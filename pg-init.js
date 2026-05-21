/**
 * Inicialização de tabelas e índices no PostgreSQL
 * Baseado no esquema do SQLite em db-init.js
 */

async function initPostgres(client) {
    console.log('🚀 Inicializando tabelas no PostgreSQL...');

    const queries = [
        // 1. Estrutura Principal de Funcionários
        `CREATE TABLE IF NOT EXISTS SSMA (
            id SERIAL PRIMARY KEY,
            Nome TEXT NOT NULL,
            Empresa TEXT NOT NULL,
            Funcao TEXT NOT NULL,
            Celular TEXT,
            CPF TEXT,
            DataEmissao TEXT,
            Vencimento TEXT,
            Anotacoes TEXT,
            Situacao TEXT DEFAULT 'S',
            Ambientacao TEXT DEFAULT 'N',
            IgnorarInvalidez TEXT DEFAULT 'N',
            Nr06_DataEmissao TEXT,
            Nr06_Vencimento TEXT,
            Nr06_Status TEXT,
            Nr06_NumControle TEXT,
            Nr06_AnoControle TEXT,
            Nr06_Validade2Anos INTEGER DEFAULT 0,
            Nr06_Validade8Meses INTEGER DEFAULT 0,
            Nr10_DataEmissao TEXT,
            Nr10_Vencimento TEXT,
            Nr10_Status TEXT,
            Nr10_NumControle TEXT,
            Nr10_AnoControle TEXT,
            Nr10_Validade2Anos INTEGER DEFAULT 0,
            Nr10_Validade8Meses INTEGER DEFAULT 0,
            Nr11_DataEmissao TEXT,
            Nr11_Vencimento TEXT,
            Nr11_Status TEXT,
            Nr11_NumControle TEXT,
            Nr11_AnoControle TEXT,
            Nr11_Validade2Anos INTEGER DEFAULT 0,
            Nr11_Validade8Meses INTEGER DEFAULT 0,
            Nr12_DataEmissao TEXT,
            Nr12_Vencimento TEXT,
            Nr12_Status TEXT,
            Nr12_Ferramenta TEXT,
            Nr12_NumControle TEXT,
            Nr12_AnoControle TEXT,
            Nr12_Validade2Anos INTEGER DEFAULT 0,
            Nr12_Validade8Meses INTEGER DEFAULT 0,
            Nr17_DataEmissao TEXT,
            Nr17_Vencimento TEXT,
            Nr17_Status TEXT,
            Nr17_NumControle TEXT,
            Nr17_AnoControle TEXT,
            Nr17_Validade2Anos INTEGER DEFAULT 0,
            Nr17_Validade8Meses INTEGER DEFAULT 0,
            Nr18_DataEmissao TEXT,
            Nr18_Vencimento TEXT,
            Nr18_Status TEXT,
            Nr18_NumControle TEXT,
            Nr18_AnoControle TEXT,
            Nr18_Validade2Anos INTEGER DEFAULT 0,
            Nr18_Validade8Meses INTEGER DEFAULT 0,
            Nr20_DataEmissao TEXT,
            Nr20_Vencimento TEXT,
            Nr20_Status TEXT,
            Nr20_NumControle TEXT,
            Nr20_AnoControle TEXT,
            Nr20_Validade2Anos INTEGER DEFAULT 0,
            Nr20_Validade8Meses INTEGER DEFAULT 0,
            Nr33_DataEmissao TEXT,
            Nr33_Vencimento TEXT,
            Nr33_Status TEXT,
            Nr33_DataFim TEXT,
            Nr33_NumControle TEXT,
            Nr33_AnoControle TEXT,
            Nr33_Validade2Anos INTEGER DEFAULT 0,
            Nr33_Validade8Meses INTEGER DEFAULT 0,
            Nr34_DataEmissao TEXT,
            Nr34_Vencimento TEXT,
            Nr34_Status TEXT,
            Nr35_DataEmissao TEXT,
            Nr35_Vencimento TEXT,
            Nr35_Status TEXT,
            Nr35_NumControle TEXT,
            Nr35_AnoControle TEXT,
            Nr35_Validade2Anos INTEGER DEFAULT 0,
            Nr35_Validade8Meses INTEGER DEFAULT 0,
            Epi_DataEmissao TEXT,
            epiVencimento TEXT,
            EpiStatus TEXT,
            Epi_Validade8Meses INTEGER DEFAULT 0,
            Foto BYTEA,
            Cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            DataInativacao TIMESTAMP
        )`,

        // 2. Fornecedores
        `CREATE TABLE IF NOT EXISTS FORNECEDOR (
            id SERIAL PRIMARY KEY,
            Empresa TEXT NOT NULL,
            CNPJ TEXT,
            Telefone TEXT,
            Celular TEXT,
            Contato TEXT,
            Observacao TEXT,
            DataCadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            DataInativacao TIMESTAMP,
            Situacao TEXT DEFAULT 'S'
        )`,

        // 3. Documentação de Empresas
        `CREATE TABLE IF NOT EXISTS DOCUMENTACAO (
            id SERIAL PRIMARY KEY,
            empresa TEXT NOT NULL,
            cnpj TEXT NOT NULL,
            pgr_emissao TEXT,
            pgr_vencimento TEXT,
            pgr_status TEXT,
            pgr_dias_corridos INTEGER,
            pgr_dias_vencer INTEGER,
            pcmso_emissao TEXT,
            pcmso_vencimento TEXT,
            pcmso_status TEXT,
            pcmso_dias_corridos INTEGER,
            pcmso_dias_vencer INTEGER,
            ativo TEXT DEFAULT 'S',
            DataCadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            DataAlteracao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        // 4. Configurações de Relatório
        `CREATE TABLE IF NOT EXISTS configuracao_relatorio (
            id SERIAL PRIMARY KEY,
            titulo TEXT DEFAULT 'Relatório de Cursos',
            rodape TEXT DEFAULT 'SSMA',
            logo TEXT DEFAULT '/Logo-Hoss.jpg'
        )`,

        // 5. Cursos habilitados
        `CREATE TABLE IF NOT EXISTS HABILITAR_CURSOS (
            id SERIAL PRIMARY KEY,
            curso TEXT NOT NULL UNIQUE,
            habilitado INTEGER DEFAULT 1
        )`,

        // 6. Histórico de Presença
        `CREATE TABLE IF NOT EXISTS HISTORICO_PRESENCA (
            id SERIAL PRIMARY KEY,
            mesAno TEXT NOT NULL,
            funcionarioId INTEGER NOT NULL,
            funcionarioNome TEXT,
            funcionarioEmpresa TEXT,
            funcionarioFuncao TEXT,
            funcionarioSituacao TEXT,
            dadosPresenca TEXT, -- JSON armazenado como texto
            comentarios TEXT,     -- JSON armazenado como texto
            dataCriacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        // 7. Log de Auditoria
        `CREATE TABLE IF NOT EXISTS AUDIT_LOG (
            id SERIAL PRIMARY KEY,
            usuario TEXT NOT NULL,
            acao TEXT NOT NULL,
            detalhes TEXT,
            ip TEXT,
            navegador TEXT,
            dataHora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        // 8. Mudanças de Função
        `CREATE TABLE IF NOT EXISTS MUDANCA_FUNCAO_PRESENCA (
            id SERIAL PRIMARY KEY,
            mesAno TEXT NOT NULL,
            funcionarioId INTEGER NOT NULL,
            funcionarioNome TEXT,
            funcaoAnterior TEXT,
            funcaoNova TEXT,
            diaInicio INTEGER NOT NULL,
            anotacoes TEXT,
            dataCriacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        // 9. Empresas Ocultas
        `CREATE TABLE IF NOT EXISTS EMPRESAS_OCULTAS (
            id SERIAL PRIMARY KEY,
            empresaOculta TEXT NOT NULL UNIQUE,
            dataCriacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        // 10. Rastreamento de Acessos
        `CREATE TABLE IF NOT EXISTS RASTREAMENTO_ACESSOS (
            id SERIAL PRIMARY KEY,
            tenant_id TEXT,
            usuario TEXT NOT NULL,
            ip TEXT,
            navegador TEXT,
            sistemaOperacional TEXT,
            status TEXT DEFAULT 'online',
            dataHoraEntrada TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            dataHoraSaida TIMESTAMP,
            lastHeartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        // 11. Presença
        `CREATE TABLE IF NOT EXISTS PRESENCA (
            id SERIAL PRIMARY KEY,
            mesAno TEXT NOT NULL,
            funcionarioId INTEGER NOT NULL,
            funcionarioNome TEXT,
            funcionarioEmpresa TEXT,
            funcionarioFuncao TEXT,
            funcionarioSituacao TEXT,
            dia INTEGER NOT NULL,
            status TEXT,
            comentario TEXT,
            formatacao TEXT,
            dataCriacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        // 12. Configurações de NRs
        `CREATE TABLE IF NOT EXISTS configuracao_nrs (
            id SERIAL PRIMARY KEY,
            nr TEXT NOT NULL UNIQUE,
            dados TEXT,
            dataAtualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        // 13. Usuários do Tenant
        `CREATE TABLE IF NOT EXISTS USUARIOS_TENANT (
            id SERIAL PRIMARY KEY,
            login TEXT NOT NULL UNIQUE,
            senha TEXT NOT NULL,
            nome TEXT NOT NULL,
            tipo TEXT DEFAULT 'comum',
            ativo INTEGER DEFAULT 1
        )`,

        // Índices
        `CREATE INDEX IF NOT EXISTS idx_ssma_situacao ON SSMA(Situacao)`,
        `CREATE INDEX IF NOT EXISTS idx_ssma_empresa ON SSMA(Empresa)`,
        `CREATE INDEX IF NOT EXISTS idx_ssma_nome ON SSMA(Nome)`,
        `CREATE INDEX IF NOT EXISTS idx_ssma_funcao ON SSMA(Funcao)`,
        `CREATE INDEX IF NOT EXISTS idx_ssma_empresa_nome ON SSMA(Empresa, Nome)`,
        `CREATE INDEX IF NOT EXISTS idx_fornecedor_situacao ON FORNECEDOR(Situacao)`
    ];

    for (const query of queries) {
        try {
            await client.query(query);
        } catch (err) {
            console.error('❌ Erro ao executar query no PG:', err.message);
            console.error('Query:', query);
        }
    }

    console.log('✅ Estrutura PostgreSQL inicializada com sucesso.');
}

module.exports = { initPostgres };
