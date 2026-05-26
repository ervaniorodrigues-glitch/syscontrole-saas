const { initPostgres } = require('./pg-init');

/**
 * Utilitários para gerenciamento de schemas de tenants no PostgreSQL
 */

// Mapeamento global de case para colunas do Postgres
// Postgres retorna tudo em lowercase. O Server.js espera em camelCase.
const COLUMN_CASE_MAP = {
    'nome': 'Nome',
    'empresa': 'Empresa',
    'funcao': 'Funcao',
    'celular': 'Celular',
    'cpf': 'CPF',
    'dataemissao': 'DataEmissao',
    'vencimento': 'Vencimento',
    'anotacoes': 'Anotacoes',
    'situacao': 'Situacao',
    'ambientacao': 'Ambientacao',
    'ignorarinvalidez': 'IgnorarInvalidez',
    'nr06_dataemissao': 'Nr06_DataEmissao',
    'nr06_vencimento': 'Nr06_Vencimento',
    'nr06_status': 'Nr06_Status',
    'nr06_numcontrole': 'Nr06_NumControle',
    'nr06_anocontrole': 'Nr06_AnoControle',
    'nr06_validade2anos': 'Nr06_Validade2Anos',
    'nr06_validade8meses': 'Nr06_Validade8Meses',
    'nr10_dataemissao': 'Nr10_DataEmissao',
    'nr10_vencimento': 'Nr10_Vencimento',
    'nr10_status': 'Nr10_Status',
    'nr10_numcontrole': 'Nr10_NumControle',
    'nr10_anocontrole': 'Nr10_AnoControle',
    'nr10_validade2anos': 'Nr10_Validade2Anos',
    'nr10_validade8meses': 'Nr10_Validade8Meses',
    'nr11_dataemissao': 'Nr11_DataEmissao',
    'nr11_vencimento': 'Nr11_Vencimento',
    'nr11_status': 'Nr11_Status',
    'nr11_numcontrole': 'Nr11_NumControle',
    'nr11_anocontrole': 'Nr11_AnoControle',
    'nr11_validade2anos': 'Nr11_Validade2Anos',
    'nr11_validade8meses': 'Nr11_Validade8Meses',
    'nr12_dataemissao': 'Nr12_DataEmissao',
    'nr12_vencimento': 'Nr12_Vencimento',
    'nr12_vencimento': 'NR12_Vencimento',
    'nr12_status': 'Nr12_Status',
    'nr12_ferramenta': 'Nr12_Ferramenta',
    'nr12_numcontrole': 'Nr12_NumControle',
    'nr12_anocontrole': 'Nr12_AnoControle',
    'nr12_validade2anos': 'Nr12_Validade2Anos',
    'nr12_validade8meses': 'Nr12_Validade8Meses',
    'nr17_dataemissao': 'Nr17_DataEmissao',
    'nr17_vencimento': 'Nr17_Vencimento',
    'nr17_status': 'Nr17_Status',
    'nr17_numcontrole': 'Nr17_NumControle',
    'nr17_anocontrole': 'Nr17_AnoControle',
    'nr17_validade2anos': 'Nr17_Validade2Anos',
    'nr17_validade8meses': 'Nr17_Validade8Meses',
    'nr18_dataemissao': 'Nr18_DataEmissao',
    'nr18_vencimento': 'Nr18_Vencimento',
    'nr18_vencimento': 'NR18_Vencimento',
    'nr18_status': 'Nr18_Status',
    'nr18_numcontrole': 'Nr18_NumControle',
    'nr18_anocontrole': 'Nr18_AnoControle',
    'nr18_validade2anos': 'Nr18_Validade2Anos',
    'nr18_validade8meses': 'Nr18_Validade8Meses',
    'nr20_dataemissao': 'Nr20_DataEmissao',
    'nr20_vencimento': 'Nr20_Vencimento',
    'nr20_status': 'Nr20_Status',
    'nr20_numcontrole': 'Nr20_NumControle',
    'nr20_anocontrole': 'Nr20_AnoControle',
    'nr20_validade2anos': 'Nr20_Validade2Anos',
    'nr20_validade8meses': 'Nr20_Validade8Meses',
    'nr33_dataemissao': 'Nr33_DataEmissao',
    'nr33_vencimento': 'Nr33_Vencimento',
    'nr33_vencimento': 'NR33_Vencimento',
    'nr33_status': 'Nr33_Status',
    'nr33_datafim': 'Nr33_DataFim',
    'nr33_numcontrole': 'Nr33_NumControle',
    'nr33_anocontrole': 'Nr33_AnoControle',
    'nr33_validade2anos': 'Nr33_Validade2Anos',
    'nr33_validade8meses': 'Nr33_Validade8Meses',
    'nr34_dataemissao': 'Nr34_DataEmissao',
    'nr34_vencimento': 'Nr34_Vencimento',
    'nr34_status': 'Nr34_Status',
    'nr35_dataemissao': 'Nr35_DataEmissao',
    'nr35_vencimento': 'Nr35_Vencimento',
    'nr35_vencimento': 'NR35_Vencimento',
    'nr35_status': 'Nr35_Status',
    'nr35_numcontrole': 'Nr35_NumControle',
    'nr35_anocontrole': 'Nr35_AnoControle',
    'nr35_validade2anos': 'Nr35_Validade2Anos',
    'nr35_validade8meses': 'Nr35_Validade8Meses',
    'epi_dataemissao': 'Epi_DataEmissao',
    'epivencimento': 'epiVencimento',
    'epistatus': 'EpiStatus',
    'epi_validade8meses': 'Epi_Validade8Meses',
    'foto': 'Foto',
    'cadastro': 'Cadastro',
    'datainativacao': 'DataInativacao',
    'datacadastro': 'DataCadastro',
    'dataalteracao': 'DataAlteracao',
    'observacao': 'Observacao',
    'contato': 'Contato',
    'telefone': 'Telefone',
    'cnpj': 'CNPJ',
    'funcionarioid': 'funcionarioId',
    'funcionarionome': 'funcionarioNome',
    'funcionarioempresa': 'funcionarioEmpresa',
    'funcionariofuncao': 'funcionarioFuncao',
    'funcionariosituacao': 'funcionarioSituacao',
    'isfolga': 'isFolga',
    'dataatualizacao': 'dataAtualizacao',
    'datacriacao': 'dataCriacao',
    'dadospresenca': 'dadosPresenca',
    'mesano': 'mesAno',
    'funcaoanterior': 'funcaoAnterior',
    'funcaonova': 'funcaoNova',
    'diainicio': 'diaInicio',
    'empresaoculta': 'empresaOculta',
    'dataocultado': 'dataOcultado',
    'datahora': 'dataHora'
};

// Normaliza o nome do tenant para ser um identificador válido de schema no Postgres
function getTenantSchemaName(tenantId) {
    // Substituir hifens por underscores e garantir que seja lowercase
    return tenantId.replace(/-/g, '_').toLowerCase();
}

/**
 * Cria um schema para o tenant e inicializa as tabelas se não existirem
 */
async function initTenantSchema(pool, tenantId) {
    const schemaName = getTenantSchemaName(tenantId);
    const client = await pool.connect();
    
    try {
        console.log(`[PG] Inicializando schema para tenant: ${schemaName}`);
        
        // Criar o schema
        await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
        
        // Mudar o contexto para o schema do tenant
        await client.query(`SET search_path TO "${schemaName}"`);
        
        // Inicializar tabelas do tenant no schema
        await initPostgres(client);
        
        console.log(`✅ Schema ${schemaName} inicializado com sucesso.`);
    } catch (err) {
        console.error(`❌ Erro ao inicializar schema ${schemaName}:`, err.message);
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Retorna uma abstração de DB para o tenant específico
 * Esta abstração imita a interface usada pelo código atual para SQLite
 */
function getPgTenantDb(pool, tenantId) {
    const schemaName = getTenantSchemaName(tenantId);
    
    const executeQuery = async (sql, params = []) => {
        const client = await pool.connect();
        try {
            await client.query(`SET search_path TO "${schemaName}"`);
            
            // Adaptar a query do formato SQLite (?) para o formato PG ($1, $2, ...)
            let pgSql = sql;
            let pIndex = 1;
            // Um replace simples, que pode falhar em strings contendo '?', mas é o que temos em server.js.
            let i = 0;
            pgSql = pgSql.replace(/\?/g, () => `$${++i}`);

            const res = await client.query(pgSql, params);
            
            // Corrige o case das colunas (Postgres converte tudo para lowercase, server.js espera camelCase)
            if (res.rows && res.rows.length > 0) {
                res.rows = res.rows.map(row => {
                    const newRow = {};
                    for (const key in row) {
                        const originalKey = COLUMN_CASE_MAP[key] || key;
                        newRow[originalKey] = row[key];
                    }
                    return newRow;
                });
            }
            
            return res;
        } finally {
            client.release();
        }
    };

    return {
        all: (sql, params = [], callback) => {
            if (typeof params === 'function') { callback = params; params = []; }
            const p = executeQuery(sql, params).then(res => res.rows);
            if (callback) p.then(rows => callback(null, rows)).catch(err => callback(err));
            return p;
        },
        get: (sql, params = [], callback) => {
            if (typeof params === 'function') { callback = params; params = []; }
            const p = executeQuery(sql, params).then(res => res.rows[0]);
            if (callback) p.then(row => callback(null, row)).catch(err => callback(err));
            return p;
        },
        run: function(sql, params = [], callback) {
            if (typeof params === 'function') { callback = params; params = []; }
            const p = executeQuery(sql, params).then(res => ({ lastID: res.oid || null, changes: res.rowCount }));
            if (callback) p.then(result => callback.call(result, null)).catch(err => callback(err));
            return p;
        },
        serialize: (fn) => fn() // No PG com promises a serialização é apenas aguardar, aqui executamos logo
    };
}

module.exports = {
    getTenantSchemaName,
    initTenantSchema,
    getPgTenantDb
};
