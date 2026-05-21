/**
 * Centraliza a inicialização de tabelas e índices para bancos Global e de Tenants
 * para garantir que todos tenham a mesma estrutura (schema).
 */

function initDatabase(targetDb, globalDb, isTenant = false) {
    // Se targetDb for fornecido, usamos serialize do targetDb
    const serialize = (fn) => targetDb.serialize(fn);

    serialize(() => {
        // 1. Estrutura Principal de Funcionários
        targetDb.run(`
            CREATE TABLE IF NOT EXISTS SSMA (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
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
                Foto BLOB,
                Cadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
                DataInativacao DATETIME,
                IgnorarInvalidez TEXT DEFAULT 'N'
            )
        `);
    
        // 2. Fornecedores
        targetDb.run(`
            CREATE TABLE IF NOT EXISTS FORNECEDOR (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                Empresa TEXT NOT NULL,
                CNPJ TEXT,
                Telefone TEXT,
                Celular TEXT,
                Contato TEXT,
                Observacao TEXT,
                DataCadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
                DataInativacao DATETIME,
                Situacao TEXT DEFAULT 'S'
            )
        `);
    
        // 3. Documentação de Empresas
        targetDb.run(`
            CREATE TABLE IF NOT EXISTS DOCUMENTACAO (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
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
                DataCadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
                DataAlteracao DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    
        // 4. Configurações de Relatório
        targetDb.run(`
            CREATE TABLE IF NOT EXISTS configuracao_relatorio (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                titulo TEXT DEFAULT 'Relatório de Cursos',
                rodape TEXT DEFAULT 'SSMA',
                logo TEXT DEFAULT '/Logo-Hoss.jpg',
                tecnico_seguranca TEXT DEFAULT '',
                epi_itens_padrao TEXT DEFAULT '[]'
            )
        `);
    
        // 5. Cursos habilitados
        targetDb.run(`
            CREATE TABLE IF NOT EXISTS HABILITAR_CURSOS (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                curso TEXT NOT NULL UNIQUE,
                habilitado INTEGER DEFAULT 1
            )
        `);

        // 6. Histórico de Presença
        targetDb.run(`
            CREATE TABLE IF NOT EXISTS HISTORICO_PRESENCA (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mesAno TEXT NOT NULL,
                funcionarioId INTEGER NOT NULL,
                funcionarioNome TEXT,
                funcionarioEmpresa TEXT,
                funcionarioFuncao TEXT,
                funcionarioSituacao TEXT,
                dadosPresenca TEXT,
                comentarios TEXT,
                dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // 7. Mudanças de Função
        targetDb.run(`
            CREATE TABLE IF NOT EXISTS MUDANCA_FUNCAO_PRESENCA (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mesAno TEXT NOT NULL,
                funcionarioId INTEGER NOT NULL,
                funcionarioNome TEXT,
                funcaoAnterior TEXT,
                funcaoNova TEXT,
                diaInicio INTEGER NOT NULL,
                anotacoes TEXT,
                dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 8. Tabela de Presença Central - A ÚNICA FONTE DE VERDADE
        targetDb.run(`
            CREATE TABLE IF NOT EXISTS PRESENCA (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mesAno TEXT NOT NULL,
                funcionarioId INTEGER NOT NULL,
                funcionarioNome TEXT,
                funcionarioEmpresa TEXT,
                funcionarioFuncao TEXT,
                funcionarioSituacao TEXT,
                dia INTEGER NOT NULL,
                status TEXT,
                isFolga INTEGER DEFAULT 0,
                comentario TEXT,
                ocorrencia TEXT,
                formatacao TEXT DEFAULT 'normal',
                dataAtualizacao DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(mesAno, funcionarioId, dia)
            )
        `);

        // Migrações para PRESENCA (caso já exista sem as colunas novas)
        targetDb.run(`ALTER TABLE PRESENCA ADD COLUMN funcionarioNome TEXT`, (err) => {});
        targetDb.run(`ALTER TABLE PRESENCA ADD COLUMN funcionarioEmpresa TEXT`, (err) => {});
        targetDb.run(`ALTER TABLE PRESENCA ADD COLUMN funcionarioFuncao TEXT`, (err) => {});
        targetDb.run(`ALTER TABLE PRESENCA ADD COLUMN funcionarioSituacao TEXT`, (err) => {});
        targetDb.run(`ALTER TABLE PRESENCA ADD COLUMN isFolga INTEGER DEFAULT 0`, (err) => {});
        targetDb.run(`ALTER TABLE PRESENCA ADD COLUMN formatacao TEXT DEFAULT 'normal'`, (err) => {});


        // 9. Empresas Ocultas
        targetDb.run(`
            CREATE TABLE IF NOT EXISTS EMPRESAS_OCULTAS (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                empresaOculta TEXT NOT NULL UNIQUE,
                dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 10. Ocorrências Gerais do Dia
        targetDb.run(`
            CREATE TABLE IF NOT EXISTS OCORRENCIAS (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mesAno TEXT NOT NULL,
                texto TEXT NOT NULL,
                data DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 11. Funcionários Ocultos da Lista
        targetDb.run(`
            CREATE TABLE IF NOT EXISTS FUNCIONARIOS_OCULTOS (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                funcionarioId INTEGER NOT NULL UNIQUE,
                dataOcultado DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    
        // 12. Log de Auditoria
        targetDb.run(`
            CREATE TABLE IF NOT EXISTS AUDIT_LOG (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                usuario TEXT NOT NULL,
                acao TEXT NOT NULL,
                detalhes TEXT,
                ip TEXT,
                navegador TEXT,
                dataHora DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        targetDb.run(`ALTER TABLE AUDIT_LOG ADD COLUMN ip TEXT`, (err) => {});
        targetDb.run(`ALTER TABLE AUDIT_LOG ADD COLUMN navegador TEXT`, (err) => {});

        // 12. Configuração das NRs (Persistência Global por Tenant)
        targetDb.run(`
            CREATE TABLE IF NOT EXISTS configuracao_nrs (
                nr TEXT PRIMARY KEY,
                dados TEXT,
                dataAtualizacao DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 13. Usuários do Tenant (para login multinível/gestores por empresa)
        targetDb.run(`
            CREATE TABLE IF NOT EXISTS USUARIOS_TENANT (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                login TEXT NOT NULL UNIQUE,
                senha TEXT NOT NULL,
                nome TEXT NOT NULL,
                tipo TEXT DEFAULT 'comum',
                ativo INTEGER DEFAULT 1
            )
        `);

        // 9. Rastreamento de Acessos (Sempre no GlobalDB)
        if (globalDb) {
            globalDb.run(`
                CREATE TABLE IF NOT EXISTS RASTREAMENTO_ACESSOS (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tenant_id TEXT,
                    usuario TEXT NOT NULL,
                    ip TEXT,
                    navegador TEXT,
                    sistemaOperacional TEXT,
                    status TEXT DEFAULT 'online',
                    dataHoraEntrada DATETIME DEFAULT CURRENT_TIMESTAMP,
                    dataHoraSaida DATETIME,
                    lastHeartbeat DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            globalDb.run(`ALTER TABLE RASTREAMENTO_ACESSOS ADD COLUMN tenant_id TEXT`, (err) => {});
        }
        
        // Migrações e Índices
        targetDb.run(`ALTER TABLE configuracao_relatorio ADD COLUMN logo TEXT DEFAULT '/Logo-Hoss.jpg'`, (err) => {});
        targetDb.run(`ALTER TABLE configuracao_relatorio ADD COLUMN tecnico_seguranca TEXT DEFAULT ''`, (err) => {});
        targetDb.run(`ALTER TABLE configuracao_relatorio ADD COLUMN epi_itens_padrao TEXT DEFAULT '[]'`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN DataEmissao TEXT`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Celular TEXT`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN CPF TEXT`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr12_Ferramenta TEXT`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN DataInativacao DATETIME`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN IgnorarInvalidez TEXT DEFAULT 'N'`, (err) => {});
        
        // Colunas de controle de certificados por ano
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr06_NumControle TEXT`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr06_AnoControle TEXT`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr06_Validade2Anos INTEGER DEFAULT 0`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr06_Validade8Meses INTEGER DEFAULT 0`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr10_NumControle TEXT`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr10_AnoControle TEXT`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr10_Validade2Anos INTEGER DEFAULT 0`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr10_Validade8Meses INTEGER DEFAULT 0`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr11_NumControle TEXT`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr11_AnoControle TEXT`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr11_Validade2Anos INTEGER DEFAULT 0`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr11_Validade8Meses INTEGER DEFAULT 0`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr12_NumControle TEXT`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr12_AnoControle TEXT`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr12_Validade2Anos INTEGER DEFAULT 0`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr12_Validade8Meses INTEGER DEFAULT 0`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr17_NumControle TEXT`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr17_AnoControle TEXT`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr17_Validade2Anos INTEGER DEFAULT 0`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr17_Validade8Meses INTEGER DEFAULT 0`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr18_NumControle TEXT`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr18_AnoControle TEXT`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr18_Validade2Anos INTEGER DEFAULT 0`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr18_Validade8Meses INTEGER DEFAULT 0`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr20_NumControle TEXT`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr20_AnoControle TEXT`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr20_Validade2Anos INTEGER DEFAULT 0`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr20_Validade8Meses INTEGER DEFAULT 0`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr33_NumControle TEXT`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr33_AnoControle TEXT`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr33_Validade2Anos INTEGER DEFAULT 0`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr33_Validade8Meses INTEGER DEFAULT 0`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr33_DataFim TEXT`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr35_NumControle TEXT`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr35_AnoControle TEXT`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr35_Validade2Anos INTEGER DEFAULT 0`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Nr35_Validade8Meses INTEGER DEFAULT 0`, (err) => {});
        targetDb.run(`ALTER TABLE SSMA ADD COLUMN Epi_Validade8Meses INTEGER DEFAULT 0`, (err) => {});
        
        targetDb.run(`CREATE INDEX IF NOT EXISTS idx_ssma_situacao ON SSMA(Situacao)`);
        targetDb.run(`CREATE INDEX IF NOT EXISTS idx_ssma_empresa ON SSMA(Empresa)`);
        targetDb.run(`CREATE INDEX IF NOT EXISTS idx_ssma_nome ON SSMA(Nome)`);
        targetDb.run(`CREATE INDEX IF NOT EXISTS idx_ssma_funcao ON SSMA(Funcao)`);
        targetDb.run(`CREATE INDEX IF NOT EXISTS idx_ssma_empresa_nome ON SSMA(Empresa, Nome)`);
        targetDb.run(`CREATE INDEX IF NOT EXISTS idx_fornecedor_situacao ON FORNECEDOR(Situacao)`);

        console.log('✅ Tabelas e Índices verificados/criados');

        // 10. Inserir dados padrão (Verificações)
        // SSMA e Fornecedores padrão SOMENTE para o banco global (isTenant = false)
        if (!isTenant) {
            verificarRegistrosPadraoSSMA(targetDb);
            verificarFornecedorPadrao(targetDb);
        }
        
        // O usuário Protegido DEVE ser inserido apenas para o banco global (tenants inserem o seu próprio usuário de cadastro como ID 1)
        if (!isTenant) {
            verificarUsuarioPadrao(targetDb);
        }
        
        // Cursos padrão são úteis para todos os bancos iniciantes
        verificarCursosPadrao(targetDb);
    });
}

function verificarUsuarioPadrao(db) {
    db.run(`INSERT OR IGNORE INTO USUARIOS_TENANT (id, login, senha, nome, tipo, ativo) VALUES (?, ?, ?, ?, ?, ?)`,
        [1, 'master', '@Senha01', 'Administrador', 'master', 1]
    );
}

function verificarRegistrosPadraoSSMA(db) {
    db.run(`INSERT INTO SSMA (Nome, Empresa, Funcao, Vencimento, Nr10_Vencimento, Situacao, Anotacoes, Ambientacao, Nr10_DataEmissao)
            SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
            WHERE NOT EXISTS (SELECT 1 FROM SSMA WHERE Nome = ?)`,
        ['Ervanio Freitas Rodrigues', 'Hoss', 'Técnico de Segurança', '2026-12-08', '2027-12-09', 'S', 'teste', 'S', '09/12/2025', 'Ervanio Freitas Rodrigues']
    );
}

function verificarFornecedorPadrao(db) {
    db.run(`INSERT INTO FORNECEDOR (Empresa, CNPJ, Telefone, Celular, Contato, Observacao, Situacao)
            SELECT ?, ?, ?, ?, ?, ?, ?
            WHERE NOT EXISTS (SELECT 1 FROM FORNECEDOR WHERE Empresa = ?)`,
        ['Hoss', '00.000.000/0000-00', '(11) 2554-3998', '(11) 94576-6912', 'Ervanio Freitas Rodrigues', 'Suporte de TI', 'S', 'Hoss']
    );
}

function verificarCursosPadrao(db) {
    const cursos = ['ASO', 'NR-06', 'NR-10', 'NR-11', 'NR-12', 'NR-17', 'NR-18', 'NR-20', 'NR-33', 'NR-34', 'NR-35', 'EPI'];
    cursos.forEach(curso => {
        db.run(
            `INSERT INTO HABILITAR_CURSOS (curso, habilitado) SELECT ?, 1 WHERE NOT EXISTS (SELECT 1 FROM HABILITAR_CURSOS WHERE curso = ?)`,
            [curso, curso]
        );
    });
}

function initDatabasePromise(targetDb, globalDb, isTenant = false) {
    return new Promise((resolve, reject) => {
        targetDb.serialize(() => {
            try {
                initDatabase(targetDb, globalDb, isTenant);
                targetDb.get('SELECT 1', (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            } catch (err) {
                reject(err);
            }
        });
    });
}

module.exports = { initDatabase, initDatabasePromise };
