import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { mediaGateway } from './gateway.mjs';
import { mediaRegistry, spacetimeReporter } from './spacetime.mjs';
import { localStorage } from './storage.mjs';
import { mediaWorker } from './worker.mjs';

const {
  SITE_FEED_SERVER: server, SITE_FEED_DATABASE: database, SITE_FEED_PROCESSOR_TOKEN: token,
  SITE_FEED_STORAGE_ROOT: root, SITE_FEED_MEDIA_PORT: port = '8080',
} = process.env;
if (!server || !database || !token || !root) {
  throw new Error('Set SITE_FEED_SERVER, SITE_FEED_DATABASE, SITE_FEED_PROCESSOR_TOKEN and SITE_FEED_STORAGE_ROOT');
}

const settings = { server, database, token };
const storage = await localStorage(root);
const registry = mediaRegistry(settings);
const reporter = spacetimeReporter(settings);
const runOnce = mediaWorker({ registry, storage, reporter });
const http = createServer(mediaGateway({ storage, registry }));
http.listen(Number(port), '127.0.0.1');

const stop = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    stop.abort();
    http.close();
  });
}
while (!stop.signal.aborted) {
  await runOnce().catch((error) => console.error(error.message));
  await delay(5_000, undefined, { signal: stop.signal }).catch((error) => {
    if (error.name !== 'AbortError') throw error;
  });
}
