// ⚠️⚠️⚠️ NÃO MEXER NO CÓDIGO SEM PEDIR PERMISSÃO AO ADMINISTRATOR ⚠️⚠️⚠️
// ⚠️⚠️⚠️ NÃO MEXER NO CÓDIGO SEM PEDIR PERMISSÃO AO ADMINISTRATOR ⚠️⚠️⚠️
// ⚠️⚠️⚠️ NÃO MEXER NO CÓDIGO SEM PEDIR PERMISSÃO AO ADMINISTRATOR ⚠️⚠️⚠️

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar middlewares
app.use(cors());
app.use(express.json({ limit: '300mb' })); // Aumentar limite para aceitar backups grandes com fotos
app.use(express.urlencoded({ limit: '300mb', extended: true }));

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

// Carregar dados ao iniciar o servidor
carregarDadosPresenca();

// Salvar dados periodicamente (a cada 30 segundos)
setInterval(salvarDadosPresenca, 30000);

// Salvar dados ao encerrar o servidor
process.on('SIGINT', () => {
    console.log('💾 Salvando dados de presença antes de encerrar...');
    salvarDadosPresenca();
    process.exit(0);
});

function getMesAnoAtual() {
    const hoje = new Date();
    return `${String(hoje.getMonth() + 1).padStart(2, '0')}-${hoje.getFullYear()}`;
}

function getUltimoDiaDoMes(ano, mes) {
    return new Date(ano, mes, 0).getDate();
}

async function verificarResetMes() {
    const mesAnoAtual = getMesAnoAtual();
    if (presencaMesAtual !== mesAnoAtual && presencaMesAtual) {
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
                        func.Funcao,
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

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
        res.json({ 
            success: true, 
            user: { 
                id: usuario.id, 
                login: usuario.login, 
                nome: usuario.nome, 
                tipo: usuario.tipo 
            } 
        });
    } else {
        res.json({ success: false, message: 'Login ou senha incorretos' });
    }
});

// Verificar sessão
app.get('/api/auth/check', (req, res) => {
    res.json({ success: true });
});

// Listar usuários (só master)
app.get('/api/usuarios', (req, res) => {
    const lista = usuariosData.usuarios.map(u => ({
        id: u.id,
        login: u.login,
        nome: u.nome,
        tipo: u.tipo,
        ativo: u.ativo
    }));
    res.json({ success: true, data: lista });
});

// Criar usuário (só master)
app.post('/api/usuarios', (req, res) => {
    const { login, senha, nome, tipo } = req.body;
    
    if (!login || !senha || !nome) {
        return res.json({ success: false, message: 'Preencha todos os campos' });
    }
    
    const existe = usuariosData.usuarios.find(u => u.login.toLowerCase() === login.toLowerCase());
    if (existe) {
        return res.json({ success: false, message: 'Login já existe' });
    }
    
    const novoId = Math.max(...usuariosData.usuarios.map(u => u.id), 0) + 1;
    usuariosData.usuarios.push({
        id: novoId,
        login: login,
        senha: senha,
        nome: nome,
        tipo: tipo || 'comum',
        ativo: true
    });
    
    salvarUsuarios(usuariosData);
    res.json({ success: true, message: 'Usuário criado com sucesso' });
});

// Atualizar usuário (só master)
app.put('/api/usuarios/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const { login, senha, nome, tipo, ativo } = req.body;
    
    const usuario = usuariosData.usuarios.find(u => u.id === id);
    if (!usuario) {
        return res.json({ success: false, message: 'Usuário não encontrado' });
    }
    
    if (login) usuario.login = login;
    if (senha) usuario.senha = senha;
    if (nome) usuario.nome = nome;
    if (tipo) usuario.tipo = tipo;
    if (ativo !== undefined) usuario.ativo = ativo;
    
    salvarUsuarios(usuariosData);
    res.json({ success: true, message: 'Usuário atualizado' });
});

// Excluir usuário (só master)
app.delete('/api/usuarios/:id', (req, res) => {
    const id = parseInt(req.params.id);
    
    if (id === 1) {
        return res.json({ success: false, message: 'Não é possível excluir o usuário master principal' });
    }
    
    usuariosData.usuarios = usuariosData.usuarios.filter(u => u.id !== id);
    salvarUsuarios(usuariosData);
    res.json({ success: true, message: 'Usuário excluído' });
});

// ==================== ROTAS DE RASTREAMENTO ====================

// POST - Registrar entrada no sistema
app.post('/api/rastreamento/entrada', (req, res) => {
    const { usuario, ip, navegador, sistemaOperacional } = req.body;
    
    const sql = `
        INSERT INTO RASTREAMENTO_ACESSOS (usuario, ip, navegador, sistemaOperacional, status, dataHoraEntrada, lastHeartbeat)
        VALUES (?, ?, ?, ?, 'online', datetime('now', 'localtime'), datetime('now', 'localtime'))
    `;
    
    db.run(sql, [usuario, ip, navegador, sistemaOperacional], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        console.log(`✅ Entrada registrada: ${usuario} (ID: ${this.lastID})`);
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
    
    db.run(sql, [id], (err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
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
    
    db.run(sql, [id], (err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        console.log(`💓 Heartbeat recebido do ID ${id}`);
        res.json({ success: true });
    });
});

// POST - Registrar saída (alternativa para sendBeacon)
app.post('/api/rastreamento/saida/:id', (req, res) => {
    const { id } = req.params;
    
    const sql = `
        UPDATE RASTREAMENTO_ACESSOS 
        SET dataHoraSaida = CURRENT_TIMESTAMP, status = 'ausente'
        WHERE id = ?
    `;
    
    db.run(sql, [id], (err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true });
    });
});

// GET - Listar acessos online (tempo real)
app.get('/api/rastreamento/online', (req, res) => {
    const sql = `
        SELECT * FROM RASTREAMENTO_ACESSOS 
        WHERE status = 'online'
        ORDER BY dataHoraEntrada DESC
    `;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ data: rows || [] });
    });
});

// GET - Listar histórico completo de acessos
app.get('/api/rastreamento/historico', (req, res) => {
    const { dataInicio, dataFim, usuario } = req.query;
    
    let sql = `SELECT * FROM RASTREAMENTO_ACESSOS WHERE 1=1`;
    let params = [];
    
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
    
    db.all(sql, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ data: rows || [] });
    });
});

// PUT - Marcar todos como ausente (limpeza)
app.put('/api/rastreamento/limpar-online', (req, res) => {
    const sql = `
        UPDATE RASTREAMENTO_ACESSOS 
        SET status = 'ausente', dataHoraSaida = CURRENT_TIMESTAMP
        WHERE status = 'online' AND dataHoraSaida IS NULL
    `;
    
    db.run(sql, [], (err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true });
    });
});

// DELETE - Limpar TODO o histórico de rastreamento
app.delete('/api/rastreamento/limpar-tudo', (req, res) => {
    const sql = `DELETE FROM RASTREAMENTO_ACESSOS`;
    
    db.run(sql, [], (err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        console.log('🗑️ Histórico de rastreamento limpo!');
        res.json({ success: true, message: 'Histórico limpo com sucesso' });
    });
});

// Limpeza automática: marcar como ausente acessos online há mais de 1 minuto sem heartbeat
const limparAcessosAntigos = () => {
    const sql = `
        UPDATE RASTREAMENTO_ACESSOS 
        SET status = 'ausente', dataHoraSaida = datetime('now', 'localtime')
        WHERE status = 'online' 
        AND dataHoraSaida IS NULL
        AND (julianday(datetime('now', 'localtime')) - julianday(lastHeartbeat)) * 24 * 60 > 1
    `;
    
    db.run(sql, [], function(err) {
        if (err) {
            console.error('❌ Erro na limpeza automática:', err);
        } else if (this.changes > 0) {
            console.log(`🧹 Limpeza automática: ${this.changes} usuário(s) marcado(s) como ausente`);
        }
    });
};

// Executar limpeza ao iniciar (MOVIDO PARA DEPOIS DA INICIALIZAÇÃO DO BANCO)
// limparAcessosAntigos();

// Executar limpeza a cada 10 segundos (mais rápido e preciso) (MOVIDO PARA DEPOIS DA INICIALIZAÇÃO DO BANCO)
// setInterval(limparAcessosAntigos, 10 * 1000);

// Redirecionar para login se não autenticado
app.get('/', (req, res, next) => {
    // Deixar o frontend verificar a sessão
    next();
});

// Middleware para adicionar headers de cache para arquivos estáticos
app.use((req, res, next) => {
    // Para arquivos JavaScript, CSS e HTML - não cachear
    if (req.path.endsWith('.js') || req.path.endsWith('.css') || req.path.endsWith('.html')) {
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
    }
    next();
});

app.use(express.static('public'));

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

// Conectar ao banco SQLite
const db = new sqlite3.Database('./syscontrole.db', (err) => {
    if (err) {
        console.error('Erro ao conectar com o banco:', err.message);
    } else {
        console.log('Conectado ao banco SQLite');
        initDatabase();
    }
});

// Inicializar tabelas
function initDatabase() {
    db.serialize(() => {
        // Criar tabela SSMA
        db.run(`
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
                Nr12_Vencimento TEXT,
                Nr12_Status TEXT,
                Nr12_Ferramenta TEXT,
                Nr17_DataEmissao TEXT,
                Nr17_Vencimento TEXT,
                Nr17_Status TEXT,
                Nr18_DataEmissao TEXT,
                Nr18_Vencimento TEXT,
                Nr18_Status TEXT,
                Nr20_DataEmissao TEXT,
                Nr20_Vencimento TEXT,
                Nr20_Status TEXT,
                Nr33_DataEmissao TEXT,
                Nr33_Vencimento TEXT,
                Nr33_Status TEXT,
                Nr34_DataEmissao TEXT,
                Nr34_Vencimento TEXT,
                Nr34_Status TEXT,
                Nr35_DataEmissao TEXT,
                Nr35_Vencimento TEXT,
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
            logo TEXT DEFAULT '/Logo-Hoss.jpg'
        )
    `);
    
    // Adicionar coluna logo se não existir
    db.run(`ALTER TABLE configuracao_relatorio ADD COLUMN logo TEXT DEFAULT '/Logo-Hoss.jpg'`, (err) => {
        // Ignora erro se coluna já existe
    });
    
    // Adicionar coluna DataEmissao do ASO se não existir
    db.run(`ALTER TABLE SSMA ADD COLUMN DataEmissao TEXT`, (err) => {
        // Ignora erro se coluna já existe
    });
    
    // Adicionar coluna Celular se não existir
    db.run(`ALTER TABLE SSMA ADD COLUMN Celular TEXT`, (err) => {
        // Ignora erro se coluna já existe
    });
    
    // Adicionar coluna CPF se não existir
    db.run(`ALTER TABLE SSMA ADD COLUMN CPF TEXT`, (err) => {
        // Ignora erro se coluna já existe
    });
    
    // Adicionar coluna Nr12_Ferramenta se não existir
    db.run(`ALTER TABLE SSMA ADD COLUMN Nr12_Ferramenta TEXT`, (err) => {
        // Ignora erro se coluna já existe
    });
    
    // Adicionar coluna DataInativacao se não existir
    db.run(`ALTER TABLE SSMA ADD COLUMN DataInativacao DATETIME`, (err) => {
        // Ignora erro se coluna já existe
    });
    
    // Inserir configuração padrão se não existir
    db.get('SELECT COUNT(*) as count FROM configuracao_relatorio', (err, row) => {
        if (!err && row && row.count === 0) {
            db.run(`INSERT INTO configuracao_relatorio (titulo, rodape, logo) VALUES (?, ?, ?)`, 
                ['Relatório de Cursos', 'SSMA', '/Logo-Hoss.jpg']);
        }
    });
        // Criar tabela HABILITAR_CURSOS
        db.run(`
            CREATE TABLE IF NOT EXISTS HABILITAR_CURSOS (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                curso TEXT NOT NULL,
                habilitado INTEGER DEFAULT 1
            )
        `);
        
        // Inserir cursos padrão se não existir
        db.get('SELECT COUNT(*) as count FROM HABILITAR_CURSOS', (err, row) => {
            if (!err && row && row.count === 0) {
                const cursos = ['ASO', 'NR-06', 'NR-10', 'NR-11', 'NR-12', 'NR-17', 'NR-18', 'NR-20', 'NR-33', 'NR-34', 'NR-35', 'EPI'];
                cursos.forEach(curso => {
                    db.run(`INSERT INTO HABILITAR_CURSOS (curso, habilitado) VALUES (?, 1)`, [curso]);
                });
                console.log('✅ Cursos padrão inseridos na tabela HABILITAR_CURSOS');
            }
        });
        
        // Criar tabela RASTREAMENTO_ACESSOS
        db.run(`
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
        db.run(`
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
        // Registra quando um funcionário muda de função durante o mês
        db.run(`
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
        // Armazena empresas que devem ser ocultadas na tabela-mes
        db.run(`
            CREATE TABLE IF NOT EXISTS EMPRESAS_OCULTAS (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                empresaOculta TEXT NOT NULL UNIQUE,
                dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log('Tabelas criadas/verificadas com sucesso');
        
        // Criar índices
        db.run(`CREATE INDEX IF NOT EXISTS idx_ssma_situacao ON SSMA(Situacao)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_ssma_empresa ON SSMA(Empresa)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_ssma_nome ON SSMA(Nome)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_ssma_funcao ON SSMA(Funcao)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_ssma_empresa_nome ON SSMA(Empresa, Nome)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_fornecedor_situacao ON FORNECEDOR(Situacao)`);
        console.log('⚡ Índices de performance criados/verificados');
        
        // Verificar registros padrão
        verificarRegistrosPadraoSSMA();
        verificarFornecedorPadrao();
        
        // Iniciar limpeza automática
        console.log('🧹 Iniciando limpeza automática de rastreamento...');
        limparAcessosAntigos();
        setInterval(limparAcessosAntigos, 10 * 1000);
    });
}

function verificarRegistrosPadraoSSMA() {
    // Garantir que existe pelo menos um registro
    db.get('SELECT COUNT(*) as count FROM SSMA', (err, row) => {
        if (err) {
            console.log('Erro ao verificar registros:', err.message);
        } else if (row.count === 0) {
            // Inserir registro padrão se não existir nenhum
            db.run(`INSERT INTO SSMA (
                Nome, Empresa, Funcao, Vencimento, Nr10_Vencimento, 
                Situacao, Anotacoes, Ambientacao, Nr10_DataEmissao
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                'Ervanio Freitas Rodrigues',
                'Hoss',
                'Técnico de Segurança',
                '2026-12-08',
                '2027-12-09',
                'S',
                'teste',
                'S',
                '09/12/2025'
            ], (err) => {
                if (err) {
                    console.log('Erro ao inserir registro padrão:', err.message);
                } else {
                    console.log('Registro padrão inserido');
                }
            });
        } else {
            // Corrigir dados corrompidos se existirem
            db.run(`UPDATE SSMA SET 
                Nome = 'Ervanio Freitas Rodrigues',
                Empresa = 'Hoss', 
                Funcao = 'Técnico de Segurança',
                Anotacoes = 'teste'
                WHERE id = 1 AND Nome = '[object Object]'`, (err) => {
                if (err) {
                    console.log('Erro ao corrigir dados:', err.message);
                } else {
                    console.log('Dados corrompidos corrigidos');
                }
            });
        }
    });
}

// Verificar e inserir fornecedor padrão
function verificarFornecedorPadrao() {
    db.get('SELECT COUNT(*) as count FROM FORNECEDOR', (err, row) => {
        if (err) {
            console.log('Erro ao verificar fornecedores:', err.message);
        } else if (row.count === 0) {
            // Inserir fornecedor padrão se não existir nenhum
            db.run(`INSERT INTO FORNECEDOR (
                Empresa, CNPJ, Telefone, Celular, Contato, Observacao, Situacao
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
                'Hoss',
                '00.000.000/0000-00',
                '(11) 2554-3998',
                '(11) 94576-6912',
                'Ervanio Freitas Rodrigues',
                'Suporte de TI',
                'S'
            ], (err) => {
                if (err) {
                    console.log('Erro ao inserir fornecedor padrão:', err.message);
                } else {
                    console.log('Fornecedor padrão inserido');
                }
            });
        }
    });
}

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
app.get('/api/ssma/check-cpf', (req, res) => {
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
    
    db.get(sql, params, (err, row) => {
        if (err) {
            console.error('Erro ao verificar CPF:', err);
            return res.status(500).json({ error: 'Erro ao verificar CPF' });
        }
        
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
    });
});

// GET - Listar todos os registros SSMA com filtros
app.get('/api/ssma', (req, res) => {
    const { nome, empresa, funcao, situacao, page = 1, limit = 10,
            statusASO, statusNR06, statusNR10, statusNR11, statusNR12, 
            statusNR17, statusNR18, statusNR20, statusNR33, statusNR34, 
            statusNR35, statusEPI, dataInicio, dataFim } = req.query;
    
    // Função para remover acentos
    const removerAcentos = (texto) => {
        if (!texto) return '';
        return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    };
    
    // Log COMPLETO para debug
    console.log(`📨 /api/ssma - situacao=${situacao}, dataInicio=${dataInicio}, dataFim=${dataFim}`);
    
    // OTIMIZADO: Não carregar coluna Foto na listagem (muito pesada)
    let baseSql = `SELECT id, Nome, Empresa, Funcao, Vencimento, Situacao, Anotacoes, Ambientacao, Cadastro,
        Nr06_DataEmissao, Nr06_Vencimento, Nr06_Status,
        Nr10_DataEmissao, Nr10_Vencimento, Nr10_Status,
        Nr11_DataEmissao, Nr11_Vencimento, Nr11_Status,
        Nr12_DataEmissao, NR12_Vencimento, Nr12_Status,
        Nr17_DataEmissao, Nr17_Vencimento, Nr17_Status,
        Nr18_DataEmissao, NR18_Vencimento, Nr18_Status,
        Nr20_DataEmissao, Nr20_Vencimento, Nr20_Status,
        Nr33_DataEmissao, NR33_Vencimento, Nr33_Status,
        Nr34_DataEmissao, Nr34_Vencimento, Nr34_Status,
        Nr35_DataEmissao, NR35_Vencimento, Nr35_Status,
        Epi_DataEmissao, epiVencimento, EpiStatus,
        CASE WHEN Foto IS NOT NULL THEN 1 ELSE 0 END as temFoto
        FROM SSMA WHERE 1=1`;
    let baseParams = [];
    
    // Filtros básicos - REMOVENDO ACENTOS para busca
    const nomeSemAcento = removerAcentos(nome);
    const empresaSemAcento = removerAcentos(empresa);
    const funcaoSemAcento = removerAcentos(funcao);
    
    // Não usar LIKE no SQL, vamos filtrar no JavaScript depois
    
    if (situacao) {
        baseSql += ' AND Situacao = ?';
        baseParams.push(situacao);
    }
    
    // Filtro por data de cadastro
    if (dataInicio) {
        baseSql += ' AND date(Cadastro) >= date(?)';
        baseParams.push(dataInicio);
    }
    if (dataFim) {
        baseSql += ' AND date(Cadastro) <= date(?)';
        baseParams.push(dataFim);
    }
    
    baseSql += ' ORDER BY Empresa, Nome';
    
    console.log('🔍 SQL:', baseSql);
    console.log('🔍 Params:', baseParams);
    
    db.all(baseSql, baseParams, (err, allRows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        // Filtrar por nome, empresa, função SEM ACENTOS
        let filteredRows = allRows;
        
        if (nomeSemAcento) {
            filteredRows = filteredRows.filter(row => 
                removerAcentos(row.Nome).includes(nomeSemAcento)
            );
        }
        
        if (empresaSemAcento) {
            filteredRows = filteredRows.filter(row => 
                removerAcentos(row.Empresa).includes(empresaSemAcento)
            );
        }
        
        if (funcaoSemAcento) {
            filteredRows = filteredRows.filter(row => 
                removerAcentos(row.Funcao).includes(funcaoSemAcento)
            );
        }
        
        // Função para verificar status de uma data
        const getStatus = (dataStr) => {
            if (!dataStr) return 'NaoInformado';
            const hoje = new Date();
            const data = new Date(dataStr);
            const diffDays = Math.ceil((data - hoje) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) return 'Vencido';
            if (diffDays <= 30) return 'Renovar';
            return 'OK';
        };
        
        // Filtrar por nome, empresa, função SEM ACENTOS (já feito acima)
        // Agora filtrar por status de cursos se especificado
        
        if (statusASO) {
            filteredRows = filteredRows.filter(row => {
                const status = getStatus(row.Vencimento);
                if (statusASO === 'vencido') return status === 'Vencido';
                if (statusASO === 'renovar') return status === 'Renovar';
                if (statusASO === 'ok') return status === 'OK';
                return true;
            });
        }
        
        if (statusNR06) {
            filteredRows = filteredRows.filter(row => {
                const status = getStatus(row.Nr06_Vencimento);
                if (statusNR06 === 'vencido') return status === 'Vencido';
                if (statusNR06 === 'renovar') return status === 'Renovar';
                if (statusNR06 === 'ok') return status === 'OK';
                return true;
            });
        }
        
        if (statusNR10) {
            filteredRows = filteredRows.filter(row => {
                const status = getStatus(row.Nr10_Vencimento);
                if (statusNR10 === 'vencido') return status === 'Vencido';
                if (statusNR10 === 'renovar') return status === 'Renovar';
                if (statusNR10 === 'ok') return status === 'OK';
                return true;
            });
        }
        
        if (statusNR11) {
            filteredRows = filteredRows.filter(row => {
                const status = getStatus(row.Nr11_Vencimento);
                if (statusNR11 === 'vencido') return status === 'Vencido';
                if (statusNR11 === 'renovar') return status === 'Renovar';
                if (statusNR11 === 'ok') return status === 'OK';
                return true;
            });
        }
        
        if (statusNR12) {
            filteredRows = filteredRows.filter(row => {
                const status = getStatus(row.NR12_Vencimento);
                if (statusNR12 === 'vencido') return status === 'Vencido';
                if (statusNR12 === 'renovar') return status === 'Renovar';
                if (statusNR12 === 'ok') return status === 'OK';
                return true;
            });
        }
        
        if (statusNR17) {
            filteredRows = filteredRows.filter(row => {
                const status = getStatus(row.Nr17_Vencimento);
                if (statusNR17 === 'vencido') return status === 'Vencido';
                if (statusNR17 === 'renovar') return status === 'Renovar';
                if (statusNR17 === 'ok') return status === 'OK';
                return true;
            });
        }
        
        if (statusNR18) {
            filteredRows = filteredRows.filter(row => {
                const status = getStatus(row.NR18_Vencimento);
                if (statusNR18 === 'vencido') return status === 'Vencido';
                if (statusNR18 === 'renovar') return status === 'Renovar';
                if (statusNR18 === 'ok') return status === 'OK';
                return true;
            });
        }
        
        if (statusNR20) {
            filteredRows = filteredRows.filter(row => {
                const status = getStatus(row.Nr20_Vencimento);
                if (statusNR20 === 'vencido') return status === 'Vencido';
                if (statusNR20 === 'renovar') return status === 'Renovar';
                if (statusNR20 === 'ok') return status === 'OK';
                return true;
            });
        }
        
        if (statusNR33) {
            filteredRows = filteredRows.filter(row => {
                const status = getStatus(row.NR33_Vencimento);
                if (statusNR33 === 'vencido') return status === 'Vencido';
                if (statusNR33 === 'renovar') return status === 'Renovar';
                if (statusNR33 === 'ok') return status === 'OK';
                return true;
            });
        }
        
        if (statusNR34) {
            filteredRows = filteredRows.filter(row => {
                const status = getStatus(row.Nr34_Vencimento);
                if (statusNR34 === 'vencido') return status === 'Vencido';
                if (statusNR34 === 'renovar') return status === 'Renovar';
                if (statusNR34 === 'ok') return status === 'OK';
                return true;
            });
        }
        
        if (statusNR35) {
            filteredRows = filteredRows.filter(row => {
                const status = getStatus(row.NR35_Vencimento);
                if (statusNR35 === 'vencido') return status === 'Vencido';
                if (statusNR35 === 'renovar') return status === 'Renovar';
                if (statusNR35 === 'ok') return status === 'OK';
                return true;
            });
        }
        
        if (statusEPI) {
            filteredRows = filteredRows.filter(row => {
                const status = getStatus(row.epiVencimento);
                if (statusEPI === 'vencido') return status === 'Vencido';
                if (statusEPI === 'renovar') return status === 'Renovar';
                if (statusEPI === 'ok') return status === 'OK';
                return true;
            });
        }
        
        // Aplicar paginação nos resultados filtrados
        const total = filteredRows.length;
        const offset = (page - 1) * limit;
        const rows = filteredRows.slice(offset, offset + parseInt(limit));
        
        // Calcular status para cada registro
        rows.forEach(row => {
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
            
            // Status geral (pior status entre todos)
            const statuses = [row.Nr06_Status, row.Nr10_Status, row.Nr11_Status, row.Nr12_Status, 
                            row.Nr17_Status, row.Nr18_Status, row.Nr20_Status, row.Nr33_Status, 
                            row.Nr34_Status, row.Nr35_Status, row.EpiStatus];
            
            if (statuses.includes('Vencido')) row.Status = 'Vencido';
            else if (statuses.includes('Renovar')) row.Status = 'Renovar';
            else row.Status = 'OK';
            
            // Preparar URL da foto se existir (usando flag temFoto)
            if (row.temFoto) {
                row.fotoUrl = `/api/foto/${row.id}`;
            } else {
                row.fotoUrl = null;
            }
            delete row.temFoto;
        });
        
        // Contar totais de ativos e inativos de TODA a tabela (sem filtro de situação)
        // N = ATIVO, S = CANCELADO (conforme Excel)
        db.get(`SELECT 
            SUM(CASE WHEN Situacao = 'N' THEN 1 ELSE 0 END) as totalAtivos,
            SUM(CASE WHEN Situacao = 'S' THEN 1 ELSE 0 END) as totalInativos
            FROM SSMA`, (err, countRow) => {
            if (err) {
                console.error('Erro ao contar ativos/inativos:', err);
            }
            
            const totalAtivos = countRow?.totalAtivos || 0;
            const totalInativos = countRow?.totalInativos || 0;
            
            const totalPages = Math.ceil(total / limit);
            console.log(`📊 Retornando: total=${total}, page=${page}, limit=${limit}, totalPages=${totalPages}, ativos=${totalAtivos}, inativos=${totalInativos}`);
            
            res.json({
                data: rows,
                total: total,
                page: parseInt(page),
                totalPages: totalPages,
                totalAtivos: totalAtivos,
                totalInativos: totalInativos
            });
        });
    });
});

// GET - Contadores de vencimentos para TODOS os registros filtrados (não paginado)
app.get('/api/ssma/contadores', (req, res) => {
    const { nome, empresa, funcao, situacao, dataInicio, dataFim } = req.query;
    
    let sql = 'SELECT Vencimento, Nr06_Vencimento, Nr10_Vencimento, Nr11_Vencimento, NR12_Vencimento, Nr17_Vencimento, NR18_Vencimento, Nr20_Vencimento, NR33_Vencimento, Nr34_Vencimento, NR35_Vencimento, epiVencimento FROM SSMA WHERE 1=1';
    let params = [];
    
    if (nome) {
        sql += ' AND Nome LIKE ?';
        params.push(`%${nome}%`);
    }
    if (empresa) {
        sql += ' AND Empresa LIKE ?';
        params.push(`%${empresa}%`);
    }
    if (funcao) {
        sql += ' AND Funcao LIKE ?';
        params.push(`%${funcao}%`);
    }
    if (situacao) {
        sql += ' AND Situacao = ?';
        params.push(situacao);
    }
    
    // Filtro por data de cadastro
    if (dataInicio) {
        sql += ' AND date(Cadastro) >= date(?)';
        params.push(dataInicio);
    }
    if (dataFim) {
        sql += ' AND date(Cadastro) <= date(?)';
        params.push(dataFim);
    }
    
    db.all(sql, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        // Calcular contadores
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
        
        const hoje = new Date();
        
        rows.forEach(row => {
            // Função para calcular status
            const calcStatus = (dataStr) => {
                if (!dataStr) return 'OK';
                const data = new Date(dataStr);
                const diffDays = Math.ceil((data - hoje) / (1000 * 60 * 60 * 24));
                if (diffDays < 0) return 'Vencido';
                if (diffDays <= 30) return 'Renovar';
                return 'OK';
            };
            
            // ASO
            const statusASO = calcStatus(row.Vencimento);
            if (statusASO === 'Vencido') contadores.aso.vencidos++;
            if (statusASO === 'Renovar') contadores.aso.renovar++;
            
            // NR-06
            const statusNR06 = calcStatus(row.Nr06_Vencimento);
            if (statusNR06 === 'Vencido') contadores.nr06.vencidos++;
            if (statusNR06 === 'Renovar') contadores.nr06.renovar++;
            
            // NR-10
            const statusNR10 = calcStatus(row.Nr10_Vencimento);
            if (statusNR10 === 'Vencido') contadores.nr10.vencidos++;
            if (statusNR10 === 'Renovar') contadores.nr10.renovar++;
            
            // NR-11
            const statusNR11 = calcStatus(row.Nr11_Vencimento);
            if (statusNR11 === 'Vencido') contadores.nr11.vencidos++;
            if (statusNR11 === 'Renovar') contadores.nr11.renovar++;
            
            // NR-12
            const statusNR12 = calcStatus(row.NR12_Vencimento);
            if (statusNR12 === 'Vencido') contadores.nr12.vencidos++;
            if (statusNR12 === 'Renovar') contadores.nr12.renovar++;
            
            // NR-17
            const statusNR17 = calcStatus(row.Nr17_Vencimento);
            if (statusNR17 === 'Vencido') contadores.nr17.vencidos++;
            if (statusNR17 === 'Renovar') contadores.nr17.renovar++;
            
            // NR-18
            const statusNR18 = calcStatus(row.NR18_Vencimento);
            if (statusNR18 === 'Vencido') contadores.nr18.vencidos++;
            if (statusNR18 === 'Renovar') contadores.nr18.renovar++;
            
            // NR-20
            const statusNR20 = calcStatus(row.Nr20_Vencimento);
            if (statusNR20 === 'Vencido') contadores.nr20.vencidos++;
            if (statusNR20 === 'Renovar') contadores.nr20.renovar++;
            
            // NR-33
            const statusNR33 = calcStatus(row.NR33_Vencimento);
            if (statusNR33 === 'Vencido') contadores.nr33.vencidos++;
            if (statusNR33 === 'Renovar') contadores.nr33.renovar++;
            
            // NR-34
            const statusNR34 = calcStatus(row.Nr34_Vencimento);
            if (statusNR34 === 'Vencido') contadores.nr34.vencidos++;
            if (statusNR34 === 'Renovar') contadores.nr34.renovar++;
            
            // NR-35
            const statusNR35 = calcStatus(row.NR35_Vencimento);
            if (statusNR35 === 'Vencido') contadores.nr35.vencidos++;
            if (statusNR35 === 'Renovar') contadores.nr35.renovar++;
            
            // EPI
            const statusEPI = calcStatus(row.epiVencimento);
            if (statusEPI === 'Vencido') contadores.epi.vencidos++;
            if (statusEPI === 'Renovar') contadores.epi.renovar++;
        });
        
        res.json(contadores);
    });
});

// GET - Servir foto específica
app.get('/api/foto/:id', (req, res) => {
    const { id } = req.params;
    
    db.get('SELECT Foto FROM SSMA WHERE id = ?', [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (!row || !row.Foto) {
            res.status(404).json({ error: 'Foto não encontrada' });
            return;
        }
        
        // Servir a foto como imagem
        res.set('Content-Type', 'image/jpeg');
        res.send(row.Foto);
    });
});

// ==================== ROTAS DE CONTAGEM ====================
// IMPORTANTE: Estas rotas devem vir ANTES de /api/ssma/:id
// para evitar que "count" seja interpretado como um ID

app.get('/api/ssma/count', (req, res) => {
    db.get('SELECT COUNT(*) as total FROM SSMA', (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ total: row.total });
    });
});

app.get('/api/fornecedores/count', (req, res) => {
    db.get('SELECT COUNT(*) as total FROM FORNECEDOR', (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ total: row.total });
    });
});

app.get('/api/documentacao/count', (req, res) => {
    db.get('SELECT COUNT(*) as total FROM DOCUMENTACAO', (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ total: row.total });
    });
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
app.get('/api/ssma/:id', (req, res) => {
    const { id } = req.params;
    
    db.get('SELECT * FROM SSMA WHERE id = ?', [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (!row) {
            res.status(404).json({ error: 'Registro não encontrado' });
            return;
        }
        
        // Calcular status
        row.Nr10_Status = calcularStatus(row.Nr10_Vencimento);
        row.Nr11_Status = calcularStatus(row.Nr11_Vencimento);
        row.Nr12_Status = calcularStatus(row.NR12_Vencimento);
        row.Nr17_Status = calcularStatus(row.Nr17_Vencimento);
        row.Nr18_Status = calcularStatus(row.NR18_Vencimento);
        row.Nr33_Status = calcularStatus(row.NR33_Vencimento);
        row.Nr35_Status = calcularStatus(row.NR35_Vencimento);
        row.EpiStatus = calcularStatus(row.epiVencimento);
        
        res.json(row);
    });
});

// POST - Criar novo registro
app.post('/api/ssma', (req, res) => {
    console.log('=== POST /api/ssma ===');
    console.log('Body recebido:', req.body);
    
    let {
        nome, empresa, funcao, celular, cpf, dataEmissao, vencimento,
        nr06_dataEmissao, nr10_dataEmissao, nr11_dataEmissao, nr12_dataEmissao, nr17_dataEmissao, nr18_dataEmissao, nr20_dataEmissao, nr33_dataEmissao, nr34_dataEmissao, nr35_dataEmissao, epi_dataEmissao,
        nr06_vencimento, nr10_vencimento, nr11_vencimento, nr12_vencimento, nr17_vencimento, nr18_vencimento, nr20_vencimento, nr33_vencimento, nr34_vencimento, nr35_vencimento, epi_vencimento,
        nr06_status, nr10_status, nr11_status, nr12_status, nr17_status, nr18_status, nr20_status, nr33_status, nr34_status, nr35_status, epi_status,
        nr12_ferramenta,
        situacao = 'S', anotacoes, ambientacao, fotoBase64
    } = req.body;
    
    // ✅ CONVERTER TUDO PARA MAIÚSCULO
    nome = nome ? nome.toUpperCase() : nome;
    empresa = empresa ? empresa.toUpperCase() : empresa;
    funcao = funcao ? funcao.toUpperCase() : funcao;
    anotacoes = anotacoes ? anotacoes.toUpperCase() : anotacoes;
    nr12_ferramenta = nr12_ferramenta ? nr12_ferramenta.toUpperCase() : nr12_ferramenta;
    
    console.log('Campos extraídos (MAIÚSCULO):', {
        nome, empresa, funcao, celular, cpf, dataEmissao, vencimento,
        nr06_dataEmissao, nr10_dataEmissao, nr11_dataEmissao, nr12_dataEmissao, nr17_dataEmissao, nr18_dataEmissao, nr20_dataEmissao, nr33_dataEmissao, nr34_dataEmissao, nr35_dataEmissao, epi_dataEmissao,
        situacao, anotacoes, ambientacao
    });
    
    // Validações (igual ao sistema desktop)
    if (!nome || !empresa || !funcao) {
        res.status(400).json({ error: 'Nome, Empresa e Função são obrigatórios' });
        return;
    }
    
    // VERIFICAR CPF DUPLICADO - Bloquear CPF duplicado em registros ATIVOS
    if (cpf && cpf.trim() !== '') {
        console.log('🔍 Verificando CPF duplicado em registros ativos...');
        const checkCpfSql = `
            SELECT id, Nome, Empresa, Situacao FROM SSMA WHERE 
            CPF = ? AND 
            Situacao = 'N'
            LIMIT 1
        `;
        
        db.get(checkCpfSql, [cpf], (err, cpfRow) => {
            if (err) {
                console.error('Erro ao verificar CPF:', err);
                res.status(500).json({ error: 'Erro ao verificar CPF' });
                return;
            }
            
            if (cpfRow) {
                console.log('⚠️ CPF DUPLICADO DETECTADO! ID:', cpfRow.id, 'Nome:', cpfRow.Nome);
                res.status(409).json({ 
                    error: `CPF já cadastrado para ${cpfRow.Nome} (${cpfRow.Empresa}) - Registro Ativo`,
                    duplicateId: cpfRow.id,
                    duplicateStatus: cpfRow.Situacao,
                    duplicateName: cpfRow.Nome,
                    duplicateType: 'cpf'
                });
                return;
            }
            
            console.log('✅ CPF disponível. Verificando duplicata de nome...');
            verificarDuplicataNome();
        });
    } else {
        // Se não tem CPF, pula direto para verificação de nome
        verificarDuplicataNome();
    }
    
    function verificarDuplicataNome() {
        // VERIFICAR DUPLICATA - Bloquear registros com mesmo Nome + Empresa + Função (as 3 juntas)
        console.log('🔍 Verificando duplicata por Nome, Empresa e Função...');
        const checkDuplicataSql = `
            SELECT id, Situacao FROM SSMA WHERE 
            Nome = ? AND 
            Empresa = ? AND
            Funcao = ?
            LIMIT 1
        `;
        
        const checkParams = [nome, empresa, funcao];
        
        db.get(checkDuplicataSql, checkParams, (err, row) => {
            if (err) {
                console.error('Erro ao verificar duplicata:', err);
                res.status(500).json({ error: 'Erro ao verificar duplicata' });
                return;
            }
            
            if (row) {
                const statusText = row.Situacao === 'N' ? 'Ativo' : 'Inativo';
                console.log('⚠️ DUPLICATA DETECTADA! ID:', row.id, 'Status:', statusText);
                res.status(409).json({ 
                    error: `Registro duplicado já existe`,
                    duplicateId: row.id,
                    duplicateStatus: row.Situacao,
                    duplicateType: 'nome'
                });
                return;
            }
            
            console.log('✅ Nenhuma duplicata encontrada. Prosseguindo com o salvamento...');
            salvarRegistro();
        });
    }
    
    function salvarRegistro() {
        
        // Converter foto de base64 se existir
        let fotoBuffer = null;
        if (fotoBase64 && fotoBase64.length > 0) {
            try {
                fotoBuffer = Buffer.from(fotoBase64, 'base64');
                console.log('📸 Foto convertida de base64:', fotoBuffer.length, 'bytes');
            } catch (err) {
                console.error('Erro ao converter base64:', err);
                return res.status(400).json({ error: 'Erro ao processar foto' });
            }
        }
    
        const sql = `
            INSERT INTO SSMA (
                Nome, Empresa, Funcao, Celular, CPF, DataEmissao, Vencimento,
                Nr06_DataEmissao, Nr06_Vencimento, Nr06_Status,
                Nr10_DataEmissao, Nr10_Vencimento, Nr10_Status,
                Nr11_DataEmissao, Nr11_Vencimento, Nr11_Status,
                Nr12_DataEmissao, Nr12_Vencimento, Nr12_Status, Nr12_Ferramenta,
                Nr17_DataEmissao, Nr17_Vencimento, Nr17_Status,
                Nr18_DataEmissao, Nr18_Vencimento, Nr18_Status,
                Nr20_DataEmissao, Nr20_Vencimento, Nr20_Status,
                Nr33_DataEmissao, Nr33_Vencimento, Nr33_Status,
                Nr34_DataEmissao, Nr34_Vencimento, Nr34_Status,
                Nr35_DataEmissao, Nr35_Vencimento, Nr35_Status,
                Epi_DataEmissao, epiVencimento, EpiStatus,
                Situacao, Anotacoes, Ambientacao, Foto
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            nome, empresa, funcao, celular, cpf, dataEmissao, vencimento,
            nr06_dataEmissao, nr06_vencimento, nr06_status,
            nr10_dataEmissao, nr10_vencimento, nr10_status,
            nr11_dataEmissao, nr11_vencimento, nr11_status,
            nr12_dataEmissao, nr12_vencimento, nr12_status, nr12_ferramenta,
            nr17_dataEmissao, nr17_vencimento, nr17_status,
            nr18_dataEmissao, nr18_vencimento, nr18_status,
            nr20_dataEmissao, nr20_vencimento, nr20_status,
            nr33_dataEmissao, nr33_vencimento, nr33_status,
            nr34_dataEmissao, nr34_vencimento, nr34_status,
            nr35_dataEmissao, nr35_vencimento, nr35_status,
            epi_dataEmissao, epi_vencimento, epi_status,
            situacao, anotacoes, ambientacao, fotoBuffer
        ];
        
        console.log('Params array length:', params.length);
        console.log('Params:', params);
        
        db.run(sql, params, function(err) {
            if (err) {
                // Capturar erro de UNIQUE constraint
                if (err.code === 'SQLITE_CONSTRAINT' && err.message.includes('UNIQUE')) {
                    console.log('⚠️ UNIQUE constraint violado:', err.message);
                    res.status(409).json({ 
                        error: `Registro duplicado já existe`,
                        duplicateId: null,
                        duplicateStatus: null
                    });
                    return;
                }
                
                console.error('Erro ao inserir:', err);
                res.status(500).json({ error: err.message });
                return;
            }
            
            console.log('✅ Registro inserido com sucesso! ID:', this.lastID);
            res.json({
                id: this.lastID,
                message: 'Registro criado com sucesso'
            });
        });
    }
});

// PUT - Atualizar registro
app.put('/api/ssma/:id', (req, res) => {
    const { id } = req.params;
    
    console.log('=== ATUALIZANDO REGISTRO ===');
    console.log('ID:', id);
    console.log('Body recebido:', req.body);
    
    let {
        nome, empresa, funcao, celular, cpf, dataEmissao, vencimento,
        nr06_dataEmissao, nr06_vencimento, nr06_status,
        nr10_dataEmissao, nr10_vencimento, nr10_status,
        nr11_dataEmissao, nr11_vencimento, nr11_status,
        nr12_dataEmissao, nr12_vencimento, nr12_status, nr12_ferramenta,
        nr17_dataEmissao, nr17_vencimento, nr17_status,
        nr18_dataEmissao, nr18_vencimento, nr18_status,
        nr20_dataEmissao, nr20_vencimento, nr20_status,
        nr33_dataEmissao, nr33_vencimento, nr33_status,
        nr34_dataEmissao, nr34_vencimento, nr34_status,
        nr35_dataEmissao, nr35_vencimento, nr35_status,
        epi_dataEmissao, epi_vencimento, epi_status,
        situacao, anotacoes, ambientacao, fotoBase64, removerFoto
    } = req.body;
    
    // ✅ CONVERTER TUDO PARA MAIÚSCULO
    nome = nome ? nome.toUpperCase() : nome;
    empresa = empresa ? empresa.toUpperCase() : empresa;
    funcao = funcao ? funcao.toUpperCase() : funcao;
    anotacoes = anotacoes ? anotacoes.toUpperCase() : anotacoes;
    nr12_ferramenta = nr12_ferramenta ? nr12_ferramenta.toUpperCase() : nr12_ferramenta;
    
    // Validações
    if (!nome || !empresa || !funcao) {
        res.status(400).json({ error: 'Nome, Empresa e Função são obrigatórios' });
        return;
    }
    
    // VERIFICAR CPF DUPLICADO - Bloquear CPF duplicado em registros ATIVOS (exceto o próprio registro)
    if (cpf && cpf.trim() !== '') {
        console.log('🔍 Verificando CPF duplicado em registros ativos (excluindo registro atual)...');
        const checkCpfSql = `
            SELECT id, Nome, Empresa, Situacao FROM SSMA WHERE 
            CPF = ? AND 
            Situacao = 'N' AND
            id != ?
            LIMIT 1
        `;
        
        db.get(checkCpfSql, [cpf, id], (err, cpfRow) => {
            if (err) {
                console.error('Erro ao verificar CPF:', err);
                res.status(500).json({ error: 'Erro ao verificar CPF' });
                return;
            }
            
            if (cpfRow) {
                console.log('⚠️ CPF DUPLICADO DETECTADO! ID:', cpfRow.id, 'Nome:', cpfRow.Nome);
                res.status(409).json({ 
                    error: `CPF já cadastrado para ${cpfRow.Nome} (${cpfRow.Empresa}) - Registro Ativo`,
                    duplicateId: cpfRow.id,
                    duplicateStatus: cpfRow.Situacao,
                    duplicateName: cpfRow.Nome,
                    duplicateType: 'cpf'
                });
                return;
            }
            
            console.log('✅ CPF disponível. Verificando duplicata de nome...');
            verificarDuplicataNome();
        });
    } else {
        // Se não tem CPF, pula direto para verificação de nome
        verificarDuplicataNome();
    }
    
    function verificarDuplicataNome() {
        // VERIFICAR DUPLICATA - Bloquear se já existe outro registro com mesmo Nome + Empresa + Função
        console.log('🔍 Verificando duplicata por Nome, Empresa e Função (excluindo o registro atual)...');
        const checkDuplicataSql = `
            SELECT id, Situacao FROM SSMA WHERE 
            Nome = ? AND 
            Empresa = ? AND
            Funcao = ? AND
            id != ?
            LIMIT 1
        `;
        
        db.get(checkDuplicataSql, [nome, empresa, funcao, id], (err, row) => {
            if (err) {
                console.error('Erro ao verificar duplicata:', err);
                res.status(500).json({ error: 'Erro ao verificar duplicata' });
                return;
            }
            
            if (row) {
                const statusText = row.Situacao === 'N' ? 'Ativo' : 'Inativo';
                console.log('⚠️ DUPLICATA DETECTADA! ID:', row.id, 'Status:', statusText);
                res.status(409).json({ 
                    error: `Registro duplicado já existe`,
                    duplicateId: row.id,
                    duplicateStatus: row.Situacao,
                    duplicateType: 'nome'
                });
                return;
            }
            
            // Prosseguir com a atualização
            proceedWithUpdate();
        });
    }
    
    function proceedWithUpdate() {
    // PRIMEIRO: Buscar dados atuais para detectar mudança de função
    db.get('SELECT Funcao, Nome FROM SSMA WHERE id = ?', [id], (err, dadosAtuais) => {
        if (err) {
            console.error('Erro ao buscar dados atuais:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        
        const funcaoAnterior = dadosAtuais ? dadosAtuais.Funcao : null;
        const funcaoNova = funcao;
        const mudouFuncao = funcaoAnterior && funcaoNova && funcaoAnterior.toUpperCase() !== funcaoNova.toUpperCase();
        
        if (mudouFuncao) {
            console.log(`🔄 MUDANÇA DE FUNÇÃO DETECTADA: ${funcaoAnterior} → ${funcaoNova}`);
        }
        
    let sql = `
        UPDATE SSMA SET
            Nome = ?, Empresa = ?, Funcao = ?, Celular = ?, CPF = ?, DataEmissao = ?, Vencimento = ?,
            Nr06_DataEmissao = ?, Nr06_Vencimento = ?, Nr06_Status = ?,
            Nr10_DataEmissao = ?, Nr10_Vencimento = ?, Nr10_Status = ?,
            Nr11_DataEmissao = ?, Nr11_Vencimento = ?, Nr11_Status = ?,
            Nr12_DataEmissao = ?, Nr12_Vencimento = ?, Nr12_Status = ?, Nr12_Ferramenta = ?,
            Nr17_DataEmissao = ?, Nr17_Vencimento = ?, Nr17_Status = ?,
            Nr18_DataEmissao = ?, Nr18_Vencimento = ?, Nr18_Status = ?,
            Nr20_DataEmissao = ?, Nr20_Vencimento = ?, Nr20_Status = ?,
            Nr33_DataEmissao = ?, Nr33_Vencimento = ?, Nr33_Status = ?,
            Nr34_DataEmissao = ?, Nr34_Vencimento = ?, Nr34_Status = ?,
            Nr35_DataEmissao = ?, Nr35_Vencimento = ?, Nr35_Status = ?,
            Epi_DataEmissao = ?, epiVencimento = ?, EpiStatus = ?,
            Situacao = ?, Anotacoes = ?, Ambientacao = ?
    `;
    
    let params = [
        nome, empresa, funcao, celular, cpf, dataEmissao, vencimento,
        nr06_dataEmissao, nr06_vencimento, nr06_status,
        nr10_dataEmissao, nr10_vencimento, nr10_status,
        nr11_dataEmissao, nr11_vencimento, nr11_status,
        nr12_dataEmissao, nr12_vencimento, nr12_status, nr12_ferramenta,
        nr17_dataEmissao, nr17_vencimento, nr17_status,
        nr18_dataEmissao, nr18_vencimento, nr18_status,
        nr20_dataEmissao, nr20_vencimento, nr20_status,
        nr33_dataEmissao, nr33_vencimento, nr33_status,
        nr34_dataEmissao, nr34_vencimento, nr34_status,
        nr35_dataEmissao, nr35_vencimento, nr35_status,
        epi_dataEmissao, epi_vencimento, epi_status,
        situacao, anotacoes, ambientacao
    ];
    
    // Se tem foto nova em base64, converter e incluir na atualização
    if (fotoBase64 && fotoBase64.length > 0) {
        try {
            const fotoBuffer = Buffer.from(fotoBase64, 'base64');
            console.log('📸 Foto recebida em base64 com', fotoBuffer.length, 'bytes');
            sql += ', Foto = ?';
            params.push(fotoBuffer);
        } catch (err) {
            console.error('Erro ao converter base64:', err);
            return res.status(400).json({ error: 'Erro ao processar foto' });
        }
    } else if (removerFoto === true) {
        // Se a flag removerFoto está ativa, limpar a foto do banco
        console.log('🗑️ Removendo foto do registro');
        sql += ', Foto = NULL';
    } else {
        console.log('⚠️ Nenhuma foto nova fornecida, mantendo foto existente');
    }
    
    sql += ' WHERE id = ?';
    params.push(id);
    
    console.log('SQL:', sql);
    console.log('Params count:', params.length);
    
    db.run(sql, params, function(err) {
        if (err) {
            // Capturar erro de UNIQUE constraint
            if (err.code === 'SQLITE_CONSTRAINT' && err.message.includes('UNIQUE')) {
                console.log('⚠️ UNIQUE constraint violado:', err.message);
                res.status(409).json({ 
                    error: `Registro duplicado já existe`,
                    duplicateId: null,
                    duplicateStatus: null
                });
                return;
            }
            
            console.error('Erro ao atualizar:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (this.changes === 0) {
            res.status(404).json({ error: 'Registro não encontrado' });
            return;
        }
        
        console.log('✅ Registro atualizado com sucesso');
        
        // Se houve mudança de função, registrar automaticamente
        if (mudouFuncao) {
            const hoje = new Date();
            const diaHoje = hoje.getDate();
            
            const sqlMudanca = `
                INSERT INTO MUDANCA_FUNCAO_PRESENCA (mesAno, funcionarioId, funcionarioNome, funcaoAnterior, funcaoNova, diaInicio, anotacoes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            
            const anotacaoAuto = `Mudança automática detectada: ${funcaoAnterior} → ${funcaoNova} em ${hoje.toLocaleDateString('pt-BR')}`;
            
            db.run(sqlMudanca, [presencaMesAtual, id, nome, funcaoAnterior, funcaoNova, diaHoje, anotacaoAuto], function(errMudanca) {
                if (errMudanca) {
                    console.error('❌ Erro ao registrar mudança de função:', errMudanca);
                } else {
                    console.log(`✅ Mudança de função registrada automaticamente! ID: ${this.lastID}`);
                }
                
                res.json({ 
                    message: 'Registro atualizado com sucesso',
                    mudancaFuncao: true,
                    funcaoAnterior: funcaoAnterior,
                    funcaoNova: funcaoNova
                });
            });
        } else {
            res.json({ message: 'Registro atualizado com sucesso' });
        }
    });
    }); // Fim do db.get para buscar dados atuais
    } // Fim da função proceedWithUpdate
});

// DELETE - Excluir registro
app.delete('/api/ssma/:id', (req, res) => {
    const { id } = req.params;
    
    db.run('DELETE FROM SSMA WHERE id = ?', [id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (this.changes === 0) {
            res.status(404).json({ error: 'Registro não encontrado' });
            return;
        }
        
        res.json({ message: 'Registro excluído com sucesso' });
    });
});

// PUT - Alternar situação (Ativo/Inativo) com data de inativação
app.put('/api/ssma/:id/toggle-situacao', (req, res) => {
    const { id } = req.params;
    const { situacao, dataInativacao } = req.body;
    
    console.log('=== ALTERANDO SITUAÇÃO ===');
    console.log('ID:', id);
    console.log('Nova situação:', situacao);
    console.log('Data inativação:', dataInativacao);
    
    // Validar situação
    if (!situacao || !['S', 'N'].includes(situacao)) {
        res.status(400).json({ error: 'Situação inválida. Use S para Ativo ou N para Inativo' });
        return;
    }
    
    // Preparar SQL baseado na situação
    let sql, params;
    
    if (situacao === 'N') {
        // Inativando - registrar data de inativação
        sql = 'UPDATE SSMA SET Situacao = ?, DataInativacao = ? WHERE id = ?';
        params = [situacao, dataInativacao || new Date().toISOString(), id];
    } else {
        // Ativando - limpar data de inativação
        sql = 'UPDATE SSMA SET Situacao = ?, DataInativacao = NULL WHERE id = ?';
        params = [situacao, id];
    }
    
    db.run(sql, params, function(err) {
        if (err) {
            console.error('Erro ao atualizar situação:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (this.changes === 0) {
            res.status(404).json({ error: 'Registro não encontrado' });
            return;
        }
        
        const statusText = situacao === 'N' ? 'Ativo' : 'Inativo';
        console.log(`Situação alterada para: ${statusText}`);
        
        res.json({
            message: `Situação alterada para ${statusText}`,
            situacao: situacao,
            dataInativacao: situacao === 'S' ? (dataInativacao || new Date().toISOString()) : null
        });
    });
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
app.get('/api/fornecedores', (req, res) => {
    const situacao = req.query.situacao;
    
    let sql = 'SELECT * FROM FORNECEDOR';
    let params = [];
    
    if (situacao && situacao !== 'all') {
        sql += ' WHERE Situacao = ?';
        params.push(situacao);
    } else if (!situacao) {
        // Por padrão, mostrar apenas fornecedores ativos
        sql += ' WHERE Situacao = "S"';
    }
    // Se situacao === 'all', não adiciona WHERE (retorna todos)
    
    sql += ' ORDER BY Empresa';
    
    db.all(sql, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows || []);
    });
});

// POST - Criar fornecedor
app.post('/api/fornecedores', (req, res) => {
    const { empresa, cnpj, telefone, celular, contato, observacao } = req.body;
    
    if (!empresa) {
        res.status(400).json({ error: 'Empresa é obrigatória' });
        return;
    }
    
    // Verificar se CNPJ já existe
    if (cnpj) {
        db.get('SELECT id, Empresa FROM FORNECEDOR WHERE CNPJ = ?', [cnpj], (err, existing) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            if (existing) {
                res.status(400).json({ error: `CNPJ já cadastrado para: ${existing.Empresa}` });
                return;
            }
            
            // CNPJ não existe, pode inserir
            inserirFornecedor();
        });
    } else {
        inserirFornecedor();
    }
    
    function inserirFornecedor() {
        const sql = 'INSERT INTO FORNECEDOR (Empresa, CNPJ, Telefone, Celular, Contato, Observacao) VALUES (?, ?, ?, ?, ?, ?)';
        
        db.run(sql, [empresa, cnpj, telefone, celular, contato, observacao], function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            res.json({
                id: this.lastID,
                message: 'Fornecedor criado com sucesso'
            });
        });
    }
});

// PUT - Alternar situação do fornecedor (Ativo/Inativo)
app.put('/api/fornecedores/:id/toggle-situacao', (req, res) => {
    const { id } = req.params;
    const { Situacao, DataInativacao } = req.body;
    
    console.log('=== ALTERANDO SITUAÇÃO DO FORNECEDOR ===');
    console.log('ID:', id);
    console.log('Nova situação:', Situacao);
    
    // Validar situação
    if (!Situacao || !['S', 'N'].includes(Situacao)) {
        res.status(400).json({ error: 'Situação inválida. Use S para Ativo ou N para Inativo' });
        return;
    }
    
    let sql, params;
    
    if (Situacao === 'N') {
        // Inativando - registrar data de inativação
        sql = 'UPDATE FORNECEDOR SET Situacao = ?, DataInativacao = ? WHERE id = ?';
        params = [Situacao, DataInativacao || new Date().toISOString(), id];
    } else {
        // Ativando - limpar data de inativação
        sql = 'UPDATE FORNECEDOR SET Situacao = ?, DataInativacao = NULL WHERE id = ?';
        params = [Situacao, id];
    }
    
    db.run(sql, params, function(err) {
        if (err) {
            console.error('Erro ao atualizar situação:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (this.changes === 0) {
            res.status(404).json({ error: 'Fornecedor não encontrado' });
            return;
        }
        
        const statusText = Situacao === 'S' ? 'Ativo' : 'Inativo';
        console.log(`Situação alterada para: ${statusText}`);
        
        res.json({
            message: `Situação alterada para ${statusText}`,
            Situacao: Situacao,
            DataInativacao: Situacao === 'N' ? (DataInativacao || new Date().toISOString()) : null
        });
    });
});

// PUT - Atualizar fornecedor
app.put('/api/fornecedores/:id', (req, res) => {
    const { id } = req.params;
    const { empresa, cnpj, telefone, celular, contato, observacao, Situacao } = req.body;
    
    // Se apenas Situacao foi enviada, usar o endpoint de toggle
    if (Situacao && !empresa) {
        // Redirecionar para o endpoint de toggle
        return res.status(400).json({ error: 'Use o endpoint /api/fornecedores/:id/toggle-situacao para alterar apenas a situação' });
    }
    
    if (!empresa) {
        res.status(400).json({ error: 'Empresa é obrigatória' });
        return;
    }
    
    const sql = 'UPDATE FORNECEDOR SET Empresa = ?, CNPJ = ?, Telefone = ?, Celular = ?, Contato = ?, Observacao = ? WHERE id = ?';
    
    db.run(sql, [empresa, cnpj, telefone, celular, contato, observacao, id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (this.changes === 0) {
            res.status(404).json({ error: 'Fornecedor não encontrado' });
            return;
        }
        
        res.json({ message: 'Fornecedor atualizado com sucesso' });
    });
});

// GET - Buscar fornecedor específico
app.get('/api/fornecedores/:id', (req, res) => {
    const { id } = req.params;
    
    db.get('SELECT * FROM FORNECEDOR WHERE id = ?', [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (!row) {
            res.status(404).json({ error: 'Fornecedor não encontrado' });
            return;
        }
        
        res.json(row);
    });
});

// DELETE - Excluir fornecedor
app.delete('/api/fornecedores/:id', (req, res) => {
    const { id } = req.params;
    
    db.run('DELETE FROM FORNECEDOR WHERE id = ?', [id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (this.changes === 0) {
            res.status(404).json({ error: 'Fornecedor não encontrado' });
            return;
        }
        
        res.json({ message: 'Fornecedor excluído com sucesso' });
    });
});

// ===== ROTAS DE DOCUMENTAÇÃO =====

// GET - Listar todas as documentações
app.get('/api/documentacao', (req, res) => {
    db.all('SELECT * FROM DOCUMENTACAO ORDER BY empresa', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows || []);
    });
});

// GET - Buscar documentação por CNPJ
app.get('/api/documentacao/cnpj/:cnpj', (req, res) => {
    const { cnpj } = req.params;
    db.get('SELECT * FROM DOCUMENTACAO WHERE cnpj = ?', [decodeURIComponent(cnpj)], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: 'Documentação não encontrada' });
            return;
        }
        res.json(row);
    });
});

// GET - Buscar documentação específica
app.get('/api/documentacao/:id', (req, res) => {
    const { id } = req.params;
    db.get('SELECT * FROM DOCUMENTACAO WHERE id = ?', [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: 'Documentação não encontrada' });
            return;
        }
        res.json(row);
    });
});

// POST - Criar nova documentação
app.post('/api/documentacao', (req, res) => {
    const { empresa, cnpj, pgr_emissao, pgr_vencimento, pgr_status, pcmso_emissao, pcmso_vencimento, pcmso_status, ativo } = req.body;
    
    db.run(`
        INSERT INTO DOCUMENTACAO (empresa, cnpj, pgr_emissao, pgr_vencimento, pgr_status, pcmso_emissao, pcmso_vencimento, pcmso_status, ativo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [empresa, cnpj, pgr_emissao, pgr_vencimento, pgr_status, pcmso_emissao, pcmso_vencimento, pcmso_status, ativo || 'S'], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ id: this.lastID, message: 'Documentação criada com sucesso' });
    });
});

// PUT - Atualizar documentação
app.put('/api/documentacao/:id', (req, res) => {
    const { id } = req.params;
    const { empresa, cnpj, pgr_emissao, pgr_vencimento, pgr_status, pcmso_emissao, pcmso_vencimento, pcmso_status, ativo } = req.body;
    
    db.run(`
        UPDATE DOCUMENTACAO 
        SET empresa = ?, cnpj = ?, pgr_emissao = ?, pgr_vencimento = ?, pgr_status = ?, 
            pcmso_emissao = ?, pcmso_vencimento = ?, pcmso_status = ?, ativo = ?, DataAlteracao = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [empresa, cnpj, pgr_emissao, pgr_vencimento, pgr_status, pcmso_emissao, pcmso_vencimento, pcmso_status, ativo || 'S', id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ error: 'Documentação não encontrada' });
            return;
        }
        res.json({ message: 'Documentação atualizada com sucesso' });
    });
});

// DELETE - Excluir documentação
app.delete('/api/documentacao/:id', (req, res) => {
    const { id } = req.params;
    
    db.run('DELETE FROM DOCUMENTACAO WHERE id = ?', [id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ error: 'Documentação não encontrada' });
            return;
        }
        res.json({ message: 'Documentação excluída com sucesso' });
    });
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

app.post('/api/habilitar-cursos', (req, res) => {
    const { cursos } = req.body;
    
    if (!cursos || !Array.isArray(cursos)) {
        res.status(400).json({ error: 'Dados inválidos' });
        return;
    }
    
    const stmt = db.prepare('UPDATE HABILITAR_CURSOS SET habilitado = ? WHERE curso = ?');
    
    cursos.forEach(curso => {
        stmt.run([curso.habilitado, curso.curso], (err) => {
            if (err) {
                console.error('Erro ao atualizar curso:', err);
            }
        });
    });
    
    stmt.finalize((err) => {
        if (err) {
            console.error('Erro ao finalizar atualização:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Cursos atualizados com sucesso' });
    });
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

app.post('/api/configuracao-relatorio', (req, res) => {
    const { titulo, rodape, logo } = req.body;
    
    db.run(`UPDATE configuracao_relatorio SET titulo = ?, rodape = ?, logo = ? WHERE id = 1`, 
        [titulo || 'Relatório de Cursos', rodape || 'SSMA', logo || '/Logo-Hoss.jpg'], 
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (this.changes === 0) {
                // Se não atualizou, inserir
                db.run(`INSERT INTO configuracao_relatorio (titulo, rodape, logo) VALUES (?, ?, ?)`,
                    [titulo || 'Relatório de Cursos', rodape || 'SSMA', logo || '/Logo-Hoss.jpg'],
                    (err) => {
                        if (err) {
                            res.status(500).json({ error: err.message });
                            return;
                        }
                        res.json({ message: 'Configuração salva com sucesso' });
                    });
            } else {
                res.json({ message: 'Configuração salva com sucesso' });
            }
        });
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
    const { funcionario_id, data, status, observacao } = req.body;
    
    if (!funcionario_id || !data) {
        return res.status(400).json({ error: 'funcionario_id e data são obrigatórios' });
    }
    
    const sql = `
        INSERT INTO PRESENCA (funcionario_id, data, status, observacao)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(funcionario_id, data) DO UPDATE SET
            status = excluded.status,
            observacao = excluded.observacao
    `;
    
    db.run(sql, [funcionario_id, data, status || 'P', observacao || ''], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, id: this.lastID });
    });
});

// POST - Salvar múltiplas presenças de uma vez
app.post('/api/presenca/salvar-lote', (req, res) => {
    const { presencas } = req.body; // Array de { funcionario_id, data, status, observacao }
    
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
            
            // Buscar funcionários inativados que têm presença no mês
            if (idsComPresenca.length > 0) {
                const placeholders = idsComPresenca.map(() => '?').join(',');
                const sqlInativos = `SELECT id, Nome, Empresa, Funcao, Situacao FROM SSMA WHERE id IN (${placeholders}) AND Situacao = 'S'`;
                
                db.all(sqlInativos, idsComPresenca, (err3, inativos) => {
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
app.get('/api/controle-presenca/dados', (req, res) => {
    verificarResetMes();
    
    // Buscar dados do banco de dados em vez de memória
    const sql = `
        SELECT funcionarioId, dia, status, comentario
        FROM PRESENCA
        WHERE mesAno = ?
        ORDER BY funcionarioId, dia
    `;
    
    db.all(sql, [presencaMesAtual], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar dados de presença:', err);
            return res.status(500).json({ error: err.message });
        }
        
        // Converter para formato esperado pelo frontend
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
        
        console.log(`✅ Dados de presença carregados do banco: ${presencaMesAtual}`);
        res.json({ data: dados, comentarios: comentarios, mesAno: presencaMesAtual });
    });
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
app.post('/api/controle-presenca/marcar', (req, res) => {
    verificarResetMes();
    
    const { funcionarioId, funcionarioNome, funcionarioEmpresa, funcionarioFuncao, funcionarioSituacao, dia, status, isFolga } = req.body;
    
    if (!funcionarioId || !dia) {
        return res.status(400).json({ error: 'funcionarioId e dia são obrigatórios' });
    }
    
    const mesAno = presencaMesAtual;
    
    // Salvar no banco de dados
    if (status === '' || status === null) {
        // Se é folga, deletar o registro
        db.run(
            'DELETE FROM PRESENCA WHERE mesAno = ? AND funcionarioId = ? AND dia = ?',
            [mesAno, funcionarioId, dia],
            function(err) {
                if (err) {
                    console.error('❌ Erro ao deletar presença:', err);
                    return res.status(500).json({ error: err.message });
                }
                
                console.log(`✅ Presença deletada: ${funcionarioNome} - Dia ${dia}`);
                res.json({ success: true, mesAno: mesAno });
            }
        );
    } else {
        // Inserir ou atualizar presença
        db.run(
            `INSERT INTO PRESENCA 
            (mesAno, funcionarioId, funcionarioNome, funcionarioEmpresa, funcionarioFuncao, funcionarioSituacao, dia, status, formatacao)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(mesAno, funcionarioId, dia) DO UPDATE SET
                status = excluded.status,
                dataAtualizacao = CURRENT_TIMESTAMP`,
            [mesAno, funcionarioId, funcionarioNome, funcionarioEmpresa, funcionarioFuncao, funcionarioSituacao, dia, status, 'normal'],
            function(err) {
                if (err) {
                    console.error('❌ Erro ao salvar presença:', err);
                    return res.status(500).json({ error: err.message });
                }
                
                console.log(`✅ Presença salva: ${funcionarioNome} - Dia ${dia} - Status: ${status}`);
                res.json({ success: true, mesAno: mesAno });
            }
        );
    }
});

// POST - Salvar comentário de presença
app.post('/api/controle-presenca/comentario', (req, res) => {
    verificarResetMes();
    
    const { funcionarioId, dia, comentario } = req.body;
    
    if (!funcionarioId || !dia) {
        return res.status(400).json({ error: 'funcionarioId e dia são obrigatórios' });
    }
    
    const mesAno = presencaMesAtual;
    
    // Salvar no banco de dados
    if (comentario && comentario.trim()) {
        db.run(
            `INSERT INTO PRESENCA (mesAno, funcionarioId, dia, comentario, dataAtualizacao)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(mesAno, funcionarioId, dia) DO UPDATE SET
                comentario = excluded.comentario,
                dataAtualizacao = CURRENT_TIMESTAMP`,
            [mesAno, funcionarioId, dia, comentario.trim()],
            function(err) {
                if (err) {
                    console.error('❌ Erro ao salvar comentário:', err);
                    return res.status(500).json({ error: err.message });
                }
                
                console.log(`✅ Comentário salvo: Funcionário ${funcionarioId} - Dia ${dia}`);
                res.json({ success: true });
            }
        );
    } else {
        // Deletar comentário se vazio
        db.run(
            'UPDATE PRESENCA SET comentario = NULL WHERE mesAno = ? AND funcionarioId = ? AND dia = ?',
            [mesAno, funcionarioId, dia],
            function(err) {
                if (err) {
                    console.error('❌ Erro ao deletar comentário:', err);
                    return res.status(500).json({ error: err.message });
                }
                
                res.json({ success: true });
            }
        );
    }
});

// POST - Ocultar funcionário da lista de presença
app.post('/api/controle-presenca/ocultar', (req, res) => {
    verificarResetMes();
    
    const { funcionarioId } = req.body;
    
    if (!funcionarioId) {
        return res.status(400).json({ error: 'funcionarioId é obrigatório' });
    }
    
    // Salvar no banco de dados
    db.run(
        'INSERT OR IGNORE INTO FUNCIONARIOS_OCULTOS (funcionarioId) VALUES (?)',
        [funcionarioId],
        function(err) {
            if (err) {
                console.error('❌ Erro ao ocultar funcionário:', err);
                return res.status(500).json({ error: err.message });
            }
            
            console.log(`👁️ Funcionário ${funcionarioId} ocultado da lista de presença`);
            res.json({ success: true, message: 'Funcionário ocultado com sucesso' });
        }
    );
});

// POST - Mostrar funcionário na lista de presença
app.post('/api/controle-presenca/mostrar', (req, res) => {
    verificarResetMes();
    
    const { funcionarioId } = req.body;
    
    if (!funcionarioId) {
        return res.status(400).json({ error: 'funcionarioId é obrigatório' });
    }
    
    // Deletar do banco de dados
    db.run(
        'DELETE FROM FUNCIONARIOS_OCULTOS WHERE funcionarioId = ?',
        [funcionarioId],
        function(err) {
            if (err) {
                console.error('❌ Erro ao mostrar funcionário:', err);
                return res.status(500).json({ error: err.message });
            }
            
            console.log(`👁️ Funcionário ${funcionarioId} voltou a aparecer na lista de presença`);
            res.json({ success: true, message: 'Funcionário visível novamente' });
        }
    );
});

// GET - Listar funcionários ocultos
app.get('/api/controle-presenca/ocultos', (req, res) => {
    verificarResetMes();
    
    const ocultosMesAtual = funcionariosOcultos[presencaMesAtual] || {};
    const idsOcultos = Object.keys(ocultosMesAtual).filter(id => ocultosMesAtual[id]);
    
    if (idsOcultos.length === 0) {
        return res.json({ data: [], count: 0 });
    }
    
    // Buscar dados dos funcionários ocultos
    const placeholders = idsOcultos.map(() => '?').join(',');
    const sql = `SELECT id, Nome, Empresa, Funcao, Situacao FROM SSMA WHERE id IN (${placeholders})`;
    
    db.all(sql, idsOcultos, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ data: rows, count: rows.length });
    });
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
    
    try {
        const { titulo } = req.body;
        
        // Buscar funcionários ativos
        const funcionarios = await new Promise((resolve, reject) => {
            db.all(`SELECT id, Nome, Empresa, Funcao FROM SSMA WHERE Situacao = 'N' ORDER BY Empresa, Nome`, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
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
        headerRow.font = { bold: true };
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
        
        // Dados dos funcionários
        const dadosPresenca = presencaMemoria[presencaMesAtual] || {};
        const comentarios = comentariosPresenca[presencaMesAtual] || {};
        let rowIndex = 5;
        
        for (const func of funcionarios) {
            const row = sheet.getRow(rowIndex);
            const presencaFunc = dadosPresenca[func.id] || {};
            
            // Dados já estão em maiúsculo no banco
            row.getCell(1).value = func.Empresa || '';
            row.getCell(2).value = func.Nome || '';
            row.getCell(3).value = func.Funcao || '';
            
            let totalP = 0;
            let totalF = 0;
            
            for (let dia = 1; dia <= diasNoMes; dia++) {
                const dadosDia = presencaFunc[dia];
                let valorExibir = '';
                
                // Extrair o valor correto do objeto ou string
                if (typeof dadosDia === 'object' && dadosDia !== null) {
                    if (dadosDia.isFolga) {
                        valorExibir = '-'; // Folga = hífen
                    } else {
                        valorExibir = dadosDia.status || '';
                    }
                } else if (typeof dadosDia === 'string') {
                    valorExibir = dadosDia;
                }
                
                row.getCell(3 + dia).value = valorExibir;
                row.getCell(3 + dia).alignment = { horizontal: 'center' };
                
                // Verificar se tem comentário para esta célula
                const chaveComentario = `${func.id}_${dia}`;
                if (comentarios[chaveComentario] && comentarios[chaveComentario].texto) {
                    // Adicionar comentário como nota na célula
                    row.getCell(3 + dia).note = {
                        texts: [{ text: comentarios[chaveComentario].texto }],
                        margins: { insetmode: 'auto' }
                    };
                    // Adicionar borda laranja para indicar comentário
                    row.getCell(3 + dia).border = {
                        top: { style: 'medium', color: { argb: 'FFFF9800' } },
                        left: { style: 'medium', color: { argb: 'FFFF9800' } },
                        bottom: { style: 'medium', color: { argb: 'FFFF9800' } },
                        right: { style: 'medium', color: { argb: 'FFFF9800' } }
                    };
                }
                
                if (valorExibir === 'P') totalP++;
                if (valorExibir === 'F') totalF++;
                
                // Colorir baseado no status
                if (valorExibir === '-') {
                    // Folga - azul claro
                    row.getCell(3 + dia).fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FF87CEEB' }
                    };
                } else if (valorExibir === 'P') {
                    // Presente - verde claro
                    row.getCell(3 + dia).fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FF90EE90' }
                    };
                } else if (valorExibir === 'F') {
                    // Falta - vermelho claro
                    row.getCell(3 + dia).fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFF6B6B' }
                    };
                } else if (valorExibir === 'N') {
                    // Novo - laranja claro
                    row.getCell(3 + dia).fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFFD700' }
                    };
                } else if (valorExibir === 'A') {
                    // Atestado - azul
                    row.getCell(3 + dia).fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FF6495ED' }
                    };
                } else if (valorExibir === 'FE') {
                    // Férias - roxo
                    row.getCell(3 + dia).fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFBA55D3' }
                    };
                } else if (valorExibir === 'FO') {
                    // Folga programada - amarelo
                    row.getCell(3 + dia).fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFFFF00' }
                    };
                }
            }
            
            row.getCell(4 + diasNoMes).value = totalP;
            row.getCell(5 + diasNoMes).value = totalF;
            
            rowIndex++;
        }
        
        // Ajustar larguras
        sheet.getColumn(1).width = 20;
        sheet.getColumn(2).width = 30;
        sheet.getColumn(3).width = 20;
        for (let i = 4; i <= 3 + diasNoMes; i++) {
            sheet.getColumn(i).width = 4;
        }
        sheet.getColumn(4 + diasNoMes).width = 5;
        sheet.getColumn(5 + diasNoMes).width = 5;
        
        // Bordas
        for (let r = 4; r < rowIndex; r++) {
            for (let c = 1; c <= 5 + diasNoMes; c++) {
                const cell = sheet.getCell(r, c);
                // Só aplicar borda fina se não tiver borda de comentário (laranja)
                if (!cell.border || !cell.border.top || cell.border.top.style !== 'medium') {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                }
            }
        }
        
        // Criar aba de comentários se houver comentários
        const comentariosArray = Object.entries(comentarios);
        if (comentariosArray.length > 0) {
            const sheetComentarios = workbook.addWorksheet('Comentários');
            
            // Cabeçalho
            sheetComentarios.getRow(1).values = ['Funcionário', 'Empresa', 'Dia', 'Comentário', 'Data do Comentário'];
            sheetComentarios.getRow(1).font = { bold: true };
            sheetComentarios.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFF9800' }
            };
            
            let rowComentario = 2;
            for (const [chave, dados] of comentariosArray) {
                const [funcId, dia] = chave.split('_');
                const func = funcionarios.find(f => f.id == funcId);
                
                if (func && dados.texto) {
                    const row = sheetComentarios.getRow(rowComentario);
                    row.getCell(1).value = func.Nome || '';
                    row.getCell(2).value = func.Empresa || '';
                    row.getCell(3).value = parseInt(dia);
                    row.getCell(4).value = dados.texto;
                    row.getCell(5).value = dados.data ? new Date(dados.data).toLocaleString('pt-BR') : '';
                    rowComentario++;
                }
            }
            
            // Ajustar larguras
            sheetComentarios.getColumn(1).width = 35;
            sheetComentarios.getColumn(2).width = 20;
            sheetComentarios.getColumn(3).width = 8;
            sheetComentarios.getColumn(4).width = 50;
            sheetComentarios.getColumn(5).width = 20;
        }
        
        const buffer = await workbook.xlsx.writeBuffer();
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; charset=UTF-8');
        res.setHeader('Content-Disposition', `attachment; filename="Presenca_${meses[mes]}_${ano}.xlsx"`);
        res.send(buffer);
        
    } catch (error) {
        console.error('Erro ao exportar presença:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== ROTAS DE BACKUP E MANUTENÇÃO ====================

// ==================== ROTAS DE BACKUP E MANUTENÇÃO ====================

// Exportar backup completo
app.get('/api/backup/exportar', (req, res) => {
    const backup = {
        versao: '2.0',
        dataBackup: new Date().toISOString(),
        dados: {}
    };
    
    // Buscar funcionários
    db.all('SELECT * FROM SSMA', (err, funcionarios) => {
        if (err) {
            console.error('Erro ao buscar funcionários:', err);
            return res.status(500).json({ error: 'Erro ao buscar funcionários: ' + err.message });
        }
        
        // CONVERTER FOTOS (BLOB) PARA BASE64 PARA SALVAR NO JSON
        backup.dados.funcionarios = (funcionarios || []).map(f => {
            const func = { ...f };
            if (func.Foto) {
                // Se é Buffer, converter para base64
                if (Buffer.isBuffer(func.Foto)) {
                    func.Foto = func.Foto.toString('base64');
                }
                // Se é objeto {type: 'Buffer', data: [...]}, converter
                else if (func.Foto.type === 'Buffer' && Array.isArray(func.Foto.data)) {
                    func.Foto = Buffer.from(func.Foto.data).toString('base64');
                }
            }
            return func;
        });
        
        // Buscar fornecedores (tabela FORNECEDOR)
        db.all('SELECT * FROM FORNECEDOR', (err, fornecedores) => {
            if (err) {
                console.error('Erro ao buscar fornecedores:', err);
            }
            backup.dados.fornecedores = fornecedores || [];
            
            // Buscar documentação (tabela DOCUMENTACAO)
            db.all('SELECT * FROM DOCUMENTACAO', (err, documentacao) => {
                if (err) {
                    console.error('Erro ao buscar documentação:', err);
                }
                backup.dados.documentacao = documentacao || [];
                
                // Buscar configuração
                db.get('SELECT * FROM configuracao_relatorio WHERE id = 1', (err, config) => {
                    if (err) {
                        console.error('Erro ao buscar configuração:', err);
                    }
                    backup.dados.configuracao = config || {};
                    
                    // Buscar cursos habilitados
                    db.all('SELECT * FROM habilitar_cursos', (err, cursos) => {
                        if (err) {
                            console.error('Erro ao buscar cursos habilitados:', err);
                        }
                        backup.dados.cursosHabilitados = cursos || [];
                        
                        // INCLUIR DADOS DE PRESENÇA NO BACKUP (MEMÓRIA + BANCO)
                        backup.dados.presenca = {
                            presencaMemoria: presencaMemoria,
                            comentariosPresenca: comentariosPresenca,
                            ocorrenciasPresenca: ocorrenciasPresenca,
                            funcionariosOcultos: funcionariosOcultos,
                            presencaMesAtual: presencaMesAtual
                        };
                        
                        // BUSCAR DADOS DA TABELA PRESENCA DO BANCO
                        db.all('SELECT * FROM PRESENCA', (err, presencaBanco) => {
                            if (err) {
                                console.error('Erro ao buscar presença do banco:', err);
                            }
                            backup.dados.presencaBanco = presencaBanco || [];
                            
                            console.log('✅ Backup gerado com sucesso:', {
                                funcionarios: backup.dados.funcionarios.length,
                                fornecedores: backup.dados.fornecedores.length,
                                documentacao: backup.dados.documentacao.length,
                                cursosHabilitados: backup.dados.cursosHabilitados.length,
                                presenca: backup.dados.presenca ? 'INCLUÍDO' : 'NÃO',
                                presencaBanco: backup.dados.presencaBanco.length + ' registros'
                            });
                            
                            res.json(backup);
                        });
                    });
                });
            });
        });
    });
});

// Restaurar backup - VERSÃO ROBUSTA COM PROMISES
app.post('/api/backup/restaurar', async (req, res) => {
    console.log('📥 Recebendo requisição de restauração...');
    console.log('   Content-Type:', req.headers['content-type']);
    console.log('   Content-Length:', req.headers['content-length']);
    
    const backup = req.body;
    
    if (!backup) {
        console.log('❌ Backup vazio ou undefined');
        return res.status(400).json({ success: false, error: 'Nenhum dado de backup recebido' });
    }
    
    if (!backup.dados) {
        console.log('❌ Backup sem propriedade "dados"');
        console.log('   Chaves recebidas:', Object.keys(backup));
        return res.status(400).json({ success: false, error: 'Arquivo de backup inválido - falta propriedade "dados"' });
    }
    
    console.log('🔄 Iniciando restauração de backup...');
    console.log('   Funcionários:', backup.dados.funcionarios?.length || 0);
    console.log('   Fornecedores:', backup.dados.fornecedores?.length || 0);
    console.log('   Documentação:', backup.dados.documentacao?.length || 0);
    console.log('   Presença:', backup.dados.presenca ? 'SIM' : 'NÃO');
    
    let erros = [];
    let restaurados = { funcionarios: 0, fornecedores: 0, documentacao: 0, presenca: false };
    
    try {
        // Limpar tabelas
        await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('DELETE FROM SSMA');
                db.run('DELETE FROM FORNECEDOR');
                db.run('DELETE FROM DOCUMENTACAO');
                db.run("DELETE FROM sqlite_sequence WHERE name='SSMA'");
                db.run("DELETE FROM sqlite_sequence WHERE name='FORNECEDOR'");
                db.run("DELETE FROM sqlite_sequence WHERE name='DOCUMENTACAO'", resolve);
            });
        });
        
        console.log('✅ Tabelas limpas');
        
        // Restaurar funcionários
        if (backup.dados.funcionarios && backup.dados.funcionarios.length > 0) {
            for (const f of backup.dados.funcionarios) {
                try {
                    const funcionario = { ...f };
                    
                    // Converter foto
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
                    
                    await new Promise((resolve, reject) => {
                        db.run(`INSERT INTO SSMA (${colunas.join(', ')}) VALUES (${placeholders})`, valores, function(err) {
                            if (err) reject(err);
                            else {
                                restaurados.funcionarios++;
                                resolve();
                            }
                        });
                    });
                } catch (err) {
                    erros.push('Funcionário ' + f.Nome + ': ' + err.message);
                }
            }
        }
        
        console.log('✅ Funcionários restaurados:', restaurados.funcionarios);
        
        // Restaurar fornecedores
        if (backup.dados.fornecedores && backup.dados.fornecedores.length > 0) {
            for (const f of backup.dados.fornecedores) {
                try {
                    const colunas = Object.keys(f);
                    const valores = Object.values(f);
                    const placeholders = colunas.map(() => '?').join(', ');
                    
                    await new Promise((resolve, reject) => {
                        db.run(`INSERT INTO FORNECEDOR (${colunas.join(', ')}) VALUES (${placeholders})`, valores, function(err) {
                            if (err) reject(err);
                            else {
                                restaurados.fornecedores++;
                                resolve();
                            }
                        });
                    });
                } catch (err) {
                    erros.push('Fornecedor ' + f.Empresa + ': ' + err.message);
                }
            }
        }
        
        console.log('✅ Fornecedores restaurados:', restaurados.fornecedores);
        
        // Restaurar documentação
        if (backup.dados.documentacao && backup.dados.documentacao.length > 0) {
            for (const d of backup.dados.documentacao) {
                try {
                    const colunas = Object.keys(d);
                    const valores = Object.values(d);
                    const placeholders = colunas.map(() => '?').join(', ');
                    
                    await new Promise((resolve, reject) => {
                        db.run(`INSERT INTO DOCUMENTACAO (${colunas.join(', ')}) VALUES (${placeholders})`, valores, function(err) {
                            if (err) reject(err);
                            else {
                                restaurados.documentacao++;
                                resolve();
                            }
                        });
                    });
                } catch (err) {
                    erros.push('Documentação ' + d.empresa + ': ' + err.message);
                }
            }
        }
        
        console.log('✅ Documentação restaurada:', restaurados.documentacao);
        
        // Restaurar cursos habilitados
        if (backup.dados.cursosHabilitados && backup.dados.cursosHabilitados.length > 0) {
            await new Promise((resolve) => {
                db.run('DELETE FROM habilitar_cursos', resolve);
            });
            
            for (const c of backup.dados.cursosHabilitados) {
                const colunas = Object.keys(c);
                const valores = Object.values(c);
                const placeholders = colunas.map(() => '?').join(', ');
                await new Promise((resolve) => {
                    db.run(`INSERT INTO habilitar_cursos (${colunas.join(', ')}) VALUES (${placeholders})`, valores, resolve);
                });
            }
        }
        
        // Restaurar configuração
        if (backup.dados.configuracao && Object.keys(backup.dados.configuracao).length > 0) {
            const config = backup.dados.configuracao;
            await new Promise((resolve) => {
                db.run('DELETE FROM configuracao_relatorio WHERE id = 1', resolve);
            });
            
            const colunas = Object.keys(config);
            const valores = Object.values(config);
            const placeholders = colunas.map(() => '?').join(', ');
            await new Promise((resolve) => {
                db.run(`INSERT INTO configuracao_relatorio (${colunas.join(', ')}) VALUES (${placeholders})`, valores, resolve);
            });
        }
        
        // Restaurar presença (MEMÓRIA + BANCO)
        if (backup.dados.presenca) {
            try {
                // Restaurar dados em memória
                presencaMemoria = backup.dados.presenca.presencaMemoria || {};
                comentariosPresenca = backup.dados.presenca.comentariosPresenca || {};
                ocorrenciasPresenca = backup.dados.presenca.ocorrenciasPresenca || {};
                funcionariosOcultos = backup.dados.presenca.funcionariosOcultos || {};
                presencaMesAtual = backup.dados.presenca.presencaMesAtual || getMesAnoAtual();
                salvarDadosPresenca();
                
                // Restaurar tabela PRESENCA do banco
                if (backup.dados.presencaBanco && backup.dados.presencaBanco.length > 0) {
                    // Limpar tabela PRESENCA
                    await new Promise((resolve) => {
                        db.run('DELETE FROM PRESENCA', resolve);
                    });
                    
                    // Inserir registros
                    for (const p of backup.dados.presencaBanco) {
                        const colunas = Object.keys(p);
                        const valores = Object.values(p);
                        const placeholders = colunas.map(() => '?').join(', ');
                        await new Promise((resolve) => {
                            db.run(`INSERT INTO PRESENCA (${colunas.join(', ')}) VALUES (${placeholders})`, valores, resolve);
                        });
                    }
                    console.log(`✅ Presença do banco restaurada: ${backup.dados.presencaBanco.length} registros`);
                }
                
                restaurados.presenca = true;
                console.log('✅ Presença restaurada (memória + banco)');
            } catch (err) {
                erros.push('Erro ao restaurar presença: ' + err.message);
            }
        }
        
        console.log('✅ Restauração concluída:', restaurados);
        if (erros.length > 0) {
            console.log('⚠️ Erros:', erros);
        }
        
        res.json({ 
            success: true, 
            message: 'Backup restaurado com sucesso',
            restaurados: restaurados,
            erros: erros.length > 0 ? erros : undefined
        });
        
    } catch (err) {
        console.error('❌ Erro na restauração:', err);
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao restaurar backup: ' + err.message,
            restaurados: restaurados
        });
    }
});

// Zerar funcionários
app.delete('/api/backup/zerar/funcionarios', (req, res) => {
    db.serialize(() => {
        db.run('DELETE FROM SSMA', function(err) {
            if (err) return res.status(500).json({ success: false, error: err.message });
            
            db.run("DELETE FROM sqlite_sequence WHERE name='SSMA'", function(err) {
                if (err) console.log('Erro ao resetar sequence:', err);
                res.json({ success: true, message: 'Funcionários zerados com sucesso' });
            });
        });
    });
});

// Zerar fornecedores
app.delete('/api/backup/zerar/fornecedores', (req, res) => {
    db.serialize(() => {
        db.run('DELETE FROM FORNECEDOR', function(err) {
            if (err) return res.status(500).json({ success: false, error: err.message });
            
            db.run("DELETE FROM sqlite_sequence WHERE name='FORNECEDOR'", function(err) {
                if (err) console.log('Erro ao resetar sequence:', err);
                res.json({ success: true, message: 'Fornecedores zerados com sucesso' });
            });
        });
    });
});

// Zerar documentação
app.delete('/api/backup/zerar/documentacao', (req, res) => {
    db.serialize(() => {
        db.run('DELETE FROM DOCUMENTACAO', function(err) {
            if (err) return res.status(500).json({ success: false, error: err.message });
            
            db.run("DELETE FROM sqlite_sequence WHERE name='DOCUMENTACAO'", function(err) {
                if (err) console.log('Erro ao resetar sequence:', err);
                res.json({ success: true, message: 'Documentação zerada com sucesso' });
            });
        });
    });
});

// Zerar lista de presença
app.delete('/api/backup/zerar/presenca', (req, res) => {
    try {
        // Limpar dados em memória
        presencaMemoria = {};
        comentariosPresenca = {};
        funcionariosOcultos = {};
        presencaMesAtual = getMesAnoAtual();
        
        // Salvar arquivo vazio
        salvarDadosPresenca();
        
        console.log('✅ Lista de presença zerada com sucesso');
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
app.get('/api/tabela-mes/monitoramento', (req, res) => {
    verificarResetMes();

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

    // Buscar dados do banco para essa janela
    const mesesLista = Array.from(mesesParaBuscar).map(m => `'${m}'`).join(',');

    const sqlTodasFuncoes = `
        SELECT DISTINCT funcionarioFuncao as funcao 
        FROM PRESENCA 
        WHERE mesAno IN (${mesesLista})
        ORDER BY funcionarioFuncao
    `;

    const sqlFuncao = `
        SELECT p.mesAno, p.funcionarioFuncao as funcao, p.dia,
               SUM(CASE WHEN p.status = 'P' THEN 1 ELSE 0 END) as totalPresenca,
               SUM(CASE WHEN p.status = 'F' THEN 1 ELSE 0 END) as totalFalta
        FROM PRESENCA p
        WHERE p.mesAno IN (${mesesLista})
        GROUP BY p.mesAno, p.funcionarioFuncao, p.dia
        ORDER BY funcao, p.mesAno, p.dia
    `;

    const sqlEmpresa = `
        SELECT p.mesAno, p.funcionarioEmpresa as empresa, p.dia,
               SUM(CASE WHEN p.status = 'P' THEN 1 ELSE 0 END) as totalPresenca,
               SUM(CASE WHEN p.status = 'F' THEN 1 ELSE 0 END) as totalFalta
        FROM PRESENCA p
        WHERE p.mesAno IN (${mesesLista}) AND p.funcionarioEmpresa NOT IN (
            SELECT empresaOculta FROM EMPRESAS_OCULTAS
        )
        GROUP BY p.mesAno, p.funcionarioEmpresa, p.dia
        ORDER BY empresa, p.mesAno, p.dia
    `;

    const sqlTodasEmpresas = `
        SELECT DISTINCT funcionarioEmpresa as empresa 
        FROM PRESENCA 
        WHERE mesAno IN (${mesesLista}) AND funcionarioEmpresa NOT IN (
            SELECT empresaOculta FROM EMPRESAS_OCULTAS
        )
        ORDER BY funcionarioEmpresa
    `;

    db.all(sqlFuncao, [], (err, funcaoRows) => {
        if (err) return res.status(500).json({ error: err.message });

        db.all(sqlTodasFuncoes, [], (err, todasFuncoesRows) => {
            if (err) return res.status(500).json({ error: err.message });

            db.all(sqlEmpresa, [], (err, empresaRows) => {
                if (err) return res.status(500).json({ error: err.message });

                db.all(sqlTodasEmpresas, [], (err, todasEmpresasRows) => {
                    if (err) return res.status(500).json({ error: err.message });

                    // Criar mapa de índice (0-30 para 31 dias)
                    const mapaIndice = {};
                    datasJanela.forEach((dt, idx) => {
                        mapaIndice[`${dt.mesAno}-${dt.dia}`] = idx;
                    });

                    // Montar os arrays de 31 posições
                    const funcaoPorDia = {};
                    const faltasPorFuncaoPorDia = {};
                    const funcoesUnicas = new Set();

                    // Inicializar com 31 posições
                    todasFuncoesRows.forEach(row => {
                        if (row.funcao) {
                            funcoesUnicas.add(row.funcao);
                            funcaoPorDia[row.funcao] = Array(31).fill(0);
                            faltasPorFuncaoPorDia[row.funcao] = Array(31).fill(0);
                        }
                    });

                    // Preencher com dados reais do banco
                    funcaoRows.forEach(row => {
                        funcoesUnicas.add(row.funcao);
                        if (!funcaoPorDia[row.funcao]) {
                            funcaoPorDia[row.funcao] = Array(31).fill(0);
                            faltasPorFuncaoPorDia[row.funcao] = Array(31).fill(0);
                        }

                        const idx = mapaIndice[`${row.mesAno}-${row.dia}`];
                        if (idx !== undefined) {
                            funcaoPorDia[row.funcao][idx] = row.totalPresenca;
                            faltasPorFuncaoPorDia[row.funcao][idx] = row.totalFalta;
                        }
                    });

                    // Montar dados de empresa
                    const empresaPorDia = {};
                    const faltasPorEmpresaPorDia = {};
                    const empresasUnicas = new Set();

                    // Inicializar com 31 posições
                    todasEmpresasRows.forEach(row => {
                        if (row.empresa) {
                            empresasUnicas.add(row.empresa);
                            empresaPorDia[row.empresa] = Array(31).fill(0);
                            faltasPorEmpresaPorDia[row.empresa] = Array(31).fill(0);
                        }
                    });

                    // Preencher com dados reais do banco
                    empresaRows.forEach(row => {
                        empresasUnicas.add(row.empresa);
                        if (!empresaPorDia[row.empresa]) {
                            empresaPorDia[row.empresa] = Array(31).fill(0);
                            faltasPorEmpresaPorDia[row.empresa] = Array(31).fill(0);
                        }

                        const idx = mapaIndice[`${row.mesAno}-${row.dia}`];
                        if (idx !== undefined) {
                            empresaPorDia[row.empresa][idx] = row.totalPresenca;
                            faltasPorEmpresaPorDia[row.empresa][idx] = row.totalFalta;
                        }
                    });

                    // Calcular totais por coluna (dia)
                    const totalPorDiaFuncao = Array(31).fill(0);
                    const totalPorDiaEmpresa = Array(31).fill(0);

                    // Somar totais por dia para funções
                    Array.from(funcoesUnicas).forEach(funcao => {
                        for (let i = 0; i < 31; i++) {
                            totalPorDiaFuncao[i] += funcaoPorDia[funcao][i];
                        }
                    });

                    // Somar totais por dia para empresas
                    Array.from(empresasUnicas).forEach(empresa => {
                        for (let i = 0; i < 31; i++) {
                            totalPorDiaEmpresa[i] += empresaPorDia[empresa][i];
                        }
                    });

                    // Retornar resposta
                    res.json({
                        datas: datasJanela,
                        funcaoPorDia: funcaoPorDia,
                        empresaPorDia: empresaPorDia,
                        faltasPorFuncaoPorDia: faltasPorFuncaoPorDia,
                        faltasPorEmpresaPorDia: faltasPorEmpresaPorDia,
                        funcoesUnicas: Array.from(funcoesUnicas).sort(),
                        empresasUnicas: Array.from(empresasUnicas).sort(),
                        totalPorDiaFuncao: totalPorDiaFuncao,
                        totalPorDiaEmpresa: totalPorDiaEmpresa,
                        totalDias: 31,
                        janelaInicio: dataInicio.toLocaleDateString('pt-BR'),
                        janelaFim: hoje.toLocaleDateString('pt-BR'),
                        dataInicio: dataInicio,
                        dataFim: hoje,
                        timestamp: new Date().getTime()
                    });
                });
            });
        });
    });
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

// Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Conexão com banco fechada.');
        process.exit(0);
    });
});

// ROTAS PARA TABELAS AUXILIARES (Dropdowns)

// GET - Listar nomes únicos
app.get('/api/nomes', (req, res) => {
    db.all('SELECT DISTINCT Nome FROM SSMA WHERE Nome IS NOT NULL AND Nome != "" ORDER BY Nome', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows.map(row => row.Nome));
    });
});

// GET - Listar empresas únicas
app.get('/api/empresas', (req, res) => {
    // Buscar empresas da tabela FORNECEDOR (só ativos)
    db.all('SELECT DISTINCT Empresa FROM FORNECEDOR WHERE Situacao = "S" AND Empresa IS NOT NULL AND Empresa != "" ORDER BY Empresa', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows.map(row => row.Empresa));
    });
});

// GET - Listar funções únicas
app.get('/api/funcoes', (req, res) => {
    db.all('SELECT DISTINCT Funcao FROM SSMA WHERE Funcao IS NOT NULL AND Funcao != "" ORDER BY Funcao', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows.map(row => row.Funcao));
    });
});


