// ====================
// ÉTAT DU JEU
// ====================

let board, currentPlayer, scores, lastPit, gameOver;

// Joueur 1 : cases 0-6  (sème droite→gauche dans son camp = index décroissant, puis gauche→droite chez J2 = index croissant)
// Joueur 2 : cases 7-13 (sème droite→gauche dans son camp = index décroissant dans 7-13, puis gauche→droite chez J1)
//
// Sens de semis unifié : on tourne toujours dans le sens 0→1→2→3→4→5→6→7→8→9→10→11→12→13→0
// Pour J1 : son camp = 0-6, camp adverse = 7-13
// Pour J2 : son camp = 7-13, camp adverse = 0-6
//
// ATTENTION : "de droite vers gauche dans son camp puis gauche vers droite chez l'adversaire"
// correspond au sens de rotation : J1 sème 6→5→4→3→2→1→0→7→8→9→10→11→12→13→6...
// soit la boucle DÉCROISSANTE dans son camp puis CROISSANTE chez l'adversaire.
//
// On représente ça par une séquence fixe :
//   J1 : 6,5,4,3,2,1,0,7,8,9,10,11,12,13  (puis recommence à 6)
//   J2 : 13,12,11,10,9,8,7,0,1,2,3,4,5,6  (puis recommence à 13)

function playerRange(p) {
  return p === 1 ? [0, 6] : [7, 13];
}

function opponentRange(p) {
  return p === 1 ? [7, 13] : [0, 6];
}

// Séquence de semis : tableau de 14 indices dans l'ordre de distribution pour chaque joueur
// J1 tourne : 6→5→4→3→2→1→0→7→8→9→10→11→12→13→6→...
// J2 tourne : 13→12→11→10→9→8→7→0→1→2→3→4→5→6→13→...
const SEQ = {
  1: [6, 5, 4, 3, 2, 1, 0, 7, 8, 9, 10, 11, 12, 13],
  2: [13, 12, 11, 10, 9, 8, 7, 0, 1, 2, 3, 4, 5, 6]
};

// Prochain index dans la séquence de semis d'un joueur, en partant d'un index donné
function nextInSeq(p, idx) {
  const seq = SEQ[p];
  const pos = seq.indexOf(idx);
  return seq[(pos + 1) % 14];
}

// Position dans la séquence (0-based)
function posInSeq(p, idx) {
  return SEQ[p].indexOf(idx);
}

// ====================
// INITIALISATION
// ====================

function initGame() {
  board = Array(14).fill(5);
  currentPlayer = 1;
  scores = [0, 0];
  lastPit = -1;
  gameOver = false;

  const msgEl = document.getElementById("msg");
  msgEl.className = "msg";
  msgEl.textContent = "Tour du Joueur 1";

  render();
}

// ====================
// UTILITAIRES
// ====================

function hasSeeds(p) {
  const [s, e] = playerRange(p);
  for (let i = s; i <= e; i++) {
    if (board[i] > 0) return true;
  }
  return false;
}

function totalSeeds() {
  return board.reduce((a, b) => a + b, 0);
}

// Indique si un index appartient au camp adverse du joueur p
function isInOpponentCamp(p, idx) {
  const [os, oe] = opponentRange(p);
  return idx >= os && idx <= oe;
}

// ====================
// SIMULATION D'UN COUP
// (corrigée : tour complet géré correctement)
// ====================

function simulateMove(b, startIdx, p) {
  let tmp = [...b];
  let seeds = tmp[startIdx];
  tmp[startIdx] = 0;

  const seq = SEQ[p];
  const startPos = seq.indexOf(startIdx);
  const totalLen = seq.length; // 14

  // Indices des cases du camp adverse dans la séquence
  // Pour J1 : cases 7-13 sont aux positions 7-13 de la séquence
  // Pour J2 : cases 0-6 sont aux positions 7-13 de la séquence
  // Dans les deux cas, le camp adverse = positions 7 à 13 de SEQ[p]
  const oppStartPos = 7; // position dans la séquence où commence le camp adverse
  const [os, oe] = opponentRange(p);

  let opSeeds = 0;
  let cur = startIdx;
  let last = startIdx;

  const fullTours = Math.floor(seeds / 13); // nombre de tours complets (on saute la case de départ, donc 13 cases par tour)
  const remainder = seeds % 13;

  if (fullTours === 0) {
    // Cas normal : moins de 14 graines, pas de tour complet
    for (let i = 0; i < seeds; i++) {
      // Avancer d'une case dans la séquence, en sautant startIdx
      let nextPos = (seq.indexOf(cur) + 1) % 14;
      while (seq[nextPos] === startIdx) {
        nextPos = (nextPos + 1) % 14;
      }
      cur = seq[nextPos];
      tmp[cur]++;
      if (isInOpponentCamp(p, cur)) opSeeds++;
    }
    last = cur;
  } else {
    // Tour(s) complet(s) : distribuer d'abord les tours complets (13 cases par tour, case départ sautée)
    // Puis continuer UNIQUEMENT dans le camp adverse depuis sa première case (leftmost)
    // "depuis la gauche jusqu'à épuisement des graines, quitte à la répéter depuis la gauche"

    // Phase 1 : tours complets (on distribue dans les 13 cases ≠ startIdx)
    const seqWithoutStart = [...seq.slice(0, seq.indexOf(startIdx)), ...seq.slice(seq.indexOf(startIdx) + 1)];
    // seqWithoutStart contient 13 cases dans l'ordre de semis, sans la case de départ

    for (let t = 0; t < fullTours; t++) {
      for (let i = 0; i < 13; i++) {
        tmp[seqWithoutStart[i]]++;
        if (isInOpponentCamp(p, seqWithoutStart[i])) opSeeds++;
      }
    }

    // Phase 2 : distribution du reste UNIQUEMENT dans le camp adverse, depuis la gauche
    // Camp adverse dans l'ordre de semis = positions oppStartPos à 13 de SEQ[p]
    const oppSeq = seq.slice(oppStartPos); // 7 cases adverses dans l'ordre de semis

    let rem = remainder;
    let oppIdx = 0;
    while (rem > 0) {
      const idx = oppSeq[oppIdx % oppSeq.length];
      tmp[idx]++;
      opSeeds++;
      last = idx;
      rem--;
      oppIdx++;
    }

    if (remainder === 0) {
      // Toutes les graines sont tombées dans le tour complet, la dernière est seqWithoutStart[12]
      last = seqWithoutStart[seqWithoutStart.length - 1];
    }
  }

  return { board: tmp, last, opSeeds, fullTour: fullTours > 0 };
}

function getMoves(p) {
  const [s, e] = playerRange(p);
  let moves = [];

  for (let i = s; i <= e; i++) {
    if (board[i] > 0) {
      const r = simulateMove(board, i, p);
      moves.push({ idx: i, seeds: board[i], opSeeds: r.opSeeds, sim: r });
    }
  }

  return moves;
}

// ====================
// RÈGLE : INTERDIT case 7 du joueur (sa dernière case côté frontière)
// Case 7 de J1 = index 6 (sa 7e case, cases 0→6)
// Case 7 de J2 = index 13 (sa 7e case, cases 7→13)
// ====================

function frontierIndex(p) {
  return p === 1 ? 6 : 13;
}

function isForbidden(idx, p) {
  if (idx !== frontierIndex(p)) return false;
  return board[idx] === 1 || board[idx] === 2;
}

// ====================
// RÈGLE DE SOLIDARITÉ
// ====================

function solidarityCheck(p) {
  const opp = 3 - p;
  if (hasSeeds(opp)) return { forced: null, end: false, strict: false };

  const moves = getMoves(p);
  if (moves.length === 0) return { forced: null, end: true };

  const valid = moves.filter(m => m.opSeeds >= 7 && !isForbidden(m.idx, p));
  if (valid.length > 0) {
    return { forced: valid.map(m => m.idx), end: false, strict: false };
  }

  // Aucun coup n'atteint 7 graines : on prend le meilleur
  const best = moves.reduce((a, b) => a.opSeeds > b.opSeeds ? a : b);
  return { forced: [best.idx], end: false, strict: true };
}

// ====================
// CAPTURES
// (corrigée : sens de chaîne selon le joueur, case spéciale correcte)
//
// Règle :
// - Prise si dernière graine tombe chez l'adversaire dans une case contenant 1 à 3 graines
//   (la graine vient d'être déposée, donc on a 2 à 4 au total)
// - Pas de prise dans la case n°1 adverse (la plus à gauche du joueur adverse)
//   SAUF si elle est incluse dans une chaîne ou si tour complet (≥14 graines)
// - Prise à la chaîne : cases précédentes (dans le sens opposé au semis) avec 2 à 4 graines
// - Interdit de vider entièrement le camp adverse
//
// Case n°1 adverse (celle la plus à GAUCHE du point de vue du joueur adverse) :
//   Pour J1 (sème 7→8→...→13 chez l'adversaire) : la case la plus à gauche du camp adverse = 7
//   Pour J2 (sème 6→5→...→0 chez l'adversaire) : la case la plus à gauche du camp adverse = 0
//
// Sens de la chaîne (on remonte en sens inverse du semis chez l'adversaire) :
//   Pour J1 dans camp adverse (7→8→...→13) : on remonte 13→12→...→7 donc cur--
//   Pour J2 dans camp adverse (6→5→...→0) : on remonte 0→1→...→6 donc cur++
// ====================

function specialIndex(p) {
  // Case n°1 adverse = première case distribuée chez l'adversaire
  // J1 : 7 (première case adverse dans la séquence J1)
  // J2 : 6 (première case adverse dans la séquence J2)
  return p === 1 ? 7 : 6;
}

function doCapture(b, lastIdx, p, seedsPlayed) {
  const [os, oe] = opponentRange(p);
  const specIdx = specialIndex(p);
  let tmp = [...b];
  let captured = 0;

  // Pas dans le camp adverse = pas de capture
  if (!isInOpponentCamp(p, lastIdx)) {
    return { board: tmp, captured: 0 };
  }

  // Pas de capture si camp adverse vide (au moment de la prise)
  if (!tmp.slice(os, oe + 1).some(v => v > 0)) {
    return { board: tmp, captured: 0 };
  }

  // Cas spécial : tour complet ET dernière graine sur la case spéciale → 1 seule graine prise
  if (lastIdx === specIdx && seedsPlayed >= 14) {
    const testBoard = [...tmp];
    testBoard[lastIdx] = 0;
    const oppStillHasSeeds = testBoard.slice(os, oe + 1).some(v => v > 0);
    if (oppStillHasSeeds) {
      tmp[lastIdx] = 0;
      return { board: tmp, captured: 1, special: true };
    }
    return { board: tmp, captured: 0 };
  }

  // La case spéciale ne peut pas être la PREMIÈRE case capturée
  // (elle peut être incluse dans une chaîne)
  if (lastIdx === specIdx) {
    return { board: tmp, captured: 0 };
  }

  // Prise normale + chaîne
  // On remonte dans le sens inverse du semis chez l'adversaire :
  //   J1 sème chez l'adversaire en croissant (7→13), on remonte en décroissant (cur--)
  //   J2 sème chez l'adversaire en décroissant (6→0), on remonte en croissant (cur++)
  const step = p === 1 ? -1 : 1;
  let cur = lastIdx;
  let isChain = false;

  while (true) {
    // Hors du camp adverse : arrêt
    if (!isInOpponentCamp(p, cur)) break;

    const count = tmp[cur];

    // Case spéciale : ne peut pas être la première capturée, mais peut être dans une chaîne
    if (cur === specIdx && !isChain) break;

    // Prise si 2 à 4 graines (la graine vient d'être déposée, count inclut déjà la dernière graine)
    if (count >= 2 && count <= 4) {
      // Vérifier que la capture ne viderait pas entièrement le camp adverse
      const testBoard = [...tmp];
      testBoard[cur] = 0;
      const oppStillHasSeeds = testBoard.slice(os, oe + 1).some(v => v > 0);
      if (!oppStillHasSeeds) break;

      captured += count;
      tmp[cur] = 0;
      cur += step; // remonter dans le sens inverse du semis
      isChain = true;
    } else {
      break;
    }
  }

  return { board: tmp, captured };
}

// ====================
// CLIC SUR UNE CASE
// ====================

function handleClick(idx) {
  if (gameOver) return;

  const [s, e] = playerRange(currentPlayer);
  if (idx < s || idx > e) {
    showMsg("Ce n'est pas votre camp.", "error");
    return;
  }

  if (board[idx] === 0) {
    showMsg("Cette case est vide.", "error");
    return;
  }

  const sol = solidarityCheck(currentPlayer);

  if (sol.end) {
    endGame("Fin de partie : solidarité impossible.");
    return;
  }

  // Solidarité : coup forcé parmi une liste de cases valides
  if (sol.forced && !sol.forced.includes(idx)) {
    showMsg("⚠ Coup de solidarité requis — choisissez une autre case.", "error");
    return;
  }

  // Coup interdit (1-2 graines depuis la case frontière)
  if (isForbidden(idx, currentPlayer)) {
    if (sol.strict && sol.forced && sol.forced.includes(idx)) {
      // Seul coup possible mais interdit → graines à l'adversaire
      const opp = 3 - currentPlayer;
      scores[opp - 1] += board[idx];
      board[idx] = 0;
      showMsg("⚠ Coup interdit forcé : graines données à l'adversaire.", "error");
      updateScoreDisplay();
      nextTurn();
      return;
    }
    showMsg("❌ Interdit : 1 ou 2 graines depuis la case frontière.", "error");
    return;
  }

  // --- Coup valide ---
  const seedsPlayed = board[idx];
  const sim = simulateMove(board, idx, currentPlayer);
  board = sim.board;
  lastPit = sim.last;

  const capResult = doCapture(board, sim.last, currentPlayer, seedsPlayed);
  board = capResult.board;

  if (capResult.captured > 0) {
    scores[currentPlayer - 1] += capResult.captured;
    const s2 = capResult.captured > 1 ? "s" : "";
    showMsg(`+${capResult.captured} graine${s2} capturée${s2}`, "capture");
  } else {
    showMsg("");
  }

  updateScoreDisplay();

  // Victoire immédiate si ≥ 40 graines
  if (scores[currentPlayer - 1] >= 40) {
    endGame(`Joueur ${currentPlayer} gagne !`, true);
    return;
  }

  // Fin si moins de 10 graines au total
  if (totalSeeds() < 10) {
    giveRemainingSeeds();
    return;
  }

  nextTurn();
}

// ====================
// PASSAGE AU TOUR SUIVANT
// ====================

function nextTurn() {
  currentPlayer = 3 - currentPlayer;

  const sol = solidarityCheck(currentPlayer);
  if (sol.end) {
    endGame("Fin de partie : solidarité impossible.");
    return;
  }

  if (!hasSeeds(currentPlayer)) {
    endGame(`Joueur ${currentPlayer} ne peut plus jouer.`);
    return;
  }

  render();

  if (!document.getElementById("msg").textContent) {
    showMsg(`Tour du Joueur ${currentPlayer}`);
  }
}

// ====================
// FIN DE PARTIE
// ====================

function giveRemainingSeeds() {
  for (let i = 0; i <= 6; i++) { scores[0] += board[i]; board[i] = 0; }
  for (let i = 7; i <= 13; i++) { scores[1] += board[i]; board[i] = 0; }
  updateScoreDisplay();
  render();

  if (scores[0] >= 40) { endGame("Joueur 1 gagne !", true); return; }
  if (scores[1] >= 40) { endGame("Joueur 2 gagne !", true); return; }
  if (scores[0] === scores[1]) { endGame("Match nul !"); return; }
  endGame(`Joueur ${scores[0] > scores[1] ? 1 : 2} gagne !`, true);
}

function endGame(msg, isWin) {
  gameOver = true;
  showMsg(msg, isWin ? "win" : "");
  render();
}

// ====================
// AFFICHAGE
// ====================

function showMsg(text, cls) {
  const el = document.getElementById("msg");
  el.className = "msg" + (cls ? " " + cls : "");
  el.textContent = text;
}

function updateScoreDisplay() {
  document.getElementById("sv1").textContent = scores[0];
  document.getElementById("sv2").textContent = scores[1];
}

function render() {
  const topRow = document.getElementById("top-row");
  const botRow = document.getElementById("bot-row");
  topRow.innerHTML = "";
  botRow.innerHTML = "";

  updateScoreDisplay();

  document.getElementById("p1row").className =
    "player-row" + (currentPlayer === 1 ? " active" : "");
  document.getElementById("p2row").className =
    "player-row" + (currentPlayer === 2 ? " active" : "");

  // Rangée du haut : joueur 2 (cases 13 → 7, affichées de gauche à droite)
  for (let i = 13; i >= 7; i--) topRow.appendChild(makePit(i, 2));

  // Rangée du bas : joueur 1 (cases 0 → 6)
  for (let i = 0; i <= 6; i++) botRow.appendChild(makePit(i, 1));
}

function makePit(idx, owner) {
  const div = document.createElement("div");
  div.className = "pit";

  if (board[idx] === 0) div.classList.add("empty");
  if (gameOver) div.classList.add("disabled");
  if (idx === lastPit && !gameOver) div.classList.add("last-pit");

  const isActivePlayer = currentPlayer === owner;
  if (isActivePlayer && !gameOver) div.classList.add("active-player");

  // Numéro de case (1 à 7 pour chaque joueur)
  // J1 : index 0 = C1, index 6 = C7
  // J2 : index 13 = C1, index 7 = C7
  const label = document.createElement("span");
  label.className = "pit-label";
  label.textContent = idx <= 6 ? `C${idx + 1}` : `C${14 - idx}`;

  div.textContent = board[idx];
  div.appendChild(label);

  if (isActivePlayer && board[idx] > 0 && !gameOver) {
    div.addEventListener("click", () => handleClick(idx));
  } else {
    div.classList.add("disabled");
  }

  // Marquer visuellement la case frontière (case 7 du joueur)
  if (idx === frontierIndex(owner)) {
    div.classList.add("frontier");
  }

  return div;
}

// ====================
// DÉMARRAGE
// ====================

initGame();
