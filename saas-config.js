const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
require('dotenv').config();

// Diretório onde os bancos de dados dos clientes ficarão armazenados (Fallback local)
const TENANTS_DIR = path.join(__dirname, 'tenants');

// Criar pasta de tenants se não existir
if (!fs.existsSync(TENANTS_DIR)) {
    fs.mkdirSync(TENANTS_DIR, { recursive: true });
}

// ============ CONFIGURAÇÃO POSTGRESQL (SaaS) ============
const pgConfig = {
    connectionString: process.env.DATABASE_URL || (process.env.PGUSER ? `postgres://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}` : null),
    ssl: process.env.DATABASE_URL?.includes('supabase') || process.env.DATABASE_URL?.includes('render') ? { rejectUnauthorized: false } : false
};

const pgPool = pgConfig.connectionString ? new Pool(pgConfig) : null;

if (pgPool) {
    console.log('🐘 Configuração PostgreSQL detectada. Pool pronto.');
}

// ============ CONFIGURAÇÃO SQLITE (LOCAL/LEGACY) ============
const MASTER_DB_PATH = path.join(__dirname, 'master.db');
const GLOBAL_DB_PATH = path.join(__dirname, 'syscontrole.db');

const globalDb = new sqlite3.Database(GLOBAL_DB_PATH, (err) => {
    if (err) console.error('Erro ao conectar ao globalDb:', err.message);
    else console.log('✅ Conectado ao banco SQLite Global (via config)');
});

// ============ ABSTRAÇÃO MASTER DB ============
// Criamos uma camada que redireciona para PostgreSQL se configurado, ou SQLite como fallback
let sqliteMasterDb = null;
if (!pgPool) {
    sqliteMasterDb = new sqlite3.Database(MASTER_DB_PATH);
}

const masterDb = {
    all: (sql, params = [], callback) => {
        if (typeof params === 'function') { callback = params; params = []; }
        const p = (async () => {
            if (pgPool) {
                let pgSql = sql;
                let i = 0;
                pgSql = pgSql.replace(/\?/g, () => `$${++i}`);
                const res = await pgPool.query(pgSql, params);
                return res.rows;
            } else {
                return new Promise((resolve, reject) => {
                    sqliteMasterDb.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
                });
            }
        })();
        if (callback) p.then(rows => callback(null, rows)).catch(err => callback(err));
        return p;
    },
    get: (sql, params = [], callback) => {
        if (typeof params === 'function') { callback = params; params = []; }
        const p = (async () => {
            if (pgPool) {
                let pgSql = sql;
                let i = 0;
                pgSql = pgSql.replace(/\?/g, () => `$${++i}`);
                const res = await pgPool.query(pgSql, params);
                return res.rows[0];
            } else {
                return new Promise((resolve, reject) => {
                    sqliteMasterDb.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
                });
            }
        })();
        if (callback) p.then(row => callback(null, row)).catch(err => callback(err));
        return p;
    },
    run: function(sql, params = [], callback) {
        if (typeof params === 'function') { callback = params; params = []; }
        const p = (async () => {
            if (pgPool) {
                let pgSql = sql;
                let i = 0;
                pgSql = pgSql.replace(/\?/g, () => `$${++i}`);
                const res = await pgPool.query(pgSql, params);
                return { lastID: res.oid || null, changes: res.rowCount };
            } else {
                return new Promise((resolve, reject) => {
                    sqliteMasterDb.run(sql, params, function(err) {
                        if (err) reject(err);
                        else resolve({ lastID: this.lastID, changes: this.changes });
                    });
                });
            }
        })();
        if (callback) p.then(result => callback.call(result, null)).catch(err => callback(err));
        return p;
    },
    serialize: (fn) => {
        if (pgPool) {
            // Em PG (async/await via queries), a serialização não trava o event loop
            // mas fn() precisa retornar promessa se quiser aguardar.
            // Para manter compatibilidade com callback passamos direto:
            return fn();
        } else {
            return sqliteMasterDb.serialize(fn);
        }
    }
};

// ============ INICIALIZAÇÃO DO MASTER DB ============
if (pgPool) {
    const { initPostgresMaster } = require('./pg-master-init');
    // Inicialização assíncrona que não bloqueia a exportação
    pgPool.connect().then(async (client) => {
        try {
            await initPostgresMaster(client);
        } finally {
            client.release();
        }
    }).catch(err => console.error('Erro conectando ao PG para init Master:', err));
} else {
    // Tabela Master no SQLite
    sqliteMasterDb.serialize(() => {
        sqliteMasterDb.run(`
            CREATE TABLE IF NOT EXISTS tenants (
                id TEXT PRIMARY KEY,
                nome_empresa TEXT NOT NULL,
                email TEXT UNIQUE,
                dominio TEXT UNIQUE,
                db_path TEXT NOT NULL,
                plano TEXT DEFAULT 'trial',
                ativo INTEGER DEFAULT 1,
                data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
                data_expiracao DATETIME,
                data_pagamento DATETIME,
                aviso_enviado INTEGER DEFAULT 0
            )
        `);

        sqliteMasterDb.run(`ALTER TABLE tenants ADD COLUMN email TEXT`, () => {});
        sqliteMasterDb.run(`ALTER TABLE tenants ADD COLUMN data_expiracao DATETIME`, () => {});
        sqliteMasterDb.run(`ALTER TABLE tenants ADD COLUMN data_pagamento DATETIME`, () => {});
        sqliteMasterDb.run(`ALTER TABLE tenants ADD COLUMN aviso_enviado INTEGER DEFAULT 0`, () => {});

        sqliteMasterDb.run(`
            CREATE TABLE IF NOT EXISTS solicitacoes_renovacao (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id TEXT NOT NULL,
                nome_completo TEXT NOT NULL,
                cpf TEXT NOT NULL,
                endereco TEXT NOT NULL,
                data_solicitacao DATETIME DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'pendente',
                FOREIGN KEY(tenant_id) REFERENCES tenants(id)
            )
        `);

        sqliteMasterDb.run(`
            CREATE TABLE IF NOT EXISTS usuarios_globais (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id TEXT NOT NULL,
                login TEXT NOT NULL,
                senha TEXT NOT NULL,
                nome TEXT NOT NULL,
                tipo TEXT DEFAULT 'comum',
                ativo INTEGER DEFAULT 1,
                FOREIGN KEY(tenant_id) REFERENCES tenants(id),
                UNIQUE(tenant_id, login)
            )
        `);
        
        sqliteMasterDb.get(`SELECT id FROM tenants WHERE id = 'ervanio-1234'`, (err, row) => {
            if (!err && !row) {
                const dbPath = path.join(TENANTS_DIR, 'ervanio-1234.db');
                sqliteMasterDb.run(`INSERT INTO tenants (id, nome_empresa, email, db_path, plano, ativo) VALUES (?, ?, ?, ?, ?, ?)`,
                    ['ervanio-1234', 'Ervanio Rodrigues', 'ervanio.rodrigues@gmail.com', dbPath, 'master', 1]);
                sqliteMasterDb.run(`INSERT INTO usuarios_globais (tenant_id, login, senha, nome, tipo) VALUES (?, ?, ?, ?, ?)`,
                    ['ervanio-1234', 'ervanio.rodrigues@gmail.com', '@Senha01', 'Ervanio Rodrigues', 'master']);
                console.log('✅ Tenant master do gestor criado no MasterDB (SQLite)!');
            }
        });
    });
}

module.exports = {
    TENANTS_DIR,
    MASTER_DB_PATH,
    masterDb,
    globalDb,
    pgPool
};


