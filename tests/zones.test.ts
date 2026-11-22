import { it, expect, vi } from 'vitest'
import sharp from 'sharp'
import { cellulesDepuisTuile, zones } from '../admin/zones'

// Tuile GBIF EPSG:4326 au niveau 0 : 512×512 px couvrant 180° × 180° (x=0 : ouest, x=1 : est).
function tuile(points: [number, number][]) {
  const rgba = new Uint8Array(512 * 512 * 4)
  for (const [px, py] of points) rgba[(py * 512 + px) * 4 + 3] = 255
  return rgba
}

it('regroupe les pixels en cases de 2° et ignore une case à un seul pixel', () => {
  // Tuile est : px 0 → lon 0°, py 0 → lat 90°. ~2,84 px par degré.
  const cases = cellulesDepuisTuile(tuile([[287, 216], [288, 217], [10, 10]]), 1)
  // (287, 216) et (288, 217) → lon ≈ 101,1°, lat ≈ 13,9° → case [12, 100] ; (10, 10) est isolé.
  expect(cases).toEqual([[12, 100]])
})

it('tuile ouest : longitudes négatives', () => {
  expect(cellulesDepuisTuile(tuile([[100, 216], [101, 216]]), 0)).toEqual([[12, -146]])
})

it('tuile vide → aucune case', () => {
  expect(cellulesDepuisTuile(tuile([]), 0)).toEqual([])
})

it('un hémisphère sans observation (GBIF répond 204) n’empêche pas l’autre', async () => {
  const png = await sharp(Buffer.from(tuile([[287, 216], [288, 217]])), { raw: { width: 512, height: 512, channels: 4 } }).png().toBuffer()
  vi.stubGlobal('fetch', vi.fn(async (url: string) =>
    url.includes('/0/0/0') ? { ok: true, status: 204, arrayBuffer: async () => new ArrayBuffer(0) }
      : { ok: true, status: 200, arrayBuffer: async () => png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) }))
  expect(await zones(1)).toEqual([[12, 100]])
  vi.unstubAllGlobals()
})
