// Run with Node 22 against a disposable local SpacetimeDB 1.12 instance.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const server = new URL(process.env.SITE_FEED_TEST_URL ?? 'http://127.0.0.1:3000');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(server.hostname));
const database = '/v1/database/minigame-test-' + randomUUID();
const moduleDir = fileURLToPath(new URL('../server/spacetimedb/', import.meta.url));
const gameId = 'maze';
const origin = 'https://minigames.grem.studio';
const path = '/games/maze/index.html';
const params = [{ key: 'level', values: ['easy', 'hard'] }];
const chapter = 'chapter-one';
const password = 'local minigame test passphrase';

async function request(route, { token, body, type, method = 'POST' } = {}) {
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  if (type) headers['Content-Type'] = type;
  const response = await fetch(new URL(route, server), { method, headers, body });
  const text = await response.text();
  assert.ok(response.ok, response.status + ' ' + text);
  return text;
}

async function identity() {
  return JSON.parse(await request('/v1/identity'));
}

function call(actor, reducer, ...args) {
  return request(database + '/call/' + reducer, {
    token: actor.token, body: JSON.stringify(args), type: 'application/json',
  });
}

async function sql(actor, query) {
  const result = await request(database + '/sql', {
    token: actor?.token, body: query, type: 'text/plain',
  });
  return JSON.parse(result)[0]?.rows;
}

async function publish(owner, dir, operation) {
  const target = resolve(moduleDir, 'target', dir === moduleDir ? 'minigame-tests' : 'minigame-tests-base');
  execFileSync(process.env.CARGO ?? 'cargo', [
    'build', '--release', '--locked', '--target', 'wasm32-unknown-unknown',
    '--manifest-path', resolve(dir, 'Cargo.toml'), '--target-dir', target,
  ], { stdio: 'inherit', env: { ...process.env, SITE_FEED_OWNER_IDENTITY: owner.identity } });
  const body = readFileSync(resolve(target, 'wasm32-unknown-unknown/release/site_feed_server.wasm'));
  const result = await request(database, { token: owner.token, body, type: 'application/octet-stream', method: 'PUT' });
  assert.equal(JSON.parse(result).Success.op, operation);
}

const document = (embedId = gameId, parameters = [{ key: 'level', value: 'hard' }], extra = {}) => JSON.stringify({
  version: 1,
  nodes: [
    { type: 'paragraph', id: 'p1', runs: [{ text: 'Find the exit.' }] },
    { type: 'panel', id: 'panel', children: [{
      type: 'gameEmbed', id: 'g1', embed_id: embedId,
      title: 'Play the maze', width: 400, height: 240, params: parameters, ...extra,
    }] },
  ],
});

const head = async (actor) => {
  const [[revision]] = await sql(actor, 'SELECT revision FROM my_serial_revision_heads');
  return revision;
};
const catalog = (actor) => sql(actor, 'SELECT embed_id, origin, path, policy FROM approved_minigames');
const publication = () => sql(undefined, 'SELECT document FROM published_rich_documents');
const draft = (owner) => sql(owner, 'SELECT draft_id, document FROM draft_rich_documents');

test('SpacetimeDB minigame registry', async (t) => {
  const [owner, admin, author, anon] = await Promise.all([identity(), identity(), identity(), identity()]);
  const base = process.env.SITE_FEED_TEST_BASE;
  await publish(owner, base ?? moduleDir, 'created');
  t.after(() => request(database, { token: owner.token, method: 'DELETE' }));
  await call(owner, 'create_admin_account', 'admin', password);
  await call(owner, 'create_publisher_account', 'author', password);
  await call(admin, 'login', 'admin', password);
  await call(author, 'login', 'author', password);
  await call(author, 'create_serial_post', chapter, 'Maze chapter', 'Legacy body');

  if (base) {
    await t.test('additive publish preserves existing game references and private drafts', async () => {
      const old = document('unregistered-legacy-game');
      await call(author, 'publish_rich_document', chapter, old);
      await call(author, 'save_draft', chapter, 7, old);
      await publish(owner, moduleDir, 'updated');
      assert.deepEqual(await publication(), [[old]]);
      assert.deepEqual(await draft(owner), [[7, old]]);
      assert.deepEqual(await catalog(), []);
      await assert.rejects(call(author, 'publish_rich_document', chapter, old), /is not approved/);
      await call(author, 'discard_draft', chapter, 7);
    });
  }

  await t.test('only a logged-in admin can register, review, approve, or revoke', async () => {
    for (const actor of [anon, author]) {
      await assert.rejects(call(actor, 'register_local_minigame', gameId, 'author', params), /logged in as an admin/);
    }
    await call(admin, 'register_local_minigame', gameId, 'author', params);
    await assert.rejects(call(admin, 'register_local_minigame', gameId, 'author', params), /already registered/);
    for (const actor of [anon, author]) {
      await assert.rejects(call(actor, 'approve_minigame', gameId, origin, path), /logged in as an admin/);
      await assert.rejects(call(actor, 'revoke_minigame', gameId), /logged in as an admin/);
      assert.deepEqual(await sql(actor, 'SELECT embed_id FROM minigames_for_review'), []);
      await assert.rejects(sql(actor, 'SELECT embed_id FROM minigame_registry'));
    }
    assert.deepEqual(await sql(admin, 'SELECT embed_id, owner, status FROM minigames_for_review'), [[gameId, 'author', 'pending']]);
    assert.deepEqual(await catalog(), []);
  });

  await t.test('registration and approval reject noncanonical paths, origins and parameter rules', async () => {
    for (const id of ['../maze', 'maze%2fother', 'maze?next=other', 'maze\\other']) {
      await assert.rejects(call(admin, 'register_local_minigame', id, 'author', []), /Invalid minigame ID/);
    }
    for (const rules of [
      [{ key: 'bad&key', values: ['good'] }],
      [params[0], params[0]],
      [{ key: 'next', values: ['https://elsewhere.example'] }],
      [{ key: 'level', values: ['hard', 'hard'] }],
    ]) {
      await assert.rejects(call(admin, 'register_local_minigame', 'invalid-rules', 'author', rules), /parameter (key|value)/);
    }
    for (const badOrigin of [
      'http://minigames.grem.studio', 'https://elsewhere.example', 'https://minigames.grem.studio:443',
      'https://minigames.grem.studio@elsewhere.example',
    ]) {
      await assert.rejects(call(admin, 'approve_minigame', gameId, badOrigin, path), /does not match/);
    }
    for (const badPath of [
      '//elsewhere.example/maze', path + '?next=elsewhere', path + '#maze',
      '/games/maze/../other/index.html', '/games/maze/%69ndex.html', '/games/maze/',
    ]) {
      await assert.rejects(call(admin, 'approve_minigame', gameId, origin, badPath), /does not match/);
    }
    const before = await publication();
    await assert.rejects(call(author, 'publish_rich_document', chapter, document()), /is not approved/);
    assert.deepEqual(await publication(), before);
    assert.deepEqual(await catalog(), []);
    await call(admin, 'approve_minigame', gameId, origin, path);
  });

  await t.test('approved catalog exposes only the script sandbox and no feature grants', async () => {
    assert.deepEqual(await catalog(anon), [[gameId, origin, path, ['allow-scripts', '']]]);
    assert.deepEqual(await sql(admin, 'SELECT status, reviewed_by FROM minigames_for_review'), [['approved', [0, 'admin']]]);
  });

  await t.test('publication rejects unknown embeds, extra URLs, and unknown or duplicate parameters atomically', async () => {
    await call(author, 'publish_rich_document', chapter, document());
    await call(author, 'update_published_document', chapter, document(), await head(author));
    assert.deepEqual(await sql(anon, 'SELECT body FROM serial_posts'), [['Find the exit.\nPlay the maze']]);
    const revision = await head(author);
    const before = await publication();
    for (const [invalid, error] of [
      [document('unregistered'), /is not approved/],
      [document(gameId, [], { src: 'https://elsewhere.example' }), /Invalid document/],
      [document(gameId, [{ key: 'other', value: 'hard' }]), /Unknown minigame parameter/],
      [document(gameId, [{ key: 'level', value: 'https://elsewhere.example' }]), /Unapproved value/],
      [document(gameId, [{ key: 'level', value: 'hard' }, { key: 'level', value: 'easy' }]), /Duplicate minigame parameter/],
    ]) {
      await assert.rejects(call(author, 'update_published_document', chapter, invalid, revision), error);
      await assert.rejects(call(author, 'publish_rich_document', chapter, invalid), error);
    }
    assert.deepEqual(await publication(), before);
    assert.equal(await head(author), revision);
  });

  await t.test('revocation blocks every publication path and preserves published and draft bytes', async () => {
    const initialHead = await head(author);
    const [[snapshotId]] = await sql(author, 'SELECT id FROM my_serial_revisions WHERE revision = ' + initialHead);
    await call(author, 'create_draft', chapter, document(), [0, initialHead]);
    const draftHead = await head(author);
    await assert.rejects(call(author, 'save_draft_at_revision', chapter, 1, document(), initialHead), /Revision mismatch/);
    await call(author, 'save_draft_at_revision', chapter, 1, document(), draftHead);
    const revision = await head(author);
    await call(admin, 'revoke_minigame', gameId);
    assert.deepEqual(await catalog(), []);
    assert.deepEqual(await sql(admin, 'SELECT status FROM minigames_for_review'), [['revoked']]);
    await assert.rejects(call(admin, 'approve_minigame', gameId, origin, path), /cannot be reapproved/);
    await assert.rejects(call(author, 'publish_rich_document', chapter, document()), /is not approved/);
    await assert.rejects(call(author, 'publish_draft', chapter, 1, revision), /is not approved/);
    await assert.rejects(call(author, 'update_published_document', chapter, document(), revision), /is not approved/);
    await assert.rejects(call(author, 'restore_serial_post', chapter, snapshotId, revision), /is not approved/);
    assert.deepEqual(await publication(), [[document()]]);
    assert.deepEqual(await draft(owner), [[1, document()]]);
    assert.equal(await head(author), revision);

    // The author can replace the unavailable embed and publish the repaired draft.
    const repaired = JSON.stringify({ version: 1, nodes: [{ type: 'paragraph', id: 'p1', runs: [{ text: 'Game retired.' }] }] });
    await call(author, 'save_draft_at_revision', chapter, 1, repaired, revision);
    await call(author, 'publish_draft', chapter, 1, await head(author));
    assert.deepEqual(await publication(), [[repaired]]);
    assert.deepEqual(await draft(owner), []);
    assert.deepEqual(await sql(anon, 'SELECT body FROM serial_posts'), [['Game retired.']]);
  });
});
