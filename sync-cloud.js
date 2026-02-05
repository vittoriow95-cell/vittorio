/* ===========================================================
   SINCRONIZZAZIONE DATI CLOUD CON MONGODB
   =========================================================== */

let utenteLoggato = null;
let sincroinCorso = false;

// Controlla se utente è loggato
function isLoggato() {
    if (!utenteLoggato) {
        utenteLoggato = sessionStorage.getItem('haccp_username');
    }
    return !!utenteLoggato;
}

// Aggiorna barra utente cloud
function aggiornaBarraCloudUser() {
    const barra = document.getElementById('cloud-user-bar');
    const usernameDisplay = document.getElementById('cloud-username-display');
    const syncStatus = document.getElementById('cloud-sync-status');
    
    if (isLoggato()) {
        barra.style.display = 'flex';
        usernameDisplay.textContent = utenteLoggato;
        
        const ultimoSync = localStorage.getItem('haccp_ultimo_sync');
        if (ultimoSync) {
            const data = new Date(ultimoSync);
            syncStatus.textContent = '✅ Sync: ' + data.toLocaleTimeString('it-IT', {hour: '2-digit', minute: '2-digit'});
        }
        
        // Sposta corpo più in basso per compensare barra fissa
        document.body.style.paddingTop = '50px';
    } else {
        barra.style.display = 'none';
        document.body.style.paddingTop = '0';
    }
}

// Logout
function effettuaLogout() {
    if (confirm('Vuoi uscire dal tuo account cloud? I dati locali saranno mantenuti.')) {
        sessionStorage.removeItem('haccp_username');
        utenteLoggato = null;
        
        // Resetta interfaccia
        document.body.style.paddingTop = '0';
        document.getElementById('cloud-user-bar').style.display = 'none';
        
        mostraNotifica('👋 Logout effettuato', 'success');
        
        // Mostra login dopo 500ms
        setTimeout(mostraLogin, 500);
    }
}

// Mostra schermata login/registrazione
function mostraLogin() {
    const overlay = document.createElement('div');
    overlay.id = 'login-overlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.95); z-index: 10000;
        display: flex; align-items: center; justify-content: center;
    `;
    
    overlay.innerHTML = `
        <div style="background: #1a1a1a; padding: 40px; border-radius: 16px; max-width: 400px; width: 90%;">
            <h2 style="text-align: center; margin-bottom: 30px; color: #0A84FF;">
                🔐 Accedi al tuo account HACCP
            </h2>
            
            <div id="login-form">
                <input type="text" id="login-username" placeholder="Username" 
                    style="width: 100%; padding: 12px; margin-bottom: 15px; background: #2a2a2a; border: 1px solid #444; border-radius: 8px; color: white; font-size: 16px;">
                
                <input type="password" id="login-password" placeholder="Password"
                    style="width: 100%; padding: 12px; margin-bottom: 20px; background: #2a2a2a; border: 1px solid #444; border-radius: 8px; color: white; font-size: 16px;">
                
                <button onclick="effettuaLogin()" 
                    style="width: 100%; padding: 14px; background: #0A84FF; border: none; border-radius: 8px; color: white; font-size: 16px; font-weight: 600; cursor: pointer; margin-bottom: 10px;">
                    Accedi
                </button>
                
                <button onclick="mostraRegistrazione()" 
                    style="width: 100%; padding: 14px; background: #2a2a2a; border: 1px solid #444; border-radius: 8px; color: white; font-size: 14px; cursor: pointer;">
                    Crea nuovo account
                </button>
                
                <div id="login-error" style="margin-top: 15px; color: #FF453A; text-align: center; display: none;"></div>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    document.getElementById('login-username').focus();
    
    // Enter per login
    document.getElementById('login-password').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') effettuaLogin();
    });
}

// Login
async function effettuaLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');
    
    if (!username || !password) {
        errorDiv.textContent = 'Inserisci username e password';
        errorDiv.style.display = 'block';
        return;
    }
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            utenteLoggato = username;
            sessionStorage.setItem('haccp_username', username);
            
            // Rimuovi overlay
            document.getElementById('login-overlay').remove();
            
            // Aggiorna barra utente
            aggiornaBarraCloudUser();
            
            // Carica dati dal cloud
            await caricaDatiDaCloud();
            
            mostraNotifica('✅ Benvenuto, ' + username + '!', 'success');
        } else {
            errorDiv.textContent = data.error || 'Login fallito';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        errorDiv.textContent = 'Errore di connessione';
        errorDiv.style.display = 'block';
        console.error('Errore login:', error);
    }
}

// Mostra form registrazione
function mostraRegistrazione() {
    const overlay = document.getElementById('login-overlay');
    overlay.querySelector('div').innerHTML = `
        <h2 style="text-align: center; margin-bottom: 30px; color: #0A84FF;">
            📝 Crea nuovo account
        </h2>
        
        <div id="register-form">
            <input type="text" id="reg-username" placeholder="Username (min 3 caratteri)" 
                style="width: 100%; padding: 12px; margin-bottom: 15px; background: #2a2a2a; border: 1px solid #444; border-radius: 8px; color: white; font-size: 16px;">
            
            <input type="password" id="reg-password" placeholder="Password (min 6 caratteri)"
                style="width: 100%; padding: 12px; margin-bottom: 15px; background: #2a2a2a; border: 1px solid #444; border-radius: 8px; color: white; font-size: 16px;">
            
            <input type="email" id="reg-email" placeholder="Email (opzionale)"
                style="width: 100%; padding: 12px; margin-bottom: 20px; background: #2a2a2a; border: 1px solid #444; border-radius: 8px; color: white; font-size: 16px;">
            
            <button onclick="effettuaRegistrazione()" 
                style="width: 100%; padding: 14px; background: #30D158; border: none; border-radius: 8px; color: white; font-size: 16px; font-weight: 600; cursor: pointer; margin-bottom: 10px;">
                Registrati
            </button>
            
            <button onclick="document.getElementById('login-overlay').remove(); mostraLogin();" 
                style="width: 100%; padding: 14px; background: #2a2a2a; border: 1px solid #444; border-radius: 8px; color: white; font-size: 14px; cursor: pointer;">
                ← Torna al login
            </button>
            
            <div id="register-error" style="margin-top: 15px; color: #FF453A; text-align: center; display: none;"></div>
        </div>
    `;
    
    document.getElementById('reg-username').focus();
}

// Registrazione
async function effettuaRegistrazione() {
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    const email = document.getElementById('reg-email').value.trim();
    const errorDiv = document.getElementById('register-error');
    
    if (!username || username.length < 3) {
        errorDiv.textContent = 'Username deve essere almeno 3 caratteri';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (!password || password.length < 6) {
        errorDiv.textContent = 'Password deve essere almeno 6 caratteri';
        errorDiv.style.display = 'block';
        return;
    }
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, email })
        });
        
        const data = await response.json();
        
        if (data.success) {
            mostraNotifica('✅ Account creato! Ora effettua il login', 'success');
            document.getElementById('login-overlay').remove();
            mostraLogin();
        } else {
            errorDiv.textContent = data.error || 'Registrazione fallita';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        errorDiv.textContent = 'Errore di connessione';
        errorDiv.style.display = 'block';
        console.error('Errore registrazione:', error);
    }
}

// Salva TUTTI i dati sul cloud
async function salvaDatiSuCloud() {
    if (!isLoggato()) return;
    if (sincroinCorso) return;
    
    sincroinCorso = true;
    
    try {
        // Raccogli TUTTI i dati da localStorage
        const dati = {
            utenti: localStorage.getItem('haccp_utenti'),
            frigo: localStorage.getItem('haccp_frigo'),
            temperature: localStorage.getItem('haccp_log'),
            lotti: localStorage.getItem('haccp_lotti'),
            nc: localStorage.getItem('haccp_nc'),
            sanificazione: localStorage.getItem('haccp_sanificazione'),
            attrezzature: localStorage.getItem('haccp_attrezzature'),
            fornitori: localStorage.getItem('haccp_fornitori'),
            allergeni: localStorage.getItem('haccp_allergeni'),
            formazione: localStorage.getItem('haccp_formazione'),
            inventario: localStorage.getItem('haccp_inventario'),
            elencoNomi: localStorage.getItem('haccp_elenco_nomi'),
            ccp: localStorage.getItem('haccp_ccp'),
            configStampa: localStorage.getItem('haccp_config_stampa'),
            configPec: localStorage.getItem('haccp_pec_accounts'),
            ultimoSync: new Date().toISOString()
        };
        
        const response = await fetch('/api/save-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: utenteLoggato, dati })
        });
        
        const risultato = await response.json();
        
        if (risultato.success) {
            console.log('✅ Dati sincronizzati sul cloud');
            localStorage.setItem('haccp_ultimo_sync', risultato.timestamp || new Date().toISOString());
            aggiornaBarraCloudUser(); // Aggiorna stato sync
        }
    } catch (error) {
        console.error('❌ Errore sincronizzazione:', error);
    } finally {
        sincroinCorso = false;
    }
}

// Carica dati dal cloud
async function caricaDatiDaCloud() {
    if (!isLoggato()) return;
    
    try {
        const response = await fetch('/api/load-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: utenteLoggato })
        });
        
        const risultato = await response.json();
        
        if (risultato.success && risultato.dati) {
            const keyMap = {
                utenti: 'haccp_utenti',
                frigo: 'haccp_frigo',
                temperature: 'haccp_log',
                lotti: 'haccp_lotti',
                nc: 'haccp_nc',
                sanificazione: 'haccp_sanificazione',
                attrezzature: 'haccp_attrezzature',
                fornitori: 'haccp_fornitori',
                allergeni: 'haccp_allergeni',
                formazione: 'haccp_formazione',
                inventario: 'haccp_inventario',
                elencoNomi: 'haccp_elenco_nomi',
                ccp: 'haccp_ccp',
                configStampa: 'haccp_config_stampa',
                configPec: 'haccp_pec_accounts'
            };

            // Ripristina TUTTI i dati
            for (const [chiave, valore] of Object.entries(risultato.dati)) {
                if (chiave !== 'ultimoSync' && valore) {
                    const storageKey = keyMap[chiave] || `haccp_${chiave}`;
                    localStorage.setItem(storageKey, valore);
                }
            }
            
            console.log('✅ Dati caricati dal cloud');
            
            // Ricarica interfaccia
            if (typeof aggiornaListaUtenti === 'function') aggiornaListaUtenti();
            if (typeof aggiornaListaFrigo === 'function') aggiornaListaFrigo();
            if (typeof renderizzaLotti === 'function') renderizzaLotti();
            
            mostraNotifica('📥 Dati caricati dal cloud', 'success');
        } else if (risultato.nuovoUtente) {
            console.log('ℹ️ Nuovo utente - nessun dato da caricare');
        }
    } catch (error) {
        console.error('❌ Errore caricamento dati:', error);
    }
}

// Auto-salvataggio ogni 30 secondi
setInterval(() => {
    if (isLoggato()) {
        salvaDatiSuCloud();
    }
}, 30000);

// Salva prima di chiudere la pagina
window.addEventListener('beforeunload', () => {
    if (isLoggato()) {
        navigator.sendBeacon('/api/save-data', JSON.stringify({
            username: utenteLoggato,
            dati: {
                lotti: localStorage.getItem('haccp_lotti'),
                temperature: localStorage.getItem('haccp_log'),
                ultimoSync: new Date().toISOString()
            }
        }));
    }
});

// Mostra login all'avvio se non loggato
window.addEventListener('DOMContentLoaded', () => {
    if (!isLoggato()) {
        setTimeout(mostraLogin, 500);
    } else {
        // Mostra barra utente e carica dati
        aggiornaBarraCloudUser();
        caricaDatiDaCloud();
    }
});
