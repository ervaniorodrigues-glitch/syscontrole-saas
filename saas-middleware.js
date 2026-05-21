const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');
const { TENANTS_DIR, masterDb, globalDb } = require('./saas-config');
const { initDatabase } = require('./db-init');

const asyncLocalStorage = new AsyncLocalStorage();

// Cache de conexões abertas por tenant para evitar IO exaustivo
const tenantDbConnections = {};

function getTenantDb(tenantId) {
    return new Promise((resolve, reject) => {
        if (tenantDbConnections[tenantId]) {
            return resolve(tenantDbConnections[tenantId]);
        }

        masterDb.get('SELECT * FROM tenants WHERE id = ? AND ativo = 1', [tenantId], (err, row) => {
            if (err) return reject(new Error('Erro ao validar Tenant no MasterDB'));
            if (!row) return reject(new Error('Tenant inválido ou inativo'));

            const dbPath = path.join(TENANTS_DIR, `${tenantId}.db`);
            const dbSqlite = new sqlite3.Database(dbPath, (err) => {
                if (err) return reject(new Error(`Erro ao conectar no banco do Tenant ${tenantId}`));

                // 🔥 AUTO-MIGRATE: Garante que tabelas/colunas novas (como IP e Navegador) existam imediatamente!
                try {
                    initDatabase(dbSqlite, globalDb, true); // Passa true para isTenant
                } catch (migrateErr) {
                    console.error(`⚠️ Falha na auto-migração para o Tenant ${tenantId}:`, migrateErr.message);
                }

                const dbContext = criarAbstracaoDB(dbSqlite);
                tenantDbConnections[tenantId] = dbContext;
                resolve(dbContext);
            });
        });
    });
}

function criarAbstracaoDB(dbSqlite) {
    return {
        all: (sql, params = [], callback) => {
            if (typeof params === 'function') { callback = params; params = []; }
            const p = new Promise((resolve, reject) => {
                dbSqlite.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
            });
            if (callback) p.then(rows => callback(null, rows)).catch(err => callback(err));
            return p;
        },
        get: (sql, params = [], callback) => {
            if (typeof params === 'function') { callback = params; params = []; }
            const p = new Promise((resolve, reject) => {
                dbSqlite.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
            });
            if (callback) p.then(row => callback(null, row)).catch(err => callback(err));
            return p;
        },
        run: function(sql, params = [], callback) {
            if (typeof params === 'function') { callback = params; params = []; }
            const p = new Promise((resolve, reject) => {
                dbSqlite.run(sql, params, function(err) {
                    if (err) reject(err);
                    else resolve({ lastID: this.lastID, changes: this.changes });
                });
            });
            if (callback) p.then(result => callback.call(result, null)).catch(err => callback(err));
            return p;
        },
        serialize: (fn) => dbSqlite.serialize(fn)
    };
}

async function tenantMiddleware(req, res, next) {
    // Arquivos estáticos e páginas HTML passam direto — o frontend controla a sessão
    const isStaticFile = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|otf|map|html)$/i.test(req.path);
    const isRootPage = req.path === '/' || req.path === '';
    const isSaasRoute = req.path.startsWith('/api/saas');
    // Rota de foto aceita tenant via query string — agora ela SERÁ processada pelo middleware para carregar o banco correto
    const isFotoRoute = req.path.startsWith('/api/foto/');

    if (isStaticFile || isRootPage || isSaasRoute) {
        return next();
    }

    // Apenas rotas de API precisam do tenant
    if (!req.path.startsWith('/api/') && !isFotoRoute) {
        return next();
    }

    // 🚀 IDENTIFICAR TENANT (FLEXÍVEL PARA LOCAL/SaaS)
    // Prioridade máxima: Header 'x-tenant-id'
    // 🔥 NOTA CRÍTICA: Ignoramos parâmetros '?t=' inteiramente numéricos, pois são CACHE-BUSTERS gerados pelo navegador/JS!
    let queryTenant = req.query['tenant-id'] || req.query['tenant_id'];
    
    // Permitir 't' como fallback apenas se não for numérico (ou seja, for uma string como 'ervanio-1234')
    if (!queryTenant && req.query['t'] && isNaN(Number(req.query['t']))) {
        queryTenant = req.query['t'];
    }
    
    let tenantId = req.headers['x-tenant-id'] || queryTenant || 'ervanio-1234';
    
    // ⭐ SUPORTE DE LEGADO: Migrar sessões ativas antigas transparentemente sem forçar logout
    if (tenantId === 'ervanio_master') {
        tenantId = 'ervanio-1234';
    }

    try {
        // Obter conexão isolada para este tenant
        const db = await getTenantDb(tenantId);
        req.tenantId = tenantId;
        
        // 🟢 REGISTRAR ATIVIDADE ONLINE DO TENANT (Real-time)
        global.activeTenants = global.activeTenants || {};
        global.activeTenants[tenantId] = Date.now();
        
        // Injetar contexto no storage assíncrono para que o proxy 'db' em server.js o utilize
        asyncLocalStorage.run(db, () => {
            next();
        });
    } catch (err) {
        // Se houver erro crítico (ex: tenant não existe), logar e seguir para o global
        console.error(`⚠️ Tenant ${tenantId} não disponível:`, err.message);
        next(); 
    }
}

module.exports = {
    tenantMiddleware,
    getTenantDb,
    asyncLocalStorage
};
