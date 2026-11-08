import test from 'node:test';
import assert from 'node:assert/strict';
import { filterUsers, loadAllAdminUsers, userPatchArgs, userPublications, userStats, publicationState } from '../src/lib/adminUsers.js';

const users = [
  { id: 'a', full_name: 'José Pérez', email: 'jose@example.com', city: 'Junín', is_admin: true, is_verified: true, role: 'worker' },
  { id: 'b', full_name: 'Comercio', city: 'Bragado', verification_requested: true, role: 'company' },
  { id: 'c', full_name: 'Cuenta bloqueada', is_blocked: true, role: 'worker' },
];
test('KPI y búsquedas combinan estado, localidad y acentos', () => {
  assert.deepEqual(userStats(users), { todos: 3, admins: 1, verificados: 1, bloqueados: 1, pendientes: 1 });
  assert.deepEqual(filterUsers(users, 'verificados', 'jose').map((u) => u.id), ['a']);
  assert.deepEqual(filterUsers(users, 'admins', 'junin').map((u) => u.id), ['a']);
  assert.equal(filterUsers(users, 'pendientes', 'Bragado')[0].id, 'b');
  assert.equal(filterUsers(users, 'no-verificados').length, 1);
  assert.equal(filterUsers(users, 'bloqueados')[0].id, 'c');
  assert.equal(filterUsers(users, 'comercios')[0].id, 'b');
});
test('aceptar, rechazar y quitar permisos conserva valores false y seis parámetros', () => {
  assert.deepEqual(userPatchArgs('b', { is_verified: true, verification_requested: false }), {
    p_user: 'b', p_role: null, p_is_admin: null, p_is_blocked: null, p_is_verified: true, p_verification_requested: false,
  });
  const patch = userPatchArgs('b', { is_admin: false, is_blocked: false, is_verified: false });
  assert.equal(patch.p_is_admin, false); assert.equal(patch.p_is_blocked, false); assert.equal(patch.p_is_verified, false);
});
test('publicaciones incluye empleos, servicios y pedidos en todos los estados', () => {
  const rows = userPublications({ jobs: [{ id: '1', created_at: '2026-01-01', status: 'filled' }, { id: '2', created_at: '2026-03-01', status: 'paused' }], services: [{ id: '3', created_at: '2026-02-01', status: 'expired', mode: 'busca' }] });
  assert.deepEqual(rows.map((r) => r.id), ['2', '3', '1']);
  assert.deepEqual(rows.map((r) => r.kind), ['job', 'service', 'job']);
  assert.equal(publicationState({ status: 'active', expires_at: '2020-01-01' }), 'expired');
  assert.equal(publicationState({ status: 'filled', expires_at: '2020-01-01' }), 'filled');
});
test('carga usuarios más allá del límite de mil con páginas ordenadas', async () => {
  const rows = Array.from({ length: 1207 }, (_, id) => ({ id: String(id) }));
  const calls = [];
  const client = { rpc(name) { assert.equal(name, 'admin_users'); const orders = []; const query = { order(field, options) { orders.push([field, options]); return query; }, range(from, to) { calls.push({ from, to, orders }); return Promise.resolve({ data: rows.slice(from, to + 1), error: null }); } }; return query; } };
  assert.equal((await loadAllAdminUsers(client)).length, 1207);
  assert.deepEqual(calls.map((c) => c.from), [0, 500, 1000]);
  assert.deepEqual(calls[0].orders.map(([field]) => field), ['created_at', 'id']);
});
test('si falla una página, no se presenta una carga parcial como completa', async () => {
  const query = { order() { return query; }, range(from) { return Promise.resolve(from === 0 ? { data: [{ id: '1' }], error: null } : { data: null, error: new Error('sin permiso') }); } };
  await assert.rejects(loadAllAdminUsers({ rpc() { return query; } }, 1), /sin permiso/);
});
