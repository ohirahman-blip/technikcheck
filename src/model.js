export const emptyState = () => ({ customers: [], appointments: [], tasks: [] });
const tables = ['customers', 'appointments', 'tasks'];
const statuses = ['geplant', 'bestätigt', 'erledigt', 'abgesagt'];
const text = (v, max = 5000) => String(v ?? '').trim().slice(0, max);
const fail = message => { throw new Error(message); };
const integer = value => Number.isSafeInteger(value) && value >= 0;
const flag = v => v === true || v === 1 || v === '1' || v === 'on' ? 1 : 0;
function amount(value) {
  if (value === '' || value == null) return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1000000) fail('Ungültiger Geldbetrag');
  return Math.round(n * 100);
}
function validDate(value, time = false) {
  const pattern = time ? /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/ : /^\d{4}-\d{2}-\d{2}$/;
  return pattern.test(value) && Number.isFinite(new Date(value).getTime());
}
function normalize(table, data, state) {
  if (table === 'customers') {
    const name = text(data.name, 120);
    if (!name) fail('Name fehlt');
    const lat = data.lat === '' || data.lat == null ? null : Number(data.lat);
    const lng = data.lng === '' || data.lng == null ? null : Number(data.lng);
    if ((lat === null) !== (lng === null) || (lat !== null && (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180))) fail('Ungültiger Kartenpunkt');
    return { name, phone: text(data.phone, 80), email: text(data.email, 160), address: text(data.address, 300), notes: text(data.notes), lat, lng, archived: flag(data.archived) };
  }
  const customer_id = Number(data.customer_id);
  if (!state.customers.some(c => c.id === customer_id)) fail('Bitte einen vorhandenen Kunden auswählen');
  const title = text(data.title, 200);
  if (!title) fail('Titel fehlt');
  if (table === 'tasks') {
    const due_date = text(data.due_date, 10);
    if (due_date && !validDate(due_date)) fail('Ungültiges Fälligkeitsdatum');
    return { customer_id, title, due_date, done: flag(data.done) };
  }
  const starts_at = text(data.starts_at, 16), ends_at = text(data.ends_at, 16);
  if (!validDate(starts_at, true) || !validDate(ends_at, true) || ends_at <= starts_at) fail('Das Ende muss nach dem Beginn liegen');
  if (!statuses.includes(data.status)) fail('Ungültiger Status');
  const price_cents = amount(data.price), paid_cents = amount(data.paid), cost_cents = amount(data.cost);
  if (paid_cents > price_cents) fail('Bezahlt darf den Preis nicht übersteigen');
  const distance_km = Number(data.distance_km || 0);
  if (!Number.isFinite(distance_km) || distance_km < 0) fail('Ungültige Kilometerzahl');
  return { customer_id, title, starts_at, ends_at, status: data.status, description: text(data.description), result: text(data.result), price_cents, paid_cents, cost_cents, distance_km };
}
export function validateState(input) {
  if (!input || !tables.every(t => Array.isArray(input[t]))) fail('Backup ist unvollständig');
  const clean = emptyState();
  for (const table of tables) {
    if (input[table].length > 100000) fail('Zu viele Einträge');
    const seen = new Set();
    for (const row of input[table]) {
      if (!row || !integer(row.id) || row.id < 1 || seen.has(row.id)) fail('Ungültige oder doppelte ID im Backup');
      seen.add(row.id);
      if (table === 'appointments' && !['price_cents', 'paid_cents', 'cost_cents'].every(k => integer(row[k]))) fail('Ungültige Beträge im Backup');
      const data = table === 'appointments' ? { ...row, price: row.price_cents / 100, paid: row.paid_cents / 100, cost: row.cost_cents / 100 } : row;
      clean[table].push({ id: row.id, ...normalize(table, data, clean), created_at: text(row.created_at || new Date().toISOString(), 40) });
    }
  }
  return clean;
}
export function applyMutation(state, path, method, body = {}) {
  const [table, idText] = path.split('/');
  if (!tables.includes(table)) fail('Unbekannter Bereich');
  const id = idText === undefined ? null : Number(idText);
  const index = state[table].findIndex(row => row.id === id);
  if (method !== 'POST' && index < 0) fail('Eintrag nicht gefunden');
  if (method === 'DELETE') {
    if (table === 'customers') fail('Kunden bitte archivieren');
    state[table].splice(index, 1);
    return { ok: true };
  }
  if (!['POST', 'PUT'].includes(method)) fail('Nicht unterstützte Aktion');
  const payload = normalize(table, body, state);
  const row = { ...payload, id: method === 'POST' ? state[table].reduce((max, r) => Math.max(max, r.id), 0) + 1 : id, created_at: method === 'POST' ? new Date().toISOString() : state[table][index].created_at };
  if (method === 'POST') state[table].push(row); else state[table][index] = row;
  return row;
}
export function parseBackup(value) {
  if (value?.format !== 'technikplan-v1') fail('Das ist kein Technikplan-Backup');
  return validateState(value);
}
