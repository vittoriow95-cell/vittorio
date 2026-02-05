// Database locale fornitori (salvato in localStorage)
const DB_FORNITORI = 'haccp_db_fornitori';

function caricaDBFornitori() {
    const db = localStorage.getItem(DB_FORNITORI);
    return db ? JSON.parse(db) : {};
}

function salvaDBFornitori(db) {
    localStorage.setItem(DB_FORNITORI, JSON.stringify(db));
}

// Funzione per mostrare dialog correzione nome fornitore
function mostraDialogCorrezioneFattura(fattura) {
    const nomeCorrente = fattura.split('/')[0]; // Nome cartella
    const nomeCorretto = prompt(
        `📝 Correzione Nome Fornitore\n\n` +
        `Nome attuale: ${nomeCorrente}\n\n` +
        `Inserisci il nome CORRETTO del fornitore:`,
        nomeCorrente
    );
    
    if (nomeCorretto && nomeCorretto !== nomeCorrente) {
        return nomeCorretto.trim();
    }
    return null;
}

// Aggiungi alla visualizzazione fatture
function renderizzaFattureConCorrezione() {
    // Questa funzione verrà integrata nella lista fatture esistente
    // per permettere la correzione al volo
}
