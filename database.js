const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'haccp_db';
const STORAGE_MODE = process.env.STORAGE_MODE || '';
const USE_MONGO = Boolean(MONGODB_URI) && STORAGE_MODE !== 'sqlite';

const SQLITE_PATH = process.env.SQLITE_PATH || path.join(__dirname, 'data', 'haccp.sqlite');

let mongoClient = null;
let mongoDb = null;
let sqliteDb = null;

function ensureSqliteDir() {
    const dir = path.dirname(SQLITE_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function ensureSqlite() {
    if (sqliteDb) return sqliteDb;
    ensureSqliteDir();
    const Database = require('better-sqlite3');
    sqliteDb = new Database(SQLITE_PATH);
    sqliteDb.pragma('journal_mode = WAL');
    sqliteDb.exec(`
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            password TEXT NOT NULL,
            email TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            active INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS user_data (
            username TEXT PRIMARY KEY,
            dati TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
    `);
    return sqliteDb;
}

async function connetti() {
    if (USE_MONGO) {
        if (mongoDb) return mongoDb;
        try {
            mongoClient = new MongoClient(MONGODB_URI);
            await mongoClient.connect();
            mongoDb = mongoClient.db(DB_NAME);
            console.log('✅ Connesso a MongoDB Atlas');
            return mongoDb;
        } catch (error) {
            console.error('❌ Errore connessione MongoDB:', error.message);
            return null;
        }
    }

    try {
        return ensureSqlite();
    } catch (error) {
        console.error('❌ Errore connessione SQLite:', error.message);
        return null;
    }
}

async function disconnetti() {
    if (mongoClient) {
        await mongoClient.close();
        mongoClient = null;
        mongoDb = null;
        console.log('🔌 Disconnesso da MongoDB');
    }

    if (sqliteDb) {
        sqliteDb.close();
        sqliteDb = null;
        console.log('🔌 Disconnesso da SQLite');
    }
}

async function salvaDatiUtente(username, dati) {
    const database = await connetti();
    if (!database) return { success: false, error: 'Database non disponibile' };

    const user = (username || '').toLowerCase();
    const payload = JSON.stringify(dati || {});
    const timestamp = new Date().toISOString();

    if (USE_MONGO) {
        try {
            const collection = database.collection('user_data');
            const documento = {
                username: user,
                dati,
                ultimoAggiornamento: new Date()
            };
            await collection.replaceOne(
                { username: user },
                documento,
                { upsert: true }
            );
            return { success: true, timestamp: documento.ultimoAggiornamento };
        } catch (error) {
            console.error('❌ Errore salvataggio dati:', error);
            return { success: false, error: error.message };
        }
    }

    try {
        const stmt = database.prepare(`
            INSERT INTO user_data (username, dati, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(username) DO UPDATE SET
                dati = excluded.dati,
                updated_at = excluded.updated_at
        `);
        stmt.run(user, payload, timestamp);
        return { success: true, timestamp };
    } catch (error) {
        console.error('❌ Errore salvataggio dati SQLite:', error);
        return { success: false, error: error.message };
    }
}

async function caricaDatiUtente(username) {
    const database = await connetti();
    if (!database) return { success: false, error: 'Database non disponibile' };

    const user = (username || '').toLowerCase();

    if (USE_MONGO) {
        try {
            const collection = database.collection('user_data');
            const documento = await collection.findOne({ username: user });
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

    try {
        const row = database.prepare('SELECT dati, updated_at FROM user_data WHERE username = ?').get(user);
        if (!row) {
            return { success: true, dati: null, nuovoUtente: true };
        }
        let parsed = null;
        try {
            parsed = JSON.parse(row.dati);
        } catch (err) {
            parsed = row.dati;
        }
        return {
            success: true,
            dati: parsed,
            ultimoAggiornamento: row.updated_at
        };
    } catch (error) {
        console.error('❌ Errore caricamento dati SQLite:', error);
        return { success: false, error: error.message };
    }
}

async function verificaUtente(username, password) {
    const database = await connetti();
    if (!database) return { success: false, error: 'Database non disponibile' };

    const user = (username || '').toLowerCase();

    if (USE_MONGO) {
        try {
            const collection = database.collection('users');
            const utente = await collection.findOne({ username: user });
            if (!utente) return { success: false, error: 'Utente non trovato' };

            const hashed = utente.password || '';
            const isHashed = typeof hashed === 'string' && hashed.startsWith('$2');
            if (isHashed) {
                const ok = await bcrypt.compare(password, hashed);
                if (!ok) return { success: false, error: 'Password errata' };
            } else {
                if (utente.password !== password) return { success: false, error: 'Password errata' };
                const nuovoHash = await bcrypt.hash(password, 10);
                await collection.updateOne(
                    { username: user },
                    { $set: { password: nuovoHash } }
                );
            }

            return { success: true, username: utente.username };
        } catch (error) {
            console.error('❌ Errore verifica utente:', error);
            return { success: false, error: error.message };
        }
    }

    try {
        const row = database.prepare('SELECT username, password FROM users WHERE username = ?').get(user);
        if (!row) return { success: false, error: 'Utente non trovato' };

        const hashed = row.password || '';
        const isHashed = typeof hashed === 'string' && hashed.startsWith('$2');
        if (isHashed) {
            const ok = await bcrypt.compare(password, hashed);
            if (!ok) return { success: false, error: 'Password errata' };
        } else {
            if (hashed !== password) return { success: false, error: 'Password errata' };
            const nuovoHash = await bcrypt.hash(password, 10);
            database.prepare('UPDATE users SET password = ? WHERE username = ?').run(nuovoHash, user);
        }

        return { success: true, username: row.username };
    } catch (error) {
        console.error('❌ Errore verifica utente SQLite:', error);
        return { success: false, error: error.message };
    }
}

async function registraUtente(username, password, email = '') {
    const database = await connetti();
    if (!database) return { success: false, error: 'Database non disponibile' };

    const user = (username || '').toLowerCase();
    const passHash = await bcrypt.hash(password, 10);
    const createdAt = new Date().toISOString();

    if (USE_MONGO) {
        try {
            const collection = database.collection('users');
            const esistente = await collection.findOne({ username: user });
            if (esistente) return { success: false, error: 'Username già esistente' };

            const nuovoUtente = {
                username: user,
                password: passHash,
                email,
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

    try {
        const esistente = database.prepare('SELECT username FROM users WHERE username = ?').get(user);
        if (esistente) return { success: false, error: 'Username già esistente' };

        database.prepare(
            'INSERT INTO users (username, password, email, created_at, active) VALUES (?, ?, ?, ?, 1)'
        ).run(user, passHash, email, createdAt);

        console.log(`✅ Nuovo utente registrato: ${username}`);
        return { success: true, username: user };
    } catch (error) {
        console.error('❌ Errore registrazione utente SQLite:', error);
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
