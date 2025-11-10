class CTLPayApp {
    constructor() {
        this.soldeUtilisateur = 0;
        this.transactionActuelle = null;
        this.historique = [];
        this.cameraActive = false;
        this.operateurSelectionne = null;
        this.montantSelectionne = 0;
        this.API_URL = CONFIG.API_URL;
        this.estConnecte = false;
        
        this.init();
    }
    
    async init() {
        console.log('🚀 CTL-PAY Application initialisée');
        
        await this.testerConnexionServeur();
        await this.chargerSolde();
        this.chargerHistorique();
        this.setupEventListeners();
        this.setupNavigation();
        this.demarrerScanner();
        
        // Maintenance de la connexion
        setInterval(() => this.testerConnexionServeur(), 30000);
    }
    
    setupNavigation() {
        // Navigation rapide
        document.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.currentTarget.getAttribute('data-section');
                this.changerSection(section);
            });
        });
        
        // Bouton retour transaction
        document.getElementById('btn-back-transaction').addEventListener('click', () => {
            this.changerSection('scanner');
        });
        
        // Bouton modal OK
        document.getElementById('btn-modal-ok').addEventListener('click', () => {
            this.cacherModal();
            this.changerSection('scanner');
        });
    }
    
    changerSection(section) {
        // Mettre à jour la navigation
        document.querySelectorAll('.quick-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-section="${section}"]`).classList.add('active');
        
        // Afficher la section
        document.querySelectorAll('.app-section').forEach(sect => {
            sect.classList.remove('active');
        });
        document.getElementById(`${section}-section`).classList.add('active');
        
        // Réinitialiser le scanner si on revient à la section scanner
        if (section === 'scanner' && !this.cameraActive) {
            this.demarrerScanner();
        }
    }
    
    setupEventListeners() {
        // Boutons dépôt
        document.getElementById('btn-recharger').addEventListener('click', () => {
            this.changerSection('depot');
        });
        
        // Sélection opérateur
        document.querySelectorAll('.operateur-card').forEach(card => {
            card.addEventListener('click', (e) => {
                this.selectionnerOperateur(e.currentTarget.getAttribute('data-operateur'));
            });
        });
        
        // Montants rapides
        document.querySelectorAll('.montant-rapide').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectionnerMontantRapide(e.currentTarget.getAttribute('data-montant'));
            });
        });
        
        // Montant personnalisé
        document.getElementById('montant-input').addEventListener('input', (e) => {
            this.selectionnerMontantPersonnalise(e.target.value);
        });
        
        // Confirmation dépôt
        document.getElementById('btn-confirmer-depot').addEventListener('click', () => {
            this.effectuerDepot();
        });
        
        // Chargement transaction manuelle
        document.getElementById('btn-charger-transaction').addEventListener('click', () => {
            this.chargerTransaction();
        });
        
        document.getElementById('transaction-id').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.chargerTransaction();
        });
        
        // Actions transaction
        document.getElementById('btn-payer').addEventListener('click', () => {
            this.effectuerPaiement();
        });
        
        document.getElementById('btn-annuler-transaction').addEventListener('click', () => {
            this.annulerTransaction();
        });
    }
    
    async testerConnexionServeur() {
        try {
            const response = await fetch(`${this.API_URL}/api/health`);
            if (!response.ok) throw new Error('Serveur non disponible');
            
            const result = await response.json();
            this.estConnecte = true;
            this.mettreAJourStatutConnexion(true);
            return true;
        } catch (error) {
            console.error('❌ Erreur connexion serveur:', error);
            this.estConnecte = false;
            this.mettreAJourStatutConnexion(false);
            return false;
        }
    }
    
    mettreAJourStatutConnexion(connecte) {
        const statutElement = document.getElementById('connection-status');
        
        if (connecte) {
            statutElement.innerHTML = '<div class="status-dot"></div><span>Connecté au serveur</span>';
            statutElement.classList.remove('error');
        } else {
            statutElement.innerHTML = '<div class="status-dot"></div><span>Hors ligne</span>';
            statutElement.classList.add('error');
        }
    }
    
    selectionnerOperateur(operateur) {
        this.operateurSelectionne = operateur;
        
        // Mettre à jour l'interface
        document.querySelectorAll('.operateur-card').forEach(card => {
            card.classList.remove('selected');
        });
        document.querySelector(`[data-operateur="${operateur}"]`).classList.add('selected');
        
        this.calculerFrais();
    }
    
    selectionnerMontantRapide(montant) {
        this.montantSelectionne = parseInt(montant);
        
        // Mettre à jour l'interface
        document.querySelectorAll('.montant-rapide').forEach(btn => {
            btn.classList.remove('selected');
        });
        document.querySelector(`[data-montant="${montant}"]`).classList.add('selected');
        
        // Mettre à jour l'input
        document.getElementById('montant-input').value = montant;
        
        this.calculerFrais();
    }
    
    selectionnerMontantPersonnalise(montant) {
        this.montantSelectionne = parseInt(montant) || 0;
        
        // Désélectionner les montants rapides
        document.querySelectorAll('.montant-rapide').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        this.calculerFrais();
    }
    
    calculerFrais() {
        if (!this.operateurSelectionne || this.montantSelectionne <= 0) {
            document.getElementById('btn-confirmer-depot').disabled = true;
            return;
        }
        
        const operateur = OPERATEURS[this.operateurSelectionne];
        const frais = Math.round(this.montantSelectionne * operateur.frais);
        const total = this.montantSelectionne + frais;
        
        // Mettre à jour le résumé
        document.getElementById('summary-montant').textContent = 
            this.montantSelectionne.toLocaleString() + ' FCFA';
        document.getElementById('summary-frais').textContent = 
            frais.toLocaleString() + ' FCFA';
        document.getElementById('summary-total').textContent = 
            total.toLocaleString() + ' FCFA';
        
        // Activer le bouton
        document.getElementById('btn-confirmer-depot').disabled = false;
    }
    
    async effectuerDepot() {
        if (!this.estConnecte) {
            this.afficherNotification('❌ Impossible de se connecter au serveur', 'error');
            return;
        }
        
        if (!this.operateurSelectionne || this.montantSelectionne <= 0) {
            this.afficherNotification('❌ Veuillez sélectionner un opérateur et un montant', 'error');
            return;
        }
        
        try {
            // Simulation de dépôt (dans la vraie app, intégration avec l'API de l'opérateur)
            this.afficherNotification(`⏳ Simulation de dépôt ${this.montantSelectionne} FCFA via ${this.operateurSelectionne.toUpperCase()}...`, 'info');
            
            // Attendre 2 secondes pour simuler le traitement
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Appeler l'API pour recharger le solde
            const response = await fetch(`${this.API_URL}/api/solde/utilisateur/recharger`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    montant: this.montantSelectionne 
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.soldeUtilisateur = result.nouveauSolde;
                this.mettreAJourSolde();
                this.afficherNotification(`✅ Dépôt réussi! +${this.montantSelectionne.toLocaleString()} FCFA`, 'success');
                
                // Réinitialiser le formulaire
                this.reinitialiserFormulaireDepot();
                this.changerSection('scanner');
                
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Erreur dépôt:', error);
            this.afficherNotification('❌ Erreur lors du dépôt: ' + error.message, 'error');
        }
    }
    
    reinitialiserFormulaireDepot() {
        this.operateurSelectionne = null;
        this.montantSelectionne = 0;
        
        document.querySelectorAll('.operateur-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        document.querySelectorAll('.montant-rapide').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        document.getElementById('montant-input').value = '';
        document.getElementById('btn-confirmer-depot').disabled = true;
        
        document.getElementById('summary-montant').textContent = '0 FCFA';
        document.getElementById('summary-frais').textContent = '0 FCFA';
        document.getElementById('summary-total').textContent = '0 FCFA';
    }
    
    async demarrerScanner() {
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
            
            this.scannerQRCode();
            
        } catch (error) {
            console.error('❌ Erreur accès caméra:', error);
            this.afficherNotification('📷 Impossible d\'accéder à la caméra', 'error');
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
                        if (data.transactionId) {
                            this.jouerSon('scan');
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
            this.afficherNotification('❌ Veuillez saisir un ID de transaction', 'error');
            return;
        }
        
        if (!this.estConnecte) {
            this.afficherNotification('❌ Impossible de se connecter au serveur', 'error');
            return;
        }
        
        try {
            this.afficherNotification('🔍 Chargement de la transaction...', 'info');
            
            const response = await fetch(`${this.API_URL}/api/transaction/${id}`);
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.transactionActuelle = result.data;
                this.afficherDetailsTransaction();
                this.changerSection('transaction');
                this.afficherNotification('✅ Transaction chargée avec succès', 'success');
            } else {
                throw new Error(result.error || 'Transaction non trouvée');
            }
        } catch (error) {
            console.error('Erreur chargement transaction:', error);
            this.afficherNotification('❌ ' + error.message, 'error');
        }
    }
    
    afficherDetailsTransaction() {
        if (!this.transactionActuelle) return;
        
        document.getElementById('detail-transaction-id').textContent = this.transactionActuelle.id;
        document.getElementById('detail-montant').textContent = 
            Math.round(this.transactionActuelle.montant).toLocaleString() + ' FCFA';
        
        const statutElement = document.getElementById('detail-statut');
        statutElement.textContent = this.getStatutText(this.transactionActuelle.statut);
        statutElement.className = 'statut-badge ' + this.transactionActuelle.statut;
        
        this.afficherBoissonsTransaction();
        
        // Activer/désactiver le bouton de paiement
        const btnPayer = document.getElementById('btn-payer');
        btnPayer.disabled = this.transactionActuelle.statut !== 'en_attente';
    }
    
    afficherBoissonsTransaction() {
        const listeElement = document.getElementById('liste-boissons');
        listeElement.innerHTML = '';
        
        if (this.transactionActuelle.boissons && Array.isArray(this.transactionActuelle.boissons)) {
            this.transactionActuelle.boissons.forEach(boisson => {
                const item = document.createElement('div');
                item.className = 'item-boisson';
                item.innerHTML = `
                    <span>${boisson.icone || '🥤'} ${boisson.nom}</span>
                    <span>${boisson.prix ? boisson.prix.toLocaleString() : '0'} FCFA</span>
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
            this.afficherNotification('❌ Impossible de se connecter au serveur', 'error');
            return;
        }
        
        try {
            this.afficherNotification('💳 Traitement du paiement...', 'info');
            
            const response = await fetch(`${this.API_URL}/api/transaction/${this.transactionActuelle.id}/payer`, {
                method: 'POST'
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.soldeUtilisateur = result.nouveauSoldeUtilisateur;
                this.mettreAJourSolde();
                this.ajouterAHistorique(this.transactionActuelle);
                this.jouerSon('success');
                this.afficherConfirmationPaiement(result.data);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Erreur paiement:', error);
            this.afficherNotification('❌ Erreur de paiement: ' + error.message, 'error');
        }
    }
    
    afficherConfirmationPaiement(transaction) {
        document.getElementById('modal-transaction-id').textContent = transaction.id;
        document.getElementById('modal-montant').textContent = 
            Math.round(transaction.montant).toLocaleString() + ' FCFA';
        document.getElementById('modal-solde').textContent = 
            Math.round(this.soldeUtilisateur).toLocaleString() + ' FCFA';
        
        this.afficherModal();
    }
    
    afficherModal() {
        document.getElementById('confirmation-modal').classList.add('active');
    }
    
    cacherModal() {
        document.getElementById('confirmation-modal').classList.remove('active');
    }
    
    annulerTransaction() {
        this.changerSection('scanner');
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
            console.error('Erreur chargement solde:', error);
        }
    }
    
    mettreAJourSolde() {
        document.getElementById('solde-utilisateur').textContent = 
            Math.round(this.soldeUtilisateur).toLocaleString() + ' FCFA';
        
        document.getElementById('last-update').textContent = 'Maintenant';
    }
    
    ajouterAHistorique(transaction) {
        this.historique.unshift({
            ...transaction,
            date: new Date().toISOString(),
            type: 'paiement'
        });
        
        // Garder seulement les 20 dernières transactions
        if (this.historique.length > 20) {
            this.historique = this.historique.slice(0, 20);
        }
        
        this.mettreAJourHistorique();
    }
    
    mettreAJourHistorique() {
        const historiqueElement = document.getElementById('historique-transactions');
        const statTotal = document.getElementById('stat-total');
        const statMontantTotal = document.getElementById('stat-montant-total');
        
        // Mettre à jour les stats
        statTotal.textContent = this.historique.length;
        
        const montantTotal = this.historique.reduce((sum, transaction) => {
            return sum + (transaction.montant || 0);
        }, 0);
        
        statMontantTotal.textContent = Math.round(montantTotal).toLocaleString() + ' FCFA';
        
        // Mettre à jour la liste
        if (this.historique.length === 0) {
            historiqueElement.innerHTML = `
                <div class="historique-vide">
                    <div class="empty-icon">📊</div>
                    <p>Aucune transaction pour le moment</p>
                    <p class="empty-sub">Vos transactions apparaîtront ici</p>
                </div>
            `;
        } else {
            historiqueElement.innerHTML = '';
            this.historique.forEach(transaction => {
                const item = document.createElement('div');
                item.className = `transaction-historique ${transaction.statut}`;
                item.innerHTML = `
                    <div>
                        <div style="font-weight: 600;">${transaction.id}</div>
                        <div style="font-size: 0.8rem; color: var(--text-light);">
                            ${new Date(transaction.date).toLocaleDateString()}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 600; color: var(--primary-color);">
                            ${Math.round(transaction.montant || 0).toLocaleString()} FCFA
                        </div>
                        <div style="font-size: 0.8rem; color: var(--text-light);">
                            ${this.getStatutText(transaction.statut)}
                        </div>
                    </div>
                `;
                historiqueElement.appendChild(item);
            });
        }
    }
    
    async chargerHistorique() {
        // Simulation - dans une vraie app, charger depuis l'API
        this.historique = [
            {
                id: 'TXABC123',
                montant: 1200,
                statut: 'paye',
                date: new Date(Date.now() - 86400000).toISOString(),
                type: 'paiement'
            },
            {
                id: 'TXDEF456',
                montant: 600,
                statut: 'annule',
                date: new Date(Date.now() - 172800000).toISOString(),
                type: 'paiement'
            }
        ];
        
        this.mettreAJourHistorique();
    }
    
    jouerSon(type) {
        const audio = document.getElementById(`sound-${type}`);
        if (audio) {
            audio.currentTime = 0;
            audio.play().catch(e => console.log('Son non joué:', e));
        }
    }
    
    afficherNotification(message, type = 'info') {
        // Créer une notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
            color: white;
            padding: 15px 20px;
            border-radius: 12px;
            font-weight: 600;
            z-index: 10000;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            animation: notificationSlideIn 0.3s ease;
            max-width: 300px;
            text-align: center;
        `;
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'notificationSlideOut 0.3s ease';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Initialiser l'application
document.addEventListener('DOMContentLoaded', function() {
    window.ctlPayApp = new CTLPayApp();
});

// Ajouter les animations CSS pour les notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes notificationSlideIn {
        from {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
        }
        to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
    }
    @keyframes notificationSlideOut {
        from {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
        to {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
        }
    }
`;
document.head.appendChild(style);
