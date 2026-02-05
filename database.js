const { MongoClient } = require('mongodb');

// Connection string MongoDB Atlas - CONFIGURARE SU RENDER!
const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'haccp_db';

let client = null;
let db = null;

// Connessione al database
async function connetti() {
    if (db) return db;
    
    if (!MONGODB_URI) {
        console.warn('⚠️ MONGODB_URI non configurato - database cloud disabilitato');
        return null;
    }
    
    try {
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        db = client.db(DB_NAME);
        console.log('✅ Connesso a MongoDB Atlas');
        return db;
    } catch (error) {
        console.error('❌ Errore connessione MongoDB:', error.message);
        return null;
    }
}

// Chiudi connessione
async function disconnetti() {
    if (client) {
        await client.close();
        client = null;
        db = null;
        console.log('🔌 Disconnesso da MongoDB');
    }
}

// Salva dati utente
async function salvaDatiUtente(username, dati) {
    const database = await connetti();
    if (!database) return { success: false, error: 'Database non disponibile' };
    
    try {
        const collection = database.collection('user_data');
        
        const documento = {
            username: username.toLowerCase(),
            dati: dati,
            ultimoAggiornamento: new Date()
        };
        
        await collection.replaceOne(
            { username: username.toLowerCase() },
            documento,
            { upsert: true }
        );
        
        return { success: true, timestamp: documento.ultimoAggiornamento };
    } catch (error) {
        console.error('❌ Errore salvataggio dati:', error);
        return { success: false, error: error.message };
    }
}

// Carica dati utente
async function caricaDatiUtente(username) {
    const database = await connetti();
    if (!database) return { success: false, error: 'Database non disponibile' };
    
    try {
        const collection = database.collection('user_data');
        const documento = await collection.findOne({ username: username.toLowerCase() });
        
        if (!documento) {
            return { success: true, dati: null, nuovoUtente: true };
        }
        
        return { 
            success: true, 
            dati: documento.dati,
            ultimoAggiornamento: documento.ultimoAggiornamento
        };
    } catch (error) {
        console.error('❌ Errore caricamento dati:', error);
        return { success: false, error: error.message };
    }
}

// Verifica credenziali utente (semplice - nessun hash per ora)
async function verificaUtente(username, password) {
    const database = await connetti();
    if (!database) return { success: false, error: 'Database non disponibile' };
    
    try {
        const collection = database.collection('users');
        const utente = await collection.findOne({ 
            username: username.toLowerCase()
        });
        
        if (!utente) {
            return { success: false, error: 'Utente non trovato' };
        }
        
        // SEMPLICE confronto password (per ora) - TODO: hash in futuro
        if (utente.password !== password) {
            return { success: false, error: 'Password errata' };
        }
        
        return { success: true, username: utente.username };
    } catch (error) {
        console.error('❌ Errore verifica utente:', error);
        return { success: false, error: error.message };
    }
}

// Registra nuovo utente
async function registraUtente(username, password, email = '') {
    const database = await connetti();
    if (!database) return { success: false, error: 'Database non disponibile' };
    
    try {
        const collection = database.collection('users');
        
        // Verifica se esiste già
        const esistente = await collection.findOne({ 
            username: username.toLowerCase() 
        });
        
        if (esistente) {
            return { success: false, error: 'Username già esistente' };
        }
        
        // Crea nuovo utente
        const nuovoUtente = {
            username: username.toLowerCase(),
            password: password, // TODO: hash in futuro
            email: email,
            dataRegistrazione: new Date(),
            attivo: true
        };
        
        await collection.insertOne(nuovoUtente);
        
        console.log(`✅ Nuovo utente registrato: ${username}`);
        return { success: true, username: nuovoUtente.username };
    } catch (error) {
        console.error('❌ Errore registrazione utente:', error);
        return { success: false, error: error.message };
    }
}

// Esporta funzioni
module.exports = {
    connetti,
    disconnetti,
    salvaDatiUtente,
    caricaDatiUtente,
    verificaUtente,
    registraUtente
};
