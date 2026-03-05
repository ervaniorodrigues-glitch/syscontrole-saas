// Histórico de Pesquisa Simples
// Salva termos digitados e mostra sugestões ao digitar

class SearchHistory {
    constructor() {
        this.storageKey = 'syscontrole_historico_pesquisa';
        this.data = this.load();
    }
    
    // Obter mês/ano atual
    getMesAno() {
        const agora = new Date();
        return `${agora.getMonth() + 1}-${agora.getFullYear()}`;
    }
    
    // Carregar histórico do LocalStorage
    load() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (!saved) {
                return this.createEmpty();
            }
            
            const data = JSON.parse(saved);
            
            // Verificar se mudou o mês - limpar se mudou
            if (data.mesAno !== this.getMesAno()) {
                console.log('🗑️ Virada de mês - limpando histórico');
                return this.createEmpty();
            }
            
            return data;
        } catch (err) {
            console.error('Erro ao carregar histórico:', err);
            return this.createEmpty();
        }
    }
    
    // Criar estrutura vazia
    createEmpty() {
        return {
            mesAno: this.getMesAno(),
            nome: [],
            empresa: [],
            funcao: []
        };
    }
    
    // Salvar no LocalStorage
    save() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.data));
        } catch (err) {
            console.error('Erro ao salvar histórico:', err);
        }
    }
    
    // Remover termo do histórico
    removeTerm(campo, termo) {
        if (!this.data[campo]) return;
        
        // Filtrar removendo o termo (case insensitive)
        this.data[campo] = this.data[campo].filter(t => 
            t.toLowerCase() !== termo.toLowerCase()
        );
        
        this.save();
    }
    
    // Adicionar termo ao histórico
    addTerm(campo, termo) {
        // Validar
        if (!termo || typeof termo !== 'string') return;
        termo = termo.trim();
        if (!termo) return;
        
        // Verificar se campo existe
        if (!this.data[campo]) {
            this.data[campo] = [];
        }
        
        // Verificar se já existe (case insensitive)
        const existe = this.data[campo].find(t => 
            t.toLowerCase() === termo.toLowerCase()
        );
        
        if (!existe) {
            // Adicionar no início (mais recente primeiro)
            this.data[campo].unshift(termo);
            
            // Limitar a 50 termos
            if (this.data[campo].length > 50) {
                this.data[campo] = this.data[campo].slice(0, 50);
            }
            
            this.save();
        }
    }
    
    // Buscar sugestões
    getSuggestions(campo, query) {
        if (!query || !this.data[campo]) return [];
        
        query = query.toLowerCase().trim();
        if (!query) return [];
        
        // Filtrar termos que contêm a query
        return this.data[campo].filter(termo => 
            termo.toLowerCase().includes(query)
        );
    }
    
    // Limpar histórico
    clear() {
        this.data = this.createEmpty();
        this.save();
    }
}

// Componente de Autocomplete
class AutocompleteUI {
    constructor(inputElement, campo, searchHistory) {
        this.input = inputElement;
        this.campo = campo;
        this.history = searchHistory;
        this.listElement = null;
        this.selectedIndex = -1;
        
        this.init();
    }
    
    init() {
        // Criar elemento da lista
        this.listElement = document.createElement('div');
        this.listElement.className = 'autocomplete-list';
        this.listElement.style.display = 'none';
        
        // Inserir após o input
        this.input.parentNode.style.position = 'relative';
        this.input.parentNode.appendChild(this.listElement);
        
        // Eventos
        this.input.addEventListener('input', () => this.onInput());
        this.input.addEventListener('keydown', (e) => this.onKeyDown(e));
        this.input.addEventListener('blur', () => {
            // Delay para permitir clique na sugestão
            setTimeout(() => this.hide(), 200);
        });
        
        // Salvar termo APENAS quando pressionar Enter
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const termo = this.input.value.trim();
                if (termo) {
                    this.history.addTerm(this.campo, termo);
                }
            }
        });
    }
    
    onInput() {
        const query = this.input.value;
        
        if (!query || query.length < 1) {
            this.hide();
            return;
        }
        
        const suggestions = this.history.getSuggestions(this.campo, query);
        
        if (suggestions.length === 0) {
            this.hide();
            return;
        }
        
        this.show(suggestions);
    }
    
    show(suggestions) {
        this.listElement.innerHTML = '';
        this.selectedIndex = -1;
        
        suggestions.forEach((termo, index) => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            
            // Texto do termo
            const text = document.createElement('span');
            text.className = 'autocomplete-text';
            text.textContent = termo;
            
            // Botão X para remover
            const btnRemove = document.createElement('button');
            btnRemove.className = 'autocomplete-remove';
            btnRemove.innerHTML = '×';
            btnRemove.title = 'Remover do histórico';
            
            // Evento do botão X
            btnRemove.addEventListener('click', (e) => {
                e.stopPropagation();
                this.history.removeTerm(this.campo, termo);
                // Atualizar lista
                const query = this.input.value;
                const newSuggestions = this.history.getSuggestions(this.campo, query);
                if (newSuggestions.length > 0) {
                    this.show(newSuggestions);
                } else {
                    this.hide();
                }
            });
            
            // Evento de clique no item
            text.addEventListener('click', () => {
                this.input.value = termo;
                this.history.addTerm(this.campo, termo);
                this.hide();
                this.input.focus();
            });
            
            item.appendChild(text);
            item.appendChild(btnRemove);
            this.listElement.appendChild(item);
        });
        
        this.listElement.style.display = 'block';
    }
    
    hide() {
        this.listElement.style.display = 'none';
        this.selectedIndex = -1;
    }
    
    onKeyDown(e) {
        const items = this.listElement.querySelectorAll('.autocomplete-item');
        
        if (items.length === 0) return;
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.selectedIndex = Math.min(this.selectedIndex + 1, items.length - 1);
            this.updateSelection(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
            this.updateSelection(items);
        } else if (e.key === 'Enter' && this.selectedIndex >= 0) {
            e.preventDefault();
            const termo = items[this.selectedIndex].querySelector('.autocomplete-text').textContent;
            this.input.value = termo;
            this.history.addTerm(this.campo, termo);
            this.hide();
        } else if (e.key === 'Escape') {
            this.hide();
        }
    }
    
    updateSelection(items) {
        items.forEach((item, index) => {
            if (index === this.selectedIndex) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }
}

// Inicializar automaticamente quando o DOM estiver pronto
if (typeof window !== 'undefined') {
    window.SearchHistory = SearchHistory;
    window.AutocompleteUI = AutocompleteUI;
}
