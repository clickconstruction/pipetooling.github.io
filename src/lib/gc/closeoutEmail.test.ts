/**
 * P5c-4's two closeout emails (closeoutEmail.ts): `accepted` and `finalIn`, keyed once per record, in both languages.
 * Since the owner's call 2 (`WAIVER_SIGN_LIVE`, v2.5178) each asks for the final pay application and the final release
 * in the portal. `closeoutEmail.off.test.ts` holds the lines that ask by email, should the flag go off again.
 */
import { describe, expect, it } from 'vitest'
import { acceptedEmail, finalInEmail } from './closeoutEmail'
import { WAIVER_SIGN_LIVE, type DrawEmailTo } from './drawEmail'
import type { Draw, Sow } from './types'

const to: DrawEmailTo = { companyId: 'c1', projectId: 'p1', project: 'Fair Oaks Clinic', trade: 'Concrete', lang: 'en' }
const sow = { id: 's1', status: 'signed', price: 48600, retainagePct: 10, basedOnRev: 0, sov: [], signedOn: '2026-09-01', draws: [], acceptedOn: '2026-10-07' } as Sow
const final: Draw = { id: 'd5', number: 5, requestedOn: '2026-10-09', gross: 0, retainage: -4860, net: 4860, status: 'requested', waiver: 'conditional', lines: [], final: true }

describe('the closeout’s emails, the waivers signed in the portal (P5c-4, the owner’s call 2)', () => {
  it('says we accepted the work, what we hold, to send the final pay application from the portal, and when we pay', () => {
    expect(WAIVER_SIGN_LIVE).toBe(true)
    expect(acceptedEmail(to, sow, 4860)).toEqual({
      companyId: 'c1',
      kind: 'accepted',
      key: 's1:accepted',
      projectId: 'p1',
      lang: 'en',
      subject: 'We accepted your Concrete work on Fair Oaks Clinic',
      lines: [
        'We accepted your Concrete work on Fair Oaks Clinic. Thank you.',
        'We hold $4,860 of your retainage. Your final pay application asks for it.',
        'Send your final pay application from your portal.',
        'We pay your retainage 10 days after the customer pays us.',
      ],
    })
  })

  it('says only thank you when nothing is held, and nothing before the work is accepted', () => {
    expect(acceptedEmail(to, sow, 0)?.lines).toEqual(['We accepted your Concrete work on Fair Oaks Clinic. Thank you.'])
    expect(acceptedEmail(to, { ...sow, acceptedOn: null }, 4860)).toBeNull()
  })

  it('says a final pay application came in, when we pay it, and to sign the final release in the portal after, keyed by the draw', () => {
    expect(finalInEmail(to, final)).toEqual({
      companyId: 'c1',
      kind: 'finalIn',
      key: 'd5:finalIn',
      projectId: 'p1',
      lang: 'en',
      subject: 'Your final pay application on Fair Oaks Clinic came in',
      lines: [
        'Your final pay application for $4,860 on Concrete for Fair Oaks Clinic came in.',
        'We pay your retainage 10 days after the customer pays us.',
        'Once we pay it, sign your unconditional final release of lien in your portal.',
      ],
    })
    expect(finalInEmail(to, { ...final, final: false })).toBeNull()
  })

  it('reads in Spanish for a company that chose it', () => {
    const es = { ...to, lang: 'es' as const }
    expect(acceptedEmail(es, sow, 4860)?.subject).toBe('Aceptamos su trabajo de Concrete en Fair Oaks Clinic')
    expect(acceptedEmail(es, sow, 4860)?.lines[2]).toBe('Envíe su solicitud de pago final desde su portal.')
    expect(finalInEmail(es, final)?.lines).toEqual([
      'Llegó su solicitud de pago final por $4,860 de Concrete para Fair Oaks Clinic.',
      'Pagamos su retención 10 días después de que el cliente nos pague.',
      'Cuando la paguemos, firme su liberación final de gravamen incondicional en su portal.',
    ])
  })
})
