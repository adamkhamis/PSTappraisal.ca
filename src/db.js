// Orders are kept in a single JSON file (data/submissions.json). Simple, and runs on any Node host.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'submissions.json');
fs.mkdirSync(path.dirname(FILE), { recursive: true });

let rows = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : [];

function save() {
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(rows, null, 1));
  fs.renameSync(tmp, FILE); // atomic replace, so a crash never leaves a half-written file
}

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const newRef = () => 'VA-' + new Date().getFullYear() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
const copy = (r) => (r ? JSON.parse(JSON.stringify(r)) : null);

module.exports = {
  create({ name, email, data, photos }) {
    const row = {
      id: rows.reduce((m, r) => Math.max(m, r.id), 0) + 1, ref: newRef(), created_at: now(), status: 'awaiting_payment',
      name, email, data, photos, stripe_session_id: null, paid_at: null, appraised_value: null, appraiser_notes: null, completed_at: null,
    };
    rows.push(row);
    save();
    return copy(row);
  },
  byRef: (ref) => copy(rows.find((r) => r.ref === ref)),
  byId: (id) => copy(rows.find((r) => r.id === Number(id))),
  list: (status) => rows.filter((r) => r.status === status).sort((a, b) => b.created_at.localeCompare(a.created_at)).map(copy),
  counts() {
    const out = { awaiting_payment: 0, paid: 0, completed: 0 };
    for (const r of rows) out[r.status]++;
    return out;
  },
  setStripeSession(id, sessionId) {
    const r = rows.find((x) => x.id === id);
    if (r) { r.stripe_session_id = sessionId; save(); }
  },
  markPaid(ref) {
    const r = rows.find((x) => x.ref === ref && x.status === 'awaiting_payment');
    if (r) { r.status = 'paid'; r.paid_at = now(); save(); }
  },
  markCompleted(id, value, notes, finCondition) {
    const r = rows.find((x) => x.id === id);
    if (r) Object.assign(r, { status: 'completed', appraised_value: value, appraiser_notes: notes, fin_condition: finCondition || r.fin_condition, completed_at: now() }), save();
  },
};
