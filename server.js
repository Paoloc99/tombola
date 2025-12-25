const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Game state
const gameState = {
  admin: null,
  players: new Map(),
  playerSessions: new Map(), // sessionId -> player data (for reconnection)
  allCards: [], // 90 pre-generated cards
  assignedCards: new Set(), // Track which card IDs are assigned (1-90)
  gameStarted: false,
  drawnNumbers: [],
  costPerCard: 0,
  prizes: {
    ambo: 0,
    terno: 0,
    quaterna: 0,
    cinquina: 0,
    tombola: 0
  },
  winners: {
    ambo: null,
    terno: null,
    quaterna: null,
    cinquina: null,
    tombola: null
  }
};

// Generate all 90 cards at server startup
// Cards 1-6 = Serie 1, Cards 7-12 = Serie 2, ..., Cards 85-90 = Serie 15
function initializeAllCards() {
  gameState.allCards = [];

  try {
    // Leggi il file CSV (formato UTF-16 LE)
    const csvPath = path.join(__dirname, 'cartelle.csv');
    let csvContent = fs.readFileSync(csvPath, 'utf-16le');

    // Rimuovi il BOM se presente
    if (csvContent.charCodeAt(0) === 0xFEFF) {
      csvContent = csvContent.slice(1);
    }

    // Rimuovi tutti i null bytes (caratteri \u0000)
    csvContent = csvContent.replace(/\u0000/g, '');

    // Parsa le cartelle dal CSV
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim() !== '');
    let currentCardRows = [];
    let cardRowIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      
      // Controlla se è un header "Cartella N"
      if (line.includes('Cartella')) {
        // Se c'è una cartella precedente con 3 righe, convertila e aggiungila
        if (currentCardRows.length === 3) {
          const card = convertRowsToCard(currentCardRows);
          gameState.allCards.push(card);
        }
        
        // Inizia una nuova cartella
        currentCardRows = [];
        cardRowIndex = 0;
      } else if (cardRowIndex < 3) {
        // Parsa la riga: dividi per tab, poi processa ogni cella
        let parts = line.replaceAll(' ', null).trim().split('\t');
                
        const rowData = parts.map(cell => {
          const trimmed = cell.trim();
          // Se la cella è vuota o contiene solo spazi, è null
          if (trimmed === '') {
            return null;
          }
          // Altrimenti, prova a parsare come numero
          const num = parseInt(trimmed, 10);
          return isNaN(num) ? null : num;
        });
        
        // // Se ci sono più di 9 parti e la colonna 8 è vuota, usa la parte 9 per la colonna 8
        // if (parts.length > 9 && rowData.length >= 9 && rowData[8] === null) {
        //   const lastPart = parts[9].trim();
        //   if (lastPart !== '') {
        //     const num = parseInt(lastPart, 10);
        //     if (!isNaN(num)) {
        //       rowData[8] = num;
        //     }
        //   }
        // }
        
        // // Assicurati che ci siano esattamente 9 colonne
        // while (rowData.length < 9) {
        //   rowData.push(null);
        // }
        // rowData.splice(9); // Rimuovi colonne extra se ce ne sono
        
        currentCardRows.push(rowData);
        cardRowIndex++;
      }
    }

    // Aggiungi l'ultima cartella se completa
    if (currentCardRows.length === 3) {
      const card = convertRowsToCard(currentCardRows);
      gameState.allCards.push(card);
    }

    // Valida che abbiamo 90 cartelle
    if (gameState.allCards.length !== 90) {
      console.error(`❌ Errore: trovate ${gameState.allCards.length} cartelle invece di 90`);
      throw new Error(`Numero di cartelle non valido: ${gameState.allCards.length}`);
    }

    // Valida ogni serie (6 cartelle per serie, 15 serie totali)
    for (let serieIndex = 0; serieIndex < 15; serieIndex++) {
      const startIndex = serieIndex * 6;
      const series = gameState.allCards.slice(startIndex, startIndex + 6);
      
      try {
        assertSeries(series);
      } catch (error) {
        console.error(`❌ Errore nella serie ${serieIndex + 1} (cartelle ${startIndex + 1}-${startIndex + 6}):`, error.message);
        throw error;
      }
    }

    console.log("✅ Cartelle caricate dal CSV:", gameState.allCards.length);
  } catch (error) {
    console.error("❌ Errore nel caricamento delle cartelle dal CSV:", error.message);
    throw error;
  }
}

// Converte le righe parse (array di array) in una cartella con struttura 3x9
function convertRowsToCard(rows) {
  const card = Array.from({ length: 3 }, () => Array(9).fill(null));
  
  for (let row = 0; row < 3; row++) {
    if (rows[row]) {
      for (let col = 0; col < 9; col++) {
        if (rows[row][col] !== null && rows[row][col] !== undefined) {
          card[row][col] = rows[row][col];
        }
      }
    }
  }
  
  return card;
}

function assertCard(card) {
  // struttura
  console.assert(card.length === 3, "❌ Card must have 3 rows");

  let total = 0;

  for (let row = 0; row < 3; row++) {
    console.assert(card[row].length === 9, "❌ Card must have 9 columns");

    const rowNums = card[row].filter(n => n !== null);
    console.assert(rowNums.length === 5, `❌ Row ${row} has ${rowNums.length} numbers`);

    total += rowNums.length;
  }

  console.assert(total === 15, `❌ Card has ${total} numbers instead of 15`);

  // colonne
  for (let col = 0; col < 9; col++) {
    const colNums = [];

    for (let row = 0; row < 3; row++) {
      if (card[row][col] !== null) colNums.push(card[row][col]);
    }

    console.assert(
      colNums.length >= 0 && colNums.length <= 3,
      `❌ Column ${col} has ${colNums.length} numbers`
    );

    // ordinamento
    for (let i = 1; i < colNums.length; i++) {
      console.assert(
        colNums[i] > colNums[i - 1],
        `❌ Column ${col} not sorted`
      );
    }

    // range colonna
    colNums.forEach(n => {
      const min = col === 0 ? 1 : col * 10;
      const max = col === 8 ? 90 : col * 10 + 9;

      console.assert(
        n >= min && n <= max,
        `❌ Number ${n} in wrong column ${col}`
      );
    });
  }
}

function assertSeries(cards) {
  console.assert(cards.length === 6, "❌ Series must have 6 cards");

  const seen = new Set();
  const colCount = Array(9).fill(0);

  cards.forEach(card => {
    assertCard(card);

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 9; col++) {
        const n = card[row][col];
        if (n !== null) {
          console.assert(!seen.has(n), `❌ Duplicate number ${n} in series`);
          seen.add(n);
          colCount[col]++;
        }
      }
    }
  });

  console.assert(seen.size === 90, `❌ Series has ${seen.size} numbers instead of 90`);

  colCount.forEach((c, col) => {
    const expected = col === 0 ? 9 : col === 8 ? 11 : 10;
    console.assert(
      c === expected,
      `❌ Column ${col} has ${c} numbers in series (expected ${expected})`
    );
  });
}

// Ottieni l'IP locale della rete
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Ignora loopback e indirizzi IPv6
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Helper function to get all card IDs in a serie
function getCardIdsInSerie(serieNum) {
  const startCard = (serieNum - 1) * 6 + 1;
  return Array.from({ length: 6 }, (_, i) => startCard + i);
}

// Check if a serie is available (none of its cards are assigned)
function isSerieAvailable(serieNum) {
  const cardIds = getCardIdsInSerie(serieNum);
  return cardIds.every(id => !gameState.assignedCards.has(id));
}

// Check if specific cards are available
function areCardsAvailable(cardIds) {
  return cardIds.every(id => !gameState.assignedCards.has(id));
}

// Get available series
function getAvailableSeries() {
  const available = [];
  for (let serieNum = 1; serieNum <= 15; serieNum++) {
    if (isSerieAvailable(serieNum)) {
      available.push(serieNum);
    }
  }
  return available;
}

// Get all available individual cards
function getAvailableCards() {
  const available = [];
  for (let cardId = 1; cardId <= 90; cardId++) {
    if (!gameState.assignedCards.has(cardId)) {
      available.push(cardId);
    }
  }
  return available;
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New connection:', socket.id);

  // Admin joins
  socket.on('admin:join', () => {
    gameState.admin = socket.id;
    const localIP = getLocalIP();
    const PORT = process.env.PORT || 3000;
    const serverUrl = `http://${localIP}:${PORT}`;
    
    socket.emit('admin:joined', {
      players: Array.from(gameState.players.values()),
      serverUrl: serverUrl
    });
    console.log('Admin joined:', socket.id);
    console.log('Server URL:', serverUrl);
  });

  // Admin reconnect
  socket.on('admin:reconnect', ({ sessionId, nickname }) => {
    console.log('Admin reconnect attempt:', sessionId, nickname);

    // Always allow admin to reconnect and see current state
    gameState.admin = socket.id;
    const localIP = getLocalIP();
    const PORT = process.env.PORT || 3000;
    const serverUrl = `http://${localIP}:${PORT}`;

    // Send current game state
    const players = Array.from(gameState.players.values()).map(p => ({
      nickname: p.nickname,
      selectionType: p.selectionType,
      selection: p.selection,
      cardCount: p.cardIds.length,
      cardIds: p.cardIds
    }));

    socket.emit('admin:game-restore', {
      gameStarted: gameState.gameStarted,
      drawnNumbers: gameState.drawnNumbers,
      players: players,
      prizes: gameState.prizes,
      serverUrl: serverUrl
    });

    console.log('Admin reconnected and game state sent');
  });

  // Request available cards
  socket.on('player:request-availability', () => {
    socket.emit('cards:availability', {
      availableSeries: getAvailableSeries(),
      availableCards: getAvailableCards()
    });
  });

  // Player reconnect (session-based)
  socket.on('player:reconnect', ({ sessionId, nickname }) => {
    console.log('Player reconnect attempt:', sessionId, nickname);

    const existingSession = gameState.playerSessions.get(sessionId);

    if (existingSession) {
      // Restore existing session
      console.log('Restoring session for:', existingSession.nickname);

      // Update socket ID
      existingSession.id = socket.id;
      gameState.players.set(socket.id, existingSession);

      // Send restored game state
      socket.emit('game:restore', {
        cards: existingSession.cards,
        cardIds: existingSession.cardIds,
        drawnNumbers: gameState.drawnNumbers,
        gameStarted: gameState.gameStarted,
        winners: gameState.winners
      });

      // If game started, also send to waiting screen or game screen
      if (gameState.gameStarted) {
        // Player goes directly to game
      } else {
        // Player goes to waiting screen
        socket.emit('join:success', {
          cardIds: existingSession.cardIds,
          cardCount: existingSession.cardIds.length
        });
      }
    }
    // If no existing session, player will proceed normally with card selection
  });

  // Player joins with card selection
  socket.on('player:join', ({ nickname, selectionType, selection, sessionId }) => {
    // selectionType: 'serie' or 'cards'
    // selection: serieNum (1-15) or array of cardIds

    let cardIds = [];

    if (selectionType === 'serie') {
      cardIds = getCardIdsInSerie(selection);
    } else {
      cardIds = selection;
    }

    // Validate cards are available
    if (!areCardsAvailable(cardIds)) {
      socket.emit('join:error', {
        message: 'Alcune cartelle selezionate non sono più disponibili!'
      });
      return;
    }

    // Assign cards
    cardIds.forEach(id => gameState.assignedCards.add(id));

    const player = {
      id: socket.id,
      sessionId: sessionId || `session_${Date.now()}_${Math.random()}`, // Fallback if not provided
      nickname,
      selectionType,
      selection,
      cardIds,
      cards: [],
      markedNumbers: []
    };

    gameState.players.set(socket.id, player);
    gameState.playerSessions.set(player.sessionId, player); // Save for reconnection

    // Notify player of successful join
    socket.emit('join:success', {
      cardIds,
      cardCount: cardIds.length
    });

    // Notify admin of new player
    if (gameState.admin) {
      io.to(gameState.admin).emit('lobby:update', {
        players: Array.from(gameState.players.values()).map(p => ({
          nickname: p.nickname,
          selectionType: p.selectionType,
          selection: p.selection,
          cardCount: p.cardIds.length,
          cardIds: p.cardIds
        }))
      });

      // Broadcast availability update to all waiting players
      io.emit('cards:availability', {
        availableSeries: getAvailableSeries(),
        availableCards: getAvailableCards()
      });
    }

    console.log(`Player joined: ${nickname} - ${cardIds.length} cartelle (IDs: ${cardIds.join(', ')})`);
  });

  // Admin sets cost per card
  socket.on('admin:set-cost', ({ cost }) => {
    gameState.costPerCard = cost;
    io.emit('cost:updated', { cost }); // Broadcast to all players
    console.log('Cost per card set to:', cost);
  });

  // Admin calculates prizes
  socket.on('admin:calculate-prizes', () => {
    const totalCards = Array.from(gameState.players.values())
      .reduce((sum, player) => sum + player.cardIds.length, 0);

    const totalPot = totalCards * gameState.costPerCard;

    gameState.prizes = {
      ambo: parseFloat((totalPot * 0.10).toFixed(2)),
      terno: parseFloat((totalPot * 0.15).toFixed(2)),
      quaterna: parseFloat((totalPot * 0.20).toFixed(2)),
      cinquina: parseFloat((totalPot * 0.25).toFixed(2)),
      tombola: parseFloat((totalPot * 0.30).toFixed(2))
    };

    socket.emit('prizes:calculated', {
      totalCards,
      totalPot: parseFloat(totalPot.toFixed(2)),
      prizes: gameState.prizes
    });

    console.log('Prizes calculated:', gameState.prizes);
  });

  // Admin adjusts prize
  socket.on('admin:adjust-prize', ({ type, amount }) => {
    if (gameState.prizes[type] !== undefined) {
      gameState.prizes[type] = parseFloat((gameState.prizes[type] + amount).toFixed(2));
      socket.emit('prizes:updated', { prizes: gameState.prizes });
    }
  });

  // Admin starts game
  socket.on('admin:start-game', () => {
    gameState.gameStarted = true;
    gameState.drawnNumbers = [];

    // Assign actual card data to all players based on their card IDs
    gameState.players.forEach((player, playerId) => {
      player.cards = player.cardIds.map(cardId => {
        // cardId is 1-based, array is 0-based
        return gameState.allCards[cardId - 1];
      });

      io.to(playerId).emit('game:started', {
        cards: player.cards,
        cardIds: player.cardIds,
        prizes: gameState.prizes
      });
    });

    socket.emit('game:started-admin', {
      totalPlayers: gameState.players.size
    });

    console.log('Game started!');
  });

  // Admin draws a number
  socket.on('admin:draw-number', () => {
    if (!gameState.gameStarted) return;

    // Find available numbers (1-90 not yet drawn)
    const availableNumbers = Array.from({ length: 90 }, (_, i) => i + 1)
      .filter(num => !gameState.drawnNumbers.includes(num));

    if (availableNumbers.length === 0) {
      socket.emit('game:no-numbers-left');
      return;
    }

    // Draw random number
    const drawnNumber = availableNumbers[
      Math.floor(Math.random() * availableNumbers.length)
    ];

    gameState.drawnNumbers.push(drawnNumber);

    // Broadcast to all players and admin
    io.emit('game:number-drawn', {
      number: drawnNumber,
      total: gameState.drawnNumbers.length
    });

    console.log(`Number drawn: ${drawnNumber} (${gameState.drawnNumbers.length}/90)`);
  });

  // Player declares a win
  socket.on('player:declare-win', ({ type }) => {
    const player = gameState.players.get(socket.id);
    if (!player) return;

    // Check if this win type has already been claimed
    if (gameState.winners[type]) {
      socket.emit('win:already-claimed', { type });
      return;
    }

    // Validate the win
    const isValid = validateWin(player, type);

    if (isValid) {
      gameState.winners[type] = player.nickname;

      // Notify admin
      io.to(gameState.admin).emit('admin:win-declared', {
        nickname: player.nickname,
        type,
        cards: player.cards,
        cardIds: player.cardIds,
        drawnNumbers: gameState.drawnNumbers
      });

      // Notify player
      socket.emit('win:declared', { type });
    } else {
      socket.emit('win:invalid', { type });
    }
  });

  // Admin validates win
  socket.on('admin:validate-win', ({ nickname, type, valid }) => {
    if (valid) {
      io.emit('win:confirmed', {
        nickname,
        type,
        prize: gameState.prizes[type]
      });
    } else {
      gameState.winners[type] = null; // Reset if invalid
      io.emit('win:rejected', { nickname, type });
    }
  });

  // Admin reset game
  socket.on('admin:reset-game', () => {
    if (socket.id !== gameState.admin) return;

    console.log('Admin resetting game...');

    // Reset game state
    gameState.players.clear();
    gameState.playerSessions.clear();
    gameState.assignedCards.clear();
    gameState.gameStarted = false;
    gameState.drawnNumbers = [];
    gameState.costPerCard = 0;
    gameState.prizes = {
      ambo: 0,
      terno: 0,
      quaterna: 0,
      cinquina: 0,
      tombola: 0
    };
    gameState.winners = {
      ambo: null,
      terno: null,
      quaterna: null,
      cinquina: null,
      tombola: null
    };

    // Notify all clients
    io.emit('game:reset');

    console.log('Game reset complete');
  });

  // Disconnect
  socket.on('disconnect', () => {
    if (socket.id === gameState.admin) {
      gameState.admin = null;
      console.log('Admin disconnected');
    } else if (gameState.players.has(socket.id)) {
      const player = gameState.players.get(socket.id);

      // Free up assigned cards if game hasn't started
      if (!gameState.gameStarted) {
        player.cardIds.forEach(id => gameState.assignedCards.delete(id));

        // Broadcast availability update
        io.emit('cards:availability', {
          availableSeries: getAvailableSeries(),
          availableCards: getAvailableCards()
        });
      }

      gameState.players.delete(socket.id);

      if (gameState.admin) {
        io.to(gameState.admin).emit('lobby:update', {
          players: Array.from(gameState.players.values()).map(p => ({
            nickname: p.nickname,
            selectionType: p.selectionType,
            selection: p.selection,
            cardCount: p.cardIds.length,
            cardIds: p.cardIds
          }))
        });
      }

      console.log(`Player disconnected: ${player.nickname}`);
    }
  });
});

// Win validation logic
function validateWin(player, type) {
  const drawnSet = new Set(gameState.drawnNumbers);

  for (const card of player.cards) {
    // Check each row
    for (let row = 0; row < 3; row++) {
      const rowNumbers = card[row].filter(n => n !== null);
      const markedInRow = rowNumbers.filter(n => drawnSet.has(n));

      switch (type) {
        case 'ambo':
          if (markedInRow.length >= 2) return true;
          break;
        case 'terno':
          if (markedInRow.length >= 3) return true;
          break;
        case 'quaterna':
          if (markedInRow.length >= 4) return true;
          break;
        case 'cinquina':
          if (markedInRow.length === 5) return true;
          break;
        case 'tombola':
          // All 15 numbers on the card
          const allCardNumbers = card.flat().filter(n => n !== null);
          const allMarked = allCardNumbers.every(n => drawnSet.has(n));
          if (allMarked) return true;
          break;
      }
    }
  }

  return false;
}

// Initialize cards at server startup
initializeAllCards();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎲 Tombola server running on port ${PORT}`);
  console.log(`📱 Open http://${getLocalIP()}:${PORT} in your browser`);
  console.log(`🏠 Or connect from other devices using your local IP`);
});
