class CTLPayApp {
    constructor() {
        this.soldeUtilisateur = 0;
        this.transactionActuelle = null;
        this.historique = [];
        this.cameraActive = false;
        this.operateurSelectionne = null;
        this.API_URL = CONFIG.API_URL;
        this.estConnecte = false;
        
        this.init();
    }
    
    async init() {
        console.log('🚀 CTL-Pay initialisé');
        
        await this.testerConnexionServeur();
        await this.chargerSolde();
        this.chargerHistorique();
        this.setupEventListeners();
        this.setupNavigation();
        
        setInterval(() => this.testerConnexionServeur(), 30000);
    }
    
    async testerConnexionServeur() {
        try {
            const response = await fetch(`${this.API_URL}/api/health`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.status === 'OK') {
                this.estConnecte = true;
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
        const statutElement = document.getElementById('statut-connexion');
        statutElement.className = `statut-connexion ${statut}`;
        
        if (statut === 'connecte') {
            statutElement.textContent = '🟢 CTL-Pay Connecté';
        } else {
            statutElement.textContent = '🔴 CTL-Pay Hors Ligne';
        }
    }
    
    setupNavigation() {
        const navButtons = document.querySelectorAll('.nav-btn');
        const sections = document.querySelectorAll('.app-section');
        
        navButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetSection = btn.getAttribute('data-section');
                
                // Mettre à jour la navigation
                navButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Afficher la section correspondante
                sections.forEach(section => section.classList.remove('active'));
                document.getElementById(`${targetSection}-section`).classList.add('active');
                
                // Actions spécifiques
                if (targetSection === 'scanner') {
                    this.demarrerScanner();
                }
            });
        });
    }
    
    setupEventListeners() {
        // Scanner
        document.getElementById('btn-activer-camera').addEventListener('click', () => this.demarrerScanner());
        document.getElementById('btn-desactiver-camera').addEventListener('click', () => this.arreterCamera());
        document.getElementById('btn-charger-transaction').addEventListener('click', () => this.chargerTransaction());
        document.getElementById('transaction-id').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.chargerTransaction();
        });
        
        // Recharge
        document.querySelectorAll('.operateur-card').forEach(card => {
            card.addEventListener('click', () => this.selectionnerOperateur(card));
        });
        
        document.querySelectorAll('.montant-rapide').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const montant = e.currentTarget.getAttribute('data-montant');
                this.rechargerSolde(montant);
            });
        });
        
        document.getElementById('btn-recharger-perso').addEventListener('click', () => {
            const montant = document.getElementById('montant-personnalise').value;
            if (montant && montant > 0) {
                this.rechargerSolde(montant);
            } else {
                this.afficherNotification('Veuillez entrer un montant valide', 'warning');
            }
        });
        
        // Transaction
        document.getElementById('btn-payer').addEventListener('click', () => this.effectuerPaiement());
        document.getElementById('btn-annuler').addEventListener('click', () => this.annulerTransaction());
        document.getElementById('btn-nouvelle-transaction').addEventListener('click', () => this.nouvelleTransaction());
        
        // Recharge header
        document.getElementById('btn-recharger').addEventListener('click', () => {
            this.changerSection('recharge');
        });
    }
    
    changerSection(section) {
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.app-section').forEach(sec => sec.classList.remove('active'));
        
        document.querySelector(`[data-section="${section}"]`).classList.add('active');
        document.getElementById(`${section}-section`).classList.add('active');
    }
    
    selectionnerOperateur(card) {
        document.querySelectorAll('.operateur-card').forEach(c => {
            c.classList.remove('selected');
        });
        
        card.classList.add('selected');
        this.operateurSelectionne = card.getAttribute('data-operateur');
        
        this.afficherNotification(`Opérateur ${this.operateurSelectionne.toUpperCase()} sélectionné`, 'info');
    }
    
    async demarrerScanner() {
        if (this.cameraActive) return;
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: "environment",
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                } 
            });
            
            const video = document.getElementById('camera-feed');
            video.srcObject = stream;
            this.cameraActive = true;
            
            document.getElementById('btn-activer-camera').style.display = 'none';
            document.getElementById('btn-desactiver-camera').style.display = 'inline-block';
            
            this.scannerQRCode(stream);
            
            this.afficherNotification('Caméra activée - Scannez le QR Code', 'info');
        } catch (error) {
            console.error('Erreur accès caméra:', error);
            this.afficherNotification('Impossible d\'accéder à la caméra', 'error');
        }
    }
    
    arreterCamera() {
        if (this.cameraActive) {
            const video = document.getElementById('camera-feed');
            const stream = video.srcObject;
            
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            
            this.cameraActive = false;
            video.srcObject = null;
            
            document.getElementById('btn-activer-camera').style.display = 'inline-block';
            document.getElementById('btn-desactiver-camera').style.display = 'none';
            
            this.afficherNotification('Caméra désactivée', 'info');
        }
    }
    
    scannerQRCode(stream) {
        const video = document.getElementById('camera-feed');
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        let scanEnCours = false;
        
        const scanFrame = () => {
            if (!this.cameraActive) return;
            
            if (video.readyState === video.HAVE_ENOUGH_DATA && !scanEnCours) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height);
                
                if (code && !scanEnCours) {
                    scanEnCours = true;
                    this.jouerSonScan();
                    
                    try {
                        const data = JSON.parse(code.data);
                        if (data.transactionId) {
                            this.arreterCamera();
                            this.chargerTransaction(data.transactionId);
                        }
                    } catch (e) {
                        console.log('QR code non reconnu:', e);
                        scanEnCours = false;
                    }
                }
            }
            requestAnimationFrame(scanFrame);
        };
        scanFrame();
    }
    
    jouerSonScan() {
        const audio = document.getElementById('scan-sound');
        if (audio) {
            audio.currentTime = 0;
            audio.play().catch(e => console.log('Son de scan non joué:', e));
        }
    }
    
    async chargerTransaction(transactionId = null) {
        const id = transactionId || document.getElementById('transaction-id').value.trim().toUpperCase();
        
        if (!id) {
            this.afficherNotification('Veuillez saisir un ID de transaction', 'warning');
            return;
        }

        if (!id.startsWith('CTL')) {
            this.afficherNotification('ID CTL invalide - Doit commencer par CTL', 'error');
            return;
        }
        
        if (!this.estConnecte) {
            this.afficherNotification('Impossible de se connecter au serveur', 'error');
            await this.testerConnexionServeur();
            return;
        }
        
        this.afficherNotification('Chargement de la transaction...', 'info');
        
        try {
            const response = await fetch(`${this.API_URL}/api/transaction/${id}`);
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.transactionActuelle = result.data;
                this.afficherDetailsTransaction();
                this.changerSection('transaction');
                this.afficherNotification('Transaction chargée avec succès', 'success');
            } else {
                throw new Error(result.error || 'Transaction non trouvée');
            }
        } catch (error) {
            console.error('Erreur chargement transaction:', error);
            this.afficherNotification('Erreur: ' + error.message, 'error');
        }
    }
    
    afficherDetailsTransaction() {
        if (!this.transactionActuelle) return;
        
        document.getElementById('detail-transaction-id').textContent = this.transactionActuelle.id;
        document.getElementById('detail-montant').textContent = this.transactionActuelle.montant.toLocaleString();
        document.getElementById('detail-statut').textContent = this.getStatutText(this.transactionActuelle.statut);
        document.getElementById('detail-statut').className = `transaction-statut ${this.transactionActuelle.statut}`;
        
        this.afficherBoissonsTransaction();
        
        const btnPayer = document.getElementById('btn-payer');
        const estPayable = this.transactionActuelle.statut === 'en_attente' && this.estConnecte;
        
        btnPayer.disabled = !estPayable;
        
        if (!estPayable) {
            btnPayer.textContent = 'Transaction ' + this.getStatutText(this.transactionActuelle.statut);
        }
    }
    
    afficherBoissonsTransaction() {
        const listeElement = document.getElementById('liste-boissons');
        listeElement.innerHTML = '';
        
        if (this.transactionActuelle.boissons && Array.isArray(this.transactionActuelle.boissons)) {
            this.transactionActuelle.boissons.forEach(boisson => {
                const item = document.createElement('div');
                item.className = 'item-boisson';
                item.innerHTML = `
                    <span>${boisson.nom}</span>
                    <strong>${boisson.prix ? boisson.prix.toLocaleString() : '0'} FCFA</strong>
                `;
                listeElement.appendChild(item);
            });
        }
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
            this.afficherNotification('Impossible de se connecter au serveur', 'error');
            return;
        }
        
        if (this.soldeUtilisateur < this.transactionActuelle.montant) {
            this.afficherNotification('Solde insuffisant - Veuillez recharger', 'error');
            this.changerSection('recharge');
            return;
        }
        
        this.afficherNotification('Traitement du paiement...', 'info');
        
        try {
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
                this.afficherConfirmationPaiement(result.data);
                this.afficherNotification('Paiement réussi!', 'success');
            } else {
                throw new Error(result.error || 'Erreur lors du paiement');
            }
        } catch (error) {
            console.error('Erreur paiement:', error);
            this.afficherNotification('Erreur: ' + error.message, 'error');
        }
    }
    
    afficherConfirmationPaiement(transaction) {
        document.getElementById('confirmation-id').textContent = transaction.id;
        document.getElementById('confirmation-montant').textContent = transaction.montant.toLocaleString();
        document.getElementById('confirmation-solde').textContent = this.soldeUtilisateur.toLocaleString();
        
        document.getElementById('confirmation-paiement').style.display = 'flex';
    }
    
    async rechargerSolde(montant) {
        if (!this.operateurSelectionne) {
            this.afficherNotification('Veuillez sélectionner un opérateur', 'warning');
            return;
        }
        
        if (!this.estConnecte) {
            this.afficherNotification('Impossible de se connecter au serveur', 'error');
            return;
        }
        
        const montantNum = parseFloat(montant);
        if (!montantNum || montantNum <= 0) {
            this.afficherNotification('Montant invalide', 'error');
            return;
        }
        
        this.afficherNotification(`Rechargement ${this.operateurSelectionne} en cours...`, 'info');
        
        try {
            const response = await fetch(`${this.API_URL}/api/solde/utilisateur/recharger`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    montant: montantNum,
                    operateur: this.operateurSelectionne 
                })
            });
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.soldeUtilisateur = result.nouveauSolde;
                this.mettreAJourSolde();
                
                // Réinitialiser le formulaire
                document.getElementById('montant-personnalise').value = '';
                
                this.afficherNotification(result.message, 'success');
                
                // Revenir à la section scanner après 2 secondes
                setTimeout(() => {
                    this.changerSection('scanner');
                }, 2000);
            } else {
                throw new Error(result.error || 'Erreur lors du rechargement');
            }
        } catch (error) {
            console.error('Erreur rechargement:', error);
            this.afficherNotification('Erreur: ' + error.message, 'error');
        }
    }
    
    annulerTransaction() {
        this.changerSection('scanner');
        this.transactionActuelle = null;
        this.afficherNotification('Transaction annulée', 'warning');
    }
    
    nouvelleTransaction() {
        document.getElementById('confirmation-paiement').style.display = 'none';
        this.changerSection('scanner');
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
        }
    }
    
    mettreAJourSolde() {
        document.getElementById('solde-utilisateur').textContent = this.soldeUtilisateur.toLocaleString();
    }
    
    ajouterAHistorique(transaction) {
        const transactionHistorique = {
            ...transaction,
            date: new Date().toISOString(),
            type: 'paiement'
        };
        
        this.historique.unshift(transactionHistorique);
        
        // Garder seulement les 10 dernières transactions
        if (this.historique.length > 10) {
            this.historique = this.historique.slice(0, 10);
        }
        
        this.mettreAJourHistorique();
    }
    
    mettreAJourHistorique() {
        const historiqueElement = document.getElementById('historique-transactions');
        const historiqueVide = document.getElementById('historique-vide');
        
        if (this.historique.length === 0) {
            historiqueElement.style.display = 'none';
            historiqueVide.style.display = 'block';
            return;
        }
        
        historiqueElement.style.display = 'block';
        historiqueVide.style.display = 'none';
        historiqueElement.innerHTML = '';
        
        this.historique.forEach(transaction => {
            const item = document.createElement('div');
            item.className = `transaction-historique ${transaction.statut}`;
            item.innerHTML = `
                <div class="historique-header">
                    <div class="historique-date">${new Date(transaction.date).toLocaleDateString()}</div>
                    <div class="historique-id">${transaction.id}</div>
                </div>
                <div class="historique-details">
                    <div class="historique-montant">${transaction.montant.toLocaleString()} FCFA</div>
                    <div class="historique-statut ${transaction.statut}">${this.getStatutText(transaction.statut)}</div>
                </div>
            `;
            historiqueElement.appendChild(item);
        });
    }
    
    async chargerHistorique() {
        // Simulation - dans une vraie app, on chargerait depuis l'API
        this.historique = [];
        this.mettreAJourHistorique();
    }
    
    afficherNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.style.display = 'block';
        
        setTimeout(() => {
            notification.style.display = 'none';
        }, 4000);
    }
}

// Initialiser l'application
document.addEventListener('DOMContentLoaded', function() {
    window.ctlPayApp = new CTLPayApp();
});
