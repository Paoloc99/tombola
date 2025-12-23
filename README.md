# 🎲 Tombola Napoletana - Applicazione Web

Un'applicazione moderna e interattiva per giocare a tombola in famiglia sulla rete di casa, con sincronizzazione real-time e interfaccia premium.

## ✨ Caratteristiche

- 🎯 **Sistema Classico Napoletano**: Serie da 6 cartelle con tutti i 90 numeri distribuiti senza ripetizioni
- 👨‍💼 **Due Ruoli**: Admin (gestisce il tabellone) e Giocatori (ricevono le cartelle)
- 💰 **Calcolo Automatico Premi**: Distribuzione percentuale classica napoletana
- 🔄 **Sincronizzazione Real-time**: Tutti i dispositivi si aggiornano istantaneamente
- 📱 **Design Responsive**: Ottimizzato per smartphone e tablet
- 🎨 **Interfaccia Premium**: Glassmorphism, gradients, animazioni fluide
- 💾 **Persistenza**: Il nickname viene salvato nel browser

## 🎮 Come Funziona

### Setup Iniziale

1. **L'Admin**:
   - Apre l'app e sceglie "Fai il Tabellone"
   - Imposta il costo per cartella (es. €1.00)
   - Vede i giocatori che si connettono in tempo reale
   - Clicca "Calcola Premi" per vedere la distribuzione
   - Può aggiustare i centesimi con i pulsanti +/-
   - Avvia la partita quando tutti sono pronti

2. **I Giocatori**:
   - Aprono l'app e scelgono "Prendi le Cartelle"
   - Selezionano quale serie vogliono (1-5)
   - Scelgono quante cartelle (1-6 dalla serie scelta)
   - Attendono che l'Admin avvii la partita

### Durante la Partita

**Admin**:
- Clicca "Estrai Numero" per sorteggiare
- Vede il tabellone con tutti i 90 numeri
- Riceve notifiche quando un giocatore dichiara una vincita
- Valida o rifiuta le vincite dichiarate

**Giocatori**:
- Vedono le loro cartelle con i numeri
- I numeri estratti si marcano automaticamente
- L'ultimo numero estratto appare in grande
- Possono dichiarare vincite con i pulsanti (Ambo, Terno, Quaterna, Cinquina, Tombola)

## 📊 Distribuzione Premi

La distribuzione classica napoletana è:
- **Ambo**: 10%
- **Terno**: 15%
- **Quaterna**: 20%
- **Cinquina**: 25%
- **Tombola**: 30%

**Totale**: 100% del montepremi

## Generazione cartelle

La generazione delle cartelle avviene con il file **tombola.exe** da richiamare
```bash
tombola.exe -n 15 -o
```

- -n X: genera X cartelle
- -o: genera le cartelle in maniera organizzata

## 🚀 Installazione e Avvio

### Prerequisiti
- Node.js (versione 14 o superiore)

### Passaggi

1. **Installa le dipendenze**:
```bash
npm install
```

2. **Avvia il server**:
```bash
npm start
```

3. **Apri il browser**:
   - Sul computer che fa da server: `http://localhost:3000`
   - Da altri dispositivi sulla stessa rete WiFi: `http://[IP-DEL-SERVER]:3000`

### 📱 Connessione da Altri Dispositivi

Per giocare con smartphone e tablet sulla tua rete di casa:

1. Trova l'indirizzo IP del computer che fa da server:
   - **Windows**: Apri il Prompt dei comandi e digita `ipconfig`
   - Cerca "Indirizzo IPv4" (es. `192.168.1.100`)

2. Su smartphone/tablet connessi alla stessa rete WiFi:
   - Apri il browser
   - Vai su `http://192.168.1.100:3000` (sostituisci con il tuo IP)

## 📖 Regole del Gioco

### Vincite

- **Ambo**: 2 numeri sulla stessa riga
- **Terno**: 3 numeri sulla stessa riga
- **Quaterna**: 4 numeri sulla stessa riga  
- **Cinquina**: 5 numeri sulla stessa riga (riga completa)
- **Tombola**: Tutti i 15 numeri della cartella

### Struttura Cartelle

Ogni cartella ha:
- 3 righe × 9 colonne
- 5 numeri per riga (15 numeri totali)
- Numeri distribuiti per decine:
  - Colonna 1: 1-9
  - Colonna 2: 10-19
  - ...
  - Colonna 9: 80-90

### Serie di Cartelle

Le cartelle sono organizzate in **serie da 6**. Ogni serie contiene tutti i 90 numeri esattamente una volta, distribuiti tra le 6 cartelle. Questo è il sistema classico della tombola napoletana.

## 🛠️ Tecnologie Utilizzate

- **Backend**: Node.js, Express
- **Real-time**: Socket.io
- **Frontend**: HTML5, Vanilla CSS, JavaScript
- **Design**: Glassmorphism, CSS Gradients, Animazioni

## 🎨 Design

L'interfaccia utilizza:
- **Gradients vivaci** per un look moderno
- **Glassmorphism** per effetti di profondità
- **Animazioni fluide** per feedback visivo
- **Typography moderna** (Poppins font)
- **Design mobile-first** ottimizzato per il tocco

## 📝 Note

- Il nickname viene salvato nel browser (localStorage)
- Chiudere la scheda non disconnette automaticamente il giocatore
- L'Admin può validare manualmente le vincite per evitare errori
- Ogni vincita (Ambo, Terno, etc.) può essere vinta solo una volta per partita

## 🐛 Troubleshooting

**"Non riesco a connettermi da smartphone"**:
- Assicurati che smartphone e server siano sulla stessa rete WiFi
- Verifica che il firewall non blocchi la porta 3000
- Controlla di aver usato l'IP corretto del server

**"I numeri non si aggiornano"**:
- Ricarica la pagina
- Controlla la connessione internet/WiFi
- Verifica che il server sia ancora attivo

**"La vincita non viene riconosciuta"**:
- L'Admin deve validare manualmente ogni vincita
- Controlla che i numeri sulla cartella siano corretti
- Per la Tombola, tutti i 15 numeri devono essere estratti

## 🎯 Buon Divertimento!

Goditi la tombola con famiglia e amici! 🎉
