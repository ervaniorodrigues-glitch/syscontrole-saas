// ==================== CERTIFICADO NR-20 ====================

SysControleWeb.prototype.toggleCert20Page = function(delta) {
    this.cert20_page = (this.cert20_page === 0) ? 1 : 0;
    this.renderCertNR20();
};

SysControleWeb.prototype.abrirCertNR20 = async function() {
    if (!this.editingId) {
        if (typeof this.showToast === 'function') {
            this.showToast('Selecione um cadastro primeiro', 'warning');
        } else {
            alert('Selecione um cadastro primeiro');
        }
        return;
    }

    // Validação de Data de Emissão (Obrigatória)
    const dataEmi = document.getElementById('nr20_dataEmissao')?.value;
    if (!dataEmi) {
        if (typeof this.showToast === 'function') {
            this.showToast('Por favor, informe a Data de Emissão para gerar o documento.', 'error');
        } else {
            alert('Preencha a Data de Emissão primeiro!');
        }
        return;
    }
    
    // Carregar configuração da NR-20 (Tenta servidor, cai no localStorage)
    let cfg = JSON.parse(localStorage.getItem('cfg_nr20') || '{}');
    try {
        const response = await fetch('/api/config/nr/nr20');
        const resJson = await response.json();
        if (resJson.success && resJson.dados) {
            cfg = resJson.dados;
            localStorage.setItem('cfg_nr20', JSON.stringify(cfg));
        }
    } catch (e) { console.error('Erro ao buscar config NR20 do servidor:', e); }

    document.getElementById('cfg20_instrutor').value       = cfg.instrutor || '';
    document.getElementById('cfg20_cargo_instrutor').value = cfg.cargo_instrutor || '';
    document.getElementById('cfg20_reg_instrutor').value   = cfg.reg_instrutor || '';
    document.getElementById('cfg20_responsavel').value     = cfg.responsavel || '';
    document.getElementById('cfg20_cargo_resp').value      = cfg.cargo_resp || '';
    document.getElementById('cfg20_reg_resp').value        = cfg.reg_resp || '';
    document.getElementById('cfg20_local').value           = cfg.local || '';
    document.getElementById('cfg20_uf').value              = cfg.uf || 'SP';
    const logoInput = document.getElementById('cfg20_logo');
    const logoPreview = document.getElementById('cfg20_logo_preview');
    if (logoInput) logoInput.value = cfg.logo || '';
    if (logoPreview) logoPreview.src = cfg.logo || '/Logo-Hoss.jpg';
    document.getElementById('cert20_num').value            = this.currentEditingData?.Nr20_NumControle || '';
    
    const modal = document.getElementById('modalCertNR20');
    if (modal) modal.style.display = 'block';
    
    this.cert20_page = 0; // Reset to front page
    this.renderCertNR20();
};

SysControleWeb.prototype.abrirCfgNR20 = async function() {
    // Carregar configuração da NR-20 (Tenta servidor, cai no localStorage)
    let cfg = JSON.parse(localStorage.getItem('cfg_nr20') || '{}');
    try {
        const response = await fetch('/api/config/nr/nr20');
        const resJson = await response.json();
        if (resJson.success && resJson.dados) {
            cfg = resJson.dados;
            localStorage.setItem('cfg_nr20', JSON.stringify(cfg));
        }
    } catch (e) { console.error('Erro ao buscar config NR20 do servidor:', e); }

    document.getElementById('cfg20_instrutor').value       = cfg.instrutor || '';
    document.getElementById('cfg20_cargo_instrutor').value = cfg.cargo_instrutor || '';
    document.getElementById('cfg20_reg_instrutor').value   = cfg.reg_instrutor || '';
    document.getElementById('cfg20_responsavel').value     = cfg.responsavel || '';
    document.getElementById('cfg20_cargo_resp').value      = cfg.cargo_resp || '';
    document.getElementById('cfg20_reg_resp').value        = cfg.reg_resp || '';
    document.getElementById('cfg20_local').value           = cfg.local || '';
    document.getElementById('cfg20_uf').value              = cfg.uf || 'SP';
    const logoInput = document.getElementById('cfg20_logo');
    const logoPreview = document.getElementById('cfg20_logo_preview');
    if (logoInput) logoInput.value = cfg.logo || '';
    if (logoPreview) logoPreview.src = cfg.logo || '/Logo-Hoss.jpg';
    
    document.getElementById('cfg20_data_fim').value       = cfg.data_fim || '';
    
    // Nível
    const nivel = cfg.nivel || 'basico';
    const radioNivel = document.getElementById('cfg20_radio_' + nivel);
    if (radioNivel) radioNivel.checked = true;

    // Classe
    const classe = cfg.classe || 'I';
    const radioClasse = document.getElementById('cfg20_radio_classe' + (classe === 'I' ? '1' : classe === 'II' ? '2' : '3'));
    if (radioClasse) radioClasse.checked = true;

    // Carregar lista de anos
    this.cfg20_anos = cfg.anos || [new Date().getFullYear()];
    this.cfg20_ano_selecionado = cfg.ano_selecionado || new Date().getFullYear();
    this.atualizarListaAnos20();

    const modal = document.getElementById('modalCfgNR20');
    if (modal) modal.style.display = 'block';
};

SysControleWeb.prototype.adicionarAno20 = function() {
    const input = document.getElementById('cfg20_novo_ano');
    const ano = parseInt(input.value);
    if (!ano || ano < 1900 || ano > 2100) {
        if (typeof this.showToast === 'function') this.showToast('Ano inválido', 'error');
        return;
    }
    if (this.cfg20_anos.includes(ano)) {
        if (typeof this.showToast === 'function') this.showToast('Ano já existe', 'warning');
        return;
    }
    this.cfg20_anos.push(ano);
    this.cfg20_anos.sort((a,b) => b - a);
    this.cfg20_ano_selecionado = ano;
    input.value = '';
    this.atualizarListaAnos20();
};

SysControleWeb.prototype.removerAnoSelecionado20 = function() {
    const select = document.getElementById('cfg20_ano_ativo');
    const ano = parseInt(select.value);
    if (!ano) return;
    if (confirm(`Tem certeza que deseja excluir o ano ${ano} da lista?`)) {
        this.removerAno20(ano);
    }
};

SysControleWeb.prototype.removerAno20 = function(ano) {
    const anoNum = Number(ano);
    this.cfg20_anos = this.cfg20_anos.filter(a => Number(a) !== anoNum);
    if (Number(this.cfg20_ano_selecionado) === anoNum) {
        this.cfg20_ano_selecionado = this.cfg20_anos[0] || new Date().getFullYear();
    }
    this.atualizarListaAnos20();
    if (typeof this.showToast === 'function') this.showToast('Ano removido da lista!', 'info');
};

SysControleWeb.prototype.atualizarListaAnos20 = function() {
    const select = document.getElementById('cfg20_ano_ativo');
    if (!select) return;
    select.innerHTML = '';
    this.cfg20_anos.forEach(ano => {
        const opt = document.createElement('option');
        opt.value = ano;
        opt.textContent = ano;
        if (parseInt(ano) === parseInt(this.cfg20_ano_selecionado)) opt.selected = true;
        select.appendChild(opt);
    });
};

SysControleWeb.prototype.salvarCfgNR20 = async function() {
    const anoAtivo = parseInt(document.getElementById('cfg20_ano_ativo').value);
    const nivelVal = document.querySelector('input[name="cfg20_nivel"]:checked')?.value || 'basico';
    const classeVal = document.querySelector('input[name="cfg20_classe"]:checked')?.value || 'I';

    const cfgData = {
        instrutor:       document.getElementById('cfg20_instrutor').value,
        cargo_instrutor: document.getElementById('cfg20_cargo_instrutor').value,
        reg_instrutor:   document.getElementById('cfg20_reg_instrutor').value,
        responsavel:     document.getElementById('cfg20_responsavel').value,
        cargo_resp:      document.getElementById('cfg20_cargo_resp').value,
        reg_resp:        document.getElementById('cfg20_reg_resp').value,
        local:           document.getElementById('cfg20_local').value,
        uf:              document.getElementById('cfg20_uf').value,
        logo:            document.getElementById('cfg20_logo').value,
        data_fim:        document.getElementById('cfg20_data_fim').value,
        nivel:           nivelVal,
        classe:          classeVal,
        anos:            this.cfg20_anos,
        ano_selecionado: anoAtivo
    };

    // Salva no localStorage para velocidade
    localStorage.setItem('cfg_nr20', JSON.stringify(cfgData));
    
    // Salva no SERVIDOR para persistência e backup (Crítico)
    try {
        await fetch('/api/config/nr/nr20', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dados: cfgData })
        });
    } catch (e) {
        console.error('Erro ao salvar config NR20 no servidor:', e);
    }
    
    // Sincronizar ano com o registro atual se estiver editando
    if (this.editingId && this.currentEditingData) {
        this.currentEditingData.Nr20_AnoControle = anoAtivo;
        const inputNum = document.getElementById('cert20_num');
        // Agora salva mesmo que o número esteja vazio para o ano carregar corretamente
        const success = await this.verificarESalvarNumeroControle('nr20', (inputNum?.value || ''), inputNum, false);
        if (!success && (inputNum?.value || '')) return;
    }
    
    const modal = document.getElementById('modalCfgNR20');
    if (modal) modal.style.display = 'none';
    if (typeof this.showToast === 'function') this.showToast('Configuração salva com sucesso!', 'success');
    this.renderCertNR20();
};


SysControleWeb.prototype.processarLogoUploadNR20 = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const logoInput = document.getElementById('cfg20_logo');
            const logoPreview = document.getElementById('cfg20_logo_preview');
            if (logoInput) logoInput.value = e.target.result;
            if (logoPreview) logoPreview.src = e.target.result;
            
            if (typeof this.showToast === 'function') {
                this.showToast('Logo selecionado!', 'success');
            }
        };
        reader.readAsDataURL(input.files[0]);
    }
};


SysControleWeb.prototype.renderCertNR20 = function() {
    const nome   = this._corrigirTexto((document.getElementById('nome')?.value || '').toUpperCase());
    const cpf    = document.getElementById('cpf')?.value || '';
    const funcao = this._corrigirTexto((document.getElementById('funcao')?.value || '').toUpperCase());
    // Priorizar o número do registro (Banco de Dados)
    const numero = document.getElementById('cert20_num')?.value || this.currentEditingData?.Nr20_NumControle || '___';
    
    // Se o número foi alterado manualmente no modal de visualização, podemos manter o comportamento de preview,
    // mas o ideal é que ele venha do banco.
    if (numero !== '___' && !this.currentEditingData?.Nr20_NumControle) {
        localStorage.setItem('cert20_ultimo_num', numero);
    }
    const dataEmissao = document.getElementById('nr20_dataEmissao')?.value || '';

    const cfg = JSON.parse(localStorage.getItem('cfg_nr20') || '{}');
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
    const numManualNum = document.getElementById('cert20_num')?.value || this.currentEditingData?.Nr20_NumControle || '';
    const ano = (numManualNum ? (this.currentEditingData?.Nr20_AnoControle || cfg.ano_selecionado) : cfg.ano_selecionado) || hoje.getFullYear();
    const dataEmissaoFormatada = dataEmissao || (dia+'/'+mes+'/'+ano);
    let dataExibir = dataEmissaoFormatada;
    if (cfg.data_fim && cfg.data_fim.trim() !== '' && cfg.data_fim !== dataEmissaoFormatada) {
        dataExibir = dataEmissaoFormatada + ' à ' + cfg.data_fim;
    }

    const nivelMap = {
        'iniciacao':     { label: 'Iniciação',     horas: 4,  horasLabel: '4 horas',      diasNec: 1,  modulos: 'Integração, <strong>Iniciação</strong>' },
        'basico':        { label: 'Básico',        horas: 8,  horasLabel: '4 a 8 horas',  diasNec: 1,  modulos: 'Integração, Iniciação, <strong>Básico</strong>' },
        'intermediario': { label: 'Intermediário', horas: 16, horasLabel: '12 a 16 horas', diasNec: 2,  modulos: 'Integração, Iniciação, Básico, <strong>Intermediário</strong>' },
        'avancado':      { label: 'Avançado',      horas: 32, horasLabel: '20 a 32 horas', diasNec: 3,  modulos: 'Integração, Iniciação, Básico, Intermediário, <strong>Avançado</strong>' }
    };
    const nivelInfo = nivelMap[cfg.nivel || 'basico'] || nivelMap.basico;
    const labelClasse = cfg.classe ? ('Instalações de Classe ' + cfg.classe) : '';

    const dataLPT = dataEmissaoFormatada;

    // --- Validação de período para CERTIFICADO INVÁLIDO ---
    // Iniciação/Básico: 1 dia suficiente → nunca dep. de Data Fim p/ validação
    // Intermediário/Avançado: exige múltiplos dias → sem Data Fim = INVÁLIDO
    let periodoValido = true;
    const nivelRequerDataFim = (cfg.nivel === 'intermediario' || cfg.nivel === 'avancado');
    if (nivelRequerDataFim) {
        if (cfg.data_fim && cfg.data_fim.trim() !== '' && dataEmissao) {
            const parseData = (str) => {
                const parts = str.split('/');
                if (parts.length !== 3) return null;
                return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            };
            const dtInicio = parseData(dataEmissao);
            const dtFim = parseData(cfg.data_fim);
            if (dtInicio && dtFim && dtFim >= dtInicio) {
                const diasPeriodo = Math.round((dtFim - dtInicio) / (1000 * 60 * 60 * 24)) + 1;
                periodoValido = diasPeriodo >= nivelInfo.diasNec;
            } else {
                periodoValido = false;
            }
        } else {
            // Sem Data Fim configurada para nível que exige múltiplos dias
            periodoValido = false;
        }
    }

    const currentPage = this.cert20_page || 0;

    const preview = document.getElementById('certNR20_preview');
    if (!preview) return;

    // Obter dados "vivos" do formulário para o preview
    const liveData = this.getDadosAtuaisFormulario();

    // Verificar se o certificado é inválido: usa a lógica de período acima
    const isInvalido = periodoValido ? false : this.isCertificadoInvalido(liveData, 'nr20');
    const isVencido = this.isCertificadoVencido(liveData, 'nr20');
    // Se nível exige Data Fim e ela não está informada, forçar inválido no certificado
    const isSemDataFim = nivelRequerDataFim && (!cfg.data_fim || cfg.data_fim.trim() === '');
    let watermarkHTML = '';
    if (isSemDataFim || isInvalido) watermarkHTML += '<div class="watermark-invalido">CERTIFICADO INVÁLIDO</div>';
    if (isVencido) watermarkHTML += '<div class="watermark-vencido">CERTIFICADO VENCIDO</div>';

    preview.innerHTML = `
    <style id="cert-style">
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Lato:wght@300;400;700&display=swap');

        @media screen {
            #certNR20_preview {
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
            #certNR20_preview, #certNR20_preview * { visibility: visible !important; }
            #certNR20_preview { position: absolute !important; top: 0 !important; left: 0 !important; width: 297mm !important; margin: 0 !important; padding: 0 !important; background: #fff !important; display: block !important; overflow: visible !important; }
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

    <div class="cert-nav-arrow left" onclick="syscontrole.toggleCert20Page(-1)">&lsaquo;</div>
    <div class="cert-nav-arrow right" onclick="syscontrole.toggleCert20Page(1)">&rsaquo;</div>

    <div class="cert-scale-wrapper page-0">
        <div class="cert-container cert-frente">
            ${watermarkHTML}
            <div class="corner-ornament top-left"><div class="corner-circle"></div></div>
            <div class="corner-ornament top-right"><div class="corner-circle"></div></div>
            <div class="corner-ornament bottom-left"><div class="corner-circle"></div></div>
            <div class="corner-ornament bottom-right"><div class="corner-circle"></div></div>
            <div class="cert-frame-rectangle"></div>
            <div class="cert-inner-content">
                <div class="controle-texto-original">Controle nº NR 20 - ${ano} - ${numero}</div>
                <div class="cert-header">
                    <img src="${logoFile}" class="cert-logo" onerror="this.style.display='none'">
                    <div class="cert-title">CERTIFICADO</div>
                </div>
                <div class="cert-body">
                    Certificamos que o Sr. <strong>${nome}</strong>, portador do CPF: <strong>${cpf}</strong>,
                    frequentou e concluiu satisfatoriamente o Treinamento de Seguran&ccedil;a e sa&uacute;de no trabalho com
                    <strong><u>Inflam&aacute;veis e Combust&iacute;veis</u></strong> seguidos pelos m&oacute;dulos:
                    ${nivelInfo.modulos}
                    conforme Item 20.11 anexo II da NR-20. Realizado nas depend&ecirc;ncias
                    da empresa com dura&ccedil;&atilde;o de <strong>${nivelInfo.horasLabel}</strong>.
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
            <div class="cert-inner-content" style="padding-top: 20mm;">
                <div class="controle-texto-original">Controle nº NR 20 - ${ano} - ${numero}</div>
                <div class="cert-header" style="justify-content: flex-start; margin-top: 0mm;">
                    <img src="${logoFile}" class="cert-logo" onerror="this.style.display='none'">
                </div>
                <div style="font-size: 20pt; font-family: 'Lato', sans-serif; font-weight: bold; text-align: center; margin: 0; border: none; color: #1a3a6b; margin-top: 2mm;">
                    CONTE&Uacute;DO PROGRAM&Aacute;TICO
                </div>
                <div style="font-size: 14pt; line-height: 2.4; color: #222; margin-left: 17mm; font-family: 'Lato', sans-serif;">
                    - Inflam&aacute;veis: Caracter&iacute;sticas, propriedades, perigos e riscos<br>
                    - Controle Coletivo e Individual para trabalho com inflam&aacute;veis<br>
                    - Fonte de Igni&ccedil;&atilde;o e seu controle<br>
                    - Prote&ccedil;&atilde;o contra Inc&ecirc;ndio com Inflam&aacute;veis<br>
                    - Procedimentos em Situa&ccedil;&atilde;o de emerg&ecirc;ncia com inflam&aacute;veis<br>
                    - Estudo da Norma Regulamentadora NR-20<br>
                    - Analise Preliminar de Perigos/Riscos<br>
                    - Permiss&atilde;o para Trabalho com Inflam&aacute;veis<br>
                    <strong>CURSO PR&Aacute;TICO</strong><br>
                    - Conhecimento e utiliza&ccedil;&atilde;o dos sistemas de seguran&ccedil;a contra inc&ecirc;ndio com inflam&aacute;veis
                </div>
            </div>
        </div>
    </div>`;

    const oldHandler = preview._printHandler;
    if (oldHandler) window.removeEventListener('keydown', oldHandler);

    preview._printHandler = function(e) {
        if (e && e.ctrlKey && e.key.toLowerCase() === 'p' && document.getElementById('modalCertNR20').style.display === 'block') {
            e.preventDefault();
            if(typeof syscontrole !== 'undefined' && syscontrole.imprimirCertificado) syscontrole.imprimirCertificado('nr20', 'ambos');
        }
    };
    window.addEventListener('keydown', preview._printHandler);
};

SysControleWeb.prototype.abrirLPTNR20 = async function() {
    if (!this.editingId) {
        if (typeof this.showToast === 'function') {
            this.showToast('Selecione um cadastro primeiro', 'warning');
        } else {
            alert('Selecione um cadastro primeiro');
        }
        return;
    }

    // Validação de Data de Emissão (Obrigatória)
    const dataEmi = document.getElementById('nr20_dataEmissao')?.value;
    if (!dataEmi) {
        if (typeof this.showToast === 'function') {
            this.showToast('Por favor, informe a Data de Emissão para gerar o documento.', 'error');
        } else {
            alert('Preencha a Data de Emissão primeiro!');
        }
        return;
    }
    
    // Sincronizar dados da config (Tenta servidor)
    let cfg = JSON.parse(localStorage.getItem('cfg_nr20') || '{}');
    try {
        const response = await fetch('/api/config/nr/nr20');
        const resJson = await response.json();
        if (resJson.success && resJson.dados) {
            cfg = resJson.dados;
            localStorage.setItem('cfg_nr20', JSON.stringify(cfg));
        }
    } catch (e) { console.error('Erro ao buscar config NR20 do servidor:', e); }

    document.getElementById('cfg20_instrutor').value       = cfg.instrutor || '';
    document.getElementById('cfg20_cargo_instrutor').value = cfg.cargo_instrutor || '';
    document.getElementById('cfg20_reg_instrutor').value   = cfg.reg_instrutor || '';
    document.getElementById('cfg20_responsavel').value     = cfg.responsavel || '';
    document.getElementById('cfg20_cargo_resp').value      = cfg.cargo_resp || '';
    document.getElementById('cfg20_reg_resp').value        = cfg.reg_resp || '';
    document.getElementById('cfg20_local').value           = cfg.local || '';
    document.getElementById('cfg20_uf').value              = cfg.uf || 'SP';
    
    const modal = document.getElementById('modalLPTNR20');
    if (modal) modal.style.display = 'block';
    
    this.renderLPTNR20();
};

SysControleWeb.prototype.renderLPTNR20 = function() {
    const nome        = this._corrigirTexto((document.getElementById('nome')?.value || '').toUpperCase());
    const funcao      = this._corrigirTexto((document.getElementById('funcao')?.value || '').toUpperCase());
    const empresa     = this._corrigirTexto((document.getElementById('empresa')?.value || '').toUpperCase());
    const dataEmissao = document.getElementById('nr20_dataEmissao')?.value || '';

    const cfg = JSON.parse(localStorage.getItem('cfg_nr20') || '{}');
    const instrutor      = cfg.instrutor      || '_______________________';
    const cargoInstrutor = cfg.cargo_instrutor || 'Tecnico em Seguranca do Trabalho';
    const local          = cfg.local           || 'Refeitório';
    const logoFile       = cfg.logo            || '/Logo-Hoss.jpg';

    const hoje = new Date();
    const dia  = String(hoje.getDate()).padStart(2,'0');
    const mes  = String(hoje.getMonth()+1).padStart(2,'0');
    const ano  = cfg.ano_selecionado || hoje.getFullYear();
    const dataBase = dataEmissao || (dia+'/'+mes+'/'+ano);
    let dataExibir = dataBase;
    if (cfg.data_fim && cfg.data_fim.trim() !== '' && cfg.data_fim !== dataBase) {
        dataExibir = dataBase + ' à ' + cfg.data_fim;
    }

    const nivelMapLPT = {
        'iniciacao':     { label: 'Iniciação',     horas: 4,  horasLabel: '4 horas' },
        'basico':        { label: 'Básico',        horas: 8,  horasLabel: '4 a 8 horas' },
        'intermediario': { label: 'Intermediário', horas: 16, horasLabel: '12 a 16 horas' },
        'avancado':      { label: 'Avançado',      horas: 32, horasLabel: '20 a 32 horas' }
    };
    const nivelInfo = nivelMapLPT[cfg.nivel || 'basico'] || nivelMapLPT.basico;

    const preview = document.getElementById('lptNR20_preview');
    if (!preview) return;

    preview.innerHTML = `
    <style id="lpt-style">
        @import url('https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&display=swap');

        @media screen {
            #lptNR20_preview { padding: 20px; background: #f0f0f0; display: flex; justify-content: center; overflow-y: auto; }
            .lpt-page { background: #fff; width: 210mm; min-height: 297mm; padding: 10mm; box-sizing: border-box; box-shadow: 0 0 10px rgba(0,0,0,0.2); }
        }

        @media print {
            @page { size: A4 portrait; margin: 0; }
            body * { visibility: hidden !important; }
            #lptNR20_preview, #lptNR20_preview * { visibility: visible !important; }
            #lptNR20_preview { position: absolute; top: 0; left: 0; width: 100%; padding: 0; margin: 0; background: #fff; }
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
        
        .lpt-topics { border: 1px solid #000; padding: 2mm 5mm; margin-bottom: 3mm; font-size: 8.5pt; background: #fff; }
        .lpt-topics ol { margin: 0; padding-left: 15px; list-style-type: decimal; }
        .lpt-topics li { margin-bottom: 1px; font-weight: bold; font-style: italic; }
        
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
                <div class="lpt-title-top">TREINAMENTO NR 20<br>INFLAM&Aacute;VEIS E COMBUST&Iacute;VEIS</div>
                <div class="lpt-title-bottom">LISTA DE PRESEN&Ccedil;A DE TREINAMENTO - LPT</div>
            </div>
        </div>

        <div class="lpt-info-section">
            <div class="lpt-empresa">EMPRESA: ${empresa}</div>
        </div>

        <div class="lpt-topics">
            <ol>
                <li>Normas e Legisla&ccedil;&atilde;o Aplicadas nos Trabalhos e Manipula&ccedil;&atilde;o de Inflam&aacute;veis e L&iacute;quidos Combust&iacute;veis;</li>
                <li>Atividades do Transportador-Revendedor-Retalhista (TRR);</li>
                <li>Aplica&ccedil;&otilde;es da NR 20;</li>
                <li>Requisitos para a Instala&ccedil;&atilde;o de Postos Combust&iacute;veis;</li>
                <li>Inflam&aacute;veis: Caracter&iacute;sticas, Propriedades, Perigos e Riscos;</li>
                <li>Equipamentos do Sistema de Abastecimento de Ve&iacute;culos;</li>
                <li>Controle Coletivo e Individual para Trabalhos com Inflam&aacute;veis;</li>
                <li>Principais Componentes das Bombas de Abastecimento de Combust&iacute;veis;</li>
                <li>Fontes de igni&ccedil;&atilde;o e seu Controle;</li>
                <li>Prote&ccedil;&atilde;o Contra Inc&ecirc;ndio com Inflam&aacute;veis.</li>
            </ol>
            <div style="margin-top: 4mm; font-size: 8.5pt; text-align: justify; border-top: 1px solid #000; padding-top: 3mm; line-height: 1.4;">
                O objetivo do Curso de NR 20 &eacute; abordar aspectos sobre legisla&ccedil;&atilde;o, englobando as resolu&ccedil;&otilde;es e normas elaboradas com aplicabilidade no transporte, manuseio, armazenagem e atendimento a produtos perigosos. O conte&uacute;do do Curso de NR 20 B&aacute;sico da Intensiva Cursos foi elaborado por profissionais das &aacute;reas de Seguran&ccedil;a no Trabalho (T&eacute;cnica em Seguran&ccedil;a no Trabalho) e Sa&uacute;de/Primeiros Socorros (Enfermeira intensivista)
            </div>
        </div>

        <div class="lpt-details-grid">
            <div class="lpt-detail-item">
                <span class="lpt-detail-label">Instrutor: </span>
                <span class="lpt-detail-value">${instrutor}</span><br>
                <span style="font-size: 8pt; margin-left: 20mm; font-weight: bold; text-transform: uppercase;">${cargoInstrutor}</span>
            </div>
            <div class="lpt-detail-item" style="text-align: center;">
                <span class="lpt-detail-label">Duração: ${nivelInfo.label}</span><br>
                <span class="lpt-detail-value" style="min-width: 80%; font-weight: bold;">${nivelInfo.horas} HORAS</span>
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

SysControleWeb.prototype.fecharLPTNR20 = function() {
    const modal = document.getElementById('modalLPTNR20');
    if (modal) modal.style.display = 'none';
    
    // Voltar para a aba NR-20
    if (typeof this.switchNRTab === 'function') {
        this.switchNRTab('nr20');
    }
};

SysControleWeb.prototype.fecharCertNR20 = function() {
    const modal = document.getElementById('modalCertNR20');
    if (modal) modal.style.display = 'none';
    
    // Voltar para a tela de origem (Formulário principal) usando a função nativa do sistema
    if (typeof this.showModal === 'function') {
        this.showModal('modalForm', true); // true = skipReset para manter os dados preenchidos
    } else {
        const modalForm = document.getElementById('modalForm');
        if (modalForm) modalForm.style.display = 'block';
    }
    
    // Garantir que volta para a aba NR-20
    if (typeof this.switchNRTab === 'function') {
        this.switchNRTab('nr20');
    }
};


