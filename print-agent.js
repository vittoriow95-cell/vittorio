const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = process.env.PRINT_AGENT_PORT || 7002;
const TOKEN = process.env.PRINT_AGENT_TOKEN || '';
const BAT_PATH = process.env.PRINT_BAT_PATH || path.join(__dirname, 'stampa_com3.bat');

function buildComandi(dati, config) {
    let comandiStampante = '';
    comandiStampante += `SIZE ${config.larghezza} mm, ${config.altezza} mm\r\n`;
    comandiStampante += 'GAP 2 mm, 0 mm\r\n';
    comandiStampante += 'DIRECTION 1\r\n';
    comandiStampante += 'CLS\r\n';

    let y = 20;
    const fontTitolo = config.fontTitolo || '3';
    const fontCampi = config.fontCampi || '2';
    const isCustom = Boolean(dati && (dati.customLabel || dati.titolo || dati.etichetta || dati.valore));

    if (isCustom) {
        const titolo = String(dati.titolo || '').trim();
        const etichetta = String(dati.etichetta || '').trim();
        const valore = String(dati.valore || '').trim();
        const linea = [etichetta, valore].filter(Boolean).join(': ');

        if (titolo) {
            comandiStampante += `TEXT 20,${y},"${fontTitolo}",0,1,1,"${titolo}"\r\n`;
            y += 40;
        }
        if (linea) {
            comandiStampante += `TEXT 10,${y},"${fontCampi}",0,1,1,"${linea}"\r\n`;
        }
    } else {
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
    }

    const copie = parseInt(dati.copie) || 1;
    comandiStampante += `PRINT ${copie}\r\n`;

    return { comandiStampante, copie };
}

function setCors(res, origin) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-print-token');
    res.setHeader('Access-Control-Max-Age', '86400');
}

const server = http.createServer((req, res) => {
    setCors(res, req.headers.origin);

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
    }

    if (req.url === '/stampa' && req.method === 'POST') {
        if (TOKEN && req.headers['x-print-token'] !== TOKEN) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Token non valido' }));
            return;
        }

        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
            try {
                const dati = JSON.parse(body || '{}');
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

                const { comandiStampante, copie } = buildComandi(dati, config);

                const percorsoPRN = path.join(__dirname, 'etichetta_temp.prn');
                fs.writeFileSync(percorsoPRN, comandiStampante, 'ascii');

                if (!fs.existsSync(percorsoPRN)) {
                    throw new Error('Impossibile creare file di stampa');
                }

                if (!fs.existsSync(BAT_PATH)) {
                    throw new Error(`File bat non trovato: ${BAT_PATH}`);
                }

                exec(`"${BAT_PATH}"`, (error) => {
                    if (error) {
                        console.error('⚠️ Errore stampa:', error.message);
                    }
                });

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, metodo: 'stampa_locale', copie }));
            } catch (err) {
                console.error('❌ ERRORE PRINT-AGENT:', err.message);
                console.error('Stack:', err.stack);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: err.message, stack: err.stack }));
            }
        });
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'Not found' }));
});

server.listen(PORT, () => {
    console.log(`🖨️ Print agent attivo su http://localhost:${PORT}`);
});
