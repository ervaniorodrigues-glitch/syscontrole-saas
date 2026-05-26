/**
 * Inicialização das tabelas globais (Master) no PostgreSQL
 */

async function initPostgresMaster(client) {
    console.log('🚀 Inicializando tabelas Master no PostgreSQL...');

    const queries = [
        // 1. Tabela de Locatários (Empresas/Assinantes)
        `CREATE TABLE IF NOT EXISTS tenants (
            id TEXT PRIMARY KEY,
            nome_empresa TEXT NOT NULL,
            email TEXT UNIQUE,
            dominio TEXT UNIQUE,
            db_path TEXT NOT NULL,
            plano TEXT DEFAULT 'trial',
            ativo INTEGER DEFAULT 1,
            data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            data_expiracao TIMESTAMP,
            data_pagamento TIMESTAMP,
            aviso_enviado INTEGER DEFAULT 0
        )`,

        // 2. Tabela de solicitações de renovação
        `CREATE TABLE IF NOT EXISTS solicitacoes_renovacao (
            id SERIAL PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            nome_completo TEXT NOT NULL,
            cpf TEXT NOT NULL,
            endereco TEXT NOT NULL,
            data_solicitacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'pendente',
            FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
        )`,

        // 3. Tabela Global de Usuários (Login via portal unificado)
        `CREATE TABLE IF NOT EXISTS usuarios_globais (
            id SERIAL PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            login TEXT NOT NULL,
            senha TEXT NOT NULL,
            nome TEXT NOT NULL,
            tipo TEXT DEFAULT 'comum',
            ativo INTEGER DEFAULT 1,
            FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
            UNIQUE(tenant_id, login)
        )`
    ];

    for (const query of queries) {
        try {
            await client.query(query);
        } catch (err) {
            console.error('❌ Erro ao executar query no PG Master:', err.message);
            console.error('Query:', query);
        }
    }

    // Garantir que o tenant master do gestor existe
    try {
        const res = await client.query(`SELECT id FROM tenants WHERE id = 'ervanio-1234'`);
        if (res.rows.length === 0) {
            const dbPath = 'ervanio-1234'; // No PG será o schema name
            await client.query(
                `INSERT INTO tenants (id, nome_empresa, email, db_path, plano, ativo) VALUES ($1, $2, $3, $4, $5, $6)`,
                ['ervanio-1234', 'Ervanio Rodrigues', 'ervanio.rodrigues@gmail.com', dbPath, 'master', 1]
            );
            await client.query(
                `INSERT INTO usuarios_globais (tenant_id, login, senha, nome, tipo) VALUES ($1, $2, $3, $4, $5)`,
                ['ervanio-1234', 'ervanio.rodrigues@gmail.com', '@Senha01', 'Ervanio Rodrigues', 'master']
            );
            console.log('✅ Tenant master do gestor criado no PG MasterDB!');
        }
    } catch (err) {
        console.error('❌ Erro ao criar tenant master no PG:', err.message);
    }

    console.log('✅ Estrutura Master PostgreSQL inicializada com sucesso.');
}

module.exports = { initPostgresMaster };
