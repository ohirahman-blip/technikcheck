import { emptyState, applyMutation, parseBackup, validateState } from './model.js';

export async function createLocalStore() {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('technikcheck-local', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('workspace');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Browserspeicher konnte nicht geöffnet werden.'));
  });
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('technikcheck-local') : null;
  if (channel) channel.onmessage = () => window.dispatchEvent(new Event('technikplan-data-changed'));
  async function transact(change) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('workspace', change ? 'readwrite' : 'readonly');
      const store = tx.objectStore('workspace');
      const read = store.get('data');
      let result, thrown;
      read.onsuccess = () => {
        try {
          const state = read.result || emptyState();
          result = change ? change(state) : state;
          if (change) store.put(state, 'data');
        } catch (error) { thrown = error; tx.abort(); }
      };
      tx.oncomplete = () => { if (change) channel?.postMessage('changed'); resolve(result); };
      tx.onerror = tx.onabort = () => reject(thrown || new Error('Speichern fehlgeschlagen. Bitte ein Backup herunterladen.'));
    });
  }
  return wrap(transact);
}

export function createCloudStore(client, userId) {
  async function transact(change) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const { data: row, error } = await client.from('technikplan_workspaces').select('data,revision').eq('owner_id', userId).maybeSingle();
      if (error) throw new Error(error.code === 'PGRST205' || error.code === '42P01' ? 'Die Datenbank ist noch nicht eingerichtet. Bitte die mitgelieferte SQL-Migration ausführen.' : error.message);
      const state = row ? validateState(row.data) : emptyState();
      if (!change) return state;
      const result = change(state);
      if (!row) {
        const write = await client.from('technikplan_workspaces').insert({ owner_id: userId, data: state, revision: 1 });
        if (write.error?.code === '23505') continue;
        if (write.error) throw new Error(write.error.message);
        return result;
      }
      const write = await client.from('technikplan_workspaces').update({ data: state, revision: row.revision + 1, updated_at: new Date().toISOString() }).eq('owner_id', userId).eq('revision', row.revision).select('revision');
      if (write.error) throw new Error(write.error.message);
      if (write.data.length) return result;
    }
    throw new Error('Die Daten wurden gleichzeitig auf einem anderen Gerät geändert. Bitte erneut speichern.');
  }
  return wrap(transact);
}

function wrap(transact) {
  return {
    request(path, method = 'GET', body) {
      if (path === 'data' && method === 'GET') return transact();
      return transact(state => applyMutation(state, path, method, body));
    },
    async backup() { return { format: 'technikplan-v1', exported_at: new Date().toISOString(), ...await transact() }; },
    async restore(input) {
      const clean = parseBackup(input);
      return transact(state => { Object.assign(state, structuredClone(clean)); return { ok: true }; });
    }
  };
}
