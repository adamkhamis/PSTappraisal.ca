const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync(process.env.DB_PATH || path.join(__dirname, '..', 'data.sqlite'));

db.exec(`
  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ref TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    status TEXT NOT NULL DEFAULT 'awaiting_payment', -- awaiting_payment | paid | completed
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    data TEXT NOT NULL,          -- JSON of all form fields
    photos TEXT NOT NULL,        -- JSON array of stored filenames
    stripe_session_id TEXT,
    paid_at TEXT,
    appraised_value REAL,
    appraiser_notes TEXT,
    completed_at TEXT
  );
`);

function newRef() {
  return 'VA-' + new Date().getFullYear() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

function hydrate(row) {
  if (!row) return null;
  return { ...row, data: JSON.parse(row.data), photos: JSON.parse(row.photos) };
}

module.exports = {
  create({ name, email, data, photos }) {
    const ref = newRef();
    db.prepare('INSERT INTO submissions (ref, name, email, data, photos) VALUES (?, ?, ?, ?, ?)')
      .run(ref, name, email, JSON.stringify(data), JSON.stringify(photos));
    return this.byRef(ref);
  },
  byRef(ref) {
    return hydrate(db.prepare('SELECT * FROM submissions WHERE ref = ?').get(ref));
  },
  byId(id) {
    return hydrate(db.prepare('SELECT * FROM submissions WHERE id = ?').get(id));
  },
  list(status) {
    return db.prepare('SELECT * FROM submissions WHERE status = ? ORDER BY created_at DESC').all(status).map(hydrate);
  },
  counts() {
    const out = { awaiting_payment: 0, paid: 0, completed: 0 };
    for (const r of db.prepare('SELECT status, COUNT(*) AS n FROM submissions GROUP BY status').all()) out[r.status] = r.n;
    return out;
  },
  setStripeSession(id, sessionId) {
    db.prepare('UPDATE submissions SET stripe_session_id = ? WHERE id = ?').run(sessionId, id);
  },
  markPaid(ref) {
    db.prepare(`UPDATE submissions SET status = 'paid', paid_at = datetime('now')
                WHERE ref = ? AND status = 'awaiting_payment'`).run(ref);
  },
  markCompleted(id, value, notes) {
    db.prepare(`UPDATE submissions SET status = 'completed', appraised_value = ?, appraiser_notes = ?,
                completed_at = datetime('now') WHERE id = ?`).run(value, notes, id);
  },
};
