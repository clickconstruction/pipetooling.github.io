/**
 * Research (punch list #292): San Antonio's permit feed gives most rows a longitude and
 * latitude, and the rest a point in Texas State Plane South Central feet (EPSG:2278, a
 * Lambert conformal conic on NAD83). This turns either into a longitude and latitude the
 * map can draw, or null when the pair is not a point at all. Pure: no I/O, shared with the
 * pull function through the edge kernels.
 */

export type LatLng = { lat: number; lng: number }

/** Texas South Central (EPSG:2278): the two standard parallels, the origin and the false offsets, in US survey feet. */
const PHI1 = toRad(28 + 23 / 60)
const PHI2 = toRad(30 + 17 / 60)
const PHI0 = toRad(27 + 50 / 60)
const LAMBDA0 = toRad(-99)
const FALSE_EASTING_FT = 1_968_500
const FALSE_NORTHING_FT = 13_123_333.333
/** GRS80 ellipsoid, as NAD83 uses it. */
const A_M = 6_378_137
const E2 = 0.006_694_380_022_9
const E = Math.sqrt(E2)
/** One US survey foot in metres. */
const FT_US = 1200 / 3937

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}
function toDeg(rad: number): number {
  return (rad * 180) / Math.PI
}
function mOf(phi: number): number {
  return Math.cos(phi) / Math.sqrt(1 - E2 * Math.sin(phi) ** 2)
}
function tOf(phi: number): number {
  const s = Math.sin(phi)
  return Math.tan(Math.PI / 4 - phi / 2) / ((1 - E * s) / (1 + E * s)) ** (E / 2)
}

const M1 = mOf(PHI1)
const M2 = mOf(PHI2)
const T0 = tOf(PHI0)
const T1 = tOf(PHI1)
const T2 = tOf(PHI2)
const N = (Math.log(M1) - Math.log(M2)) / (Math.log(T1) - Math.log(T2))
const F = M1 / (N * T1 ** N)
const RHO0 = A_M * F * T0 ** N

/** Longitude and latitude from a point in Texas South Central feet; null when the maths does not converge. */
export function fromTexasSouthCentralFeet(xFt: number, yFt: number): LatLng | null {
  if (!Number.isFinite(xFt) || !Number.isFinite(yFt)) return null
  const x = (xFt - FALSE_EASTING_FT) * FT_US
  const y = (yFt - FALSE_NORTHING_FT) * FT_US
  const rho = Math.sign(N) * Math.sqrt(x ** 2 + (RHO0 - y) ** 2)
  if (rho === 0) return null
  const theta = Math.atan2(x, RHO0 - y)
  const t = (rho / (A_M * F)) ** (1 / N)
  let phi = Math.PI / 2 - 2 * Math.atan(t)
  for (let i = 0; i < 12; i++) {
    const s = Math.sin(phi)
    const next = Math.PI / 2 - 2 * Math.atan(t * ((1 - E * s) / (1 + E * s)) ** (E / 2))
    if (Math.abs(next - phi) < 1e-12) {
      phi = next
      break
    }
    phi = next
  }
  const lambda = theta / N + LAMBDA0
  const out = { lat: toDeg(phi), lng: toDeg(lambda) }
  return Number.isFinite(out.lat) && Number.isFinite(out.lng) ? out : null
}

/** Rough box around the feed's cities: a point outside it is a bad row, not a place to pin. */
const TEXAS_BOX = { latMin: 25.5, latMax: 36.7, lngMin: -107, lngMax: -93.4 }

function inTexas(p: LatLng): boolean {
  return p.lat >= TEXAS_BOX.latMin && p.lat <= TEXAS_BOX.latMax && p.lng >= TEXAS_BOX.lngMin && p.lng <= TEXAS_BOX.lngMax
}

/**
 * The feed's X_COORD / Y_COORD as a point: longitude and latitude when the pair already is one,
 * else State Plane feet converted, else null. Strings and numbers both come in from the feed.
 */
export function pointFromFeedCoords(x: string | number | null | undefined, y: string | number | null | undefined): LatLng | null {
  const xn = typeof x === 'number' ? x : Number(String(x ?? '').trim())
  const yn = typeof y === 'number' ? y : Number(String(y ?? '').trim())
  if (!Number.isFinite(xn) || !Number.isFinite(yn) || (xn === 0 && yn === 0)) return null
  if (Math.abs(xn) <= 180 && Math.abs(yn) <= 90) {
    const p = { lat: yn, lng: xn }
    return inTexas(p) ? p : null
  }
  const p = fromTexasSouthCentralFeet(xn, yn)
  return p && inTexas(p) ? p : null
}
