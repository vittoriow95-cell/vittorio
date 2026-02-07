# 📋 HACCP APP - Sistema Gestione Completo

## 🚀 Avvio Rapido

### 1. Prima installazione
```bash
npm install
```

### 2. Avvio server
**Metodo 1 - Doppio click su:**
```
AVVIA_SERVER.bat
```

**Metodo 2 - Da terminale:**
```bash
node server.js
```

### 3. Apri browser
Vai su: **http://localhost:5000**

---

## 🔧 Risoluzione Problemi

### ❌ Errore "Porta già in uso"
**Soluzione:** Doppio click su `PULISCI_PORTE.bat`

Questo script:
- Chiude tutti i processi Node.js zombie
- Libera le porte 3000, 3001, 5000, 8080
- Verifica che tutto sia pulito

Poi riavvia con `AVVIA_SERVER.bat`

---

## 🖨️ Stampante VERETTI 420B

### Configurazione
- **Modello:** 4BARCODE 4B-2054L(BT)
- **Porta:** COM3
- **Protocollo:** TSPL
- **Velocità:** 115200 baud

### Test Stampa
1. Vai alla sezione "Lotti"
2. Crea o seleziona un lotto
3. Clicca "Stampa Etichetta"
4. Scegli numero copie
5. La stampa parte automaticamente

### Risoluzione problemi stampa
- Verifica che la stampante sia accesa
- Controlla che sia su COM3 in Gestione Dispositivi
- Verifica che il file `stampa_com3.bat` esista

---

## 🌐 Uso senza PC di casa (server cloud + agente stampa locale)

Se vuoi usare l’app da ovunque **senza tenere acceso il PC di casa**, devi:
1) **Pubblicare il server** su cloud (Render/Railway/etc.)
2) **Lasciare acceso solo il PC in macelleria** collegato alla stampante

### ✅ Avvio agente stampa (PC in macelleria)
```bash
npm run agent
```

Variabili utili:
- `PRINT_AGENT_PORT` (default 7001)
- `PRINT_AGENT_TOKEN` (token di sicurezza)
- `PRINT_BAT_PATH` (percorso del file stampa_com3.bat)

### ✅ Configurazione server cloud
Imposta queste variabili sul server cloud:
- `PRINT_AGENT_URL` = URL dell’agente (es. http://IP_DEL_PC:7001/stampa o URL tunnel)
- `PRINT_AGENT_TOKEN` = lo stesso token dell’agente

### ✅ Test agente stampa
```bash
```

Se il test risponde `ok: true`, l’agente è pronto.

---

## 📧 Sistema PEC - Fatture Automatiche

### Account Configurato
- **Email:** volperosrio@pec.it
- **Server:** imaps.aruba.it
- **Provider:** Aruba PEC

### Come Funziona
1. Vai alla sezione "PEC"
2. Configura account (se non già fatto)
3. Clicca "Avvia Scansione"
4. Il sistema:
   - Scarica tutte le email PEC
   - Estrae i PDF allegati
   - Riconosce automaticamente il fornitore dal contenuto
   - Salva in cartelle organizzate per fornitore

### 🚨 Email Importanti - Sistema di Allerta

Il sistema riconosce automaticamente email da:

**PRIORITÀ CRITICA 🔴**
- Agenzia delle Entrate
- INPS
- Guardia di Finanza
- Agenzia Riscossione (ex Equitalia)
- Tribunale/Giustizia

**PRIORITÀ ALTA 🟠**
- Comuni e Province
- ASL/ATS
- Camera di Commercio

**PRIORITÀ MEDIA 🟡**
- Banche (avvisi pagamento)

**Cosa succede:**
- Popup rosso lampeggiante
- Allegati salvati in `_URGENTI/[Nome Ente]/`
- Log dettagliato con tutti i dettagli
- Notifica se contiene parole come: multa, sanzione, sollecito, tributi, etc.

---

## 📁 Struttura Cartelle Fatture

```
[Cartella PEC]/
├── _URGENTI/
│   ├── Agenzia delle Entrate/
│   ├── INPS/
│   └── ...
├── NomeFornitore1/
│   ├── fattura_001.pdf
│   └── fattura_002.pdf
├── NomeFornitore2/
└── ...
```

---

## ✨ Funzionalità Principali

### 📊 Dashboard
- Riepilogo generale
- Statistiche temperature
- Scadenze prodotti
- Alert manutenzioni

### 🌡️ Controllo Temperature
- Registrazione giornaliera frigo/freezer
- Alert automatici fuori range
- Storico completo

### 📦 Gestione Lotti
- Tracciabilità completa
- Stampa etichette HACCP
- Scadenzario integrato

### 🧹 Pulizie & Sanificazione
- Checklist personalizzabili
- Registro conforme

### ⚠️ Non Conformità
- Segnalazione immediata
- Azioni correttive
- Storico completo

### 🔧 Manutenzioni
- Scadenzario attrezzature
- Alert preventivi
- Registro interventi

### 👥 Fornitori
- Anagrafica completa
- Valutazioni
- Documenti allegati

### 🥜 Allergeni
- Database completo
- Etichettatura automatica

### ✅ CCP (Punti Critici)
- Monitoraggio continuo
- Limiti critici
- Azioni correttive

### 🎓 Formazione
- Registro personale
- Attestati
- Scadenze certificazioni

### 📦 Inventario
- Giacenze in tempo reale
- Movimenti
- Riordini automatici

---

## 🔒 Sicurezza

- PIN Admin: `9999` (cambialo nelle impostazioni!)
- Dati salvati in localStorage (browser)
- Nessun dato inviato a server esterni

---

## 🆘 Supporto

### Errori Comuni

**Server non si avvia**
→ Esegui `PULISCI_PORTE.bat`

**Stampante non stampa**
→ Verifica COM3 e che sia accesa

**PEC non scarica email**
→ Verifica credenziali e connessione internet

**Popup "Server non disponibile"**
→ Riavvia con `AVVIA_SERVER.bat`

---

## 📝 File Importanti

- `server.js` - Server Node.js (stampa + PEC)
- `app.js` - Logica applicazione
- `index.html` - Interfaccia
- `style.css` - Stile Apple moderno
- `AVVIA_SERVER.bat` - Avvio rapido
- `PULISCI_PORTE.bat` - Risoluzione problemi porte
- `stampa_com3.bat` - Driver stampa TSPL

---

## 🎯 Tips & Tricks

1. **Backup dati:** I dati sono nel browser. Usa Export regolarmente!
2. **Scansione PEC automatica:** Attivala per controllo ogni 30 min
3. **Alert email importanti:** Controlla sempre `_URGENTI/`
4. **Stampe multiple:** Usa il campo "Copie" per etichette in serie

---

**Versione:** 2.0
**Data:** Febbraio 2026
**Sviluppato per:** Gestione HACCP completa con automazione
