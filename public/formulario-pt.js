// =====================================================================
// FORMULÁRIO - PERMISSÃO DE TRABALHO (PT)
// =====================================================================

function ptGetConfig() {
    let config;
    try {
        config = JSON.parse(localStorage.getItem('pt-config'));
    } catch (e) {}
    
    if (!config) {
        config = {
            nomeResp: '',
            nomeTec: '',
            nomeEng: '',
            logo: ''
        };
    }
    return config;
}

function renderizarFormPT() {
    const container = document.getElementById('conteudoAbaPT');
    if (!container) return;

    const config = ptGetConfig();

    container.innerHTML = `
<style>
#pt-form { font-family: Arial, sans-serif; font-size: 12px; color: #222; padding: 10px; }
#pt-form h2 { text-align:center; font-size:15px; margin:0 0 4px; text-transform:uppercase; }
#pt-form h3 { text-align:center; font-size:12px; margin:0 0 8px; color:#555; }
.pt-table { width:100%; border-collapse:collapse; margin-bottom:8px; }
.pt-table td, .pt-table th { border:1px solid #333; padding:4px 6px; vertical-align:top; }
.pt-table th { background:#c8d8e8; text-align:center; font-size:11px; }
.pt-header-row td { background:#1a3a5c; color:#fff; font-weight:bold; font-size:12px; padding:5px 8px; }
.pt-section-title { background:#dce8f5; font-weight:bold; font-size:11px; text-align:center; }
.pt-tipo-btn { display:inline-block; margin:2px; padding:4px 8px; border:2px solid #1a3a5c; border-radius:4px; cursor:pointer; font-size:11px; user-select:none; }
.pt-tipo-btn.selected { background:#1a3a5c; color:#fff; }
.pt-input { width:100%; border:none; border-bottom:1px dashed #999; font-size:11px; padding:2px 4px; background:transparent; font-family:inherit; }
.pt-input:focus { outline:none; border-bottom:1px solid #2980b9; }
.pt-check-cell { text-align:center; }
.pt-check-cell input[type=checkbox] { width:14px; height:14px; cursor:pointer; }
.sna-select { border:1px solid #aaa; font-size:11px; padding:1px; width:45px; text-align:center; text-align-last:center; }
.pt-sign-box { min-height:40px; border:1px solid #aaa; border-radius:4px; background:#fafafa; }
.pt-btn { color:#fff; border:none; padding:8px 14px; border-radius:5px; cursor:pointer; font-size:12px; font-weight:bold; }
.pt-btn-print { background:#1a3a5c; }
.pt-btn-limpar { background:#e74c3c; }
.pt-btn-config { background:#7f8c8d; }
.pt-secc { margin-bottom:6px; }
/* Modal de Configuração PT */
#pt-config-modal { display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:10000; justify-content:center; align-items:center; }
#pt-config-content { background:#fff; padding:20px; border-radius:8px; width:450px; max-width:90%; box-shadow:0 4px 15px rgba(0,0,0,0.3); max-height:90vh; overflow-y:auto; }
#pt-config-content h3 { margin-top:0; border-bottom:1px solid #eee; padding-bottom:10px; }
.pt-cfg-group { margin-bottom:12px; }
.pt-cfg-group label { display:block; font-weight:bold; font-size:12px; margin-bottom:4px; color:#333; }
.pt-cfg-input { width:100%; padding:6px; border:1px solid #ccc; border-radius:4px; box-sizing:border-box; font-size:12px; }
.pt-cfg-btns { display:flex; justify-content:flex-end; gap:10px; margin-top:20px; }
</style>

<div id="pt-form">
  <!-- CABEÇALHO -->
  <table class="pt-table">
    <tr>
      <td style="width:15%;text-align:center;font-weight:bold;font-size:16px;border-right:1px solid #333;">
        ${config.logo ? `<img src="${config.logo}" style="max-width:100%;max-height:45px;">` : `<div style="font-size:11px;color:#555;margin-top:10px;">Logo da Empresa</div>`}
      </td>
      <td style="text-align:center;vertical-align:middle;">
        <div style="font-size:15px;font-weight:bold;text-transform:uppercase;">PERMISSÃO DE TRABALHO</div>
        <div style="font-size:11px;color:#555;">Liberação para Trabalhos de Risco</div>
      </td>
      <td style="width:20%;font-size:11px;">
        <div><b>Nº:</b> <input class="pt-input save-target" id="pt-numero" style="width:80px;"></div>
        <div style="margin-top:4px;"><b>Data:</b> <input class="pt-input save-target" id="pt-data" type="date"></div>
      </td>
    </tr>
  </table>

  <!-- TIPO DE PT -->
  <table class="pt-table">
    <tr><td class="pt-section-title" colspan="6">TIPO DE PERMISSÃO (clique para selecionar)</td></tr>
    <tr>
      <td class="pt-check-cell"><span class="pt-tipo-btn save-tipo" data-tipo="1" onclick="ptToggleTipo(this)">① Altura</span></td>
      <td class="pt-check-cell"><span class="pt-tipo-btn save-tipo" data-tipo="2" onclick="ptToggleTipo(this)">② Serviços a Quente</span></td>
      <td class="pt-check-cell"><span class="pt-tipo-btn save-tipo" data-tipo="3" onclick="ptToggleTipo(this)">③ Escavação</span></td>
      <td class="pt-check-cell"><span class="pt-tipo-btn save-tipo" data-tipo="4" onclick="ptToggleTipo(this)">④ Elevação de Carga</span></td>
      <td class="pt-check-cell"><span class="pt-tipo-btn save-tipo" data-tipo="5" onclick="ptToggleTipo(this)">⑤ Controle de Energias</span></td>
      <td class="pt-check-cell"><span class="pt-tipo-btn save-tipo" data-tipo="6" onclick="ptToggleTipo(this)">⑥ Espaço Confinado</span></td>
    </tr>
  </table>

  <!-- ÁREA / SERVIÇO -->
  <table class="pt-table">
    <tr>
      <td style="width:40%;"><b>Área:</b> <input class="pt-input save-target" id="pt-area" placeholder="Ex: Fundo da Obra"></td>
      <td><b>Descrição do Serviço:</b> <input class="pt-input save-target" id="pt-descricao" placeholder="Descreva o serviço a ser executado"></td>
    </tr>
  </table>

  <!-- PRODUTOS QUÍMICOS -->
  <table class="pt-table">
    <tr><td class="pt-section-title" colspan="8">PRODUTO QUÍMICO ENVOLVIDO</td></tr>
    <tr>
      ${['Corrosivo','Inflamável','Tóxico','Combustível','Explosivo','Oxidante','Radioativo'].map(p=>`
      <td class="pt-check-cell" style="width:12%;">
        <div style="font-size:10px;font-weight:bold;">${p}</div>
        <input type="checkbox" class="save-target" id="pt-quim-${p.toLowerCase().replace(/[^a-z]/g,'')}">
      </td>`).join('')}
      <!-- Campo Extra para Produto Químico -->
      <td class="pt-check-cell" style="width:16%;">
        <input class="pt-input save-target" id="pt-quim-outro-nome" placeholder="Outro..." style="font-size:10px; text-align:center; width:80%;">
        <br><input type="checkbox" class="save-target" id="pt-quim-outro-chk">
      </td>
    </tr>
  </table>

  <!-- TABELA S/N/NA PRINCIPAL -->
  <table class="pt-table">
    <tr>
      <th style="width:19%">RECOMENDAÇÕES GERAIS</th><th style="width:6%">S/N/NA</th>
      <th style="width:19%">EPI UTILIZADO</th><th style="width:6%">S/N/NA</th>
      <th style="width:19%">FERRAMENTAS/EQUIP.</th><th style="width:6%">S/N/NA</th>
      <th style="width:19%">EPC / MEDIDAS</th><th style="width:6%">S/N/NA</th>
    </tr>
    ${ptLinhasSNA()}
  </table>

  <!-- SEÇÃO ESPECÍFICA POR TIPO - dinâmica -->
  <div id="pt-secoes-especificas"></div>

  <!-- EXECUTANTES -->
  <table class="pt-table" style="margin-top:6px;">
    <tr><td class="pt-section-title" colspan="5">NOMES DOS EXECUTANTES</td></tr>
    <tr>
      <th>Nome</th><th>Empresa</th><th style="width:16%">Tipo de Liberação (Nº)</th><th style="width:18%">Período (Início/Fim)</th><th style="width:12%">Assinatura</th>
    </tr>
    ${[1,2,3,4,5,6].map(i=>`
    <tr>
      <td><input class="pt-input save-target" id="pt-exec-nome-${i}"></td>
      <td><input class="pt-input save-target" id="pt-exec-emp-${i}"></td>
      <td style="text-align:center;"><input class="pt-input save-target" id="pt-exec-tipo-${i}" style="width:60px;text-align:center;" placeholder="ex: 6"></td>
      <td style="text-align:center;">
        <input class="pt-input save-target" id="pt-exec-ini-${i}" type="time" style="width:38%;"> <span id="pt-as-span-${i}">às</span> 
        <input class="pt-input save-target" id="pt-exec-fim-${i}" type="time" style="width:38%;">
      </td>
      <td class="pt-sign-box"></td>
    </tr>`).join('')}
  </table>

  <!-- RECOMENDAÇÕES ADICIONAIS -->
  <table class="pt-table">
    <tr><td class="pt-section-title">RECOMENDAÇÕES ADICIONAIS</td></tr>
    <tr><td><textarea id="pt-recomendacoes" class="save-target" style="width:100%;height:45px;font-size:11px;border:none;resize:vertical;font-family:inherit;" placeholder="Descreva recomendações adicionais..."></textarea></td></tr>
  </table>

  <!-- AUTORIZAÇÕES -->
  <table class="pt-table">
    <tr><td class="pt-section-title" colspan="7">AUTORIZAÇÕES</td></tr>
    <tr>
      <th style="width:3%">Nº</th><th style="width:12%">Data</th><th style="width:10%">Horário Inic.</th><th style="width:10%">Horário Fim</th>
      <th style="width:20%">Resp. Executante</th><th style="width:20%">Seg. Trabalho</th><th style="width:25%" id="lbl-eng-area">Resp. Área (Engenheiro)</th>
    </tr>
    ${[1,2,3,4,5,6].map(i=>`
    <tr>
      <td style="text-align:center;">${i}ª</td>
      <td><input class="pt-input save-target" type="date" id="pt-auth-data-${i}"></td>
      <td><input class="pt-input save-target" type="time" id="pt-auth-ini-${i}"></td>
      <td><input class="pt-input save-target" type="time" id="pt-auth-fim-${i}"></td>
      <td class="pt-sign-box" style="vertical-align:bottom; text-align:center; padding-bottom:2px;">
        ${config.nomeResp ? `<div id="pt-auth-n1-${i}" style="font-size:11px; border-top:1px solid #999; margin-top:20px; padding-top:2px;">${config.nomeResp}</div>` : ''}
      </td>
      <td class="pt-sign-box" style="vertical-align:bottom; text-align:center; padding-bottom:2px;">
        ${config.nomeTec ? `<div id="pt-auth-n2-${i}" style="font-size:11px; border-top:1px solid #999; margin-top:20px; padding-top:2px;">${config.nomeTec}</div>` : ''}
      </td>
      <td class="pt-sign-box" style="vertical-align:bottom; text-align:center; padding-bottom:2px;">
        ${config.nomeEng ? `<div id="pt-auth-n3-${i}" style="font-size:11px; border-top:1px solid #999; margin-top:20px; padding-top:2px;">${config.nomeEng}</div>` : ''}
      </td>
    </tr>`).join('')}
  </table>

</div>

<!-- BOTÕES -->
<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:10px;padding-bottom:10px;">
  <button class="pt-btn pt-btn-config" onclick="ptAbrirConfig()">⚙️ Configurações</button>
  <button class="pt-btn pt-btn-limpar" onclick="ptLimpar()">🗑️ Nova PT (Limpar)</button>
  <button class="pt-btn pt-btn-print" onclick="ptImprimir()">🖨️ Imprimir PT</button>
</div>

<!-- MODAL CONFIGURAÇÕES -->
<div id="pt-config-modal">
  <div id="pt-config-content">
    <h3>Configurações da Permissão de Trabalho</h3>
    <div class="pt-cfg-group">
      <label>Nome Resp. Executante (Assinatura)</label>
      <input type="text" id="pt-cfg-nome-resp" class="pt-cfg-input" value="${config.nomeResp || ''}" placeholder="Nome do Responsável">
    </div>
    <div class="pt-cfg-group">
      <label>Nome Seg. Trabalho (Assinatura)</label>
      <input type="text" id="pt-cfg-nome-tec" class="pt-cfg-input" value="${config.nomeTec || ''}" placeholder="Nome do Técnico">
    </div>
    <div class="pt-cfg-group">
      <label>Nome Engenheiro (Assinatura)</label>
      <input type="text" id="pt-cfg-nome-eng2" class="pt-cfg-input" value="${config.nomeEng || ''}" placeholder="Nome do Engenheiro">
    </div>
    <div class="pt-cfg-group">
      <label>Logo da Empresa (Arquivo de Imagem)</label>
      <input type="file" id="pt-cfg-logo-file" accept="image/*" class="pt-cfg-input" onchange="ptLerLogo(this)">
      <input type="hidden" id="pt-cfg-logo-b64" value="${config.logo || ''}">
      ${config.logo ? `<img id="pt-cfg-logo-preview" src="${config.logo}" style="max-height:40px; margin-top:8px;">` : `<img id="pt-cfg-logo-preview" style="max-height:40px; margin-top:8px; display:none;">`}
    </div>
    <div class="pt-cfg-btns">
      <button class="pt-btn pt-btn-limpar" onclick="document.getElementById('pt-config-modal').style.display='none'">Cancelar</button>
      <button class="pt-btn pt-btn-print" onclick="ptSalvarConfig()">Salvar</button>
    </div>
  </div>
</div>
`;

    ptAtualizarSecoesEspecificas();
    setTimeout(ptCarregarDadosSalvos, 100);

    // Auto-save no input/change
    const form = document.getElementById('pt-form');
    if (form) {
        form.addEventListener('input', ptSalvarDadosAtuais);
        form.addEventListener('change', ptSalvarDadosAtuais);
    }
}

function ptLerLogo(input) {
    if (input.files && input.files[0]) {
        var reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('pt-cfg-logo-b64').value = e.target.result;
            const preview = document.getElementById('pt-cfg-logo-preview');
            preview.src = e.target.result;
            preview.style.display = 'block';
        }
        reader.readAsDataURL(input.files[0]);
    }
}

function ptAbrirConfig() {
    document.getElementById('pt-config-modal').style.display = 'flex';
}

function ptSalvarConfig() {
    const config = {
        nomeResp: document.getElementById('pt-cfg-nome-resp').value,
        nomeTec: document.getElementById('pt-cfg-nome-tec').value,
        nomeEng: document.getElementById('pt-cfg-nome-eng2').value,
        logo: document.getElementById('pt-cfg-logo-b64').value
    };
    localStorage.setItem('pt-config', JSON.stringify(config));
    document.getElementById('pt-config-modal').style.display = 'none';
    
    // Salvar estado atual antes de re-renderizar
    ptSalvarDadosAtuais();
    renderizarFormPT();
}

function ptLinhasSNA() {
    const dados = [
        ['Acompanhamento do Brigadista','Protetor Facial','Ferro de Solda','Contenção'],
        ['Inspeção Final','Avental','Furadeira Elétrica','Exaustão'],
        ['Alterar o Trânsito','Luva','Lixadeira Elétrica','Isolar a Área'],
        ['Desligar Energia','Cinto de Segurança','Maçarico','Sinalizar'],
        ['Medir Presença de Gases','Macacão','Picareta / Enxada','Tapume'],
        ['Filtro','Máscara PFF1','Motor a Explosão','Aterrar'],
        ['Máscara PFF2','Serra','Descontaminar',''],
        ['Capacete','Respirador Facial','Talhadeira','Insuflar'],
        ['Óculos de Segurança','Respirador Semifacial','Martelete Elétrico/Pneumático','Limpeza da Área'],
        ['Protetor Auricular','Bota de Borracha','Retroescavadeira','Paralisar trabalhos próximos'],
        ['Sapato de Segurança','Mangote Couro','Motoniveladora','Interditar tráfego no local'],
        ['Creme para mãos e braços','Perneira Couro','Mini Escavadeira','Cabos e extensões sinalizados'],
    ];
    
    let html = dados.map((row, idx)=>`
    <tr>
      <td style="font-size:10px;">${row[0]}</td>
      <td class="pt-check-cell">${ptSNA('pt-ger-'+idx+'-0')}</td>
      <td style="font-size:10px;">${row[1]}</td>
      <td class="pt-check-cell">${ptSNA('pt-ger-'+idx+'-1')}</td>
      <td style="font-size:10px;">${row[2]}</td>
      <td class="pt-check-cell">${ptSNA('pt-ger-'+idx+'-2')}</td>
      <td style="font-size:10px;">${row[3]}</td>
      <td class="pt-check-cell">${row[3] ? ptSNA('pt-ger-'+idx+'-3') : ''}</td>
    </tr>`).join('');

    // Adiciona 3 linhas em branco personalizáveis no final
    for(let i=0; i<3; i++) {
        html += `
        <tr>
          <td><input class="pt-input save-target" id="pt-cust-0-${i}" placeholder="Outro..."></td>
          <td class="pt-check-cell">${ptSNA('pt-cust-0-sna-'+i)}</td>
          <td><input class="pt-input save-target" id="pt-cust-1-${i}" placeholder="Outro..."></td>
          <td class="pt-check-cell">${ptSNA('pt-cust-1-sna-'+i)}</td>
          <td><input class="pt-input save-target" id="pt-cust-2-${i}" placeholder="Outro..."></td>
          <td class="pt-check-cell">${ptSNA('pt-cust-2-sna-'+i)}</td>
          <td><input class="pt-input save-target" id="pt-cust-3-${i}" placeholder="Outro..."></td>
          <td class="pt-check-cell">${ptSNA('pt-cust-3-sna-'+i)}</td>
        </tr>`;
    }
    return html;
}

function ptLimparChecklist() {
    // Função desativada a pedido do usuário
}

function ptToggleTipo(el) {
    if (el.classList.contains('selected')) return; // Já está selecionado

    // SALVAR DADOS DO TIPO ATUAL antes de trocar
    ptSalvarDadosAtuais();

    // Desmarca todos e marca o clicado (Seleção Única)
    document.querySelectorAll('.pt-tipo-btn').forEach(b => b.classList.remove('selected'));
    el.classList.add('selected');
    
    const newTipo = el.dataset.tipo;
    
    // Reconstruir seções específicas do novo tipo
    ptAtualizarSecoesEspecificas();
    
    // Carregar dados salvos para o novo tipo (ou limpar se nunca preenchido)
    setTimeout(() => {
        ptCarregarDadosTipo(newTipo);
        ptAtualizarExecTipo();
    }, 20);
}

function ptAtualizarExecTipo() {
    const tiposSel = [...document.querySelectorAll('.pt-tipo-btn.selected')].map(b => b.dataset.tipo).join(', ');
    for(let i=1; i<=6; i++) {
        const el = document.getElementById(`pt-exec-tipo-${i}`);
        if(el && el.value !== tiposSel) {
            el.value = tiposSel;
        }
    }
}

function ptAtualizarSecoesEspecificas() {
    const container = document.getElementById('pt-secoes-especificas');
    if (!container) return;
    const tiposSel = [...document.querySelectorAll('.pt-tipo-btn.selected')].map(b=>b.dataset.tipo);
    let html = '';

    if (tiposSel.includes('1')) html += ptSecaoAltura();
    if (tiposSel.includes('2')) html += ptSecaoQuente();
    if (tiposSel.includes('3')) html += ptSecaoEscavacao();
    if (tiposSel.includes('4')) html += ptSecaoElevacao();
    if (tiposSel.includes('5')) html += ptSecaoEnergias();
    if (tiposSel.includes('6')) html += ptSecaoConfinado();

    container.innerHTML = html;
}

function ptCarregarDadosTipo(tipo) {
    const form = document.getElementById('pt-form');
    if (!form) return;
    
    const savedStr = localStorage.getItem('pt-form-data-tipo-' + tipo);
    
    if (savedStr) {
        try {
            const data = JSON.parse(savedStr);
            // Restaurar todos os campos salvos para este tipo
            form.querySelectorAll('.save-target').forEach(el => {
                if (!el.id) return;
                if (data[el.id] !== undefined) {
                    if (el.type === 'checkbox') el.checked = data[el.id];
                    else el.value = data[el.id];
                } else {
                    // Campo sem dado salvo para este tipo = limpar
                    if (el.type === 'checkbox') el.checked = false;
                    else el.value = '';
                }
            });
        } catch(e) {}
    } else {
        // Tipo nunca preenchido - limpar TODOS os campos
        form.querySelectorAll('.save-target').forEach(el => {
            if (!el.id) return;
            if (el.type === 'checkbox') el.checked = false;
            else el.value = '';
        });
        // Auto-preencher 'S' para Espaço Confinado na primeira vez
        if (tipo === '6') {
            document.querySelectorAll('[id^="pt-conf-sna-"]').forEach(sel => {
                sel.value = 'S';
            });
        }
    }
    
    localStorage.setItem('pt-last-tipo', tipo);
}

function ptSNA(id) {
    return `<select class="sna-select save-target" id="${id}"><option></option><option value="S">S</option><option value="N">N</option><option value="NA">NA</option></select>`;
}

function ptSecaoAltura() {
    const itens = [
        'Escadas em boas condições gerais?', 'Escada amarrada ou segura por terceiro?', 'Ponto de ancoragem adequado para a carga aplicada?',
        'Executantes cientes do ponto de ancoragem?', 'Escada com inclinação correta?', 'Escada cavalete com corrente ou barra limitadora?',
        'Escada cavalete com abertura de 2/3?', 'Abertura nos pisos e paredes estão protegidos?', 'Estrutura do andaime em bom estado?',
        'Equipamento nivelado (andaime)?', 'Guarda corpo e rodapé (andaime)?', 'Base sobre sapatas (andaime)?',
        'Rodízios com trava (andaime)?', 'Travas diagonais a cada 3m (andaime)?', 'Telhados com cabo guia/linha de vida?',
        'Telhas secas e com pranchões?', 'Sinalização e isolamento do piso inferior?', 'Check list da plataforma realizado?',
        'Mínimo 2 operadores treinados em plataforma?',
    ];
    return ptSecaoGenerica('① TRABALHO EM ALTURA',itens,'alt');
}

function ptSecaoQuente() {
    const itens = [
        'Retirar materiais inflamáveis num raio de 10 metros', 'Deixar um extintor próximo', 'Preparar outros meios de extinção',
        'Proteger área de faísca ou projeção de soldas', 'Inspeção de cabos, mangueiras, canetas etc.', 'Verificar vazamento de gases',
        'Cilindros de O2 e acetileno amarrados e protegidos', 'Válvulas corta-chama instaladas', 'Materiais inflamáveis protegidos contra calor?',
    ];
    return ptSecaoGenerica('② SERVIÇOS A QUENTE',itens,'qt');
}

function ptSecaoEscavacao() {
    const itens = [
        'Manter estabilidade em profundidade > 1,25m', 'Isolar área de interferência e comunicar a todos', 'Necessária proteção para produtos inflamáveis',
        'Demarcar área de escavação', 'Escada de emergência', 'Avaliação de atmosfera? O2 / LIE/LEL / CO',
        'Trabalho realizado em dupla', 'Paralisar os trabalhos em caso de chuva/vento', 'Talude 45 graus, acima de 1,20m',
        'Afastar o trânsito de veículos', 'Utilizar o detector eletrônico de obstáculos', 'Verificar possíveis gerações de gases e/ou líquidos',
        'Materiais retirados depositados a dist. > metade da profundidade',
    ];
    return ptSecaoGenerica('③ ESCAVAÇÃO',itens,'esc');
}

function ptSecaoElevacao() {
    const itens = [
        'Inspeção pré-operacional no equipamento', 'A ponta da lança alcança a rede elétrica?', 'Verificar a condição climática (Vento, chuva etc.)',
        'Inspeção nas cintas, cabos e estropos', 'Equipamento tem tabela de carga?', 'Conferir nivelamento e patolamento do equipamento',
        'Apresentar/avaliar plano de RIGGER com ART', 'Conferir travas do moitão', 'Operadores qualificados e autorizados',
        'Sinaleiro para o operador', 'Proibir a presença de pessoas na área', 'Abertura da lança garante um trabalho seguro?',
        'Utilizar cordas para guiar peças', 'Avaliado as dimensões e peso da carga a ser içada',
    ];
    return ptSecaoGenerica('④ ELEVAÇÃO DE CARGA',itens,'elev');
}

function ptSecaoEnergias() {
    const itens = [
        'Instalação de raquetes? Quem:', 'Trava mecânica? Quem:', 'Bloqueio de válvulas com cadeado? Quem:',
        'Identificar com etiquetas? Quem:', 'Testar e Verificar / Quem:', 'Realizar bloqueios? Quem:',
        'Travar com cadeado? Quem:', 'Desenergizar cabos elétricos', 'Necessária proteção para produtos inflamáveis',
        'Limpeza/descontaminação de piso e equipamentos',
    ];
    return ptSecaoGenerica('⑤ CONTROLE DE ENERGIAS',itens,'ene');
}

function ptSecaoConfinado() {
    const itens = [
        'Isolamento e sinalização do espaço confinado?', 'Teste de atmosfera realizado? (O2 / LIE/LEL / CO / H2S)', 'Ventilação mecânica providenciada?',
        'Tripé e sistema de resgate disponível?', 'Cordas e acessórios 4x1 disponíveis?', 'Vigia treinado em NR-33 posicionado na entrada?',
        'Vigilante com comunicação com equipe interna?', 'Equipamento de proteção respiratória disponível?', 'Trabalho realizado em dupla (mínimo)?',
        'Liberação médica dos executantes?', 'Plano de resgate elaborado e testado?', 'Comunicação estabelecida com Bombeiros/Resgate?',
        'Todos foram orientados conforme NR-33?', 'Material necessário montado antes de iniciar?', 'Mestre da obra ciente da atividade?',
    ];
    return `
    <table class="pt-table" style="margin-top:6px;">
      <tr><td class="pt-section-title" colspan="4" style="background:#2c3e50;color:#fff;">⑥ ESPAÇO CONFINADO (NR-33)</td></tr>
      <tr>
        <th style="width:55%">VERIFICAÇÃO</th><th style="width:8%">S/N/NA</th>
        <th style="width:27%">MEDIÇÕES DE ATMOSFERA</th><th style="width:10%">Resultado</th>
      </tr>
      ${itens.map((it,i)=> i < 4 ? `
      <tr>
        <td style="font-size:11px;">${it}</td>
        <td class="pt-check-cell">${ptSNA('pt-conf-sna-'+i)}</td>
        ${i===0 ? `<td style="font-size:11px;text-align:right;">O2 (%): <span style="font-weight:bold;margin-right:10px;">19,5 a 23,0</span></td><td><input class="pt-input save-target" id="pt-atm-o2v" placeholder="% medido"></td>` : ''}
        ${i===1 ? `<td style="font-size:11px;text-align:right;">LIE/LEL (%): <span style="font-weight:bold;margin-right:10px;">&lt; 10</span></td><td><input class="pt-input save-target" id="pt-atm-lelv" placeholder="% medido"></td>` : ''}
        ${i===2 ? `<td style="font-size:11px;text-align:right;">CO (ppm): <span style="font-weight:bold;margin-right:10px;">&lt; 39</span></td><td><input class="pt-input save-target" id="pt-atm-cov" placeholder="ppm medido"></td>` : ''}
        ${i===3 ? `<td style="font-size:11px;text-align:right;">H2S (ppm): <span style="font-weight:bold;margin-right:10px;">&lt; 8</span></td><td><input class="pt-input save-target" id="pt-atm-h2sv" placeholder="ppm medido"></td>` : ''}
      </tr>` : `
      <tr>
        <td style="font-size:11px;">${it}</td>
        <td class="pt-check-cell">${ptSNA('pt-conf-sna-'+i)}</td>
        <td colspan="2" style="font-size:10px;color:#666;text-align:center;">—</td>
      </tr>`).join('')}
    </table>`;
}

function ptSecaoGenerica(titulo, itens, prefixo) {
    return `
    <table class="pt-table" style="margin-top:6px;">
      <tr><td class="pt-section-title" colspan="4" style="background:#2c3e50;color:#fff;">${titulo}</td></tr>
      <tr><th style="width:75%">VERIFICAÇÃO</th><th style="width:8%">S/N/NA</th><th style="width:17%" colspan="2">OBSERVAÇÃO</th></tr>
      ${itens.map((it,i)=>`
      <tr>
        <td style="font-size:11px;">${it}</td>
        <td class="pt-check-cell">${ptSNA(prefixo+'-sna-'+i)}</td>
        <td colspan="2"><input class="pt-input save-target" id="${prefixo}-obs-${i}" placeholder="Observação..."></td>
      </tr>`).join('')}
    </table>`;
}

// === LÓGICA DE SALVAR E CARREGAR POR TIPO DE RISCO (AUTO-SAVE) ===

function ptSalvarDadosAtuais() {
    const form = document.getElementById('pt-form');
    if (!form) return;

    // Identificar tipo selecionado
    const selectedBtn = form.querySelector('.pt-tipo-btn.selected');
    if (!selectedBtn) return; // Sem tipo selecionado, nada a salvar
    
    const tipo = selectedBtn.dataset.tipo;
    const data = {};

    // Salvar todos os campos com classe 'save-target'
    form.querySelectorAll('.save-target').forEach(el => {
        if (!el.id) return;
        if (el.type === 'checkbox') {
            data[el.id] = el.checked;
        } else {
            data[el.id] = el.value;
        }
    });

    localStorage.setItem('pt-form-data-tipo-' + tipo, JSON.stringify(data));
    localStorage.setItem('pt-last-tipo', tipo);
}

function ptCarregarDadosSalvos() {
    const lastTipo = localStorage.getItem('pt-last-tipo');
    if (!lastTipo) return;

    const form = document.getElementById('pt-form');
    if (!form) return;
    
    // Selecionar o botão do último tipo usado
    const btn = form.querySelector(`.pt-tipo-btn[data-tipo="${lastTipo}"]`);
    if (btn && !btn.classList.contains('selected')) {
        btn.classList.add('selected');
    }
    
    // Reconstruir seções específicas
    ptAtualizarSecoesEspecificas();
    
    // Carregar dados do último tipo
    setTimeout(() => {
        ptCarregarDadosTipo(lastTipo);
        ptAtualizarExecTipo();
    }, 20);
}

function ptLimpar() {
    if (confirm('Deseja iniciar uma NOVA PT? Isso apagará todos os campos preenchidos.')) {
        // Remover dados de TODOS os tipos
        for (let i = 1; i <= 6; i++) {
            localStorage.removeItem('pt-form-data-tipo-' + i);
        }
        localStorage.removeItem('pt-last-tipo');
        localStorage.removeItem('pt-form-data'); // compatibilidade
        renderizarFormPT();
    }
}

function ptImprimir() {
    const form = document.getElementById('pt-form');
    
    // Limpar "Tipo" e esconder "às" nas linhas vazias de Executantes
    for(let i=1; i<=6; i++) {
        const nomeEl = document.getElementById('pt-exec-nome-'+i);
        const tipoEl = document.getElementById('pt-exec-tipo-'+i);
        const spanAs = document.getElementById('pt-as-span-'+i);
        if (nomeEl && !nomeEl.value) {
            if (tipoEl) {
                tipoEl.setAttribute('data-old-value', tipoEl.value);
                tipoEl.value = ''; 
            }
            if (spanAs) spanAs.style.display = 'none';
        }
        
        // Esconder nomes na tabela Autorizações se a data estiver vazia
        const dataAuth = document.getElementById('pt-auth-data-'+i);
        if (dataAuth && !dataAuth.value) {
            ['n1', 'n2', 'n3'].forEach(pref => {
                const nEl = document.getElementById(`pt-auth-${pref}-${i}`);
                if (nEl) nEl.style.display = 'none';
            });
        }
    }
    
    // TRANSFORMAR VALORES ATUAIS EM ATRIBUTOS HTML PARA O INNERHTML CAPTURAR
    const dateEmptys = [];
    form.querySelectorAll('input:not([type="checkbox"])').forEach(el => {
        if ((el.type === 'date' || el.type === 'time') && !el.value) {
            dateEmptys.push({ el: el, oldType: el.getAttribute('type') });
            el.setAttribute('type', 'text');
        }
        el.setAttribute('value', el.value || '');
    });
    form.querySelectorAll('input[type="checkbox"]').forEach(el => {
        if(el.checked) el.setAttribute('checked', 'checked');
        else el.removeAttribute('checked');
    });
    form.querySelectorAll('select').forEach(el => {
        el.querySelectorAll('option').forEach(opt => {
            if(opt.value === el.value) opt.setAttribute('selected', 'selected');
            else opt.removeAttribute('selected');
        });
    });
    form.querySelectorAll('textarea').forEach(el => {
        el.innerHTML = el.value;
    });

    const conteudo = form.innerHTML;
    
    // Restaurar campos de data/hora
    dateEmptys.forEach(item => {
        item.el.setAttribute('type', item.oldType);
    });
    
    // Restaurar "Tipo" e "às" nas linhas vazias
    for(let i=1; i<=6; i++) {
        const nomeEl = document.getElementById('pt-exec-nome-'+i);
        const tipoEl = document.getElementById('pt-exec-tipo-'+i);
        const spanAs = document.getElementById('pt-as-span-'+i);
        if (nomeEl && !nomeEl.value) {
            if (tipoEl && tipoEl.hasAttribute('data-old-value')) {
                tipoEl.value = tipoEl.getAttribute('data-old-value');
                tipoEl.removeAttribute('data-old-value');
            }
            if (spanAs) spanAs.style.display = 'inline';
        }
        
        // Restaurar nomes na tabela Autorizações
        const dataAuth = document.getElementById('pt-auth-data-'+i);
        if (dataAuth && !dataAuth.value) {
            ['n1', 'n2', 'n3'].forEach(pref => {
                const nEl = document.getElementById(`pt-auth-${pref}-${i}`);
                if (nEl) nEl.style.display = 'block';
            });
        }
    }
    
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    
    const w = iframe.contentWindow;
    w.document.open();
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Permissão de Trabalho</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:10px;margin:10px;color:#000;}
      table{width:100%;border-collapse:collapse;margin-bottom:6px; page-break-inside: avoid;}
      td,th{border:1px solid #333;padding:3px 4px;vertical-align:top;}
      th{background:#ddd !important; -webkit-print-color-adjust:exact; color-adjust:exact;}
      .pt-tipo-btn{padding:2px 4px;border:1px solid #000;border-radius:3px; display:inline-block; margin:1px;}
      .pt-tipo-btn.selected{background:#333 !important;color:#fff !important;font-weight:bold; -webkit-print-color-adjust:exact; color-adjust:exact;}
      input,select,textarea{width:100%;border:none;border-bottom:1px solid #aaa;font-size:10px;background:transparent;font-family:inherit;}
      select{appearance:none; -webkit-appearance:none; border:1px solid #fff; border-bottom:1px solid #aaa; text-align:center; text-align-last:center;}
      .pt-section-title{background:#eee !important;font-weight:bold;text-align:center; -webkit-print-color-adjust:exact; color-adjust:exact;}
      .pt-sign-box{height:30px;}
      tr { page-break-inside: avoid; }
      @page{margin:8mm;}
      ::placeholder { color: transparent !important; opacity: 0 !important; }
    </style></head><body>${conteudo}</body></html>`);
    w.document.close();
    
    // Auto-ajustar textareas na impressao
    const tas = w.document.querySelectorAll('textarea');
    tas.forEach(ta => {
        ta.style.height = ta.scrollHeight + 'px';
        ta.style.border = 'none'; 
        ta.style.overflow = 'visible';
    });

    setTimeout(()=>{ 
        w.focus();
        w.print(); 
        setTimeout(() => document.body.removeChild(iframe), 2000);
    }, 800);
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('conteudoAbaPT')) {
        renderizarFormPT();
    }
});

// Interceptar Ctrl+P para usar a função de impressão nativa do form se o modal estiver aberto
// e interceptar ESC para fechar as modais
document.addEventListener('keydown', function(event) {
    const modalFormularios = document.getElementById('modalFormularios');
    const osConfigModal = document.getElementById('os-config-modal');
    const ptConfigModal = document.getElementById('pt-config-modal');

    // Fechar com ESC
    if (event.key === 'Escape') {
        let stopped = false;
        
        // 1. Tentar fechar sub-modais de configuração primeiro
        if (osConfigModal && osConfigModal.style.display !== 'none' && osConfigModal.style.display !== '') {
            osConfigModal.style.display = 'none';
            stopped = true;
        }
        else if (ptConfigModal && ptConfigModal.style.display !== 'none' && ptConfigModal.style.display !== '') {
            ptConfigModal.style.display = 'none';
            stopped = true;
        }
        
        // 2. Se nenhum sub-modal estava aberto, fechar o modal principal
        if (!stopped && modalFormularios && modalFormularios.style.display !== 'none' && modalFormularios.style.display !== '') {
            modalFormularios.style.display = 'none';
        }
    }

    // Ctrl+P
    if ((event.ctrlKey || event.metaKey) && (event.key === 'p' || event.key === 'P')) {
        if (modalFormularios && modalFormularios.style.display !== 'none') {
            event.preventDefault(); // Impede o print padrao do navegador (que sai feio)
            // Checar qual aba esta visivel
            const abaPT = document.getElementById('conteudoAbaPT');
            if (abaPT && abaPT.style.display !== 'none') {
                ptImprimir();
            } else {
                if(typeof osImprimir === 'function') osImprimir();
            }
        }
    }
});
