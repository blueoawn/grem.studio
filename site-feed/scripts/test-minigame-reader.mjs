import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { resolveMinigameEmbed } from '../../shared/serial-minigames.mjs';

const node = {
  id: 'g1', embed_id: 'maze', width: 400, height: 240, title: 'Play the maze',
  params: [{ key: 'level', value: 'hard' }],
};
const game = {
  embedId: 'maze', origin: 'https://minigames.grem.studio', path: '/games/maze/index.html',
  allowedParams: [{ key: 'level', values: ['easy', 'hard'] }],
  policy: { sandbox: 'allow-scripts', allow: '' },
};
const unavailable = { status: 'unavailable', id: 'g1', title: 'Play the maze', width: 400, height: 240 };

test('ready descriptors use the registered URL and script-only sandbox', async () => {
  const result = await resolveMinigameEmbed(node, game, (url, options) => {
    assert.equal(url.href, 'https://minigames.grem.studio/games/maze/index.html?level=hard');
    assert.equal(options.method, 'HEAD');
    assert.equal(options.redirect, 'error');
    assert.equal(options.credentials, 'omit');
    return new Response(null, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  });
  assert.deepEqual(result, {
    ...unavailable, status: 'ready', src: 'https://minigames.grem.studio/games/maze/index.html?level=hard',
    sandbox: 'allow-scripts', allow: '', referrerPolicy: 'no-referrer',
  });
});

test('revoked, missing, or invalid embeds yield a URL-free placeholder with the saved title and size', async () => {
  const original = structuredClone(node);
  const unexpected = () => assert.fail('Unavailable game should not be fetched');
  // The fallback also handles a failed request, so count calls outside that path.
  let calls = 0;
  const request = () => { calls++; return unexpected(); };
  assert.deepEqual(await resolveMinigameEmbed(node, undefined, request), unavailable);
  assert.deepEqual(await resolveMinigameEmbed(node, { ...game, embedId: 'other' }, request), unavailable);
  for (const params of [
    [{ key: 'next', value: 'elsewhere' }],
    [{ key: 'level', value: 'https://elsewhere.example' }],
    [...node.params, ...node.params],
  ]) {
    assert.deepEqual(await resolveMinigameEmbed({ ...node, params }, game, request), unavailable);
  }
  assert.equal(calls, 0);
  assert.deepEqual(node, original);
});

test('redirects, missing files, and unreachable hosts fall back without following the redirect', async (t) => {
  const seen = [];
  const server = createServer((request, response) => {
    seen.push(request.url);
    if (request.url.startsWith(game.path)) {
      response.writeHead(302, { location: '/unapproved-destination' });
    } else {
      response.writeHead(404);
    }
    response.end();
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const local = { ...game, origin: 'http://127.0.0.1:' + server.address().port };
  assert.deepEqual(await resolveMinigameEmbed(node, local), unavailable);
  assert.deepEqual(seen, [game.path + '?level=hard']);
  assert.deepEqual(await resolveMinigameEmbed(node, { ...local, path: '/missing' }), unavailable);
  const failing = async () => { throw new TypeError('Failed to fetch'); };
  assert.deepEqual(await resolveMinigameEmbed(node, local, failing), unavailable);
});
