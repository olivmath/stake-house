// Configurações dos Contratos Stellar
const STELLAR_CONFIG = {
    NETWORK: 'testnet',
    HORIZON_URL: 'https://horizon-testnet.stellar.org',
    FUNGIBLE_CONTRACT_ID: 'CCSZ3PUWNPFQNERNJVQUVY4LB42VRLCAQZCJZE6LUILHSJO7AYF45NMI',
    STAKE_HOUSE_CONTRACT_ID: 'CAYTL7YU3XCI46HSJQSJSD3DPHX525NJCP6CZUKQJ2B7KOMOIYANIAWO',
    ADMIN_PUBLIC_KEY: 'GBB7GMUFUCEJHUOIMD3GFC7IPK4O43ZCTAEOIAWE6I34B2TLVB5M373I'
};

// Stellar Wallet Generator - Aplicação Simplificada
class StellarWalletApp {
    constructor() {
        this.investorWallet = null;
        this.userWallets = [];
        this.maxUsers = 4;
        this.registeredUsers = 0;
        this.server = null;
        this.init();
    }

    init() {
        this.initializeStellarSDK();
        this.setupEventListeners();
        this.generateInvestorWalletAutomatically();
        this.generateAllUserWalletsAutomatically();
        this.updateCounters();
    }

    initializeStellarSDK() {
        try {
            // Configurar rede Stellar
            StellarSdk.Networks.TESTNET;
            this.server = new StellarSdk.Horizon.Server(STELLAR_CONFIG.HORIZON_URL);
            console.log('Stellar SDK inicializado com sucesso');
        } catch (error) {
            console.error('Erro ao inicializar Stellar SDK:', error);
        }
    }

    // Função centralizada para gerar carteiras com faucet automático
    async generateWalletWithFaucet(walletType, userId = null) {
        try {
            // Gerar carteira usando Stellar SDK
            const keypair = StellarSdk.Keypair.random();
            
            // Criar objeto da carteira
            const wallet = {
                type: walletType,
                publicKey: keypair.publicKey(),
                secretKey: keypair.secret(),
                createdAt: new Date().toLocaleString('pt-BR')
            };

            // Fazer faucet (financiar conta na testnet)
            await this.fundAccountWithFaucet(keypair.publicKey());

            console.log(`Carteira ${walletType} gerada e financiada com sucesso`);
            return { wallet, keypair };
        } catch (error) {
            console.error(`Erro ao gerar carteira ${walletType}:`, error);
            throw error;
        }
    }

    // Função para financiar conta usando o faucet da testnet
    async fundAccountWithFaucet(publicKey) {
        try {
            const response = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
            if (!response.ok) {
                throw new Error(`Erro no faucet: ${response.status}`);
            }
            console.log(`Conta ${publicKey} financiada com sucesso via faucet`);
            return await response.json();
        } catch (error) {
            console.error('Erro ao financiar conta:', error);
            throw error;
        }
    }

    // Método para interagir com o contrato fungible
    async callFungibleContract(method, params, sourceKeypair) {
        try {
            const contract = new StellarSdk.Contract(STELLAR_CONFIG.FUNGIBLE_CONTRACT_ID);
            const sourceAccount = await this.server.loadAccount(sourceKeypair.publicKey());
            
            let operation;
            
            switch (method) {
                case 'mint':
                    operation = contract.call('mint', 
                        StellarSdk.Address.fromString(params.to),
                        StellarSdk.nativeToScVal(params.amount, { type: 'i128' })
                    );
                    break;
                case 'transfer':
                    operation = contract.call('transfer',
                        StellarSdk.Address.fromString(params.from),
                        StellarSdk.Address.fromString(params.to),
                        StellarSdk.nativeToScVal(params.amount, { type: 'i128' })
                    );
                    break;
                case 'balance':
                    operation = contract.call('balance',
                        StellarSdk.Address.fromString(params.address)
                    );
                    break;
                default:
                    throw new Error(`Método ${method} não suportado`);
            }

            const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
                fee: StellarSdk.BASE_FEE,
                networkPassphrase: StellarSdk.Networks.TESTNET
            })
            .addOperation(operation)
            .setTimeout(30)
            .build();

            transaction.sign(sourceKeypair);
            
            const result = await this.server.submitTransaction(transaction);
            return result;
        } catch (error) {
            console.error('Erro ao chamar contrato fungible:', error);
            throw error;
        }
    }

    // Método para interagir com o contrato stake-house
    async callStakeHouseContract(method, params, sourceKeypair) {
        try {
            const contract = new StellarSdk.Contract(STELLAR_CONFIG.STAKE_HOUSE_CONTRACT_ID);
            const sourceAccount = await this.server.loadAccount(sourceKeypair.publicKey());
            
            let operation;
            
            switch (method) {
                case 'deposit':
                    operation = contract.call('deposit',
                        StellarSdk.Address.fromString(params.from),
                        StellarSdk.nativeToScVal(params.amount, { type: 'i128' })
                    );
                    break;
                case 'join':
                    operation = contract.call('join',
                        StellarSdk.Address.fromString(params.user)
                    );
                    break;
                case 'get_balance':
                    operation = contract.call('get_balance');
                    break;
                case 'get_users':
                    operation = contract.call('get_users');
                    break;
                default:
                    throw new Error(`Método ${method} não suportado`);
            }

            const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
                fee: StellarSdk.BASE_FEE,
                networkPassphrase: StellarSdk.Networks.TESTNET
            })
            .addOperation(operation)
            .setTimeout(30)
            .build();

            transaction.sign(sourceKeypair);
            
            const result = await this.server.submitTransaction(transaction);
            return result;
        } catch (error) {
            console.error('Erro ao chamar contrato stake-house:', error);
            throw error;
        }
    }

    setupEventListeners() {
        // Botão de depósito
        const depositBtn = document.getElementById('deposit-btn');
        if (depositBtn) {
            depositBtn.addEventListener('click', () => this.makeDeposit());
        }

        // Input de valor do depósito
        const depositAmount = document.getElementById('deposit-amount');
        if (depositAmount) {
            depositAmount.addEventListener('input', () => this.validateDepositAmount());
        }

        // Botões dos usuários (apenas join e reset, não mais generate)
        for (let i = 1; i <= this.maxUsers; i++) {
            const joinBtn = document.getElementById(`join-user-${i}`);
            if (joinBtn) {
                joinBtn.addEventListener('click', () => this.joinAirdrop(i));
            }

            const resetBtn = document.getElementById(`reset-user-${i}`);
            if (resetBtn) {
                resetBtn.addEventListener('click', () => this.resetUserWallet(i));
            }
        }

        // Event listeners para botões de copiar
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-copy')) {
                this.copyToClipboard(e.target);
            }
        });
    }

    generateAllUserWalletsAutomatically() {
        try {
            // Gerar carteiras para todos os 4 usuários
            for (let userId = 1; userId <= 4; userId++) {
                this.generateUserWalletAutomatically(userId);
            }
        } catch (error) {
            console.error('Erro ao gerar carteiras dos usuários:', error);
        }
    }

    generateUserWalletAutomatically(userId) {
        try {
            const walletInfo = document.getElementById(`user-${userId}-wallet-info`);
            const resetBtn = document.getElementById(`reset-user-${userId}`);
            
            // Gerar carteira usando Stellar SDK
            const keypair = StellarSdk.Keypair.random();
            const wallet = {
                type: `Usuário ${userId}`,
                publicKey: keypair.publicKey(),
                secretKey: keypair.secret(),
                createdAt: new Date().toLocaleString('pt-BR')
            };
            
            this.userWallets[userId - 1] = wallet;
            this.displayWalletInfo(walletInfo, wallet);
            
            // Mostrar botão de reset e join
            if (resetBtn) {
                resetBtn.classList.remove('hidden');
            }
            this.enableJoinButton(userId);
            
            console.log(`Carteira do usuário ${userId} gerada automaticamente`);
        } catch (error) {
            console.error(`Erro ao gerar carteira do usuário ${userId}:`, error);
        }
    }

    generateInvestorWalletAutomatically() {
        const walletInfo = document.getElementById('investor-wallet-info');
        
        try {
            // Gerar carteira usando Stellar SDK
            const keypair = StellarSdk.Keypair.random();
            const wallet = {
                type: 'Investidor',
                publicKey: keypair.publicKey(),
                secretKey: keypair.secret(),
                createdAt: new Date().toLocaleString('pt-BR')
            };
            
            this.investorWallet = wallet;
            this.displayWalletInfo(walletInfo, wallet);
            this.updateCounters();
            this.enableDepositSection();
            
            this.showNotification('Carteira do investidor gerada automaticamente!');
        } catch (error) {
            console.error('Erro ao gerar carteira do investidor:', error);
            this.showNotification('Erro ao gerar carteira', 'error');
        }
    }

    generateInvestorWallet() {
        const btn = document.getElementById('generate-investor');
        const walletInfo = document.getElementById('investor-wallet-info');
        
        this.setLoading(btn, true);
        
        try {
            // Gerar carteira usando Stellar SDK
            const keypair = StellarSdk.Keypair.random();
            const wallet = {
                type: 'Investidor',
                publicKey: keypair.publicKey(),
                secretKey: keypair.secret(),
                createdAt: new Date().toLocaleString('pt-BR')
            };
            
            this.investorWallet = wallet;
            this.displayWalletInfo(walletInfo, wallet);
            this.updateCounters();
            this.enableDepositSection();
            
            this.showNotification('Carteira do investidor gerada com sucesso!');
        } catch (error) {
            console.error('Erro ao gerar carteira do investidor:', error);
            this.showNotification('Erro ao gerar carteira', 'error');
        } finally {
            this.setLoading(btn, false);
        }
    }

    enableDepositSection() {
        const depositBtn = document.getElementById('deposit-btn');
        if (depositBtn && this.investorWallet) {
            this.validateDepositAmount();
        }
    }

    validateDepositAmount() {
        const depositAmount = document.getElementById('deposit-amount');
        const depositBtn = document.getElementById('deposit-btn');
        
        if (depositAmount && depositBtn && this.investorWallet) {
            const amount = parseFloat(depositAmount.value);
            depositBtn.disabled = !amount || amount <= 0;
        }
    }

    async makeDeposit() {
        const depositAmount = document.getElementById('deposit-amount');
        const depositStatus = document.getElementById('deposit-status');
        const depositBtn = document.getElementById('deposit-btn');
        
        if (!this.investorWallet) {
            this.showStatusMessage(depositStatus, 'Gere uma carteira primeiro', 'error');
            return;
        }

        const amount = parseFloat(depositAmount.value);
        if (!amount || amount <= 0) {
            this.showStatusMessage(depositStatus, 'Digite um valor válido', 'error');
            return;
        }

        this.setLoading(depositBtn, true);
        this.showStatusMessage(depositStatus, 'Processando depósito...', 'loading');

        try {
            // Criar keypair a partir da secret key do investidor
            const investorKeypair = StellarSdk.Keypair.fromSecret(this.investorWallet.secretKey);
            
            // Primeiro, vamos verificar se a conta tem fundos suficientes
            // Em um ambiente real, você precisaria ter tokens fungible primeiro
            
            // Chamar o método deposit do contrato stake-house
            const result = await this.callStakeHouseContract('deposit', {
                from: this.investorWallet.publicKey,
                amount: Math.floor(amount * 10000000) // Converter para stroops (7 casas decimais)
            }, investorKeypair);
            
            console.log('Resultado do depósito:', result);
            
            this.showStatusMessage(depositStatus, `Depósito de ${amount} tokens realizado com sucesso!`, 'success');
            depositAmount.value = '';
            this.validateDepositAmount();
            
            this.showNotification(`Depósito de ${amount} tokens realizado!`);
        } catch (error) {
            console.error('Erro no depósito:', error);
            let errorMessage = 'Erro ao realizar depósito';
            
            if (error.message.includes('account not found')) {
                errorMessage = 'Conta não encontrada. Certifique-se de que a conta tem fundos XLM.';
            } else if (error.message.includes('insufficient funds')) {
                errorMessage = 'Fundos insuficientes na conta.';
            }
            
            this.showStatusMessage(depositStatus, errorMessage, 'error');
            this.showNotification(errorMessage, 'error');
        } finally {
            this.setLoading(depositBtn, false);
        }
    }

    showStatusMessage(container, message, type) {
        if (container) {
            container.textContent = message;
            container.className = `status-message ${type}`;
        }
    }

    generateUserWallet(userId) {
        const btn = document.getElementById(`generate-user-${userId}`);
        const walletInfo = document.getElementById(`user-${userId}-wallet-info`);
        const resetBtn = document.getElementById(`reset-user-${userId}`);
        
        this.setLoading(btn, true);
        
        try {
            // Gerar carteira usando Stellar SDK
            const keypair = StellarSdk.Keypair.random();
            const wallet = {
                type: `Usuário ${userId}`,
                publicKey: keypair.publicKey(),
                secretKey: keypair.secret(),
                createdAt: new Date().toLocaleString('pt-BR')
            };
            
            this.userWallets[userId - 1] = wallet;
            this.displayWalletInfo(walletInfo, wallet);
            
            // Mostrar botão de reset e join
            resetBtn.classList.remove('hidden');
            this.enableJoinButton(userId);
            
            this.updateCounters();
            this.showNotification(`Carteira do usuário ${userId} gerada com sucesso!`);
        } catch (error) {
            console.error(`Erro ao gerar carteira do usuário ${userId}:`, error);
            this.showNotification('Erro ao gerar carteira', 'error');
        } finally {
            this.setLoading(btn, false);
        }
    }

    enableJoinButton(userId) {
        const joinBtn = document.getElementById(`join-user-${userId}`);
        if (joinBtn && this.userWallets[userId - 1]) {
            joinBtn.classList.remove('hidden');
            joinBtn.disabled = false;
        }
    }

    async joinAirdrop(userId) {
        const joinBtn = document.getElementById(`join-user-${userId}`);
        const joinStatus = document.getElementById(`join-status-${userId}`);
        const wallet = this.userWallets[userId - 1];
        
        if (!wallet) {
            this.showStatusMessage(joinStatus, 'Gere uma carteira primeiro', 'error');
            return;
        }

        this.setLoading(joinBtn, true);
        this.showStatusMessage(joinStatus, 'Registrando para o airdrop...', 'loading');

        try {
            // Criar keypair a partir da secret key do usuário
            const userKeypair = StellarSdk.Keypair.fromSecret(wallet.secretKey);
            
            // Chamar o método join do contrato stake-house
            const result = await this.callStakeHouseContract('join', {
                user: wallet.publicKey
            }, userKeypair);
            
            console.log('Resultado do join:', result);
            
            this.registeredUsers++;
            joinBtn.disabled = true;
            joinBtn.textContent = 'Registrado ✓';
            joinBtn.classList.add('btn-success');
            joinBtn.classList.remove('btn-join');
            
            this.showStatusMessage(joinStatus, 'Registrado com sucesso para o airdrop!', 'success');
            this.updateCounters();
            
            this.showNotification(`Usuário ${userId} registrado para o airdrop!`);
        } catch (error) {
            console.error('Erro no registro:', error);
            let errorMessage = 'Erro ao registrar para o airdrop';
            
            if (error.message.includes('account not found')) {
                errorMessage = 'Conta não encontrada. Certifique-se de que a conta tem fundos XLM.';
            } else if (error.message.includes('already registered')) {
                errorMessage = 'Usuário já está registrado no airdrop.';
            }
            
            this.showStatusMessage(joinStatus, errorMessage, 'error');
            this.showNotification(errorMessage, 'error');
        } finally {
            this.setLoading(joinBtn, false);
        }
    }

    resetUserWallet(userId) {
        const walletInfo = document.getElementById(`user-${userId}-wallet-info`);
        const resetBtn = document.getElementById(`reset-user-${userId}`);
        const joinBtn = document.getElementById(`join-user-${userId}`);
        const joinStatus = document.getElementById(`join-status-${userId}`);
        
        // Verificar se o usuário estava registrado
        const wasRegistered = joinBtn && joinBtn.textContent.includes('✓');
        if (wasRegistered) {
            this.registeredUsers--;
        }
        
        this.userWallets[userId - 1] = null;
        walletInfo.classList.add('hidden');
        resetBtn.classList.add('hidden');
        
        // Reset join button
        if (joinBtn) {
            joinBtn.classList.add('hidden');
            joinBtn.disabled = true;
            joinBtn.textContent = 'Registrar para Airdrop';
            joinBtn.classList.remove('btn-success');
            joinBtn.classList.add('btn-join');
        }
        
        // Clear join status
        if (joinStatus) {
            joinStatus.textContent = '';
            joinStatus.className = 'status-message';
        }
        
        this.updateCounters();
        this.showNotification(`Carteira do usuário ${userId} removida`);
    }

    displayWalletInfo(container, wallet) {
        container.innerHTML = `
            <div class="key-group">
                <label>Chave Pública:</label>
                <div class="key-display">${wallet.publicKey}</div>
                <button class="btn btn-copy" data-copy="${wallet.publicKey}">
                    Copiar Chave Pública
                </button>
            </div>
            <div class="key-group">
                <label>Chave Secreta:</label>
                <div class="key-display">${wallet.secretKey}</div>
                <button class="btn btn-copy" data-copy="${wallet.secretKey}">
                    Copiar Chave Secreta
                </button>
            </div>
            <div class="key-group">
                <label>Criada em:</label>
                <div class="key-display">${wallet.createdAt}</div>
            </div>
        `;
        
        container.classList.remove('hidden');
    }

    copyToClipboard(button) {
        const textToCopy = button.getAttribute('data-copy');
        
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                this.showCopySuccess(button);
            }).catch(err => {
                console.error('Erro ao copiar:', err);
                this.fallbackCopy(textToCopy, button);
            });
        } else {
            this.fallbackCopy(textToCopy, button);
        }
    }

    fallbackCopy(text, button) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.showCopySuccess(button);
        } catch (err) {
            console.error('Erro no fallback de cópia:', err);
        } finally {
            document.body.removeChild(textArea);
        }
    }

    showCopySuccess(button) {
        const originalText = button.textContent;
        button.textContent = 'Copiado!';
        button.classList.add('success');
        
        setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove('success');
        }, 2000);
    }

    setLoading(button, isLoading) {
        if (isLoading) {
            button.disabled = true;
            button.textContent = 'Gerando...';
            button.classList.add('loading');
        } else {
            button.disabled = false;
            button.textContent = button.getAttribute('data-original-text') || 'Gerar Carteira';
            button.classList.remove('loading');
        }
    }

    updateCounters() {
        // Contador dos usuários
        const usersCounter = document.getElementById('users-counter');
        if (usersCounter) {
            const activeUsers = this.userWallets.filter(wallet => wallet !== null && wallet !== undefined).length;
            usersCounter.textContent = `${this.registeredUsers} de ${this.maxUsers} usuários registrados`;
        }
    }

    showNotification(message, type = 'success') {
        // Remove notificação existente
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        // Cria nova notificação
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        if (type === 'error') {
            notification.style.background = '#dc3545';
        }

        document.body.appendChild(notification);

        // Remove após 3 segundos
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }

    // Método para exportar dados (funcionalidade adicional)
    exportWallets() {
        const data = {
            investor: this.investorWallet,
            users: this.userWallets.filter(wallet => wallet !== null),
            exportedAt: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `stellar-wallets-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showNotification('Carteiras exportadas com sucesso!');
    }

    // Método para limpar todas as carteiras
    resetAll() {
        if (confirm('Tem certeza que deseja limpar todas as carteiras?')) {
            this.investorWallet = null;
            this.userWallets = [];
            
            // Esconder todas as informações de carteira
            const investorInfo = document.getElementById('investor-wallet-info');
            if (investorInfo) investorInfo.classList.add('hidden');
            
            for (let i = 1; i <= this.maxUsers; i++) {
                const userInfo = document.getElementById(`user-${i}-wallet-info`);
                const resetBtn = document.getElementById(`reset-user-${i}`);
                if (userInfo) userInfo.classList.add('hidden');
                if (resetBtn) resetBtn.classList.add('hidden');
            }
            
            this.updateCounters();
            this.showNotification('Todas as carteiras foram removidas');
        }
    }
}

// Inicializar aplicação quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    window.stellarApp = new StellarWalletApp();
    
    // Adicionar funcionalidades extras se necessário
    console.log('Stellar Wallet Generator iniciado com sucesso!');
    
    // Salvar referência original dos textos dos botões
    document.querySelectorAll('.btn-primary, .btn-user').forEach(btn => {
        btn.setAttribute('data-original-text', btn.textContent);
    });
});

// Função global para exportar (pode ser chamada do console ou botão adicional)
function exportWallets() {
    if (window.stellarApp) {
        window.stellarApp.exportWallets();
    }
}

// Função global para resetar tudo
function resetAll() {
    if (window.stellarApp) {
        window.stellarApp.resetAll();
    }
}