import './controls.js';
import { createClient } from '@supabase/supabase-js';
import { createLocalStore, createCloudStore } from './storage.js';

const panel = document.querySelector('#entryPanel');
const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
async function mount(store, label, logout) {
  window.technikData = store;
  panel.replaceChildren();
  document.body.classList.remove('loading');
  document.querySelector('#storageLabel').textContent = label;
  const controls = document.querySelector('#accountControls');
  if (logout) {
    const button = document.createElement('button'); button.className = 'btn small'; button.textContent = 'Abmelden'; button.onclick = logout; controls.append(button);
  } else {
    const note = document.createElement('div'); note.className = 'mode-note'; note.textContent = 'Lokaler Modus: Daten nur in diesem Browser. Regelmäßig Backup speichern.'; controls.append(note);
  }
  const script = document.createElement('script'); script.src = '/ui.js'; document.body.append(script);
}
function login(client) {
  panel.innerHTML = '<form class="card auth-form"><div class="eyebrow">TECHNIKPLAN</div><h1>Deine Kunden. Überall.</h1><p>Melde dich an, um auf deine Kunden und Termine zuzugreifen.</p><label>E-Mail<input name="email" type="email" autocomplete="username" required></label><label>Passwort<input name="password" type="password" autocomplete="current-password" minlength="8" required></label><button class="btn primary" type="submit">Anmelden</button><button class="btn" id="register" type="button">Konto erstellen</button><p class="status-note" role="status"></p></form>';
  const form = panel.querySelector('form'), status = form.querySelector('[role=status]');
  async function submit(register) {
    if (!window.validateForm(form)) return;
    const values = Object.fromEntries(new FormData(form));
    form.querySelectorAll('button').forEach(b => b.disabled = true);
    try {
      const { data, error } = register ? await client.auth.signUp(values) : await client.auth.signInWithPassword(values);
      if (error) throw error;
      if (data.session) location.reload();
      else status.textContent = 'Bitte bestätige deine E-Mail-Adresse und melde dich anschließend an.';
    } catch (error) { status.textContent = error.message; }
    finally { form.querySelectorAll('button').forEach(b => b.disabled = false); }
  }
  form.onsubmit = event => { event.preventDefault(); submit(false); };
  form.querySelector('#register').onclick = () => submit(true);
}
async function start() {
  if (!url && !key) return mount(await createLocalStore(), 'Lokaler Testbetrieb auf diesem Gerät.');
  if (!url || !key || !url.startsWith('https://')) throw new Error('Supabase-Konfiguration unvollständig. Bitte .env.local anhand von .env.example ergänzen.');
  if (key.startsWith('sb_secret_')) throw new Error('Ein geheimer Supabase-Schlüssel darf nicht im Browser verwendet werden. Bitte den Publishable Key verwenden.');
  if (key.startsWith('eyJ')) {
    try { if (JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'service_role') throw new Error('SERVICE_KEY'); }
    catch (error) { if (error.message === 'SERVICE_KEY') throw new Error('Service-Role-Schlüssel ist hier nicht erlaubt. Bitte den öffentlichen Anon/Publishable Key verwenden.'); }
  }
  const client = createClient(url, key);
  const { data: { session }, error } = await client.auth.getSession();
  if (error) throw error;
  if (!session) return login(client);
  await mount(createCloudStore(client, session.user.id), 'Mit deinem Konto in Supabase gespeichert.', async () => { await client.auth.signOut(); location.reload(); });
  client.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') location.reload(); });
  setInterval(() => { if (!document.hidden) window.dispatchEvent(new Event('technikplan-data-changed')); }, 30000);
}
start().catch(error => { panel.textContent = error.message; });
