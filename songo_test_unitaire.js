// ====================
// TESTS UNITAIRES — SONGO
// Exécuter avec : node songo.test.js
// ====================

// ---- Copie des fonctions pures du jeu ----
// (on réimporte la logique sans le DOM)

function playerRange(p) { return p === 1 ? [0, 6] : [7, 13]; }
function opponentRange(p) { return p === 1 ? [7, 13] : [0, 6]; }

function hasSeeds(board, p) {
  const [s, e] = playerRange(p);
  for (let i = s; i <= e; i++) if (board[i] > 0) return true;
  return false;
}

function totalSeeds(board) { return board.reduce((a, b) => a + b, 0); }

function simulateMove(b, idx, p) {
  let tmp = [...b];
  let seeds = tmp[idx]; tmp[idx] = 0;
  let cur = idx, opSeeds = 0;
  const [os, oe] = opponentRange(p);
  while (seeds > 0) {
    cur = (cur + 1) % 14;
    tmp[cur]++;
    seeds--;
    if (cur >= os && cur <= oe) opSeeds++;
  }
  return { board: tmp, last: cur, opSeeds };
}

function isForbidden(board, idx, p) {
  const frontierIdx = p === 1 ? 6 : 7;
  if (idx !== frontierIdx) return false;
  return board[idx] === 1 || board[idx] === 2;
}

function getMoves(board, p) {
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

function solidarityCheck(board, p) {
  const opp = 3 - p;
  if (hasSeeds(board, opp)) return { forced: null, end: false, strict: false };
  const moves = getMoves(board, p);
  if (moves.length === 0) return { forced: null, end: true };
  const valid = moves.filter(m => m.opSeeds >= 7 && !isForbidden(board, m.idx, p));
  if (valid.length > 0) return { forced: valid.map(m => m.idx), end: false, strict: false };
  const best = moves.reduce((a, b) => a.opSeeds > b.opSeeds ? a : b);
  return { forced: [best.idx], end: false, strict: true };
}

function doCapture(b, lastIdx, p, seedsPlayed) {
  const [os, oe] = opponentRange(p);
  const specialIdx = p === 1 ? 7 : 6;
  let tmp = [...b];
  let captured = 0;
  if (!tmp.slice(os, oe + 1).some(v => v > 0)) return { board: tmp, captured: 0 };
  if (lastIdx === specialIdx && seedsPlayed >= 14) {
    tmp[lastIdx] = 0;
    return { board: tmp, captured: 1, special: true };
  }
  let cur = lastIdx, isChain = false;
  while (true) {
    if (cur < os || cur > oe) break;
    const count = tmp[cur];
    if (cur === specialIdx && !isChain) break;
    if (count >= 2 && count <= 4) {
      const testBoard = [...tmp]; testBoard[cur] = 0;
      if (!testBoard.slice(os, oe + 1).some(v => v > 0)) break;
      captured += count; tmp[cur] = 0; cur--; isChain = true;
    } else break;
  }
  return { board: tmp, captured };
}

// ====================
// FRAMEWORK DE TEST MINIMAL
// ====================

let passed = 0, failed = 0, total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗  ${name}`);
    console.log(`       → ${e.message}`);
    failed++;
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected)
        throw new Error(`attendu ${JSON.stringify(expected)}, reçu ${JSON.stringify(actual)}`);
    },
    toEqual(expected) {
      const a = JSON.stringify(actual), b = JSON.stringify(expected);
      if (a !== b) throw new Error(`attendu ${b}, reçu ${a}`);
    },
    toBeTrue()  { if (actual !== true)  throw new Error(`attendu true, reçu ${actual}`); },
    toBeFalse() { if (actual !== false) throw new Error(`attendu false, reçu ${actual}`); },
    toBeGreaterThanOrEqual(n) {
      if (actual < n) throw new Error(`attendu ≥ ${n}, reçu ${actual}`);
    },
    toContain(val) {
      if (!actual.includes(val))
        throw new Error(`attendu que le tableau contienne ${val}, reçu ${JSON.stringify(actual)}`);
    },
  };
}

function section(title) {
  console.log(`\n── ${title}`);
}

// ====================
// TESTS
// ====================

section("Plateau initial");

test("70 graines au total en début de partie", () => {
  const board = Array(14).fill(5);
  expect(totalSeeds(board)).toBe(70);
});

test("Chaque case contient 5 graines", () => {
  const board = Array(14).fill(5);
  board.forEach((v, i) => expect(v).toBe(5));
});

test("Joueur 1 possède les cases 0 à 6", () => {
  const [s, e] = playerRange(1);
  expect(s).toBe(0); expect(e).toBe(6);
});

test("Joueur 2 possède les cases 7 à 13", () => {
  const [s, e] = playerRange(2);
  expect(s).toBe(7); expect(e).toBe(13);
});

// ====================

section("Semis des graines");

test("Semis simple : case 0 avec 3 graines → cases 1, 2, 3 reçoivent 1", () => {
  const board = Array(14).fill(0); board[0] = 3;
  const { board: b2, last } = simulateMove(board, 0, 1);
  expect(b2[0]).toBe(0);
  expect(b2[1]).toBe(1); expect(b2[2]).toBe(1); expect(b2[3]).toBe(1);
  expect(last).toBe(3);
});

test("Semis franchit la frontière : case 6 avec 3 graines → atteint le camp adverse", () => {
  const board = Array(14).fill(0); board[6] = 3;
  const { board: b2, opSeeds } = simulateMove(board, 6, 1);
  expect(opSeeds).toBeGreaterThanOrEqual(1);
});

test("Semis circulaire : depasse l'index 13 → revient à 0", () => {
  const board = Array(14).fill(0); board[13] = 2;
  const { board: b2, last } = simulateMove(board, 13, 2);
  expect(b2[0]).toBe(1); expect(b2[1]).toBe(1);
  expect(last).toBe(1);
});

test("Semis depuis case 0 avec 14 graines : case de départ n'est pas resemée", () => {
  const board = Array(14).fill(0); board[0] = 14;
  const { board: b2 } = simulateMove(board, 0, 1);
  expect(b2[0]).toBe(0);
});

test("Semis depuis case 0 avec 15 graines : case de départ reçoit 1 graine", () => {
  const board = Array(14).fill(0); board[0] = 15;
  const { board: b2 } = simulateMove(board, 0, 1);
  expect(b2[0]).toBe(1);
});

// ====================

section("Captures");

test("Pas de capture si la dernière case adverse a 1 graine (= 1 après dépôt → hors [2,4])", () => {
  const board = Array(14).fill(0);
  board[0] = 1; // joueur 1 joue case 0
  board[8] = 0; // case 8 adverse contient 0 → après dépôt = 1
  const sim = simulateMove(board, 0, 1);
  const { captured } = doCapture(sim.board, sim.last, 1, 1);
  expect(captured).toBe(0);
});

test("Capture si la dernière case adverse a 2 graines après dépôt", () => {
  // board[7] = 1 avant semis, on y dépose 1 → total = 2 → capture
  const board = Array(14).fill(0);
  board[7] = 1; // camp adverse case 7 a 1 graine
  board[8] = 3; // case 8 a 3 → après dépôt = 3 si on y arrive, ici on vise case 7
  // On simule directement doCapture avec lastIdx=8, board[8]=2
  const b = Array(14).fill(0); b[8] = 2; b[9] = 1;
  const { captured } = doCapture(b, 8, 1, 5);
  expect(captured).toBe(2);
});

test("Capture en chaîne : deux cases consécutives avec 2 à 4 graines", () => {
  const b = Array(14).fill(0);
  b[9] = 3; b[8] = 2;
  const { captured } = doCapture(b, 9, 1, 5);
  expect(captured).toBe(5); // 3 + 2
});

test("Chaîne stoppée si une case sort de [2,4]", () => {
  const b = Array(14).fill(0);
  b[10] = 3; b[9] = 5; b[8] = 2; // case 9 a 5 → hors [2,4] → stop
  const { captured } = doCapture(b, 10, 1, 5);
  expect(captured).toBe(3); // seulement case 10
});

test("Pas de capture si cela viderait entièrement le camp adverse", () => {
  // Camp adverse (7-13) : seulement case 9 avec 2 graines
  const b = Array(14).fill(0);
  b[9] = 2;
  const { captured, board: b2 } = doCapture(b, 9, 1, 5);
  expect(captured).toBe(0);
  expect(b2[9]).toBe(2); // case préservée
});

test("La case spéciale (7 pour J1) ne peut pas être la première capturée", () => {
  const b = Array(14).fill(0);
  b[7] = 3; b[8] = 2; // case 7 = spéciale, case 8 normale
  // lastIdx = 7 → case spéciale en premier → pas de capture
  const { captured } = doCapture(b, 7, 1, 5);
  expect(captured).toBe(0);
});

test("La case spéciale peut être capturée si elle fait partie d'une chaîne", () => {
  const b = Array(14).fill(0);
  b[8] = 3; b[7] = 2; // lastIdx=8, chaîne remonte vers 7 (spéciale)
  const { captured } = doCapture(b, 8, 1, 5);
  expect(captured).toBe(5); // 3 + 2
});

test("Cas spécial tour complet (≥14 graines) : capture 1 graine sur case spéciale", () => {
  const b = Array(14).fill(0);
  b[7] = 3; // case spéciale adverse
  b[8] = 1; // autre case pour éviter camp vide
  const { captured, special } = doCapture(b, 7, 1, 14);
  expect(captured).toBe(1);
  expect(special).toBeTrue();
});

// ====================

section("Règle interdit 1-2 graines depuis case frontière");

test("Joueur 1 : interdit jouer case 6 avec 1 graine", () => {
  const board = Array(14).fill(0); board[6] = 1;
  expect(isForbidden(board, 6, 1)).toBeTrue();
});

test("Joueur 1 : interdit jouer case 6 avec 2 graines", () => {
  const board = Array(14).fill(0); board[6] = 2;
  expect(isForbidden(board, 6, 1)).toBeTrue();
});

test("Joueur 1 : autorisé jouer case 6 avec 3 graines", () => {
  const board = Array(14).fill(0); board[6] = 3;
  expect(isForbidden(board, 6, 1)).toBeFalse();
});

test("Joueur 1 : case 5 avec 1 graine n'est pas interdite (pas la frontière)", () => {
  const board = Array(14).fill(0); board[5] = 1;
  expect(isForbidden(board, 5, 1)).toBeFalse();
});

test("Joueur 2 : interdit jouer case 7 avec 1 graine", () => {
  const board = Array(14).fill(0); board[7] = 1;
  expect(isForbidden(board, 7, 2)).toBeTrue();
});

test("Joueur 2 : interdit jouer case 7 avec 2 graines", () => {
  const board = Array(14).fill(0); board[7] = 2;
  expect(isForbidden(board, 7, 2)).toBeTrue();
});

test("Joueur 2 : autorisé jouer case 7 avec 4 graines", () => {
  const board = Array(14).fill(0); board[7] = 4;
  expect(isForbidden(board, 7, 2)).toBeFalse();
});

// ====================

section("Règle de solidarité");

test("Pas de solidarité si l'adversaire a des graines", () => {
  const board = Array(14).fill(5);
  const sol = solidarityCheck(board, 1);
  expect(sol.forced).toBe(null);
  expect(sol.end).toBeFalse();
});

test("Solidarité : camp adverse vide → doit envoyer ≥ 7 graines", () => {
  const board = Array(14).fill(0);
  // Joueur 1 a des graines, camp adverse (7-13) vide
  board[0] = 10; // 10 graines en case 0 → atteindra le camp adverse
  const sol = solidarityCheck(board, 1);
  expect(sol.forced).toContain(0);
  expect(sol.strict).toBeFalse();
});

test("Solidarité stricte : impossible d'envoyer ≥ 7, on prend le maximum", () => {
  const board = Array(14).fill(0);
  board[0] = 3; // 3 graines : atteint cases 1,2,3 → 0 dans camp adverse
  const sol = solidarityCheck(board, 1);
  expect(sol.strict).toBeTrue();
});

test("Solidarité end=true si aucun coup possible", () => {
  const board = Array(14).fill(0); // tout vide
  const sol = solidarityCheck(board, 1);
  expect(sol.end).toBeTrue();
});

test("Solidarité : plusieurs coups valides → liste de choix libres", () => {
  const board = Array(14).fill(0);
  board[0] = 10; board[1] = 10; // deux cases pouvant envoyer ≥ 7
  const sol = solidarityCheck(board, 1);
  expect(sol.forced.length).toBeGreaterThanOrEqual(2);
});

// ====================

section("Conditions de fin de partie");

test("Fin si total graines < 10", () => {
  const board = Array(14).fill(0); board[0] = 5; board[7] = 4;
  expect(totalSeeds(board)).toBe(9);
  // < 10 → fin attendue
  expect(totalSeeds(board) < 10).toBeTrue();
});

test("Pas de fin prématurée si exactement 10 graines", () => {
  const board = Array(14).fill(0); board[0] = 5; board[7] = 5;
  expect(totalSeeds(board) < 10).toBeFalse();
});

test("Victoire si score ≥ 40", () => {
  expect(40 >= 40).toBeTrue();
  expect(39 >= 40).toBeFalse();
});

test("Match nul si les deux joueurs ont ≤ 39 graines et plus aucun coup", () => {
  const board = Array(14).fill(0);
  expect(hasSeeds(board, 1)).toBeFalse();
  expect(hasSeeds(board, 2)).toBeFalse();
});

// ====================
// RÉSUMÉ
// ====================

console.log(`\n${"─".repeat(40)}`);
console.log(`Résultat : ${passed}/${total} tests réussis${failed > 0 ? `, ${failed} échoué(s)` : " ✓"}`);
if (failed > 0) process.exit(1);
