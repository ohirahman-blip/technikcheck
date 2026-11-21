import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, applyMutation, parseBackup } from '../src/model.js';

test('customer, appointment and backup roundtrip retain coordinates and cents', () => {
  const data = emptyState();
  const customer = applyMutation(data, 'customers', 'POST', { name: 'Test', lat: '52.52', lng: '13.4' });
  const appointment = applyMutation(data, 'appointments', 'POST', { customer_id: customer.id, title: 'Einrichtung', starts_at: '2026-11-21T10:00', ends_at: '2026-11-21T11:00', status: 'erledigt', price: '69.90', paid: '30.20', cost: '5.15' });
  assert.equal(appointment.price_cents, 6990);
  assert.equal(appointment.paid_cents, 3020);
  assert.deepEqual(parseBackup({ format: 'technikplan-v1', ...data }), data);
  assert.equal(customer.lat, 52.52);
});

test('invalid edits do not modify a previous record', () => {
  const state = emptyState();
  applyMutation(state, 'customers', 'POST', { name: 'Test' });
  const input = { customer_id: 1, title: 'Test', starts_at: '2026-11-21T10:00', ends_at: '2026-11-21T11:00', status: 'geplant', price: 50, paid: 0 };
  applyMutation(state, 'appointments', 'POST', input);
  const previous = structuredClone(state);
  assert.throws(() => applyMutation(state, 'appointments/1', 'PUT', { ...input, paid: 60 }), /Preis/);
  assert.deepEqual(state, previous);
});

test('backup rejects orphaned tasks, duplicate ids and invalid coordinates', () => {
  assert.throws(() => parseBackup({ format: 'technikplan-v1', customers: [], appointments: [], tasks: [{ id: 1, customer_id: 9, title: 'Test' }] }), /Kunden/);
  assert.throws(() => parseBackup({ format: 'technikplan-v1', customers: [{ id: 1, name: 'A' }, { id: 1, name: 'B' }], appointments: [], tasks: [] }), /doppelte/);
  assert.throws(() => applyMutation(emptyState(), 'customers', 'POST', { name: 'Test', lat: 'NaN', lng: '13' }), /Kartenpunkt/);
});

test('existing SQLite-format JSON backups import without changing ids', () => {
  const old = { format: 'technikplan-v1', customers: [{ id: 42, name: 'Test', phone: '', email: '', address: '', lat: null, lng: null, notes: '', archived: 0, created_at: '2026-11-19 12:00:00' }], appointments: [], tasks: [] };
  const state = parseBackup(old);
  const next = applyMutation(state, 'customers', 'POST', { name: 'Weiterer Test' });
  assert.equal(next.id, 43);
});
