// =====================================================================
// FORMULÁRIO - ORDEM DE SERVIÇO (OS)
// =====================================================================

function osGetConfig() {
    let config;
    try {
        config = JSON.parse(localStorage.getItem('os-config'));
    } catch (e) {}
    
    if (!config) {
        config = {
            empresa: 'Construtora HOSS Ltda.',
            instrutor: 'Ervanio F Rodrigues',
            logo: '/Logo-Hoss.jpg'
        };
    } else if (!config.logo) {
        config.logo = '/Logo-Hoss.jpg';
    }
    return config;
}

async function renderizarFormOS() {
    const container = document.getElementById('conteudoAbaOS');
    if (!container) return;
    
    const config = osGetConfig();

    let funcoes = [];
    try {
        const res = await fetch('/api/funcoes');
        const json = await res.json();
        // /api/funcoes retorna diretamente um array: ["Funcao1", "Funcao2"]
        if (Array.isArray(json)) {
            funcoes = json;
        } else if (json.success && json.data) {
            funcoes = json.data;
        }
    } catch(e) {
        console.error('Erro ao buscar funções para OS:', e);
    }
    
    // Removemos o fallback fixo para não dar a impressão de "vazamento" de dados de outra empresa
    // Se a empresa for nova, só terá as funções que ela mesma cadastrou.

    const optionsHtml = funcoes.map(f => `<option value="${f}">${f}</option>`).join('');

    container.innerHTML = `
<style>
#os-form { font-family: Arial, sans-serif; font-size: 12px; color: #222; padding: 10px; }
#os-form h2 { text-align:center; font-size:16px; margin:0 0 5px; text-transform:uppercase; background:#1a3a5c; color:#fff; padding:8px; border-radius:4px; }
.os-table { width:100%; border-collapse:collapse; margin-bottom:10px; }
.os-table td, .os-table th { border:1px solid #333; padding:5px 8px; vertical-align:top; }
.os-section-title { background:#c8d8e8; font-weight:bold; font-size:12px; text-align:center; text-transform:uppercase; }
.os-input { width:100%; border:none; border-bottom:1px solid #999; font-size:12px; padding:3px; background:transparent; font-family:inherit; }
.os-input:focus { outline:none; border-bottom:2px solid #2980b9; }
.os-textarea { width:100%; border:1px solid #ccc; font-size:12px; padding:5px; resize:vertical; min-height:60px; font-family:inherit; }
.os-check-item { display:flex; align-items:center; gap:5px; margin-bottom:4px; }
.os-check-item input { margin:0; cursor:pointer; }
.os-check-item label { cursor:pointer; font-size:11px; }
.os-btn-print { background:#1a3a5c; color:#fff; border:none; padding:8px 18px; border-radius:5px; cursor:pointer; font-size:12px; font-weight:bold; }
.os-btn-limpar { background:#e74c3c; color:#fff; border:none; padding:8px 18px; border-radius:5px; cursor:pointer; font-size:12px; font-weight:bold; }
.os-btn-config { background:#7f8c8d; color:#fff; border:none; padding:8px 18px; border-radius:5px; cursor:pointer; font-size:12px; font-weight:bold; }
.os-btn-template { background:#f39c12; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:11px; font-weight:bold; margin-right:5px; }
.os-sign-box { border-bottom:1px solid #000; height:30px; margin-top:20px; }
/* Modal de Configuração OS */
#os-config-modal { display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:10000; justify-content:center; align-items:center; }
#os-config-content { background:#fff; padding:20px; border-radius:8px; width:450px; max-width:90%; box-shadow:0 4px 15px rgba(0,0,0,0.3); }
#os-config-content h3 { margin-top:0; border-bottom:1px solid #eee; padding-bottom:10px; }
.os-cfg-group { margin-bottom:12px; }
.os-cfg-group label { display:block; font-weight:bold; font-size:12px; margin-bottom:4px; color:#333; }
.os-cfg-input { width:100%; padding:6px; border:1px solid #ccc; border-radius:4px; box-sizing:border-box; font-size:12px; }
.os-cfg-btns { display:flex; justify-content:flex-end; gap:10px; margin-top:20px; }

/* Header do Formulario com Logo */
.os-header-impr { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; border: 1px solid #333; padding: 5px; }
.os-header-logo { height: 60px; max-width: 180px; object-fit: contain; }
.os-header-title { flex: 1; text-align: center; font-weight: bold; font-size: 16px; padding: 10px; border-left: 1px solid #333; background: #1a3a5c; color: #fff; }

/* Preview de Logo no modal */
.logo-upload-area { display:flex; align-items:center; gap:10px; }
.logo-preview-img { width:50px; height:50px; object-fit:contain; border:1px solid #ccc; border-radius:4px; }
.btn-selecionar-logo { background:#2980b9; color:#fff; border:none; padding:6px 10px; border-radius:4px; cursor:pointer; font-size:11px; }
</style>

<div id="os-form">
  <!-- CABEÇALHO COM LOGO -->
  <div class="os-header-impr">
    <img src="${config.logo || '/Logo-Hoss.jpg'}" class="os-header-logo" alt="Logo Empresa">
    <div class="os-header-title">ORDEM DE SERVIÇO DE SEGURANÇA</div>
  </div>

  <!-- SELEÇÃO DE TEMPLATE -->
  <div style="margin-bottom:10px; display:flex; gap:10px; align-items:center; background:#f0f4f8; padding:8px; border-radius:4px; border:1px solid #d0dce8;">
    <strong style="color:#1a3a5c;">Carregar Padrão:</strong>
    <select class="os-input" style="width:250px; background:#fff; border:1px solid #ccc; padding:4px;" onchange="if(this.value) { osCarregarTemplate(this.value); this.value=''; }">
      <option value="">-- Selecione a Função --</option>
      ${optionsHtml}
    </select>
  </div>

  <!-- CABEÇALHO -->
  <table class="os-table">
    <tr>
      <td style="width:50%;">
        <div style="display:flex; align-items:center; gap:5px;">
          <b style="white-space:nowrap;">Nome:</b> 
          <input class="os-input" id="os-nome" style="flex:1; width:auto;" placeholder="Nome do funcionário">
        </div>
      </td>
      <td style="width:25%;">
        <div style="display:flex; align-items:center; gap:5px;">
          <b style="white-space:nowrap;">Setor:</b> 
          <input class="os-input" id="os-setor" style="flex:1; width:auto;" placeholder="Obras / ADM">
        </div>
      </td>
      <td style="width:25%;">
        <div style="display:flex; align-items:center; gap:5px;">
          <b style="white-space:nowrap;">Data:</b> 
          <input class="os-input" type="date" id="os-data" style="flex:1; width:auto;">
        </div>
      </td>
    </tr>
    <tr>
      <td colspan="3">
        <div style="display:flex; align-items:center; gap:5px;">
          <b style="white-space:nowrap;">Função:</b> 
          <input class="os-input" id="os-funcao" style="flex:1; width:auto;" placeholder="Descreva a função do funcionário">
        </div>
      </td>
    </tr>
  </table>

  <!-- ATIVIDADES DESENVOLVIDAS -->
  <table class="os-table">
    <tr><td class="os-section-title">ATIVIDADES DESENVOLVIDAS</td></tr>
    <tr><td><textarea class="os-textarea" id="os-atividades" placeholder="Descreva detalhadamente as atividades executadas..."></textarea></td></tr>
  </table>

  <!-- RISCOS ENVOLVIDOS & EPI'S -->
  <table class="os-table">
    <tr>
      <td class="os-section-title" style="width:50%;">RISCOS ENVOLVIDOS</td>
      <td class="os-section-title" style="width:50%;">EPI'S DE USO OBRIGATÓRIO</td>
    </tr>
    <tr>
      <td style="vertical-align:top;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px;" id="os-lista-riscos">
          <!-- Gerado via JS -->
        </div>
      </td>
      <td style="vertical-align:top;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px;" id="os-lista-epis">
          <!-- Gerado via JS -->
        </div>
      </td>
    </tr>
  </table>

  <!-- NORMAS INTERNAS / MEDIDAS PREVENTIVAS -->
  <table class="os-table">
    <tr><td class="os-section-title">NORMAS INTERNAS / MEDIDAS PREVENTIVAS / RECOMENDAÇÕES</td></tr>
    <tr><td><textarea class="os-textarea" id="os-medidas" style="min-height:120px;" placeholder="Medidas preventivas, regras do canteiro, procedimentos seguros..."></textarea></td></tr>
  </table>

  <!-- PROCEDIMENTOS EM CASO DE ACIDENTES -->
  <table class="os-table">
    <tr><td class="os-section-title">PROCEDIMENTOS EM CASO DE ACIDENTES</td></tr>
    <tr><td><textarea class="os-textarea" id="os-acidentes" style="min-height:50px;">Comunicar imediatamente qualquer acidente ou incidente ao Encarregado / Engenheiro / Segurança do Trabalho e aguardar orientações, obedecendo o Fluxograma de Acidentes.</textarea></td></tr>
  </table>

  <!-- TERMO DE RESPONSABILIDADE -->
  <table class="os-table os-print-break">
    <tr><td class="os-section-title">TERMO DE RESPONSABILIDADE</td></tr>
    <tr>
      <td style="font-size:11px; text-align:justify; line-height:1.4;">
        Declaro que recebi da <b>${config.empresa}</b> nesta data, as orientações que fazem parte deste documento, estando ciente e comprometendo-me a seguir as orientações nela contidas e reconhecendo serem elas indispensáveis à minha segurança e a de meus colegas de trabalho.
        Também afirmo ter recebido os EPI's de utilização obrigatória para minha função e comprometo-me a utilizá-los durante toda a minha jornada de trabalho, solicitando sua substituição sempre que necessário.
        O não cumprimento injustificado das determinações acima implicará em ATO FALTOSO com as Normas de Segurança, podendo vir a sofrer as seguintes punições: advertência verbal, advertência por escrito, suspensão e/ou demissão por justa causa.
      </td>
    </tr>
  </table>

  <!-- ASSINATURAS -->
  <table class="os-table" style="margin-top:20px; border:none;">
    <tr>
      <td style="border:none; text-align:center; width:50%; padding:0 20px;">
        <div class="os-sign-box"></div>
        <div style="margin-top:5px; font-weight:bold;">Assinatura do Empregado</div>
      </td>
      <td style="border:none; text-align:center; width:50%; padding:0 20px;">
        <div class="os-sign-box"></div>
        <div style="margin-top:5px; font-weight:bold;">Assinatura do Instrutor (Segurança do Trabalho)</div>
        <div><input class="os-input" id="os-instrutor" style="text-align:center;" placeholder="Nome do Instrutor" value="${config.instrutor}"></div>
      </td>
    </tr>
  </table>

  <!-- BOTÕES -->
  <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:10px;padding-bottom:10px;">
    <button class="os-btn-config" onclick="osAbrirConfig()">⚙️ Configurações</button>
    <button class="os-btn-limpar" onclick="osLimpar()">🗑️ Limpar</button>
    <button class="os-btn-print" onclick="osImprimir()">🖨️ Imprimir OS</button>
  </div>

  <!-- MODAL CONFIGURAÇÕES OS -->
  <div id="os-config-modal">
    <div id="os-config-content">
      <h3>Configurações da Ordem de Serviço</h3>
      
      <div class="os-cfg-group">
        <label>Logo da Empresa:</label>
        <div class="logo-upload-area">
            <img id="os-cfg-preview-logo" src="${config.logo || '/Logo-Hoss.jpg'}" class="logo-preview-img">
            <input type="file" id="os-cfg-file-logo" accept="image/*" style="display:none" onchange="osPreviewLogo(this)">
            <button type="button" class="btn-selecionar-logo" onclick="document.getElementById('os-cfg-file-logo').click()">📷 Carregar Logo</button>
        </div>
      </div>

      <div class="os-cfg-group">
        <label>Nome da Empresa (Termo de Responsabilidade)</label>
        <input type="text" id="os-cfg-empresa" class="os-cfg-input" value="${config.empresa}" placeholder="Ex: Construtora HOSS Ltda.">
      </div>
      <div class="os-cfg-group">
        <label>Nome do Instrutor Padrão</label>
        <input type="text" id="os-cfg-instrutor" class="os-cfg-input" value="${config.instrutor}" placeholder="Nome do Técnico de Segurança">
      </div>
      <div class="os-cfg-btns">
        <button class="os-btn-limpar" onclick="document.getElementById('os-config-modal').style.display='none'">Cancelar</button>
        <button class="os-btn-print" onclick="osSalvarConfig()">Salvar</button>
      </div>
    </div>
  </div>
</div>`;

    osGerarCheckboxes();
}


function osGerarCheckboxes() {
    const containerRiscos = document.getElementById('os-lista-riscos');
    const containerEpis = document.getElementById('os-lista-epis');
    if(!containerRiscos || !containerEpis) return;

    const riscos = [
        "Ruído", "Poeira", "Radiação não ionizante", "Postura incorreta", 
        "Iluminação insuficiente / excessiva", "Queda de nível (andaimes, escadas)", 
        "Queda de mesmo nível", "Queda de objetos", "Choque elétrico", 
        "Dermatoses por contato c/ produtos químicos", "Cortes, projeção de partículas", 
        "Arranjo físico inadequado (entulhos)", "Ferramentas defeituosas / Improvisação",
        "Risco de soterramento / desabamento", "Trabalho a quente / Risco de incêndio",
        "Vibração"
    ];

    const epis = [
        "Capacete com jugular", "Óculos de segurança incolor ou escuro", 
        "Calçado de segurança c/ bico", "Máscara contra poeira", 
        "Uniforme Refletivo", "Cinto de Segurança tipo paraquedista", 
        "Protetor auricular (plug ou concha)", "Luvas (nitrílica/raspa/vaqueta/pigmento)", 
        "Bota de borracha", "Protetor facial / Máscara de Solda", 
        "Avental / Perneira de raspa", "Respirador semifacial c/ filtro",
        "Creme Protetor / Protetor Solar", "Luvas anti vibração", "Máscara PFF2"
    ];

    containerRiscos.innerHTML = riscos.map((r, i) => `
        <div class="os-check-item">
            <input type="checkbox" id="os-risco-${i}" value="${r}">
            <label for="os-risco-${i}">${r}</label>
        </div>
    `).join('');

    containerEpis.innerHTML = epis.map((e, i) => `
        <div class="os-check-item">
            <input type="checkbox" id="os-epi-${i}" value="${e}">
            <label for="os-epi-${i}">${e}</label>
        </div>
    `).join('');
}

function osCarregarTemplate(funcao) {
    document.getElementById('os-funcao').value = funcao;
    
    // Desmarcar todos primeiro
    document.querySelectorAll('#os-lista-riscos input, #os-lista-epis input').forEach(c => c.checked = false);
    
    // Texto base para atividades
    let atividades = "";
    let medidas = `Usar os EPI's conforme orientação da Segurança do Trabalho / Encarregados.
Manter organizado e limpo o ambiente de trabalho.
As ferramentas rotativas só poderão ser manuseadas mediante treinamento e autorização.
Não improvisar ferramentas manuais.
Para trabalho em altura a partir de 2,00 metros, obrigatória a utilização do cinto de segurança tipo paraquedista com 2 talabartes ancorados em linha de vida.
Ao trabalhar em altura isolar e sinalizar a área abaixo.
Realizar Check List das ferramentas elétricas / manuais diariamente.
Paralisar o serviço sempre que constatar irregularidade quanto à segurança.
Não remover ou ultrapassar áreas isoladas / sinalizadas.
Não executar nenhum tipo de tarefa para a qual não foi treinado ou autorizado.
Fumar somente em local permitido. Não consumir bebida alcoólica.
Proibida a utilização de celulares e fones de ouvido durante as atividades.`;

    // Marcar base (quase todos têm)
    const baseRiscos = [0,1,3,5,6,7,10,11];
    const baseEpis = [0,1,2,4,7];
    
    baseRiscos.forEach(i => { const el = document.getElementById('os-risco-'+i); if(el) el.checked = true; });
    baseEpis.forEach(i => { const el = document.getElementById('os-epi-'+i); if(el) el.checked = true; });

    const fUpper = funcao.toUpperCase();

    if(fUpper.includes('SERVENTE')) {
        atividades = `- Executar tarefas auxiliares no canteiro de obras.
- Auxiliar o pedreiro, carpinteiro, armadores entre outros na execução da obra.
- Colaborar na organização e limpeza das áreas de trabalho.
- Preparar mistura para argamassa, transportar carrinhos com massa.`;
        
        medidas = `Usar os EPI's conforme orientação / recomendação da Segurança do Trabalho / Encarregados da obra.
Usar luvas de raspa de couro para trabalhos com materiais cortantes e abrasivos.
Manter organizado e limpo o ambiente de trabalho.
As ferramentas rotativas só poderão ser manuseadas mediante treinamento e autorização.
Usar luvas e botas impermeáveis em locais úmidos.
Utilizar luvas impermeáveis para manuseio de cimento, argamassa ou produtos químicos.
Não improvisar ferramentas manuais.
Para trabalho em altura a partir de 2,00 metros, obrigatória a utilização do cinto de segurança tipo paraquedista com 2 talabartes ancorados em linha de vida.
Ao trabalhar em altura isolar e sinalizar a área abaixo.
Usar protetor auricular, quando trabalhar em local ruidoso.
Utilizar diariamente protetor solar.
Realizar Check List das ferramentas elétricas / manuais / e extensões elétricas diariamente.
Paralisar o serviço sempre que constatar qualquer irregularidade quanto à segurança, comunicando imediatamente.
Não remover ou ultrapassar áreas isoladas / sinalizadas.
Circular com atenção no canteiro de obras e comunicar as condições inseguras encontradas.
Não executar nenhum tipo de tarefa para a qual não foi treinado ou autorizado.`;

        // Riscos da OS Original do Servente HOSS
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].forEach(i => { if(document.getElementById('os-risco-'+i)) document.getElementById('os-risco-'+i).checked = true; });
        // EPIs da OS Original
        [0, 1, 2, 3, 4, 5, 6, 7, 8].forEach(i => { if(document.getElementById('os-epi-'+i)) document.getElementById('os-epi-'+i).checked = true; });
    } 
    else if(fUpper.includes('PEDREIRO')) {
        atividades = `- Executar trabalhos de alvenaria, assentamento de tijolos, blocos, reboco, concretagem.
- Nivelar, aprumar e realizar acabamentos.
- Utilizar ferramentas manuais (colher, prumo, nível, desempenadeira).
- Manusear argamassa e cimento.`;
        document.getElementById('os-risco-9').checked = true;
        document.getElementById('os-epi-3').checked = true;
        document.getElementById('os-epi-8').checked = true;
    }
    else if(fUpper.includes('CARPINTEIRO')) {
        atividades = `Estruturas e Fôrmas: Confeccionar fôrmas de madeira para fundações, pilares, vigas e lajes, permitindo a concretagem.
Armações de Telhados: Construir estruturas para telhados (tesouras, caibros) e montagem de andaimes para sustentação ou proteção.
Esquadrias e Acabamentos: Instalar portas, janelas, rodapés, forros, divisórias e esquadrias de madeira.
Leitura de Projetos: Interpretar plantas e projetos de engenharia para cortar, montar e instalar peças com precisão.
Manejo de Ferramentas: Utilizar ferramentas manuais e elétricas (serras, martelos, furadeiras, plainas) com segurança.
Desforma: Retirar as fôrmas de madeira após a cura do concreto
Orientação:
	Operar serra circular de bancada e ferramentas de corte manuais/elétricas.
	Operar serra circular manual sem com uso de bancada “Obrigatório” Caso não tenha, providenciar a montagem de uma para trabalho.`;

        medidas = `Cuidados Especiais: Nas desformas, Escoramentos, Escavações, manuseio de matérias, na concretagem de locais altos, acessos em espaço confinado não acessar sem autorização, nunca remover uma proteção sem autorização e ao remover, deixa como estava.
Usar os EPI's conforme orientação da Segurança do Trabalho / Encarregados.
Manter organizado e limpo o ambiente de trabalho.
As ferramentas rotativas só poderão ser manuseadas mediante treinamento e autorização.
Não improvisar ferramentas manuais.
Para trabalho em altura a partir de 2,00 metros, obrigatória a utilização do cinto de segurança tipo paraquedista com 2 talabartes ancorados em linha de vida.
Ao trabalhar em altura isolar e sinalizar a área abaixo.
Realizar Check List das ferramentas elétricas / manuais diariamente.
Paralisar o serviço sempre que constatar irregularidade quanto à segurança.
Não remover ou ultrapassar áreas isoladas / sinalizadas.
Não executar nenhum tipo de tarefa para a qual não foi treinado ou autorizado.
Fumar somente em local permitido. Não consumir bebida alcoólica nem se alimentar no canteiro de obras.
Proibida a utilização de celulares e fones de ouvido durante as atividades.`;

        document.getElementById('os-risco-8').checked = true; // Choque
        document.getElementById('os-risco-12').checked = true; // Ferramentas
        document.getElementById('os-epi-6').checked = true; // Protetor auricular
    }
    else if(fUpper.includes('ARMADOR')) {
        atividades = `- Cortar, dobrar e montar armações de aço para estruturas de concreto.
- Auxiliar na concretagem quando necessário.
- Operar tesoura manual, policorte e ferramentas de armação.`;
        document.getElementById('os-risco-10').checked = true; // Cortes
        document.getElementById('os-epi-7').checked = true; // Luvas raspa
    }
    else if(fUpper.includes('ADMINISTRATIVO')) {
        atividades = `- Executar rotinas administrativas no escritório da obra (arquivos, folha de ponto, controle de notas fiscais).
- Eventuais idas ao canteiro de obras para coleta de assinaturas, entrega de documentos e comunicação com encarregados.`;
        baseRiscos.forEach(i => { const el = document.getElementById('os-risco-'+i); if(el) el.checked = false; });
        baseEpis.forEach(i => { const el = document.getElementById('os-epi-'+i); if(el) el.checked = false; });
        [3, 6, 7].forEach(i => document.getElementById('os-risco-'+i).checked = true); // Postura, Queda mesmo nível, Queda objetos
        [0, 1, 2].forEach(i => document.getElementById('os-epi-'+i).checked = true); // Capacete, Óculos, Botina (ao entrar na obra)
    }
    else if(fUpper.includes('ENGENHEIRO')) {
        atividades = `- Projetar e acompanhar todas as etapas de uma construção e/ou reformas.
- Realizar serviços técnicos de controle e acompanhamento de obra.
- Chefiar as equipes, supervisionando os prazos, os custos e o cumprimento das normas de segurança, saúde e meio ambiente.
- Atender o cliente, participar de reuniões para apresentação do desenvolvimento da obra.
- Responsável pela modificação em projetos.
- Responsável pela compra de material e contratação de funcionários.
- Verificar apontamentos e licenças de funcionários.`;
        
        medidas = `Utilizar os EPI's conforme orientação / recomendação da Segurança do Trabalho.
Para trabalho em altura a partir de 2,00 metros, obrigatório utilizar do cinto de segurança tipo paraquedista acoplado a linha de vida.
Utilizar óculos de segurança quando estiver no canteiro de obras.
Utilizar diariamente protetor solar.
Orientar os encarregados e funcionários sobre o processo mais seguro de executar os trabalhos.
Planejar, coordenar e controlar a execução da tarefa determinando o processo mais seguro a ser adotado.
Fiscalizar e exigir dos funcionários o uso do EPI apropriado.
Realizar reunião com a administração da obra para discutir as medidas específicas de segurança a serem adotadas.
Dar especial atenção à proteção da periferia, poços de elevadores, instalações elétricas e a manutenção de máquinas e equipamentos.
Paralisar imediatamente os trabalhos em andamento que sujeitem os trabalhadores a grave e iminente risco.
Utilizar protetor auricular, quando trabalhar em local ruidoso.
Não permitir alterações nos locais onde tenham ocorrido acidentes graves, antes da realização da perícia ou vistoria.
Providenciar atendimento médico urgente aos trabalhadores acidentados.`;

        // Riscos (Conforme OS Engenheiro Civil.docx extraído)
        [0, 1, 2, 3, 4, 6, 10, 11].forEach(i => { if(document.getElementById('os-risco-'+i)) document.getElementById('os-risco-'+i).checked = true; });
        // EPIs (Capacete, Óculos, Bico, Máscara, Cinto, Protetor Plug, Bota Borracha, Refletivo)
        [0, 1, 2, 3, 5, 6, 8, 4].forEach(i => { if(document.getElementById('os-epi-'+i)) document.getElementById('os-epi-'+i).checked = true; });
    }
    else if(fUpper.includes('ESTAGIÁRIO') || fUpper.includes('ESTAGIARIO')) {
        atividades = `- Auxiliar o engenheiro nas rotinas de planejamento e acompanhamento da execução da obra.
- Realizar medições em campo, atualização de cronogramas, leitura de projetos e verificação de serviços nas frentes de trabalho.`;
    }
    else if(fUpper.includes('ELETRICISTA')) {
        atividades = `- Executar a montagem, instalação e manutenção de quadros elétricos, redes de distribuição (baixa tensão), iluminação e tomadas provisórias e definitivas da obra.
- Testar circuitos, realizar desenergização e bloqueios elétricos conforme NR-10.
- Lançamento de fiação em eletrodutos e calhas.`;
        document.getElementById('os-risco-8').checked = true; // Choque elétrico
        document.getElementById('os-risco-10').checked = true; // Cortes
        document.getElementById('os-epi-5').checked = true; // Cinto de Segurança
        document.getElementById('os-epi-7').checked = true; // Luvas isolantes/vaqueta
    }
    else if(fUpper.includes('SEGURANÇA') || fUpper.includes('SEGURANCA')) {
        atividades = `- Realizar inspeções de Segurança, Meio Ambiente e Saúde (SSMA) no canteiro de obras.
- Ministrar treinamentos, integrações e Diálogos Diários de Segurança (DDS).
- Emitir e validar Permissões de Trabalho (PT) e fiscalizar o uso correto de EPIs e EPCs.`;
        document.getElementById('os-risco-2').checked = true; // Radiação (sol)
    }
    else if(fUpper.includes('EDIFICAÇÕES') || fUpper.includes('EDIFICACOES')) {
        atividades = `- Auxiliar a engenharia no controle da execução da obra, fiscalizando as equipes de campo e terceirizados.
- Levantar quantitativos, verificar alinhamento, prumo, nivelamento e conformidade das estruturas com os projetos.`;
        document.getElementById('os-risco-2').checked = true; // Radiação
    }
    else if(fUpper.includes('MARTELETEIRO')) {
        atividades = `Operam equipamentos (martelete) de pequeno porte para a retirada de materiais fixados ou perfurações parciais ou desmontagens. Inspecionam as condições operacionais dos equipamentos e do local do trabalho e preparam o local para o trabalho. Cumprem as normas de segurança do trabalho.`;
        medidas = `- Usar obrigatoriamente os Equipamentos de Proteção Individual e Coletiva indicados para a função;
- Cumprir todas as normas internas da Empresa, inclusive esta Ordem de Serviço, normas expedidas pela Contratante sobre Segurança e Saúde Ocupacional;
- Estaquear corretamente o ponto de ancoragem a 45º;
- Realizar inspeções nos EPI's e ferramentas manuais antes do início das atividades;
- Treinamentos de Segurança / DSS – Diálogo de Segurança e Saúde Ocupacional;
- O Equipamento de Proteção Coletiva, o Equipamento de Proteção Individual e as Análises de Risco da Tarefa serão usadas como medidas para eliminar e/ou neutralizar a insalubridade e condições inseguras.`;
        
        // Riscos Específicos
        [0, 3, 5, 7, 15].forEach(i => {
            const el = document.getElementById('os-risco-'+i);
            if(el) el.checked = true;
        });

        // EPIs Específicos
        [0, 1, 2, 5, 6, 12, 13, 14].forEach(i => {
            const el = document.getElementById('os-epi-'+i);
            if(el) el.checked = true;
        });
    }
    else if(fUpper.includes('AJUDANTE') || fUpper.includes('AUXILIAR')) {
        atividades = `- Auxiliar os profissionais (pedreiro, carpinteiro, ferreiro, etc) na execução de suas tarefas.
- Transportar materiais de construção, ferramentas e entulhos no canteiro de obras.
- Preparar massas, argamassas e misturas sob supervisão.
- Manter a organização e limpeza permanente dos locais de trabalho.`;
        // Riscos
        [9, 10, 11].forEach(i => { if(document.getElementById('os-risco-'+i)) document.getElementById('os-risco-'+i).checked = true; });
        // EPIs
        [3, 6, 7, 8].forEach(i => { if(document.getElementById('os-epi-'+i)) document.getElementById('os-epi-'+i).checked = true; });
    }
    else if(fUpper.includes('SOLDADOR')) {
        atividades = `- Realizar a união e corte de peças metálicas por meio de processos de soldagem (Arco, MIG/MAG, Eletrodo).
- Preparar superfícies, chanfros e alinhamentos das peças antes da soldagem.
- Realizar inspeção visual de soldas, controlar parâmetros das máquinas de solda.
- Utilizar lixadeiras para acabamento em superfícies soldadas.`;
        // Riscos Específicos
        [0, 2, 8, 10, 14].forEach(i => { if(document.getElementById('os-risco-'+i)) document.getElementById('os-risco-'+i).checked = true; });
        // EPIs Específicos
        [1, 6, 7, 9, 10, 11].forEach(i => { if(document.getElementById('os-epi-'+i)) document.getElementById('os-epi-'+i).checked = true; });
    }
    else if(fUpper.includes('MONTADOR')) {
        atividades = `- Montar e desmontar estruturas metálicas, andaimes, torres de elevação ou fôrmas industriais.
- Apertar conexões parafusadas e fixadores com uso de ferramentas de impacto.
- Auxiliar e orientar o içamento e movimentação de cargas estruturais pesadas.`;
        // Riscos Específicos
        [0, 3, 5, 7, 10].forEach(i => { if(document.getElementById('os-risco-'+i)) document.getElementById('os-risco-'+i).checked = true; });
        // EPIs Específicos
        [5, 6, 7].forEach(i => { if(document.getElementById('os-epi-'+i)) document.getElementById('os-epi-'+i).checked = true; });
    }
    else if(fUpper.includes('OPERADOR') || fUpper.includes('MANGOTEIRO')) {
        atividades = `- Operar equipamentos pesados de obra (retroescavadeira, perfuratriz, caminhão munck) seguindo normas de segurança.
- Executar checklist visual e mecânico de pré-operação da máquina diariamente.
- Sinalizar a área de operação e verificar a ausência de pedestres no raio de ação.`;
        // Riscos Específicos
        [0, 7, 10, 12, 15].forEach(i => { if(document.getElementById('os-risco-'+i)) document.getElementById('os-risco-'+i).checked = true; });
        // EPIs Específicos
        [1, 3, 6, 13].forEach(i => { if(document.getElementById('os-epi-'+i)) document.getElementById('os-epi-'+i).checked = true; });
    }
    else if(fUpper.includes('SONDADOR') || fUpper.includes('INJETOR') || fUpper.includes('PROTENDEDOR')) {
        atividades = `- Operar equipamentos de sondagem e injeção de calda de cimento no solo para fundações.
- Manusear e acoplar hastes de perfuração, trados e revestimentos metálicos.
- Executar a limpeza do equipamento de injeção e monitorar pressões da bomba.`;
        // Riscos Específicos
        [0, 1, 5, 10, 15].forEach(i => { if(document.getElementById('os-risco-'+i)) document.getElementById('os-risco-'+i).checked = true; });
        // EPIs Específicos
        [3, 6, 8, 13, 14].forEach(i => { if(document.getElementById('os-epi-'+i)) document.getElementById('os-epi-'+i).checked = true; });
    }
    else if(fUpper.includes('TOPOGRAFIA') || fUpper.includes('AGRIMENSURA')) {
        atividades = `- Realizar o levantamento planialtimétrico do terreno de obras utilizando estação total, GPS ou nível ótico.
- Implantar gabaritos, eixos de construção e níveis de referência.
- Percorrer frentes de serviço para conferência de locação e as-built.`;
        // Riscos Específicos
        [2, 6, 7, 11].forEach(i => { if(document.getElementById('os-risco-'+i)) document.getElementById('os-risco-'+i).checked = true; });
        // EPIs Específicos
        [1, 12].forEach(i => { if(document.getElementById('os-epi-'+i)) document.getElementById('os-epi-'+i).checked = true; });
    }
    else if(fUpper.includes('PINTOR')) {
        atividades = `- Realizar pintura em alvenarias, metais e madeiras usando tintas, vernizes e esmaltes.
- Preparar tintas, diluentes, seladores, bem como realizar o lixamento e massa corrida.
- Operar compressores de ar comprimido e pistolas de pintura (Airless).`;
        // Riscos Específicos
        [1, 5, 9, 10].forEach(i => { if(document.getElementById('os-risco-'+i)) document.getElementById('os-risco-'+i).checked = true; });
        // EPIs Específicos
        [1, 3, 7, 11].forEach(i => { if(document.getElementById('os-epi-'+i)) document.getElementById('os-epi-'+i).checked = true; });
    }
    else if(fUpper.includes('CONCRETISTA') || fUpper.includes('IMPERMEABILIZADOR')) {
        atividades = `- Realizar o lançamento, espalhamento, adensamento e vibração do concreto em estruturas.
- Manusear mangotes de bomba de concreto e operar vibradores de imersão.
- Realizar o sarrafeamento, desempeno e cura química do concreto lançado.`;
        // Riscos Específicos
        [5, 7, 9, 15].forEach(i => { if(document.getElementById('os-risco-'+i)) document.getElementById('os-risco-'+i).checked = true; });
        // EPIs Específicos
        [3, 7, 8, 13].forEach(i => { if(document.getElementById('os-epi-'+i)) document.getElementById('os-epi-'+i).checked = true; });
    }
    else if(fUpper.includes('ENCARREGADO') || fUpper.includes('LIDER') || fUpper.includes('SUPERVISOR')) {
        atividades = `- Distribuir, coordenar e fiscalizar as equipes nas frentes de serviços operacionais.
- Garantir que o trabalho siga os projetos técnicos e os padrões de qualidade da obra.
- Monitorar e exigir o uso obrigatório de EPIs e EPCs pela sua equipe e reportar anomalias.`;
        // Riscos Específicos
        [4, 5, 7].forEach(i => { if(document.getElementById('os-risco-'+i)) document.getElementById('os-risco-'+i).checked = true; });
        // EPIs Específicos
        [0, 1, 2, 6].forEach(i => { if(document.getElementById('os-epi-'+i)) document.getElementById('os-epi-'+i).checked = true; });
    }
    else if(fUpper.includes('VIGIA') || fUpper.includes('APONTADOR')) {
        atividades = `- Realizar controle de acesso de pedestres, materiais e veículos nas portarias do canteiro.
- Fiscalizar e realizar rondas para prevenção de furtos, danos e incêndios.
- Reportar condições de risco à segurança patrimonial ou do trabalho de imediato.`;
        // Riscos Específicos
        [2, 3, 4, 11].forEach(i => { if(document.getElementById('os-risco-'+i)) document.getElementById('os-risco-'+i).checked = true; });
        // EPIs Específicos
        [0, 1, 2, 4, 12].forEach(i => { if(document.getElementById('os-epi-'+i)) document.getElementById('os-epi-'+i).checked = true; });
    }
    else {
        // Fallback dinâmico para funções cadastradas que não têm template
        atividades = `- Executar as atividades inerentes à função de ${funcao}.
- Seguir os procedimentos de segurança específicos orientados pelo SESMT / Encarregado.
- Utilizar os EPIs corretamente e zelar pelas ferramentas de trabalho.`;
        // Exibir aviso apenas se não estiver em processo de auto-preenchimento
        setTimeout(() => alert(`⚠️ A função "${funcao}" foi carregada com um padrão BÁSICO.\n\nComo é uma função não padronizada, sugerimos que o Técnico de Segurança preencha manualmente os detalhes dos riscos e atividades antes da impressão.`), 500);
    }

    document.getElementById('os-atividades').value = atividades;
    document.getElementById('os-medidas').value = medidas;
}

function osLimpar() {
    if (confirm('Limpar todo o formulário de OS?')) renderizarFormOS();
}

function osImprimir() {
    const form = document.getElementById('os-form');
    
    // Serializar valores para impressão
    const dateEmptys = [];
    form.querySelectorAll('input:not([type="checkbox"])').forEach(el => {
        if ((el.type === 'date' || el.type === 'time') && !el.value) {
            dateEmptys.push({ el: el, oldType: el.getAttribute('type') });
            el.setAttribute('type', 'text');
        }
        el.setAttribute('value', el.value || '');
    });
    form.querySelectorAll('textarea').forEach(el => {
        el.innerHTML = el.value;
    });

    const conteudo = form.innerHTML;
    
    // Restaurar tipos
    dateEmptys.forEach(item => {
        item.el.setAttribute('type', item.oldType);
    });

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    
    const w = iframe.contentWindow;
    w.document.open();
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ordem de Serviço</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:12px;margin:15px; color:#000;}
      table{width:100%;border-collapse:collapse;margin-bottom:8px; page-break-inside: avoid;}
      td,th{border:1px solid #000;padding:5px 8px;vertical-align:top;}
      h2{text-align:center;font-size:16px;background:#333 !important;color:#fff !important;padding:8px;border-radius:4px; -webkit-print-color-adjust:exact; color-adjust:exact;}
      .os-section-title{background:#eee !important;font-weight:bold;text-align:center;text-transform:uppercase; -webkit-print-color-adjust:exact; color-adjust:exact;}
      input,textarea{width:100%;border:none;border-bottom:1px solid #999;font-size:12px;font-family:inherit;background:transparent;}
      textarea{resize:none;overflow:visible; height:auto;}
      
      /* Estilo EXATO da Grade no Print */
      #os-lista-riscos, #os-lista-epis {
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
          gap: 5px !important;
      }
      .os-check-item {
          display: flex !important;
          align-items: flex-start !important;
          margin-bottom: 2px !important;
          font-size: 10px !important;
          line-height: 1.2;
      }
      /* Visual fake checkbox p/ impressão garantida */
      .print-chk {
          width: 10px; height: 10px;
          border: 1px solid #333;
          display: inline-flex; align-items: center; justify-content: center;
          margin-right: 5px; margin-top: 1px;
          font-weight: bold; font-size: 10px;
          flex-shrink: 0;
          -webkit-print-color-adjust:exact; print-color-adjust:exact;
      }
      .print-chk.checked {
          background-color: #0078d7 !important;
          border-color: #0078d7 !important;
          color: white !important;
      }
      .os-btn-print,.os-btn-limpar,.os-btn-template,.os-btn-config, strong{display:none !important;} 
      div[style*="margin-bottom:10px; display:flex"] { display:none !important; }
      #os-config-modal { display:none !important; }
      .os-sign-box{border-bottom:1px solid #000;height:40px;margin-top:20px;}
      tr { page-break-inside: avoid; }
      @page{margin:0;}
      body{padding:15mm;}
      .os-header-impr { display:flex !important; align-items:center !important; border:1px solid #333; padding:5px; margin-bottom:10px; }
      .os-header-logo { height: 50px !important; width: auto !important; max-width:180px !important; object-fit: contain; margin-right:15px; }
      .os-header-title { flex:1; text-align:center; font-weight:bold; font-size:14px; padding:10px; background: #1a3a5c !important; color:#fff !important; -webkit-print-color-adjust:exact; print-color-adjust:exact;}
      .os-print-break { page-break-before: always !important; }
      ::placeholder { color: transparent !important; opacity: 0 !important; }
    </style></head><body>${conteudo}</body></html>`);
    
    w.document.close();

    // CONVERTER TEXTAREAS EM DIVS DE TEXTO FLUIDO PARA IMPRESSÃO (EVITA ESPAÇOS BRANCOS BIZARROS)
    const tas = w.document.querySelectorAll('textarea');
    tas.forEach(ta => {
        const div = w.document.createElement('div');
        div.style.whiteSpace = 'pre-wrap';
        div.style.fontSize = '12px';
        div.style.fontFamily = 'Arial, sans-serif';
        div.style.padding = '5px 0';
        div.style.minHeight = '20px';
        div.textContent = ta.value;
        ta.parentNode.replaceChild(div, ta);
    });

    // CONVERTER CHECKBOXES REAIS EM VISUAIS ESTILIZADOS (GARANTE A BELEZA DO SISTEMA NA IMPRESSÃO)
    const items = w.document.querySelectorAll('.os-check-item');
    items.forEach(item => {
        const inp = item.querySelector('input');
        const lbl = item.querySelector('label');
        if(inp && lbl) {
            const checked = inp.checked;
            const labelTxt = lbl.textContent || lbl.innerText;
            
            // Monta a nova visualização: um box quadrado preenchido (ou não) e o label
            const newHTML = `
                <div class="print-chk ${checked ? 'checked' : ''}">${checked ? '✓' : ''}</div>
                <span>${labelTxt}</span>
            `;
            item.innerHTML = newHTML;
        }
    });

    setTimeout(()=>{
        w.focus();
        w.print();
        setTimeout(() => document.body.removeChild(iframe), 2000);
    }, 600);
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    renderizarFormOS();
});

function osAbrirConfig() {
    document.getElementById('os-config-modal').style.display = 'flex';
}

function osPreviewLogo(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('os-cfg-preview-logo').src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function osSalvarConfig() {
    const logoSrc = document.getElementById('os-cfg-preview-logo').src;
    const config = {
        empresa: document.getElementById('os-cfg-empresa').value || 'Construtora HOSS Ltda.',
        instrutor: document.getElementById('os-cfg-instrutor').value || 'Ervanio F Rodrigues',
        logo: logoSrc.startsWith('data:image') ? logoSrc : '/Logo-Hoss.jpg'
    };
    localStorage.setItem('os-config', JSON.stringify(config));
    document.getElementById('os-config-modal').style.display = 'none';
    renderizarFormOS(); // Re-renderiza para aplicar as mudanças visuais
}

// Vincula ao escopo do sistema se existir
if (typeof SysControleWeb !== 'undefined') {
    SysControleWeb.prototype.abrirOrdemDeServico = function() {
        const nome = document.getElementById('nome') ? document.getElementById('nome').value : '';
        const empresa = document.getElementById('empresa') ? document.getElementById('empresa').value : '';
        const funcao = document.getElementById('funcao') ? document.getElementById('funcao').value : '';

        if (!nome) {
            alert('Por favor, selecione um funcionário primeiro.');
            return;
        }

        // Abrir janela de formulários sem limpar os dados
        if(this.abrirFormularios) {
            this.abrirFormularios(true);
        }
        
        // Mudar para a aba OS
        if(this.trocarAbaFormulario) {
            this.trocarAbaFormulario('os');
        }

        // Preencher e carregar o padrão
        setTimeout(() => {
            const elNome = document.getElementById('os-nome');
            const elSetor = document.getElementById('os-setor');
            const selectFuncao = document.querySelector('.os-input[onchange*="osCarregarTemplate"]');
            
            if (elNome) elNome.value = nome;
            if (elSetor) elSetor.value = empresa;
            
            if (selectFuncao && funcao) {
                // Tenta achar a função no select (case-insensitive)
                let match = false;
                for (let opt of selectFuncao.options) {
                    if (opt.value.toUpperCase() === funcao.toUpperCase()) {
                        selectFuncao.value = opt.value;
                        osCarregarTemplate(opt.value);
                        selectFuncao.value = ''; // Reseta pra ficar igual ao select original
                        match = true;
                        break;
                    }
                }
                
                // Se não achar (função totalmente nova), chama com a string enviada
                // Isso acionará o "fallback" genérico no osCarregarTemplate
                if (!match) {
                    osCarregarTemplate(funcao);
                }
            }
        }, 300);
    };
}
