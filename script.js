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
        if (!statutElement) return;
        
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
                this.changerSection(targetSection);
            });
        });
    }
    
    changerSection(section) {
        console.log('Changement de section vers:', section);
        
        // Mettre à jour la navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const navBtn = document.querySelector(`[data-section="${section}"]`);
        if (navBtn) {
            navBtn.classList.add('active');
        }
        
        // Cacher toutes les sections
        document.querySelectorAll('.app-section').forEach(sec => {
            sec.classList.remove('active');
        });
        
        // Afficher la section cible
        const targetSection = document.getElementById(`${section}-section`);
        if (targetSection) {
            targetSection.classList.add('active');
        } else {
            console.error('Section non trouvée:', `${section}-section`);
        }
        
        // Actions spécifiques
        if (section === 'scanner') {
            this.demarrerScanner();
        }
    }
    
    setupEventListeners() {
        // Scanner
        const btnActiverCamera = document.getElementById('btn-activer-camera');
        const btnDesactiverCamera = document.getElementById('btn-desactiver-camera');
        const btnChargerTransaction = document.getElementById('btn-charger-transaction');
        const inputTransactionId = document.getElementById('transaction-id');
        
        if (btnActiverCamera) {
            btnActiverCamera.addEventListener('click', () => this.demarrerScanner());
        }
        
        if (btnDesactiverCamera) {
            btnDesactiverCamera.addEventListener('click', () => this.arreterCamera());
        }
        
        if (btnChargerTransaction) {
            btnChargerTransaction.addEventListener('click', () => this.chargerTransaction());
        }
        
        if (inputTransactionId) {
            inputTransactionId.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.chargerTransaction();
            });
        }
        
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
        
        const btnRechargerPerso = document.getElementById('btn-recharger-perso');
        if (btnRechargerPerso) {
            btnRechargerPerso.addEventListener('click', () => {
                const montant = document.getElementById('montant-personnalise').value;
                if (montant && montant > 0) {
                    this.rechargerSolde(montant);
                } else {
                    this.afficherNotification('Veuillez entrer un montant valide', 'warning');
                }
            });
        }
        
        // Transaction
        const btnPayer = document.getElementById('btn-payer');
        const btnAnnuler = document.getElementById('btn-annuler');
        const btnNouvelleTransaction = document.getElementById('btn-nouvelle-transaction');
        
        if (btnPayer) {
            btnPayer.addEventListener('click', () => this.effectuerPaiement());
        }
        
        if (btnAnnuler) {
            btnAnnuler.addEventListener('click', () => this.annulerTransaction());
        }
        
        if (btnNouvelleTransaction) {
            btnNouvelleTransaction.addEventListener('click', () => this.nouvelleTransaction());
        }
        
        // Recharge header
        const btnRechargerHeader = document.getElementById('btn-recharger');
        if (btnRechargerHeader) {
            btnRechargerHeader.addEventListener('click', () => {
                this.changerSection('recharge');
            });
        }
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
            if (!video) {
                throw new Error('Élément video non trouvé');
            }
            
            video.srcObject = stream;
            this.cameraActive = true;
            
            const btnActiver = document.getElementById('btn-activer-camera');
            const btnDesactiver = document.getElementById('btn-desactiver-camera');
            
            if (btnActiver) btnActiver.style.display = 'none';
            if (btnDesactiver) btnDesactiver.style.display = 'inline-block';
            
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
            if (video) {
                const stream = video.srcObject;
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                }
                video.srcObject = null;
            }
            
            this.cameraActive = false;
            
            const btnActiver = document.getElementById('btn-activer-camera');
            const btnDesactiver = document.getElementById('btn-desactiver-camera');
            
            if (btnActiver) btnActiver.style.display = 'inline-block';
            if (btnDesactiver) btnDesactiver.style.display = 'none';
            
            this.afficherNotification('Caméra désactivée', 'info');
        }
    }
    
    scannerQRCode(stream) {
        const video = document.getElementById('camera-feed');
        if (!video) return;
        
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
                        console.log('QR Code scanné:', data);
                        
                        if (data.transactionId) {
                            this.arreterCamera();
                            this.chargerTransaction(data.transactionId);
                        } else {
                            scanEnCours = false;
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
        try {
            const audio = document.getElementById('scan-sound');
            if (audio) {
                audio.currentTime = 0;
                audio.play().catch(e => console.log('Son de scan non joué:', e));
            }
        } catch (error) {
            console.log('Erreur lecture son:', error);
        }
    }
    
    async chargerTransaction(transactionId = null) {
        const id = transactionId || document.getElementById('transaction-id')?.value.trim().toUpperCase();
        
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
        
        // Mettre à jour les éléments de la transaction
        const elements = {
            'detail-transaction-id': this.transactionActuelle.id,
            'detail-montant': this.transactionActuelle.montant.toLocaleString(),
            'detail-statut': this.getStatutText(this.transactionActuelle.statut)
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
        
        // Mettre à jour le statut
        const statutElement = document.getElementById('detail-statut');
        if (statutElement) {
            statutElement.className = `transaction-statut ${this.transactionActuelle.statut}`;
        }
        
        this.afficherBoissonsTransaction();
        
        const btnPayer = document.getElementById('btn-payer');
        if (btnPayer) {
            const estPayable = this.transactionActuelle.statut === 'en_attente' && this.estConnecte;
            btnPayer.disabled = !estPayable;
            
            if (!estPayable) {
                btnPayer.textContent = 'Transaction ' + this.getStatutText(this.transactionActuelle.statut);
            } else {
                btnPayer.textContent = '💳 Confirmer le Paiement';
            }
        }
    }
    
    afficherBoissonsTransaction() {
        const listeElement = document.getElementById('liste-boissons');
        if (!listeElement) return;
        
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
        const confirmationOverlay = document.getElementById('confirmation-paiement');
        const confirmationId = document.getElementById('confirmation-id');
        const confirmationMontant = document.getElementById('confirmation-montant');
        const confirmationSolde = document.getElementById('confirmation-solde');
        
        if (confirmationId) confirmationId.textContent = transaction.id;
        if (confirmationMontant) confirmationMontant.textContent = transaction.montant.toLocaleString();
        if (confirmationSolde) confirmationSolde.textContent = this.soldeUtilisateur.toLocaleString();
        
        if (confirmationOverlay) {
            confirmationOverlay.style.display = 'flex';
        }
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
                const inputMontant = document.getElementById('montant-personnalise');
                if (inputMontant) inputMontant.value = '';
                
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
        const confirmationOverlay = document.getElementById('confirmation-paiement');
        if (confirmationOverlay) {
            confirmationOverlay.style.display = 'none';
        }
        
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
        const soldeElement = document.getElementById('solde-utilisateur');
        if (soldeElement) {
            soldeElement.textContent = this.soldeUtilisateur.toLocaleString();
        }
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
        
        if (!historiqueElement || !historiqueVide) return;
        
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
        if (!notification) return;
        
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
