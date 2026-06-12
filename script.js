// =====================================================
// NAVIGATION
// =====================================================

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (id === 'page-history') renderHistory();
}

function goHome() {
  closeModal();
  showPage('page-home');
}

function confirmLeave() {
  if (!gameOver && totalSeeds() < 70) {
    if (!confirm('Abandonner la partie en cours ?')) return;
  }
  showPage('page-home');
}

function confirmRestart() {
  if (!gameOver && totalSeeds() < 70) {
    if (!confirm('Abandonner la partie et en commencer une nouvelle ?')) return;
  }
  startNewGame();
}

function startNewGame() {
  closeModal();
  showPage('page-game');
  initGame();
}

// =====================================================
// HISTORIQUE (localStorage)
// =====================================================

function saveGame(result) {
  const key = 'songo_history';
  let hist = [];
  try { hist = JSON.parse(localStorage.getItem(key)) || []; } catch(e) {}
  hist.unshift(result);
  if (hist.length > 50) hist = hist.slice(0, 50);
  localStorage.setItem(key, JSON.stringify(hist));
}

function loadHistory() {
  try { return JSON.parse(localStorage.getItem('songo_history')) || []; } catch(e) { return []; }
}

function clearHistory() {
  if (confirm("Effacer tout l'historique ?")) {
    localStorage.removeItem('songo_history');
    renderHistory();
  }
}

function renderHistory() {
  const hist = loadHistory();
  const countEl   = document.getElementById('hist-count');
  const contentEl = document.getElementById('hist-content');

  countEl.textContent = hist.length ? `${hist.length} partie${hist.length > 1 ? 's' : ''}` : '';

  if (hist.length === 0) {
    contentEl.innerHTML = '<div class="hist-empty">Aucune partie enregistrée.<br>Jouez votre première partie !</div>';
    return;
  }

  let html = '<div class="hist-list">';
  hist.forEach(g => {
    const d       = new Date(g.date);
    const dateStr = d.toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });

    let boardHtml = '';
    if (g.board) {
      boardHtml = `
        <div class="hist-board">
          <div class="hist-board-rows">
            <div class="hist-board-row">
              <span class="hist-player-lbl">J2</span>
              ${[13,12,11,10,9,8,7].map(i => `<div class="hist-pit-mini${g.board[i]===0?' empty':''}">${g.board[i]}</div>`).join('')}
            </div>
            <div class="hist-board-row">
              <span class="hist-player-lbl">J1</span>
              ${[0,1,2,3,4,5,6].map(i => `<div class="hist-pit-mini${g.board[i]===0?' empty':''}">${g.board[i]}</div>`).join('')}
            </div>
          </div>
        </div>`;
    }

    html += `
      <div class="hist-card">
        <div class="hist-card-header">
          <span class="hist-card-result">${g.result}</span>
          <span class="hist-card-date">${dateStr}</span>
        </div>
        <div class="hist-card-scores">
          <span>Joueur 1 : <strong>${g.scores[0]}</strong></span>
          <span>Joueur 2 : <strong>${g.scores[1]}</strong></span>
        </div>
        ${g.reason ? `<div class="hist-card-reason">${g.reason}</div>` : ''}
        ${boardHtml}
      </div>`;
  });
  html += '</div>';
  html += '<button class="hist-clear-btn" onclick="clearHistory()">Effacer l\'historique</button>';
  contentEl.innerHTML = html;
}

// =====================================================
// MODALE DE FIN DE PARTIE
// =====================================================

function openModal(resultData) {
  const { winner, scores: sc, reason, isDraw } = resultData;

  document.getElementById('modal-emoji').textContent = isDraw ? '🤝' : '🏆';
  document.getElementById('modal-title').textContent = isDraw ? 'Match nul !' : `Joueur ${winner} gagne !`;
  document.getElementById('modal-sub').textContent   = isDraw ? 'Les deux joueurs sont à égalité' : `Victoire du Joueur ${winner}`;

  document.getElementById('modal-scores-row').innerHTML = `
    <div class="modal-player-score">
      <div class="lbl">Joueur 1</div>
      <div class="val${winner === 1 ? ' winner' : ''}">${sc[0]}</div>
    </div>
    <div class="modal-sep">·</div>
    <div class="modal-player-score">
      <div class="lbl">Joueur 2</div>
      <div class="val${winner === 2 ? ' winner' : ''}">${sc[1]}</div>
    </div>`;

  document.getElementById('modal-reason').textContent = reason || '';
  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

// Fermer la modale en cliquant sur le fond
document.getElementById('modal-overlay').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// =====================================================
// ÉTAT DU JEU
// =====================================================

let board, currentPlayer, scores, lastPit, gameOver;

// Joueur 1 : cases 0-6   — sème 6→5→4→3→2→1→0→7→8→9→10→11→12→13
// Joueur 2 : cases 7-13  — sème 13→12→11→10→9→8→7→0→1→2→3→4→5→6
const SEQ = {
  1: [6, 5, 4, 3, 2, 1, 0, 7, 8, 9, 10, 11, 12, 13],
  2: [13, 12, 11, 10, 9, 8, 7, 0, 1, 2, 3, 4, 5, 6]
};

function playerRange(p)   { return p === 1 ? [0, 6]  : [7, 13]; }
function opponentRange(p) { return p === 1 ? [7, 13] : [0, 6];  }

function isInOpponentCamp(p, idx) {
  const [os, oe] = opponentRange(p);
  return idx >= os && idx <= oe;
}

// =====================================================
// INITIALISATION
// =====================================================

function initGame() {
  board         = Array(14).fill(5);
  currentPlayer = 1;
  scores        = [0, 0];
  lastPit       = -1;
  gameOver      = false;

  const msgEl   = document.getElementById('msg');
  msgEl.className  = 'msg';
  msgEl.textContent = 'Tour du Joueur 1';
  render();
}

// =====================================================
// UTILITAIRES
// =====================================================

function hasSeeds(p) {
  const [s, e] = playerRange(p);
  for (let i = s; i <= e; i++) if (board[i] > 0) return true;
  return false;
}

function totalSeeds() { return board.reduce((a, b) => a + b, 0); }

// =====================================================
// SIMULATION D'UN COUP
// =====================================================

function simulateMove(b, startIdx, p) {
  let tmp  = [...b];
  let seeds = tmp[startIdx];
  tmp[startIdx] = 0;

  const seq        = SEQ[p];
  const oppStartPos = 7; // le camp adverse commence toujours à la position 7 dans SEQ
  let opSeeds = 0, last = startIdx;

  const fullTours = Math.floor(seeds / 13);
  const remainder = seeds % 13;

  if (fullTours === 0) {
    // Semis normal : on saute la case de départ si on y repasse
    let cur = startIdx;
    for (let i = 0; i < seeds; i++) {
      let nextPos = (seq.indexOf(cur) + 1) % 14;
      while (seq[nextPos] === startIdx) nextPos = (nextPos + 1) % 14;
      cur = seq[nextPos];
      tmp[cur]++;
      if (isInOpponentCamp(p, cur)) opSeeds++;
    }
    last = cur;
  } else {
    // Tour(s) complet(s) : on distribue 13 cases par tour (sans la case de départ)
    const startPos         = seq.indexOf(startIdx);
    const seqWithoutStart  = [...seq.slice(0, startPos), ...seq.slice(startPos + 1)];

    for (let t = 0; t < fullTours; t++) {
      for (let i = 0; i < 13; i++) {
        tmp[seqWithoutStart[i]]++;
        if (isInOpponentCamp(p, seqWithoutStart[i])) opSeeds++;
      }
    }

    // Puis le reste UNIQUEMENT dans le camp adverse, depuis sa première case
    const oppSeq = seq.slice(oppStartPos); // 7 cases adverses dans l'ordre
    let rem = remainder, oppIdx = 0;
    while (rem > 0) {
      const idx = oppSeq[oppIdx % oppSeq.length];
      tmp[idx]++; opSeeds++; last = idx; rem--; oppIdx++;
    }
    if (remainder === 0) last = seqWithoutStart[seqWithoutStart.length - 1];
  }

  return { board: tmp, last, opSeeds, fullTour: fullTours > 0 };
}

function getMoves(p) {
  const [s, e] = playerRange(p);
  return Array.from({ length: e - s + 1 }, (_, k) => s + k)
    .filter(i => board[i] > 0)
    .map(i => {
      const r = simulateMove(board, i, p);
      return { idx: i, seeds: board[i], opSeeds: r.opSeeds, sim: r };
    });
}

// =====================================================
// RÈGLES SPÉCIALES
// =====================================================

// Case frontière (case 7) :
//   J1 → index 6  (7e case de J1, côté droit de son camp)
//   J2 → index 13 (7e case de J2, côté gauche de son camp)
function frontierIndex(p) { return p === 1 ? 6 : 13; }

function isForbidden(idx, p) {
  if (idx !== frontierIndex(p)) return false;
  return board[idx] === 1 || board[idx] === 2;
}

// Solidarité : si le camp adverse est vide, on doit envoyer ≥7 graines
function solidarityCheck(p) {
  const opp = 3 - p;
  if (hasSeeds(opp)) return { forced: null, end: false, strict: false };

  const moves = getMoves(p);
  if (moves.length === 0) return { forced: null, end: true };

  const valid = moves.filter(m => m.opSeeds >= 7 && !isForbidden(m.idx, p));
  if (valid.length > 0) return { forced: valid.map(m => m.idx), end: false, strict: false };

  const best = moves.reduce((a, b) => a.opSeeds > b.opSeeds ? a : b);
  return { forced: [best.idx], end: false, strict: true };
}

// Case n°1 adverse (première case du camp adverse dans le sens du semis) :
//   J1 sème en croissant dans le camp adverse (7→13) → première = 7
//   J2 sème en décroissant dans le camp adverse (6→0) → première = 6
function specialIndex(p) { return p === 1 ? 7 : 6; }

// =====================================================
// CAPTURES
// =====================================================

function doCapture(b, lastIdx, p, seedsPlayed) {
  const [os, oe] = opponentRange(p);
  const specIdx  = specialIndex(p);
  let tmp = [...b];
  let captured = 0;

  if (!isInOpponentCamp(p, lastIdx)) return { board: tmp, captured: 0 };
  if (!tmp.slice(os, oe + 1).some(v => v > 0)) return { board: tmp, captured: 0 };

  // Tour complet + dernière graine sur la case spéciale → 1 seule graine
  if (lastIdx === specIdx && seedsPlayed >= 14) {
    const testBoard = [...tmp];
    testBoard[lastIdx] = 0;
    if (testBoard.slice(os, oe + 1).some(v => v > 0)) {
      tmp[lastIdx] = 0;
      return { board: tmp, captured: 1, special: true };
    }
    return { board: tmp, captured: 0 };
  }

  // La case spéciale ne peut pas être la première capturée
  if (lastIdx === specIdx) return { board: tmp, captured: 0 };

  // Prise normale + chaîne (on remonte dans le sens inverse du semis)
  // J1 sème en croissant (7→13) → on remonte en décroissant (step = -1)
  // J2 sème en décroissant (6→0) → on remonte en croissant  (step = +1)
  const step = p === 1 ? -1 : 1;
  let cur = lastIdx, isChain = false;

  while (true) {
    if (!isInOpponentCamp(p, cur)) break;
    const count = tmp[cur];
    if (cur === specIdx && !isChain) break;
    if (count >= 2 && count <= 4) {
      const testBoard = [...tmp];
      testBoard[cur] = 0;
      if (!testBoard.slice(os, oe + 1).some(v => v > 0)) break; // ne pas vider le camp
      captured += count;
      tmp[cur] = 0;
      cur += step;
      isChain = true;
    } else break;
  }

  return { board: tmp, captured };
}

// =====================================================
// CLIC SUR UNE CASE
// =====================================================

function handleClick(idx) {
  if (gameOver) return;

  const [s, e] = playerRange(currentPlayer);
  if (idx < s || idx > e)  { showMsg("Ce n'est pas votre camp.", 'error'); return; }
  if (board[idx] === 0)    { showMsg('Cette case est vide.', 'error'); return; }

  const sol = solidarityCheck(currentPlayer);
  if (sol.end) { endGame('Fin de partie : solidarité impossible.'); return; }

  if (sol.forced && !sol.forced.includes(idx)) {
    showMsg('⚠ Coup de solidarité requis — choisissez une autre case.', 'error');
    return;
  }

  if (isForbidden(idx, currentPlayer)) {
    if (sol.strict && sol.forced && sol.forced.includes(idx)) {
      const opp = 3 - currentPlayer;
      scores[opp - 1] += board[idx];
      board[idx] = 0;
      showMsg("⚠ Coup interdit forcé : graines données à l'adversaire.", 'error');
      updateScoreDisplay();
      nextTurn();
      return;
    }
    showMsg('❌ Interdit : 1 ou 2 graines depuis la case frontière.', 'error');
    return;
  }

  // Coup valide
  const seedsPlayed = board[idx];
  const sim = simulateMove(board, idx, currentPlayer);
  board   = sim.board;
  lastPit = sim.last;

  const capResult = doCapture(board, sim.last, currentPlayer, seedsPlayed);
  board = capResult.board;

  if (capResult.captured > 0) {
    scores[currentPlayer - 1] += capResult.captured;
    const pl = capResult.captured > 1 ? 's' : '';
    showMsg(`+${capResult.captured} graine${pl} capturée${pl}`, 'capture');
  } else {
    showMsg('');
  }

  updateScoreDisplay();

  if (scores[currentPlayer - 1] >= 40) {
    endGame(`Joueur ${currentPlayer} gagne !`, true, '40 graines atteintes');
    return;
  }
  if (totalSeeds() < 10) { giveRemainingSeeds(); return; }

  nextTurn();
}

// =====================================================
// TOUR SUIVANT
// =====================================================

function nextTurn() {
  currentPlayer = 3 - currentPlayer;

  const sol = solidarityCheck(currentPlayer);
  if (sol.end)             { endGame('Fin de partie : solidarité impossible.', false, 'Solidarité impossible'); return; }
  if (!hasSeeds(currentPlayer)) { endGame(`Joueur ${currentPlayer} ne peut plus jouer.`, false, 'Camp vide'); return; }

  render();
  if (!document.getElementById('msg').textContent) showMsg(`Tour du Joueur ${currentPlayer}`);
}

// =====================================================
// FIN DE PARTIE
// =====================================================

function giveRemainingSeeds() {
  for (let i = 0; i <= 6;  i++) { scores[0] += board[i]; board[i] = 0; }
  for (let i = 7; i <= 13; i++) { scores[1] += board[i]; board[i] = 0; }
  updateScoreDisplay();
  render();

  if (scores[0] >= 40)            { endGame('Joueur 1 gagne !', true, 'Moins de 10 graines au total'); return; }
  if (scores[1] >= 40)            { endGame('Joueur 2 gagne !', true, 'Moins de 10 graines au total'); return; }
  if (scores[0] === scores[1])    { endGame('Match nul !', false, 'Moins de 10 graines — égalité', true); return; }
  endGame(`Joueur ${scores[0] > scores[1] ? 1 : 2} gagne !`, true, 'Moins de 10 graines au total');
}

function endGame(msg, isWin, reason, isDraw) {
  gameOver = true;
  showMsg(msg, isWin ? 'win' : '');
  render();

  let winner = null;
  if (!isDraw) winner = scores[0] > scores[1] ? 1 : 2;

  const resultData = {
    date:   new Date().toISOString(),
    result: isDraw ? 'Match nul' : `Joueur ${winner} gagne`,
    winner,
    scores: [...scores],
    board:  [...board],
    reason: reason || msg,
    isDraw: !!isDraw
  };

  saveGame(resultData);
  setTimeout(() => openModal(resultData), 350);
}

// =====================================================
// AFFICHAGE
// =====================================================

function showMsg(text, cls) {
  const el = document.getElementById('msg');
  el.className  = 'msg' + (cls ? ' ' + cls : '');
  el.textContent = text;
}

function updateScoreDisplay() {
  document.getElementById('sv1').textContent = scores[0];
  document.getElementById('sv2').textContent = scores[1];
}

function render() {
  const topRow = document.getElementById('top-row');
  const botRow = document.getElementById('bot-row');
  topRow.innerHTML = '';
  botRow.innerHTML = '';
  updateScoreDisplay();

  document.getElementById('p1row').className = 'player-row' + (currentPlayer === 1 ? ' active' : '');
  document.getElementById('p2row').className = 'player-row' + (currentPlayer === 2 ? ' active' : '');

  for (let i = 13; i >= 7; i--) topRow.appendChild(makePit(i, 2));
  for (let i = 0;  i <= 6; i++) botRow.appendChild(makePit(i, 1));
}

function makePit(idx, owner) {
  const div = document.createElement('div');
  div.className = 'pit';

  if (board[idx] === 0) div.classList.add('empty');
  if (gameOver)         div.classList.add('disabled');
  if (idx === lastPit && !gameOver) div.classList.add('last-pit');

  const isActivePlayer = currentPlayer === owner;
  if (isActivePlayer && !gameOver) div.classList.add('active-player');

  const label = document.createElement('span');
  label.className  = 'pit-label';
  // J1 : index 0 = C1 … index 6 = C7
  // J2 : index 13 = C1 … index 7 = C7
  label.textContent = idx <= 6 ? `C${idx + 1}` : `C${14 - idx}`;

  div.textContent = board[idx];
  div.appendChild(label);

  if (isActivePlayer && board[idx] > 0 && !gameOver) {
    div.addEventListener('click', () => handleClick(idx));
  } else {
    div.classList.add('disabled');
  }

  if (idx === frontierIndex(owner)) div.classList.add('frontier');

  return div;
}

// =====================================================
// DÉMARRAGE
// =====================================================

// La page d'accueil est affichée par défaut (class="page active" dans le HTML)
// Le jeu sera initialisé au clic sur "Nouvelle partie"
