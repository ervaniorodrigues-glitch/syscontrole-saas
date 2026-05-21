// ===== CONFIGURAÇÃO E CERTIFICADOS NR =====

function abrirConfiguracaoCert() {
    const mem = JSON.parse(localStorage.getItem('cert_nr_mem') || '{}');
    document.getElementById('cfg_numero').value           = mem.numero || '';
    document.getElementById('cfg_instrutor').value        = mem.instrutor || '';
    document.getElementById('cfg_cargo_instrutor').value  = mem.cargo_instrutor || '';
    document.getElementById('cfg_reg_instrutor').value    = mem.reg_instrutor || '';
    document.getElementById('cfg_responsavel').value      = mem.responsavel || '';
    document.getElementById('cfg_cargo_resp').value       = mem.cargo_resp || '';
    document.getElementById('cfg_reg_resp').value         = mem.reg_resp || '';
    document.getElementById('cfg_local').value            = mem.local || '';
    document.getElementById('cfg_uf').value               = mem.uf || 'SP';
    document.getElementById('modalConfiguracaoCert').style.display = 'block';
}

function salvarConfiguracaoCert() {
    localStorage.setItem('cert_nr_mem', JSON.stringify({
        numero:          document.getElementById('cfg_numero').value,
        instrutor:       document.getElementById('cfg_instrutor').value,
        cargo_instrutor: document.getElementById('cfg_cargo_instrutor').value,
        reg_instrutor:   document.getElementById('cfg_reg_instrutor').value,
        responsavel:     document.getElementById('cfg_responsavel').value,
        cargo_resp:      document.getElementById('cfg_cargo_resp').value,
        reg_resp:        document.getElementById('cfg_reg_resp').value,
        local:           document.getElementById('cfg_local').value,
        uf:              document.getElementById('cfg_uf').value
    }));
    document.getElementById('modalConfiguracaoCert').style.display = 'none';
    if (window.syscontrole) syscontrole.showToast('Configuração salva!', 'success');
}

// Ctrl+P abre janela de impressão do certificado ativo
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'p') {
        const preview = document.getElementById('cert06_preview');
        if (preview && document.getElementById('modalCertificadoNR06').style.display === 'block') {
            e.preventDefault();
            const conteudo = preview.innerHTML;
            const janela = window.open('', '_blank');
            janela.document.write('<html><head><title>Certificado NR-06</title><style>body{margin:20px;font-family:"Times New Roman",serif;}@media print{body{margin:0;}}</style></head><body>' + conteudo + '</body></html>');
            janela.document.close();
            setTimeout(() => { janela.print(); }, 400);
        }
    }
});
