const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
require('dotenv').config();

// Diretório onde os bancos de dados dos clientes ficarão armazenados
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
// O Master DB guarda os Logins Globais e a relação Empresa -> Banco de Dados Isolado
const MASTER_DB_PATH = path.join(__dirname, 'master.db');
const masterDb = new sqlite3.Database(MASTER_DB_PATH);

// O Global DB guarda os logs de rastreamento e é o banco principal (fallback)
const GLOBAL_DB_PATH = path.join(__dirname, 'syscontrole.db');
const globalDb = new sqlite3.Database(GLOBAL_DB_PATH, (err) => {
    if (err) console.error('Erro ao conectar ao globalDb:', err.message);
    else console.log('✅ Conectado ao banco SQLite Global (via config)');
});

// Tabela Master
masterDb.serialize(() => {
    // Tabela de Locatários (Empresas/Assinantes)
    masterDb.run(`
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

    // Migração: adicionar colunas novas se não existirem (para bancos já criados)
    masterDb.run(`ALTER TABLE tenants ADD COLUMN email TEXT`, () => {});
    masterDb.run(`ALTER TABLE tenants ADD COLUMN data_expiracao DATETIME`, () => {});
    masterDb.run(`ALTER TABLE tenants ADD COLUMN data_pagamento DATETIME`, () => {});
    masterDb.run(`ALTER TABLE tenants ADD COLUMN aviso_enviado INTEGER DEFAULT 0`, () => {});

    // Tabela de solicitações de renovação
    masterDb.run(`
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

    // Tabela Global de Usuários (Login via portal unificado)
    masterDb.run(`
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
    
    // Garantir que o tenant master do gestor existe
    masterDb.get(`SELECT id FROM tenants WHERE id = 'ervanio-1234'`, (err, row) => {
        if (!err && !row) {
            const dbPath = path.join(TENANTS_DIR, 'ervanio-1234.db');
            masterDb.run(`INSERT INTO tenants (id, nome_empresa, email, db_path, plano, ativo) VALUES (?, ?, ?, ?, ?, ?)`,
                ['ervanio-1234', 'Ervanio Rodrigues', 'ervanio.rodrigues@gmail.com', dbPath, 'master', 1]);
            masterDb.run(`INSERT INTO usuarios_globais (tenant_id, login, senha, nome, tipo) VALUES (?, ?, ?, ?, ?)`,
                ['ervanio-1234', 'ervanio.rodrigues@gmail.com', '@Senha01', 'Ervanio Rodrigues', 'master']);
            console.log('✅ Tenant master do gestor criado no MasterDB!');
        }
    });
});

module.exports = {
    TENANTS_DIR,
    MASTER_DB_PATH,
    masterDb,
    globalDb,
    pgPool
};

