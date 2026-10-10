/** P5c-4's closeout emails should the owner turn the waivers off again (`WAIVER_SIGN_LIVE` false): each asks by email. */
import { describe, expect, it, vi } from 'vitest'

vi.mock('./drawEmail', async (original) => ({ ...(await original<typeof import('./drawEmail')>()), WAIVER_SIGN_LIVE: false }))

import { acceptedEmail, finalInEmail } from './closeoutEmail'
import type { Draw, Sow } from './types'

const to = { companyId: 'c1', projectId: 'p1', project: 'Fair Oaks Clinic', trade: 'Concrete', lang: 'en' as const }

describe('the closeout’s emails with the waivers off (P5c-4)', () => {
  it('asks for the final pay application, and the final release, by email', () => {
    const sow = { id: 's1', acceptedOn: '2026-10-07' } as Sow
    expect(acceptedEmail(to, sow, 4860)?.lines[2]).toBe('For now, email your final pay application to Click.')
    const final = { id: 'd5', net: 4860, final: true } as Draw
    expect(finalInEmail(to, final)?.lines[2]).toBe('Once we pay it, send us your unconditional final release of lien.')
  })
})
