var Se = {}, wt;
function or() {
  if (wt) return Se;
  wt = 1, Se.byteLength = l, Se.toByteArray = f, Se.fromByteArray = b;
  for (var e = [], t = [], r = typeof Uint8Array < "u" ? Uint8Array : Array, n = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", a = 0, u = n.length; a < u; ++a)
    e[a] = n[a], t[n.charCodeAt(a)] = a;
  t[45] = 62, t[95] = 63;
  function o(m) {
    var p = m.length;
    if (p % 4 > 0)
      throw new Error("Invalid string. Length must be a multiple of 4");
    var w = m.indexOf("=");
    w === -1 && (w = p);
    var U = w === p ? 0 : 4 - w % 4;
    return [w, U];
  }
  function l(m) {
    var p = o(m), w = p[0], U = p[1];
    return (w + U) * 3 / 4 - U;
  }
  function d(m, p, w) {
    return (p + w) * 3 / 4 - w;
  }
  function f(m) {
    var p, w = o(m), U = w[0], g = w[1], I = new r(d(m, U, g)), T = 0, E = g > 0 ? U - 4 : U, x;
    for (x = 0; x < E; x += 4)
      p = t[m.charCodeAt(x)] << 18 | t[m.charCodeAt(x + 1)] << 12 | t[m.charCodeAt(x + 2)] << 6 | t[m.charCodeAt(x + 3)], I[T++] = p >> 16 & 255, I[T++] = p >> 8 & 255, I[T++] = p & 255;
    return g === 2 && (p = t[m.charCodeAt(x)] << 2 | t[m.charCodeAt(x + 1)] >> 4, I[T++] = p & 255), g === 1 && (p = t[m.charCodeAt(x)] << 10 | t[m.charCodeAt(x + 1)] << 4 | t[m.charCodeAt(x + 2)] >> 2, I[T++] = p >> 8 & 255, I[T++] = p & 255), I;
  }
  function y(m) {
    return e[m >> 18 & 63] + e[m >> 12 & 63] + e[m >> 6 & 63] + e[m & 63];
  }
  function v(m, p, w) {
    for (var U, g = [], I = p; I < w; I += 3)
      U = (m[I] << 16 & 16711680) + (m[I + 1] << 8 & 65280) + (m[I + 2] & 255), g.push(y(U));
    return g.join("");
  }
  function b(m) {
    for (var p, w = m.length, U = w % 3, g = [], I = 16383, T = 0, E = w - U; T < E; T += I)
      g.push(v(m, T, T + I > E ? E : T + I));
    return U === 1 ? (p = m[w - 1], g.push(
      e[p >> 2] + e[p << 4 & 63] + "=="
    )) : U === 2 && (p = (m[w - 2] << 8) + m[w - 1], g.push(
      e[p >> 10] + e[p >> 4 & 63] + e[p << 2 & 63] + "="
    )), g.join("");
  }
  return Se;
}
var Kt = or(), Te = class je {
  __time_duration_micros__;
  static MICROS_PER_MILLIS = 1000n;
  /**
   * Get the algebraic type representation of the {@link TimeDuration} type.
   * @returns The algebraic type representation of the type.
   */
  static getAlgebraicType() {
    return h.Product({
      elements: [
        {
          name: "__time_duration_micros__",
          algebraicType: h.I64
        }
      ]
    });
  }
  static isTimeDuration(t) {
    if (t.tag !== "Product")
      return !1;
    const r = t.value.elements;
    if (r.length !== 1)
      return !1;
    const n = r[0];
    return n.name === "__time_duration_micros__" && n.algebraicType.tag === "I64";
  }
  get micros() {
    return this.__time_duration_micros__;
  }
  get millis() {
    return Number(this.micros / je.MICROS_PER_MILLIS);
  }
  constructor(t) {
    this.__time_duration_micros__ = t;
  }
  static fromMillis(t) {
    return new je(BigInt(t) * je.MICROS_PER_MILLIS);
  }
  /** This outputs the same string format that we use in the host and in Rust modules */
  toString() {
    const t = this.micros, r = t < 0 ? "-" : "+", n = t < 0 ? -t : t, a = n / 1000000n, u = n % 1000000n;
    return `${r}${a}.${String(u).padStart(6, "0")}`;
  }
}, Re = class ge {
  __timestamp_micros_since_unix_epoch__;
  static MICROS_PER_MILLIS = 1000n;
  get microsSinceUnixEpoch() {
    return this.__timestamp_micros_since_unix_epoch__;
  }
  constructor(t) {
    this.__timestamp_micros_since_unix_epoch__ = t;
  }
  /**
   * Get the algebraic type representation of the {@link Timestamp} type.
   * @returns The algebraic type representation of the type.
   */
  static getAlgebraicType() {
    return h.Product({
      elements: [
        {
          name: "__timestamp_micros_since_unix_epoch__",
          algebraicType: h.I64
        }
      ]
    });
  }
  static isTimestamp(t) {
    if (t.tag !== "Product")
      return !1;
    const r = t.value.elements;
    if (r.length !== 1)
      return !1;
    const n = r[0];
    return n.name === "__timestamp_micros_since_unix_epoch__" && n.algebraicType.tag === "I64";
  }
  /**
   * The Unix epoch, the midnight at the beginning of January 1, 1970, UTC.
   */
  static UNIX_EPOCH = new ge(0n);
  /**
   * Get a `Timestamp` representing the execution environment's belief of the current moment in time.
   */
  static now() {
    return ge.fromDate(/* @__PURE__ */ new Date());
  }
  /** Convert to milliseconds since Unix epoch. */
  toMillis() {
    return this.microsSinceUnixEpoch / 1000n;
  }
  /**
   * Get a `Timestamp` representing the same point in time as `date`.
   */
  static fromDate(t) {
    const r = t.getTime(), n = BigInt(r) * ge.MICROS_PER_MILLIS;
    return new ge(n);
  }
  /**
   * Get a `Date` representing approximately the same point in time as `this`.
   *
   * This method truncates to millisecond precision,
   * and throws `RangeError` if the `Timestamp` is outside the range representable as a `Date`.
   */
  toDate() {
    const r = this.__timestamp_micros_since_unix_epoch__ / ge.MICROS_PER_MILLIS;
    if (r > BigInt(Number.MAX_SAFE_INTEGER) || r < BigInt(Number.MIN_SAFE_INTEGER))
      throw new RangeError(
        "Timestamp is outside of the representable range of JS's Date"
      );
    return new Date(Number(r));
  }
  since(t) {
    return new Te(
      this.__timestamp_micros_since_unix_epoch__ - t.__timestamp_micros_since_unix_epoch__
    );
  }
}, jt = class A {
  __uuid__;
  /**
   * The nil UUID (all zeros).
   *
   * @example
   * ```ts
   * const uuid = Uuid.NIL;
   * console.assert(
   *   uuid.toString() === "00000000-0000-0000-0000-000000000000"
   * );
   * ```
   */
  static NIL = new A(0n);
  static MAX_UUID_BIGINT = 0xffffffffffffffffffffffffffffffffn;
  /**
   * The max UUID (all ones).
   *
   * @example
   * ```ts
   * const uuid = Uuid.MAX;
   * console.assert(
   *   uuid.toString() === "ffffffff-ffff-ffff-ffff-ffffffffffff"
   * );
   * ```
   */
  static MAX = new A(A.MAX_UUID_BIGINT);
  /**
   * Create a UUID from a raw 128-bit value.
   *
   * @param u - Unsigned 128-bit integer
   * @throws {Error} If the value is outside the valid UUID range
   */
  constructor(t) {
    if (t < 0n || t > A.MAX_UUID_BIGINT)
      throw new Error("Invalid UUID: must be between 0 and `MAX_UUID_BIGINT`");
    this.__uuid__ = t;
  }
  /**
   * Create a UUID `v4` from explicit random bytes.
   *
   * This method assumes the bytes are already sufficiently random.
   * It only sets the appropriate bits for the UUID version and variant.
   *
   * @param bytes - Exactly 16 random bytes
   * @returns A UUID `v4`
   * @throws {Error} If `bytes.length !== 16`
   *
   * @example
   * ```ts
   * const randomBytes = new Uint8Array(16);
   * const uuid = Uuid.fromRandomBytesV4(randomBytes);
   *
   * console.assert(
   *   uuid.toString() === "00000000-0000-4000-8000-000000000000"
   * );
   * ```
   */
  static fromRandomBytesV4(t) {
    if (t.length !== 16) throw new Error("UUID v4 requires 16 bytes");
    const r = new Uint8Array(t);
    return r[6] = r[6] & 15 | 64, r[8] = r[8] & 63 | 128, new A(A.bytesToBigInt(r));
  }
  /**
   * Generate a UUID `v7` using a monotonic counter from `0` to `2^31 - 1`,
   * a timestamp, and 4 random bytes.
   *
   * The counter wraps around on overflow.
   *
   * The UUID `v7` is structured as follows:
   *
   * ```ascii
   * ┌───────────────────────────────────────────────┬───────────────────┐
   * | B0  | B1  | B2  | B3  | B4  | B5              |         B6        |
   * ├───────────────────────────────────────────────┼───────────────────┤
   * |                 unix_ts_ms                    |      version 7    |
   * └───────────────────────────────────────────────┴───────────────────┘
   * ┌──────────────┬─────────┬──────────────────┬───────────────────────┐
   * | B7           | B8      | B9  | B10 | B11  | B12 | B13 | B14 | B15 |
   * ├──────────────┼─────────┼──────────────────┼───────────────────────┤
   * | counter_high | variant |    counter_low   |        random         |
   * └──────────────┴─────────┴──────────────────┴───────────────────────┘
   * ```
   *
   * @param counter - Mutable monotonic counter (31-bit)
   * @param now - Timestamp since the Unix epoch
   * @param randomBytes - Exactly 4 random bytes
   * @returns A UUID `v7`
   *
   * @throws {Error} If the `counter` is negative
   * @throws {Error} If the `timestamp` is before the Unix epoch
   * @throws {Error} If `randomBytes.length !== 4`
   *
   * @example
   * ```ts
   * const now = Timestamp.fromMillis(1_686_000_000_000n);
   * const counter = { value: 1 };
   * const randomBytes = new Uint8Array(4);
   *
   * const uuid = Uuid.fromCounterV7(counter, now, randomBytes);
   *
   * console.assert(
   *   uuid.toString() === "0000647e-5180-7000-8000-000200000000"
   * );
   * ```
   */
  static fromCounterV7(t, r, n) {
    if (n.length !== 4)
      throw new Error("`fromCounterV7` requires `randomBytes.length == 4`");
    if (t.value < 0)
      throw new Error("`fromCounterV7` uuid `counter` must be non-negative");
    if (r.__timestamp_micros_since_unix_epoch__ < 0)
      throw new Error("`fromCounterV7` `timestamp` before unix epoch");
    const a = t.value;
    t.value = a + 1 & 2147483647;
    const u = r.toMillis() & 0xffffffffffffn, o = new Uint8Array(16);
    return o[0] = Number(u >> 40n & 0xffn), o[1] = Number(u >> 32n & 0xffn), o[2] = Number(u >> 24n & 0xffn), o[3] = Number(u >> 16n & 0xffn), o[4] = Number(u >> 8n & 0xffn), o[5] = Number(u & 0xffn), o[7] = a >>> 23 & 255, o[9] = a >>> 15 & 255, o[10] = a >>> 7 & 255, o[11] = (a & 127) << 1 & 255, o[12] |= n[0] & 127, o[13] = n[1], o[14] = n[2], o[15] = n[3], o[6] = o[6] & 15 | 112, o[8] = o[8] & 63 | 128, new A(A.bytesToBigInt(o));
  }
  /**
   * Parse a UUID from a string representation.
   *
   * @param s - UUID string
   * @returns Parsed UUID
   * @throws {Error} If the string is not a valid UUID
   *
   * @example
   * ```ts
   * const s = "01888d6e-5c00-7000-8000-000000000000";
   * const uuid = Uuid.parse(s);
   *
   * console.assert(uuid.toString() === s);
   * ```
   */
  static parse(t) {
    const r = t.replace(/-/g, "");
    if (r.length !== 32) throw new Error("Invalid hex UUID");
    let n = 0n;
    for (let a = 0; a < 32; a += 2)
      n = n << 8n | BigInt(parseInt(r.slice(a, a + 2), 16));
    return new A(n);
  }
  /** Convert to string (hyphenated form). */
  toString() {
    const r = [...A.bigIntToBytes(this.__uuid__)].map((n) => n.toString(16).padStart(2, "0")).join("");
    return r.slice(0, 8) + "-" + r.slice(8, 12) + "-" + r.slice(12, 16) + "-" + r.slice(16, 20) + "-" + r.slice(20);
  }
  /** Convert to bigint (u128). */
  asBigInt() {
    return this.__uuid__;
  }
  /** Return a `Uint8Array` of 16 bytes. */
  toBytes() {
    return A.bigIntToBytes(this.__uuid__);
  }
  static bytesToBigInt(t) {
    let r = 0n;
    for (const n of t) r = r << 8n | BigInt(n);
    return r;
  }
  static bigIntToBytes(t) {
    const r = new Uint8Array(16);
    for (let n = 15; n >= 0; n--)
      r[n] = Number(t & 0xffn), t >>= 8n;
    return r;
  }
  /**
   * Returns the version of this UUID.
   *
   * This represents the algorithm used to generate the value.
   *
   * @returns A `UuidVersion`
   * @throws {Error} If the version field is not recognized
   */
  getVersion() {
    const t = this.toBytes()[6] >> 4 & 15;
    switch (t) {
      case 4:
        return "V4";
      case 7:
        return "V7";
      default:
        if (this == A.NIL)
          return "Nil";
        if (this == A.MAX)
          return "Max";
        throw new Error(`Unsupported UUID version: ${t}`);
    }
  }
  /**
   * Extract the monotonic counter from a UUIDv7.
   *
   * Intended for testing and diagnostics.
   * Behavior is undefined if called on a non-V7 UUID.
   *
   * @returns 31-bit counter value
   */
  getCounter() {
    const t = this.toBytes(), r = t[7], n = t[9], a = t[10], u = t[11] >>> 1;
    return r << 23 | n << 15 | a << 7 | u | 0;
  }
  compareTo(t) {
    return this.__uuid__ < t.__uuid__ ? -1 : this.__uuid__ > t.__uuid__ ? 1 : 0;
  }
  static getAlgebraicType() {
    return h.Product({
      elements: [
        {
          name: "__uuid__",
          algebraicType: h.U128
        }
      ]
    });
  }
}, G = class {
  #r;
  #e;
  #t = 0;
  constructor(e) {
    this.#r = new Uint8Array(e), this.#e = new DataView(this.#r.buffer);
  }
  #n(e) {
    const t = this.#t + e + 1;
    if (t <= this.#r.length) return;
    let r = this.#r.length * 2;
    r < t && (r = t);
    const n = new Uint8Array(r);
    n.set(this.#r), this.#r = n, this.#e = new DataView(this.#r.buffer);
  }
  toBase64() {
    return Kt.fromByteArray(this.#r.subarray(0, this.#t));
  }
  getBuffer() {
    return this.#r.slice(0, this.#t);
  }
  get offset() {
    return this.#t;
  }
  writeUInt8Array(e) {
    const t = e.length;
    this.#n(4 + t), this.writeU32(t), this.#r.set(e, this.#t), this.#t += e.length;
  }
  writeBool(e) {
    this.#n(1), this.#e.setUint8(this.#t, e ? 1 : 0), this.#t += 1;
  }
  writeByte(e) {
    this.#n(1), this.#e.setUint8(this.#t, e), this.#t += 1;
  }
  writeI8(e) {
    this.#n(1), this.#e.setInt8(this.#t, e), this.#t += 1;
  }
  writeU8(e) {
    this.#n(1), this.#e.setUint8(this.#t, e), this.#t += 1;
  }
  writeI16(e) {
    this.#n(2), this.#e.setInt16(this.#t, e, !0), this.#t += 2;
  }
  writeU16(e) {
    this.#n(2), this.#e.setUint16(this.#t, e, !0), this.#t += 2;
  }
  writeI32(e) {
    this.#n(4), this.#e.setInt32(this.#t, e, !0), this.#t += 4;
  }
  writeU32(e) {
    this.#n(4), this.#e.setUint32(this.#t, e, !0), this.#t += 4;
  }
  writeI64(e) {
    this.#n(8), this.#e.setBigInt64(this.#t, e, !0), this.#t += 8;
  }
  writeU64(e) {
    this.#n(8), this.#e.setBigUint64(this.#t, e, !0), this.#t += 8;
  }
  writeU128(e) {
    this.#n(16);
    const t = e & BigInt("0xFFFFFFFFFFFFFFFF"), r = e >> BigInt(64);
    this.#e.setBigUint64(this.#t, t, !0), this.#e.setBigUint64(this.#t + 8, r, !0), this.#t += 16;
  }
  writeI128(e) {
    this.#n(16);
    const t = e & BigInt("0xFFFFFFFFFFFFFFFF"), r = e >> BigInt(64);
    this.#e.setBigInt64(this.#t, t, !0), this.#e.setBigInt64(this.#t + 8, r, !0), this.#t += 16;
  }
  writeU256(e) {
    this.#n(32);
    const t = BigInt("0xFFFFFFFFFFFFFFFF"), r = e & t, n = e >> BigInt(64) & t, a = e >> BigInt(128) & t, u = e >> BigInt(192);
    this.#e.setBigUint64(this.#t + 0, r, !0), this.#e.setBigUint64(this.#t + 8, n, !0), this.#e.setBigUint64(this.#t + 16, a, !0), this.#e.setBigUint64(this.#t + 24, u, !0), this.#t += 32;
  }
  writeI256(e) {
    this.#n(32);
    const t = BigInt("0xFFFFFFFFFFFFFFFF"), r = e & t, n = e >> BigInt(64) & t, a = e >> BigInt(128) & t, u = e >> BigInt(192);
    this.#e.setBigUint64(this.#t + 0, r, !0), this.#e.setBigUint64(this.#t + 8, n, !0), this.#e.setBigUint64(this.#t + 16, a, !0), this.#e.setBigInt64(this.#t + 24, u, !0), this.#t += 32;
  }
  writeF32(e) {
    this.#n(4), this.#e.setFloat32(this.#t, e, !0), this.#t += 4;
  }
  writeF64(e) {
    this.#n(8), this.#e.setFloat64(this.#t, e, !0), this.#t += 8;
  }
  writeString(e) {
    const r = new TextEncoder().encode(e);
    this.writeU32(r.length), this.#n(r.length), this.#r.set(r, this.#t), this.#t += r.length;
  }
}, J = class {
  /**
   * The DataView used to read values from the binary data.
   *
   * Note: The DataView's `byteOffset` is relative to the beginning of the
   * underlying ArrayBuffer, not the start of the provided Uint8Array input.
   * This `BinaryReader`'s `#offset` field is used to track the current read position
   * relative to the start of the provided Uint8Array input.
   */
  #r;
  /**
   * Represents the offset (in bytes) relative to the start of the DataView
   * and provided Uint8Array input.
   *
   * Note: This is *not* the absolute byte offset within the underlying ArrayBuffer.
   */
  #e = 0;
  constructor(e) {
    this.#r = new DataView(e.buffer, e.byteOffset, e.byteLength), this.#e = 0;
  }
  get offset() {
    return this.#e;
  }
  get remaining() {
    return this.#r.byteLength - this.#e;
  }
  /** Ensure we have at least `n` bytes left to read */
  #t(e) {
    if (this.#e + e > this.#r.byteLength)
      throw new RangeError(
        `Tried to read ${e} byte(s) at relative offset ${this.#e}, but only ${this.remaining} byte(s) remain`
      );
  }
  readUInt8Array() {
    const e = this.readU32();
    return this.#t(e), this.readBytes(e);
  }
  readBool() {
    const e = this.#r.getUint8(this.#e);
    return this.#e += 1, e !== 0;
  }
  readByte() {
    const e = this.#r.getUint8(this.#e);
    return this.#e += 1, e;
  }
  readBytes(e) {
    const t = new Uint8Array(
      this.#r.buffer,
      this.#r.byteOffset + this.#e,
      e
    );
    return this.#e += e, t;
  }
  readI8() {
    const e = this.#r.getInt8(this.#e);
    return this.#e += 1, e;
  }
  readU8() {
    return this.readByte();
  }
  readI16() {
    const e = this.#r.getInt16(this.#e, !0);
    return this.#e += 2, e;
  }
  readU16() {
    const e = this.#r.getUint16(this.#e, !0);
    return this.#e += 2, e;
  }
  readI32() {
    const e = this.#r.getInt32(this.#e, !0);
    return this.#e += 4, e;
  }
  readU32() {
    const e = this.#r.getUint32(this.#e, !0);
    return this.#e += 4, e;
  }
  readI64() {
    const e = this.#r.getBigInt64(this.#e, !0);
    return this.#e += 8, e;
  }
  readU64() {
    const e = this.#r.getBigUint64(this.#e, !0);
    return this.#e += 8, e;
  }
  readU128() {
    const e = this.#r.getBigUint64(this.#e, !0), t = this.#r.getBigUint64(this.#e + 8, !0);
    return this.#e += 16, (t << BigInt(64)) + e;
  }
  readI128() {
    const e = this.#r.getBigUint64(this.#e, !0), t = this.#r.getBigInt64(this.#e + 8, !0);
    return this.#e += 16, (t << BigInt(64)) + e;
  }
  readU256() {
    const e = this.#r.getBigUint64(this.#e, !0), t = this.#r.getBigUint64(this.#e + 8, !0), r = this.#r.getBigUint64(this.#e + 16, !0), n = this.#r.getBigUint64(this.#e + 24, !0);
    return this.#e += 32, (n << BigInt(192)) + (r << BigInt(128)) + (t << BigInt(64)) + e;
  }
  readI256() {
    const e = this.#r.getBigUint64(this.#e, !0), t = this.#r.getBigUint64(this.#e + 8, !0), r = this.#r.getBigUint64(this.#e + 16, !0), n = this.#r.getBigInt64(this.#e + 24, !0);
    return this.#e += 32, (n << BigInt(192)) + (r << BigInt(128)) + (t << BigInt(64)) + e;
  }
  readF32() {
    const e = this.#r.getFloat32(this.#e, !0);
    return this.#e += 4, e;
  }
  readF64() {
    const e = this.#r.getFloat64(this.#e, !0);
    return this.#e += 8, e;
  }
  readString() {
    const e = this.readUInt8Array();
    return new TextDecoder("utf-8").decode(e);
  }
};
function De(e) {
  const t = e.replace(/([-_][a-z])/gi, (r) => r.toUpperCase().replace("-", "").replace("_", ""));
  return t.charAt(0).toUpperCase() + t.slice(1);
}
function Ee(e, t) {
  if (e === t) return !0;
  if (typeof e != "object" || e === null || typeof t != "object" || t === null)
    return !1;
  const r = Object.keys(e), n = Object.keys(t);
  if (r.length !== n.length) return !1;
  for (const a of r)
    if (!n.includes(a) || !Ee(e[a], t[a]))
      return !1;
  return !0;
}
function $t(e) {
  return Array.prototype.map.call(e.reverse(), (t) => ("00" + t.toString(16)).slice(-2)).join("");
}
function cr(e) {
  if (e.length != 16)
    throw new Error(`Uint8Array is not 16 bytes long: ${e}`);
  return new J(e).readU128();
}
function lr(e) {
  if (e.length != 32)
    throw new Error(`Uint8Array is not 32 bytes long: [${e}]`);
  return new J(e).readU256();
}
function zt(e) {
  e.startsWith("0x") && (e = e.slice(2));
  const t = e.match(/.{1,2}/g) || [];
  return Uint8Array.from(
    t.map((n) => parseInt(n, 16))
  ).reverse();
}
function dr(e) {
  return cr(zt(e));
}
function hr(e) {
  return lr(zt(e));
}
function Lt(e) {
  const t = new G(16);
  return t.writeU128(e), t.getBuffer();
}
function mr(e) {
  return $t(Lt(e));
}
function Ht(e) {
  const t = new G(32);
  return t.writeU256(e), t.getBuffer();
}
function pr(e) {
  return $t(Ht(e));
}
function ke(e) {
  return e.replace(/[-_]+/g, "_").replace(/_([a-zA-Z0-9])/g, (t, r) => r.toUpperCase());
}
function Pe(e, t) {
  for (; t.tag === "Ref"; ) t = e.types[t.value];
  if (t.tag === "Product") {
    let n = 0;
    for (const { algebraicType: a } of t.value.elements)
      n += Pe(e, a);
    return n;
  } else if (t.tag === "Sum") {
    let n = 1 / 0;
    for (const { algebraicType: a } of t.value.variants) {
      const u = Pe(e, a);
      u < n && (n = u);
    }
    return n === 1 / 0 && (n = 0), 4 + n;
  } else if (t.tag == "Array")
    return 4 + 4 * Pe(e, t.value);
  return {
    String: 8,
    Sum: 1,
    Bool: 1,
    I8: 1,
    U8: 1,
    I16: 2,
    U16: 2,
    I32: 4,
    U32: 4,
    F32: 4,
    I64: 8,
    U64: 8,
    F64: 8,
    I128: 16,
    U128: 16,
    I256: 32,
    U256: 32
  }[t.tag];
}
var ht = class Ze {
  __identity__;
  /**
   * Creates a new `Identity`.
   *
   * `data` can be a hexadecimal string or a `bigint`.
   */
  constructor(t) {
    this.__identity__ = typeof t == "string" ? hr(t) : t;
  }
  /**
   * Get the algebraic type representation of the {@link Identity} type.
   * @returns The algebraic type representation of the type.
   */
  static getAlgebraicType() {
    return h.Product({
      elements: [{ name: "__identity__", algebraicType: h.U256 }]
    });
  }
  /**
   * Check if two identities are equal.
   */
  isEqual(t) {
    return this.toHexString() === t.toHexString();
  }
  /**
   * Check if two identities are equal.
   */
  equals(t) {
    return this.isEqual(t);
  }
  /**
   * Print the identity as a hexadecimal string.
   */
  toHexString() {
    return pr(this.__identity__);
  }
  /**
   * Convert the address to a Uint8Array.
   */
  toUint8Array() {
    return Ht(this.__identity__);
  }
  /**
   * Parse an Identity from a hexadecimal string.
   */
  static fromString(t) {
    return new Ze(t);
  }
  /**
   * Zero identity (0x0000000000000000000000000000000000000000000000000000000000000000)
   */
  static zero() {
    return new Ze(0n);
  }
  toString() {
    return this.toHexString();
  }
}, h = {
  Ref: (e) => ({ tag: "Ref", value: e }),
  Sum: (e) => ({
    tag: "Sum",
    value: e
  }),
  Product: (e) => ({
    tag: "Product",
    value: e
  }),
  Array: (e) => ({
    tag: "Array",
    value: e
  }),
  String: { tag: "String" },
  Bool: { tag: "Bool" },
  I8: { tag: "I8" },
  U8: { tag: "U8" },
  I16: { tag: "I16" },
  U16: { tag: "U16" },
  I32: { tag: "I32" },
  U32: { tag: "U32" },
  I64: { tag: "I64" },
  U64: { tag: "U64" },
  I128: { tag: "I128" },
  U128: { tag: "U128" },
  I256: { tag: "I256" },
  U256: { tag: "U256" },
  F32: { tag: "F32" },
  F64: { tag: "F64" },
  serializeValue(e, t, r, n) {
    if (t.tag === "Ref") {
      if (!n)
        throw new Error("cannot serialize refs without a typespace");
      for (; t.tag === "Ref"; ) t = n.types[t.value];
    }
    switch (t.tag) {
      case "Product":
        Z.serializeValue(e, t.value, r, n);
        break;
      case "Sum":
        vt.serializeValue(e, t.value, r, n);
        break;
      case "Array":
        if (t.value.tag === "U8")
          e.writeUInt8Array(r);
        else {
          const a = t.value;
          e.writeU32(r.length);
          for (const u of r)
            h.serializeValue(e, a, u, n);
        }
        break;
      case "Bool":
        e.writeBool(r);
        break;
      case "I8":
        e.writeI8(r);
        break;
      case "U8":
        e.writeU8(r);
        break;
      case "I16":
        e.writeI16(r);
        break;
      case "U16":
        e.writeU16(r);
        break;
      case "I32":
        e.writeI32(r);
        break;
      case "U32":
        e.writeU32(r);
        break;
      case "I64":
        e.writeI64(r);
        break;
      case "U64":
        e.writeU64(r);
        break;
      case "I128":
        e.writeI128(r);
        break;
      case "U128":
        e.writeU128(r);
        break;
      case "I256":
        e.writeI256(r);
        break;
      case "U256":
        e.writeU256(r);
        break;
      case "F32":
        e.writeF32(r);
        break;
      case "F64":
        e.writeF64(r);
        break;
      case "String":
        e.writeString(r);
        break;
    }
  },
  deserializeValue: function(e, t, r) {
    if (t.tag === "Ref") {
      if (!r)
        throw new Error("cannot deserialize refs without a typespace");
      for (; t.tag === "Ref"; ) t = r.types[t.value];
    }
    switch (t.tag) {
      case "Product":
        return Z.deserializeValue(e, t.value, r);
      case "Sum":
        return vt.deserializeValue(e, t.value, r);
      case "Array":
        if (t.value.tag === "U8")
          return e.readUInt8Array();
        {
          const n = t.value, a = e.readU32(), u = [];
          for (let o = 0; o < a; o++)
            u.push(
              h.deserializeValue(e, n, r)
            );
          return u;
        }
      case "Bool":
        return e.readBool();
      case "I8":
        return e.readI8();
      case "U8":
        return e.readU8();
      case "I16":
        return e.readI16();
      case "U16":
        return e.readU16();
      case "I32":
        return e.readI32();
      case "U32":
        return e.readU32();
      case "I64":
        return e.readI64();
      case "U64":
        return e.readU64();
      case "I128":
        return e.readI128();
      case "U128":
        return e.readU128();
      case "I256":
        return e.readI256();
      case "U256":
        return e.readU256();
      case "F32":
        return e.readF32();
      case "F64":
        return e.readF64();
      case "String":
        return e.readString();
    }
  },
  /**
   * Convert a value of the algebraic type into something that can be used as a key in a map.
   * There are no guarantees about being able to order it.
   * This is only guaranteed to be comparable to other values of the same type.
   * @param value A value of the algebraic type
   * @returns Something that can be used as a key in a map.
   */
  intoMapKey: function(e, t) {
    switch (e.tag) {
      case "U8":
      case "U16":
      case "U32":
      case "U64":
      case "U128":
      case "U256":
      case "I8":
      case "I16":
      case "I32":
      case "I64":
      case "I128":
      case "I256":
      case "F32":
      case "F64":
      case "String":
      case "Bool":
        return t;
      case "Product":
        return Z.intoMapKey(e.value, t);
      default: {
        const r = new G(10);
        return h.serializeValue(r, e, t), r.toBase64();
      }
    }
  }
}, Z = {
  serializeValue(e, t, r, n) {
    for (const a of t.elements)
      h.serializeValue(
        e,
        a.algebraicType,
        r[a.name],
        n
      );
  },
  deserializeValue(e, t, r) {
    const n = {};
    if (t.elements.length === 1) {
      if (t.elements[0].name === "__time_duration_micros__")
        return new Te(e.readI64());
      if (t.elements[0].name === "__timestamp_micros_since_unix_epoch__")
        return new Re(e.readI64());
      if (t.elements[0].name === "__identity__")
        return new ht(e.readU256());
      if (t.elements[0].name === "__connection_id__")
        return new Ve(e.readU128());
      if (t.elements[0].name === "__uuid__")
        return new jt(e.readU128());
    }
    for (const a of t.elements)
      n[a.name] = h.deserializeValue(
        e,
        a.algebraicType,
        r
      );
    return n;
  },
  intoMapKey(e, t) {
    if (e.elements.length === 1) {
      if (e.elements[0].name === "__time_duration_micros__")
        return t.__time_duration_micros__;
      if (e.elements[0].name === "__timestamp_micros_since_unix_epoch__")
        return t.__timestamp_micros_since_unix_epoch__;
      if (e.elements[0].name === "__identity__")
        return t.__identity__;
      if (e.elements[0].name === "__connection_id__")
        return t.__connection_id__;
      if (e.elements[0].name === "__uuid__")
        return t.__uuid__;
    }
    const r = new G(10);
    return h.serializeValue(r, h.Product(e), t), r.toBase64();
  }
}, vt = {
  serializeValue: function(e, t, r, n) {
    if (t.variants.length == 2 && t.variants[0].name === "some" && t.variants[1].name === "none")
      r != null ? (e.writeByte(0), h.serializeValue(
        e,
        t.variants[0].algebraicType,
        r,
        n
      )) : e.writeByte(1);
    else if (t.variants.length == 2 && t.variants[0].name === "ok" && t.variants[1].name === "err") {
      let a, u, o;
      if ("ok" in r ? (a = "ok", u = r.ok, o = 0) : (a = "err", u = r.err, o = 1), o < 0)
        throw `Result serialization error: variant '${a}' not found in ${JSON.stringify(t)}`;
      e.writeU8(o), h.serializeValue(
        e,
        t.variants[o].algebraicType,
        u,
        n
      );
    } else {
      const a = r.tag, u = t.variants.findIndex((o) => o.name === a);
      if (u < 0)
        throw `Can't serialize a sum type, couldn't find ${r.tag} tag ${JSON.stringify(r)} in variants ${JSON.stringify(t)}`;
      e.writeU8(u), h.serializeValue(
        e,
        t.variants[u].algebraicType,
        r.value,
        n
      );
    }
  },
  deserializeValue: function(e, t, r) {
    const n = e.readU8();
    if (t.variants.length == 2 && t.variants[0].name === "some" && t.variants[1].name === "none") {
      if (n === 0)
        return h.deserializeValue(
          e,
          t.variants[0].algebraicType,
          r
        );
      if (n === 1)
        return;
      throw `Can't deserialize an option type, couldn't find ${n} tag`;
    } else if (t.variants.length == 2 && t.variants[0].name === "ok" && t.variants[1].name === "err") {
      if (n === 0)
        return { ok: h.deserializeValue(
          e,
          t.variants[0].algebraicType,
          r
        ) };
      if (n === 1)
        return { err: h.deserializeValue(
          e,
          t.variants[1].algebraicType,
          r
        ) };
      throw `Can't deserialize a result type, couldn't find ${n} tag`;
    } else {
      const a = t.variants[n], u = h.deserializeValue(
        e,
        a.algebraicType,
        r
      );
      return { tag: a.name, value: u };
    }
  }
}, Ve = class $e {
  __connection_id__;
  /**
   * Creates a new `ConnectionId`.
   */
  constructor(t) {
    this.__connection_id__ = t;
  }
  /**
   * Get the algebraic type representation of the {@link ConnectionId} type.
   * @returns The algebraic type representation of the type.
   */
  static getAlgebraicType() {
    return h.Product({
      elements: [
        { name: "__connection_id__", algebraicType: h.U128 }
      ]
    });
  }
  isZero() {
    return this.__connection_id__ === BigInt(0);
  }
  static nullIfZero(t) {
    return t.isZero() ? null : t;
  }
  static random() {
    function t() {
      return Math.floor(Math.random() * 255);
    }
    let r = BigInt(0);
    for (let n = 0; n < 16; n++)
      r = r << BigInt(8) | BigInt(t());
    return new $e(r);
  }
  /**
   * Compare two connection IDs for equality.
   */
  isEqual(t) {
    return this.__connection_id__ == t.__connection_id__;
  }
  /**
   * Check if two connection IDs are equal.
   */
  equals(t) {
    return this.isEqual(t);
  }
  /**
   * Print the connection ID as a hexadecimal string.
   */
  toHexString() {
    return mr(this.__connection_id__);
  }
  /**
   * Convert the connection ID to a Uint8Array.
   */
  toUint8Array() {
    return Lt(this.__connection_id__);
  }
  /**
   * Parse a connection ID from a hexadecimal string.
   */
  static fromString(t) {
    return new $e(dr(t));
  }
  static fromStringOrNull(t) {
    const r = $e.fromString(t);
    return r.isZero() ? null : r;
  }
}, fr = {
  interval(e) {
    return yr(e);
  },
  time(e) {
    return gr(e);
  },
  getAlgebraicType() {
    return h.Sum({
      variants: [
        {
          name: "Interval",
          algebraicType: Te.getAlgebraicType()
        },
        { name: "Time", algebraicType: Re.getAlgebraicType() }
      ]
    });
  },
  isScheduleAt(e) {
    if (e.tag !== "Sum")
      return !1;
    const t = e.value.variants;
    if (t.length !== 2)
      return !1;
    const r = t.find((a) => a.name === "Interval"), n = t.find((a) => a.name === "Time");
    return !r || !n ? !1 : Te.isTimeDuration(r.algebraicType) && Re.isTimestamp(n.algebraicType);
  }
}, yr = (e) => ({
  tag: "Interval",
  value: new Te(e)
}), gr = (e) => ({
  tag: "Time",
  value: new Re(e)
}), Wt = fr, br = {
  getAlgebraicType(e) {
    return h.Sum({
      variants: [
        { name: "some", algebraicType: e },
        {
          name: "none",
          algebraicType: h.Product({ elements: [] })
        }
      ]
    });
  }
}, wr = {
  getAlgebraicType(e, t) {
    return h.Sum({
      variants: [
        { name: "ok", algebraicType: e },
        { name: "err", algebraicType: t }
      ]
    });
  }
}, mt = /* @__PURE__ */ Symbol("QueryBrand"), vr = (e) => !!e && typeof e == "object" && mt in e;
function Ir(e) {
  return e.toSql();
}
var It = class Qt {
  constructor(t, r, n) {
    if (this.sourceQuery = t, this.filterQuery = r, this.joinCondition = n, t.table.name === r.table.name)
      throw new Error("Cannot semijoin a table to itself");
  }
  [mt] = !0;
  type = "semijoin";
  build() {
    return this;
  }
  where(t) {
    const r = this.sourceQuery.where(t);
    return new Qt(
      r,
      this.filterQuery,
      this.joinCondition
    );
  }
  toSql() {
    const t = this.filterQuery, r = this.sourceQuery, n = Oe(t.table.name), a = Oe(r.table.name);
    let u = `SELECT ${a}.* FROM ${n} JOIN ${a} ON ${X(this.joinCondition)}`;
    const o = [];
    if (t.whereClause && o.push(X(t.whereClause)), r.whereClause && o.push(X(r.whereClause)), o.length > 0) {
      const l = o.length === 1 ? o[0] : o.map(Fe).join(" AND ");
      u += ` WHERE ${l}`;
    }
    return u;
  }
}, _r = class ze {
  constructor(t, r) {
    this.table = t, this.whereClause = r;
  }
  [mt] = !0;
  where(t) {
    const r = t(this.table.cols), n = this.whereClause ? Mr(this.whereClause, r) : r;
    return new ze(this.table, n);
  }
  rightSemijoin(t, r) {
    const n = new ze(t), a = r(
      this.table.indexedCols,
      t.indexedCols
    );
    return new It(n, this, a);
  }
  leftSemijoin(t, r) {
    const n = new ze(t), a = r(
      this.table.indexedCols,
      t.indexedCols
    );
    return new It(this, n, a);
  }
  toSql() {
    return Sr(this.table, this.whereClause);
  }
  build() {
    return this;
  }
}, Br = class {
  type = "table";
  name;
  cols;
  indexedCols;
  tableDef;
  constructor(e) {
    this.name = e.name, this.cols = xr(e), this.indexedCols = this.cols, this.tableDef = e, Object.freeze(this);
  }
  asFrom() {
    return new _r(this);
  }
  rightSemijoin(e, t) {
    return this.asFrom().rightSemijoin(e, t);
  }
  leftSemijoin(e, t) {
    return this.asFrom().leftSemijoin(e, t);
  }
  build() {
    return this.asFrom().build();
  }
  toSql() {
    return this.asFrom().toSql();
  }
  where(e) {
    return this.asFrom().where(e);
  }
};
function Ur(e) {
  return new Br(e);
}
function Tr(e) {
  const t = /* @__PURE__ */ Object.create(null);
  for (const r of e.tables) {
    const n = Ur(
      r
    );
    t[r.name] = n;
  }
  return Object.freeze(t);
}
function xr(e) {
  const t = {};
  for (const r of Object.keys(e.columns)) {
    const n = e.columns[r], a = new Ar(
      e.name,
      r,
      n.typeBuilder.algebraicType
    );
    t[r] = Object.freeze(a);
  }
  return Object.freeze(t);
}
function Sr(e, t, r = []) {
  const a = `SELECT * FROM ${Oe(e.name)}`, u = [];
  if (t && u.push(X(t)), u.push(...r), u.length === 0) return a;
  const o = u.length === 1 ? u[0] : u.map(Fe).join(" AND ");
  return `${a} WHERE ${o}`;
}
var Ar = class {
  type = "column";
  column;
  table;
  // phantom: actual runtime value is undefined
  tsValueType;
  spacetimeType;
  constructor(e, t, r) {
    this.table = e, this.column = t, this.spacetimeType = r;
  }
  // These types could be tighted, but since we declare the overloads above, it doesn't weaken the API surface.
  eq(e) {
    return {
      type: "eq",
      left: this,
      right: Ae(e)
    };
  }
  // These types could be tighted, but since we declare the overloads above, it doesn't weaken the API surface.
  lt(e) {
    return {
      type: "lt",
      left: this,
      right: Ae(e)
    };
  }
  // These types could be tighted, but since we declare the overloads above, it doesn't weaken the API surface.
  lte(e) {
    return {
      type: "lte",
      left: this,
      right: Ae(e)
    };
  }
  // These types could be tighted, but since we declare the overloads above, it doesn't weaken the API surface.
  gt(e) {
    return {
      type: "gt",
      left: this,
      right: Ae(e)
    };
  }
  // These types could be tighted, but since we declare the overloads above, it doesn't weaken the API surface.
  gte(e) {
    return {
      type: "gte",
      left: this,
      right: Ae(e)
    };
  }
};
function Cr(e) {
  return { type: "literal", value: e };
}
function Ae(e) {
  return e.type === "literal" || typeof e == "object" && e != null && "type" in e && e.type === "column" ? e : Cr(e);
}
function Mr(...e) {
  return { type: "and", clauses: e };
}
function X(e, t) {
  switch (e.type) {
    case "eq":
      return `${q(e.left)} = ${q(e.right)}`;
    case "ne":
      return `${q(e.left)} <> ${q(e.right)}`;
    case "gt":
      return `${q(e.left)} > ${q(e.right)}`;
    case "gte":
      return `${q(e.left)} >= ${q(e.right)}`;
    case "lt":
      return `${q(e.left)} < ${q(e.right)}`;
    case "lte":
      return `${q(e.left)} <= ${q(e.right)}`;
    case "and":
      return e.clauses.map((r) => X(r)).map(Fe).join(" AND ");
    case "or":
      return e.clauses.map((r) => X(r)).map(Fe).join(" OR ");
    case "not":
      return `NOT ${Fe(X(e.clause))}`;
  }
}
function Fe(e) {
  return `(${e})`;
}
function q(e, t) {
  if (Er(e))
    return qr(e.value);
  const r = e.table;
  return `${Oe(r)}.${Oe(e.column)}`;
}
function qr(e) {
  if (e == null)
    return "NULL";
  if (e instanceof ht || e instanceof Ve)
    return `0x${e.toHexString()}`;
  switch (typeof e) {
    case "number":
    case "bigint":
      return String(e);
    case "boolean":
      return e ? "TRUE" : "FALSE";
    case "string":
      return `'${e.replace(/'/g, "''")}'`;
    default:
      return `'${JSON.stringify(e).replace(/'/g, "''")}'`;
  }
}
function Oe(e) {
  return `"${e.replace(/"/g, '""')}"`;
}
function Er(e) {
  return e.type === "literal";
}
function i(e, t) {
  return { ...e, ...t };
}
var _ = class {
  /**
   * The TypeScript phantom type. This is not stored at runtime,
   * but is visible to the compiler
   */
  type;
  /**
   * The SpacetimeDB algebraic type (run‑time value). In addition to storing
   * the runtime representation of the `AlgebraicType`, it also captures
   * the TypeScript type information of the `AlgebraicType`. That is to say
   * the value is not merely an `AlgebraicType`, but is constructed to be
   * the corresponding concrete `AlgebraicType` for the TypeScript type `Type`.
   *
   * e.g. `string` corresponds to `AlgebraicType.String`
   */
  algebraicType;
  constructor(e) {
    this.algebraicType = e;
  }
  optional() {
    return new Le(this);
  }
  serialize(e, t) {
    h.serializeValue(e, this.algebraicType, t);
  }
  deserialize(e) {
    return h.deserializeValue(e, this.algebraicType);
  }
}, kr = class extends _ {
  constructor() {
    super(h.U8);
  }
  index(e = "btree") {
    return new Y(
      this,
      i(c, { indexType: e })
    );
  }
  unique() {
    return new Y(this, i(c, { isUnique: !0 }));
  }
  primaryKey() {
    return new Y(
      this,
      i(c, { isPrimaryKey: !0 })
    );
  }
  autoInc() {
    return new Y(
      this,
      i(c, { isAutoIncrement: !0 })
    );
  }
  default(e) {
    return new Y(
      this,
      i(c, { defaultValue: e })
    );
  }
  name(e) {
    return new Y(this, i(c, { name: e }));
  }
}, Pr = class extends _ {
  constructor() {
    super(h.U16);
  }
  index(e = "btree") {
    return new ee(
      this,
      i(c, { indexType: e })
    );
  }
  unique() {
    return new ee(this, i(c, { isUnique: !0 }));
  }
  primaryKey() {
    return new ee(
      this,
      i(c, { isPrimaryKey: !0 })
    );
  }
  autoInc() {
    return new ee(
      this,
      i(c, { isAutoIncrement: !0 })
    );
  }
  default(e) {
    return new ee(
      this,
      i(c, { defaultValue: e })
    );
  }
  name(e) {
    return new ee(this, i(c, { name: e }));
  }
}, Fr = class extends _ {
  constructor() {
    super(h.U32);
  }
  index(e = "btree") {
    return new te(
      this,
      i(c, { indexType: e })
    );
  }
  unique() {
    return new te(this, i(c, { isUnique: !0 }));
  }
  primaryKey() {
    return new te(
      this,
      i(c, { isPrimaryKey: !0 })
    );
  }
  autoInc() {
    return new te(
      this,
      i(c, { isAutoIncrement: !0 })
    );
  }
  default(e) {
    return new te(
      this,
      i(c, { defaultValue: e })
    );
  }
  name(e) {
    return new te(this, i(c, { name: e }));
  }
}, Rr = class extends _ {
  constructor() {
    super(h.U64);
  }
  index(e = "btree") {
    return new re(
      this,
      i(c, { indexType: e })
    );
  }
  unique() {
    return new re(this, i(c, { isUnique: !0 }));
  }
  primaryKey() {
    return new re(
      this,
      i(c, { isPrimaryKey: !0 })
    );
  }
  autoInc() {
    return new re(
      this,
      i(c, { isAutoIncrement: !0 })
    );
  }
  default(e) {
    return new re(
      this,
      i(c, { defaultValue: e })
    );
  }
  name(e) {
    return new re(this, i(c, { name: e }));
  }
}, Dr = class extends _ {
  constructor() {
    super(h.U128);
  }
  index(e = "btree") {
    return new ne(
      this,
      i(c, { indexType: e })
    );
  }
  unique() {
    return new ne(
      this,
      i(c, { isUnique: !0 })
    );
  }
  primaryKey() {
    return new ne(
      this,
      i(c, { isPrimaryKey: !0 })
    );
  }
  autoInc() {
    return new ne(
      this,
      i(c, { isAutoIncrement: !0 })
    );
  }
  default(e) {
    return new ne(
      this,
      i(c, { defaultValue: e })
    );
  }
  name(e) {
    return new ne(this, i(c, { name: e }));
  }
}, Vr = class extends _ {
  constructor() {
    super(h.U256);
  }
  index(e = "btree") {
    return new ie(
      this,
      i(c, { indexType: e })
    );
  }
  unique() {
    return new ie(
      this,
      i(c, { isUnique: !0 })
    );
  }
  primaryKey() {
    return new ie(
      this,
      i(c, { isPrimaryKey: !0 })
    );
  }
  autoInc() {
    return new ie(
      this,
      i(c, { isAutoIncrement: !0 })
    );
  }
  default(e) {
    return new ie(
      this,
      i(c, { defaultValue: e })
    );
  }
  name(e) {
    return new ie(this, i(c, { name: e }));
  }
}, Or = class extends _ {
  constructor() {
    super(h.I8);
  }
  index(e = "btree") {
    return new se(
      this,
      i(c, { indexType: e })
    );
  }
  unique() {
    return new se(this, i(c, { isUnique: !0 }));
  }
  primaryKey() {
    return new se(
      this,
      i(c, { isPrimaryKey: !0 })
    );
  }
  autoInc() {
    return new se(
      this,
      i(c, { isAutoIncrement: !0 })
    );
  }
  default(e) {
    return new se(
      this,
      i(c, { defaultValue: e })
    );
  }
  name(e) {
    return new se(this, i(c, { name: e }));
  }
}, Nr = class extends _ {
  constructor() {
    super(h.I16);
  }
  index(e = "btree") {
    return new ae(
      this,
      i(c, { indexType: e })
    );
  }
  unique() {
    return new ae(this, i(c, { isUnique: !0 }));
  }
  primaryKey() {
    return new ae(
      this,
      i(c, { isPrimaryKey: !0 })
    );
  }
  autoInc() {
    return new ae(
      this,
      i(c, { isAutoIncrement: !0 })
    );
  }
  default(e) {
    return new ae(
      this,
      i(c, { defaultValue: e })
    );
  }
  name(e) {
    return new ae(this, i(c, { name: e }));
  }
}, Kr = class extends _ {
  constructor() {
    super(h.I32);
  }
  index(e = "btree") {
    return new ue(
      this,
      i(c, { indexType: e })
    );
  }
  unique() {
    return new ue(this, i(c, { isUnique: !0 }));
  }
  primaryKey() {
    return new ue(
      this,
      i(c, { isPrimaryKey: !0 })
    );
  }
  autoInc() {
    return new ue(
      this,
      i(c, { isAutoIncrement: !0 })
    );
  }
  default(e) {
    return new ue(
      this,
      i(c, { defaultValue: e })
    );
  }
  name(e) {
    return new ue(this, i(c, { name: e }));
  }
}, jr = class extends _ {
  constructor() {
    super(h.I64);
  }
  index(e = "btree") {
    return new oe(
      this,
      i(c, { indexType: e })
    );
  }
  unique() {
    return new oe(this, i(c, { isUnique: !0 }));
  }
  primaryKey() {
    return new oe(
      this,
      i(c, { isPrimaryKey: !0 })
    );
  }
  autoInc() {
    return new oe(
      this,
      i(c, { isAutoIncrement: !0 })
    );
  }
  default(e) {
    return new oe(
      this,
      i(c, { defaultValue: e })
    );
  }
  name(e) {
    return new oe(this, i(c, { name: e }));
  }
}, $r = class extends _ {
  constructor() {
    super(h.I128);
  }
  index(e = "btree") {
    return new ce(
      this,
      i(c, { indexType: e })
    );
  }
  unique() {
    return new ce(
      this,
      i(c, { isUnique: !0 })
    );
  }
  primaryKey() {
    return new ce(
      this,
      i(c, { isPrimaryKey: !0 })
    );
  }
  autoInc() {
    return new ce(
      this,
      i(c, { isAutoIncrement: !0 })
    );
  }
  default(e) {
    return new ce(
      this,
      i(c, { defaultValue: e })
    );
  }
  name(e) {
    return new ce(this, i(c, { name: e }));
  }
}, zr = class extends _ {
  constructor() {
    super(h.I256);
  }
  index(e = "btree") {
    return new le(
      this,
      i(c, { indexType: e })
    );
  }
  unique() {
    return new le(
      this,
      i(c, { isUnique: !0 })
    );
  }
  primaryKey() {
    return new le(
      this,
      i(c, { isPrimaryKey: !0 })
    );
  }
  autoInc() {
    return new le(
      this,
      i(c, { isAutoIncrement: !0 })
    );
  }
  default(e) {
    return new le(
      this,
      i(c, { defaultValue: e })
    );
  }
  name(e) {
    return new le(this, i(c, { name: e }));
  }
}, Lr = class extends _ {
  constructor() {
    super(h.F32);
  }
  default(e) {
    return new Bt(
      this,
      i(c, { defaultValue: e })
    );
  }
  name(e) {
    return new Bt(this, i(c, { name: e }));
  }
}, _t = class extends _ {
  constructor() {
    super(h.F64);
  }
  default(e) {
    return new Ut(
      this,
      i(c, { defaultValue: e })
    );
  }
  name(e) {
    return new Ut(this, i(c, { name: e }));
  }
}, Hr = class extends _ {
  constructor() {
    super(h.Bool);
  }
  index(e = "btree") {
    return new Ce(
      this,
      i(c, { indexType: e })
    );
  }
  unique() {
    return new Ce(
      this,
      i(c, { isUnique: !0 })
    );
  }
  primaryKey() {
    return new Ce(
      this,
      i(c, { isPrimaryKey: !0 })
    );
  }
  default(e) {
    return new Ce(
      this,
      i(c, { defaultValue: e })
    );
  }
  name(e) {
    return new Ce(this, i(c, { name: e }));
  }
}, Wr = class extends _ {
  constructor() {
    super(h.String);
  }
  index(e = "btree") {
    return new Me(
      this,
      i(c, { indexType: e })
    );
  }
  unique() {
    return new Me(
      this,
      i(c, { isUnique: !0 })
    );
  }
  primaryKey() {
    return new Me(
      this,
      i(c, { isPrimaryKey: !0 })
    );
  }
  default(e) {
    return new Me(
      this,
      i(c, { defaultValue: e })
    );
  }
  name(e) {
    return new Me(this, i(c, { name: e }));
  }
}, Ge = class extends _ {
  element;
  constructor(e) {
    super(h.Array(e.algebraicType)), this.element = e;
  }
  default(e) {
    return new Tt(
      this.element,
      i(c, { defaultValue: e })
    );
  }
  name(e) {
    return new Tt(this.element, i(c, { name: e }));
  }
}, Qr = class extends _ {
  constructor() {
    super(h.Array(h.U8));
  }
  default(e) {
    return new xt(
      i(c, { defaultValue: e })
    );
  }
  name(e) {
    return new xt(i(c, { name: e }));
  }
}, Le = class extends _ {
  value;
  constructor(e) {
    super(br.getAlgebraicType(e.algebraicType)), this.value = e;
  }
  default(e) {
    return new St(
      this,
      i(c, { defaultValue: e })
    );
  }
  name(e) {
    return new St(this, i(c, { name: e }));
  }
}, xe = class extends _ {
  typeName;
  elements;
  constructor(e, t) {
    function r(n) {
      return Object.keys(n).map((a) => ({
        name: a,
        // Lazily resolve the underlying object's algebraicType.
        // This will call obj[key].algebraicType only when someone
        // actually reads this property.
        get algebraicType() {
          return n[a].algebraicType;
        }
      }));
    }
    super(
      h.Product({
        elements: r(e)
      })
    ), this.typeName = t, this.elements = e;
  }
  default(e) {
    return new At(
      this,
      i(c, { defaultValue: e })
    );
  }
  name(e) {
    return new At(this, i(c, { name: e }));
  }
}, Xe = class extends _ {
  ok;
  err;
  constructor(e, t) {
    super(wr.getAlgebraicType(e.algebraicType, t.algebraicType)), this.ok = e, this.err = t;
  }
  default(e) {
    return new rn(this, i(c, { defaultValue: e }));
  }
}, pt = class extends _ {
  constructor() {
    super({ tag: "Product", value: { elements: [] } });
  }
}, k = class extends _ {
  row;
  typeName;
  constructor(e, t) {
    const r = Object.fromEntries(
      Object.entries(e).map(([a, u]) => [
        a,
        u instanceof B ? u : new B(u, {})
      ])
    ), n = Object.keys(r).map((a) => ({
      name: a,
      get algebraicType() {
        return r[a].typeBuilder.algebraicType;
      }
    }));
    super(h.Product({ elements: n })), this.row = r, this.typeName = t;
  }
}, Jt = class extends _ {
  variants;
  typeName;
  constructor(e, t) {
    function r(n) {
      return Object.keys(n).map((a) => ({
        name: a,
        // Lazily resolve the underlying object's algebraicType.
        // This will call obj[key].algebraicType only when someone
        // actually reads this property.
        get algebraicType() {
          return n[a].algebraicType;
        }
      }));
    }
    super(
      h.Sum({
        variants: r(e)
      })
    ), this.variants = e, this.typeName = t;
    for (const n of Object.keys(e)) {
      const a = Object.getOwnPropertyDescriptor(e, n), u = !!a && (typeof a.get == "function" || typeof a.set == "function");
      let o = !1;
      if (u || (o = e[n] instanceof pt), o) {
        const l = this.create(n);
        Object.defineProperty(this, n, {
          value: l,
          writable: !1,
          enumerable: !0,
          configurable: !1
        });
      } else
        Object.defineProperty(this, n, {
          value: ((d) => this.create(n, d)),
          writable: !1,
          enumerable: !0,
          configurable: !1
        });
    }
  }
  create(e, t) {
    return t === void 0 ? { tag: e } : { tag: e, value: t };
  }
  default(e) {
    return new st(
      this,
      i(c, { defaultValue: e })
    );
  }
  name(e) {
    return new st(this, i(c, { name: e }));
  }
}, ft = Jt, Jr = class extends Jt {
  index(e = "btree") {
    return new Ct(
      this,
      i(c, { indexType: e })
    );
  }
  primaryKey() {
    return new Ct(
      this,
      i(c, { isPrimaryKey: !0 })
    );
  }
}, Zr = class extends _ {
  constructor() {
    super(Wt.getAlgebraicType());
  }
  default(e) {
    return new Mt(
      this,
      i(c, { defaultValue: e })
    );
  }
  name(e) {
    return new Mt(this, i(c, { name: e }));
  }
}, Gr = class extends _ {
  constructor() {
    super(ht.getAlgebraicType());
  }
  index(e = "btree") {
    return new de(
      this,
      i(c, { indexType: e })
    );
  }
  unique() {
    return new de(
      this,
      i(c, { isUnique: !0 })
    );
  }
  primaryKey() {
    return new de(
      this,
      i(c, { isPrimaryKey: !0 })
    );
  }
  autoInc() {
    return new de(
      this,
      i(c, { isAutoIncrement: !0 })
    );
  }
  default(e) {
    return new de(
      this,
      i(c, { defaultValue: e })
    );
  }
  name(e) {
    return new de(this, i(c, { name: e }));
  }
}, Xr = class extends _ {
  constructor() {
    super(Ve.getAlgebraicType());
  }
  index(e = "btree") {
    return new he(
      this,
      i(c, { indexType: e })
    );
  }
  unique() {
    return new he(
      this,
      i(c, { isUnique: !0 })
    );
  }
  primaryKey() {
    return new he(
      this,
      i(c, { isPrimaryKey: !0 })
    );
  }
  autoInc() {
    return new he(
      this,
      i(c, { isAutoIncrement: !0 })
    );
  }
  default(e) {
    return new he(
      this,
      i(c, { defaultValue: e })
    );
  }
  name(e) {
    return new he(this, i(c, { name: e }));
  }
}, Yr = class extends _ {
  constructor() {
    super(Re.getAlgebraicType());
  }
  index(e = "btree") {
    return new me(
      this,
      i(c, { indexType: e })
    );
  }
  unique() {
    return new me(
      this,
      i(c, { isUnique: !0 })
    );
  }
  primaryKey() {
    return new me(
      this,
      i(c, { isPrimaryKey: !0 })
    );
  }
  autoInc() {
    return new me(
      this,
      i(c, { isAutoIncrement: !0 })
    );
  }
  default(e) {
    return new me(
      this,
      i(c, { defaultValue: e })
    );
  }
  name(e) {
    return new me(this, i(c, { name: e }));
  }
}, en = class extends _ {
  constructor() {
    super(Te.getAlgebraicType());
  }
  index(e = "btree") {
    return new pe(
      this,
      i(c, { indexType: e })
    );
  }
  unique() {
    return new pe(
      this,
      i(c, { isUnique: !0 })
    );
  }
  primaryKey() {
    return new pe(
      this,
      i(c, { isPrimaryKey: !0 })
    );
  }
  autoInc() {
    return new pe(
      this,
      i(c, { isAutoIncrement: !0 })
    );
  }
  default(e) {
    return new pe(
      this,
      i(c, { defaultValue: e })
    );
  }
  name(e) {
    return new pe(this, i(c, { name: e }));
  }
}, tn = class extends _ {
  constructor() {
    super(jt.getAlgebraicType());
  }
  index(e = "btree") {
    return new fe(
      this,
      i(c, { indexType: e })
    );
  }
  unique() {
    return new fe(
      this,
      i(c, { isUnique: !0 })
    );
  }
  primaryKey() {
    return new fe(
      this,
      i(c, { isPrimaryKey: !0 })
    );
  }
  autoInc() {
    return new fe(
      this,
      i(c, { isAutoIncrement: !0 })
    );
  }
  default(e) {
    return new fe(
      this,
      i(c, { defaultValue: e })
    );
  }
  name(e) {
    return new fe(this, i(c, { name: e }));
  }
}, c = {}, B = class {
  typeBuilder;
  columnMetadata;
  constructor(e, t) {
    this.typeBuilder = e, this.columnMetadata = t;
  }
  serialize(e, t) {
    h.serializeValue(e, this.typeBuilder.algebraicType, t);
  }
  deserialize(e) {
    return h.deserializeValue(
      e,
      this.typeBuilder.algebraicType
    );
  }
}, Y = class D extends B {
  index(t = "btree") {
    return new D(
      this.typeBuilder,
      i(this.columnMetadata, { indexType: t })
    );
  }
  unique() {
    return new D(
      this.typeBuilder,
      i(this.columnMetadata, { isUnique: !0 })
    );
  }
  primaryKey() {
    return new D(
      this.typeBuilder,
      i(this.columnMetadata, { isPrimaryKey: !0 })
    );
  }
  autoInc() {
    return new D(
      this.typeBuilder,
      i(this.columnMetadata, { isAutoIncrement: !0 })
    );
  }
  default(t) {
    return new D(
      this.typeBuilder,
      i(this.columnMetadata, {
        defaultValue: t
      })
    );
  }
  name(t) {
    return new D(
      this.typeBuilder,
      i(this.columnMetadata, { name: t })
    );
  }
}, ee = class V extends B {
  index(t = "btree") {
    return new V(
      this.typeBuilder,
      i(this.columnMetadata, { indexType: t })
    );
  }
  unique() {
    return new V(
      this.typeBuilder,
      i(this.columnMetadata, { isUnique: !0 })
    );
  }
  primaryKey() {
    return new V(
      this.typeBuilder,
      i(this.columnMetadata, { isPrimaryKey: !0 })
    );
  }
  autoInc() {
    return new V(
      this.typeBuilder,
      i(this.columnMetadata, { isAutoIncrement: !0 })
    );
  }
  default(t) {
    return new V(
      this.typeBuilder,
      i(this.columnMetadata, {
        defaultValue: t
      })
    );
  }
  name(t) {
    return new V(
      this.typeBuilder,
      i(this.columnMetadata, { name: t })
    );
  }
}, te = class O extends B {
  index(t = "btree") {
    return new O(
      this.typeBuilder,
      i(this.columnMetadata, { indexType: t })
    );
  }
  unique() {
    return new O(
      this.typeBuilder,
      i(this.columnMetadata, { isUnique: !0 })
    );
  }
  primaryKey() {
    return new O(
      this.typeBuilder,
      i(this.columnMetadata, { isPrimaryKey: !0 })
    );
  }
  autoInc() {
    return new O(
      this.typeBuilder,
      i(this.columnMetadata, { isAutoIncrement: !0 })
    );
  }
  default(t) {
    return new O(
      this.typeBuilder,
      i(this.columnMetadata, {
        defaultValue: t
      })
    );
  }
  name(t) {
    return new O(
      this.typeBuilder,
      i(this.columnMetadata, { name: t })
    );
  }
}, re = class N extends B {
  index(t = "btree") {
    return new N(
      this.typeBuilder,
      i(this.columnMetadata, { indexType: t })
    );
  }
  unique() {
    return new N(
      this.typeBuilder,
      i(this.columnMetadata, { isUnique: !0 })
    );
  }
  primaryKey() {
    return new N(
      this.typeBuilder,
      i(this.columnMetadata, { isPrimaryKey: !0 })
    );
  }
  autoInc() {
    return new N(
      this.typeBuilder,
      i(this.columnMetadata, { isAutoIncrement: !0 })
    );
  }
  default(t) {
    return new N(
      this.typeBuilder,
      i(this.columnMetadata, {
        defaultValue: t
      })
    );
  }
  name(t) {
    return new N(
      this.typeBuilder,
      i(this.columnMetadata, { name: t })
    );
  }
}, ne = class K extends B {
  index(t = "btree") {
    return new K(
      this.typeBuilder,
      i(this.columnMetadata, { indexType: t })
    );
  }
  unique() {
    return new K(
      this.typeBuilder,
      i(this.columnMetadata, { isUnique: !0 })
    );
  }
  primaryKey() {
    return new K(
      this.typeBuilder,
      i(this.columnMetadata, { isPrimaryKey: !0 })
    );
  }
  autoInc() {
    return new K(
      this.typeBuilder,
      i(this.columnMetadata, { isAutoIncrement: !0 })
    );
  }
  default(t) {
    return new K(
      this.typeBuilder,
      i(this.columnMetadata, {
        defaultValue: t
      })
    );
  }
  name(t) {
    return new K(
      this.typeBuilder,
      i(this.columnMetadata, { name: t })
    );
  }
}, ie = class j extends B {
  index(t = "btree") {
    return new j(
      this.typeBuilder,
      i(this.columnMetadata, { indexType: t })
    );
  }
  unique() {
    return new j(
      this.typeBuilder,
      i(this.columnMetadata, { isUnique: !0 })
    );
  }
  primaryKey() {
    return new j(
      this.typeBuilder,
      i(this.columnMetadata, { isPrimaryKey: !0 })
    );
  }
  autoInc() {
    return new j(
      this.typeBuilder,
      i(this.columnMetadata, { isAutoIncrement: !0 })
    );
  }
  default(t) {
    return new j(
      this.typeBuilder,
      i(this.columnMetadata, {
        defaultValue: t
      })
    );
  }
  name(t) {
    return new j(
      this.typeBuilder,
      i(this.columnMetadata, { name: t })
    );
  }
}, se = class $ extends B {
  index(t = "btree") {
    return new $(
      this.typeBuilder,
      i(this.columnMetadata, { indexType: t })
    );
  }
  unique() {
    return new $(
      this.typeBuilder,
      i(this.columnMetadata, { isUnique: !0 })
    );
  }
  primaryKey() {
    return new $(
      this.typeBuilder,
      i(this.columnMetadata, { isPrimaryKey: !0 })
    );
  }
  autoInc() {
    return new $(
      this.typeBuilder,
      i(this.columnMetadata, { isAutoIncrement: !0 })
    );
  }
  default(t) {
    return new $(
      this.typeBuilder,
      i(this.columnMetadata, {
        defaultValue: t
      })
    );
  }
  name(t) {
    return new $(
      this.typeBuilder,
      i(this.columnMetadata, { name: t })
    );
  }
}, ae = class z extends B {
  index(t = "btree") {
    return new z(
      this.typeBuilder,
      i(this.columnMetadata, { indexType: t })
    );
  }
  unique() {
    return new z(
      this.typeBuilder,
      i(this.columnMetadata, { isUnique: !0 })
    );
  }
  primaryKey() {
    return new z(
      this.typeBuilder,
      i(this.columnMetadata, { isPrimaryKey: !0 })
    );
  }
  autoInc() {
    return new z(
      this.typeBuilder,
      i(this.columnMetadata, { isAutoIncrement: !0 })
    );
  }
  default(t) {
    return new z(
      this.typeBuilder,
      i(this.columnMetadata, {
        defaultValue: t
      })
    );
  }
  name(t) {
    return new z(
      this.typeBuilder,
      i(this.columnMetadata, { name: t })
    );
  }
}, ue = class L extends B {
  index(t = "btree") {
    return new L(
      this.typeBuilder,
      i(this.columnMetadata, { indexType: t })
    );
  }
  unique() {
    return new L(
      this.typeBuilder,
      i(this.columnMetadata, { isUnique: !0 })
    );
  }
  primaryKey() {
    return new L(
      this.typeBuilder,
      i(this.columnMetadata, { isPrimaryKey: !0 })
    );
  }
  autoInc() {
    return new L(
      this.typeBuilder,
      i(this.columnMetadata, { isAutoIncrement: !0 })
    );
  }
  default(t) {
    return new L(
      this.typeBuilder,
      i(this.columnMetadata, {
        defaultValue: t
      })
    );
  }
  name(t) {
    return new L(
      this.typeBuilder,
      i(this.columnMetadata, { name: t })
    );
  }
}, oe = class H extends B {
  index(t = "btree") {
    return new H(
      this.typeBuilder,
      i(this.columnMetadata, { indexType: t })
    );
  }
  unique() {
    return new H(
      this.typeBuilder,
      i(this.columnMetadata, { isUnique: !0 })
    );
  }
  primaryKey() {
    return new H(
      this.typeBuilder,
      i(this.columnMetadata, { isPrimaryKey: !0 })
    );
  }
  autoInc() {
    return new H(
      this.typeBuilder,
      i(this.columnMetadata, { isAutoIncrement: !0 })
    );
  }
  default(t) {
    return new H(
      this.typeBuilder,
      i(this.columnMetadata, {
        defaultValue: t
      })
    );
  }
  name(t) {
    return new H(
      this.typeBuilder,
      i(this.columnMetadata, { name: t })
    );
  }
}, ce = class W extends B {
  index(t = "btree") {
    return new W(
      this.typeBuilder,
      i(this.columnMetadata, { indexType: t })
    );
  }
  unique() {
    return new W(
      this.typeBuilder,
      i(this.columnMetadata, { isUnique: !0 })
    );
  }
  primaryKey() {
    return new W(
      this.typeBuilder,
      i(this.columnMetadata, { isPrimaryKey: !0 })
    );
  }
  autoInc() {
    return new W(
      this.typeBuilder,
      i(this.columnMetadata, { isAutoIncrement: !0 })
    );
  }
  default(t) {
    return new W(
      this.typeBuilder,
      i(this.columnMetadata, {
        defaultValue: t
      })
    );
  }
  name(t) {
    return new W(
      this.typeBuilder,
      i(this.columnMetadata, { name: t })
    );
  }
}, le = class Q extends B {
  index(t = "btree") {
    return new Q(
      this.typeBuilder,
      i(this.columnMetadata, { indexType: t })
    );
  }
  unique() {
    return new Q(
      this.typeBuilder,
      i(this.columnMetadata, { isUnique: !0 })
    );
  }
  primaryKey() {
    return new Q(
      this.typeBuilder,
      i(this.columnMetadata, { isPrimaryKey: !0 })
    );
  }
  autoInc() {
    return new Q(
      this.typeBuilder,
      i(this.columnMetadata, { isAutoIncrement: !0 })
    );
  }
  default(t) {
    return new Q(
      this.typeBuilder,
      i(this.columnMetadata, {
        defaultValue: t
      })
    );
  }
  name(t) {
    return new Q(
      this.typeBuilder,
      i(this.columnMetadata, { name: t })
    );
  }
}, Bt = class Ye extends B {
  default(t) {
    return new Ye(
      this.typeBuilder,
      i(this.columnMetadata, {
        defaultValue: t
      })
    );
  }
  name(t) {
    return new Ye(
      this.typeBuilder,
      i(this.columnMetadata, { name: t })
    );
  }
}, Ut = class et extends B {
  default(t) {
    return new et(
      this.typeBuilder,
      i(this.columnMetadata, {
        defaultValue: t
      })
    );
  }
  name(t) {
    return new et(
      this.typeBuilder,
      i(this.columnMetadata, { name: t })
    );
  }
}, Ce = class be extends B {
  index(t = "btree") {
    return new be(
      this.typeBuilder,
      i(this.columnMetadata, { indexType: t })
    );
  }
  unique() {
    return new be(
      this.typeBuilder,
      i(this.columnMetadata, { isUnique: !0 })
    );
  }
  primaryKey() {
    return new be(
      this.typeBuilder,
      i(this.columnMetadata, { isPrimaryKey: !0 })
    );
  }
  default(t) {
    return new be(
      this.typeBuilder,
      i(this.columnMetadata, {
        defaultValue: t
      })
    );
  }
  name(t) {
    return new be(
      this.typeBuilder,
      i(this.columnMetadata, { name: t })
    );
  }
}, Me = class we extends B {
  index(t = "btree") {
    return new we(
      this.typeBuilder,
      i(this.columnMetadata, { indexType: t })
    );
  }
  unique() {
    return new we(
      this.typeBuilder,
      i(this.columnMetadata, { isUnique: !0 })
    );
  }
  primaryKey() {
    return new we(
      this.typeBuilder,
      i(this.columnMetadata, { isPrimaryKey: !0 })
    );
  }
  default(t) {
    return new we(
      this.typeBuilder,
      i(this.columnMetadata, {
        defaultValue: t
      })
    );
  }
  name(t) {
    return new we(
      this.typeBuilder,
      i(this.columnMetadata, { name: t })
    );
  }
}, Tt = class tt extends B {
  default(t) {
    return new tt(
      this.typeBuilder,
      i(this.columnMetadata, {
        defaultValue: t
      })
    );
  }
  name(t) {
    return new tt(
      this.typeBuilder,
      i(this.columnMetadata, { name: t })
    );
  }
}, xt = class rt extends B {
  constructor(t) {
    super(new _(h.Array(h.U8)), t);
  }
  default(t) {
    return new rt(
      i(this.columnMetadata, { defaultValue: t })
    );
  }
  name(t) {
    return new rt(i(this.columnMetadata, { name: t }));
  }
}, St = class nt extends B {
  default(t) {
    return new nt(
      this.typeBuilder,
      i(this.columnMetadata, {
        defaultValue: t
      })
    );
  }
  name(t) {
    return new nt(
      this.typeBuilder,
      i(this.columnMetadata, { name: t })
    );
  }
}, rn = class Zt extends B {
  constructor(t, r) {
    super(t, r);
  }
  default(t) {
    return new Zt(
      this.typeBuilder,
      i(this.columnMetadata, {
        defaultValue: t
      })
    );
  }
}, At = class it extends B {
  default(t) {
    return new it(
      this.typeBuilder,
      i(this.columnMetadata, { defaultValue: t })
    );
  }
  name(t) {
    return new it(
      this.typeBuilder,
      i(this.columnMetadata, { name: t })
    );
  }
}, st = class at extends B {
  default(t) {
    return new at(
      this.typeBuilder,
      i(this.columnMetadata, { defaultValue: t })
    );
  }
  name(t) {
    return new at(
      this.typeBuilder,
      i(this.columnMetadata, { name: t })
    );
  }
}, Ct = class ut extends st {
  index(t = "btree") {
    return new ut(
      this.typeBuilder,
      i(this.columnMetadata, { indexType: t })
    );
  }
  primaryKey() {
    return new ut(
      this.typeBuilder,
      i(this.columnMetadata, { isPrimaryKey: !0 })
    );
  }
}, Mt = class ot extends B {
  default(t) {
    return new ot(
      this.typeBuilder,
      i(this.columnMetadata, { defaultValue: t })
    );
  }
  name(t) {
    return new ot(
      this.typeBuilder,
      i(this.columnMetadata, { name: t })
    );
  }
}, de = class ve extends B {
  index(t = "btree") {
    return new ve(
      this.typeBuilder,
      i(this.columnMetadata, { indexType: t })
    );
  }
  unique() {
    return new ve(
      this.typeBuilder,
      i(this.columnMetadata, { isUnique: !0 })
    );
  }
  primaryKey() {
    return new ve(
      this.typeBuilder,
      i(this.columnMetadata, { isPrimaryKey: !0 })
    );
  }
  default(t) {
    return new ve(
      this.typeBuilder,
      i(this.columnMetadata, { defaultValue: t })
    );
  }
  name(t) {
    return new ve(
      this.typeBuilder,
      i(this.columnMetadata, { name: t })
    );
  }
}, he = class Ie extends B {
  index(t = "btree") {
    return new Ie(
      this.typeBuilder,
      i(this.columnMetadata, { indexType: t })
    );
  }
  unique() {
    return new Ie(
      this.typeBuilder,
      i(this.columnMetadata, { isUnique: !0 })
    );
  }
  primaryKey() {
    return new Ie(
      this.typeBuilder,
      i(this.columnMetadata, { isPrimaryKey: !0 })
    );
  }
  default(t) {
    return new Ie(
      this.typeBuilder,
      i(this.columnMetadata, { defaultValue: t })
    );
  }
  name(t) {
    return new Ie(
      this.typeBuilder,
      i(this.columnMetadata, { name: t })
    );
  }
}, me = class _e extends B {
  index(t = "btree") {
    return new _e(
      this.typeBuilder,
      i(this.columnMetadata, { indexType: t })
    );
  }
  unique() {
    return new _e(
      this.typeBuilder,
      i(this.columnMetadata, { isUnique: !0 })
    );
  }
  primaryKey() {
    return new _e(
      this.typeBuilder,
      i(this.columnMetadata, { isPrimaryKey: !0 })
    );
  }
  default(t) {
    return new _e(
      this.typeBuilder,
      i(this.columnMetadata, { defaultValue: t })
    );
  }
  name(t) {
    return new _e(
      this.typeBuilder,
      i(this.columnMetadata, { name: t })
    );
  }
}, pe = class Be extends B {
  index(t = "btree") {
    return new Be(
      this.typeBuilder,
      i(this.columnMetadata, { indexType: t })
    );
  }
  unique() {
    return new Be(
      this.typeBuilder,
      i(this.columnMetadata, { isUnique: !0 })
    );
  }
  primaryKey() {
    return new Be(
      this.typeBuilder,
      i(this.columnMetadata, { isPrimaryKey: !0 })
    );
  }
  default(t) {
    return new Be(
      this.typeBuilder,
      i(this.columnMetadata, { defaultValue: t })
    );
  }
  name(t) {
    return new Be(
      this.typeBuilder,
      i(this.columnMetadata, { name: t })
    );
  }
}, fe = class Ue extends B {
  index(t = "btree") {
    return new Ue(
      this.typeBuilder,
      i(this.columnMetadata, { indexType: t })
    );
  }
  unique() {
    return new Ue(
      this.typeBuilder,
      i(this.columnMetadata, { isUnique: !0 })
    );
  }
  primaryKey() {
    return new Ue(
      this.typeBuilder,
      i(this.columnMetadata, { isPrimaryKey: !0 })
    );
  }
  default(t) {
    return new Ue(
      this.typeBuilder,
      i(this.columnMetadata, { defaultValue: t })
    );
  }
  name(t) {
    return new Ue(
      this.typeBuilder,
      i(this.columnMetadata, { name: t })
    );
  }
}, nn = class extends _ {
  ref;
  /** The phantom type of the pointee of this ref. */
  __spacetimeType;
  constructor(e) {
    super(h.Ref(e)), this.ref = e;
  }
}, sn = ((e, t) => {
  let r = e, n;
  if (typeof e == "string") {
    if (!t)
      throw new TypeError(
        "When providing a name, you must also provide the variants object or array."
      );
    r = t, n = e;
  }
  if (Array.isArray(r)) {
    const a = {};
    for (const u of r)
      a[u] = new pt();
    return new Jr(a, n);
  }
  return new ft(r, n);
}), s = {
  /**
   * Creates a new `Bool` {@link AlgebraicType} to be used in table definitions
   * Represented as `boolean` in TypeScript.
   * @returns A new {@link BoolBuilder} instance
   */
  bool: () => new Hr(),
  /**
   * Creates a new `String` {@link AlgebraicType} to be used in table definitions
   * Represented as `string` in TypeScript.
   * @returns A new {@link StringBuilder} instance
   */
  string: () => new Wr(),
  /**
   * Creates a new `F64` {@link AlgebraicType} to be used in table definitions
   * Represented as `number` in TypeScript.
   * @returns A new {@link F64Builder} instance
   */
  number: () => new _t(),
  /**
   * Creates a new `I8` {@link AlgebraicType} to be used in table definitions
   * Represented as `number` in TypeScript.
   * @returns A new {@link I8Builder} instance
   */
  i8: () => new Or(),
  /**
   * Creates a new `U8` {@link AlgebraicType} to be used in table definitions
   * Represented as `number` in TypeScript.
   * @returns A new {@link U8Builder} instance
   */
  u8: () => new kr(),
  /**
   * Creates a new `I16` {@link AlgebraicType} to be used in table definitions
   * Represented as `number` in TypeScript.
   * @returns A new {@link I16Builder} instance
   */
  i16: () => new Nr(),
  /**
   * Creates a new `U16` {@link AlgebraicType} to be used in table definitions
   * Represented as `number` in TypeScript.
   * @returns A new {@link U16Builder} instance
   */
  u16: () => new Pr(),
  /**
   * Creates a new `I32` {@link AlgebraicType} to be used in table definitions
   * Represented as `number` in TypeScript.
   * @returns A new {@link I32Builder} instance
   */
  i32: () => new Kr(),
  /**
   * Creates a new `U32` {@link AlgebraicType} to be used in table definitions
   * Represented as `number` in TypeScript.
   * @returns A new {@link U32Builder} instance
   */
  u32: () => new Fr(),
  /**
   * Creates a new `I64` {@link AlgebraicType} to be used in table definitions
   * Represented as `bigint` in TypeScript.
   * @returns A new {@link I64Builder} instance
   */
  i64: () => new jr(),
  /**
   * Creates a new `U64` {@link AlgebraicType} to be used in table definitions
   * Represented as `bigint` in TypeScript.
   * @returns A new {@link U64Builder} instance
   */
  u64: () => new Rr(),
  /**
   * Creates a new `I128` {@link AlgebraicType} to be used in table definitions
   * Represented as `bigint` in TypeScript.
   * @returns A new {@link I128Builder} instance
   */
  i128: () => new $r(),
  /**
   * Creates a new `U128` {@link AlgebraicType} to be used in table definitions
   * Represented as `bigint` in TypeScript.
   * @returns A new {@link U128Builder} instance
   */
  u128: () => new Dr(),
  /**
   * Creates a new `I256` {@link AlgebraicType} to be used in table definitions
   * Represented as `bigint` in TypeScript.
   * @returns A new {@link I256Builder} instance
   */
  i256: () => new zr(),
  /**
   * Creates a new `U256` {@link AlgebraicType} to be used in table definitions
   * Represented as `bigint` in TypeScript.
   * @returns A new {@link U256Builder} instance
   */
  u256: () => new Vr(),
  /**
   * Creates a new `F32` {@link AlgebraicType} to be used in table definitions
   * Represented as `number` in TypeScript.
   * @returns A new {@link F32Builder} instance
   */
  f32: () => new Lr(),
  /**
   * Creates a new `F64` {@link AlgebraicType} to be used in table definitions
   * Represented as `number` in TypeScript.
   * @returns A new {@link F64Builder} instance
   */
  f64: () => new _t(),
  /**
   * Creates a new `Product` {@link AlgebraicType} to be used in table definitions. Product types in SpacetimeDB
   * are essentially the same as objects in JavaScript/TypeScript.
   * Properties of the object must also be {@link TypeBuilder}s.
   * Represented as an object with specific properties in TypeScript.
   *
   * @param name (optional) A display name for the product type. If omitted, an anonymous product type is created.
   * @param obj The object defining the properties of the type, whose property
   * values must be {@link TypeBuilder}s.
   * @returns A new {@link ProductBuilder} instance.
   */
  object: ((e, t) => {
    if (typeof e == "string") {
      if (!t)
        throw new TypeError(
          "When providing a name, you must also provide the object."
        );
      return new xe(t, e);
    }
    return new xe(e, void 0);
  }),
  /**
   * Creates a new `Row` {@link AlgebraicType} to be used in table definitions. Row types in SpacetimeDB
   * are similar to `Product` types, but are specifically used to define the schema of a table row.
   * Properties of the object must also be {@link TypeBuilder} or {@link ColumnBuilder}s.
   *
   * You can represent a `Row` as either a {@link RowObj} or an {@link RowBuilder} type when
   * defining a table schema.
   *
   * The {@link RowBuilder} type is useful when you want to create a type which can be used anywhere
   * a {@link TypeBuilder} is accepted, such as in nested objects or arrays, or as the argument
   * to a scheduled function.
   *
   * @param obj The object defining the properties of the row, whose property
   * values must be {@link TypeBuilder}s or {@link ColumnBuilder}s.
   * @returns A new {@link RowBuilder} instance
   */
  row: ((e, t) => {
    const [r, n] = typeof e == "string" ? [t, e] : [e, void 0];
    return new k(r, n);
  }),
  /**
   * Creates a new `Array` {@link AlgebraicType} to be used in table definitions.
   * Represented as an array in TypeScript.
   * @param element The element type of the array, which must be a `TypeBuilder`.
   * @returns A new {@link ArrayBuilder} instance
   */
  array(e) {
    return new Ge(e);
  },
  enum: sn,
  /**
   * This is a special helper function for conveniently creating {@link Product} type columns with no fields.
   *
   * @returns A new {@link ProductBuilder} instance with no fields.
   */
  unit() {
    return new pt();
  },
  /**
   * Creates a lazily-evaluated {@link TypeBuilder}. This is useful for creating
   * recursive types, such as a tree or linked list.
   * @param thunk A function that returns a {@link TypeBuilder}.
   * @returns A proxy {@link TypeBuilder} that evaluates the thunk on first access.
   */
  lazy(e) {
    let t = null;
    const r = () => t ??= e();
    return new Proxy({}, {
      get(a, u, o) {
        const l = r(), d = Reflect.get(l, u, o);
        return typeof d == "function" ? d.bind(l) : d;
      },
      set(a, u, o, l) {
        return Reflect.set(r(), u, o, l);
      },
      has(a, u) {
        return u in r();
      },
      ownKeys() {
        return Reflect.ownKeys(r());
      },
      getOwnPropertyDescriptor(a, u) {
        return Object.getOwnPropertyDescriptor(r(), u);
      },
      getPrototypeOf() {
        return Object.getPrototypeOf(r());
      }
    });
  },
  /**
   * This is a special helper function for conveniently creating {@link ScheduleAt} type columns.
   * @returns A new ColumnBuilder instance with the {@link ScheduleAt} type.
   */
  scheduleAt: () => new Zr(),
  /**
   * This is a convenience method for creating a column with the {@link Option} type.
   * You can create a column of the same type by constructing an enum with a `some` and `none` variant.
   * @param value The type of the value contained in the `some` variant of the `Option`.
   * @returns A new {@link OptionBuilder} instance with the {@link Option} type.
   */
  option(e) {
    return new Le(e);
  },
  /**
   * This is a convenience method for creating a column with the {@link Result} type.
   * You can create a column of the same type by constructing an enum with an `ok` and `err` variant.
   * @param ok The type of the value contained in the `ok` variant of the `Result`.
   * @param err The type of the value contained in the `err` variant of the `Result`.
   * @returns A new {@link ResultBuilder} instance with the {@link Result} type.
   */
  result(e, t) {
    return new Xe(e, t);
  },
  /**
   * This is a convenience method for creating a column with the {@link Identity} type.
   * You can create a column of the same type by constructing an `object` with a single `__identity__` element.
   * @returns A new {@link TypeBuilder} instance with the {@link Identity} type.
   */
  identity: () => new Gr(),
  /**
   * This is a convenience method for creating a column with the {@link ConnectionId} type.
   * You can create a column of the same type by constructing an `object` with a single `__connection_id__` element.
   * @returns A new {@link TypeBuilder} instance with the {@link ConnectionId} type.
   */
  connectionId: () => new Xr(),
  /**
   * This is a convenience method for creating a column with the {@link Timestamp} type.
   * You can create a column of the same type by constructing an `object` with a single `__timestamp_micros_since_unix_epoch__` element.
   * @returns A new {@link TypeBuilder} instance with the {@link Timestamp} type.
   */
  timestamp: () => new Yr(),
  /**
   * This is a convenience method for creating a column with the {@link TimeDuration} type.
   * You can create a column of the same type by constructing an `object` with a single `__time_duration_micros__` element.
   * @returns A new {@link TypeBuilder} instance with the {@link TimeDuration} type.
   */
  timeDuration: () => new en(),
  /**
   * This is a convenience method for creating a column with the {@link Uuid} type.
   * You can create a column of the same type by constructing an `object` with a single `__uuid__` element.
   * @returns A new {@link TypeBuilder} instance with the {@link Uuid} type.
   */
  uuid: () => new tn(),
  /**
   * This is a convenience method for creating a column with the {@link ByteArray} type.
   * You can create a column of the same type by constructing an `array` of `u8`.
   * The TypeScript representation is {@link Uint8Array}.
   * @returns A new {@link ByteArrayBuilder} instance with the {@link ByteArray} type.
   */
  byteArray: () => new Qr()
}, an = s.enum("RowSizeHint", {
  FixedSize: s.u16(),
  RowOffsets: s.array(s.u64())
}), un = an, ct = s.object("BsatnRowList", {
  get sizeHint() {
    return un;
  },
  rowsData: s.byteArray()
}), on = s.object("CallReducer", {
  reducer: s.string(),
  args: s.byteArray(),
  requestId: s.u32(),
  flags: s.u8()
}), cn = s.object("Subscribe", {
  queryStrings: s.array(s.string()),
  requestId: s.u32()
}), ln = s.object("OneOffQuery", {
  messageId: s.byteArray(),
  queryString: s.string()
}), R = s.object("QueryId", {
  id: s.u32()
}), dn = s.object("SubscribeSingle", {
  query: s.string(),
  requestId: s.u32(),
  get queryId() {
    return R;
  }
}), hn = s.object("SubscribeMulti", {
  queryStrings: s.array(s.string()),
  requestId: s.u32(),
  get queryId() {
    return R;
  }
}), mn = s.object("Unsubscribe", {
  requestId: s.u32(),
  get queryId() {
    return R;
  }
}), pn = s.object("UnsubscribeMulti", {
  requestId: s.u32(),
  get queryId() {
    return R;
  }
}), fn = s.object("CallProcedure", {
  procedure: s.string(),
  args: s.byteArray(),
  requestId: s.u32(),
  flags: s.u8()
}), yn = s.enum("ClientMessage", {
  get CallReducer() {
    return on;
  },
  get Subscribe() {
    return cn;
  },
  get OneOffQuery() {
    return ln;
  },
  get SubscribeSingle() {
    return dn;
  },
  get SubscribeMulti() {
    return hn;
  },
  get Unsubscribe() {
    return mn;
  },
  get UnsubscribeMulti() {
    return pn;
  },
  get CallProcedure() {
    return fn;
  }
}), qe = yn, Gt = s.object("QueryUpdate", {
  get deletes() {
    return ct;
  },
  get inserts() {
    return ct;
  }
}), gn = s.enum("CompressableQueryUpdate", {
  get Uncompressed() {
    return Gt;
  },
  Brotli: s.byteArray(),
  Gzip: s.byteArray()
}), bn = gn, Xt = s.object("TableUpdate", {
  tableId: s.u32(),
  tableName: s.string(),
  numRows: s.u64(),
  get updates() {
    return s.array(bn);
  }
}), Ne = s.object("DatabaseUpdate", {
  get tables() {
    return s.array(Xt);
  }
}), wn = s.object("InitialSubscription", {
  get databaseUpdate() {
    return Ne;
  },
  requestId: s.u32(),
  totalHostExecutionDuration: s.timeDuration()
}), vn = s.enum("UpdateStatus", {
  get Committed() {
    return Ne;
  },
  Failed: s.string(),
  OutOfEnergy: s.unit()
}), In = vn, _n = s.object("ReducerCallInfo", {
  reducerName: s.string(),
  reducerId: s.u32(),
  args: s.byteArray(),
  requestId: s.u32()
}), Bn = s.object("EnergyQuanta", {
  quanta: s.u128()
}), Un = s.object("TransactionUpdate", {
  get status() {
    return In;
  },
  timestamp: s.timestamp(),
  callerIdentity: s.identity(),
  callerConnectionId: s.connectionId(),
  get reducerCall() {
    return _n;
  },
  get energyQuantaUsed() {
    return Bn;
  },
  totalHostExecutionDuration: s.timeDuration()
}), Tn = s.object("TransactionUpdateLight", {
  requestId: s.u32(),
  get update() {
    return Ne;
  }
}), xn = s.object("IdentityToken", {
  identity: s.identity(),
  token: s.string(),
  connectionId: s.connectionId()
}), Sn = s.object("OneOffTable", {
  tableName: s.string(),
  get rows() {
    return ct;
  }
}), An = s.object("OneOffQueryResponse", {
  messageId: s.byteArray(),
  error: s.option(s.string()),
  get tables() {
    return s.array(Sn);
  },
  totalHostExecutionDuration: s.timeDuration()
}), Yt = s.object("SubscribeRows", {
  tableId: s.u32(),
  tableName: s.string(),
  get tableRows() {
    return Xt;
  }
}), Cn = s.object("SubscribeApplied", {
  requestId: s.u32(),
  totalHostExecutionDurationMicros: s.u64(),
  get queryId() {
    return R;
  },
  get rows() {
    return Yt;
  }
}), Mn = s.object("UnsubscribeApplied", {
  requestId: s.u32(),
  totalHostExecutionDurationMicros: s.u64(),
  get queryId() {
    return R;
  },
  get rows() {
    return Yt;
  }
}), qn = s.object("SubscriptionError", {
  totalHostExecutionDurationMicros: s.u64(),
  requestId: s.option(s.u32()),
  queryId: s.option(s.u32()),
  tableId: s.option(s.u32()),
  error: s.string()
}), En = s.object("SubscribeMultiApplied", {
  requestId: s.u32(),
  totalHostExecutionDurationMicros: s.u64(),
  get queryId() {
    return R;
  },
  get update() {
    return Ne;
  }
}), kn = s.object("UnsubscribeMultiApplied", {
  requestId: s.u32(),
  totalHostExecutionDurationMicros: s.u64(),
  get queryId() {
    return R;
  },
  get update() {
    return Ne;
  }
}), Pn = s.enum("ProcedureStatus", {
  Returned: s.byteArray(),
  OutOfEnergy: s.unit(),
  InternalError: s.string()
}), Fn = Pn, Rn = s.object("ProcedureResult", {
  get status() {
    return Fn;
  },
  timestamp: s.timestamp(),
  totalHostExecutionDuration: s.timeDuration(),
  requestId: s.u32()
}), Dn = s.enum("ServerMessage", {
  get InitialSubscription() {
    return wn;
  },
  get TransactionUpdate() {
    return Un;
  },
  get TransactionUpdateLight() {
    return Tn;
  },
  get IdentityToken() {
    return xn;
  },
  get OneOffQueryResponse() {
    return An;
  },
  get SubscribeApplied() {
    return Cn;
  },
  get UnsubscribeApplied() {
    return Mn;
  },
  get SubscriptionError() {
    return qn;
  },
  get SubscribeMultiApplied() {
    return En;
  },
  get UnsubscribeMultiApplied() {
    return kn;
  },
  get ProcedureResult() {
    return Rn;
  }
}), Vn = Dn, We = class {
  #r = /* @__PURE__ */ new Map();
  on(e, t) {
    let r = this.#r.get(e);
    r || (r = /* @__PURE__ */ new Set(), this.#r.set(e, r)), r.add(t);
  }
  off(e, t) {
    const r = this.#r.get(e);
    r && r.delete(t);
  }
  emit(e, ...t) {
    const r = this.#r.get(e);
    if (r)
      for (const n of r)
        n(...t);
  }
}, On = {
  component: "📦",
  info: "ℹ️",
  warn: "⚠️",
  error: "❌",
  debug: "🐛"
}, Nn = {
  component: "color: #fff; background-color: #8D6FDD; padding: 2px 5px; border-radius: 3px;",
  info: "color: #fff; background-color: #007bff; padding: 2px 5px; border-radius: 3px;",
  warn: "color: #fff; background-color: #ffc107; padding: 2px 5px; border-radius: 3px;",
  error: "color: #fff; background-color: #dc3545; padding: 2px 5px; border-radius: 3px;",
  debug: "color: #fff; background-color: #28a745; padding: 2px 5px; border-radius: 3px;"
}, Kn = {
  component: "color: #8D6FDD;",
  info: "color: #007bff;",
  warn: "color: #ffc107;",
  error: "color: #dc3545;",
  debug: "color: #28a745;"
}, P = (e, t) => {
  console.log(
    `%c${On[e]} ${e.toUpperCase()}%c ${t}`,
    Nn[e],
    Kn[e]
  );
}, qt = (e, t) => e === t ? 0 : e < t ? -1 : 1, jn = class {
  rows;
  tableDef;
  emitter;
  /**
   * @param name the table name
   * @param primaryKeyCol column index designated as `#[primarykey]`
   * @param primaryKey column name designated as `#[primarykey]`
   * @param entityClass the entityClass
   */
  constructor(e) {
    this.tableDef = e, this.rows = /* @__PURE__ */ new Map(), this.emitter = new We();
    const t = this.tableDef.indexes || [];
    for (const r of t) {
      const n = r, a = this.#r(this.tableDef, n);
      this[r.name] = a;
    }
  }
  // TODO: this just scans the whole table; we should build proper index structures
  #r(e, t) {
    if (t.algorithm !== "btree")
      throw new Error("Only btree indexes are supported in TableCacheImpl");
    const r = t.columns, n = (l) => r.map((d) => l[d]), a = (l, d) => {
      const f = n(l), y = Array.isArray(d) ? d : [d], v = Math.max(0, y.length - 1);
      for (let p = 0; p < v; p++)
        if (!Ee(f[p], y[p])) return !1;
      const b = y[y.length - 1], m = f[v];
      if (b && typeof b == "object" && "from" in b && "to" in b) {
        const p = b.from, w = b.to;
        if (p.tag !== "unbounded") {
          const U = qt(m, p.value);
          if (U < 0 || U === 0 && p.tag === "excluded") return !1;
        }
        if (w.tag !== "unbounded") {
          const U = qt(m, w.value);
          if (U > 0 || U === 0 && w.tag === "excluded") return !1;
        }
        return !0;
      } else
        return !!Ee(m, b);
    }, u = e.constraints.some((l) => l.constraint !== "unique" ? !1 : Ee(l.columns, t.columns)), o = this;
    return u ? {
      find: (d) => {
        const f = Array.isArray(d) ? d : [d];
        for (const y of o.iter())
          if (Ee(n(y), f)) return y;
        return null;
      }
    } : {
      *filter(d) {
        for (const f of o.iter())
          a(f, d) && (yield f);
      }
    };
  }
  /**
   * @returns number of rows in the table
   */
  count() {
    return BigInt(this.rows.size);
  }
  /**
   * @returns The values of the rows in the table
   */
  iter() {
    function* e(t) {
      for (const [r] of t.values())
        yield r;
    }
    return e(this.rows);
  }
  /**
   * Allows iteration over the rows in the table
   * @returns An iterator over the rows in the table
   */
  [Symbol.iterator]() {
    return this.iter();
  }
  applyOperations = (e, t) => {
    const r = [];
    if (Object.values(this.tableDef.columns).some(
      (a) => a.columnMetadata.isPrimaryKey === !0
    )) {
      const a = /* @__PURE__ */ new Map(), u = /* @__PURE__ */ new Map();
      for (const o of e)
        if (o.type === "insert") {
          const [l, d] = a.get(o.rowId) || [o, 0];
          a.set(o.rowId, [o, d + 1]);
        } else {
          const [l, d] = u.get(o.rowId) || [o, 0];
          u.set(o.rowId, [o, d + 1]);
        }
      for (const [o, [l, d]] of a) {
        const f = u.get(o);
        if (f) {
          const [y, v] = f, b = d - v, m = this.update(
            t,
            o,
            l.row,
            b
          );
          m && r.push(m), u.delete(o);
        } else {
          const y = this.insert(t, l, d);
          y && r.push(y);
        }
      }
      for (const [o, l] of u.values()) {
        const d = this.delete(t, o, l);
        d && r.push(d);
      }
    } else
      for (const a of e)
        if (a.type === "insert") {
          const u = this.insert(t, a);
          u && r.push(u);
        } else {
          const u = this.delete(t, a);
          u && r.push(u);
        }
    return r;
  };
  update = (e, t, r, n = 0) => {
    const a = this.rows.get(t);
    if (!a) {
      P(
        "error",
        `Updating a row that was not present in the cache. Table: ${this.tableDef.name}, RowId: ${t}`
      );
      return;
    }
    const [u, o] = a, l = Math.max(1, o + n);
    if (o + n <= 0) {
      P(
        "error",
        `Negative reference count for in table ${this.tableDef.name} row ${t} (${o} + ${n})`
      );
      return;
    }
    return this.rows.set(t, [r, l]), o === 0 ? (P(
      "error",
      `Updating a row id in table ${this.tableDef.name} which was not present in the cache (rowId: ${t})`
    ), {
      type: "insert",
      table: this.tableDef.name,
      cb: () => {
        this.emitter.emit("insert", e, r);
      }
    }) : {
      type: "update",
      table: this.tableDef.name,
      cb: () => {
        this.emitter.emit("update", e, u, r);
      }
    };
  };
  insert = (e, t, r = 1) => {
    const [n, a] = this.rows.get(t.rowId) || [
      t.row,
      0
    ];
    if (this.rows.set(t.rowId, [t.row, a + r]), a === 0)
      return {
        type: "insert",
        table: this.tableDef.name,
        cb: () => {
          this.emitter.emit("insert", e, t.row);
        }
      };
  };
  delete = (e, t, r = 1) => {
    const [n, a] = this.rows.get(t.rowId) || [
      t.row,
      0
    ];
    if (a === 0) {
      P("warn", "Deleting a row that was not present in the cache");
      return;
    }
    if (a <= r)
      return this.rows.delete(t.rowId), {
        type: "delete",
        table: this.tableDef.name,
        cb: () => {
          this.emitter.emit("delete", e, t.row);
        }
      };
    this.rows.set(t.rowId, [t.row, a - r]);
  };
  /**
   * Register a callback for when a row is newly inserted into the database.
   *
   * ```ts
   * ctx.db.user.onInsert((reducerEvent, user) => {
   *   if (reducerEvent) {
   *      console.log("New user on reducer", reducerEvent, user);
   *   } else {
   *      console.log("New user received during subscription update on insert", user);
   *  }
   * });
   * ```
   *
   * @param cb Callback to be called when a new row is inserted
   */
  onInsert = (e) => {
    this.emitter.on("insert", e);
  };
  /**
   * Register a callback for when a row is deleted from the database.
   *
   * ```ts
   * ctx.db.user.onDelete((reducerEvent, user) => {
   *   if (reducerEvent) {
   *      console.log("Deleted user on reducer", reducerEvent, user);
   *   } else {
   *      console.log("Deleted user received during subscription update on update", user);
   *  }
   * });
   * ```
   *
   * @param cb Callback to be called when a new row is inserted
   */
  onDelete = (e) => {
    this.emitter.on("delete", e);
  };
  /**
   * Register a callback for when a row is updated into the database.
   *
   * ```ts
   * ctx.db.user.onInsert((reducerEvent, oldUser, user) => {
   *   if (reducerEvent) {
   *      console.log("Updated user on reducer", reducerEvent, user);
   *   } else {
   *      console.log("Updated user received during subscription update on delete", user);
   *  }
   * });
   * ```
   *
   * @param cb Callback to be called when a new row is inserted
   */
  onUpdate = (e) => {
    this.emitter.on("update", e);
  };
  /**
   * Remove a callback for when a row is newly inserted into the database.
   *
   * @param cb Callback to be removed
   */
  removeOnInsert = (e) => {
    this.emitter.off("insert", e);
  };
  /**
   * Remove a callback for when a row is deleted from the database.
   *
   * @param cb Callback to be removed
   */
  removeOnDelete = (e) => {
    this.emitter.off("delete", e);
  };
  /**
   * Remove a callback for when a row is updated into the database.
   *
   * @param cb Callback to be removed
   */
  removeOnUpdate = (e) => {
    this.emitter.off("update", e);
  };
}, $n = class {
  map = /* @__PURE__ */ new Map();
  get(e) {
    return this.map.get(e);
  }
  set(e, t) {
    return this.map.set(e, t), this;
  }
  has(e) {
    return this.map.has(e);
  }
  delete(e) {
    return this.map.delete(e);
  }
  // optional: iteration stays broadly typed (cannot express per-key relation here)
  keys() {
    return this.map.keys();
  }
  values() {
    return this.map.values();
  }
  entries() {
    return this.map.entries();
  }
  [Symbol.iterator]() {
    return this.entries();
  }
}, zn = class {
  /**
   * The tables in the database.
   */
  tables = new $n();
  /**
   * Returns the table with the given name.
   * - If SchemaDef is a concrete schema, `name` is constrained to known table names,
   *   and the return type matches that table.
   * - If SchemaDef is undefined, `name` is string and the return type is untyped.
   */
  getTable(e) {
    const t = this.tables.get(e);
    if (!t)
      throw console.error(
        "The table has not been registered for this client. Please register the table before using it. If you have registered global tables using the SpacetimeDBClient.registerTables() or `registerTable()` method, please make sure that is executed first!"
      ), new Error(`Table ${String(e)} does not exist`);
    return t;
  }
  /**
   * Returns the table with the given name, creating it if needed.
   * - Typed mode: `tableTypeInfo.tableName` is constrained to known names and
   *   the return type matches that table.
   * - Untyped mode: accepts any string and returns an untyped TableCache.
   */
  getOrCreateTable(e) {
    const t = e.name, r = this.tables.get(t);
    if (r)
      return r;
    const n = new jn(
      e
    );
    return this.tables.set(t, n), n;
  }
};
function Ln(e, t) {
  const r = Math.min(e.length, t.length);
  for (let n = 0; n < r; n++) {
    const a = e[n], u = t[n];
    if (a !== u)
      return typeof a == "number" && typeof u == "number" ? a - u : typeof a == "string" && typeof u == "string" ? a.localeCompare(u) : typeof a == "string" ? 1 : -1;
  }
  return e.length - t.length;
}
var er = class lt {
  major;
  minor;
  patch;
  preRelease;
  buildInfo;
  constructor(t, r, n, a = null, u = null) {
    this.major = t, this.minor = r, this.patch = n, this.preRelease = a, this.buildInfo = u;
  }
  toString() {
    let t = `${this.major}.${this.minor}.${this.patch}`;
    return this.preRelease && (t += `-${this.preRelease.join(".")}`), this.buildInfo && (t += `+${this.buildInfo}`), t;
  }
  compare(t) {
    return this.major !== t.major ? this.major - t.major : this.minor !== t.minor ? this.minor - t.minor : this.patch !== t.patch ? this.patch - t.patch : this.preRelease && t.preRelease ? Ln(this.preRelease, t.preRelease) : this.preRelease || t.preRelease ? -1 : 0;
  }
  clone() {
    return new lt(
      this.major,
      this.minor,
      this.patch,
      this.preRelease ? [...this.preRelease] : null,
      this.buildInfo
    );
  }
  static parseVersionString(t) {
    const r = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*))?(?:\+([\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*))?$/, n = t.match(r);
    if (!n)
      throw new Error(`Invalid version string: ${t}`);
    const a = parseInt(n[1], 10), u = parseInt(n[2], 10), o = parseInt(n[3], 10), l = n[4] ? n[4].split(".").map((f) => isNaN(Number(f)) ? f : Number(f)) : null, d = n[5] || null;
    return new lt(a, u, o, l, d);
  }
}, tr = new er(
  1,
  4,
  0
);
function Hn(e) {
  if (e === void 0)
    throw new Error(Et(e));
  if (er.parseVersionString(e).compare(tr) < 0)
    throw new Error(Et(e));
}
function Et(e) {
  return `Module code was generated with an incompatible version of the spacetimedb cli (${e}). Update the cli version to at least ${tr.toString()} and regenerate the bindings. You can upgrade to the latest cli version by running: spacetime version upgrade`;
}
async function rr(e, t, r = 128 * 1024) {
  let n = 0;
  const a = new ReadableStream({
    pull(m) {
      if (n < e.length) {
        const p = e.subarray(
          n,
          Math.min(n + r, e.length)
        );
        m.enqueue(p), n += r;
      } else
        m.close();
    }
  }), u = new DecompressionStream(t), l = a.pipeThrough(u).getReader(), d = [];
  let f = 0, y;
  for (; !(y = await l.read()).done; )
    d.push(y.value), f += y.value.length;
  const v = new Uint8Array(f);
  let b = 0;
  for (const m of d)
    v.set(m, b), b += m.length;
  return v;
}
async function Wn() {
  if (typeof globalThis.WebSocket < "u")
    return globalThis.WebSocket;
  const e = new Function("m", "return import(m)");
  try {
    const { WebSocket: t } = await e("undici");
    return t;
  } catch (t) {
    throw console.warn(
      "[spacetimedb-sdk] No global WebSocket found. On Node 18–21, please install `undici` (npm install undici) to enable WebSocket support."
    ), t;
  }
}
var Qn = class nr {
  onclose;
  onopen;
  onmessage;
  onerror;
  #r;
  async #e(t) {
    const r = new Uint8Array(t.data);
    let n;
    if (r[0] === 0)
      n = r.slice(1);
    else {
      if (r[0] === 1)
        throw new Error(
          "Brotli Compression not supported. Please use gzip or none compression in withCompression method on DbConnection."
        );
      if (r[0] === 2)
        n = await rr(r.slice(1), "gzip");
      else
        throw new Error(
          "Unexpected Compression Algorithm. Please use `gzip` or `none`"
        );
    }
    this.onmessage?.({ data: n });
  }
  #t(t) {
    this.onopen?.(t);
  }
  #n(t) {
    this.onerror?.(t);
  }
  #i(t) {
    this.onclose?.(t);
  }
  send(t) {
    this.#r.send(t);
  }
  close() {
    this.#r.close();
  }
  constructor(t) {
    this.onmessage = void 0, this.onopen = void 0, this.onmessage = void 0, this.onerror = void 0, t.onmessage = this.#e.bind(this), t.onerror = this.#n.bind(this), t.onclose = this.#i.bind(this), t.onopen = this.#t.bind(this), t.binaryType = "arraybuffer", this.#r = t;
  }
  static async createWebSocketFn({
    url: t,
    nameOrAddress: r,
    wsProtocol: n,
    authToken: a,
    compression: u,
    lightMode: o,
    confirmedReads: l
  }) {
    const d = new Headers(), f = await Wn();
    let y;
    if (a) {
      d.set("Authorization", `Bearer ${a}`);
      const m = new URL("v1/identity/websocket-token", t);
      m.protocol = t.protocol === "wss:" ? "https:" : "http:";
      const p = await fetch(m, { method: "POST", headers: d });
      if (p.ok) {
        const { token: w } = await p.json();
        y = w;
      } else
        return Promise.reject(
          new Error(`Failed to verify token: ${p.statusText}`)
        );
    }
    const v = new URL(`v1/database/${r}/subscribe`, t);
    y && v.searchParams.set("token", y), v.searchParams.set(
      "compression",
      u === "gzip" ? "Gzip" : "None"
    ), o && v.searchParams.set("light", "true"), l !== void 0 && v.searchParams.set("confirmed", l.toString());
    const b = new f(v.toString(), n);
    return new nr(b);
  }
}, Jn = class {
  /**
   * Creates a new `DbConnectionBuilder` database client and set the initial parameters.
   *
   * Users are not expected to call this constructor directly. Instead, use the static method `DbConnection.builder()`.
   *
   * @param remoteModule The remote module to use to connect to the SpacetimeDB server.
   * @param dbConnectionConstructor The constructor to use to create a new `DbConnection`.
   */
  constructor(t, r) {
    this.remoteModule = t, this.dbConnectionCtor = r, this.#o = Qn.createWebSocketFn;
  }
  #r;
  #e;
  #t;
  #n;
  #i = new We();
  #l = "gzip";
  #s = !1;
  #a;
  #o;
  /**
   * Set the URI of the SpacetimeDB server to connect to.
   *
   * @param uri The URI of the SpacetimeDB server to connect to.
   *
   **/
  withUri(t) {
    return this.#r = new URL(t), this;
  }
  /**
   * Set the name or Identity of the database module to connect to.
   *
   * @param nameOrAddress
   *
   * @returns The `DbConnectionBuilder` instance.
   */
  withModuleName(t) {
    return this.#e = t, this;
  }
  /**
   * Set the identity of the client to connect to the database.
   *
   * @param token The credentials to use to authenticate with SpacetimeDB. This
   * is optional. You can store the token returned by the `onConnect` callback
   * to use in future connections.
   *
   * @returns The `DbConnectionBuilder` instance.
   */
  withToken(t) {
    return this.#n = t, this;
  }
  withWSFn(t) {
    return this.#o = t, this;
  }
  /**
   * Set the compression algorithm to use for the connection.
   *
   * @param compression The compression algorithm to use for the connection.
   */
  withCompression(t) {
    return this.#l = t, this;
  }
  /**
   * Sets the connection to operate in light mode.
   *
   * Light mode is a mode that reduces the amount of data sent over the network.
   *
   * @param lightMode The light mode for the connection.
   */
  withLightMode(t) {
    return this.#s = t, this;
  }
  /**
   * Sets the connection to use confirmed reads.
   *
   * When enabled, the server will send query results only after they are
   * confirmed to be durable.
   *
   * What durable means depends on the server configuration: a single node
   * server may consider a transaction durable once it is `fsync`'ed to disk,
   * whereas a cluster may require that some number of replicas have
   * acknowledge that they have stored the transactions.
   *
   * Note that enabling confirmed reads will increase the latency between a
   * reducer call and the corresponding subscription update arriving at the
   * client.
   *
   * If this method is not called, not preference is sent to the server, and
   * the server will choose the default.
   *
   * @param confirmedReads `true` to enable confirmed reads, `false` to disable.
   */
  withConfirmedReads(t) {
    return this.#a = t, this;
  }
  /**
   * Register a callback to be invoked upon authentication with the database.
   *
   * @param identity A unique identifier for a client connected to a database.
   * @param token The credentials to use to authenticate with SpacetimeDB.
   *
   * @returns The `DbConnectionBuilder` instance.
   *
   * The callback will be invoked with the `Identity` and private authentication `token` provided by the database to identify this connection.
   *
   * If credentials were supplied to connect, those passed to the callback will be equivalent to the ones used to connect.
   *
   * If the initial connection was anonymous, a new set of credentials will be generated by the database to identify this user.
   *
   * The credentials passed to the callback can be saved and used to authenticate the same user in future connections.
   *
   * @example
   *
   * ```ts
   * DbConnection.builder().onConnect((ctx, identity, token) => {
   *  console.log("Connected to SpacetimeDB with identity:", identity.toHexString());
   * });
   * ```
   */
  onConnect(t) {
    return this.#i.on("connect", t), this;
  }
  /**
   * Register a callback to be invoked upon an error.
   *
   * @example
   *
   * ```ts
   * DbConnection.builder().onConnectError((ctx, error) => {
   *   console.log("Error connecting to SpacetimeDB:", error);
   * });
   * ```
   */
  onConnectError(t) {
    return this.#i.on("connectError", t), this;
  }
  /**
   * Registers a callback to run when a {@link DbConnection} whose connection initially succeeded
   * is disconnected, either after a {@link DbConnection.disconnect} call or due to an error.
   *
   * If the connection ended because of an error, the error is passed to the callback.
   *
   * The `callback` will be installed on the `DbConnection` created by `build`
   * before initiating the connection, ensuring there's no opportunity for the disconnect to happen
   * before the callback is installed.
   *
   * Note that this does not trigger if `build` fails
   * or in cases where {@link DbConnectionBuilder.onConnectError} would trigger.
   * This callback only triggers if the connection closes after `build` returns successfully
   * and {@link DbConnectionBuilder.onConnect} is invoked, i.e., after the `IdentityToken` is received.
   *
   * To simplify SDK implementation, at most one such callback can be registered.
   * Calling `onDisconnect` on the same `DbConnectionBuilder` multiple times throws an error.
   *
   * Unlike callbacks registered via {@link DbConnection},
   * no mechanism is provided to unregister the provided callback.
   * This is a concession to ergonomics; there's no clean place to return a `CallbackId` from this method
   * or from `build`.
   *
   * @param {function(error?: Error): void} callback - The callback to invoke upon disconnection.
   * @throws {Error} Throws an error if called multiple times on the same `DbConnectionBuilder`.
   */
  onDisconnect(t) {
    return this.#i.on("disconnect", t), this;
  }
  /**
   * Builds a new `DbConnection` with the parameters set on this `DbConnectionBuilder` and attempts to connect to the SpacetimeDB server.
   *
   * @returns A new `DbConnection` with the parameters set on this `DbConnectionBuilder`.
   *
   * @example
   *
   * ```ts
   * const host = "http://localhost:3000";
   * const name_or_address = "database_name"
   * const auth_token = undefined;
   * DbConnection.builder().withUri(host).withModuleName(name_or_address).withToken(auth_token).build();
   * ```
   */
  build() {
    if (!this.#r)
      throw new Error("URI is required to connect to SpacetimeDB");
    if (!this.#e)
      throw new Error(
        "Database name or address is required to connect to SpacetimeDB"
      );
    return Hn(this.remoteModule.versionInfo?.cliVersion), this.dbConnectionCtor({
      uri: this.#r,
      nameOrAddress: this.#e,
      identity: this.#t,
      token: this.#n,
      emitter: this.#i,
      compression: this.#l,
      lightMode: this.#s,
      confirmedReads: this.#a,
      createWSFn: this.#o,
      remoteModule: this.remoteModule
    });
  }
}, ir = class {
  constructor(e) {
    this.db = e;
  }
  #r = void 0;
  #e = void 0;
  /**
   * Registers `callback` to run when this query is successfully added to our subscribed set,
   * I.e. when its `SubscriptionApplied` message is received.
   *
   * The database state exposed via the `&EventContext` argument
   * includes all the rows added to the client cache as a result of the new subscription.
   *
   * The event in the `&EventContext` argument is `Event::SubscribeApplied`.
   *
   * Multiple `on_applied` callbacks for the same query may coexist.
   * No mechanism for un-registering `on_applied` callbacks is exposed.
   *
   * @param cb - Callback to run when the subscription is applied.
   * @returns The current `SubscriptionBuilder` instance.
   */
  onApplied(e) {
    return this.#r = e, this;
  }
  /**
   * Registers `callback` to run when this query either:
   * - Fails to be added to our subscribed set.
   * - Is unexpectedly removed from our subscribed set.
   *
   * If the subscription had previously started and has been unexpectedly removed,
   * the database state exposed via the `&EventContext` argument contains no rows
   * from any subscriptions removed within the same error event.
   * As proposed, it must therefore contain no rows.
   *
   * The event in the `&EventContext` argument is `Event::SubscribeError`,
   * containing a dynamic error object with a human-readable description of the error
   * for diagnostic purposes.
   *
   * Multiple `on_error` callbacks for the same query may coexist.
   * No mechanism for un-registering `on_error` callbacks is exposed.
   *
   * @param cb - Callback to run when there is an error in subscription.
   * @returns The current `SubscriptionBuilder` instance.
   */
  onError(e) {
    return this.#e = e, this;
  }
  subscribe(e) {
    const t = Array.isArray(e) ? e : [e];
    if (t.length === 0)
      throw new Error("Subscriptions must have at least one query");
    const r = t.map((n) => {
      if (typeof n == "string") return n;
      if (vr(n)) return Ir(n);
      throw new Error("Subscriptions must be SQL strings or typed queries");
    });
    return new Gn(
      this.db,
      r,
      this.#r,
      this.#e
    );
  }
  /**
   * Subscribes to all rows from all tables.
   *
   * This method is intended as a convenience
   * for applications where client-side memory use and network bandwidth are not concerns.
   * Applications where these resources are a constraint
   * should register more precise queries via `subscribe`
   * in order to replicate only the subset of data which the client needs to function.
   *
   * This method should not be combined with `subscribe` on the same `DbConnection`.
   * A connection may either `subscribe` to particular queries,
   * or `subscribeToAllTables`, but not both.
   * Attempting to call `subscribe`
   * on a `DbConnection` that has previously used `subscribeToAllTables`,
   * or vice versa, may misbehave in any number of ways,
   * including dropping subscriptions, corrupting the client cache, or throwing errors.
   */
  subscribeToAllTables() {
    this.subscribe("SELECT * FROM *");
  }
}, Zn = class {
  subscriptions = /* @__PURE__ */ new Map();
}, Gn = class {
  constructor(e, t, r, n) {
    this.db = e, this.#i.on(
      "applied",
      (a) => {
        this.#n = !0, r && r(a);
      }
    ), this.#i.on(
      "error",
      (a, u) => {
        this.#n = !1, this.#t = !0, n && n(a, u);
      }
    ), this.#r = this.db.registerSubscription(this, this.#i, t);
  }
  #r;
  #e = !1;
  #t = !1;
  #n = !1;
  #i = new We();
  /**
   * Consumes self and issues an `Unsubscribe` message,
   * removing this query from the client's set of subscribed queries.
   * It is only valid to call this method if `is_active()` is `true`.
   */
  unsubscribe() {
    if (this.#e)
      throw new Error("Unsubscribe has already been called");
    this.#e = !0, this.db.unregisterSubscription(this.#r), this.#i.on(
      "end",
      (e) => {
        this.#t = !0, this.#n = !1;
      }
    );
  }
  /**
   * Unsubscribes and also registers a callback to run upon success.
   * I.e. when an `UnsubscribeApplied` message is received.
   *
   * If `Unsubscribe` returns an error,
   * or if the `on_error` callback(s) are invoked before this subscription would end normally,
   * the `on_end` callback is not invoked.
   *
   * @param onEnd - Callback to run upon successful unsubscribe.
   */
  unsubscribeThen(e) {
    if (this.#t)
      throw new Error("Subscription has already ended");
    if (this.#e)
      throw new Error("Unsubscribe has already been called");
    this.#e = !0, this.db.unregisterSubscription(this.#r), this.#i.on(
      "end",
      (t) => {
        this.#t = !0, this.#n = !1, e(t);
      }
    );
  }
  /**
   * True if this `SubscriptionHandle` has ended,
   * either due to an error or a call to `unsubscribe`.
   *
   * This is initially false, and becomes true when either the `on_end` or `on_error` callback is invoked.
   * A subscription which has not yet been applied is not active, but is also not ended.
   */
  isEnded() {
    return this.#t;
  }
  /**
   * True if this `SubscriptionHandle` is active, meaning it has been successfully applied
   * and has not since ended, either due to an error or a complete `unsubscribe` request-response pair.
   *
   * This corresponds exactly to the interval bounded at the start by the `on_applied` callback
   * and at the end by either the `on_end` or `on_error` callback.
   */
  isActive() {
    return this.#n;
  }
};
function Xn(e) {
  switch (e) {
    case "FullUpdate":
      return 0;
    case "NoSuccessNotify":
      return 1;
  }
}
var Yn = class {
  /**
   * Whether or not the connection is active.
   */
  isActive = !1;
  /**
   * This connection's public identity.
   */
  identity = void 0;
  /**
   * This connection's private authentication token.
   */
  token = void 0;
  /**
   * The accessor field to access the tables in the database and associated
   * callback functions.
   */
  db;
  /**
   * The accessor field to access the reducers in the database and associated
   * callback functions.
   */
  reducers;
  /**
   * The accessor field to access functions related to setting flags on
   * reducers regarding how the server should handle the reducer call and
   * the events that it sends back to the client.
   */
  setReducerFlags;
  /**
   * The accessor field to access the reducers in the database and associated
   * callback functions.
   */
  procedures;
  /**
   * The `ConnectionId` of the connection to to the database.
   */
  connectionId = Ve.random();
  // These fields are meant to be strictly private.
  #r = 0;
  #e = 0;
  #t;
  #n = new We();
  #i;
  #l = Promise.resolve();
  #s = new Zn();
  #a;
  #o = /* @__PURE__ */ new Map();
  #h = /* @__PURE__ */ new Map();
  // These fields are not part of the public API, but in a pinch you
  // could use JavaScript to access them by bypassing TypeScript's
  // private fields.
  // We use them in testing.
  clientCache;
  ws;
  wsPromise;
  constructor({
    uri: e,
    nameOrAddress: t,
    identity: r,
    token: n,
    emitter: a,
    remoteModule: u,
    createWSFn: o,
    compression: l,
    lightMode: d,
    confirmedReads: f
  }) {
    P("info", "Connecting to SpacetimeDB WS...");
    const y = new URL(e.toString());
    /^wss?:/.test(e.protocol) || (y.protocol = y.protocol === "https:" ? "wss:" : "ws:"), this.identity = r, this.token = n, this.#a = u, this.#t = a;
    const v = this.connectionId.toHexString();
    y.searchParams.set("connection_id", v), this.clientCache = new zn(), this.db = this.#f(u), this.reducers = this.#y(u), this.setReducerFlags = this.#g(u), this.procedures = this.#b(u), this.wsPromise = o({
      url: y,
      nameOrAddress: t,
      wsProtocol: "v1.bsatn.spacetimedb",
      authToken: n,
      compression: l,
      lightMode: d,
      confirmedReads: f
    }).then((b) => (this.ws = b, this.ws.onclose = () => {
      this.#t.emit("disconnect", this), this.isActive = !1;
    }, this.ws.onerror = (m) => {
      this.#t.emit("connectError", this, m), this.isActive = !1;
    }, this.ws.onopen = this.#v.bind(this), this.ws.onmessage = this.#_.bind(this), b)).catch((b) => {
      P("error", "Error connecting to SpacetimeDB WS"), this.#t.emit("connectError", this, b);
    });
  }
  #m = () => {
    const e = this.#r;
    return this.#r += 1, e;
  };
  #p = () => this.#e++;
  #f(e) {
    const t = /* @__PURE__ */ Object.create(null);
    for (const r of e.tables) {
      const n = r.accessorName;
      Object.defineProperty(t, n, {
        enumerable: !0,
        configurable: !1,
        get: () => this.clientCache.getOrCreateTable(r)
      });
    }
    return t;
  }
  #y(e) {
    const t = {};
    for (const r of e.reducers) {
      const n = ke(r.name);
      t[n] = (o) => {
        const l = this.#o.get(r.name) ?? "FullUpdate";
        this.callReducerWithParams(
          r.name,
          r.paramsType,
          o,
          l
        );
      };
      const a = `on${De(r.name)}`;
      t[a] = (o) => {
        this.onReducer(r.name, o);
      };
      const u = `removeOn${De(r.name)}`;
      t[u] = (o) => {
        this.offReducer(r.name, o);
      };
    }
    return t;
  }
  #g(e) {
    const t = /* @__PURE__ */ Object.create(null);
    for (const r of e.reducers) {
      const n = ke(r.name);
      Object.defineProperty(t, n, {
        enumerable: !0,
        configurable: !1,
        value: (a) => {
          this.#o.set(r.name, a);
        }
      });
    }
    return t;
  }
  #b(e) {
    const t = {};
    for (const r of e.procedures) {
      const n = ke(r.name), a = new xe(r.params).algebraicType.value, u = r.returnType.algebraicType;
      t[n] = (o) => this.callProcedureWithParams(
        r.name,
        a,
        o,
        u
      );
    }
    return t;
  }
  #u(e) {
    return {
      db: this.db,
      reducers: this.reducers,
      setReducerFlags: this.setReducerFlags,
      isActive: this.isActive,
      subscriptionBuilder: this.subscriptionBuilder.bind(this),
      disconnect: this.disconnect.bind(this),
      event: e
    };
  }
  // NOTE: This is very important!!! This is the actual function that
  // gets called when you call `connection.subscriptionBuilder()`.
  // The `subscriptionBuilder` function which is generated, just shadows
  // this function in the type system, but not the actual implementation!
  // Do not remove this function, or shoot yourself in the foot please.
  // It's not clear what would be a better way to do this at this exact
  // moment.
  subscriptionBuilder = () => new ir(this);
  registerSubscription(e, t, r) {
    const n = this.#m();
    return this.#s.subscriptions.set(n, {
      handle: e,
      emitter: t
    }), this.#d(
      qe.SubscribeMulti({
        queryStrings: r,
        queryId: { id: n },
        // The TypeScript SDK doesn't currently track `request_id`s,
        // so always use 0.
        requestId: 0
      })
    ), n;
  }
  unregisterSubscription(e) {
    this.#d(
      qe.UnsubscribeMulti({
        queryId: { id: e },
        // The TypeScript SDK doesn't currently track `request_id`s,
        // so always use 0.
        requestId: 0
      })
    );
  }
  // This function is async because we decompress the message async
  async #w(e) {
    const t = (a, u, o) => {
      const l = o.rowsData, d = new J(l), f = [], y = this.#a.tables.find((w) => w.name === u), v = y.rowType, m = Object.entries(y.columns).find(
        (w) => w[1].columnMetadata.isPrimaryKey
      );
      let p = 0;
      for (; d.remaining > 0; ) {
        const w = Z.deserializeValue(d, v);
        let U;
        if (m !== void 0) {
          const g = m[0], I = m[1].typeBuilder.algebraicType;
          U = h.intoMapKey(
            I,
            w[g]
          );
        } else {
          const g = l.subarray(p, d.offset);
          U = Kt.fromByteArray(g);
        }
        p = d.offset, f.push({
          type: a,
          rowId: U,
          row: w
        });
      }
      return f;
    }, r = async (a) => {
      const u = a.tableName;
      let o = [];
      for (const l of a.updates) {
        let d;
        if (l.tag === "Gzip") {
          const f = await rr(l.value, "gzip");
          d = h.deserializeValue(
            new J(f),
            Gt.algebraicType
          );
        } else {
          if (l.tag === "Brotli")
            throw new Error(
              "Brotli compression not supported. Please use gzip or none compression in withCompression method on DbConnection."
            );
          d = l.value;
        }
        o = o.concat(
          t("insert", u, d.inserts)
        ), o = o.concat(
          t("delete", u, d.deletes)
        );
      }
      return {
        tableName: u,
        operations: o
      };
    }, n = async (a) => {
      const u = [];
      for (const o of a.tables)
        u.push(await r(o));
      return u;
    };
    switch (e.tag) {
      case "InitialSubscription": {
        const a = e.value.databaseUpdate;
        return {
          tag: "InitialSubscription",
          tableUpdates: await n(a)
        };
      }
      case "TransactionUpdateLight": {
        const a = e.value.update;
        return {
          tag: "TransactionUpdateLight",
          tableUpdates: await n(a)
        };
      }
      case "TransactionUpdate": {
        const a = e.value, u = a.callerIdentity, o = Ve.nullIfZero(
          a.callerConnectionId
        ), l = a.reducerCall.reducerName, d = a.reducerCall.args, f = a.energyQuantaUsed;
        let y = [], v = "";
        switch (a.status.tag) {
          case "Committed":
            y = await n(a.status.value);
            break;
          case "Failed":
            y = [], v = a.status.value;
            break;
          case "OutOfEnergy":
            y = [];
            break;
        }
        if (l === "<none>") {
          console.error(`Received an error from the database: ${v}`);
          return;
        }
        let b;
        return l !== "" && (b = {
          reducerName: l,
          args: d
        }), {
          tag: "TransactionUpdate",
          tableUpdates: y,
          identity: u,
          connectionId: o,
          reducerInfo: b,
          status: a.status,
          energyConsumed: f.quanta,
          message: v,
          timestamp: a.timestamp
        };
      }
      case "IdentityToken":
        return {
          tag: "IdentityToken",
          identity: e.value.identity,
          token: e.value.token,
          connectionId: e.value.connectionId
        };
      case "OneOffQueryResponse":
        throw new Error(
          `TypeScript SDK never sends one-off queries, but got OneOffQueryResponse ${e}`
        );
      case "SubscribeMultiApplied": {
        const a = await n(
          e.value.update
        );
        return {
          tag: "SubscribeApplied",
          queryId: e.value.queryId.id,
          tableUpdates: a
        };
      }
      case "UnsubscribeMultiApplied": {
        const a = await n(
          e.value.update
        );
        return {
          tag: "UnsubscribeApplied",
          queryId: e.value.queryId.id,
          tableUpdates: a
        };
      }
      case "SubscriptionError":
        return {
          tag: "SubscriptionError",
          queryId: e.value.queryId,
          error: e.value.error
        };
      case "ProcedureResult": {
        const { status: a, requestId: u } = e.value;
        return {
          tag: "ProcedureResult",
          requestId: u,
          result: a.tag === "Returned" ? { tag: "Ok", value: a.value } : a.tag === "OutOfEnergy" ? {
            tag: "Err",
            value: "Procedure execution aborted due to insufficient energy"
          } : { tag: "Err", value: a.value }
        };
      }
    }
  }
  #d(e) {
    this.wsPromise.then((t) => {
      if (t) {
        const r = new G(1024);
        h.serializeValue(
          r,
          qe.algebraicType,
          e
        );
        const n = r.getBuffer();
        t.send(n);
      }
    });
  }
  /**
   * Handles WebSocket onOpen event.
   */
  #v() {
    this.isActive = !0;
  }
  #c(e, t) {
    const r = [];
    for (const n of e) {
      const a = n.tableName, u = this.#a.tables.find(
        (d) => d.name === a
      ), l = this.clientCache.getOrCreateTable(u).applyOperations(
        n.operations,
        t
      );
      for (const d of l)
        r.push(d);
    }
    return r;
  }
  async #I(e) {
    const t = h.deserializeValue(
      new J(e),
      Vn.algebraicType
    ), r = await this.#w(t);
    if (r)
      switch (r.tag) {
        case "InitialSubscription": {
          const n = { tag: "SubscribeApplied" }, a = this.#u(n), { event: u, ...o } = a, l = this.#c(
            r.tableUpdates,
            a
          );
          this.#t && this.#i?.(o);
          for (const d of l)
            d.cb();
          break;
        }
        case "TransactionUpdateLight": {
          const n = { tag: "UnknownTransaction" }, a = this.#u(n), u = this.#c(
            r.tableUpdates,
            a
          );
          for (const o of u)
            o.cb();
          break;
        }
        case "TransactionUpdate": {
          let n = r.reducerInfo;
          const a = n === void 0 ? void 0 : this.#a.reducers.find(
            (b) => b.name === n.reducerName
          );
          let u, o = a === void 0;
          if (a)
            try {
              const b = new J(n.args);
              u = Z.deserializeValue(
                b,
                a.paramsType
              );
            } catch {
              console.debug("Failed to deserialize reducer arguments"), o = !0;
            }
          if (o) {
            const b = { tag: "UnknownTransaction" }, m = this.#u(b), p = this.#c(
              r.tableUpdates,
              m
            );
            for (const w of p)
              w.cb();
            return;
          }
          n = n, u = u;
          const l = {
            callerIdentity: r.identity,
            status: r.status,
            callerConnectionId: r.connectionId,
            timestamp: r.timestamp,
            energyConsumed: r.energyConsumed,
            reducer: {
              name: n.reducerName,
              args: u
            }
          }, d = {
            tag: "Reducer",
            value: l
          }, f = this.#u(d), y = {
            ...f,
            event: l
          }, v = this.#c(
            r.tableUpdates,
            f
          );
          this.#n.emit(
            n.reducerName,
            y,
            u
          );
          for (const b of v)
            b.cb();
          break;
        }
        case "IdentityToken": {
          this.identity = r.identity, !this.token && r.token && (this.token = r.token), this.connectionId = r.connectionId, this.#t.emit("connect", this, this.identity, this.token);
          break;
        }
        case "SubscribeApplied": {
          const n = this.#s.subscriptions.get(
            r.queryId
          );
          if (n === void 0) {
            P(
              "error",
              `Received SubscribeApplied for unknown queryId ${r.queryId}.`
            );
            break;
          }
          const a = { tag: "SubscribeApplied" }, u = this.#u(a), { event: o, ...l } = u, d = this.#c(
            r.tableUpdates,
            u
          );
          n?.emitter.emit("applied", l);
          for (const f of d)
            f.cb();
          break;
        }
        case "UnsubscribeApplied": {
          const n = this.#s.subscriptions.get(
            r.queryId
          );
          if (n === void 0) {
            P(
              "error",
              `Received UnsubscribeApplied for unknown queryId ${r.queryId}.`
            );
            break;
          }
          const a = { tag: "UnsubscribeApplied" }, u = this.#u(a), { event: o, ...l } = u, d = this.#c(
            r.tableUpdates,
            u
          );
          n?.emitter.emit("end", l), this.#s.subscriptions.delete(r.queryId);
          for (const f of d)
            f.cb();
          break;
        }
        case "SubscriptionError": {
          const n = Error(r.error), a = { tag: "Error", value: n }, o = {
            ...this.#u(a),
            event: n
          };
          r.queryId !== void 0 ? (this.#s.subscriptions.get(r.queryId)?.emitter.emit("error", o, n), this.#s.subscriptions.delete(r.queryId)) : (console.error("Received an error message without a queryId: ", n), this.#s.subscriptions.forEach(({ emitter: l }) => {
            l.emit("error", o, n);
          }));
          break;
        }
        case "ProcedureResult": {
          const { requestId: n, result: a } = r, u = this.#h.get(n);
          this.#h.delete(n), u?.(a);
          break;
        }
      }
  }
  /**
   * Handles WebSocket onMessage event.
   * @param wsMessage MessageEvent object.
   */
  #_(e) {
    this.#l = this.#l.then(() => this.#I(e.data));
  }
  /**
   * Call a reducer on your SpacetimeDB module.
   *
   * @param reducerName The name of the reducer to call
   * @param argsSerializer The arguments to pass to the reducer
   */
  callReducer(e, t, r) {
    const n = qe.CallReducer({
      reducer: e,
      args: t,
      // The TypeScript SDK doesn't currently track `request_id`s,
      // so always use 0.
      requestId: 0,
      flags: Xn(r)
    });
    this.#d(n);
  }
  /**
   * Call a reducer on your SpacetimeDB module with typed arguments.
   * @param reducerSchema The schema of the reducer to call
   * @param callReducerFlags The flags for the reducer call
   * @param params The arguments to pass to the reducer
   */
  callReducerWithParams(e, t, r, n) {
    const a = new G(1024);
    Z.serializeValue(a, t, r);
    const u = a.getBuffer();
    this.callReducer(e, u, n);
  }
  /**
   * Call a reducer on your SpacetimeDB module.
   *
   * @param procedureName The name of the reducer to call
   * @param argsBuffer The arguments to pass to the reducer
   */
  callProcedure(e, t) {
    const { promise: r, resolve: n, reject: a } = Promise.withResolvers(), u = this.#p(), o = qe.CallProcedure({
      procedure: e,
      args: t,
      requestId: u,
      // reserved for future use - 0 is the only valid value
      flags: 0
    });
    return this.#d(o), this.#h.set(u, (l) => {
      l.tag === "Ok" ? n(l.value) : a(l.value);
    }), r;
  }
  /**
   * Call a reducer on your SpacetimeDB module with typed arguments.
   * @param reducerSchema The schema of the reducer to call
   * @param callReducerFlags The flags for the reducer call
   * @param params The arguments to pass to the reducer
   */
  callProcedureWithParams(e, t, r, n) {
    const a = new G(1024);
    Z.serializeValue(a, t, r);
    const u = a.getBuffer();
    return this.callProcedure(e, u).then((o) => h.deserializeValue(
      new J(o),
      n
    ));
  }
  /**
   * Close the current connection.
   *
   * @example
   *
   * ```ts
   * const connection = DbConnection.builder().build();
   * connection.disconnect()
   * ```
   */
  disconnect() {
    this.wsPromise.then((e) => {
      e && e.close();
    });
  }
  on(e, t) {
    this.#t.on(e, t);
  }
  off(e, t) {
    this.#t.off(e, t);
  }
  onConnect(e) {
    this.#t.on("connect", e);
  }
  onDisconnect(e) {
    this.#t.on("disconnect", e);
  }
  onConnectError(e) {
    this.#t.on("connectError", e);
  }
  removeOnConnect(e) {
    this.#t.off("connect", e);
  }
  removeOnDisconnect(e) {
    this.#t.off("disconnect", e);
  }
  removeOnConnectError(e) {
    this.#t.off("connectError", e);
  }
  // Note: This is required to be public because it needs to be
  // called from the `RemoteReducers` class.
  onReducer(e, t) {
    this.#n.on(e, t);
  }
  // Note: This is required to be public because it needs to be
  // called from the `RemoteReducers` class.
  offReducer(e, t) {
    this.#n.off(e, t);
  }
}, ei = s.enum("Lifecycle", {
  Init: s.unit(),
  OnConnect: s.unit(),
  OnDisconnect: s.unit()
}), yt = ei;
function Qe(e, t, r, n) {
  if (kt.has(e))
    throw new TypeError(`There is already a reducer with the name '${e}'`);
  kt.add(e), t instanceof k || (t = new k(t)), t.typeName === void 0 && (t.typeName = De(e));
  const a = C(t), u = sr(M.typespace, a).value;
  M.reducers.push({
    name: e,
    params: u,
    lifecycle: n
    // <- lifecycle flag lands here
  }), r.name || Object.defineProperty(r, "name", { value: e, writable: !1 });
}
var kt = /* @__PURE__ */ new Set();
function Pt(e, t, r) {
  Qe(e, t, r);
}
function ti(e, t, r) {
  Qe(e, t, r, yt.Init);
}
function ri(e, t, r) {
  Qe(e, t, r, yt.OnConnect);
}
function ni(e, t, r) {
  Qe(e, t, r, yt.OnDisconnect);
}
var ii = class {
  reducersType;
  constructor(e) {
    this.reducersType = si(e);
  }
};
function si(e) {
  return { reducers: e.map((n) => {
    const a = n.params.row;
    return {
      name: n.reducerName,
      // Prefer the schema's own accessorName if present at runtime; otherwise derive it.
      accessorName: n.accessorName,
      params: a,
      paramsType: n.paramsSpacetimeType
    };
  }) };
}
function ai(...e) {
  const t = e.length === 1 && Array.isArray(e[0]) ? e[0] : e;
  return new ii(t);
}
function S(e, t) {
  const r = {
    elements: Object.entries(t).map(([n, a]) => ({
      name: n,
      algebraicType: "typeBuilder" in a ? a.typeBuilder.algebraicType : a.algebraicType
    }))
  };
  return {
    reducerName: e,
    accessorName: ke(e),
    params: new k(t),
    paramsSpacetimeType: r,
    reducerDef: {
      name: e,
      params: r,
      lifecycle: void 0
    }
  };
}
function Ft(e, t, r, n, a) {
  const u = new k(r, De(e.name));
  let o = C(n).algebraicType;
  const { value: l } = sr(
    M.typespace,
    C(u)
  );
  if (M.miscExports.push({
    tag: "View",
    value: {
      name: e.name,
      index: (t ? Dt : Rt).length,
      isPublic: e.public,
      isAnonymous: t,
      params: l,
      returnType: o
    }
  }), o.tag == "Sum") {
    const d = a;
    a = ((f, y) => {
      const v = d(f, y);
      return v == null ? [] : [v];
    }), o = h.Array(
      o.value.variants[0].algebraicType
    );
  }
  (t ? Dt : Rt).push({
    fn: a,
    params: l,
    returnType: o,
    returnTypeBaseSize: Pe(M.typespace, o)
  });
}
var Rt = [], Dt = [];
function Vt(e, t, r, n) {
  const a = {
    elements: Object.entries(t).map(([o, l]) => ({
      name: o,
      algebraicType: C(
        "typeBuilder" in l ? l.typeBuilder : l
      ).algebraicType
    }))
  }, u = C(r).algebraicType;
  M.miscExports.push({
    tag: "Procedure",
    value: {
      name: e,
      params: a,
      returnType: u
    }
  }), ui.push({
    fn: n,
    paramsType: a,
    returnType: u,
    returnTypeBaseSize: Pe(M.typespace, u)
  });
}
var ui = [];
function oi(...e) {
  return { procedures: e.length === 1 && Array.isArray(e[0]) ? e[0] : e };
}
function ci(e) {
  return { tables: e.map(li) };
}
function li(e) {
  const t = (r) => e.rowType.algebraicType.value.elements[r].name;
  return {
    name: e.tableName,
    accessorName: ke(e.tableName),
    columns: e.rowType.row,
    // typed as T[i]['rowType']['row'] under TablesToSchema<T>
    rowType: e.rowSpacetimeType,
    constraints: e.tableDef.constraints.map((r) => ({
      name: r.name,
      constraint: "unique",
      columns: r.data.value.columns.map(t)
    })),
    // TODO: horrible horrible horrible. we smuggle this `Array<UntypedIndex>`
    // by casting it to an `Array<IndexOpts>` as `TableToSchema` expects.
    // This is then used in `TableCacheImpl.constructor` and who knows where else.
    // We should stop lying about our types.
    indexes: e.tableDef.indexes.map((r) => {
      const n = r.algorithm.tag === "Direct" ? [r.algorithm.value] : r.algorithm.value;
      return {
        name: r.accessorName,
        unique: e.tableDef.constraints.some(
          (a) => a.data.value.columns.every((u) => n.includes(u))
        ),
        algorithm: r.algorithm.tag.toLowerCase(),
        columns: n.map(t)
      };
    })
  };
}
var M = {
  typespace: { types: [] },
  tables: [],
  reducers: [],
  types: [],
  miscExports: [],
  rowLevelSecurity: []
}, Ot = /* @__PURE__ */ new Map();
function sr(e, t) {
  let r = t.algebraicType;
  for (; r.tag === "Ref"; )
    r = e.types[r.value];
  return r;
}
function C(e) {
  return e instanceof xe && !hi(e) || e instanceof ft || e instanceof k ? di(e) : e instanceof Le ? new Le(
    C(e.value)
  ) : e instanceof Xe ? new Xe(
    C(e.ok),
    C(e.err)
  ) : e instanceof Ge ? new Ge(
    C(e.element)
  ) : e;
}
function di(e) {
  const t = e.algebraicType, r = e.typeName;
  if (r === void 0)
    throw new Error(
      `Missing type name for ${e.constructor.name ?? "TypeBuilder"} ${JSON.stringify(e)}`
    );
  let n = Ot.get(t);
  if (n != null)
    return n;
  const a = e instanceof k || e instanceof xe ? {
    tag: "Product",
    value: { elements: [] }
  } : { tag: "Sum", value: { variants: [] } };
  if (n = new nn(M.typespace.types.length), M.typespace.types.push(a), Ot.set(t, n), e instanceof k)
    for (const [u, o] of Object.entries(e.row))
      a.value.elements.push({
        name: u,
        algebraicType: C(o.typeBuilder).algebraicType
      });
  else if (e instanceof xe)
    for (const [u, o] of Object.entries(e.elements))
      a.value.elements.push({
        name: u,
        algebraicType: C(o).algebraicType
      });
  else if (e instanceof ft)
    for (const [u, o] of Object.entries(e.variants))
      a.value.variants.push({
        name: u,
        algebraicType: C(o).algebraicType
      });
  return M.types.push({
    name: mi(r),
    ty: n.ref,
    customOrdering: !0
  }), n;
}
function hi(e) {
  return e.typeName == null && e.algebraicType.value.elements.length === 0;
}
function mi(e) {
  const t = e.split(".");
  return { name: t.pop(), scope: t };
}
var pi = class {
  tablesDef;
  typespace;
  schemaType;
  constructor(e, t, r) {
    this.tablesDef = { tables: e }, this.typespace = t, this.schemaType = ci(r);
  }
  reducer(e, t, r) {
    return typeof t == "function" ? (Pt(e, {}, t), t) : (Pt(e, t, r), r);
  }
  init(e, t) {
    const [r, n] = typeof e == "string" ? [e, t] : ["init", e];
    ti(r, {}, n);
  }
  clientConnected(e, t) {
    const [r, n] = typeof e == "string" ? [e, t] : ["on_connect", e];
    ri(r, {}, n);
  }
  clientDisconnected(e, t) {
    const [r, n] = typeof e == "string" ? [e, t] : ["on_disconnect", e];
    ni(r, {}, n);
  }
  view(e, t, r) {
    Ft(e, !1, {}, t, r);
  }
  // TODO: re-enable once parameterized views are supported in SQL
  // view<Ret extends ViewReturnTypeBuilder>(
  //   opts: ViewOpts,
  //   ret: Ret,
  //   fn: ViewFn<S, {}, Ret>
  // ): void;
  // view<Params extends ParamsObj, Ret extends ViewReturnTypeBuilder>(
  //   opts: ViewOpts,
  //   params: Params,
  //   ret: Ret,
  //   fn: ViewFn<S, {}, Ret>
  // ): void;
  // view<Params extends ParamsObj, Ret extends ViewReturnTypeBuilder>(
  //   opts: ViewOpts,
  //   paramsOrRet: Ret | Params,
  //   retOrFn: ViewFn<S, {}, Ret> | Ret,
  //   maybeFn?: ViewFn<S, Params, Ret>
  // ): void {
  //   if (typeof retOrFn === 'function') {
  //     defineView(name, false, {}, paramsOrRet as Ret, retOrFn);
  //   } else {
  //     defineView(name, false, paramsOrRet as Params, retOrFn, maybeFn!);
  //   }
  // }
  anonymousView(e, t, r) {
    Ft(e, !0, {}, t, r);
  }
  procedure(e, t, r, n) {
    return typeof r == "function" ? (Vt(e, {}, t, r), r) : (Vt(e, t, r, n), n);
  }
  clientVisibilityFilter = {
    sql(e) {
      M.rowLevelSecurity.push({ sql: e });
    }
  };
};
function fi(...e) {
  const t = e.length === 1 && Array.isArray(e[0]) ? e[0] : e, r = t.map((n) => n.tableDef);
  return M.tables.push(...r), t.map((n) => ({
    name: n.tableName,
    accessorName: n.tableName,
    columns: n.rowType.row,
    rowType: n.rowSpacetimeType,
    indexes: n.idxs,
    constraints: n.constraints
  })), new pi(r, M.typespace, t);
}
function ar(e) {
  return Object.fromEntries(
    e.map((t) => [t.accessorName, t])
  );
}
var yi = s.enum("RawIndexAlgorithm", {
  BTree: s.array(s.u16()),
  Hash: s.array(s.u16()),
  Direct: s.u16()
}), Nt = yi;
function ye(e, t, ...r) {
  const {
    name: n,
    public: a = !1,
    indexes: u = [],
    scheduled: o
  } = e, l = /* @__PURE__ */ new Map(), d = [];
  t instanceof k || (t = new k(t)), t.typeName === void 0 && (t.typeName = De(n));
  const f = C(t);
  t.algebraicType.value.elements.forEach((g, I) => {
    l.set(g.name, I), d.push(g.name);
  });
  const y = [], v = [], b = [], m = [];
  let p;
  for (const [g, I] of Object.entries(t.row)) {
    const T = I.columnMetadata;
    T.isPrimaryKey && y.push(l.get(g));
    const E = T.isUnique || T.isPrimaryKey;
    if (T.indexType || E) {
      const x = T.indexType ?? "btree", bt = l.get(g);
      let Je;
      switch (x) {
        case "btree":
          Je = Nt.BTree([bt]);
          break;
        case "direct":
          Je = Nt.Direct(bt);
          break;
      }
      v.push({
        name: void 0,
        // Unnamed indexes will be assigned a globally unique name
        accessorName: g,
        // The name of this column will be used as the accessor name
        algorithm: Je
      });
    }
    if (E && b.push({
      name: void 0,
      data: { tag: "Unique", value: { columns: [l.get(g)] } }
    }), T.isAutoIncrement && m.push({
      name: void 0,
      start: void 0,
      minValue: void 0,
      maxValue: void 0,
      column: l.get(g),
      increment: 1n
    }), o) {
      const x = I.typeBuilder.algebraicType;
      Wt.isScheduleAt(x) && (p = l.get(g));
    }
  }
  for (const g of u ?? []) {
    let I;
    switch (g.algorithm) {
      case "btree":
        I = {
          tag: "BTree",
          value: g.columns.map((T) => l.get(T))
        };
        break;
      case "direct":
        I = { tag: "Direct", value: l.get(g.column) };
        break;
    }
    v.push({ name: void 0, accessorName: g.name, algorithm: I });
  }
  for (const g of e.constraints ?? [])
    if (g.constraint === "unique") {
      const I = {
        tag: "Unique",
        value: { columns: g.columns.map((T) => l.get(T)) }
      };
      b.push({ name: g.name, data: I });
      continue;
    }
  for (const g of v) {
    const T = (g.algorithm.tag === "Direct" ? [g.algorithm.value] : g.algorithm.value).map((E) => d[E]).join("_");
    g.name = `${n}_${T}_idx_${g.algorithm.tag.toLowerCase()}`;
  }
  const w = {
    name: n,
    productTypeRef: f.ref,
    primaryKey: y,
    indexes: v,
    constraints: b,
    sequences: m,
    schedule: o && p !== void 0 ? {
      name: void 0,
      reducerName: o,
      scheduledAtColumn: p
    } : void 0,
    tableType: { tag: "User" },
    tableAccess: { tag: a ? "Public" : "Private" }
  }, U = t.algebraicType.value;
  return {
    rowType: t,
    tableName: n,
    rowSpacetimeType: U,
    tableDef: w,
    idxs: {},
    constraints: b
  };
}
const gi = {
  username: s.string(),
  password: s.string()
}, bi = {
  title: s.string(),
  body: s.string(),
  postDate: s.u64(),
  linkUrl: s.string(),
  category: s.string(),
  imageUrl: s.string()
}, wi = {
  username: s.string(),
  password: s.string()
}, vi = {
  slug: s.string(),
  title: s.string(),
  body: s.string()
}, Ii = {
  username: s.string()
}, _i = {
  postId: s.u64()
}, Bi = {
  username: s.string(),
  confirmPassword: s.string()
}, Ui = {
  slug: s.string()
}, Ti = {
  postId: s.u64(),
  title: s.string(),
  body: s.string(),
  postDate: s.u64(),
  linkUrl: s.string(),
  category: s.string(),
  imageUrl: s.string()
}, xi = {
  slug: s.string(),
  title: s.string(),
  body: s.string()
}, Si = {
  username: s.string(),
  password: s.string()
}, Ai = {}, Ci = {
  postId: s.u64(),
  moveUp: s.bool()
}, Mi = {
  slug: s.string(),
  earlier: s.bool()
}, qi = {
  postId: s.u64(),
  isArchived: s.bool()
}, Ei = s.row({
  username: s.string(),
  isAdmin: s.bool().name("is_admin"),
  createdAt: s.u64().name("created_at"),
  serialPosts: s.u32().name("serial_posts"),
  activeSessions: s.u32().name("active_sessions")
}), ki = s.row({
  username: s.string().primaryKey(),
  passwordHash: s.string().name("password_hash"),
  isAdmin: s.bool().name("is_admin"),
  createdAt: s.u64().name("created_at")
}), Pi = s.row({
  username: s.string(),
  isAdmin: s.bool().name("is_admin")
}), Fi = s.row({
  postId: s.u64().primaryKey().name("post_id"),
  title: s.string(),
  body: s.string(),
  postDate: s.u64().name("post_date"),
  linkUrl: s.string().name("link_url"),
  category: s.string(),
  imageUrl: s.string().name("image_url"),
  sortOrder: s.u64().name("sort_order"),
  isArchived: s.bool().name("is_archived"),
  createdBy: s.string().name("created_by"),
  createdAt: s.u64().name("created_at"),
  updatedAt: s.u64().name("updated_at")
}), Ri = s.row({
  slug: s.string().primaryKey(),
  title: s.string(),
  body: s.string(),
  createdBy: s.string().name("created_by"),
  publishedAt: s.u64().name("published_at"),
  sortOrder: s.u64().name("sort_order")
}), Di = s.row({
  identity: s.identity().primaryKey(),
  username: s.string()
});
s.object("Account", {
  username: s.string(),
  passwordHash: s.string(),
  isAdmin: s.bool(),
  createdAt: s.u64()
});
s.object("AccountSummary", {
  username: s.string(),
  isAdmin: s.bool(),
  createdAt: s.u64(),
  serialPosts: s.u32(),
  activeSessions: s.u32()
});
s.object("MyAccount", {
  username: s.string(),
  isAdmin: s.bool()
});
s.object("Post", {
  postId: s.u64(),
  title: s.string(),
  body: s.string(),
  postDate: s.u64(),
  linkUrl: s.string(),
  category: s.string(),
  imageUrl: s.string(),
  sortOrder: s.u64(),
  isArchived: s.bool(),
  createdBy: s.string(),
  createdAt: s.u64(),
  updatedAt: s.u64()
});
s.object("SerialPost", {
  slug: s.string(),
  title: s.string(),
  body: s.string(),
  createdBy: s.string(),
  publishedAt: s.u64(),
  sortOrder: s.u64()
});
s.object("Session", {
  identity: s.identity(),
  username: s.string()
});
const gt = fi(
  ye({
    name: "accounts",
    indexes: [
      { name: "is_admin", algorithm: "btree", columns: [
        "isAdmin"
      ] },
      { name: "username", algorithm: "btree", columns: [
        "username"
      ] }
    ],
    constraints: [
      { name: "accounts_username_key", constraint: "unique", columns: ["username"] }
    ]
  }, ki),
  ye({
    name: "posts",
    indexes: [
      { name: "post_id", algorithm: "btree", columns: [
        "postId"
      ] }
    ],
    constraints: [
      { name: "posts_post_id_key", constraint: "unique", columns: ["postId"] }
    ]
  }, Fi),
  ye({
    name: "serial_posts",
    indexes: [
      { name: "created_by", algorithm: "btree", columns: [
        "createdBy"
      ] },
      { name: "slug", algorithm: "btree", columns: [
        "slug"
      ] }
    ],
    constraints: [
      { name: "serial_posts_slug_key", constraint: "unique", columns: ["slug"] }
    ]
  }, Ri),
  ye({
    name: "sessions",
    indexes: [
      { name: "identity", algorithm: "btree", columns: [
        "identity"
      ] },
      { name: "username", algorithm: "btree", columns: [
        "username"
      ] }
    ],
    constraints: [
      { name: "sessions_identity_key", constraint: "unique", columns: ["identity"] }
    ]
  }, Di),
  ye({
    name: "account_audit",
    indexes: [],
    constraints: []
  }, Ei),
  ye({
    name: "my_account",
    indexes: [],
    constraints: []
  }, Pi)
), ur = ai(
  S("create_admin_account", gi),
  S("create_post", bi),
  S("create_publisher_account", wi),
  S("create_serial_post", vi),
  S("delete_admin_account", Ii),
  S("delete_post", _i),
  S("delete_publisher_account", Bi),
  S("delete_serial_post", Ui),
  S("edit_post", Ti),
  S("edit_serial_post", xi),
  S("login", Si),
  S("logout", Ai),
  S("move_post", Ci),
  S("move_serial_post", Mi),
  S("set_post_archived", qi)
), Vi = oi(), Oi = {
  versionInfo: {
    cliVersion: "1.12.0"
  },
  tables: gt.schemaType.tables,
  reducers: ur.reducersType.reducers,
  ...Vi
};
ar(gt.schemaType.tables);
Tr(gt.schemaType);
ar(ur.reducersType.reducers);
class Ni extends ir {
}
class Ki extends Jn {
}
const He = class He extends Yn {
  constructor() {
    super(...arguments), this.subscriptionBuilder = () => new Ni(this);
  }
};
He.builder = () => new Ki(Oi, (t) => new He(t));
let dt = He;
const ji = location.hostname === "localhost" || location.hostname === "127.0.0.1" ? "ws://localhost:3000" : "wss://grem.studio/spacetimedb/", $i = "site-feed", zi = 8, F = document.getElementById("whats-new-list");
function Li(e) {
  return new Date(Number(e / 1000n)).toLocaleDateString();
}
function Ke(e) {
  if (!F) return;
  const t = [...e.db.posts.iter()].filter((r) => !r.isArchived).sort(
    (r, n) => r.sortOrder === n.sortOrder ? r.postDate > n.postDate ? -1 : r.postDate < n.postDate ? 1 : 0 : r.sortOrder > n.sortOrder ? -1 : 1
  ).slice(0, zi);
  if (F.replaceChildren(), t.length === 0) {
    const r = document.createElement("li");
    r.textContent = "No updates yet — check back soon!", F.appendChild(r);
    return;
  }
  for (const r of t) {
    const n = document.createElement("li"), a = document.createElement("strong");
    a.textContent = `${Li(r.postDate)}: `, n.appendChild(a);
    const u = document.createElement("strong");
    if (u.textContent = r.title, n.appendChild(u), n.appendChild(document.createTextNode(` — ${r.body}`)), r.linkUrl) {
      n.appendChild(document.createTextNode(" "));
      const o = document.createElement("a");
      o.href = r.linkUrl, o.textContent = "Check it out", n.appendChild(o);
    }
    if (r.category && n.appendChild(document.createTextNode(` [${r.category}]`)), r.imageUrl) {
      const o = document.createElement("img");
      o.src = r.imageUrl, o.alt = r.title, o.style.display = "block", o.style.maxWidth = "100%", o.style.marginTop = "8px", n.appendChild(o);
    }
    F.appendChild(n);
  }
}
function Hi() {
  if (!F) return;
  F.replaceChildren();
  const e = document.createElement("li");
  e.textContent = "Loading latest updates...", F.appendChild(e);
}
F && dt.builder().withUri(ji).withModuleName($i).onConnect((e) => {
  e.subscriptionBuilder().onApplied(() => Ke(e)).subscribe("SELECT * FROM posts"), e.db.posts.onInsert(() => Ke(e)), e.db.posts.onUpdate(() => Ke(e)), e.db.posts.onDelete(() => Ke(e));
}).onConnectError((e, t) => {
  console.error("site-feed widget connection error:", t), Hi();
}).build();
