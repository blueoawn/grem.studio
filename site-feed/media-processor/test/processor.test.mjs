import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { processMedia } from '../processor.mjs';
import { spacetimeReporter } from '../spacetime.mjs';
import { localStorage } from '../storage.mjs';

const fixtures = new URL('./fixtures/', import.meta.url);
const good = {
  'photo-1200x800.jpg': {
    type: 'image/jpeg', hash: '68f7853383c2efe87c5adf7e93909236d001b747c3d3eaf18d28215a994ee3e7',
    metadata: { width: 1200, height: 800 }, image: { width: 256, height: 171 },
  },
  'icon-64x64.png': {
    type: 'image/png', hash: 'be9e93f614be347d93ba2c9d3483df6a9025fcf4966968afd023ac1b06dcc79f',
    metadata: { width: 64, height: 64 }, image: { width: 64, height: 64 },
  },
  'clip-5s.mp4': {
    type: 'video/mp4', hash: '38ae09db5529bcda627a9b3c95295c05cf2975bf10e57395e521ebc0370c2125',
    metadata: { duration_seconds: 5 }, filename: 'video.mp4', codec: 'h264',
  },
  'clip-5s.webm': {
    type: 'video/webm', hash: '126f2b471e83e6edc3c3ba6e641e57450be8ba9eab11155202183c8b1f1aeeea',
    metadata: { duration_seconds: 5 }, filename: 'video.webm', codec: 'av1',
  },
};

async function setup(t, source, content_type) {
  const root = await mkdtemp(join(tmpdir(), 'site-feed-media-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const asset = { asset_id: 'test-asset', storage_key: 'original', content_type };
  if (source) await copyFile(new URL(source, fixtures), join(root, asset.storage_key));
  const storage = await localStorage(root);
  const reports = [];
  const reporter = {
    async begin(assetId) { reports.push([assetId, 'processing']); },
    async finish(assetId, result) { reports.push([assetId, result]); },
  };
  return { root, asset, storage, reports, reporter, run: () => processMedia(asset, { storage, reporter }) };
}

function assertReports(fixture, result) {
  assert.deepEqual(fixture.reports, [[fixture.asset.asset_id, 'processing'], [fixture.asset.asset_id, result]]);
}

for (const [name, expected] of Object.entries(good)) {
  test(`${name} produces complete ready metadata and variants`, async (t) => {
    const fixture = await setup(t, name, expected.type);
    const result = await fixture.run();
    assertReports(fixture, result);
    const { status, sha256, variants, ...metadata } = result;
    assert.equal(status, 'ready');
    assert.equal(sha256, expected.hash);
    assert.deepEqual(metadata, expected.metadata);
    const variantRoot = `variants/media-v1/${expected.hash}`;
    for (const variant of variants) {
      const written = await stat(join(fixture.root, variant.path));
      assert.ok(written.size > 0);
      assert.equal(written.size, variant.byte_size);
    }
    if (expected.image) {
      assert.deepEqual(variants.map(({ byte_size, ...variant }) => variant), [
        { kind: 'Thumbnail', path: `${variantRoot}/thumbnail.webp`, content_type: 'image/webp' },
      ]);
      const { format, width, height } = await sharp(await readFile(join(fixture.root, variants[0].path))).metadata();
      assert.deepEqual({ width, height, format }, { ...expected.image, format: 'webp' });
    } else {
      assert.deepEqual(variants.map(({ byte_size, ...variant }) => variant), [
        { kind: 'Poster', path: `${variantRoot}/poster.jpg`, content_type: 'image/jpeg' },
        { kind: 'Deliverable', path: `${variantRoot}/${expected.filename}`, content_type: expected.type },
      ]);
      assert.equal((await sharp(await readFile(join(fixture.root, variants[0].path))).metadata()).format, 'jpeg');
      const probe = JSON.parse(execFileSync('ffprobe', [
        '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'format=duration:stream=codec_name',
        '-of', 'json', join(fixture.root, variants[1].path),
      ], { encoding: 'utf8' }));
      assert.equal(probe.streams[0].codec_name, expected.codec);
      assert.equal(Number(probe.format.duration), 5);
    }
  });
}

for (const [name, type, reason] of [
  ['png-renamed.mp4', 'video/mp4', 'unsupported'],
  ['truncated.png', 'image/png', 'malformed'],
  ['huge-9000x10.png', 'image/png', 'too_large'],
  ['long-3601s.webm', 'video/webm', 'too_long'],
  ['script.svg', 'image/svg', 'unsupported'],
]) {
  test(`${name} reports ${reason} and writes no variants`, async (t) => {
    const fixture = await setup(t, name, type);
    const result = await fixture.run();
    assert.deepEqual(result, { status: 'failed', reason });
    assertReports(fixture, result);
    assert.deepEqual(await readdir(fixture.root), ['original']);
  });
}

test('a 101 MiB object is refused without reading past 100 MiB', async (t) => {
  const fixture = await setup(t, null, 'image/png');
  let readBytes = 0;
  fixture.storage.size = async () => 101 * 1024 ** 2;
  fixture.storage.read = async function* (_key, { end }) {
    const chunk = Buffer.alloc(1024 ** 2);
    for (let offset = 0; offset <= end; offset += chunk.length) {
      const data = chunk.subarray(0, Math.min(chunk.length, end - offset + 1));
      readBytes += data.length;
      yield data;
    }
  };
  const result = await fixture.run();
  assert.deepEqual(result, { status: 'failed', reason: 'too_large' });
  assertReports(fixture, result);
  assert.equal(readBytes, 0);
  assert.deepEqual(await readdir(fixture.root), []);
});

test('a retry reports the same SHA and reuses one set of variants', async (t) => {
  const fixture = await setup(t, 'photo-1200x800.jpg', 'image/jpeg');
  const calls = [];
  const reporter = spacetimeReporter({
    server: 'http://localhost:3000', database: 'fixture-db', token: 'fixture-token',
    async request(url, options) {
      assert.equal(url.pathname, '/v1/database/fixture-db/call/report_media_processing_result');
      assert.equal(options.headers.Authorization, 'Bearer fixture-token');
      calls.push(JSON.parse(options.body));
      return calls.length === 3 ? new Response('Asset already has a final processing result', { status: 530 }) : new Response(null, { status: 200 });
    },
  });
  const run = () => processMedia(fixture.asset, { storage: fixture.storage, reporter });
  const first = await run();
  const variant = join(fixture.root, first.variants[0].path);
  const bytes = await readFile(variant);
  const before = await stat(variant);
  const second = await run();
  assert.equal(first.sha256, good['photo-1200x800.jpg'].hash);
  assert.deepEqual(second, first);
  const begin = [fixture.asset.asset_id, { Processing: [] }];
  const { path, byte_size } = first.variants[0];
  const finish = [fixture.asset.asset_id, { Ready: [
    { some: 1200 }, { some: 800 }, { none: [] },
    [[{ Thumbnail: [] }, path, 'image/webp', byte_size]], { some: first.sha256 },
  ] }];
  assert.deepEqual(calls, [begin, finish, begin, finish]);
  assert.deepEqual(await readFile(variant), bytes);
  assert.equal((await stat(variant)).mtimeMs, before.mtimeMs);
  assert.deepEqual(await readdir(join(fixture.root, `variants/media-v1/${first.sha256}`)), ['thumbnail.webp']);
});
