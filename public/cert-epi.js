// ==================== FICHA DE EPI ====================

SysControleWeb.prototype.abrirFichaEPI = async function() {
    if (!this.editingId) {
        if (typeof this.showToast === 'function') {
            this.showToast('Selecione um cadastro primeiro', 'warning');
        } else {
            alert('Selecione um cadastro primeiro');
        }
        return;
    }

    try {
        const [respFunc, respCfg] = await Promise.all([
            fetch(`/api/ssma/${this.editingId}`),
            fetch('/api/configuracao-relatorio')
        ]);
        
        const data = await respFunc.json();
        if (data && data.id) {
            this.currentEditingData = data;
        }
        
        const cfg = await respCfg.json();
        this.reportCfg = cfg || { logo: '/Logo-Hoss.jpg' };
        
    } catch (e) {
        console.error('Erro ao buscar dados para EPI:', e);
    }

    const modal = document.getElementById('modalFichaEPI');
    if (modal) modal.style.display = 'block';
    
    this.renderFichaEPI();
};

SysControleWeb.prototype.fecharFichaEPI = function() {
    const modal = document.getElementById('modalFichaEPI');
    if (modal) modal.style.display = 'none';
};

SysControleWeb.prototype.abrirCfgEPI = async function() {
    const modal = document.getElementById('modalCfgEPI');
    if (modal) modal.style.display = 'block';
    
    try {
        const response = await fetch('/api/configuracao-relatorio');
        if (response.ok) {
            const config = await response.json();
            document.getElementById('configTecnicoEPI').value = config?.tecnico_seguranca || '';
            this.reportCfg = config;
        }
    } catch (e) {
        console.error('Erro ao carregar técnico:', e);
    }

    // Carregar setor do funcionário atual
    const setorInput = document.getElementById('configSetorEPI');
    if (setorInput) {
        setorInput.value = (this.currentEditingData?.Epi_Setor || '').toUpperCase();
    }
    
    this.renderItensEditorEPI();
};

SysControleWeb.prototype.renderItensEditorEPI = function() {
    const tbody = document.getElementById('tbodyItensEPI');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    let itens = [];
    try {
        itens = JSON.parse(this.currentEditingData?.Epi_Dados || '[]');
    } catch (e) {
        itens = [];
    }
    
    if (itens.length === 0) {
        for (let i = 0; i < 10; i++) {
            this.adicionarLinhaEPI();
        }
    } else {
        itens.forEach(item => {
            this.adicionarLinhaEPI(item);
        });
    }
};

SysControleWeb.prototype.adicionarLinhaEPI = function(dados = {}) {
    const tbody = document.getElementById('tbodyItensEPI');
    if (!tbody) return;
    
    const tr = document.createElement('tr');
    tr.className = 'epi-item-row';
    
    tr.innerHTML = `
        <td style="border:1px solid #ddd; padding:4px;">
            <input type="number" class="epi-qty" value="${dados.qty || ''}" style="width:100%; border:none; text-align:center;" oninput="syscontrole.autoPreencherDataEPI(this)">
        </td>
        <td style="border:1px solid #ddd; padding:4px;">
            <input type="text" class="epi-desc" value="${dados.desc || ''}" style="width:100%; border:none;" oninput="syscontrole.autoPreencherDataEPI(this)">
        </td>
        <td style="border:1px solid #ddd; padding:4px;">
            <input type="text" class="epi-ca" value="${dados.ca || ''}" style="width:100%; border:none; text-align:center;">
        </td>
        <td style="border:1px solid #ddd; padding:4px;">
            <input type="text" class="epi-date" value="${dados.date || ''}" style="width:100%; border:none; text-align:center; background:#f9f9f9;" readonly>
        </td>
        <td style="border:1px solid #ddd; padding:4px; text-align:center;">
            <button type="button" onclick="this.parentElement.parentElement.remove()" style="background:none; border:none; color:red; cursor:pointer; font-weight:bold;">&times;</button>
        </td>
    `;
    
    tbody.appendChild(tr);
};

SysControleWeb.prototype.autoPreencherDataEPI = function(input) {
    const row = input.parentElement.parentElement;
    const qty = row.querySelector('.epi-qty').value;
    const desc = row.querySelector('.epi-desc').value;
    const dateInput = row.querySelector('.epi-date');
    
    if (qty && desc && !dateInput.value) {
        const hoje = new Date();
        const dataFormatada = hoje.toLocaleDateString('pt-BR');
        dateInput.value = dataFormatada;
    }
};

SysControleWeb.prototype.salvarItensPadraoEPI = async function() {
    const rows = document.querySelectorAll('.epi-item-row');
    const itens = [];
    
    rows.forEach(row => {
        const qty = row.querySelector('.epi-qty').value;
        const desc = row.querySelector('.epi-desc').value;
        const ca = row.querySelector('.epi-ca').value;
        const date = row.querySelector('.epi-date').value;
        
        if (qty || desc || ca) {
            itens.push({ qty, desc, ca, date });
        }
    });
    
    try {
        const resp = await fetch('/api/configuracao-relatorio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                ...this.reportCfg,
                epi_itens_padrao: JSON.stringify(itens)
            })
        });
        
        if (resp.ok) {
            if (typeof this.showToast === 'function') this.showToast('Itens Padrão salvos!', 'success');
            this.reportCfg.epi_itens_padrao = JSON.stringify(itens);
        }
    } catch (e) {
        console.error('Erro ao salvar itens padrão:', e);
    }
};

SysControleWeb.prototype.carregarItensPadraoEPI = async function() {
    // Buscar a config atualizada do servidor para garantir que os itens padrão estejam carregados
    try {
        const response = await fetch('/api/configuracao-relatorio');
        if (response.ok) {
            const config = await response.json();
            this.reportCfg = config;
        }
    } catch (e) {
        console.error('Erro ao buscar config para carregar padrão:', e);
    }

    const itensJson = this.reportCfg?.epi_itens_padrao || '[]';
    let itens = [];
    try {
        itens = JSON.parse(itensJson);
    } catch (e) {
        itens = [];
    }
    
    if (itens.length === 0) {
        if (typeof this.showToast === 'function') this.showToast('Nenhum item padrão cadastrado', 'info');
        return;
    }
    
    const tbody = document.getElementById('tbodyItensEPI');
    if (tbody) tbody.innerHTML = '';
    
    itens.forEach(item => {
        this.adicionarLinhaEPI(item);
    });
    
    if (typeof this.showToast === 'function') this.showToast('Itens padrão carregados!', 'success');
};

SysControleWeb.prototype.solicitarLinhasBrancoEPI = function() {
    const qtd = prompt('Quantas linhas em branco deseja gerar?', '8');
    if (qtd === null) {
        // Cancelou, volta para padrão
        const radPadrao = document.querySelector('input[name="tipo_impressao_epi"][value="padrao"]');
        if (radPadrao) radPadrao.checked = true;
        return;
    }
    
    this.blankRowsCount = parseInt(qtd) || 8;
    this.renderFichaEPI();
};

SysControleWeb.prototype.salvarItensEPI = async function() {
    const rows = document.querySelectorAll('.epi-item-row');
    const tecnico = document.getElementById('configTecnicoEPI').value.trim();
    const setor = (document.getElementById('configSetorEPI')?.value || '').trim().toUpperCase();
    const itens = [];
    
    rows.forEach(row => {
        const qty = row.querySelector('.epi-qty').value;
        const desc = row.querySelector('.epi-desc').value;
        const ca = row.querySelector('.epi-ca').value;
        const date = row.querySelector('.epi-date').value;
        
        if (qty || desc || ca) {
            itens.push({ qty, desc, ca, date });
        }
    });
    
    const dadosJson = JSON.stringify(itens);
    
    try {
        // Salvar dados EPI + Setor no registro do funcionário
        const respEpi = fetch(`/api/ssma/${this.editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Epi_Dados: dadosJson, Epi_Setor: setor })
        });
        
        // Salvar técnico na config global
        const respTec = fetch('/api/configuracao-relatorio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                ...this.reportCfg,
                tecnico_seguranca: tecnico,
                rodape: 'SSMA'
            })
        });

        const [resultEpi, resultTec] = await Promise.all([respEpi, respTec]);
        
        if (resultEpi.ok && resultTec.ok) {
            if (typeof this.showToast === 'function') this.showToast('Dados salvos com sucesso!', 'success');
            if (this.currentEditingData) {
                this.currentEditingData.Epi_Dados = dadosJson;
                this.currentEditingData.Epi_Setor = setor;
            }
            if (this.reportCfg) this.reportCfg.tecnico_seguranca = tecnico;
            document.getElementById('modalCfgEPI').style.display = 'none';
            this.renderFichaEPI();
        } else {
            alert('Erro ao salvar dados.');
        }
    } catch (e) {
        console.error('Erro ao salvar EPI:', e);
        alert('Erro de rede ao salvar');
    }
};

SysControleWeb.prototype.renderFichaEPI = function() {
    const data = this.currentEditingData;
    if (!data) return;

    const preview = document.getElementById('fichaEPI_preview');
    if (!preview) return;

    const nome = (data.Nome || '').toUpperCase();
    const funcao = (data.Funcao || '').toUpperCase();
    const cpf = data.CPF || '';
    const logo = this.reportCfg?.logo || '/Logo-Hoss.jpg';
    const tecnico = (this.reportCfg?.tecnico_seguranca || '').toUpperCase();
    const setor = (data.Epi_Setor || '').toUpperCase();
    
    const tipoImpressao = document.querySelector('input[name="tipo_impressao_epi"]:checked')?.value || 'padrao';
    
    let itens = [];
    if (tipoImpressao === 'branco') {
        const totalBranco = this.blankRowsCount || 8;
        itens = Array.from({ length: totalBranco }).map(() => ({}));
    } else {
        try {
            itens = JSON.parse(data.Epi_Dados || '[]');
        } catch (e) {
            itens = [];
        }
    }

    const hoje = new Date();
    const dataHoje = hoje.toLocaleDateString('pt-BR');

    const paginas = [];
    let i = 0;
    
    // Primeira página
    const P1_COUNT = 8;
    paginas.push(itens.slice(i, i + P1_COUNT));
    i += P1_COUNT;
    
    // Páginas subsequentes
    const PN_COUNT = 20;
    while (i < itens.length) {
        paginas.push(itens.slice(i, i + PN_COUNT));
        i += PN_COUNT;
    }
    
    // Garantir ao menos uma página
    if (paginas.length === 0) paginas.push([]);

    let fullHtml = `
    <style>
        @page {
            size: A4 landscape;
            margin: 0;
        }

        @media print {
            body { margin: 0; padding: 0; background: #fff; }
            
            /* Ocultar todos os elementos da pagina */
            body > * { display: none !important; }
            
            /* Mostrar APENAS o modal EPI */
            body > #modalFichaEPI { display: block !important; }

            #modalFichaEPI {
                position: static !important;
                width: 100% !important;
                height: auto !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #fff !important;
                overflow: visible !important;
            }

            /* Ocultar barra superior do modal (botoes e fechar) */
            #modalFichaEPI > div:first-child {
                display: none !important;
            }

            /* Resetar o wrapper branco interno */
            #modalFichaEPI > div:last-child {
                border: none !important;
                box-shadow: none !important;
                max-width: none !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: visible !important;
                border-radius: 0 !important;
            }

            /* Ocultar cabecalho azul "Ficha Individual de EPI" */
            #modalFichaEPI > div:last-child > div:first-child {
                display: none !important;
            }

            /* Area de preview - liberar altura e overflow */
            #fichaEPI_preview {
                margin: 0 !important;
                padding: 0 !important;
                max-height: none !important;
                height: auto !important;
                overflow: visible !important;
            }

            /* Cada pagina da ficha */
            .ficha-container {
                border: none !important;
                box-shadow: none !important;
                margin: 0 !important;
                padding: 5mm 10mm !important;
                width: 297mm !important;
                height: 210mm !important;
                max-height: 210mm !important;
                overflow: hidden !important;
                page-break-after: always !important;
                break-after: page !important;
                display: flex !important;
                flex-direction: column !important;
                box-sizing: border-box !important;
            }

            .ficha-container:last-child {
                page-break-after: avoid !important;
                break-after: auto !important;
            }
        }

        .ficha-container {
            width: 277mm;
            min-height: 190mm;
            margin: 0 auto 20px auto;
            color: #000;
            font-family: 'Arial', sans-serif;
            background: #fff;
            box-sizing: border-box;
            padding: 8mm;
            border: 1px solid #ccc;
            display: flex;
            flex-direction: column;
        }

        .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 8px;
        }
        .header-table td { border: none !important; padding: 0; vertical-align: middle; }
        .header-logo { width: 130px; }
        .header-logo img { max-width: 130px; height: auto; display: block; }
        .header-text { text-align: center; font-weight: bold; font-size: 11pt; line-height: 1.2; }
        .header-spacer { width: 130px; }

        .row-info {
            display: flex;
            justify-content: space-between;
            border-bottom: 1.2px solid #000;
            padding: 4px 0;
            margin-bottom: 4px;
            font-weight: bold;
            font-size: 10pt;
        }
        
        .disclaimer-text {
            font-size: 8.5pt;
            text-align: justify;
            margin: 6px 0;
            line-height: 1.2;
        }
        
        .obligations-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            font-size: 7.5pt;
            margin-bottom: 6px;
        }
        .oblig-col h4 {
            font-size: 8pt;
            margin: 1px 0;
            text-decoration: underline;
        }
        .oblig-col p { margin: 0.5px 0; }
        
        .epi-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 5px;
            table-layout: fixed;
        }
        .epi-table th, .epi-table td {
            border: 1px solid #000;
            padding: 3px;
            text-align: center;
            font-size: 9pt;
        }
        .epi-table th { background: #eee; font-weight: bold; }
        
        .col-quant { width: 45px; }
        .col-desc { width: auto; text-align: left !important; }
        .col-date { width: 90px; }
        .col-ca { width: 75px; }
        .col-obs { width: 110px; }
        .col-ass { width: 220px; }
        
        .ficha-footer {
            margin-top: auto;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            padding-top: 15px;
            margin-bottom: 30px; 
        }
        .assinatura-line {
            width: 320px;
            border-top: 1.2px solid #000;
            text-align: center;
            padding-top: 6px;
            font-size: 9.5pt;
            font-weight: bold;
            margin-top: 25px;
        }
    </style>
    `;

    paginas.forEach((itensPagina, index) => {
        const isFirstPage = (index === 0);
        const rowsToRender = (tipoImpressao === 'branco') ? itensPagina.length : (isFirstPage ? P1_COUNT : PN_COUNT);

        fullHtml += `
        <div class="ficha-container">
            <table class="header-table">
                <tr>
                    <td class="header-logo">
                        <img src="${logo}" onerror="this.style.display='none'">
                    </td>
                    <td class="header-text">
                        SESMT - SERVIÇO ESPECIALIZADO EM SEGURANÇA E MEDICINA DO TRABALHO<br>
                        FICHA INDIVIDUAL DE "E.P.I."<br>
                        NR. 6 (EQUIPAMENTO DE PROTEÇÃO INDIVIDUAL DE E.P.I)<br>
                        ITEM 6.6 E 6.7 - (REQUISIÇÃO E INFORMAÇÃO INDIVIDUAL DE E.P.I.)
                    </td>
                    <td class="header-spacer"></td>
                </tr>
            </table>
            
            <div class="row-info">
                <span>EU, ${nome}</span>
                <span>CPF: ${cpf}</span>
            </div>
            <div class="row-info">
                <span>Função: ${funcao}</span>
                <span>SETOR: ${setor}</span>
            </div>
            
            ${isFirstPage ? `
            <div class="disclaimer-text">
                Recebi os equipamentos de Proteção Individual listados no quadro a seguir, em perfeito estado de conservação.
                Declaro que recebi instruções de sua correta utilização, das noções de conservação e higiene e de que sou obrigado a utilizá-lo em decorrência da atividade que executo.
                Declaro que fui orientado sobre os riscos do ambiente de trabalho e das minhas atividades laborais e que devo usar todos os EPI recomendados pela empresa.
            </div>
            
            <div class="obligations-container">
                <div class="oblig-col">
                    <h4>NR - 6 (Item 6.6 - Obrigações do Empregador)</h4>
                    <p><strong>6.6.1 - OBRIGA-SE O EMPREGADOR, QUANTO AO E.P.I.:</strong></p>
                    <p>A- Adquirir tipo adequado a atividade do Empregado;</p>
                    <p>B- Fornecer ao Empregado somente E.P.I. aprovado pelo M.T.E.;</p>
                    <p>C- Treinar o Trabalhador sobre o seu uso adequado;</p>
                    <p>D- Tornar obrigatório o seu uso;</p>
                    <p>E- Substituí-lo imediatamente, quando danificado ou extraviado;</p>
                    <p>F- Responsabilizar-se pela sua higienização e manutenção periódica;</p>
                    <p>G- Comunicar ao M.T.E. qualquer irregularidade observada no E.P.I. adquirido.</p>
                </div>
                <div class="oblig-col">
                    <h4>NR - 6 (Item 6.7 - Obrigações do Empregado)</h4>
                    <p><strong>6.7.1 - OBRIGA-SE O EMPREGADO, QUANTO AO E.P.I.:</strong></p>
                    <p>A- Usá-lo apenas para a finalidade a que se destina;</p>
                    <p>B- Responsabilizar-se por sua guarda e conservação;</p>
                    <p>C- Comunicar ao Empregador qualquer alteração.</p>
                </div>
            </div>
            ` : ''}

            <table class="epi-table">
                <thead>
                    <tr>
                        <th class="col-quant">QUANT</th>
                        <th class="col-desc">DISCRIMINAÇÃO</th>
                        <th class="col-date">DT. ENTREGA</th>
                        <th class="col-date">DT. DEVOLUÇÃO</th>
                        <th class="col-ca">C.A.</th>
                        <th class="col-obs">Observações</th>
                        <th class="col-ass">ASS. EMPREGADO</th>
                    </tr>
                </thead>
                <tbody>
        `;

        for (let j = 0; j < rowsToRender; j++) {
            const item = itensPagina[j] || {};
            fullHtml += `
                <tr style="height: 28px;">
                    <td>${item.qty || ''}</td>
                    <td class="col-desc">${item.desc || ''}</td>
                    <td>${item.date || ''}</td>
                    <td></td>
                    <td>${item.ca || ''}</td>
                    <td></td>
                    <td></td>
                </tr>
            `;
        }

        fullHtml += `
                </tbody>
            </table>
            
            <div class="ficha-footer">
                <div style="font-weight:bold; font-size: 9.5pt;">DATA: ${dataHoje} (Pág. ${index + 1}/${paginas.length})</div>
                <div style="display: flex; gap: 40px;">
                    <div class="assinatura-line">
                        <div style="margin-bottom: 2px;">${tecnico}</div>
                        TÉCNICO DE SEGURANÇA
                    </div>
                    <div class="assinatura-line">
                        <div style="margin-bottom: 2px;">&nbsp;</div>
                        (Nome e assinatura)
                    </div>
                </div>
            </div>
        </div>
        `;
    });

    preview.innerHTML = fullHtml;
};
