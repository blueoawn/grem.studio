function startsWith(bytes, signature) {
  return bytes.subarray(0, signature.length).equals(signature);
}

const PNG = Buffer.from('89504e470d0a1a0a', 'hex');
const JPEG = Buffer.from('ffd8ff', 'hex');
const GIF = ['GIF87a', 'GIF89a'].map((header) => Buffer.from(header));
const EBML = Buffer.from('1a45dfa3', 'hex');
const MP4_BRANDS = new Set(['isom', 'iso2', 'iso3', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'dash', 'M4V ', 'MSNV']);

function readVint(bytes, offset, readId = false) {
  const first = bytes[offset];
  if (!first) return null;
  let mask = 0x80;
  let length = 1;
  while (!(first & mask)) {
    mask >>= 1;
    length++;
  }
  if (offset + length > bytes.length) return null;
  let value = readId ? first : (first & (mask - 1));
  for (let i = 1; i < length; i++) value = value * 256 + bytes[offset + i];
  if (!Number.isSafeInteger(value)) return null;
  return { end: offset + length, value };
}

function isWebm(bytes) {
  const header = readVint(bytes, EBML.length);
  if (!header) return false;
  const end = Math.min(bytes.length, header.end + header.value);
  let offset = header.end;
  while (offset < end) {
    const id = readVint(bytes, offset, true);
    const field = id && readVint(bytes, id.end);
    if (!field || field.end + field.value > end) return false;
    offset = field.end + field.value;
    if (id.value === 0x4282) return bytes.toString('latin1', field.end, offset) === 'webm';
  }
  return false;
}

function isMp4(bytes) {
  if (bytes.length < 16 || bytes.toString('latin1', 4, 8) !== 'ftyp') return false;
  const boxEnd = Math.min(bytes.readUInt32BE(0), bytes.length);
  if (boxEnd < 16) return false;
  if (MP4_BRANDS.has(bytes.toString('latin1', 8, 12))) return true;
  for (let offset = 16; offset + 4 <= boxEnd; offset += 4) {
    if (MP4_BRANDS.has(bytes.toString('latin1', offset, offset + 4))) return true;
  }
  return false;
}

/** Classify only the six supported formats. Decoders verify their content later. */
export function sniffType(bytes) {
  if (startsWith(bytes, PNG)) return 'image/png';
  if (startsWith(bytes, JPEG)) return 'image/jpeg';
  if (GIF.some((signature) => startsWith(bytes, signature))) return 'image/gif';
  if (bytes.toString('latin1', 0, 4) === 'RIFF' && bytes.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  if (isMp4(bytes)) return 'video/mp4';
  if (startsWith(bytes, EBML) && isWebm(bytes)) return 'video/webm';
  return null;
}
