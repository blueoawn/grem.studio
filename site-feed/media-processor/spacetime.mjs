// SATS-JSON sum values carry their variant name, and options are also sums.
const some = (value) => value === undefined ? { none: [] } : { some: value };

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
