import { supabase } from '@/lib/supabase'

type MetaErrorJson = {
  error?: string
  detail?: string
}

type MetaBodyJson = MetaErrorJson & {
  ok?: boolean
  googleStatus?: string
  lat?: number
  lng?: number
}

function baseUrl(): string {
  const u = import.meta.env.VITE_SUPABASE_URL as string | undefined
  if (!u) throw new Error('Missing VITE_SUPABASE_URL')
  return u.replace(/\/$/, '')
}

function anonKey(): string {
  const k = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (!k) throw new Error('Missing VITE_SUPABASE_ANON_KEY')
  return k
}

async function accessToken(): Promise<string> {
  const { data: sess } = await supabase.auth.getSession()
  const jwt = sess.session?.access_token
  if (!jwt) throw new Error('Not signed in')
  return jwt
}

/**
 * Street View metadata via Edge Function (GOOGLE_MAPS_API_KEY server-side).
 * Returns null when Google reports no imagery (e.g. ZERO_RESULTS) or key/config issues surfaced as ok:false.
 * Throws on transport/auth/server errors.
 */
export async function fetchStreetViewMeta(location: string): Promise<{ lat: number; lng: number } | null> {
  const trimmed = location.trim()
  if (!trimmed) {
    throw new Error('Missing location')
  }

  const jwt = await accessToken()
  const url = `${baseUrl()}/functions/v1/street-view-preview?location=${encodeURIComponent(trimmed)}&meta=1`

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${jwt}`,
      apikey: anonKey(),
    },
  })

  const json = (await res.json()) as MetaBodyJson
  if (!res.ok) {
    const msg =
      typeof json.error === 'string' ? json.error : 'Street View metadata request failed'
    throw new Error(msg)
  }
  if (json.ok === true && typeof json.lat === 'number' && typeof json.lng === 'number') {
    return { lat: json.lat, lng: json.lng }
  }
  return null
}

/**
 * Proxied Street View static image blob.
 */
export async function fetchStreetViewImageBlob(location: string): Promise<Blob> {
  const trimmed = location.trim()
  if (!trimmed) {
    throw new Error('Missing location')
  }

  const jwt = await accessToken()
  const url = `${baseUrl()}/functions/v1/street-view-preview?location=${encodeURIComponent(trimmed)}`

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${jwt}`,
      apikey: anonKey(),
    },
  })

  if (!res.ok) {
    let msg = 'Street View image request failed'
    try {
      const j = (await res.json()) as MetaErrorJson
      if (typeof j.error === 'string') msg = j.error
    } catch {
      /* use default */
    }
    throw new Error(msg)
  }

  const ct = res.headers.get('Content-Type') ?? ''
  if (!ct.startsWith('image/')) {
    throw new Error('Unexpected Street View image response')
  }

  return res.blob()
}

export function googleStreetViewPanoUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${encodeURIComponent(String(lat))},${encodeURIComponent(String(lng))}`
}
