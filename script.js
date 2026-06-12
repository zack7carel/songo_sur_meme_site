// =====================================================
// CONFIGURATION BACKEND
// =====================================================
// Remplacez cette URL par l'URL de votre Web Service Render
// ex : https://songo-backend.onrender.com
const API_URL = 'https://songo-sur-meme-site1-0.onrender.com';

// =====================================================
// ÉTAT EN LIGNE
// =====================================================
let onlineMode    = false;
let myPlayerNum   = null;   // 1 ou 2
let roomCode      = null;
let pollInterval  = null;
let lastStateHash = null;

// =====================================================
// AJAX helpers
// =====================================================

async function apiGet(path) {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

async function apiPost(path, data) {
  const res = await fetch(`${API_URL}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
  return res.json();
}

async function apiPatch(path, data) {
  const res = await fetch(`${API_URL}${path}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status}`);
  return res.json();
}

async function apiDelete(path) {
  await fetch(`${API_URL}${path}`, { method: 'DELETE' });
}

// =====================================================
// CODE DE SALLE
// =====================================================

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// =====================================================
// CRÉER UNE PARTIE EN LIGNE
// =====================================================

async function createOnlineGame() {
  const createCard  = document.getElementById('online-create-card');
  const waitingDiv  = document.getElementById('online-waiting');
  const codeDisplay = document.getElementById('waiting-code-display');
  const errorEl     = document.getElementById('join-error');

  roomCode    = generateRoomCode();
  myPlayerNum = 1;

  const state = buildInitialState();
  state.player1joined = true;
  state.player2joined = false;

  try {
    await apiPost('/rooms', { code: roomCode, state });
  } catch(e) {
    errorEl.textContent = 'Impossible de créer la partie. Vérifiez votre connexion.';
    return;
  }

  createCard.style.display = 'none';
  waitingDiv.style.display = 'flex';
  codeDisplay.textContent  = roomCode;

  // Polling : attendre que le joueur 2 rejoigne
  pollInterval = setInterval(async () => {
    try {
      const s = await apiGet(`/rooms/${roomCode}`);
      if (s && s.player2joined) {
        clearInterval(pollInterval);
        pollInterval = null;
        waitingDiv.style.display = 'none';
        startOnlineSession(s);
      }
    } catch(e) { /* retry silencieux */ }
  }, 2000);
}

// =====================================================
// REJOINDRE UNE PARTIE
// =====================================================

async function joinOnlineGame() {
  const input   = document.getElementById('join-code-input');
  const errorEl = document.getElementById('join-error');
  const code    = input.value.trim().toUpperCase();
  errorEl.textContent = '';

  if (code.length < 6) { errorEl.textContent = 'Code invalide (6 caractères requis).'; return; }

  let state;
  try {
    state = await apiGet(`/rooms/${code}`);
  } catch(e) {
    errorEl.textContent = 'Aucune partie trouvée avec ce code.';
    return;
  }

  if (state.player2joined) { errorEl.textContent = 'Cette partie est déjà complète.'; return; }
  if (state.gameOver)      { errorEl.textContent = 'Cette partie est déjà terminée.';  return; }

  roomCode    = code;
  myPlayerNum = 2;

  try {
    await apiPatch(`/rooms/${roomCode}`, { player2joined: true });
  } catch(e) {
    errorEl.textContent = 'Erreur lors de la connexion à la partie.';
    return;
  }

  startOnlineSession(state);
}

// =====================================================
// DÉMARRER LA SESSION EN LIGNE
// =====================================================

function startOnlineSession(initialState) {
  onlineMode = true;
  showPage('page-game');
  applyStateFromRemote(initialState);

  document.getElementById('online-badge').style.display = 'inline-block';
  document.getElementById('restart-btn').style.display  = 'none';

  const me  = myPlayerNum === 1 ? 'Moi'        : 'Adversaire';
  const adv = myPlayerNum === 1 ? 'Adversaire' : 'Moi';
  document.getElementById('sc1-label').textContent       = `${me} (J1)`;
  document.getElementById('sc2-label').textContent       = `${adv} (J2)`;
  document.getElementById('p1row').firstChild.textContent = `${me} (J1) `;
  document.getElementById('p2row').firstChild.textContent = `${adv} (J2) `;

  // Polling de l'état toutes les 1,5 s
  pollInterval = setInterval(pollGameState, 1500);
}

async function pollGameState() {
  if (!roomCode) return;
  try {
    const state = await apiGet(`/rooms/${roomCode}`);
    const hash  = JSON.stringify(state);
    if (hash === lastStateHash) return;
    lastStateHash = hash;
    applyStateFromRemote(state);
  } catch(e) { /* réseau instable, on réessaie */ }
}

// =====================================================
// APPLIQUER UN ÉTAT REÇU DU BACKEND
// =====================================================

function applyStateFromRemote(state) {
  board         = state.board;
  currentPlayer = state.currentPlayer;
  scores        = state.scores;
  lastPit       = state.lastPit;
  gameOver      = state.gameOver;

  render();
  updateScoreDisplay();

  if (state.lastMsg) showMsg(state.lastMsg.text, state.lastMsg.cls);

  if (gameOver && state.resultData) {
    clearInterval(pollInterval);
    pollInterval = null;
    saveGame(state.resultData);
    setTimeout(() => openModal(state.resultData), 350);
  } else if (!gameOver && onlineMode) {
    if (currentPlayer === myPlayerNum) {
      showMsg("C'est votre tour !", 'capture');
    } else {
      showMsg("En attente de l'adversaire…", 'waiting-online');
    }
  }
}

// =====================================================
// PUBLIER L'ÉTAT SUR LE BACKEND
// =====================================================

async function pushState(msg, msgCls) {
  if (!onlineMode || !roomCode) return;
  try {
    await apiPatch(`/rooms/${roomCode}`, {
      board, currentPlayer, scores, lastPit, gameOver,
      lastMsg: { text: msg || '', cls: msgCls || '' }
    });
  } catch(e) {}
}

async function pushEndState(resultData, msg) {
  if (!onlineMode || !roomCode) return;
  try {
    await apiPatch(`/rooms/${roomCode}`, {
      board, currentPlayer, scores, lastPit, gameOver: true,
      lastMsg: { text: msg || '', cls: 'win' },
      resultData
    });
  } catch(e) {}
}

// =====================================================
// ANNULER / COPIER
// =====================================================

async function cancelOnlineGame() {
  clearInterval(pollInterval);
  pollInterval = null;
  if (roomCode) {
    try { await apiDelete(`/rooms/${roomCode}`); } catch(e) {}
    roomCode = null;
  }
  document.getElementById('online-waiting').style.display      = 'none';
  document.getElementById('online-create-card').style.display  = '';
  document.getElementById('join-code-input').value             = '';
  document.getElementById('join-error').textContent            = '';
}

function copyRoomCode() {
  navigator.clipboard.writeText(roomCode).then(() => {
    const btn = document.querySelector('.btn-copy');
    btn.textContent = '✅ Copié !';
    setTimeout(() => { btn.textContent = '📋 Copier le code'; }, 2000);
  });
}

// =====================================================
// ÉTAT INITIAL
// =====================================================

function buildInitialState() {
  return {
    board:         Array(14).fill(5),
    currentPlayer: 1,
    scores:        [0, 0],
    lastPit:       -1,
    gameOver:      false,
    lastMsg:       { text: 'Tour du Joueur 1', cls: '' },
    resultData:    null
  };
}

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
  stopOnlineMode();
  showPage('page-home');
}

function stopOnlineMode() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
  onlineMode    = false;
  myPlayerNum   = null;
  roomCode      = null;
  lastStateHash = null;
  document.getElementById('online-badge').style.display       = 'none';
  document.getElementById('restart-btn').style.display        = '';
  document.getElementById('sc1-label').textContent            = 'Joueur 1';
  document.getElementById('sc2-label').textContent            = 'Joueur 2';
  document.getElementById('p1row').firstChild.textContent     = 'Joueur 1 ';
  document.getElementById('p2row').firstChild.textContent     = 'Joueur 2 ';
  document.getElementById('online-waiting').style.display     = 'none';
  document.getElementById('online-create-card').style.display = '';
  document.getElementById('join-code-input').value            = '';
  document.getElementById('join-error').textContent           = '';
}

function confirmLeave() {
  if (!gameOver && totalSeeds() < 70) {
    if (!confirm('Abandonner la partie en cours ?')) return;
  }
  stopOnlineMode();
  showPage('page-home');
}

function confirmRestart() {
  if (onlineMode) return;
  if (!gameOver && totalSeeds() < 70) {
    if (!confirm('Abandonner la partie et en commencer une nouvelle ?')) return;
  }
  startNewGame();
}

function startNewGame() {
  closeModal();
  stopOnlineMode();
  showPage('page-game');
  initGame();
}

// =====================================================
// HISTORIQUE
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
  const hist      = loadHistory();
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
        <div class="hist-board"><div class="hist-board-rows">
          <div class="hist-board-row">
            <span class="hist-player-lbl">J2</span>
            ${[13,12,11,10,9,8,7].map(i=>`<div class="hist-pit-mini${g.board[i]===0?' empty':''}">${g.board[i]}</div>`).join('')}
          </div>
          <div class="hist-board-row">
            <span class="hist-player-lbl">J1</span>
            ${[0,1,2,3,4,5,6].map(i=>`<div class="hist-pit-mini${g.board[i]===0?' empty':''}">${g.board[i]}</div>`).join('')}
          </div>
        </div></div>`;
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
  html += '</div><button class="hist-clear-btn" onclick="clearHistory()">Effacer l\'historique</button>';
  contentEl.innerHTML = html;
}

// =====================================================
// MODALE
// =====================================================

function openModal(resultData) {
  const { winner, scores: sc, reason, isDraw } = resultData;
  document.getElementById('modal-emoji').textContent = isDraw ? '🤝' : '🏆';
  document.getElementById('modal-title').textContent = isDraw ? 'Match nul !' : `Joueur ${winner} gagne !`;
  document.getElementById('modal-sub').textContent   = isDraw ? 'Les deux joueurs sont à égalité' : `Victoire du Joueur ${winner}`;
  document.getElementById('modal-scores-row').innerHTML = `
    <div class="modal-player-score">
      <div class="lbl">Joueur 1</div>
      <div class="val${winner===1?' winner':''}">${sc[0]}</div>
    </div>
    <div class="modal-sep">·</div>
    <div class="modal-player-score">
      <div class="lbl">Joueur 2</div>
      <div class="val${winner===2?' winner':''}">${sc[1]}</div>
    </div>`;
  document.getElementById('modal-reason').textContent = reason || '';
  document.getElementById('modal-new-btn').style.display = onlineMode ? 'none' : '';
  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

document.getElementById('modal-overlay').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// =====================================================
// ÉTAT DU JEU
// =====================================================

let board, currentPlayer, scores, lastPit, gameOver;

const SEQ = {
  1: [6,5,4,3,2,1,0,7,8,9,10,11,12,13],
  2: [13,12,11,10,9,8,7,0,1,2,3,4,5,6]
};

function playerRange(p)   { return p===1 ? [0,6]  : [7,13]; }
function opponentRange(p) { return p===1 ? [7,13] : [0,6];  }
function isInOpponentCamp(p,idx) { const [os,oe]=opponentRange(p); return idx>=os&&idx<=oe; }

function initGame() {
  board=Array(14).fill(5); currentPlayer=1; scores=[0,0]; lastPit=-1; gameOver=false;
  const m=document.getElementById('msg'); m.className='msg'; m.textContent='Tour du Joueur 1';
  render();
}

function hasSeeds(p) { const [s,e]=playerRange(p); for(let i=s;i<=e;i++) if(board[i]>0) return true; return false; }
function totalSeeds() { return board.reduce((a,b)=>a+b,0); }

// =====================================================
// SIMULATION
// =====================================================

function simulateMove(b, startIdx, p) {
  let tmp=([...b]); let seeds=tmp[startIdx]; tmp[startIdx]=0;
  const seq=SEQ[p]; const oppStartPos=7;
  let opSeeds=0, last=startIdx;
  const fullTours=Math.floor(seeds/13), remainder=seeds%13;

  if(fullTours===0) {
    let cur=startIdx;
    for(let i=0;i<seeds;i++){
      let np=(seq.indexOf(cur)+1)%14;
      while(seq[np]===startIdx) np=(np+1)%14;
      cur=seq[np]; tmp[cur]++;
      if(isInOpponentCamp(p,cur)) opSeeds++;
    }
    last=cur;
  } else {
    const sp=seq.indexOf(startIdx);
    const swos=[...seq.slice(0,sp),...seq.slice(sp+1)];
    for(let t=0;t<fullTours;t++) for(let i=0;i<13;i++){tmp[swos[i]]++;if(isInOpponentCamp(p,swos[i]))opSeeds++;}
    const oppSeq=seq.slice(oppStartPos);
    let rem=remainder,oi=0;
    while(rem>0){const idx=oppSeq[oi%oppSeq.length];tmp[idx]++;opSeeds++;last=idx;rem--;oi++;}
    if(remainder===0) last=swos[swos.length-1];
  }
  return {board:tmp,last,opSeeds,fullTour:fullTours>0};
}

function getMoves(p) {
  const [s,e]=playerRange(p);
  return Array.from({length:e-s+1},(_,k)=>s+k).filter(i=>board[i]>0)
    .map(i=>{const r=simulateMove(board,i,p);return{idx:i,seeds:board[i],opSeeds:r.opSeeds,sim:r};});
}

// =====================================================
// RÈGLES SPÉCIALES
// =====================================================

function frontierIndex(p) { return p===1?6:13; }
function isForbidden(idx,p) { if(idx!==frontierIndex(p))return false; return board[idx]===1||board[idx]===2; }

function solidarityCheck(p) {
  const opp=3-p;
  if(hasSeeds(opp)) return {forced:null,end:false,strict:false};
  const moves=getMoves(p);
  if(moves.length===0) return {forced:null,end:true};
  const valid=moves.filter(m=>m.opSeeds>=7&&!isForbidden(m.idx,p));
  if(valid.length>0) return {forced:valid.map(m=>m.idx),end:false,strict:false};
  const any=moves.filter(m=>m.opSeeds>0&&!isForbidden(m.idx,p));
  if(any.length>0) return {forced:any.map(m=>m.idx),end:false,strict:false};
  const best=moves.reduce((a,b)=>a.opSeeds>b.opSeeds?a:b);
  return {forced:[best.idx],end:false,strict:true};
}

function specialIndex(p) { return p===1?7:6; }

// =====================================================
// CAPTURES
// =====================================================

function doCapture(b,lastIdx,p,seedsPlayed) {
  const [os,oe]=opponentRange(p); const specIdx=specialIndex(p);
  let tmp=[...b],captured=0;
  if(!isInOpponentCamp(p,lastIdx)) return {board:tmp,captured:0};
  if(!tmp.slice(os,oe+1).some(v=>v>0)) return {board:tmp,captured:0};
  if(lastIdx===specIdx&&seedsPlayed>=14){
    const tb=[...tmp];tb[lastIdx]=0;
    if(tb.slice(os,oe+1).some(v=>v>0)){tmp[lastIdx]=0;return{board:tmp,captured:1,special:true};}
    return{board:tmp,captured:0};
  }
  if(lastIdx===specIdx) return {board:tmp,captured:0};
  const step=p===1?-1:1; let cur=lastIdx,isChain=false;
  while(true){
    if(!isInOpponentCamp(p,cur))break;
    const count=tmp[cur];
    if(cur===specIdx&&!isChain)break;
    if(count>=2&&count<=4){
      const tb=[...tmp];tb[cur]=0;
      if(!tb.slice(os,oe+1).some(v=>v>0))break;
      captured+=count;tmp[cur]=0;cur+=step;isChain=true;
    }else break;
  }
  return {board:tmp,captured};
}

// =====================================================
// CLIC SUR UNE CASE
// =====================================================

async function handleClick(idx) {
  if(gameOver) return;
  if(onlineMode && currentPlayer!==myPlayerNum){showMsg("Ce n'est pas votre tour.",'error');return;}

  const [s,e]=playerRange(currentPlayer);
  if(idx<s||idx>e){showMsg("Ce n'est pas votre camp.",'error');return;}
  if(board[idx]===0){showMsg('Cette case est vide.','error');return;}

  const sol=solidarityCheck(currentPlayer);
  if(sol.end){endGame('Fin de partie : solidarité impossible.');return;}
  if(sol.forced&&!sol.forced.includes(idx)){showMsg('⚠ Coup de solidarité requis — choisissez une autre case.','error');return;}

  if(isForbidden(idx,currentPlayer)){
    if(sol.strict&&sol.forced&&sol.forced.includes(idx)){
      const opp=3-currentPlayer; scores[opp-1]+=board[idx]; board[idx]=0;
      const msg="⚠ Coup interdit forcé : graines données à l'adversaire.";
      showMsg(msg,'error'); updateScoreDisplay();
      if(onlineMode) await pushState(msg,'error');
      nextTurn(); return;
    }
    showMsg('❌ Interdit : 1 ou 2 graines depuis la case frontière.','error'); return;
  }

  const seedsPlayed=board[idx];
  const sim=simulateMove(board,idx,currentPlayer);
  board=sim.board; lastPit=sim.last;

  const cap=doCapture(board,sim.last,currentPlayer,seedsPlayed);
  board=cap.board;

  let captureMsg='';
  if(cap.captured>0){
    scores[currentPlayer-1]+=cap.captured;
    const pl=cap.captured>1?'s':'';
    captureMsg=`+${cap.captured} graine${pl} capturée${pl}`;
    showMsg(captureMsg,'capture');
  } else { showMsg(''); }

  updateScoreDisplay();

  if(scores[currentPlayer-1]>=40){endGame(`Joueur ${currentPlayer} gagne !`,true,'40 graines atteintes');return;}
  if(totalSeeds()<10){giveRemainingSeeds();return;}

  if(onlineMode) await pushState(captureMsg,captureMsg?'capture':'');
  nextTurn();
}

// =====================================================
// TOUR SUIVANT
// =====================================================

function nextTurn() {
  currentPlayer=3-currentPlayer;
  const sol=solidarityCheck(currentPlayer);
  if(sol.end){endGame('Fin de partie : solidarité impossible.',false,'Solidarité impossible');return;}
  if(!hasSeeds(currentPlayer)){endGame(`Joueur ${currentPlayer} ne peut plus jouer.`,false,'Camp vide');return;}
  render();
  if(!document.getElementById('msg').textContent&&!onlineMode) showMsg(`Tour du Joueur ${currentPlayer}`);
}

// =====================================================
// FIN DE PARTIE
// =====================================================

function giveRemainingSeeds() {
  for(let i=0;i<=6;i++){scores[0]+=board[i];board[i]=0;}
  for(let i=7;i<=13;i++){scores[1]+=board[i];board[i]=0;}
  updateScoreDisplay(); render();
  if(scores[0]>=40){endGame('Joueur 1 gagne !',true,'Moins de 10 graines au total');return;}
  if(scores[1]>=40){endGame('Joueur 2 gagne !',true,'Moins de 10 graines au total');return;}
  if(scores[0]===scores[1]){endGame('Match nul !',false,'Moins de 10 graines — égalité',true);return;}
  endGame(`Joueur ${scores[0]>scores[1]?1:2} gagne !`,true,'Moins de 10 graines au total');
}

async function endGame(msg,isWin,reason,isDraw) {
  gameOver=true; showMsg(msg,isWin?'win':''); render();
  let winner=null;
  if(!isDraw) winner=scores[0]>scores[1]?1:2;
  const resultData={
    date:new Date().toISOString(),
    result:isDraw?'Match nul':`Joueur ${winner} gagne`,
    winner, scores:[...scores], board:[...board],
    reason:reason||msg, isDraw:!!isDraw
  };
  if(onlineMode){
    await pushEndState(resultData,msg);
    clearInterval(pollInterval); pollInterval=null;
  }
  saveGame(resultData);
  setTimeout(()=>openModal(resultData),350);
}

// =====================================================
// AFFICHAGE
// =====================================================

function showMsg(text,cls) {
  const el=document.getElementById('msg');
  el.className='msg'+(cls?' '+cls:''); el.textContent=text;
}

function updateScoreDisplay() {
  document.getElementById('sv1').textContent=scores[0];
  document.getElementById('sv2').textContent=scores[1];
}

function render() {
  const topRow=document.getElementById('top-row');
  const botRow=document.getElementById('bot-row');
  topRow.innerHTML=''; botRow.innerHTML='';
  updateScoreDisplay();
  document.getElementById('p1row').className='player-row'+(currentPlayer===1?' active':'');
  document.getElementById('p2row').className='player-row'+(currentPlayer===2?' active':'');
  for(let i=13;i>=7;i--) topRow.appendChild(makePit(i,2));
  for(let i=0;i<=6;i++)  botRow.appendChild(makePit(i,1));
}

function makePit(idx,owner) {
  const div=document.createElement('div');
  div.className='pit';
  if(board[idx]===0)           div.classList.add('empty');
  if(gameOver)                 div.classList.add('disabled');
  if(idx===lastPit&&!gameOver) div.classList.add('last-pit');
  const isActivePlayer=currentPlayer===owner;
  if(isActivePlayer&&!gameOver) div.classList.add('active-player');

  const label=document.createElement('span');
  label.className='pit-label';
  label.textContent=idx<=6?`C${idx+1}`:`C${14-idx}`;
  div.textContent=board[idx];
  div.appendChild(label);

  const isMyTurn=!onlineMode||(currentPlayer===myPlayerNum&&owner===myPlayerNum);
  if(isActivePlayer&&board[idx]>0&&!gameOver&&isMyTurn){
    div.addEventListener('click',()=>handleClick(idx));
  } else {
    div.classList.add('disabled');
  }

  if(idx===frontierIndex(owner)) div.classList.add('frontier');
  return div;
}
