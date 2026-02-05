/* ===========================================================
1. CONFIGURAZIONE E CARICAMENTO DATI
===========================================================
*/

const PIN_ADMIN = "9999";

// Recuperiamo gli utenti salvati o creiamo un elenco vuoto se è la prima volta
let databaseUtenti = JSON.parse(localStorage.getItem("haccp_utenti")) || [];
let databaseFrigo = JSON.parse(localStorage.getItem("haccp_frigo")) || [];
let databaseTemperature = JSON.parse(localStorage.getItem("haccp_log")) || [];

// Appena l'app parte, aggiorniamo la lista visibile (se ci sono dati)
aggiornaListaUtenti();


/* ===========================================================
2. FUNZIONE LOGIN (CORRETTA)
===========================================================
*/

function logicaLogin() {
    const inputElement = document.getElementById("input-pin");
    const pinInserito = inputElement.value;

    // --- STRADA A: CONTROLLO SE È L'ADMIN ---
    if (pinInserito === "9999") {
        console.log("Accesso Admin autorizzato");
        vaiA("sez-admin"); 
        inputElement.value = ""; 
        return; 
    }

    // --- STRADA B: CONTROLLO SE È UN UTENTE REGISTRATO ---
    const utenteTrovato = databaseUtenti.find(u => u.pin === pinInserito);

    if (utenteTrovato) {
        console.log("Accesso Utente: " + utenteTrovato.nome);
        
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

        // Attiviamo l'Assistente
        aggiornaAssistente(utenteTrovato.nome);
        
        vaiA("sez-operatore");

        // CORREZIONE QUI: Usiamo input-pin invece di pin-input
        inputElement.value = "";
        return;
    }

    // Se il PIN è sbagliato
    alert("PIN errato!");
    inputElement.value = "";
}



/* ===========================================================
3. IL MOTORE DI NAVIGAZIONE (L'Interruttore)
=========================================================== */

function vaiA(idSezione) {
    // 1. Nascondiamo TUTTE le sezioni che hanno la classe "schermata"
    const tutteLeSchermate = document.querySelectorAll('.schermata');
    tutteLeSchermate.forEach(s => s.style.display = "none");

    // 2. Cerchiamo la sezione da aprire
    const sezioneDaAprire = document.getElementById(idSezione);
    
    if (sezioneDaAprire) {
        sezioneDaAprire.style.display = "block";
        window.scrollTo(0, 0); // Torna in alto
    } else {
        // Se vedi questo errore in console, l'ID nel pulsante è sbagliato!
        console.error("ERRORE: La sezione '" + idSezione + "' non esiste nell'HTML!");
        alert("Errore tecnico: sezione non trovata.");
    }

    // 3. Logica speciale per caricamento frigo
    // IMPORTANTE: Assicurati che il nome qui coincida con quello del pulsante!
    if (idSezione === "sez-op-temperature" || idSezione === "sez-registra-temp") {
        console.log("Apertura sezione temperature: carico i frigoriferi...");
        popolaMenuFrigo();
    }
    
    // Carica la lista prodotti quando apriamo la sezione lotti
    if (idSezione === "sez-op-lotti") {
        console.log("Apertura sezione lotti: carico i prodotti...");
        popolaSelectProdotti();
    }
}

function logout() {
    location.reload();
}


/* ===========================================================
4. LOGICA GESTIONE UTENTI
===========================================================
*/



function aggiungiUtente() {
    const nome = document.getElementById("nuovo-nome-utente").value.trim();
    const pin = document.getElementById("nuovo-pin-utente").value.trim();
    
    // Recupera il ruolo selezionato (Operatore o Responsabile)
    const ruolo = document.querySelector('input[name="ruolo-utente"]:checked').value;

    if (nome === "" || pin === "") {
        alert("Inserisci tutti i dati!");
        return;
    }

    // Creiamo l'oggetto utente COMPLETO
    const nuovoUtente = { 
        nome: nome, 
        pin: pin, 
        ruolo: ruolo 
    };

    databaseUtenti.push(nuovoUtente);
    localStorage.setItem("haccp_utenti", JSON.stringify(databaseUtenti));

    // Pulizia campi
    document.getElementById("nuovo-nome-utente").value = "";
    document.getElementById("nuovo-pin-utente").value = "";
    
    aggiornaListaUtenti();
    alert("Utente registrato come: " + ruolo);
}

function aggiornaListaUtenti() {
    const contenitore = document.getElementById("lista-utenti-creati");
    if (!contenitore) return;
    contenitore.innerHTML = "";

    databaseUtenti.forEach((utente, index) => {
        // Se è responsabile, mettiamo una corona o un colore diverso
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
}

function eliminaUtente(indice) {
    // 1. Chiediamo conferma per sicurezza
    const conferma = confirm("Vuoi davvero eliminare questo collaboratore?");
    
    if (conferma) {
        // 2. Rimuoviamo l'utente dall'array usando la sua posizione (indice)
        databaseUtenti.splice(indice, 1);

        // 3. Salviamo la nuova lista nel browser per non perdere la modifica
        localStorage.setItem("haccp_utenti", JSON.stringify(databaseUtenti));

        // 4. Rinfreschiamo subito la lista visibile a schermo
        aggiornaListaUtenti();
        
        console.log("Utente rimosso con successo.");
    }
}

/* ===========================================================
5. LOGICA GESTIONE FRIGORIFERI
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


aggiornaListaFrigo();


// ==========================================
// 6. LOGICA OPERATIVA: REGISTRAZIONE TEMPERATURE
// ==========================================

function salvaTemperatura() {
    const selectFrigo = document.getElementById("select-frigo");
    const inputTemp = document.getElementById("temp-rilevata");
    const etichettaNome = document.getElementById("nome-operatore");

    // Controlliamo che gli elementi esistano per evitare la schermata nera
    if (!selectFrigo || !inputTemp || !etichettaNome) {
        console.error("Errore: Alcuni elementi HTML mancano!");
        return;
    }

    const frigo = selectFrigo.value;
    const gradi = inputTemp.value;
    const operatore = etichettaNome.innerText;

    if (gradi === "") {
        alert("Inserisci i gradi!");
        return;
    }

    // Determiniamo lo stato (OK o ALLARME)
    let stato = "OK";
    if (parseFloat(gradi) > 5) {
        stato = "⚠️ ALLARME";
    }

    // Creiamo il record
    const nuovoRecord = {
        data: new Date().toLocaleString(),
        frigo: frigo,
        gradi: gradi,
        utente: operatore,
        stato: stato
    };

    // Salvataggio nel database e nel localStorage
    databaseTemperature.push(nuovoRecord);
    localStorage.setItem("haccp_log", JSON.stringify(databaseTemperature));

    // Aggiorniamo l'assistente prima di cambiare pagina
    aggiornaAssistente(operatore);

    alert("✅ Temperatura salvata correttamente!");
    
    // Pulizia e ritorno
    inputTemp.value = "";
    vaiA("sez-operatore");
}

function aggiornaAssistente(nomeUtente) {
    const box = document.getElementById("stato-attivita");
    const testo = document.getElementById("testo-stato");
    if (!box || !testo) return;

    const oggi = new Date().toLocaleDateString();
    
    // Troviamo l'ultima registrazione utile (che non sia un riposo)
    const ultimaReg = databaseTemperature.slice().reverse().find(r => r.gradi !== "CHIUSO");
    
    // Controlliamo se oggi è già stato fatto qualcosa
    const fattoOggi = databaseTemperature.some(r => r.data.includes(oggi));

    box.className = ""; // Reset colori

    if (fattoOggi) {
        // --- CASO 1: OGGI TUTTO OK ---
        box.classList.add("stato-ok");
        testo.innerHTML = `✅ <strong>CONTROLLO COMPLETATO</strong><br>Ottimo lavoro, ${nomeUtente}!`;
    } 
    else {
        // --- CASO 2: MANCA IL CONTROLLO ---
        box.classList.add("stato-vuoto");
        
        // Calcoliamo se è passato più di un giorno
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
   7. GESTIONE LOTTI E PRODUZIONE (FUNZIONE DINAMICA)
   =========================================================== */

let databaseLotti = JSON.parse(localStorage.getItem("haccp_lotti")) || [];
let elencoNomiProdotti = JSON.parse(localStorage.getItem("haccp_elenco_nomi")) || ["Sugo Pomodoro", "Ragu", "Maionese"];

function salvaLottoInterno() {
    const selectProd = document.getElementById("select-prodotto-prep");
    const nuovoNome = document.getElementById("nuovo-prodotto-nome").value.trim();
    const lottoOrigine = document.getElementById("lotto-origine").value;
    const quantita = document.getElementById("quantita-prep").value;
    const giorniScadenza = parseInt(document.getElementById("giorni-scadenza").value) || 3;
    const operatore = document.getElementById("nome-operatore").innerText;

    // Determiniamo il nome del prodotto (o dalla lista o dal campo nuovo)
    let prodottoFinale = selectProd.value;
    if (nuovoNome !== "") {
        prodottoFinale = nuovoNome;
        // Se è un nome nuovo, lo aggiungiamo all'elenco per la prossima volta
        if (!elencoNomiProdotti.includes(prodottoFinale)) {
            elencoNomiProdotti.push(prodottoFinale);
            localStorage.setItem("haccp_elenco_nomi", JSON.stringify(elencoNomiProdotti));
        }
    }

    if (!prodottoFinale || !lottoOrigine || !quantita) {
        alert("⚠️ Inserisci il nome del prodotto, il lotto origine e la quantità!");
        return;
    }

    const oggi = new Date();
    const codiceLotto = oggi.getFullYear().toString() + 
                        (oggi.getMonth() + 1).toString().padStart(2, '0') + 
                        oggi.getDate().toString().padStart(2, '0') + 
                        "-" + prodottoFinale.substring(0, 3).toUpperCase();

    let dataScadenza = new Date();
    dataScadenza.setDate(oggi.getDate() + giorniScadenza);

    const nuovoLotto = {
        dataProduzione: oggi.toLocaleDateString(),
        prodotto: prodottoFinale,
        lottoInterno: codiceLotto,
        lottoOrigine: lottoOrigine,
        quantita: quantita,
        scadenza: dataScadenza.toLocaleDateString(),
        operatore: operatore
    };

    databaseLotti.push(nuovoLotto);
    localStorage.setItem("haccp_lotti", JSON.stringify(databaseLotti));

    alert(`✅ LOTTO CREATO: ${codiceLotto}\nScadenza: ${nuovoLotto.scadenza}`);
    
    // Reset campi e torna alla home
    document.getElementById("nuovo-prodotto-nome").value = "";
    document.getElementById("lotto-origine").value = "";
    document.getElementById("quantita-prep").value = "";
    vaiA('sez-operatore');
}

// Riempie la tendina con i nomi salvati
function popolaSelectProdotti() {
    const select = document.getElementById("select-prodotto-prep");
    if (!select) return;
    select.innerHTML = '<option value="">-- Scegli esistente o scrivi sotto --</option>';
    elencoNomiProdotti.forEach(p => {
        let opt = document.createElement("option");
        opt.value = p;
        opt.innerText = p;
        select.appendChild(opt);
    });
}

/* ===========================================================
   8. FUNZIONI PER LO STORICO
   =========================================================== */

function vaiAStorico() {
    vaiA('sez-storico-admin');
    mostraStorico('temperature');
}

function mostraStorico(tipo) {
    const btnTemp = document.getElementById("btn-tab-temp");
    const btnLotti = document.getElementById("btn-tab-lotti");
    const divTemp = document.getElementById("contenuto-storico-temp");
    const divLotti = document.getElementById("contenuto-storico-lotti");

    if (tipo === 'temperature') {
        btnTemp.style.background = "var(--oro)";
        btnLotti.style.background = "#555";
        divTemp.style.display = "block";
        divLotti.style.display = "none";
        aggiornaStoricoTemperature();
    } else {
        btnTemp.style.background = "#555";
        btnLotti.style.background = "var(--oro)";
        divTemp.style.display = "none";
        divLotti.style.display = "block";
        aggiornaStoricoLotti();
    }
}

function aggiornaStoricoTemperature() {
    const contenitore = document.getElementById("contenuto-storico-temp");
    if (!contenitore) return;
    
    contenitore.innerHTML = "";
    
    if (databaseTemperature.length === 0) {
        contenitore.innerHTML = '<p style="color:gray; text-align:center; padding:20px;">Nessuna registrazione trovata</p>';
        return;
    }

    // Mostriamo le registrazioni più recenti per prime
    const registrazioniInvertite = [...databaseTemperature].reverse();
    
    registrazioniInvertite.forEach((record, index) => {
        const coloreStato = record.stato === "OK" ? "#4CAF50" : 
                           record.stato === "RIPOSO" ? "#FF9800" : "#f44336";
        
        const isChiuso = record.gradi === "CHIUSO";
        
        contenitore.innerHTML += `
            <div class="riga-utente" style="border-left: 5px solid ${coloreStato}; margin-bottom: 8px; padding: 12px; background: #2a2a2a;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <strong style="color: ${coloreStato};">${record.stato}</strong>
                    <small style="color: #888;">${record.data}</small>
                </div>
                <div style="font-size: 0.9rem; color: #ccc;">
                    ${isChiuso ? 
                        '🏖️ <strong>GIORNO DI RIPOSO</strong>' : 
                        `📍 ${record.frigo} - <strong>${record.gradi}°C</strong>`
                    }
                </div>
                <div style="font-size: 0.75rem; color: #999; margin-top: 5px;">
                    👤 ${record.utente}
                </div>
            </div>
        `;
    });
}

function aggiornaStoricoLotti() {
    const contenitore = document.getElementById("contenuto-storico-lotti");
    if (!contenitore) return;
    
    contenitore.innerHTML = "";
    
    if (databaseLotti.length === 0) {
        contenitore.innerHTML = '<p style="color:gray; text-align:center; padding:20px;">Nessun lotto registrato</p>';
        return;
    }

    // Mostriamo i lotti più recenti per primi
    const lottiInvertiti = [...databaseLotti].reverse();
    
    lottiInvertiti.forEach((lotto, index) => {
        const oggi = new Date();
        let scadenza;
        let giorniRimanenti;
        
        // Parse date safely - assume DD/MM/YYYY format
        try {
            const parts = lotto.scadenza.split('/');
            if (parts.length === 3) {
                // Create date as YYYY-MM-DD
                scadenza = new Date(parts[2], parts[1] - 1, parts[0]);
                giorniRimanenti = Math.ceil((scadenza - oggi) / (1000 * 60 * 60 * 24));
            } else {
                // Fallback to current date if format is unexpected
                scadenza = new Date();
                giorniRimanenti = 0;
            }
        } catch (e) {
            scadenza = new Date();
            giorniRimanenti = 0;
        }
        
        let coloreScadenza = "#4CAF50"; // Verde
        if (giorniRimanenti <= 0) coloreScadenza = "#f44336"; // Rosso
        else if (giorniRimanenti <= 2) coloreScadenza = "#FF9800"; // Arancione
        
        contenitore.innerHTML += `
            <div class="riga-utente" style="border-left: 5px solid ${coloreScadenza}; margin-bottom: 10px; padding: 12px; background: #2a2a2a;">
                <div style="margin-bottom: 8px;">
                    <strong style="color: #c9a03f; font-size: 1.1rem;">${lotto.prodotto}</strong>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; font-size: 0.85rem; color: #ccc;">
                    <div>🏷️ Lotto: <strong>${lotto.lottoInterno}</strong></div>
                    <div>📦 Qt: <strong>${lotto.quantita}</strong></div>
                    <div>📅 Prod: ${lotto.dataProduzione}</div>
                    <div style="color: ${coloreScadenza};">⏰ Scad: ${lotto.scadenza}</div>
                </div>
                <div style="font-size: 0.75rem; color: #999; margin-top: 8px; padding-top: 8px; border-top: 1px solid #444;">
                    🔗 Origine: ${lotto.lottoOrigine} | 👤 ${lotto.operatore}
                </div>
                ${giorniRimanenti <= 2 && giorniRimanenti >= 0 ? 
                    '<div style="margin-top: 5px; padding: 5px; background: #FF9800; color: #000; border-radius: 5px; text-align: center; font-size: 0.75rem; font-weight: bold;">⚠️ IN SCADENZA</div>' : 
                    giorniRimanenti < 0 ? 
                    '<div style="margin-top: 5px; padding: 5px; background: #f44336; color: #fff; border-radius: 5px; text-align: center; font-size: 0.75rem; font-weight: bold;">🚫 SCADUTO</div>' : 
                    ''
                }
            </div>
        `;
    });
}

