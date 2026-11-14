import { processMedia } from './processor.mjs';
import { uploadKey } from './gateway.mjs';

export function mediaWorker({
  registry, storage, reporter, retryMs = 60_000, now = Date.now, onError = console.error,
}) {
  const retryAt = new Map();
  return async function runOnce() {
    await registry.cleanupExpiredIntents();
    await storage.expirePartialUploads(now());
    const jobs = await registry.jobs();
    const queued = new Set(jobs.map(({ asset_id }) => asset_id));
    for (const id of retryAt.keys()) {
      if (!queued.has(id)) retryAt.delete(id);
    }
    for (const asset of jobs) {
      const id = asset.asset_id;
      if (now() < (retryAt.get(id) ?? 0)) continue;
      try {
        if (asset.storage_key === uploadKey(asset)) {
          await processMedia(asset, { storage, reporter });
        } else {
          await reporter.begin(id);
          await reporter.finish(id, { status: 'failed', reason: 'invalid_storage_key' });
        }
        retryAt.delete(id);
      } catch (error) {
        retryAt.set(id, now() + retryMs);
        onError(error, id);
      }
    }
  };
}
