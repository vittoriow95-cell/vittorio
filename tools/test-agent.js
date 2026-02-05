const http = require('http');
const https = require('https');

const urlStr = process.env.PRINT_AGENT_TEST_URL || 'http://localhost:7001/health';
const token = process.env.PRINT_AGENT_TOKEN || '';

const { URL } = require('url');
const urlObj = new URL(urlStr);
const isHttps = urlObj.protocol === 'https:';
const lib = isHttps ? https : http;

const headers = {};
if (token) headers['x-print-token'] = token;

const req = lib.request(
    {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers
    },
    (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
            console.log('Status:', res.statusCode);
            console.log('Body:', body);
            process.exit(res.statusCode === 200 ? 0 : 1);
        });
    }
);

req.on('error', (err) => {
    console.error('Errore:', err.message);
    process.exit(1);
});

req.end();
