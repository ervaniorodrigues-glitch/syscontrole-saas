// ==================== CERTIFICADO NR-11 ====================

SysControleWeb.prototype.toggleCert11Page = function(delta) {
    this.cert11_page = (this.cert11_page === 0) ? 1 : 0;
    this.renderCertNR11();
};

SysControleWeb.prototype.abrirCertNR11 = async function() {
    if (!this.editingId) {
        if (typeof this.showToast === 'function') {
            this.showToast('Selecione um cadastro primeiro', 'warning');
        } else {
            alert('Selecione um cadastro primeiro');
        }
        return;
    }

    // Validação de Data de Emissão (Obrigatória)
    const dataEmi = document.getElementById('nr11_dataEmissao')?.value;
    if (!dataEmi) {
        if (typeof this.showToast === 'function') {
            this.showToast('Por favor, informe a Data de Emissão para gerar o documento.', 'error');
        } else {
            alert('Preencha a Data de Emissão primeiro!');
        }
        return;
    }
    
    // Carregar configuração da NR-11 (Tenta servidor, cai no localStorage)
    let cfg = JSON.parse(localStorage.getItem('cfg_nr11') || '{}');
    try {
        const response = await fetch('/api/config/nr/nr11');
        const resJson = await response.json();
        if (resJson.success && resJson.dados) {
            cfg = resJson.dados;
            localStorage.setItem('cfg_nr11', JSON.stringify(cfg));
        }
    } catch (e) { console.error('Erro ao buscar config NR11 do servidor:', e); }

    document.getElementById('cfg11_instrutor').value       = cfg.instrutor || '';
    document.getElementById('cfg11_cargo_instrutor').value = cfg.cargo_instrutor || '';
    document.getElementById('cfg11_reg_instrutor').value   = cfg.reg_instrutor || '';
    document.getElementById('cfg11_responsavel').value     = cfg.responsavel || '';
    document.getElementById('cfg11_cargo_resp').value      = cfg.cargo_resp || '';
    document.getElementById('cfg11_reg_resp').value        = cfg.reg_resp || '';
    document.getElementById('cfg11_local').value           = cfg.local || 'Refeitório';
    document.getElementById('cfg11_uf').value              = cfg.uf || 'SP';
    document.getElementById('cfg11_nome_treinamento').value = cfg.nome_treinamento || '';
    const logoInput = document.getElementById('cfg11_logo');
    const logoPreview = document.getElementById('cfg11_logo_preview');
    if (logoInput) logoInput.value = cfg.logo || '';
    if (logoPreview) logoPreview.src = cfg.logo || '/Logo-Hoss.jpg';
    document.getElementById('cert11_num').value            = localStorage.getItem('cert11_ultimo_num') || '';
    
    const modal = document.getElementById('modalCertNR11');
    if (modal) modal.style.display = 'block';
    
    this.cert11_page = 0; // Reset to front page
    this.renderCertNR11();
};

SysControleWeb.prototype.abrirCfgNR11 = async function() {
    // Carregar configuração da NR-11 (Tenta servidor, cai no localStorage)
    let cfg = JSON.parse(localStorage.getItem('cfg_nr11') || '{}');
    try {
        const response = await fetch('/api/config/nr/nr11');
        const resJson = await response.json();
        if (resJson.success && resJson.dados) {
            cfg = resJson.dados;
            localStorage.setItem('cfg_nr11', JSON.stringify(cfg));
        }
    } catch (e) { console.error('Erro ao buscar config NR11 do servidor:', e); }

    document.getElementById('cfg11_instrutor').value       = cfg.instrutor || '';
    document.getElementById('cfg11_cargo_instrutor').value = cfg.cargo_instrutor || '';
    document.getElementById('cfg11_reg_instrutor').value   = cfg.reg_instrutor || '';
    document.getElementById('cfg11_responsavel').value     = cfg.responsavel || '';
    document.getElementById('cfg11_cargo_resp').value      = cfg.cargo_resp || '';
    document.getElementById('cfg11_reg_resp').value        = cfg.reg_resp || '';
    document.getElementById('cfg11_local').value           = cfg.local || 'Refeitório';
    document.getElementById('cfg11_uf').value              = cfg.uf || 'SP';
    document.getElementById('cfg11_nome_treinamento').value = cfg.nome_treinamento || '';
    const logoInput = document.getElementById('cfg11_logo');
    const logoPreview = document.getElementById('cfg11_logo_preview');
    if (logoInput) logoInput.value = cfg.logo || '';
    if (logoPreview) logoPreview.src = cfg.logo || '/Logo-Hoss.jpg';
    
    // Novos campos de modelos de texto
    const defOp = "Certificamos que o Sr. {{NOME}}, portador do CPF: {{CPF}}, frequentou e concluiu satisfatoriamente o <strong><u>Treinamento de Segurança na Operação de Equipamentos de Movimentação de Carga</u></strong>, com dura&ccedil;&atilde;o de {{HORAS}} em atendimento &agrave; NR 11 da Portaria N&ordm; 3214/78, do Minist&eacute;rio do Trabalho.";
    const defGen = "Certificamos que o Sr. {{NOME}}, portador do CPF: {{CPF}}, frequentou e concluiu satisfatoriamente o treinamento para <strong><u>{{FUNCAO}}</u></strong>, com dura&ccedil;&atilde;o de {{HORAS}} em atendimento &agrave; NR 11 da Portaria N&ordm; 3214/78, do Minist&eacute;rio do Trabalho.";

    let txt_op = cfg.txt_operador || '';
    if (txt_op.length < 20) txt_op = defOp;

    let txt_gen = cfg.txt_geral || '';
    if (txt_gen.length < 20) txt_gen = defGen;

    document.getElementById('cfg11_txt_operador').value = txt_op;
    document.getElementById('cfg11_txt_geral').value = txt_gen;
    const modeloTipo = cfg.modelo_tipo || '2';
    if (modeloTipo === '1') document.getElementById('cfg11_radio_op').checked = true;
    else if (modeloTipo === '3') {
        const radRec = document.getElementById('cfg11_radio_recicle');
        if(radRec) radRec.checked = true;
    }
    else document.getElementById('cfg11_radio_geral').checked = true;

    // Campo Data Fim
    const inputDataFim = document.getElementById('cfg11_data_fim');
    if (inputDataFim) inputDataFim.value = cfg.data_fim || '';

    // Carregar lista de anos
    this.cfg11_anos = cfg.anos || [new Date().getFullYear()];
    this.cfg11_ano_selecionado = cfg.ano_selecionado || new Date().getFullYear();
    this.atualizarListaAnos11();
    
    const modal = document.getElementById('modalCfgNR11');
    if (modal) modal.style.display = 'block';
};

SysControleWeb.prototype.adicionarAno11 = function() {
    const input = document.getElementById('cfg11_novo_ano');
    const ano = parseInt(input.value);
    if (!ano || ano < 1900 || ano > 2100) {
        if (typeof this.showToast === 'function') this.showToast('Ano inválido', 'error');
        return;
    }
    if (this.cfg11_anos.includes(ano)) {
        if (typeof this.showToast === 'function') this.showToast('Ano já existe', 'warning');
        return;
    }
    this.cfg11_anos.push(ano);
    this.cfg11_anos.sort((a,b) => b - a);
    this.cfg11_ano_selecionado = ano;
    input.value = '';
    this.atualizarListaAnos11();
};

SysControleWeb.prototype.removerAnoSelecionado11 = function() {
    const select = document.getElementById('cfg11_ano_ativo');
    const ano = parseInt(select.value);
    if (!ano) return;
    if (confirm(`Tem certeza que deseja excluir o ano ${ano} da lista?`)) {
        this.removerAno11(ano);
    }
};

SysControleWeb.prototype.removerAno11 = function(ano) {
    const anoNum = Number(ano);
    this.cfg11_anos = this.cfg11_anos.filter(a => Number(a) !== anoNum);
    if (Number(this.cfg11_ano_selecionado) === anoNum) {
        this.cfg11_ano_selecionado = this.cfg11_anos[0] || new Date().getFullYear();
    }
    this.atualizarListaAnos11();
    if (typeof this.showToast === 'function') this.showToast('Ano removido da lista!', 'info');
};

SysControleWeb.prototype.atualizarListaAnos11 = function() {
    const select = document.getElementById('cfg11_ano_ativo');
    if (!select) return;
    select.innerHTML = '';
    this.cfg11_anos.forEach(ano => {
        const opt = document.createElement('option');
        opt.value = ano;
        opt.textContent = ano;
        if (parseInt(ano) === parseInt(this.cfg11_ano_selecionado)) opt.selected = true;
        select.appendChild(opt);
    });
};

SysControleWeb.prototype.salvarCfgNR11 = async function() {
    const anoAtivo = parseInt(document.getElementById('cfg11_ano_ativo').value);
    const cfgData = {
        instrutor:       document.getElementById('cfg11_instrutor').value,
        cargo_instrutor: document.getElementById('cfg11_cargo_instrutor').value,
        reg_instrutor:   document.getElementById('cfg11_reg_instrutor').value,
        responsavel:     document.getElementById('cfg11_responsavel').value,
        cargo_resp:      document.getElementById('cfg11_cargo_resp').value,
        reg_resp:        document.getElementById('cfg11_reg_resp').value,
        local:           document.getElementById('cfg11_local').value,
        uf:              document.getElementById('cfg11_uf').value,
        logo:            document.getElementById('cfg11_logo').value,
        txt_operador:    document.getElementById('cfg11_txt_operador').value,
        txt_geral:       document.getElementById('cfg11_txt_geral').value,
        modelo_tipo:     document.querySelector('input[name="cfg11_modelo_tipo"]:checked')?.value || '2',
        data_fim:        document.getElementById('cfg11_data_fim')?.value || '',
        anos:            this.cfg11_anos,
        ano_selecionado: anoAtivo,
        nome_treinamento: document.getElementById('cfg11_nome_treinamento').value
    };

    // Salva no localStorage para velocidade
    localStorage.setItem('cfg_nr11', JSON.stringify(cfgData));
    
    // Salva no SERVIDOR para persistência e backup (Crítico)
    try {
        await fetch('/api/config/nr/nr11', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dados: cfgData })
        });
    } catch (e) {
        console.error('Erro ao salvar config NR11 no servidor:', e);
    }
    
    const modal = document.getElementById('modalCfgNR11');
    if (modal) modal.style.display = 'none';
    
    if (typeof this.showToast === 'function') {
        this.showToast('Configuração salva com sucesso!', 'success');
    }
    
    // Atualizar previews
    this.renderCertNR11();
    this.renderLPTNR11();
};


SysControleWeb.prototype.processarLogoUpload11 = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const logoInput = document.getElementById('cfg11_logo');
            const logoPreview = document.getElementById('cfg11_logo_preview');
            if (logoInput) logoInput.value = e.target.result;
            if (logoPreview) logoPreview.src = e.target.result;
            
            if (typeof this.showToast === 'function') {
                this.showToast('Logo selecionado!', 'success');
            }
        };
        reader.readAsDataURL(input.files[0]);
    }
};

SysControleWeb.prototype.renderCertNR11 = function() {
    const nome   = this._corrigirTexto((document.getElementById('nome')?.value || '').toUpperCase());
    const cpf    = document.getElementById('cpf')?.value || '';
    const funcao = this._corrigirTexto((document.getElementById('funcao')?.value || '').toUpperCase());
    const numero = document.getElementById('cert11_num')?.value || '___';
    if (numero !== '___') localStorage.setItem('cert11_ultimo_num', numero);
    const dataEmissao = document.getElementById('nr11_dataEmissao')?.value || '';

    const cfg = JSON.parse(localStorage.getItem('cfg_nr11') || '{}');
    
    const instrutor      = this._corrigirTexto(cfg.instrutor      || '_______________________');
    const cargoInstrutor = this._corrigirTexto(cfg.cargo_instrutor || 'Tecnico em Seguranca do Trabalho');
    const regInstrutor   = this._corrigirTexto(cfg.reg_instrutor   || '');
    const responsavel    = this._corrigirTexto(cfg.responsavel     || '_______________________');
    const cargoResp      = this._corrigirTexto(cfg.cargo_resp      || 'Eng. de Seguranca do Trabalho');
    const regResp        = this._corrigirTexto(cfg.reg_resp        || '');
    const local          = this._corrigirTexto(cfg.local           || 'Guarulhos');
    const uf             = this._corrigirTexto(cfg.uf              || 'SP');
    const logoFile       = cfg.logo            || '/Logo-Hoss.jpg';

    // Modelos de texto
    let certBodyTemplate = '';
    const modeloTipo = cfg.modelo_tipo || '2';
    if (modeloTipo === '1') {
        certBodyTemplate = cfg.txt_operador || '';
    } else {
        certBodyTemplate = cfg.txt_geral || '';
    }

    // Fallback se não houver texto configurado
    if (!certBodyTemplate || certBodyTemplate.trim().length < 20) {
        if (modeloTipo === '1') {
            certBodyTemplate = `Certificamos que o Sr. {{NOME}}, portador do CPF: {{CPF}}, frequentou e concluiu satisfatoriamente o <strong><u>Treinamento de Segurança na Operação de Equipamentos de Movimentação de Carga</u></strong>, com dura&ccedil;&atilde;o de <strong>{{HORAS}}</strong> em atendimento &agrave; <strong>NR 11</strong> da Portaria N&ordm; 3214/78, do Minist&eacute;rio do Trabalho.`;
        } else {
            certBodyTemplate = `Certificamos que o Sr. {{NOME}}, portador do CPF: {{CPF}}, frequentou e concluiu satisfatoriamente o treinamento para <strong><u>{{FUNCAO}}</u></strong>, com dura&ccedil;&atilde;o de <strong>{{HORAS}}</strong> em atendimento &agrave; <strong>NR 11</strong> da Portaria N&ordm; 3214/78, do Minist&eacute;rio do Trabalho.`;
        }
    }

    const hoje = new Date();
    const dia  = String(hoje.getDate()).padStart(2,'0');
    const mes  = String(hoje.getMonth()+1).padStart(2,'0');
    const ano  = cfg.ano_selecionado || hoje.getFullYear();
    
    // --- LÓGICA DE EXIBIÇÃO DE DATA (COM DATA FIM) ---
    const dataFimCfg = cfg.data_fim || '';
    let dataExibir = dataEmissao || (dia+'/'+mes+'/'+ano);
    if (dataFimCfg && dataFimCfg.trim() !== '' && dataFimCfg !== dataEmissao) {
        dataExibir = `${dataEmissao} à ${dataFimCfg}`;
    }


    const horasNecessarias = modeloTipo === '1' ? 32 : (modeloTipo === '3' ? 4 : 8);
    const diasNecessarios = Math.ceil(horasNecessarias / 8); 
    const horasTexto = horasNecessarias + ' horas';
    
    let certBodyFinal = certBodyTemplate
        .replace(/<strong>NR 11<\/strong>/gi, 'NR 11')
        .replace(/<strong>{{HORAS}}<\/strong>/gi, '{{HORAS}}')
        .replace(/{{NOME}}|\bNOME\b/g, `<strong style="color:#000;">${nome}</strong>`)
        .replace(/{{CPF}}|000\.000\.000\-00/g, `<strong style="color:#000;">${cpf}</strong>`)
        .replace(/{{FUNCAO}}|OPERADOR DE EQUIPAMENTOS DE MOVIMENTAÇÃO DE CARGA/gi, (match) => {
            if (match.toUpperCase() === '{{FUNCAO}}') {
                if (cfg.nome_treinamento && cfg.nome_treinamento.trim() !== '') {
                    return `<strong style="color:#000; text-decoration: underline;">${this._corrigirTexto(cfg.nome_treinamento.toUpperCase())}</strong>`;
                }
                const funcTreino = modeloTipo === '1' ? 'Operador' : (modeloTipo === '3' ? 'Reciclagem' : 'Básico');
                return `<strong style="color:#000; text-decoration: underline;">${funcTreino}</strong>`;
            }
            return `<strong style="color:#000; text-decoration: underline;">${match}</strong>`;
        })
        .replace(/{{HORAS}}|16 horas|8 horas|32 horas|4 horas/gi, `${horasTexto}`)
        .replace(/{{DATA}}/g, `<strong style="color:#000;">${dataExibir}</strong>`);

    const currentPage = this.cert11_page || 0;

    // --- LÓGICA DE VALIDAÇÃO DE PERÍODO (MARCA D'ÁGUA) ---
    let periodoValido = true;
    if (horasNecessarias > 8) {
        if (!dataFimCfg || dataFimCfg.trim() === '' || dataFimCfg === dataEmissao) {
            periodoValido = false; 
        } else {
            const parseData = (str) => {
                const parts = str.split('/');
                if (parts.length !== 3) return null;
                return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            };
            const dtInicio = parseData(dataEmissao);
            const dtFim = parseData(dataFimCfg);
            if (dtInicio && dtFim && dtFim >= dtInicio) {
                const diasPeriodo = Math.round((dtFim - dtInicio) / (1000 * 60 * 60 * 24)) + 1;
                periodoValido = diasPeriodo >= diasNecessarios;
            } else {
                periodoValido = false;
            }
        }
    }

    const liveData = this.getDadosAtuaisFormulario();
    const isInvalido = !periodoValido;
    const isVencido = this.isCertificadoVencido(liveData, 'nr11');
    let watermarkHTML = '';
    if (isInvalido) watermarkHTML += '<div class="watermark-invalido">CERTIFICADO INVÁLIDO</div>';
    if (isVencido) watermarkHTML += '<div class="watermark-vencido">CERTIFICADO VENCIDO</div>';

    const preview = document.getElementById('certNR11_preview');
    if (!preview) return;

    preview.innerHTML = `
    <style id="cert11-style">
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Lato:wght@300;400;700&display=swap');

        @media screen {
            #certNR11_preview {
                padding: 0 !important;
                background: #333 !important;
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: center !important;
                position: relative;
                min-height: 520px;
                overflow: hidden !important; 
            }
            .cert-scale-wrapper {
                width: 178.2mm; 
                height: 126mm;
                position: relative;
                flex-shrink: 0;
            }
            .cert-container {
                transform: scale(0.6); 
                transform-origin: top left;
                position: absolute;
                top: 0; left: 0;
                box-shadow: 0 10px 40px rgba(0,0,0,0.8);
            }
            .cert-nav-arrow {
                position: absolute;
                top: 50%;
                transform: translateY(-50%);
                font-size: 100px;
                color: #fff;
                cursor: pointer;
                user-select: none;
                z-index: 2000;
                font-weight: 200;
                opacity: 0.7;
                transition: opacity 0.2s, transform 0.2s;
                text-shadow: 0 0 15px rgba(0,0,0,0.8);
            }
            .cert-nav-arrow:hover { opacity: 1; transform: translateY(-50%) scale(1.1); }
            .cert-nav-arrow.left  { left: 30px; }
            .cert-nav-arrow.right { right: 30px; }

            .page-0 { display: ${currentPage === 0 ? 'block' : 'none'} !important; }
            .page-1 { display: ${currentPage === 1 ? 'block' : 'none'} !important; }
        }

        .watermark-invalido {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-35deg);
            font-size: 80pt;
            font-weight: 900;
            color: rgba(255, 0, 0, 0.25) !important;
            border: 15px solid rgba(255, 0, 0, 0.25);
            padding: 20px 50px;
            z-index: 1000;
            pointer-events: none;
            text-align: center;
            white-space: nowrap;
        }
        .watermark-vencido {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-35deg);
            font-size: 80pt;
            font-weight: 900;
            color: rgba(255, 100, 0, 0.25) !important;
            border: 15px solid rgba(255, 100, 0, 0.25);
            padding: 20px 50px;
            z-index: 1000;
            pointer-events: none;
            text-align: center;
            white-space: nowrap;
        }

        @media print {
            html, body { margin: 0 !important; padding: 0 !important; width: 297mm; height: auto !important; background: #fff; }
            body * { visibility: hidden !important; }
            #certNR11_preview, #certNR11_preview * { visibility: visible !important; }
            #certNR11_preview { position: absolute !important; top: 0 !important; left: 0 !important; width: 297mm !important; margin: 0 !important; padding: 0 !important; background: #fff !important; display: block !important; overflow: visible !important; }
            @page { margin: 0; }
            @page landscape { size: A4 landscape; margin: 0; }
            @page portrait { size: A4 portrait; margin: 0; }
            .cert-container { page: landscape; transform: none !important; position: relative !important; margin: 0 !important; box-shadow: none !important; border: none !important; width: 297mm !important; height: 210mm !important; page-break-after: always !important; break-after: page !important; display: flex !important; }
            .cert-verso { page-break-after: avoid !important; break-after: auto !important; }
            .cert-scale-wrapper { width: 297mm !important; height: auto !important; display: block !important; }
            .cert-nav-arrow { display: none !important; }
            .page-0, .page-1, .lpt-print-only { display: block !important; }
            .lpt-print-only { page-break-before: always !important; break-before: page !important; }
        }

        @media screen {
            .lpt-print-only { display: none !important; }
        }

        .cert-container {
            width: 297mm; height: 210mm; background: #fff; box-sizing: border-box;
            position: relative; font-family: 'Lato', sans-serif; display: flex; flex-direction: column;
            color: #1a3a6b; overflow: hidden; print-color-adjust: exact; -webkit-print-color-adjust: exact;
        }
        .cert-frame-rectangle { position: absolute; top: 21mm; left: 21mm; right: 21mm; bottom: 21mm; border: 2px solid #1a3a6b !important; box-sizing: border-box; z-index: 5; }
        .corner-ornament { position: absolute; width: 18mm; height: 18mm; background: #1a3a6b !important; box-shadow: inset 0 0 0 1000px #1a3a6b !important; display: flex; align-items: center; justify-content: center; z-index: 100; }
        .corner-circle { width: 5mm; height: 5mm; background: #fff !important; box-shadow: inset 0 0 0 1000px #fff !important; border-radius: 50%; }
        .top-left { top: 12mm; left: 12mm; }
        .top-right { top: 12mm; right: 12mm; }
        .bottom-left { bottom: 12mm; left: 12mm; }
        .bottom-right { bottom: 12mm; right: 12mm; }
        .cert-inner-content { flex: 1; padding: 25mm; display: flex; flex-direction: column; z-index: 10; position: relative; }
        .cert-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4mm; margin-top: 0mm; }
        .cert-logo { height: 24mm; }
        .cert-title { font-family: 'Cinzel', serif; font-size: 42pt; font-weight: 700; text-align: center; flex: 1; margin-right: 28mm; letter-spacing: 2mm; color: #1a3a6b; }
        .cert-body { font-size: 20pt; line-height: 1.6; text-align: justify; margin-top: 10mm; color: #333; }
        .cert-body strong { font-weight: 700; color: #000; }
        .cert-footer-info { margin-top: 15mm; font-size: 15pt; font-weight: 700; color: #1a3a6b; }
        .cert-assinaturas { margin-top: auto; margin-bottom: 5mm; display: flex; justify-content: space-between; gap: 15mm; width: 100%; }
        .signature-box { flex: 1; text-align: center; font-size: 12.5pt; color: #333; }
        .sig-line { border-top: 1.5px solid #1a3a6b; margin-bottom: 3mm; width: 90%; margin-left: 5%; }
        .controle-texto-original { position: absolute; top: 12mm; right: 35mm; font-size: 11pt; font-weight: 700; color: #1a3a6b; }
    </style>

    <div class="cert-nav-arrow left" onclick="syscontrole.toggleCert11Page(-1)">&lsaquo;</div>
    <div class="cert-nav-arrow right" onclick="syscontrole.toggleCert11Page(1)">&rsaquo;</div>

    <div class="cert-scale-wrapper page-0">
        <div class="cert-container cert-frente">
            ${watermarkHTML}
            <div class="corner-ornament top-left"><div class="corner-circle"></div></div>
            <div class="corner-ornament top-right"><div class="corner-circle"></div></div>
            <div class="corner-ornament bottom-left"><div class="corner-circle"></div></div>
            <div class="corner-ornament bottom-right"><div class="corner-circle"></div></div>
            <div class="cert-frame-rectangle"></div>
            <div class="cert-inner-content">
                <div class="controle-texto-original">Controle nº NR 11 - ${ano} - ${numero}</div>
                <div class="cert-header">
                    <img src="${logoFile}" class="cert-logo" onerror="this.style.display='none'">
                    <div class="cert-title">CERTIFICADO</div>
                </div>
                <div class="cert-body" style="font-size: 15pt;">
                    ${certBodyFinal}
                    <div style="margin-top: 4mm; font-size: 14pt;">Rua Soldado João Pereira da Silva, 233 - Pq. Novo Mundo/ SP</div>
                </div>
                <div class="cert-footer-info" style="margin-top: 5mm;">DATA ${dataExibir}.</div>
                <div class="cert-assinaturas">
                    <div class="signature-box"><div class="sig-line"></div><strong>Participante</strong><br><strong>${nome}</strong><br>${funcao}</div>
                    <div class="signature-box"><div class="sig-line"></div><strong>Instrutor de Seguran&ccedil;a do Trabalho</strong><br>${instrutor}<br>${cargoInstrutor}<br>Reg. M.T.E. ${regInstrutor}</div>
                    <div class="signature-box"><div class="sig-line"></div><strong>Respons&aacute;vel T&eacute;cnico</strong><br>${responsavel}<br>${cargoResp}<br>${regResp}</div>
                </div>
            </div>
        </div>
    </div>

    <div class="cert-scale-wrapper page-1">
        <div class="cert-container cert-verso">
            ${watermarkHTML}
            <div class="corner-ornament top-left"><div class="corner-circle"></div></div>
            <div class="corner-ornament top-right"><div class="corner-circle"></div></div>
            <div class="corner-ornament bottom-left"><div class="corner-circle"></div></div>
            <div class="corner-ornament bottom-right"><div class="corner-circle"></div></div>
            <div class="cert-frame-rectangle"></div>
            <div class="cert-inner-content">
                <div class="controle-texto-original">Controle nº NR 11 - ${ano} - ${numero}</div>
                <div class="cert-header" style="justify-content: flex-start; margin-top: 0mm;">
                    <img src="${logoFile}" class="cert-logo" onerror="this.style.display='none'">
                </div>
                <div style="font-size: 18pt; font-family: 'Lato', sans-serif; font-weight: bold; font-style: italic; text-align: center; margin: -10mm 0 2mm 0; border: none; color: #1a3a6b; text-transform: uppercase;">
                    CONTE&Uacute;DO PROGRAM&Aacute;TICO
                </div>
                <div style="font-size: 14pt; line-height: 1.6; color: #222; margin: 2mm 15mm; font-family: 'Lato', sans-serif; text-align: justify;">
                    1. Conceitos gerais de movimentação de carga;<br>
                    2. Tipos de equipamento;<br>
                    3. Riscos por equipamento;<br>
                    4. Tipos de movimentação;<br>
                    5. Tipos de controle por risco;<br>
                    6. Conceitos e práticas sobre equipamentos de segurança;<br>
                    7. Tipos de equipamento de segurança;<br>
                    8. EPI;<br>
                    9. EPC;<br>
                    10. Funcionamento de equipamentos de segurança;<br>
                    11. Inspeção dos equipamentos e itens de segurança;<br>
                    12. Checklist de pré-operação;<br>
                    13. Tipos de acessório e suas inspeções;<br>
                    14. Regras de guindar, movimentar e transportar de acordo com o equipamento;<br>
                    15. Regras de condução, circulação e sinalização da unidade.
                </div>
            </div>
        </div>
    </div>`;

    const oldHandler = preview._printHandler;
    if (oldHandler) window.removeEventListener('keydown', oldHandler);

    preview._printHandler = function(e) {
        if (e.ctrlKey && e.key.toLowerCase() === 'p' && document.getElementById('modalCertNR11').style.display === 'block') {
            e.preventDefault();
            const styleElement = document.getElementById('cert11-style');
            if (!styleElement) return;

            const janela = window.open('', '_blank', 'width=1100,height=800');
            janela.document.write(`
                <!DOCTYPE html><html><head><title>Certificado NR-11 - ${nome}</title>
                <style>${styleElement.innerHTML}</style>
                <style>
                    @page { size: A4 landscape; margin: 0; }
                    html, body { height: auto !important; } 
                    .cert-container { display: flex !important; break-after: page !important; }
                    .cert-verso { page-break-after: avoid !important; break-after: auto !important; }
                    .cert-nav-arrow { display: none !important; }
                    .page-0, .page-1 { display: block !important; }
                </style>
                </head><body>
                    <div id="certNR11_preview">
                        ${preview.innerHTML}
                    </div>
                    <script>window.onload=function(){setTimeout(function(){window.print();window.onafterprint=function(){window.close();};},500);};</script>
                </body></html>`);
            janela.document.close();
        }
    };
    window.addEventListener('keydown', preview._printHandler);
};

SysControleWeb.prototype.abrirLPTNR11 = async function() {
    if (!this.editingId) {
        if (typeof this.showToast === 'function') this.showToast('Selecione um cadastro primeiro', 'warning');
        else alert('Selecione um cadastro primeiro');
        return;
    }

    const dataEmi = document.getElementById('nr11_dataEmissao')?.value;
    if (!dataEmi) {
        if (typeof this.showToast === 'function') {
            this.showToast('Por favor, informe a Data de Emissão para gerar o documento.', 'error');
        } else {
            alert('Preencha a Data de Emissão primeiro!');
        }
        return;
    }

    let cfg = JSON.parse(localStorage.getItem('cfg_nr11') || '{}');
    try {
        const response = await fetch('/api/config/nr/nr11');
        const resJson = await response.json();
        if (resJson.success && resJson.dados) {
            cfg = resJson.dados;
            localStorage.setItem('cfg_nr11', JSON.stringify(cfg));
        }
    } catch (e) { console.error('Erro ao buscar config NR11 do servidor:', e); }

    document.getElementById('cfg11_instrutor').value       = cfg.instrutor || '';
    document.getElementById('cfg11_cargo_instrutor').value = cfg.cargo_instrutor || '';
    document.getElementById('cfg11_reg_instrutor').value   = cfg.reg_instrutor || '';
    document.getElementById('cfg11_responsavel').value     = cfg.responsavel || '';
    document.getElementById('cfg11_cargo_resp').value      = cfg.cargo_resp || '';
    document.getElementById('cfg11_reg_resp').value        = cfg.reg_resp || '';
    document.getElementById('cfg11_local').value           = cfg.local || 'Refeitório';
    document.getElementById('cfg11_uf').value              = cfg.uf || 'SP';
    
    const modal = document.getElementById('modalLPTNR11');
    if (modal) modal.style.display = 'block';
    
    this.renderLPTNR11();
};

SysControleWeb.prototype.renderLPTNR11 = function() {
    const nome        = this._corrigirTexto((document.getElementById('nome')?.value || '').toUpperCase());
    const funcao      = this._corrigirTexto((document.getElementById('funcao')?.value || '').toUpperCase());
    const empresa     = this._corrigirTexto((document.getElementById('empresa')?.value || '').toUpperCase());
    const dataEmissao = document.getElementById('nr11_dataEmissao')?.value || '';

    const cfg = JSON.parse(localStorage.getItem('cfg_nr11') || '{}');
    const instrutor      = cfg.instrutor      || '_______________________';
    const cargoInstrutor = cfg.cargo_instrutor || 'Tecnico em Seguranca do Trabalho';
    const local          = cfg.local           || 'Refeitório';
    const logoFile       = cfg.logo            || '/Logo-Hoss.jpg';

    const hoje = new Date();
    const dia  = String(hoje.getDate()).padStart(2,'0');
    const mes  = String(hoje.getMonth()+1).padStart(2,'0');
    const ano  = cfg.ano_selecionado || hoje.getFullYear();
    
    const dataFimCfg = cfg.data_fim || '';
    let dataExibir = dataEmissao || (dia+'/'+mes+'/'+ano);
    if (dataFimCfg && dataFimCfg.trim() !== '' && dataFimCfg !== dataEmissao) {
        dataExibir = `${dataEmissao} à ${dataFimCfg}`;
    }

    const preview = document.getElementById('lptNR11_preview');
    if (!preview) return;

    preview.innerHTML = `
    <style id="lpt11-style">
        @import url('https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&display=swap');

        @page {
            size: A4 portrait;
            margin: 0;
        }

        @media screen {
            #lptNR11_preview { padding: 20px; background: #f0f0f0; display: flex; justify-content: center; overflow-y: auto; }
            .lpt-page { background: #fff; width: 210mm; min-height: 297mm; padding: 10mm; box-sizing: border-box; box-shadow: 0 0 10px rgba(0,0,0,0.2); }
        }

        @media print {
            body { margin: 0; padding: 0; background: #fff; }
            
            /* Esconder elementos indesejados */
            #modalLPTNR11 {
                position: fixed !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                height: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #fff !important;
                z-index: 999999 !important;
            }

            /* Esconder o cabeçalho azul do modal e botões */
            #modalLPTNR11 > div > div:first-child,
            #modalLPTNR11 .btn-cfg-mobile-hide,
            .modal-header, 
            .modal-footer {
                display: none !important;
            }

            #lptNR11_preview, #lptNR11_preview * { visibility: visible !important; }
            #lptNR11_preview { 
                position: absolute; 
                top: 0; 
                left: 0; 
                width: 100%; 
                padding: 0; 
                margin: 0; 
                background: #fff; 
                max-height: none !important;
                overflow: visible !important;
            }
            .lpt-page { 
                page: portrait; 
                box-shadow: none !important; 
                width: 210mm !important; 
                height: 297mm !important;
                padding: 10mm !important; 
                margin: 0 !important;
                display: flex !important;
                flex-direction: column !important;
                border: none !important; /* Remove borda externa na impressão */
            }
            body > *:not(#modalLPTNR11) { display: none !important; }
        }

        .lpt-page { 
            font-family: 'Lato', sans-serif; 
            color: #000; 
            line-height: 1.3; 
            font-size: 10pt; 
            border: 1px solid #000; 
            padding: 10mm; 
            box-sizing: border-box; 
            min-height: 297mm;
            display: flex;
            flex-direction: column;
        }
        .lpt-header { display: flex; border: 2px solid #000; margin-bottom: 3mm; }
        .lpt-logo-box { width: 35mm; padding: 2mm; border-right: 2px solid #000; display: flex; align-items: center; justify-content: center; }
        .lpt-logo { max-width: 100%; max-height: 25mm; object-fit: contain; }
        .lpt-title-box { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
        .lpt-title-top { border-bottom: 2px solid #000; width: 100%; padding: 2mm; font-weight: bold; font-size: 11pt; color: #1a3a6b; }
        .lpt-title-bottom { width: 100%; padding: 2mm; font-weight: bold; font-size: 12pt; }
        
        .lpt-info-section { margin-bottom: 3mm; }
        .lpt-empresa { font-weight: bold; font-size: 11pt; margin-bottom: 2mm; border-bottom: 1px solid #000; padding: 1mm 0; text-transform: uppercase; }
        
        .lpt-topics { border: 1px solid #000; padding: 2mm 5mm; margin-bottom: 3mm; font-size: 8.5pt; background: #fff; text-align: justify; }
        .lpt-topics p { margin: 0; font-weight: bold; font-style: italic; }
        
        .lpt-details-grid { display: grid; grid-template-columns: 2.2fr 1fr; border: 2px solid #000; margin-bottom: 3mm; }
        .lpt-detail-item { padding: 2mm 4mm; border-bottom: 1px solid #000; }
        .lpt-detail-label { font-weight: bold; font-size: 9pt; }
        .lpt-detail-value { border-bottom: 1px solid #000; display: inline-block; min-width: 60%; padding: 0 5px; font-style: italic; }
        
        .lpt-table { width: 100%; border-collapse: collapse; margin-top: 3mm; border: 1px solid #000; }
        .lpt-table th { border: 1px solid #000; padding: 2mm; background: #fff; font-weight: bold; font-size: 9pt; }
        .lpt-table td { border: 1px solid #000; padding: 2mm; text-align: left; height: 8.5mm; }
        .lpt-col-no { width: 8mm; text-align: center; }
        .lpt-col-nome { width: 80mm; font-weight: bold; color: #1a3a6b; }
        .lpt-col-funcao { width: 45mm; font-style: italic; text-align: center; }

        .lpt-footer-assinaturas {
            margin-top: auto;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20mm;
            padding-top: 10mm;
            margin-bottom: 30px; /* Sobe o campo de assinatura */
        }
        .lpt-sig-box {
            text-align: center;
            border-top: 1px solid #000;
            padding-top: 2mm;
            font-size: 9pt;
            font-weight: bold;
        }
    </style>

    <div class="lpt-page">
        <div class="lpt-header">
            <div class="lpt-logo-box">
                <img src="${logoFile}" class="lpt-logo" onerror="this.style.display='none'">
            </div>
            <div class="lpt-title-box">
                <div class="lpt-title-top" style="line-height: 1.2;">
                    TREINAMENTO NR 11 - MOVIMENTAÇÃO DE CARGA
                </div>
                <div class="lpt-title-bottom">LISTA DE PRESENÇA DE TREINAMENTO - LPT</div>
            </div>
        </div>

        <div class="lpt-info-section">
            <div class="lpt-empresa">EMPRESA: ${empresa}</div>
        </div>

        <div class="lpt-topics">
            <p style="font-size: 10pt; margin: 0; line-height: 1.4; text-align: justify;">
                Curso livre para Qualificação Profissional, onde objetivo é capacitar profissionais para práticas relativas a operações e procedimentos para reconhecimento, análise e prevenção de risco associado a movimentação de cargas, abordando conteúdos e práticas relacionados com operações e procedimentos para reconhecimento, análise e percepção de risco associado a todo tipo de movimentação, equipamentos e veículos que transportam cargas, bem como inspeção e utilização de equipamentos de proteção individual (EPIs) e equipamentos de proteção coletiva (EPC).
            </p>
        </div>

        <div class="lpt-details-grid">
            <div class="lpt-detail-item">
                <span class="lpt-detail-label">Instrutor: </span>
                <div style="display: inline-flex; flex-direction: column; align-items: center; vertical-align: top; margin-left: 2mm;">
                    <span class="lpt-detail-value" style="border-bottom: 1px solid #000; padding: 0 2px;">${instrutor}</span>
                    <span style="font-size: 8pt; font-weight: bold; text-transform: uppercase;">${cargoInstrutor}</span>
                </div>
            </div>
            <div class="lpt-detail-item" style="text-align: center;">
                <span class="lpt-detail-label">Duração: </span><br>
                <span class="lpt-detail-value" style="font-weight: bold;">${cfg.modelo_tipo === '1' ? '32 HORAS' : (cfg.modelo_tipo === '3' ? '4 HORAS' : '8 HORAS')}</span>
            </div>
            <div class="lpt-detail-item" style="border-bottom: none;">
                <span class="lpt-detail-label">Local do treinamento: </span>
                <span class="lpt-detail-value">${local}</span>
            </div>
            <div class="lpt-detail-item" style="border-bottom: none; text-align: center; padding-left: 5px;">
                <span class="lpt-detail-label" style="font-size: 11pt;">Data: ${dataExibir}</span>
            </div>
        </div>

        <table class="lpt-table">
            <thead>
                <tr>
                    <th class="lpt-col-no">Nº</th>
                    <th class="lpt-col-nome">NOME</th>
                    <th class="lpt-col-funcao">FUNÇÃO</th>
                    <th>ASSINATURA</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="lpt-col-no">1</td>
                    <td class="lpt-col-nome">${nome}</td>
                    <td class="lpt-col-funcao">${funcao}</td>
                    <td></td>
                </tr>
                ${Array.from({length: 8}).map((_, i) => `
                <tr>
                    <td class="lpt-col-no">${i + 2}</td>
                    <td class="lpt-col-nome"></td>
                    <td class="lpt-col-funcao"></td>
                    <td></td>
                </tr>`).join('')}
            </tbody>
        </table>

        <div class="lpt-footer-assinaturas">
            <div class="lpt-sig-box">
                ASSINATURA DO INSTRUTOR
            </div>
            <div class="lpt-sig-box">
                CARIMBO DA EMPRESA
            </div>
        </div>
    </div>`;
};

SysControleWeb.prototype.fecharLPTNR11 = function() {
    const modal = document.getElementById('modalLPTNR11');
    if (modal) modal.style.display = 'none';
    
    if (typeof this.switchNRTab === 'function') {
        this.switchNRTab('nr11');
    }
};

SysControleWeb.prototype.fecharCertNR11 = function() {
    const modal = document.getElementById('modalCertNR11');
    if (modal) modal.style.display = 'none';
    
    if (typeof this.showModal === 'function') {
        this.showModal('modalForm', true);
    } else {
        const modalForm = document.getElementById('modalForm');
        if (modalForm) modalForm.style.display = 'block';
    }
    
    if (typeof this.switchNRTab === 'function') {
        this.switchNRTab('nr11');
    }
};
