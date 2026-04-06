/**
 * Reject IPs that should not be sent to a geo-IP provider (private, loopback, link-local, etc.).
 */

function ipv4Octets(s: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s.trim())
  if (!m) return null
  const parts = [m[1], m[2], m[3], m[4]].map((x) => parseInt(x, 10))
  if (parts.some((n) => n < 0 || n > 255)) return null
  return parts
}

/** First hextet of IPv6 (before first :) for prefix checks; lowercase, no brackets. */
function ipv6FirstHextetNorm(s: string): string | null {
  let t = s.trim().toLowerCase()
  if (t.startsWith('[') && t.endsWith(']')) t = t.slice(1, -1)
  if (!t.includes(':')) return null
  const first = t.split(':')[0]
  return first === '' && t.startsWith('::') ? '0' : first || null
}

export function isRoutablePublicIp(ip: string): { ok: true } | { ok: false; reason: string } {
  const s = ip.trim()
  if (!s) return { ok: false, reason: 'Missing IP' }

  const v4 = ipv4Octets(s)
  if (v4) {
    const [a, b] = v4
    if (a === 10) return { ok: false, reason: 'Private or non-routable IP' }
    if (a === 172 && b >= 16 && b <= 31) return { ok: false, reason: 'Private or non-routable IP' }
    if (a === 192 && b === 168) return { ok: false, reason: 'Private or non-routable IP' }
    if (a === 127) return { ok: false, reason: 'Private or non-routable IP' }
    if (a === 169 && b === 254) return { ok: false, reason: 'Private or non-routable IP' }
    if (a === 0) return { ok: false, reason: 'Private or non-routable IP' }
    if (a === 100 && b >= 64 && b <= 127) return { ok: false, reason: 'Private or non-routable IP' }
    return { ok: true }
  }

  if (!s.includes(':')) {
    return { ok: false, reason: 'Invalid IP address' }
  }

  const low = s.toLowerCase()
  if (low === '::1' || low === '[::1]') return { ok: false, reason: 'Private or non-routable IP' }

  const fh = ipv6FirstHextetNorm(s)
  if (fh) {
    if (fh.startsWith('fe80')) return { ok: false, reason: 'Private or non-routable IP' }
    if (fh.startsWith('fc') || fh.startsWith('fd')) return { ok: false, reason: 'Private or non-routable IP' }
  }

  return { ok: true }
}
