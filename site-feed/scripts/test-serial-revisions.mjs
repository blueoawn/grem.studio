// Run with Node 22 and a disposable local SpacetimeDB 1.12 server.
// Optional SITE_FEED_TEST_BASE points to an origin/main SpacetimeDB module directory.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const server = new URL(process.env.SITE_FEED_TEST_URL ?? 'http://127.0.0.1:3000');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(server.hostname));
const database = '/v1/database/revision-test-' + randomUUID();
const moduleDir = fileURLToPath(new URL('../server/spacetimedb/', import.meta.url));
const passphrase = 'local revision test passphrase';
const chapter = 'chapter-one';
const otherChapter = 'chapter-two';

async function request(path, { token, body, type, method = 'POST' } = {}) {
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  if (type) headers['Content-Type'] = type;
  const response = await fetch(new URL(path, server), { method, headers, body });
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
  const target = resolve(moduleDir, 'target', dir === moduleDir ? 'revision-tests' : 'revision-tests-base');
  execFileSync(process.env.CARGO ?? 'cargo', [
    'build', '--release', '--locked', '--target', 'wasm32-unknown-unknown',
    '--manifest-path', resolve(dir, 'Cargo.toml'), '--target-dir', target,
  ], { stdio: 'inherit', env: { ...process.env, SITE_FEED_OWNER_IDENTITY: owner.identity } });
  const body = readFileSync(resolve(target, 'wasm32-unknown-unknown/release/site_feed_server.wasm'));
  const result = await request(database, { token: owner.token, body, type: 'application/octet-stream', method: 'PUT' });
  assert.equal(JSON.parse(result).Success.op, operation);
}

const document = (text) => JSON.stringify({
  version: 1, nodes: [{ type: 'paragraph', id: 'p1', runs: [{ text }] }],
});

function rowsFor(actor, table, columns, slug) {
  return sql(actor, 'SELECT ' + columns + ' FROM ' + table + " WHERE slug = '" + slug + "'");
}

function history(actor, slug = chapter) {
  return rowsFor(actor, 'my_serial_revisions', 'id, revision, author, draft_id, parent_revision_id', slug);
}

async function head(actor, slug = chapter) {
  const [[revision]] = await rowsFor(actor, 'my_serial_revision_heads', 'revision', slug);
  return revision;
}

async function latest(actor, slug = chapter) {
  const revision = await head(actor, slug);
  const row = (await history(actor, slug)).find((entry) => entry[1] === revision);
  assert.ok(row, 'expected a retained snapshot for the current revision');
  return row;
}

test('SpacetimeDB serial revision history', async (t) => {
  const [owner, admin, author, other] = await Promise.all([identity(), identity(), identity(), identity()]);
  const base = process.env.SITE_FEED_TEST_BASE;
  await publish(owner, base ?? moduleDir, 'created');
  t.after(() => request(database, { token: owner.token, method: 'DELETE' }));
  await call(owner, 'create_admin_account', 'admin', passphrase);
  await call(owner, 'create_publisher_account', 'author', passphrase);
  await call(owner, 'create_publisher_account', 'other', passphrase);
  await call(admin, 'login', 'admin', passphrase);
  await call(author, 'login', 'author', passphrase);
  await call(other, 'login', 'other', passphrase);

  await call(author, 'create_serial_post', chapter, 'Original title', 'Original body');
  await call(other, 'create_serial_post', otherChapter, 'Other title', 'Other body');
  const original = document('Original rich content');
  await call(author, 'publish_rich_document', chapter, original);
  await call(author, 'save_draft', chapter, 7, document('Original draft'));

  if (base) {
    await t.test('additive publish preserves chapter, rich document, private draft, and sessions', async () => {
      await publish(owner, moduleDir, 'updated');
      assert.deepEqual(await rowsFor(author, 'serial_posts', 'title, body', chapter), [
        ['Original title', 'Original body'],
      ]);
      assert.deepEqual(await rowsFor(author, 'published_rich_documents', 'document', chapter), [[original]]);
      assert.deepEqual(await sql(owner, 'SELECT draft_id, document FROM draft_rich_documents'), [
        [7, document('Original draft')],
      ]);
      assert.deepEqual(await history(author), []);
      assert.equal(await head(author), 0);
    });
  }

  await t.test('author and admin restore published content, preserve slug and order, and append immutable history', async () => {
    const [[slug, order, publishedAt]] = await rowsFor(author, 'serial_posts', 'slug, sort_order, published_at', chapter);
    // In the migration run, the first mutation captures the existing publication.
    await call(admin, 'publish_rich_document', chapter, document('Bad publish'));
    const [originalRow] = (await history(author))
      .filter((entry) => entry[3][0] === 1)
      .sort((a, b) => a[1] - b[1])
      .slice(-2);
    assert.equal(originalRow[2], 'author');
    const [sourceId] = originalRow;
    const sourcePayload = await sql(owner, 'SELECT content FROM serial_revision_snapshots WHERE revision_id = ' + sourceId);
    await call(author, 'edit_serial_post', chapter, 'Bad title', 'Bad body');
    const current = await head(author);

    await assert.rejects(call(author, 'restore_serial_post', chapter, sourceId, current - 1), /Revision mismatch/);
    assert.equal(await head(author), current);
    assert.deepEqual(await rowsFor(author, 'serial_posts', 'title, body', chapter), [['Bad title', 'Bad body']]);
    assert.deepEqual(await rowsFor(author, 'published_rich_documents', 'document', chapter), [[document('Bad publish')]]);

    await call(author, 'restore_serial_post', ' CHAPTER-ONE ', sourceId, current);
    assert.deepEqual(await rowsFor(author, 'serial_posts', 'slug, sort_order, published_at, title, body', chapter), [
      [slug, order, publishedAt, 'Original title', 'Original body'],
    ]);
    assert.deepEqual(await rowsFor(author, 'published_rich_documents', 'document', chapter), [[original]]);
    const [id, revision, restoredBy, , parent] = await latest(author);
    assert.notEqual(id, sourceId);
    assert.equal(revision, current + 1);
    assert.equal(restoredBy, 'author');
    // SATS encodes an optional ID as a tagged value.
    assert.deepEqual(parent, [0, sourceId]);
    assert.deepEqual((await history(author)).find((entry) => entry[0] === sourceId), originalRow);
    assert.deepEqual(await sql(owner, 'SELECT content FROM serial_revision_snapshots WHERE revision_id = ' + sourceId), sourcePayload);

    await call(admin, 'restore_serial_post', chapter, sourceId, current + 1);
    assert.equal((await latest(admin))[2], 'admin');
  });

  await t.test('other publishers and anonymous callers cannot read or restore history, including across slugs', async () => {
    const [sourceId, revision] = await latest(author);
    assert.deepEqual(await history(other), []);
    assert.deepEqual(await history(undefined), []);
    for (const table of ['serial_revisions', 'serial_revision_snapshots', 'draft_rich_documents']) {
      await assert.rejects(sql(other, 'SELECT * FROM ' + table), /private|permission|unauthorized|not found/i);
    }
    await assert.rejects(call(other, 'restore_serial_post', chapter, sourceId, revision), /Only the author or an admin/);
    await assert.rejects(call(other, 'publish_rich_document', chapter, document('Other edit')), /Only the author or an admin/);
    await assert.rejects(call(other, 'restore_serial_post', otherChapter, sourceId, await head(other, otherChapter)), /Revision not found/);
    assert.equal(await head(author), revision);
  });

  await t.test('restoring a discarded draft recovers it privately and keeps the publication intact', async () => {
    const before = await rowsFor(author, 'published_rich_documents', 'document', chapter);
    await call(author, 'save_draft', chapter, 7, document('Bad draft edit'));
    const draftRevisions = (await history(author))
      .filter((entry) => entry[3][0] === 0 && entry[3][1] === 7)
      .sort((a, b) => a[1] - b[1]);
    assert.equal(draftRevisions.length, 2);
    const [sourceId] = draftRevisions[0];
    await call(author, 'discard_draft', chapter, 7);
    assert.deepEqual(await sql(owner, 'SELECT draft_id FROM draft_rich_documents'), []);
    const current = await head(author);

    await call(admin, 'restore_serial_post', chapter, sourceId, current);
    assert.deepEqual(await sql(owner, 'SELECT draft_id, document FROM draft_rich_documents'), [[7, document('Original draft')]]);
    assert.deepEqual(await rowsFor(author, 'published_rich_documents', 'document', chapter), before);
    assert.equal(await head(author), current + 1);
  });

  await t.test('restoring a legacy snapshot removes the rich publication without touching the draft', async () => {
    const legacy = 'legacy-chapter';
    await call(author, 'create_serial_post', legacy, 'Legacy title', 'Legacy body');
    await call(author, 'save_draft', legacy, 10, document('Unpublished changes'));
    await call(author, 'publish_rich_document', legacy, document('First rich publication'));
    const [legacyRow] = (await history(author, legacy))
      .filter((entry) => entry[3][0] === 1)
      .sort((a, b) => a[1] - b[1]);
    await call(author, 'restore_serial_post', legacy, legacyRow[0], await head(author, legacy));
    assert.deepEqual(await rowsFor(author, 'published_rich_documents', 'document', legacy), []);
    assert.deepEqual(await rowsFor(author, 'serial_posts', 'title, body', legacy), [['Legacy title', 'Legacy body']]);
    assert.deepEqual(await sql(owner, "SELECT document FROM draft_rich_documents WHERE post_slug = 'legacy-chapter'"), [
      [document('Unpublished changes')],
    ]);
  });

  await t.test('reusing a deleted slug does not expose its previous owner’s history', async () => {
    const reused = 'reused-chapter';
    await call(author, 'create_serial_post', reused, 'Original title', 'Original body');
    await call(author, 'publish_rich_document', reused, document('Original publication'));
    await call(author, 'save_draft', reused, 12, document('Original private draft'));
    const [previousId] = await latest(author, reused);

    await call(author, 'delete_serial_post', reused);
    await call(other, 'create_serial_post', reused, 'New title', 'New body');
    assert.deepEqual(await history(other, reused), []);
    assert.deepEqual(await rowsFor(other, 'published_rich_documents', 'document', reused), []);
    assert.deepEqual(await sql(owner, "SELECT draft_id FROM draft_rich_documents WHERE post_slug = 'reused-chapter'"), []);
    await assert.rejects(call(other, 'restore_serial_post', reused, previousId, 0), /Revision not found/);
  });

  await t.test('retention also enforces the per-chapter snapshot byte budget', async () => {
    const large = 'large-draft';
    const oneMegabyte = 'a'.repeat(1_000_000);
    await call(author, 'create_serial_post', large, 'Large draft', 'Published body');
    for (let index = 1; index <= 17; index++) {
      await call(author, 'save_draft', large, 1, oneMegabyte);
    }
    const revisions = await history(author, large);
    assert.equal(revisions.length, 16);
    assert.equal(Math.min(...revisions.map((row) => row[1])), 2);
    assert.equal(await head(author, large), 17);
  });

  await t.test('retention keeps the newest 100 revisions and prunes expired rows without resetting the head', async () => {
    for (let index = 0; index <= 100; index++) {
      await call(other, 'edit_serial_post', otherChapter, 'Other title', 'Other body ' + index);
    }
    const revisions = await history(other, otherChapter);
    const current = await head(other, otherChapter);
    assert.equal(revisions.length, 100);
    assert.equal(Math.min(...revisions.map((row) => row[1])), current - 99);

    // The database owner backdates the fixture so the real pruning reducer can be tested.
    await sql(owner, "UPDATE serial_revisions SET timestamp = 1 WHERE slug = 'chapter-two'");
    await assert.rejects(call(other, 'restore_serial_post', otherChapter, (await latest(other, otherChapter))[0], current), /Revision not found/);
    await assert.rejects(call(other, 'prune_old_revisions'), /admin/);
    await call(admin, 'prune_old_revisions');
    assert.deepEqual(await history(other, otherChapter), []);
    assert.equal(await head(other, otherChapter), current);
    await call(other, 'edit_serial_post', otherChapter, 'Other title', 'After expiry');
    assert.ok(await head(other, otherChapter) > current);
    assert.ok((await history(author)).length > 0, 'pruning should leave the other chapter intact');
  });
});

