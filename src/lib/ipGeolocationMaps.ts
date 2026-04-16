import type { SupabaseClient } from '@supabase/supabase-js'

const CACHE_PREFIX = 'ipgeo:v1:'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

type CacheEntry = { lat: number; lng: number; exp: number }

function ipv4Octets(s: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s.trim())
  if (!m || m[1] == null || m[2] == null || m[3] == null || m[4] == null) return null
  const parts = [m[1], m[2], m[3], m[4]].map((x) => parseInt(x, 10))
  if (parts.some((n) => n < 0 || n > 255)) return null
  return parts
}

function ipv6FirstHextetNorm(s: string): string | null {
  let t = s.trim().toLowerCase()
  if (t.startsWith('[') && t.endsWith(']')) t = t.slice(1, -1)
  if (!t.includes(':')) return null
  const first = t.split(':')[0]
  return first === '' && t.startsWith('::') ? '0' : first || null
}

/** Matches Edge `_shared/ipGeoValidation.ts` — hide Map for unroutable IPs. */
export function isRoutablePublicIp(ip: string): boolean {
  const s = ip.trim()
  if (!s) return false

  const v4 = ipv4Octets(s)
  if (v4) {
    const a = v4[0]
    const b = v4[1]
    if (a === undefined || b === undefined) return false
    if (a === 10) return false
    if (a === 172 && b >= 16 && b <= 31) return false
    if (a === 192 && b === 168) return false
    if (a === 127) return false
    if (a === 169 && b === 254) return false
    if (a === 0) return false
    if (a === 100 && b >= 64 && b <= 127) return false
    return true
  }

  if (!s.includes(':')) return false

  const low = s.toLowerCase()
  if (low === '::1' || low === '[::1]') return false

  const fh = ipv6FirstHextetNorm(s)
  if (fh) {
    if (fh.startsWith('fe80')) return false
    if (fh.startsWith('fc') || fh.startsWith('fd')) return false
  }

  return true
}

export function googleMapsUrlForLatLng(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`
}

function readCache(ip: string): { lat: number; lng: number } | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + ip)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry
    if (
      typeof entry.lat !== 'number' ||
      typeof entry.lng !== 'number' ||
      typeof entry.exp !== 'number' ||
      Date.now() > entry.exp
    ) {
      sessionStorage.removeItem(CACHE_PREFIX + ip)
      return null
    }
    return { lat: entry.lat, lng: entry.lng }
  } catch {
    return null
  }
}

function writeCache(ip: string, lat: number, lng: number): void {
  try {
    const entry: CacheEntry = { lat, lng, exp: Date.now() + CACHE_TTL_MS }
    sessionStorage.setItem(CACHE_PREFIX + ip, JSON.stringify(entry))
  } catch {
    /* ignore */
  }
}

type ResolveResponse = { lat: number; lng: number; label?: string | null; error?: string }

async function fetchResolveIpGeolocationAuthorized(
  supabase: SupabaseClient,
  query: string,
): Promise<{ lat: number; lng: number }> {
  const { data: sess } = await supabase.auth.getSession()
  const jwt = sess.session?.access_token
  if (!jwt) {
    throw new Error('Not signed in')
  }

  const baseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  const url = `${baseUrl}/functions/v1/resolve-ip-geolocation${query}`

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${jwt}`,
      apikey: anon,
    },
  })

  const json = (await res.json()) as ResolveResponse
  if (!res.ok) {
    throw new Error(typeof json.error === 'string' ? json.error : 'Could not resolve IP location')
  }
  if (typeof json.lat !== 'number' || typeof json.lng !== 'number') {
    throw new Error('Invalid response from geolocation service')
  }

  return { lat: json.lat, lng: json.lng }
}

/**
 * Geo-IP for the signed-in caller (omit `ip` on Edge). No sessionStorage cache — avoids stale coords when the network changes.
 * Used when device GPS is unavailable during clock in/out.
 */
export async function fetchCallerIpGeoForMaps(supabase: SupabaseClient): Promise<{ lat: number; lng: number }> {
  return fetchResolveIpGeolocationAuthorized(supabase, '')
}

export async function fetchIpGeoForMaps(
  supabase: SupabaseClient,
  ip: string,
): Promise<{ lat: number; lng: number }> {
  const trimmed = ip.trim()
  if (!trimmed) {
    throw new Error('Missing IP')
  }

  const cached = readCache(trimmed)
  if (cached) return cached

  const { lat, lng } = await fetchResolveIpGeolocationAuthorized(
    supabase,
    `?ip=${encodeURIComponent(trimmed)}`,
  )

  writeCache(trimmed, lat, lng)
  return { lat, lng }
}
