/**
 * Draws the TizoMD mark (a rounded navy square with a white "M" on a brand
 * glow) and emits every icon the build needs:
 *   - build/iconsrc/icon-{16,24,32,48,64,128,256}.png  (electron-builder icons)
 *   - build/icon.ico                                   (Windows, PNG-in-ICO)
 * Pure Node — no canvas, no sharp. Run: `npm run icon` (or `node scripts/build-icon.mjs`).
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const ICONS = join(ROOT, 'build', 'iconsrc')
const ICO = join(ROOT, 'build', 'icon.ico')
const SIZES = [16, 24, 32, 48, 64, 128, 256]

// ---- tiny PNG writer --------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePNG(width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc(height * (width * 4 + 1))
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// ---- drawing ----------------------------------------------------------------
// Normalized palette: navy gradient bg, purple bottom-right glow, white M.
const BG_TOP = [0x28, 0x2d, 0x4e]
const BG_BOTTOM = [0x12, 0x16, 0x26]
const GLOW = [0xa1, 0x3f, 0xd0, 0.5]
const GLYPH = [0xf4, 0xf6, 0xff]

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(px - ax, py - ay)
  let t = ((px - ax) * dx + (py - ay) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function drawIcon(size) {
  const buf = Buffer.alloc(size * size * 4)
  const cx = size * 0.72
  const cy = size * 0.62
  const glowR = size * 0.95
  const radius = size * 0.22
  const segs = [
    [0.20, 0.30, 0.20, 0.70],
    [0.80, 0.30, 0.80, 0.70],
    [0.20, 0.30, 0.50, 0.66],
    [0.50, 0.66, 0.80, 0.30]
  ]
  const thick = size * 0.088
  const aa = Math.max(0.75, size * 0.02)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const o = (y * size + x) * 4
      const fx = x + 0.5
      const fy = y + 0.5

      // rounded-rect coverage
      const nearX = Math.max(radius - fx, 0, fx - (size - radius))
      const nearY = Math.max(radius - fy, 0, fy - (size - radius))
      const rectD = Math.hypot(nearX, nearY)
      const rectCov = Math.max(0, Math.min(1, (radius - rectD) / aa + 0.5))
      if (rectCov <= 0) continue

      // vertical navy gradient
      const t = fy / size
      let r = BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t
      let g = BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t
      let b = BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t

      // purple glow toward bottom-right
      const gd = Math.hypot(fx - cx, fy - cy) / glowR
      const glowF = Math.max(0, 1 - gd) * GLOW[3]
      r += (GLOW[0] - r) * glowF
      g += (GLOW[1] - g) * glowF
      b += (GLOW[2] - b) * glowF

      // white M glyph with crisp edges
      let mD = Infinity
      for (const [ax, ay, bx, by] of segs) {
        const d = distToSegment(fx, fy, ax * size, ay * size, bx * size, by * size)
        if (d < mD) mD = d
      }
      const mCov = Math.max(0, Math.min(1, (thick / 2 - mD) / aa + 0.5))
      r += (GLYPH[0] - r) * mCov
      g += (GLYPH[1] - g) * mCov
      b += (GLYPH[2] - b) * mCov

      buf[o] = Math.round(r)
      buf[o + 1] = Math.round(g)
      buf[o + 2] = Math.round(b)
      buf[o + 3] = Math.round(rectCov * 255)
    }
  }
  return buf
}

function buildIco(pngs) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(pngs.length, 4)
  const entries = []
  const bodies = []
  let offset = 6 + 16 * pngs.length
  for (const { size, png } of pngs) {
    const e = Buffer.alloc(16)
    e[0] = size >= 256 ? 0 : size
    e[1] = size >= 256 ? 0 : size
    e[2] = 0
    e[3] = 0
    e.writeUInt16LE(1, 4)
    e.writeUInt16LE(32, 6)
    e.writeUInt32LE(png.length, 8)
    e.writeUInt32LE(offset, 12)
    entries.push(e)
    bodies.push(png)
    offset += png.length
  }
  return Buffer.concat([header, ...entries, ...bodies])
}

mkdirSync(ICONS, { recursive: true })
const pngs = SIZES.map((size) => {
  const png = encodePNG(size, size, drawIcon(size))
  writeFileSync(join(ICONS, `icon-${size}.png`), png)
  console.log(`  wrote icon-${size}.png (${png.length} bytes)`)
  return { size, png }
})
writeFileSync(ICO, buildIco(pngs))
console.log(`  wrote icon.ico (${SIZES.length} sizes)`)
console.log(`\nicons in ${ICONS}, ${ICO}`)