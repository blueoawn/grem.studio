import { pipeline } from 'node:stream/promises';

const ASSET_ID = /^[a-zA-Z0-9_-]{1,128}$/;
const ROUTE = /^\/media\/([a-zA-Z0-9_-]{1,128})(?:\/(thumbnail|poster|deliverable))?$/;

// Only the trusted upload service may write under this publisher's namespace.
export function uploadKey(asset) {
  const publisher = asset.publisher.replace(/^0x/, '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(publisher) || !ASSET_ID.test(asset.asset_id)) {
    throw new Error('Invalid publisher or asset ID');
  }
  return `uploads/${publisher}/${asset.asset_id}`;
}

function byteRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  return start <= end ? { start, end } : null;
}

export function mediaGateway({ storage, registry }) {
  return async function serve(req, res) {
    const route = ROUTE.exec(req.url?.split('?')[0]);
    if (!route || !['HEAD', 'GET'].includes(req.method)) {
      res.writeHead(404).end();
      return;
    }
    const [, id, kind] = route;
    try {
      const asset = await registry.deliveryAsset(id);
      if (!asset || !await registry.isPublished(id)) {
        res.writeHead(404).end();
        return;
      }
      const role = kind ?? (asset.content_type.startsWith('video/') ? 'deliverable' : undefined);
      const object = role
        ? asset.variants.find((entry) => entry.kind.toLowerCase() === role)
        : { path: uploadKey(asset), content_type: asset.content_type };
      if (!object) {
        res.writeHead(404).end();
        return;
      }
      const size = await storage.size(object.path);
      const range = req.headers.range && byteRange(req.headers.range, size);
      if (req.headers.range && !range) {
        res.writeHead(416, { 'Content-Range': `bytes */${size}` }).end();
        return;
      }
      const headers = {
        'Content-Type': object.content_type,
        'Content-Length': range ? range.end - range.start + 1 : size,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      };
      if (range) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${size}`;
      const body = req.method === 'GET' ? await storage.read(object.path, range || {}) : null;
      res.writeHead(range ? 206 : 200, headers);
      if (body) await pipeline(body, res);
      else res.end();
    } catch (error) {
      if (res.headersSent) res.destroy(error);
      else res.writeHead(error.code === 'ENOENT' ? 404 : 503).end();
    }
  };
}
