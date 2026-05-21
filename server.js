// ⚠️⚠️⚠️ NÃO MEXER NO CÓDIGO SEM PEDIR PERMISSÃO AO ADMINISTRATOR ⚠️⚠️⚠️
// ⚠️⚠️⚠️ NÃO MEXER NO CÓDIGO SEM PEDIR PERMISSÃO AO ADMINISTRATOR ⚠️⚠️⚠️
// ⚠️⚠️⚠️ NÃO MEXER NO CÓDIGO SEM PEDIR PERMISSÃO AO ADMINISTRATOR ⚠️⚠️⚠️

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const fs = require('fs');

// Módulos SaaS Multi-Tenant
const { tenantMiddleware, asyncLocalStorage } = require('./saas-middleware');
const saasRoutes = require('./saas-routes');

// ============ GLOBAL ERROR HANDLING ============
process.on('uncaughtException', (err) => {
    console.error('❌ CRITICAL: Uncaught Exception:', err);
    // Em um ambiente de produção, poderíamos reiniciar o processo aqui,
    // mas por enquanto apenas logamos para diagnosticar por que o "servidor está parando".
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});


// ============ CONFIGURAÇÃO DE AMBIENTE / BANCO ============
const DB_TYPE = process.env.DB_TYPE || 'sqlite'; // 'sqlite' ou 'postgres'
console.log(`🔌 Tipo de Banco de Dados Detectado: ${DB_TYPE.toUpperCase()}`);

// Configurações do PostgreSQL (SaaS / Web)
const pgConfig = {
    user: process.env.PG_USER || 'postgres',
    host: process.env.PG_HOST || 'localhost',
    database: process.env.PG_DATABASE || 'syscontrole',
    password: process.env.PG_PASSWORD || 'sua_senha_aqui',
    port: process.env.PG_PORT || 5432,
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false
};

const pool = DB_TYPE === 'postgres' ? new Pool(pgConfig) : null;
const dbSqlite = DB_TYPE === 'sqlite' ? new sqlite3.Database(path.join(__dirname, 'syscontrole.db')) : null;

// Camada de Abstração para queries (Compatível com Callbacks e Promises)
const db = {
    all: (sql, params = [], callback) => {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        
        const p = (async () => {
            // Verificação do Tenant (Multi-tenant context)
            const tenantDb = asyncLocalStorage.getStore();
            if (tenantDb) {
                return tenantDb.all(sql, params);
            }

            if (DB_TYPE === 'postgres') {
                let pgSql = sql;
                params.forEach((_, i) => pgSql = pgSql.replace('?', `$${i + 1}`));
                const res = await pool.query(pgSql, params);
                return res.rows;
            } else {
                return new Promise((resolve, reject) => {
                    dbSqlite.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
                });
            }
        })();

        if (callback) {
            p.then(rows => callback(null, rows)).catch(err => callback(err));
        }
        return p;
    },
    get: (sql, params = [], callback) => {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }

        const p = (async () => {
            // Verificação do Tenant (Multi-tenant context)
            const tenantDb = asyncLocalStorage.getStore();
            if (tenantDb) {
                return tenantDb.get(sql, params);
            }

            if (DB_TYPE === 'postgres') {
                let pgSql = sql;
                params.forEach((_, i) => pgSql = pgSql.replace('?', `$${i + 1}`));
                const res = await pool.query(pgSql, params);
                return res.rows[0];
            } else {
                return new Promise((resolve, reject) => {
                    dbSqlite.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
                });
            }
        })();

        if (callback) {
            p.then(row => callback(null, row)).catch(err => callback(err));
        }
        return p;
    },
    run: function(sql, params = [], callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }

        const self = this;
        const p = (async () => {
            // Verificação do Tenant (Multi-tenant context)
            const tenantDb = asyncLocalStorage.getStore();
            if (tenantDb) {
                return tenantDb.run(sql, params);
            }

            if (DB_TYPE === 'postgres') {
                let pgSql = sql;
                params.forEach((_, i) => pgSql = pgSql.replace('?', `$${i + 1}`));
                const res = await pool.query(pgSql, params);
                return { lastID: res.oid || null, changes: res.rowCount };
            } else {
                return new Promise((resolve, reject) => {
                    dbSqlite.run(sql, params, function(err) {
                        if (err) reject(err);
                        else resolve({ lastID: this.lastID, changes: this.changes });
                    });
                });
            }
        })();

        if (callback) {
            p.then(result => {
                // Simular o 'this' do sqlite3 para callbacks
                callback.call(result, null);
            }).catch(err => callback(err));
        }
        return p;
    },
    serialize: (fn) => {
        const tenantDb = asyncLocalStorage.getStore();
        if (tenantDb) {
            return tenantDb.serialize(fn);
        }
        return (DB_TYPE === 'sqlite' ? dbSqlite.serialize(fn) : fn());
    },
    prepare: (sql) => {
        if (DB_TYPE === 'sqlite') {
            return dbSqlite.prepare(sql);
        } else {
            // No PostgreSQL, prepare é simulado ou usa a pool diretamente
            // Para manter compatibilidade com stmt.run/finalize, retornaríamos um mock
            // mas o foco atual é SQLite onde o problema ocorre.
            return {
                run: async (params, cb) => {
                    try {
                        let pgSql = sql;
                        params.forEach((_, i) => pgSql = pgSql.replace('?', `$${i + 1}`));
                        await pool.query(pgSql, params);
                        if (cb) cb(null);
                    } catch (err) {
                        if (cb) cb(err);
                    }
                },
                finalize: (cb) => { if (cb) cb(null); }
            };
        }
    },
    close: (callback) => {
        if (DB_TYPE === 'sqlite') dbSqlite.close(callback);
        else pool.end().then(() => callback && callback()).catch(err => callback && callback(err));
    }
};

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar middlewares
app.use((req, res, next) => {
    console.log(`[REQ] ${req.method} ${req.url}`);
    next();
});
app.use(cors());
app.use(express.json({ limit: '300mb' })); // Aumentar limite para aceitar backups grandes com fotos
app.use(express.urlencoded({ limit: '300mb', extended: true }));

// Integrar middlewares do SaaS Multi-Tenant
app.use(tenantMiddleware); // Isola os bancos de dados por inquilino (tenant)
app.use('/api/saas', saasRoutes); // Rotas do SaaS (Login, Registro, Gestão)
app.use((req, res, next) => {
    if (req.path.endsWith('.js') || req.path.endsWith('.css') || req.path.endsWith('.html') || req.path === '/' || req.path === '') {
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
    }
    next();
});

app.use('/Imagens', express.static(path.join(__dirname, 'Imagens')));
app.use(express.static('public')); // Garantir que a pasta public seja servida


// Função global para normalizar texto (Remover acentos e caracteres especiais, converter para MAIÚSCULO)
const normalizarTexto = (texto) => {
    if (!texto) return '';
    let val = texto.toString();

    // Reparar mojibake comum antes de normalizar
    val = val.replace(/JO[\uFFFD]+O/g, 'JOAO');
    val = val.replace(/GON[\uFFFD]+ALVES/g, 'GONCALVES');
    val = val.replace(/T[\uFFFD]+CNICO/g, 'TECNICO');
    val = val.replace(/JOS[\uFFFD]+/g, 'JOSE');
    val = val.replace(/EDIFICA[\uFFFD]+ES/g, 'EDIFICACOES');
    val = val.replace(/CONCEI[\uFFFD]+O/g, 'CONCEICAO');

    return val
        .normalize('NFD') // Decompõe caracteres acentuados
        .replace(/[\u0300-\u036f]/g, '') // Remove os acentos
        .replace(/\uFFFD/g, '') // Remove caractere de erro 
        .replace(/[^\x00-\x7F]/g, '') // Remove qualquer outro caractere não-ASCII (Garante limpeza total)
        .toUpperCase()
        .trim();
};

// ============ CONTROLE DE PRESENÇA EM MEMÓRIA ============
// Estrutura: { mesAno: { funcionarioId: { dia: status } } }
// Exemplo: { "01-2026": { 1: { 1: "P", 2: "F", 3: "P" }, 2: { 1: "P" } } }
let presencaMemoria = {};
let presencaMesAtual = null;

// Comentários de presença: { mesAno: { "funcId_dia": { texto, data } } }
let comentariosPresenca = {};

// Ocorrências do dia: { mesAno: [ { id, texto, data } ] }
let ocorrenciasPresenca = {};

// Funcionários ocultos: { mesAno: { funcionarioId: true } }
// Mantém os dados até o final do mês, mas não exibe na lista
let funcionariosOcultos = {};

// Flag para controlar se já fez backup automático no mês
let backupAutomaticoFeito = {};

// Arquivo para persistir dados de presença
const PRESENCA_FILE = path.join(__dirname, 'presenca_dados.json');

// Carregar dados de presença do arquivo ao iniciar
function carregarDadosPresenca() {
    try {
        if (fs.existsSync(PRESENCA_FILE)) {
            const dados = JSON.parse(fs.readFileSync(PRESENCA_FILE, 'utf8'));
            presencaMemoria = dados.presenca || {};
            comentariosPresenca = dados.comentarios || {};
            ocorrenciasPresenca = dados.ocorrencias || {};
            funcionariosOcultos = dados.ocultos || {};
            presencaMesAtual = dados.mesAtual || getMesAnoAtual();
            console.log('📂 Dados de presença carregados do arquivo');
        }
    } catch (err) {
        console.error('Erro ao carregar dados de presença:', err.message);
    }
}

// Salvar dados de presença no arquivo
function salvarDadosPresenca() {
    try {
        const dados = {
            presenca: presencaMemoria,
            comentarios: comentariosPresenca,
            ocorrencias: ocorrenciasPresenca,
            ocultos: funcionariosOcultos,
            mesAtual: presencaMesAtual,
            ultimaAtualizacao: new Date().toISOString()
        };
        fs.writeFileSync(PRESENCA_FILE, JSON.stringify(dados, null, 2), 'utf8');
    } catch (err) {
        console.error('Erro ao salvar dados de presença:', err.message);
    }
}

// Salvar dados no banco de dados (Migração progressiva)
async function migrarJSONParaSQLite() {
    console.log('🚀 Iniciando verificação de migração JSON -> SQLite...');
    try {
        const mesAnoAtual = getMesAnoAtual();
        
        // Carregar do arquivo se existir
        if (fs.existsSync(PRESENCA_FILE)) {
            const dataFile = JSON.parse(fs.readFileSync(PRESENCA_FILE, 'utf8'));
            const dadosMes = dataFile.presenca ? dataFile.presenca[mesAnoAtual] || {} : {};
            const comentariosMes = dataFile.comentarios ? dataFile.comentarios[mesAnoAtual] || {} : {};
            
            // Verificar se o banco já tem dados desse mês
            const check = await db.get("SELECT COUNT(*) as count FROM PRESENCA_MES_ATUAL WHERE mesAno = ?", [mesAnoAtual]);
            if (check.count === 0 && Object.keys(dadosMes).length > 0) {
                console.log(`📦 Migrando ${Object.keys(dadosMes).length} registros de presença para o banco...`);
                for (const funcId of Object.keys(dadosMes)) {
                    for (const dia of Object.keys(dadosMes[funcId])) {
                        const info = dadosMes[funcId][dia];
                        await db.run(
                            "INSERT INTO PRESENCA_MES_ATUAL (mesAno, funcionarioId, dia, status, isFolga, dataCriacao, dataAtualizacao) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
                            [mesAnoAtual, parseInt(funcId), parseInt(dia), info.status, info.isFolga ? 1 : 0]
                        );
                    }
                }
                
                console.log(`💬 Migrando ${Object.keys(comentariosMes).length} comentários para o banco...`);
                for (const chave of Object.keys(comentariosMes)) {
                    const [funcId, dia] = chave.split('_');
                    const com = comentariosMes[chave];
                    await db.run(
                        "INSERT INTO COMENTARIOS_PRESENCA (mesAno, funcionarioId, dia, texto, dataCriacao) VALUES (?, ?, ?, ?, ?)",
                        [mesAnoAtual, parseInt(funcId), parseInt(dia), com.texto, com.data]
                    );
                }
                console.log('✅ Migração concluída!');
                await registrarLog('Sistema', 'Migração', `Migrados dados de ${mesAnoAtual} do JSON para o SQLite`);
            }
        }
    } catch (err) {
        console.error('❌ Erro na migração:', err);
    }
}

// LOG DE AUDITORIA CENTRALIZADO E ROBUSTO
async function registrarLog(reqOrUser, acao, detalhes = '') {
    try {
        let usuario = 'Sistema';
        let ip = '';
        let navegador = '';
        
        if (reqOrUser && reqOrUser.headers) {
            const usuarioRaw = reqOrUser.headers['x-user-name'] || 'Desconhecido';
            usuario = decodeURIComponent(usuarioRaw);
            ip = reqOrUser.ip || reqOrUser.headers['x-forwarded-for'] || reqOrUser.connection?.remoteAddress || '';
            navegador = reqOrUser.headers['user-agent'] || '';
        } else if (typeof reqOrUser === 'string') {
            usuario = reqOrUser;
        }
        
        const sql = `
            INSERT INTO AUDIT_LOG (usuario, acao, detalhes, ip, navegador, dataHora)
            VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))
        `;
        
        await db.run(sql, [usuario, acao, detalhes, ip, navegador]);
    } catch (err) {
        console.error('❌ Falha ao gravar log de auditoria:', err.message);
    }
}

// Criar tabela de auditoria se não existir (fallback)
db.run(`CREATE TABLE IF NOT EXISTS AUDIT_LOG (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario TEXT,
    acao TEXT,
    detalhes TEXT,
    ip TEXT,
    navegador TEXT,
    dataHora DATETIME DEFAULT CURRENT_TIMESTAMP
)`);
db.run(`ALTER TABLE AUDIT_LOG ADD COLUMN ip TEXT`, () => {});
db.run(`ALTER TABLE AUDIT_LOG ADD COLUMN navegador TEXT`, () => {});

// Carregar dados ao iniciar o servidor
carregarDadosPresenca();
migrarJSONParaSQLite();

// Salvar dados periodicamente (a cada 30 segundos) - Mantido por enquanto para retrocompatibilidade
setInterval(salvarDadosPresenca, 30000);

// Salvar dados ao encerrar o servidor
// O handler consolidado está no final do arquivo.


function getMesAnoAtual() {
    const hoje = new Date();
    return `${String(hoje.getMonth() + 1).padStart(2, '0')}-${hoje.getFullYear()}`;
}

function getUltimoDiaDoMes(ano, mes) {
    return new Date(ano, mes, 0).getDate();
}

async function verificarResetMes() {
    try {
        const mesAnoAtual = getMesAnoAtual();
        
        // Se não mudou de mês ou é a primeira vez, apenas retornar
        if (!presencaMesAtual) {
            presencaMesAtual = mesAnoAtual;
            console.log(`✅ Mês atual inicializado: ${mesAnoAtual}`);
            return;
        }
        
        if (presencaMesAtual === mesAnoAtual) {
            console.log(`✅ Mês atual: ${mesAnoAtual} (sem mudanças)`);
            return;
        }
        
        // Se chegou aqui, mudou de mês
        console.log(`🔄 Novo mês detectado: ${mesAnoAtual}`);
        console.log(`📦 SALVANDO HISTÓRICO DO MÊS ANTERIOR (${presencaMesAtual})...`);
        console.log(`   ⚠️ INCLUINDO FUNCIONÁRIOS OCULTOS NO HISTÓRICO`);
        
        // SALVAR NO HISTÓRICO ANTES DE ZERAR (INCLUINDO OCULTOS)
        try {
            await salvarHistoricoPresenca(presencaMesAtual);
            console.log(`✅ Histórico do mês ${presencaMesAtual} salvo com sucesso!`);
        } catch (err) {
            console.error(`❌ ERRO ao salvar histórico do mês ${presencaMesAtual}:`, err);
        }
        
        // FAZER BACKUP EM EXCEL
        console.log(`📦 FAZENDO BACKUP EM EXCEL DO MÊS ANTERIOR (${presencaMesAtual})...`);
        try {
            await gerarBackupPresenca(presencaMesAtual);
            console.log(`✅ Backup Excel do mês ${presencaMesAtual} concluído com sucesso!`);
        } catch (err) {
            console.error(`❌ ERRO ao fazer backup do mês ${presencaMesAtual}:`, err);
        }
        
        // AGORA SIM, ZERAR PARA O NOVO MÊS
        console.log(`🗑️ Zerando dados de presença para iniciar ${mesAnoAtual}...`);
        presencaMemoria = {};
        comentariosPresenca = {};
        ocorrenciasPresenca = {};
        funcionariosOcultos = {};
        presencaMesAtual = mesAnoAtual;
        salvarDadosPresenca();
        console.log(`✅ Sistema pronto para ${mesAnoAtual}`);
    } catch (error) {
        console.error('❌ ERRO em verificarResetMes:', error);
        // Garantir que o mês atual está definido mesmo com erro
        if (!presencaMesAtual) {
            presencaMesAtual = getMesAnoAtual();
        }
    }
}

// ============ SALVAR HISTÓRICO DE PRESENÇA ============
async function salvarHistoricoPresenca(mesAno) {
    return new Promise((resolve, reject) => {
        // Buscar funcionários que tiveram presença registrada no mês
        const sql = `SELECT id, Nome, Empresa, Funcao, Situacao FROM SSMA`;
        
        db.all(sql, [], (err, funcionarios) => {
            if (err) {
                reject(err);
                return;
            }
            
            const dadosPresenca = presencaMemoria[mesAno] || {};
            const comentarios = comentariosPresenca[mesAno] || {};
            let salvos = 0;
            
            // Salvar cada funcionário que teve presença registrada
            funcionarios.forEach(func => {
                const presencaFunc = dadosPresenca[func.id];
                
                // Só salvar se teve alguma presença registrada
                if (presencaFunc && Object.keys(presencaFunc).length > 0) {
                    const insertSql = `
                        INSERT INTO HISTORICO_PRESENCA 
                        (mesAno, funcionarioId, funcionarioNome, funcionarioEmpresa, funcionarioFuncao, funcionarioSituacao, dadosPresenca, comentarios)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `;
                    
                    // Filtrar comentários deste funcionário
                    const comentariosFunc = {};
                    Object.keys(comentarios).forEach(chave => {
                        if (chave.startsWith(`${func.id}_`)) {
                            comentariosFunc[chave] = comentarios[chave];
                        }
                    });
                    
                    db.run(insertSql, [
                        mesAno,
                        func.id,
                        func.Nome,
                        func.Empresa,
                        func.Funcao ? func.Funcao.normalize('NFC').trim() : '',
                        func.Situacao,
                        JSON.stringify(presencaFunc),
                        JSON.stringify(comentariosFunc)
                    ], (err) => {
                        if (err) {
                            console.error(`❌ Erro ao salvar histórico do funcionário ${func.Nome}:`, err);
                        } else {
                            salvos++;
                        }
                    });
                }
            });
            
            setTimeout(() => {
                console.log(`📊 Histórico salvo: ${salvos} funcionários com presença registrada`);
                resolve();
            }, 1000);
        });
    });
}

// ============ BACKUP AUTOMÁTICO DE PRESENÇA ============
async function verificarBackupAutomatico() {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = agora.getMonth() + 1;
    const dia = agora.getDate();
    const hora = agora.getHours();
    const ultimoDia = getUltimoDiaDoMes(ano, mes);
    const mesAno = getMesAnoAtual();
    
    // Verificar se é o último dia do mês e são 15:00 ou mais
    if (dia === ultimoDia && hora >= 15 && !backupAutomaticoFeito[mesAno]) {
        console.log(`📦 Iniciando backup automático de presença - ${mesAno}...`);
        await gerarBackupPresenca(mesAno);
        backupAutomaticoFeito[mesAno] = true;
    }
}

async function gerarBackupPresenca(mesAno) {
    try {
        const [mes, ano] = mesAno.split('-');
        const meses = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
        const nomeMes = meses[parseInt(mes) - 1];
        
        // Buscar funcionários
        const funcionarios = await new Promise((resolve, reject) => {
            db.all(`SELECT id, Nome, Empresa, Funcao FROM SSMA WHERE Situacao = 'N' ORDER BY Empresa, Nome`, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        if (funcionarios.length === 0) {
            console.log('⚠️ Nenhum funcionário ativo para backup');
            return;
        }
        
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Presença');
        
        const diasNoMes = getUltimoDiaDoMes(parseInt(ano), parseInt(mes));
        const dadosPresenca = presencaMemoria[mesAno] || {};
        const comentarios = comentariosPresenca[mesAno] || {};
        
        // Cabeçalho
        sheet.mergeCells(1, 1, 1, 4 + diasNoMes + 2);
        sheet.getCell(1, 1).value = 'BACKUP AUTOMÁTICO - CONTROLE DE PRESENÇA';
        sheet.getCell(1, 1).font = { bold: true, size: 14 };
        sheet.getCell(1, 1).alignment = { horizontal: 'center' };
        
        sheet.mergeCells(2, 1, 2, 4 + diasNoMes + 2);
        sheet.getCell(2, 1).value = `${nomeMes} / ${ano}`;
        sheet.getCell(2, 1).font = { bold: true, size: 12 };
        sheet.getCell(2, 1).alignment = { horizontal: 'center' };
        
        // Cabeçalho das colunas
        const headerRow = sheet.getRow(4);
        headerRow.values = ['Empresa', 'Nome', 'Função', ...Array.from({length: diasNoMes}, (_, i) => i + 1), 'P', 'F'];
        headerRow.font = { bold: true };
        headerRow.alignment = { horizontal: 'center' };
        
        // Dados dos funcionários
        let rowIndex = 5;
        let comentariosLista = [];
        
        for (const func of funcionarios) {
            const row = sheet.getRow(rowIndex);
            const presencaFunc = dadosPresenca[func.id] || {};
            
            row.getCell(1).value = func.Empresa || '';
            row.getCell(2).value = func.Nome || '';
            row.getCell(3).value = func.Funcao || '';
            
            let totalP = 0;
            let totalF = 0;
            
            for (let dia = 1; dia <= diasNoMes; dia++) {
                const status = presencaFunc[dia] || '';
                row.getCell(3 + dia).value = status;
                row.getCell(3 + dia).alignment = { horizontal: 'center' };
                
                if (status === 'P') totalP++;
                if (status === 'F') totalF++;
                
                // Verificar comentário
                const chave = `${func.id}_${dia}`;
                if (comentarios[chave]) {
                    comentariosLista.push({
                        nome: func.Nome,
                        dia: dia,
                        texto: comentarios[chave].texto,
                        data: comentarios[chave].data
                    });
                }
            }
            
            row.getCell(4 + diasNoMes).value = totalP;
            row.getCell(5 + diasNoMes).value = totalF;
            
            rowIndex++;
        }
        
        // Adicionar comentários no final
        if (comentariosLista.length > 0) {
            rowIndex += 2;
            sheet.getCell(rowIndex, 1).value = 'COMENTÁRIOS:';
            sheet.getCell(rowIndex, 1).font = { bold: true };
            rowIndex++;
            
            for (const com of comentariosLista) {
                const dataFormatada = new Date(com.data).toLocaleDateString('pt-BR');
                sheet.getCell(rowIndex, 1).value = `${com.nome} - Dia ${com.dia}: ${com.texto} (${dataFormatada})`;
                rowIndex++;
            }
        }
        
        // Ajustar larguras
        sheet.getColumn(1).width = 20;
        sheet.getColumn(2).width = 30;
        sheet.getColumn(3).width = 20;
        
        // Salvar arquivo na pasta Downloads
        const downloadsPath = path.join(require('os').homedir(), 'Downloads');
        const nomeArquivo = `Backup_Presenca_${nomeMes}_${ano}.xlsx`;
        const caminhoCompleto = path.join(downloadsPath, nomeArquivo);
        
        await workbook.xlsx.writeFile(caminhoCompleto);
        console.log(`✅ Backup automático salvo em: ${caminhoCompleto}`);
        
    } catch (error) {
        console.error('❌ Erro ao gerar backup automático:', error);
    }
}

// Verificar backup a cada hora
setInterval(verificarBackupAutomatico, 60 * 60 * 1000);

// Verificar também ao iniciar o servidor (após 5 segundos)
setTimeout(verificarBackupAutomatico, 5000);
// =========================================================

// Middleware já configurado no início do arquivo (300mb para suportar backups com fotos)

// ============ SISTEMA DE AUTENTICAÇÃO ============
// Arquivo de usuários
const USERS_FILE = path.join(__dirname, 'usuarios.json');

// Carregar usuários
function carregarUsuarios() {
    try {
        if (fs.existsSync(USERS_FILE)) {
            return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        }
    } catch (err) {
        console.error('Erro ao carregar usuários:', err.message);
    }
    // Usuário master padrão
    return {
        usuarios: [
            { id: 1, login: 'master', senha: '@Senha01', tipo: 'master', nome: 'Administrador', ativo: true }
        ]
    };
}

// Salvar usuários
function salvarUsuarios(dados) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(dados, null, 2), 'utf8');
}

// Inicializar usuários
let usuariosData = carregarUsuarios();
salvarUsuarios(usuariosData); // Garantir que o arquivo existe

// Rota de login
app.post('/api/auth/login', (req, res) => {
    const { login, senha } = req.body;
    
    const usuario = usuariosData.usuarios.find(u => 
        u.login.toLowerCase() === login.toLowerCase() && u.senha === senha && u.ativo
    );
    
    if (usuario) {
        return res.json({ 
            success: true, 
            user: { 
                id: usuario.id, 
                login: usuario.login, 
                nome: usuario.nome, 
                tipo: usuario.tipo 
            } 
        });
    }

    // 🚀 FALLBACK PARA SAAS MULTI-TENANT EM CASO DE CACHE NO BROWSER!
    try {
        const { masterDb } = require('./saas-config');
        masterDb.get(`
            SELECT u.*, t.nome_empresa, t.ativo as tenant_ativo, t.plano, t.data_expiracao
            FROM usuarios_globais u
            JOIN tenants t ON u.tenant_id = t.id
            WHERE LOWER(u.login) = LOWER(?) AND u.senha = ?
        `, [login, senha], (err, row) => {
            if (err || !row) {
                return res.json({ success: false, message: 'Login ou senha incorretos' });
            }
            
            // Verificar se tenant está ativo
            if (row.tenant_ativo === 0) {
                return res.status(401).json({ success: false, message: 'Empresa desativada. Contate o suporte.' });
            }
            
            console.log(`🔐 Autenticação SaaS realizada via Fallback legada para: ${login}`);
            
            // Registrar atividade online
            global.activeTenants = global.activeTenants || {};
            global.activeTenants[row.tenant_id] = Date.now();

            return res.json({
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
        });
    } catch (e) {
        console.error('Erro no fallback de autenticação SaaS:', e);
        return res.json({ success: false, message: 'Login ou senha incorretos' });
    }
});

// Verificar sessão
app.get('/api/auth/check', (req, res) => {
    res.json({ success: true });
});

// Listar usuários (só master - Isolado por Tenant)
app.get('/api/usuarios', (req, res) => {
    db.all('SELECT id, login, senha, nome, tipo, ativo FROM USUARIOS_TENANT', [], (err, rows) => {
        if (err) {
            console.error('Erro ao listar usuários do tenant:', err);
            return res.status(500).json({ success: false, message: 'Erro ao carregar usuários.' });
        }
        
        const lista = rows.map(u => ({
            id: u.id,
            login: u.login,
            senha: u.senha,
            nome: u.nome,
            tipo: u.tipo,
            ativo: u.ativo === 1 || u.ativo === true || u.ativo === 'true'
        }));
        
        res.json({ success: true, data: lista });
    });
});

// Criar usuário (só master - Isolado por Tenant)
app.post('/api/usuarios', async (req, res) => {
    const { login, senha, nome, tipo } = req.body;
    
    if (!login || !senha || !nome) {
        return res.json({ success: false, message: 'Preencha todos os campos' });
    }
    
    try {
        const row = await db.get('SELECT id FROM USUARIOS_TENANT WHERE LOWER(login) = LOWER(?)', [login]);
        if (row) {
            return res.json({ success: false, message: 'Login já existe nesta empresa' });
        }
        
        await db.run(
            'INSERT INTO USUARIOS_TENANT (login, senha, nome, tipo, ativo) VALUES (?, ?, ?, ?, 1)',
            [login, senha, nome, tipo || 'comum']
        );
        
        await registrarLog(req, 'Criar Usuário', `Cadastrou o usuário [${nome}] (login: ${login}, nível: ${tipo || 'comum'})`);
        res.json({ success: true, message: 'Usuário criado com sucesso' });
    } catch (err) {
        console.error('Erro ao criar usuário no tenant:', err);
        res.status(500).json({ success: false, message: 'Erro ao criar usuário.' });
    }
});

// Atualizar usuário (só master - Isolado por Tenant)
app.put('/api/usuarios/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const { login, senha, nome, tipo, ativo } = req.body;
    
    try {
        const usuario = await db.get('SELECT * FROM USUARIOS_TENANT WHERE id = ?', [id]);
        if (!usuario) {
            return res.json({ success: false, message: 'Usuário não encontrado' });
        }
        
        if (id === 1) {
            if (tipo && tipo !== 'master') {
                return res.json({ success: false, message: 'Não é permitido alterar o nível de acesso do usuário proprietário (Protegido)' });
            }
            if (ativo !== undefined && !ativo) {
                return res.json({ success: false, message: 'Não é permitido desativar o usuário proprietário (Protegido)' });
            }
        }
        
        const nLogin = login || usuario.login;
        const nSenha = senha || usuario.senha;
        const nNome = nome || usuario.nome;
        const nTipo = tipo || usuario.tipo;
        const nAtivo = ativo !== undefined ? (ativo ? 1 : 0) : usuario.ativo;
        
        await db.run(
            'UPDATE USUARIOS_TENANT SET login = ?, senha = ?, nome = ?, tipo = ?, ativo = ? WHERE id = ?',
            [nLogin, nSenha, nNome, nTipo, nAtivo, id]
        );
        
        let acaoDesc = 'Atualizar Usuário';
        let detalhes = `Atualizou dados do usuário [${nNome}]`;
        
        if (ativo !== undefined && (ativo ? 1 : 0) !== usuario.ativo) {
            acaoDesc = ativo ? 'Ativar Usuário' : 'Inativar Usuário';
            detalhes = `${ativo ? 'Ativou' : 'Inativou'} o acesso do usuário [${nNome}]`;
        }
        
        await registrarLog(req, acaoDesc, detalhes);
        res.json({ success: true, message: 'Usuário atualizado' });
    } catch (err) {
        console.error('Erro ao atualizar usuário no tenant:', err);
        res.json({ success: false, message: 'Erro ao atualizar usuário.' });
    }
});

// Excluir usuário (só master - Isolado por Tenant)
app.delete('/api/usuarios/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    
    try {
        const row = await db.get('SELECT nome, tipo FROM USUARIOS_TENANT WHERE id = ?', [id]);
        if (!row) {
            return res.json({ success: false, message: 'Usuário não encontrado' });
        }
        
        if (id === 1) {
            return res.json({ success: false, message: 'Não é permitido excluir o usuário proprietário (Protegido)' });
        }
        
        await db.run('DELETE FROM USUARIOS_TENANT WHERE id = ?', [id]);
        await registrarLog(req, 'Excluir Usuário', `Excluiu permanentemente o usuário [${row.nome}]`);
        res.json({ success: true, message: 'Usuário excluído com sucesso!' });
    } catch (err) {
        console.error('❌ Erro interno ao excluir usuário:', err);
        res.json({ success: false, message: 'Erro ao excluir usuário do banco de dados.' });
    }
});

// GET - Buscar logs de auditoria (Histórico de Ações)
app.get('/api/auditoria', async (req, res) => {
    try {
        const rows = await db.all('SELECT * FROM AUDIT_LOG ORDER BY dataHora DESC LIMIT 1000');
        res.json({ success: true, data: rows || [] });
    } catch (err) {
        console.error('Erro ao buscar logs de auditoria:', err);
        res.status(500).json({ success: false, message: 'Erro ao carregar logs.' });
    }
});

// ==================== ROTAS DE RASTREAMENTO ====================

// POST - Registrar entrada no sistema (Centralizado no GlobalDB isolado por tenant)
app.post('/api/rastreamento/entrada', (req, res) => {
    const { usuario, ip, navegador, sistemaOperacional } = req.body;
    const tenantId = req.tenantId || 'ervanio-1234';

    const sql = `
        INSERT INTO RASTREAMENTO_ACESSOS (usuario, tenant_id, ip, navegador, sistemaOperacional, status, dataHoraEntrada, lastHeartbeat)
        VALUES (?, ?, ?, ?, ?, 'online', datetime('now', 'localtime'), datetime('now', 'localtime'))
    `;
    
    dbSqlite.run(sql, [usuario, tenantId, ip, navegador, sistemaOperacional], function(err) {
        if (err) {
            console.error('Erro ao registrar entrada de rastreamento:', err);
            return res.status(500).json({ error: err.message });
        }
        console.log(`✅ Entrada registrada: ${usuario} no tenant ${tenantId} (ID: ${this.lastID})`);
        res.json({ success: true, id: this.lastID });
    });
});

// PUT - Registrar saída do sistema
app.put('/api/rastreamento/saida/:id', (req, res) => {
    const { id } = req.params;
    
    const sql = `
        UPDATE RASTREAMENTO_ACESSOS 
        SET dataHoraSaida = datetime('now', 'localtime'), status = 'ausente'
        WHERE id = ?
    `;
    
    dbSqlite.run(sql, [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// PUT - Heartbeat para manter usuário online
app.put('/api/rastreamento/heartbeat/:id', (req, res) => {
    const { id } = req.params;
    
    const sql = `
        UPDATE RASTREAMENTO_ACESSOS 
        SET lastHeartbeat = datetime('now', 'localtime')
        WHERE id = ? AND status = 'online'
    `;
    
    dbSqlite.run(sql, [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// POST - Registrar saída (alternativa para sendBeacon)
app.post('/api/rastreamento/saida/:id', (req, res) => {
    const { id } = req.params;
    
    const sql = `
        UPDATE RASTREAMENTO_ACESSOS 
        SET dataHoraSaida = datetime('now', 'localtime'), status = 'ausente'
        WHERE id = ?
    `;
    
    dbSqlite.run(sql, [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// GET - Listar acessos online (tempo real, filtrado por tenant)
app.get('/api/rastreamento/online', (req, res) => {
    const tenantId = req.tenantId || 'ervanio-1234';
    
    const sql = `
        SELECT * FROM RASTREAMENTO_ACESSOS 
        WHERE status = 'online' AND tenant_id = ?
        ORDER BY dataHoraEntrada DESC
    `;
    
    dbSqlite.all(sql, [tenantId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows || [] });
    });
});

// GET - Listar histórico completo de acessos (filtrado por tenant)
app.get('/api/rastreamento/historico', (req, res) => {
    const { dataInicio, dataFim, usuario } = req.query;
    const tenantId = req.tenantId || 'ervanio-1234';
    
    let sql = `SELECT * FROM RASTREAMENTO_ACESSOS WHERE tenant_id = ?`;
    let params = [tenantId];
    
    if (dataInicio) {
        sql += ` AND DATE(dataHoraEntrada) >= DATE(?)`;
        params.push(dataInicio);
    }
    
    if (dataFim) {
        sql += ` AND DATE(dataHoraEntrada) <= DATE(?)`;
        params.push(dataFim);
    }
    
    if (usuario) {
        sql += ` AND usuario LIKE ?`;
        params.push(`%${usuario}%`);
    }
    
    sql += ` ORDER BY dataHoraEntrada DESC LIMIT 1000`;
    
    dbSqlite.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows || [] });
    });
});

// PUT - Marcar todos como ausente (limpeza isolada por tenant)
app.put('/api/rastreamento/limpar-online', (req, res) => {
    const tenantId = req.tenantId || 'ervanio-1234';
    const sql = `
        UPDATE RASTREAMENTO_ACESSOS 
        SET status = 'ausente', dataHoraSaida = datetime('now', 'localtime')
        WHERE status = 'online' AND dataHoraSaida IS NULL AND tenant_id = ?
    `;
    
    dbSqlite.run(sql, [tenantId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// DELETE - Limpar TODO o histórico de rastreamento (isolado por tenant)
app.delete('/api/rastreamento/limpar-tudo', (req, res) => {
    const tenantId = req.tenantId || 'ervanio-1234';
    const sql = `DELETE FROM RASTREAMENTO_ACESSOS WHERE tenant_id = ?`;
    
    dbSqlite.run(sql, [tenantId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        console.log(`🗑️ Histórico de rastreamento do tenant ${tenantId} limpo!`);
        res.json({ success: true, message: 'Histórico limpo com sucesso' });
    });
});

// Limpeza automática: marcar como ausente acessos online há mais de 1 minuto sem heartbeat
const limparAcessosAntigos = async () => {
    const sql = `
        UPDATE RASTREAMENTO_ACESSOS 
        SET status = 'ausente', dataHoraSaida = datetime('now', 'localtime')
        WHERE status = 'online' 
        AND dataHoraSaida IS NULL
        AND (julianday(datetime('now', 'localtime')) - julianday(lastHeartbeat)) * 24 * 60 > 1
    `;
    
    try {
        const result = await db.run(sql);
        if (result.changes > 0) {
            console.log(`🧹 Limpeza automática: ${result.changes} usuário(s) marcado(s) como ausente`);
        }
    } catch (err) {
        console.error('❌ Erro na limpeza automática:', err);
    }
};

// Executar limpeza ao iniciar
limparAcessosAntigos();

// Executar limpeza a cada 10 segundos
setInterval(limparAcessosAntigos, 10 * 1000);

// Redirecionar para login se não autenticado
app.get('/', (req, res, next) => {
    // Deixar o frontend verificar a sessão
    next();
});



// Middleware de erro para multer
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        console.error('Multer error:', err);
        return res.status(400).json({ error: 'Erro ao processar arquivo: ' + err.message });
    } else if (err) {
        console.error('Middleware error:', err);
        return res.status(500).json({ error: 'Erro no servidor: ' + err.message });
    }
    next();
});

// Configuração do multer para upload de fotos
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Inicializar o banco de dados (SQLite ou Postgres)
async function inicializarConexao() {
    if (DB_TYPE === 'postgres') {
        try {
            await pool.connect();
            console.log('✅ Conectado ao PostgreSQL');
            await initDatabase();
        } catch (err) {
            console.error('❌ Erro ao conectar com PostgreSQL:', err.message);
        }
    } else {
        console.log('✅ Conectado ao banco SQLite');
        await initDatabase();
    }
}

inicializarConexao();

// Inicializar tabelas
async function initDatabase() {
    try {
        await db.serialize(async () => {
            // Criar tabela SSMA
            await db.run(`
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
                Nr10_DataEmissao TEXT,
                Nr10_Vencimento TEXT,
                Nr10_Status TEXT,
                Nr11_DataEmissao TEXT,
                Nr11_Vencimento TEXT,
                Nr11_Status TEXT,
                Nr12_DataEmissao TEXT,
                NR12_Vencimento TEXT,
                Nr12_Status TEXT,
                Nr12_Ferramenta TEXT,
                Nr17_DataEmissao TEXT,
                Nr17_Vencimento TEXT,
                Nr17_Status TEXT,
                Nr18_DataEmissao TEXT,
                NR18_Vencimento TEXT,
                Nr18_Status TEXT,
                Nr20_DataEmissao TEXT,
                Nr20_Vencimento TEXT,
                Nr20_Status TEXT,
                Nr33_DataEmissao TEXT,
                NR33_Vencimento TEXT,
                Nr33_Status TEXT,
                Nr34_DataEmissao TEXT,
                Nr34_Vencimento TEXT,
                Nr34_Status TEXT,
                Nr35_DataEmissao TEXT,
                NR35_Vencimento TEXT,
                Nr35_Status TEXT,
                Epi_DataEmissao TEXT,
                epiVencimento TEXT,
                EpiStatus TEXT,
                Foto BLOB,
                Cadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
                DataInativacao DATETIME
            )
        `);
    
    // Criar tabela FORNECEDOR
    db.run(`
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
    
    // Criar tabela DOCUMENTACAO
    db.run(`
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
    
    // Criar tabela de configuração do relatório
    db.run(`
        CREATE TABLE IF NOT EXISTS configuracao_relatorio (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            titulo TEXT DEFAULT 'Relatório de Cursos',
            rodape TEXT DEFAULT 'SSMA',
            logo TEXT DEFAULT '/Logo-Hoss.jpg',
            tecnico_seguranca TEXT DEFAULT ''
        )
    `);
    
    // Adicionar colunas se não existirem (usando try/catch para ignorar erros de coluna duplicada)
    try { await db.run(`ALTER TABLE configuracao_relatorio ADD COLUMN logo TEXT DEFAULT '/Logo-Hoss.jpg'`); } catch (err) {}
    try { await db.run(`ALTER TABLE SSMA ADD COLUMN DataEmissao TEXT`); } catch (err) {}
    try { await db.run(`ALTER TABLE SSMA ADD COLUMN Celular TEXT`); } catch (err) {}
    try { await db.run(`ALTER TABLE SSMA ADD COLUMN CPF TEXT`); } catch (err) {}
    try { await db.run(`ALTER TABLE SSMA ADD COLUMN Nr12_Ferramenta TEXT`); } catch (err) {}
    try { await db.run(`ALTER TABLE SSMA ADD COLUMN DataInativacao DATETIME`); } catch (err) {}
    
    // Novas colunas para controle de certificados por ano
    try { await db.run(`ALTER TABLE SSMA ADD COLUMN Nr06_NumControle TEXT`); } catch (err) {}
    try { await db.run(`ALTER TABLE SSMA ADD COLUMN Nr06_AnoControle TEXT`); } catch (err) {}
    try { await db.run(`ALTER TABLE SSMA ADD COLUMN Nr12_NumControle TEXT`); } catch (err) {}
    try { await db.run(`ALTER TABLE SSMA ADD COLUMN Nr12_AnoControle TEXT`); } catch (err) {}
    try { await db.run(`ALTER TABLE SSMA ADD COLUMN Nr18_NumControle TEXT`); } catch (err) {}
    try { await db.run(`ALTER TABLE SSMA ADD COLUMN Nr18_AnoControle TEXT`); } catch (err) {}
    try { await db.run(`ALTER TABLE SSMA ADD COLUMN Nr20_NumControle TEXT`); } catch (err) {}
    try { await db.run(`ALTER TABLE SSMA ADD COLUMN Nr20_AnoControle TEXT`); } catch (err) {}
    try { await db.run(`ALTER TABLE SSMA ADD COLUMN Nr33_NumControle TEXT`); } catch (err) {}
    try { await db.run(`ALTER TABLE SSMA ADD COLUMN Nr33_AnoControle TEXT`); } catch (err) {}
    try { await db.run(`ALTER TABLE SSMA ADD COLUMN Nr11_NumControle TEXT`); } catch (err) {}
    try { await db.run(`ALTER TABLE SSMA ADD COLUMN Nr11_AnoControle TEXT`); } catch (err) {}
    try { await db.run(`ALTER TABLE SSMA ADD COLUMN Nr35_NumControle TEXT`); } catch (err) {}
    try { await db.run(`ALTER TABLE SSMA ADD COLUMN Nr35_AnoControle TEXT`); } catch (err) {}
    try { await db.run(`ALTER TABLE SSMA ADD COLUMN Nr06_Validade2Anos INTEGER DEFAULT 0`); } catch (err) {}
    try { await db.run(`ALTER TABLE SSMA ADD COLUMN Epi_Validade8Meses INTEGER DEFAULT 0`); } catch (err) {}
    try { await db.run(`ALTER TABLE SSMA ADD COLUMN Nr17_NumControle TEXT`); } catch (err) {}
    try { await db.run(`ALTER TABLE SSMA ADD COLUMN Nr17_AnoControle TEXT`); } catch (err) {}
    try { await db.run(`ALTER TABLE SSMA ADD COLUMN Epi_Dados TEXT`); } catch (err) {}
    try { await db.run(`ALTER TABLE SSMA ADD COLUMN Epi_Setor TEXT`); } catch (err) {}
    try { await db.run(`ALTER TABLE configuracao_relatorio ADD COLUMN tecnico_seguranca TEXT DEFAULT ''`); } catch (err) {}
    try { await db.run(`ALTER TABLE configuracao_relatorio ADD COLUMN epi_itens_padrao TEXT DEFAULT '[]'`); } catch (err) {}
    
    // Inserir configuração padrão se não existir
    const cfgCount = await db.get('SELECT COUNT(*) as count FROM configuracao_relatorio');
    if (cfgCount && cfgCount.count === 0) {
        await db.run(`INSERT INTO configuracao_relatorio (titulo, rodape, logo) VALUES (?, ?, ?)`, 
            ['Relatório de Cursos', 'SSMA', '/Logo-Hoss.jpg']);
    }

    // Criar tabela HABILITAR_CURSOS
    await db.run(`
        CREATE TABLE IF NOT EXISTS HABILITAR_CURSOS (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            curso TEXT NOT NULL,
            habilitado INTEGER DEFAULT 1
        )
    `);
    
    // Inserir cursos padrão se não existir
    const cursosPadrao = ['ASO', 'NR-06', 'NR-10', 'NR-11', 'NR-12', 'NR-17', 'NR-18', 'NR-20', 'NR-33', 'NR-34', 'NR-35', 'EPI'];
    
    for (const curso of cursosPadrao) {
        const existe = await db.get('SELECT id FROM HABILITAR_CURSOS WHERE curso = ?', [curso]);
        if (!existe) {
            await db.run(`INSERT INTO HABILITAR_CURSOS (curso, habilitado) VALUES (?, 1)`, [curso]);
            console.log(`✅ Curso ${curso} adicionado à tabela HABILITAR_CURSOS`);
        }
    }
    console.log('✅ Verificação de cursos concluída na tabela HABILITAR_CURSOS');
    
    // Criar tabela RASTREAMENTO_ACESSOS
    await db.run(`
        CREATE TABLE IF NOT EXISTS RASTREAMENTO_ACESSOS (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    
    // Criar tabela HISTORICO_PRESENCA
    await db.run(`
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
    
    // Criar tabela MUDANCA_FUNCAO_PRESENCA
    await db.run(`
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
    
    // Criar tabela EMPRESAS_OCULTAS
    await db.run(`
        CREATE TABLE IF NOT EXISTS EMPRESAS_OCULTAS (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresaOculta TEXT NOT NULL UNIQUE,
            dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Criar tabela de configuração das NRs (Persistência Global)
    await db.run(`
        CREATE TABLE IF NOT EXISTS configuracao_nrs (
            nr TEXT PRIMARY KEY,
            dados TEXT,
            dataAtualizacao DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
        }); // Fim do db.serialize
        
        // Criar índices
        await db.run(`CREATE INDEX IF NOT EXISTS idx_ssma_situacao ON SSMA(Situacao)`);
        await db.run(`CREATE INDEX IF NOT EXISTS idx_ssma_empresa ON SSMA(Empresa)`);
        await db.run(`CREATE INDEX IF NOT EXISTS idx_ssma_nome ON SSMA(Nome)`);
        await db.run(`CREATE INDEX IF NOT EXISTS idx_ssma_funcao ON SSMA(Funcao)`);
        await db.run(`CREATE INDEX IF NOT EXISTS idx_ssma_empresa_nome ON SSMA(Empresa, Nome)`);
        await db.run(`CREATE INDEX IF NOT EXISTS idx_fornecedor_situacao ON FORNECEDOR(Situacao)`);
        console.log('⚡ Índices de performance criados/verificados');
        
        // Verificar registros padrão
        await verificarRegistrosPadraoSSMA();
        await verificarFornecedorPadrao();
        
        console.log('Tabelas criadas/verificadas com sucesso');
    } catch (err) {
        console.error('❌ Erro no initDatabase:', err);
    }
}

async function verificarRegistrosPadraoSSMA() {
    // Garantir que existe pelo menos um registro
    const row = await db.get('SELECT COUNT(*) as count FROM SSMA');
    if (row && row.count === 0) {
        await db.run(`INSERT INTO SSMA (
            Nome, Empresa, Funcao, Vencimento, Nr10_Vencimento, 
            Situacao, Anotacoes, Ambientacao, Nr10_DataEmissao
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            'Ervanio Freitas Rodrigues', 'Hoss', 'Técnico de Segurança',
            '2026-12-08', '2027-12-09', 'S', 'teste', 'S', '09/12/2025'
        ]);
        console.log('Registro padrão inserido');
    }
}

async function verificarFornecedorPadrao() {
    const row = await db.get('SELECT COUNT(*) as count FROM FORNECEDOR');
    if (row && row.count === 0) {
        await db.run(`INSERT INTO FORNECEDOR (
            Empresa, CNPJ, Telefone, Celular, Contato, Observacao, Situacao
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
            'Hoss', '00.000.000/0000-00', '(11) 2554-3998', '(11) 94576-6912',
            'Ervanio Freitas Rodrigues', 'Suporte de TI', 'S'
        ]);
        console.log('Fornecedor padrão inserido');
    }
}

// ==================== NOVAS ROTAS PARA CONFIGURAÇÃO DE NRS ====================

// GET - Buscar configurações de uma NR
app.get('/api/config/nr/:nr', async (req, res) => {
    const nr = req.params.nr.toLowerCase();
    const sql = `SELECT dados FROM configuracao_nrs WHERE nr = ?`;
    
    try {
        const row = await db.get(sql, [nr]);
        if (row && row.dados) {
            res.json({ success: true, dados: JSON.parse(row.dados) });
        } else {
            res.json({ success: false, message: 'Configuração não encontrada' });
        }
    } catch (err) {
        console.error(`Erro ao carregar config da ${nr}:`, err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST - Salvar configurações de uma NR
app.post('/api/config/nr/:nr', async (req, res) => {
    const nr = req.params.nr.toLowerCase();
    const { dados } = req.body;
    
    if (!dados) {
        return res.status(400).json({ success: false, message: 'Dados não informados' });
    }
    
    const dadosJson = JSON.stringify(dados);
    const sql = DB_TYPE === 'sqlite' 
        ? `INSERT INTO configuracao_nrs (nr, dados, dataAtualizacao) VALUES (?, ?, datetime('now', 'localtime')) 
           ON CONFLICT(nr) DO UPDATE SET dados = excluded.dados, dataAtualizacao = datetime('now', 'localtime')`
        : `INSERT INTO configuracao_nrs (nr, dados, dataAtualizacao) VALUES ($1, $2, CURRENT_TIMESTAMP) 
           ON CONFLICT(nr) DO UPDATE SET dados = EXCLUDED.dados, dataAtualizacao = CURRENT_TIMESTAMP`;
    
    try {
        await db.run(sql, [nr, dadosJson]);
        console.log(`✅ Configuração da ${nr.toUpperCase()} salva no banco de dados`);
        res.json({ success: true, message: 'Configuração salva com sucesso' });
    } catch (err) {
        console.error(`Erro ao salvar config da ${nr}:`, err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==============================================================================

// FUNÇÃO PARA CALCULAR STATUS DOS CURSOS (igual ao sistema desktop)
function calcularStatus(dataVencimento) {
    if (!dataVencimento) return 'NaoInformado';
    
    const hoje = new Date();
    const vencimento = new Date(dataVencimento);
    const diffTime = vencimento - hoje;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Vencido';
    if (diffDays <= 30) return 'Renovar';
    return 'OK';
}

// ROTAS DA API - EXATAMENTE IGUAL AO SISTEMA DESKTOP

// GET - Verificar CPF duplicado (usado pelo frontend antes de salvar)
app.get('/api/ssma/check-cpf', async (req, res) => {
    const { cpf, excludeId } = req.query;
    
    if (!cpf) {
        return res.json({ exists: false });
    }
    
    console.log('🔍 Verificando CPF duplicado:', cpf, 'excludeId:', excludeId);
    
    let sql = `
        SELECT id, Nome, Empresa, Situacao FROM SSMA 
        WHERE CPF = ? AND Situacao = 'N'
    `;
    const params = [cpf];
    
    // Se está editando, excluir o próprio registro da verificação
    if (excludeId) {
        sql += ' AND id != ?';
        params.push(excludeId);
    }
    
    sql += ' LIMIT 1';
    
    try {
        const row = await db.get(sql, params);
        if (row) {
            console.log('⚠️ CPF duplicado encontrado:', row);
            res.json({ 
                exists: true, 
                id: row.id,
                nome: row.Nome,
                empresa: row.Empresa,
                situacao: row.Situacao
            });
        } else {
            console.log('✅ CPF disponível');
            res.json({ exists: false });
        }
    } catch (err) {
        console.error('Erro ao verificar CPF:', err);
        res.status(500).json({ error: 'Erro ao verificar CPF' });
    }
});

// Função para normalizar a capitalização das colunas retornadas do SQLite, para evitar bugs de casing
const normalizarCasingRow = (row) => {
    if (!row) return row;
    
    // NR12
    if (row.Nr12_Vencimento !== undefined && row.NR12_Vencimento === undefined) row.NR12_Vencimento = row.Nr12_Vencimento;
    if (row.NR12_Vencimento !== undefined && row.Nr12_Vencimento === undefined) row.Nr12_Vencimento = row.NR12_Vencimento;
    if (row.Nr12_DataEmissao !== undefined && row.nr12_dataEmissao === undefined) row.nr12_dataEmissao = row.Nr12_DataEmissao;
    if (row.Nr12_Status !== undefined && row.nr12_status === undefined) row.nr12_status = row.Nr12_Status;
    if (row.Nr12_Ferramenta !== undefined && row.nr12_ferramenta === undefined) row.nr12_ferramenta = row.Nr12_Ferramenta;

    // NR18
    if (row.Nr18_Vencimento !== undefined && row.NR18_Vencimento === undefined) row.NR18_Vencimento = row.Nr18_Vencimento;
    if (row.NR18_Vencimento !== undefined && row.Nr18_Vencimento === undefined) row.Nr18_Vencimento = row.NR18_Vencimento;

    // NR33
    if (row.Nr33_Vencimento !== undefined && row.NR33_Vencimento === undefined) row.NR33_Vencimento = row.Nr33_Vencimento;
    if (row.NR33_Vencimento !== undefined && row.Nr33_Vencimento === undefined) row.Nr33_Vencimento = row.NR33_Vencimento;

    // NR35
    if (row.Nr35_Vencimento !== undefined && row.NR35_Vencimento === undefined) row.NR35_Vencimento = row.Nr35_Vencimento;
    if (row.NR35_Vencimento !== undefined && row.Nr35_Vencimento === undefined) row.Nr35_Vencimento = row.NR35_Vencimento;

    return row;
};

// GET - Listar todos os registros SSMA com filtros (RESTAURAÇÃO NUCLEAR)
app.get('/api/ssma', async (req, res) => {
    const { nome, empresa, funcao, situacao, page = 1, limit = 10,
            statusASO, statusNR06, statusNR10, statusNR11, statusNR12, 
            statusNR17, statusNR18, statusNR20, statusNR33, statusNR34, 
            statusNR35, statusEPI, dataInicio, dataFim } = req.query;
    
    // Função para remover acentos
    const removerAcentos = (texto) => {
        if (!texto) return '';
        return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    };
    
    // NUCLEAR: Carregar TUDO do banco para evitar colunas faltando
    let sql = 'SELECT * FROM SSMA WHERE 1=1';
    let params = [];
    
    if (nome) {
        sql += ' AND UPPER(Nome) LIKE UPPER(?)';
        params.push(`%${removerAcentos(nome)}%`);
    }
    if (empresa) {
        sql += ' AND UPPER(Empresa) LIKE UPPER(?)';
        params.push(`%${removerAcentos(empresa)}%`);
    }
    if (funcao) {
        sql += ' AND UPPER(Funcao) LIKE UPPER(?)';
        params.push(`%${removerAcentos(funcao)}%`);
    }
    if (situacao) {
        sql += ' AND Situacao = ?';
        params.push(situacao);
    }
    
    const dateFunc = DB_TYPE === 'postgres' ? 'CAST(Cadastro AS DATE)' : 'date(Cadastro)';
    if (dataInicio) {
        sql += ` AND ${dateFunc} >= ?`;
        params.push(dataInicio);
    }
    if (dataFim) {
        sql += ` AND ${dateFunc} <= ?`;
        params.push(dataFim);
    }
    
    sql += ' ORDER BY Empresa, Nome';
    
    try {
        const allRows = await db.all(sql, params);
        let filteredRows = allRows;
        
        const getStatus = (dataStr) => {
            if (!dataStr) return 'NaoInformado';
            const hoje = new Date();
            const data = new Date(dataStr);
            const diffDays = Math.ceil((data - hoje) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) return 'Vencido';
            if (diffDays <= 30) return 'Renovar';
            return 'OK';
        };
        
        const cursosStatusMap = {
            'statusASO': 'Vencimento', 'statusNR06': 'Nr06_Vencimento', 'statusNR10': 'Nr10_Vencimento',
            'statusNR11': 'Nr11_Vencimento', 'statusNR12': 'NR12_Vencimento', 'statusNR17': 'Nr17_Vencimento',
            'statusNR18': 'NR18_Vencimento', 'statusNR20': 'Nr20_Vencimento', 'statusNR33': 'NR33_Vencimento',
            'statusNR34': 'Nr34_Vencimento', 'statusNR35': 'NR35_Vencimento', 'statusEPI': 'epiVencimento'
        };

        Object.keys(cursosStatusMap).forEach(statusKey => {
            const statusValue = req.query[statusKey];
            if (statusValue) {
                const column = cursosStatusMap[statusKey];
                filteredRows = filteredRows.filter(row => {
                    const status = getStatus(row[column]);
                    if (statusValue === 'vencido') return status === 'Vencido';
                    if (statusValue === 'renovar') return status === 'Renovar';
                    if (statusValue === 'ok') return status === 'OK';
                    return true;
                });
            }
        });
        
        const total = filteredRows.length;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;
        const rows = filteredRows.slice(offset, offset + limitNum);
        
        rows.forEach(row => {
            normalizarCasingRow(row);
            row.Nr06_Status = calcularStatus(row.Nr06_Vencimento);
            row.Nr10_Status = calcularStatus(row.Nr10_Vencimento);
            row.Nr11_Status = calcularStatus(row.Nr11_Vencimento);
            row.Nr12_Status = calcularStatus(row.NR12_Vencimento);
            row.Nr17_Status = calcularStatus(row.Nr17_Vencimento);
            row.Nr18_Status = calcularStatus(row.NR18_Vencimento);
            row.Nr20_Status = calcularStatus(row.Nr20_Vencimento);
            row.Nr33_Status = calcularStatus(row.NR33_Vencimento);
            row.Nr34_Status = calcularStatus(row.Nr34_Vencimento);
            row.Nr35_Status = calcularStatus(row.NR35_Vencimento);
            row.EpiStatus = calcularStatus(row.epiVencimento);
            
            // Flag para o frontend saber se tem foto
            row.temFoto = row.Foto ? 1 : 0;
            if (row.temFoto) {
                const tenantParam = req.tenantId ? `?tenant_id=${req.tenantId}` : '';
                row.fotoUrl = `/api/foto/${row.id}${tenantParam}`;
            } else {
                row.fotoUrl = null;
            }
            // Remover binário pesado do JSON para não travar o navegador
            delete row.Foto;
        });
        
        const counts = await db.get(`SELECT 
            SUM(CASE WHEN Situacao = 'N' THEN 1 ELSE 0 END) as totalAtivos,
            SUM(CASE WHEN Situacao = 'S' THEN 1 ELSE 0 END) as totalInativos
            FROM SSMA`);
            
        res.json({
            data: rows,
            total: total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
            totalAtivos: counts?.totalAtivos || 0,
            totalInativos: counts?.totalInativos || 0
        });
    } catch (err) {
        console.error('Erro /api/ssma NUCLEAR:', err);
        res.status(500).json({ error: err.message });
    }
});


// GET - Contadores de vencimentos para TODOS os registros filtrados (RESTAURADO)
app.get('/api/ssma/contadores', async (req, res) => {
    const { nome, empresa, funcao, situacao, dataInicio, dataFim } = req.query;
    
    let sql = 'SELECT Vencimento, Nr06_Vencimento, Nr10_Vencimento, Nr11_Vencimento, NR12_Vencimento, Nr17_Vencimento, NR18_Vencimento, Nr20_Vencimento, NR33_Vencimento, Nr34_Vencimento, NR35_Vencimento, epiVencimento FROM SSMA WHERE 1=1';
    let params = [];
    
    const removerAcentos = (texto) => {
        if (!texto) return '';
        return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    };

    if (nome) {
        sql += ' AND UPPER(Nome) LIKE UPPER(?)';
        params.push(`%${removerAcentos(nome)}%`);
    }
    if (empresa) {
        sql += ' AND UPPER(Empresa) LIKE UPPER(?)';
        params.push(`%${removerAcentos(empresa)}%`);
    }
    if (funcao) {
        sql += ' AND UPPER(Funcao) LIKE UPPER(?)';
        params.push(`%${removerAcentos(funcao)}%`);
    }
    if (situacao) {
        sql += ' AND Situacao = ?';
        params.push(situacao);
    }
    
    const dateFunc = DB_TYPE === 'postgres' ? 'CAST(Cadastro AS DATE)' : 'date(Cadastro)';
    if (dataInicio) {
        sql += ` AND ${dateFunc} >= ?`;
        params.push(dataInicio);
    }
    if (dataFim) {
        sql += ` AND ${dateFunc} <= ?`;
        params.push(dataFim);
    }
    
    try {
        const rows = await db.all(sql, params);
        const contadores = {
            aso: { vencidos: 0, renovar: 0 },
            nr06: { vencidos: 0, renovar: 0 },
            nr10: { vencidos: 0, renovar: 0 },
            nr11: { vencidos: 0, renovar: 0 },
            nr12: { vencidos: 0, renovar: 0 },
            nr17: { vencidos: 0, renovar: 0 },
            nr18: { vencidos: 0, renovar: 0 },
            nr20: { vencidos: 0, renovar: 0 },
            nr33: { vencidos: 0, renovar: 0 },
            nr34: { vencidos: 0, renovar: 0 },
            nr35: { vencidos: 0, renovar: 0 },
            epi: { vencidos: 0, renovar: 0 }
        };
        
        const getStatus = (dataStr) => {
            if (!dataStr) return 'OK';
            const hoje = new Date();
            const data = new Date(dataStr);
            const diffDays = Math.ceil((data - hoje) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) return 'Vencido';
            if (diffDays <= 30) return 'Renovar';
            return 'OK';
        };
        
        rows.forEach(row => {
            normalizarCasingRow(row);
            if (getStatus(row.Vencimento) === 'Vencido') contadores.aso.vencidos++;
            else if (getStatus(row.Vencimento) === 'Renovar') contadores.aso.renovar++;
            
            if (getStatus(row.Nr06_Vencimento) === 'Vencido') contadores.nr06.vencidos++;
            else if (getStatus(row.Nr06_Vencimento) === 'Renovar') contadores.nr06.renovar++;
            
            if (getStatus(row.Nr10_Vencimento) === 'Vencido') contadores.nr10.vencidos++;
            else if (getStatus(row.Nr10_Vencimento) === 'Renovar') contadores.nr10.renovar++;
            
            if (getStatus(row.Nr11_Vencimento) === 'Vencido') contadores.nr11.vencidos++;
            else if (getStatus(row.Nr11_Vencimento) === 'Renovar') contadores.nr11.renovar++;
            
            if (getStatus(row.NR12_Vencimento) === 'Vencido') contadores.nr12.vencidos++;
            else if (getStatus(row.NR12_Vencimento) === 'Renovar') contadores.nr12.renovar++;
            
            if (getStatus(row.Nr17_Vencimento) === 'Vencido') contadores.nr17.vencidos++;
            else if (getStatus(row.Nr17_Vencimento) === 'Renovar') contadores.nr17.renovar++;
            
            if (getStatus(row.NR18_Vencimento) === 'Vencido') contadores.nr18.vencidos++;
            else if (getStatus(row.NR18_Vencimento) === 'Renovar') contadores.nr18.renovar++;
            
            if (getStatus(row.Nr20_Vencimento) === 'Vencido') contadores.nr20.vencidos++;
            else if (getStatus(row.Nr20_Vencimento) === 'Renovar') contadores.nr20.renovar++;
            
            if (getStatus(row.NR33_Vencimento) === 'Vencido') contadores.nr33.vencidos++;
            else if (getStatus(row.NR33_Vencimento) === 'Renovar') contadores.nr33.renovar++;
            
            if (getStatus(row.Nr34_Vencimento) === 'Vencido') contadores.nr34.vencidos++;
            else if (getStatus(row.Nr34_Vencimento) === 'Renovar') contadores.nr34.renovar++;
            
            if (getStatus(row.NR35_Vencimento) === 'Vencido') contadores.nr35.vencidos++;
            else if (getStatus(row.NR35_Vencimento) === 'Renovar') contadores.nr35.renovar++;
            
            if (getStatus(row.epiVencimento) === 'Vencido') contadores.epi.vencidos++;
            else if (getStatus(row.epiVencimento) === 'Renovar') contadores.epi.renovar++;
        });
        
        res.json(contadores);
    } catch (err) {
        console.error('Erro em /api/ssma/contadores (Restaurado):', err);
        res.status(500).json({ error: err.message });
    }
});

// GET - Servir foto específica
app.get('/api/foto/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const row = await db.get('SELECT Foto FROM SSMA WHERE id = ?', [id]);
        if (!row || !row.Foto) {
            return res.status(404).json({ error: 'Foto não encontrada' });
        }
        
        let buffer;
        if (typeof row.Foto === 'string') {
            buffer = Buffer.from(row.Foto, 'base64');
        } else {
            buffer = row.Foto;
        }
        
        res.set('Content-Type', 'image/jpeg');
        res.send(buffer);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== ROTAS DE CONTAGEM ====================
// IMPORTANTE: Estas rotas devem vir ANTES de /api/ssma/:id
// para evitar que "count" seja interpretado como um ID

app.get('/api/ssma/count', async (req, res) => {
    try {
        const row = await db.get('SELECT COUNT(*) as total FROM SSMA');
        res.json({ total: row.total });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/fornecedores/count', async (req, res) => {
    try {
        const row = await db.get('SELECT COUNT(*) as total FROM FORNECEDOR');
        res.json({ total: row.total });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/documentacao/count', async (req, res) => {
    try {
        const row = await db.get('SELECT COUNT(*) as total FROM DOCUMENTACAO');
        res.json({ total: row.total });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/presenca/count', (req, res) => {
    try {
        // Contar total de registros de presença em memória
        let total = 0;
        for (const mesAno in presencaMemoria) {
            for (const funcId in presencaMemoria[mesAno]) {
                total += Object.keys(presencaMemoria[mesAno][funcId]).length;
            }
        }
        res.json({ total: total });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET - Buscar registro específico
app.get('/api/ssma/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const row = await db.get('SELECT * FROM SSMA WHERE id = ?', [id]);
        if (!row) {
            return res.status(404).json({ error: 'Registro não encontrado' });
        }
        normalizarCasingRow(row);
        
        row.Nr10_Status = calcularStatus(row.Nr10_Vencimento);
        row.Nr11_Status = calcularStatus(row.Nr11_Vencimento);
        row.Nr12_Status = calcularStatus(row.NR12_Vencimento);
        row.Nr17_Status = calcularStatus(row.Nr17_Vencimento);
        row.Nr18_Status = calcularStatus(row.NR18_Vencimento);
        row.Nr33_Status = calcularStatus(row.NR33_Vencimento);
        row.Nr35_Status = calcularStatus(row.NR35_Vencimento);
        row.EpiStatus = calcularStatus(row.epiVencimento);
        
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Mapeamento de carga horária por curso (NR)
const NR_DURATIONS = {
    'nr06': 4,
    'nr10': 8,
    'nr11': 8,
    'nr12': 4,
    'nr17': 2,
    'nr18': 4,
    'nr20': 16,
    'nr33': 16,
    'nr34': 8,
    'nr35': 8,
    'epi': 4
};

// GET - Obter próximo número de controle para um NR e Ano
app.get('/api/ssma/proximo-numero', async (req, res) => {
    const { nr, ano } = req.query;
    
    if (!nr || !ano) {
        return res.status(400).json({ error: 'NR e Ano são obrigatórios' });
    }
    
    try {
        // Mapear NR para a coluna correta no banco
        const nrMap = {
            'nr06': 'Nr06_NumControle',
            'nr11': 'Nr11_NumControle',
            'nr12': 'Nr12_NumControle',
            'nr17': 'Nr17_NumControle',
            'nr18': 'Nr18_NumControle',
            'nr20': 'Nr20_NumControle',
            'nr33': 'Nr33_NumControle',
            'nr35': 'Nr35_NumControle'
        };
        
        const colNum = nrMap[nr.toLowerCase()];
        const colAno = nr.toLowerCase() === 'nr06' ? 'Nr06_AnoControle' : 
                      nr.toLowerCase() === 'nr11' ? 'Nr11_AnoControle' : 
                      nr.toLowerCase() === 'nr12' ? 'Nr12_AnoControle' :
                      nr.toLowerCase() === 'nr17' ? 'Nr17_AnoControle' :
                      nr.toLowerCase() === 'nr18' ? 'Nr18_AnoControle' :
                      nr.toLowerCase() === 'nr20' ? 'Nr20_AnoControle' :
                      nr.toLowerCase() === 'nr33' ? 'Nr33_AnoControle' :
                      'Nr35_AnoControle';

        if (!colNum) {
            return res.status(400).json({ error: 'NR inválida para controle de numeração' });
        }

        const sql = `SELECT MAX(CAST(${colNum} AS INTEGER)) as ultimo FROM SSMA WHERE ${colAno} = ?`;
        const row = await db.get(sql, [ano]);
        
        const proximo = (row && row.ultimo ? parseInt(row.ultimo) : 0) + 1;
        res.json({ proximo: proximo.toString().padStart(3, '0') });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET - Verificar se um número de controle já existe para um NR e Ano
app.get('/api/ssma/verificar-numero', async (req, res) => {
    const { nr, ano, num, id } = req.query;
    
    if (!nr || !ano || !num) {
        return res.status(400).json({ error: 'NR, Ano e Número são obrigatórios' });
    }
    
    try {
        const nrMap = {
            'nr06': 'Nr06', 'nr11': 'Nr11', 'nr12': 'Nr12', 'nr17': 'Nr17', 
            'nr20': 'Nr20', 'nr33': 'Nr33', 'nr35': 'Nr35'
        };
        const key = nrMap[nr.toLowerCase()];
        if (!key) return res.status(400).json({ error: 'NR inválida' });

        const sql = `SELECT id, Nome FROM SSMA WHERE ${key}_NumControle = ? AND ${key}_AnoControle = ? AND id != ? LIMIT 1`;
        const row = await db.get(sql, [num, ano, id || 0]);
        
        if (row) {
            res.json({ exists: true, name: row.Nome });
        } else {
            res.json({ exists: false });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH - Atualizar apenas o número e ano de controle de um NR específico
app.patch('/api/ssma/:id/numero-controle', async (req, res) => {
    const { id } = req.params;
    const { nr, num, ano } = req.body;
    
    // Log para depuração (visto no console do servidor)
    console.log(`📥 [PATCH/NumControle] ID: ${id}, NR: ${nr}, Num: ${num}, Ano: ${ano}`);

    if (!nr) {
        return res.status(400).json({ error: 'NR é obrigatório' });
    }
    
    try {
        const nrMap = {
            'nr06': 'Nr06', 'nr12': 'Nr12', 'nr18': 'Nr18', 
            'nr20': 'Nr20', 'nr33': 'Nr33', 'nr35': 'Nr35'
        };
        const key = nrMap[nr.toLowerCase()];
        if (!key) return res.status(400).json({ error: 'NR inválida' });

        const numeroFinal = num || '';
        const anoFinal = ano || new Date().getFullYear();

        // 1. Verificar se já existe (Deduplicação de Segurança) - Apenas se num não for vazio
        if (numeroFinal) {
            const checkSql = `SELECT id, Nome FROM SSMA WHERE ${key}_NumControle = ? AND ${key}_AnoControle = ? AND id != ? LIMIT 1`;
            const existing = await db.get(checkSql, [numeroFinal, anoFinal, id]);
            
            if (existing) {
                console.warn(`⚠️ [PATCH/NumControle] Conflito: ${numeroFinal}/${anoFinal} já existe para ${existing.Nome}`);
                return res.status(409).json({ 
                    error: `Número ${numeroFinal} já em uso por ${existing.Nome}`,
                    name: existing.Nome 
                });
            }
        }

        // 2. Prosseguir com o update
        const sql = `UPDATE SSMA SET ${key}_NumControle = ?, ${key}_AnoControle = ? WHERE id = ?`;
        const result = await db.run(sql, [numeroFinal, anoFinal, id]);
        
        if (result.changes > 0) {
            console.log(`✅ [PATCH/NumControle] Salvo com sucesso para ID ${id}`);
            res.json({ message: 'Número de controle atualizado com sucesso' });
        } else {
            console.error(`❌ [PATCH/NumControle] Nenhuma alteração feita para ID ${id}. Registro existe?`);
            res.status(404).json({ error: 'Registro não encontrado para atualização' });
        }
    } catch (err) {
        console.error(`❌ [PATCH/NumControle] Erro:`, err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST - Criar novo registro
app.post('/api/ssma', async (req, res) => {
    // Normalize body key casing for all courses to prevent any database updates from going blank
    for (const key of Object.keys(req.body)) {
        const lowerKey = key.toLowerCase();
        if (lowerKey !== key && req.body[key] !== undefined && req.body[lowerKey] === undefined) {
            req.body[lowerKey] = req.body[key];
        }
    }
    
    let {
        nome, empresa, funcao, celular, cpf, dataEmissao, vencimento,
        nr06_dataEmissao, nr10_dataEmissao, nr11_dataEmissao, nr12_dataEmissao, nr17_dataEmissao, nr18_dataEmissao, nr20_dataEmissao, nr33_dataEmissao, nr34_dataEmissao, nr35_dataEmissao, epi_dataEmissao,
        nr06_vencimento, nr10_vencimento, nr11_vencimento, nr12_vencimento, nr17_vencimento, nr18_vencimento, nr20_vencimento, nr33_vencimento, nr34_vencimento, nr35_vencimento, epi_vencimento,
        nr06_status, nr10_status, nr11_status, nr12_status, nr17_status, nr18_status, nr20_status, nr33_status, nr34_status, nr35_status, epi_status,
        nr12_ferramenta,
        nr06_numControle, nr06_anoControle, nr06_validade2anos,
        nr11_numControle, nr11_anoControle,
        nr12_numControle, nr12_anoControle,
        nr17_numControle, nr17_anoControle,
        nr18_numControle, nr18_anoControle,
        nr20_numControle, nr20_anoControle,
        nr33_numControle, nr33_anoControle,
        nr35_numControle, nr35_anoControle,
        situacao = 'S', anotacoes, ambientacao, fotoBase64, dataInativacao, ignorarInvalidez
    } = req.body;
    
    // ✅ CONVERTER TUDO PARA MAIÚSCULO E SEM ACENTOS
    nome = normalizarTexto(nome);
    empresa = normalizarTexto(empresa);
    funcao = normalizarTexto(funcao);
    anotacoes = normalizarTexto(anotacoes);
    nr12_ferramenta = normalizarTexto(nr12_ferramenta);
    
    if (!nome || !empresa || !funcao) {
        return res.status(400).json({ error: 'Nome, Empresa e Função são obrigatórios' });
    }
    
    // ============ VALIDAÇÃO DE CARGA HORÁRIA DIÁRIA (MÁX 8H) ============
    const datasTrabalho = {};
    const nrsParaVerificar = [
        { key: 'nr06', data: nr06_dataEmissao },
        { key: 'nr10', data: nr10_dataEmissao },
        { key: 'nr11', data: nr11_dataEmissao },
        { key: 'nr12', data: nr12_dataEmissao },
        { key: 'nr17', data: nr17_dataEmissao },
        { key: 'nr18', data: nr18_dataEmissao },
        { key: 'nr20', data: nr20_dataEmissao },
        { key: 'nr33', data: nr33_dataEmissao },
        { key: 'nr34', data: nr34_dataEmissao },
        { key: 'nr35', data: nr35_dataEmissao },
        { key: 'epi', data: epi_dataEmissao }
    ];

    nrsParaVerificar.forEach(item => {
        if (item.data && item.data.trim() !== '') {
            if (!datasTrabalho[item.data]) datasTrabalho[item.data] = { total: 0, cursos: [] };
            const horas = NR_DURATIONS[item.key] || 0;
            datasTrabalho[item.data].total += horas;
            datasTrabalho[item.data].cursos.push(`${item.key.toUpperCase()} (${horas}h)`);
        }
    });

    for (const data in datasTrabalho) {
        // Validação de carga horária removida do backend a pedido do usuário.
        // O bloqueio agora é visual (marca d'água de INVÁLIDO) no certificado pelo frontend.
    }
    // ============ FIM VALIDAÇÃO CARGA HORÁRIA ============
    
    
    try {
        // VERIFICAR CPF DUPLICADO
        if (cpf && cpf.trim() !== '') {
            const cpfRow = await db.get("SELECT id, Nome, Empresa FROM SSMA WHERE CPF = ? AND Situacao = 'N' LIMIT 1", [cpf]);
            if (cpfRow) {
                return res.status(409).json({ 
                    error: `CPF já cadastrado para ${cpfRow.Nome} (${cpfRow.Empresa})`,
                    duplicateId: cpfRow.id,
                    duplicateType: 'cpf'
                });
            }
        }
        
        // VERIFICAR UNICIDADE DE NÚMERO DE CONTROLE POR ANO (Para NRs 06, 12, 18, 20, 33, 35)
        const nrsValidar = [
            { key: 'Nr06', num: nr06_numControle, ano: nr06_anoControle, label: 'NR-06' },
            { key: 'Nr11', num: nr11_numControle, ano: nr11_anoControle, label: 'NR-11' },
            { key: 'Nr12', num: nr12_numControle, ano: nr12_anoControle, label: 'NR-12' },
            { key: 'Nr18', num: nr18_numControle, ano: nr18_anoControle, label: 'NR-18' },
            { key: 'Nr20', num: nr20_numControle, ano: nr20_anoControle, label: 'NR-20' },
            { key: 'Nr33', num: nr33_numControle, ano: nr33_anoControle, label: 'NR-33' },
            { key: 'Nr35', num: nr35_numControle, ano: nr35_anoControle, label: 'NR-35' }
        ];

        for (const nr of nrsValidar) {
            if (nr.num && nr.ano) {
                const dupCert = await db.get(`SELECT id, Nome FROM SSMA WHERE ${nr.key}_NumControle = ? AND ${nr.key}_AnoControle = ? LIMIT 1`, [nr.num, nr.ano]);
                if (dupCert) {
                    return res.status(409).json({ 
                        error: `O número de controle ${nr.num} para o ano ${nr.ano} já está em uso na ${nr.label} (Funcionário ID: ${dupCert.id} - ${dupCert.Nome})`,
                        duplicateId: dupCert.id,
                        duplicateType: 'controle_nr'
                    });
                }
            }
        }
        
        // VERIFICAR DUPLICATA NOME + EMPRESA + FUNÇÃO
        const dupRow = await db.get("SELECT id FROM SSMA WHERE Nome = ? AND Empresa = ? AND Funcao = ? LIMIT 1", [nome, empresa, funcao]);
        if (dupRow) {
            return res.status(409).json({ 
                error: `Registro duplicado já existe`,
                duplicateId: dupRow.id,
                duplicateType: 'nome'
            });
        }
        
        let fotoBuffer = fotoBase64 ? Buffer.from(fotoBase64, 'base64') : null;
        
        const sql = `
            INSERT INTO SSMA (
                Nome, Empresa, Funcao, Celular, CPF, DataEmissao, Vencimento,
                Nr06_DataEmissao, Nr06_Vencimento, Nr06_Status, Nr06_Validade2Anos,
                Nr10_DataEmissao, Nr10_Vencimento, Nr10_Status,
                Nr11_DataEmissao, Nr11_Vencimento, Nr11_Status,
                Nr12_DataEmissao, NR12_Vencimento, Nr12_Status, Nr12_Ferramenta,
                Nr17_DataEmissao, Nr17_Vencimento, Nr17_Status,
                Nr18_DataEmissao, NR18_Vencimento, Nr18_Status,
                Nr20_DataEmissao, Nr20_Vencimento, Nr20_Status,
                Nr33_DataEmissao, NR33_Vencimento, Nr33_Status,
                Nr34_DataEmissao, Nr34_Vencimento, Nr34_Status,
                Nr35_DataEmissao, NR35_Vencimento, Nr35_Status,
                Epi_DataEmissao, epiVencimento, EpiStatus, Epi_Validade8Meses,
                Nr06_NumControle, Nr06_AnoControle,
                Nr11_NumControle, Nr11_AnoControle,
                Nr12_NumControle, Nr12_AnoControle,
                Nr17_NumControle, Nr17_AnoControle,
                Nr18_NumControle, Nr18_AnoControle,
                Nr20_NumControle, Nr20_AnoControle,
                Nr33_NumControle, Nr33_AnoControle,
                Nr35_NumControle, Nr35_AnoControle,
                Situacao, Anotacoes, Ambientacao, DataInativacao, Foto, IgnorarInvalidez
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            nome, empresa, funcao, celular, cpf, dataEmissao, vencimento,
            nr06_dataEmissao, nr06_vencimento, nr06_status, nr06_validade2anos || 0,
            nr10_dataEmissao, nr10_vencimento, nr10_status,
            nr11_dataEmissao, nr11_vencimento, nr11_status,
            nr12_dataEmissao, nr12_vencimento, nr12_status, nr12_ferramenta,
            nr17_dataEmissao, nr17_vencimento, nr17_status,
            nr18_dataEmissao, nr18_vencimento, nr18_status,
            nr20_dataEmissao, nr20_vencimento, nr20_status,
            nr33_dataEmissao, nr33_vencimento, nr33_status,
            nr34_dataEmissao, nr34_vencimento, nr34_status,
            nr35_dataEmissao, nr35_vencimento, nr35_status,
            epi_dataEmissao, epi_vencimento, epi_status, req.body.epi_validade8meses || 0,
            nr06_numControle, nr06_anoControle,
            nr11_numControle, nr11_anoControle,
            nr12_numControle, nr12_anoControle,
            nr17_numControle, nr17_anoControle,
            nr18_numControle, nr18_anoControle,
            nr20_numControle, nr20_anoControle,
            nr33_numControle, nr33_anoControle,
            nr35_numControle, nr35_anoControle,
            situacao, anotacoes, ambientacao, dataInativacao || null, fotoBuffer, ignorarInvalidez || 'N'
        ];
        
        const result = await db.run(sql, params);
        await registrarLog(req, 'Cadastrar Funcionário', `Cadastrou o funcionário [${nome}] na empresa ${empresa} (Função: ${funcao})`);
        res.json({ id: result.lastID, message: 'Registro criado com sucesso' });
    } catch (err) {
        console.error('Erro ao inserir:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT - Atualizar registro
app.put('/api/ssma/:id', async (req, res) => {
    const { id } = req.params;
    
    // Normalize body key casing for all courses to prevent any database updates from going blank
    for (const key of Object.keys(req.body)) {
        const lowerKey = key.toLowerCase();
        if (lowerKey !== key && req.body[key] !== undefined && req.body[lowerKey] === undefined) {
            req.body[lowerKey] = req.body[key];
        }
    }
    
    let {
        nome, empresa, funcao, celular, cpf, dataEmissao, vencimento,
        nr06_dataEmissao, nr06_vencimento, nr06_status, nr06_validade2anos,
        nr10_dataEmissao, nr10_vencimento, nr10_status,
        nr11_dataEmissao, nr11_vencimento, nr11_status,
        nr12_dataEmissao, nr12_vencimento, nr12_status, nr12_ferramenta,
        nr17_dataEmissao, nr17_vencimento, nr17_status,
        nr18_dataEmissao, nr18_vencimento, nr18_status,
        nr20_dataEmissao, nr20_vencimento, nr20_status,
        nr33_dataEmissao, nr33_vencimento, nr33_status,
        nr34_dataEmissao, nr34_vencimento, nr34_status,
        nr35_dataEmissao, nr35_vencimento, nr35_status,
        nr06_numControle, nr06_anoControle,
        nr11_numControle, nr11_anoControle,
        nr12_numControle, nr12_anoControle,
        nr18_numControle, nr18_anoControle,
        nr20_numControle, nr20_anoControle,
        nr33_numControle, nr33_anoControle,
        nr35_numControle, nr35_anoControle,
        nr17_numControle, nr17_anoControle,
        epi_dataEmissao, epi_vencimento, epi_status,
        situacao, anotacoes, ambientacao, fotoBase64, removerFoto, dataInativacao, ignorarInvalidez
    } = req.body;
    
    // ✅ CONVERTER TUDO PARA MAIÚSCULO E SEM ACENTOS
    nome = normalizarTexto(nome);
    empresa = normalizarTexto(empresa);
    funcao = normalizarTexto(funcao);
    anotacoes = normalizarTexto(anotacoes);
    nr12_ferramenta = normalizarTexto(nr12_ferramenta);
    
    if (!nome || !empresa || !funcao) {
        return res.status(400).json({ error: 'Nome, Empresa e Função são obrigatórios' });
    }

    // ============ VALIDAÇÃO DE CARGA HORÁRIA DIÁRIA (MÁX 8H) ============
    const datasTrabalho = {};
    const nrsParaVerificar = [
        { key: 'nr06', data: nr06_dataEmissao },
        { key: 'nr10', data: nr10_dataEmissao },
        { key: 'nr11', data: nr11_dataEmissao },
        { key: 'nr12', data: nr12_dataEmissao },
        { key: 'nr17', data: nr17_dataEmissao },
        { key: 'nr18', data: nr18_dataEmissao },
        { key: 'nr20', data: nr20_dataEmissao },
        { key: 'nr33', data: nr33_dataEmissao },
        { key: 'nr34', data: nr34_dataEmissao },
        { key: 'nr35', data: nr35_dataEmissao },
        { key: 'epi', data: epi_dataEmissao }
    ];

    nrsParaVerificar.forEach(item => {
        if (item.data && item.data.trim() !== '') {
            if (!datasTrabalho[item.data]) datasTrabalho[item.data] = { total: 0, cursos: [] };
            const horas = NR_DURATIONS[item.key] || 0;
            datasTrabalho[item.data].total += horas;
            datasTrabalho[item.data].cursos.push(`${item.key.toUpperCase()} (${horas}h)`);
        }
    });

    for (const data in datasTrabalho) {
        // Validação de carga horária removida do backend a pedido do usuário.
        // O bloqueio agora é visual (marca d'água de INVÁLIDO) no certificado pelo frontend.
    }
    // ============ FIM VALIDAÇÃO CARGA HORÁRIA ============
    
    
    try {
        const oldRow = await db.get('SELECT * FROM SSMA WHERE id = ?', [id]);
        
        // VERIFICAR CPF DUPLICADO (exceto o próprio)
        if (cpf && cpf.trim() !== '') {
            const cpfRow = await db.get("SELECT id, Nome, Empresa FROM SSMA WHERE CPF = ? AND Situacao = 'N' AND id != ? LIMIT 1", [cpf, id]);
            if (cpfRow) {
                return res.status(409).json({ 
                    error: `CPF já cadastrado para ${cpfRow.Nome} (${cpfRow.Empresa})`,
                    duplicateId: cpfRow.id,
                    duplicateType: 'cpf'
                });
            }
        }
        
        // VERIFICAR DUPLICATA NOME (exceto o próprio)
        const dupRow = await db.get("SELECT id FROM SSMA WHERE Nome = ? AND Empresa = ? AND Funcao = ? AND id != ? LIMIT 1", [nome, empresa, funcao, id]);
        if (dupRow) {
            return res.status(409).json({ 
                error: `Registro duplicado já existe`,
                duplicateId: dupRow.id,
                duplicateType: 'nome'
            });
        }

        // VERIFICAR UNICIDADE DE NÚMERO DE CONTROLE POR ANO (Para NRs 06, 12, 18, 20, 33, 35) (exceto o próprio)
        const nrsValidar = [
            { key: 'Nr06', num: nr06_numControle, ano: nr06_anoControle, label: 'NR-06' },
            { key: 'Nr11', num: nr11_numControle, ano: nr11_anoControle, label: 'NR-11' },
            { key: 'Nr12', num: nr12_numControle, ano: nr12_anoControle, label: 'NR-12' },
            { key: 'Nr18', num: nr18_numControle, ano: nr18_anoControle, label: 'NR-18' },
            { key: 'Nr20', num: nr20_numControle, ano: nr20_anoControle, label: 'NR-20' },
            { key: 'Nr33', num: nr33_numControle, ano: nr33_anoControle, label: 'NR-33' },
            { key: 'Nr35', num: nr35_numControle, ano: nr35_anoControle, label: 'NR-35' }
        ];

        for (const nr of nrsValidar) {
            if (nr.num && nr.ano) {
                const dupCert = await db.get(`SELECT id, Nome FROM SSMA WHERE ${nr.key}_NumControle = ? AND ${nr.key}_AnoControle = ? AND id != ? LIMIT 1`, [nr.num, nr.ano, id]);
                if (dupCert) {
                    return res.status(409).json({ 
                        error: `O número de controle ${nr.num} para o ano ${nr.ano} já está em uso na ${nr.label} (Funcionário ID: ${dupCert.id} - ${dupCert.Nome})`,
                        duplicateId: dupCert.id,
                        duplicateType: 'controle_nr'
                    });
                }
            }
        }
        
        // PROTEÇÃO FINAL: Se a Data de Emissão estiver vazia ou nula, limpar completamente todos os campos vinculados!
        // Mas apenas se a data de emissão estiver explicitamente no body (ou vazia)
        if (req.body.hasOwnProperty('nr06_dataEmissao') && (!nr06_dataEmissao || nr06_dataEmissao.trim() === '')) { nr06_vencimento = ''; nr06_status = ''; nr06_numControle = ''; nr06_anoControle = ''; }
        if (req.body.hasOwnProperty('nr10_dataEmissao') && (!nr10_dataEmissao || nr10_dataEmissao.trim() === '')) { nr10_vencimento = ''; nr10_status = ''; }
        if (req.body.hasOwnProperty('nr11_dataEmissao') && (!nr11_dataEmissao || nr11_dataEmissao.trim() === '')) { nr11_vencimento = ''; nr11_status = ''; nr11_numControle = ''; nr11_anoControle = ''; }
        if (req.body.hasOwnProperty('nr12_dataEmissao') && (!nr12_dataEmissao || nr12_dataEmissao.trim() === '')) { nr12_vencimento = ''; nr12_status = ''; nr12_ferramenta = ''; nr12_numControle = ''; nr12_anoControle = ''; }
        if (req.body.hasOwnProperty('nr17_dataEmissao') && (!nr17_dataEmissao || nr17_dataEmissao.trim() === '')) { nr17_vencimento = ''; nr17_status = ''; nr17_numControle = ''; nr17_anoControle = ''; }
        if (req.body.hasOwnProperty('nr18_dataEmissao') && (!nr18_dataEmissao || nr18_dataEmissao.trim() === '')) { nr18_vencimento = ''; nr18_status = ''; nr18_numControle = ''; nr18_anoControle = ''; }
        if (req.body.hasOwnProperty('nr20_dataEmissao') && (!nr20_dataEmissao || nr20_dataEmissao.trim() === '')) { nr20_vencimento = ''; nr20_status = ''; nr20_numControle = ''; nr20_anoControle = ''; }
        if (req.body.hasOwnProperty('nr33_dataEmissao') && (!nr33_dataEmissao || nr33_dataEmissao.trim() === '')) { nr33_vencimento = ''; nr33_status = ''; nr33_numControle = ''; nr33_anoControle = ''; }
        if (req.body.hasOwnProperty('nr34_dataEmissao') && (!nr34_dataEmissao || nr34_dataEmissao.trim() === '')) { nr34_vencimento = ''; nr34_status = ''; }
        if (req.body.hasOwnProperty('nr35_dataEmissao') && (!nr35_dataEmissao || nr35_dataEmissao.trim() === '')) { nr35_vencimento = ''; nr35_status = ''; nr35_numControle = ''; nr35_anoControle = ''; }
        if (req.body.hasOwnProperty('epi_dataEmissao') && (!epi_dataEmissao || epi_dataEmissao.trim() === '')) { epi_vencimento = ''; epi_status = ''; }

        // Mapeamento de campos para construção dinâmica do SQL
        const camposUpdate = {
            Nome: nome, Empresa: empresa, Funcao: funcao, Celular: celular, CPF: cpf, DataEmissao: dataEmissao, Vencimento: vencimento,
            Nr06_DataEmissao: nr06_dataEmissao, Nr06_Vencimento: nr06_vencimento, Nr06_Status: nr06_status, Nr06_Validade2Anos: nr06_validade2anos ?? 0,
            Nr10_DataEmissao: nr10_dataEmissao, Nr10_Vencimento: nr10_vencimento, Nr10_Status: nr10_status,
            Nr11_DataEmissao: nr11_dataEmissao, Nr11_Vencimento: nr11_vencimento, Nr11_Status: nr11_status,
            Nr12_DataEmissao: nr12_dataEmissao, NR12_Vencimento: nr12_vencimento, Nr12_Status: nr12_status, Nr12_Ferramenta: nr12_ferramenta,
            Nr17_DataEmissao: nr17_dataEmissao, Nr17_Vencimento: nr17_vencimento, Nr17_Status: nr17_status,
            Nr18_DataEmissao: nr18_dataEmissao, NR18_Vencimento: nr18_vencimento, Nr18_Status: nr18_status,
            Nr20_DataEmissao: nr20_dataEmissao, Nr20_Vencimento: nr20_vencimento, Nr20_Status: nr20_status,
            Nr33_DataEmissao: nr33_dataEmissao, NR33_Vencimento: nr33_vencimento, Nr33_Status: nr33_status,
            Nr34_DataEmissao: nr34_dataEmissao, Nr34_Vencimento: nr34_vencimento, Nr34_Status: nr34_status,
            Nr35_DataEmissao: nr35_dataEmissao, NR35_Vencimento: nr35_vencimento, Nr35_Status: nr35_status,
            Epi_DataEmissao: epi_dataEmissao, epiVencimento: epi_vencimento, EpiStatus: epi_status, 
            Epi_Validade8Meses: req.body.epi_validade8meses ?? 0,
            Situacao: situacao, Anotacoes: anotacoes, Ambientacao: ambientacao, DataInativacao: dataInativacao, IgnorarInvalidez: ignorarInvalidez || 'N'
        };

        // Adicionar campos de controle APENAS se estiverem presentes no body (prevenir overwrite com undefined)
        if (req.body.hasOwnProperty('nr06_numControle')) camposUpdate.Nr06_NumControle = nr06_numControle;
        if (req.body.hasOwnProperty('nr06_anoControle')) camposUpdate.Nr06_AnoControle = nr06_anoControle;
        if (req.body.hasOwnProperty('nr12_numControle')) camposUpdate.Nr12_NumControle = nr12_numControle;
        if (req.body.hasOwnProperty('nr12_anoControle')) camposUpdate.Nr12_AnoControle = nr12_anoControle;
        if (req.body.hasOwnProperty('nr18_numControle')) camposUpdate.Nr18_NumControle = nr18_numControle;
        if (req.body.hasOwnProperty('nr18_anoControle')) camposUpdate.Nr18_AnoControle = nr18_anoControle;
        if (req.body.hasOwnProperty('nr20_numControle')) camposUpdate.Nr20_NumControle = nr20_numControle;
        if (req.body.hasOwnProperty('nr20_anoControle')) camposUpdate.Nr20_AnoControle = nr20_anoControle;
        if (req.body.hasOwnProperty('nr11_numControle')) camposUpdate.Nr11_NumControle = nr11_numControle;
        if (req.body.hasOwnProperty('nr11_anoControle')) camposUpdate.Nr11_AnoControle = nr11_anoControle;
        if (req.body.hasOwnProperty('nr17_numControle')) camposUpdate.Nr17_NumControle = nr17_numControle;
        if (req.body.hasOwnProperty('nr17_anoControle')) camposUpdate.Nr17_AnoControle = nr17_anoControle;
        if (req.body.hasOwnProperty('nr33_numControle')) camposUpdate.Nr33_NumControle = nr33_numControle;
        if (req.body.hasOwnProperty('nr33_anoControle')) camposUpdate.Nr33_AnoControle = nr33_anoControle;
        if (req.body.hasOwnProperty('nr35_numControle')) camposUpdate.Nr35_NumControle = nr35_numControle;
        if (req.body.hasOwnProperty('nr35_anoControle')) camposUpdate.Nr35_AnoControle = nr35_anoControle;

        // Construir a cláusula SET e os parâmetros dinamicamente
        const setParts = [];
        const params = [];

        for (const [col, val] of Object.entries(camposUpdate)) {
            if (val !== undefined) {
                setParts.push(`${col} = ?`);
                params.push(val);
            }
        }

        if (removerFoto) {
            setParts.push('Foto = NULL');
        } else if (fotoBase64) {
            setParts.push('Foto = ?');
            params.push(Buffer.from(fotoBase64, 'base64'));
        }

        if (setParts.length === 0) {
            return res.json({ success: true, message: 'Nenhuma alteração necessária' });
        }

        const alteracoes = [];
        if (oldRow) {
            const normalizedOld = normalizarCasingRow({ ...oldRow });
            
            for (const [col, newVal] of Object.entries(camposUpdate)) {
                if (newVal !== undefined) {
                    let oldVal = normalizedOld[col];
                    if (oldVal === undefined) {
                        const lowerCol = col.toLowerCase();
                        for (const key of Object.keys(normalizedOld)) {
                            if (key.toLowerCase() === lowerCol) {
                                oldVal = normalizedOld[key];
                                break;
                            }
                        }
                    }
                    
                    let oldStr = (oldVal === null || oldVal === undefined) ? '' : String(oldVal).trim();
                    let newStr = (newVal === null || newVal === undefined) ? '' : String(newVal).trim();
                    
                    const normalizeDate = (val) => {
                        if (!val) return '';
                        if (val.includes('T')) return val.split('T')[0];
                        return val;
                    };
                    
                    if (col.toLowerCase().includes('dataemissao') || col.toLowerCase().includes('vencimento')) {
                        if (normalizeDate(oldStr) === normalizeDate(newStr)) continue;
                    }
                    
                    if (oldStr !== newStr) {
                        let colLabel = col;
                        if (col === 'Nome') colLabel = 'Nome';
                        else if (col === 'Empresa') colLabel = 'Empresa';
                        else if (col === 'Funcao') colLabel = 'Função';
                        else if (col === 'Celular') colLabel = 'Celular';
                        else if (col === 'CPF') colLabel = 'CPF';
                        else if (col === 'Anotacoes') colLabel = 'Anotações';
                        else if (col === 'Ambientacao') colLabel = 'Ambientação';
                        else if (col === 'Situacao') colLabel = 'Situação';
                        else {
                            colLabel = col.replace('_', ' - ');
                        }
                        
                        const formatValDisplay = (val) => {
                            if (!val) return 'vazio';
                            if (/^\d{4}-\d{2}-\d{2}/.test(val)) {
                                const parts = val.split('T')[0].split('-');
                                if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
                            }
                            return `'${val}'`;
                        };
                        
                        alteracoes.push(`${colLabel} de ${formatValDisplay(oldStr)} para ${formatValDisplay(newStr)}`);
                    }
                }
            }
        }
        
        let logDetalhes = `Editou dados do funcionário [${nome}] (Empresa: ${empresa}, Função: ${funcao})`;
        if (alteracoes.length > 0) {
            logDetalhes += ` | Alterações: ${alteracoes.join(', ')}`;
        }

        const sql = `UPDATE SSMA SET ${setParts.join(', ')} WHERE id = ?`;
        params.push(id);

        await db.run(sql, params);
        await registrarLog(req, 'Atualizar Funcionário', logDetalhes);
        res.json({ success: true, message: 'Registro atualizado com sucesso' });
    } catch (err) {
        console.error('Erro ao atualizar:', err);
        res.status(500).json({ error: err.message });
    }
});

// PATCH - Atualização parcial (ex: Epi_Dados)
app.patch('/api/ssma/:id', async (req, res) => {
    const { id } = req.params;
    const body = req.body;
    
    if (Object.keys(body).length === 0) {
        return res.status(400).json({ error: 'Nenhum dado informado para atualização' });
    }
    
    const setParts = [];
    const params = [];
    
    for (const [col, val] of Object.entries(body)) {
        // Lista de colunas permitidas para evitar SQL Injection (simplificado para o contexto)
        const allowedCols = [
            'Epi_Dados', 'Epi_Setor', 'IgnorarInvalidez',
            'Nr06_NumControle', 'Nr06_AnoControle',
            'Nr11_NumControle', 'Nr11_AnoControle',
            'Nr12_NumControle', 'Nr12_AnoControle',
            'Nr17_NumControle', 'Nr17_AnoControle',
            'Nr18_NumControle', 'Nr18_AnoControle',
            'Nr20_NumControle', 'Nr20_AnoControle',
            'Nr33_NumControle', 'Nr33_AnoControle',
            'Nr35_NumControle', 'Nr35_AnoControle'
        ];
        if (allowedCols.includes(col)) {
            setParts.push(`${col} = ?`);
            params.push(val);
        }
    }
    
    if (setParts.length === 0) {
        return res.status(400).json({ error: 'Colunas inválidas para atualização parcial' });
    }
    
    const sql = `UPDATE SSMA SET ${setParts.join(', ')} WHERE id = ?`;
    params.push(id);
    
    try {
        const result = await db.run(sql, params);
        if (result.changes === 0) return res.status(404).json({ error: 'Registro não encontrado' });
        res.json({ success: true, message: 'Registro atualizado parcialmente' });
    } catch (err) {
        console.error('Erro no PATCH /api/ssma:', err);
        res.status(500).json({ error: err.message });
    }
});


// DELETE - Excluir registro
app.delete('/api/ssma/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const row = await db.get('SELECT Nome FROM SSMA WHERE id = ?', [id]);
        if (!row) return res.status(404).json({ error: 'Registro não encontrado' });
        
        await db.run('DELETE FROM SSMA WHERE id = ?', [id]);
        await registrarLog(req, 'Excluir Funcionário', `Excluiu permanentemente o funcionário [${row.Nome}]`);
        res.json({ message: 'Registro excluído com sucesso' });
    } catch (err) {
        console.error('Erro ao excluir funcionário:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT - Alternar situação (Ativo/Inativo) com data de inativação
app.put('/api/ssma/:id/toggle-situacao', async (req, res) => {
    const { id } = req.params;
    const { situacao, dataInativacao } = req.body;
    
    // Validar situação
    if (!situacao || !['S', 'N'].includes(situacao)) {
        return res.status(400).json({ error: 'Situação inválida. Use S para Cancelado ou N para Ativo' });
    }
    
    try {
        const row = await db.get('SELECT Nome FROM SSMA WHERE id = ?', [id]);
        if (!row) return res.status(404).json({ error: 'Registro não encontrado' });
        
        let sql, params;
        if (situacao === 'S') {
            // Cancelando/Inativando (S = Cancelado) - registrar data de inativação
            sql = 'UPDATE SSMA SET Situacao = ?, DataInativacao = ? WHERE id = ?';
            params = [situacao, dataInativacao || new Date().toISOString(), id];
        } else {
            // Ativando (N = Ativo) - limpar data de inativação
            sql = 'UPDATE SSMA SET Situacao = ?, DataInativacao = NULL WHERE id = ?';
            params = [situacao, id];
        }
        
        await db.run(sql, params);
        
        const statusText = situacao === 'N' ? 'Ativo' : 'Cancelado';
        const acaoDesc = situacao === 'N' ? 'Ativar Funcionário' : 'Inativar Funcionário';
        await registrarLog(req, acaoDesc, `${situacao === 'N' ? 'Ativou' : 'Inativou'} o funcionário [${row.Nome}]`);
        
        res.json({
            message: `Situação alterada para ${statusText}`,
            situacao: situacao,
            dataInativacao: situacao === 'S' ? (dataInativacao || new Date().toISOString()) : null
        });
    } catch (err) {
        console.error('Erro ao atualizar situação:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT - Atualizar apenas data de inativação
app.put('/api/ssma/:id/atualizar-data-inativacao', (req, res) => {
    const { id } = req.params;
    const { dataInativacao } = req.body;
    
    console.log('=== ATUALIZANDO DATA DE INATIVAÇÃO ===');
    console.log('ID:', id);
    console.log('Data inativação:', dataInativacao);
    
    const sql = 'UPDATE SSMA SET DataInativacao = ? WHERE id = ?';
    
    db.run(sql, [dataInativacao, id], function(err) {
        if (err) {
            console.error('Erro ao atualizar data de inativação:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (this.changes === 0) {
            res.status(404).json({ error: 'Registro não encontrado' });
            return;
        }
        
        console.log('Data de inativação atualizada com sucesso');
        res.json({ message: 'Data de inativação atualizada', dataInativacao });
    });
});

// ROTAS PARA FORNECEDORES

// GET - Listar fornecedores
// GET - Listar fornecedores
app.get('/api/fornecedores', async (req, res) => {
    const situacao = req.query.situacao;
    let sql = 'SELECT * FROM FORNECEDOR';
    let params = [];
    
    if (situacao && situacao !== 'all') {
        sql += ' WHERE Situacao = ?';
        params.push(situacao);
    } else if (!situacao) {
        sql += ' WHERE Situacao = "S"';
    }
    
    sql += ' ORDER BY Empresa';
    
    try {
        console.log('🔍 GET /api/fornecedores - Situacao:', situacao);
        const rows = await db.all(sql, params);
        console.log('✅ Retornando', rows.length, 'fornecedores');
        res.json(rows || []);
    } catch (err) {
        console.error('❌ Erro na API de fornecedores:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// DEBUG - Endpoint para verificar banco
app.get('/debug-fornecedores', async (req, res) => {
    try {
        const rows = await db.all('SELECT * FROM FORNECEDOR');
        res.send(`<h1>Debug Fornecedores</h1><pre>${JSON.stringify(rows, null, 2)}</pre>`);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// POST - Criar fornecedor
app.post('/api/fornecedores', async (req, res) => {
    let { empresa, cnpj, telefone, celular, contato, observacao } = req.body;
    
    empresa = normalizarTexto(empresa);
    contato = normalizarTexto(contato);
    observacao = normalizarTexto(observacao);
    
    if (!empresa) {
        return res.status(400).json({ error: 'Empresa é obrigatória' });
    }
    
    try {
        if (cnpj) {
            const existing = await db.get('SELECT id, Empresa FROM FORNECEDOR WHERE CNPJ = ?', [cnpj]);
            if (existing) {
                return res.status(400).json({ error: `CNPJ já cadastrado para: ${existing.Empresa}` });
            }
        }
        
        const sql = 'INSERT INTO FORNECEDOR (Empresa, CNPJ, Telefone, Celular, Contato, Observacao) VALUES (?, ?, ?, ?, ?, ?)';
        const result = await db.run(sql, [empresa, cnpj, telefone, celular, contato, observacao]);
        
        await registrarLog(req, 'Cadastrar Fornecedor', `Cadastrou o fornecedor [${empresa}]`);
        
        res.json({
            id: result.lastID,
            message: 'Fornecedor criado com sucesso'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT - Alternar situação do fornecedor (Ativo/Inativo)
app.put('/api/fornecedores/:id/toggle-situacao', async (req, res) => {
    const { id } = req.params;
    const { Situacao, DataInativacao } = req.body;
    
    if (!Situacao || !['S', 'N'].includes(Situacao)) {
        return res.status(400).json({ error: 'Situação inválida. Use S para Ativo ou N para Inativo' });
    }
    
    try {
        let sql, params;
        if (Situacao === 'N') {
            sql = 'UPDATE FORNECEDOR SET Situacao = ?, DataInativacao = ? WHERE id = ?';
            params = [Situacao, DataInativacao || new Date().toISOString(), id];
        } else {
            sql = 'UPDATE FORNECEDOR SET Situacao = ?, DataInativacao = NULL WHERE id = ?';
            params = [Situacao, id];
        }
        
        const row = await db.get('SELECT Empresa FROM FORNECEDOR WHERE id = ?', [id]);
        const result = await db.run(sql, params);
        if (result.changes === 0) return res.status(404).json({ error: 'Fornecedor não encontrado' });
        
        const statusText = Situacao === 'S' ? 'Ativo' : 'Inativo';
        const acaoDesc = Situacao === 'S' ? 'Ativar Fornecedor' : 'Inativar Fornecedor';
        await registrarLog(req, acaoDesc, `${Situacao === 'S' ? 'Ativou' : 'Inativou'} o fornecedor [${row ? row.Empresa : id}]`);
        
        res.json({
            message: `Situação alterada para ${statusText}`,
            Situacao: Situacao,
            DataInativacao: Situacao === 'N' ? (DataInativacao || new Date().toISOString()) : null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT - Atualizar fornecedor
app.put('/api/fornecedores/:id', async (req, res) => {
    const { id } = req.params;
    let { empresa, cnpj, telefone, celular, contato, observacao, Situacao } = req.body;
    
    empresa = normalizarTexto(empresa);
    contato = normalizarTexto(contato);
    observacao = normalizarTexto(observacao);
    
    if (Situacao && !empresa) {
        return res.status(400).json({ error: 'Use o endpoint /api/fornecedores/:id/toggle-situacao para alterar apenas a situação' });
    }
    
    if (!empresa) {
        return res.status(400).json({ error: 'Empresa é obrigatória' });
    }
    
    try {
        const sql = 'UPDATE FORNECEDOR SET Empresa = ?, CNPJ = ?, Telefone = ?, Celular = ?, Contato = ?, Observacao = ? WHERE id = ?';
        const result = await db.run(sql, [empresa, cnpj, telefone, celular, contato, observacao, id]);
        if (result.changes === 0) return res.status(404).json({ error: 'Fornecedor não encontrado' });
        await registrarLog(req, 'Atualizar Fornecedor', `Editou dados do fornecedor [${empresa}]`);
        res.json({ message: 'Fornecedor atualizado com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET - Buscar fornecedor específico
app.get('/api/fornecedores/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const row = await db.get('SELECT * FROM FORNECEDOR WHERE id = ?', [id]);
        if (!row) return res.status(404).json({ error: 'Fornecedor não encontrado' });
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE - Excluir fornecedor
app.delete('/api/fornecedores/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const row = await db.get('SELECT Empresa FROM FORNECEDOR WHERE id = ?', [id]);
        const result = await db.run('DELETE FROM FORNECEDOR WHERE id = ?', [id]);
        if (result.changes === 0) return res.status(404).json({ error: 'Fornecedor não encontrado' });
        await registrarLog(req, 'Excluir Fornecedor', `Excluiu permanentemente o fornecedor [${row ? row.Empresa : id}]`);
        res.json({ message: 'Fornecedor excluído com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===== ROTAS DE DOCUMENTAÇÃO =====

// GET - Listar todas as documentações
app.get('/api/documentacao', async (req, res) => {
    try {
        const rows = await db.all('SELECT * FROM DOCUMENTACAO ORDER BY empresa');
        res.json(rows || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET - Buscar documentação por CNPJ
app.get('/api/documentacao/cnpj/:cnpj', async (req, res) => {
    const { cnpj } = req.params;
    try {
        const row = await db.get('SELECT * FROM DOCUMENTACAO WHERE cnpj = ?', [decodeURIComponent(cnpj)]);
        if (!row) return res.status(404).json({ error: 'Documentação não encontrada' });
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET - Buscar documentação específica
app.get('/api/documentacao/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const row = await db.get('SELECT * FROM DOCUMENTACAO WHERE id = ?', [id]);
        if (!row) return res.status(404).json({ error: 'Documentação não encontrada' });
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST - Criar nova documentação
app.post('/api/documentacao', async (req, res) => {
    let { empresa, cnpj, pgr_emissao, pgr_vencimento, pgr_status, pcmso_emissao, pcmso_vencimento, pcmso_status, ativo } = req.body;
    
    empresa = normalizarTexto(empresa);
    const sql = `INSERT INTO DOCUMENTACAO (empresa, cnpj, pgr_emissao, pgr_vencimento, pgr_status, pcmso_emissao, pcmso_vencimento, pcmso_status, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    try {
        const result = await db.run(sql, [empresa, cnpj, pgr_emissao, pgr_vencimento, pgr_status, pcmso_emissao, pcmso_vencimento, pcmso_status, ativo || 'S']);
        await registrarLog(req, 'Cadastrar Documentação', `Cadastrou documentação PGR/PCMSO para [${empresa}] (CNPJ: ${cnpj || '-'})`);
        res.json({ id: result.lastID, message: 'Documentação criada com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT - Atualizar documentação
app.put('/api/documentacao/:id', async (req, res) => {
    const { id } = req.params;
    let { empresa, cnpj, pgr_emissao, pgr_vencimento, pgr_status, pcmso_emissao, pcmso_vencimento, pcmso_status, ativo } = req.body;
    
    empresa = normalizarTexto(empresa);
    const sql = `UPDATE DOCUMENTACAO SET empresa = ?, cnpj = ?, pgr_emissao = ?, pgr_vencimento = ?, pgr_status = ?, pcmso_emissao = ?, pcmso_vencimento = ?, pcmso_status = ?, ativo = ?, DataAlteracao = CURRENT_TIMESTAMP WHERE id = ?`;
    try {
        const result = await db.run(sql, [empresa, cnpj, pgr_emissao, pgr_vencimento, pgr_status, pcmso_emissao, pcmso_vencimento, pcmso_status, ativo || 'S', id]);
        if (result.changes === 0) return res.status(404).json({ error: 'Documentação não encontrada' });
        await registrarLog(req, 'Atualizar Documentação', `Editou documentação PGR/PCMSO de [${empresa}] (ID: ${id})`);
        res.json({ message: 'Documentação atualizada com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE - Excluir documentação
app.delete('/api/documentacao/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const row = await db.get('SELECT empresa FROM DOCUMENTACAO WHERE id = ?', [id]);
        const result = await db.run('DELETE FROM DOCUMENTACAO WHERE id = ?', [id]);
        if (result.changes === 0) return res.status(404).json({ error: 'Documentação não encontrada' });
        await registrarLog(req, 'Excluir Documentação', `Excluiu documentação de [${row ? row.empresa : id}]`);
        res.json({ message: 'Documentação excluída com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Rota para servir a página principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rotas para Habilitar Cursos
app.get('/api/habilitar-cursos', (req, res) => {
    db.all('SELECT * FROM HABILITAR_CURSOS ORDER BY id', [], (err, rows) => {
        if (err) {
            console.error('Erro ao buscar cursos:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.post('/api/habilitar-cursos', async (req, res) => {
    const { cursos } = req.body;
    
    if (!cursos || !Array.isArray(cursos)) {
        return res.status(400).json({ error: 'Dados inválidos' });
    }
    
    try {
        for (const curso of cursos) {
            const updateResult = await db.run('UPDATE HABILITAR_CURSOS SET habilitado = ? WHERE curso = ?', [curso.habilitado, curso.curso]);
            if (updateResult && updateResult.changes === 0) {
                await db.run('INSERT INTO HABILITAR_CURSOS (curso, habilitado) VALUES (?, ?)', [curso.curso, curso.habilitado]);
            }
        }

        // Auditoria inteligente
        await registrarLog(req, 'Configurar Cursos', `Alterou a visibilidade dos cursos/treinamentos monitorados no painel`);
        
        res.json({ message: 'Cursos atualizados com sucesso' });
    } catch (err) {
        console.error('Erro ao atualizar cursos:', err);
        res.status(500).json({ error: err.message });
    }
});

// Rotas para Configuração do Relatório
app.get('/api/configuracao-relatorio', (req, res) => {
    db.get('SELECT * FROM configuracao_relatorio WHERE id = 1', (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(row || { titulo: 'Relatório de Cursos', rodape: 'SSMA' });
    });
});

app.post('/api/configuracao-relatorio', async (req, res) => {
    const { titulo, rodape, logo, tecnico_seguranca, epi_itens_padrao } = req.body;
    
    try {
        const result = await db.run(
            `UPDATE configuracao_relatorio SET titulo = ?, rodape = ?, logo = ?, tecnico_seguranca = ?, epi_itens_padrao = ? WHERE id = 1`, 
            [titulo || 'Relatório de Cursos', rodape || 'SSMA', logo || '/Logo-Hoss.jpg',
             tecnico_seguranca !== undefined ? tecnico_seguranca : '',
             epi_itens_padrao !== undefined ? epi_itens_padrao : '[]']
        );
        
        if (result.changes === 0) {
            // Se não atualizou, inserir
            await db.run(
                `INSERT INTO configuracao_relatorio (titulo, rodape, logo, tecnico_seguranca, epi_itens_padrao) VALUES (?, ?, ?, ?, ?)`,
                [titulo || 'Relatório de Cursos', rodape || 'SSMA', logo || '/Logo-Hoss.jpg',
                 tecnico_seguranca || '', epi_itens_padrao || '[]']
            );
        }
        
        // Auditoria inteligente
        await registrarLog(req, 'Configurar Relatório', `Atualizou as diretrizes de impressão/relatórios do sistema`);
        
        res.json({ message: 'Configuração salva com sucesso' });
    } catch (err) {
        console.error('❌ Erro ao salvar configuração:', err);
        res.status(500).json({ error: err.message });
    }
});

// Rota para exportar SSMA para Excel (.xlsx) com colunas selecionadas
app.post('/api/exportar-excel-custom', async (req, res) => {
    const { nome, empresa, funcao, situacao, colunas } = req.body;
    
    if (!colunas || colunas.length === 0) {
        return res.status(400).json({ error: 'Nenhuma coluna selecionada' });
    }
    
    let sql = 'SELECT * FROM SSMA WHERE 1=1';
    let params = [];
    
    if (nome) {
        sql += ' AND Nome LIKE ? COLLATE NOCASE';
        params.push(`%${nome}%`);
    }
    if (empresa) {
        sql += ' AND Empresa LIKE ? COLLATE NOCASE';
        params.push(`%${empresa}%`);
    }
    if (funcao) {
        sql += ' AND Funcao LIKE ? COLLATE NOCASE';
        params.push(`%${funcao}%`);
    }
    if (situacao) {
        sql += ' AND Situacao = ?';
        params.push(situacao);
    }
    
    sql += ' ORDER BY Empresa, Nome';
    
    db.all(sql, params, async (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        // Buscar configuração (título e logo)
        db.get('SELECT titulo, logo FROM configuracao_relatorio WHERE id = 1', async (err, config) => {
            const titulo = config?.titulo || 'Relatório de Cursos';
            const logoPath = config?.logo || '/Logo-Hoss.jpg';
            
            try {
                // Mapeamento de colunas para labels
                const colunasMap = {
                    'Nome': 'Nome',
                    'Empresa': 'Empresa',
                    'Funcao': 'Função',
                    'CPF': 'CPF',
                    'Celular': 'Celular',
                    'Situacao': 'Situação',
                    'Cadastro': 'Data Cadastro',
                    'DataInativacao': 'Data Inativação',
                    'Ambientacao': 'Ambientação',
                    'Anotacoes': 'Anotações',
                    'DataEmissao': 'ASO - Emissão',
                    'Vencimento': 'ASO - Vencimento',
                    'Status': 'ASO - Status',
                    'Nr06_DataEmissao': 'NR-06 - Emissão',
                    'Nr06_Vencimento': 'NR-06 - Vencimento',
                    'Nr06_Status': 'NR-06 - Status',
                    'Nr10_DataEmissao': 'NR-10 - Emissão',
                    'Nr10_Vencimento': 'NR-10 - Vencimento',
                    'Nr10_Status': 'NR-10 - Status',
                    'Nr11_DataEmissao': 'NR-11 - Emissão',
                    'Nr11_Vencimento': 'NR-11 - Vencimento',
                    'Nr11_Status': 'NR-11 - Status',
                    'Nr12_DataEmissao': 'NR-12 - Emissão',
                    'NR12_Vencimento': 'NR-12 - Vencimento',
                    'Nr12_Status': 'NR-12 - Status',
                    'Nr12_Ferramenta': 'NR-12 - Ferramentas Autorizadas',
                    'Nr17_DataEmissao': 'NR-17 - Emissão',
                    'Nr17_Vencimento': 'NR-17 - Vencimento',
                    'Nr17_Status': 'NR-17 - Status',
                    'Nr18_DataEmissao': 'NR-18 - Emissão',
                    'NR18_Vencimento': 'NR-18 - Vencimento',
                    'Nr18_Status': 'NR-18 - Status',
                    'Nr20_DataEmissao': 'NR-20 - Emissão',
                    'Nr20_Vencimento': 'NR-20 - Vencimento',
                    'Nr20_Status': 'NR-20 - Status',
                    'Nr33_DataEmissao': 'NR-33 - Emissão',
                    'NR33_Vencimento': 'NR-33 - Vencimento',
                    'Nr33_Status': 'NR-33 - Status',
                    'Nr34_DataEmissao': 'NR-34 - Emissão',
                    'Nr34_Vencimento': 'NR-34 - Vencimento',
                    'Nr34_Status': 'NR-34 - Status',
                    'Nr35_DataEmissao': 'NR-35 - Emissão',
                    'NR35_Vencimento': 'NR-35 - Vencimento',
                    'Nr35_Status': 'NR-35 - Status',
                    'Epi_DataEmissao': 'EPI - Emissão',
                    'epiVencimento': 'EPI - Vencimento',
                    'EpiStatus': 'EPI - Status'
                };
                
                // Criar workbook com ExcelJS
                const workbook = new ExcelJS.Workbook();
                const worksheet = workbook.addWorksheet('Relatório');
                
                // Configurar largura das colunas baseado no tipo
                const colWidths = colunas.map(col => {
                    if (col === 'Nome') return 35;
                    if (col === 'Empresa') return 18;
                    if (col === 'Funcao') return 20;
                    if (col === 'Anotacoes' || col === 'Nr12_Ferramenta') return 45;
                    if (col.includes('Status')) return 10;
                    return 14;
                });
                
                worksheet.columns = colWidths.map(w => ({ width: w }));
                
                // Adicionar logo se existir
                let startRow = 1;
                const logoFilePath = path.join(__dirname, 'public', logoPath.replace('/', ''));
                
                if (fs.existsSync(logoFilePath) && !logoPath.startsWith('data:')) {
                    try {
                        const logoImage = workbook.addImage({
                            filename: logoFilePath,
                            extension: 'jpeg'
                        });
                        
                        worksheet.addImage(logoImage, {
                            tl: { col: 0, row: 0 },
                            ext: { width: 80, height: 50 }
                        });
                        
                        // Título ao lado do logo
                        const lastCol = String.fromCharCode(65 + colunas.length - 1);
                        worksheet.mergeCells(`B1:${lastCol}1`);
                        const titleCell = worksheet.getCell('B1');
                        titleCell.value = titulo;
                        titleCell.font = { bold: true, size: 16 };
                        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
                        
                        worksheet.getRow(1).height = 50;
                        startRow = 3;
                    } catch (e) {
                        startRow = 2;
                    }
                } else {
                    // Sem logo, só título
                    const lastCol = String.fromCharCode(65 + colunas.length - 1);
                    worksheet.mergeCells(`A1:${lastCol}1`);
                    const titleCell = worksheet.getCell('A1');
                    titleCell.value = titulo;
                    titleCell.font = { bold: true, size: 16 };
                    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
                    startRow = 3;
                }
                
                // Cabeçalhos
                const headerRow = worksheet.getRow(startRow);
                colunas.forEach((col, i) => {
                    const cell = headerRow.getCell(i + 1);
                    cell.value = colunasMap[col] || col;
                    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } };
                    cell.border = { 
                        top: { style: 'thin', color: { argb: 'FF000000' } }, 
                        bottom: { style: 'thin', color: { argb: 'FF000000' } }, 
                        left: { style: 'thin', color: { argb: 'FF000000' } }, 
                        right: { style: 'thin', color: { argb: 'FF000000' } } 
                    };
                    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                });
                headerRow.height = 25;
                
                // Dados
                rows.forEach((row, index) => {
                    const dataRow = worksheet.getRow(startRow + 1 + index);
                    
                    colunas.forEach((col, i) => {
                        const cell = dataRow.getCell(i + 1);
                        let valor = row[col] || '';
                        
                        // ⭐ NORMALIZAR caracteres UTF-8
                        if (typeof valor === 'string') {
                            valor = Buffer.from(valor, 'utf8').toString('utf8');
                        }
                        
                        // Converter para MAIÚSCULO os campos de texto
                        if (col === 'Nome' || col === 'Empresa' || col === 'Funcao') {
                            valor = valor ? String(valor).toUpperCase() : '';
                        }
                        
                        // Formatar situação
                        if (col === 'Situacao') {
                            valor = valor === 'N' ? 'Ativo' : 'Inativo';
                        }
                        
                        // Formatar ambientação
                        if (col === 'Ambientacao') {
                            valor = valor === 'S' ? 'Sim' : 'Não';
                        }
                        
                        // Formatar datas
                        if (col.includes('Vencimento') || col.includes('DataEmissao') || col.includes('Emissao') || col === 'Cadastro' || col === 'DataInativacao') {
                            valor = formatarData(valor);
                        }
                        
                        cell.value = valor;
                        cell.border = { 
                            top: { style: 'thin', color: { argb: 'FF000000' } }, 
                            bottom: { style: 'thin', color: { argb: 'FF000000' } }, 
                            left: { style: 'thin', color: { argb: 'FF000000' } }, 
                            right: { style: 'thin', color: { argb: 'FF000000' } } 
                        };
                        cell.alignment = { vertical: 'middle', wrapText: true };
                        
                        // Centralizar colunas de data e status
                        if (col.includes('Vencimento') || col.includes('DataEmissao') || col.includes('Status') || col === 'Situacao') {
                            cell.alignment = { horizontal: 'center', vertical: 'middle' };
                        }
                    });
                    
                    // Cor alternada nas linhas
                    if (index % 2 === 1) {
                        colunas.forEach((col, i) => {
                            dataRow.getCell(i + 1).fill = { 
                                type: 'pattern', 
                                pattern: 'solid', 
                                fgColor: { argb: 'FFF5F5F5' } 
                            };
                        });
                    }
                });
                
                // Rodapé
                const footerRowNum = startRow + rows.length + 2;
                const footerRow = worksheet.getRow(footerRowNum);
                const lastCol = String.fromCharCode(65 + colunas.length - 1);
                worksheet.mergeCells(`A${footerRowNum}:${lastCol}${footerRowNum}`);
                const footerCell = footerRow.getCell(1);
                footerCell.value = `SSMA - ${rows.length} registro(s) - Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`;
                footerCell.alignment = { horizontal: 'center' };
                footerCell.font = { italic: true, color: { argb: 'FF666666' }, size: 10 };
                
                // Gerar buffer e enviar
                const buffer = await workbook.xlsx.writeBuffer();
                
                await registrarLog(req, 'Exportar Excel', `Exportou relatório Excel personalizado (${rows.length} registros)`);
                
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; charset=UTF-8');
                res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''relatorio_ssma_${new Date().toISOString().split('T')[0]}.xlsx`);
                res.send(buffer);
                
            } catch (error) {
                console.error('Erro ao gerar Excel:', error);
                res.status(500).json({ error: 'Erro ao gerar Excel: ' + error.message });
            }
        });
    });
});

// Rota para exportar SSMA para Excel (.xlsx) com logo
app.get('/api/exportar-excel', async (req, res) => {
    const { nome, empresa, funcao, situacao } = req.query;
    
    let sql = 'SELECT * FROM SSMA WHERE 1=1';
    let params = [];
    
    if (nome) {
        sql += ' AND Nome LIKE ? COLLATE NOCASE';
        params.push(`%${nome}%`);
    }
    if (empresa) {
        sql += ' AND Empresa LIKE ? COLLATE NOCASE';
        params.push(`%${empresa}%`);
    }
    if (funcao) {
        sql += ' AND Funcao LIKE ? COLLATE NOCASE';
        params.push(`%${funcao}%`);
    }
    if (situacao) {
        sql += ' AND Situacao = ?';
        params.push(situacao);
    }
    
    sql += ' ORDER BY Empresa, Nome';
    
    db.all(sql, params, async (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        // Buscar configuração (título e logo)
        db.get('SELECT titulo, logo FROM configuracao_relatorio WHERE id = 1', async (err, config) => {
            const titulo = config?.titulo || 'Relatório de Cursos';
            const logoPath = config?.logo || '/Logo-Hoss.jpg';
            
            try {
                // Criar workbook com ExcelJS
                const workbook = new ExcelJS.Workbook();
                const worksheet = workbook.addWorksheet('Relatório');
                
                // Configurar largura das colunas
                worksheet.columns = [
                    { width: 35 }, // A - Nome
                    { width: 15 }, // B - Empresa
                    { width: 20 }, // C - Função
                    { width: 12 }, // D - Venc-ASO
                    { width: 12 }, // E - Venc-NR10
                    { width: 12 }, // F - Venc-NR12
                    { width: 12 }, // G - Venc-NR18
                    { width: 12 }, // H - Venc-NR35
                    { width: 12 }, // I - Venc-EPI
                    { width: 10 }  // J - Situação
                ];
                
                // Adicionar logo se existir
                let startRow = 1;
                const logoFilePath = path.join(__dirname, 'public', logoPath.replace('/', ''));
                
                if (fs.existsSync(logoFilePath) && !logoPath.startsWith('data:')) {
                    const logoImage = workbook.addImage({
                        filename: logoFilePath,
                        extension: 'jpeg'
                    });
                    
                    worksheet.addImage(logoImage, {
                        tl: { col: 0, row: 0 },
                        ext: { width: 80, height: 50 }
                    });
                    
                    // Título ao lado do logo
                    worksheet.mergeCells('B1:J1');
                    const titleCell = worksheet.getCell('B1');
                    titleCell.value = titulo;
                    titleCell.font = { bold: true, size: 16 };
                    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
                    
                    worksheet.getRow(1).height = 50;
                    startRow = 3;
                } else {
                    // Sem logo, só título
                    worksheet.mergeCells('A1:J1');
                    const titleCell = worksheet.getCell('A1');
                    titleCell.value = titulo;
                    titleCell.font = { bold: true, size: 16 };
                    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
                    startRow = 3;
                }
                
                // Cabeçalhos
                const headers = ['Nome', 'Empresa', 'Função', 'Venc-ASO', 'Venc-NR10', 'Venc-NR12', 'Venc-NR18', 'Venc-NR35', 'Venc-EPI', 'Situação'];
                const headerRow = worksheet.getRow(startRow);
                headers.forEach((header, i) => {
                    const cell = headerRow.getCell(i + 1);
                    cell.value = header;
                    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A90E2' } };
                    cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
                });
                
                // Dados
                rows.forEach((row, index) => {
                    const dataRow = worksheet.getRow(startRow + 1 + index);
                    dataRow.getCell(1).value = row.Nome || '';
                    dataRow.getCell(2).value = row.Empresa || '';
                    dataRow.getCell(3).value = row.Funcao || '';
                    dataRow.getCell(4).value = formatarData(row.Vencimento);
                    dataRow.getCell(5).value = formatarData(row.Nr10_Vencimento);
                    dataRow.getCell(6).value = formatarData(row.NR12_Vencimento);
                    dataRow.getCell(7).value = formatarData(row.NR18_Vencimento);
                    dataRow.getCell(8).value = formatarData(row.NR35_Vencimento);
                    dataRow.getCell(9).value = formatarData(row.epiVencimento);
                    dataRow.getCell(10).value = row.Situacao === 'N' ? 'Ativo' : 'Inativo';
                    
                    // Bordas
                    for (let i = 1; i <= 10; i++) {
                        dataRow.getCell(i).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
                    }
                });
                
                // Rodapé SSMA
                const footerRow = worksheet.getRow(startRow + rows.length + 2);
                worksheet.mergeCells(`A${startRow + rows.length + 2}:J${startRow + rows.length + 2}`);
                const footerCell = footerRow.getCell(1);
                footerCell.value = 'SSMA';
                footerCell.alignment = { horizontal: 'center' };
                footerCell.font = { italic: true, color: { argb: 'FF666666' } };
                
                // Gerar buffer e enviar
                const buffer = await workbook.xlsx.writeBuffer();
                
                await registrarLog(req, 'Exportar Excel', `Exportou relatório Excel padrão (${rows.length} registros)`);
                
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; charset=UTF-8');
                res.setHeader('Content-Disposition', `attachment; filename="relatorio_ssma.xlsx"`);
                res.send(buffer);
                
            } catch (error) {
                console.error('Erro ao gerar Excel:', error);
                res.status(500).json({ error: 'Erro ao gerar Excel: ' + error.message });
            }
        });
    });
});

// Função auxiliar para formatar data
function formatarData(dateString) {
    if (!dateString || dateString === 'null') return '';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    } catch (e) {
        return dateString;
    }
}

// POST - Gerar Lista de Presença (apenas funcionários ATIVOS)
app.post('/api/lista-presenca', async (req, res) => {
    const { mes, ano, titulo, empresa } = req.body;
    
    // Buscar apenas funcionários ATIVOS (Situacao = 'N')
    let sql = "SELECT Nome, Empresa, Funcao FROM SSMA WHERE Situacao = 'N'";
    let params = [];
    
    if (empresa) {
        sql += ' AND Empresa = ?';
        params.push(empresa);
    }
    
    sql += ' ORDER BY Empresa, Nome';
    
    db.all(sql, params, async (err, funcionarios) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        try {
            const workbook = new ExcelJS.Workbook();
            const meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
            const nomeMes = meses[mes - 1];
            
            const worksheet = workbook.addWorksheet(`${nomeMes}.${ano.toString().slice(-2)}`);
            
            // Calcular dias do mês
            const diasNoMes = new Date(ano, mes, 0).getDate();
            
            // Configurar larguras das colunas
            const colWidths = [
                { width: 12 },  // Empresa
                { width: 35 },  // Nome
                { width: 18 }   // Função
            ];
            
            // Adicionar colunas para cada dia
            for (let i = 1; i <= diasNoMes; i++) {
                colWidths.push({ width: 3 });
            }
            
            // Colunas de total
            colWidths.push({ width: 5 }); // P
            colWidths.push({ width: 5 }); // F
            
            worksheet.columns = colWidths;
            
            // Linha 1 - Título
            worksheet.mergeCells(1, 2, 1, diasNoMes + 5);
            const titleCell = worksheet.getCell(1, 2);
            titleCell.value = `${titulo} - ${nomeMes}/${ano}`;
            titleCell.font = { bold: true, size: 14 };
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
            worksheet.getRow(1).height = 25;
            
            // Linha 2 - Cabeçalhos principais
            worksheet.getCell(2, 2).value = 'NOME';
            worksheet.getCell(2, 3).value = 'FUNÇÃO';
            worksheet.getCell(2, 2).font = { bold: true };
            worksheet.getCell(2, 3).font = { bold: true };
            
            // Linha 3 - "DIA" e "TOTAL"
            worksheet.getCell(3, 4).value = 'DIA';
            worksheet.getCell(3, 4).font = { bold: true };
            worksheet.mergeCells(3, diasNoMes + 4, 3, diasNoMes + 5);
            worksheet.getCell(3, diasNoMes + 4).value = 'TOTAL';
            worksheet.getCell(3, diasNoMes + 4).font = { bold: true };
            worksheet.getCell(3, diasNoMes + 4).alignment = { horizontal: 'center' };
            
            // Linha 4 - Números dos dias e P/F
            for (let i = 1; i <= diasNoMes; i++) {
                const cell = worksheet.getCell(4, i + 3);
                cell.value = i;
                cell.font = { bold: true, size: 9 };
                cell.alignment = { horizontal: 'center' };
                
                // Verificar se é fim de semana
                const data = new Date(ano, mes - 1, i);
                if (data.getDay() === 0 || data.getDay() === 6) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
                }
            }
            
            worksheet.getCell(4, diasNoMes + 4).value = 'P';
            worksheet.getCell(4, diasNoMes + 4).font = { bold: true };
            worksheet.getCell(4, diasNoMes + 4).alignment = { horizontal: 'center' };
            worksheet.getCell(4, diasNoMes + 5).value = 'F';
            worksheet.getCell(4, diasNoMes + 5).font = { bold: true };
            worksheet.getCell(4, diasNoMes + 5).alignment = { horizontal: 'center' };
            
            // Dados dos funcionários (apenas ATIVOS)
            let rowNum = 5;
            funcionarios.forEach(func => {
                const row = worksheet.getRow(rowNum);
                
                row.getCell(1).value = func.Empresa || '';
                row.getCell(2).value = func.Nome || '';
                row.getCell(3).value = func.Funcao || '';
                
                // Células vazias para os dias (para preenchimento manual)
                for (let i = 1; i <= diasNoMes; i++) {
                    const cell = row.getCell(i + 3);
                    cell.value = '';
                    cell.border = {
                        top: { style: 'thin' },
                        bottom: { style: 'thin' },
                        left: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                    cell.alignment = { horizontal: 'center' };
                    
                    // Marcar fins de semana
                    const data = new Date(ano, mes - 1, i);
                    if (data.getDay() === 0 || data.getDay() === 6) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
                        cell.value = '-';
                    }
                }
                
                // Fórmulas para contar P e F
                const primeiraColDia = 4; // Coluna D
                const ultimaColDia = primeiraColDia + diasNoMes - 1;
                const letraPrimeira = String.fromCharCode(64 + primeiraColDia);
                const letraUltima = String.fromCharCode(64 + ultimaColDia);
                
                // Coluna P - Contar "X"
                row.getCell(diasNoMes + 4).value = { formula: `COUNTIF(${letraPrimeira}${rowNum}:${letraUltima}${rowNum},"X")` };
                row.getCell(diasNoMes + 4).alignment = { horizontal: 'center' };
                
                // Coluna F - Contar "F"
                row.getCell(diasNoMes + 5).value = { formula: `COUNTIF(${letraPrimeira}${rowNum}:${letraUltima}${rowNum},"F")` };
                row.getCell(diasNoMes + 5).alignment = { horizontal: 'center' };
                
                // Bordas nas células de nome, empresa, função
                for (let i = 1; i <= 3; i++) {
                    row.getCell(i).border = {
                        top: { style: 'thin' },
                        bottom: { style: 'thin' },
                        left: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                }
                
                // Bordas nas células de total
                row.getCell(diasNoMes + 4).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
                row.getCell(diasNoMes + 5).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
                
                rowNum++;
            });
            
            // Bordas no cabeçalho
            for (let r = 2; r <= 4; r++) {
                for (let c = 1; c <= diasNoMes + 5; c++) {
                    const cell = worksheet.getCell(r, c);
                    cell.border = {
                        top: { style: 'thin' },
                        bottom: { style: 'thin' },
                        left: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                }
            }
            
            // Cabeçalho com cor
            const headerRow = worksheet.getRow(4);
            headerRow.eachCell((cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
            });
            
            // Gerar buffer e enviar
            const buffer = await workbook.xlsx.writeBuffer();
            
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; charset=UTF-8');
            res.setHeader('Content-Disposition', `attachment; filename="Lista_Presenca_${nomeMes}_${ano}.xlsx"`);
            res.send(buffer);
            
        } catch (error) {
            console.error('Erro ao gerar lista de presença:', error);
            res.status(500).json({ error: 'Erro ao gerar lista: ' + error.message });
        }
    });
});

// ==================== ROTAS DE CONTROLE DE PRESENÇA ====================

// GET - Buscar funcionários ATIVOS para controle de presença
app.get('/api/presenca/funcionarios', (req, res) => {
    const { empresa, mes, ano } = req.query;
    
    let sql = `SELECT id, Nome, Empresa, Funcao FROM SSMA WHERE Situacao = 'S'`;
    const params = [];
    
    if (empresa) {
        sql += ` AND Empresa LIKE ?`;
        params.push(`%${empresa}%`);
    }
    
    sql += ` ORDER BY Empresa, Nome`;
    
    db.all(sql, params, (err, funcionarios) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        // Se mes e ano foram informados, buscar presenças do período
        if (mes && ano) {
            const mesStr = mes.toString().padStart(2, '0');
            const dataInicio = `${ano}-${mesStr}-01`;
            const ultimoDia = new Date(ano, mes, 0).getDate();
            const dataFim = `${ano}-${mesStr}-${ultimoDia}`;
            
            const sqlPresenca = `
                SELECT funcionario_id, data, status, observacao 
                FROM PRESENCA 
                WHERE data BETWEEN ? AND ?
            `;
            
            db.all(sqlPresenca, [dataInicio, dataFim], (err, presencas) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                
                // Mapear presenças por funcionário
                const presencaMap = {};
                presencas.forEach(p => {
                    if (!presencaMap[p.funcionario_id]) {
                        presencaMap[p.funcionario_id] = {};
                    }
                    const dia = parseInt(p.data.split('-')[2]);
                    presencaMap[p.funcionario_id][dia] = { status: p.status, observacao: p.observacao };
                });
                
                res.json({ funcionarios, presencas: presencaMap });
            });
        } else {
            res.json({ funcionarios, presencas: {} });
        }
    });
});

// POST - Salvar presença de um funcionário
app.post('/api/presenca/salvar', (req, res) => {
    let { funcionario_id, data, status, observacao } = req.body;
    
    observacao = normalizarTexto(observacao);
    
    if (!funcionario_id || !data) {
        return res.status(400).json({ error: 'funcionario_id e data são obrigatórios' });
    }
    
    const sql = `
        INSERT INTO PRESENCA (funcionario_id, data, status, observacao, funcionarioFuncao, funcionarioEmpresa)
        VALUES (?, ?, ?, ?, 
            (SELECT Funcao FROM SSMA WHERE id = ?), 
            (SELECT Empresa FROM SSMA WHERE id = ?))
        ON CONFLICT(funcionario_id, data) DO UPDATE SET
            status = excluded.status,
            observacao = excluded.observacao,
            funcionarioFuncao = excluded.funcionarioFuncao,
            funcionarioEmpresa = excluded.funcionarioEmpresa
    `;
    
    db.run(sql, [funcionario_id, data, status || 'P', observacao || '', funcionario_id, funcionario_id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, id: this.lastID });
    });
});

// POST - Salvar múltiplas presenças de uma vez
app.post('/api/presenca/salvar-lote', (req, res) => {
    let { presencas } = req.body; // Array de { funcionario_id, data, status, observacao }
    
    if (presencas && Array.isArray(presencas)) {
        presencas = presencas.map(p => ({
            ...p,
            observacao: normalizarTexto(p.observacao)
        }));
    }
    
    if (!presencas || !Array.isArray(presencas)) {
        return res.status(400).json({ error: 'presencas deve ser um array' });
    }
    
    const sql = `
        INSERT INTO PRESENCA (funcionario_id, data, status, observacao)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(funcionario_id, data) DO UPDATE SET
            status = excluded.status,
            observacao = excluded.observacao
    `;
    
    let erros = 0;
    let salvos = 0;
    
    db.serialize(() => {
        const stmt = db.prepare(sql);
        
        presencas.forEach(p => {
            stmt.run([p.funcionario_id, p.data, p.status || 'P', p.observacao || ''], (err) => {
                if (err) erros++;
                else salvos++;
            });
        });
        
        stmt.finalize(() => {
            res.json({ success: true, salvos, erros });
        });
    });
});

// GET - Resumo de presença por mês
app.get('/api/presenca/resumo', (req, res) => {
    const { mes, ano, empresa } = req.query;
    
    if (!mes || !ano) {
        return res.status(400).json({ error: 'mes e ano são obrigatórios' });
    }
    
    const mesStr = mes.toString().padStart(2, '0');
    const dataInicio = `${ano}-${mesStr}-01`;
    const ultimoDia = new Date(ano, mes, 0).getDate();
    const dataFim = `${ano}-${mesStr}-${ultimoDia}`;
    
    let sqlFuncionarios = `SELECT id, Nome, Empresa, Funcao FROM SSMA WHERE Situacao = 'S'`;
    const params = [];
    
    if (empresa) {
        sqlFuncionarios += ` AND Empresa LIKE ?`;
        params.push(`%${empresa}%`);
    }
    
    sqlFuncionarios += ` ORDER BY Empresa, Nome`;
    
    db.all(sqlFuncionarios, params, (err, funcionarios) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        const sqlPresenca = `
            SELECT funcionario_id, 
                   SUM(CASE WHEN status = 'P' THEN 1 ELSE 0 END) as presencas,
                   SUM(CASE WHEN status = 'F' THEN 1 ELSE 0 END) as faltas,
                   SUM(CASE WHEN status NOT IN ('P', 'F', '') THEN 1 ELSE 0 END) as outros
            FROM PRESENCA 
            WHERE data BETWEEN ? AND ?
            GROUP BY funcionario_id
        `;
        
        db.all(sqlPresenca, [dataInicio, dataFim], (err, resumos) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            const resumoMap = {};
            resumos.forEach(r => {
                resumoMap[r.funcionario_id] = r;
            });
            
            const resultado = funcionarios.map(f => ({
                ...f,
                presencas: resumoMap[f.id]?.presencas || 0,
                faltas: resumoMap[f.id]?.faltas || 0,
                outros: resumoMap[f.id]?.outros || 0
            }));
            
            res.json({ funcionarios: resultado, diasNoMes: ultimoDia });
        });
    });
});

// BUSCAR PRESENÇA (SQL)
app.get('/api/controle-presenca', async (req, res) => {
    try {
        const mesAno = getMesAnoAtual();
        const rows = await db.all("SELECT * FROM PRESENCA_MES_ATUAL WHERE mesAno = ?", [mesAno]);
        const comments = await db.all("SELECT * FROM COMENTARIOS_PRESENCA WHERE mesAno = ?", [mesAno]);
        const ocultos = await db.all("SELECT funcionarioId FROM FUNCIONARIOS_OCULTOS WHERE mesAno = ?", [mesAno]);
        
        // Formatar para o frontend (compatibilidade)
        const presenca = {};
        rows.forEach(r => {
            if (!presenca[r.funcionarioId]) presenca[r.funcionarioId] = {};
            presenca[r.funcionarioId][r.dia] = { status: r.status, isFolga: r.isFolga === 1 };
        });
        
        const comentarios = {};
        comments.forEach(c => {
            comentarios[`${c.funcionarioId}_${c.dia}`] = { texto: c.texto, data: c.dataCriacao };
        });

        const listOcultos = ocultos.map(o => o.funcionarioId);

        res.json({
            success: true,
            mesAtual: mesAno,
            presenca: presenca,
            comentarios: comentarios,
            ocultos: listOcultos
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ============ ROTAS DE CONTROLE DE PRESENÇA ============

// GET - Buscar funcionários para controle de presença
// Retorna funcionários ATIVOS + funcionários que têm presença registrada no mês (mesmo que inativados)
app.get('/api/controle-presenca/funcionarios', (req, res) => {
    verificarResetMes();
    
    // Buscar todos os funcionários ativos
    const sql = `SELECT id, Nome, Empresa, Funcao, Situacao FROM SSMA WHERE Situacao = 'N' ORDER BY Empresa, Nome`;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        // Pegar IDs dos funcionários que têm presença registrada no mês atual (do banco de dados)
        const sqlIdsComPresenca = `SELECT DISTINCT funcionarioId FROM PRESENCA WHERE mesAno = ?`;
        
        db.all(sqlIdsComPresenca, [presencaMesAtual], (err2, presencaRows) => {
            if (err2) {
                console.error('Erro ao buscar IDs com presença:', err2);
                presencaRows = [];
            }
            
            const idsComPresenca = (presencaRows || []).map(row => row.funcionarioId);
            
            // Buscar funcionários inativados que têm presença REAL no mês (P, F, A, FE, FO - não apenas registros vazios)
            if (idsComPresenca.length > 0) {
                const placeholders = idsComPresenca.map(() => '?').join(',');
                const sqlInativos = `
                    SELECT DISTINCT s.id, s.Nome, s.Empresa, s.Funcao, s.Situacao 
                    FROM SSMA s
                    INNER JOIN PRESENCA p ON p.funcionarioId = s.id
                    WHERE s.id IN (${placeholders}) 
                    AND s.Situacao = 'S'
                    AND p.mesAno = ?
                    AND p.status IN ('P', 'F', 'A', 'FE', 'FO')
                `;
                
                db.all(sqlInativos, [...idsComPresenca, presencaMesAtual], (err3, inativos) => {
                    if (err3) {
                        console.error('Erro ao buscar inativos:', err3);
                    }
                    
                    // Combinar ativos + inativos com presença
                    const todosFuncionarios = [...rows, ...(inativos || [])];
                    
                    // Buscar mudanças de função do mês atual
                    const sqlMudancas = `SELECT * FROM MUDANCA_FUNCAO_PRESENCA WHERE mesAno = ? ORDER BY funcionarioId, diaInicio`;
                    
                    db.all(sqlMudancas, [presencaMesAtual], (err4, mudancas) => {
                        if (err4) {
                            console.error('Erro ao buscar mudanças de função:', err4);
                        }
                        
                        // Processar funcionários e criar registros duplicados para mudanças de função
                        const funcionariosExpandidos = [];
                        
                        for (const func of todosFuncionarios) {
                            // Verificar se este funcionário tem mudança de função
                            const mudancasFunc = (mudancas || []).filter(m => m.funcionarioId === func.id);
                            
                            if (mudancasFunc.length > 0) {
                                // Ordenar mudanças por dia
                                mudancasFunc.sort((a, b) => a.diaInicio - b.diaInicio);
                                
                                // Primeiro registro: função original até o dia anterior à primeira mudança
                                const diaInicioOriginal = func.iniciouNoMes ? func.diaInicio : 1;
                                funcionariosExpandidos.push({
                                    ...func,
                                    inativado: func.Situacao === 'S',
                                    Funcao: mudancasFunc[0].funcaoAnterior, // Usar função anterior da mudança
                                    funcaoOriginal: mudancasFunc[0].funcaoAnterior,
                                    diaInicio: diaInicioOriginal,
                                    diaFim: mudancasFunc[0].diaInicio - 1,
                                    mudancaId: null,
                                    isMudanca: false,
                                    idUnico: `${func.id}_original`
                                });
                                
                                // Registros de mudanças
                                for (let i = 0; i < mudancasFunc.length; i++) {
                                    const mudanca = mudancasFunc[i];
                                    const proximaMudanca = mudancasFunc[i + 1];
                                    
                                    funcionariosExpandidos.push({
                                        ...func,
                                        Funcao: mudanca.funcaoNova,
                                        inativado: func.Situacao === 'S',
                                        funcaoOriginal: mudancasFunc[0].funcaoAnterior,
                                        diaInicio: mudanca.diaInicio,
                                        diaFim: proximaMudanca ? proximaMudanca.diaInicio - 1 : 31,
                                        mudancaId: mudanca.id,
                                        isMudanca: true,
                                        anotacoesMudanca: mudanca.anotacoes,
                                        idUnico: `${func.id}_mudanca_${mudanca.id}`
                                    });
                                }
                            } else {
                                // Sem mudança de função, adicionar normalmente
                                const diaInicioNormal = func.iniciouNoMes ? func.diaInicio : 1;
                                funcionariosExpandidos.push({
                                    ...func,
                                    inativado: func.Situacao === 'S',
                                    funcaoOriginal: func.Funcao,
                                    diaInicio: diaInicioNormal,
                                    diaFim: 31,
                                    mudancaId: null,
                                    isMudanca: false,
                                    idUnico: `${func.id}_normal`
                                });
                            }
                        }
                        
                        res.json({ data: funcionariosExpandidos, mesAno: presencaMesAtual });
                    });
                });
            } else {
                // Nenhum inativo com presença, buscar mudanças de função
                const sqlMudancas = `SELECT * FROM MUDANCA_FUNCAO_PRESENCA WHERE mesAno = ? ORDER BY funcionarioId, diaInicio`;
                
                db.all(sqlMudancas, [presencaMesAtual], (err4, mudancas) => {
                    if (err4) {
                        console.error('Erro ao buscar mudanças de função:', err4);
                    }
                    
                    // Processar funcionários e criar registros duplicados para mudanças de função
                    const funcionariosExpandidos = [];
                    
                    for (const func of rows) {
                        // Verificar se este funcionário tem mudança de função
                        const mudancasFunc = (mudancas || []).filter(m => m.funcionarioId === func.id);
                        
                        if (mudancasFunc.length > 0) {
                            // Ordenar mudanças por dia
                            mudancasFunc.sort((a, b) => a.diaInicio - b.diaInicio);
                            
                            // Primeiro registro: função original até o dia anterior à primeira mudança
                            const diaInicioOriginal = func.iniciouNoMes ? func.diaInicio : 1;
                            funcionariosExpandidos.push({
                                ...func,
                                inativado: false,
                                Funcao: mudancasFunc[0].funcaoAnterior, // Usar função anterior da mudança
                                funcaoOriginal: mudancasFunc[0].funcaoAnterior,
                                diaInicio: diaInicioOriginal,
                                diaFim: mudancasFunc[0].diaInicio - 1,
                                mudancaId: null,
                                isMudanca: false,
                                idUnico: `${func.id}_original`
                            });
                            
                            // Registros de mudanças
                            for (let i = 0; i < mudancasFunc.length; i++) {
                                const mudanca = mudancasFunc[i];
                                const proximaMudanca = mudancasFunc[i + 1];
                                
                                funcionariosExpandidos.push({
                                    ...func,
                                    Funcao: mudanca.funcaoNova,
                                    inativado: false,
                                    funcaoOriginal: mudancasFunc[0].funcaoAnterior,
                                    diaInicio: mudanca.diaInicio,
                                    diaFim: proximaMudanca ? proximaMudanca.diaInicio - 1 : 31,
                                    mudancaId: mudanca.id,
                                    isMudanca: true,
                                    anotacoesMudanca: mudanca.anotacoes,
                                    idUnico: `${func.id}_mudanca_${mudanca.id}`
                                });
                            }
                        } else {
                            // Sem mudança de função, adicionar normalmente
                            const diaInicioNormal = func.iniciouNoMes ? func.diaInicio : 1;
                            funcionariosExpandidos.push({
                                ...func,
                                inativado: false,
                                funcaoOriginal: func.Funcao,
                                diaInicio: diaInicioNormal,
                                diaFim: 31,
                                mudancaId: null,
                                isMudanca: false,
                                idUnico: `${func.id}_normal`
                            });
                        }
                    }
                    
                    res.json({ data: funcionariosExpandidos, mesAno: presencaMesAtual });
                });
            }
        });
    });
});

// GET - Buscar dados de presença do mês atual
app.get('/api/controle-presenca/dados', async (req, res) => {
    await verificarResetMes();
    
    const sql = `
        SELECT funcionarioId, dia, status, comentario
        FROM PRESENCA
        WHERE mesAno = ?
        ORDER BY funcionarioId, dia
    `;
    
    try {
        const rows = await db.all(sql, [presencaMesAtual]);
        const dados = {};
        const comentarios = {};
        
        rows.forEach(row => {
            if (!dados[row.funcionarioId]) {
                dados[row.funcionarioId] = {};
            }
            
            dados[row.funcionarioId][row.dia] = {
                status: row.status || '',
                isFolga: false
            };
            
            if (row.comentario) {
                if (!comentarios[row.funcionarioId]) {
                    comentarios[row.funcionarioId] = {};
                }
                comentarios[row.funcionarioId][row.dia] = row.comentario;
            }
        });
        
        res.json({ data: dados, comentarios: comentarios, mesAno: presencaMesAtual });
    } catch (err) {
        console.error('❌ Erro ao buscar dados de presença:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET - Buscar histórico de presença (todos os meses)
app.get('/api/controle-presenca/historico', (req, res) => {
    const sql = `SELECT DISTINCT mesAno FROM HISTORICO_PRESENCA ORDER BY mesAno DESC`;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ meses: rows.map(r => r.mesAno) });
    });
});

// GET - Buscar dados de um mês específico do histórico
app.get('/api/controle-presenca/historico/:mesAno', (req, res) => {
    const { mesAno } = req.params;
    
    const sql = `SELECT * FROM HISTORICO_PRESENCA WHERE mesAno = ?`;
    
    db.all(sql, [mesAno], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        // Reconstruir estrutura de dados
        const dadosPresenca = {};
        const comentarios = {};
        
        rows.forEach(row => {
            dadosPresenca[row.funcionarioId] = JSON.parse(row.dadosPresenca);
            const comentariosFunc = JSON.parse(row.comentarios);
            Object.assign(comentarios, comentariosFunc);
        });
        
        res.json({ data: dadosPresenca, comentarios: comentarios, mesAno: mesAno, rows: rows });
    });
});

// ============ ROTAS DE OCORRÊNCIAS ============

// GET - Listar ocorrências do mês atual
app.get('/api/ocorrencias', (req, res) => {
    verificarResetMes();
    const ocorrencias = ocorrenciasPresenca[presencaMesAtual] || [];
    // Ordenar por data decrescente (mais recente primeiro)
    const ordenadas = [...ocorrencias].sort((a, b) => new Date(b.data) - new Date(a.data));
    res.json({ data: ordenadas, mesAno: presencaMesAtual });
});

// POST - Criar nova ocorrência
app.post('/api/ocorrencias', (req, res) => {
    verificarResetMes();
    const { texto } = req.body;
    
    if (!texto || !texto.trim()) {
        return res.status(400).json({ success: false, error: 'Texto é obrigatório' });
    }
    
    if (!ocorrenciasPresenca[presencaMesAtual]) {
        ocorrenciasPresenca[presencaMesAtual] = [];
    }
    
    const novaOcorrencia = {
        id: Date.now().toString(),
        texto: texto.trim(),
        data: new Date().toISOString()
    };
    
    ocorrenciasPresenca[presencaMesAtual].push(novaOcorrencia);
    salvarDadosPresenca();
    
    console.log('📝 Nova ocorrência salva:', novaOcorrencia.texto.substring(0, 50) + '...');
    res.json({ success: true, data: novaOcorrencia });
});

// DELETE - Excluir ocorrência
app.delete('/api/ocorrencias/:id', (req, res) => {
    verificarResetMes();
    const { id } = req.params;
    
    if (!ocorrenciasPresenca[presencaMesAtual]) {
        return res.status(404).json({ success: false, error: 'Ocorrência não encontrada' });
    }
    
    const index = ocorrenciasPresenca[presencaMesAtual].findIndex(o => o.id === id);
    if (index === -1) {
        return res.status(404).json({ success: false, error: 'Ocorrência não encontrada' });
    }
    
    ocorrenciasPresenca[presencaMesAtual].splice(index, 1);
    salvarDadosPresenca();
    
    console.log('🗑️ Ocorrência excluída:', id);
    res.json({ success: true });
});

// POST - Limpar dados de presença do mês atual
app.post('/api/controle-presenca/limpar', (req, res) => {
    verificarResetMes();
    presencaMemoria[presencaMesAtual] = {};
    res.json({ success: true, message: 'Dados de presença limpos' });
});

// POST - Salvar marcação de presença
app.post('/api/controle-presenca/marcar', async (req, res) => {
    verificarResetMes();
    
    const { funcionarioId, funcionarioNome, funcionarioEmpresa, funcionarioSituacao, dia, status } = req.body;
    const funcionarioFuncao = req.body.funcionarioFuncao ? req.body.funcionarioFuncao.normalize('NFC').trim() : '';
    
    if (!funcionarioId || !dia) {
        return res.status(400).json({ error: 'funcionarioId e dia são obrigatórios' });
    }
    
    const mesAno = presencaMesAtual;
    
    try {
        if (status === '' || status === null) {
            // Se é folga, deletar o registro
            await db.run(
                'DELETE FROM PRESENCA WHERE mesAno = ? AND funcionarioId = ? AND dia = ?',
                [mesAno, funcionarioId, dia]
            );
            
            console.log(`✅ Presença deletada: ${funcionarioNome} - Dia ${dia}`);
            
            // Auditoria inteligente automática
            await registrarLog(req, 'Limpar Presença', `Limpou a marcação de presença de [${funcionarioNome}] no dia ${dia}`);
        } else {
            // Inserir ou atualizar presença
            await db.run(
                `INSERT INTO PRESENCA 
                (mesAno, funcionarioId, funcionarioNome, funcionarioEmpresa, funcionarioFuncao, funcionarioSituacao, dia, status, formatacao)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(mesAno, funcionarioId, dia) DO UPDATE SET
                    status = excluded.status,
                    dataAtualizacao = CURRENT_TIMESTAMP`,
                [mesAno, funcionarioId, funcionarioNome, funcionarioEmpresa, funcionarioFuncao, funcionarioSituacao, dia, status, req.body.formatacao || 'normal']
            );
            
            console.log(`✅ Presença salva: ${funcionarioNome} - Dia ${dia} - Status: ${status}`);
            
            // Auditoria inteligente automática
            await registrarLog(req, 'Marcar Presença', `Marcou presença [${status}] para o funcionário [${funcionarioNome}] no dia ${dia}`);
        }
        
        res.json({ success: true, mesAno: mesAno });
    } catch (err) {
        console.error('❌ Erro ao processar presença:', err);
        res.status(500).json({ error: err.message });
    }
});

// COMENTÁRIO PRESENÇA (SQL)
app.post('/api/controle-presenca/comentario', async (req, res) => {
    try {
        const { funcionarioId, dia, texto } = req.body;
        const mesAno = getMesAnoAtual();
        
        const existing = await db.get("SELECT id FROM COMENTARIOS_PRESENCA WHERE mesAno = ? AND funcionarioId = ? AND dia = ?", [mesAno, funcionarioId, dia]);
        
        if (existing) {
            if (!texto) {
                await db.run("DELETE FROM COMENTARIOS_PRESENCA WHERE id = ?", [existing.id]);
            } else {
                await db.run("UPDATE COMENTARIOS_PRESENCA SET texto = ? WHERE id = ?", [texto, existing.id]);
            }
        } else if (texto) {
            await db.run(
                "INSERT INTO COMENTARIOS_PRESENCA (mesAno, funcionarioId, dia, texto, dataCriacao) VALUES (?, ?, ?, ?, datetime('now'))",
                [mesAno, funcionarioId, dia, texto]
            );
        }

        // Capturar o nome do funcionário
        const func = await db.get("SELECT Nome FROM SSMA WHERE id = ?", [funcionarioId]);
        
        // Auditoria inteligente (Passando 'req' para carregar corretamente 'Danilo', IP e Navegador!)
        await registrarLog(req, 'Comentário Presença', `Alterou comentário de [${func?.Nome || funcionarioId}] no dia ${dia}`);

        res.json({ success: true });
    } catch (err) {
        console.error('❌ Erro ao salvar comentário:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// OCULTAR FUNCIONÁRIO (SQL)
app.post('/api/controle-presenca/ocultar', async (req, res) => {
    try {
        const { funcionarioId } = req.body;
        const mesAno = getMesAnoAtual();
        
        await db.run(
            "INSERT OR IGNORE INTO FUNCIONARIOS_OCULTOS (mesAno, funcionarioId) VALUES (?, ?)",
            [mesAno, funcionarioId]
        );

        const func = await db.get("SELECT Nome FROM SSMA WHERE id = ?", [funcionarioId]);
        await registrarLog(req, 'Ocultar Funcionário', `Ocultou o funcionário [${func?.Nome || funcionarioId}] da planilha de presença`);
        
        res.json({ success: true });
    } catch (err) {
        console.error('❌ Erro ao ocultar funcionário:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// MOSTRAR FUNCIONÁRIO (SQL)
app.post('/api/controle-presenca/mostrar', async (req, res) => {
    try {
        const { funcionarioId } = req.body;
        const mesAno = getMesAnoAtual();
        
        await db.run(
            "DELETE FROM FUNCIONARIOS_OCULTOS WHERE mesAno = ? AND funcionarioId = ?",
            [mesAno, funcionarioId]
        );

        const func = await db.get("SELECT Nome FROM SSMA WHERE id = ?", [funcionarioId]);
        await registrarLog(req, 'Exibir Funcionário', `Voltou a exibir o funcionário [${func?.Nome || funcionarioId}] na planilha de presença`);
        
        res.json({ success: true });
    } catch (err) {
        console.error('❌ Erro ao mostrar funcionário:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// LISTAR OCULTOS (SQL)
app.get('/api/controle-presenca/ocultos', async (req, res) => {
    try {
        const mesAno = getMesAnoAtual();
        const rows = await db.all("SELECT funcionarioId FROM FUNCIONARIOS_OCULTOS WHERE mesAno = ?", [mesAno]);
        res.json({ success: true, ocultos: rows.map(r => r.funcionarioId) });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// FECHAR MÊS MANUALMENTE
app.post('/api/controle-presenca/fechar-mes', async (req, res) => {
    try {
        const { usuario } = req.body;
        const mesAno = getMesAnoAtual();
        
        console.log(`🚀 Fechamento manual do mês ${mesAno} solicitado por ${usuario}`);
        
        // 1. Gerar Backup Excel
        await gerarBackupPresenca(mesAno);
        
        // 2. Salvar no Histórico SQL
        await salvarHistoricoPresenca(mesAno);
        
        // 3. Limpar tabelas atuais para o novo mês
        await db.run("DELETE FROM PRESENCA_MES_ATUAL WHERE mesAno = ?", [mesAno]);
        await db.run("DELETE FROM COMENTARIOS_PRESENCA WHERE mesAno = ?", [mesAno]);
        await db.run("DELETE FROM FUNCIONARIOS_OCULTOS WHERE mesAno = ?", [mesAno]);
        
        await registrarLog(usuario, 'Fechar Mês', `Encerrou manualmente o mês ${mesAno}`);
        
        res.json({ success: true, message: 'Mês encerrado e arquivado com sucesso!' });
    } catch (err) {
        console.error('Erro ao fechar mês:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// LISTAR BACKUPS
app.get('/api/backups/listar', async (req, res) => {
    try {
        const downloadsPath = path.join(require('os').homedir(), 'Downloads');
        const files = fs.readdirSync(downloadsPath)
            .filter(f => f.startsWith('Backup_Presenca_') || f.startsWith('Presenca_'))
            .map(f => ({
                nome: f,
                data: fs.statSync(path.join(downloadsPath, f)).mtime,
                tamanho: fs.statSync(path.join(downloadsPath, f)).size
            }))
            .sort((a, b) => b.data - a.data);
            
        res.json({ success: true, backups: files });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// DOWNLOAD BACKUP
app.get('/api/backups/download/:arquivo', (req, res) => {
    try {
        const { arquivo } = req.params;
        const downloadsPath = path.join(require('os').homedir(), 'Downloads');
        const filePath = path.join(downloadsPath, arquivo);
        
        if (fs.existsSync(filePath)) {
            res.download(filePath);
        } else {
            res.status(404).json({ success: false, error: 'Arquivo não encontrado' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ============ ROTAS DE EMPRESAS OCULTAS ============

// POST - Ocultar empresa da tabela-mes
app.post('/api/tabela-mes/ocultar-empresa', (req, res) => {
    const { empresa } = req.body;
    
    if (!empresa) {
        return res.status(400).json({ error: 'empresa é obrigatória' });
    }
    
    const sql = `INSERT OR IGNORE INTO EMPRESAS_OCULTAS (empresaOculta) VALUES (?)`;
    
    db.run(sql, [empresa], function(err) {
        if (err) {
            console.error('Erro ao ocultar empresa:', err);
            return res.status(500).json({ error: err.message });
        }
        
        console.log(`👁️ Empresa ${empresa} ocultada da tabela-mes`);
        res.json({ success: true, message: 'Empresa ocultada com sucesso' });
    });
});

// POST - Mostrar empresa na tabela-mes
app.post('/api/tabela-mes/mostrar-empresa', (req, res) => {
    const { empresa } = req.body;
    
    if (!empresa) {
        return res.status(400).json({ error: 'empresa é obrigatória' });
    }
    
    const sql = `DELETE FROM EMPRESAS_OCULTAS WHERE empresaOculta = ?`;
    
    db.run(sql, [empresa], function(err) {
        if (err) {
            console.error('Erro ao mostrar empresa:', err);
            return res.status(500).json({ error: err.message });
        }
        
        console.log(`👁️ Empresa ${empresa} voltou a aparecer na tabela-mes`);
        res.json({ success: true, message: 'Empresa visível novamente' });
    });
});

// GET - Listar empresas ocultas
app.get('/api/tabela-mes/empresas-ocultas', (req, res) => {
    const sql = `SELECT empresaOculta FROM EMPRESAS_OCULTAS ORDER BY empresaOculta`;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        const empresas = rows.map(row => row.empresaOculta);
        res.json({ data: empresas, count: empresas.length });
    });
});

// ============ ROTAS DE MUDANÇA DE FUNÇÃO ============

// POST - Registrar mudança de função
app.post('/api/mudanca-funcao/registrar', (req, res) => {
    verificarResetMes();
    
    const { funcionarioId, funcionarioNome, funcaoAnterior, funcaoNova, diaInicio, anotacoes } = req.body;
    
    if (!funcionarioId || !funcaoNova || !diaInicio) {
        return res.status(400).json({ error: 'funcionarioId, funcaoNova e diaInicio são obrigatórios' });
    }
    
    const sql = `
        INSERT INTO MUDANCA_FUNCAO_PRESENCA (mesAno, funcionarioId, funcionarioNome, funcaoAnterior, funcaoNova, diaInicio, anotacoes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.run(sql, [presencaMesAtual, funcionarioId, funcionarioNome, funcaoAnterior, funcaoNova, diaInicio, anotacoes], function(err) {
        if (err) {
            console.error('Erro ao registrar mudança de função:', err);
            return res.status(500).json({ error: err.message });
        }
        
        console.log(`✅ Mudança de função registrada: ${funcionarioNome} - ${funcaoAnterior} → ${funcaoNova} (dia ${diaInicio})`);
        res.json({ success: true, id: this.lastID, message: 'Mudança de função registrada com sucesso' });
    });
});

// GET - Listar mudanças de função do mês
app.get('/api/mudanca-funcao/listar', (req, res) => {
    verificarResetMes();
    
    const sql = `SELECT * FROM MUDANCA_FUNCAO_PRESENCA WHERE mesAno = ? ORDER BY funcionarioNome, diaInicio`;
    
    db.all(sql, [presencaMesAtual], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ data: rows || [], mesAno: presencaMesAtual });
    });
});

// DELETE - Excluir mudança de função
app.delete('/api/mudanca-funcao/:id', (req, res) => {
    const { id } = req.params;
    
    const sql = `DELETE FROM MUDANCA_FUNCAO_PRESENCA WHERE id = ?`;
    
    db.run(sql, [id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        console.log(`🗑️ Mudança de função excluída: ID ${id}`);
        res.json({ success: true, message: 'Mudança de função excluída' });
    });
});

// ============ FIM ROTAS DE MUDANÇA DE FUNÇÃO ============

// POST - Exportar presença para Excel
app.post('/api/controle-presenca/exportar', async (req, res) => {
    verificarResetMes();
    
    console.log('🔵 EXPORTANDO PRESENÇA...');
    
    try {
        const { titulo } = req.body;
        
        // Buscar funcionários ativos + inativos que tiveram presença no mês
        const funcionarios = await new Promise((resolve, reject) => {
            // Primeiro buscar IDs que têm presença no mês
            db.all('SELECT DISTINCT funcionarioId FROM PRESENCA WHERE mesAno = ?', [presencaMesAtual], (err, presencaRows) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                const idsComPresenca = presencaRows.map(r => r.funcionarioId);
                
                let sql = `SELECT id, Nome, Empresa, Funcao, Situacao FROM SSMA WHERE Situacao = 'N'`;
                let params = [];
                
                // Se tem inativos com presença, incluir eles também
                if (idsComPresenca.length > 0) {
                    const placeholders = idsComPresenca.map(() => '?').join(',');
                    sql += ` OR (Situacao = 'S' AND id IN (${placeholders}))`;
                    params = idsComPresenca;
                }
                
                db.all(sql, params, (err, rows) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    // ⭐ ORDENAÇÃO: HOSS sempre primeiro
                    rows.sort((a, b) => {
                        if (a.Empresa === 'HOSS' && b.Empresa !== 'HOSS') return -1;
                        if (a.Empresa !== 'HOSS' && b.Empresa === 'HOSS') return 1;
                        if (a.Empresa === 'HOSS' && b.Empresa === 'HOSS') return a.Nome.localeCompare(b.Nome);
                        const empresaCompare = a.Empresa.localeCompare(b.Empresa);
                        if (empresaCompare !== 0) return empresaCompare;
                        return a.Nome.localeCompare(b.Nome);
                    });
                    resolve(rows);
                });
            });
        });
        
        console.log(`🔵 Total funcionários: ${funcionarios.length}`);
        
        // Buscar dados de presença do BANCO
        const dadosPresencaBanco = await new Promise((resolve, reject) => {
            db.all('SELECT funcionarioId, dia, status, comentario FROM PRESENCA WHERE mesAno = ?', [presencaMesAtual], (err, rows) => {
                if (err) reject(err);
                else {
                    const dados = {};
                    const comentarios = {};
                    rows.forEach(row => {
                        if (!dados[row.funcionarioId]) dados[row.funcionarioId] = {};
                        dados[row.funcionarioId][row.dia] = row.status || '';
                        if (row.comentario) {
                            const chave = `${row.funcionarioId}_${row.dia}`;
                            comentarios[chave] = { texto: row.comentario };
                        }
                    });
                    resolve({ dados, comentarios });
                }
            });
        });
        
        const dadosPresenca = dadosPresencaBanco.dados;
        const comentarios = dadosPresencaBanco.comentarios;
        
        console.log(`🔵 Dados de presença carregados`);

        
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Presença');
        
        const hoje = new Date();
        const mes = hoje.getMonth();
        const ano = hoje.getFullYear();
        const diasNoMes = new Date(ano, mes + 1, 0).getDate();
        const meses = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
        
        // Cabeçalho
        sheet.mergeCells(1, 1, 1, 4 + diasNoMes + 2);
        sheet.getCell(1, 1).value = titulo || 'CONTROLE DE PRESENÇA';
        sheet.getCell(1, 1).font = { bold: true, size: 14 };
        sheet.getCell(1, 1).alignment = { horizontal: 'center' };
        
        sheet.mergeCells(2, 1, 2, 4 + diasNoMes + 2);
        sheet.getCell(2, 1).value = `${meses[mes]} / ${ano}`;
        sheet.getCell(2, 1).font = { bold: true, size: 12 };
        sheet.getCell(2, 1).alignment = { horizontal: 'center' };
        
        // Cabeçalho das colunas
        const headerRow = sheet.getRow(4);
        headerRow.values = ['Empresa', 'Nome', 'Função', ...Array.from({length: diasNoMes}, (_, i) => i + 1), 'P', 'F'];
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1F7E3D' }
        };
        headerRow.alignment = { horizontal: 'center' };
        
        // Marcar fins de semana no cabeçalho
        for (let dia = 1; dia <= diasNoMes; dia++) {
            const data = new Date(ano, mes, dia);
            const diaSemana = data.getDay();
            if (diaSemana === 0 || diaSemana === 6) {
                sheet.getCell(4, 3 + dia).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFCCCCCC' }
                };
            }
        }
        
        // Separar ativos e inativos
        const ativos = funcionarios.filter(f => f.Situacao !== 'S');
        const inativos = funcionarios.filter(f => f.Situacao === 'S');
        const funcionariosOrdenados = [...ativos, ...inativos];
        
        let rowIndex = 5;
        
        // Dados dos funcionários
        for (const func of funcionariosOrdenados) {
            const row = sheet.getRow(rowIndex);
            const presencaFunc = dadosPresenca[func.id] || {};
            const isInativo = func.Situacao === 'S';
            
            row.getCell(1).value = func.Empresa || '';
            row.getCell(2).value = func.Nome || '';
            row.getCell(3).value = func.Funcao || '';
            
            let totalP = 0;
            let totalF = 0;
            
            for (let dia = 1; dia <= diasNoMes; dia++) {
                const valorExibir = presencaFunc[dia] || '';
                
                // Se o valor for "AZUL", não exibir texto, apenas aplicar cor de fundo
                const valorParaExibir = (valorExibir === 'AZUL') ? '' : valorExibir;
                
                row.getCell(3 + dia).value = valorParaExibir;
                row.getCell(3 + dia).alignment = { horizontal: 'center' };
                
                // Verificar comentário
                const chaveComentario = `${func.id}_${dia}`;
                if (comentarios[chaveComentario] && comentarios[chaveComentario].texto) {
                    row.getCell(3 + dia).note = {
                        texts: [{ text: comentarios[chaveComentario].texto }]
                    };
                    row.getCell(3 + dia).border = {
                        top: { style: 'medium', color: { argb: 'FFFF9800' } },
                        left: { style: 'medium', color: { argb: 'FFFF9800' } },
                        bottom: { style: 'medium', color: { argb: 'FFFF9800' } },
                        right: { style: 'medium', color: { argb: 'FFFF9800' } }
                    };
                }
                
                if (valorExibir === 'P') totalP++;
                if (valorExibir === 'F') totalF++;
                
                // Verificar se é fim de semana
                const data = new Date(ano, mes, dia);
                const diaSemana = data.getDay();
                const isFimDeSemana = (diaSemana === 0 || diaSemana === 6);
                
                // Limpar espaços do valor
                const valorLimpo = (valorExibir || '').trim();
                
                // Colorir baseado no status
                // Prioridade: inativo > status específico > AZUL/folga/ponto > fim de semana vazio
                if (isInativo) {
                    // Inativo sempre amarelo (sobrepõe tudo)
                    row.getCell(3 + dia).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF99' } };
                } else if (valorLimpo === 'P') {
                    // Presente - verde claro
                    row.getCell(3 + dia).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF90EE90' } };
                } else if (valorLimpo === 'F') {
                    // Falta - vermelho claro
                    row.getCell(3 + dia).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B6B' } };
                } else if (valorLimpo === 'FO') {
                    // Folga programada - amarelo
                    row.getCell(3 + dia).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
                } else if (valorLimpo === 'FE') {
                    // Férias - roxo
                    row.getCell(3 + dia).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBA55D3' } };
                } else if (valorLimpo === 'A') {
                    // Atestado - azul
                    row.getCell(3 + dia).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6495ED' } };
                } else if (valorLimpo === 'N') {
                    // Novo - dourado
                    row.getCell(3 + dia).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD700' } };
                } else if (valorLimpo === 'AZUL' || valorLimpo === '-' || valorLimpo === '.' || (valorLimpo === '' && isFimDeSemana)) {
                    // AZUL (folga digitada), hífen, ponto OU fim de semana vazio - azul médio
                    row.getCell(3 + dia).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB3E5FC' } };
                }
            }
            
            row.getCell(4 + diasNoMes).value = totalP;
            row.getCell(5 + diasNoMes).value = totalF;
            
            // Se é inativo, aplicar fundo amarelo nas colunas
            if (isInativo) {
                [1, 2, 3, 4 + diasNoMes, 5 + diasNoMes].forEach(col => {
                    row.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF99' } };
                });
            }
            
            rowIndex++;
        }
        
        // ============ RESUMO POR FUNÇÃO ============
        const resumoPorFuncao = {};
        for (const func of funcionarios) {
            const presencaFunc = dadosPresenca[func.id] || {};
            const funcaoKey = func.Funcao ? func.Funcao.normalize('NFC').trim() : '';
            if (!resumoPorFuncao[funcaoKey]) {
                resumoPorFuncao[funcaoKey] = {};
                for (let dia = 1; dia <= diasNoMes; dia++) {
                    resumoPorFuncao[funcaoKey][dia] = { P: 0, F: 0 };
                }
            }
            for (let dia = 1; dia <= diasNoMes; dia++) {
                const status = presencaFunc[dia] || '';
                if (status === 'P') resumoPorFuncao[funcaoKey][dia].P++;
                if (status === 'F') resumoPorFuncao[funcaoKey][dia].F++;
            }
        }
        
        rowIndex += 2;
        const headerResumo = sheet.getRow(rowIndex);
        headerResumo.values = ['FUNÇÃO', ...Array.from({length: diasNoMes}, (_, i) => i + 1), 'P', 'F'];
        headerResumo.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerResumo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F7E3D' } };
        headerResumo.alignment = { horizontal: 'center' };
        rowIndex++;
        
        const funcoes = Object.keys(resumoPorFuncao).sort();
        for (const funcao of funcoes) {
            const row = sheet.getRow(rowIndex);
            row.getCell(1).value = funcao;
            row.getCell(1).font = { bold: true };
            let totalP = 0, totalF = 0;
            for (let dia = 1; dia <= diasNoMes; dia++) {
                const dados = resumoPorFuncao[funcao][dia];
                row.getCell(1 + dia).value = dados.P;
                row.getCell(1 + dia).alignment = { horizontal: 'center' };
                row.getCell(1 + dia).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB3E5FC' } };
                totalP += dados.P;
                totalF += dados.F;
            }
            row.getCell(2 + diasNoMes).value = totalP;
            row.getCell(2 + diasNoMes).font = { bold: true };
            row.getCell(3 + diasNoMes).value = totalF;
            row.getCell(3 + diasNoMes).font = { bold: true };
            rowIndex++;
        }
        
        // Linha TOTAL da função
        const rowTotalFuncao = sheet.getRow(rowIndex);
        rowTotalFuncao.getCell(1).value = 'TOTAL';
        rowTotalFuncao.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        rowTotalFuncao.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
        let totalGeralPFuncao = 0, totalGeralFFuncao = 0;
        for (let dia = 1; dia <= diasNoMes; dia++) {
            let diaTotal = 0;
            for (const funcao of funcoes) diaTotal += resumoPorFuncao[funcao][dia].P;
            rowTotalFuncao.getCell(1 + dia).value = diaTotal;
            rowTotalFuncao.getCell(1 + dia).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            rowTotalFuncao.getCell(1 + dia).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
            rowTotalFuncao.getCell(1 + dia).alignment = { horizontal: 'center' };
            totalGeralPFuncao += diaTotal;
        }
        rowTotalFuncao.getCell(2 + diasNoMes).value = totalGeralPFuncao;
        rowTotalFuncao.getCell(2 + diasNoMes).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        rowTotalFuncao.getCell(2 + diasNoMes).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
        for (const funcao of funcoes) {
            for (let dia = 1; dia <= diasNoMes; dia++) totalGeralFFuncao += resumoPorFuncao[funcao][dia].F;
        }
        rowTotalFuncao.getCell(3 + diasNoMes).value = totalGeralFFuncao;
        rowTotalFuncao.getCell(3 + diasNoMes).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        rowTotalFuncao.getCell(3 + diasNoMes).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
        rowIndex++;
        
        // ============ RESUMO POR EMPRESA ============
        const resumoPorEmpresa = {};
        for (const func of funcionarios) {
            const presencaFunc = dadosPresenca[func.id] || {};
            if (!resumoPorEmpresa[func.Empresa]) {
                resumoPorEmpresa[func.Empresa] = {};
                for (let dia = 1; dia <= diasNoMes; dia++) {
                    resumoPorEmpresa[func.Empresa][dia] = { P: 0, F: 0 };
                }
            }
            for (let dia = 1; dia <= diasNoMes; dia++) {
                const status = presencaFunc[dia] || '';
                if (status === 'P') resumoPorEmpresa[func.Empresa][dia].P++;
                if (status === 'F') resumoPorEmpresa[func.Empresa][dia].F++;
            }
        }
        
        rowIndex += 2;
        const headerResumoEmpresa = sheet.getRow(rowIndex);
        headerResumoEmpresa.values = ['EMPRESA', ...Array.from({length: diasNoMes}, (_, i) => i + 1), 'P', 'F'];
        headerResumoEmpresa.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerResumoEmpresa.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F7E3D' } };
        headerResumoEmpresa.alignment = { horizontal: 'center' };
        rowIndex++;
        
        const empresas = Object.keys(resumoPorEmpresa).sort((a, b) => {
            if (a === 'HOSS' && b !== 'HOSS') return -1;
            if (a !== 'HOSS' && b === 'HOSS') return 1;
            return a.localeCompare(b);
        });
        
        for (const empresa of empresas) {
            const row = sheet.getRow(rowIndex);
            
            // Verificar se esta empresa tem apenas funcionários inativos
            const funcionariosDaEmpresa = funcionariosOrdenados.filter(f => f.Empresa === empresa);
            const temAtivos = funcionariosDaEmpresa.some(f => f.Situacao !== 'S');
            const corFundo = temAtivos ? 'FFB3E5FC' : 'FFFFFF99'; // Azul médio para ativos, amarelo para só inativos
            
            row.getCell(1).value = empresa;
            row.getCell(1).font = { bold: true };
            row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corFundo } };
            
            let totalP = 0, totalF = 0;
            for (let dia = 1; dia <= diasNoMes; dia++) {
                const dados = resumoPorEmpresa[empresa][dia];
                row.getCell(1 + dia).value = dados.P;
                row.getCell(1 + dia).alignment = { horizontal: 'center' };
                row.getCell(1 + dia).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corFundo } };
                totalP += dados.P;
                totalF += dados.F;
            }
            row.getCell(2 + diasNoMes).value = totalP;
            row.getCell(2 + diasNoMes).font = { bold: true };
            row.getCell(2 + diasNoMes).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corFundo } };
            row.getCell(3 + diasNoMes).value = totalF;
            row.getCell(3 + diasNoMes).font = { bold: true };
            row.getCell(3 + diasNoMes).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corFundo } };
            rowIndex++;
        }
        
        // Linha TOTAL da empresa
        const rowTotalEmpresa = sheet.getRow(rowIndex);
        rowTotalEmpresa.getCell(1).value = 'TOTAL';
        rowTotalEmpresa.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        rowTotalEmpresa.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
        let totalGeralPEmpresa = 0, totalGeralFEmpresa = 0;
        for (let dia = 1; dia <= diasNoMes; dia++) {
            let diaTotal = 0;
            for (const empresa of empresas) diaTotal += resumoPorEmpresa[empresa][dia].P;
            rowTotalEmpresa.getCell(1 + dia).value = diaTotal;
            rowTotalEmpresa.getCell(1 + dia).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            rowTotalEmpresa.getCell(1 + dia).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
            rowTotalEmpresa.getCell(1 + dia).alignment = { horizontal: 'center' };
            totalGeralPEmpresa += diaTotal;
        }
        rowTotalEmpresa.getCell(2 + diasNoMes).value = totalGeralPEmpresa;
        rowTotalEmpresa.getCell(2 + diasNoMes).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        rowTotalEmpresa.getCell(2 + diasNoMes).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
        for (const empresa of empresas) {
            for (let dia = 1; dia <= diasNoMes; dia++) totalGeralFEmpresa += resumoPorEmpresa[empresa][dia].F;
        }
        rowTotalEmpresa.getCell(3 + diasNoMes).value = totalGeralFEmpresa;
        rowTotalEmpresa.getCell(3 + diasNoMes).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        rowTotalEmpresa.getCell(3 + diasNoMes).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
// Ajustar larguras
        sheet.getColumn(1).width = 20;
        sheet.getColumn(2).width = 30;
        sheet.getColumn(3).width = 20;
        for (let i = 4; i <= 3 + diasNoMes; i++) sheet.getColumn(i).width = 4;
        
        const buffer = await workbook.xlsx.writeBuffer();
        
        console.log(`✅ Excel gerado! Tamanho: ${buffer.length} bytes`);
        
        // Nome do arquivo sem acentos e sem underscores problemáticos
        const mesesSemAcento = ['JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
        const nomeArquivo = `Presenca-${mesesSemAcento[mes]}-${ano}.xlsx`;
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${nomeArquivo}`);
        res.send(buffer);
        
    } catch (error) {
        console.error('❌ Erro ao exportar presença:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== ROTAS DE BACKUP E MANUTENÇÃO ====================

// Exportar backup completo
app.get('/api/backup/exportar', async (req, res) => {
    try {
        console.log('📤 Iniciando geração de backup completo...');
        
        const backup = {
            versao: '2.1',
            dataBackup: new Date().toISOString(),
            dados: {}
        };
        
        // Buscar todos os dados em paralelo para maior performance
        const [
            funcionarios,
            fornecedores,
            documentacao,
            configuracao,
            cursosHabilitados,
            configuracoesNR,
            presencaBanco,
            historicoPresenca,
            mudancasFuncao,
            empresasOcultas,
            auditLog
        ] = await Promise.all([
            db.all('SELECT * FROM SSMA'),
            db.all('SELECT * FROM FORNECEDOR'),
            db.all('SELECT * FROM DOCUMENTACAO'),
            db.get('SELECT * FROM configuracao_relatorio WHERE id = 1'),
            db.all('SELECT * FROM HABILITAR_CURSOS'),
            db.all('SELECT * FROM configuracao_nrs'),
            db.all('SELECT * FROM PRESENCA'),
            db.all('SELECT * FROM HISTORICO_PRESENCA'),
            db.all('SELECT * FROM MUDANCA_FUNCAO_PRESENCA'),
            db.all('SELECT * FROM EMPRESAS_OCULTAS'),
            db.all('SELECT * FROM AUDIT_LOG')
        ]);

        // CONVERTER FOTOS (BLOB) PARA BASE64
        backup.dados.funcionarios = (funcionarios || []).map(f => {
            const func = { ...f };
            if (func.Foto) {
                if (Buffer.isBuffer(func.Foto)) {
                    func.Foto = func.Foto.toString('base64');
                } else if (func.Foto.type === 'Buffer' && Array.isArray(func.Foto.data)) {
                    func.Foto = Buffer.from(func.Foto.data).toString('base64');
                }
            }
            return func;
        });
        
        backup.dados.fornecedores = fornecedores || [];
        backup.dados.documentacao = documentacao || [];
        backup.dados.configuracao = configuracao || {};
        backup.dados.cursosHabilitados = cursosHabilitados || [];
        backup.dados.configuracoesNR = configuracoesNR || [];
        backup.dados.presencaBanco = presencaBanco || [];
        backup.dados.historicoPresenca = historicoPresenca || [];
        backup.dados.mudancasFuncao = mudancasFuncao || [];
        backup.dados.empresasOcultas = empresasOcultas || [];
        backup.dados.auditLog = auditLog || [];
        
        // INCLUIR DADOS DE PRESENÇA EM MEMÓRIA
        backup.dados.presenca = {
            presencaMemoria: presencaMemoria,
            comentariosPresenca: comentariosPresenca,
            ocorrenciasPresenca: ocorrenciasPresenca,
            funcionariosOcultos: funcionariosOcultos,
            presencaMesAtual: presencaMesAtual
        };

        console.log('✅ Backup completo gerado com sucesso:', {
            funcionarios: backup.dados.funcionarios.length,
            fornecedores: backup.dados.fornecedores.length,
            documentacao: backup.dados.documentacao.length,
            presencaBanco: backup.dados.presencaBanco.length,
            historico: backup.dados.historicoPresenca.length
        });

        await registrarLog(req, 'Exportar Backup', `Exportou backup completo do sistema (${backup.dados.funcionarios.length} funcionários, ${backup.dados.fornecedores.length} fornecedores)`);
        
        res.json(backup);
    } catch (error) {
        console.error('❌ Erro ao gerar backup:', error);
        res.status(500).json({ error: 'Erro ao gerar backup: ' + error.message });
    }
});

// Restaurar backup - VERSÃO ROBUSTA PARA DB HÍBRIDO
app.post('/api/backup/restaurar', async (req, res) => {
    console.log('📥 Recebendo requisição de restauração...');
    const backup = req.body;
    
    if (!backup || !backup.dados) {
        return res.status(400).json({ success: false, error: 'Arquivo de backup inválido' });
    }
    
    let erros = [];
    let restaurados = { funcionarios: 0, fornecedores: 0, documentacao: 0, presenca: false };
    
    try {
        // Limpar tabelas de forma sequencial
        await db.run('DELETE FROM SSMA');
        await db.run('DELETE FROM FORNECEDOR');
        await db.run('DELETE FROM DOCUMENTACAO');
        
        if (DB_TYPE === 'sqlite') {
            try { await db.run("DELETE FROM sqlite_sequence WHERE name='SSMA'"); } catch(e) {}
            try { await db.run("DELETE FROM sqlite_sequence WHERE name='FORNECEDOR'"); } catch(e) {}
            try { await db.run("DELETE FROM sqlite_sequence WHERE name='DOCUMENTACAO'"); } catch(e) {}
        }
        
        console.log('✅ Tabelas limpas');
        
        // Colunas válidas da tabela SSMA (exclui colunas calculadas como temFoto)
        const COLUNAS_SSMA_VALIDAS = new Set([
            'id', 'Nome', 'Empresa', 'Funcao', 'Celular', 'CPF', 'DataEmissao', 'Vencimento', 'Anotacoes', 'Situacao', 'Ambientacao',
            'Nr06_DataEmissao', 'Nr06_Vencimento', 'Nr06_Status', 'Nr06_NumControle', 'Nr06_AnoControle', 'Nr06_Validade2Anos', 'Nr06_Validade8Meses',
            'Nr10_DataEmissao', 'Nr10_Vencimento', 'Nr10_Status', 'Nr10_NumControle', 'Nr10_AnoControle', 'Nr10_Validade2Anos', 'Nr10_Validade8Meses',
            'Nr11_DataEmissao', 'Nr11_Vencimento', 'Nr11_Status', 'Nr11_NumControle', 'Nr11_AnoControle', 'Nr11_Validade2Anos', 'Nr11_Validade8Meses',
            'Nr12_DataEmissao', 'Nr12_Vencimento', 'NR12_Vencimento', 'Nr12_Status', 'Nr12_Ferramenta', 'Nr12_NumControle', 'Nr12_AnoControle', 'Nr12_Validade2Anos', 'Nr12_Validade8Meses',
            'Nr17_DataEmissao', 'Nr17_Vencimento', 'Nr17_Status', 'Nr17_NumControle', 'Nr17_AnoControle', 'Nr17_Validade2Anos', 'Nr17_Validade8Meses',
            'Nr18_DataEmissao', 'Nr18_Vencimento', 'NR18_Vencimento', 'Nr18_Status', 'Nr18_NumControle', 'Nr18_AnoControle', 'Nr18_Validade2Anos', 'Nr18_Validade8Meses',
            'Nr20_DataEmissao', 'Nr20_Vencimento', 'Nr20_Status', 'Nr20_NumControle', 'Nr20_AnoControle', 'Nr20_Validade2Anos', 'Nr20_Validade8Meses',
            'Nr33_DataEmissao', 'Nr33_Vencimento', 'NR33_Vencimento', 'Nr33_Status', 'Nr33_DataFim', 'Nr33_NumControle', 'Nr33_AnoControle', 'Nr33_Validade2Anos', 'Nr33_Validade8Meses',
            'Nr34_DataEmissao', 'Nr34_Vencimento', 'Nr34_Status',
            'Nr35_DataEmissao', 'Nr35_Vencimento', 'NR35_Vencimento', 'Nr35_Status', 'Nr35_NumControle', 'Nr35_AnoControle', 'Nr35_Validade2Anos', 'Nr35_Validade8Meses',
            'Epi_DataEmissao', 'epiVencimento', 'EpiStatus', 'Epi_Validade8Meses',
            'Foto', 'Cadastro', 'DataInativacao', 'IgnorarInvalidez'
        ]);

        // Restaurar funcionários
        if (backup.dados.funcionarios && backup.dados.funcionarios.length > 0) {
            for (const f of backup.dados.funcionarios) {
                try {
                    const funcionario = {};
                    for (const [k, v] of Object.entries(f)) {
                        if (COLUNAS_SSMA_VALIDAS.has(k)) funcionario[k] = v;
                    }

                    // Converter foto de base64/Buffer para Buffer binário
                    if (funcionario.Foto) {
                        if (typeof funcionario.Foto === 'string') {
                            funcionario.Foto = Buffer.from(funcionario.Foto, 'base64');
                        } else if (funcionario.Foto.type === 'Buffer' && Array.isArray(funcionario.Foto.data)) {
                            funcionario.Foto = Buffer.from(funcionario.Foto.data);
                        }
                    }

                    const colunas = Object.keys(funcionario);
                    const valores = Object.values(funcionario);
                    const placeholders = colunas.map(() => '?').join(', ');
                    
                    await db.run(`INSERT INTO SSMA (${colunas.join(', ')}) VALUES (${placeholders})`, valores);
                    restaurados.funcionarios++;
                } catch (err) {
                    erros.push('Funcionário ' + f.Nome + ': ' + err.message);
                }
            }
        }
        
        // Restaurar fornecedores
        if (backup.dados.fornecedores && backup.dados.fornecedores.length > 0) {
            for (const f of backup.dados.fornecedores) {
                try {
                    const colunas = Object.keys(f);
                    const valores = Object.values(f);
                    const placeholders = colunas.map(() => '?').join(', ');
                    await db.run(`INSERT INTO FORNECEDOR (${colunas.join(', ')}) VALUES (${placeholders})`, valores);
                    restaurados.fornecedores++;
                } catch (err) {
                    erros.push('Fornecedor ' + f.Empresa + ': ' + err.message);
                }
            }
        }
        
        // Restaurar documentação
        if (backup.dados.documentacao && backup.dados.documentacao.length > 0) {
            for (const d of backup.dados.documentacao) {
                try {
                    const colunas = Object.keys(d);
                    const valores = Object.values(d);
                    const placeholders = colunas.map(() => '?').join(', ');
                    await db.run(`INSERT INTO DOCUMENTACAO (${colunas.join(', ')}) VALUES (${placeholders})`, valores);
                    restaurados.documentacao++;
                } catch (err) {
                    erros.push('Documentação ' + d.empresa + ': ' + err.message);
                }
            }
        }
        
        // Restaurar presença
        if (backup.dados.presenca) {
            presencaMemoria = backup.dados.presenca.presencaMemoria || {};
            comentariosPresenca = backup.dados.presenca.comentariosPresenca || {};
            ocorrenciasPresenca = backup.dados.presenca.ocorrenciasPresenca || {};
            funcionariosOcultos = backup.dados.presenca.funcionariosOcultos || {};
            presencaMesAtual = backup.dados.presenca.presencaMesAtual || getMesAnoAtual();
            salvarDadosPresenca();
            
            if (backup.dados.presencaBanco && backup.dados.presencaBanco.length > 0) {
                await db.run('DELETE FROM PRESENCA');
                for (const p of backup.dados.presencaBanco) {
                    const colunas = Object.keys(p);
                    const valores = Object.values(p);
                    const placeholders = colunas.map(() => '?').join(', ');
                    await db.run(`INSERT INTO PRESENCA (${colunas.join(', ')}) VALUES (${placeholders})`, valores);
                }
            }
            restaurados.presenca = true;
        }

        // Restaurar histórico de presença
        if (backup.dados.historicoPresenca && backup.dados.historicoPresenca.length > 0) {
            await db.run('DELETE FROM HISTORICO_PRESENCA');
            for (const h of backup.dados.historicoPresenca) {
                const colunas = Object.keys(h);
                const valores = Object.values(h);
                const placeholders = colunas.map(() => '?').join(', ');
                await db.run(`INSERT INTO HISTORICO_PRESENCA (${colunas.join(', ')}) VALUES (${placeholders})`, valores);
            }
        }

        // Restaurar mudanças de função
        if (backup.dados.mudancasFuncao && backup.dados.mudancasFuncao.length > 0) {
            await db.run('DELETE FROM MUDANCA_FUNCAO_PRESENCA');
            for (const m of backup.dados.mudancasFuncao) {
                const colunas = Object.keys(m);
                const valores = Object.values(m);
                const placeholders = colunas.map(() => '?').join(', ');
                await db.run(`INSERT INTO MUDANCA_FUNCAO_PRESENCA (${colunas.join(', ')}) VALUES (${placeholders})`, valores);
            }
        }

        // Restaurar empresas ocultas
        if (backup.dados.empresasOcultas && backup.dados.empresasOcultas.length > 0) {
            await db.run('DELETE FROM EMPRESAS_OCULTAS');
            for (const e of backup.dados.empresasOcultas) {
                const colunas = Object.keys(e);
                const valores = Object.values(e);
                const placeholders = colunas.map(() => '?').join(', ');
                await db.run(`INSERT INTO EMPRESAS_OCULTAS (${colunas.join(', ')}) VALUES (${placeholders})`, valores);
            }
        }

        // Restaurar audit log
        if (backup.dados.auditLog && backup.dados.auditLog.length > 0) {
            await db.run('DELETE FROM AUDIT_LOG');
            for (const a of backup.dados.auditLog) {
                const colunas = Object.keys(a);
                const valores = Object.values(a);
                const placeholders = colunas.map(() => '?').join(', ');
                await db.run(`INSERT INTO AUDIT_LOG (${colunas.join(', ')}) VALUES (${placeholders})`, valores);
            }
        }

        // Restaurar configurações de NRs
        if (backup.dados.configuracoesNR && backup.dados.configuracoesNR.length > 0) {
            for (const cfg of backup.dados.configuracoesNR) {
                try {
                    const sql = DB_TYPE === 'sqlite'
                        ? `INSERT INTO configuracao_nrs (nr, dados, dataAtualizacao) VALUES (?, ?, datetime('now', 'localtime')) 
                           ON CONFLICT(nr) DO UPDATE SET dados = excluded.dados, dataAtualizacao = datetime('now', 'localtime')`
                        : `INSERT INTO configuracao_nrs (nr, dados, dataAtualizacao) VALUES ($1, $2, CURRENT_TIMESTAMP) 
                           ON CONFLICT(nr) DO UPDATE SET dados = EXCLUDED.dados, dataAtualizacao = CURRENT_TIMESTAMP`;
                    await db.run(sql, [cfg.nr, cfg.dados]);
                } catch (err) {
                    erros.push('Configuração NR ' + cfg.nr + ': ' + err.message);
                }
            }
            restaurados.configuracoesNR = backup.dados.configuracoesNR.length;
        }
        
        res.json({ success: true, message: 'Backup restaurado com sucesso', restaurados, erros: erros.length > 0 ? erros : undefined });
        await registrarLog(req, 'Restaurar Backup', `Restaurou backup completo (${restaurados.funcionarios} funcionários, ${restaurados.fornecedores} fornecedores, ${restaurados.documentacao} documentações)`);
    } catch (err) {
        console.error('❌ Erro na restauração:', err);
        res.status(500).json({ success: false, error: 'Erro ao restaurar backup: ' + err.message });
    }
});

// Zerar funcionários
app.delete('/api/backup/zerar/funcionarios', async (req, res) => {
    try {
        await db.run('DELETE FROM SSMA');
        if (DB_TYPE === 'sqlite') await db.run("DELETE FROM sqlite_sequence WHERE name='SSMA'");
        await registrarLog(req, 'Zerar Funcionários', 'Zerou todos os registros de funcionários (SSMA)');
        res.json({ success: true, message: 'Funcionários zerados com sucesso' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Zerar fornecedores
app.delete('/api/backup/zerar/fornecedores', async (req, res) => {
    try {
        await db.run('DELETE FROM FORNECEDOR');
        if (DB_TYPE === 'sqlite') await db.run("DELETE FROM sqlite_sequence WHERE name='FORNECEDOR'");
        await registrarLog(req, 'Zerar Fornecedores', 'Zerou todos os registros de fornecedores');
        res.json({ success: true, message: 'Fornecedores zerados com sucesso' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Zerar documentação
app.delete('/api/backup/zerar/documentacao', async (req, res) => {
    try {
        await db.run('DELETE FROM DOCUMENTACAO');
        if (DB_TYPE === 'sqlite') await db.run("DELETE FROM sqlite_sequence WHERE name='DOCUMENTACAO'");
        await registrarLog(req, 'Zerar Documentação', 'Zerou todos os registros de documentação PGR/PCMSO');
        res.json({ success: true, message: 'Documentação zerada com sucesso' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Zerar lista de presença
app.delete('/api/backup/zerar/presenca', async (req, res) => {
    try {
        // Limpar dados em memória
        presencaMemoria = {};
        comentariosPresenca = {};
        funcionariosOcultos = {};
        presencaMesAtual = getMesAnoAtual();
        
        // Salvar arquivo vazio
        salvarDadosPresenca();
        
        console.log('✅ Lista de presença zerada com sucesso');
        await registrarLog(req, 'Zerar Presença', 'Zerou todos os dados de presença do mês atual');
        res.json({ success: true, message: 'Lista de presença zerada com sucesso' });
    } catch (err) {
        console.error('Erro ao zerar presença:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Corrigir funções duplicadas (normalizar para maiúsculo)
app.post('/api/backup/corrigir-funcoes', (req, res) => {
    console.log('🔧 Corrigindo funções duplicadas...');
    
    db.serialize(() => {
        // Atualizar todas as funções para maiúsculo
        db.run(`UPDATE SSMA SET Funcao = UPPER(TRIM(Funcao)) WHERE Funcao IS NOT NULL AND Funcao != ''`, function(err) {
            if (err) {
                console.error('❌ Erro ao corrigir funções:', err);
                return res.status(500).json({ success: false, error: err.message });
            }
            
            console.log(`✅ ${this.changes} funções corrigidas com sucesso`);
            res.json({ 
                success: true, 
                message: `${this.changes} funções normalizadas para maiúsculo`,
                changes: this.changes
            });
        });
    });
});

// GET - Alimentar a "Janela de Monitoramento de 30 Dias" (DESLIZANTE)
app.get('/api/tabela-mes/monitoramento', async (req, res) => {
    await verificarResetMes();

    // Feriados brasileiros de 2026
    const feriados = ['01-01', '02-16', '02-17', '04-21', '05-01', '09-07', '10-12', '11-02', '11-20', '12-25'];

    // Função para gerar nomes dos meses em português
    const getNomeMes = (mesNum) => {
        const meses = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
                        'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
        return meses[mesNum - 1];
    };

    // Calcular a janela DESLIZANTE de 31 dias (hoje - 30 dias até hoje)
    const hoje = new Date();
    const dataInicio = new Date();
    dataInicio.setDate(hoje.getDate() - 30); // Volta 30 dias para ter 31 dias totais

    console.log(`📅 Janela Deslizante de 31 dias: ${dataInicio.toLocaleDateString('pt-BR')} a ${hoje.toLocaleDateString('pt-BR')}`);

    // Gerar as 31 datas da janela deslizante
    const datasJanela = [];
    const mesesParaBuscar = new Set();

    for (let i = 0; i < 31; i++) {
        const dataRef = new Date(dataInicio);
        dataRef.setDate(dataInicio.getDate() + i);

        const dia = dataRef.getDate();
        const mesNum = dataRef.getMonth() + 1;
        const anoNum = dataRef.getFullYear();
        const mesStr = String(mesNum).padStart(2, '0');
        const diaStr = String(dia).padStart(2, '0');

        const diaSemana = dataRef.getDay();
        const dataFeriadoStr = `${diaStr}-${mesStr}`;
        const mesAnoStr = `${mesStr}-${anoNum}`;

        const isFimDeSemana = diaSemana === 0 || diaSemana === 6;
        const isFeriado = feriados.includes(dataFeriadoStr);
        const isDescanso = isFimDeSemana || isFeriado;

        datasJanela.push({
            dia: dia,
            mesNome: getNomeMes(mesNum),
            mesAno: mesAnoStr,
            isFimDeSemana: isFimDeSemana,
            isFeriado: isFeriado,
            isDescanso: isDescanso,
            dataFormatada: `${diaStr}/${mesStr}`
        });

        mesesParaBuscar.add(mesAnoStr);
    }

    console.log(`📊 Total de datas na janela: ${datasJanela.length}`);
    console.log(`📊 Meses na janela: ${Array.from(mesesParaBuscar).join(', ')}`);

    const mesesLista = Array.from(mesesParaBuscar).map(m => `'${m}'`).join(',');

    try {
        const [funcaoRows, todasFuncoesRows, empresaRows, todasEmpresasRows] = await Promise.all([
            db.all(`SELECT p.mesAno, p.funcionarioFuncao as funcao, p.dia, SUM(CASE WHEN p.status = 'P' THEN 1 ELSE 0 END) as totalPresenca, SUM(CASE WHEN p.status = 'F' THEN 1 ELSE 0 END) as totalFalta FROM PRESENCA p WHERE p.mesAno IN (${mesesLista}) GROUP BY p.mesAno, p.funcionarioFuncao, p.dia`),
            db.all(`SELECT DISTINCT funcionarioFuncao as funcao FROM PRESENCA WHERE mesAno IN (${mesesLista}) ORDER BY funcionarioFuncao`),
            db.all(`SELECT p.mesAno, p.funcionarioEmpresa as empresa, p.dia, SUM(CASE WHEN p.status = 'P' THEN 1 ELSE 0 END) as totalPresenca, SUM(CASE WHEN p.status = 'F' THEN 1 ELSE 0 END) as totalFalta FROM PRESENCA p WHERE p.mesAno IN (${mesesLista}) AND p.funcionarioEmpresa NOT IN (SELECT empresaOculta FROM EMPRESAS_OCULTAS) GROUP BY p.mesAno, p.funcionarioEmpresa, p.dia`),
            db.all(`SELECT DISTINCT funcionarioEmpresa as empresa FROM PRESENCA WHERE mesAno IN (${mesesLista}) AND funcionarioEmpresa NOT IN (SELECT empresaOculta FROM EMPRESAS_OCULTAS) ORDER BY funcionarioEmpresa`)
        ]);

        const mapaIndice = {};
        datasJanela.forEach((dt, idx) => { mapaIndice[`${dt.mesAno}-${dt.dia}`] = idx; });

        const funcaoPorDia = {};
        const faltasPorFuncaoPorDia = {};
        const funcoesUnicas = new Set();
        const totalPorDiaFuncao = Array(31).fill(0);

        todasFuncoesRows.forEach(row => {
            if (row.funcao) {
                funcoesUnicas.add(row.funcao);
                funcaoPorDia[row.funcao] = Array(31).fill(0);
                faltasPorFuncaoPorDia[row.funcao] = Array(31).fill(0);
            }
        });

        funcaoRows.forEach(row => {
            if (!funcaoPorDia[row.funcao]) {
                funcaoPorDia[row.funcao] = Array(31).fill(0);
                faltasPorFuncaoPorDia[row.funcao] = Array(31).fill(0);
            }
            const idx = mapaIndice[`${row.mesAno}-${row.dia}`];
            if (idx !== undefined) {
                funcaoPorDia[row.funcao][idx] = row.totalPresenca;
                faltasPorFuncaoPorDia[row.funcao][idx] = row.totalFalta;
                totalPorDiaFuncao[idx] += row.totalPresenca;
            }
        });

        const empresaPorDia = {};
        const faltasPorEmpresaPorDia = {};
        const empresasUnicas = new Set();
        const totalPorDiaEmpresa = Array(31).fill(0);

        todasEmpresasRows.forEach(row => {
            if (row.empresa) {
                empresasUnicas.add(row.empresa);
                empresaPorDia[row.empresa] = Array(31).fill(0);
                faltasPorEmpresaPorDia[row.empresa] = Array(31).fill(0);
            }
        });

        empresaRows.forEach(row => {
            if (!empresaPorDia[row.empresa]) {
                empresaPorDia[row.empresa] = Array(31).fill(0);
                faltasPorEmpresaPorDia[row.empresa] = Array(31).fill(0);
            }
            const idx = mapaIndice[`${row.mesAno}-${row.dia}`];
            if (idx !== undefined) {
                empresaPorDia[row.empresa][idx] = row.totalPresenca;
                faltasPorEmpresaPorDia[row.empresa][idx] = row.totalFalta;
                totalPorDiaEmpresa[idx] += row.totalPresenca;
            }
        });

        res.json({
            datas: datasJanela,
            funcaoPorDia,
            empresaPorDia,
            faltasPorFuncaoPorDia,
            faltasPorEmpresaPorDia,
            funcoesUnicas: Array.from(funcoesUnicas).sort(),
            empresasUnicas: Array.from(empresasUnicas).sort(),
            totalPorDiaFuncao,
            totalPorDiaEmpresa,
            totalDias: 31,
            janelaInicio: dataInicio.toLocaleDateString('pt-BR'),
            janelaFim: hoje.toLocaleDateString('pt-BR'),
            dataInicio,
            dataFim: hoje,
            timestamp: Date.now()
        });
    } catch (err) {
        console.error('❌ Erro no monitoramento:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET - Endpoint para verificar se há atualizações (para polling do frontend)
app.get('/api/tabela-mes/check-updates', (req, res) => {
    const ultimaVerificacao = req.query.lastCheck ? parseInt(req.query.lastCheck) : 0;
    const agora = new Date().getTime();
    
    // Se passou mais de 5 segundos, retornar que há atualizações
    if (agora - ultimaVerificacao > 5000) {
        res.json({ hasUpdates: true, timestamp: agora });
    } else {
        res.json({ hasUpdates: false, timestamp: agora });
    }
});

// Iniciar servidor (0.0.0.0 permite conexões de qualquer IP na rede)
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 SysControle Web rodando em http://localhost:${PORT}`);
    console.log(`📊 Sistema idêntico ao desktop, mas na web!`);
    console.log(`🌐 Acesso na rede: http://SEU_IP:${PORT}`);
    
    // VERIFICAR SE MUDOU DE MÊS AO INICIAR O SERVIDOR
    console.log(`\n🔍 Verificando mudança de mês...`);
    await verificarResetMes();
});

// Graceful shutdown consolidado
process.on('SIGINT', () => {
    console.log('\n💾 Encerrando servidor com segurança...');
    console.log('💾 Salvando dados de presença...');
    salvarDadosPresenca();
    
    db.close((err) => {
        if (err) {
            console.error('❌ Erro ao fechar banco:', err.message);
        } else {
            console.log('✅ Conexão com banco fechada.');
        }
        process.exit(0);
    });
});


// ROTAS PARA TABELAS AUXILIARES (Dropdowns)

// GET - Listar nomes únicos
app.get('/api/nomes', async (req, res) => {
    try {
        const rows = await db.all('SELECT DISTINCT Nome FROM SSMA WHERE Nome IS NOT NULL AND Nome != "" ORDER BY Nome');
        res.json(rows.map(row => row.Nome));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET - Listar empresas únicas
app.get('/api/empresas', async (req, res) => {
    try {
        const rows = await db.all('SELECT DISTINCT Empresa FROM FORNECEDOR WHERE Situacao = "S" AND Empresa IS NOT NULL AND Empresa != "" ORDER BY Empresa');
        res.json(rows.map(row => row.Empresa));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET - Listar funções únicas
app.get('/api/funcoes', async (req, res) => {
    try {
        const rows = await db.all('SELECT DISTINCT Funcao FROM SSMA WHERE Funcao IS NOT NULL AND Funcao != "" ORDER BY Funcao');
        res.json(rows.map(row => row.Funcao));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


