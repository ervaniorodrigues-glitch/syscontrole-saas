// ==================== CERTIFICADO NR-06 ====================

SysControleWeb.prototype.toggleCert06Page = function(delta) {
    this.cert06_page = (this.cert06_page === 0) ? 1 : 0;
    this.renderCertNR06();
};

SysControleWeb.prototype.abrirCertNR06 = async function() {
    if (!this.editingId) {
        if (typeof this.showToast === 'function') {
            this.showToast('Selecione um cadastro primeiro', 'warning');
        } else {
            alert('Selecione um cadastro primeiro');
        }
        return;
    }

    // Validação de Data de Emissão (Obrigatória)
    const dataEmi = document.getElementById('nr06_dataEmissao')?.value;
    if (!dataEmi) {
        if (typeof this.showToast === 'function') {
            this.showToast('Acesse a aba NR-06 e preencha a Data de Emissão primeiro!', 'error');
        } else {
            alert('Preencha a Data de Emissão primeiro!');
        }
        return;
    }
    
    // Carregar configuração da NR-06 (Tenta servidor, cai no localStorage)
    let cfg = JSON.parse(localStorage.getItem('cfg_nr06') || '{}');
    try {
        const response = await fetch('/api/config/nr/nr06');
        const resJson = await response.json();
        if (resJson.success && resJson.dados) {
            cfg = resJson.dados;
            localStorage.setItem('cfg_nr06', JSON.stringify(cfg));
        }
    } catch (e) { console.error('Erro ao buscar config NR06 do servidor:', e); }

    document.getElementById('cfg06_instrutor').value       = cfg.instrutor || '';
    document.getElementById('cfg06_cargo_instrutor').value = cfg.cargo_instrutor || '';
    document.getElementById('cfg06_reg_instrutor').value   = cfg.reg_instrutor || '';
    document.getElementById('cfg06_responsavel').value     = cfg.responsavel || '';
    document.getElementById('cfg06_cargo_resp').value      = cfg.cargo_resp || '';
    document.getElementById('cfg06_reg_resp').value        = cfg.reg_resp || '';
    document.getElementById('cfg06_local').value           = cfg.local || '';
    document.getElementById('cfg06_uf').value              = cfg.uf || 'SP';
    const logoInput = document.getElementById('cfg06_logo');
    const logoPreview = document.getElementById('cfg06_logo_preview');
    if (logoInput) logoInput.value = cfg.logo || '';
    if (logoPreview) logoPreview.src = cfg.logo || '/Logo-Hoss.jpg';
    document.getElementById('cert06_num').value            = this.currentEditingData?.Nr06_NumControle || '';
    
    const modal = document.getElementById('modalCertNR06');
    if (modal) modal.style.display = 'block';
    
    this.cert06_page = 0; // Reset to front page
    this.renderCertNR06();
};

SysControleWeb.prototype.abrirCfgNR06 = async function() {
    // Carregar configuração da NR-06 (Tenta servidor, cai no localStorage)
    let cfg = JSON.parse(localStorage.getItem('cfg_nr06') || '{}');
    try {
        const response = await fetch('/api/config/nr/nr06');
        const resJson = await response.json();
        if (resJson.success && resJson.dados) {
            cfg = resJson.dados;
            localStorage.setItem('cfg_nr06', JSON.stringify(cfg));
        }
    } catch (e) { console.error('Erro ao buscar config NR06 do servidor:', e); }

    document.getElementById('cfg06_instrutor').value       = cfg.instrutor || '';
    document.getElementById('cfg06_cargo_instrutor').value = cfg.cargo_instrutor || '';
    document.getElementById('cfg06_reg_instrutor').value   = cfg.reg_instrutor || '';
    document.getElementById('cfg06_responsavel').value     = cfg.responsavel || '';
    document.getElementById('cfg06_cargo_resp').value      = cfg.cargo_resp || '';
    document.getElementById('cfg06_reg_resp').value        = cfg.reg_resp || '';
    document.getElementById('cfg06_local').value           = cfg.local || '';
    document.getElementById('cfg06_uf').value              = cfg.uf || 'SP';
    const logoInput = document.getElementById('cfg06_logo');
    const logoPreview = document.getElementById('cfg06_logo_preview');
    if (logoInput) logoInput.value = cfg.logo || '';
    if (logoPreview) logoPreview.src = cfg.logo || '/Logo-Hoss.jpg';
    
    // Carregar lista de anos
    this.cfg06_anos = cfg.anos || [new Date().getFullYear()];
    this.cfg06_ano_selecionado = cfg.ano_selecionado || new Date().getFullYear();
    this.atualizarListaAnos06();

    const modal = document.getElementById('modalCfgNR06');
    if (modal) modal.style.display = 'block';
};

SysControleWeb.prototype.adicionarAno06 = function() {
    const input = document.getElementById('cfg06_novo_ano');
    const ano = parseInt(input.value);
    if (!ano || ano < 1900 || ano > 2100) {
        if (typeof this.showToast === 'function') this.showToast('Ano inválido', 'error');
        return;
    }
    if (this.cfg06_anos.includes(ano)) {
        if (typeof this.showToast === 'function') this.showToast('Ano já existe', 'warning');
        return;
    }
    this.cfg06_anos.push(ano);
    this.cfg06_anos.sort((a,b) => b - a);
    this.cfg06_ano_selecionado = ano;
    input.value = '';
    this.atualizarListaAnos06();
};

SysControleWeb.prototype.removerAnoSelecionado06 = function() {
    const select = document.getElementById('cfg06_ano_ativo');
    const ano = parseInt(select.value);
    if (!ano) return;

    if (confirm(`Tem certeza que deseja excluir o ano ${ano} da lista?`)) {
        this.removerAno06(ano);
    }
};

SysControleWeb.prototype.removerAno06 = function(ano) {
    // Garantir comparação numérica robusta
    const anoNum = Number(ano);
    this.cfg06_anos = this.cfg06_anos.filter(a => Number(a) !== anoNum);
    
    // Atualizar ano selecionado se o excluído era o ativo
    if (Number(this.cfg06_ano_selecionado) === anoNum) {
        this.cfg06_ano_selecionado = this.cfg06_anos[0] || new Date().getFullYear();
    }
    
    this.atualizarListaAnos06();
    
    if (typeof this.showToast === 'function') {
        this.showToast('Ano removido da lista!', 'info');
    }
};


SysControleWeb.prototype.atualizarListaAnos06 = function() {
    const select = document.getElementById('cfg06_ano_ativo');
    if (!select) return;

    select.innerHTML = '';
    this.cfg06_anos.forEach(ano => {
        const opt = document.createElement('option');
        opt.value = ano;
        opt.textContent = ano;
        if (parseInt(ano) === parseInt(this.cfg06_ano_selecionado)) opt.selected = true;
        select.appendChild(opt);
    });
};


SysControleWeb.prototype.salvarCfgNR06 = async function() {
    const anoAtivo = parseInt(document.getElementById('cfg06_ano_ativo').value);
    const cfgData = {
        instrutor:       document.getElementById('cfg06_instrutor').value,
        cargo_instrutor: document.getElementById('cfg06_cargo_instrutor').value,
        reg_instrutor:   document.getElementById('cfg06_reg_instrutor').value,
        responsavel:     document.getElementById('cfg06_responsavel').value,
        cargo_resp:      document.getElementById('cfg06_cargo_resp').value,
        reg_resp:        document.getElementById('cfg06_reg_resp').value,
        local:           document.getElementById('cfg06_local').value,
        uf:              document.getElementById('cfg06_uf').value,
        logo:            document.getElementById('cfg06_logo').value,
        anos:            this.cfg06_anos,
        ano_selecionado: anoAtivo
    };

    // Salva no localStorage para velocidade
    localStorage.setItem('cfg_nr06', JSON.stringify(cfgData));
    
    // Salva no SERVIDOR para persistência e backup (Crítico)
    try {
        await fetch('/api/config/nr/nr06', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dados: cfgData })
        });
    } catch (e) {
        console.error('Erro ao salvar config NR06 no servidor:', e);
    }
    
    // Sincronizar ano com o registro atual se estiver editando
    if (this.editingId && this.currentEditingData) {
        this.currentEditingData.Nr06_AnoControle = anoAtivo;
        const inputNum = document.getElementById('cert06_num');
        // Agora salva mesmo que o número esteja vazio para o ano carregar corretamente
        const success = await this.verificarESalvarNumeroControle('nr06', (inputNum?.value || ''), inputNum, false);
        if (!success && (inputNum?.value || '')) return; // Manter modal se houver erro (exceto se número estiver vazio)
    }
    
    const modal = document.getElementById('modalCfgNR06');
    if (modal) modal.style.display = 'none';
    
    if (typeof this.showToast === 'function') {
        this.showToast('Configuração salva com sucesso!', 'success');
    }
    this.renderCertNR06();
};


SysControleWeb.prototype.processarLogoUpload = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const logoInput = document.getElementById('cfg06_logo');
            const logoPreview = document.getElementById('cfg06_logo_preview');
            if (logoInput) logoInput.value = e.target.result;
            if (logoPreview) logoPreview.src = e.target.result;
            
            if (typeof this.showToast === 'function') {
                this.showToast('Logo selecionado!', 'success');
            }
        };
        reader.readAsDataURL(input.files[0]);
    }
};

SysControleWeb.prototype.renderCertNR06 = function() {
    const nome   = this._corrigirTexto((document.getElementById('nome')?.value || '').toUpperCase());
    const cpf    = document.getElementById('cpf')?.value || '';
    const funcao = this._corrigirTexto((document.getElementById('funcao')?.value || '').toUpperCase());
    // Priorizar o número do registro (Banco de Dados)
    const numero = document.getElementById('cert06_num')?.value || this.currentEditingData?.Nr06_NumControle || '___';
    
    // Se o número foi alterado manualmente no modal de visualização, podemos manter o comportamento de preview,
    // mas o ideal é que ele venha do banco.
    if (numero !== '___' && !this.currentEditingData?.Nr06_NumControle) {
        localStorage.setItem('cert06_ultimo_num', numero);
    }
    const dataEmissao = document.getElementById('nr06_dataEmissao')?.value || '';

    const cfg = JSON.parse(localStorage.getItem('cfg_nr06') || '{}');
    const instrutor      = this._corrigirTexto(cfg.instrutor      || '_______________________');
    const cargoInstrutor = this._corrigirTexto(cfg.cargo_instrutor || 'Tecnico em Seguranca do Trabalho');
    const regInstrutor   = this._corrigirTexto(cfg.reg_instrutor   || '');
    const responsavel    = this._corrigirTexto(cfg.responsavel     || '_______________________');
    const cargoResp      = this._corrigirTexto(cfg.cargo_resp      || 'Eng. de Seguranca do Trabalho');
    const regResp        = this._corrigirTexto(cfg.reg_resp        || '');
    const local          = this._corrigirTexto(cfg.local           || 'Guarulhos');
    const uf             = this._corrigirTexto(cfg.uf              || 'SP');
    const logoFile       = cfg.logo            || '/Logo-Hoss.jpg';

    const hoje = new Date();
    const dia  = String(hoje.getDate()).padStart(2,'0');
    const mes  = String(hoje.getMonth()+1).padStart(2,'0');
    
    // Priorizar o ano: se o número manual estiver vazio, usa o da config
    const numManualNum = document.getElementById('cert06_num')?.value || this.currentEditingData?.Nr06_NumControle || '';
    const ano = (numManualNum ? (this.currentEditingData?.Nr06_AnoControle || cfg.ano_selecionado) : cfg.ano_selecionado) || hoje.getFullYear();

    const dataExibir = dataEmissao || (dia+'/'+mes+'/'+ano);
    const dataLPT = dataEmissao || (dia+'/'+mes+'/'+ano);

    const currentPage = this.cert06_page || 0;

    const preview = document.getElementById('certNR06_preview');
    if (!preview) return;

    // Obter dados "vivos" do formulário para o preview
    const liveData = this.getDadosAtuaisFormulario();

    // Verificar se o certificado é inválido (excede 8h no dia) ou vencido
    const isInvalido = this.isCertificadoInvalido(liveData, 'nr06');
    const isVencido = this.isCertificadoVencido(liveData, 'nr06');
    let watermarkHTML = '';
    if (isInvalido) watermarkHTML += '<div class="watermark-invalido">CERTIFICADO INVÁLIDO</div>';
    if (isVencido) watermarkHTML += '<div class="watermark-vencido">CERTIFICADO VENCIDO</div>';

    preview.innerHTML = `
    <style id="cert-style">
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Lato:wght@300;400;700&display=swap');

        @media screen {
            #certNR06_preview {
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

        @media print {
            html, body { margin: 0 !important; padding: 0 !important; width: 297mm; height: auto !important; background: #fff; }
            body * { visibility: hidden !important; }
            #certNR06_preview, #certNR06_preview * { visibility: visible !important; }
            #certNR06_preview { position: absolute !important; top: 0 !important; left: 0 !important; width: 297mm !important; margin: 0 !important; padding: 0 !important; background: #fff !important; display: block !important; overflow: visible !important; }
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
        .cert-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4mm; margin-top: 5mm; }
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

    <div class="cert-nav-arrow left" onclick="syscontrole.toggleCert06Page(-1)">&lsaquo;</div>
    <div class="cert-nav-arrow right" onclick="syscontrole.toggleCert06Page(1)">&rsaquo;</div>

    <div class="cert-scale-wrapper page-0">
        <div class="cert-container cert-frente">
            ${watermarkHTML}
            <div class="corner-ornament top-left"><div class="corner-circle"></div></div>
            <div class="corner-ornament top-right"><div class="corner-circle"></div></div>
            <div class="corner-ornament bottom-left"><div class="corner-circle"></div></div>
            <div class="corner-ornament bottom-right"><div class="corner-circle"></div></div>
            <div class="cert-frame-rectangle"></div>
            <div class="cert-inner-content">
                <div class="controle-texto-original">Controle nº NR 06 - ${ano} - ${numero}</div>
                <div class="cert-header">
                    <img src="${logoFile}" class="cert-logo" onerror="this.style.display='none'">
                    <div class="cert-title">CERTIFICADO</div>
                </div>
                <div class="cert-body">
                    Certificamos que o Sr. <strong>${nome}</strong>, portador do CPF: <strong>${cpf}</strong>,
                    frequentou e concluiu satisfatoriamente o <strong><u>Treinamento de Uso adequado, Guarda e
                    Conserva&ccedil;&atilde;o de EPI's</u></strong>, com dura&ccedil;&atilde;o de <strong>4 horas</strong>
                    em atendimento &agrave; <strong>NR 06</strong> da Portaria N&ordm; 3214/78, do Minist&eacute;rio
                    do Trabalho, realizado no per&iacute;odo de 8:00 as 12:00 horas.
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
            <div class="cert-inner-content" style="padding-top: 10mm;">
                <div class="controle-texto-original">Controle nº NR 06 - ${ano} - ${numero}</div>
                <div class="cert-header" style="justify-content: flex-start; margin-top: 5mm;">
                    <img src="${logoFile}" class="cert-logo" onerror="this.style.display='none'">
                </div>
                <div style="font-size: 20pt; font-family: 'Lato', sans-serif; font-weight: bold; text-align: center; margin: 8mm 0; border: none; color: #1a3a6b;">
                    CONTE&Uacute;DO PROGRAM&Aacute;TICO
                </div>
                <div style="font-size: 15pt; line-height: 2.4; color: #222; margin-left: 17mm; font-family: 'Lato', sans-serif;">
                    1. Apresentação da Norma Regulamentadora - NR 06;<br>
                    2. Legisla&ccedil;&atilde;o;<br>3. Certificado de Aprova&ccedil;&atilde;o - CA;<br>
                    4. Finalidade dos EPIs utilizados na empresa;<br>
                    5. Caracter&iacute;sticas t&eacute;cnicas e atenua&ccedil;&otilde;es dos EPIs;<br>
                    6. Modo de utiliza&ccedil;&atilde;o dos EPIs;<br>
                    7. Periodicidade de troca, higieniza&ccedil;&atilde;o e conserva&ccedil;&atilde;o dos EPIs;<br>
                    8. Treinamento pr&aacute;tico com os EPIs.
                </div>
            </div>
        </div>
    </div>`;

    const oldHandler = preview._printHandler;
    if (oldHandler) window.removeEventListener('keydown', oldHandler);

    preview._printHandler = function(e) {
        if (e && e.ctrlKey && e.key.toLowerCase() === 'p' && document.getElementById('modalCertNR06').style.display === 'block') {
            e.preventDefault();
            if(typeof syscontrole !== 'undefined' && syscontrole.imprimirCertificado) syscontrole.imprimirCertificado('nr06', 'ambos');
        }
    };
    window.addEventListener('keydown', preview._printHandler);
};

SysControleWeb.prototype.abrirLPTNR06 = async function() {
    if (!this.editingId) {
        if (typeof this.showToast === 'function') {
            this.showToast('Selecione um cadastro primeiro', 'warning');
        } else {
            alert('Selecione um cadastro primeiro');
        }
        return;
    }

    // Validação de Data de Emissão (Obrigatória)
    const dataEmi = document.getElementById('nr06_dataEmissao')?.value;
    if (!dataEmi) {
        if (typeof this.showToast === 'function') {
            this.showToast('Acesse a aba NR-06 e preencha a Data de Emissão primeiro!', 'error');
        } else {
            alert('Preencha a Data de Emissão primeiro!');
        }
        return;
    }
    
    // Sincronizar dados da config (Tenta servidor)
    let cfg = JSON.parse(localStorage.getItem('cfg_nr06') || '{}');
    try {
        const response = await fetch('/api/config/nr/nr06');
        const resJson = await response.json();
        if (resJson.success && resJson.dados) {
            cfg = resJson.dados;
            localStorage.setItem('cfg_nr06', JSON.stringify(cfg));
        }
    } catch (e) { console.error('Erro ao buscar config NR06 do servidor:', e); }

    document.getElementById('cfg06_instrutor').value       = cfg.instrutor || '';
    document.getElementById('cfg06_cargo_instrutor').value = cfg.cargo_instrutor || '';
    document.getElementById('cfg06_reg_instrutor').value   = cfg.reg_instrutor || '';
    document.getElementById('cfg06_responsavel').value     = cfg.responsavel || '';
    document.getElementById('cfg06_cargo_resp').value      = cfg.cargo_resp || '';
    document.getElementById('cfg06_reg_resp').value        = cfg.reg_resp || '';
    document.getElementById('cfg06_local').value           = cfg.local || '';
    document.getElementById('cfg06_uf').value              = cfg.uf || 'SP';
    
    const modal = document.getElementById('modalLPTNR06');
    if (modal) modal.style.display = 'block';
    
    this.renderLPTNR06();
};

SysControleWeb.prototype.renderLPTNR06 = function() {
    const nome        = this._corrigirTexto((document.getElementById('nome')?.value || '').toUpperCase());
    const funcao      = this._corrigirTexto((document.getElementById('funcao')?.value || '').toUpperCase());
    const empresa     = this._corrigirTexto((document.getElementById('empresa')?.value || '').toUpperCase());
    const dataEmissao = document.getElementById('nr06_dataEmissao')?.value || '';

    const cfg = JSON.parse(localStorage.getItem('cfg_nr06') || '{}');
    const instrutor      = cfg.instrutor      || '_______________________';
    const cargoInstrutor = cfg.cargo_instrutor || 'Tecnico em Seguranca do Trabalho';
    const local          = cfg.local           || 'Guarulhos';
    const logoFile       = cfg.logo            || '/Logo-Hoss.jpg';

    const hoje = new Date();
    const dia  = String(hoje.getDate()).padStart(2,'0');
    const mes  = String(hoje.getMonth()+1).padStart(2,'0');
    const ano  = hoje.getFullYear();
    const dataExibir = dataEmissao || (dia+'/'+mes+'/'+ano);

    const preview = document.getElementById('lptNR06_preview');
    if (!preview) return;

    preview.innerHTML = `
    <style id="lpt-style">
        @import url('https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&display=swap');

        @page {
            size: A4 portrait;
            margin: 0;
        }

        @media screen {
            #lptNR06_preview { padding: 20px; background: #f0f0f0; display: flex; justify-content: center; overflow-y: auto; }
            .lpt-page { background: #fff; width: 210mm; min-height: 297mm; padding: 10mm; box-sizing: border-box; box-shadow: 0 0 10px rgba(0,0,0,0.2); }
        }

        @media print {
            body { margin: 0; padding: 0; background: #fff; }
            
            /* Esconder elementos indesejados */
            #modalLPTNR06 {
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
            #modalLPTNR06 > div > div:first-child,
            #modalLPTNR06 .btn-cfg-mobile-hide,
            .modal-header, 
            .modal-footer {
                display: none !important;
            }

            #lptNR06_preview, #lptNR06_preview * { visibility: visible !important; }
            #lptNR06_preview { 
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
            body > *:not(#modalLPTNR06) { display: none !important; }
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
        
        .lpt-topics { border: 1px solid #000; padding: 2mm 5mm; margin-bottom: 3mm; font-size: 8.5pt; background: #fff; }
        .lpt-topics ol { margin: 0; padding-left: 15px; list-style-type: decimal; }
        .lpt-topics li { margin-bottom: 1px; font-weight: bold; font-style: italic; }
        
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
                <div class="lpt-title-top">TREINAMENTO NR 06<br>EPI - EQUIPAMENTO DE PROTEÇÃO INDIVIDUAL</div>
                <div class="lpt-title-bottom">LISTA DE PRESENÇA DE TREINAMENTO - LPT</div>
            </div>
        </div>

        <div class="lpt-info-section">
            <div class="lpt-empresa">EMPRESA: ${empresa}</div>
        </div>

        <div class="lpt-topics">
            <ol>
                <li>Apresentação da Norma Regulamentadora - NR 06.</li>
                <li>Legislação.</li>
                <li>Certificado de Aprovação - CA.</li>
                <li>Finalidade dos EPIs utilizados na empresa.</li>
                <li>Descrição do equipamento e seus componentes.</li>
                <li>Risco ocupacional contra o qual o EPI oferece proteção.</li>
                <li>Restrições e limitações de proteção.</li>
                <li>Forma adequada de uso e ajuste.</li>
                <li>Manutenção e substituição.</li>
                <li>Cuidados de limpeza, higienização, guarda e conservação.</li>
                <li>Treinamento prático com os EPIs.</li>
            </ol>
        </div>

        <div class="lpt-details-grid">
            <div class="lpt-detail-item">
                <span class="lpt-detail-label">Instrutor: </span>
                <span class="lpt-detail-value">${instrutor}</span><br>
                <span style="font-size: 8pt; margin-left: 20mm; font-weight: bold; text-transform: uppercase;">${cargoInstrutor}</span>
            </div>
            <div class="lpt-detail-item" style="text-align: center;">
                <span class="lpt-detail-label">Duração: </span><br>
                <span class="lpt-detail-value" style="min-width: 80%; font-weight: bold;">04 HORAS</span>
            </div>
            <div class="lpt-detail-item" style="border-bottom: none;">
                <span class="lpt-detail-label">Local do treinamento: </span>
                <span class="lpt-detail-value" style="min-width: 50%;">${local}</span>
            </div>
            <div class="lpt-detail-item" style="border-bottom: none; text-align: center; border-left: 1px solid #000; padding-left: 5px;">
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

SysControleWeb.prototype.fecharLPTNR06 = function() {
    const modal = document.getElementById('modalLPTNR06');
    if (modal) modal.style.display = 'none';
    
    // Voltar para a aba NR-06
    if (typeof this.switchNRTab === 'function') {
        this.switchNRTab('nr06');
    }
};

SysControleWeb.prototype.fecharCertNR06 = function() {
    const modal = document.getElementById('modalCertNR06');
    if (modal) modal.style.display = 'none';
    
    // Voltar para a tela de origem (Formulário principal) usando a função nativa do sistema
    if (typeof this.showModal === 'function') {
        this.showModal('modalForm', true); // true = skipReset para manter os dados preenchidos
    } else {
        const modalForm = document.getElementById('modalForm');
        if (modalForm) modalForm.style.display = 'block';
    }
    
    // Garantir que volta para a aba NR-06
    if (typeof this.switchNRTab === 'function') {
        this.switchNRTab('nr06');
    }
};


