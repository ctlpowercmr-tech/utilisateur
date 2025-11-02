class UtilisateurApp {
    constructor() {
        this.soldeUtilisateur = 0;
        this.transactionActuelle = null;
        this.historique = [];
        this.cameraActive = false;
        this.API_URL = CONFIG.API_URL;
        this.estConnecte = false;
        
        this.init();
    }
    
    async init() {
        console.log('🚀 Initialisation application utilisateur');
        
        // Tester la connexion immédiatement
        await this.testerConnexionServeur();
        await this.chargerSolde();
        this.chargerHistorique();
        this.setupEventListeners();
        this.demarrerScanner();
        
        // Vérifier la connexion périodiquement
        setInterval(() => this.testerConnexionServeur(), 30000);
    }
    
    async testerConnexionServeur() {
        try {
            console.log('🔗 Test de connexion au serveur...');
            const debut = Date.now();
            const response = await fetch(`${this.API_URL}/api/health`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();
            const tempsReponse = Date.now() - debut;
            
            if (result.status === 'OK') {
                this.estConnecte = true;
                console.log(`✅ Serveur connecté (${tempsReponse}ms)`);
                this.mettreAJourStatutConnexion('connecte');
                return true;
            } else {
                throw new Error('Réponse serveur invalide');
            }
        } catch (error) {
            console.error('❌ Erreur connexion serveur:', error);
            this.estConnecte = false;
            this.mettreAJourStatutConnexion('erreur', error.message);
            return false;
        }
    }
    
    mettreAJourStatutConnexion(statut, message = '') {
        let statutElement = document.getElementById('statut-connexion');
        
        if (!statutElement) {
            statutElement = document.createElement('div');
            statutElement.id = 'statut-connexion';
            statutElement.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                padding: 10px 15px;
                border-radius: 20px;
                font-weight: bold;
                z-index: 1000;
                backdrop-filter: blur(10px);
                font-size: 14px;
            `;
            document.body.appendChild(statutElement);
        }
        
        if (statut === 'connecte') {
            statutElement.textContent = '✅ En ligne';
            statutElement.style.background = 'rgba(76, 175, 80, 0.9)';
            statutElement.style.color = 'white';
        } else {
            statutElement.textContent = '❌ Hors ligne';
            statutElement.style.background = 'rgba(244, 67, 54, 0.9)';
            statutElement.style.color = 'white';
        }
    }
    
    setupEventListeners() {
        document.getElementById('btn-charger-transaction').addEventListener('click', () => this.chargerTransaction());
        document.getElementById('btn-payer').addEventListener('click', () => this.effectuerPaiement());
        document.getElementById('btn-annuler').addEventListener('click', () => this.annulerTransaction());
        document.getElementById('btn-nouvelle-transaction').addEventListener('click', () => this.nouvelleTransaction());
        
        // ÉVÉNEMENTS RECHARGE
        document.getElementById('btn-recharger').addEventListener('click', () => this.afficherRecharge());
        document.getElementById('btn-fermer-recharge').addEventListener('click', () => this.cacherRecharge());
        
        // Recharges rapides
        document.querySelectorAll('.montant-rapide').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const montant = e.target.getAttribute('data-montant');
                this.rechargerSolde(montant);
            });
        });
        
        // Recharge personnalisée
        document.getElementById('btn-recharger-perso').addEventListener('click', () => {
            const montant = document.getElementById('montant-personnalise').value;
            if (montant && montant > 0) {
                this.rechargerSolde(montant);
            } else {
                alert('Veuillez entrer un montant valide');
            }
        });
        
        document.getElementById('transaction-id').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.chargerTransaction();
        });
    }
    
    afficherRecharge() {
        document.getElementById('recharge-section').style.display = 'block';
        document.getElementById('scanner-section').style.display = 'none';
        document.getElementById('transaction-section').style.display = 'none';
    }
    
    cacherRecharge() {
        document.getElementById('recharge-section').style.display = 'none';
        document.getElementById('scanner-section').style.display = 'block';
    }
    
    async rechargerSolde(montant) {
        if (!this.estConnecte) {
            alert('❌ Impossible de se connecter au serveur pour recharger');
            await this.testerConnexionServeur();
            return;
        }
        
        try {
            console.log('💳 Tentative de rechargement:', montant);
            const response = await fetch(`${this.API_URL}/api/solde/utilisateur/recharger`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ montant: parseFloat(montant) })
            });
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.soldeUtilisateur = result.nouveauSolde;
                this.mettreAJourSolde();
                alert(`✅ ${result.message}`);
                this.cacherRecharge();
                document.getElementById('montant-personnalise').value = '';
            } else {
                alert('❌ Erreur: ' + result.error);
            }
        } catch (error) {
            console.error('Erreur rechargement:', error);
            this.estConnecte = false;
            this.mettreAJourStatutConnexion('erreur', error.message);
            alert('❌ Erreur de connexion au serveur lors du rechargement');
        }
    }
    
    async demarrerScanner() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: "environment" } 
            });
            const video = document.getElementById('camera-feed');
            video.srcObject = stream;
            this.cameraActive = true;
            
            this.scannerQRCode(stream);
        } catch (error) {
            console.error('Erreur accès caméra:', error);
            document.getElementById('scanner-section').innerHTML += 
                '<p style="color: #ff6b6b; margin-top: 10px;">📷 Impossible d\'accéder à la caméra</p>';
        }
    }
    
    scannerQRCode(stream) {
        const video = document.getElementById('camera-feed');
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        const scanFrame = () => {
            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height);
                
                if (code) {
                    try {
                        console.log('📱 QR code détecté:', code.data);
                        const data = JSON.parse(code.data);
                        if (data.transactionId) {
                            this.arreterCamera();
                            this.chargerTransaction(data.transactionId);
                        }
                    } catch (e) {
                        console.log('QR code non reconnu:', e);
                    }
                }
            }
            requestAnimationFrame(scanFrame);
        };
        scanFrame();
    }
    
    arreterCamera() {
        if (this.cameraActive) {
            const video = document.getElementById('camera-feed');
            const stream = video.srcObject;
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            this.cameraActive = false;
        }
    }
    
    async chargerTransaction(transactionId = null) {
        const id = transactionId || document.getElementById('transaction-id').value.trim();
        
        if (!id) {
            alert('Veuillez saisir un ID de transaction');
            return;
        }

        console.log('🔄 Chargement transaction:', id);
        
        if (!this.estConnecte) {
            alert('❌ Impossible de se connecter au serveur');
            await this.testerConnexionServeur();
            return;
        }
        
        try {
            const response = await fetch(`${this.API_URL}/api/transaction/${id}`);
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('📄 Résultat transaction:', result);
            
            if (result.success) {
                this.transactionActuelle = result.data;
                this.afficherDetailsTransaction();
            } else {
                alert('❌ ' + (result.error || 'Transaction non trouvée'));
            }
        } catch (error) {
            console.error('Erreur chargement transaction:', error);
            this.estConnecte = false;
            this.mettreAJourStatutConnexion('erreur', error.message);
            alert('❌ Erreur de connexion au serveur. Vérifiez:\n• Votre connexion internet\n• Que l\'ID de transaction est correct');
        }
    }
    
    afficherDetailsTransaction() {
        const scannerSection = document.getElementById('scanner-section');
        const transactionSection = document.getElementById('transaction-section');
        const rechargeSection = document.getElementById('recharge-section');
        
        scannerSection.style.display = 'none';
        transactionSection.style.display = 'block';
        rechargeSection.style.display = 'none';
        
        document.getElementById('detail-transaction-id').textContent = this.transactionActuelle.id;
        document.getElementById('detail-montant').textContent = this.transactionActuelle.montant.toFixed(2);
        document.getElementById('detail-statut').textContent = this.getStatutText(this.transactionActuelle.statut);
        
        this.afficherBoissonsTransaction();
        
        const btnPayer = document.getElementById('btn-payer');
        const estPayable = this.transactionActuelle.statut === 'en_attente' && this.estConnecte;
        
        btnPayer.disabled = !estPayable;
        
        if (this.transactionActuelle.statut !== 'en_attente') {
            btnPayer.textContent = 'Transaction ' + this.getStatutText(this.transactionActuelle.statut);
        } else if (!this.estConnecte) {
            btnPayer.textContent = 'Serveur hors ligne';
        } else {
            btnPayer.textContent = 'Confirmer le Paiement';
        }
    }
    
    afficherBoissonsTransaction() {
        const listeElement = document.getElementById('liste-boissons');
        listeElement.innerHTML = '';
        
        this.transactionActuelle.boissons.forEach(boisson => {
            const item = document.createElement('div');
            item.className = 'item-boisson';
            item.innerHTML = `
                <span>${boisson.icone || '🥤'} ${boisson.nom}</span>
                <span>${boisson.prix.toFixed(2)}€</span>
            `;
            listeElement.appendChild(item);
        });
    }
    
    getStatutText(statut) {
        const statuts = {
            'en_attente': 'En attente',
            'paye': 'Payé',
            'annule': 'Annulé',
            'expire': 'Expiré'
        };
        return statuts[statut] || statut;
    }
    
    async effectuerPaiement() {
        if (!this.transactionActuelle || !this.estConnecte) {
            alert('❌ Impossible de se connecter au serveur');
            await this.testerConnexionServeur();
            return;
        }
        
        try {
            console.log('💸 Tentative de paiement:', this.transactionActuelle.id);
            const response = await fetch(`${this.API_URL}/api/transaction/${this.transactionActuelle.id}/payer`, {
                method: 'POST'
            });
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.soldeUtilisateur = result.nouveauSoldeUtilisateur;
                this.mettreAJourSolde();
                this.ajouterAHistorique(this.transactionActuelle);
                this.afficherConfirmationPaiement();
                console.log('✅ Paiement réussi');
            } else {
                alert('❌ Erreur: ' + result.error);
            }
        } catch (error) {
            console.error('Erreur paiement:', error);
            this.estConnecte = false;
            this.mettreAJourStatutConnexion('erreur', error.message);
            alert('❌ Erreur de connexion au serveur lors du paiement');
        }
    }
    
    afficherConfirmationPaiement() {
        document.getElementById('confirmation-paiement').style.display = 'flex';
    }
    
    annulerTransaction() {
        this.retournerAuScanner();
    }
    
    nouvelleTransaction() {
        document.getElementById('confirmation-paiement').style.display = 'none';
        this.retournerAuScanner();
    }
    
    retournerAuScanner() {
        const scannerSection = document.getElementById('scanner-section');
        const transactionSection = document.getElementById('transaction-section');
        const rechargeSection = document.getElementById('recharge-section');
        
        scannerSection.style.display = 'block';
        transactionSection.style.display = 'none';
        rechargeSection.style.display = 'none';
        
        document.getElementById('transaction-id').value = '';
        this.transactionActuelle = null;
        
        this.demarrerScanner();
    }
    
    async chargerSolde() {
        try {
            const response = await fetch(`${this.API_URL}/api/solde/utilisateur`);
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.soldeUtilisateur = result.solde;
                this.mettreAJourSolde();
            }
        } catch (error) {
            console.error('Erreur chargement solde:', error);
            this.estConnecte = false;
            this.mettreAJourStatutConnexion('erreur', error.message);
        }
    }
    
    mettreAJourSolde() {
        document.getElementById('solde-utilisateur').textContent = this.soldeUtilisateur.toFixed(2);
    }
    
    ajouterAHistorique(transaction) {
        this.historique.unshift({
            ...transaction,
            date: new Date().toISOString()
        });
        
        if (this.historique.length > 10) {
            this.historique = this.historique.slice(0, 10);
        }
        
        this.mettreAJourHistorique();
    }
    
    mettreAJourHistorique() {
        const historiqueElement = document.getElementById('historique-transactions');
        historiqueElement.innerHTML = '';
        
        this.historique.forEach(transaction => {
            const item = document.createElement('div');
            item.className = `transaction-historique ${transaction.statut}`;
            item.innerHTML = `
                <div>
                    <div>${new Date(transaction.date).toLocaleDateString()}</div>
                    <div style="font-size: 0.8rem; opacity: 0.8;">${transaction.id}</div>
                </div>
                <div style="text-align: right;">
                    <div>${transaction.montant.toFixed(2)}€</div>
                    <div style="font-size: 0.8rem; opacity: 0.8;">${this.getStatutText(transaction.statut)}</div>
                </div>
            `;
            historiqueElement.appendChild(item);
        });
    }
    
    async chargerHistorique() {
        this.historique = [];
        this.mettreAJourHistorique();
    }
}

// Initialiser immédiatement au chargement
document.addEventListener('DOMContentLoaded', function() {
    window.utilisateurApp = new UtilisateurApp();
});
