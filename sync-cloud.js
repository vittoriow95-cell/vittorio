/* ===========================================================
   SINCRONIZZAZIONE DATI CLOUD CON MONGODB
   =========================================================== */

let utenteLoggato = null;
let sincroinCorso = false;
let cloudReady = false;
let cloudHasData = false;
const AUTO_CLOUD_USERNAME_KEY = 'haccp_cloud_username';
const AUTO_CLOUD_DEFAULT = 'il rifugio della volpe';
const RENDER_CLOUD_URL_DEFAULT = 'https://vittorio-az8f.onrender.com';
const RENDER_CLOUD_URL_KEY = 'haccp_render_url';
const SEDE_PARAM_KEY = 'sede';
const SEDE_MAP = {
    macelleria: 'il rifugio della volpe',
    braceria: 'braceria volpe'
};

const CLOUD_STORAGE_KEYS = {
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
    prodottiAdmin: 'haccp_prodotti_admin',
    elencoNomi: 'haccp_elenco_nomi',
    ccp: 'haccp_ccp',
    configStampa: 'haccp_config_stampa',
    configPec: 'haccp_pec_accounts',
    ingredienti: 'haccp_ingredienti',
    fotoLotti: 'haccp_foto_lotti',
    tempNC: 'haccp_temp_nc',
    ordini: 'haccp_ordini',
    ricette: 'haccp_ricette',
    reportPdf: 'haccp_report_pdf_config',
    firma: 'haccp_signature_canvas',
    layout: 'haccp_layout_positions',
    notifSmart: 'haccp_notif_smart',
    pecAutoscan: 'haccp_pec_autoscan',
    pecIntervallo: 'haccp_pec_intervallo',
    alertEmail: 'haccp_config_alert_email',
    alertWhatsapp: 'haccp_config_alert_whatsapp'
};

const CLOUD_STORAGE_VALUES = Object.values(CLOUD_STORAGE_KEYS);

function mostraNotificaSafe(testo, tipo) {
    if (typeof mostraNotifica === 'function') {
        mostraNotifica(testo, tipo);
        return;
    }
    console.log(`[${tipo || 'info'}] ${testo}`);
}

function getRenderCloudUrl() {
    const saved = (localStorage.getItem(RENDER_CLOUD_URL_KEY) || '').trim();
    return saved || RENDER_CLOUD_URL_DEFAULT;
}

function setRenderCloudUrl(value) {
    const next = String(value || '').trim();
    if (next) {
        localStorage.setItem(RENDER_CLOUD_URL_KEY, next);
    }
}

// Controlla se utente è loggato
function isLoggato() {
    if (!utenteLoggato) {
        utenteLoggato = sessionStorage.getItem('haccp_username');
    }
    return !!utenteLoggato;
}

function getSedeDaUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        const sedeRaw = (params.get(SEDE_PARAM_KEY) || '').trim().toLowerCase();
        return SEDE_MAP[sedeRaw] || '';
    } catch (err) {
        return '';
    }
}

function impostaUtenteCloudAutomatico() {
    const sedeDaUrl = getSedeDaUrl();
    const usernameSalvato = sedeDaUrl || localStorage.getItem(AUTO_CLOUD_USERNAME_KEY) || AUTO_CLOUD_DEFAULT;
    utenteLoggato = usernameSalvato;
    sessionStorage.setItem('haccp_username', usernameSalvato);
}

// Aggiorna barra utente cloud
function aggiornaBarraCloudUser() {
    const barra = document.getElementById('cloud-user-bar');
    const usernameDisplay = document.getElementById('cloud-username-display');
    const syncStatus = document.getElementById('cloud-sync-status');
    
    if (isLoggato()) {
        barra.style.display = 'flex';
        usernameDisplay.textContent = utenteLoggato;

        const logoutButton = barra.querySelector('button');
        if (logoutButton) {
            logoutButton.style.display = 'none';
        }
        
        const ultimoSync = localStorage.getItem('haccp_ultimo_sync');
        if (ultimoSync) {
            const data = new Date(ultimoSync);
            syncStatus.textContent = '✅ Sync: ' + data.toLocaleTimeString('it-IT', {hour: '2-digit', minute: '2-digit'});
        }
        
        // Sposta corpo più in basso per compensare barra fissa
        document.body.style.paddingTop = '8px';
    } else {
        barra.style.display = 'none';
        document.body.style.paddingTop = '0';
    }
}

// Logout
function effettuaLogout() {
    mostraNotificaSafe('☁️ Accesso cloud automatico attivo', 'info');
}

// Mostra schermata login/registrazione
function mostraLogin() {
    impostaUtenteCloudAutomatico();
    aggiornaBarraCloudUser();
    caricaDatiDaCloud({ force: true });
    return;

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
            await caricaDatiDaCloud({ force: true });
            
            mostraNotificaSafe('✅ Benvenuto, ' + username + '!', 'success');
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
            mostraNotificaSafe('✅ Account creato! Ora effettua il login', 'success');
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
            utenti: localStorage.getItem(CLOUD_STORAGE_KEYS.utenti),
            frigo: localStorage.getItem(CLOUD_STORAGE_KEYS.frigo),
            temperature: localStorage.getItem(CLOUD_STORAGE_KEYS.temperature),
            lotti: localStorage.getItem(CLOUD_STORAGE_KEYS.lotti),
            nc: localStorage.getItem(CLOUD_STORAGE_KEYS.nc),
            sanificazione: localStorage.getItem(CLOUD_STORAGE_KEYS.sanificazione),
            attrezzature: localStorage.getItem(CLOUD_STORAGE_KEYS.attrezzature),
            fornitori: localStorage.getItem(CLOUD_STORAGE_KEYS.fornitori),
            allergeni: localStorage.getItem(CLOUD_STORAGE_KEYS.allergeni),
            formazione: localStorage.getItem(CLOUD_STORAGE_KEYS.formazione),
            inventario: localStorage.getItem(CLOUD_STORAGE_KEYS.inventario),
            prodottiAdmin: localStorage.getItem(CLOUD_STORAGE_KEYS.prodottiAdmin),
            elencoNomi: localStorage.getItem(CLOUD_STORAGE_KEYS.elencoNomi),
            ccp: localStorage.getItem(CLOUD_STORAGE_KEYS.ccp),
            configStampa: localStorage.getItem(CLOUD_STORAGE_KEYS.configStampa),
            configPec: localStorage.getItem(CLOUD_STORAGE_KEYS.configPec),
            ingredienti: localStorage.getItem(CLOUD_STORAGE_KEYS.ingredienti),
            fotoLotti: localStorage.getItem(CLOUD_STORAGE_KEYS.fotoLotti),
            tempNC: localStorage.getItem(CLOUD_STORAGE_KEYS.tempNC),
            ordini: localStorage.getItem(CLOUD_STORAGE_KEYS.ordini),
            ricette: localStorage.getItem(CLOUD_STORAGE_KEYS.ricette),
            reportPdf: localStorage.getItem(CLOUD_STORAGE_KEYS.reportPdf),
            firma: localStorage.getItem(CLOUD_STORAGE_KEYS.firma),
            layout: localStorage.getItem(CLOUD_STORAGE_KEYS.layout),
            notifSmart: localStorage.getItem(CLOUD_STORAGE_KEYS.notifSmart),
            pecAutoscan: localStorage.getItem(CLOUD_STORAGE_KEYS.pecAutoscan),
            pecIntervallo: localStorage.getItem(CLOUD_STORAGE_KEYS.pecIntervallo),
            alertEmail: localStorage.getItem(CLOUD_STORAGE_KEYS.alertEmail),
            alertWhatsapp: localStorage.getItem(CLOUD_STORAGE_KEYS.alertWhatsapp),
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
async function caricaDatiDaCloud(options = {}) {
    if (!isLoggato()) return;
    
    try {
        const response = await fetch('/api/load-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: utenteLoggato })
        });
        
        const risultato = await response.json();
        
        if (risultato.success && risultato.dati) {
            applicaDatiCloud(risultato.dati, options);
            console.log('✅ Dati caricati dal cloud');
            cloudReady = true;
            cloudHasData = true;
            mostraNotificaSafe('📥 Dati caricati dal cloud (sorgente Render)', 'success');
        } else if (risultato.nuovoUtente) {
            cloudReady = true;
            cloudHasData = false;
            mostraNotificaSafe('ℹ️ Nessun dato cloud per questo utente', 'warning');
        }
    } catch (error) {
        cloudReady = false;
        console.error('❌ Errore caricamento dati:', error);
        mostraNotificaSafe('❌ Sync cloud fallita: controlla rete o username', 'error');
    }
}

function applicaDatiCloud(dati, options = {}) {
    if (options.force) {
        CLOUD_STORAGE_VALUES.forEach((key) => localStorage.removeItem(key));
    }

    const resolveStorageKey = (chiave) => {
        if (chiave === 'prodotti' || chiave === 'prodotti_admin') return CLOUD_STORAGE_KEYS.prodottiAdmin;
        if (chiave === 'elenco_prodotti' || chiave === 'elencoNomiProdotti') return CLOUD_STORAGE_KEYS.elencoNomi;
        return CLOUD_STORAGE_KEYS[chiave] || `haccp_${chiave}`;
    };

    const normalizeValue = (valore) => {
        if (valore === null || valore === undefined) return null;
        if (typeof valore === 'string') return valore;
        try {
            return JSON.stringify(valore);
        } catch (error) {
            return String(valore);
        }
    };

    for (const [chiave, valore] of Object.entries(dati || {})) {
        if (chiave === 'ultimoSync') continue;
        const storageKey = resolveStorageKey(chiave);
        const normalized = normalizeValue(valore);
        if (normalized === null) {
            localStorage.removeItem(storageKey);
        } else {
            localStorage.setItem(storageKey, normalized);
        }
    }

    const prodottiRaw = localStorage.getItem(CLOUD_STORAGE_KEYS.prodottiAdmin);
    const elencoRaw = localStorage.getItem(CLOUD_STORAGE_KEYS.elencoNomi);
    let prodottiParsed = [];
    try {
        prodottiParsed = JSON.parse(prodottiRaw || '[]');
    } catch (error) {
        prodottiParsed = [];
    }
    let elencoParsed = [];
    try {
        elencoParsed = JSON.parse(elencoRaw || '[]');
    } catch (error) {
        elencoParsed = [];
    }
    if ((!Array.isArray(prodottiParsed) || prodottiParsed.length === 0) && Array.isArray(elencoParsed) && elencoParsed.length > 0) {
        const ricostruiti = elencoParsed.map((nome) => ({
            nome: String(nome || '').trim(),
            giorniScadenza: 3
        })).filter((p) => p.nome);
        localStorage.setItem(CLOUD_STORAGE_KEYS.prodottiAdmin, JSON.stringify(ricostruiti));
    }

    if (typeof ricaricaCacheLocali === 'function') ricaricaCacheLocali();
    if (typeof aggiornaListaUtenti === 'function') aggiornaListaUtenti();
    if (typeof aggiornaListaFrigo === 'function') aggiornaListaFrigo();
    if (typeof renderizzaLotti === 'function') renderizzaLotti();
    if (typeof renderizzaListaIngredienti === 'function') renderizzaListaIngredienti();
    if (typeof renderizzaFotoLotti === 'function') renderizzaFotoLotti();
    if (typeof renderTempNCList === 'function') renderTempNCList();
    if (typeof renderizzaProdottiAdmin === 'function') renderizzaProdottiAdmin();
    if (typeof renderizzaListaProdottiAssocia === 'function') renderizzaListaProdottiAssocia();
}

async function importaDatiDaRender() {
    const inputUrl = document.getElementById('render-url-input');
    if (inputUrl) setRenderCloudUrl(inputUrl.value);

    const baseUrl = getRenderCloudUrl().replace(/\/+$/, '');
    const username = (sessionStorage.getItem('haccp_username') || AUTO_CLOUD_DEFAULT).trim();

    if (!baseUrl) {
        mostraNotificaSafe('❌ URL Render mancante', 'error');
        return;
    }

    mostraNotificaSafe('☁️ Importazione dati da Render...', 'info');

    try {
        const response = await fetch(`${baseUrl}/api/load-data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });

        const risultato = await response.json();
        if (risultato.success && risultato.dati) {
            applicaDatiCloud(risultato.dati, { force: true });
            cloudReady = true;
            cloudHasData = true;
            mostraNotificaSafe('✅ Dati Render importati nel PC', 'success');
            return;
        }

        if (risultato.nuovoUtente) {
            cloudReady = true;
            cloudHasData = false;
            mostraNotificaSafe('⚠️ Nessun dato trovato su Render', 'warning');
            return;
        }

        mostraNotificaSafe('❌ Import fallito: risposta non valida', 'error');
    } catch (error) {
        cloudReady = false;
        console.error('❌ Import Render fallito:', error);
        mostraNotificaSafe('❌ Import Render fallito: controlla rete', 'error');
    }
}

// Auto-salvataggio ogni 30 secondi
setInterval(() => {
    if (isLoggato() && cloudReady) {
        salvaDatiSuCloud();
    }
}, 30000);

// Salva prima di chiudere la pagina
window.addEventListener('beforeunload', () => {
    if (isLoggato() && cloudReady) {
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
        setTimeout(mostraLogin, 200);
    } else {
        // Mostra barra utente e carica dati
        aggiornaBarraCloudUser();
        caricaDatiDaCloud({ force: true });
    }

    const renderUrlInput = document.getElementById('render-url-input');
    if (renderUrlInput) {
        renderUrlInput.value = getRenderCloudUrl();
    }
});
