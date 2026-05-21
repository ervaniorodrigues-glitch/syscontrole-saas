// ==================== CERTIFICADO NR-33 ====================

SysControleWeb.prototype.toggleCert33Page = function(delta) {
    this.cert33_page = (this.cert33_page === 0) ? 1 : 0;
    this.renderCertNR33();
};

SysControleWeb.prototype.abrirCertNR33 = async function() {
    if (!this.editingId) {
        if (typeof this.showToast === 'function') {
            this.showToast('Selecione um cadastro primeiro', 'warning');
        } else {
            alert('Selecione um cadastro primeiro');
        }
        return;
    }

    // Validação de Data de Emissão (Obrigatória)
    const dataEmi = document.getElementById('nr33_dataEmissao')?.value;
    if (!dataEmi) {
        if (typeof this.showToast === 'function') {
            this.showToast('Por favor, informe a Data de Emissão para gerar o documento.', 'error');
        } else {
            alert('Preencha a Data de Emissão primeiro!');
        }
        return;
    }
    
    // Carregar configuração da NR-33 (Tenta servidor, cai no localStorage)
    let cfg = JSON.parse(localStorage.getItem('cfg_nr33') || '{}');
    try {
        const response = await fetch('/api/config/nr/nr33');
        const resJson = await response.json();
        if (resJson.success && resJson.dados) {
            cfg = resJson.dados;
            localStorage.setItem('cfg_nr33', JSON.stringify(cfg));
        }
    } catch (e) { console.error('Erro ao buscar config NR33 do servidor:', e); }

    document.getElementById('cfg33_instrutor').value       = cfg.instrutor || '';
    document.getElementById('cfg33_cargo_instrutor').value = cfg.cargo_instrutor || '';
    document.getElementById('cfg33_reg_instrutor').value   = cfg.reg_instrutor || '';
    document.getElementById('cfg33_responsavel').value     = cfg.responsavel || '';
    document.getElementById('cfg33_cargo_resp').value      = cfg.cargo_resp || '';
    document.getElementById('cfg33_reg_resp').value        = cfg.reg_resp || '';
    document.getElementById('cfg33_local').value           = cfg.local || 'Refeitório';
    document.getElementById('cfg33_uf').value              = cfg.uf || 'SP';
    const logoInput = document.getElementById('cfg33_logo');
    const logoPreview = document.getElementById('cfg33_logo_preview');
    if (logoInput) logoInput.value = cfg.logo || '';
    if (logoPreview) logoPreview.src = cfg.logo || '/Logo-Hoss.jpg';
    document.getElementById('cert33_num').value            = localStorage.getItem('cert33_ultimo_num') || '';
    
    const modal = document.getElementById('modalCertNR33');
    if (modal) modal.style.display = 'block';
    
    this.cert33_page = 0; // Reset to front page
    this.renderCertNR33();
};

SysControleWeb.prototype.abrirCfgNR33 = async function() {
    // Carregar configuração da NR-33 (Tenta servidor, cai no localStorage)
    let cfg = JSON.parse(localStorage.getItem('cfg_nr33') || '{}');
    try {
        const response = await fetch('/api/config/nr/nr33');
        const resJson = await response.json();
        if (resJson.success && resJson.dados) {
            cfg = resJson.dados;
            localStorage.setItem('cfg_nr33', JSON.stringify(cfg));
        }
    } catch (e) { console.error('Erro ao buscar config NR33 do servidor:', e); }

    if (cfg.txt_supervisor && cfg.txt_supervisor.includes('Antigravity Test Text')) cfg.txt_supervisor = '';
    if (cfg.txt_executante && cfg.txt_executante.includes('Antigravity Test Text')) cfg.txt_executante = '';
    document.getElementById('cfg33_instrutor').value       = cfg.instrutor || '';
    document.getElementById('cfg33_cargo_instrutor').value = cfg.cargo_instrutor || '';
    document.getElementById('cfg33_reg_instrutor').value   = cfg.reg_instrutor || '';
    document.getElementById('cfg33_responsavel').value     = cfg.responsavel || '';
    document.getElementById('cfg33_cargo_resp').value      = cfg.cargo_resp || '';
    document.getElementById('cfg33_reg_resp').value        = cfg.reg_resp || '';
    document.getElementById('cfg33_local').value           = cfg.local || 'Refeitório';
    document.getElementById('cfg33_uf').value              = cfg.uf || 'SP';
    const logoInput = document.getElementById('cfg33_logo');
    const logoPreview = document.getElementById('cfg33_logo_preview');
    if (logoInput) logoInput.value = cfg.logo || '';
    if (logoPreview) logoPreview.src = cfg.logo || '/Logo-Hoss.jpg';
    
    // Novos campos de modelos de texto
    const defSup = "Certificamos que o Sr. {{NOME}}, portador do CPF: {{CPF}}, frequentou e concluiu satisfatoriamente o <strong><u>Treinamento de Segurança e Saúde nos Trabalhos em Espaços Confinados - Supervisor de Entrada</u></strong>, com dura&ccedil;&atilde;o de <strong>{{HORAS}}</strong> em atendimento &agrave; <strong>NR 33</strong> da Portaria N&ordm; 3214/78, do Minist&eacute;rio do Trabalho.";
    const defExec = "Certificamos que o Sr. {{NOME}}, portador do CPF: {{CPF}}, frequentou e concluiu satisfatoriamente o treinamento para <strong><u>{{FUNCAO}}</u></strong>, com dura&ccedil;&atilde;o de <strong>{{HORAS}}</strong> em atendimento &agrave; <strong>NR 33</strong> da Portaria N&ordm; 3214/78, do Minist&eacute;rio do Trabalho.";

    let txt_sup = cfg.txt_supervisor || '';
    if (txt_sup.length < 20) txt_sup = defSup;

    let txt_exe = cfg.txt_executante || '';
    if (txt_exe.length < 20) txt_exe = defExec;

    document.getElementById('cfg33_txt_supervisor').value = txt_sup;
    document.getElementById('cfg33_txt_executante').value = txt_exe;
    const modeloTipo = cfg.modelo_tipo || '2';
    if (modeloTipo === '1') document.getElementById('cfg33_radio_sup').checked = true;
    else if (modeloTipo === '3') {
        const radRec = document.getElementById('cfg33_radio_recicle');
        if(radRec) radRec.checked = true;
    }
    else document.getElementById('cfg33_radio_exec').checked = true;

    // Campo Data Fim
    const inputDataFim = document.getElementById('cfg33_data_fim');
    if (inputDataFim) inputDataFim.value = cfg.data_fim || '';

    // Carregar lista de anos
    this.cfg33_anos = cfg.anos || [new Date().getFullYear()];
    this.cfg33_ano_selecionado = cfg.ano_selecionado || new Date().getFullYear();
    this.atualizarListaAnos33();
    
    const modal = document.getElementById('modalCfgNR33');
    if (modal) modal.style.display = 'block';
};

SysControleWeb.prototype.adicionarAno33 = function() {
    const input = document.getElementById('cfg33_novo_ano');
    const ano = parseInt(input.value);
    if (!ano || ano < 1900 || ano > 2100) {
        if (typeof this.showToast === 'function') this.showToast('Ano inválido', 'error');
        return;
    }
    if (this.cfg33_anos.includes(ano)) {
        if (typeof this.showToast === 'function') this.showToast('Ano já existe', 'warning');
        return;
    }
    this.cfg33_anos.push(ano);
    this.cfg33_anos.sort((a,b) => b - a);
    this.cfg33_ano_selecionado = ano;
    input.value = '';
    this.atualizarListaAnos33();
};

SysControleWeb.prototype.removerAnoSelecionado33 = function() {
    const select = document.getElementById('cfg33_ano_ativo');
    const ano = parseInt(select.value);
    if (!ano) return;
    if (confirm(`Tem certeza que deseja excluir o ano ${ano} da lista?`)) {
        this.removerAno33(ano);
    }
};

SysControleWeb.prototype.removerAno33 = function(ano) {
    const anoNum = Number(ano);
    this.cfg33_anos = this.cfg33_anos.filter(a => Number(a) !== anoNum);
    if (Number(this.cfg33_ano_selecionado) === anoNum) {
        this.cfg33_ano_selecionado = this.cfg33_anos[0] || new Date().getFullYear();
    }
    this.atualizarListaAnos33();
    if (typeof this.showToast === 'function') this.showToast('Ano removido da lista!', 'info');
};

SysControleWeb.prototype.atualizarListaAnos33 = function() {
    const select = document.getElementById('cfg33_ano_ativo');
    if (!select) return;
    select.innerHTML = '';
    this.cfg33_anos.forEach(ano => {
        const opt = document.createElement('option');
        opt.value = ano;
        opt.textContent = ano;
        if (parseInt(ano) === parseInt(this.cfg33_ano_selecionado)) opt.selected = true;
        select.appendChild(opt);
    });
};

SysControleWeb.prototype.salvarCfgNR33 = async function() {
    const anoAtivo = parseInt(document.getElementById('cfg33_ano_ativo').value);
    const cfgData = {
        instrutor:       document.getElementById('cfg33_instrutor').value,
        cargo_instrutor: document.getElementById('cfg33_cargo_instrutor').value,
        reg_instrutor:   document.getElementById('cfg33_reg_instrutor').value,
        responsavel:     document.getElementById('cfg33_responsavel').value,
        cargo_resp:      document.getElementById('cfg33_cargo_resp').value,
        reg_resp:        document.getElementById('cfg33_reg_resp').value,
        local:           document.getElementById('cfg33_local').value,
        uf:              document.getElementById('cfg33_uf').value,
        logo:            document.getElementById('cfg33_logo').value,
        txt_supervisor:  document.getElementById('cfg33_txt_supervisor').value,
        txt_executante:  document.getElementById('cfg33_txt_executante').value,
        modelo_tipo:     document.querySelector('input[name="cfg33_modelo_tipo"]:checked')?.value || '2',
        data_fim:        document.getElementById('cfg33_data_fim')?.value || '',
        anos:            this.cfg33_anos,
        ano_selecionado: anoAtivo
    };

    // Salva no localStorage para velocidade
    localStorage.setItem('cfg_nr33', JSON.stringify(cfgData));
    
    // Salva no SERVIDOR para persistência e backup (Crítico)
    try {
        await fetch('/api/config/nr/nr33', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dados: cfgData })
        });
    } catch (e) {
        console.error('Erro ao salvar config NR33 no servidor:', e);
    }
    
    const modal = document.getElementById('modalCfgNR33');
    if (modal) modal.style.display = 'none';
    
    if (typeof this.showToast === 'function') {
        this.showToast('Configuração salva com sucesso!', 'success');
    }
    
    // Atualizar previews
    this.renderCertNR33();
    this.renderLPTNR33();
};


SysControleWeb.prototype.processarLogoUpload33 = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const logoInput = document.getElementById('cfg33_logo');
            const logoPreview = document.getElementById('cfg33_logo_preview');
            if (logoInput) logoInput.value = e.target.result;
            if (logoPreview) logoPreview.src = e.target.result;
            
            if (typeof this.showToast === 'function') {
                this.showToast('Logo selecionado!', 'success');
            }
        };
        reader.readAsDataURL(input.files[0]);
    }
};

SysControleWeb.prototype.renderCertNR33 = function() {
    const nome   = this._corrigirTexto((document.getElementById('nome')?.value || '').toUpperCase());
    const cpf    = document.getElementById('cpf')?.value || '';
    const funcao = this._corrigirTexto((document.getElementById('funcao')?.value || '').toUpperCase());
    const numero = document.getElementById('cert33_num')?.value || '___';
    if (numero !== '___') localStorage.setItem('cert33_ultimo_num', numero);
    const dataEmissao = document.getElementById('nr33_dataEmissao')?.value || '';

    const cfg = JSON.parse(localStorage.getItem('cfg_nr33') || '{}');
    if (cfg.txt_supervisor && cfg.txt_supervisor.includes('Antigravity Test Text')) cfg.txt_supervisor = '';
    if (cfg.txt_executante && cfg.txt_executante.includes('Antigravity Test Text')) cfg.txt_executante = '';
    
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
        certBodyTemplate = cfg.txt_supervisor || '';
    } else {
        certBodyTemplate = cfg.txt_executante || '';
    }

    // Fallback se não houver texto configurado
    if (!certBodyTemplate || certBodyTemplate.trim().length < 20) {
        if (modeloTipo === '1') {
            certBodyTemplate = `Certificamos que o Sr. {{NOME}}, portador do CPF: {{CPF}}, frequentou e concluiu satisfatoriamente o <strong><u>Treinamento de Segurança e Saúde nos Trabalhos em Espaços Confinados - Supervisor de Entrada</u></strong>, com dura&ccedil;&atilde;o de <strong>{{HORAS}}</strong> em atendimento &agrave; <strong>NR 33</strong> da Portaria N&ordm; 3214/78, do Minist&eacute;rio do Trabalho.`;
        } else {
            certBodyTemplate = `Certificamos que o Sr. {{NOME}}, portador do CPF: {{CPF}}, frequentou e concluiu satisfatoriamente o treinamento para <strong><u>{{FUNCAO}}</u></strong>, com dura&ccedil;&atilde;o de <strong>{{HORAS}}</strong> em atendimento &agrave; <strong>NR 33</strong> da Portaria N&ordm; 3214/78, do Minist&eacute;rio do Trabalho.`;
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


    // Processar placeholders no template (Garantir Negrito)
    // Verificar se o certificado é inválido (excede 8h no dia) ou vencido
    // Se há Data Fim configurada => verificar se o período cobre as horas necessárias (8h/dia)
    const horasNecessarias = modeloTipo === '1' ? 40 : (modeloTipo === '3' ? 8 : 16);
    const diasNecessarios = horasNecessarias / 8; // 5 dias p/ supervisor, 1 dia p/ reciclagem, 2 dias p/ executante
    const horasTexto = modeloTipo === '1' ? '40 horas' : (modeloTipo === '3' ? '8 horas' : '16 horas');
    
    let certBodyFinal = certBodyTemplate
        .replace(/{{NOME}}|\bNOME\b/g, `<strong style="color:#000;">${nome}</strong>`)
        .replace(/{{CPF}}|000\.000\.000\-00/g, `<strong style="color:#000;">${cpf}</strong>`)
        .replace(/{{FUNCAO}}|SUPERVISOR DE ENTRADA EM ESPAÇO CONFINADO|Trabalhadores autorizados e vigia/gi, (match) => {
            if (match.toUpperCase() === '{{FUNCAO}}') {
                const funcTreino = modeloTipo === '1' ? 'Supervisores' : (modeloTipo === '3' ? 'Reciclagem' : 'Executantes e Vigias');
                return `<strong style="color:#000; text-decoration: underline;">${funcTreino}</strong>`;
            }
            return `<strong style="color:#000; text-decoration: underline;">${match}</strong>`;
        })
        .replace(/{{HORAS}}|40 horas|16 horas/gi, `<strong>${horasTexto}</strong>`)
        .replace(/{{DATA}}/g, `<strong style="color:#000;">${dataExibir}</strong>`);

    const currentPage = this.cert33_page || 0;

    // --- LÓGICA DE VALIDAÇÃO DE PERÍODO (MARCA D'ÁGUA) ---
    // dataFimCfg já definido acima
    let periodoValido = true;
    
    // Se a carga for maior que 8h, EXIGE que tenha Data Fim e que o intervalo seja suficiente
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

    // Obter dados "vivos" do formulário para o preview
    const liveData = this.getDadosAtuaisFormulario();

    const isInvalido = !periodoValido;
    const isVencido = this.isCertificadoVencido(liveData, 'nr33');
    let watermarkHTML = '';
    if (isInvalido) watermarkHTML += '<div class="watermark-invalido">CERTIFICADO INVÁLIDO</div>';
    if (isVencido) watermarkHTML += '<div class="watermark-vencido">CERTIFICADO VENCIDO</div>';

    const preview = document.getElementById('certNR33_preview');
    if (!preview) return;

    preview.innerHTML = `
    <style id="cert33-style">
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Lato:wght@300;400;700&display=swap');

        @media screen {
            #certNR33_preview {
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
            #certNR33_preview, #certNR33_preview * { visibility: visible !important; }
            #certNR33_preview { position: absolute !important; top: 0 !important; left: 0 !important; width: 297mm !important; margin: 0 !important; padding: 0 !important; background: #fff !important; display: block !important; overflow: visible !important; }
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
        .cert-body { font-size: 16pt; line-height: 1.6; text-align: justify; margin-top: 10mm; color: #333; }
        .cert-body strong { font-weight: 700; color: #000; }
        .cert-footer-info { margin-top: 15mm; font-size: 15pt; font-weight: 700; color: #1a3a6b; }
        .cert-assinaturas { margin-top: auto; margin-bottom: 5mm; display: flex; justify-content: space-between; gap: 15mm; width: 100%; }
        .signature-box { flex: 1; text-align: center; font-size: 12.5pt; color: #333; }
        .sig-line { border-top: 1.5px solid #1a3a6b; margin-bottom: 3mm; width: 90%; margin-left: 5%; }
        .controle-texto-original { position: absolute; top: 12mm; right: 35mm; font-size: 11pt; font-weight: 700; color: #1a3a6b; }
    </style>

    <div class="cert-nav-arrow left" onclick="syscontrole.toggleCert33Page(-1)">&lsaquo;</div>
    <div class="cert-nav-arrow right" onclick="syscontrole.toggleCert33Page(1)">&rsaquo;</div>

    <div class="cert-scale-wrapper page-0">
        <div class="cert-container cert-frente">
            ${watermarkHTML}
            <div class="corner-ornament top-left"><div class="corner-circle"></div></div>
            <div class="corner-ornament top-right"><div class="corner-circle"></div></div>
            <div class="corner-ornament bottom-left"><div class="corner-circle"></div></div>
            <div class="corner-ornament bottom-right"><div class="corner-circle"></div></div>
            <div class="cert-frame-rectangle"></div>
            <div class="cert-inner-content">
                <div class="controle-texto-original">Controle nº NR 33 - ${ano} - ${numero}</div>
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
                <div class="controle-texto-original">Controle nº NR 33 - ${ano} - ${numero}</div>
                <div class="cert-header" style="justify-content: flex-start; margin-top: 0mm;">
                    <img src="${logoFile}" class="cert-logo" onerror="this.style.display='none'">
                </div>
                <div style="font-size: 18pt; font-family: 'Lato', sans-serif; font-weight: bold; font-style: italic; text-align: center; margin: -10mm 0 2mm 0; border: none; color: #1a3a6b; text-transform: uppercase;">
                    ${cfg.modelo_tipo === '1' ? 'TREINAMENTO DE ESPA&Ccedil;O CONFINADO NR-33<br>EQUIPE DE EMERG&Ecirc;NCIA E SALVAMENTO' : 'CONTE&Uacute;DO PROGRAM&Aacute;TICO'}
                </div>
                <div style="font-size: 14pt; line-height: 1.5; color: #222; margin: 2mm 10mm; font-family: 'Lato', sans-serif; text-align: justify;">
                    Definições; identificação dos espaços confinados; reconhecimento, <strong>avaliação e controle de riscos</strong>; funcionamento de equipamentos utilizados; procedimentos e utilização da PET.<br>
                    Critérios de indicação e uso de equipamentos para controle de riscos; conhecimento sobre práticas seguras em espaços confinados.<br>
                    Legislação de segurança e saúde no trabalho.<br>
                    Programa de Proteção Respiratória; área classificada.<br>
                    Técnicas em operações de salvamento e emergência no espaço confinado vertical e horizontal; Avaliação primária de vítima, imobilização e Pranchamento de vítima na maca SKED e prancha rígida; montagem de tripé para acesso ao espaço confinado com sistema de vantagem mecânica 4x1, com instalação trava-quedas para captura de progresso; nós de amarrações.<br>
                    <em>Noções de primeiros socorros</em>
                </div>
            </div>
        </div>
    </div>`;

    const oldHandler = preview._printHandler;
    if (oldHandler) window.removeEventListener('keydown', oldHandler);

    preview._printHandler = function(e) {
        if (e.ctrlKey && e.key.toLowerCase() === 'p' && document.getElementById('modalCertNR33').style.display === 'block') {
            e.preventDefault();
            const styleElement = document.getElementById('cert33-style');
            if (!styleElement) return;

            const janela = window.open('', '_blank', 'width=1100,height=800');
            janela.document.write(`
                <!DOCTYPE html><html><head><title>Certificado NR-33 - ${nome}</title>
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
                    <div id="certNR33_preview">
                        ${preview.innerHTML}
                    </div>
                    <script>window.onload=function(){setTimeout(function(){window.print();window.onafterprint=function(){window.close();};},500);};</script>
                </body></html>`);
            janela.document.close();
        }
    };
    window.addEventListener('keydown', preview._printHandler);
};

SysControleWeb.prototype.abrirLPTNR33 = async function() {
    if (!this.editingId) {
        if (typeof this.showToast === 'function') this.showToast('Selecione um cadastro primeiro', 'warning');
        else alert('Selecione um cadastro primeiro');
        return;
    }

    // Validação de Data de Emissão (Obrigatória)
    const dataEmi = document.getElementById('nr33_dataEmissao')?.value;
    if (!dataEmi) {
        if (typeof this.showToast === 'function') {
            this.showToast('Por favor, informe a Data de Emissão para gerar o documento.', 'error');
        } else {
            alert('Preencha a Data de Emissão primeiro!');
        }
        return;
    }

    // Sincronizar dados da config (Tenta servidor)
    let cfg = JSON.parse(localStorage.getItem('cfg_nr33') || '{}');
    try {
        const response = await fetch('/api/config/nr/nr33');
        const resJson = await response.json();
        if (resJson.success && resJson.dados) {
            cfg = resJson.dados;
            localStorage.setItem('cfg_nr33', JSON.stringify(cfg));
        }
    } catch (e) { console.error('Erro ao buscar config NR33 do servidor:', e); }

    document.getElementById('cfg33_instrutor').value       = cfg.instrutor || '';
    document.getElementById('cfg33_cargo_instrutor').value = cfg.cargo_instrutor || '';
    document.getElementById('cfg33_reg_instrutor').value   = cfg.reg_instrutor || '';
    document.getElementById('cfg33_responsavel').value     = cfg.responsavel || '';
    document.getElementById('cfg33_cargo_resp').value      = cfg.cargo_resp || '';
    document.getElementById('cfg33_reg_resp').value        = cfg.reg_resp || '';
    document.getElementById('cfg33_local').value           = cfg.local || 'Refeitório';
    document.getElementById('cfg33_uf').value              = cfg.uf || 'SP';
    
    const modal = document.getElementById('modalLPTNR33');
    if (modal) modal.style.display = 'block';
    
    this.renderLPTNR33();
};

SysControleWeb.prototype.renderLPTNR33 = function() {
    const nome        = this._corrigirTexto((document.getElementById('nome')?.value || '').toUpperCase());
    const funcao      = this._corrigirTexto((document.getElementById('funcao')?.value || '').toUpperCase());
    const empresa     = this._corrigirTexto((document.getElementById('empresa')?.value || '').toUpperCase());
    const dataEmissao = document.getElementById('nr33_dataEmissao')?.value || '';

    const cfg = JSON.parse(localStorage.getItem('cfg_nr33') || '{}');
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


    const preview = document.getElementById('lptNR33_preview');
    if (!preview) return;

    preview.innerHTML = `
    <style id="lpt33-style">
        @import url('https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&display=swap');

        @media screen {
            #lptNR33_preview { padding: 20px; background: #f0f0f0; display: flex; justify-content: center; overflow-y: auto; }
            .lpt-page { background: #fff; width: 210mm; min-height: 297mm; padding: 10mm; box-sizing: border-box; box-shadow: 0 0 10px rgba(0,0,0,0.2); }
        }

        @media print {
            @page { size: A4 portrait; margin: 0; }
            body * { visibility: hidden !important; }
            #lptNR33_preview, #lptNR33_preview * { visibility: visible !important; }
            #lptNR33_preview { position: absolute; top: 0; left: 0; width: 100%; padding: 0; margin: 0; background: #fff; }
            .lpt-page { page: portrait; box-shadow: none !important; width: 100% !important; padding: 10mm !important; }
        }

        .lpt-page { font-family: 'Lato', sans-serif; color: #000; line-height: 1.3; font-size: 10pt; border: 1px solid #000; padding: 10mm; box-sizing: border-box; min-height: 297mm; }
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
        .lpt-table td { border: 1px solid #000; padding: 2mm; text-align: left; height: 8mm; }
        .lpt-col-no { width: 8mm; text-align: center; }
        .lpt-col-nome { width: 80mm; font-weight: bold; color: #1a3a6b; }
        .lpt-col-funcao { width: 45mm; font-style: italic; text-align: center; }
    </style>

    <div class="lpt-page">
        <div class="lpt-header">
            <div class="lpt-logo-box">
                <img src="${logoFile}" class="lpt-logo" onerror="this.style.display='none'">
            </div>
            <div class="lpt-title-box">
                <div class="lpt-title-top" style="line-height: 1.2;">
                    ${cfg.modelo_tipo === '1' 
                        ? 'TREINAMENTO DE ESPAÇO CONFINADO NR-33<br>EQUIPE DE EMERGÊNCIA E SALVAMENTO' 
                        : (cfg.modelo_tipo === '3' ? 'TREINAMENTO NR 33<br>RECICLAGEM DE SEGURANÇA E SAÚDE NOS TRABALHOS EM ESPAÇOS CONFINADOS' : 'TREINAMENTO NR 33<br>SEGURANÇA E SAÚDE NOS TRABALHOS EM ESPAÇOS CONFINADOS')}
                </div>
                <div class="lpt-title-bottom">LISTA DE PRESENÇA DE TREINAMENTO - LPT</div>
            </div>
        </div>

        <div class="lpt-info-section">
            <div class="lpt-empresa">EMPRESA: ${empresa}</div>
        </div>

        <div class="lpt-topics">
            <p style="font-size: 8.5pt; margin: 0; line-height: 1.3;">
                Definições; identificação dos espaços confinados; reconhecimento, <strong>avaliação e controle de riscos</strong>; funcionamento de equipamentos utilizados; procedimentos e utilização da PET.<br>
                Critérios de indicação e uso de equipamentos para controle de riscos; conhecimento sobre práticas seguras em espaços confinados.<br>
                Legislação de segurança e saúde no trabalho.<br>
                Programa de Proteção Respiratória; área classificada.<br>
                Técnicas em operações de salvamento e emergência no espaço confinado vertical e horizontal; Avaliação primária de vítima, imobilização e Pranchamento de vítima na maca SKED e prancha rígida; montagem de tripé para acesso ao espaço confinado com sistema de vantagem mecânica 4x1, com instalação trava-quedas para captura de progresso; nós de amarrações.<br>
                <em>Noções de primeiros socorros</em>
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
                <span class="lpt-detail-value" style="font-weight: bold;">${cfg.modelo_tipo === '1' ? '40 HORAS' : (cfg.modelo_tipo === '3' ? '8 HORAS' : '16 HORAS')}</span>
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
                ${Array.from({length: 14}).map((_, i) => `
                <tr>
                    <td class="lpt-col-no">${i + 2}</td>
                    <td class="lpt-col-nome"></td>
                    <td class="lpt-col-funcao"></td>
                    <td></td>
                </tr>`).join('')}
            </tbody>
        </table>
    </div>`;
};

SysControleWeb.prototype.fecharLPTNR33 = function() {
    const modal = document.getElementById('modalLPTNR33');
    if (modal) modal.style.display = 'none';
    
    // Voltar para a aba NR-33
    if (typeof this.switchNRTab === 'function') {
        this.switchNRTab('nr33');
    }
};

SysControleWeb.prototype.fecharCertNR33 = function() {
    const modal = document.getElementById('modalCertNR33');
    if (modal) modal.style.display = 'none';
    
    if (typeof this.showModal === 'function') {
        this.showModal('modalForm', true);
    } else {
        const modalForm = document.getElementById('modalForm');
        if (modalForm) modalForm.style.display = 'block';
    }
    
    if (typeof this.switchNRTab === 'function') {
        this.switchNRTab('nr33');
    }
};
