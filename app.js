/* ===========================================================
   1. CONFIGURAZIONE E CARICAMENTO DATI INIZIALI
   =========================================================== */

const PIN_ADMIN = "9999";

// Recuperiamo gli utenti salvati o creiamo un elenco vuoto se è la prima volta
let databaseUtenti = JSON.parse(localStorage.getItem("haccp_utenti")) || [];
let databaseFrigo = JSON.parse(localStorage.getItem("haccp_frigo")) || [];
let databaseTemperature = JSON.parse(localStorage.getItem("haccp_log")) || [];
let databaseLotti = JSON.parse(localStorage.getItem("haccp_lotti")) || [];
let elencoNomiProdotti = JSON.parse(localStorage.getItem("haccp_elenco_nomi")) || [];
let databaseIngredienti = JSON.parse(localStorage.getItem("haccp_ingredienti")) || [];
let databaseFotoLotti = JSON.parse(localStorage.getItem("haccp_foto_lotti")) || [];
let prodottiAdmin = JSON.parse(localStorage.getItem('haccp_prodotti_admin')) || [];

// Controlli automatici all'avvio
setTimeout(() => {
    controlliAutomaticiAvvio();
}, 2000);

// Controlli periodici ogni ora
setInterval(() => {
    controlliAutomaticiAvvio();
}, 3600000); // 1 ora

// ========== SISTEMA NOTIFICHE BROWSER ==========
function richieidiPermessiNotifiche() {
    if ('Notification' in window && Notification.permission === 'default') {
        setTimeout(() => {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    mostraNotifica('✅ Notifiche attivate! Riceverai alert per scadenze e temperature', 'success');
                }
            });
        }, 5000);
    }
}

function inviaNotificaBrowser(titolo, messaggio, tipo = 'info') {
    if ('Notification' in window && Notification.permission === 'granted') {
        const icone = {
            'success': '✅',
            'warning': '⚠️',
            'error': '❌',
            'info': 'ℹ️',
            'critica': '🚨'
        };
        
        const notifica = new Notification(icone[tipo] + ' ' + titolo, {
            body: messaggio,
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="75" font-size="75">' + icone[tipo] + '</text></svg>',
            badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="75" font-size="75">' + icone[tipo] + '</text></svg>',
            requireInteraction: tipo === 'critica',
            silent: false
        });
        
        notifica.onclick = () => {
            window.focus();
            notifica.close();
        };
        
        // Chiudi automaticamente dopo 10 secondi (tranne critiche)
        if (tipo !== 'critica') {
            setTimeout(() => notifica.close(), 10000);
        }
    }
}

function controlliAutomaticiAvvio() {
    // Verifica scadenze prodotti
    const prodottiInScadenza = verificaScadenze();
    
    // Verifica manutenzioni in scadenza
    const attrezzature = JSON.parse(localStorage.getItem('haccp_attrezzature')) || [];
    const oggi = new Date();
    const manutenzioniScadenza = attrezzature.filter(a => {
        const prossima = new Date(a.prossimaManutenzione);
        const diffGiorni = Math.floor((prossima - oggi) / (1000 * 60 * 60 * 24));
        return diffGiorni >= 0 && diffGiorni <= 7;
    });
    
    // Verifica formazione in scadenza
    const formazione = JSON.parse(localStorage.getItem('haccp_formazione')) || [];
    const attestatiScadenza = formazione.filter(f => {
        const scadenza = new Date(f.dataScadenza);
        const diffGiorni = Math.floor((scadenza - oggi) / (1000 * 60 * 60 * 24));
        return diffGiorni >= 0 && diffGiorni <= 90;
    });
    
    // Verifica temperature critiche (ultime 24h)
    const temperatureCritiche = verificaTemperatureCritiche();
    
    // Notifiche browser + in-app
    if (temperatureCritiche > 0) {
        inviaNotificaBrowser('TEMPERATURE CRITICHE', `${temperatureCritiche} letture fuori range nelle ultime 24h!`, 'critica');
        mostraNotifica(`🌡️ ${temperatureCritiche} temperature CRITICHE!`, 'error');
    }
    
    if (prodottiInScadenza.critici > 0) {
        inviaNotificaBrowser('PRODOTTI SCADUTI', `${prodottiInScadenza.critici} prodotti scaduti o in scadenza oggi!`, 'critica');
    }
    
    if (prodottiInScadenza.imminenti > 0) {
        inviaNotificaBrowser('Scadenze Prossime', `${prodottiInScadenza.imminenti} prodotti in scadenza nei prossimi 3 giorni`, 'warning');
    }
    
    if (manutenzioniScadenza.length > 0) {
        mostraNotifica(`🔧 ${manutenzioniScadenza.length} manutenzioni in scadenza!`, 'warning');
        inviaNotificaBrowser('Manutenzioni in Scadenza', `${manutenzioniScadenza.length} attrezzature richiedono manutenzione`, 'warning');
    }
    
    if (attestatiScadenza.length > 0) {
        setTimeout(() => {
            mostraNotifica(`🎓 ${attestatiScadenza.length} attestati in scadenza!`, 'warning');
        }, 3000);
    }
}

function verificaTemperatureCritiche() {
    const temperature = JSON.parse(localStorage.getItem('haccp_log')) || [];
    const oggi = new Date();
    const ieri = new Date(oggi.getTime() - 24 * 60 * 60 * 1000);
    
    return temperature.filter(t => {
        const data = new Date(t.data);
        if (data < ieri) return false;

        if (t.temperaturaFrigo !== undefined || t.temperaturaFreezer !== undefined) {
            const tempFrigo = parseFloat(t.temperaturaFrigo);
            const tempFreezer = parseFloat(t.temperaturaFreezer);
            return (tempFrigo < 0 || tempFrigo > 4 || tempFreezer < -22 || tempFreezer > -18);
        }

        const valore = parseFloat(t.gradi);
        if (isNaN(valore)) return false;

        const frigo = databaseFrigo.find(f => f.nome === t.frigo);
        const tipo = frigo ? frigo.tipo : 'Positivo';
        if (tipo === 'Negativo') {
            return valore < -22 || valore > -18;
        }
        return valore < 0 || valore > 4;
    }).length;
}



/* ===========================================================
   2. SISTEMA LOGIN E AUTENTICAZIONE
   =========================================================== */

function logicaLogin() {
    renderizzaLoginUtenti();
}

function entraAdminDirect() {
    vaiA("sez-admin");
}

function entraOperatoreDaLista(index) {
    const utenteTrovato = databaseUtenti[index];
    if (!utenteTrovato) return;

    console.log("Accesso Utente: " + utenteTrovato.nome);
    sessionStorage.setItem('nomeUtenteLoggato', utenteTrovato.nome);

    const etichettaNome = document.getElementById("nome-operatore");
    if (etichettaNome) {
        etichettaNome.innerText = utenteTrovato.nome;
    }

    const btnExtra = document.getElementById("extra-resp");
    const labelRuolo = document.getElementById("ruolo-operatore");

    if (utenteTrovato.ruolo === "Responsabile") {
        if (btnExtra) btnExtra.style.display = "flex";
        if (labelRuolo) labelRuolo.innerText = "⭐ Responsabile Autocontrollo";
    } else {
        if (btnExtra) btnExtra.style.display = "none";
        if (labelRuolo) labelRuolo.innerText = "Operatore Incaricato";
    }

    aggiornaAssistente(utenteTrovato.nome);
    vaiA("sez-operatore");
}

function renderizzaLoginUtenti() {
    const container = document.getElementById("lista-utenti-login");
    if (!container) return;

    if (!databaseUtenti || databaseUtenti.length === 0) {
        container.innerHTML = '<p style="color:#888; text-align:center; width:100%;">Nessun utente. Aggiungilo dalle impostazioni Admin.</p>';
        return;
    }

    container.innerHTML = databaseUtenti.map((u, i) => {
        const badge = u.ruolo === "Responsabile" ? "⭐" : "";
        return `
            <button type="button" onclick="entraOperatoreDaLista(${i})" style="padding:12px; font-size:14px; background:#2b2b2b; border:1px solid #333; border-radius:10px; color:#fff; cursor:pointer;">
                ${badge} ${u.nome}
            </button>
        `;
    }).join('');
}

function logout() {
    sessionStorage.clear();
    location.reload();
}

/* ===========================================================
   SISTEMA TEMA DARK/LIGHT MODE
   =========================================================== */

// Carica tema salvato all'avvio
document.addEventListener('DOMContentLoaded', () => {
    const temaSalvato = localStorage.getItem('haccp_tema') || 'dark';
    if (temaSalvato === 'light') {
        document.body.classList.add('light-mode');
        aggiornaIconaTema();
    }
});

function toggleTema() {
    const body = document.body;
    body.classList.toggle('light-mode');
    
    const tema = body.classList.contains('light-mode') ? 'light' : 'dark';
    localStorage.setItem('haccp_tema', tema);
    
    aggiornaIconaTema();
    
    // Feedback visivo
    mostraNotifica(tema === 'light' ? '☀️ Modalità Chiara attivata' : '🌙 Modalità Scura attivata', 'success');
}

function aggiornaIconaTema() {
    const icona = document.getElementById('icona-tema');
    const iconaOp = document.getElementById('icona-tema-op');
    const nuovaIcona = document.body.classList.contains('light-mode') ? '☀️' : '🌙';
    
    if (icona) icona.textContent = nuovaIcona;
    if (iconaOp) iconaOp.textContent = nuovaIcona;
}



/* ===========================================================
   3. MOTORE DI NAVIGAZIONE TRA SEZIONI
   =========================================================== */

function vaiA(idSezione) {
    // 1. Nascondiamo TUTTE le sezioni che hanno la classe "schermata"
    const tutteLeSchermate = document.querySelectorAll('.schermata');
    tutteLeSchermate.forEach(s => s.style.display = "none");

    if (idSezione !== "sez-op-lotti") {
        stopCameraTracciabilita();
    }

    // 2. Cerchiamo la sezione da aprire
    const sezioneDaAprire = document.getElementById(idSezione);
    
    if (sezioneDaAprire) {
        sezioneDaAprire.style.display = "block";
        window.scrollTo(0, 0); // Torna in alto
    } else {
        console.error("ERRORE: La sezione '" + idSezione + "' non esiste nell'HTML!");
        alert("Errore tecnico: sezione non trovata.");
    }

    const btnBackFixed = document.getElementById('btn-back-fixed');
    if (btnBackFixed) {
        const isOperatore = idSezione && idSezione.startsWith('sez-op-');
        const sezioniArchivio = ['sez-op-temp-archivio', 'sez-op-lotti-archivio'];
        const ritorno = sezioniArchivio.includes(idSezione) ? 'sez-op-archivi' : 'sez-operatore';
        btnBackFixed.style.display = (isOperatore && idSezione !== 'sez-operatore') ? 'flex' : 'none';
        btnBackFixed.onclick = () => vaiA(ritorno);
    }

    // 3. Logica speciale per temperature
    if (idSezione === "sez-op-temperature") {
        renderizzaTemperatureEntry();
    }

    if (idSezione === "sez-op-temp-archivio") {
        renderizzaArchivioTemperature();
    }
    
    // 4. Logica speciale per tracciabilita
    if (idSezione === "sez-op-lotti") {
        inizializzaTracciabilitaCamera();
    }

    if (idSezione === "sez-op-lotti-archivio") {
        renderizzaArchivioLotti();
    }

    if (idSezione === "sez-op-ingredienti") {
        renderizzaListaIngredienti();
    }

    if (idSezione === "sez-op-foto-lotti") {
        renderizzaFotoLotti();
    }
    
    // 5. Carica account PEC quando si apre la sezione
    if (idSezione === "sez-op-pec") {
        caricaAccountPEC();
    }
    
    // 6. Carica dati sezioni nuove (ora in area operatore)
    if (idSezione === "sez-op-scadenzario") renderizzaScadenzario();
    if (idSezione === "sez-op-manutenzioni") renderizzaManutenzioni();
    if (idSezione === "sez-op-fornitori") renderizzaFornitori();
    if (idSezione === "sez-op-allergeni") renderizzaAllergeni();
    if (idSezione === "sez-op-ccp") renderizzaCCP();
    if (idSezione === "sez-op-formazione") renderizzaFormazione();
    if (idSezione === "sez-op-inventario") renderizzaInventario();
    if (idSezione === "sez-op-ordini") renderizzaOrdiniDashboard();
    if (idSezione === "sez-operatore") renderizzaDashboard();
    
    // 7. Carica sezioni admin avanzate
    if (idSezione === "sez-admin-calendario") renderizzaCalendario();
    if (idSezione === "sez-admin-backup") aggiornaInfoBackup();

    if (idSezione === "sez-admin-prodotti") renderizzaProdottiAdmin();
}

/* ===========================================================
   4. GESTIONE UTENTI (ADMIN)
   =========================================================== */

function aggiungiUtente() {
    const nome = document.getElementById("nuovo-nome-utente").value.trim();
    
    // Recupera il ruolo selezionato (Operatore o Responsabile)
    const ruolo = document.querySelector('input[name="ruolo-utente"]:checked').value;

    if (nome === "") {
        alert("Inserisci tutti i dati!");
        return;
    }

    // Creiamo l'oggetto utente COMPLETO
    const nuovoUtente = { 
        nome: nome, 
        ruolo: ruolo 
    };

    databaseUtenti.push(nuovoUtente);
    localStorage.setItem("haccp_utenti", JSON.stringify(databaseUtenti));

    // Pulizia campi
    document.getElementById("nuovo-nome-utente").value = "";
    
    aggiornaListaUtenti();
    alert("Utente registrato come: " + ruolo);
}

function aggiornaListaUtenti() {
    const contenitore = document.getElementById("lista-utenti-creati");
    if (!contenitore) return;
    contenitore.innerHTML = "";

    databaseUtenti.forEach((utente, index) => {
        const labelRuolo = utente.ruolo === "Responsabile" ? "⭐ RESP." : "OP.";
        
        contenitore.innerHTML += `
            <div class="riga-utente" style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong>${utente.nome}</strong> 
                    <small style="color: gold; margin-left:10px;">${labelRuolo}</small>
                </div>
                <button onclick="eliminaUtente(${index})" style="background:red; width:20px;">X</button>
            </div>
        `;
    });

    renderizzaLoginUtenti();
}

function eliminaUtente(indice) {
    const conferma = confirm("Vuoi davvero eliminare questo collaboratore?");
    
    if (conferma) {
        databaseUtenti.splice(indice, 1);
        localStorage.setItem("haccp_utenti", JSON.stringify(databaseUtenti));
        aggiornaListaUtenti();
        console.log("Utente rimosso con successo.");
    }
}



/* ===========================================================
   5. GESTIONE FRIGORIFERI (ADMIN)
   =========================================================== */

function aggiungiFrigo() {
    const inputNome = document.getElementById("nuovo-nome-frigo");
    const nomeVal = inputNome.value.trim();
    const radioSelezionato = document.querySelector('input[name="tipo-frigo"]:checked');
    const tipoVal = radioSelezionato ? radioSelezionato.value : "Positivo";

    if (nomeVal === "") {
        alert("Errore: Inserisci il nome del frigorifero!");
        return;
    }

    const nuovoFrigo = { nome: nomeVal, tipo: tipoVal };
    databaseFrigo.push(nuovoFrigo);
    localStorage.setItem("haccp_frigo", JSON.stringify(databaseFrigo));

    inputNome.value = ""; 
    aggiornaListaFrigo();
}

function aggiornaListaFrigo() {
    const contenitore = document.getElementById("lista-frigo-creati");
    if (!contenitore) return;
    contenitore.innerHTML = "";

    databaseFrigo.forEach((frigo, index) => {
        const colore = (frigo.tipo === "Positivo") ? "#4CAF50" : "#2196F3";
        contenitore.innerHTML += `
            <div class="riga-utente" style="border-left: 5px solid ${colore}; display: flex; justify-content: space-between; align-items: center; padding: 10px; margin-bottom: 5px;">
                <div>
                    <strong>${frigo.nome}</strong> 
                    <small style="color:${colore}">(${frigo.tipo})</small>
                </div>
                <button onclick="eliminaFrigo(${index})" style="width: 40px; background-color: #ff4444; color: white; border: none; border-radius: 5px; cursor: pointer;">X</button>
            </div>`;
    });
}

function eliminaFrigo(indice) {
    if (confirm("Vuoi davvero eliminare questo frigorifero?")) {
        databaseFrigo.splice(indice, 1);
        localStorage.setItem("haccp_frigo", JSON.stringify(databaseFrigo));
        aggiornaListaFrigo();
    }
} 


/* ===========================================================
   5B. GESTIONE PRODOTTI (ADMIN)
   =========================================================== */

function aggiungiProdottoAdmin() {
    const nomeEl = document.getElementById('admin-prodotto-nome');
    const giorniEl = document.getElementById('admin-prodotto-giorni');
    if (!nomeEl || !giorniEl) return;

    const nome = nomeEl.value.trim();
    const giorni = parseInt(giorniEl.value, 10);

    if (!nome) {
        alert('Inserisci il nome prodotto');
        return;
    }

    const esiste = prodottiAdmin.some(p => p.nome.toLowerCase() === nome.toLowerCase());
    if (esiste) {
        alert('Prodotto gia presente');
        return;
    }

    const nuovo = {
        nome,
        giorniScadenza: isNaN(giorni) ? 3 : Math.max(0, giorni)
    };

    prodottiAdmin.push(nuovo);
    localStorage.setItem('haccp_prodotti_admin', JSON.stringify(prodottiAdmin));

    if (!elencoNomiProdotti.includes(nome)) {
        elencoNomiProdotti.push(nome);
        localStorage.setItem('haccp_elenco_nomi', JSON.stringify(elencoNomiProdotti));
    }

    nomeEl.value = '';
    giorniEl.value = '';
    renderizzaProdottiAdmin();
}

function eliminaProdottoAdmin(index) {
    prodottiAdmin.splice(index, 1);
    localStorage.setItem('haccp_prodotti_admin', JSON.stringify(prodottiAdmin));
    renderizzaProdottiAdmin();
}

function renderizzaProdottiAdmin() {
    const container = document.getElementById('lista-prodotti-admin');
    if (!container) return;

    prodottiAdmin = JSON.parse(localStorage.getItem('haccp_prodotti_admin')) || prodottiAdmin || [];

    if (!prodottiAdmin || prodottiAdmin.length === 0) {
        container.innerHTML = '<p style="color:#888; text-align:center;">Nessun prodotto salvato</p>';
        return;
    }

    container.innerHTML = prodottiAdmin.map((p, i) => {
        const giorni = Number.isFinite(parseInt(p.giorniScadenza, 10)) ? p.giorniScadenza : 3;
        return `
            <div style="background:#1f1f1f; padding:10px; border-radius:8px; margin-bottom:8px; display:flex; align-items:center; justify-content:space-between;">
                <div style="flex:1; min-width:0;">
                    <div style="color:#fff; font-weight:600; font-size:13px;">${p.nome}</div>
                    <div style="color:#aaa; font-size:11px;">Scadenza: ${giorni} gg</div>
                </div>
                <button type="button" onclick="eliminaProdottoAdmin(${i})" style="background:#f44336; padding:6px 10px; border:none; border-radius:6px; font-size:11px;">Elimina</button>
            </div>
        `;
    }).join('');
}

function popolaMenuFrigo() {
    const select = document.getElementById("select-frigo");
    if (!select) return; 

    select.innerHTML = ""; 

    if (databaseFrigo.length === 0) {
        let opt = document.createElement("option");
        opt.innerText = "Nessun frigo configurato";
        select.appendChild(opt);
        return;
    }

    databaseFrigo.forEach(frigo => {
        let opt = document.createElement("option");
        opt.value = frigo.nome;
        opt.innerText = frigo.nome;
        select.appendChild(opt);
    });
}



/* ===========================================================
   6. REGISTRAZIONE TEMPERATURE (OPERATORE)
   =========================================================== */

function renderizzaTemperatureEntry() {
    const container = document.getElementById('lista-temperature-frigo');
    if (!container) return;

    if (!databaseFrigo || databaseFrigo.length === 0) {
        container.innerHTML = '<p style="color:#888; text-align:center;">Nessun frigo configurato</p>';
        return;
    }

    container.innerHTML = databaseFrigo.map((f) => {
        return `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px;">
                <div style="color:#fff; font-weight:600; font-size:13px;">${f.nome}</div>
                <input type="number" step="0.1" data-frigo-temp data-frigo-nome="${f.nome}" placeholder="°C" style="max-width:120px; text-align:center;">
            </div>
        `;
    }).join('');
}

function salvaTemperatura() {
    salvaTemperatureGiornaliere();
}

function salvaTemperatureGiornaliere() {
    const inputs = document.querySelectorAll('[data-frigo-temp]');
    const etichettaNome = document.getElementById("nome-operatore");
    if (!inputs || inputs.length === 0 || !etichettaNome) return;

    const oggi = new Date().toLocaleDateString('it-IT');
    const operatore = etichettaNome.innerText || 'Operatore';
    let salvato = false;

    inputs.forEach((input) => {
        const valore = input.value.trim();
        const frigo = input.getAttribute('data-frigo-nome') || '';
        if (!valore || !frigo) return;

        const gradi = parseFloat(valore);
        if (isNaN(gradi)) return;

        const ora = getOraAttuale();

        let stato = "OK";
        if (gradi > 5) {
            stato = "⚠️ ALLARME";
        }

        databaseTemperature.push({
            data: oggi,
            ora: ora,
            frigo: frigo,
            gradi: gradi.toString(),
            utente: operatore,
            stato: stato
        });
        salvato = true;
    });

    if (!salvato) {
        alert('Inserisci almeno una temperatura');
        return;
    }

    localStorage.setItem("haccp_log", JSON.stringify(databaseTemperature));
    aggiornaAssistente(operatore);
    mostraNotifica('✅ Temperature salvate', 'success');
    vaiA("sez-operatore");
}

function renderizzaArchivioTemperature() {
    const container = document.getElementById('lista-giorni-temperature');
    if (!container) return;

    const dateUniche = Array.from(new Set(databaseTemperature.map(t => t.data))).filter(Boolean);
    dateUniche.sort((a, b) => new Date(b.split('/').reverse().join('-')) - new Date(a.split('/').reverse().join('-')));

    if (dateUniche.length === 0) {
        container.innerHTML = '<p style="color:#888; text-align:center;">Nessuna temperatura registrata</p>';
        return;
    }

    if (!dataArchivioTemperatura) {
        dataArchivioTemperatura = dateUniche[0];
    }

    container.innerHTML = dateUniche.map(d => {
        const attivo = d === dataArchivioTemperatura ? 'background:#30D158; color:#fff;' : 'background:#333; color:#fff;';
        return `
            <div style="display:flex; align-items:center; gap:6px; margin:4px 0;">
                <button type="button" onclick="selezionaGiornoTemperature('${d}')" style="padding:6px 10px; ${attivo}">${d}</button>
                <button type="button" onclick="scaricaTemperatureGiornoPDF('${d}')" style="padding:6px 10px; background:#2196F3;">PDF</button>
            </div>
        `;
    }).join('');

    renderizzaTemperatureGiorno();
}

function selezionaGiornoTemperature(dataStr) {
    dataArchivioTemperatura = dataStr;
    renderizzaArchivioTemperature();
}

function renderizzaTemperatureGiorno() {
    const container = document.getElementById('lista-temperature-giorno');
    if (!container || !dataArchivioTemperatura) return;

    if (!databaseFrigo || databaseFrigo.length === 0) {
        container.innerHTML = '<p style="color:#888; text-align:center;">Nessun frigo configurato</p>';
        return;
    }

    const records = databaseTemperature.filter(t => t.data === dataArchivioTemperatura);
    const dataObj = parseDataIt(dataArchivioTemperatura);
    const giorno = dataObj ? dataObj.getDate() : '';
    const mese = dataObj ? dataObj.toLocaleDateString('it-IT', { month: 'short' }).toUpperCase() : '';
    const anno = dataObj ? dataObj.getFullYear() : '';

    const righe = databaseFrigo.map((f, i) => {
        const rec = records.find(r => r.frigo === f.nome);
        const value = rec ? rec.gradi : '';
        const ora = rec ? (rec.ora || '') : '';
        const stato = rec ? (rec.stato || '') : '';
        return `
            <tr>
                <td style="border:1px solid #000; padding:6px; text-align:center;">${i + 1}</td>
                <td style="border:1px solid #000; padding:6px;">${escapeHtml(f.nome)}</td>
                <td style="border:1px solid #000; padding:6px; text-align:center;">
                    <input type="number" step="0.1" data-frigo-archivio data-frigo-nome="${escapeHtml(f.nome)}" value="${escapeHtml(value)}" placeholder="°C" style="width:90px; text-align:center; border:1px solid #000; padding:4px;">
                </td>
                <td style="border:1px solid #000; padding:6px; text-align:center;">
                    <input type="text" data-frigo-ora-archivio data-frigo-nome="${escapeHtml(f.nome)}" value="${escapeHtml(ora)}" placeholder="--:--" style="width:70px; text-align:center; border:1px solid #000; padding:4px;">
                </td>
                <td style="border:1px solid #000; padding:6px; text-align:center; font-weight:700;">${escapeHtml(stato)}</td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <div style="background:#fff; color:#000; border-radius:10px; padding:14px; border:1px solid #ccc;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px;">
                <div style="font-weight:700;">REGISTRO TEMPERATURE FRIGORIFERI</div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:70px; border:1px solid #000; text-align:center; border-radius:8px; overflow:hidden;">
                        <div style="background:#000; color:#fff; font-size:11px; padding:2px 0;">${mese}</div>
                        <div style="font-size:20px; font-weight:700; padding:6px 0;">${giorno}</div>
                        <div style="font-size:10px; padding-bottom:4px;">${anno}</div>
                    </div>
                </div>
            </div>
            <table style="width:100%; border-collapse:collapse; font-size:12px;">
                <thead>
                    <tr>
                        <th style="border:1px solid #000; padding:6px; text-align:center; width:28px;">#</th>
                        <th style="border:1px solid #000; padding:6px; text-align:left;">Frigorifero</th>
                        <th style="border:1px solid #000; padding:6px; text-align:center; width:90px;">Temp (C)</th>
                        <th style="border:1px solid #000; padding:6px; text-align:center; width:70px;">Ora</th>
                        <th style="border:1px solid #000; padding:6px; text-align:center; width:90px;">Stato</th>
                    </tr>
                </thead>
                <tbody>
                    ${righe}
                </tbody>
            </table>
            <div style="margin-top:12px; font-size:11px;">Firma responsabile: ________________________________</div>
        </div>
    `;
}

function salvaTemperatureArchivioGiorno() {
    if (!dataArchivioTemperatura) return;
    const inputs = document.querySelectorAll('[data-frigo-archivio]');
    if (!inputs || inputs.length === 0) return;

    const etichettaNome = document.getElementById("nome-operatore");
    const operatore = etichettaNome ? etichettaNome.innerText : 'Operatore';

    databaseTemperature = databaseTemperature.filter(t => t.data !== dataArchivioTemperatura);

    inputs.forEach((input) => {
        const valore = input.value.trim();
        const frigo = input.getAttribute('data-frigo-nome') || '';
        if (!valore || !frigo) return;
        const gradi = parseFloat(valore);
        if (isNaN(gradi)) return;

        const oraInput = document.querySelector(`[data-frigo-ora-archivio][data-frigo-nome="${escapeAttrSelector(frigo)}"]`);
        const ora = oraInput ? String(oraInput.value || '').trim() : '';

        let stato = "OK";
        if (gradi > 5) {
            stato = "⚠️ ALLARME";
        }

        databaseTemperature.push({
            data: dataArchivioTemperatura,
            ora: ora,
            frigo: frigo,
            gradi: gradi.toString(),
            utente: operatore,
            stato: stato
        });
    });

    localStorage.setItem("haccp_log", JSON.stringify(databaseTemperature));
    mostraNotifica('✅ Archivio temperature salvato', 'success');
}

function scaricaTemperatureGiornoPDF(dataStr) {
    const dataRif = dataStr || dataArchivioTemperatura;
    if (!dataRif) return;
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert('PDF non disponibile');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`Temperature - ${dataRif}`, 14, 16);

    const records = databaseTemperature.filter(t => t.data === dataRif);
    let y = 26;
    records.forEach((r) => {
        doc.setFontSize(11);
        const ora = r.ora ? ` (${r.ora})` : '';
        doc.text(`${r.frigo}: ${r.gradi} C${ora}`, 14, y);
        y += 8;
        if (y > 280) {
            doc.addPage();
            y = 16;
        }
    });

    doc.save(`temperature_${dataRif.replace(/\//g, '-')}.pdf`);
}

function getOraAttuale() {
    return new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function parseDataIt(dataStr) {
    if (!dataStr || typeof dataStr !== 'string') return null;
    const parts = dataStr.split('/');
    if (parts.length !== 3) return null;
    const giorno = parseInt(parts[0], 10);
    const mese = parseInt(parts[1], 10) - 1;
    const anno = parseInt(parts[2], 10);
    if (isNaN(giorno) || isNaN(mese) || isNaN(anno)) return null;
    return new Date(anno, mese, giorno);
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeAttrSelector(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function stampaTemperatureArchivioSistema() {
    if (!dataArchivioTemperatura) {
        alert('Seleziona un giorno');
        return;
    }

    const etichettaNome = document.getElementById("nome-operatore");
    const operatore = etichettaNome ? etichettaNome.innerText || 'Operatore' : 'Operatore';

    if (!databaseFrigo || databaseFrigo.length === 0) {
        alert('Nessun frigo configurato');
        return;
    }

    const dataObj = parseDataIt(dataArchivioTemperatura);
    const giorno = dataObj ? dataObj.getDate() : '';
    const mese = dataObj ? dataObj.toLocaleDateString('it-IT', { month: 'short' }).toUpperCase() : '';
    const anno = dataObj ? dataObj.getFullYear() : '';

    const righe = databaseFrigo.map((f, i) => {
        const input = document.querySelector(`[data-frigo-archivio][data-frigo-nome="${escapeAttrSelector(f.nome)}"]`);
        const oraInput = document.querySelector(`[data-frigo-ora-archivio][data-frigo-nome="${escapeAttrSelector(f.nome)}"]`);
        let gradi = input && input.value ? input.value.trim() : '';
        let ora = oraInput && oraInput.value ? oraInput.value.trim() : '';
        let stato = '';

        if (!gradi) {
            const ultimo = databaseTemperature.slice().reverse().find(r => r.data === dataArchivioTemperatura && r.frigo === f.nome);
            if (ultimo) {
                gradi = ultimo.gradi || '';
                ora = ultimo.ora || '';
                stato = ultimo.stato || '';
            }
        } else {
            const valNum = parseFloat(gradi);
            if (!isNaN(valNum)) {
                stato = valNum > 5 ? 'ALLARME' : 'OK';
            }
        }

        return `
            <tr>
                <td style="border:1px solid #000; padding:6px; text-align:center;">${i + 1}</td>
                <td style="border:1px solid #000; padding:6px;">${escapeHtml(f.nome)}</td>
                <td style="border:1px solid #000; padding:6px; text-align:center;">${escapeHtml(gradi)}</td>
                <td style="border:1px solid #000; padding:6px; text-align:center;">${escapeHtml(ora)}</td>
                <td style="border:1px solid #000; padding:6px; text-align:center; font-weight:700;">${escapeHtml(stato)}</td>
            </tr>
        `;
    }).join('');

    const html = `
        <!doctype html>
        <html lang="it">
        <head>
            <meta charset="UTF-8" />
            <title>Registro Temperature</title>
            <style>
                body { font-family: Arial, sans-serif; background: #fff; color: #000; margin: 0; }
                .sheet { max-width: 900px; margin: 20px auto; border: 1px solid #000; padding: 16px; }
                .header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
                .title { font-weight: 700; }
                .calendar { width: 70px; border: 1px solid #000; text-align: center; border-radius: 8px; overflow: hidden; }
                .calendar .month { background: #000; color: #fff; font-size: 11px; padding: 2px 0; }
                .calendar .day { font-size: 20px; font-weight: 700; padding: 6px 0; }
                .calendar .year { font-size: 10px; padding-bottom: 4px; }
                .meta { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 12px; gap: 8px; }
                table { width: 100%; border-collapse: collapse; font-size: 12px; }
                th, td { border: 1px solid #000; padding: 6px; }
                th { text-align: left; }
                .note { margin-top: 12px; font-size: 11px; }
            </style>
        </head>
        <body>
            <div class="sheet">
                <div class="header">
                    <div class="title">REGISTRO TEMPERATURE FRIGORIFERI</div>
                    <div class="calendar">
                        <div class="month">${escapeHtml(mese)}</div>
                        <div class="day">${escapeHtml(giorno)}</div>
                        <div class="year">${escapeHtml(anno)}</div>
                    </div>
                </div>
                <div class="meta">
                    <div>Data: ${escapeHtml(dataArchivioTemperatura)}</div>
                    <div>Operatore: ${escapeHtml(operatore)}</div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width:28px; text-align:center;">#</th>
                            <th>Frigorifero</th>
                            <th style="width:90px; text-align:center;">Temp (C)</th>
                            <th style="width:70px; text-align:center;">Ora</th>
                            <th style="width:90px; text-align:center;">Stato</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${righe}
                    </tbody>
                </table>
                <div class="note">Firma responsabile: ________________________________</div>
            </div>
        </body>
        </html>
    `;

    const win = window.open('', 'STAMPA_TEMPERATURE', 'width=900,height=700');
    if (!win) {
        alert('Impossibile aprire la stampa. Verifica i popup del browser.');
        return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
}



/* ===========================================================
   7. ASSISTENTE INTELLIGENTE (DASHBOARD OPERATORE)
   =========================================================== */

function aggiornaAssistente(nomeUtente) {
    const box = document.getElementById("stato-attivita");
    const testo = document.getElementById("testo-stato");
    if (!box || !testo) return;

    const oggi = new Date().toLocaleDateString();
    
    const ultimaReg = databaseTemperature.slice().reverse().find(r => r.gradi !== "CHIUSO");
    const fattoOggi = databaseTemperature.some(r => r.data.includes(oggi));

    box.className = ""; // Reset colori

    if (fattoOggi) {
        box.classList.add("stato-ok");
        testo.innerHTML = `✅ <strong>CONTROLLO COMPLETATO</strong><br>Ottimo lavoro, ${nomeUtente}!`;
    } 
    else {
        box.classList.add("stato-vuoto");
        testo.innerHTML = `
            👋 <strong>Ciao ${nomeUtente}!</strong><br>
            Non risultano controlli nelle ultime 24 ore.<br>
            <div style="margin-top:10px;">
                <p style="font-size:0.8rem;">Era giorno di riposo?</p>
                <button onclick="segnaRiposoRapido('Ieri')" style="background:orange; font-size:0.7rem; padding:5px; margin-right:5px;">SÌ, IERI</button>
                <button onclick="segnaRiposoRapido('Oggi')" style="background:orange; font-size:0.7rem; padding:5px;">SÌ, OGGI</button>
            </div>
        `;
    }
}

function segnaRiposoRapido(quando) {
    const nomeOp = document.getElementById("nome-operatore").innerText;
    let dataChiusura = new Date().toLocaleDateString();

    if (quando === 'Ieri') {
        let ieri = new Date();
        ieri.setDate(ieri.getDate() - 1);
        dataChiusura = ieri.toLocaleDateString();
    }

    const record = {
        data: dataChiusura,
        frigo: "---",
        gradi: "CHIUSO",
        utente: nomeOp,
        stato: "RIPOSO"
    };

    databaseTemperature.push(record);
    localStorage.setItem("haccp_log", JSON.stringify(databaseTemperature));
    
    alert("Registrato: " + quando + " l'attività era chiusa.");
    aggiornaAssistente(nomeOp); 
}



/* ===========================================================
   8. GESTIONE LOTTI E PRODUZIONE - VISUALIZZAZIONE
   =========================================================== */

// Variabile per gestire la data che stiamo guardando
let dataVisualizzata = new Date();
let timerScansionePECAutomatica = null;
let intervalloScansionePEC = 30; // minuti
let ricetteProdotti = JSON.parse(localStorage.getItem('haccp_ricette')) || {};
let modalSelezioneModo = 'ricetta';
let ingredienteInSelezioneIndex = null;
let prodottoCorrenteSelezionato = '';
let fotoIngredientiTemp = [];
let prodottoAssociatoTemp = '';
let scadenzaManualeTemp = '';
let lottoInStampa = null;
let lottoDettaglioCorrente = null;
let dataArchivioTemperatura = null;
let lottiArchivioCorrenti = [];
let cameraIngredientiStream = null;
let galleriaFotoLotto = [];
let galleriaIndiceLotto = 0;
let previewIndiceLotto = 0;
let galleriaTouchStartX = 0;
let galleriaTouchStartY = 0;
let galleriaTouching = false;
let previewTouchStartX = 0;
let previewTouchStartY = 0;
let previewTouching = false;

function inizializzaTracciabilitaCamera() {
    fotoIngredientiTemp = [];
    prodottoAssociatoTemp = '';
    scadenzaManualeTemp = '';
    aggiornaProdottoAssociatoBox();
    renderizzaFotoIngredientiTemp();
    startCameraTracciabilita();
}

function startCameraTracciabilita() {
    const video = document.getElementById('camera-ingredienti');
    if (!video || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    if (cameraIngredientiStream) return;

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        .then((stream) => {
            cameraIngredientiStream = stream;
            video.srcObject = stream;
            video.play();
        })
        .catch(() => {
            // Se non disponibile, l'utente puo' usare il caricamento file.
        });
}

function stopCameraTracciabilita() {
    if (!cameraIngredientiStream) return;
    cameraIngredientiStream.getTracks().forEach((t) => t.stop());
    cameraIngredientiStream = null;
    const video = document.getElementById('camera-ingredienti');
    if (video) video.srcObject = null;
}

function scattaFotoIngredienti() {
    const video = document.getElementById('camera-ingredienti');
    const canvas = document.getElementById('camera-ingredienti-canvas');
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(video, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    fotoIngredientiTemp.push({ dataUrl, url: '' });
    renderizzaFotoIngredientiTemp();
}

function apriCameraIngredienti() {
    const input = document.getElementById('input-foto-ingredienti');
    if (input) input.click();
}

function gestisciFotoIngredientiCamera(input) {
    if (!input.files || input.files.length === 0) return;
    const files = Array.from(input.files);

    files.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            fotoIngredientiTemp.push({
                dataUrl,
                url: ''
            });
            renderizzaFotoIngredientiTemp();
        };
        reader.readAsDataURL(file);
    });

    input.value = '';
}

function renderizzaFotoIngredientiTemp() {
    const container = document.getElementById('lista-foto-ingredienti');
    if (!container) return;

    if (fotoIngredientiTemp.length === 0) {
        container.innerHTML = '<div style="color:#888; font-size:12px;">Nessuna foto</div>';
        return;
    }

    container.innerHTML = fotoIngredientiTemp.map((f, i) => {
        const src = f.url || f.dataUrl;
        return `
            <div style="position:relative;">
                <img src="${src}" style="width:100%; height:90px; object-fit:cover; border-radius:6px; border:1px solid #333;">
                <button type="button" onclick="rimuoviFotoIngrediente(${i})" style="position:absolute; top:4px; right:4px; background:#f44336; padding:2px 6px; border:none; border-radius:6px; font-size:10px;">X</button>
            </div>
        `;
    }).join('');
}

function rimuoviFotoIngrediente(index) {
    fotoIngredientiTemp.splice(index, 1);
    renderizzaFotoIngredientiTemp();
}

function apriModalAssociaProdotto() {
    renderizzaListaProdottiAssocia();
}

function chiudiModalAssociaProdotto() {
    const modal = document.getElementById('modal-associa-prodotto');
    if (modal) modal.style.display = 'none';
}

function renderizzaListaProdottiAssocia() {
    const select = document.getElementById('select-prodotto-associa');
    if (!select) return;

    prodottiAdmin = JSON.parse(localStorage.getItem('haccp_prodotti_admin')) || prodottiAdmin || [];
    elencoNomiProdotti = JSON.parse(localStorage.getItem('haccp_elenco_nomi')) || elencoNomiProdotti || [];

    const lista = prodottiAdmin.length > 0 ? prodottiAdmin : elencoNomiProdotti.map(n => ({ nome: n, giorniScadenza: 3 }));
    if (!lista || lista.length === 0) {
        select.innerHTML = '<option value="">Nessun prodotto disponibile</option>';
        return;
    }

    select.innerHTML = '<option value="">ASSOCIA PRODOTTO</option>' + lista.map((p) => {
        const selected = p.nome === prodottoAssociatoTemp ? 'selected' : '';
        return `<option value="${p.nome}" ${selected}>${p.nome}</option>`;
    }).join('');
}

function selezionaProdottoAssocia(nome) {
    prodottoAssociatoTemp = nome;
    const prod = prodottiAdmin.find(p => p.nome === nome);
    if (prod && prod.giorniScadenza !== undefined && prod.giorniScadenza !== null) {
        const giorni = parseInt(prod.giorniScadenza, 10);
        if (!isNaN(giorni)) {
            const d = new Date();
            d.setDate(d.getDate() + giorni);
            scadenzaManualeTemp = d.toISOString().slice(0, 10);
        }
    }
    renderizzaListaProdottiAssocia();
    const input = document.getElementById('scadenza-prodotto');
    if (input) input.value = scadenzaManualeTemp || '';
}

function confermaAssociaProdotto() {
    const input = document.getElementById('scadenza-prodotto');
    if (input) scadenzaManualeTemp = input.value.trim();
    if (!prodottoAssociatoTemp) {
        alert('Seleziona un prodotto');
        return;
    }
    aggiornaProdottoAssociatoBox();
    chiudiModalAssociaProdotto();
}

function aggiornaProdottoAssociatoBox() {
    const box = document.getElementById('prodotto-associato-box');
    if (!box) return;
    box.textContent = prodottoAssociatoTemp ? `Prodotto: ${prodottoAssociatoTemp}` : 'Prodotto: nessuno';
}

function convalidaTracciabilitaCamera() {
    if (fotoIngredientiTemp.length === 0) {
        alert('Scatta almeno una foto ingrediente');
        return;
    }
    if (!prodottoAssociatoTemp) {
        alert('Associa un prodotto');
        return;
    }

    const oggi = new Date();
    const dataBase = oggi.getFullYear().toString() +
                     (oggi.getMonth() + 1).toString().padStart(2, '0') +
                     oggi.getDate().toString().padStart(2, '0');

    const lottiOggi = databaseLotti.filter(l => {
        return l.lottoInterno && l.lottoInterno.startsWith(dataBase) &&
               l.prodotto === prodottoAssociatoTemp;
    });

    const progressivo = (lottiOggi.length + 1).toString().padStart(3, '0');
    const codiceLotto = `${dataBase}-${prodottoAssociatoTemp.substring(0, 3).toUpperCase()}${progressivo}`;

    let dataScadenza = scadenzaManualeTemp;
    if (!dataScadenza) {
        const prod = prodottiAdmin.find(p => p.nome === prodottoAssociatoTemp);
        const giorni = prod ? parseInt(prod.giorniScadenza, 10) : 3;
        const d = new Date();
        d.setDate(d.getDate() + (isNaN(giorni) ? 3 : giorni));
        dataScadenza = d.toISOString().slice(0, 10);
    }

    Promise.all(
        fotoIngredientiTemp.map(async (f) => {
            if (f.url) return f.url;
            try {
                return await uploadFoto('ingrediente', f.dataUrl);
            } catch (err) {
                console.error('Upload foto ingrediente fallito:', err.message);
                return f.dataUrl;
            }
        })
    ).then((urls) => {
        const fotoPrincipale = urls[0] || '';
        const nuovoLotto = {
            dataProduzione: oggi.toLocaleDateString('it-IT'),
            prodotto: prodottoAssociatoTemp,
            lottoInterno: codiceLotto,
            lottoOrigine: codiceLotto,
            scadenza: new Date(dataScadenza).toLocaleDateString('it-IT'),
            operatore: sessionStorage.getItem('nomeUtenteLoggato') || 'Operatore',
            timestamp: new Date().toISOString(),
            fotoLottoUrl: fotoPrincipale,
            fotoIngredienti: urls
        };

        databaseLotti.push(nuovoLotto);
        localStorage.setItem('haccp_lotti', JSON.stringify(databaseLotti));

        if (fotoPrincipale) {
            databaseFotoLotti.push({
                id: Date.now().toString(),
                prodotto: nuovoLotto.prodotto,
                lotto: nuovoLotto.lottoInterno,
                scadenza: nuovoLotto.scadenza,
                fotoUrl: fotoPrincipale,
                creatoIl: new Date().toISOString()
            });
            localStorage.setItem('haccp_foto_lotti', JSON.stringify(databaseFotoLotti));
        }

        lottoInStampa = nuovoLotto;
        apriModalStampaCopie();

        fotoIngredientiTemp = [];
        prodottoAssociatoTemp = '';
        scadenzaManualeTemp = '';
        renderizzaFotoIngredientiTemp();
        aggiornaProdottoAssociatoBox();
        renderizzaArchivioLotti();
    });
}

// Cambia giorno nel registro lotti (frecce avanti/indietro)
function cambiaDataLotti(offset) {
    dataVisualizzata.setDate(dataVisualizzata.getDate() + offset);
    renderizzaLottiGiorno();
}

// Disegna le card dei lotti del giorno selezionato
function renderizzaLottiGiorno() {
    const contenitore = document.getElementById("lista-lotti-giorno");
    const dataStr = dataVisualizzata.toLocaleDateString('it-IT');
    document.getElementById("data-visualizzata-lotti").innerText = dataStr;

    const filtrati = databaseLotti.filter(l => l.dataProduzione === dataStr);

    if (filtrati.length === 0) {
        contenitore.innerHTML = `
            <p style="text-align:center; color:#666; padding:60px 20px; font-size:0.95rem;">
                Nessuna produzione registrata per questa data<br>
                Premi <strong style="color:gold;">+</strong> per iniziare
            </p>`;
        return;
    }

    // Genera le card in stile professionale (come l'immagine)
    contenitore.innerHTML = filtrati.map((l, index) => {
        const isTerminato = l.terminato === true;
        const badgeTerminato = isTerminato ? '<span style="background:#666; color:#fff; padding:4px 8px; border-radius:6px; font-size:11px; font-weight:bold;">✓ TERMINATO</span>' : '';
        const ingredientiText = (l.ingredientiUsati || [])
            .map(i => i.nome)
            .filter(Boolean)
            .join(', ');
        const fotoHtml = l.fotoLottoUrl
            ? `<div style="margin-top:8px;"><img src="${l.fotoLottoUrl}" style="max-height:60px; border-radius:6px; border:1px solid #333;"></div>`
            : '';
        
        return `
        <div class="card-lotto ${isTerminato ? 'lotto-terminato' : ''}">
            <div class="card-lotto-barra"></div>
            <div class="card-lotto-contenuto">
                <div class="card-lotto-titolo">
                    ${l.prodotto}
                    ${badgeTerminato}
                </div>
                ${ingredientiText ? `<div class="card-lotto-ingredienti">Ingredienti: ${ingredientiText}</div>` : ''}
                ${fotoHtml}
            </div>
            <div class="card-lotto-azioni">
                <button class="btn-stampa-lotto" data-lotto-index="${index}" type="button" ${isTerminato ? 'disabled' : ''}>
                    🖨️ Stampa
                </button>
                ${!isTerminato ? `
                <button class="btn-cambia-lotto" data-lotto-index="${index}" type="button" title="Cambia lotto">
                    🔁 Cambia
                </button>
                <button class="btn-termina-lotto" data-lotto-index="${index}" type="button" title="Marca come terminato">
                    ✓ Terminato
                </button>
                ` : `
                <button class="btn-ripristina-lotto" data-lotto-index="${index}" type="button" title="Ripristina lotto">
                    ↺ Ripristina
                </button>
                `}
            </div>
        </div>
    `;
    }).join('');
    
    // Aggiungi event listener ai pulsanti stampa
    document.querySelectorAll('.btn-stampa-lotto').forEach((btn, index) => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            stampaEtichettaLotto(filtrati[index]);
        });
    });
    
    // Event listener per pulsanti "Terminato"
    document.querySelectorAll('.btn-termina-lotto').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const index = parseInt(btn.dataset.lottoIndex);
            terminaLotto(filtrati[index]);
        });
    });
    
    // Event listener per pulsanti "Ripristina"
    document.querySelectorAll('.btn-ripristina-lotto').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const index = parseInt(btn.dataset.lottoIndex);
            ripristinaLotto(filtrati[index]);
        });
    });

    // Event listener per pulsante "Cambia lotto"
    document.querySelectorAll('.btn-cambia-lotto').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const index = parseInt(btn.dataset.lottoIndex);
            cambiaLotto(filtrati[index]);
        });
    });
}

// Marca un lotto come terminato
function terminaLotto(lotto) {
    if (!confirm(`Marcare il lotto "${lotto.prodotto}" come TERMINATO?\n\nNon comparirà più negli alert di scadenza.`)) {
        return;
    }
    
    // Trova il lotto nel database e marca come terminato
    const index = databaseLotti.findIndex(l => 
        l.lottoInterno === lotto.lottoInterno && 
        l.dataProduzione === lotto.dataProduzione
    );
    
    if (index !== -1) {
        databaseLotti[index].terminato = true;
        databaseLotti[index].dataTerminazione = new Date().toISOString();
        databaseLotti[index].operatoreTerminazione = sessionStorage.getItem('nomeUtenteLoggato') || 'Operatore';
        localStorage.setItem("haccp_lotti", JSON.stringify(databaseLotti));
        
        renderizzaLottiGiorno();
        mostraNotifica(`✓ Lotto "${lotto.prodotto}" marcato come terminato`, 'success');
    }
}

// Ripristina un lotto terminato
function ripristinaLotto(lotto) {
    if (!confirm(`Ripristinare il lotto "${lotto.prodotto}"?\n\nTornerà visibile negli alert di scadenza.`)) {
        return;
    }

    const index = databaseLotti.findIndex(l =>
        l.lottoInterno === lotto.lottoInterno &&
        l.dataProduzione === lotto.dataProduzione
    );

    if (index !== -1) {
        databaseLotti[index].terminato = false;
        delete databaseLotti[index].dataTerminazione;
        delete databaseLotti[index].operatoreTerminazione;
        localStorage.setItem("haccp_lotti", JSON.stringify(databaseLotti));

        renderizzaLottiGiorno();
        mostraNotifica(`↺ Lotto "${lotto.prodotto}" ripristinato`, 'success');
    }
}

function cambiaLotto(lotto) {
    if (!confirm(`Cambiare lotto per "${lotto.prodotto}"?\n\nIl lotto attuale verra archiviato e ne verra creato uno nuovo.`)) {
        return;
    }

    const index = databaseLotti.findIndex(l =>
        l.lottoInterno === lotto.lottoInterno &&
        l.dataProduzione === lotto.dataProduzione
    );

    if (index !== -1) {
        databaseLotti[index].terminato = true;
        databaseLotti[index].dataTerminazione = new Date().toISOString();
        databaseLotti[index].operatoreTerminazione = sessionStorage.getItem('nomeUtenteLoggato') || 'Operatore';
        localStorage.setItem("haccp_lotti", JSON.stringify(databaseLotti));
        renderizzaLottiGiorno();
    }

    lottoPrecedenteId = lotto.lottoInterno;
    apriModalLotto();

    const select = document.getElementById('select-prodotto-lotto');
    const nuovo = document.getElementById('nuovo-prodotto-input');
    const found = Array.from(select.options).some(o => o.value === lotto.prodotto);

    if (found) {
        select.value = lotto.prodotto;
        gestisciNuovoProdotto(lotto.prodotto);
    } else {
        select.value = '+ Nuovo Prodotto';
        gestisciNuovoProdotto('+ Nuovo Prodotto');
        nuovo.value = lotto.prodotto;
    }

    document.getElementById('lotto-origine-lotto').value = lotto.lottoOrigine || '';
    ingredientiLottoCorrente = Array.isArray(lotto.ingredientiUsati) ? [...lotto.ingredientiUsati] : [];
    renderizzaIngredientiUsati();
    mostraNotifica('🔁 Nuovo lotto pronto da compilare', 'info');
}



/* ===========================================================
   9. GESTIONE LOTTI E PRODUZIONE - CREAZIONE NUOVO LOTTO
   =========================================================== */

// Apre il modal per registrare un nuovo lotto
function apriModalLotto() {
    ingredientiLottoCorrente = []; // Reset lista ingredienti
    renderizzaIngredientiUsati();
    popolaSelectProdotti(); // Riempie la tendina con i prodotti salvati
    impostaModalTracciabilita();
    modalSelezioneModo = 'ricetta';
    ingredienteInSelezioneIndex = null;
    prodottoCorrenteSelezionato = '';
    fotoLottoTempUrl = '';
    const lottoOrigineEl = document.getElementById('lotto-origine-lotto');
    if (lottoOrigineEl) lottoOrigineEl.value = '';
    const dataScadenzaEl = document.getElementById('data-scadenza-lotto');
    if (dataScadenzaEl) {
        const oggi = new Date();
        const scad = new Date(oggi.getTime() + 3 * 24 * 60 * 60 * 1000);
        dataScadenzaEl.value = scad.toISOString().slice(0, 10);
    }
    document.getElementById("modal-produzione").style.display = "flex";
}

// Chiude il modal produzione
function chiudiModalLotto() {
    document.getElementById("modal-produzione").style.display = "none";
    // Reset campi
    ingredientiLottoCorrente = [];
    fotoLottoTempUrl = '';
    document.getElementById("select-prodotto-lotto").value = "";
    document.getElementById("nuovo-prodotto-input").style.display = "none";
    document.getElementById("nuovo-prodotto-input").value = "";
    document.getElementById("lotto-origine-lotto").value = "";
    document.getElementById("data-scadenza-lotto").value = "";
    document.getElementById("note-lotto").value = "";
    const preview = document.getElementById("preview-foto-lotto-prodotto");
    if (preview) preview.innerHTML = '';
    renderizzaIngredientiUsati();
}

// Array temporaneo per gli ingredienti usati nel lotto corrente
let ingredientiLottoCorrente = [];
let fotoLottoTempUrl = '';
let lottoPrecedenteId = null;
let fotoIngredienteManualeDataUrl = '';

// Apre selezione ingredienti
function apriModalSelezionaIngredienti() {
    modalSelezioneModo = 'ricetta';
    ingredienteInSelezioneIndex = null;
    renderizzaSelezioneIngredienti();
    document.getElementById('modal-seleziona-ingredienti').style.display = 'flex';
}

function chiudiModalSelezionaIngredienti() {
    document.getElementById('modal-seleziona-ingredienti').style.display = 'none';
    modalSelezioneModo = 'ricetta';
    ingredienteInSelezioneIndex = null;
}

function renderizzaSelezioneIngredienti() {
    const container = document.getElementById('lista-ingredienti-selezione');
    if (!container) return;

    const titolo = document.querySelector('#modal-seleziona-ingredienti h3');

    if (modalSelezioneModo === 'lotto') {
        const idx = ingredienteInSelezioneIndex;
        const nome = idx !== null && ingredientiLottoCorrente[idx] ? ingredientiLottoCorrente[idx].nome : '';
        if (titolo) titolo.textContent = nome ? `✅ SELEZIONA LOTTO - ${nome}` : '✅ SELEZIONA LOTTO';

        const nomeNorm = normalizzaNomeIngrediente(nome);
        const lottiDisponibili = databaseIngredienti.filter(i => !i.archiviato && normalizzaNomeIngrediente(i.nome) === nomeNorm);

        if (lottiDisponibili.length === 0) {
            container.innerHTML = '<p style="color:#aaa; font-size:12px; text-align:center;">Nessun lotto disponibile per questo ingrediente</p>';
            return;
        }

        const selezionato = ingredientiLottoCorrente[idx] ? ingredientiLottoCorrente[idx].id : '';
        container.innerHTML = lottiDisponibili.map((ing) => {
            const checked = String(selezionato) === String(ing.id) ? 'checked' : '';
            const descr = [ing.lotto, ing.scadenza].filter(Boolean).join(' | ');
            return `
                <label style="display:flex; gap:10px; align-items:center; padding:8px; border-bottom:1px solid #333;">
                    <input type="radio" name="lotto-ingrediente-radio" data-ing-id="${ing.id}" ${checked}>
                    <span style="color:#ddd; font-size:13px;">${descr || 'Lotto disponibile'}</span>
                </label>
            `;
        }).join('');
        return;
    }

    if (titolo) titolo.textContent = '✅ SELEZIONA INGREDIENTI';

    const ingredientiUnici = Array.from(new Set(databaseIngredienti
        .filter(i => !i.archiviato)
        .map(i => i.nome)
        .filter(Boolean))
    );

    if (ingredientiUnici.length === 0) {
        container.innerHTML = '<p style="color:#aaa; font-size:12px; text-align:center;">Nessun ingrediente disponibile</p>';
        return;
    }

    const selezionati = new Set(ingredientiLottoCorrente.map(i => normalizzaNomeIngrediente(i.nome)));
    container.innerHTML = ingredientiUnici.map((nome) => {
        const checked = selezionati.has(normalizzaNomeIngrediente(nome)) ? 'checked' : '';
        return `
            <label style="display:flex; gap:10px; align-items:center; padding:8px; border-bottom:1px solid #333;">
                <input type="checkbox" data-ingrediente-nome="${nome}" ${checked}>
                <span style="color:#ddd; font-size:13px;">${nome}</span>
            </label>
        `;
    }).join('');
}

function confermaSelezioneIngredienti() {
    if (modalSelezioneModo === 'lotto') {
        const radio = document.querySelector('#lista-ingredienti-selezione input[type="radio"]:checked');
        if (!radio || ingredienteInSelezioneIndex === null) {
            mostraNotifica('⚠️ Seleziona un lotto', 'warning');
            return;
        }
        const id = radio.getAttribute('data-ing-id');
        const item = databaseIngredienti.find(i => String(i.id) === String(id));
        if (item) {
            ingredientiLottoCorrente[ingredienteInSelezioneIndex] = {
                id: item.id,
                nome: item.nome,
                lotto: item.lotto,
                scadenza: item.scadenza,
                fotoUrl: item.fotoUrl || ''
            };
        }

        renderizzaIngredientiUsati();
        chiudiModalSelezionaIngredienti();
        return;
    }

    const checks = document.querySelectorAll('#lista-ingredienti-selezione input[type="checkbox"]');
    const selezionati = [];
    checks.forEach((c) => {
        if (c.checked) {
            const nome = c.getAttribute('data-ingrediente-nome');
            if (nome) selezionati.push(nome);
        }
    });

    ingredientiLottoCorrente = selezionati.map(nome => ({
        id: '',
        nome: nome,
        lotto: '',
        scadenza: '',
        fotoUrl: ''
    }));

    renderizzaIngredientiUsati();
    chiudiModalSelezionaIngredienti();
}

// Gestisce il comportamento quando si seleziona "+ Nuovo Prodotto"
function gestisciNuovoProdotto(valore) {
    const inputNuovo = document.getElementById("nuovo-prodotto-input");
    if (valore === "+ Nuovo Prodotto") {
        inputNuovo.style.display = "block";
        inputNuovo.focus();
    } else {
        inputNuovo.style.display = "none";
    }

    if (valore && valore !== "+ Nuovo Prodotto") {
        prodottoCorrenteSelezionato = valore;
        caricaRicettaProdotto(valore);
    }
}

// Visualizza lista ingredienti usati
function renderizzaIngredientiUsati() {
    const container = document.getElementById('lista-ingredienti-usati');
    
    if (ingredientiLottoCorrente.length === 0) {
        container.innerHTML = '<p style="color:#ccc; font-size:11px; margin:0;">Nessun ingrediente aggiunto</p>';
        return;
    }
    
    let html = '';
    ingredientiLottoCorrente.forEach((ing, i) => {
        const stato = ing.lotto ? '✅ Lotto selezionato' : '⚠️ Seleziona lotto';
        html += `
            <div onclick="apriSelezioneLottoIngrediente(${i})" style="background:rgba(42, 42, 42, 0.8); padding:6px 8px; margin-bottom:4px; border-radius:4px; display:flex; justify-content:space-between; align-items:center; border-left:2px solid #4CAF50; cursor:pointer;">
                <div style="flex:1; min-width:0;">
                    <div style="color:#4CAF50; font-weight:bold; font-size:12px;">📦 ${ing.nome || 'Ingrediente'}</div>
                    <div style="color:#aaa; font-size:11px;">${stato}</div>
                </div>
                <button type="button" onclick="event.stopPropagation(); rimuoviIngredienteUsato(${i});" style="background:#f44336; padding:3px 7px; border:none; border-radius:3px; cursor:pointer; font-size:11px; flex-shrink:0;">
                    🗑️
                </button>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Rimuovi ingrediente dalla lista
function rimuoviIngredienteUsato(index) {
    ingredientiLottoCorrente.splice(index, 1);
    renderizzaIngredientiUsati();
}

function apriSelezioneLottoIngrediente(index) {
    if (index === null || index === undefined) return;
    ingredienteInSelezioneIndex = index;
    modalSelezioneModo = 'lotto';
    renderizzaSelezioneIngredienti();
    document.getElementById('modal-seleziona-ingredienti').style.display = 'flex';
}

function normalizzaNomeIngrediente(nome) {
    return String(nome || '').trim().toLowerCase();
}

function caricaRicettaProdotto(prodotto) {
    const ricetta = ricetteProdotti[prodotto];
    if (Array.isArray(ricetta) && ricetta.length > 0) {
        ingredientiLottoCorrente = ricetta.map(nome => ({
            id: '',
            nome: nome,
            lotto: '',
            scadenza: '',
            fotoUrl: ''
        }));
    } else {
        ingredientiLottoCorrente = [];
    }
    renderizzaIngredientiUsati();
}

function impostaModalTracciabilita() {
    const daNascondere = [
        'data-scadenza-lotto',
        'lotto-origine-lotto',
        'input-foto-lotto-prodotto',
        'note-lotto'
    ];

    daNascondere.forEach((id) => {
        const input = document.getElementById(id);
        const label = document.querySelector(`label[for="${id}"]`);
        if (label) label.style.display = 'none';
        if (input) input.style.display = 'none';
    });

    const previewFoto = document.getElementById('preview-foto-lotto-prodotto');
    if (previewFoto) previewFoto.style.display = 'none';

    const btnRegistro = document.querySelector('button[onclick="vaiA(\'sez-op-ingredienti\')"]');
    if (btnRegistro) btnRegistro.style.display = 'none';
}

function calcolaScadenzaProduzione() {
    const dateValide = ingredientiLottoCorrente
        .map(i => i.scadenza)
        .filter(Boolean)
        .map(s => new Date(s))
        .filter(d => !isNaN(d.getTime()));

    if (dateValide.length > 0) {
        const minDate = new Date(Math.min(...dateValide.map(d => d.getTime())));
        return minDate.toLocaleDateString('it-IT');
    }

    const oggi = new Date();
    oggi.setDate(oggi.getDate() + 3);
    return oggi.toLocaleDateString('it-IT');
}

// Apre modal scansione ingrediente
function scansionaIngredienteFoto() {
    document.getElementById('modal-scansione-ingrediente').style.display = 'flex';
    document.getElementById('preview-foto-ingrediente').innerHTML = '';
    document.getElementById('risultato-ocr-ingrediente').innerHTML = '<p style="color:#888; margin:0;">In attesa di foto...</p>';
    document.getElementById('form-ingrediente-estratto').style.display = 'none';
}

// Chiude modal scansione ingrediente
function chiudiModalScansioneIngrediente() {
    document.getElementById('modal-scansione-ingrediente').style.display = 'none';
    document.getElementById('input-foto-ingrediente-ocr').value = '';
}

function estraiDataDaTesto(text) {
    const match = text.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{4}|\d{4}[\/\-]\d{2}[\/\-]\d{2})/);
    return match ? match[1] : '';
}

function normalizzaDataInput(dataStr) {
    if (!dataStr) return '';
    const d = dataStr.replace(/\//g, '-');
    if (/^\d{2}-\d{2}-\d{4}$/.test(d)) {
        const [dd, mm, yyyy] = d.split('-');
        return `${yyyy}-${mm}-${dd}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        return d;
    }
    return '';
}

function estraiNomeIngredienteDaTesto(text) {
    const righe = text.split('\n').map(r => r.trim()).filter(r => r.length > 2);
    const blacklist = ['lotto', 'scad', 'scadenza', 'data', 'prodotto', 'ingredienti'];
    for (const r of righe) {
        const lower = r.toLowerCase();
        if (blacklist.some(b => lower.includes(b))) continue;
        if (r.length >= 3 && r.length <= 60) return r;
    }
    return righe[0] || '';
}

// Processa foto ingrediente e estrae testo con OCR
async function processaFotoIngrediente(input) {
    if (!input.files || !input.files[0]) return;
    
    const file = input.files[0];
    const reader = new FileReader();
    
    reader.onload = async function(e) {
        const dataUrl = e.target.result;
        const preview = document.getElementById('preview-foto-ingrediente');
        preview.innerHTML = `<img src="${dataUrl}" style="max-width:100%; max-height:300px; border-radius:8px; border:2px solid #2196F3;">`;
        
        const risultato = document.getElementById('risultato-ocr-ingrediente');
        risultato.innerHTML = '<p style="color:#FF9800; margin:0;">🔄 Analizzando immagine...</p>';
        
        try {
            const worker = await Tesseract.createWorker('ita');
            const { data: { text } } = await worker.recognize(dataUrl);
            await worker.terminate();
            
            risultato.innerHTML = `
                <p style="color:#4CAF50; font-weight:bold; margin-bottom:10px;">✅ Testo rilevato:</p>
                <pre style="background:#1a1a1a; padding:10px; border-radius:5px; font-size:12px; white-space:pre-wrap; max-height:150px; overflow-y:auto;">${text}</pre>
            `;
            
            const lottoMatch = text.match(/\d{8}-[A-Z]{3}\d{3}|LOT[\s:]?\w+|LOTTO[\s:]?\w+|L[\s:]?\d+/i);
            const dataMatch = estraiDataDaTesto(text);
            const nomeMatch = estraiNomeIngredienteDaTesto(text);
            
            document.getElementById('nome-ingrediente-ocr').value = nomeMatch || '';
            document.getElementById('lotto-ingrediente-ocr').value = lottoMatch ? lottoMatch[0].trim() : '';
            document.getElementById('scadenza-ingrediente-ocr').value = normalizzaDataInput(dataMatch);
            document.getElementById('form-ingrediente-estratto').style.display = 'block';
            mostraNotifica('✅ Dati ingrediente rilevati!', 'success');
        } catch (error) {
            risultato.innerHTML = `<p style="color:#f44336; margin:0;">❌ Errore: ${error.message}</p>`;
            mostraNotifica('❌ Errore scansione', 'error');
        }
    };
    
    reader.readAsDataURL(file);
}

// Conferma ingrediente scansionato e salva
async function confermaIngredienteScansionato() {
    const nome = document.getElementById('nome-ingrediente-ocr').value.trim();
    const lotto = document.getElementById('lotto-ingrediente-ocr').value.trim();
    const scadenza = document.getElementById('scadenza-ingrediente-ocr').value.trim();
    const previewImg = document.querySelector('#preview-foto-ingrediente img');
    const dataUrl = previewImg ? previewImg.src : '';

    if (!nome || !lotto) {
        alert('⚠️ Inserisci nome e lotto!');
        return;
    }

    let fotoUrl = '';
    if (dataUrl) {
        try {
            fotoUrl = await uploadFoto('ingrediente', dataUrl);
        } catch (err) {
            console.error('Upload foto ingrediente fallito:', err.message);
        }
    }

    const nuovo = {
        id: Date.now().toString(),
        nome,
        lotto,
        scadenza,
        fotoUrl,
        creatoIl: new Date().toISOString(),
        archiviato: false
    };

    databaseIngredienti.push(nuovo);
    localStorage.setItem('haccp_ingredienti', JSON.stringify(databaseIngredienti));
    renderizzaListaIngredienti();
    chiudiModalScansioneIngrediente();
    mostraNotifica('✅ Ingrediente salvato', 'success');
}

async function uploadFoto(tipo, dataUrl) {
    const response = await fetch('/api/upload-foto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, dataUrl })
    });

    const data = await response.json();
    if (!data.success) {
        throw new Error(data.error || 'Upload fallito');
    }
    const url = data.url || '';
    const isRender = location.hostname.endsWith('onrender.com');
    const isRelative = url.startsWith('/foto-');
    // Su Render senza storage persistente, salva direttamente il dataUrl.
    if (isRender && isRelative) {
        return dataUrl;
    }
    return url;
}

function gestisciFotoIngredienteManuale(input) {
    if (!input.files || !input.files[0]) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        fotoIngredienteManualeDataUrl = e.target.result;
        const preview = document.getElementById('preview-foto-ingrediente-manuale');
        if (preview) {
            preview.innerHTML = `<img src="${fotoIngredienteManualeDataUrl}" style="max-width:100%; max-height:200px; border-radius:8px; border:1px solid #333;">`;
        }
    };
    reader.readAsDataURL(input.files[0]);
}

// Salva ingrediente da form manuale
async function salvaIngredienteManuale() {
    const nome = document.getElementById('nome-ingrediente').value.trim();
    const lotto = document.getElementById('lotto-ingrediente').value.trim();
    const scadenza = document.getElementById('scadenza-ingrediente').value.trim();
    const dataUrl = fotoIngredienteManualeDataUrl || '';

    if (!nome || !lotto) {
        alert('⚠️ Inserisci nome e lotto ingrediente');
        return;
    }

    let fotoUrl = '';
    if (dataUrl) {
        try {
            fotoUrl = await uploadFoto('ingrediente', dataUrl);
        } catch (err) {
            console.error('Upload foto ingrediente fallito:', err.message);
        }
    }

    const nuovo = {
        id: Date.now().toString(),
        nome,
        lotto,
        scadenza,
        fotoUrl,
        creatoIl: new Date().toISOString(),
        archiviato: false
    };

    databaseIngredienti.push(nuovo);
    localStorage.setItem('haccp_ingredienti', JSON.stringify(databaseIngredienti));
    renderizzaListaIngredienti();

    document.getElementById('nome-ingrediente').value = '';
    document.getElementById('lotto-ingrediente').value = '';
    document.getElementById('scadenza-ingrediente').value = '';
    const preview = document.getElementById('preview-foto-ingrediente-manuale');
    if (preview) preview.innerHTML = '';
    document.getElementById('foto-ingrediente').value = '';
    fotoIngredienteManualeDataUrl = '';
    mostraNotifica('✅ Ingrediente salvato', 'success');
}

function renderizzaListaIngredienti() {
    const container = document.getElementById('lista-ingredienti');
    if (!container) return;

    const attivi = databaseIngredienti.filter(i => !i.archiviato);
    if (attivi.length === 0) {
        container.innerHTML = '<p style="color:#888; text-align:center;">Nessun ingrediente salvato</p>';
        return;
    }

    container.innerHTML = attivi.map((i) => {
        const descr = [i.nome, i.lotto, i.scadenza].filter(Boolean).join(' | ');
        const foto = i.fotoUrl ? `<img src="${i.fotoUrl}" onerror="gestisciFotoMancanteIngrediente('${i.id}')" style="height:40px; border-radius:6px; border:1px solid #333; margin-left:8px;">` : '';
        return `
            <div style="background:#1f1f1f; padding:10px; border-radius:8px; margin-bottom:8px; display:flex; align-items:center; justify-content:space-between;">
                <div style="flex:1; min-width:0;">
                    <div style="color:#fff; font-weight:600; font-size:13px;">${descr}</div>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    ${foto}
                    <button type="button" onclick="archiviaIngrediente('${i.id}')" style="background:#666; padding:6px 10px; border:none; border-radius:6px; font-size:11px;">Archivia</button>
                </div>
            </div>
        `;
    }).join('');
}

function gestisciFotoMancanteIngrediente(id) {
    const idx = databaseIngredienti.findIndex(i => String(i.id) === String(id));
    if (idx === -1) return;
    if (!databaseIngredienti[idx].fotoUrl) return;
    databaseIngredienti[idx].fotoUrl = '';
    localStorage.setItem('haccp_ingredienti', JSON.stringify(databaseIngredienti));
}

function archiviaIngrediente(id) {
    const idx = databaseIngredienti.findIndex(i => String(i.id) === String(id));
    if (idx === -1) return;
    databaseIngredienti[idx].archiviato = true;
    localStorage.setItem('haccp_ingredienti', JSON.stringify(databaseIngredienti));
    renderizzaListaIngredienti();
}

async function processaFotoEtichettaLotto(input) {
    if (!input.files || !input.files[0]) return;
    const reader = new FileReader();

    reader.onload = async function(e) {
        const dataUrl = e.target.result;
        const preview = document.getElementById('preview-foto-lotto-prodotto');
        if (preview) preview.innerHTML = `<img src="${dataUrl}" style="max-width:100%; max-height:240px; border-radius:8px; border:2px solid #2196F3;">`;

        try {
            const worker = await Tesseract.createWorker('ita');
            const { data: { text } } = await worker.recognize(dataUrl);
            await worker.terminate();

            const lottoMatch = text.match(/\d{8}-[A-Z]{3}\d{3}|LOT[\s:]?\w+|LOTTO[\s:]?\w+|L[\s:]?\d+/i);
            const dataMatch = estraiDataDaTesto(text);
            const nomeMatch = estraiNomeIngredienteDaTesto(text);

            if (lottoMatch) {
                document.getElementById('lotto-origine-lotto').value = lottoMatch[0].trim();
            }

            if (dataMatch) {
                document.getElementById('data-scadenza-lotto').value = normalizzaDataInput(dataMatch);
            }

            if (nomeMatch) {
                const select = document.getElementById('select-prodotto-lotto');
                const nuovo = document.getElementById('nuovo-prodotto-input');
                const found = Array.from(select.options).some(o => o.value === nomeMatch);
                if (found) {
                    select.value = nomeMatch;
                    gestisciNuovoProdotto(nomeMatch);
                } else {
                    select.value = '+ Nuovo Prodotto';
                    gestisciNuovoProdotto('+ Nuovo Prodotto');
                    nuovo.value = nomeMatch;
                }
            }

            try {
                fotoLottoTempUrl = await uploadFoto('lotto', dataUrl);
            } catch (err) {
                console.error('Upload foto lotto fallito:', err.message);
            }
        } catch (error) {
            console.error('OCR lotto fallito:', error.message);
        }
    };

    reader.readAsDataURL(input.files[0]);
}

function renderizzaFotoLotti() {
    const container = document.getElementById('lista-foto-lotti');
    if (!container) return;

    if (databaseFotoLotti.length === 0) {
        container.innerHTML = '<p style="color:#888; text-align:center;">Nessuna foto lotto salvata</p>';
        return;
    }

    container.innerHTML = databaseFotoLotti.map((f) => {
        const info = [f.prodotto, f.lotto, f.scadenza].filter(Boolean).join(' | ');
        return `
            <div style="background:#1f1f1f; padding:10px; border-radius:8px; margin-bottom:10px;">
                <img src="${f.fotoUrl}" style="width:100%; max-height:240px; object-fit:contain; border-radius:6px; border:1px solid #333;">
                <div style="color:#ccc; margin-top:6px; font-size:12px;">${info}</div>
            </div>
        `;
    }).join('');
}

// Riempie la tendina prodotti con quelli già usati in passato
function popolaSelectProdotti() {
    const select = document.getElementById("select-prodotto-lotto");
    if (!select) return;
    
    // PRODOTTI PREIMPOSTATI PER MACELLERIA
    const prodottiMacelleria = [];
    const prodottiAdminNomi = prodottiAdmin.map(p => p.nome);
    
    // Unisci prodotti preimpostati + quelli salvati dall'utente
    const tuttiProdotti = [...new Set([...prodottiMacelleria, ...prodottiAdminNomi, ...elencoNomiProdotti])];
    
    select.innerHTML = '<option value="">-- Seleziona Prodotto --</option>';
    
    tuttiProdotti.forEach(p => {
        let opt = document.createElement("option");
        opt.value = p;
        opt.innerText = p;
        select.appendChild(opt);
    });
    
    // Aggiungi opzione per creare nuovo
    let optNuovo = document.createElement("option");
    optNuovo.value = "+ Nuovo Prodotto";
    optNuovo.innerText = "+ Nuovo Prodotto";
    select.appendChild(optNuovo);
}

// Salva il lotto nel database e aggiorna la lista
function confermaSalvataggioLotto() {
    try {
        const selectProdottoEl = document.getElementById("select-prodotto-lotto");
        const nuovoProdottoInputEl = document.getElementById("nuovo-prodotto-input");
        const dataScadenzaEl = document.getElementById("data-scadenza-lotto");
        const lottoOrigineEl = document.getElementById("lotto-origine-lotto");
        const noteEl = document.getElementById("note-lotto");
        
        if (!selectProdottoEl || !nuovoProdottoInputEl || !dataScadenzaEl || !noteEl || !lottoOrigineEl) {
            console.error('Elementi del form non trovati');
            alert('⚠️ Errore: form non trovato. Riapri la modal.');
            return false;
        }
        
        const selectProdotto = selectProdottoEl.value;
        const nuovoProdottoInput = nuovoProdottoInputEl.value.trim();
        const dataScadenzaInput = dataScadenzaEl.value;
        const lottoOrigineInput = lottoOrigineEl.value.trim();
        const note = noteEl.value.trim();
        
        // Determina il nome del prodotto finale
        let prodottoFinale = selectProdotto === "+ Nuovo Prodotto" ? nuovoProdottoInput : selectProdotto;
        
        if (!prodottoFinale) {
            alert('⚠️ Seleziona o inserisci il nome del prodotto!');
            return false;
        }

        if (!ingredientiLottoCorrente || ingredientiLottoCorrente.length === 0) {
            alert('⚠️ Seleziona gli ingredienti della ricetta');
            return false;
        }

        const ingredientiMancanti = ingredientiLottoCorrente.filter(i => !i.lotto);
        if (ingredientiMancanti.length > 0) {
            alert('⚠️ Seleziona il lotto per tutti gli ingredienti');
            return false;
        }
        
        // Se è un nome nuovo, salvalo nell'elenco
        if (nuovoProdottoInput && !elencoNomiProdotti.includes(nuovoProdottoInput)) {
            elencoNomiProdotti.push(nuovoProdottoInput);
            localStorage.setItem("haccp_elenco_nomi", JSON.stringify(elencoNomiProdotti));
        }
        
        // Genera codice lotto automatico progressivo
        const oggi = new Date();
        const dataBase = oggi.getFullYear().toString() + 
                         (oggi.getMonth() + 1).toString().padStart(2, '0') + 
                         oggi.getDate().toString().padStart(2, '0');
        
        // Conta quanti lotti sono stati creati oggi per questo prodotto
        const lottiOggi = databaseLotti.filter(l => {
            return l.lottoInterno && l.lottoInterno.startsWith(dataBase) && 
                   l.prodotto === prodottoFinale;
        });
        
        const progressivo = (lottiOggi.length + 1).toString().padStart(3, '0');
        const codiceLotto = `${dataBase}-${prodottoFinale.substring(0, 3).toUpperCase()}${progressivo}`;
        
        // Calcola data scadenza
        let dataScadenza = new Date();
        if (dataScadenzaInput) {
            const parsed = new Date(dataScadenzaInput);
            if (!isNaN(parsed.getTime())) {
                dataScadenza = parsed;
            }
        } else {
            const calcolata = calcolaScadenzaProduzione();
            const parsed = new Date(calcolata.split('/').reverse().join('-'));
            if (!isNaN(parsed.getTime())) {
                dataScadenza = parsed;
            }
        }
        
        // Crea oggetto lotto
        const nuovoLotto = {
            dataProduzione: oggi.toLocaleDateString('it-IT'),
            prodotto: prodottoFinale,
            lottoInterno: codiceLotto,
            lottoOrigine: codiceLotto,
            ingredientiUsati: [...ingredientiLottoCorrente],
            note: note,
            scadenza: dataScadenza.toLocaleDateString('it-IT'),
            operatore: sessionStorage.getItem('nomeUtenteLoggato') || 'Operatore',
            timestamp: new Date().toISOString(),
            fotoLottoUrl: fotoLottoTempUrl || ''
        };

        if (lottoPrecedenteId) {
            nuovoLotto.lottoPrecedente = lottoPrecedenteId;
            lottoPrecedenteId = null;
        }
        
        // Salva nel database
        databaseLotti.push(nuovoLotto);
        localStorage.setItem("haccp_lotti", JSON.stringify(databaseLotti));
        
        if (nuovoLotto.fotoLottoUrl) {
            databaseFotoLotti.push({
                id: Date.now().toString(),
                prodotto: nuovoLotto.prodotto,
                lotto: nuovoLotto.lottoInterno,
                scadenza: nuovoLotto.scadenza,
                fotoUrl: nuovoLotto.fotoLottoUrl,
                creatoIl: new Date().toISOString()
            });
            localStorage.setItem('haccp_foto_lotti', JSON.stringify(databaseFotoLotti));
        }

        // Chiudi modal
        chiudiModalLotto();
        
        // Aggiorna lista
        setTimeout(() => {
            renderizzaLottiGiorno();
        }, 100);
        
        // Stampa in background (senza input aggiuntivi)
        setTimeout(() => {
            stampaEtichettaLottoAuto(nuovoLotto);
        }, 200);
        
        // Salva ricetta per il prodotto
        const ricettaAggiornata = Array.from(new Set(ingredientiLottoCorrente.map(i => i.nome).filter(Boolean)));
        if (ricettaAggiornata.length > 0) {
            ricetteProdotti[prodottoFinale] = ricettaAggiornata;
            localStorage.setItem('haccp_ricette', JSON.stringify(ricetteProdotti));
        }

        // Notifica
        setTimeout(() => {
            mostraNotifica(`✅ LOTTO CREATO: ${codiceLotto}`, 'success');
        }, 300);
        
        return false;
        
    } catch (error) {
        console.error('❌ Errore in confermaSalvataggioLotto:', error);
        alert('Errore: ' + error.message);
        return false;
    }
}

function apriModalStampaCopie() {
    const modal = document.getElementById('modal-stampa-copie');
    const input = document.getElementById('input-copie-stampa');
    if (input) input.value = '1';
    if (modal) modal.style.display = 'flex';
}

function chiudiModalStampaCopie() {
    const modal = document.getElementById('modal-stampa-copie');
    if (modal) modal.style.display = 'none';
}

function aggiornaCopieStampa(delta) {
    const input = document.getElementById('input-copie-stampa');
    if (!input) return;
    const current = parseInt(input.value, 10) || 1;
    let next = current + delta;
    if (next < 1) next = 1;
    if (next > 30) next = 30;
    input.value = String(next);
}

function confermaStampaCopie() {
    const input = document.getElementById('input-copie-stampa');
    if (!input || !lottoInStampa) return;
    let copie = parseInt(input.value, 10);
    if (isNaN(copie) || copie < 1) copie = 1;
    if (copie > 30) copie = 30;
    stampaEtichettaLottoConCopie(lottoInStampa, copie);
    lottoInStampa = null;
    chiudiModalStampaCopie();
}

function stampaEtichettaLottoConCopie(lotto, copie) {
    try {
        const config = JSON.parse(localStorage.getItem('haccp_config_stampa')) || {
            larghezza: 40,
            altezza: 30,
            mostraTitolo: true,
            mostraProdotto: true,
            mostraLotto: true,
            mostraProduzione: true,
            mostraScadenza: true,
            sizeTitolo: 3,
            sizeCampi: 2,
            fontTitolo: '3',
            fontCampi: '2'
        };

        const datiStampa = {
            prodotto: String(lotto.prodotto || ''),
            lottoOrigine: String(lotto.lottoOrigine || ''),
            dataProduzione: String(lotto.dataProduzione || ''),
            scadenza: String(lotto.scadenza || lotto.dataScadenza || ''),
            copie: copie,
            config: config
        };

        inviaStampa(datiStampa)
        .then(data => {
            if (!data.success) {
                console.error('Errore stampa:', data.error);
            }
        })
        .catch(error => {
            console.error('Errore connessione stampante:', error);
            mostraNotifica('⚠️ Errore comunicazione stampante', 'warning');
        });

        setTimeout(() => {
            mostraNotifica(`🖨️ ${copie} ${copie === 1 ? 'etichetta inviata' : 'etichette inviate'}!`, 'success');
        }, 100);
    } catch (error) {
        console.error('Errore stampa:', error);
    }
}

function renderizzaArchivioLotti() {
    const container = document.getElementById('lista-lotti-archivio');
    if (!container) return;

    if (!databaseLotti || databaseLotti.length === 0) {
        container.innerHTML = '<p style="color:#888; text-align:center;">Nessun lotto salvato</p>';
        return;
    }

    const ordinati = [...databaseLotti].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    container.innerHTML = ordinati.map((l, index) => {
        const foto = l.fotoLottoUrl ? `<img src="${l.fotoLottoUrl}" style="width:60px; height:60px; object-fit:cover; border-radius:6px; border:1px solid #333;">` : '';
        const fotoCount = Array.isArray(l.fotoIngredienti) ? l.fotoIngredienti.length : 0;
        return `
            <div style="background:#1f1f1f; padding:10px; border-radius:8px; margin-bottom:8px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
                <div style="display:flex; align-items:center; gap:10px;">
                    ${foto}
                    <div>
                        <div style="color:#fff; font-weight:600; font-size:13px;">${l.prodotto || 'Prodotto'}</div>
                        <div style="color:#aaa; font-size:11px;">${l.dataProduzione || ''} | ${fotoCount} foto ingredienti</div>
                    </div>
                </div>
                <div style="display:flex; gap:6px; align-items:center;">
                    <button type="button" onclick="eliminaLottoArchivio(${index})" title="Elimina" style="width:26px; height:26px; border-radius:50%; background:#f44336; padding:0; font-size:14px; line-height:1;">✕</button>
                    <button type="button" onclick="apriDettaglioLotto(${index})" style="padding:6px 10px; font-size:11px;">Dettaglio</button>
                    <button type="button" onclick="apriModalStampaCopieDaArchivio(${index})" style="padding:6px 10px; font-size:11px; background:#30D158;">Stampa</button>
                </div>
            </div>
        `;
    }).join('');

    lottiArchivioCorrenti = ordinati;
}

function eliminaLottoArchivio(index) {
    const lotto = lottiArchivioCorrenti[index];
    if (!lotto) return;
    if (!confirm(`Eliminare il lotto "${lotto.prodotto}"?

Questa operazione non puo' essere annullata.`)) {
        return;
    }

    const lottoIndex = databaseLotti.findIndex(l =>
        l.lottoInterno === lotto.lottoInterno &&
        l.dataProduzione === lotto.dataProduzione
    );

    if (lottoIndex === -1) {
        mostraNotifica('⚠️ Lotto non trovato', 'warning');
        return;
    }

    databaseLotti.splice(lottoIndex, 1);
    localStorage.setItem('haccp_lotti', JSON.stringify(databaseLotti));

    if (Array.isArray(databaseFotoLotti) && databaseFotoLotti.length > 0) {
        databaseFotoLotti = databaseFotoLotti.filter(f => f.lotto !== lotto.lottoInterno);
        localStorage.setItem('haccp_foto_lotti', JSON.stringify(databaseFotoLotti));
    }

    if (lottoDettaglioCorrente && lottoDettaglioCorrente.lottoInterno === lotto.lottoInterno) {
        lottoDettaglioCorrente = null;
        chiudiModalDettaglioLotto();
    }

    renderizzaArchivioLotti();
    mostraNotifica('🗑️ Lotto eliminato', 'success');

    if (typeof salvaDatiSuCloud === 'function') {
        salvaDatiSuCloud();
    }
}

function apriModalStampaCopieDaArchivio(index) {
    const lotto = lottiArchivioCorrenti[index];
    if (!lotto) return;
    lottoInStampa = lotto;
    apriModalStampaCopie();
}

function apriDettaglioLotto(index) {
    const lotto = lottiArchivioCorrenti[index];
    if (!lotto) return;
    lottoDettaglioCorrente = lotto;
    previewIndiceLotto = 0;

    const container = document.getElementById('dettaglio-lotto-contenuto');
    if (container) {
        const fotoCount = Array.isArray(lotto.fotoIngredienti) ? lotto.fotoIngredienti.length : 0;
        const totaleFoto = (lotto.fotoLottoUrl ? 1 : 0) + fotoCount;
        const hasFoto = totaleFoto > 0;
        const fotoPreview = hasFoto
            ? `
                <div class="lotto-preview-foto">
                    <button type="button" class="lotto-preview-nav prev" onclick="cambiaFotoPreview(-1)">◀︎</button>
                    <img id="lotto-preview-img" class="lotto-preview-img" onclick="apriGalleriaLotto()" alt="Foto lotto" />
                    <button type="button" class="lotto-preview-nav next" onclick="cambiaFotoPreview(1)">▶︎</button>
                </div>
            `
            : '';
        container.innerHTML = `
            ${fotoPreview}
            <div style="color:#fff; font-weight:600;">${lotto.prodotto || ''}</div>
            <div style="color:#aaa; font-size:12px;">Lotto: ${lotto.lottoInterno || ''}</div>
            <div style="color:#aaa; font-size:12px;">Produzione: ${lotto.dataProduzione || ''}</div>
            <div style="color:#aaa; font-size:12px;">Scadenza: ${lotto.scadenza || ''}</div>
            <div style="color:#aaa; font-size:12px;">Foto totali: ${totaleFoto}</div>
        `;
        aggiornaFotoPreview();
        inizializzaSwipePreview();
    }

    const modal = document.getElementById('modal-dettaglio-lotto');
    if (modal) modal.style.display = 'flex';
}

function chiudiModalDettaglioLotto() {
    const modal = document.getElementById('modal-dettaglio-lotto');
    if (modal) modal.style.display = 'none';
}

function getFotoLottoCorrente() {
    if (!lottoDettaglioCorrente) return [];
    const lista = [];
    if (lottoDettaglioCorrente.fotoLottoUrl) {
        lista.push(lottoDettaglioCorrente.fotoLottoUrl);
    }
    if (Array.isArray(lottoDettaglioCorrente.fotoIngredienti)) {
        lista.push(...lottoDettaglioCorrente.fotoIngredienti.filter(Boolean));
    }
    return lista;
}

function aggiornaFotoPreview() {
    const img = document.getElementById('lotto-preview-img');
    if (!img) return;
    const lista = getFotoLottoCorrente();
    if (!lista.length) return;
    if (previewIndiceLotto >= lista.length) previewIndiceLotto = 0;
    img.src = lista[previewIndiceLotto];
}

function cambiaFotoPreview(delta) {
    const lista = getFotoLottoCorrente();
    if (!lista.length) return;
    previewIndiceLotto = (previewIndiceLotto + delta + lista.length) % lista.length;
    aggiornaFotoPreview();
}

function inizializzaSwipePreview() {
    const img = document.getElementById('lotto-preview-img');
    if (!img) return;

    img.ontouchstart = (event) => {
        const touch = event.touches && event.touches[0];
        if (!touch) return;
        previewTouching = true;
        previewTouchStartX = touch.clientX;
        previewTouchStartY = touch.clientY;
    };

    img.ontouchend = (event) => {
        if (!previewTouching) return;
        previewTouching = false;
        const touch = event.changedTouches && event.changedTouches[0];
        if (!touch) return;
        const dx = touch.clientX - previewTouchStartX;
        const dy = touch.clientY - previewTouchStartY;
        if (Math.abs(dx) < 30 || Math.abs(dx) < Math.abs(dy)) return;
        if (dx > 0) {
            cambiaFotoPreview(-1);
        } else {
            cambiaFotoPreview(1);
        }
    };
}

function apriGalleriaLotto() {
    if (!lottoDettaglioCorrente) return;
    galleriaFotoLotto = getFotoLottoCorrente();
    if (galleriaFotoLotto.length === 0) {
        mostraNotifica('Nessuna foto disponibile', 'info');
        return;
    }
    galleriaIndiceLotto = Math.min(previewIndiceLotto, galleriaFotoLotto.length - 1);
    renderGalleriaLotto();
    inizializzaSwipeGalleria();
    const modal = document.getElementById('modal-galleria-lotto');
    if (modal) modal.style.display = 'flex';
}

function chiudiGalleriaLotto() {
    const modal = document.getElementById('modal-galleria-lotto');
    if (modal) modal.style.display = 'none';
}

function cambiaFotoLotto(delta) {
    if (!galleriaFotoLotto.length) return;
    galleriaIndiceLotto = (galleriaIndiceLotto + delta + galleriaFotoLotto.length) % galleriaFotoLotto.length;
    renderGalleriaLotto();
}

function selezionaFotoLotto(index) {
    if (index < 0 || index >= galleriaFotoLotto.length) return;
    galleriaIndiceLotto = index;
    renderGalleriaLotto();
}

function renderGalleriaLotto() {
    const img = document.getElementById('galleria-foto-principale');
    const thumbs = document.getElementById('galleria-thumbs');
    if (!img || !thumbs) return;

    img.src = galleriaFotoLotto[galleriaIndiceLotto] || '';
    thumbs.innerHTML = galleriaFotoLotto.map((url, i) => {
        const active = i === galleriaIndiceLotto ? 'attiva' : '';
        return `<img src="${url}" class="galleria-thumb ${active}" onclick="selezionaFotoLotto(${i})" />`;
    }).join('');
}

function inizializzaSwipeGalleria() {
    const img = document.getElementById('galleria-foto-principale');
    if (!img) return;

    img.ontouchstart = (event) => {
        const touch = event.touches && event.touches[0];
        if (!touch) return;
        galleriaTouching = true;
        galleriaTouchStartX = touch.clientX;
        galleriaTouchStartY = touch.clientY;
    };

    img.ontouchend = (event) => {
        if (!galleriaTouching) return;
        galleriaTouching = false;
        const touch = event.changedTouches && event.changedTouches[0];
        if (!touch) return;
        const dx = touch.clientX - galleriaTouchStartX;
        const dy = touch.clientY - galleriaTouchStartY;
        if (Math.abs(dx) < 30 || Math.abs(dx) < Math.abs(dy)) return;
        if (dx > 0) {
            cambiaFotoLotto(-1);
        } else {
            cambiaFotoLotto(1);
        }
    };
}

function stampaLottoDaDettaglio() {
    if (!lottoDettaglioCorrente) return;
    lottoInStampa = lottoDettaglioCorrente;
    chiudiModalDettaglioLotto();
    apriModalStampaCopie();
}

function terminaLottoDaDettaglio() {
    if (!lottoDettaglioCorrente) return;
    terminaLottoArchivio(lottoDettaglioCorrente);
}

function cambiaLottoDaDettaglio() {
    if (!lottoDettaglioCorrente) return;
    cambiaLotto(lottoDettaglioCorrente);
    chiudiModalDettaglioLotto();
}

function terminaLottoArchivio(lotto) {
    if (!lotto) return;
    if (lotto.terminato === true) {
        mostraNotifica('ℹ️ Lotto gia terminato', 'info');
        return;
    }

    if (!confirm(`Marcare il lotto "${lotto.prodotto}" come TERMINATO?`)) {
        return;
    }

    const index = databaseLotti.findIndex(l =>
        l.lottoInterno === lotto.lottoInterno &&
        l.dataProduzione === lotto.dataProduzione
    );

    if (index === -1) {
        mostraNotifica('⚠️ Lotto non trovato', 'warning');
        return;
    }

    databaseLotti[index].terminato = true;
    databaseLotti[index].dataTerminazione = new Date().toISOString();
    databaseLotti[index].operatoreTerminazione = sessionStorage.getItem('nomeUtenteLoggato') || 'Operatore';
    localStorage.setItem('haccp_lotti', JSON.stringify(databaseLotti));

    lottoDettaglioCorrente = databaseLotti[index];
    chiudiModalDettaglioLotto();
    renderizzaArchivioLotti();
    mostraNotifica(`✓ Lotto "${lotto.prodotto}" marcato come terminato`, 'success');
}



/* ===========================================================
   10. STAMPA ETICHETTE LOTTI
   =========================================================== */

const PRINT_DIRECT_URL = 'https://print.miohaccp.it/stampa';
const PRINT_DIRECT_TIMEOUT_MS = 2500;
const PRINT_FALLBACK_TIMEOUT_MS = 7000;

async function inviaStampa(datiStampa) {
    const token = localStorage.getItem('haccp_print_token') || '';
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        headers['x-print-token'] = token;
    }

    const targets = [];
    const isCustom = Boolean(datiStampa && datiStampa.customLabel);
    if (!isCustom && PRINT_DIRECT_URL && location.hostname.endsWith('onrender.com')) {
        targets.push({ url: PRINT_DIRECT_URL, timeout: PRINT_DIRECT_TIMEOUT_MS });
    }
    targets.push({ url: '/stampa', timeout: PRINT_FALLBACK_TIMEOUT_MS });

    let lastError = null;
    for (const target of targets) {
        try {
            const response = await fetch(target.url, {
                method: 'POST',
                headers,
                body: JSON.stringify(datiStampa),
                signal: AbortSignal.timeout(target.timeout)
            });
            return await response.json();
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('Stampa non raggiungibile');
}

async function stampaEtichettaLotto(lotto) {
    try {
        // Chiedi quante copie stampare
        const copie = prompt('Quante etichette vuoi stampare?', '1');
        if (!copie || copie === null) return;
        const numeroCopie = parseInt(copie);
        if (isNaN(numeroCopie) || numeroCopie < 1 || numeroCopie > 50) {
            alert('⚠️ Numero non valido! Inserisci un numero tra 1 e 50');
            return;
        }

        // Carica configurazione stampa
        const config = JSON.parse(localStorage.getItem('haccp_config_stampa')) || {
            larghezza: 40,
            altezza: 30,
            mostraTitolo: true,
            mostraProdotto: true,
            mostraLotto: true,
            mostraProduzione: true,
            mostraScadenza: true,
            sizeTitolo: 3,
            sizeCampi: 2,
            fontTitolo: '3',
            fontCampi: '2'
        };

        // Prepara dati per la stampa
        const datiStampa = {
            prodotto: String(lotto.prodotto || ''),
            lottoOrigine: String(lotto.lottoOrigine || ''),
            dataProduzione: String(lotto.dataProduzione || ''),
            scadenza: String(lotto.scadenza || lotto.dataScadenza || ''),
            copie: numeroCopie,
            config: config
        };

        // Invia stampa al server locale
        inviaStampa(datiStampa)
        .then(data => {
            if (!data.success) {
                console.error('Errore stampa:', data.error);
            }
        })
        .catch(error => {
            console.error('Errore connessione stampante:', error);
            mostraNotifica('⚠️ Errore comunicazione stampante', 'warning');
        });
        setTimeout(() => {
            mostraNotifica(`🖨️ ${numeroCopie} ${numeroCopie === 1 ? 'etichetta inviata' : 'etichette inviate'}!`, 'success');
        }, 100);
    } catch (error) {
        console.error('Errore stampa:', error);
        alert('Errore durante la stampa. Verifica che il server sia avviato.');
    }
}

async function stampaEtichettaLottoAuto(lotto) {
    try {
        const copieSalvate = parseInt(localStorage.getItem('haccp_copie_auto') || '1');
        const numeroCopie = isNaN(copieSalvate) || copieSalvate < 1 ? 1 : copieSalvate;

        const config = JSON.parse(localStorage.getItem('haccp_config_stampa')) || {
            larghezza: 40,
            altezza: 30,
            mostraTitolo: true,
            mostraProdotto: true,
            mostraLotto: true,
            mostraProduzione: true,
            mostraScadenza: true,
            sizeTitolo: 3,
            sizeCampi: 2,
            fontTitolo: '3',
            fontCampi: '2'
        };

        const datiStampa = {
            prodotto: String(lotto.prodotto || ''),
            lottoOrigine: String(lotto.lottoOrigine || ''),
            dataProduzione: String(lotto.dataProduzione || ''),
            scadenza: String(lotto.scadenza || lotto.dataScadenza || ''),
            copie: numeroCopie,
            config: config
        };

        inviaStampa(datiStampa)
        .then(data => {
            if (!data.success) {
                console.error('Errore stampa:', data.error);
            }
        })
        .catch(error => {
            console.error('Errore connessione stampante:', error);
            mostraNotifica('⚠️ Errore comunicazione stampante', 'warning');
        });

        setTimeout(() => {
            mostraNotifica(`🖨️ ${numeroCopie} ${numeroCopie === 1 ? 'etichetta inviata' : 'etichette inviate'}!`, 'success');
        }, 100);
    } catch (error) {
        console.error('Errore stampa automatica:', error);
    }
}

function leggiCampoEtichettaPersonalizzata(id, fallback) {
    const input = document.getElementById(id);
    if (!input) return fallback;
    const value = String(input.value || '').trim();
    return value || fallback;
}

function aggiornaAnteprimaEtichettaPersonalizzata() {
    const titolo = leggiCampoEtichettaPersonalizzata('custom-etichetta-nome', '');
    const etichetta = leggiCampoEtichettaPersonalizzata('custom-etichetta-label', '');
    const valore = leggiCampoEtichettaPersonalizzata('custom-etichetta-valore', '');

    const previewTitolo = document.getElementById('custom-preview-title');
    const previewEtichetta = document.getElementById('custom-preview-label');
    const previewValore = document.getElementById('custom-preview-value');

    if (previewTitolo) previewTitolo.textContent = titolo;
    if (previewEtichetta) previewEtichetta.textContent = etichetta;
    if (previewValore) previewValore.textContent = valore;
}

function stampaEtichettaPersonalizzata() {
    const titolo = leggiCampoEtichettaPersonalizzata('custom-etichetta-nome', '');
    const etichetta = leggiCampoEtichettaPersonalizzata('custom-etichetta-label', '');
    const valoreRaw = document.getElementById('custom-etichetta-valore');
    const valore = valoreRaw ? String(valoreRaw.value || '').trim() : '';

    if (!titolo && !etichetta && !valore) {
        alert('Inserisci almeno un testo da stampare');
        return;
    }

    const config = JSON.parse(localStorage.getItem('haccp_config_stampa')) || {
        larghezza: 40,
        altezza: 30,
        mostraTitolo: true,
        mostraProdotto: true,
        mostraLotto: true,
        mostraProduzione: true,
        mostraScadenza: true,
        sizeTitolo: 3,
        sizeCampi: 2,
        fontTitolo: '3',
        fontCampi: '2'
    };

    const datiStampa = {
        customLabel: true,
        titolo: titolo,
        etichetta: etichetta,
        valore: valore,
        copie: 1,
        config: config
    };

    inviaStampa(datiStampa)
    .then(data => {
        if (!data.success) {
            console.error('Errore stampa:', data.error || data.message);
            mostraNotifica('⚠️ Errore stampa etichetta', 'warning');
            return;
        }
        mostraNotifica('🖨️ Etichetta inviata!', 'success');
    })
    .catch(error => {
        console.error('Errore connessione stampante:', error);
        mostraNotifica('⚠️ Errore comunicazione stampante', 'warning');
    });
}



// VERIFICA SE IL SERVER È ATTIVO
async function verificaServer() {
    try {
        const response = await fetch('/test', {
            method: 'GET',
            signal: AbortSignal.timeout(2000)
        });
        return response.ok;
    } catch (err) {
        return false;
    }
}

// STAMPA AUTOMATICA (solo se server attivo)
async function generaCSVPerCLabel(lotto) {
    try {
        const popup = document.createElement('div');
        popup.id = 'loading-stampa';
        popup.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999;">
                <div style="background: white; padding: 40px; border-radius: 20px; text-align: center;">
                    <div style="font-size: 3rem; margin-bottom: 20px;">🖨️</div>
                    <h3 style="color: #333; margin: 0;">Invio stampa in corso...</h3>
                    <p style="color: #666; margin-top: 10px;">Attendere prego</p>
                </div>
            </div>
        `;
        document.body.appendChild(popup);
        
        const risultato = await inviaStampa(lotto);

        document.body.removeChild(popup);
        
        if (risultato.success) {
            alert('✅ ETICHETTA STAMPATA!\n\n' + lotto.prodotto + '\n' + lotto.lottoInterno);
        } else {
            throw new Error(risultato.error);
        }
        
    } catch (err) {
        const popup = document.getElementById('loading-stampa');
        if (popup) document.body.removeChild(popup);
        
        alert('❌ ERRORE STAMPA AUTOMATICA:\n\n' + err.message + '\n\nProvo modalità manuale...');
        scaricaCSVManuale(lotto);
    }
}

// SCARICA CSV MANUALE
function scaricaCSVManuale(lotto) {
    const csvContent = 
`PRODOTTO,LOTTO_INTERNO,LOTTO_ORIGINE,DATA_PROD,DATA_SCAD,OPERATORE
"${lotto.prodotto}","${lotto.lottoInterno}","${lotto.lottoOrigine}","${lotto.dataProduzione}","${lotto.scadenza}","${lotto.operatore}"`;
    
    const blob = new Blob([csvContent], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'etichetta_haccp.csv';
    link.click();
    URL.revokeObjectURL(url);
    
    setTimeout(() => {
        alert(
            '📥 FILE CSV SCARICATO!\n\n' +
            '🖨️ ISTRUZIONI cLabel:\n\n' +
            '1. Apri cLabel\n' +
            '2. File → Apri → etichetta_lotto.lab\n' +
            '3. Database → Importa\n' +
            '4. Seleziona: etichetta_haccp.csv\n' +
            '5. Conferma e Stampa\n\n' +
            '✅ Fatto!'
        );
    }, 500);
}

// STAMPA NORMALE (codice esistente)
function stampaNormale(lotto) {
    const finestra = window.open('', 'STAMPA_ETICHETTA', 'width=400,height=600');
    
    finestra.document.write(`
        <html>
        <head>
            <title>Etichetta Lotto ${lotto.prodotto}</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    padding: 20px; 
                    font-size: 14pt; 
                }
                .box { 
                    border: 3px solid black; 
                    padding: 15px; 
                    margin: 20px 0; 
                    page-break-after: always;
                }
                .grande { 
                    font-size: 22pt; 
                    font-weight: bold; 
                    text-align: center;
                    margin-bottom: 15px;
                    text-transform: uppercase;
                }
                .riga {
                    margin: 10px 0;
                    padding: 8px;
                    border-bottom: 1px solid #ccc;
                }
            </style>
        </head>
        <body>
            <div class="box">
                <div class="grande">${lotto.prodotto}</div>
                <div class="riga"><strong>LOTTO PRODUZIONE:</strong> ${lotto.lottoInterno}</div>
                <div class="riga"><strong>DATA PRODUZIONE:</strong> ${lotto.dataProduzione}</div>
                <div class="riga"><strong>SCADENZA:</strong> ${lotto.scadenza}</div>
                ${lotto.ingredientiUsati && lotto.ingredientiUsati.length > 0 ? 
                    `<div class="riga"><strong>INGREDIENTI USATI:</strong><br>${lotto.ingredientiUsati.map(i => [i.nome, i.lotto, i.scadenza].filter(Boolean).join(' | ')).join('<br>')}</div>` : ''}
                ${lotto.note ? `<div class="riga"><strong>NOTE:</strong> ${lotto.note}</div>` : ''}
                <div class="riga"><strong>OPERATORE:</strong> ${lotto.operatore}</div>
            </div>
        </body>
        </html>
    `);
    
    finestra.document.close();
    setTimeout(() => finestra.print(), 800);
}



/* ===========================================================
   11. VISUALIZZAZIONE STORICO (ADMIN/OPERATORE)
   =========================================================== */

function vaiAStorico() {
    // Imposta date di default (ultimi 7 giorni)
    const oggi = new Date();
    const setteGiorniFa = new Date();
    setteGiorniFa.setDate(oggi.getDate() - 7);
    
    document.getElementById('filtro-data-inizio').value = setteGiorniFa.toISOString().split('T')[0];
    document.getElementById('filtro-data-fine').value = oggi.toISOString().split('T')[0];
    
    vaiA('sez-storico-admin');
    filtraStorico(); 
}

// Carica Dashboard Avanzata con Grafici
function caricaDashboardAvanzata() {
    vaiA('sez-admin-dashboard');
    
    // Aggiorna statistiche
    aggiornaStatisticheDashboard();
    
    // Genera grafici
    setTimeout(() => {
        generaGraficoTemperature();
        generaGraficoLotti();
        generaGraficoNC();
        generaGraficoScadenze();
    }, 100);
}

function aggiornaStatisticheDashboard() {
    try {
        const temperature = JSON.parse(localStorage.getItem('haccp_log')) || [];
        const lotti = JSON.parse(localStorage.getItem('haccp_lotti')) || [];
        const lottiAttivi = lotti.filter(l => !l.terminato);
        const nc = JSON.parse(localStorage.getItem('haccp_nc')) || [];
        
        const statTemp = document.getElementById('stat-temperature');
        const statLotti = document.getElementById('stat-lotti');
        const statNC = document.getElementById('stat-nc');
        const statScad = document.getElementById('stat-scadenze');
        
        if (statTemp) statTemp.textContent = temperature.length;
        if (statLotti) statLotti.textContent = lottiAttivi.length;
        if (statNC) statNC.textContent = nc.length;
        
        // Conta prodotti in scadenza (prossimi 7 giorni) - solo attivi
        const prodottiScadenza = lottiAttivi.filter(l => {
            if (!l.scadenza) return false;
            const scadenza = new Date(l.scadenza);
            if (isNaN(scadenza.getTime())) return false;
            const oggi = new Date();
            const diff = Math.floor((scadenza - oggi) / (1000 * 60 * 60 * 24));
            return diff >= 0 && diff <= 7;
        }).length;
        
        if (statScad) statScad.textContent = prodottiScadenza;
    } catch (error) {
        console.error('Errore aggiornamento statistiche:', error);
    }
}

function generaGraficoTemperature() {
    try {
        if (typeof Chart === 'undefined') {
            console.error('Chart.js non caricato');
            return;
        }
        
        const temperature = JSON.parse(localStorage.getItem('haccp_log')) || [];
        const ultimi7 = temperature.slice(-7).reverse();
        
        const ctx = document.getElementById('chartTemperature');
        if (!ctx) {
            console.warn('Canvas chartTemperature non trovato');
            return;
        }
        
        // Distruggi grafico esistente se presente
        if (window.chartTempInstance) {
            window.chartTempInstance.destroy();
        }
        
        const labels = ultimi7.map(t => {
            const data = new Date(t.data);
            return data.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
        });
        
        window.chartTempInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Frigo (°C)',
                    data: ultimi7.map(t => parseFloat(t.temperaturaFrigo)),
                    borderColor: '#0A84FF',
                    backgroundColor: 'rgba(10, 132, 255, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'Freezer (°C)',
                    data: ultimi7.map(t => parseFloat(t.temperaturaFreezer)),
                    borderColor: '#64D2FF',
                    backgroundColor: 'rgba(100, 210, 255, 0.1)',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { labels: { color: '#fff' } }
            },
            scales: {
                y: {
                    ticks: { color: '#fff' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                x: {
                    ticks: { color: '#fff' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                }
            }
        }
    });
    } catch (error) {
        console.error('Errore generazione grafico temperature:', error);
    }
}

function generaGraficoLotti() {
    try {
        if (typeof Chart === 'undefined') return;
        
        const lotti = JSON.parse(localStorage.getItem('haccp_lotti')) || [];
        const lottiAttivi = lotti.filter(l => !l.terminato);
        
        // Conta per categoria
        const categorie = {};
        lottiAttivi.forEach(l => {
            const cat = l.categoria || 'Altro';
            categorie[cat] = (categorie[cat] || 0) + 1;
        });
        
        const ctx = document.getElementById('chartLotti');
        if (!ctx) return;
        
        if (window.chartLottiInstance) {
            window.chartLottiInstance.destroy();
        }
        
        window.chartLottiInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(categorie),
            datasets: [{
                data: Object.values(categorie),
                backgroundColor: [
                    '#0A84FF', '#30D158', '#FF9F0A', '#FF453A', 
                    '#BF5AF2', '#64D2FF', '#FFD60A'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { labels: { color: '#fff' } }
            }
        }
    });
    } catch (error) {
        console.error('Errore generazione grafico lotti:', error);
    }
}

function generaGraficoNC() {
    try {
        if (typeof Chart === 'undefined') return;
        
        const nc = JSON.parse(localStorage.getItem('haccp_nc')) || [];
        
        // Conta per tipo
        const tipi = {};
        nc.forEach(n => {
            const tipo = n.tipo || 'Altro';
            tipi[tipo] = (tipi[tipo] || 0) + 1;
        });
        
        const ctx = document.getElementById('chartNC');
        if (!ctx) return;
        
        if (window.chartNCInstance) {
            window.chartNCInstance.destroy();
        }
        
        window.chartNCInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(tipi),
            datasets: [{
                label: 'Non Conformità',
                data: Object.values(tipi),
                backgroundColor: '#FF453A'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { labels: { color: '#fff' } }
            },
            scales: {
                y: {
                    ticks: { color: '#fff', stepSize: 1 },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                x: {
                    ticks: { color: '#fff' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                }
            }
        }
    });
    } catch (error) {
        console.error('Errore generazione grafico NC:', error);
    }
}

function generaGraficoScadenze() {
    try {
        if (typeof Chart === 'undefined') return;
        
        const lotti = JSON.parse(localStorage.getItem('haccp_lotti')) || [];
        const lottiAttivi = lotti.filter(l => !l.terminato);
        const oggi = new Date();
        const prossimi30 = new Date();
        prossimi30.setDate(oggi.getDate() + 30);
        
        // Conta scadenze per settimana
        const settimane = ['0-7 gg', '8-14 gg', '15-21 gg', '22-30 gg'];
        const conteggi = [0, 0, 0, 0];
        
        lottiAttivi.forEach(l => {
            if (!l.scadenza) return;
            const scadenza = new Date(l.scadenza);
            if (isNaN(scadenza.getTime())) return;
            const diff = Math.floor((scadenza - oggi) / (1000 * 60 * 60 * 24));
            
            if (diff >= 0 && diff <= 7) conteggi[0]++;
            else if (diff >= 8 && diff <= 14) conteggi[1]++;
            else if (diff >= 15 && diff <= 21) conteggi[2]++;
            else if (diff >= 22 && diff <= 30) conteggi[3]++;
        });
        
        const ctx = document.getElementById('chartScadenze');
        if (!ctx) return;
        
        if (window.chartScadenzeInstance) {
            window.chartScadenzeInstance.destroy();
        }
        
        window.chartScadenzeInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: settimane,
            datasets: [{
                label: 'Prodotti in scadenza',
                data: conteggi,
                backgroundColor: ['#FF453A', '#FF9F0A', '#FFD60A', '#30D158']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { labels: { color: '#fff' } }
            },
            scales: {
                y: {
                    ticks: { color: '#fff', stepSize: 1 },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                x: {
                    ticks: { color: '#fff' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                }
            }
        }
    });
    } catch (error) {
        console.error('Errore generazione grafico scadenze:', error);
    }
}

function filtraStorico() {
    console.log('📊 Database temperature completo:', databaseTemperature);
    
    const dataInizio = document.getElementById('filtro-data-inizio').value || '1900-01-01';
    const dataFine = document.getElementById('filtro-data-fine').value || '2099-12-31';

    const temperatureFiltrate = databaseTemperature.filter(t => {
        let dataStr = t.data;
        
        if (dataStr.includes(',')) {
            dataStr = dataStr.split(',')[0].trim();
        } else if (dataStr.includes(' ')) {
            dataStr = dataStr.split(' ')[0].trim();
        }
        
        const parti = dataStr.split('/');
        
        if (parti.length !== 3) {
            console.warn('⚠️ Formato data non valido:', t.data);
            return false;
        }
        
        const giorno = parti[0].padStart(2, '0');
        const mese = parti[1].padStart(2, '0');
        const anno = parti[2];
        const dataReg = `${anno}-${mese}-${giorno}`;
        
        return dataReg >= dataInizio && dataReg <= dataFine;
    });

    mostraTemperatureTabella(temperatureFiltrate);
}

function mostraTemperatureTabella(dati) {
    const container = document.getElementById('storico-temperature');
    
    if (dati.length === 0) {
        container.innerHTML = '<p style="color:gray; text-align:center; padding:40px;">Nessun dato trovato nel periodo selezionato</p>';
        return;
    }

    let html = '<table style="width:100%; color:white; border-collapse: collapse; background: #1a1a1a;">';
    html += '<tr style="background:#333; font-weight:bold;">';
    html += '<th style="padding:12px; border:1px solid #555;">DATA E ORA</th>';
    html += '<th style="padding:12px; border:1px solid #555;">FRIGO</th>';
    html += '<th style="padding:12px; border:1px solid #555;">TEMPERATURA (°C)</th>';
    html += '<th style="padding:12px; border:1px solid #555;">OPERATORE</th>';
    html += '</tr>';

    dati.forEach(d => {
        // Gestisce ENTRAMBI i separatori (spazio E virgola)
        let dataCompleta = d.data;
        let soloData = dataCompleta;
        let soloOra = '';
        
        if (dataCompleta.includes(',')) {
            // Formato: "02/02/2026, 18:44:57"
            const parti = dataCompleta.split(',');
            soloData = parti[0].trim();
            soloOra = parti[1] ? parti[1].trim() : '';
        } else if (dataCompleta.includes(' ')) {
            // Formato: "02/02/2026 18:44:57"
            const parti = dataCompleta.split(' ');
            soloData = parti[0];
            soloOra = parti[1] || '';
        }
        
        html += `<tr style="border-bottom: 1px solid #444;">`;
        html += `<td style="padding:10px; border:1px solid #555;">
                    <strong>${soloData}</strong>
                    ${soloOra ? `<br><small style="color:#888;">${soloOra}</small>` : ''}
                 </td>`;
        html += `<td style="padding:10px; border:1px solid #555;">${d.frigo}</td>`;
        html += `<td style="padding:10px; border:1px solid #555; text-align:center; font-weight:bold; color:gold;">${d.gradi}°C</td>`;
        html += `<td style="padding:10px; border:1px solid #555;">${d.utente}</td>`;
        html += '</tr>';
    });

    html += '</table>';
    container.innerHTML = html;
}

function mostraTabStorico(quale) {
    document.getElementById('storico-temperature').style.display = 'none';
    document.getElementById('storico-lotti').style.display = 'none';
    document.getElementById('storico-pulizie').style.display = 'none'; 
    
    document.getElementById('tab-temp').style.background = '#444';
    document.getElementById('tab-temp').style.color = 'white';
    document.getElementById('tab-lotti').style.background = '#444';
    document.getElementById('tab-lotti').style.color = 'white';
    document.getElementById('tab-pulizie').style.background = '#444';
    document.getElementById('tab-pulizie').style.color = 'white'; 
    document.getElementById('tab-nc').style.background = '#444';
    document.getElementById('tab-nc').style.color = 'white'; 
    
    if (quale === 'temperature') {
        document.getElementById('storico-temperature').style.display = 'block';
        document.getElementById('tab-temp').style.background = 'gold';
        document.getElementById('tab-temp').style.color = 'black';
        filtraStorico();
    } else if (quale === 'lotti') {
        document.getElementById('storico-lotti').style.display = 'block';
        document.getElementById('tab-lotti').style.background = 'gold';
        document.getElementById('tab-lotti').style.color = 'black';
        mostraStoricoLotti();
    } else if (quale === 'pulizie') { // AGGIUNGI
        document.getElementById('storico-pulizie').style.display = 'block';
        document.getElementById('tab-pulizie').style.background = 'gold';
        document.getElementById('tab-pulizie').style.color = 'black';
        mostraStoricoPulizie();
    
    } else if (quale === 'nc') { // AGGIUNGI
        document.getElementById('storico-nc').style.display = 'block';
        document.getElementById('tab-nc').style.background = 'gold';
        document.getElementById('tab-nc').style.color = 'black';
        mostraStoricoNC();
    }
}

function mostraStoricoPulizie() {
    const container = document.getElementById('storico-pulizie');
    
    if (databasePulizie.length === 0) {
        container.innerHTML = '<p style="color:gray; text-align:center; padding:40px;">Nessuna registrazione pulizie</p>';
        return;
    }
    
    let html = '<table style="width:100%; color:white; border-collapse: collapse; background: #1a1a1a;">';
    html += '<tr style="background:#333; font-weight:bold;">';
    html += '<th style="padding:12px; border:1px solid #555;">DATA</th>';
    html += '<th style="padding:12px; border:1px solid #555;">ORA</th>';
    html += '<th style="padding:12px; border:1px solid #555;">OPERATORE</th>';
    html += '<th style="padding:12px; border:1px solid #555;">AREE</th>';
    html += '</tr>';
    
    [...databasePulizie].reverse().forEach(p => {
        html += `<tr style="border-bottom: 1px solid #444;">`;
        html += `<td style="padding:10px; border:1px solid #555;">${p.data}</td>`;
        html += `<td style="padding:10px; border:1px solid #555;">${p.ora}</td>`;
        html += `<td style="padding:10px; border:1px solid #555;">${p.operatore}</td>`;
        html += `<td style="padding:10px; border:1px solid #555; font-size:0.8rem;">${p.aree.length} zone</td>`;
        html += '</tr>';
    });

    html += '</table>';
    container.innerHTML = html;
}

        
function mostraStoricoLotti() {
        const container = document.getElementById('storico-lotti');
        
        if (databaseLotti.length === 0) {
        container.innerHTML = '<p style="color:gray; text-align:center; padding:40px;">Nessun lotto registrato</p>';
        return;
    }
        
        let html = '<table style="width:100%; color:white; border-collapse: collapse; background: #1a1a1a;">';
        html += '<tr style="background:#333; font-weight:bold;">';
        html += '<th style="padding:12px; border:1px solid #555;">DATA</th>';
        html += '<th style="padding:12px; border:1px solid #555;">PRODOTTO</th>';
        html += '<th style="padding:12px; border:1px solid #555;">LOTTO</th>';
        html += '<th style="padding:12px; border:1px solid #555;">SCADENZA</th>';
        html += '</tr>';
        
        [...databaseLotti].reverse().forEach(l => {
            html += `<tr style="border-bottom: 1px solid #444;">`;
            html += `<td style="padding:10px; border:1px solid #555;">${l.dataProduzione}</td>`;
            html += `<td style="padding:10px; border:1px solid #555;">${l.prodotto}</td>`;
            html += `<td style="padding:10px; border:1px solid #555; font-family:monospace;">${l.lottoInterno}</td>`;
            html += `<td style="padding:10px; border:1px solid #555;">${l.scadenza}</td>`;
            html += '</tr>';
        });
        
        html += '</table>';
        container.innerHTML = html;
    }

function mostraStoricoNC() {
    const container = document.getElementById('storico-nc');
    
    if (databaseNC.length === 0) {
        container.innerHTML = '<p style="color:gray; text-align:center; padding:40px;">Nessuna non conformità registrata</p>';
        return;
    }
    
    let html = '<table style="width:100%; color:white; border-collapse: collapse; background: #1a1a1a;">';
    html += '<tr style="background:#333; font-weight:bold;">';
    html += '<th style="padding:12px; border:1px solid #555;">ID</th>';
    html += '<th style="padding:12px; border:1px solid #555;">DATA</th>';
    html += '<th style="padding:12px; border:1px solid #555;">TIPO</th>';
    html += '<th style="padding:12px; border:1px solid #555;">GRAVITÀ</th>';
    html += '<th style="padding:12px; border:1px solid #555;">STATO</th>';
    html += '</tr>';
    
    [...databaseNC].reverse().forEach(nc => {
        const colorStato = nc.stato === 'APERTA' ? '#ff5252' : '#4CAF50';
        const iconaGravita = nc.gravita === 'Alta' ? '🔴' : nc.gravita === 'Media' ? '🟡' : '🟢';
        
        html += `<tr style="border-bottom: 1px solid #444;">`;
        html += `<td style="padding:10px; border:1px solid #555;">NC-${nc.id}</td>`;
        html += `<td style="padding:10px; border:1px solid #555;">${nc.dataApertura}</td>`;
        html += `<td style="padding:10px; border:1px solid #555;">${nc.tipo}</td>`;
        html += `<td style="padding:10px; border:1px solid #555;">${iconaGravita} ${nc.gravita}</td>`;
        html += `<td style="padding:10px; border:1px solid #555; color:${colorStato}; font-weight:bold;">${nc.stato}</td>`;
        html += '</tr>';
    });
    
    html += '</table>';
    container.innerHTML = html;
}


/* ===========================================================
   12. BACKUP E ESPORTAZIONE DATI
   =========================================================== */

function backupAutomatico() {
    const datiCompleti = {
        utenti: localStorage.getItem('haccp_utenti'),
        frigoriferi: localStorage.getItem('haccp_frigo'),
        temperature: localStorage.getItem('haccp_log'),
        lotti: localStorage.getItem('haccp_lotti'),
        prodotti: localStorage.getItem('haccp_elenco_nomi'),
        timestamp: new Date().toISOString(),
        versione: '1.0'
    };
    
    const dataOggi = new Date().toISOString().split('T')[0];
    const nomeFile = `HACCP_BACKUP_${dataOggi}.json`;
    
    const blob = new Blob([JSON.stringify(datiCompleti, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeFile;
    a.click();
    URL.revokeObjectURL(url);
    
    alert(`✅ Backup completato!\nFile: ${nomeFile}`);
}

function esportaStoricoCSV() {
    if (databaseTemperature.length === 0) {
        alert('⚠️ Nessun dato da esportare');
        return;
    }
    
    let csv = 'DATA/ORA,FRIGORIFERO,TEMPERATURA,OPERATORE,STATO\n';
    
    databaseTemperature.forEach(t => {
        csv += `"${t.data}","${t.frigo}",${t.gradi},"${t.utente}","${t.stato}"\n`;
    });
    
    const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HACCP_TEMPERATURE_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    alert('✅ File CSV scaricato!');
}

/* ===========================================================
   14. GESTIONE PULIZIE E SANIFICAZIONE
   =========================================================== */

// Database pulizie
let databasePulizie = JSON.parse(localStorage.getItem("haccp_pulizie")) || [];

// Aree standard da pulire in macelleria
const areePulizia = [
    { id: 1, nome: "Bancone Vendita", frequenza: "Giornaliera" },
    { id: 2, nome: "Celle Frigorifere", frequenza: "Giornaliera" },
    { id: 3, nome: "Zona Lavorazione Carni", frequenza: "Giornaliera" },
    { id: 4, nome: "Pavimenti", frequenza: "Giornaliera" },
    { id: 5, nome: "Attrezzature (Tritacarne, Affettatrice)", frequenza: "Giornaliera" },
    { id: 6, nome: "Lavandini e Sanitari", frequenza: "Giornaliera" },
    { id: 7, nome: "Magazzino", frequenza: "Settimanale" },
    { id: 8, nome: "Vetrine Esposizione", frequenza: "Giornaliera" }
];

// Variabile per la data visualizzata
let dataVisualizzataPulizie = new Date();

// Apre la sezione pulizie
function vaiAPulizie() {
    dataVisualizzataPulizie = new Date();
    renderizzaPulizieGiorno();
    vaiA('sez-op-pulizie');
}

// Cambia data (frecce avanti/indietro)
function cambiaDataPulizie(offset) {
    dataVisualizzataPulizie.setDate(dataVisualizzataPulizie.getDate() + offset);
    renderizzaPulizieGiorno();
}

// Disegna la checklist pulizie del giorno
function renderizzaPulizieGiorno() {
    const container = document.getElementById("lista-pulizie-giorno");
    const dataStr = dataVisualizzataPulizie.toLocaleDateString('it-IT');
    document.getElementById("data-visualizzata-pulizie").innerText = dataStr;

    // Verifica se esiste già una registrazione per oggi
    const registrazioneEsistente = databasePulizie.find(p => p.data === dataStr);

    if (registrazioneEsistente) {
        // Mostra conferma avvenuta
        container.innerHTML = `
            <div style="background: linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%); padding: 30px; border-radius: 16px; text-align: center; border: 2px solid #4CAF50;">
                <div style="font-size: 4rem; margin-bottom: 15px;">✅</div>
                <h3 style="color: white; margin-bottom: 10px;">PULIZIE COMPLETATE</h3>
                <p style="color: #aaa; margin-bottom: 5px;">Data: ${registrazioneEsistente.data}</p>
                <p style="color: #aaa; margin-bottom: 5px;">Operatore: ${registrazioneEsistente.operatore}</p>
                <p style="color: #aaa;">Ora: ${registrazioneEsistente.ora}</p>
                
                <div style="margin-top: 20px; padding: 15px; background: rgba(0,0,0,0.2); border-radius: 8px;">
                    <p style="color: white; font-size: 0.9rem; margin-bottom: 10px;"><strong>Aree sanificate:</strong></p>
                    <ul style="list-style: none; padding: 0; color: #ddd; font-size: 0.85rem;">
                        ${areePulizia.map(a => `<li style="margin: 5px 0;">✓ ${a.nome}</li>`).join('')}
                    </ul>
                </div>
                
                <button onclick="eliminaRegistrazionePulizia('${dataStr}')" style="margin-top: 20px; background: #ff5252;">
                    🗑️ CANCELLA REGISTRAZIONE
                </button>
            </div>
        `;
        return;
    }

    // Mostra checklist da completare
    let html = '<div style="background: var(--grigio-medio); padding: 20px; border-radius: 16px; border: 2px solid var(--oro);">';
    html += '<h4 style="color: var(--oro); margin-bottom: 20px; text-align: center;">CHECKLIST SANIFICAZIONE</h4>';
    
    areePulizia.forEach(area => {
        const badgeColor = area.frequenza === 'Giornaliera' ? '#4CAF50' : '#FF9800';
        html += `
            <div style="background: var(--grigio-scuro); padding: 15px; margin-bottom: 12px; border-radius: 10px; border-left: 4px solid ${badgeColor};">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: bold; color: white; margin-bottom: 5px;">${area.nome}</div>
                        <div style="font-size: 0.75rem; color: #aaa;">Frequenza: ${area.frequenza}</div>
                    </div>
                    <input type="checkbox" id="check-area-${area.id}" checked style="width: 25px; height: 25px; cursor: pointer;">
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// Salva registrazione pulizie
function registraPulizieGiorno() {
    const dataStr = dataVisualizzataPulizie.toLocaleDateString('it-IT');
    const operatore = sessionStorage.getItem('nomeUtenteLoggato') || 'Operatore';
    
    // Verifica che tutte le checkbox siano spuntate
    let tutteSpuntate = true;
    areePulizia.forEach(area => {
        const checkbox = document.getElementById(`check-area-${area.id}`);
        if (checkbox && !checkbox.checked) {
            tutteSpuntate = false;
        }
    });
    
    if (!tutteSpuntate) {
        alert('⚠️ Attenzione: Non tutte le aree sono state spuntate!\n\nCompleta la checklist prima di confermare.');
        return;
    }
    
    // Chiedi conferma
    if (!confirm('Confermi che tutte le pulizie sono state eseguite correttamente?')) {
        return;
    }
    
    // Crea registrazione
    const nuovaRegistrazione = {
        data: dataStr,
        operatore: operatore,
        ora: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        aree: areePulizia.map(a => a.nome),
        timestamp: new Date().toISOString()
    };
    
    // Salva
    databasePulizie.push(nuovaRegistrazione);
    localStorage.setItem("haccp_pulizie", JSON.stringify(databasePulizie));
    
    // Ricarica visualizzazione
    renderizzaPulizieGiorno();
    
    alert('✅ Pulizie registrate con successo!');
}

// Elimina registrazione (se serve correggere)
function eliminaRegistrazionePulizia(data) {
    if (!confirm('Vuoi davvero cancellare questa registrazione?')) {
        return;
    }
    
    databasePulizie = databasePulizie.filter(p => p.data !== data);
    localStorage.setItem("haccp_pulizie", JSON.stringify(databasePulizie));
    
    renderizzaPulizieGiorno();
    alert('🗑️ Registrazione eliminata');
}

/* ===========================================================
   15. GESTIONE NON CONFORMITÀ E AZIONI CORRETTIVE
   =========================================================== */

// Database non conformità
let databaseNC = JSON.parse(localStorage.getItem("haccp_nc")) || [];

// Filtro attivo (default: aperte)
let filtroNCAttivo = 'aperte';

// Apre sezione NC
function vaiANC() {
    filtroNCAttivo = 'aperte';
    renderizzaListaNC();
    vaiA('sez-op-nc');
}

// Apre modal nuova segnalazione
function apriModalNC() {
    document.getElementById("modal-nc").style.display = "flex";
}

function chiudiModalNC() {
    document.getElementById("modal-nc").style.display = "none";
    // Reset campi
    document.getElementById("nc-tipo").value = "";
    document.getElementById("nc-area").value = "";
    document.getElementById("nc-descrizione").value = "";
    document.getElementById("nc-gravita").value = "Bassa";
}

// Salva nuova NC
function salvaNC() {
    const tipo = document.getElementById("nc-tipo").value;
    const area = document.getElementById("nc-area").value;
    const descrizione = document.getElementById("nc-descrizione").value.trim();
    const gravita = document.getElementById("nc-gravita").value;
    
    if (!tipo || !area || !descrizione) {
        alert('⚠️ Compila tutti i campi obbligatori');
        return;
    }
    
    const nuovaNC = {
        id: Date.now(),
        tipo: tipo,
        area: area,
        descrizione: descrizione,
        gravita: gravita,
        dataApertura: new Date().toLocaleDateString('it-IT'),
        oraApertura: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        segnalatore: sessionStorage.getItem('nomeUtenteLoggato') || 'Operatore',
        stato: 'APERTA',
        azioneCorrettiva: null,
        dataChiusura: null,
        responsabileChiusura: null,
        timestamp: new Date().toISOString()
    };
    
    databaseNC.push(nuovaNC);
    localStorage.setItem("haccp_nc", JSON.stringify(databaseNC));
    
    chiudiModalNC();
    renderizzaListaNC();
    
    alert('⚠️ Non Conformità registrata!\n\nID: NC-' + nuovaNC.id);
}

// Filtra NC per stato
function filtraNC(stato) {
    filtroNCAttivo = stato;
    
    // Aggiorna stile pulsanti
    document.getElementById('filtro-aperte').style.background = '#444';
    document.getElementById('filtro-chiuse').style.background = '#444';
    document.getElementById('filtro-tutte').style.background = '#444';
    
    if (stato === 'aperte') {
        document.getElementById('filtro-aperte').style.background = '#ff5252';
    } else if (stato === 'chiuse') {
        document.getElementById('filtro-chiuse').style.background = '#4CAF50';
    } else {
        document.getElementById('filtro-tutte').style.background = 'gold';
        document.getElementById('filtro-tutte').style.color = 'black';
    }
    
    renderizzaListaNC();
}

// Renderizza lista NC
function renderizzaListaNC() {
    const container = document.getElementById("lista-nc");
    
    // Filtra in base allo stato
    let ncFiltrate = databaseNC;
    if (filtroNCAttivo === 'aperte') {
        ncFiltrate = databaseNC.filter(nc => nc.stato === 'APERTA');
    } else if (filtroNCAttivo === 'chiuse') {
        ncFiltrate = databaseNC.filter(nc => nc.stato === 'CHIUSA');
    }
    
    if (ncFiltrate.length === 0) {
        const messaggio = filtroNCAttivo === 'aperte' 
            ? '🎉 Nessuna non conformità aperta<br>Tutto sotto controllo!'
            : filtroNCAttivo === 'chiuse'
            ? '📋 Nessuna NC chiusa da visualizzare'
            : '📋 Nessuna segnalazione presente';
        
        container.innerHTML = `<p style="text-align:center; color:#666; padding:60px 20px; font-size:0.95rem;">${messaggio}</p>`;
        return;
    }
    
    // Ordina per data (più recenti prima)
    ncFiltrate.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Genera HTML
    let html = '';
    ncFiltrate.forEach(nc => {
        const coloreBordo = nc.stato === 'APERTA' ? '#ff5252' : '#4CAF50';
        const iconaGravita = nc.gravita === 'Alta' ? '🔴' : nc.gravita === 'Media' ? '🟡' : '🟢';
        
        html += `
        <div class="card-lotto" style="border-left: 6px solid ${coloreBordo}; margin-bottom: 20px;">
            <div class="card-lotto-contenuto">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                    <div>
                        <div style="font-size: 0.75rem; color: #888; margin-bottom: 5px;">ID: NC-${nc.id}</div>
                        <div class="card-lotto-titolo" style="color: ${coloreBordo};">${iconaGravita} ${nc.tipo}</div>
                    </div>
                    <div style="background: ${coloreBordo}; color: white; padding: 5px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: bold;">
                        ${nc.stato}
                    </div>
                </div>
                
                <div class="card-lotto-info">📍 Area: ${nc.area}</div>
                <div class="card-lotto-info">📅 Aperta: ${nc.dataApertura} alle ${nc.oraApertura}</div>
                <div class="card-lotto-info">👤 Segnalatore: ${nc.segnalatore}</div>
                <div class="card-lotto-info">⚖️ Gravità: ${nc.gravita}</div>
                
                <div style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px; margin-top: 12px;">
                    <div style="font-size: 0.85rem; color: #ddd; line-height: 1.5;">${nc.descrizione}</div>
                </div>
                
                ${nc.stato === 'CHIUSA' ? `
                    <div style="background: rgba(76, 175, 80, 0.2); padding: 12px; border-radius: 8px; margin-top: 12px; border-left: 3px solid #4CAF50;">
                        <div style="font-size: 0.8rem; color: #4CAF50; font-weight: bold; margin-bottom: 5px;">✅ AZIONE CORRETTIVA:</div>
                        <div style="font-size: 0.85rem; color: #ddd; margin-bottom: 8px;">${nc.azioneCorrettiva}</div>
                        <div style="font-size: 0.75rem; color: #888;">Chiusa il ${nc.dataChiusura} da ${nc.responsabileChiusura}</div>
                    </div>
                ` : ''}
            </div>
            
            ${nc.stato === 'APERTA' ? `
                <div class="card-lotto-azioni">
                    <button class="btn-stampa-lotto" onclick="apriModalAzioneCorrettiva(${nc.id})" style="background: #4CAF50;">
                        ✅ RISOLVI
                    </button>
                </div>
            ` : ''}
        </div>
        `;
    });
    
    container.innerHTML = html;
}

// Apre modal azione correttiva
function apriModalAzioneCorrettiva(idNC) {
    document.getElementById('nc-id-chiusura').value = idNC;
    document.getElementById('nc-responsabile').value = sessionStorage.getItem('nomeUtenteLoggato') || 'Operatore';
    document.getElementById("modal-azione-correttiva").style.display = "flex";
}

function chiudiModalAzioneCorrettiva() {
    document.getElementById("modal-azione-correttiva").style.display = "none";
    document.getElementById("nc-azione").value = "";
}

// Chiude NC con azione correttiva
function chiudiNC() {
    const idNC = parseInt(document.getElementById('nc-id-chiusura').value);
    const azione = document.getElementById('nc-azione').value.trim();
    const responsabile = document.getElementById('nc-responsabile').value;
    
    if (!azione) {
        alert('⚠️ Descrivi l\'azione correttiva intrapresa');
        return;
    }
    
    if (!confirm('Confermi la chiusura di questa Non Conformità?')) {
        return;
    }
    
    // Trova e aggiorna NC
    const nc = databaseNC.find(n => n.id === idNC);
    if (nc) {
        nc.stato = 'CHIUSA';
        nc.azioneCorrettiva = azione;
        nc.dataChiusura = new Date().toLocaleDateString('it-IT') + ' ' + new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        nc.responsabileChiusura = responsabile;
        
        localStorage.setItem("haccp_nc", JSON.stringify(databaseNC));
        
        chiudiModalAzioneCorrettiva();
        renderizzaListaNC();
        
        alert('✅ Non Conformità chiusa con successo!\n\nID: NC-' + idNC);
    }
}

/* ===========================================================
   16. GENERAZIONE REPORT MENSILE HACCP
   =========================================================== */

// Apre sezione report
function apriGeneratoreReport() {
    const oggi = new Date();
    const meseCorrente = oggi.toISOString().substring(0, 7);
    document.getElementById('mese-report').value = meseCorrente;
    
    document.getElementById('anteprima-report').style.display = 'none';
    document.getElementById('azioni-report').style.display = 'none';
    
    vaiA('sez-report-mensile');
}

// Genera report mensile
function generaReportMensile() {
    const meseSelezionato = document.getElementById('mese-report').value;
    
    if (!meseSelezionato) {
        alert('⚠️ Seleziona un mese');
        return;
    }
    
    const [anno, mese] = meseSelezionato.split('-');
    const nomiMesi = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 
                      'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    const nomeMesseCompleto = nomiMesi[parseInt(mese) - 1] + ' ' + anno;
    
    // Filtra dati del mese
    const temperaturesDelMese = databaseTemperature.filter(t => {
        // Gestisce sia "31/01/2026 14:30" che "31/01/2026"
        const soloData = t.data.includes(' ') ? t.data.split(' ')[0] : t.data;
        const parti = soloData.split('/'); // ["31","01","2026"]
        
        // Verifica che ci siano 3 parti (giorno, mese, anno)
        if (parti.length !== 3) return false;
        
        const dataReg = `${parti[2]}-${parti[1].padStart(2, '0')}-${parti[0].padStart(2, '0')}`; // "2026-01-31"
        return dataReg.startsWith(meseSelezionato);
    });
    
    const lottiDelMese = databaseLotti.filter(l => {
        const parti = l.dataProduzione.split('/');
        const dataReg = `${parti[2]}-${parti[1]}-${parti[0]}`;
        return dataReg.startsWith(meseSelezionato);
    });
    
    const pulizieDelMese = databasePulizie.filter(p => {
        const parti = p.data.split('/');
        const dataReg = `${parti[2]}-${parti[1]}-${parti[0]}`;
        return dataReg.startsWith(meseSelezionato);
    });
    
    const ncDelMese = databaseNC.filter(nc => {
        const parti = nc.dataApertura.split('/');
        const dataReg = `${parti[2]}-${parti[1]}-${parti[0]}`;
        return dataReg.startsWith(meseSelezionato);
    });
    
    // Genera HTML report
    let html = `
        <div style="text-align: center; border-bottom: 3px solid #2196F3; padding-bottom: 20px; margin-bottom: 30px;">
            <h1 style="color: #2196F3; margin: 0; font-size: 2rem;">REPORT HACCP MENSILE</h1>
            <h2 style="color: #333; margin: 10px 0 0 0; font-size: 1.5rem;">${nomeMesseCompleto}</h2>
            <p style="color: #666; margin: 5px 0 0 0; font-size: 0.9rem;">Generato il ${new Date().toLocaleDateString('it-IT')}</p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 30px;">
            <div style="background: #e3f2fd; padding: 20px; border-radius: 10px; border-left: 5px solid #2196F3;">
                <div style="font-size: 2rem; font-weight: bold; color: #2196F3;">${temperaturesDelMese.length}</div>
                <div style="color: #666; font-size: 0.9rem;">RILEVAZIONI TEMPERATURE</div>
            </div>
            <div style="background: #fff3e0; padding: 20px; border-radius: 10px; border-left: 5px solid #FF9800;">
                <div style="font-size: 2rem; font-weight: bold; color: #FF9800;">${lottiDelMese.length}</div>
                <div style="color: #666; font-size: 0.9rem;">LOTTI PRODOTTI</div>
            </div>
            <div style="background: #e8f5e9; padding: 20px; border-radius: 10px; border-left: 5px solid #4CAF50;">
                <div style="font-size: 2rem; font-weight: bold; color: #4CAF50;">${pulizieDelMese.length}</div>
                <div style="color: #666; font-size: 0.9rem;">SANIFICAZIONI</div>
            </div>
            <div style="background: #ffebee; padding: 20px; border-radius: 10px; border-left: 5px solid #f44336;">
                <div style="font-size: 2rem; font-weight: bold; color: #f44336;">${ncDelMese.length}</div>
                <div style="color: #666; font-size: 0.9rem;">NON CONFORMITÀ</div>
            </div>
        </div>

        <div style="margin-bottom: 30px; page-break-inside: avoid;">
            <h3 style="color: #2196F3; border-bottom: 2px solid #2196F3; padding-bottom: 10px;">🌡️ CONTROLLO TEMPERATURE</h3>
            ${temperaturesDelMese.length > 0 ? `
                <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                    <thead>
                        <tr style="background: #2196F3; color: white;">
                            <th style="padding: 10px; text-align: left;">DATA</th>
                            <th style="padding: 10px; text-align: left;">FRIGO</th>
                            <th style="padding: 10px; text-align: center;">TEMP (°C)</th>
                            <th style="padding: 10px; text-align: left;">OPERATORE</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${temperaturesDelMese.map((t, i) => `
                            <tr style="background: ${i % 2 === 0 ? '#f5f5f5' : 'white'}; border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px;">${t.data.split(' ')[0]}</td>
                                <td style="padding: 8px;">${t.frigo}</td>
                                <td style="padding: 8px; text-align: center; font-weight: bold;">${t.gradi}</td>
                                <td style="padding: 8px;">${t.utente}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : '<p style="color: #999; text-align: center; padding: 20px;">Nessuna registrazione</p>'}
        </div>

        <div style="margin-bottom: 30px; page-break-inside: avoid;">
            <h3 style="color: #FF9800; border-bottom: 2px solid #FF9800; padding-bottom: 10px;">🏷️ TRACCIABILITÀ LOTTI</h3>
            ${lottiDelMese.length > 0 ? `
                <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                    <thead>
                        <tr style="background: #FF9800; color: white;">
                            <th style="padding: 10px; text-align: left;">CODICE LOTTO</th>
                            <th style="padding: 10px; text-align: left;">PRODOTTO</th>
                            <th style="padding: 10px; text-align: center;">SCADENZA</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${lottiDelMese.map((l, i) => `
                            <tr style="background: ${i % 2 === 0 ? '#fff3e0' : 'white'}; border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-family: monospace;">${l.lottoInterno}</td>
                                <td style="padding: 8px;">${l.prodotto}</td>
                                <td style="padding: 8px; text-align: center;">${l.scadenza}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : '<p style="color: #999; text-align: center; padding: 20px;">Nessun lotto registrato</p>'}
        </div>

        <div style="margin-bottom: 30px; page-break-inside: avoid;">
            <h3 style="color: #4CAF50; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">🧹 SANIFICAZIONE AMBIENTI</h3>
            ${pulizieDelMese.length > 0 ? `
                <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                    <thead>
                        <tr style="background: #4CAF50; color: white;">
                            <th style="padding: 10px; text-align: left;">DATA</th>
                            <th style="padding: 10px; text-align: center;">AREE PULITE</th>
                            <th style="padding: 10px; text-align: left;">RESPONSABILE</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pulizieDelMese.map((p, i) => `
                            <tr style="background: ${i % 2 === 0 ? '#e8f5e9' : 'white'}; border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px;">${p.data}</td>
                                <td style="padding: 8px; text-align: center;">${p.aree.length}</td>
                                <td style="padding: 8px;">${p.operatore}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : '<p style="color: #999; text-align: center; padding: 20px;">Nessuna sanificazione</p>'}
        </div>

        <div style="margin-bottom: 30px; page-break-inside: avoid;">
            <h3 style="color: #f44336; border-bottom: 2px solid #f44336; padding-bottom: 10px;">⚠️ NON CONFORMITÀ</h3>
            ${ncDelMese.length > 0 ? `
                <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                    <thead>
                        <tr style="background: #f44336; color: white;">
                            <th style="padding: 10px; text-align: left;">ID</th>
                            <th style="padding: 10px; text-align: left;">TIPO</th>
                            <th style="padding: 10px; text-align: center;">STATO</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ncDelMese.map((nc, i) => `
                            <tr style="background: ${i % 2 === 0 ? '#ffebee' : 'white'}; border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px;">NC-${nc.id}</td>
                                <td style="padding: 8px;">${nc.tipo}</td>
                                <td style="padding: 8px; text-align: center; color: ${nc.stato === 'APERTA' ? '#f44336' : '#4CAF50'}; font-weight: bold;">${nc.stato}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : '<p style="color: #999; text-align: center; padding: 20px;">Nessuna NC</p>'}
        </div>

        <div style="margin-top: 50px; padding-top: 30px; border-top: 2px solid #333;">
            <p style="color: #666; font-size: 0.9rem; margin-bottom: 30px;">
                Il sottoscritto dichiara che le registrazioni sopra riportate sono conformi al Piano HACCP.
            </p>
            <div style="display: flex; justify-content: space-between; margin-top: 40px;">
                <div style="text-align: center;">
                    <div style="border-top: 2px solid #333; width: 200px; margin-bottom: 5px;"></div>
                    <small style="color: #666;">Firma Responsabile HACCP</small>
                </div>
                <div style="text-align: center;">
                    <div style="border-top: 2px solid #333; width: 150px; margin-bottom: 5px;"></div>
                    <small style="color: #666;">Data</small>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('anteprima-report').innerHTML = html;
    document.getElementById('anteprima-report').style.display = 'block';
    document.getElementById('azioni-report').style.display = 'flex';
}

function stampaReport() {
    window.print();
}

function scaricaReportPDF() {
    alert('💡 Nella finestra di stampa seleziona:\n"Salva come PDF"\n\nPoi clicca Salva.');
    window.print();
}

/* ===========================================================
   13. NOTIFICHE
   =========================================================== */

function mostraNotifica(testo, tipo = 'success') {
    const notifica = document.createElement('div');
    
    // Stili in base al tipo
    const colori = {
        success: '#4CAF50',
        error: '#f44336',
        warning: '#FF9800',
        info: '#2196F3'
    };

    notifica.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colori[tipo] || colori.success};
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-size: 1rem;
        font-weight: bold;
        max-width: 400px;
        animation: slideIn 0.3s ease-out;
    `;
    
    notifica.textContent = testo;
    document.body.appendChild(notifica);

    // Rimuovi dopo 4 secondi
    setTimeout(() => {
        notifica.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => notifica.remove(), 300);
    }, 4000);
}


/* ===========================================================
   GESTIONE CONFIGURAZIONE STAMPA
   =========================================================== */

function salvaConfigurazioneStampa() {
    const config = {
        larghezza: document.getElementById('cfg-larghezza').value,
        altezza: document.getElementById('cfg-altezza').value,
        mostraTitolo: document.getElementById('cfg-mostra-titolo').checked,
        mostraProdotto: document.getElementById('cfg-mostra-prodotto').checked,
        mostraLotto: document.getElementById('cfg-mostra-lotto').checked,
        mostraProduzione: document.getElementById('cfg-mostra-produzione').checked,
        mostraScadenza: document.getElementById('cfg-mostra-scadenza').checked,
        sizeTitolo: document.getElementById('cfg-size-titolo').value,
        sizeCampi: document.getElementById('cfg-size-campi').value,
        fontTitolo: document.getElementById('cfg-font-titolo').value,
        fontCampi: document.getElementById('cfg-font-campi').value
    };
    
    localStorage.setItem('haccp_config_stampa', JSON.stringify(config));
    mostraNotifica('✅ Configurazione stampa salvata!', 'success');
}

function caricaConfigurazioneStampa() {
    const config = JSON.parse(localStorage.getItem('haccp_config_stampa'));
    if (config) {
        document.getElementById('cfg-larghezza').value = config.larghezza || 40;
        document.getElementById('cfg-altezza').value = config.altezza || 30;
        document.getElementById('cfg-mostra-titolo').checked = config.mostraTitolo !== false;
        document.getElementById('cfg-mostra-prodotto').checked = config.mostraProdotto !== false;
        document.getElementById('cfg-mostra-lotto').checked = config.mostraLotto !== false;
        document.getElementById('cfg-mostra-produzione').checked = config.mostraProduzione !== false;
        document.getElementById('cfg-mostra-scadenza').checked = config.mostraScadenza !== false;
        document.getElementById('cfg-size-titolo').value = config.sizeTitolo || 3;
        document.getElementById('cfg-size-campi').value = config.sizeCampi || 2;
        document.getElementById('cfg-font-titolo').value = config.fontTitolo || '3';
        document.getElementById('cfg-font-campi').value = config.fontCampi || '2';
    }
}

async function testStampa() {
    const lottoDiTest = {
        prodotto: "TEST PRODOTTO",
        lottoOrigine: "TEST123",
        dataProduzione: new Date().toLocaleDateString('it-IT'),
        scadenza: new Date(Date.now() + 3*24*60*60*1000).toLocaleDateString('it-IT'),
        ingredienti: "Ingredienti di test"
    };
    
    mostraNotifica('🖨️ Invio stampa di test...', 'info');
    await stampaEtichettaLotto(lottoDiTest);
}

// Carica configurazione quando si apre la pagina
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(caricaConfigurazioneStampa, 500);
    setTimeout(caricaAccountPEC, 500); // Carica account PEC salvati
    setTimeout(aggiornaAnteprimaEtichettaPersonalizzata, 500);
    
    // Previeni comportamento default solo per stampe etichette
    document.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            const onclick = e.target.getAttribute('onclick');
            const allowStampa = e.target.getAttribute('data-allow-stampa') === 'true';
            if (!allowStampa && onclick && onclick.includes('stampa')) {
                e.preventDefault();
                e.stopPropagation();
            }
        }
    }, true);
});


/* ===========================================================
   GESTIONE PEC FATTURE
   =========================================================== */

function caricaAccountPEC() {
    renderizzaListaAccountPEC();
    verificaScansionePECAutomatica();
}

function renderizzaListaAccountPEC() {
    // Migrazione da account singolo a multipli (retrocompatibilità)
    const vecchioAccount = localStorage.getItem('haccp_pec_account');
    const accountsEsistenti = localStorage.getItem('haccp_pec_accounts');
    
    if (vecchioAccount && !accountsEsistenti) {
        // Migra il vecchio formato al nuovo
        try {
            const acc = JSON.parse(vecchioAccount);
            localStorage.setItem('haccp_pec_accounts', JSON.stringify([acc]));
            console.log('✅ Migrato account PEC da vecchio formato');
        } catch (e) {
            console.error('Errore migrazione account:', e);
        }
    }
    
    const accounts = JSON.parse(localStorage.getItem('haccp_pec_accounts')) || [];
    const container = document.getElementById('lista-pec-accounts');
    
    if (accounts.length === 0) {
        container.innerHTML = '<p style="color:gray; text-align:center; padding:20px;">Nessun account configurato</p>';
        return;
    }
    
    let html = '';
    accounts.forEach((acc, i) => {
        html += `
            <div style="background:#2a2a2a; padding:10px 12px; border-radius:6px; margin-bottom:8px; border-left:3px solid #4CAF50;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
                    <div style="flex:1; min-width:0;">
                        <div style="font-weight:bold; color:#4CAF50; margin-bottom:3px; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">📧 ${acc.email}</div>
                        <div style="font-size:11px; color:#888; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">📁 ${acc.cartella}</div>
                        ${acc.descrizione ? `<div style="font-size:10px; color:#666; margin-top:2px;">${acc.descrizione}</div>` : ''}
                    </div>
                    <div style="display:flex; gap:6px; flex-shrink:0;">
                        <button type="button" onclick="testConnessionePEC(${i})" style="padding:6px 10px; background:#2196F3; border:none; border-radius:4px; cursor:pointer; font-size:12px; white-space:nowrap;">🔌 TEST</button>
                        <button type="button" onclick="rimuoviAccountPEC(${i})" style="padding:6px 10px; background:#f44336; border:none; border-radius:4px; cursor:pointer; font-size:12px;">🗑️</button>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function aggiungiAccountPEC() {
    const email = prompt('📧 Indirizzo email PEC (es: fatture@pec.tuaazienda.it):');
    if (!email) return;
    
    const password = prompt('🔐 Password PEC:');
    if (!password) return;
    
    const cartella = prompt('📁 Cartella destinazione (es: C:\\Fatture\\Attività1):', 'C:\\Fatture');
    if (!cartella) return;
    
    const descrizione = prompt('📝 Descrizione (opzionale, es: "Ristorante Centro"):', '');
    
    // Salva account senza host - sarà rilevato automaticamente al test
    const accounts = JSON.parse(localStorage.getItem('haccp_pec_accounts')) || [];
    accounts.push({ 
        email, 
        password, 
        cartella, 
        descrizione,
        host: null // Sarà rilevato automaticamente al primo test
    });
    localStorage.setItem('haccp_pec_accounts', JSON.stringify(accounts));
    
    renderizzaListaAccountPEC();
    mostraNotifica('✅ Account aggiunto! Clicca TEST per rilevare il server automaticamente.', 'success');
}

function rimuoviAccountPEC(index) {
    if (!confirm('Vuoi rimuovere questo account PEC?')) return;
    
    const accounts = JSON.parse(localStorage.getItem('haccp_pec_accounts')) || [];
    accounts.splice(index, 1);
    localStorage.setItem('haccp_pec_accounts', JSON.stringify(accounts));
    
    renderizzaListaAccountPEC();
    mostraNotifica('🗑️ Account rimosso', 'success');
}

async function testConnessionePEC(index) {
    const accounts = JSON.parse(localStorage.getItem('haccp_pec_accounts')) || [];
    const account = accounts[index];
    
    aggiungiLogPEC(`🔌 Test connessione a ${account.email}...`);
    mostraNotifica('🔄 Test in corso...', 'info');
    
    try {
        const response = await fetch('/pec-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(account)
        });
        
        const result = await response.json();
        
        if (result.success) {
            aggiungiLogPEC(`✅ ${account.email}: Connessione riuscita!`);
            
            // Se è stato trovato un server, salvalo nell'account
            if (result.serverTrovato) {
                aggiungiLogPEC(`📡 Server rilevato: ${result.serverTrovato}`);
                accounts[index].host = result.serverTrovato;
                localStorage.setItem('haccp_pec_accounts', JSON.stringify(accounts));
                renderizzaListaAccountPEC();
                mostraNotifica(`✅ Connessione OK! Server: ${result.serverTrovato}`, 'success');
            } else {
                mostraNotifica('✅ Connessione OK!', 'success');
            }
        } else {
            aggiungiLogPEC(`❌ ${account.email}: ${result.error}`);
            mostraNotifica('❌ ' + result.error, 'error');
        }
    } catch (error) {
        aggiungiLogPEC(`❌ Errore: ${error.message}`);
        mostraNotifica('❌ Errore connessione server', 'error');
    }
}

async function avviaScansionePEC() {
    const accounts = JSON.parse(localStorage.getItem('haccp_pec_accounts')) || [];
    
    if (accounts.length === 0) {
        alert('⚠️ Configura almeno un account PEC prima di avviare la scansione!');
        return;
    }
    
    // Valida tutti gli account e controlla che abbiano il server rilevato
    const accountsSenzaHost = accounts.filter(acc => !acc.host);
    if (accountsSenzaHost.length > 0) {
        const emails = accountsSenzaHost.map(a => a.email).join(', ');
        alert(`⚠️ Prima di scansionare, testa questi account per rilevare il server:\n\n${emails}\n\nClicca il pulsante TEST per ogni account.`);
        return;
    }
    
    // Valida tutti gli account
    const accountsValidi = accounts.filter(acc => {
        if (!acc.email || !acc.password || !acc.cartella) {
            aggiungiLogPEC(`⚠️ Account ${acc.email || 'sconosciuto'} incompleto - saltato`);
            return false;
        }
        return true;
    });
    
    if (accountsValidi.length === 0) {
        alert('⚠️ Nessun account PEC configurato correttamente!');
        return;
    }
    
    aggiungiLogPEC('🚀 Avvio scansione PEC...');
    aggiungiLogPEC(`📧 Account da scansionare: ${accountsValidi.length}`);
    
    try {
        const response = await fetch('/pec-scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accounts: accountsValidi })
        });
        
        const result = await response.json();
        
        if (result.success) {
            let totaleProcessate = 0;
            let emailImportantiTotali = [];
            
            result.risultati.forEach(r => {
                aggiungiLogPEC(`📧 ${r.email}: ${r.message}`);
                if (r.errori && r.errori.length > 0) {
                    r.errori.forEach(e => aggiungiLogPEC(`  ⚠️ ${e}`));
                }
                totaleProcessate += r.processate || 0;
                
                // Raccogli email importanti
                if (r.emailImportanti && r.emailImportanti.length > 0) {
                    emailImportantiTotali.push(...r.emailImportanti);
                }
            });
            
            // Mostra alert per email importanti
            if (emailImportantiTotali.length > 0) {
                aggiungiLogPEC('');
                aggiungiLogPEC('🚨🚨🚨 EMAIL IMPORTANTI RILEVATE 🚨🚨🚨');
                emailImportantiTotali.forEach(em => {
                    const priorita = em.priorita === 'CRITICA' ? '🔴' : em.priorita === 'ALTA' ? '🟠' : '🟡';
                    aggiungiLogPEC(`${priorita} ${em.fonte}: ${em.oggetto.substring(0, 60)}`);
                    aggiungiLogPEC(`   Da: ${em.mittente}`);
                    aggiungiLogPEC(`   Data: ${new Date(em.data).toLocaleString('it-IT')}`);
                    if (em.hasAllegati) {
                        aggiungiLogPEC(`   📎 Con allegati - salvati in _URGENTI/${em.fonte}`);
                    }
                });
                aggiungiLogPEC('🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨');
                
                // Notifica sonora e visiva
                mostraNotifica(`🚨 ${emailImportantiTotali.length} EMAIL IMPORTANTI RILEVATE!`, 'warning');
                
                // Mostra popup riassuntivo
                mostraPopupEmailImportanti(emailImportantiTotali);
            }
            
            aggiungiLogPEC(`✅ COMPLETATO - ${totaleProcessate} fatture salvate`);
            mostraNotifica(`✅ ${totaleProcessate} fatture importate!`, 'success');
        } else {
            aggiungiLogPEC(`❌ Errore: ${result.error}`);
            mostraNotifica('❌ ' + result.error, 'error');
        }
    } catch (error) {
        aggiungiLogPEC(`❌ Errore connessione: ${error.message}`);
        mostraNotifica('❌ Errore server', 'error');
    }
}

function aggiungiLogPEC(messaggio) {
    const log = document.getElementById('log-pec');
    if (!log) return;
    
    const timestamp = new Date().toLocaleTimeString('it-IT');
    log.innerHTML += `[${timestamp}] ${messaggio}\n`;
    log.scrollTop = log.scrollHeight;
}

function mostraPopupEmailImportanti(emailImportanti) {
    // Crea popup modale elegante e discreto
    const popup = document.createElement('div');
    popup.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
        padding: 20px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,100,100,0.3);
        z-index: 10000;
        max-width: 420px;
        max-height: 80vh;
        overflow-y: auto;
        color: white;
        animation: slideInRight 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        backdrop-filter: blur(10px);
    `;
    
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
        @keyframes slideInRight {
            from {
                opacity: 0;
                transform: translateX(100px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
        .email-card {
            transition: all 0.2s;
        }
        .email-card:hover {
            transform: translateX(-3px);
            box-shadow: 0 4px 12px rgba(255,100,100,0.2);
        }
    `;
    document.head.appendChild(styleSheet);
    
    let htmlContent = `
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px;">
            <div>
                <div style="font-size: 16px; font-weight: bold; color: #ff6b6b; margin-bottom: 3px;">📧 Email Importanti</div>
                <div style="font-size: 12px; color: #888;">${emailImportanti.length} ${emailImportanti.length === 1 ? 'messaggio' : 'messaggi'} rilevati</div>
            </div>
            <button onclick="this.parentElement.parentElement.parentElement.remove(); document.getElementById('overlay-email-popup').remove();" style="
                background: transparent;
                color: #888;
                border: none;
                font-size: 24px;
                cursor: pointer;
                padding: 0;
                width: 30px;
                height: 30px;
                line-height: 24px;
                transition: all 0.2s;
            " onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#888'">×</button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 15px;">
    `;
    
    emailImportanti.forEach(em => {
        const icona = em.priorita === 'CRITICA' ? '🔴' : em.priorita === 'ALTA' ? '🟠' : '🟡';
        const coloreBordo = em.priorita === 'CRITICA' ? '#ff4444' : em.priorita === 'ALTA' ? '#ff9800' : '#ffc107';
        htmlContent += `
            <div class="email-card" style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; border-left: 3px solid ${coloreBordo};">
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 5px;">
                    <span style="font-size: 10px;">${icona}</span>
                    <span style="font-weight: bold; font-size: 12px; color: ${coloreBordo};">${em.fonte}</span>
                </div>
                <div style="font-size: 12px; color: #ddd; line-height: 1.4; margin-bottom: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${em.oggetto}</div>
                <div style="font-size: 10px; color: #666; display: flex; align-items: center; gap: 8px;">
                    <span>📅 ${new Date(em.data).toLocaleDateString('it-IT')}</span>
                    ${em.hasAllegati ? '<span>📎 Allegati</span>' : ''}
                </div>
            </div>
        `;
    });
    
    htmlContent += `
        </div>
        <div style="text-align: center;">
            <button onclick="this.parentElement.parentElement.remove(); document.getElementById('overlay-email-popup').remove();" style="
                background: linear-gradient(135deg, #ff6b6b, #ff5252);
                color: white;
                border: none;
                padding: 10px 24px;
                border-radius: 6px;
                font-weight: 600;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.2s;
                width: 100%;
            " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(255,82,82,0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                ✓ HO VISTO
            </button>
        </div>
    `;
    
    popup.innerHTML = htmlContent;
    document.body.appendChild(popup);
    
    // Overlay semi-trasparente (meno invasivo)
    const overlay = document.createElement('div');
    overlay.id = 'overlay-email-popup';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.3);
        z-index: 9999;
        backdrop-filter: blur(2px);
    `;
    overlay.onclick = () => {
        overlay.remove();
        popup.remove();
    };
    document.body.appendChild(overlay);
    
    // Auto-chiusura dopo 15 secondi
    setTimeout(() => {
        if (popup.parentElement) {
            popup.style.animation = 'slideInRight 0.3s reverse';
            setTimeout(() => {
                if (popup.parentElement) popup.remove();
                if (overlay.parentElement) overlay.remove();
            }, 300);
        }
    }, 15000);
}

function verificaScansionePECAutomatica() {
    const autoScanAttivo = localStorage.getItem('haccp_pec_autoscan') === 'true';
    const intervallo = parseInt(localStorage.getItem('haccp_pec_intervallo')) || 30;
    
    intervalloScansionePEC = intervallo;
    
    if (autoScanAttivo) {
        avviaScansionePECAutomatica();
    }
    
    aggiornaStatoAutoScan();
}

function toggleScansionePECAutomatica() {
    const attivo = localStorage.getItem('haccp_pec_autoscan') === 'true';
    
    if (attivo) {
        // Disattiva
        localStorage.setItem('haccp_pec_autoscan', 'false');
        fermaScansionePECAutomatica();
        mostraNotifica('⏸️ Scansione automatica disattivata', 'info');
    } else {
        // Attiva
        const accounts = JSON.parse(localStorage.getItem('haccp_pec_accounts')) || [];
        if (accounts.length === 0) {
            alert('⚠️ Configura prima un account PEC!');
            return;
        }
        
        localStorage.setItem('haccp_pec_autoscan', 'true');
        avviaScansionePECAutomatica();
        mostraNotifica('▶️ Scansione automatica attivata ogni ' + intervalloScansionePEC + ' minuti', 'success');
    }
    
    aggiornaStatoAutoScan();
}

function avviaScansionePECAutomatica() {
    fermaScansionePECAutomatica(); // Pulisce timer precedente
    
    aggiungiLogPEC('🤖 Scansione automatica attivata (ogni ' + intervalloScansionePEC + ' minuti)');
    
    // Prima scansione immediata
    avviaScansionePEC();
    
    // Timer per scansioni successive
    timerScansionePECAutomatica = setInterval(() => {
        aggiungiLogPEC('🔄 Scansione automatica programmata...');
        avviaScansionePEC();
    }, intervalloScansionePEC * 60 * 1000);
}

function fermaScansionePECAutomatica() {
    if (timerScansionePECAutomatica) {
        clearInterval(timerScansionePECAutomatica);
        timerScansionePECAutomatica = null;
        aggiungiLogPEC('⏸️ Scansione automatica fermata');
    }
}

function cambiaIntervalloScansione() {
    const nuovoIntervallo = prompt('⏱️ Inserisci intervallo in minuti (minimo 5, consigliato 30):', intervalloScansionePEC);
    
    if (nuovoIntervallo === null) return;
    
    const intervallo = parseInt(nuovoIntervallo);
    
    if (isNaN(intervallo) || intervallo < 5) {
        alert('⚠️ Inserisci un numero valido (minimo 5 minuti)');
        return;
    }
    
    intervalloScansionePEC = intervallo;
    localStorage.setItem('haccp_pec_intervallo', intervallo);
    
    // Riavvia se attivo
    const attivo = localStorage.getItem('haccp_pec_autoscan') === 'true';
    if (attivo) {
        avviaScansionePECAutomatica();
    }
    
    aggiornaStatoAutoScan();
    mostraNotifica('⏱️ Intervallo aggiornato: ' + intervallo + ' minuti', 'success');
}

async function riorganizzaFattureEsistenti() {
    const conferma = confirm('🔄 Riorganizzare tutte le fatture salvate?\n\nLe fatture verranno rinominate con:\n• Data emissione\n• Nome azienda estratto dal PDF\n• Numero fattura\n\nE organizzate in cartelle per fornitore.\n\nVuoi continuare?');
    
    if (!conferma) return;
    
    const accounts = JSON.parse(localStorage.getItem('haccp_pec_accounts')) || [];
    if (accounts.length === 0) {
        mostraNotifica('⚠️ Nessun account PEC configurato', 'error');
        return;
    }
    
    // Usa il primo account (o chiedi quale usare se ce ne sono multipli)
    const accountObj = accounts[0];
    if (!accountObj.cartella) {
        mostraNotifica('⚠️ Cartella fatture non configurata', 'error');
        return;
    }
    
    mostraNotifica('🔄 Avvio riorganizzazione...', 'info');
    
    try {
        const response = await fetch('/riorganizza-fatture', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cartella: accountObj.cartella })
        });
        
        const result = await response.json();
        
        if (result.success) {
            let messaggio = `✅ Riorganizzazione completata!\n\n`;
            messaggio += `📊 File processati: ${result.processate}\n`;
            messaggio += `✅ File rinominati: ${result.rinominate}\n`;
            
            if (result.errori && result.errori.length > 0) {
                messaggio += `\n⚠️ Errori (${result.errori.length}):\n`;
                messaggio += result.errori.slice(0, 5).join('\n');
                if (result.errori.length > 5) {
                    messaggio += `\n... e altri ${result.errori.length - 5}`;
                }
            }
            
            alert(messaggio);
            mostraNotifica('✅ Fatture riorganizzate con successo!', 'success');
        } else {
            throw new Error(result.error || 'Errore sconosciuto');
        }
    } catch (error) {
        console.error('Errore riorganizzazione:', error);
        mostraNotifica('❌ Errore: ' + error.message, 'error');
        alert('❌ Errore durante la riorganizzazione:\n\n' + error.message);
    }
}

// ========== GESTIONE CORREZIONE FORNITORI ==========
async function mostraGestioneFornitori() {
    const accounts = JSON.parse(localStorage.getItem('haccp_pec_accounts')) || [];
    if (accounts.length === 0) {
        mostraNotifica('⚠️ Nessun account PEC configurato', 'error');
        return;
    }
    
    const accountObj = accounts[0];
    if (!accountObj.cartella) {
        mostraNotifica('⚠️ Cartella fatture non configurata', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/lista-cartelle?cartella=${encodeURIComponent(accountObj.cartella)}`);
        const cartelle = await response.json();
        
        if (cartelle.errore) {
            mostraNotifica('❌ ' + cartelle.errore, 'error');
            return;
        }
        
        // Crea finestra popup
        const popup = document.createElement('div');
        popup.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 5px 30px rgba(0,0,0,0.3);
            max-width: 600px;
            max-height: 70vh;
            overflow-y: auto;
            z-index: 10000;
        `;
        
        let html = `
            <h3 style="margin-top: 0; color: #2c3e50;">
                📁 Gestione Fornitori
                <button onclick="this.closest('div').remove()" style="float: right; border: none; background: #e74c3c; color: white; padding: 5px 15px; border-radius: 5px; cursor: pointer;">✕</button>
            </h3>
            <p style="color: #7f8c8d; margin-bottom: 20px;">Clicca su un fornitore per rinominarlo</p>
        `;
        
        if (cartelle.length === 0) {
            html += `<p style="text-align: center; color: #95a5a6;">Nessun fornitore trovato</p>`;
        } else {
            html += `<div style="display: grid; gap: 10px;">`;
            cartelle.forEach((cartella, idx) => {
                const nomeStrano = cartella.nome.match(/^[A-Z]{5,}$|ZPWW|[A-Za-z0-9]{5}_[A-Z]{4,}/);
                const classe = nomeStrano ? 'background: #fff3cd; border-left: 4px solid #ffc107;' : '';
                
                html += `
                    <div style="padding: 15px; border: 1px solid #ddd; border-radius: 8px; cursor: pointer; transition: all 0.2s; ${classe}"
                         onclick="rinominaFornitore('${cartella.nome.replace(/'/g, "\\'")}', '${accountObj.cartella.replace(/\\/g, "\\\\")}')">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-weight: bold; color: #2c3e50; font-size: 16px;">${cartella.nome}</div>
                                <div style="color: #7f8c8d; font-size: 13px; margin-top: 5px;">📄 ${cartella.numFile} file</div>
                            </div>
                            ${nomeStrano ? '<div style="color: #ff9800; font-weight: bold;">⚠️</div>' : '<div style="color: #27ae60;">✓</div>'}
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        }
        
        popup.innerHTML = html;
        document.body.appendChild(popup);
        
        // Overlay sfondo
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 9999;
        `;
        overlay.onclick = () => {
            overlay.remove();
            popup.remove();
        };
        document.body.appendChild(overlay);
        
    } catch (error) {
        console.error('Errore caricamento fornitori:', error);
        mostraNotifica('❌ Errore: ' + error.message, 'error');
    }
}

async function rinominaFornitore(vecchioNome, cartellaBase) {
    const nuovoNome = prompt(`📝 Rinomina Fornitore\n\nNome attuale: ${vecchioNome}\n\nInserisci il nuovo nome:`, vecchioNome);
    
    if (!nuovoNome || nuovoNome === vecchioNome) {
        return;
    }
    
    // Sanitizza nome
    const nomePulito = nuovoNome.trim()
        .replace(/\s+/g, '_')
        .replace(/[<>:"/\\|?*\.]/g, '')
        .substring(0, 60);
    
    if (!nomePulito) {
        mostraNotifica('❌ Nome non valido', 'error');
        return;
    }
    
    try {
        // 1. Salva nel database per riconoscimento futuro
        const dbResponse = await fetch('/salva-correzione-fornitore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nomeOriginale: vecchioNome.replace(/[^a-zA-Z0-9_]/g, '_'),
                nomeCorretto: nomePulito
            })
        });
        
        const dbResult = await dbResponse.json();
        
        mostraNotifica(`✅ Mappatura salvata!\nProssime fatture "${vecchioNome}" saranno salvate come "${nomePulito}"`, 'success');
        
        // Ricarica lista
        document.querySelectorAll('div[style*="z-index: 10000"]').forEach(el => el.remove());
        document.querySelectorAll('div[style*="z-index: 9999"]').forEach(el => el.remove());
        
        setTimeout(() => mostraGestioneFornitori(), 300);
    } catch (error) {
        console.error('Errore rinomina:', error);
        mostraNotifica('❌ Errore: ' + error.message, 'error');
    }
}

function aggiornaStatoAutoScan() {
    const attivo = localStorage.getItem('haccp_pec_autoscan') === 'true';
    const btnToggle = document.getElementById('btn-toggle-autoscan');
    const statoText = document.getElementById('stato-autoscan');
    
    if (btnToggle) {
        if (attivo) {
            btnToggle.textContent = '⏸️ DISATTIVA AUTO-SCAN';
            btnToggle.style.background = '#f44336';
        } else {
            btnToggle.textContent = '▶️ ATTIVA AUTO-SCAN';
            btnToggle.style.background = '#4CAF50';
        }
    }
    
    if (statoText) {
        if (attivo) {
            statoText.innerHTML = `🟢 <strong>ATTIVO</strong> - Scansione ogni ${intervalloScansionePEC} minuti`;
            statoText.style.color = '#4CAF50';
        } else {
            statoText.innerHTML = '🔴 <strong>DISATTIVO</strong> - Scansione manuale';
            statoText.style.color = '#888';
        }
    }
}

async function caricaListaFatture() {
    const accounts = JSON.parse(localStorage.getItem('haccp_pec_accounts')) || [];
    
    if (accounts.length === 0) {
        document.getElementById('lista-fatture-importate').innerHTML = 
            '<p style="color:#888; text-align:center; padding:20px;">Configura prima un account PEC</p>';
        return;
    }
    
    try {
        const response = await fetch('/lista-fatture', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cartelle: accounts.map(a => a.cartella) })
        });
        
        const result = await response.json();
        
        if (result.success && result.fatture) {
            renderizzaListaFatture(result.fatture);
        } else {
            document.getElementById('lista-fatture-importate').innerHTML = 
                '<p style="color:#888; text-align:center; padding:20px;">Nessuna fattura trovata</p>';
        }
    } catch (error) {
        document.getElementById('lista-fatture-importate').innerHTML = 
            '<p style="color:#f44336; text-align:center; padding:20px;">Errore caricamento: ' + error.message + '</p>';
    }
}

function renderizzaListaFatture(fatture) {
    const container = document.getElementById('lista-fatture-importate');
    
    if (fatture.length === 0) {
        container.innerHTML = '<p style="color:#888; text-align:center; padding:20px;">Nessuna fattura importata</p>';
        return;
    }
    
    // Ordina: prima i PDF, poi per data
    fatture.sort((a, b) => {
        const aPDF = a.nome.toLowerCase().endsWith('.pdf') ? 1 : 0;
        const bPDF = b.nome.toLowerCase().endsWith('.pdf') ? 1 : 0;
        if (aPDF !== bPDF) return bPDF - aPDF; // PDF prima
        return b.dataModifica - a.dataModifica; // poi per data
    });
    
    // Raggruppa per fornitore
    const perFornitore = {};
    fatture.forEach(f => {
        if (!perFornitore[f.fornitore]) {
            perFornitore[f.fornitore] = [];
        }
        perFornitore[f.fornitore].push(f);
    });
    
    let html = `<div style="margin-bottom:10px; color:#888; font-size:12px;">
        📊 ${fatture.length} fatture da ${Object.keys(perFornitore).length} fornitori
    </div>`;
    
    // Mostra per fornitore
    Object.keys(perFornitore).sort().forEach(fornitore => {
        const fattureFornitore = perFornitore[fornitore];
        const coloreFornitore = fornitore === 'SCONOSCIUTO' ? '#888' : '#4CAF50';
        
        html += `
            <div style="margin-bottom:15px;">
                <div style="background:#1a1a1a; padding:6px 10px; border-radius:4px; margin-bottom:5px; font-weight:bold; color:${coloreFornitore}; font-size:13px; cursor:pointer;" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                    📁 ${fornitore} (${fattureFornitore.length})
                </div>
                <div>
        `;
        
        fattureFornitore.forEach(f => {
            const dataModifica = new Date(f.dataModifica).toLocaleDateString('it-IT');
            const dimensione = (f.dimensione / 1024).toFixed(1) + ' KB';
            
            // Icona e colore in base al tipo
            let icona = '📄';
            let colore = '#4CAF50';
            if (f.nome.toLowerCase().endsWith('.xml')) {
                icona = '📝';
                colore = '#FF9800';
            } else if (f.nome.toLowerCase().endsWith('.p7m')) {
                icona = '📎';
                colore = '#2196F3';
            }
            
            html += `
                <div style="background:#2a2a2a; padding:8px 10px; border-radius:6px; margin-bottom:6px; border-left:3px solid ${colore};">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
                        <div style="flex:1; min-width:0;">
                            <div style="font-weight:bold; color:${colore}; margin-bottom:2px; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                ${icona} ${f.nome}
                            </div>
                            <div style="font-size:11px; color:#888;">
                                ${dataModifica} • ${dimensione}
                            </div>
                        </div>
                        <button onclick="apriCartella('${f.percorso.replace(/\\/g, '\\\\')}')" 
                                style="padding:5px 10px; background:#2196F3; border:none; border-radius:4px; cursor:pointer; font-size:11px; white-space:nowrap; flex-shrink:0;">
                            📂 APRI
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += `</div></div>`;
    });
    
    container.innerHTML = html;
}

function apriCartella(percorso) {
    fetch('/apri-cartella', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ percorso })
    }).catch(err => {
        mostraNotifica('❌ Errore apertura cartella', 'error');
    });
}


/* ===========================================================
   SCADENZARIO PRODOTTI
   =========================================================== */

function verificaScadenze() {
    const oggi = new Date();
    // Escludi lotti terminati
    const lottiAttivi = databaseLotti.filter(l => !l.terminato);

    // Nuova logica: giorni dalla scadenza (passato = positivo)
    const ok = lottiAttivi.filter(lotto => {
        if (!lotto.scadenza) return false;
        const scadenza = parseDataItaliana(lotto.scadenza);
        const giorniDallaScadenza = Math.floor((oggi - scadenza) / (1000 * 60 * 60 * 24));
        return giorniDallaScadenza <= 0;
    });
    const attenzione = lottiAttivi.filter(lotto => {
        if (!lotto.scadenza) return false;
        const scadenza = parseDataItaliana(lotto.scadenza);
        const giorniDallaScadenza = Math.floor((oggi - scadenza) / (1000 * 60 * 60 * 24));
        return giorniDallaScadenza > 0 && giorniDallaScadenza <= 5;
    });
    const critici = lottiAttivi.filter(lotto => {
        if (!lotto.scadenza) return false;
        const scadenza = parseDataItaliana(lotto.scadenza);
        const giorniDallaScadenza = Math.floor((oggi - scadenza) / (1000 * 60 * 60 * 24));
        return giorniDallaScadenza > 5;
    });

    if (critici.length > 0) {
        mostraNotifica(`🔴 ${critici.length} prodotti SCADUTI da oltre 5 giorni!`, 'error');
    } else if (attenzione.length > 0) {
        mostraNotifica(`🟡 ${attenzione.length} prodotti scaduti da 0 a 5 giorni`, 'warning');
    }

    return {
        ok: ok.length,
        attenzione: attenzione.length,
        critici: critici.length
    };
}

function parseDataItaliana(dataStr) {
    if (!dataStr) return new Date();
    const parti = dataStr.split('/');
    if (parti.length !== 3) return new Date();
    const data = new Date(parti[2], parti[1] - 1, parti[0]);
    return isNaN(data.getTime()) ? new Date() : data;
}

function renderizzaScadenzario() {
    const container = document.getElementById('lista-scadenze');
    const alert = document.getElementById('alert-scadenze');
    const oggi = new Date();

    // Escludi lotti terminati
    const lottiAttivi = databaseLotti.filter(l => !l.terminato);

    // Nuova logica: giorni dalla scadenza
    const prodottiConScadenza = lottiAttivi.map(lotto => {
        if (!lotto.scadenza) return null;
        const scadenza = parseDataItaliana(lotto.scadenza);
        const giorniDallaScadenza = Math.floor((oggi - scadenza) / (1000 * 60 * 60 * 24));
        return { ...lotto, scadenza: scadenza, giorniDallaScadenza };
    }).filter(p => p !== null).sort((a, b) => a.giorniDallaScadenza - b.giorniDallaScadenza);

    const ok = prodottiConScadenza.filter(p => p.giorniDallaScadenza <= 0);
    const attenzione = prodottiConScadenza.filter(p => p.giorniDallaScadenza > 0 && p.giorniDallaScadenza <= 5);
    const critico = prodottiConScadenza.filter(p => p.giorniDallaScadenza > 5);

    let alertHTML = '';
    if (critico.length > 0) {
        alertHTML += `<div style="background:#f44336; padding:15px; border-radius:8px; margin-bottom:15px;"><strong>🔴 ${critico.length} prodotti SCADUTI da oltre 5 giorni</strong></div>`;
    }
    if (attenzione.length > 0) {
        alertHTML += `<div style="background:#FFD60A; color:#222; padding:15px; border-radius:8px; margin-bottom:15px;"><strong>🟡 ${attenzione.length} prodotti scaduti da 0 a 5 giorni</strong></div>`;
    }
    if (ok.length > 0) {
        alertHTML += `<div style="background:#4CAF50; color:#fff; padding:15px; border-radius:8px; margin-bottom:15px;"><strong>🟢 ${ok.length} prodotti validi (non scaduti)</strong></div>`;
    }

    const lottiTerminati = databaseLotti.filter(l => l.terminato).length;
    if (lottiTerminati > 0) {
        alertHTML += `<div style="background:#1a1a1a; padding:10px; border-radius:8px; margin-bottom:15px; font-size:13px; opacity:0.7;"><strong>ℹ️ ${lottiTerminati} lotti marcati come terminati (esclusi da questa lista)</strong></div>`;
    }

    alert.innerHTML = alertHTML;

    let html = '<table style="width:100%; border-collapse:collapse;">';
    html += '<tr style="background:#333;"><th style="padding:12px;">Prodotto</th><th>Lotto</th><th>Scadenza</th><th>Stato</th><th>Messaggio</th></tr>';

    prodottiConScadenza.forEach(p => {
        let colore = '#4CAF50';
        let stato = '🟢 OK';
        let messaggio = '';
        if (p.giorniDallaScadenza < 0) {
            // Futuro
            if (p.giorniDallaScadenza === -1) {
                messaggio = 'Scade domani';
            } else {
                messaggio = `Scade tra ${-p.giorniDallaScadenza} giorni`;
            }
        } else if (p.giorniDallaScadenza === 0) {
            messaggio = 'Scade oggi';
        } else if (p.giorniDallaScadenza > 0 && p.giorniDallaScadenza <= 5) {
            colore = '#FFD60A';
            stato = '🟡 ATTENZIONE';
            messaggio = `Scaduto da ${p.giorniDallaScadenza} giorni`;
        } else if (p.giorniDallaScadenza > 5) {
            colore = '#f44336';
            stato = '🔴 CRITICO';
            messaggio = `Scaduto da ${p.giorniDallaScadenza} giorni`;
        }

        html += `<tr style="border-bottom:1px solid #555;">
            <td style="padding:12px;">${p.prodotto}</td>
            <td>${p.lottoInterno}</td>
            <td>${p.scadenza.toLocaleDateString('it-IT')}</td>
            <td style="color:${colore}; font-weight:bold;">${stato}</td>
            <td style="color:${colore};">${messaggio}</td>
        </tr>`;
    });
    html += '</table>';
    container.innerHTML = html;
}


/* ===========================================================
   MANUTENZIONI ATTREZZATURE
   =========================================================== */

function aggiungiAttrezzatura() {
    const nome = prompt('🔧 Nome attrezzatura (es: Frigorifero 1, Bilancia):');
    if (!nome) return;
    
    const frequenza = prompt('📅 Frequenza manutenzione in giorni (es: 30, 90, 365):', '90');
    if (!frequenza) return;
    
    const attrezzature = JSON.parse(localStorage.getItem('haccp_attrezzature')) || [];
    attrezzature.push({
        nome,
        frequenzaGiorni: parseInt(frequenza),
        ultimaManutenzione: new Date().toISOString(),
        prossimaManutenzione: new Date(Date.now() + parseInt(frequenza) * 24 * 60 * 60 * 1000).toISOString(),
        storico: []
    });
    
    localStorage.setItem('haccp_attrezzature', JSON.stringify(attrezzature));
    renderizzaManutenzioni();
    mostraNotifica('✅ Attrezzatura aggiunta!', 'success');
}

function registraManutenzione(index) {
    const attrezzature = JSON.parse(localStorage.getItem('haccp_attrezzature')) || [];
    const note = prompt('📝 Note manutenzione (opzionale):', '');
    
    const oggi = new Date();
    attrezzature[index].storico.push({
        data: oggi.toISOString(),
        operatore: sessionStorage.getItem('nomeUtenteLoggato') || 'Admin',
        note
    });
    attrezzature[index].ultimaManutenzione = oggi.toISOString();
    attrezzature[index].prossimaManutenzione = new Date(oggi.getTime() + attrezzature[index].frequenzaGiorni * 24 * 60 * 60 * 1000).toISOString();
    
    localStorage.setItem('haccp_attrezzature', JSON.stringify(attrezzature));
    renderizzaManutenzioni();
    mostraNotifica('✅ Manutenzione registrata!', 'success');
}

function renderizzaManutenzioni() {
    const attrezzature = JSON.parse(localStorage.getItem('haccp_attrezzature')) || [];
    const container = document.getElementById('lista-attrezzature');
    const oggi = new Date();
    
    let html = '';
    attrezzature.forEach((attr, i) => {
        const prossima = new Date(attr.prossimaManutenzione);
        const giorniRimanenti = Math.floor((prossima - oggi) / (1000 * 60 * 60 * 24));
        const colore = giorniRimanenti < 7 ? '#f44336' : giorniRimanenti < 30 ? '#FF9800' : '#4CAF50';
        
        html += `<div style="background:#2a2a2a; padding:20px; border-radius:8px; margin-bottom:15px; border-left:4px solid ${colore};">
            <div style="display:flex; justify-content:space-between; align-items:start;">
                <div>
                    <h3 style="color:${colore}; margin:0 0 10px 0;">🔧 ${attr.nome}</h3>
                    <p style="margin:5px 0; color:#aaa;">Ultima: ${new Date(attr.ultimaManutenzione).toLocaleDateString('it-IT')}</p>
                    <p style="margin:5px 0; color:${colore}; font-weight:bold;">Prossima: ${prossima.toLocaleDateString('it-IT')} (${giorniRimanenti} giorni)</p>
                    <p style="margin:5px 0; color:#888; font-size:12px;">Frequenza: ogni ${attr.frequenzaGiorni} giorni</p>
                </div>
                <button onclick="registraManutenzione(${i})" style="padding:10px 20px; background:#4CAF50; border:none; border-radius:5px; cursor:pointer;">✅ REGISTRA</button>
            </div>
        </div>`;
    });
    
    container.innerHTML = html || '<p style="color:#888; text-align:center; padding:40px;">Nessuna attrezzatura registrata</p>';
}


/* ===========================================================
   FORNITORI QUALIFICATI
   =========================================================== */

function aggiungiFornitore() {
    const nome = prompt('🏢 Ragione Sociale:');
    if (!nome) return;
    
    const categoria = prompt('📦 Categoria (es: Carni, Latticini, Ortofrutta):', '');
    const piva = prompt('🔢 P.IVA:', '');
    const telefono = prompt('📞 Telefono:', '');
    const email = prompt('📧 Email:', '');
    
    const fornitori = JSON.parse(localStorage.getItem('haccp_fornitori')) || [];
    fornitori.push({
        nome,
        categoria: categoria || 'Generale',
        piva: piva || '',
        telefono: telefono || '',
        email: email || '',
        dataQualifica: new Date().toISOString(),
        attivo: true,
        note: ''
    });
    
    localStorage.setItem('haccp_fornitori', JSON.stringify(fornitori));
    renderizzaFornitori();
    mostraNotifica('✅ Fornitore aggiunto!', 'success');
}

function renderizzaFornitori() {
    const fornitori = JSON.parse(localStorage.getItem('haccp_fornitori')) || [];
    const container = document.getElementById('lista-fornitori');
    
    let html = '';
    fornitori.forEach((f, i) => {
        html += `<div style="background:#2a2a2a; padding:20px; border-radius:8px; margin-bottom:15px; border-left:4px solid #00BCD4;">
            <h3 style="color:#00BCD4; margin:0 0 10px 0;">🏢 ${f.nome}</h3>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:10px; font-size:14px; color:#aaa;">
                <div>📦 ${f.categoria}</div>
                <div>🔢 ${f.piva || 'N/A'}</div>
                <div>📞 ${f.telefono || 'N/A'}</div>
                <div>📧 ${f.email || 'N/A'}</div>
                <div>✅ Qualificato il ${new Date(f.dataQualifica).toLocaleDateString('it-IT')}</div>
            </div>
        </div>`;
    });
    
    container.innerHTML = html || '<p style="color:#888; text-align:center; padding:40px;">Nessun fornitore registrato</p>';
}


/* ===========================================================
   ALLERGENI
   =========================================================== */

function aggiungiProdottoAllergeni() {
    const prodotto = prompt('🍕 Nome prodotto:');
    if (!prodotto) return;
    
    const allergeni = [];
    const listaAllergeni = [
        'Glutine', 'Crostacei', 'Uova', 'Pesce', 'Arachidi', 'Soia', 
        'Latte', 'Frutta a guscio', 'Sedano', 'Senape', 'Sesamo', 
        'Solfiti', 'Lupini', 'Molluschi'
    ];
    
    let sel = '';
    do {
        sel = prompt(`Seleziona allergeni presenti (scrivi il numero):\n${listaAllergeni.map((a, i) => `${i + 1}. ${a}`).join('\n')}\n\n0 per terminare`, '0');
        const num = parseInt(sel);
        if (num > 0 && num <= listaAllergeni.length) {
            allergeni.push(listaAllergeni[num - 1]);
        }
    } while (sel !== '0' && sel !== null);
    
    const prodottiAllergeni = JSON.parse(localStorage.getItem('haccp_allergeni')) || [];
    prodottiAllergeni.push({
        prodotto,
        allergeni,
        data: new Date().toISOString()
    });
    
    localStorage.setItem('haccp_allergeni', JSON.stringify(prodottiAllergeni));
    renderizzaAllergeni();
    mostraNotifica('✅ Prodotto aggiunto!', 'success');
}

function renderizzaAllergeni() {
    const prodotti = JSON.parse(localStorage.getItem('haccp_allergeni')) || [];
    const container = document.getElementById('lista-allergeni');
    
    let html = '';
    prodotti.forEach((p, i) => {
        html += `<div style="background:#2a2a2a; padding:20px; border-radius:8px; margin-bottom:15px; border-left:4px solid #E91E63;">
            <h3 style="color:#E91E63; margin:0 0 10px 0;">🍕 ${p.prodotto}</h3>
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
                ${p.allergeni.map(a => `<span style="background:#E91E63; padding:5px 10px; border-radius:15px; font-size:12px;">⚠️ ${a}</span>`).join('')}
            </div>
            ${p.allergeni.length === 0 ? '<p style="color:#4CAF50;">✅ Nessun allergene</p>' : ''}
        </div>`;
    });
    
    container.innerHTML = html || '<p style="color:#888; text-align:center; padding:40px;">Nessun prodotto registrato</p>';
}


/* ===========================================================
   CCP - PUNTI CRITICI DI CONTROLLO
   =========================================================== */

function registraControlloCCP() {
    const tipo = prompt('Tipo controllo:\n1. Temperatura cottura\n2. Temperatura conservazione\n3. Igiene personale\n4. Pulizia attrezzature\n5. Controllo materie prime', '1');
    const tipi = ['', 'Temperatura cottura', 'Temperatura conservazione', 'Igiene personale', 'Pulizia attrezzature', 'Controllo materie prime'];
    
    const descrizione = prompt('📝 Descrizione controllo:', '');
    const esito = prompt('Esito:\n1. Conforme ✅\n2. Non conforme ❌', '1');
    const note = prompt('Note (opzionale):', '');
    
    const controlli = JSON.parse(localStorage.getItem('haccp_ccp')) || [];
    controlli.push({
        tipo: tipi[parseInt(tipo)] || 'Altro',
        descrizione,
        esito: esito === '1' ? 'Conforme' : 'Non conforme',
        data: new Date().toISOString(),
        operatore: sessionStorage.getItem('nomeUtenteLoggato') || 'Admin',
        note
    });
    
    localStorage.setItem('haccp_ccp', JSON.stringify(controlli));
    renderizzaCCP();
    mostraNotifica('✅ Controllo registrato!', 'success');
}

function renderizzaCCP() {
    const controlli = JSON.parse(localStorage.getItem('haccp_ccp')) || [];
    const container = document.getElementById('lista-ccp');
    
    let html = '<table style="width:100%; border-collapse:collapse;">';
    html += '<tr style="background:#333;"><th style="padding:12px;">Data</th><th>Tipo</th><th>Descrizione</th><th>Esito</th><th>Operatore</th></tr>';
    
    controlli.slice().reverse().forEach(c => {
        const colore = c.esito === 'Conforme' ? '#4CAF50' : '#f44336';
        const icona = c.esito === 'Conforme' ? '✅' : '❌';
        html += `<tr style="border-bottom:1px solid #555;">
            <td style="padding:12px;">${new Date(c.data).toLocaleDateString('it-IT')}</td>
            <td>${c.tipo}</td>
            <td>${c.descrizione}</td>
            <td style="color:${colore};">${icona} ${c.esito}</td>
            <td>${c.operatore}</td>
        </tr>`;
    });
    html += '</table>';
    
    container.innerHTML = html || '<p style="color:#888; text-align:center; padding:40px;">Nessun controllo registrato</p>';
}


/* ===========================================================
   FORMAZIONE PERSONALE
   =========================================================== */

function aggiungiAttestato() {
    const dipendente = prompt('👤 Nome dipendente:');
    if (!dipendente) return;
    
    const corso = prompt('📚 Tipo corso (es: HACCP Base, Aggiornamento, Antincendio):', 'HACCP');
    const dataRilascio = prompt('📅 Data rilascio (gg/mm/aaaa):', new Date().toLocaleDateString('it-IT'));
    const validitaAnni = prompt('⏳ Validità in anni:', '3');
    
    const formazione = JSON.parse(localStorage.getItem('haccp_formazione')) || [];
    const rilascio = parseDataItaliana(dataRilascio);
    const scadenza = new Date(rilascio);
    scadenza.setFullYear(scadenza.getFullYear() + parseInt(validitaAnni));
    
    formazione.push({
        dipendente,
        corso,
        dataRilascio: rilascio.toISOString(),
        dataScadenza: scadenza.toISOString(),
        validitaAnni: parseInt(validitaAnni)
    });
    
    localStorage.setItem('haccp_formazione', JSON.stringify(formazione));
    renderizzaFormazione();
    mostraNotifica('✅ Attestato aggiunto!', 'success');
}

function renderizzaFormazione() {
    const formazione = JSON.parse(localStorage.getItem('haccp_formazione')) || [];
    const container = document.getElementById('lista-formazione');
    const alert = document.getElementById('alert-scadenze-formazione');
    const oggi = new Date();
    
    const inScadenza = formazione.filter(f => {
        const scadenza = new Date(f.dataScadenza);
        const diffGiorni = Math.floor((scadenza - oggi) / (1000 * 60 * 60 * 24));
        return diffGiorni >= 0 && diffGiorni <= 90;
    });
    
    if (inScadenza.length > 0) {
        alert.innerHTML = `<div style="background:#FF9800; padding:15px; border-radius:8px;"><strong>⚠️ ${inScadenza.length} attestati in scadenza nei prossimi 90 giorni</strong></div>`;
    } else {
        alert.innerHTML = '';
    }
    
    let html = '';
    formazione.forEach((f, i) => {
        const scadenza = new Date(f.dataScadenza);
        const diffGiorni = Math.floor((scadenza - oggi) / (1000 * 60 * 60 * 24));
        const colore = diffGiorni < 0 ? '#666' : diffGiorni < 90 ? '#FF9800' : '#4CAF50';
        const stato = diffGiorni < 0 ? '❌ SCADUTO' : diffGiorni < 90 ? '⚠️ IN SCADENZA' : '✅ VALIDO';
        
        html += `<div style="background:#2a2a2a; padding:20px; border-radius:8px; margin-bottom:15px; border-left:4px solid ${colore};">
            <h3 style="color:${colore}; margin:0 0 10px 0;">👤 ${f.dipendente}</h3>
            <div style="font-size:14px; color:#aaa;">
                <p style="margin:5px 0;">📚 Corso: ${f.corso}</p>
                <p style="margin:5px 0;">📅 Rilasciato: ${new Date(f.dataRilascio).toLocaleDateString('it-IT')}</p>
                <p style="margin:5px 0; color:${colore}; font-weight:bold;">⏳ Scadenza: ${scadenza.toLocaleDateString('it-IT')} - ${stato}</p>
            </div>
        </div>`;
    });
    
    container.innerHTML = html || '<p style="color:#888; text-align:center; padding:40px;">Nessun attestato registrato</p>';
}


/* ===========================================================
   INVENTARIO MATERIE PRIME
   =========================================================== */

function aggiungiMateriaPrima() {
    const nome = prompt('📦 Nome materia prima:');
    if (!nome) return;
    
    const quantita = prompt('⚖️ Quantità (es: 10kg, 5L):', '');
    const lotto = prompt('🔢 Lotto fornitore:', '');
    const scadenza = prompt('📅 Scadenza (gg/mm/aaaa):', '');
    const fornitore = prompt('🏢 Fornitore:', '');
    
    const inventario = JSON.parse(localStorage.getItem('haccp_inventario')) || [];
    inventario.push({
        nome,
        quantita: quantita || '',
        lotto: lotto || '',
        scadenza: scadenza || '',
        fornitore: fornitore || '',
        dataCarico: new Date().toISOString(),
        operatore: sessionStorage.getItem('nomeUtenteLoggato') || 'Admin'
    });
    
    localStorage.setItem('haccp_inventario', JSON.stringify(inventario));
    renderizzaInventario();
    mostraNotifica('✅ Materia prima aggiunta!', 'success');
}

function renderizzaInventario() {
    const inventario = JSON.parse(localStorage.getItem('haccp_inventario')) || [];
    const container = document.getElementById('lista-inventario');
    
    let html = '<table style="width:100%; border-collapse:collapse;">';
    html += '<tr style="background:#333;"><th style="padding:12px;">Nome</th><th>Quantità</th><th>Lotto</th><th>Scadenza</th><th>Fornitore</th><th>Caricato</th></tr>';
    
    inventario.slice().reverse().forEach(item => {
        html += `<tr style="border-bottom:1px solid #555;">
            <td style="padding:12px;">${item.nome}</td>
            <td>${item.quantita}</td>
            <td>${item.lotto}</td>
            <td>${item.scadenza}</td>
            <td>${item.fornitore}</td>
            <td>${new Date(item.dataCarico).toLocaleDateString('it-IT')}</td>
        </tr>`;
    });
    html += '</table>';
    
    container.innerHTML = html || '<p style="color:#888; text-align:center; padding:40px;">Nessuna materia prima in inventario</p>';
}


/* ===========================================================
   DASHBOARD STATISTICHE
   =========================================================== */

function renderizzaDashboard() {
    const stats = document.getElementById('dashboard-stats');
    const grafici = document.getElementById('dashboard-grafici');
    
    if (!stats || !grafici) return;

    renderizzaOrdiniHome();
    
    // Statistiche
    const lottiTotali = databaseLotti.length;
    const temperatureTotali = databaseTemperature.length;
    const utentiTotali = databaseUtenti.length;
    const prodottiInScadenza = verificaScadenze ? verificaScadenze().length : 0;
    
    stats.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px;">
            <div style="background:#2a2a2a; padding:15px; border-radius:8px; text-align:center;">
                <div style="font-size:32px; color:#4CAF50; margin-bottom:5px;">${lottiTotali}</div>
                <div style="color:#aaa; font-size:0.85rem;">Lotti Prodotti</div>
            </div>
            <div style="background:#2a2a2a; padding:15px; border-radius:8px; text-align:center;">
                <div style="font-size:32px; color:#2196F3; margin-bottom:5px;">${temperatureTotali}</div>
                <div style="color:#aaa; font-size:0.85rem;">Rilevazioni Temp.</div>
            </div>
            <div style="background:#2a2a2a; padding:15px; border-radius:8px; text-align:center;">
                <div style="font-size:32px; color:#FF9800; margin-bottom:5px;">${utentiTotali}</div>
                <div style="color:#aaa; font-size:0.85rem;">Operatori</div>
            </div>
            <div style="background:#2a2a2a; padding:15px; border-radius:8px; text-align:center;">
                <div style="font-size:32px; color:#f44336; margin-bottom:5px;">${prodottiInScadenza}</div>
                <div style="color:#aaa; font-size:0.85rem;">In Scadenza</div>
            </div>
        </div>
    `;
    
    // Attività ultimi 7 giorni
    const ultimi7Giorni = [];
    for (let i = 6; i >= 0; i--) {
        const data = new Date();
        data.setDate(data.getDate() - i);
        const dataStr = data.toLocaleDateString('it-IT');
        const lottiGiorno = databaseLotti.filter(l => l.dataProduzione === dataStr).length;
        ultimi7Giorni.push({ data: dataStr, lotti: lottiGiorno });
    }
    
    grafici.innerHTML = `
        <div style="background:#2a2a2a; padding:15px; border-radius:8px;">
            <h3 style="margin:0 0 15px 0; font-size:1rem;">📊 Produzioni Ultimi 7 Giorni</h3>
            <div style="display:flex; align-items:flex-end; gap:8px; height:150px;">
                ${ultimi7Giorni.map(g => {
                    const altezza = g.lotti === 0 ? 5 : (g.lotti / Math.max(...ultimi7Giorni.map(x => x.lotti)) * 130);
                    return `<div style="flex:1; display:flex; flex-direction:column; align-items:center;">
                        <div style="background:#4CAF50; width:100%; height:${altezza}px; border-radius:5px 5px 0 0;"></div>
                        <div style="font-size:10px; margin-top:8px; color:#888;">${g.data.split('/')[0]}/${g.data.split('/')[1]}</div>
                        <div style="font-weight:bold; color:#4CAF50; font-size:12px;">${g.lotti}</div>
                    </div>`;
                }).join('')}
            </div>
        </div>
    `;
}

const ORDINI_STORAGE_KEY = 'haccp_ordini';
let ordineInModificaId = null;
let ordineDataSelezionata = null;
let ordineOraSelezionata = '';
let calendarioOrdiniMese = null;

function getOrdiniSalvati() {
    return JSON.parse(localStorage.getItem(ORDINI_STORAGE_KEY) || '[]');
}

function normalizzaDataOrdine(dataStr) {
    if (!dataStr) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) return dataStr;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataStr)) {
        const [gg, mm, aa] = dataStr.split('/');
        return `${aa}-${mm}-${gg}`;
    }
    return dataStr;
}

function parseDataOrdine(dataStr) {
    const iso = normalizzaDataOrdine(dataStr);
    if (!iso) return null;
    const date = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

function formatDataLabel(dataStr, ora) {
    const data = parseDataOrdine(dataStr);
    if (!data) return '';
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    const diffGiorni = Math.round((data - oggi) / (1000 * 60 * 60 * 24));
    const base = data.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
    const oraLabel = ora ? ` - ${ora}` : '';
    if (diffGiorni === 0) return `Oggi, ${base}${oraLabel}`;
    if (diffGiorni === 1) return `Domani, ${base}${oraLabel}`;
    if (diffGiorni === 2) return `Dopodomani, ${base}${oraLabel}`;
    return `${base}${oraLabel}`;
}

function mostraVistaOrdini(idVista) {
    const vistaLista = document.getElementById('ordini-view-lista');
    const vistaNota = document.getElementById('ordini-view-nota');
    if (!vistaLista || !vistaNota) return;
    vistaLista.classList.toggle('active', idVista === 'lista');
    vistaNota.classList.toggle('active', idVista === 'nota');
}

function aggiornaOrdineDataLabel() {
    const label = document.getElementById('ordine-data-label');
    if (!label) return;
    if (!ordineDataSelezionata) {
        label.textContent = '';
        label.style.display = 'none';
        return;
    }
    label.textContent = formatDataLabel(ordineDataSelezionata, ordineOraSelezionata);
    label.style.display = 'block';
}

function syncOraOrdineUI() {
    const toggle = document.getElementById('ordine-ora-toggle');
    const input = document.getElementById('ordine-ora');
    if (!toggle || !input) return;
    toggle.checked = Boolean(ordineOraSelezionata);
    input.disabled = !toggle.checked;
    input.value = ordineOraSelezionata || '';
}

function toggleCalendarioOrdini(show) {
    const modal = document.getElementById('ordini-modal');
    if (!modal) return;
    modal.style.display = show ? 'flex' : 'none';
    if (show) {
        inizializzaMeseCalendario();
        syncOraOrdineUI();
        renderCalendarioOrdini();
        const delBtn = document.getElementById('ordini-modal-delete');
        if (delBtn) delBtn.style.display = ordineInModificaId ? 'inline-flex' : 'none';
    }
}

function inizializzaMeseCalendario() {
    const riferimento = parseDataOrdine(ordineDataSelezionata) || new Date();
    calendarioOrdiniMese = {
        year: riferimento.getFullYear(),
        month: riferimento.getMonth()
    };
}

function cambiaMeseOrdini(delta) {
    if (!calendarioOrdiniMese) {
        inizializzaMeseCalendario();
    }
    const nextMonth = calendarioOrdiniMese.month + delta;
    const date = new Date(calendarioOrdiniMese.year, nextMonth, 1);
    calendarioOrdiniMese = { year: date.getFullYear(), month: date.getMonth() };
    renderCalendarioOrdini();
}

function renderCalendarioOrdini() {
    const grid = document.getElementById('ordini-calendar-grid');
    const title = document.getElementById('ordini-calendar-title');
    if (!grid || !title) return;

    if (!calendarioOrdiniMese) {
        inizializzaMeseCalendario();
    }

    const anno = calendarioOrdiniMese.year;
    const mese = calendarioOrdiniMese.month;
    const giorniNelMese = new Date(anno, mese + 1, 0).getDate();
    const nomeMese = new Date(anno, mese, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

    title.textContent = nomeMese;

    const selezionata = parseDataOrdine(ordineDataSelezionata);
    const giornoSelezionato = selezionata && selezionata.getMonth() === mese && selezionata.getFullYear() === anno
        ? selezionata.getDate()
        : null;

    let html = '';
    for (let d = 1; d <= giorniNelMese; d += 1) {
        const selectedClass = d === giornoSelezionato ? 'selected' : '';
        html += `<div class="ordini-calendar-day ${selectedClass}" onclick="selezionaDataOrdine(${d})">${d}</div>`;
    }
    grid.innerHTML = html;
}

function selezionaDataOrdine(giorno) {
    if (!calendarioOrdiniMese) {
        inizializzaMeseCalendario();
    }
    const anno = calendarioOrdiniMese.year;
    const mese = calendarioOrdiniMese.month + 1;
    const mm = String(mese).padStart(2, '0');
    const gg = String(giorno).padStart(2, '0');
    ordineDataSelezionata = `${anno}-${mm}-${gg}`;
    aggiornaOrdineDataLabel();
    renderCalendarioOrdini();
}

function toggleOraOrdine() {
    const toggle = document.getElementById('ordine-ora-toggle');
    const input = document.getElementById('ordine-ora');
    if (!toggle || !input) return;
    input.disabled = !toggle.checked;
    if (!toggle.checked) {
        ordineOraSelezionata = '';
        input.value = '';
        aggiornaOrdineDataLabel();
    }
}

function selezionaOraOrdine() {
    const input = document.getElementById('ordine-ora');
    if (!input) return;
    ordineOraSelezionata = String(input.value || '').trim();
    aggiornaOrdineDataLabel();
}

function apriNuovoOrdine() {
    ordineInModificaId = null;
    ordineDataSelezionata = null;
    ordineOraSelezionata = '';
    const titoloInput = document.getElementById('ordine-titolo');
    const testoInput = document.getElementById('ordine-contesto');
    if (titoloInput) titoloInput.value = '';
    if (testoInput) testoInput.value = '';
    aggiornaOrdineDataLabel();
    mostraVistaOrdini('nota');
}

function tornaListaOrdini() {
    mostraVistaOrdini('lista');
    renderizzaOrdiniDashboard();
}

function salvaOrdine() {
    const titoloInput = document.getElementById('ordine-titolo');
    const testoInput = document.getElementById('ordine-contesto');
    if (!titoloInput || !testoInput) return;

    const titolo = titoloInput.value.trim();
    const testo = testoInput.value.trim();
    if (!titolo && !testo) {
        alert('Inserisci titolo o contesto');
        return;
    }

    const ordini = getOrdiniSalvati();
    const adessoIso = new Date().toISOString();

    if (ordineInModificaId) {
        const idx = ordini.findIndex(o => o.id === ordineInModificaId);
        if (idx !== -1) {
            ordini[idx] = {
                ...ordini[idx],
                titolo,
                testo,
                data: ordineDataSelezionata || '',
                ora: ordineOraSelezionata || '',
                aggiornatoIl: adessoIso
            };
        }
    } else {
        ordini.unshift({
            id: Date.now().toString(),
            titolo,
            testo,
            data: ordineDataSelezionata || '',
            ora: ordineOraSelezionata || '',
            creatoIl: adessoIso
        });
    }

    localStorage.setItem(ORDINI_STORAGE_KEY, JSON.stringify(ordini));
    mostraNotifica(ordineInModificaId ? '✅ Ordine aggiornato' : '✅ Ordine salvato', 'success');
    ordineInModificaId = null;
    ordineDataSelezionata = null;
    ordineOraSelezionata = '';
    aggiornaOrdineDataLabel();
    mostraVistaOrdini('lista');
    renderizzaOrdiniDashboard();
    renderizzaOrdiniHome();
}

function annullaModificaOrdine() {
    ordineInModificaId = null;
    ordineDataSelezionata = null;
    ordineOraSelezionata = '';
    const titoloInput = document.getElementById('ordine-titolo');
    const testoInput = document.getElementById('ordine-contesto');
    if (titoloInput) titoloInput.value = '';
    if (testoInput) testoInput.value = '';
    aggiornaOrdineDataLabel();
    mostraVistaOrdini('lista');
}

function avviaModificaOrdine(id) {
    const ordini = getOrdiniSalvati();
    const ordine = ordini.find(o => o.id === id);
    if (!ordine) return;

    ordineInModificaId = id;
    const titoloInput = document.getElementById('ordine-titolo');
    const testoInput = document.getElementById('ordine-contesto');
    if (titoloInput) titoloInput.value = ordine.titolo || ordine.nome || '';
    if (testoInput) testoInput.value = ordine.testo || ordine.ordine || '';
    ordineDataSelezionata = normalizzaDataOrdine(ordine.data || '') || null;
    ordineOraSelezionata = ordine.ora || '';
    aggiornaOrdineDataLabel();
    mostraVistaOrdini('nota');
}

function annullaOrdine(id) {
    const ordini = getOrdiniSalvati();
    const next = ordini.filter(o => o.id !== id);
    localStorage.setItem(ORDINI_STORAGE_KEY, JSON.stringify(next));
    if (ordineInModificaId === id) {
        ordineInModificaId = null;
        ordineDataSelezionata = null;
        ordineOraSelezionata = '';
        aggiornaOrdineDataLabel();
    }
    renderizzaOrdiniDashboard();
    renderizzaOrdiniHome();
    mostraVistaOrdini('lista');
}

function eliminaOrdineDaModal() {
    if (!ordineInModificaId) return;
    annullaOrdine(ordineInModificaId);
    toggleCalendarioOrdini(false);
}

function renderizzaOrdiniDashboard() {
    mostraVistaOrdini('lista');
    renderizzaOrdiniLista('lista-ordini-dashboard', { soloOggi: false, cliccabile: true });
}

function renderizzaOrdiniHome() {
    renderizzaOrdiniLista('lista-ordini-home', { soloOggi: true, cliccabile: false, home: true });
}

function renderizzaOrdiniLista(containerId, opzioni) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const ordini = getOrdiniSalvati();
    const oggiIso = new Date().toISOString().slice(0, 10);
    const filtroOggi = opzioni && opzioni.soloOggi;
    const cliccabile = opzioni && opzioni.cliccabile;
    const isHome = opzioni && opzioni.home;

    const filtrati = filtroOggi
        ? ordini.filter(o => normalizzaDataOrdine(o.data) === oggiIso)
        : ordini;

    const emptyBox = document.getElementById('ordini-empty');
    if (!filtrati.length) {
        if (containerId === 'lista-ordini-dashboard' && emptyBox) {
            emptyBox.style.display = 'flex';
            container.style.display = 'none';
            container.innerHTML = '';
            return;
        }
        container.innerHTML = filtroOggi
            ? '<div style="color:#888; text-align:center; font-size:12px; padding:8px;">Nessuna prenotazione per oggi</div>'
            : '<div style="color:#888; text-align:center; font-size:12px; padding:8px;">Nessun ordine salvato</div>';
        return;
    }

    if (containerId === 'lista-ordini-dashboard' && emptyBox) {
        emptyBox.style.display = 'none';
        container.style.display = 'block';
    }

    const ordinati = [...filtrati].sort((a, b) => {
        const aKey = `${normalizzaDataOrdine(a.data) || '9999-12-31'}`;
        const bKey = `${normalizzaDataOrdine(b.data) || '9999-12-31'}`;
        return aKey.localeCompare(bKey);
    });

    container.innerHTML = ordinati.map((o) => {
        const titolo = escapeHtml(o.titolo || o.nome || 'Promemoria');
        const testo = escapeHtml(o.testo || o.ordine || '');
        const dataLabel = o.data ? formatDataLabel(o.data, o.ora) : '';
        const onClick = cliccabile ? `onclick="avviaModificaOrdine('${o.id}')"` : '';
        const listClass = isHome ? 'ordini-list-item ordini-list-item-home' : 'ordini-list-item';
        return `
            <div class="${listClass}" ${onClick}>
                <div class="ordini-list-title">${titolo}</div>
                <div class="ordini-list-context">${testo}</div>
                ${dataLabel ? `<div class="ordini-list-date">${escapeHtml(dataLabel)}</div>` : ''}
            </div>
        `;
    }).join('');
}


/* ===========================================================
   EXPORT PDF REPORT HACCP
   =========================================================== */

function apriGeneratoreReport() {
    vaiA('sez-admin-report');
    
    // Imposta date predefinite (ultimo mese)
    const oggi = new Date();
    const meseFa = new Date();
    meseFa.setMonth(oggi.getMonth() - 1);
    
    document.getElementById('report-data-inizio').value = meseFa.toISOString().split('T')[0];
    document.getElementById('report-data-fine').value = oggi.toISOString().split('T')[0];
}

async function generaReportPDF() {
    try {
        if (typeof jspdf === 'undefined') {
            mostraNotifica('❌ Libreria PDF non caricata! Ricarica la pagina.', 'error');
            return;
        }
        
        mostraNotifica('📄 Generazione report in corso...', 'info');
        
        const { jsPDF } = jspdf;
        const doc = new jsPDF();
        
        // Recupera date
        const dataInizio = new Date(document.getElementById('report-data-inizio').value);
        const dataFine = new Date(document.getElementById('report-data-fine').value);
        
        // Recupera opzioni
        const includiTemp = document.getElementById('report-inc-temp').checked;
        const includiLotti = document.getElementById('report-inc-lotti').checked;
        const includiNC = document.getElementById('report-inc-nc').checked;
        const includiSanif = document.getElementById('report-inc-sanif').checked;
        const includiManut = document.getElementById('report-inc-manut').checked;
        const includiForm = document.getElementById('report-inc-form').checked;
        
        let yPos = 20;
        
        // INTESTAZIONE
        doc.setFontSize(20);
        doc.setTextColor(0, 132, 255);
        doc.text('REPORT HACCP', 105, yPos, { align: 'center' });
        
        yPos += 10;
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Periodo: ${dataInizio.toLocaleDateString('it-IT')} - ${dataFine.toLocaleDateString('it-IT')}`, 105, yPos, { align: 'center' });
        
        yPos += 5;
        doc.text(`Generato il: ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT')}`, 105, yPos, { align: 'center' });
        
        yPos += 15;
        doc.setDrawColor(200);
        doc.line(20, yPos, 190, yPos);
        yPos += 10;
        
        // TEMPERATURE
        if (includiTemp) {
            const temperature = JSON.parse(localStorage.getItem('haccp_log')) || [];
            const tempPeriodo = temperature.filter(t => {
                const dataTemp = new Date(t.data);
                return dataTemp >= dataInizio && dataTemp <= dataFine;
            });
            
            doc.setFontSize(14);
            doc.setTextColor(0);
            doc.text('🌡️ CONTROLLO TEMPERATURE', 20, yPos);
            yPos += 8;
            
            doc.setFontSize(10);
            doc.text(`Totale controlli effettuati: ${tempPeriodo.length}`, 20, yPos);
            yPos += 6;
            
            // Temperature fuori range
            const fuoriRange = tempPeriodo.filter(t => {
                const frigo = parseFloat(t.temperaturaFrigo);
                const freezer = parseFloat(t.temperaturaFreezer);
                return frigo < 0 || frigo > 4 || freezer < -22 || freezer > -18;
            });
            
            doc.setTextColor(255, 69, 58);
            doc.text(`Letture fuori range: ${fuoriRange.length}`, 20, yPos);
            yPos += 10;
            
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }
        }
        
        // LOTTI
        if (includiLotti) {
            const lotti = JSON.parse(localStorage.getItem('haccp_lotti')) || [];
            const lottiPeriodo = lotti.filter(l => {
                const dataProd = parseDataItaliana(l.dataProduzione);
                return dataProd >= dataInizio && dataProd <= dataFine;
            });
            
            doc.setFontSize(14);
            doc.setTextColor(0);
            doc.text('🏷️ LOTTI DI PRODUZIONE', 20, yPos);
            yPos += 8;
            
            doc.setFontSize(10);
            doc.text(`Totale lotti creati: ${lottiPeriodo.length}`, 20, yPos);
            yPos += 6;
            
            const lottiTerminati = lottiPeriodo.filter(l => l.terminato).length;
            doc.text(`Lotti terminati: ${lottiTerminati}`, 20, yPos);
            yPos += 10;
            
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }
        }
        
        // NON CONFORMITÀ
        if (includiNC) {
            const nc = JSON.parse(localStorage.getItem('haccp_nc')) || [];
            const ncPeriodo = nc.filter(n => {
                const dataNC = new Date(n.data);
                return dataNC >= dataInizio && dataNC <= dataFine;
            });
            
            doc.setFontSize(14);
            doc.setTextColor(0);
            doc.text('⚠️ NON CONFORMITÀ', 20, yPos);
            yPos += 8;
            
            doc.setFontSize(10);
            doc.setTextColor(255, 69, 58);
            doc.text(`Totale segnalazioni: ${ncPeriodo.length}`, 20, yPos);
            yPos += 10;
            
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }
        }
        
        // SANIFICAZIONI
        if (includiSanif) {
            const sanificazioni = JSON.parse(localStorage.getItem('haccp_sanificazione')) || [];
            const sanifPeriodo = sanificazioni.filter(s => {
                const dataSanif = new Date(s.data);
                return dataSanif >= dataInizio && dataSanif <= dataFine;
            });
            
            doc.setFontSize(14);
            doc.setTextColor(0);
            doc.text('🧼 SANIFICAZIONI', 20, yPos);
            yPos += 8;
            
            doc.setFontSize(10);
            doc.text(`Interventi effettuati: ${sanifPeriodo.length}`, 20, yPos);
            yPos += 10;
            
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }
        }
        
        // MANUTENZIONI
        if (includiManut) {
            const attrezzature = JSON.parse(localStorage.getItem('haccp_attrezzature')) || [];
            
            doc.setFontSize(14);
            doc.setTextColor(0);
            doc.text('🔧 MANUTENZIONI', 20, yPos);
            yPos += 8;
            
            doc.setFontSize(10);
            doc.text(`Attrezzature monitorate: ${attrezzature.length}`, 20, yPos);
            yPos += 10;
        }
        
        // FORMAZIONE
        if (includiForm) {
            const formazione = JSON.parse(localStorage.getItem('haccp_formazione')) || [];
            
            doc.setFontSize(14);
            doc.setTextColor(0);
            doc.text('🎓 FORMAZIONE PERSONALE', 20, yPos);
            yPos += 8;
            
            doc.setFontSize(10);
            doc.text(`Attestati registrati: ${formazione.length}`, 20, yPos);
            yPos += 10;
        }
        
        // FIRMA E NOTE FINALI
        yPos += 20;
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }
        
        doc.setDrawColor(200);
        doc.line(20, yPos, 190, yPos);
        yPos += 10;
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text('Responsabile HACCP: _________________________', 20, yPos);
        yPos += 10;
        doc.text('Data e Firma: _________________________', 20, yPos);
        
        const pdfUrl = doc.output('bloburl');
        const win = window.open(pdfUrl, 'ANTEPRIMA_REPORT');
        if (!win) {
            mostraNotifica('⚠️ Popup bloccato. Consenti i popup per vedere l\'anteprima.', 'warning');
            return;
        }
        win.focus();
        setTimeout(() => {
            try {
                win.print();
            } catch (err) {
                // Ignora errori di stampa automatica.
            }
        }, 600);

        mostraNotifica('✅ Anteprima report aperta', 'success');
        
    } catch (error) {
        console.error('Errore generazione PDF:', error);
        mostraNotifica('❌ Errore nella generazione del PDF: ' + error.message, 'error');
    }
}


/* ===========================================================
   SISTEMA BACKUP & RESTORE
   =========================================================== */

function esportaDatiCompleti() {
    try {
        const dataBackup = {
            version: '2.0',
            dataEsportazione: new Date().toISOString(),
            dati: {
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
                configurazioni: {
                    stampa: localStorage.getItem('haccp_config_stampa'),
                    pec: localStorage.getItem('haccp_pec_accounts'),
                    backup: localStorage.getItem('haccp_config_backup'),
                    alert: localStorage.getItem('haccp_config_alert'),
                    tema: localStorage.getItem('haccp_tema')
                }
            }
        };
        
        const jsonString = JSON.stringify(dataBackup, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `HACCP_Backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Salva info ultimo backup
        localStorage.setItem('haccp_ultimo_backup', new Date().toISOString());
        aggiornaInfoBackup();
        
        mostraNotifica('✅ Backup esportato con successo!', 'success');
        
    } catch (error) {
        console.error('Errore esportazione:', error);
        mostraNotifica('❌ Errore durante l\'esportazione: ' + error.message, 'error');
    }
}

function importaDatiCompleti() {
    const fileInput = document.getElementById('file-import-backup');
    const file = fileInput.files[0];
    
    if (!file) {
        mostraNotifica('⚠️ Seleziona un file JSON di backup!', 'warning');
        return;
    }
    
    if (!confirm('⚠️ ATTENZIONE!\n\nQuesta operazione sovrascriverà TUTTI i dati esistenti.\n\nVuoi procedere?')) {
        return;
    }
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const backup = JSON.parse(e.target.result);
            
            if (!backup.version || !backup.dati) {
                throw new Error('File di backup non valido');
            }
            
            // Ripristina tutti i dati
            for (const [key, value] of Object.entries(backup.dati)) {
                if (key === 'configurazioni') {
                    for (const [confKey, confValue] of Object.entries(value)) {
                        if (confValue) localStorage.setItem(confKey, confValue);
                    }
                } else {
                    if (value) localStorage.setItem(`haccp_${key}`, value);
                }
            }
            
            mostraNotifica('✅ Backup ripristinato! Ricarica la pagina.', 'success');
            
            setTimeout(() => {
                location.reload();
            }, 2000);
            
        } catch (error) {
            console.error('Errore importazione:', error);
            mostraNotifica('❌ File backup corrotto o non valido!', 'error');
        }
    };
    
    reader.readAsText(file);
}

function salvaImpostazioniBackup() {
    const frequenza = document.getElementById('backup-frequenza').value;
    
    const config = {
        frequenza: frequenza,
        ultimoBackup: localStorage.getItem('haccp_ultimo_backup') || null
    };
    
    localStorage.setItem('haccp_config_backup', JSON.stringify(config));
    
    mostraNotifica('✅ Impostazioni backup salvate!', 'success');
    aggiornaInfoBackup();
    
    // Avvia scheduler se abilitato
    if (frequenza !== 'disabled') {
        avviaBackupAutomatico(frequenza);
    }
}

function aggiornaInfoBackup() {
    const infoDiv = document.getElementById('info-ultimo-backup');
    if (!infoDiv) return;
    
    const ultimoBackup = localStorage.getItem('haccp_ultimo_backup');
    
    if (ultimoBackup) {
        const data = new Date(ultimoBackup);
        infoDiv.innerHTML = `<small>Ultimo backup: ${data.toLocaleDateString('it-IT')} alle ${data.toLocaleTimeString('it-IT')}</small>`;
    } else {
        infoDiv.innerHTML = '<small>Ultimo backup: Mai effettuato</small>';
    }
}

function avviaBackupAutomatico(frequenza) {
    // TODO: Implementare scheduler con setInterval
    // Per ora solo placeholder
    console.log('Backup automatico schedulato:', frequenza);
}


/* ===========================================================
   CALENDARIO SCADENZE
   =========================================================== */

let calendarioMeseCorrente = new Date().getMonth();
let calendarioAnnoCorrente = new Date().getFullYear();

function renderizzaCalendario() {
    vaiA('sez-admin-calendario');
    
    const nomiMesi = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 
                      'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    
    document.getElementById('calendario-mese-anno').textContent = 
        `${nomiMesi[calendarioMeseCorrente]} ${calendarioAnnoCorrente}`;
    
    const primoGiorno = new Date(calendarioAnnoCorrente, calendarioMeseCorrente, 1);
    const ultimoGiorno = new Date(calendarioAnnoCorrente, calendarioMeseCorrente + 1, 0);
    
    // Primo giorno della settimana (0 = domenica, vogliamo lunedì = 1)
    let giornoInizio = primoGiorno.getDay();
    giornoInizio = giornoInizio === 0 ? 6 : giornoInizio - 1;
    
    const giorniMese = ultimoGiorno.getDate();
    
    // Recupera lotti attivi
    const lotti = JSON.parse(localStorage.getItem('haccp_lotti')) || [];
    const lottiAttivi = lotti.filter(l => !l.terminato);
    
    let html = '';
    
    // Celle vuote iniziali
    for (let i = 0; i < giornoInizio; i++) {
        html += '<div style="padding: 12px; background: rgba(255,255,255,0.02); border-radius: 8px;"></div>';
    }
    
    // Giorni del mese
    for (let giorno = 1; giorno <= giorniMese; giorno++) {
        const dataCorrente = new Date(calendarioAnnoCorrente, calendarioMeseCorrente, giorno);
        const dataStr = dataCorrente.toLocaleDateString('it-IT');
        
        // Trova prodotti in scadenza in questo giorno
        const prodottiGiorno = lottiAttivi.filter(l => {
            if (!l.scadenza) return false;
            return l.scadenza === dataStr;
        });
        
        const oggi = new Date();
        oggi.setHours(0, 0, 0, 0);
        dataCorrente.setHours(0, 0, 0, 0);
        
        // Determina colore
        let colore = 'rgba(255,255,255,0.05)';
        let borderColor = 'rgba(255,255,255,0.1)';
        
        if (prodottiGiorno.length > 0) {
            const diffGiorni = Math.floor((dataCorrente - oggi) / (1000 * 60 * 60 * 24));
            
            if (diffGiorni < 0) {
                colore = 'rgba(255, 69, 58, 0.2)'; // Rosso - scaduto
                borderColor = '#FF453A';
            } else if (diffGiorni <= 3) {
                colore = 'rgba(255, 159, 10, 0.2)'; // Arancione - critico
                borderColor = '#FF9F0A';
            } else if (diffGiorni <= 7) {
                colore = 'rgba(255, 214, 10, 0.2)'; // Giallo - imminente
                borderColor = '#FFD60A';
            } else {
                colore = 'rgba(48, 209, 88, 0.2)'; // Verde - OK
                borderColor = '#30D158';
            }
        }
        
        // Oggi
        if (dataCorrente.getTime() === oggi.getTime()) {
            borderColor = '#0A84FF';
        }
        
        html += `
            <div onclick="mostraDettagliGiornoCalendario(${giorno})" 
                 style="padding: 12px; background: ${colore}; border: 2px solid ${borderColor}; 
                        border-radius: 8px; cursor: pointer; transition: all 0.3s; position: relative;
                        min-height: 60px; display: flex; flex-direction: column; justify-content: space-between;">
                <div style="font-weight: 600; font-size: 1.1rem;">${giorno}</div>
                ${prodottiGiorno.length > 0 ? 
                    `<div style="background: ${borderColor}; color: white; border-radius: 12px; 
                                padding: 4px 8px; font-size: 0.75rem; font-weight: 600; text-align: center;">
                        ${prodottiGiorno.length}
                    </div>` : ''}
            </div>
        `;
    }
    
    document.getElementById('calendario-giorni').innerHTML = html;
}

function mostraDettagliGiornoCalendario(giorno) {
    const dataSelezionata = new Date(calendarioAnnoCorrente, calendarioMeseCorrente, giorno);
    const dataStr = dataSelezionata.toLocaleDateString('it-IT');
    
    const lotti = JSON.parse(localStorage.getItem('haccp_lotti')) || [];
    const lottiGiorno = lotti.filter(l => !l.terminato && l.scadenza === dataStr);
    
    const dettagliDiv = document.getElementById('calendario-dettagli');
    const titoloDiv = document.getElementById('calendario-dettagli-titolo');
    const listaDiv = document.getElementById('calendario-dettagli-lista');
    
    titoloDiv.textContent = `Prodotti in scadenza il ${dataStr}`;
    
    if (lottiGiorno.length === 0) {
        listaDiv.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Nessun prodotto in scadenza</p>';
    } else {
        listaDiv.innerHTML = lottiGiorno.map(l => `
            <div style="padding: 16px; background: rgba(255,255,255,0.05); border-radius: 12px; margin-bottom: 12px; 
                        border-left: 4px solid #0A84FF;">
                <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 8px;">${l.prodotto}</div>
                <div style="font-size: 0.9rem; color: var(--text-secondary);">Lotto: ${l.lottoInterno}</div>
                <div style="font-size: 0.9rem; color: var(--text-secondary);">Produzione: ${l.dataProduzione}</div>
            </div>
        `).join('');
    }
    
    dettagliDiv.style.display = 'block';
}

function calendarioMesePrecedente() {
    calendarioMeseCorrente--;
    if (calendarioMeseCorrente < 0) {
        calendarioMeseCorrente = 11;
        calendarioAnnoCorrente--;
    }
    renderizzaCalendario();
}

function calendarioMeseSuccessivo() {
    calendarioMeseCorrente++;
    if (calendarioMeseCorrente > 11) {
        calendarioMeseCorrente = 0;
        calendarioAnnoCorrente++;
    }
    renderizzaCalendario();
}


/* ===========================================================
   CONFIGURAZIONE ALERT EMAIL/WHATSAPP
   =========================================================== */

function salvaConfigurazioneEmail() {
    const config = {
        enabled: document.getElementById('alert-email-enabled').value === 'true',
        destinatario: document.getElementById('alert-email-destinatario').value,
        smtp: document.getElementById('alert-email-smtp').value,
        porta: document.getElementById('alert-email-porta').value,
        mittente: document.getElementById('alert-email-mittente').value,
        password: document.getElementById('alert-email-password').value,
        eventi: {
            scadenze: document.getElementById('alert-email-scadenze').checked,
            temperature: document.getElementById('alert-email-temperature').checked,
            nc: document.getElementById('alert-email-nc').checked,
            manutenzioni: document.getElementById('alert-email-manutenzioni').checked
        }
    };
    
    localStorage.setItem('haccp_config_alert_email', JSON.stringify(config));
    mostraNotifica('✅ Configurazione email salvata!', 'success');
}

function salvaConfigurazioneWhatsApp() {
    const config = {
        enabled: document.getElementById('alert-whatsapp-enabled').value === 'true',
        numero: document.getElementById('alert-whatsapp-numero').value,
        apiKey: document.getElementById('alert-whatsapp-apikey').value,
        sid: document.getElementById('alert-whatsapp-sid').value,
        eventi: {
            scadenze: document.getElementById('alert-whatsapp-scadenze').checked,
            temperature: document.getElementById('alert-whatsapp-temperature').checked,
            nc: document.getElementById('alert-whatsapp-nc').checked
        }
    };
    
    localStorage.setItem('haccp_config_alert_whatsapp', JSON.stringify(config));
    mostraNotifica('✅ Configurazione WhatsApp salvata!', 'success');
}

async function testEmail() {
    const config = JSON.parse(localStorage.getItem('haccp_config_alert_email') || '{}');
    
    if (!config.destinatario) {
        mostraNotifica('⚠️ Configura prima l\'email destinatario!', 'warning');
        return;
    }
    
    mostraNotifica('📧 Invio email di test in corso...', 'info');
    
    try {
        // TODO: Implementare invio email tramite backend server.js
        // Per ora simuliamo successo
        setTimeout(() => {
            mostraNotifica('✅ Email di test inviata! (Simulazione)', 'success');
        }, 2000);
    } catch (error) {
        mostraNotifica('❌ Errore invio email: ' + error.message, 'error');
    }
}

async function testWhatsApp() {
    const config = JSON.parse(localStorage.getItem('haccp_config_alert_whatsapp') || '{}');
    
    if (!config.numero) {
        mostraNotifica('⚠️ Configura prima il numero WhatsApp!', 'warning');
        return;
    }
    
    mostraNotifica('💬 Invio messaggio WhatsApp di test...', 'info');
    
    try {
        // TODO: Implementare invio WhatsApp tramite Twilio/CallMeBot API
        // Per ora simuliamo successo
        setTimeout(() => {
            mostraNotifica('✅ Messaggio WhatsApp inviato! (Simulazione)', 'success');
        }, 2000);
    } catch (error) {
        mostraNotifica('❌ Errore invio WhatsApp: ' + error.message, 'error');
    }
}

// Funzione per inviare alert automatici quando si verificano eventi
function inviaAlertAutomatico(tipo, messaggio) {
    const configEmail = JSON.parse(localStorage.getItem('haccp_config_alert_email') || '{}');
    const configWhatsApp = JSON.parse(localStorage.getItem('haccp_config_alert_whatsapp') || '{}');
    
    // Email
    if (configEmail.enabled && configEmail.eventi[tipo]) {
        // TODO: Implementare invio email
        console.log('Alert email:', messaggio);
    }
    
    // WhatsApp
    if (configWhatsApp.enabled && configWhatsApp.eventi[tipo]) {
        // TODO: Implementare invio WhatsApp
        console.log('Alert WhatsApp:', messaggio);
    }
}

// Carica app all'avvio - DEVE ESSERE ALLA FINE!
window.addEventListener('DOMContentLoaded', () => {
  aggiornaListaUtenti();
  aggiornaListaFrigo();
  richieidiPermessiNotifiche();
    renderizzaLoginUtenti();
});
