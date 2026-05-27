const express = require('express');
const path = require('path');
const fs = require('fs');
const { masterDb, globalDb, TENANTS_DIR } = require('./saas-config');
const { initDatabase, initDatabasePromise } = require('./db-init');

const router = express.Router();

// ROTA TEMPORÁRIA: Corrigir plano da Infovanio
router.get('/fix-infovanio', async (req, res) => {
    const { pgPool } = require('./saas-config');
    try {
        const expiracao = new Date();
        expiracao.setDate(expiracao.getDate() + 30);
        if (pgPool) {
            await pgPool.query(
                `UPDATE public.tenants SET plano = $1, data_expiracao = $2 WHERE id = $3`,
                ['trial', expiracao.toISOString(), 'infovanio-ltda-3068']
            );
        }
        res.json({ success: true, message: 'Infovanio corrigida para trial' });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

router.post('/client-log', (req, res) => {
    console.error('❌ [CLIENT ERR]', req.body);
    res.status(204).end();
});

// ============ HELPERS ============

// Calcula dias restantes do trial
function diasRestantes(dataExpiracao) {
    if (!dataExpiracao) return 0;
    const agora = new Date();
    const expira = new Date(dataExpiracao);
    const diff = expira - agora;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ============ LOGIN UNIFICADO (SaaS) ============
router.post('/login', (req, res) => {
    const { login, senha, tenant_code } = req.body;

    if (!login || !senha) {
        return res.status(400).json({ success: false, message: 'Login e senha obrigatórios.' });
    }

    // ---- FLUXO 2: Usuário interno (funcionário liberado pelo master) ----
    if (tenant_code) {
        masterDb.get(`SELECT * FROM tenants WHERE (LOWER(id) = LOWER(?) OR LOWER(email) = LOWER(?)) AND ativo = 1`, [tenant_code, tenant_code], async (err, tenant) => {
            if (err || !tenant) {
                return res.status(401).json({ success: false, message: 'Código da empresa inválido ou empresa inativa.' });
            }

            try {
                const { pgPool } = require('./saas-config');
                let user;

                if (pgPool) {
                    // Modo PostgreSQL — usar schema do tenant
                    const { getPgTenantDb } = require('./pg-tenant-utils');
                    const tenantDb = getPgTenantDb(pgPool, tenant.id);
                    user = await tenantDb.get(
                        `SELECT * FROM USUARIOS_TENANT WHERE LOWER(login) = LOWER(?) AND senha = ? AND ativo = 1`,
                        [login, senha]
                    );
                } else {
                    // Modo SQLite
                    const sqlite3 = require('sqlite3').verbose();
                    const dbPath = path.isAbsolute(tenant.db_path) ? tenant.db_path : path.join(__dirname, tenant.db_path);
                    user = await new Promise((resolve, reject) => {
                        const tenantDb = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (dbErr) => {
                            if (dbErr) return reject(dbErr);
                            tenantDb.get(
                                `SELECT * FROM USUARIOS_TENANT WHERE LOWER(login) = LOWER(?) AND senha = ? AND ativo = 1`,
                                [login, senha],
                                (queryErr, row) => {
                                    tenantDb.close();
                                    if (queryErr) return reject(queryErr);
                                    resolve(row);
                                }
                            );
                        });
                    });
                }

                if (!user) {
                    return res.status(401).json({ success: false, message: 'Login ou senha incorretos.' });
                }

                // Normalizar campos (PG retorna lowercase)
                const userId = user.id;
                const userLogin = user.login;
                const userNome = user.nome || user.Nome || user.NOME;
                const userTipo = user.tipo || user.Tipo;

                const ipAtual = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
                verificarSessaoAtiva(login, tenant.id, ipAtual, (sessErr, sessao) => {
                    if (sessao) {
                        return res.status(401).json({
                            success: false,
                            code: 'CONCURRENT_SESSION',
                            message: 'ESTA CONTA JÁ POSSUI UMA SESSÃO ATIVA. Encerre o outro acesso.'
                        });
                    }
                    return res.json({
                        success: true,
                        user: {
                            id: userId,
                            tenant_id: tenant.id,
                            login: userLogin,
                            nome: userNome,
                            tipo: userTipo,
                            empresa: tenant.nome_empresa || tenant.nome_empresa,
                            plano: tenant.plano
                        }
                    });
                });
            } catch (e) {
                console.error('Erro login interno (Flow 2):', e.message);
                return res.status(500).json({ success: false, message: 'Erro ao autenticar.' });
            }
        });
        return;
    }

    // ---- FLUXO 1: Master (e-mail/senha via usuarios_globais) ----
    // ⭐ BLOQUEIO RÍGIDO AQUI TAMBÉM: Verificar se já existe sessão ativa
    // Usamos o checkout do masterDb para encontrar o tenant primeiro
    masterDb.get(`
        SELECT u.*, t.nome_empresa, t.ativo as tenant_ativo, t.plano, t.data_expiracao
        FROM usuarios_globais u
        JOIN tenants t ON u.tenant_id = t.id
        WHERE LOWER(u.login) = LOWER(?) AND u.senha = ?
    `, [login, senha], (err, row) => {
        if (err) {
            console.error('Erro no login SaaS:', err);
            return res.status(500).json({ success: false, message: 'Erro no servidor.' });
        }

        if (!row) {
            return res.status(401).json({ success: false, message: 'E-mail ou senha incorretos.' });
        }

        const ipAtual = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        verificarSessaoAtiva(login, row.tenant_id, ipAtual, (sessErr, sessao) => {
            if (sessao) {
                console.log(`🚫 Tentativa de login duplicado bloqueada (Unified Master): ${login}`);
                return res.status(401).json({ 
                    success: false, 
                    code: 'CONCURRENT_SESSION',
                    message: 'ESTA CONTA JÁ POSSUI UMA SESSÃO ATIVA. Encerre o outro acesso.' 
                });
            }

            if (row.ativo === 0) {
            return res.status(401).json({ success: false, message: 'Conta desativada. Contate o suporte.' });
        }

        // Verificar trial/expiração (exceto plano master/pago)
        if (row.plano === 'trial') {
            const dias = diasRestantes(row.data_expiracao);

            if (dias <= 0) {
                return res.status(403).json({
                    success: false,
                    bloqueado: true,
                    tenant_id: row.tenant_id,
                    message: 'Seu período de teste expirou. Preencha seus dados e faça o pagamento via PIX para continuar.',
                    pix: '11945760912',
                    whatsapp: '5511945760912'
                });
            }

            // Aviso quando faltam 5 dias ou menos (SOMENTE PARA MASTER)
            const aviso = (dias <= 5 && row.tipo === 'master') ? {
                dias_restantes: dias,
                message: `Seu acesso expira em ${dias} dia(s). Para continuar, faça o pagamento via PIX.`,
                pix: '11945760912',
                whatsapp: '5511945760912'
            } : null;

            return res.json({
                success: true,
                aviso,
                user: {
                    id: row.id,
                    tenant_id: row.tenant_id,
                    login: row.login,
                    nome: row.nome,
                    tipo: row.tipo,
                    empresa: row.nome_empresa,
                    plano: row.plano,
                    dias_restantes: dias
                }
            });
        }

        // Plano pago ou master — verificar se tenant está ativo
        if (row.tenant_ativo === 0) {
            return res.status(401).json({ success: false, message: 'Empresa desativada. Contate o suporte financeiro.' });
        }

        // Registrar login como atividade online
        global.activeTenants = global.activeTenants || {};
        global.activeTenants[row.tenant_id] = Date.now();

        res.json({
            success: true,
            user: {
                id: row.id,
                tenant_id: row.tenant_id,
                login: row.login,
                nome: row.nome,
                tipo: row.tipo,
                empresa: row.nome_empresa,
                plano: row.plano
            }
        });
    }); // FECHA verificarSessaoAtiva
}); // FECHA masterDb.get
}); // FECHA router.post

// Helper para gerar ID de Tenant único no formato: empresa-1234
async function gerarTenantIdUnico(nome_empresa) {
    const cleanName = nome_empresa.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
        .replace(/[^a-z0-9]+/g, '-') // substitui espaços/chars por hífen
        .replace(/^-+|-+$/g, ''); // limpa hífens no início/fim

    let tentativas = 0;
    while (tentativas < 15) {
        const num = Math.floor(1000 + Math.random() * 9000); // 4 dígitos aleatórios
        const id = `${cleanName}-${num}`;
        
        const existe = await new Promise((resolve) => {
            masterDb.get('SELECT id FROM tenants WHERE id = ?', [id], (err, row) => {
                resolve(!!row);
            });
        });
        
        if (!existe) return id;
        tentativas++;
    }
    // Fallback seguro caso todas as tentativas colidam
    return `${cleanName}-${Date.now().toString().slice(-4)}`;
}

function copiarConfiguracoesDeModelo(modelDbPath, targetDb) {
    return new Promise((resolve) => {
        if (!fs.existsSync(modelDbPath)) {
            console.log(`⚠️ Banco modelo não encontrado em ${modelDbPath}. Mantendo configurações padrão.`);
            return resolve();
        }

        const sqlite3 = require('sqlite3').verbose();
        const modelDb = new sqlite3.Database(modelDbPath, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                console.error('Erro ao abrir banco modelo:', err.message);
                return resolve();
            }

            modelDb.serialize(() => {
                // 1. Copiar HABILITAR_CURSOS
                modelDb.all('SELECT curso, habilitado FROM HABILITAR_CURSOS', [], (err, rows) => {
                    if (!err && rows && rows.length > 0) {
                        targetDb.serialize(() => {
                            targetDb.run('DELETE FROM HABILITAR_CURSOS');
                            rows.forEach(row => {
                                targetDb.run('INSERT INTO HABILITAR_CURSOS (curso, habilitado) VALUES (?, ?)', [row.curso, row.habilitado]);
                            });
                            console.log(`[MODELO] ${rows.length} cursos copiados de ${path.basename(modelDbPath)}`);
                        });
                    } else if (err) {
                        console.error('Erro ao ler HABILITAR_CURSOS do modelo:', err.message);
                    }
                });

                // 2. Copiar configuracao_relatorio
                modelDb.all('SELECT titulo, rodape, logo, tecnico_seguranca, epi_itens_padrao FROM configuracao_relatorio', [], (err, rows) => {
                    if (!err && rows && rows.length > 0) {
                        targetDb.serialize(() => {
                            targetDb.run('DELETE FROM configuracao_relatorio');
                            rows.forEach(row => {
                                targetDb.run(
                                    'INSERT INTO configuracao_relatorio (titulo, rodape, logo, tecnico_seguranca, epi_itens_padrao) VALUES (?, ?, ?, ?, ?)',
                                    [row.titulo, row.rodape, row.logo, row.tecnico_seguranca, row.epi_itens_padrao]
                                );
                            });
                            console.log(`[MODELO] Configurações de relatório copiadas de ${path.basename(modelDbPath)}`);
                        });
                    } else if (err) {
                        console.error('Erro ao ler configuracao_relatorio do modelo:', err.message);
                    }
                });

                // 3. Copiar configuracao_nrs
                modelDb.all('SELECT nr, dados FROM configuracao_nrs', [], (err, rows) => {
                    if (!err && rows && rows.length > 0) {
                        targetDb.serialize(() => {
                            targetDb.run('DELETE FROM configuracao_nrs');
                            rows.forEach(row => {
                                targetDb.run('INSERT INTO configuracao_nrs (nr, dados) VALUES (?, ?)', [row.nr, row.dados]);
                            });
                            console.log(`[MODELO] ${rows.length} configurações de NRs copiadas de ${path.basename(modelDbPath)}`);
                        });
                    } else if (err) {
                        console.error('Erro ao ler configuracao_nrs do modelo:', err.message);
                    }
                });

                // Finalizar e fechar
                modelDb.get('SELECT 1', () => {
                    modelDb.close(() => {
                        targetDb.serialize(() => {
                            targetDb.get('SELECT 1', () => {
                                resolve();
                            });
                        });
                    });
                });
            });
        });
    });
}

// ============ CADASTRO DE NOVA EMPRESA (TRIAL 30 DIAS) ============
router.post('/registrar', async (req, res) => {
    const { nome_empresa, email, senha } = req.body;
    const { pgPool } = require('./saas-config');
    const { initTenantSchema, getPgTenantDb } = require('./pg-tenant-utils');

    if (!nome_empresa || !email || !senha) {
        return res.status(400).json({ success: false, message: 'Preencha todos os campos.' });
    }

    // Verificar se e-mail já existe
    masterDb.get('SELECT id FROM tenants WHERE email = ?', [email], async (err, existe) => {
        if (err) return res.status(500).json({ success: false, message: 'Erro interno.' });
        if (existe) return res.status(400).json({ success: false, message: 'Este e-mail já está cadastrado.' });

        const tenantId = await gerarTenantIdUnico(nome_empresa);
        const dbPath = path.join(TENANTS_DIR, `${tenantId}.db`);

        // Data de expiração: 30 dias a partir de hoje
        const dataExpiracao = new Date();
        dataExpiracao.setDate(dataExpiracao.getDate() + 30);

        try {
            if (pgPool) {
                // Fluxo PostgreSQL
                const client = await pgPool.connect();
                try {
                    await client.query('BEGIN');
                    await client.query(
                        `INSERT INTO tenants (id, nome_empresa, email, db_path, plano, ativo, data_expiracao) VALUES ($1, $2, $3, $4, 'trial', 1, $5)`,
                        [tenantId, nome_empresa, email, tenantId, dataExpiracao.toISOString()]
                    );
                    await client.query(
                        `INSERT INTO usuarios_globais (tenant_id, login, senha, nome, tipo) VALUES ($1, $2, $3, $4, 'master')`,
                        [tenantId, email, senha, nome_empresa]
                    );
                    await client.query('COMMIT');
                    
                    // Inicializar schema do novo tenant
                    await initTenantSchema(pgPool, tenantId);
                    
                    // Inserir usuário master no tenant e copiar configurações (simulado aqui)
                    const pgTenantDb = getPgTenantDb(pgPool, tenantId);
                    await pgTenantDb.run(`CREATE TABLE IF NOT EXISTS USUARIOS_TENANT (
                        id SERIAL PRIMARY KEY,
                        login TEXT NOT NULL UNIQUE, senha TEXT NOT NULL,
                        nome TEXT NOT NULL, tipo TEXT DEFAULT 'comum', ativo INTEGER DEFAULT 1
                    )`);
                    await pgTenantDb.run(
                        `INSERT INTO USUARIOS_TENANT (login, senha, nome, tipo, ativo) VALUES (?, ?, ?, 'master', 1) ON CONFLICT(login) DO NOTHING`,
                        [email, senha, nome_empresa]
                    );

                    console.log(`✅ Novo tenant PG criado: ${tenantId} (${email}) - Trial até ${dataExpiracao.toLocaleDateString('pt-BR')}`);
                    return res.json({
                        success: true,
                        message: 'Empresa cadastrada! Você tem 30 dias de acesso gratuito.',
                        tenant_id: tenantId,
                        expiracao: dataExpiracao.toISOString()
                    });
                } catch (pgErr) {
                    await client.query('ROLLBACK');
                    console.error('Erro no cadastro PG:', pgErr);
                    return res.status(500).json({ success: false, message: 'Erro ao criar empresa no banco de dados.' });
                } finally {
                    client.release();
                }
            } else {
                // Fluxo SQLite (Legado)
                masterDb.serialize(() => {
                    masterDb.run('BEGIN TRANSACTION');

                    masterDb.run(
                        `INSERT INTO tenants (id, nome_empresa, email, db_path, plano, ativo, data_expiracao) VALUES (?, ?, ?, ?, 'trial', 1, ?)`,
                        [tenantId, nome_empresa, email, dbPath, dataExpiracao.toISOString()],
                        (err) => {
                            if (err) {
                                masterDb.run('ROLLBACK');
                                return res.status(500).json({ success: false, message: 'Erro ao criar empresa.' });
                            }

                            masterDb.run(
                                `INSERT INTO usuarios_globais (tenant_id, login, senha, nome, tipo) VALUES (?, ?, ?, ?, 'master')`,
                                [tenantId, email, senha, nome_empresa],
                                (err) => {
                                    if (err) {
                                        masterDb.run('ROLLBACK');
                                        return res.status(500).json({ success: false, message: 'Erro ao criar usuário.' });
                                    }

                                    // Criar banco zerado para o novo tenant (sem herdar dados de ninguém)
                                    const sqlite3 = require('sqlite3').verbose();
                                    const novoDb = new sqlite3.Database(dbPath);
                                    
                                    (async () => {
                                        try {
                                            // 1. Inicializar tabelas e índices
                                            await initDatabasePromise(novoDb, globalDb, true);
                                            
                                            // 2. Criar tabela de usuários do tenant (obrigatória para login) e inserir usuário master
                                            await new Promise((resolve, reject) => {
                                                novoDb.serialize(() => {
                                                    novoDb.run(`CREATE TABLE IF NOT EXISTS USUARIOS_TENANT (
                                                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                        login TEXT NOT NULL UNIQUE, senha TEXT NOT NULL,
                                                        nome TEXT NOT NULL, tipo TEXT DEFAULT 'comum', ativo INTEGER DEFAULT 1
                                                    )`);
                                                    novoDb.run(
                                                        `INSERT OR IGNORE INTO USUARIOS_TENANT (id, login, senha, nome, tipo, ativo) VALUES (1, ?, ?, ?, 'master', 1)`,
                                                        [email, senha, nome_empresa]
                                                    );
                                                    novoDb.get('SELECT 1', (err) => err ? reject(err) : resolve());
                                                });
                                            });

                                            // 3. Copiar configurações do banco modelo (ervanio-1234.db) se existir
                                            const modelDbPath = path.join(TENANTS_DIR, 'ervanio-1234.db');
                                            await copiarConfiguracoesDeModelo(modelDbPath, novoDb);

                                            console.log(`[REGISTRAR] Banco de dados do tenant ${tenantId} totalmente inicializado e configurado.`);
                                        } catch (initErr) {
                                            console.error(`❌ Erro ao inicializar banco do tenant ${tenantId}:`, initErr);
                                        } finally {
                                            novoDb.close((err) => {
                                                if (err) console.error(`Erro ao fechar banco do tenant ${tenantId}:`, err.message);
                                                else console.log(`[REGISTRAR] Banco do tenant ${tenantId} fechado com sucesso.`);
                                            });
                                        }
                                    })();

                                    masterDb.run('COMMIT');
                                    console.log(`✅ Novo tenant criado: ${tenantId} (${email}) - Trial até ${dataExpiracao.toLocaleDateString('pt-BR')}`);

                                    return res.json({
                                        success: true,
                                        message: 'Empresa cadastrada! Você tem 30 dias de acesso gratuito.',
                                        tenant_id: tenantId,
                                        expiracao: dataExpiracao.toISOString()
                                    });
                                }
                            );
                        }
                    );
                });
            }
        } catch (e) {
            console.error('Erro na rota registrar:', e);
            return res.status(500).json({ success: false, message: 'Erro no servidor.' });
        }
    });
});

// Helper para verificar sessões ativas (BLOQUEIO DESATIVADO)
const verificarSessaoAtiva = (usuario, tenant_id, ipAtual, callback) => {
    // ⭐ BLOQUEIO REMOVIDO: Sempre permite o acesso
    return callback(null, null); 
};

// ============ VERIFICAR STATUS DO TENANT (usado pelo frontend) ============
router.get('/status/:tenantId', (req, res) => {
    masterDb.get('SELECT plano, data_expiracao, ativo, nome_empresa FROM tenants WHERE id = ?', [req.params.tenantId], (err, row) => {
        if (err || !row) return res.status(404).json({ success: false });

        const dias = row.plano === 'trial' ? diasRestantes(row.data_expiracao) : null;
        res.json({
            success: true,
            plano: row.plano,
            ativo: row.ativo === 1,
            dias_restantes: dias,
            expirado: row.plano === 'trial' && dias <= 0
        });
    });
});

// ============ CONFIGURAÇÃO E LOGIN DO GESTOR ============
const CONFIG_FILE = path.join(__dirname, 'gestor-config.json');
let gestorConfig = { 
    email: process.env.GESTOR_EMAIL || 'ervanio.rodrigues@gmail.com', 
    senha: process.env.GESTOR_SENHA || '@Senha01'
};

function carregarConfig() {
    try {
        // Variáveis de ambiente SEMPRE têm prioridade absoluta
        if (process.env.GESTOR_EMAIL) gestorConfig.email = process.env.GESTOR_EMAIL;
        if (process.env.GESTOR_SENHA) gestorConfig.senha = process.env.GESTOR_SENHA;
    } catch (e) {
        console.error('Erro ao carregar config do gestor:', e.message);
    }
}
function salvarConfig() {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(gestorConfig, null, 2));
    } catch (e) {
        console.error('Erro ao salvar gestor-config.json:', e.message);
    }
}
carregarConfig();

function verificarGestor(req, res, next) {
    const senha = req.headers['x-gestor-senha'];
    const email = req.headers['x-gestor-email'];

    carregarConfig();

    // Aceita senha com ou sem @ no início (para compatibilidade com Render)
    const senhaConfig = gestorConfig.senha;
    const senhaMatch = senha === senhaConfig || 
                       senha === senhaConfig.replace(/^@/, '') ||
                       '@' + senha === senhaConfig;

    if (!senhaMatch || email !== gestorConfig.email) {
        return res.status(401).json({ success: false, message: 'Acesso negado.' });
    }
    next();
}

// GESTOR — Esqueci minha senha (Senha Provisória)
router.post('/gestor/esqueci-senha', (req, res) => {
    const { email } = req.body;
    if (email !== gestorConfig.email) {
        return res.status(400).json({ success: false, message: 'E-mail não reconhecido.' });
    }

    const senhaProvisoria = 'Tmp' + Math.random().toString(36).slice(-4).toUpperCase();
    gestorConfig.senha = senhaProvisoria;
    salvarConfig();

    console.log(`\n📧 SIMULAÇÃO DE E-MAIL PARA: ${email}`);
    console.log(`Sua nova senha provisória é: ${senhaProvisoria}\n`);

    res.json({ 
        success: true, 
        message: 'Uma senha provisória foi gerada para o seu e-mail.',
        simulacao: `Sua senha provisória é: ${senhaProvisoria}` // Para o usuário ver no frontend já que não temos SMTP real
    });
});

// GESTOR — Alterar Senha (após logado)
router.post('/gestor/alterar-senha', verificarGestor, (req, res) => {
    const { novaSenha } = req.body;
    if (!novaSenha || novaSenha.length < 4) {
        return res.status(400).json({ success: false, message: 'Senha muito curta.' });
    }

    gestorConfig.senha = novaSenha;
    salvarConfig();
    res.json({ success: true, message: 'Senha alterada com sucesso!' });
});

router.get('/gestor/tenants', verificarGestor, async (req, res) => {
    const { pgPool } = require('./saas-config');
    
    const sql = `
        SELECT t.id, t.nome_empresa, t.email, t.plano, t.ativo, t.data_cadastro, t.data_expiracao, t.data_pagamento,
               COUNT(u.id) as total_usuarios
        FROM tenants t
        LEFT JOIN usuarios_globais u ON u.tenant_id = t.id
        GROUP BY t.id, t.nome_empresa, t.email, t.plano, t.ativo, t.data_cadastro, t.data_expiracao, t.data_pagamento
        ORDER BY t.data_cadastro DESC
    `;

    try {
        let rows;
        if (pgPool) {
            const client = await pgPool.connect();
            try {
                const result = await client.query(sql);
                rows = result.rows;
            } finally {
                client.release();
            }
        } else {
            rows = await new Promise((resolve, reject) => {
                masterDb.all(sql, [], (err, r) => err ? reject(err) : resolve(r));
            });
        }

        global.activeTenants = global.activeTenants || {};
        const lista = rows.map(r => {
            const lastActive = global.activeTenants[r.id] || 0;
            const isOnline = (Date.now() - lastActive) < 120000;
            return {
                ...r,
                online: isOnline,
                dias_restantes: r.plano === 'trial' ? diasRestantes(r.data_expiracao) : null,
                expirado: r.plano === 'trial' && diasRestantes(r.data_expiracao) <= 0
            };
        });

        res.json({ success: true, data: lista });
    } catch (err) {
        console.error('Erro ao buscar tenants:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GESTOR — Liberar acesso pago para um tenant
router.post('/gestor/liberar/:tenantId', verificarGestor, async (req, res) => {
    const { tenantId } = req.params;
    const { plano } = req.body;
    const { pgPool } = require('./saas-config');
    const novaExpiracao = new Date();
    novaExpiracao.setDate(novaExpiracao.getDate() + 30);

    try {
        if (pgPool) {
            const client = await pgPool.connect();
            try {
                await client.query(`UPDATE tenants SET plano = $1, ativo = 1, data_expiracao = $2, data_pagamento = $3 WHERE id = $4`,
                    [plano || 'pago', novaExpiracao.toISOString(), new Date().toISOString(), tenantId]);
            } finally { client.release(); }
        } else {
            await new Promise((resolve, reject) => masterDb.run(
                `UPDATE tenants SET plano = ?, ativo = 1, data_expiracao = ?, data_pagamento = ? WHERE id = ?`,
                [plano || 'pago', novaExpiracao.toISOString(), new Date().toISOString(), tenantId],
                (err) => err ? reject(err) : resolve()
            ));
        }
        res.json({ success: true, message: 'Acesso liberado com sucesso!', nova_expiracao: novaExpiracao.toISOString() });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GESTOR — Bloquear/desativar tenant
router.post('/gestor/bloquear/:tenantId', verificarGestor, async (req, res) => {
    const { pgPool } = require('./saas-config');
    try {
        if (pgPool) {
            const client = await pgPool.connect();
            try { await client.query(`UPDATE tenants SET ativo = 0 WHERE id = $1`, [req.params.tenantId]); }
            finally { client.release(); }
        } else {
            await new Promise((resolve, reject) => masterDb.run(`UPDATE tenants SET ativo = 0 WHERE id = ?`, [req.params.tenantId], (err) => err ? reject(err) : resolve()));
        }
        res.json({ success: true, message: 'Empresa bloqueada.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GESTOR — Estender trial de um tenant
router.post('/gestor/estender/:tenantId', verificarGestor, async (req, res) => {
    const { dias } = req.body;
    const diasExtender = parseInt(dias) || 30;
    const { pgPool } = require('./saas-config');

    try {
        let row;
        if (pgPool) {
            const client = await pgPool.connect();
            try {
                const r = await client.query('SELECT data_expiracao FROM tenants WHERE id = $1', [req.params.tenantId]);
                row = r.rows[0];
            } finally { client.release(); }
        } else {
            row = await new Promise((resolve, reject) => masterDb.get('SELECT data_expiracao FROM tenants WHERE id = ?', [req.params.tenantId], (err, r) => err ? reject(err) : resolve(r)));
        }

        if (!row) return res.status(404).json({ success: false });
        const base = row.data_expiracao && new Date(row.data_expiracao) > new Date() ? new Date(row.data_expiracao) : new Date();
        base.setDate(base.getDate() + diasExtender);

        if (pgPool) {
            const client = await pgPool.connect();
            try { await client.query(`UPDATE tenants SET data_expiracao = $1, data_pagamento = $2, ativo = 1 WHERE id = $3`, [base.toISOString(), new Date().toISOString(), req.params.tenantId]); }
            finally { client.release(); }
        } else {
            await new Promise((resolve, reject) => masterDb.run(`UPDATE tenants SET data_expiracao = ?, data_pagamento = ?, ativo = 1 WHERE id = ?`, [base.toISOString(), new Date().toISOString(), req.params.tenantId], (err) => err ? reject(err) : resolve()));
        }
        res.json({ success: true, message: `Trial estendido por ${diasExtender} dias.`, nova_expiracao: base.toISOString() });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ============ SOLICITAÇÃO DE RENOVAÇÃO (enviada pelo usuário) ============
router.post('/renovacao/solicitar', (req, res) => {
    const { tenant_id, nome_completo, cpf, endereco } = req.body;

    if (!tenant_id || !nome_completo || !cpf || !endereco) {
        return res.status(400).json({ success: false, message: 'Preencha todos os campos.' });
    }

    // Verificar se já tem solicitação pendente
    masterDb.get(
        `SELECT id FROM solicitacoes_renovacao WHERE tenant_id = ? AND status = 'pendente'`,
        [tenant_id],
        (err, existe) => {
            if (existe) {
                return res.json({ success: true, ja_enviado: true, message: 'Solicitação já enviada. Aguarde a aprovação do gestor.' });
            }

            masterDb.run(
                `INSERT INTO solicitacoes_renovacao (tenant_id, nome_completo, cpf, endereco) VALUES (?, ?, ?, ?)`,
                [tenant_id, nome_completo, cpf, endereco],
                function(err) {
                    if (err) return res.status(500).json({ success: false, error: err.message });
                    console.log(`📋 Nova solicitação de renovação: ${nome_completo} (${tenant_id})`);
                    res.json({ success: true, message: 'Solicitação enviada! Aguarde a aprovação.' });
                }
            );
        }
    );
});

// GESTOR — Listar solicitações pendentes
router.get('/gestor/solicitacoes', verificarGestor, (req, res) => {
    masterDb.all(`
        SELECT s.*, t.nome_empresa, t.email, t.plano, t.data_expiracao
        FROM solicitacoes_renovacao s
        JOIN tenants t ON s.tenant_id = t.id
        ORDER BY s.data_solicitacao DESC
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, data: rows || [] });
    });
});

// GESTOR — Aprovar solicitação (libera acesso pago)
router.post('/gestor/solicitacoes/aprovar/:id', verificarGestor, (req, res) => {
    const { id } = req.params;

    masterDb.get(`SELECT * FROM solicitacoes_renovacao WHERE id = ?`, [id], (err, sol) => {
        if (err || !sol) return res.status(404).json({ success: false, message: 'Solicitação não encontrada.' });

        const novaExpiracao = new Date();
        novaExpiracao.setDate(novaExpiracao.getDate() + 30);

        masterDb.run(
            `UPDATE tenants SET plano = 'pago', ativo = 1, data_expiracao = ?, data_pagamento = ? WHERE id = ?`,
            [novaExpiracao.toISOString(), new Date().toISOString(), sol.tenant_id],
            (err) => {
                if (err) return res.status(500).json({ success: false, error: err.message });

                masterDb.run(
                    `UPDATE solicitacoes_renovacao SET status = 'aprovado' WHERE id = ?`,
                    [id],
                    (err) => {
                        if (err) return res.status(500).json({ success: false });
                        console.log(`✅ Solicitação ${id} aprovada — tenant ${sol.tenant_id} liberado`);
                        res.json({ success: true, message: 'Acesso liberado com sucesso!' });
                    }
                );
            }
        );
    });
});

// GESTOR — Rejeitar solicitação
router.post('/gestor/solicitacoes/rejeitar/:id', verificarGestor, (req, res) => {
    masterDb.run(
        `UPDATE solicitacoes_renovacao SET status = 'rejeitado' WHERE id = ?`,
        [req.params.id],
        function(err) {
            if (err) return res.status(500).json({ success: false });
            res.json({ success: true, message: 'Solicitação rejeitada.' });
        }
    );
});

// GESTOR — Deletar tenant (remove do master.db e apaga o banco de dados)
router.delete('/gestor/deletar/:tenantId', verificarGestor, (req, res) => {
    const { tenantId } = req.params;

    masterDb.get('SELECT * FROM tenants WHERE id = ?', [tenantId], (err, tenant) => {
        if (err || !tenant) return res.status(404).json({ success: false, message: 'Empresa não encontrada.' });

        if (tenant.ativo === 1) {
            return res.status(400).json({ success: false, message: 'Não é possível deletar uma empresa ATIVA. Bloqueie primeiro.' });
        }

        // Deletar usuários globais do tenant
        masterDb.run('DELETE FROM usuarios_globais WHERE tenant_id = ?', [tenantId], (err) => {
            if (err) return res.status(500).json({ success: false, error: err.message });

            // Deletar solicitações de renovação
            masterDb.run('DELETE FROM solicitacoes_renovacao WHERE tenant_id = ?', [tenantId], () => {});

            // Deletar o tenant do master
            masterDb.run('DELETE FROM tenants WHERE id = ?', [tenantId], (err) => {
                if (err) return res.status(500).json({ success: false, error: err.message });

                // Apagar o arquivo .db da empresa
                const dbPath = tenant.db_path;
                try {
                    if (require('fs').existsSync(dbPath)) {
                        require('fs').unlinkSync(dbPath);
                        console.log(`🗑️ Banco deletado: ${dbPath}`);
                    }
                } catch (e) {
                    console.error('Aviso: não foi possível apagar o arquivo .db:', e.message);
                }

                console.log(`✅ Tenant deletado: ${tenantId} (${tenant.nome_empresa})`);
                res.json({ success: true, message: `Empresa "${tenant.nome_empresa}" deletada permanentemente.` });
            });
        });
    });
});

module.exports = router;
