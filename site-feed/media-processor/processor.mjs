import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdtemp, open, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { sniffType } from './sniff.mjs';

const exec = promisify(execFile);
const MAX_BYTES = 100 * 1024 ** 2;
const MAX_DIMENSION = 8192;
const MAX_DURATION = 3600;
const PREVIEW_SIZE = 256;
// Change this version if an encoding change makes existing variants incompatible.
const VARIANT_PREFIX = 'variants/media-v1';
const TOOLS = { ffmpeg: 'ffmpeg', ffprobe: 'ffprobe' };

class InvalidMedia extends Error {}

async function spool(storage, key, input) {
  const size = await storage.size(key);
  if (!Number.isSafeInteger(size) || size < 0) throw new Error('Storage returned an invalid object size');
  if (size > MAX_BYTES) throw new InvalidMedia('too_large');
  if (size === 0) throw new InvalidMedia('malformed');

  const hash = createHash('sha256');
  let received = 0;
  const inspect = new Transform({
    transform(chunk, _encoding, next) {
      received += chunk.length;
      if (received > MAX_BYTES) return next(new InvalidMedia('too_large'));
      hash.update(chunk);
      next(null, chunk);
    },
  });
  await pipeline(await storage.read(key, { end: size - 1 }), inspect, createWriteStream(input));
  if (received !== size) throw new Error('Stored upload size changed while processing');
  return hash.digest('hex');
}

async function inspectType(input) {
  const file = await open(input, 'r');
  try {
    const buffer = Buffer.alloc(4096);
    const { bytesRead } = await file.read(buffer);
    return sniffType(buffer.subarray(0, bytesRead));
  } finally {
    await file.close();
  }
}

function checkDimensions(width, height) {
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new InvalidMedia('malformed');
  }
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) throw new InvalidMedia('too_large');
}

async function inspectImage(input, dir) {
  const thumbnail = join(dir, 'thumbnail.webp');
  let width;
  let height;
  try {
    // Metadata reads headers only. Check each side before letting libvips decode pixels.
    ({ width, height } = (await sharp(input, { limitInputPixels: false }).metadata()).autoOrient);
    checkDimensions(width, height);
    await sharp(input, { limitInputPixels: MAX_DIMENSION ** 2, failOn: 'warning' })
      .autoOrient()
      .resize(PREVIEW_SIZE, PREVIEW_SIZE, { fit: 'inside', withoutEnlargement: true })
      .webp()
      .toFile(thumbnail);
  } catch (error) {
    if (error instanceof InvalidMedia) throw error;
    // libvips does not attach Node errno codes to its decoder failures.
    if (error.code || /(?:write error|no space left|no such file|permission denied|out of memory)/i.test(error.message)) throw error;
    throw new InvalidMedia('malformed');
  }
  return { width, height, outputs: [{ kind: 'Thumbnail', filename: 'thumbnail.webp', content_type: 'image/webp' }] };
}

function videoInputOptions(type) {
  const format = type === 'video/mp4' ? ['-f', 'mov', '-enable_drefs', '0', '-use_absolute_path', '0'] : ['-f', 'matroska'];
  return ['-protocol_whitelist', 'file', ...format];
}

async function runMediaTool(command, args, timeout) {
  try {
    return (await exec(command, args, { timeout, maxBuffer: 1024 ** 2, windowsHide: true })).stdout;
  } catch (error) {
    if (error.code === 1 && !error.killed && !/(?:encoder .* not found|unknown encoder|no space left|permission denied|cannot allocate memory|option .* not found|no such file)/i.test(error.stderr)) {
      throw new InvalidMedia('malformed');
    }
    // Preserve tool startup/host failures so the queue can retry or alert an operator.
    throw error;
  }
}

const WEBM_VIDEO = ['vp8', 'vp9', 'av1'];
const WEBM_AUDIO = ['opus', 'vorbis'];

async function inspectVideo(input, dir, type, tools) {
  const inputOptions = videoInputOptions(type);
  const { format, streams } = JSON.parse(await runMediaTool(tools.ffprobe, [
    '-v', 'error', '-show_entries', 'format=duration:stream=index,codec_type,codec_name,width,height:stream_disposition=attached_pic',
    '-of', 'json', ...inputOptions, input,
  ], 30_000));
  const video = streams?.find((stream) => stream.codec_type === 'video' && !stream.disposition?.attached_pic);
  const audio = streams?.find((stream) => stream.codec_type === 'audio');
  if (!video) throw new InvalidMedia('malformed');
  checkDimensions(video.width, video.height);

  const duration = Number(format?.duration);
  if (!Number.isFinite(duration) || duration <= 0) throw new InvalidMedia('malformed');
  if (duration > MAX_DURATION) throw new InvalidMedia('too_long');

  const mp4 = type === 'video/mp4';
  if (!mp4 && (!WEBM_VIDEO.includes(video.codec_name) || (audio && !WEBM_AUDIO.includes(audio.codec_name)))) {
    throw new InvalidMedia('unsupported');
  }

  const ffmpeg = [
    '-nostdin', '-hide_banner', '-loglevel', 'error', '-xerror', '-err_detect', 'explode', '-threads', '2',
    ...inputOptions, '-i', input,
  ];
  const mapping = ['-map', `0:${video.index}`, ...(audio ? ['-map', `0:${audio.index}`] : [])];
  const filename = mp4 ? 'video.mp4' : 'video.webm';
  const encoding = mp4
    ? [
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2',
      '-preset', 'fast', '-threads:v', '2', '-c:a', 'aac', '-movflags', '+faststart',
    ]
    : ['-c', 'copy'];

  await runMediaTool(tools.ffmpeg, [
    ...ffmpeg, ...mapping, '-map_metadata', '-1', '-map_chapters', '-1', ...encoding, join(dir, filename),
    // WebM is remuxed using its already browser-compatible codecs. Decode the mapped
    // streams to a null output as well so decode errors prevent publication.
    ...(!mp4 ? [...mapping, '-f', 'null', '-'] : []),
  ], 30 * 60_000);
  await runMediaTool(tools.ffmpeg, [
    ...ffmpeg, '-map', `0:${video.index}`, '-frames:v', '1', '-vf',
    `scale=w='min(${PREVIEW_SIZE},iw)':h='min(${PREVIEW_SIZE},ih)':force_original_aspect_ratio=decrease`,
    '-update', '1', join(dir, 'poster.jpg'),
  ], 30_000);

  return {
    duration_seconds: Math.ceil(duration),
    outputs: [
      { kind: 'Poster', filename: 'poster.jpg', content_type: 'image/jpeg' },
      { kind: 'Deliverable', filename, content_type: type },
    ],
  };
}

/** Process one finalized upload. The storage adapter and reporter are private to the worker. */
export async function processMedia({ asset_id, storage_key, content_type }, { storage, reporter, tools = TOOLS }) {
  await reporter.begin(asset_id);
  const dir = await mkdtemp(join(tmpdir(), 'site-feed-media-'));
  try {
    const input = join(dir, 'upload');
    let result;
    try {
      const sha256 = await spool(storage, storage_key, input);
      const type = await inspectType(input);
      if (!type || type !== content_type) throw new InvalidMedia('unsupported');
      const { outputs, ...metadata } = type.startsWith('image/')
        ? await inspectImage(input, dir)
        : await inspectVideo(input, dir, type, tools);

      // Complete all derivatives before writing any of them to storage.
      for (const { filename } of outputs) {
        if (!(await stat(join(dir, filename))).size) throw new InvalidMedia('malformed');
      }
      const variants = [];
      for (const { kind, filename, content_type } of outputs) {
        const path = `${VARIANT_PREFIX}/${sha256}/${filename}`;
        const byte_size = await storage.putVariantIfAbsent(path, join(dir, filename));
        variants.push({ kind, path, content_type, byte_size });
      }
      result = { status: 'ready', sha256, ...metadata, variants };
    } catch (error) {
      if (!(error instanceof InvalidMedia)) throw error;
      result = { status: 'failed', reason: error.message };
    }

    await reporter.finish(asset_id, result);
    return result;
  } finally {
    await rm(dir, { recursive: true, force: true, maxRetries: 3 });
  }
}
