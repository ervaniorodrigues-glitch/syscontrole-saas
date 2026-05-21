// ==================== CERTIFICADO NR-12 ====================

SysControleWeb.prototype.toggleCert12Page = function(delta) {
    this.cert12_page = (this.cert12_page === 0) ? 1 : 0;
    this.renderCertNR12();
};

SysControleWeb.prototype.abrirCertNR12 = async function() {
    if (!this.editingId) {
        if (typeof this.showToast === 'function') {
            this.showToast('Selecione um cadastro primeiro', 'warning');
        } else {
            alert('Selecione um cadastro primeiro');
        }
        return;
    }

    // Validação de Data de Emissão (Obrigatória)
    const dataEmi = document.getElementById('nr12_dataEmissao')?.value;
    if (!dataEmi) {
        if (typeof this.showToast === 'function') {
            this.showToast('Por favor, informe a Data de Emissão para gerar o documento.', 'error');
        } else {
            alert('Preencha a Data de Emissão primeiro!');
        }
        return;
    }
    
    // Carregar configuração da NR-12 (Tenta servidor, cai no localStorage)
    let cfg = JSON.parse(localStorage.getItem('cfg_nr12') || '{}');
    try {
        const response = await fetch('/api/config/nr/nr12');
        const resJson = await response.json();
        if (resJson.success && resJson.dados) {
            cfg = resJson.dados;
            localStorage.setItem('cfg_nr12', JSON.stringify(cfg));
        }
    } catch (e) { console.error('Erro ao buscar config NR12 do servidor:', e); }

    document.getElementById('cfg12_instrutor').value       = cfg.instrutor || '';
    document.getElementById('cfg12_cargo_instrutor').value = cfg.cargo_instrutor || '';
    document.getElementById('cfg12_reg_instrutor').value   = cfg.reg_instrutor || '';
    document.getElementById('cfg12_responsavel').value     = cfg.responsavel || '';
    document.getElementById('cfg12_cargo_resp').value      = cfg.cargo_resp || '';
    document.getElementById('cfg12_reg_resp').value        = cfg.reg_resp || '';
    document.getElementById('cfg12_local').value           = cfg.local || '';
    document.getElementById('cfg12_uf').value              = cfg.uf || 'SP';
    const logoInput = document.getElementById('cfg12_logo');
    const logoPreview = document.getElementById('cfg12_logo_preview');
    if (logoInput) logoInput.value = cfg.logo || '';
    if (logoPreview) logoPreview.src = cfg.logo || '/Logo-Hoss.jpg';
    document.getElementById('cert12_num').value            = this.currentEditingData?.Nr12_NumControle || '';
    
    const modal = document.getElementById('modalCertNR12');
    if (modal) modal.style.display = 'block';
    
    this.cert12_page = 0; // Reset to front page
    this.renderCertNR12();
};

SysControleWeb.prototype.abrirCfgNR12 = async function() {
    // Carregar configuração da NR-12 (Tenta servidor, cai no localStorage)
    let cfg = JSON.parse(localStorage.getItem('cfg_nr12') || '{}');
    try {
        const response = await fetch('/api/config/nr/nr12');
        const resJson = await response.json();
        if (resJson.success && resJson.dados) {
            cfg = resJson.dados;
            localStorage.setItem('cfg_nr12', JSON.stringify(cfg));
        }
    } catch (e) { console.error('Erro ao buscar config NR12 do servidor:', e); }

    document.getElementById('cfg12_instrutor').value       = cfg.instrutor || '';
    document.getElementById('cfg12_cargo_instrutor').value = cfg.cargo_instrutor || '';
    document.getElementById('cfg12_reg_instrutor').value   = cfg.reg_instrutor || '';
    document.getElementById('cfg12_responsavel').value     = cfg.responsavel || '';
    document.getElementById('cfg12_cargo_resp').value      = cfg.cargo_resp || '';
    document.getElementById('cfg12_reg_resp').value        = cfg.reg_resp || '';
    document.getElementById('cfg12_local').value           = cfg.local || '';
    document.getElementById('cfg12_uf').value              = cfg.uf || 'SP';
    const logoInput = document.getElementById('cfg12_logo');
    const logoPreview = document.getElementById('cfg12_logo_preview');
    if (logoInput) logoInput.value = cfg.logo || '';
    if (logoPreview) logoPreview.src = cfg.logo || '/Logo-Hoss.jpg';
    
    // Carregar lista de anos
    this.cfg12_anos = cfg.anos || [new Date().getFullYear()];
    this.cfg12_ano_selecionado = cfg.ano_selecionado || new Date().getFullYear();
    this.atualizarListaAnos12();

    const modal = document.getElementById('modalCfgNR12');
    if (modal) modal.style.display = 'block';
};

SysControleWeb.prototype.adicionarAno12 = function() {
    const input = document.getElementById('cfg12_novo_ano');
    const ano = parseInt(input.value);
    if (!ano || ano < 1900 || ano > 2100) {
        if (typeof this.showToast === 'function') this.showToast('Ano inválido', 'error');
        return;
    }
    if (this.cfg12_anos.includes(ano)) {
        if (typeof this.showToast === 'function') this.showToast('Ano já existe', 'warning');
        return;
    }
    this.cfg12_anos.push(ano);
    this.cfg12_anos.sort((a,b) => b - a);
    this.cfg12_ano_selecionado = ano;
    input.value = '';
    this.atualizarListaAnos12();
};

SysControleWeb.prototype.removerAnoSelecionado12 = function() {
    const select = document.getElementById('cfg12_ano_ativo');
    const ano = parseInt(select.value);
    if (!ano) return;
    if (confirm(`Tem certeza que deseja excluir o ano ${ano} da lista?`)) {
        this.removerAno12(ano);
    }
};

SysControleWeb.prototype.removerAno12 = function(ano) {
    const anoNum = Number(ano);
    this.cfg12_anos = this.cfg12_anos.filter(a => Number(a) !== anoNum);
    if (Number(this.cfg12_ano_selecionado) === anoNum) {
        this.cfg12_ano_selecionado = this.cfg12_anos[0] || new Date().getFullYear();
    }
    this.atualizarListaAnos12();
    if (typeof this.showToast === 'function') this.showToast('Ano removido da lista!', 'info');
};

SysControleWeb.prototype.atualizarListaAnos12 = function() {
    const select = document.getElementById('cfg12_ano_ativo');
    if (!select) return;
    select.innerHTML = '';
    this.cfg12_anos.forEach(ano => {
        const opt = document.createElement('option');
        opt.value = ano;
        opt.textContent = ano;
        if (parseInt(ano) === parseInt(this.cfg12_ano_selecionado)) opt.selected = true;
        select.appendChild(opt);
    });
};

SysControleWeb.prototype.salvarCfgNR12 = async function() {
    const anoAtivo = parseInt(document.getElementById('cfg12_ano_ativo').value);
    const cfgData = {
        instrutor:       document.getElementById('cfg12_instrutor').value,
        cargo_instrutor: document.getElementById('cfg12_cargo_instrutor').value,
        reg_instrutor:   document.getElementById('cfg12_reg_instrutor').value,
        responsavel:     document.getElementById('cfg12_responsavel').value,
        cargo_resp:      document.getElementById('cfg12_cargo_resp').value,
        reg_resp:        document.getElementById('cfg12_reg_resp').value,
        local:           document.getElementById('cfg12_local').value,
        uf:              document.getElementById('cfg12_uf').value,
        logo:            document.getElementById('cfg12_logo').value,
        anos:            this.cfg12_anos,
        ano_selecionado: anoAtivo
    };

    // Salva no localStorage para velocidade
    localStorage.setItem('cfg_nr12', JSON.stringify(cfgData));
    
    // Salva no SERVIDOR para persistência e backup (Crítico)
    try {
        await fetch('/api/config/nr/nr12', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dados: cfgData })
        });
    } catch (e) {
        console.error('Erro ao salvar config NR12 no servidor:', e);
    }
    
    // Sincronizar ano com o registro atual se estiver editando
    if (this.editingId && this.currentEditingData) {
        this.currentEditingData.Nr12_AnoControle = anoAtivo;
        const inputNum = document.getElementById('cert12_num');
        // Agora salva mesmo que o número esteja vazio para o ano carregar corretamente
        const success = await this.verificarESalvarNumeroControle('nr12', (inputNum?.value || ''), inputNum, false);
        if (!success && (inputNum?.value || '')) return;
    }
    
    const modal = document.getElementById('modalCfgNR12');
    if (modal) modal.style.display = 'none';
    if (typeof this.showToast === 'function') this.showToast('Configuração salva com sucesso!', 'success');
    this.renderCertNR12();
};


SysControleWeb.prototype.processarLogoUploadNR12 = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const logoInput = document.getElementById('cfg12_logo');
            const logoPreview = document.getElementById('cfg12_logo_preview');
            if (logoInput) logoInput.value = e.target.result;
            if (logoPreview) logoPreview.src = e.target.result;
            
            if (typeof this.showToast === 'function') {
                this.showToast('Logo selecionado!', 'success');
            }
        };
        reader.readAsDataURL(input.files[0]);
    }
};

SysControleWeb.prototype.renderCertNR12 = function() {
    const nome        = this._corrigirTexto((document.getElementById('nome')?.value || '').toUpperCase());
    const cpf         = document.getElementById('cpf')?.value || '';
    const funcao      = this._corrigirTexto((document.getElementById('funcao')?.value || '').toUpperCase());
    // Priorizar o número do registro (Banco de Dados)
    const numero = document.getElementById('cert12_num')?.value || this.currentEditingData?.Nr12_NumControle || '___';
    
    // Se o número foi alterado manualmente no modal de visualização, podemos manter o comportamento de preview,
    // mas o ideal é que ele venha do banco.
    if (numero !== '___' && !this.currentEditingData?.Nr12_NumControle) {
        localStorage.setItem('cert12_ultimo_num', numero);
    }
    const dataEmissao = document.getElementById('nr12_dataEmissao')?.value || '';
    const ferramenta  = this._corrigirTexto(document.getElementById('nr12_ferramenta')?.value || '');

    const cfg = JSON.parse(localStorage.getItem('cfg_nr12') || '{}');
    const instrutor      = this._corrigirTexto(cfg.instrutor      || '_______________________');
    const cargoInstrutor = this._corrigirTexto(cfg.cargo_instrutor || 'Instrutor de Segurança');
    const regInstrutor   = this._corrigirTexto(cfg.reg_instrutor   || '');
    const responsavel    = this._corrigirTexto(cfg.responsavel     || '_______________________');
    const cargoResp      = this._corrigirTexto(cfg.cargo_resp      || 'Responsável Técnico');
    const regResp        = this._corrigirTexto(cfg.reg_resp        || '');
    const local          = this._corrigirTexto(cfg.local           || 'Guarulhos');
    const uf             = this._corrigirTexto(cfg.uf              || 'SP');
    const logoFile       = cfg.logo            || '/Logo-Hoss.jpg';

    const hoje = new Date();
    const dia  = String(hoje.getDate()).padStart(2,'0');
    const mes  = String(hoje.getMonth()+1).padStart(2,'0');
    
    // Priorizar o ano: se o nmero manual estiver vazio, usa o da config
    const numManualNum = document.getElementById('cert12_num')?.value || this.currentEditingData?.Nr12_NumControle || '';
    const ano = (numManualNum ? (this.currentEditingData?.Nr12_AnoControle || cfg.ano_selecionado) : cfg.ano_selecionado) || hoje.getFullYear();

    const dataExibir = dataEmissao || (dia+'/'+mes+'/'+ano);

    const currentPage = this.cert12_page || 0;

    const preview = document.getElementById('certNR12_preview');
    if (!preview) return;

    // Obter dados "vivos" do formulário para o preview
    const liveData = this.getDadosAtuaisFormulario();

    // Verificar se o certificado é inválido (excede 8h no dia) ou vencido
    const isInvalido = this.isCertificadoInvalido(liveData, 'nr12');
    const isVencido = this.isCertificadoVencido(liveData, 'nr12');
    let watermarkHTML = '';
    if (isInvalido) watermarkHTML += '<div class="watermark-invalido">CERTIFICADO INVÁLIDO</div>';
    if (isVencido) watermarkHTML += '<div class="watermark-vencido">CERTIFICADO VENCIDO</div>';

    preview.innerHTML = `
    <style id="cert12-style">
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Lato:wght@300;400;700&display=swap');

        @media screen {
            #certNR12_preview {
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
            #certNR12_preview, #certNR12_preview * { visibility: visible !important; }
            #certNR12_preview { position: absolute !important; top: 0 !important; left: 0 !important; width: 297mm !important; margin: 0 !important; padding: 0 !important; background: #fff !important; display: block !important; overflow: visible !important; }
            @page { size: A4 landscape; margin: 0; }
            .cert-container { transform: none !important; position: relative !important; margin: 0 !important; box-shadow: none !important; border: none !important; width: 297mm !important; height: 210mm !important; page-break-after: always !important; break-after: page !important; display: flex !important; }
            .cert-verso { page-break-after: avoid !important; break-after: auto !important; }
            .cert-scale-wrapper { width: 297mm !important; height: auto !important; display: block !important; }
            .cert-nav-arrow { display: none !important; }
            .page-0, .page-1 { display: block !important; }
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
        .cert-logo { height: 20mm; }
        .cert-title { font-family: 'Cinzel', serif; font-size: 42pt; font-weight: 700; text-align: center; flex: 1; margin-right: 28mm; letter-spacing: 2mm; color: #1a3a6b; }
        .cert-body { font-size: 18pt; line-height: 1.6; text-align: justify; margin-top: 10mm; color: #333; }
        .cert-body strong { font-weight: 700; color: #000; }
        .cert-footer-info { margin-top: 15mm; font-size: 15pt; font-weight: 700; color: #1a3a6b; }
        .cert-assinaturas { margin-top: auto; margin-bottom: 5mm; display: flex; justify-content: space-between; gap: 15mm; width: 100%; }
        .signature-box { flex: 1; text-align: center; font-size: 13pt; color: #333; }
        .sig-line { border-top: 1.5px solid #1a3a6b; margin-bottom: 3mm; width: 90%; margin-left: 5%; }
        .controle-texto-original { position: absolute; top: 12mm; right: 35mm; font-size: 11pt; font-weight: 700; color: #1a3a6b; }
    </style>

    <div class="cert-nav-arrow left" onclick="syscontrole.toggleCert12Page(-1)">&lsaquo;</div>
    <div class="cert-nav-arrow right" onclick="syscontrole.toggleCert12Page(1)">&rsaquo;</div>

    <div class="cert-scale-wrapper page-0">
        <div class="cert-container cert-frente">
            ${watermarkHTML}
            <div class="corner-ornament top-left"><div class="corner-circle"></div></div>
            <div class="corner-ornament top-right"><div class="corner-circle"></div></div>
            <div class="corner-ornament bottom-left"><div class="corner-circle"></div></div>
            <div class="corner-ornament bottom-right"><div class="corner-circle"></div></div>
            <div class="cert-frame-rectangle"></div>
            <div class="cert-inner-content">
                <div class="controle-texto-original">Controle nº NR 12 - ${ano} - ${numero}</div>
                <div class="cert-header">
                    <img src="${logoFile}" class="cert-logo" onerror="this.style.display='none'">
                    <div class="cert-title">CERTIFICADO</div>
                </div>
                <div class="cert-body" style="font-size: 16pt; line-height: 1.5; margin-top: 5mm;">
                    Certificamos que o Sr. <strong>${nome}</strong>, portador do <strong>CPF: ${cpf}</strong> participou do 
                    Treinamento para trabalhos com Máquinas Rotativas, recebendo informações sobre inspeções, 
                    aplicações e segurança, conforme NR12 - Anexo 2, realizado nas dependências da empresa, com 
                    carga horária de 04 (quatro) horas teóricas e práticas. Todos São orientados a <strong><u>NUNCA</u></strong> fazer 
                    utilização de ferramentas sem o devido treinamento.
                    <div style="margin-top: 3mm;">Se usar algum outro equipamento fora do especificado, ele usa por contra própria sem autorização da SSMA.</div>
                    <div style="margin-top: 5mm;"><strong>Habilitado para:</strong> ${ferramenta || 'FERRAMENTAS MANUAIS E ELÉTRICAS'}</div>
                    <div style="margin-top: 4mm; font-size: 14pt;">Rua Soldado João Pereira da Silva, 233 - Pq. Novo Mundo/ SP</div>
                </div>
                <div class="cert-footer-info" style="margin-top: 5mm;">DATA ${dataExibir}.</div>
                <div class="cert-assinaturas">
                    <div class="signature-box"><div class="sig-line"></div><strong>Participante</strong><br><strong>${nome}</strong><br>${funcao}</div>
                    <div class="signature-box"><div class="sig-line"></div><strong>Instrutor de Segurança do Trabalho</strong><br>${instrutor}<br>${cargoInstrutor}<br>${regInstrutor ? 'Reg. M.T.E. ' + regInstrutor : ''}</div>
                    <div class="signature-box"><div class="sig-line"></div><strong>Responsável Técnico</strong><br>${responsavel}<br>${cargoResp}<br>${regResp ? 'CREA. ' + regResp : ''}</div>
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
            <div class="cert-inner-content" style="padding: 25mm 25mm 15mm 25mm; display: flex; flex-direction: column; justify-content: flex-start;">
                <div class="controle-texto-original">Controle nº NR 12 - ${ano} - ${numero}</div>
                
                <!-- Cabeçalho Equilibrado e Centrado -->
                <div style="display: flex; align-items: center; width: 100%; margin-bottom: 8mm; padding: 0 5mm;">
                    <div style="width: 50mm; display: flex; justify-content: flex-start;">
                        <img src="${logoFile}" style="height: 17mm; max-width: 100%; object-fit: contain;" onerror="this.style.display='none'">
                    </div>
                    <div style="flex: 1; text-align: center; font-size: 22pt; font-family: 'Lato', sans-serif; font-weight: bold; color: #1a3a6b;">
                        CONTE&Uacute;DO PROGRAM&Aacute;TICO - NR 12
                    </div>
                    <div style="width: 50mm;"></div> <!-- Balanceador para centralização perfeita -->
                </div>

                <!-- Lista de Conteúdo Otimizada para Estética e Enquadramento -->
                <div style="font-size: 13pt; line-height: 1.5; color: #222; font-family: 'Lato', sans-serif; padding-left: 17mm;">
                    1. Objetivo;<br>
                    2. Descrição e identificação dos riscos associados com cada máquina e equipamento e as proteções específicas contra cada um deles;<br>
                    3. Funcionamento das proteções; como e por que devem ser usadas;<br>
                    4. Como e em que circunstâncias uma proteção pode ser removida;<br>
                    5. O que fazer se uma proteção foi danificada ou se perdeu sua função, deixando de garantir uma segurança adequada;<br>
                    6. Princípios de segurança na utilização da máquina ou equipamentos;<br>
                    7. Segurança para riscos mecânicos, elétricos e outros relevantes;<br>
                    8. Método de trabalho seguro;<br>
                    9. Permissão de trabalho;<br>
                    10. Sistema de bloqueio de funcionamento durante operações de inspeção, limpeza, lubrificação e manutenção;<br>
                    11. Medidas de controle dos riscos: Equipamentos de Proteção Coletiva - EPC's e Equipamentos de Proteção Individual - EPIs;<br>
                    12. Noções sobre acidentes e doenças decorrentes da exposição aos riscos existentes na máquina, equipamentos e implementos;<br>
                    13. Acessórios indispensáveis;<br>
                    14. Check-List dos Equipamentos;<br>
                    15. Primeiros socorros e procedimentos em caso de emergência;<br>
                    16. Treinamento prático.
                </div>
            </div>
        </div>
    </div>`;

    const oldHandler = preview._printHandler;
    if (oldHandler) window.removeEventListener('keydown', oldHandler);

    preview._printHandler = function(e) {
        if (e && e.ctrlKey && e.key.toLowerCase() === 'p' && document.getElementById('modalCertNR12').style.display === 'block') {
            e.preventDefault();
            if(typeof syscontrole !== 'undefined' && syscontrole.imprimirCertificado) syscontrole.imprimirCertificado('nr12', 'ambos');
        }
    };
    window.addEventListener('keydown', preview._printHandler);
};

SysControleWeb.prototype.abrirLPTNR12 = async function() {
    if (!this.editingId) {
        if (typeof this.showToast === 'function') {
            this.showToast('Selecione um cadastro primeiro', 'warning');
        } else {
            alert('Selecione um cadastro primeiro');
        }
        return;
    }

    // Validação de Data de Emissão (Obrigatória)
    const dataEmi = document.getElementById('nr12_dataEmissao')?.value;
    if (!dataEmi) {
        if (typeof this.showToast === 'function') {
            this.showToast('Por favor, informe a Data de Emissão para gerar o documento.', 'error');
        } else {
            alert('Preencha a Data de Emissão primeiro!');
        }
        return;
    }
    
    // Sincronizar dados da config (Tenta servidor)
    let cfg = JSON.parse(localStorage.getItem('cfg_nr12') || '{}');
    try {
        const response = await fetch('/api/config/nr/nr12');
        const resJson = await response.json();
        if (resJson.success && resJson.dados) {
            cfg = resJson.dados;
            localStorage.setItem('cfg_nr12', JSON.stringify(cfg));
        }
    } catch (e) { console.error('Erro ao buscar config NR12 do servidor:', e); }

    document.getElementById('cfg12_instrutor').value       = cfg.instrutor || '';
    document.getElementById('cfg12_cargo_instrutor').value = cfg.cargo_instrutor || '';
    document.getElementById('cfg12_reg_instrutor').value   = cfg.reg_instrutor || '';
    document.getElementById('cfg12_responsavel').value     = cfg.responsavel || '';
    document.getElementById('cfg12_cargo_resp').value      = cfg.cargo_resp || '';
    document.getElementById('cfg12_reg_resp').value        = cfg.reg_resp || '';
    document.getElementById('cfg12_local').value           = cfg.local || '';
    document.getElementById('cfg12_uf').value              = cfg.uf || 'SP';
    
    const modal = document.getElementById('modalLPTNR12');
    if (modal) modal.style.display = 'block';
    
    this.renderLPTNR12();
};

SysControleWeb.prototype.renderLPTNR12 = function() {
    const nome        = this._corrigirTexto((document.getElementById('nome')?.value || '').toUpperCase());
    const funcao      = this._corrigirTexto((document.getElementById('funcao')?.value || '').toUpperCase());
    const empresa     = this._corrigirTexto((document.getElementById('empresa')?.value || '').toUpperCase());
    const dataEmissao = document.getElementById('nr12_dataEmissao')?.value || '';

    const cfg = JSON.parse(localStorage.getItem('cfg_nr12') || '{}');
    const instrutor      = this._corrigirTexto(cfg.instrutor      || '_______________________');
    const cargoInstrutor = this._corrigirTexto(cfg.cargo_instrutor || 'Instrutor de Segurança');
    const local          = this._corrigirTexto(cfg.local           || 'Guarulhos');
    const logoFile       = cfg.logo            || '/Logo-Hoss.jpg';

    const hoje = new Date();
    const dia  = String(hoje.getDate()).padStart(2,'0');
    const mes  = String(hoje.getMonth()+1).padStart(2,'0');
    const ano  = hoje.getFullYear();
    const dataExibir = dataEmissao || (dia+'/'+mes+'/'+ano);

    const preview = document.getElementById('lptNR12_preview');
    if (!preview) return;

    preview.innerHTML = `
    <style id="lpt12-style">
        @import url('https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&display=swap');

        @page {
            size: A4 portrait;
            margin: 0;
        }

        @media screen {
            #lptNR12_preview { padding: 20px; background: #f0f0f0; display: flex; justify-content: center; overflow-y: auto; }
            .lpt-page { background: #fff; width: 210mm; min-height: 297mm; padding: 10mm; box-sizing: border-box; box-shadow: 0 0 10px rgba(0,0,0,0.2); }
        }

        @media print {
            body { margin: 0; padding: 0; background: #fff; }
            
            /* Esconder elementos indesejados */
            #modalLPTNR12 {
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
            #modalLPTNR12 > div > div:first-child,
            #modalLPTNR12 .btn-cfg-mobile-hide,
            .modal-header, 
            .modal-footer {
                display: none !important;
            }

            #lptNR12_preview, #lptNR12_preview * { visibility: visible !important; }
            #lptNR12_preview { 
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
                border: none !important; 
            }
            body > *:not(#modalLPTNR12) { display: none !important; }
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
            margin-bottom: 30px; 
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
                <div class="lpt-title-top">TREINAMENTO NR 12<br>SEGURANÇA EM MÁQUINAS E EQUIPAMENTOS</div>
                <div class="lpt-title-bottom">LISTA DE PRESENÇA DE TREINAMENTO - LPT</div>
            </div>
        </div>

        <div class="lpt-info-section">
            <div class="lpt-empresa">EMPRESA: ${empresa}</div>
        </div>

        <div class="lpt-topics" style="padding: 2mm 5mm; margin-bottom: 2mm;">
            <div style="font-weight: bold; margin-bottom: 1mm; font-size: 9pt;">Assuntos abordados:</div>
            <ol style="font-size: 8pt; column-count: 2; column-gap: 5mm; margin: 0; padding-left: 15px;">
                <li>Objetivo</li>
                <li>Identificação dos riscos</li>
                <li>Proteções contra riscos</li>
                <li>Funcionamento das proteções</li>
                <li>Uso correto de proteções</li>
                <li>Remoção de proteções</li>
                <li>Proteção danificada</li>
                <li>Princípios de segurança</li>
                <li>Riscos mecânicos e elétricos</li>
                <li>Método de trabalho seguro</li>
                <li>Permissão de trabalho</li>
                <li>Sistema de bloqueio</li>
                <li>EPC's e EPI's</li>
                <li>Acidentes e doenças</li>
                <li>Acessórios e emergência</li>
                <li>Treinamento prático</li>
            </ol>
        </div>

        <div class="lpt-details-grid" style="margin-bottom: 3mm;">
            <div class="lpt-detail-item">
                <span class="lpt-detail-label">Instrutor de Segurança do Trabalho: </span>
                <span class="lpt-detail-value">${instrutor}</span><br>
                <span style="font-size: 8pt; margin-left: 10mm; font-weight: bold; text-transform: uppercase;">${cargoInstrutor} ${regInstrutor ? '- REG. M.T.E. ' + regInstrutor : ''}</span>
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

SysControleWeb.prototype.fecharLPTNR12 = function() {
    const modal = document.getElementById('modalLPTNR12');
    if (modal) modal.style.display = 'none';
    
    if (typeof this.switchNRTab === 'function') {
        this.switchNRTab('nr12');
    }
};

SysControleWeb.prototype.fecharCertNR12 = function() {
    const modal = document.getElementById('modalCertNR12');
    if (modal) modal.style.display = 'none';
    
    if (typeof this.showModal === 'function') {
        this.showModal('modalForm', true);
    } else {
        const modalForm = document.getElementById('modalForm');
        if (modalForm) modalForm.style.display = 'block';
    }
    
    if (typeof this.switchNRTab === 'function') {
        this.switchNRTab('nr12');
    }
};


