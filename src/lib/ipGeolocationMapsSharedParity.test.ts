import { describe, expect, it } from 'vitest'
import { isRoutablePublicIp as clientGate } from './ipGeolocationMaps'
// Deno edge copy (supabase/functions/_shared) — must behave identically.
import { isRoutablePublicIp as edgeGate } from '../../supabase/functions/_shared/ipGeoValidation'

// Guards against drift between the client routable-IP gate (hides the map pin)
// and the edge gate in resolve-ip-geolocation (refuses the provider call). The
// client returns a boolean, the edge a { ok } result; the verdict must match
// for every address. If this fails, the two implementations diverged — reconcile them.

const ADDRESSES = [
  '8.8.8.8',
  ' 203.0.113.9 ',
  '10.1.2.3',
  '10.255.255.255',
  '172.15.255.255',
  '172.16.0.1',
  '172.31.255.255',
  '172.32.0.1',
  '192.168.1.1',
  '192.167.1.1',
  '127.0.0.1',
  '169.254.1.1',
  '169.253.1.1',
  '0.0.0.0',
  '0.1.2.3',
  '100.63.255.255',
  '100.64.0.1',
  '100.127.255.255',
  '100.128.0.1',
  '256.1.1.1',
  '1.2.3',
  '1.2.3.4.5',
  '',
  '   ',
  'not an ip',
  '::1',
  '[::1]',
  '::',
  'fe80::1',
  'FE80::1',
  '[fe80::1]',
  'FD00::1',
  'fc00::1',
  'fe00::1',
  '2001:db8::1',
  '[2001:db8::1]',
  '::ffff:8.8.8.8',
  '::ffff:10.0.0.1',
]

describe('ipGeolocationMaps ↔ _shared/ipGeoValidation parity', () => {
  it('the client gate and the edge gate give the same verdict for every address', () => {
    for (const ip of ADDRESSES) {
      expect(clientGate(ip), ip).toBe(edgeGate(ip).ok)
    }
  })

  it('the edge gate names its refusals', () => {
    expect(edgeGate('')).toEqual({ ok: false, reason: 'Missing IP' })
    expect(edgeGate('not an ip')).toEqual({ ok: false, reason: 'Invalid IP address' })
    expect(edgeGate('10.0.0.1')).toEqual({ ok: false, reason: 'Private or non-routable IP' })
    expect(edgeGate('fe80::1')).toEqual({ ok: false, reason: 'Private or non-routable IP' })
    expect(edgeGate('8.8.8.8')).toEqual({ ok: true })
  })
})
