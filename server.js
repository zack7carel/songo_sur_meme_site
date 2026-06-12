const express = require('express');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Stockage en mémoire ───────────────────────────────────────
// rooms[code] = { ...gameState, updatedAt: Date }
const rooms = {};

// Nettoyage automatique : supprimer les salles inactives depuis +2h
setInterval(() => {
  const limit = Date.now() - 2 * 60 * 60 * 1000;
  for (const code in rooms) {
    if (rooms[code].updatedAt < limit) delete rooms[code];
  }
}, 15 * 60 * 1000); // toutes les 15 min

// ── Routes ───────────────────────────────────────────────────

// Créer une salle
app.post('/rooms', (req, res) => {
  const { code, state } = req.body;
  if (!code || !state) return res.status(400).json({ error: 'code et state requis' });
  if (rooms[code])     return res.status(409).json({ error: 'Code déjà utilisé' });

  rooms[code] = { ...state, updatedAt: Date.now() };
  res.status(201).json({ ok: true });
});

// Lire l'état d'une salle
app.get('/rooms/:code', (req, res) => {
  const room = rooms[req.params.code];
  if (!room) return res.status(404).json({ error: 'Salle introuvable' });
  res.json(room);
});

// Mettre à jour l'état d'une salle (PATCH partiel)
app.patch('/rooms/:code', (req, res) => {
  const room = rooms[req.params.code];
  if (!room) return res.status(404).json({ error: 'Salle introuvable' });

  Object.assign(room, req.body, { updatedAt: Date.now() });
  res.json({ ok: true });
});

// Supprimer une salle
app.delete('/rooms/:code', (req, res) => {
  delete rooms[req.params.code];
  res.json({ ok: true });
});

// Health check (Render en a besoin)
app.get('/health', (_req, res) => res.json({ status: 'ok', rooms: Object.keys(rooms).length }));

app.listen(PORT, () => console.log(`Songo backend démarré sur le port ${PORT}`));
