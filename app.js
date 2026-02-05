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
    
    // 4. Logica speciale per la sezione produzione lotti
    if (idSezione === "sez-op-lotti") {
        console.log("Apertura sezione lotti: carico i prodotti...");
        popolaSelectProdotti();
    }
    
    // 5. Logica speciale per lo storico lotti
    if (idSezione === "sez-storico-admin") {
        console.log("Apertura storico lotti...");
        caricaStoricoLotti();
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

// Funzione per aprire lo storico e caricare i lotti
function vaiAStorico() {
    vaiA('sez-storico-admin');
    caricaStoricoLotti();
}

// Funzione che calcola lo stato della scadenza
function calcolaStatoScadenza(dataScadenzaStr) {
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0); // Reset ore per confronto preciso
    
    // Converti la data scadenza da stringa a oggetto Date
    const partiData = dataScadenzaStr.split('/');
    let dataScadenza;
    
    if (partiData.length === 3) {
        // Formato: gg/mm/aaaa
        dataScadenza = new Date(partiData[2], partiData[1] - 1, partiData[0]);
    } else {
        // Fallback se il formato è diverso
        dataScadenza = new Date(dataScadenzaStr);
    }
    
    dataScadenza.setHours(0, 0, 0, 0);
    
    // Calcola differenza in millisecondi e converti in giorni
    const diffMs = oggi - dataScadenza;
    const giorniDallaScadenza = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    let stato, colore, emoji;
    
    if (giorniDallaScadenza < 0) {
        // Prodotto ancora valido
        stato = "OK";
        colore = "#4CAF50"; // Verde
        emoji = "✅";
    } else if (giorniDallaScadenza >= 0 && giorniDallaScadenza <= 5) {
        // Scaduto da 0 a 5 giorni
        stato = "ATTENZIONE";
        colore = "#FFA500"; // Arancione/Giallo
        emoji = "⚠️";
    } else {
        // Scaduto da 6+ giorni
        stato = "CRITICO";
        colore = "#f44336"; // Rosso
        emoji = "🔴";
    }
    
    return { stato, colore, emoji, giorniDallaScadenza };
}

// Funzione che visualizza i lotti nello storico
function caricaStoricoLotti() {
    const container = document.getElementById("container-storico-lotti");
    if (!container) return;
    
    container.innerHTML = "";
    
    if (databaseLotti.length === 0) {
        container.innerHTML = '<p style="color:gray; text-align:center;">Nessun lotto registrato.</p>';
        return;
    }
    
    // Ordina i lotti dal più recente al più vecchio
    const lottiOrdinati = databaseLotti.slice().reverse();
    
    lottiOrdinati.forEach((lotto, index) => {
        const statoScadenza = calcolaStatoScadenza(lotto.scadenza);
        
        let messaggioScadenza = "";
        if (statoScadenza.giorniDallaScadenza < 0) {
            messaggioScadenza = `Scade tra ${Math.abs(statoScadenza.giorniDallaScadenza)} giorni`;
        } else if (statoScadenza.giorniDallaScadenza === 0) {
            messaggioScadenza = "Scade oggi";
        } else {
            messaggioScadenza = `Scaduto da ${statoScadenza.giorniDallaScadenza} giorni`;
        }
        
        container.innerHTML += `
            <div class="riga-lotto" style="
                background: #2a2a2a; 
                border-left: 5px solid ${statoScadenza.colore}; 
                padding: 15px; 
                margin-bottom: 10px; 
                border-radius: 8px;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong style="color: white; font-size: 1.1rem;">${lotto.prodotto}</strong>
                        <br>
                        <small style="color: #aaa;">Lotto: ${lotto.lottoInterno}</small>
                        <br>
                        <small style="color: #aaa;">Prodotto il: ${lotto.dataProduzione}</small>
                        <br>
                        <small style="color: #aaa;">Operatore: ${lotto.operatore}</small>
                    </div>
                    <div style="text-align: right;">
                        <div style="
                            background: ${statoScadenza.colore}; 
                            color: white; 
                            padding: 8px 12px; 
                            border-radius: 8px; 
                            font-weight: bold;
                            margin-bottom: 5px;
                        ">
                            ${statoScadenza.emoji} ${statoScadenza.stato}
                        </div>
                        <small style="color: ${statoScadenza.colore};">
                            Scadenza: ${lotto.scadenza}<br>
                            ${messaggioScadenza}
                        </small>
                    </div>
                </div>
            </div>
        `;
    });
}
