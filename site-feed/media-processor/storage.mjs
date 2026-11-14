import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, link, mkdir, readdir, realpath, rm, stat } from 'node:fs/promises';
import { isAbsolute, join, relative, sep } from 'node:path';

function objectSegments(key) {
  const segments = key.split('/');
  if (!segments.every((part) => /^[a-z0-9._-]+$/i.test(part) && part !== '.' && part !== '..')) {
    throw new Error('Invalid storage key');
  }
  return segments;
}

async function requireInside(root, location) {
  const path = await realpath(location);
  const child = relative(root, path);
  if (child === '..' || child.startsWith(`..${sep}`) || isAbsolute(child)) throw new Error('Storage key leaves the private root');
  return path;
}

/** The local adapter expects a private, operator-owned directory and immutable upload objects. */
export async function localStorage(directory) {
  const root = await realpath(directory);
  return {
    async expirePartialUploads(now) {
      const staging = await requireInside(root, join(root, 'partial-uploads')).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
      if (!staging) return;
      const entries = await readdir(staging, { withFileTypes: true });
      for (const entry of entries) {
        const match = /^(\d{13})-[a-f0-9-]+\.part$/.exec(entry.name);
        if (entry.isFile() && match && Number(match[1]) <= now) {
          await rm(join(staging, entry.name), { force: true });
        }
      }
    },
    async size(key) {
      const object = await stat(await requireInside(root, join(root, ...objectSegments(key))));
      if (!object.isFile()) throw new Error('Stored upload is not a file');
      return object.size;
    },
    async read(key, { start, end }) {
      return createReadStream(await requireInside(root, join(root, ...objectSegments(key))), { start, end });
    },
    async putVariantIfAbsent(key, source) {
      const segments = objectSegments(key);
      let parent = root;
      for (const segment of segments.slice(0, -1)) {
        const next = join(parent, segment);
        await mkdir(next).catch((error) => { if (error.code !== 'EEXIST') throw error; });
        parent = await requireInside(root, next);
      }
      const path = join(parent, segments.at(-1));
      const temporary = join(parent, `.variant-${randomUUID()}`);
      try {
        await copyFile(source, temporary);
        try {
          // Linking locally publishes the finished object atomically without overwriting an existing variant.
          await link(temporary, path);
        } catch (error) {
          if (error.code !== 'EEXIST') throw error;
        }
        const object = await stat(await requireInside(root, path));
        if (!object.isFile() || !object.size) throw new Error('Invalid stored variant');
        return object.size;
      } finally {
        await rm(temporary, { force: true });
      }
    },
  };
}
