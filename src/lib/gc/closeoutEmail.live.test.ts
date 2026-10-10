/** P5c-4's closeout emails once the owner turns the waivers on (`WAIVER_SIGN_LIVE`): each points at the portal. */
import { describe, expect, it, vi } from 'vitest'

vi.mock('./drawEmail', async (original) => ({ ...(await original<typeof import('./drawEmail')>()), WAIVER_SIGN_LIVE: true }))

import { acceptedEmail, finalInEmail } from './closeoutEmail'
import type { Draw, Sow } from './types'

const to = { companyId: 'c1', projectId: 'p1', project: 'Fair Oaks Clinic', trade: 'Concrete', lang: 'en' as const }

describe('the closeout’s emails once the waivers are on (P5c-4)', () => {
  it('asks for the final pay application, and the final release, in the portal', () => {
    const sow = { id: 's1', acceptedOn: '2026-10-07' } as Sow
    expect(acceptedEmail(to, sow, 4860)?.lines[2]).toBe('Send your final pay application from your portal.')
    const final = { id: 'd5', net: 4860, final: true } as Draw
    expect(finalInEmail(to, final)?.lines[2]).toBe('Once we pay it, sign your unconditional final release of lien in your portal.')
  })
})
