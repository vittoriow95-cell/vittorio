const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const SERVER_PORT = 5000;
const PRINT_AGENT_PORT = 7002;
let serverProcess = null;
let printAgentProcess = null;

function waitForServer(url, timeoutMs = 15000) {
    const start = Date.now();

    return new Promise((resolve, reject) => {
        const check = () => {
            http.get(url, (res) => {
                res.resume();
                resolve();
            }).on('error', () => {
                if (Date.now() - start > timeoutMs) {
                    reject(new Error('Server timeout'));
                } else {
                    setTimeout(check, 300);
                }
            });
        };

        check();
    });
}

function startServer() {
    const serverPath = path.join(__dirname, 'server.js');

    serverProcess = spawn(process.execPath, [serverPath], {
        env: { ...process.env, PORT: String(SERVER_PORT) },
        stdio: 'inherit'
    });

    serverProcess.on('exit', () => {
        serverProcess = null;
    });
}

function startPrintAgent() {
    const agentPath = path.join(__dirname, 'print-agent.js');

    printAgentProcess = spawn(process.execPath, [agentPath], {
        env: { ...process.env, PRINT_AGENT_PORT: String(PRINT_AGENT_PORT) },
        stdio: 'inherit'
    });

    printAgentProcess.on('exit', () => {
        printAgentProcess = null;
    });
}

async function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 1024,
        minHeight: 700,
        autoHideMenuBar: true,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    await waitForServer(`http://localhost:${SERVER_PORT}`);
    await win.loadURL(`http://localhost:${SERVER_PORT}`);
}

app.whenReady().then(async () => {
    startServer();
    startPrintAgent();

    try {
        await createWindow();
    } catch (err) {
        app.quit();
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (serverProcess) {
        serverProcess.kill();
    }

    if (printAgentProcess) {
        printAgentProcess.kill();
    }

    if (process.platform !== 'darwin') {
        app.quit();
    }
});
