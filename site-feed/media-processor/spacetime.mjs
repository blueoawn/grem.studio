// SATS-JSON sum values carry their variant name, and options are also sums.
const some = (value) => value === undefined ? { none: [] } : { some: value };

// SQL encodes sums as [tag, value]; Some and None have tags 0 and 1.
const optional = (value) => value?.[0] === 0 ? value[1] : undefined;
const kinds = ['Thumbnail', 'Poster', 'Deliverable'];

export function mediaRegistry({ server, database, token }) {
  const base = new URL(`/v1/database/${encodeURIComponent(database)}/`, server);
  if (!token) throw new Error('A SpacetimeDB processor token is required');
  async function request(path, body, authenticated = true) {
    const response = await fetch(new URL(path, base), {
      method: 'POST',
      headers: {
        'Content-Type': path === 'sql' ? 'text/plain' : 'application/json',
        ...(authenticated && { Authorization: `Bearer ${token}` }),
      },
      body,
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Media registry returned ${response.status}: ${text.trim()}`);
    return text && JSON.parse(text);
  }
  const rows = async (query, authenticated = true) => (await request('sql', query, authenticated))[0].rows;
  return {
    async jobs() {
      const jobs = await rows('SELECT asset_id, publisher, storage_key, content_type, byte_size FROM media_processing_jobs');
      return jobs.map(([asset_id, [publisher], storage_key, content_type, byte_size]) => ({
        asset_id, publisher, storage_key, content_type, byte_size,
      }));
    },
    async deliveryAsset(assetId) {
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(assetId)) return;
      const [row] = await rows(`SELECT asset_id, publisher, content_type, variants FROM media_delivery_assets WHERE asset_id = '${assetId}'`);
      if (!row) return;
      const [asset_id, [publisher], content_type, rawVariants] = row;
      const variants = optional(rawVariants).map(([kind, path, type]) => ({ kind: kinds[kind[0]], path, content_type: type }));
      return { asset_id, publisher, content_type, variants };
    },
    async isPublished(assetId) {
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(assetId)) return false;
      const refs = await rows(`SELECT asset_id FROM published_media_references WHERE asset_id = '${assetId}'`, false);
      return refs.length > 0;
    },
    cleanupExpiredIntents() {
      return request('call/cleanup_expired_upload_intents', '[]');
    },
  };
}

export function spacetimeReporter({ server, database, token, request = fetch }) {
  const endpoint = new URL(`/v1/database/${encodeURIComponent(database)}/call/report_media_processing_result`, server);
  if (!token) throw new Error('A SpacetimeDB processor token is required');

  async function report(assetId, result, { retryFinal = false } = {}) {
    const response = await request(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([assetId, result]),
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    });
    if (response.ok) {
      await response.body?.cancel();
      return;
    }

    const message = (await response.text()).trim();
    // A repeated job still has to send the terminal value so the reducer checks it for equality.
    if (retryFinal && response.status === 530 && message === 'Asset already has a final processing result') return;
    throw new Error(`Media processing reducer returned ${response.status}: ${message}`);
  }

  return {
    begin(assetId) {
      return report(assetId, { Processing: [] }, { retryFinal: true });
    },
    finish(assetId, result) {
      if (result.status === 'failed') return report(assetId, { Failed: result.reason });
      if (result.status !== 'ready') throw new Error('Unknown media processing result');
      const { width, height, duration_seconds, sha256 } = result;
      return report(assetId, { Ready: [
        some(width), some(height), some(duration_seconds),
        result.variants.map(({ kind, path, content_type, byte_size }) => [{ [kind]: [] }, path, content_type, byte_size]),
        some(sha256),
      ] });
    },
  };
}
