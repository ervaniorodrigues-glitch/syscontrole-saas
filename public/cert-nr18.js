// ==================== CERTIFICADO NR-18 ====================

SysControleWeb.prototype.toggleCert18Page = function(delta) {
    this.cert18_page = (this.cert18_page === 0) ? 1 : 0;
    this.renderCertNR18();
};

SysControleWeb.prototype.abrirCertNR18 = async function() {
    if (!this.editingId) {
        if (typeof this.showToast === 'function') {
            this.showToast('Selecione um cadastro primeiro', 'warning');
        } else {
            alert('Selecione um cadastro primeiro');
        }
        return;
    }

    // Validação de Data de Emissão (Obrigatória)
    const dataEmi = document.getElementById('nr18_dataEmissao')?.value;
    if (!dataEmi) {
        if (typeof this.showToast === 'function') {
            this.showToast('Por favor, informe a Data de Emissão para gerar o documento.', 'error');
        } else {
            alert('Preencha a Data de Emissão primeiro!');
        }
        return;
    }
    
    // Carregar configuração da NR-18 (Tenta servidor, cai no localStorage)
    let cfg = JSON.parse(localStorage.getItem('cfg_nr18') || '{}');
    try {
        const response = await fetch('/api/config/nr/nr18');
        const resJson = await response.json();
        if (resJson.success && resJson.dados) {
            cfg = resJson.dados;
            localStorage.setItem('cfg_nr18', JSON.stringify(cfg));
        }
    } catch (e) { console.error('Erro ao buscar config NR18 do servidor:', e); }

    document.getElementById('cfg18_instrutor').value       = cfg.instrutor || '';
    document.getElementById('cfg18_cargo_instrutor').value = cfg.cargo_instrutor || '';
    document.getElementById('cfg18_reg_instrutor').value   = cfg.reg_instrutor || '';
    document.getElementById('cfg18_responsavel').value     = cfg.responsavel || '';
    document.getElementById('cfg18_cargo_resp').value      = cfg.cargo_resp || '';
    document.getElementById('cfg18_reg_resp').value        = cfg.reg_resp || '';
    document.getElementById('cfg18_local').value           = cfg.local || 'Refeitório';
    document.getElementById('cfg18_uf').value              = cfg.uf || 'SP';
    const logoInput = document.getElementById('cfg18_logo');
    const logoPreview = document.getElementById('cfg18_logo_preview');
    if (logoInput) logoInput.value = cfg.logo || '';
    if (logoPreview) logoPreview.src = cfg.logo || '/Logo-Hoss.jpg';
    document.getElementById('cert18_num').value            = this.currentEditingData?.Nr18_NumControle || '';
    
    const modal = document.getElementById('modalCertNR18');
    if (modal) modal.style.display = 'block';
    
    this.cert18_page = 0; // Reset to front page
    this.renderCertNR18();
};

SysControleWeb.prototype.abrirCfgNR18 = async function() {
    // Carregar configuração da NR-18 (Tenta servidor, cai no localStorage)
    let cfg = JSON.parse(localStorage.getItem('cfg_nr18') || '{}');
    try {
        const response = await fetch('/api/config/nr/nr18');
        const resJson = await response.json();
        if (resJson.success && resJson.dados) {
            cfg = resJson.dados;
            localStorage.setItem('cfg_nr18', JSON.stringify(cfg));
        }
    } catch (e) { console.error('Erro ao buscar config NR18 do servidor:', e); }

    document.getElementById('cfg18_instrutor').value       = cfg.instrutor || '';
    document.getElementById('cfg18_cargo_instrutor').value = cfg.cargo_instrutor || '';
    document.getElementById('cfg18_reg_instrutor').value   = cfg.reg_instrutor || '';
    document.getElementById('cfg18_responsavel').value     = cfg.responsavel || '';
    document.getElementById('cfg18_cargo_resp').value      = cfg.cargo_resp || '';
    document.getElementById('cfg18_reg_resp').value        = cfg.reg_resp || '';
    document.getElementById('cfg18_local').value           = cfg.local || 'Refeitório';
    document.getElementById('cfg18_uf').value              = cfg.uf || 'SP';
    const logoInput = document.getElementById('cfg18_logo');
    const logoPreview = document.getElementById('cfg18_logo_preview');
    if (logoInput) logoInput.value = cfg.logo || '';
    if (logoPreview) logoPreview.src = cfg.logo || '/Logo-Hoss.jpg';
    
    // Carregar lista de anos
    this.cfg18_anos = cfg.anos || [new Date().getFullYear()];
    this.cfg18_ano_selecionado = cfg.ano_selecionado || new Date().getFullYear();
    this.atualizarListaAnos18();

    const modal = document.getElementById('modalCfgNR18');
    if (modal) modal.style.display = 'block';
};

SysControleWeb.prototype.adicionarAno18 = function() {
    const input = document.getElementById('cfg18_novo_ano');
    const ano = parseInt(input.value);
    if (!ano || ano < 1900 || ano > 2100) {
        if (typeof this.showToast === 'function') this.showToast('Ano inválido', 'error');
        return;
    }
    if (this.cfg18_anos.includes(ano)) {
        if (typeof this.showToast === 'function') this.showToast('Ano já existe', 'warning');
        return;
    }
    this.cfg18_anos.push(ano);
    this.cfg18_anos.sort((a,b) => b - a);
    this.cfg18_ano_selecionado = ano;
    input.value = '';
    this.atualizarListaAnos18();
};

SysControleWeb.prototype.removerAnoSelecionado18 = function() {
    const select = document.getElementById('cfg18_ano_ativo');
    const ano = parseInt(select.value);
    if (!ano) return;
    if (confirm(`Tem certeza que deseja excluir o ano ${ano} da lista?`)) {
        this.removerAno18(ano);
    }
};

SysControleWeb.prototype.removerAno18 = function(ano) {
    const anoNum = Number(ano);
    this.cfg18_anos = this.cfg18_anos.filter(a => Number(a) !== anoNum);
    if (Number(this.cfg18_ano_selecionado) === anoNum) {
        this.cfg18_ano_selecionado = this.cfg18_anos[0] || new Date().getFullYear();
    }
    this.atualizarListaAnos18();
    if (typeof this.showToast === 'function') this.showToast('Ano removido da lista!', 'info');
};

SysControleWeb.prototype.atualizarListaAnos18 = function() {
    const select = document.getElementById('cfg18_ano_ativo');
    if (!select) return;
    select.innerHTML = '';
    this.cfg18_anos.forEach(ano => {
        const opt = document.createElement('option');
        opt.value = ano;
        opt.textContent = ano;
        if (parseInt(ano) === parseInt(this.cfg18_ano_selecionado)) opt.selected = true;
        select.appendChild(opt);
    });
};

SysControleWeb.prototype.salvarCfgNR18 = async function() {
    const anoAtivo = parseInt(document.getElementById('cfg18_ano_ativo').value);
    const cfgData = {
        instrutor:       document.getElementById('cfg18_instrutor').value,
        cargo_instrutor: document.getElementById('cfg18_cargo_instrutor').value,
        reg_instrutor:   document.getElementById('cfg18_reg_instrutor').value,
        responsavel:     document.getElementById('cfg18_responsavel').value,
        cargo_resp:      document.getElementById('cfg18_cargo_resp').value,
        reg_resp:        document.getElementById('cfg18_reg_resp').value,
        local:           document.getElementById('cfg18_local').value,
        uf:              document.getElementById('cfg18_uf').value,
        logo:            document.getElementById('cfg18_logo').value,
        anos:            this.cfg18_anos,
        ano_selecionado: anoAtivo
    };

    // Salva no localStorage para velocidade
    localStorage.setItem('cfg_nr18', JSON.stringify(cfgData));
    
    // Salva no SERVIDOR para persistência e backup (Crítico)
    try {
        await fetch('/api/config/nr/nr18', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dados: cfgData })
        });
    } catch (e) {
        console.error('Erro ao salvar config NR18 no servidor:', e);
    }
    
    // Sincronizar ano com o registro atual se estiver editando
    if (this.editingId && this.currentEditingData) {
        this.currentEditingData.Nr18_AnoControle = anoAtivo;
        const inputNum = document.getElementById('cert18_num');
        // Agora salva mesmo que o número esteja vazio para o ano carregar corretamente
        const success = await this.verificarESalvarNumeroControle('nr18', (inputNum?.value || ''), inputNum, false);
        if (!success && (inputNum?.value || '')) return;
    }
    
    const modal = document.getElementById('modalCfgNR18');
    if (modal) modal.style.display = 'none';
    if (typeof this.showToast === 'function') this.showToast('Configuração salva com sucesso!', 'success');
    this.renderCertNR18();
};


SysControleWeb.prototype.processarLogoUploadNR18 = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const logoInput = document.getElementById('cfg18_logo');
            const logoPreview = document.getElementById('cfg18_logo_preview');
            if (logoInput) logoInput.value = e.target.result;
            if (logoPreview) logoPreview.src = e.target.result;
            
            if (typeof this.showToast === 'function') {
                this.showToast('Logo selecionado!', 'success');
            }
        };
        reader.readAsDataURL(input.files[0]);
    }
};

SysControleWeb.prototype.renderCertNR18 = function() {
    const nome   = this._corrigirTexto((document.getElementById('nome')?.value || '').toUpperCase());
    const cpf    = document.getElementById('cpf')?.value || '';
    const funcao = this._corrigirTexto((document.getElementById('funcao')?.value || '').toUpperCase());
    // Priorizar o número do registro (Banco de Dados)
    const numero = document.getElementById('cert18_num')?.value || this.currentEditingData?.Nr18_NumControle || '___';
    
    // Se o número foi alterado manualmente no modal de visualização, podemos manter o comportamento de preview,
    // mas o ideal é que ele venha do banco.
    if (numero !== '___' && !this.currentEditingData?.Nr18_NumControle) {
        localStorage.setItem('cert18_ultimo_num', numero);
    }
    const dataEmissao = document.getElementById('nr18_dataEmissao')?.value || '';

    const cfg = JSON.parse(localStorage.getItem('cfg_nr18') || '{}');
    const instrutor      = this._corrigirTexto(cfg.instrutor      || '_______________________');
    const cargoInstrutor = this._corrigirTexto(cfg.cargo_instrutor || 'Técnico em Segurança do Trabalho');
    const regInstrutor   = this._corrigirTexto(cfg.reg_instrutor   || '');
    const responsavel    = this._corrigirTexto(cfg.responsavel     || '_______________________');
    const cargoResp      = this._corrigirTexto(cfg.cargo_resp      || 'Eng. de Segurança do Trabalho');
    const regResp        = this._corrigirTexto(cfg.reg_resp        || '');
    const local          = this._corrigirTexto(cfg.local           || 'Refeitório');
    const uf             = this._corrigirTexto(cfg.uf              || 'SP');
    const logoFile       = cfg.logo            || '/Logo-Hoss.jpg';

    const hoje = new Date();
    const dia  = String(hoje.getDate()).padStart(2,'0');
    const mes  = String(hoje.getMonth()+1).padStart(2,'0');
    
    // Priorizar o ano: se o número manual estiver vazio, usa o da config
    const numManualNum = document.getElementById('cert18_num')?.value || this.currentEditingData?.Nr18_NumControle || '';
    const ano = (numManualNum ? (this.currentEditingData?.Nr18_AnoControle || cfg.ano_selecionado) : cfg.ano_selecionado) || hoje.getFullYear();

    const dataExibir = dataEmissao || (dia+'/'+mes+'/'+ano);

    const currentPage = this.cert18_page || 0;

    const preview = document.getElementById('certNR18_preview');
    if (!preview) return;

    // Obter dados "vivos" do formulário para o preview
    const liveData = this.getDadosAtuaisFormulario();

    // Verificar se o certificado é inválido (excede 8h no dia) ou vencido
    const isInvalido = this.isCertificadoInvalido(liveData, 'nr18');
    const isVencido = this.isCertificadoVencido(liveData, 'nr18');
    let watermarkHTML = '';
    if (isInvalido) watermarkHTML += '<div class="watermark-invalido">CERTIFICADO INVÁLIDO</div>';
    if (isVencido) watermarkHTML += '<div class="watermark-vencido">CERTIFICADO VENCIDO</div>';

    preview.innerHTML = `
    <style id="cert18-style">
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Lato:wght@300;400;700&display=swap');

        @media screen {
            #certNR18_preview {
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
            #certNR18_preview, #certNR18_preview * { visibility: visible !important; }
            #certNR18_preview { position: absolute !important; top: 0 !important; left: 0 !important; width: 297mm !important; margin: 0 !important; padding: 0 !important; background: #fff !important; display: block !important; overflow: visible !important; }
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
        .cert-footer-info { margin-top: 15mm; font-size: 15pt; font-weight: 400; color: #1a3a6b; }
        .cert-assinaturas { margin-top: auto; margin-bottom: 5mm; display: flex; justify-content: space-between; gap: 15mm; width: 100%; }
        .signature-box { flex: 1; text-align: center; font-size: 12.5pt; color: #333; }
        .sig-line { border-top: 1.5px solid #1a3a6b; margin-bottom: 3mm; width: 90%; margin-left: 5%; }
        .controle-texto-original { position: absolute; top: 12mm; right: 35mm; font-size: 11pt; font-weight: 700; color: #1a3a6b; }
    </style>

    <div class="cert-nav-arrow left" onclick="syscontrole.toggleCert18Page(-1)">&lsaquo;</div>
    <div class="cert-nav-arrow right" onclick="syscontrole.toggleCert18Page(1)">&rsaquo;</div>

    <div class="cert-scale-wrapper page-0">
        <div class="cert-container cert-frente">
            ${watermarkHTML}
            <div class="corner-ornament top-left"><div class="corner-circle"></div></div>
            <div class="corner-ornament top-right"><div class="corner-circle"></div></div>
            <div class="corner-ornament bottom-left"><div class="corner-circle"></div></div>
            <div class="corner-ornament bottom-right"><div class="corner-circle"></div></div>
            <div class="cert-frame-rectangle"></div>
            <div class="cert-inner-content">
                <div class="controle-texto-original">Controle nº NR 18 - ${ano} - ${numero}</div>
                <div class="cert-header">
                    <img src="${logoFile}" class="cert-logo" onerror="this.style.display='none'">
                    <div class="cert-title">CERTIFICADO</div>
                </div>
                <div class="cert-body">
                    Certificamos que o Sr. <strong>${nome}</strong>, portador do CPF: <strong>${cpf}</strong>,
                    frequentou e concluiu satisfatoriamente o Treinamento de Segurança do Trabalho - NR 18 
                    (Condições e Meio Ambiente de Trabalho na Indústria da Construção), conforme determina a NR 01, NR 6 e NR 18 em seus itens, de acordo com a Lei nº 6.514 de 22/12/1977 e Portaria nº 3.214 de 08/06/1978, com carga horária de 04 (quatro) horas.
                    <div style="margin-top: 4mm; font-size: 14pt;">Rua Soldado João Pereira da Silva, 233 - Pq. Novo Mundo/ SP</div>
                </div>
                <div class="cert-footer-info" style="margin-top: 5mm;">DATA ${dataExibir}.</div>
                <div class="cert-assinaturas">
                    <div class="signature-box"><div class="sig-line"></div><strong>Participante</strong><br><strong>${nome}</strong><br>${funcao}</div>
                    <div class="signature-box"><div class="sig-line"></div><strong>Instrutor de Segurança do Trabalho</strong><br>${instrutor}<br>${cargoInstrutor}<br>Reg. M.T.E. ${regInstrutor}</div>
                    <div class="signature-box"><div class="sig-line"></div><strong>Responsável Técnico</strong><br>${responsavel}<br>${cargoResp}<br>${regResp}</div>
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
            <div class="cert-inner-content" style="padding: 21mm 25mm;">
                <div class="controle-texto-original">Controle nº NR 18 - ${ano} - ${numero}</div>
                
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2mm;">
                    <img src="${logoFile}" style="height: 18mm; margin-left: 5mm; margin-top: 3mm;" onerror="this.style.display='none'">
                    <div style="font-size: 18pt; font-family: 'Lato', sans-serif; font-weight: bold; text-align: center; flex: 1; color: #1a3a6b; margin-right: 18mm;">
                        Conteúdo Programático
                    </div>
                </div>

                <div style="font-size: 12.5pt; line-height: 1.45; color: #222; margin-left: 10mm; font-family: 'Lato', sans-serif; font-style: italic;">
                    1. Apresentação da NR-18;<br>
                    2. Informações sobre as condições e meio ambiente de trabalho;<br>
                    3. Riscos de acidentes na Construção Civil;<br>
                    4. Riscos ocupacionais;<br>
                    5. Avaliações ambientais;<br>
                    6. Riscos inerentes a função – Ordem de serviço;<br>
                    7. Segurança: responsabilidade de todos;<br>
                    8. Participação x Compromisso para “Acidente Zero”;<br>
                    9. Normas de Segurança do Trabalho;<br>
                    10. Exames médicos e exames complementares;<br>
                    11. Proteções Coletivas e Individuais – EPC e EPI;<br>
                    12. Uso adequado, guarda e conservação dos Equipamentos de Proteção Individual – EPI;<br>
                    13. Informações sobre os Equipamentos de Proteção Coletiva – EPC, existentes no canteiro de obra;<br>
                    14. Noções Básicas: Prevenção e Combate a Princípio de Incêndio;<br>
                    15. Higiene x Saúde;<br>
                    16. Higiene nas áreas de vivência, refeitório, sanitários e local de trabalho;<br>
                    17. Higiene no alojamento;<br>
                    18. Trabalho em Altura – Risco de Queda;<br>
                    19. Proibição de uso de máquinas e equipamentos por pessoas não autorizadas e habilitadas / qualificadas;<br>
                    20. Respeito e atitude com os colegas de trabalho, visitantes e transeuntes;<br>
                    21. Acidentes e doença do trabalho: conceito, consequências e procedimentos a serem adotados;<br>
                    22. Divulgação do PGR / PCMSO.
                </div>
            </div>
        </div>
    </div>`;

    const oldHandler = preview._printHandler;
    if (oldHandler) window.removeEventListener('keydown', oldHandler);

    preview._printHandler = function(e) {
        if (e && e.ctrlKey && e.key.toLowerCase() === 'p' && document.getElementById('modalCertNR18').style.display === 'block') {
            e.preventDefault();
            if(typeof syscontrole !== 'undefined' && syscontrole.imprimirCertificado) syscontrole.imprimirCertificado('nr18', 'ambos');
        }
    };
    window.addEventListener('keydown', preview._printHandler);
};

SysControleWeb.prototype.abrirLPTNR18 = async function() {
    if (!this.editingId) {
        if (typeof this.showToast === 'function') {
            this.showToast('Selecione um cadastro primeiro', 'warning');
        } else {
            alert('Selecione um cadastro primeiro');
        }
        return;
    }

    // Validação de Data de Emissão (Obrigatória)
    const dataEmi = document.getElementById('nr18_dataEmissao')?.value;
    if (!dataEmi) {
        if (typeof this.showToast === 'function') {
            this.showToast('Por favor, informe a Data de Emissão para gerar o documento.', 'error');
        } else {
            alert('Preencha a Data de Emissão primeiro!');
        }
        return;
    }
    
    // Sincronizar dados da config (Tenta servidor)
    let cfg = JSON.parse(localStorage.getItem('cfg_nr18') || '{}');
    try {
        const response = await fetch('/api/config/nr/nr18');
        const resJson = await response.json();
        if (resJson.success && resJson.dados) {
            cfg = resJson.dados;
            localStorage.setItem('cfg_nr18', JSON.stringify(cfg));
        }
    } catch (e) { console.error('Erro ao buscar config NR18 do servidor:', e); }

    document.getElementById('cfg18_instrutor').value       = cfg.instrutor || '';
    document.getElementById('cfg18_cargo_instrutor').value = cfg.cargo_instrutor || '';
    document.getElementById('cfg18_reg_instrutor').value   = cfg.reg_instrutor || '';
    document.getElementById('cfg18_responsavel').value     = cfg.responsavel || '';
    document.getElementById('cfg18_cargo_resp').value      = cfg.cargo_resp || '';
    document.getElementById('cfg18_reg_resp').value        = cfg.reg_resp || '';
    document.getElementById('cfg18_local').value           = cfg.local || 'Refeitório';
    document.getElementById('cfg18_uf').value              = cfg.uf || 'SP';
    
    const modal = document.getElementById('modalLPTNR18');
    if (modal) modal.style.display = 'block';
    
    this.renderLPTNR18();
};

SysControleWeb.prototype.renderLPTNR18 = function() {
    const nome        = this._corrigirTexto((document.getElementById('nome')?.value || '').toUpperCase());
    const funcao      = this._corrigirTexto((document.getElementById('funcao')?.value || '').toUpperCase());
    const empresa     = this._corrigirTexto((document.getElementById('empresa')?.value || '').toUpperCase());
    const dataEmissao = document.getElementById('nr18_dataEmissao')?.value || '';

    const cfg = JSON.parse(localStorage.getItem('cfg_nr18') || '{}');
    const instrutor      = this._corrigirTexto(cfg.instrutor      || '_______________________');
    const cargoInstrutor = this._corrigirTexto(cfg.cargo_instrutor || 'Técnico em Segurança do Trabalho');
    const local          = this._corrigirTexto(cfg.local           || 'Refeitório');
    const logoFile       = cfg.logo            || '/Logo-Hoss.jpg';

    const hoje = new Date();
    const dia  = String(hoje.getDate()).padStart(2,'0');
    const mes  = String(hoje.getMonth()+1).padStart(2,'0');
    const ano  = hoje.getFullYear();
    const dataExibir = dataEmissao || (dia+'/'+mes+'/'+ano);

    const preview = document.getElementById('lptNR18_preview');
    if (!preview) return;

    preview.innerHTML = `
    <style id="lpt18-style">
        @import url('https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&display=swap');

        @media screen {
            #lptNR18_preview { padding: 20px; background: #f0f0f0; display: flex; justify-content: center; overflow-y: auto; }
            .lpt-page { background: #fff; width: 210mm; min-height: 297mm; padding: 10mm; box-sizing: border-box; box-shadow: 0 0 10px rgba(0,0,0,0.2); }
        }

        @media print {
            @page { size: A4 portrait; margin: 0; }
            body * { visibility: hidden !important; }
            #lptNR18_preview, #lptNR18_preview * { visibility: visible !important; }
            #lptNR18_preview { position: absolute; top: 0; left: 0; width: 100%; padding: 0; margin: 0; background: #fff; }
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
                <div class="lpt-title-top">TREINAMENTO NR 18<br>SEGURANÇA NA INDÚSTRIA DA CONSTRUÇÃO</div>
                <div class="lpt-title-bottom">LISTA DE PRESENÇA DE TREINAMENTO - LPT</div>
            </div>
        </div>

        <div class="lpt-info-section">
            <div class="lpt-empresa">EMPRESA: ${empresa}</div>
        </div>

        <div class="lpt-topics" style="padding: 2mm 5mm; margin-bottom: 3mm;">
            <ol style="font-size: 8.5pt; column-count: 2; column-gap: 10mm; margin: 0; padding-left: 15px;">
                <li>Apresentação da NR-18.</li>
                <li>Informações sobre as condições e meio ambiente de trabalho.</li>
                <li>Riscos de acidentes na Construção Civil.</li>
                <li>Riscos ocupacionais.</li>
                <li>Avaliações ambientais.</li>
                <li>Riscos inerentes a função – Ordem de serviço.</li>
                <li>Segurança: responsabilidade de todos.</li>
                <li>Participação x Compromisso para “Acidente Zero”.</li>
                <li>Normas de Segurança do Trabalho.</li>
                <li>Exames médicos e exames complementares.</li>
                <li>Proteções Coletivas e Individuais – EPC e EPI.</li>
                <li>Uso adequado, guarda e conservação dos Equipamentos de Proteção Individual – EPI.</li>
                <li>Informações sobre os Equipamentos de Proteção Coletiva – EPC.</li>
                <li>Noções Básicas: Prevenção e Combate a Princípio de Incêndio.</li>
                <li>Higiene x Saúde.</li>
                <li>Higiene nas áreas de vivência, refeitório, etc.</li>
                <li>Higiene no alojamento.</li>
                <li>Trabalho em Altura – Risco de Queda.</li>
                <li>Proibição de uso de máquinas não autorizadas.</li>
                <li>Respeito e atitude com os colegas.</li>
                <li>Acidentes e doença do trabalho.</li>
                <li>Divulgação do PGR / PCMSO.</li>
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
                <span class="lpt-detail-value" style="font-weight: bold;">04 HORAS</span>
            </div>
            <div class="lpt-detail-item" style="border-bottom: none;">
                <span class="lpt-detail-label">Local do treinamento: </span>
                <span class="lpt-detail-value">${local}</span>
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

SysControleWeb.prototype.fecharLPTNR18 = function() {
    const modal = document.getElementById('modalLPTNR18');
    if (modal) modal.style.display = 'none';
    
    // Voltar para a aba NR-18
    if (typeof this.switchNRTab === 'function') {
        this.switchNRTab('nr18');
    }
};

SysControleWeb.prototype.fecharCertNR18 = function() {
    const modal = document.getElementById('modalCertNR18');
    if (modal) modal.style.display = 'none';
    
    // Voltar para a tela de origem (Formulário principal) usando a função nativa do sistema
    if (typeof this.showModal === 'function') {
        this.showModal('modalForm', true); // true = skipReset para manter os dados preenchidos
    } else {
        const modalForm = document.getElementById('modalForm');
        if (modalForm) modalForm.style.display = 'block';
    }
    
    // Garantir que volta para a aba NR-18
    if (typeof this.switchNRTab === 'function') {
        this.switchNRTab('nr18');
    }
};


