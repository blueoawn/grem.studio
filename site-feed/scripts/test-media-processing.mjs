import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat, truncate, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { mediaGateway, uploadKey } from '../media-processor/gateway.mjs';
import { mediaRegistry, spacetimeReporter } from '../media-processor/spacetime.mjs';
import { localStorage } from '../media-processor/storage.mjs';
import { mediaWorker } from '../media-processor/worker.mjs';

const server = new URL(process.env.SITE_FEED_TEST_URL ?? 'http://127.0.0.1:3000');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(server.hostname), 'Use a disposable local SpacetimeDB 1.12 instance');
const database = 'media-test-' + randomUUID();
const db = '/v1/database/' + database;
const moduleDir = fileURLToPath(new URL('../server/spacetimedb/', import.meta.url));
const fixtures = new URL('../media-processor/test/fixtures/', import.meta.url);
const maxBytes = 100 * 1024 ** 2;
const passphrase = 'local media integration passphrase';

async function request(path, { token, body, type, method = 'POST' } = {}) {
  const response = await fetch(new URL(path, server), {
    method, body, signal: AbortSignal.timeout(30_000),
    headers: { ...(type && { 'Content-Type': type }), ...(token && { Authorization: 'Bearer ' + token }) },
  });
  const text = await response.text();
  assert.ok(response.ok, `${response.status} ${text}`);
  return text && JSON.parse(text);
}

const identity = () => request('/v1/identity');
const call = (actor, reducer, ...args) => request(db + '/call/' + reducer, {
  token: actor.token, body: JSON.stringify(args), type: 'application/json',
});
const sql = async (actor, body) => (await request(db + '/sql', {
  token: actor?.token, body, type: 'text/plain',
}))[0].rows;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function publish(owner, processor) {
  const target = resolve(moduleDir, 'target');
  execFileSync(process.env.CARGO ?? 'cargo', [
    'build', '--release', '--locked', '--target', 'wasm32-unknown-unknown',
    '--manifest-path', resolve(moduleDir, 'Cargo.toml'), '--target-dir', target,
  ], { stdio: 'inherit', env: {
    ...process.env, SITE_FEED_OWNER_IDENTITY: owner.identity, SITE_FEED_MEDIA_PROCESSOR_IDENTITY: processor.identity,
  } });
  const body = await readFile(resolve(target, 'wasm32-unknown-unknown/release/site_feed_server.wasm'));
  const result = await request(db, { token: owner.token, body, type: 'application/octet-stream', method: 'PUT' });
  assert.equal(result.Success.op, 'created');
}

test('media processing on SpacetimeDB', async (t) => {
  const [owner, publisher, processor] = await Promise.all([identity(), identity(), identity()]);
  await publish(owner, processor);
  t.after(() => request(db, { token: owner.token, method: 'DELETE' }));
  await call(owner, 'create_publisher_account', 'author', passphrase);
  await call(publisher, 'login', 'author', passphrase);

  const root = await mkdtemp(resolve(tmpdir(), 'site-feed-integration-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const storage = await localStorage(root);
  const registry = mediaRegistry({ server, database, token: processor.token });
  const reporter = spacetimeReporter({ server, database, token: processor.token });
  const run = mediaWorker({ registry, storage, reporter, onError: (error) => { throw error; } });
  const http = createServer(mediaGateway({ storage, registry }));
  await new Promise((ok, fail) => http.listen(0, '127.0.0.1', ok).once('error', fail));
  t.after(() => new Promise((ok, fail) => http.close((error) => error ? fail(error) : ok())));
  const url = (id, suffix = '') => `http://127.0.0.1:${http.address().port}/media/${id}${suffix}`;
  const row = async (id) => {
    const rows = await sql(publisher, `SELECT status, width, height, duration_seconds, content_hash, variants, processing_error FROM my_media_assets WHERE asset_id = '${id}'`);
    assert.equal(rows.length, 1);
    return rows[0];
  };
  const publishReference = async (id, contentType) => {
    await call(publisher, 'create_serial_post', id, 'Media fixture', 'Fixture body');
    const type = contentType.startsWith('image/') ? 'image' : 'video';
    await call(publisher, 'publish_rich_document', id, JSON.stringify({
      version: 1, nodes: [{ id: 'media', type, asset_id: id, ...(type === 'image' ? { alt: 'Fixture' } : { caption: 'Fixture clip' }) }],
    }));
  };
  async function finalize(id, fixture, contentType) {
    const key = uploadKey({ asset_id: id, publisher: publisher.identity });
    const path = resolve(root, key);
    const oversized = fixture === 'oversized-101mb.bin';
    await mkdir(dirname(path), { recursive: true });
    await copyFile(new URL(oversized ? 'truncated.png' : fixture, fixtures), path);
    const reported = (await stat(path)).size;
    await call(publisher, 'create_upload_intent', id, id, fixture, contentType, reported);
    await call(publisher, 'upload_progress', id, reported);
    await call(publisher, 'finalize_upload', id, key);
    // Simulate an oversized object already in storage after valid B1 finalization.
    if (oversized) await truncate(path, 101 * 1024 ** 2);
    assert.equal((await row(id))[0], 0);
    return path;
  }

  await t.test('1 image becomes ready and serves the published image', async () => {
    const id = 'sample-image';
    const path = await finalize(id, 'photo-1200x800.jpg', 'image/jpeg');
    assert.deepEqual(await sql(publisher, 'SELECT asset_id FROM media_processing_jobs'), []);
    const staging = resolve(root, 'partial-uploads');
    await mkdir(staging);
    const expired = `${Date.now() - 5000}-a.part`;
    const active = `${Date.now() + 60_000}-b.part`;
    await Promise.all([expired, active].map((name) => writeFile(resolve(staging, name), 'partial')));
    assert.equal((await fetch(url(id))).status, 404);
    await run();
    assert.deepEqual(await readdir(staging), [active]);
    const [status, width, height, , hash] = await row(id);
    const original = await readFile(path);
    assert.deepEqual([status, width, height, hash], [2, [0, 1200], [0, 800], [0, sha256(original)]]);
    assert.deepEqual((await registry.deliveryAsset(id)).variants.map(({ kind }) => kind), ['Thumbnail']);
    await publishReference(id, 'image/jpeg');
    const response = await fetch(url(id));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/jpeg');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), original);
    assert.equal((await fetch(url(id, '/thumbnail'), { method: 'HEAD' })).status, 200);
    await call(publisher, 'delete_serial_post', id);
    assert.equal((await fetch(url(id))).status, 404);
  });

  await t.test('2 video becomes ready and serves a byte range from its deliverable', async () => {
    const id = 'sample-video';
    await finalize(id, 'clip-5s.mp4', 'video/mp4');
    await run();
    assert.equal((await fetch(url(id))).status, 404, 'Ready but unpublished');
    await publishReference(id, 'video/mp4');
    const [status, , , duration] = await row(id);
    assert.deepEqual([status, duration], [2, [0, 5]]);
    const { variants } = await registry.deliveryAsset(id);
    assert.deepEqual(variants.map(({ kind }) => kind), ['Poster', 'Deliverable']);
    const expected = await readFile(resolve(root, variants[1].path));
    const response = await fetch(url(id, '/deliverable'), { headers: { Range: 'bytes=8-31' } });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('content-range'), 'bytes 8-31/' + expected.length);
    assert.equal(response.headers.get('content-type'), 'video/mp4');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), expected.subarray(8, 32));
  });

  for (const [number, fixture, type, reason] of [
    [3, 'png-renamed.mp4', 'video/mp4', 'unsupported'],
    [4, 'truncated.png', 'image/png', 'malformed'],
    [5, 'oversized-101mb.bin', 'image/png', 'too_large'],
  ]) {
    await t.test(`${number} ${fixture} fails with ${reason} and has no public URL`, async () => {
      const id = `invalid-${number}`;
      await finalize(id, fixture, type);
      await run();
      const [status, , , , hash, variants, failure] = await row(id);
      assert.deepEqual([status, hash[0], variants[0], failure], [3, 1, 1, [0, reason]]);
      await assert.rejects(publishReference(id, type), /not ready/);
      assert.equal((await fetch(url(id))).status, 404);
      assert.equal((await fetch(url(id, '/thumbnail'))).status, 404);
    });
  }

  await t.test('6 interrupted processing stays private and retries with one variant set', async () => {
    const id = 'interrupted-image';
    const path = await finalize(id, 'icon-64x64.png', 'image/png');
    const errors = [];
    let now = 0;
    const retryMs = 1000;
    const interrupted = mediaWorker({
      registry, storage, retryMs, now: () => now,
      onError: (error) => errors.push(error),
      reporter: { ...reporter, finish: () => { throw new Error('interrupted before report'); } },
    });
    await interrupted();
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /interrupted before report/);
    const hash = sha256(await readFile(path));
    const dir = resolve(root, 'variants/media-v1', hash);
    assert.deepEqual(await readdir(dir), ['thumbnail.webp']);
    const before = await stat(resolve(dir, 'thumbnail.webp'));
    now = retryMs - 1;
    await interrupted();
    assert.equal(errors.length, 1);
    now = retryMs;
    assert.equal((await row(id))[0], 1);
    assert.equal((await fetch(url(id))).status, 404);
    await run();
    assert.deepEqual((await row(id)).slice(0, 5), [2, [0, 64], [0, 64], [1, []], [0, hash]]);
    assert.deepEqual(await readdir(dir), ['thumbnail.webp']);
    assert.equal((await stat(resolve(dir, 'thumbnail.webp'))).ino, before.ino);
    await publishReference(id, 'image/png');
    assert.equal((await fetch(url(id))).status, 200);
  });
});
