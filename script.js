class UtilisateurApp {
    constructor() {
        this.soldeUtilisateur = 0;
        this.transactionActuelle = null;
        this.historique = [];
        this.cameraActive = false;
        this.API_URL = CONFIG.API_URL;
        
        this.init();
    }
    
    async init() {
        await this.chargerSolde();
        this.chargerHistorique();
        this.setupEventListeners();
        this.demarrerScanner();
    }
    
    setupEventListeners() {
        document.getElementById('btn-charger-transaction').addEventListener('click', () => this.chargerTransaction());
        document.getElementById('btn-payer').addEventListener('click', () => this.effectuerPaiement());
        document.getElementById('btn-annuler').addEventListener('click', () => this.annulerTransaction());
        document.getElementById('btn-nouvelle-transaction').addEventListener('click', () => this.nouvelleTransaction());
        
        document.getElementById('transaction-id').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.chargerTransaction();
        });
    }
    
    async demarrerScanner() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: "environment" } 
            });
            const video = document.getElementById('camera-feed');
            video.srcObject = stream;
            this.cameraActive = true;
            
            this.scannerQRCode();
        } catch (error) {
            console.error('❌ Erreur accès caméra:', error);
            document.querySelector('.scanner-container').innerHTML += 
                '<p style="color: #ff6b6b; margin-top: 10px;">📷 Impossible d\'accéder à la caméra. Utilisez la saisie manuelle.</p>';
        }
    }
    
    scannerQRCode() {
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
                        const data = JSON.parse(code.data);
                        if (data.transactionId && data.type === 'paiement-boisson') {
                            this.arreterCamera();
                            this.chargerTransaction(data.transactionId);
                        }
                    } catch (e) {
                        console.log('QR code non reconnu');
                    }
                }
            }
            if (this.cameraActive) {
                requestAnimationFrame(scanFrame);
            }
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
            alert('⚠️ Veuillez saisir un ID de transaction');
            return;
        }
        
        try {
            const response = await fetch(`${this.API_URL}/api/transaction/${id}`);
            const result = await response.json();
            
            if (result.success) {
                this.transactionActuelle = result.data;
                this.afficherDetailsTransaction();
            } else {
                alert('❌ Transaction non trouvée ou expirée');
            }
        } catch (error) {
            console.error('❌ Erreur:', error);
            alert('❌ Erreur de connexion au serveur');
        }
    }
    
    afficherDetailsTransaction() {
        const scannerSection = document.getElementById('scanner-section');
        const transactionSection = document.getElementById('transaction-section');
        
        scannerSection.style.display = 'none';
        transactionSection.style.display = 'block';
        
        document.getElementById('detail-transaction-id').textContent = this.transactionActuelle.id;
        document.getElementById('detail-montant').textContent = this.transactionActuelle.montant.toFixed(2);
        document.getElementById('detail-statut').textContent = this.getStatutText(this.transactionActuelle.statut);
        
        this.afficherBoissonsTransaction();
        
        const btnPayer = document.getElementById('btn-payer');
        btnPayer.disabled = this.transactionActuelle.statut !== 'en_attente';
        
        if (this.transactionActuelle.statut !== 'en_attente') {
            btnPayer.textContent = 'Transaction ' + this.getStatutText(this.transactionActuelle.statut);
            btnPayer.style.background = '#666';
        } else {
            btnPayer.textContent = 'Confirmer le Paiement';
            btnPayer.style.background = '';
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
        if (!this.transactionActuelle) return;
        
        try {
            const response = await fetch(`${this.API_URL}/api/transaction/${this.transactionActuelle.id}/payer`, {
                method: 'POST'
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.soldeUtilisateur = result.nouveauSoldeUtilisateur;
                this.mettreAJourSolde();
                this.ajouterAHistorique(this.transactionActuelle);
                this.afficherConfirmationPaiement();
            } else {
                alert('❌ Erreur: ' + result.error);
            }
        } catch (error) {
            console.error('❌ Erreur:', error);
            alert('❌ Erreur de connexion au serveur');
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
        
        scannerSection.style.display = 'block';
        transactionSection.style.display = 'none';
        
        document.getElementById('transaction-id').value = '';
        this.transactionActuelle = null;
        
        this.demarrerScanner();
    }
    
    async chargerSolde() {
        try {
            const response = await fetch(`${this.API_URL}/api/solde/utilisateur`);
            const result = await response.json();
            
            if (result.success) {
                this.soldeUtilisateur = result.solde;
                this.mettreAJourSolde();
            }
        } catch (error) {
            console.error('❌ Erreur chargement solde:', error);
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
        
        if (this.historique.length === 0) {
            historiqueElement.innerHTML = '<div style="text-align: center; opacity: 0.7; padding: 20px;">Aucune transaction récente</div>';
            return;
        }
        
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
        // Dans une vraie application, charger depuis l'API
        this.historique = [];
        this.mettreAJourHistorique();
    }
}

const utilisateurApp = new UtilisateurApp();
