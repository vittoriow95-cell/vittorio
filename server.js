const http = require('http');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const xml2js = require('xml2js');
const pdf = require('pdf-parse');
const { createWorker } = require('tesseract.js');
const database = require('./database');

// Database fornitori per mappatura intelligente
const DB_FORNITORI_PATH = path.join(__dirname, 'fornitori_db.json');

// Carica database fornitori (crea se non esiste)
function caricaDatabaseFornitori() {
    if (!fs.existsSync(DB_FORNITORI_PATH)) {
        fs.writeFileSync(DB_FORNITORI_PATH, JSON.stringify({ mappature: {} }, null, 2));
    }
    return JSON.parse(fs.readFileSync(DB_FORNITORI_PATH, 'utf8'));
}

// Salva database fornitori
function salvaDatabaseFornitori(db) {
    fs.writeFileSync(DB_FORNITORI_PATH, JSON.stringify(db, null, 2));
}

const PORT = process.env.PORT || 5000;
const PRINT_AGENT_URL = process.env.PRINT_AGENT_URL || '';
const PRINT_AGENT_TOKEN = process.env.PRINT_AGENT_TOKEN || '';
const NOME_STAMPANTE = '4BARCODE 4B-2054L(BT)';
const TEMPLATE_BARTENDER = path.join(__dirname, 'etichetta_haccp.btw');
const FOTO_LOTTI_DIR = path.join(__dirname, 'foto-lotti');
const FOTO_INGREDIENTI_DIR = path.join(__dirname, 'foto-ingredienti');

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

ensureDir(FOTO_LOTTI_DIR);
ensureDir(FOTO_INGREDIENTI_DIR);

function postJson(urlStr, data, token) {
    return new Promise((resolve, reject) => {
        const { URL } = require('url');
        const urlObj = new URL(urlStr);
        const isHttps = urlObj.protocol === 'https:';
        const lib = isHttps ? require('https') : require('http');
        const payload = JSON.stringify(data || {});

        const headers = {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        };

        if (token) {
            headers['x-print-token'] = token;
        }

        const req = lib.request(
            {
                hostname: urlObj.hostname,
                port: urlObj.port || (isHttps ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: 'POST',
                headers
            },
            (res) => {
                let body = '';
                res.on('data', (chunk) => (body += chunk));
                res.on('end', () => {
                    resolve({ status: res.statusCode || 500, body });
                });
            }
        );

        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

// Mittenti importanti da monitorare
const MITTENTI_PRIORITARI = [
    // Agenzia delle Entrate
    { pattern: /@agenziaentrate\.it$/i, nome: 'Agenzia delle Entrate', priorita: 'CRITICA' },
    { pattern: /@pec\.agenziaentrate\.it$/i, nome: 'Agenzia delle Entrate PEC', priorita: 'CRITICA' },
    
    // INPS
    { pattern: /@inps\.it$/i, nome: 'INPS', priorita: 'CRITICA' },
    { pattern: /@postacert\.inps\.gov\.it$/i, nome: 'INPS PEC', priorita: 'CRITICA' },
    
    // Guardia di Finanza
    { pattern: /@gdf\.it$/i, nome: 'Guardia di Finanza', priorita: 'CRITICA' },
    { pattern: /@pec\.gdf\.it$/i, nome: 'Guardia di Finanza PEC', priorita: 'CRITICA' },
    
    // Comuni e Provincia
    { pattern: /@comune\./i, nome: 'Comune', priorita: 'ALTA' },
    { pattern: /@provincia\./i, nome: 'Provincia', priorita: 'ALTA' },
    
    // ASL / ATS
    { pattern: /@asl\./i, nome: 'ASL', priorita: 'ALTA' },
    { pattern: /@ats\./i, nome: 'ATS', priorita: 'ALTA' },
    
    // Camera di Commercio
    { pattern: /@camcom\./i, nome: 'Camera di Commercio', priorita: 'ALTA' },
    { pattern: /@unioncamere\./i, nome: 'Unioncamere', priorita: 'ALTA' },
    
    // Equitalia / Agenzia Entrate Riscossione
    { pattern: /@agenziaentrateriscossione\.gov\.it$/i, nome: 'Agenzia Riscossione', priorita: 'CRITICA' },
    
    // Tribunale
    { pattern: /@giustizia\.it$/i, nome: 'Tribunale/Giustizia', priorita: 'CRITICA' },
    
    // Banche (avvisi di pagamento)
    { pattern: /@intesasanpaolo\./i, nome: 'Intesa Sanpaolo', priorita: 'MEDIA' },
    { pattern: /@unicredit\./i, nome: 'Unicredit', priorita: 'MEDIA' },
    { pattern: /@bancobpm\./i, nome: 'Banco BPM', priorita: 'MEDIA' },
];

// Parole chiave che indicano urgenza
const PAROLE_URGENZA = [
    'multa', 'sanzione', 'sollecito', 'intimazione', 'pagamento', 'scadenza',
    'cartella esattoriale', 'avviso di accertamento', 'ispezione', 'verifica',
    'citazione', 'decreto ingiuntivo', 'pignoramento', 'fermo amministrativo',
    'tributi', 'tassa', 'contributi', 'mora', 'penale'
];

const server = http.createServer((req, res) => {
    // CORS headers CORRETTI
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Servi file app
    if (req.url === '/' || req.url === '/index.html') {
        fs.readFile('index.html', (err, data) => {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    } else if (req.url === '/style.css') {
        fs.readFile('style.css', (err, data) => {
            res.writeHead(200, { 'Content-Type': 'text/css' });
            res.end(data);
        });
    } else if (req.url === '/app.js') {
        fs.readFile('app.js', (err, data) => {
            res.writeHead(200, { 'Content-Type': 'application/javascript' });
            res.end(data);
        });
    } else if (req.url === '/sync-cloud.js') {
        fs.readFile('sync-cloud.js', (err, data) => {
            res.writeHead(200, { 'Content-Type': 'application/javascript' });
            res.end(data);
        });
    } 
    // Servi file dalla cartella assets
    else if (req.url.startsWith('/assets/')) {
        const filePath = path.join(__dirname, req.url);
        const ext = path.extname(filePath).toLowerCase();
        
        const mimeTypes = {
            '.svg': 'image/svg+xml',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif'
        };
        
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('File non trovato');
                return;
            }
            res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
            res.end(data);
        });
    }
    // Servi foto lotti e ingredienti
    else if (req.url.startsWith('/foto-lotti/') || req.url.startsWith('/foto-ingredienti/')) {
        const filePath = path.join(__dirname, req.url);
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp'
        };
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('File non trovato');
                return;
            }
            res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
            res.end(data);
        });
    }
    // Endpoint stampa
    else if (req.url === '/stampa' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            const dati = JSON.parse(body);

            if (PRINT_AGENT_URL) {
                try {
                    const risposta = await postJson(PRINT_AGENT_URL, dati, PRINT_AGENT_TOKEN);
                    res.writeHead(risposta.status, { 'Content-Type': 'application/json' });
                    res.end(risposta.body || JSON.stringify({ success: false, message: 'Nessuna risposta agente' }));
                } catch (err) {
                    console.error('❌ Errore inoltro stampa:', err.message);
                    res.writeHead(502, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Errore inoltro stampa', error: err.message }));
                }
                return;
            }
            
            console.log('\n📦 STAMPA RICHIESTA:');
            console.log('Prodotto:', dati.prodotto);
            console.log('Lotto:', dati.lottoOrigine);
            
            // Leggi configurazione (se inviata dal client)
            const config = dati.config || {
                larghezza: 40,
                altezza: 30,
                mostraTitolo: true,
                mostraProdotto: true,
                mostraLotto: true,
                mostraProduzione: true,
                mostraScadenza: true,
                sizeTitolo: 3,
                sizeCampi: 2
            };
            
            // STAMPA DIRETTA SU COM3 con configurazione
            let comandiStampante = '';
            comandiStampante += `SIZE ${config.larghezza} mm, ${config.altezza} mm\r\n`;
            comandiStampante += 'GAP 2 mm, 0 mm\r\n';
            comandiStampante += 'DIRECTION 1\r\n';
            comandiStampante += 'CLS\r\n';
            
            let y = 20;
            const fontTitolo = config.fontTitolo || '3';
            const fontCampi = config.fontCampi || '2';
            
            if (config.mostraTitolo) {
                comandiStampante += `TEXT 50,${y},"${fontTitolo}",0,1,1,"ETICHETTA HACCP"\r\n`;
                y += 40;
            }
            
            if (config.mostraProdotto) {
                comandiStampante += `TEXT 10,${y},"${fontCampi}",0,1,1,"Prodotto: ${dati.prodotto}"\r\n`;
                y += 30;
            }
            
            if (config.mostraLotto) {
                comandiStampante += `TEXT 10,${y},"${fontCampi}",0,1,1,"Lotto: ${dati.lottoOrigine}"\r\n`;
                y += 30;
            }
            
            if (config.mostraProduzione) {
                comandiStampante += `TEXT 10,${y},"${fontCampi}",0,1,1,"Prod: ${dati.dataProduzione}"\r\n`;
                y += 30;
            }
            
            if (config.mostraScadenza) {
                comandiStampante += `TEXT 10,${y},"${fontCampi}",0,1,1,"Scad: ${dati.scadenza || dati.dataScadenza}"\r\n`;
            }
            
            // Numero copie
            const copie = parseInt(dati.copie) || 1;
            comandiStampante += `PRINT ${copie}\r\n`;
            
            console.log(`🖨️ Stampa ${copie} ${copie === 1 ? 'copia' : 'copie'}`);
            
            // Salva file temporaneo
            const percorsoPRN = path.join(__dirname, 'etichetta_temp.prn');
            fs.writeFileSync(percorsoPRN, comandiStampante, 'ascii');
            
            // Verifica che il file sia stato creato
            if (!fs.existsSync(percorsoPRN)) {
                throw new Error('Impossibile creare file di stampa');
            }
            
            console.log('🖨️ Invio a COM3...');
            
            // Stampa su COM3 in background (non aspettare)
            const batPath = path.join(__dirname, 'stampa_com3.bat');
            exec(`"${batPath}"`, (error) => {
                if (error) {
                    console.error('⚠️ Errore stampa:', error.message);
                }
            });
            console.log('✅ Stampato!');
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, metodo: 'stampa_diretta' }));
        });
    }
    // Endpoint PEC - Scansione fatture
    else if (req.url === '/pec-scan' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { accounts } = JSON.parse(body);
                console.log('📥 Avvio scansione PEC per', accounts.length, 'account(s)');
                
                if (!accounts || accounts.length === 0) {
                    throw new Error('Nessun account PEC configurato');
                }
                
                // Validazione account
                for (const account of accounts) {
                    if (!account.cartella) {
                        throw new Error(`Account ${account.email}: cartella di salvataggio non configurata`);
                    }
                    if (!account.host) {
                        throw new Error(`Account ${account.email}: server IMAP non testato. Clicca TEST prima di scansionare.`);
                    }
                }
                
                const risultati = [];
                
                for (const account of accounts) {
                    console.log('  📧 Scansione:', account.email);
                    try {
                        const risultato = await scanPEC(account);
                        risultati.push(risultato);
                    } catch (err) {
                        console.error(`❌ Errore su ${account.email}:`, err.message);
                        risultati.push({
                            email: account.email,
                            processate: 0,
                            errori: [err.message],
                            message: 'ERRORE: ' + err.message
                        });
                    }
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, risultati }));
            } catch (error) {
                console.error('❌ Errore scansione PEC:', error.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
    }
    // Test connessione PEC
    else if (req.url === '/pec-test' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const account = JSON.parse(body);
                console.log('📧 Test PEC per:', account.email);
                
                if (!account.email || !account.password) {
                    throw new Error('Email o password mancanti');
                }
                
                const result = await testPECConnection(account);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (error) {
                console.error('❌ Errore test PEC:', error.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
    }
    
    // Lista fatture salvate
    else if (req.url === '/lista-fatture' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { cartelle } = JSON.parse(body);
                const fatture = [];
                
                cartelle.forEach(cartella => {
                    if (fs.existsSync(cartella)) {
                        const fornitori = fs.readdirSync(cartella);
                        fornitori.forEach(fornitore => {
                            const percorsoFornitore = path.join(cartella, fornitore);
                            if (fs.statSync(percorsoFornitore).isDirectory()) {
                                const files = fs.readdirSync(percorsoFornitore);
                                files.forEach(file => {
                                    const percorsoCompleto = path.join(percorsoFornitore, file);
                                    const stats = fs.statSync(percorsoCompleto);
                                    fatture.push({
                                        nome: file,
                                        fornitore: fornitore,
                                        percorso: percorsoCompleto,
                                        dimensione: stats.size,
                                        dataModifica: stats.mtime
                                    });
                                });
                            }
                        });
                    }
                });
                
                // Ordina per data più recente
                fatture.sort((a, b) => b.dataModifica - a.dataModifica);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, fatture }));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
    }
    
    // Rinomina cartella fornitore
    else if (req.url === '/correggi-fornitore' && req.method === 'POST') {
        gestisciCorrezioneFornitore(req, res);
    }
    
    // Lista cartelle fornitori
    else if (req.url.startsWith('/lista-cartelle')) {
        gestisciListaCartelle(req, res);
    }
    
    // Salva correzione fornitore nel database
    else if (req.url === '/salva-correzione-fornitore' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { nomeOriginale, nomeCorretto } = JSON.parse(body);
                const dbFornitori = caricaDatabaseFornitori();
                
                dbFornitori.mappature[nomeOriginale] = nomeCorretto;
                salvaDatabaseFornitori(dbFornitori);
                
                console.log(`✅ Mappatura salvata: "${nomeOriginale}" → "${nomeCorretto}"`);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ successo: true, messaggio: 'Mappatura salvata' }));
            } catch (e) {
                console.error('❌ Errore salvataggio mappatura:', e);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ errore: e.message }));
            }
        });
    }
    
    // Analizza fatture per OCR
    else if (req.url === '/analizza-ocr' && req.method === 'POST') {
        gestisciAnalisiOCR(req, res);
    }
    
    // Riorganizza fatture esistenti con nomi intelligenti
    else if (req.url === '/riorganizza-fatture' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { cartella } = JSON.parse(body);
                console.log('🔄 Avvio riorganizzazione fatture in:', cartella);
                
                if (!fs.existsSync(cartella)) {
                    throw new Error('Cartella non trovata');
                }
                
                let totaleProcessate = 0;
                let totaleRinominate = 0;
                let errori = [];
                
                // Funzione ricorsiva per trovare tutti i PDF
                const trovaTuttiPDF = (dir) => {
                    const files = fs.readdirSync(dir);
                    let pdfs = [];
                    
                    for (const file of files) {
                        const percorsoCompleto = path.join(dir, file);
                        const stat = fs.statSync(percorsoCompleto);
                        
                        if (stat.isDirectory()) {
                            // Ricorsione nelle sottocartelle
                            pdfs = pdfs.concat(trovaTuttiPDF(percorsoCompleto));
                        } else if (file.toLowerCase().endsWith('.pdf')) {
                            pdfs.push(percorsoCompleto);
                        }
                    }
                    return pdfs;
                };
                
                const tuttiPDF = trovaTuttiPDF(cartella);
                console.log(`📊 Trovati ${tuttiPDF.length} PDF da riorganizzare`);
                
                for (const percorsoPDF of tuttiPDF) {
                    try {
                        totaleProcessate++;
                        const buffer = fs.readFileSync(percorsoPDF);
                        
                        // Analizza PDF con sistema intelligente
                        const pdfData = await pdf(buffer);
                        const testo = pdfData.text;
                        
                        let nomeFornitore = 'SCONOSCIUTO';
                        let dataEmissione = null;
                        let numeroFattura = null;
                        
                        // Usa le stesse strategie di estrazione
                        let match = testo.match(/Cedente[\s\/]*Prestatore[\s\n:]*([A-Z][A-Za-zÀ-ÿ\s\.\,&'\-]{3,70}?)[\s\n]/i);
                        
                        if (!match) {
                            match = testo.match(/(?:Denominazione|Ragione\s*Sociale)[\s\n:]*([A-Z][A-Za-zÀ-ÿ\s\.\,&'\-]{3,70}?)[\s\n]/i);
                        }
                        
                        if (!match) {
                            const righe = testo.split('\n');
                            for (let i = 0; i < righe.length; i++) {
                                if (righe[i].match(/(?:P\.?\s*IVA|Partita\s*IVA)[\s:]*\d{11}/i)) {
                                    for (let j = Math.max(0, i - 3); j < i; j++) {
                                        const rigaPulita = righe[j].trim();
                                        if (rigaPulita.length >= 3 && rigaPulita.length <= 70 && 
                                            rigaPulita.match(/^[A-Z][A-Za-zÀ-ÿ\s\.\,&'\-]+$/) &&
                                            !rigaPulita.match(/^(?:Via|Viale|Piazza|Corso|CAP|Tel|Email|PEC)/i)) {
                                            match = [null, rigaPulita];
                                            break;
                                        }
                                    }
                                    if (match) break;
                                }
                            }
                        }
                        
                        if (match && match[1]) {
                            nomeFornitore = match[1].trim()
                                .replace(/\s+/g, '_')
                                .replace(/[<>:"/\\|?*\.]/g, '')
                                .replace(/_{2,}/g, '_')
                                .replace(/^_|_$/g, '')
                                .substring(0, 50);
                        }
                        
                        // Estrai data
                        let matchData = testo.match(/(?:Data\s*(?:Emissione|Fattura|Documento)?|Emissione|Del)[\s\n:]*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/i);
                        if (matchData) {
                            const giorno = matchData[1].padStart(2, '0');
                            const mese = matchData[2].padStart(2, '0');
                            const anno = matchData[3];
                            dataEmissione = `${anno}-${mese}-${giorno}`;
                        }
                        
                        // Estrai numero fattura
                        let matchNumero = testo.match(/(?:Fattura\s*(?:N|Numero|n°|num)?|N°?\s*Fattura|Numero\s*Documento)[\s\n:]*([A-Z0-9\/\-]{1,25})/i);
                        if (matchNumero && matchNumero[1]) {
                            numeroFattura = matchNumero[1].trim().replace(/[<>:"/\\|?*]/g, '_').substring(0, 20);
                        }
                        
                        // Crea nuova cartella fornitore
                        const nuovaCartellaFornitore = path.join(cartella, nomeFornitore);
                        if (!fs.existsSync(nuovaCartellaFornitore)) {
                            fs.mkdirSync(nuovaCartellaFornitore, { recursive: true });
                        }
                        
                        // Crea nuovo nome file
                        let parti = [];
                        if (dataEmissione) parti.push(dataEmissione);
                        parti.push(nomeFornitore);
                        if (numeroFattura) parti.push('N' + numeroFattura);
                        
                        const nuovoNome = parti.join('_') + '.pdf';
                        const nuovoPercorso = path.join(nuovaCartellaFornitore, nuovoNome);
                        
                        // Sposta/rinomina file
                        if (percorsoPDF !== nuovoPercorso) {
                            // Se esiste già, aggiungi timestamp
                            let percorsoFinale = nuovoPercorso;
                            if (fs.existsSync(percorsoFinale)) {
                                const timestamp = Date.now().toString().slice(-6);
                                percorsoFinale = path.join(nuovaCartellaFornitore, `${parti.join('_')}_${timestamp}.pdf`);
                            }
                            
                            fs.renameSync(percorsoPDF, percorsoFinale);
                            totaleRinominate++;
                            console.log(`✅ Rinominato: ${path.basename(percorsoPDF)} → ${nomeFornitore}/${path.basename(percorsoFinale)}`);
                        }
                        
                    } catch (e) {
                        errori.push(`${path.basename(percorsoPDF)}: ${e.message}`);
                        console.error(`❌ Errore su ${path.basename(percorsoPDF)}:`, e.message);
                    }
                }
                
                // Rimuovi cartelle vuote
                const rimuoviCartelleVuote = (dir) => {
                    const files = fs.readdirSync(dir);
                    for (const file of files) {
                        const percorso = path.join(dir, file);
                        if (fs.statSync(percorso).isDirectory()) {
                            rimuoviCartelleVuote(percorso);
                            if (fs.readdirSync(percorso).length === 0) {
                                fs.rmdirSync(percorso);
                                console.log(`🗑️ Rimossa cartella vuota: ${file}`);
                            }
                        }
                    }
                };
                
                rimuoviCartelleVuote(cartella);
                
                console.log(`✅ Riorganizzazione completata: ${totaleRinominate}/${totaleProcessate} file rinominati`);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true, 
                    processate: totaleProcessate,
                    rinominate: totaleRinominate,
                    errori: errori
                }));
                
            } catch (error) {
                console.error('❌ Errore riorganizzazione:', error.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
    }
    
    // Test connessione server
    else if (req.url === '/test' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, status: 'online', timestamp: new Date().toISOString() }));
    }
    
    // Seleziona cartella con dialog
    else if (req.url === '/seleziona-cartella' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { titolo } = JSON.parse(body);
                
                // Usa PowerShell per aprire dialog di selezione cartella
                const script = `
                    Add-Type -AssemblyName System.Windows.Forms
                    $folderBrowser = New-Object System.Windows.Forms.FolderBrowserDialog
                    $folderBrowser.Description = "${titolo || 'Seleziona cartella'}"
                    $folderBrowser.SelectedPath = "C:\\"
                    $result = $folderBrowser.ShowDialog()
                    if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
                        Write-Output $folderBrowser.SelectedPath
                    }
                `;
                
                exec(`powershell -Command "${script.replace(/"/g, '\\"')}"`, (error, stdout, stderr) => {
                    if (error || !stdout.trim()) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, cartella: null }));
                        return;
                    }
                    
                    const cartella = stdout.trim();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, cartella }));
                });
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
    }
    
    // Apri cartella in Esplora Risorse
    else if (req.url === '/apri-cartella' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { percorso } = JSON.parse(body);
                const cartella = path.dirname(percorso);
                require('child_process').exec(`explorer "${cartella}"`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
    }
    
    // ========== API DATABASE CLOUD ==========

    // Upload foto lotti/ingredienti
    else if (req.url === '/api/upload-foto' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { tipo, dataUrl } = JSON.parse(body || '{}');

                if (!dataUrl || !tipo) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Dati mancanti' }));
                    return;
                }

                const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
                if (!match) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Formato immagine non valido' }));
                    return;
                }

                const mime = match[1];
                const base64Data = match[2];
                const buffer = Buffer.from(base64Data, 'base64');

                if (buffer.length > 5 * 1024 * 1024) {
                    res.writeHead(413, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Immagine troppo grande' }));
                    return;
                }

                const ext = mime.split('/')[1] || 'png';
                const nomeFile = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
                const dir = tipo === 'ingrediente' ? FOTO_INGREDIENTI_DIR : FOTO_LOTTI_DIR;
                const urlBase = tipo === 'ingrediente' ? '/foto-ingredienti/' : '/foto-lotti/';
                const filePath = path.join(dir, nomeFile);

                fs.writeFileSync(filePath, buffer);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, url: urlBase + nomeFile }));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
    }
    
    // Login utente
    else if (req.url === '/api/login' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { username, password } = JSON.parse(body);
                
                if (!username || !password) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Username e password richiesti' }));
                    return;
                }
                
                const risultato = await database.verificaUtente(username, password);
                
                res.writeHead(risultato.success ? 200 : 401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(risultato));
            } catch (error) {
                console.error('❌ Errore login:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
    }
    
    // Registrazione nuovo utente
    else if (req.url === '/api/register' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { username, password, email } = JSON.parse(body);
                
                if (!username || !password) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Username e password richiesti' }));
                    return;
                }
                
                const risultato = await database.registraUtente(username, password, email);
                
                res.writeHead(risultato.success ? 200 : 400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(risultato));
            } catch (error) {
                console.error('❌ Errore registrazione:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
    }
    
    // Salva dati utente
    else if (req.url === '/api/save-data' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { username, dati } = JSON.parse(body);
                
                if (!username || !dati) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Username e dati richiesti' }));
                    return;
                }
                
                const risultato = await database.salvaDatiUtente(username, dati);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(risultato));
            } catch (error) {
                console.error('❌ Errore salvataggio dati:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
    }
    
    // Carica dati utente
    else if (req.url === '/api/load-data' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { username } = JSON.parse(body);
                
                if (!username) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Username richiesto' }));
                    return;
                }
                
                const risultato = await database.caricaDatiUtente(username);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(risultato));
            } catch (error) {
                console.error('❌ Errore caricamento dati:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
    }
    
    else {
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(PORT, async () => {
    console.log('\n🚀 SERVER AVVIATO');
    console.log('🌐 http://localhost:' + PORT);
    console.log('🖨️ Stampante:', NOME_STAMPANTE);
    console.log('📧 Gestione PEC: Attiva');
    
    // Test connessione MongoDB all'avvio
    try {
        await database.connetti();
    } catch (err) {
        console.warn('⚠️ MongoDB non disponibile all\'avvio:', err.message);
    }
    
    console.log('');
});

// Gestione errori globale per evitare crash
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`\n❌ ERRORE: Porta ${PORT} già in uso!`);
        console.error('💡 Esegui PULISCI_PORTE.bat per liberare la porta\n');
        process.exit(1);
    } else {
        console.error('\n❌ Errore server:', error.message, '\n');
    }
});

process.on('uncaughtException', (error) => {
    console.error('\n⚠️ Errore non gestito:', error.message);
    console.error('Stack:', error.stack);
    console.error('Il server continua a funzionare...\n');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('\n⚠️ Promise rifiutata:', reason);
    console.error('Il server continua a funzionare...\n');
});

// ========== FUNZIONI PEC ==========

// Lista server da provare automaticamente
const SERVER_PEC_DA_PROVARE = [
    'imaps.pec.aruba.it',
    'imaps.aruba.it',
    'imap.pec.aruba.it',
    'imap.aruba.it',
    'mail.pec.aruba.it'
];

async function testPECConnection(account) {
    // Se l'account ha già un host configurato, usa quello
    if (account.host) {
        return testSingoloServer(account, account.host);
    }
    
    // Altrimenti prova automaticamente i server fino a trovare quello giusto
    console.log('🔍 Rilevamento automatico server per:', account.email);
    
    for (const host of SERVER_PEC_DA_PROVARE) {
        console.log('  ⚙️ Provo:', host);
        try {
            const result = await testSingoloServer(account, host);
            if (result.success) {
                console.log('  ✅ Server trovato:', host);
                // Salva il server funzionante nell'account
                return { success: true, message: 'Connessione OK', serverTrovato: host };
            }
        } catch (err) {
            console.log('  ❌ Fallito:', host);
            continue;
        }
    }
    
    throw new Error('Nessun server funzionante trovato. Verifica email e password.');
}

async function testSingoloServer(account, host) {
    return new Promise((resolve, reject) => {
        const imap = new Imap({
            user: account.email,
            password: account.password,
            host: host,
            port: 993,
            tls: true,
            tlsOptions: { 
                rejectUnauthorized: false,
                servername: host
            },
            authTimeout: 10000,
            connTimeout: 10000
        });

        imap.once('ready', () => {
            imap.end();
            resolve({ success: true, message: 'Connessione OK' });
        });

        imap.once('error', (err) => {
            reject(new Error('Errore connessione: ' + err.message));
        });

        imap.connect();
    });
}

async function scanPEC(account) {
    return new Promise((resolve, reject) => {
        const host = account.host || 'imaps.pec.aruba.it';
        const imap = new Imap({
            user: account.email,
            password: account.password,
            host: host,
            port: 993,
            tls: true,
            tlsOptions: { 
                rejectUnauthorized: false,
                servername: host
            },
            authTimeout: 15000,
            connTimeout: 15000
        });

        let fattureProcessate = 0;
        let errori = [];
        let emailImportanti = [];

        imap.once('ready', () => {
            imap.openBox('INBOX', false, (err, box) => {
                if (err) {
                    imap.end();
                    return reject(err);
                }

                // Cerca tutte le email degli ultimi 6 mesi
                const dataLimite = new Date();
                dataLimite.setMonth(dataLimite.getMonth() - 6);
                
                // Formato data per IMAP: 'DD-Mmm-YYYY'
                const mesi = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const giorno = String(dataLimite.getDate()).padStart(2, '0');
                const mese = mesi[dataLimite.getMonth()];
                const anno = dataLimite.getFullYear();
                const dataIMAPFormat = `${giorno}-${mese}-${anno}`;
                
                // Sintassi IMAP corretta: [['SINCE', 'data']]
                const criteriRicerca = [['SINCE', dataIMAPFormat]];
                
                console.log(`🔍 Ricerca email dal ${dataIMAPFormat}...`);
                
                imap.search(criteriRicerca, (err, results) => {
                    if (err) {
                        imap.end();
                        return reject(err);
                    }
                    
                    if (!results || results.length === 0) {
                        imap.end();
                        return resolve({ 
                            email: account.email, 
                            processate: 0, 
                            errori: [],
                            message: 'Nessuna email trovata' 
                        });
                    }
                    
                    console.log(`📧 Trovate ${results.length} email da analizzare (dal ${dataIMAPFormat})...`);

                    const f = imap.fetch(results, { bodies: '', markSeen: false });
                    
                    let emailAnalizzate = 0;
                    let pdfTrovati = 0;

                    f.on('message', (msg) => {
                        msg.on('body', (stream) => {
                            simpleParser(stream, async (err, parsed) => {
                                if (err) {
                                    errori.push('Errore parsing email: ' + err.message);
                                    return;
                                }
                                
                                emailAnalizzate++;

                                // Verifica se mittente è prioritario
                                const mittente = parsed.from?.text || parsed.from?.value?.[0]?.address || '';
                                const oggetto = parsed.subject || '';
                                const testoEmail = parsed.text || '';
                                
                                const mittenteImportante = verificaMittenteImportante(mittente, oggetto, testoEmail);
                                
                                if (mittenteImportante) {
                                    emailImportanti.push({
                                        mittente: mittente,
                                        oggetto: oggetto,
                                        data: parsed.date,
                                        priorita: mittenteImportante.priorita,
                                        fonte: mittenteImportante.nome,
                                        hasAllegati: parsed.attachments.length > 0
                                    });
                                    
                                    console.log(`🚨 EMAIL IMPORTANTE: ${mittenteImportante.nome} - ${oggetto.substring(0, 60)}`);
                                }
                                
                                // DEBUG: Log allegati trovati
                                if (parsed.attachments && parsed.attachments.length > 0) {
                                    console.log(`📎 Email da ${mittente.substring(0, 30)} ha ${parsed.attachments.length} allegati`);
                                    parsed.attachments.forEach(att => {
                                        console.log(`   - ${att.filename} (${att.contentType})`);
                                    });
                                }

                                // Cerca allegati fattura - PDF e EMAIL ANNIDATE (postacert.eml)
                                for (const att of parsed.attachments) {
                                    const filename = att.filename;
                                    
                                    // CASO 1: PDF diretti
                                    if (filename.match(/\.pdf$/i)) {
                                        pdfTrovati++;
                                        console.log(`📄 PDF #${pdfTrovati}: ${filename}`);
                                        try {
                                            const cartella = mittenteImportante 
                                                ? path.join(account.cartella, '_URGENTI', mittenteImportante.nome)
                                                : account.cartella;
                                            
                                            await salvaFattura(att, cartella, mittenteImportante, mittente);
                                            fattureProcessate++;
                                        } catch (e) {
                                            // Filtra errori "previsti" di PDF corrotto - non aggiungere a errori
                                            if (!e.message.includes('bad XRef')) {
                                                console.error(`❌ Errore PDF ${filename}: ${e.message.substring(0, 80)}`);
                                                errori.push(`${filename}: ${e.message.substring(0, 100)}`);
                                            } else {
                                                console.warn(`⚠️ PDF corrotto (${filename}), saltato automaticamente`);
                                            }
                                            // CONTINUA CON IL PROSSIMO FILE - NON BLOCCARE
                                        }
                                    }
                                    
                                    // CASO 2: Email PEC annidate (postacert.eml contiene fatture XML/PDF)
                                    else if (filename.match(/^postacert\.eml$/i) || att.contentType === 'message/rfc822') {
                                        try {
                                            console.log(`📨 Apertura email PEC annidata: ${filename}`);
                                            // Parsa l'email contenuta
                                            const emailAnnidata = await simpleParser(att.content);
                                            
                                            // Processa gli allegati dell'email annidata
                                            for (const subAtt of emailAnnidata.attachments) {
                                                const subFilename = subAtt.filename;
                                                
                                                try {
                                                    // PDF all'interno della PEC
                                                    if (subFilename.match(/\.pdf$/i)) {
                                                        pdfTrovati++;
                                                        console.log(`  📄 PDF trovato: ${subFilename}`);
                                                        await salvaFattura(subAtt, account.cartella, mittenteImportante, mittente);
                                                        fattureProcessate++;
                                                    }
                                                    // XML Fattura Elettronica
                                                    else if (subFilename.match(/\.xml$/i) && !subFilename.match(/daticert/i)) {
                                                        pdfTrovati++;
                                                        console.log(`  📄 XML Fattura: ${subFilename}`);
                                                        await salvaFatturaXML(subAtt, account.cartella, mittente);
                                                        fattureProcessate++;
                                                    }
                                                } catch (subErr) {
                                                    // Filtra errori "previsti" di PDF corrotto
                                                    if (!subErr.message.includes('bad XRef')) {
                                                        console.error(`  ⚠️ Errore processing ${subFilename}: ${subErr.message.substring(0, 60)}`);
                                                        errori.push(`${subFilename}: ${subErr.message.substring(0, 100)}`);
                                                    } else {
                                                        console.warn(`  ⚠️ PDF corrotto (${subFilename}), saltato`);
                                                    }
                                                    // Continua con il prossimo allegato
                                                }
                                            }
                                        } catch (e) {
                                            console.error(`⚠️ Errore apertura PEC annidata: ${e.message}`);
                                        }
                                    }
                                }
                            });
                        });
                    });

                    f.once('end', () => {
                        setTimeout(() => {
                            console.log(`✅ Analisi completata: ${emailAnalizzate} email, ${pdfTrovati} PDF trovati, ${fattureProcessate} fatture salvate`);
                            imap.end();
                            resolve({ 
                                email: account.email, 
                                processate: fattureProcessate, 
                                errori,
                                emailImportanti: emailImportanti,
                                message: `${fattureProcessate} fatture salvate${emailImportanti.length > 0 ? ` - ${emailImportanti.length} EMAIL URGENTI!` : ''}` 
                            });
                        }, 2000);
                    });
                });
            });
        });

        imap.once('error', (err) => {
            reject(new Error('Errore IMAP: ' + err.message));
        });

        imap.connect();
    });
}

// Verifica se il mittente è importante
function verificaMittenteImportante(mittente, oggetto, testo) {
    // Controlla mittente
    for (const m of MITTENTI_PRIORITARI) {
        if (m.pattern.test(mittente)) {
            return { nome: m.nome, priorita: m.priorita };
        }
    }
    
    // Controlla parole chiave nell'oggetto o testo
    const testoCompleto = (oggetto + ' ' + testo).toLowerCase();
    for (const parola of PAROLE_URGENZA) {
        if (testoCompleto.includes(parola.toLowerCase())) {
            return { nome: 'Comunicazione Urgente', priorita: 'ALTA' };
        }
    }
    
    return null;
}

// Funzione OCR IBRIDA: pdf-parse + Tesseract per PDF scansionati
async function estraiTestoConOCR(pdfBuffer, filename) {
    try {
        console.log(`🔍 Lettura PDF: "${filename}"...`);
        
        // TENTATIVO 1: Estrazione testo embedded (PDF digitali)
        let data, testoEmbedded;
        try {
            data = await pdf(pdfBuffer);
            testoEmbedded = data.text || '';
        } catch (pdfError) {
            // PDF corrotto o malformato
            if (pdfError.message.includes('bad XRef') || pdfError.message.includes('Invalid PDF')) {
                console.log(`⚠️ PDF corrotto (${pdfError.message.substring(0, 50)}), provo OCR...`);
                testoEmbedded = ''; // Forza OCR
            } else {
                throw pdfError; // Altri errori vengono propagati
            }
        }
        
        if (testoEmbedded && testoEmbedded.trim().length > 100) {
            console.log(`✅ Testo embedded: ${testoEmbedded.length} caratteri`);
            return testoEmbedded;
        }
        
        // TENTATIVO 2: OCR su PDF scansionato
        console.log(`⚠️ Poco testo embedded (${testoEmbedded.length} char) - avvio OCR...`);
        
        const tempDir = path.join(__dirname, 'temp_ocr');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const pdfPath = path.join(tempDir, `temp_${Date.now()}.pdf`);
        const imgPath = path.join(tempDir, `img_${Date.now()}`);
        
        // Salva PDF temporaneo
        fs.writeFileSync(pdfPath, pdfBuffer);
        
        try {
            // Converti PDF → PNG con pdf-poppler
            const poppler = require('pdf-poppler');
            const popplerPathEnv = process.env.POPPLER_PATH;
            const popplerPathLocal = path.join(__dirname, 'poppler', 'poppler-24.08.0', 'Library', 'bin');
            const popplerPath = popplerPathEnv || (fs.existsSync(popplerPathLocal) ? popplerPathLocal : undefined);
            
            const opts = {
                format: 'png',
                out_dir: tempDir,
                out_prefix: path.basename(imgPath),
                page: 1, // Solo prima pagina
                scale: 2000 // Alta risoluzione per OCR
            };

            if (popplerPath) {
                opts.poppler_path = popplerPath; // Path binari Poppler
            }
            
            await poppler.convert(pdfPath, opts);
            
            // Trova PNG generato
            const pngFile = fs.readdirSync(tempDir)
                .filter(f => f.startsWith(path.basename(imgPath)) && f.endsWith('.png'))[0];
            
            if (!pngFile) {
                throw new Error('Conversione PDF→PNG fallita');
            }
            
            const pngPath = path.join(tempDir, pngFile);
            
            // OCR con Tesseract (solo ENG per evitare download ITA)
            const Tesseract = require('tesseract.js');
            const { data: { text } } = await Tesseract.recognize(pngPath, 'eng', {
                logger: () => {} // Disabilita log verbosi
            });
            
            console.log(`✅ OCR completato: ${text.length} caratteri estratti`);
            
            // Pulizia file temporanei
            fs.unlinkSync(pdfPath);
            fs.unlinkSync(pngPath);
            
            return text;
            
        } catch (ocrError) {
            console.error(`❌ Errore OCR: ${ocrError.message}`);
            // Pulizia in caso di errore
            try { fs.unlinkSync(pdfPath); } catch {}
            return testoEmbedded; // Ritorna almeno il testo embedded (anche se poco)
        }
        
    } catch (error) {
        console.error(`⚠️ Errore lettura PDF "${filename}": ${error.message}`);
        return '';
    }
}

// Funzione per salvare fatture elettroniche XML (FatturaPA) come PDF leggibili
async function salvaFatturaXML(attachment, cartellaBase, mittenteEmail = null) {
    const buffer = attachment.content;
    const filename = attachment.filename;
    
    try {
        // Parsa l'XML
        const xmlText = buffer.toString('utf8');
        const parser = new xml2js.Parser({ explicitArray: false });
        const result = await parser.parseStringPromise(xmlText);
        
        // Estrai dati dal formato FatturaPA
        const fattura = result['p:FatturaElettronica'] || result['FatturaElettronica'] || result;
        const fatturaBody = fattura['FatturaElettronicaBody'] || fattura['Body'];
        const header = fattura['FatturaElettronicaHeader'] || fattura['Header'];
        
        // Dati cedente (fornitore)
        const cedente = header?.CedentePrestatore || header?.['p:CedentePrestatore'];
        const anagrafica = cedente?.DatiAnagrafici?.Anagrafica || cedente?.['p:DatiAnagrafici']?.['p:Anagrafica'];
        const sede = cedente?.Sede || cedente?.['p:Sede'];
        
        let nomeFornitore = 'SCONOSCIUTO';
        if (anagrafica?.Denominazione || anagrafica?.['p:Denominazione']) {
            nomeFornitore = (anagrafica.Denominazione || anagrafica['p:Denominazione']).trim();
        } else if (anagrafica?.Nome && anagrafica?.Cognome) {
            nomeFornitore = `${anagrafica.Cognome} ${anagrafica.Nome}`.trim();
        }
        
        // Dati cessionario (cliente)
        const cessionario = header?.CessionarioCommittente || header?.['p:CessionarioCommittente'];
        const anagraficaCliente = cessionario?.DatiAnagrafici?.Anagrafica;
        const sedeCliente = cessionario?.Sede;
        
        // Dati generali fattura
        const datiGenerali = fatturaBody?.DatiGenerali?.DatiGeneraliDocumento || fatturaBody?.['p:DatiGenerali']?.['p:DatiGeneraliDocumento'];
        const numeroFattura = datiGenerali?.Numero || datiGenerali?.['p:Numero'] || 'SN';
        const dataEmissione = datiGenerali?.Data || datiGenerali?.['p:Data'] || null;
        const tipoDocumento = datiGenerali?.TipoDocumento || 'TD01';
        
        // Importi
        const importoTotale = datiGenerali?.ImportoTotaleDocumento || '0.00';
        
        // Linee dettaglio (se presenti)
        const dettaglioLinee = fatturaBody?.DatiBeniServizi?.DettaglioLinee || [];
        
        // Pulisci nome fornitore per filesystem
        const nomeFornitoreFile = nomeFornitore
            .replace(/[<>:"/\\|?*]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 50);
        
        // Crea cartella fornitore
        const cartellaFornitore = path.join(cartellaBase, nomeFornitoreFile);
        if (!fs.existsSync(cartellaFornitore)) {
            fs.mkdirSync(cartellaFornitore, { recursive: true });
        }
        
        // Nome file PDF
        const timestamp = Date.now();
        const nomeFilePDF = dataEmissione 
            ? `${dataEmissione}_${nomeFornitoreFile}_N${numeroFattura}_${timestamp}.pdf`
            : `${nomeFornitoreFile}_N${numeroFattura}_${timestamp}.pdf`;
        
        const percorsoPDF = path.join(cartellaFornitore, nomeFilePDF);
        
        // GENERA PDF LEGGIBILE
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(percorsoPDF);
        doc.pipe(stream);
        
        // Intestazione
        doc.fontSize(18).font('Helvetica-Bold').text('FATTURA ELETTRONICA', { align: 'center' });
        doc.moveDown();
        
        // Info documento
        doc.fontSize(12).font('Helvetica');
        doc.text(`Numero: ${numeroFattura}`, { continued: true });
        doc.text(`    Data: ${dataEmissione || 'N/A'}`, { align: 'right' });
        doc.text(`Tipo: ${tipoDocumento === 'TD01' ? 'Fattura' : tipoDocumento}`);
        doc.moveDown();
        
        // Cedente (Fornitore)
        doc.fontSize(14).font('Helvetica-Bold').text('FORNITORE');
        doc.fontSize(11).font('Helvetica');
        doc.text(nomeFornitore);
        if (sede) {
            const indirizzo = `${sede.Indirizzo || ''} ${sede.NumeroCivico || ''}`.trim();
            const citta = `${sede.CAP || ''} ${sede.Comune || ''} ${sede.Provincia || ''}`.trim();
            if (indirizzo) doc.text(indirizzo);
            if (citta) doc.text(citta);
        }
        const pIva = cedente?.DatiAnagrafici?.IdFiscaleIVA?.IdCodice;
        if (pIva) doc.text(`P.IVA: ${pIva}`);
        doc.moveDown();
        
        // Cessionario (Cliente)
        doc.fontSize(14).font('Helvetica-Bold').text('CLIENTE');
        doc.fontSize(11).font('Helvetica');
        if (anagraficaCliente?.Denominazione) {
            doc.text(anagraficaCliente.Denominazione);
        }
        if (sedeCliente) {
            const indirizzoC = `${sedeCliente.Indirizzo || ''} ${sedeCliente.NumeroCivico || ''}`.trim();
            const cittaC = `${sedeCliente.CAP || ''} ${sedeCliente.Comune || ''} ${sedeCliente.Provincia || ''}`.trim();
            if (indirizzoC) doc.text(indirizzoC);
            if (cittaC) doc.text(cittaC);
        }
        doc.moveDown(2);
        
        // Dettaglio righe (se presenti)
        if (Array.isArray(dettaglioLinee) && dettaglioLinee.length > 0) {
            doc.fontSize(12).font('Helvetica-Bold').text('DETTAGLIO');
            doc.fontSize(10).font('Helvetica');
            
            dettaglioLinee.slice(0, 15).forEach((linea, idx) => {
                const desc = linea.Descrizione || 'N/A';
                const qta = linea.Quantita || '';
                const prezzo = linea.PrezzoUnitario || '';
                const totale = linea.PrezzoTotale || '';
                
                doc.text(`${idx + 1}. ${desc.substring(0, 60)}`);
                if (qta && prezzo) {
                    doc.text(`   Qta: ${qta}  x  €${prezzo}  =  €${totale}`, { indent: 20 });
                }
            });
            
            if (dettaglioLinee.length > 15) {
                doc.text(`... altre ${dettaglioLinee.length - 15} righe`);
            }
            doc.moveDown();
        }
        
        // Totale
        doc.fontSize(14).font('Helvetica-Bold');
        doc.text(`TOTALE: € ${importoTotale}`, { align: 'right' });
        
        doc.end();
        
        // Aspetta che il PDF sia scritto
        await new Promise((resolve) => stream.on('finish', resolve));
        
        console.log(`  ✅ PDF generato: ${nomeFornitoreFile}/${nomeFilePDF}`);
        
    } catch (error) {
        console.error(`⚠️ Errore conversione XML→PDF: ${error.message}`);
        // Salva XML originale come fallback
        const cartellaUnknown = path.join(cartellaBase, 'SCONOSCIUTO');
        if (!fs.existsSync(cartellaUnknown)) {
            fs.mkdirSync(cartellaUnknown, { recursive: true });
        }
        const percorsoFallback = path.join(cartellaUnknown, `${Date.now()}_${filename}`);
        fs.writeFileSync(percorsoFallback, buffer);
    }
}

async function salvaFattura(attachment, cartellaBase, isImportante = null, mittenteEmail = null) {
    const buffer = attachment.content;
    const filename = attachment.filename;
    
    // Crea cartella base se non esiste
    if (!fs.existsSync(cartellaBase)) {
        fs.mkdirSync(cartellaBase, { recursive: true });
    }
    
    let nomeFornitore = 'SCONOSCIUTO';
    let dataEmissione = null;
    let numeroFattura = null;
    let isPDF = filename.toLowerCase().endsWith('.pdf');
    
    // STRATEGIA 0: Usa mittente email se disponibile
    if (mittenteEmail && mittenteEmail.includes('@')) {
        const dominio = mittenteEmail.split('@')[1];
        const nomeDominio = dominio.split('.')[0];
        
        // Pulisci e usa come fornitore
        nomeFornitore = nomeDominio
            .replace(/[^a-zA-Z0-9]/g, '_')
            .replace(/_+/g, '_')
            .substring(0, 40);
        
        console.log(`📧 Fornitore da email: ${mittenteEmail} → "${nomeFornitore}"`);
    }
    
    // Per i PDF, estrai testo e cerca fornitore + data
    if (isPDF) {
        try {
            // ===== CONTROLLO DATABASE FORNITORI FIRST =====
            const dbFornitori = caricaDatabaseFornitori();
            
            // Estrai un "fingerprint" semplice dal filename per confronto
            const baseFilename = filename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_');
            
            // Cerca nel database se questo fornitore è già conosciuto
            if (dbFornitori.mappature[baseFilename]) {
                nomeFornitore = dbFornitori.mappature[baseFilename];
                console.log(`✅ Fornitore riconosciuto dal database: "${baseFilename}" → "${nomeFornitore}"`);
                // Salta l'estrazione complessa e passa direttamente al salvataggio
            } else {
                // Fornitore non in database, applica OCR SEMPRE
                console.log(`🔍 Lettura PDF con OCR: "${filename}"...`);
                let testo = '';
                try {
                    testo = await estraiTestoConOCR(buffer, filename);
                } catch (ocrError) {
                    console.error(`❌ Errore OCR per ${filename}: ${ocrError.message.substring(0, 80)}`);
                    // Continua comunque - usa mittente email come fallback
                    testo = '';
                }
                
                if (!testo || testo.length < 50) {
                    console.log(`⚠️ OCR non ha estratto testo sufficiente, uso mittente email`);
                    // nomeFornitore rimane quello dal mittente email
                } else {
                    console.log(`✅ OCR completato: ${testo.length} caratteri estratti`);
                
                    // ===== ESTRAZIONE SUPER INTELLIGENTE =====
                    
                    let nomeEstratto = null;
                    
                    // STRATEGIA 0: ENTI PUBBLICI (Comune, INAIL, INPS, ASL, ecc.)
                    const entiPattern = /(?:Denominazione|Ragione\s*Sociale|Ditta|Intestatario|Cedente)?[\s\n:]*\b((?:Comune|Città|Regione|Provincia)\s+(?:di|DI)\s+[A-Z][A-Za-zÀ-ù\s'-]{3,30}|INAIL|INPS|ASL|ATS|Agenzia\s+delle?\s+Entrate|Motorizzazione|Camera\s+di\s+Commercio|Agenzia\s+Dogane|(?:Istituto|Ente)\s+[A-Z][A-Za-zÀ-ù\s'-]{3,40})\b/i;
                    let matchEnti = testo.match(entiPattern);
                    
                    if (matchEnti) {
                        nomeEstratto = matchEnti[1].trim();
                        console.log(`✅ [ENTE PUBBLICO] Trovato: "${nomeEstratto}"`);
                    }
                    
                    // STRATEGIA 1: Cerca "Nome S.r.l." o "Nome S.p.A." in TUTTO il testo (priorità alle prime)
                    // Prima cerca dopo label esplicite
                    if (!nomeEstratto) {
                        const labelPattern = /(?:Denominazione|Ragione\s*Sociale|Ditta|Intestatario)[\s\n:]*([A-Z][A-Za-zÀ-ù\.\s&'-]{3,40}?)\s+(S\.r\.l\.|S\.p\.A\.|S\.a\.s\.|S\.n\.c\.|Srl|Spa|Sas|Snc|SRL|SPA)(?:\s|\.|\n|$)/i;
                        let matchLabel = testo.match(labelPattern);
                        
                        if (matchLabel) {
                            nomeEstratto = matchLabel[1].trim() + ' ' + matchLabel[2];
                            console.log(`✅ [LABEL] Trovato: "${nomeEstratto}"`);
                        } else {
                            // Pattern generico più restrittivo
                            const patternSocieta = /\b([A-Z][A-Z\s\.&'-]{2,30}?)\s+(S\.r\.l\.|S\.p\.A\.|S\.a\.s\.|S\.n\.c\.|Srl|Spa|Sas|Snc|SRL|SPA)(?:\s|\.|\n|$)/g;
                            let matches = [...testo.matchAll(patternSocieta)];
                            
                            if (matches.length > 0) {
                                const match = matches[0];
                                let nomePreliminary = match[1].trim();
                                
                                // Rimuovi parole spazzatura OCR all'inizio
                                nomePreliminary = nomePreliminary
                                    .replace(/^(Tipo|El|one|Iscrizione|Denominazione|Ditta|Ragione|Sociale|pestmamRo|Codice)\s+/gi, '')
                                    .trim();
                                
                                nomeEstratto = nomePreliminary + ' ' + match[2];
                                console.log(`✅ [SOCIETÀ] Trovato: "${nomeEstratto}"`);
                            }
                        }
                    }
                    
                    // STRATEGIA 2: Cerca nomi MAIUSCOLI (3-50 caratteri, no parole chiave fattura)
                    if (!nomeEstratto) {
                        const righe = testo.split('\n').filter(r => r.trim().length > 0);
                        const paroleEscluse = /FATTURA|INVOICE|DDT|BOLLA|DOCUMENTO|FORMULARIO|RIFIUTI|TRASPORTATORE|DESTINATARIO|MITTENTE|PRODUTTORE|INDIRIZZO|VIA|VIALE|PIAZZA|CORSO|CAP|TELEFONO|EMAIL|PEC|CODICE|PARTITA/i;
                        
                        for (let i = 0; i < Math.min(20, righe.length); i++) {
                            const riga = righe[i].trim();
                            
                            // Nome tutto MAIUSCOLO, no numeri, no keywords
                            if (riga.length >= 4 && riga.length <= 50 && 
                                riga === riga.toUpperCase() && 
                                riga.match(/^[A-Z][A-Z\s\.&'-]+$/) && 
                                !paroleEscluse.test(riga) &&
                                !riga.match(/\d{2}[\/\-]\d{2}/) && // no date
                                !riga.match(/\d{5,}/) // no codici lunghi
                            ) {
                                nomeEstratto = riga;
                                console.log(`✅ [MAIUSCOLO] Trovato riga ${i}: "${nomeEstratto}"`);
                                break;
                            }
                        }
                    }
                    
                    // STRATEGIA 3: Cerca riga sopra P.IVA
                    if (!nomeEstratto) {
                        const righe = testo.split('\n');
                        for (let i = 1; i < Math.min(30, righe.length); i++) {
                            if (righe[i].match(/P\.?\s*I\.?V\.?A[:\s]*\d{11}|Partita\s+IVA/i)) {
                                const rigaSopra = righe[i-1].trim();
                                if (rigaSopra.length >= 4 && rigaSopra.length <= 60 &&
                                    !rigaSopra.match(/CEDENTE|PRESTATORE|FORNITORE|CLIENTE/i)) {
                                    nomeEstratto = rigaSopra;
                                    console.log(`✅ [SOPRA P.IVA] Trovato: "${nomeEstratto}"`);
                                    break;
                                }
                            }
                        }
                    }
                    
                    // STRATEGIA 4: Cerca "Ragione Sociale" o "Ditta" esplicita
                    if (!nomeEstratto) {
                        const matchRagione = testo.match(/(?:Ragione\s*Sociale|Ditta|Denominazione)[\s\n:]+([A-Z][A-Za-zÀ-ù\s\.&'-]{4,50})/i);
                        if (matchRagione) {
                            nomeEstratto = matchRagione[1].trim();
                            console.log(`✅ [RAGIONE SOCIALE] Trovato: "${nomeEstratto}"`);
                        }
                    }
                    
                    // Pulizia e assegnazione
                    if (nomeEstratto) {
                        nomeFornitore = nomeEstratto
                            .replace(/\s+/g, '_')
                            .replace(/[<>:"/\\|?*]/g, '')
                            .replace(/\.+$/g, '') // rimuovi punti finali
                            .substring(0, 50);
                    }
            
            // ===== ESTRAZIONE DATA EMISSIONE =====
            let matchData = testo.match(/(?:Data\s*(?:di\s*)?(?:Emissione|Fattura|Documento))[\s\n:]*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i);
            
            // Pattern 2: Data specifica "Del 04/02/2026"
            if (!matchData) {
                matchData = testo.match(/Del[\s\n:]*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i);
            }
            
            // Pattern 3: Solo data valida (no date antiche o future)
            if (!matchData) {
                const righe = testo.split('\n').slice(0, 30);
                for (const riga of righe) {
                    const m = riga.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
                    if (m) {
                        const anno = parseInt(m[3]);
                        // Solo date tra 2020 e 2030 (fatture recenti)
                        if (anno >= 2020 && anno <= 2030) {
                            matchData = m;
                            break;
                        }
                    }
                }
            }
            
            if (matchData) {
                const giorno = matchData[1].padStart(2, '0');
                const mese = matchData[2].padStart(2, '0');
                const anno = matchData[3];
                dataEmissione = `${anno}-${mese}-${giorno}`;
            }
            
            // ===== ESTRAZIONE NUMERO FATTURA =====
            // Pattern 1: "Fattura N. 12345" o "N° Fattura: 12345"
            let matchNumero = testo.match(/(?:Fattura|Documento)[\s\n]+(?:N°?|Numero|n°|num\.?)[\s\n:]*([0-9A-Z\/\-]{1,20})/i);
            
            // Pattern 2: "N. 12345" isolato - SOLO NUMERI dopo N.
            if (!matchNumero) {
                matchNumero = testo.match(/(?:^|\n)N(?:°|\.)\s*(\d{3,20})/im);
            }
            
            // Pattern 3: Numero fattura dopo "Numero:" 
            if (!matchNumero) {
                matchNumero = testo.match(/Numero[\s\n:]+([0-9A-Z\/\-]{3,20})/i);
            }
            
            if (matchNumero && matchNumero[1]) {
                // Pulisci AGGRESSIVAMENTE: rimuovi lettere spazzatura OCR, mantieni solo numeri/slash/trattini
                numeroFattura = matchNumero[1].trim()
                    .replace(/[^0-9\/\-]/g, '') // KEEP ONLY digits, slash, dash
                    .replace(/^[\-\/]+/, '') // rimuovi trattini/slash all'inizio
                    .replace(/[\-\/]+$/, '') // rimuovi trattini/slash alla fine
                    .substring(0, 20)
                    .trim();
                
                // Se rimasto vuoto, usa il raw match ripulito da caratteri illegali
                if (!numeroFattura && matchNumero[1]) {
                    numeroFattura = matchNumero[1]
                        .replace(/[<>:"/\\|?*]/g, '_')
                        .substring(0, 15);
                }
            }
            
            console.log(`📄 PDF analizzato - Fornitore: "${nomeFornitore}" | Data: ${dataEmissione || 'N/A'} | N°: ${numeroFattura || 'N/A'}`);
                } // Fine blocco OCR
            } // Fine else - estrazione automatica
            
        } catch (e) {
            console.error('⚠️ Errore parsing PDF:', e.message);
            nomeFornitore = 'SCONOSCIUTO';
        }
    }
    
    // Validazione finale nome fornitore
    if (!nomeFornitore || nomeFornitore.length < 2 || nomeFornitore === 'SCONOSCIUTO') {
        // Ultimo tentativo: usa nome file senza estensione
        const baseName = path.basename(filename, '.pdf');
        const cleaned = baseName.replace(/[^A-Za-z\s]/g, '').trim();
        nomeFornitore = cleaned.substring(0, 30) || 'SCONOSCIUTO';
    }
    
    // Crea cartella fornitore
    const cartellaFornitore = path.join(cartellaBase, nomeFornitore);
    if (!fs.existsSync(cartellaFornitore)) {
        fs.mkdirSync(cartellaFornitore, { recursive: true });
    }
    
    // ===== RINOMINA FILE INTELLIGENTE =====
    let nuovoNome = filename;
    
    if (isPDF) {
        const estensione = '.pdf';
        let parti = [];
        
        // Formato: YYYY-MM-DD_NomeAzienda_N123.pdf
        if (dataEmissione) {
            parti.push(dataEmissione);
        }
        
        parti.push(nomeFornitore);
        
        if (numeroFattura) {
            parti.push('N' + numeroFattura);
        }
        
        if (parti.length > 0) {
            nuovoNome = parti.join('_') + estensione;
        }
    }
    
    // Salva file con nome intelligente
    const percorsoFile = path.join(cartellaFornitore, nuovoNome);
    
    // Se file esiste già, aggiungi timestamp
    let percorsoFinale = percorsoFile;
    if (fs.existsSync(percorsoFinale)) {
        const ext = path.extname(nuovoNome);
        const base = nuovoNome.replace(ext, '');
        const timestamp = Date.now().toString().slice(-6);
        percorsoFinale = path.join(cartellaFornitore, `${base}_${timestamp}${ext}`);
    }
    
    fs.writeFileSync(percorsoFinale, buffer);
    
    const marcatore = isImportante ? '🚨' : '✅';
    console.log(`${marcatore} Salvata: ${nomeFornitore}/${path.basename(percorsoFinale)}`);
}

// ========== ENDPOINT CORREZIONE MANUALE FATTURE ==========
function gestisciCorrezioneFornitore(req, res) {
    if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const { vecchioNome, nuovoNome, cartellaBase } = JSON.parse(body);
                
                if (!vecchioNome || !nuovoNome || !cartellaBase) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ errore: 'Parametri mancanti' }));
                    return;
                }
                
                const vecchiaCartella = path.join(cartellaBase, vecchioNome);
                const nuovaCartella = path.join(cartellaBase, nuovoNome);
                
                if (!fs.existsSync(vecchiaCartella)) {
                    res.writeHead(404);
                    res.end(JSON.stringify({ errore: 'Cartella non trovata' }));
                    return;
                }
                
                // Rinomina cartella
                if (fs.existsSync(nuovaCartella)) {
                    // Se esiste già, sposta i file dentro
                    const files = fs.readdirSync(vecchiaCartella);
                    files.forEach(file => {
                        const src = path.join(vecchiaCartella, file);
                        const dest = path.join(nuovaCartella, file);
                        
                        // Se file esiste, aggiungi timestamp
                        if (fs.existsSync(dest)) {
                            const ext = path.extname(file);
                            const base = file.replace(ext, '');
                            const timestamp = Date.now().toString().slice(-6);
                            const newDest = path.join(nuovaCartella, `${base}_${timestamp}${ext}`);
                            fs.renameSync(src, newDest);
                        } else {
                            fs.renameSync(src, dest);
                        }
                    });
                    
                    // Elimina cartella vuota
                    fs.rmdirSync(vecchiaCartella);
                } else {
                    // Rinomina direttamente
                    fs.renameSync(vecchiaCartella, nuovaCartella);
                }
                
                console.log(`✏️ Cartella rinominata: ${vecchioNome} → ${nuovoNome}`);
                
                res.writeHead(200);
                res.end(JSON.stringify({ 
                    successo: true,
                    messaggio: `Cartella rinominata in "${nuovoNome}"` 
                }));
                
            } catch (errore) {
                console.error('❌ Errore correzione:', errore);
                res.writeHead(500);
                res.end(JSON.stringify({ errore: errore.message }));
            }
        });
    }
}

function gestisciListaCartelle(req, res) {
    const params = new URL(req.url, `http://localhost:${PORT}`).searchParams;
    const cartella = params.get('cartella');
    
    if (!cartella || !fs.existsSync(cartella)) {
        res.writeHead(400);
        res.end(JSON.stringify({ errore: 'Cartella non valida' }));
        return;
    }
    
    try {
        const items = fs.readdirSync(cartella, { withFileTypes: true });
        const cartelle = items
            .filter(item => item.isDirectory())
            .map(item => ({
                nome: item.name,
                percorso: path.join(cartella, item.name),
                numFile: fs.readdirSync(path.join(cartella, item.name)).length
            }))
            .sort((a, b) => a.nome.localeCompare(b.nome));
        
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(cartelle));
        
    } catch (errore) {
        console.error('❌ Errore lista cartelle:', errore);
        res.writeHead(500);
        res.end(JSON.stringify({ errore: errore.message }));
    }
}

// Analizza quante fatture richiedono OCR
async function gestisciAnalisiOCR(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
        try {
            const { cartella, maxFile = 50 } = JSON.parse(body);
            
            if (!fs.existsSync(cartella)) {
                res.writeHead(404);
                res.end(JSON.stringify({ errore: 'Cartella non trovata' }));
                return;
            }
            
            const risultati = {
                totaleAnalizzati: 0,
                richiedonoOCR: 0,
                testoOK: 0,
                errori: 0,
                dettagli: []
            };
            
            // Scansiona sottocartelle fornitori
            const fornitori = fs.readdirSync(cartella, { withFileTypes: true })
                .filter(item => item.isDirectory())
                .map(item => item.name);
            
            for (const fornitore of fornitori) {
                const cartFornitore = path.join(cartella, fornitore);
                const files = fs.readdirSync(cartFornitore).filter(f => f.toLowerCase().endsWith('.pdf'));
                
                for (const file of files) {
                    if (risultati.totaleAnalizzati >= maxFile) break;
                    
                    const filePath = path.join(cartFornitore, file);
                    
                    try {
                        const buffer = fs.readFileSync(filePath);
                        const pdfData = await pdf(buffer);
                        const testo = pdfData.text;
                        
                        const righeNonVuote = testo.split('\n').filter(r => r.trim().length > 0).length;
                        const caratteriTotali = testo.trim().length;
                        
                        const richiedeOCR = caratteriTotali < 100 || righeNonVuote < 5;
                        
                        risultati.totaleAnalizzati++;
                        if (richiedeOCR) {
                            risultati.richiedonoOCR++;
                            risultati.dettagli.push({
                                file: `${fornitore}/${file}`,
                                caratteri: caratteriTotali,
                                righe: righeNonVuote,
                                richiedeOCR: true
                            });
                        } else {
                            risultati.testoOK++;
                        }
                        
                    } catch (err) {
                        risultati.errori++;
                        risultati.dettagli.push({
                            file: `${fornitore}/${file}`,
                            errore: err.message
                        });
                    }
                }
                
                if (risultati.totaleAnalizzati >= maxFile) break;
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(risultati));
            
        } catch (errore) {
            console.error('❌ Errore analisi OCR:', errore);
            res.writeHead(500);
            res.end(JSON.stringify({ errore: errore.message }));
        }
    });
}
