/**
 * P5c-4's two closeout emails (closeoutEmail.ts): `accepted` and `finalIn`, keyed once per record, in both languages,
 * and while `WAIVER_SIGN_LIVE` holds the waivers, each says to email what the portal cannot take yet.
 * `closeoutEmail.live.test.ts` holds the lines once it is on.
 */
import { describe, expect, it } from 'vitest'
import { acceptedEmail, finalInEmail } from './closeoutEmail'
import { WAIVER_SIGN_LIVE, type DrawEmailTo } from './drawEmail'
import type { Draw, Sow } from './types'

const to: DrawEmailTo = { companyId: 'c1', projectId: 'p1', project: 'Fair Oaks Clinic', trade: 'Concrete', lang: 'en' }
const sow = { id: 's1', status: 'signed', price: 48600, retainagePct: 10, basedOnRev: 0, sov: [], signedOn: '2026-09-01', draws: [], acceptedOn: '2026-10-07' } as Sow
const final: Draw = { id: 'd5', number: 5, requestedOn: '2026-10-09', gross: 0, retainage: -4860, net: 4860, status: 'requested', waiver: 'conditional', lines: [], final: true }

describe('the closeout’s emails while the owner’s call holds the waivers (P5c-4)', () => {
  it('says we accepted the work, what we hold, to email the final pay application for now, and when we pay', () => {
    expect(WAIVER_SIGN_LIVE).toBe(false)
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
        'For now, email your final pay application to Click.',
        'We pay your retainage 10 days after the customer pays us.',
      ],
    })
  })

  it('says only thank you when nothing is held, and nothing before the work is accepted', () => {
    expect(acceptedEmail(to, sow, 0)?.lines).toEqual(['We accepted your Concrete work on Fair Oaks Clinic. Thank you.'])
    expect(acceptedEmail(to, { ...sow, acceptedOn: null }, 4860)).toBeNull()
  })

  it('says a final pay application came in, when we pay it, and to send the final release after, keyed by the draw', () => {
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
        'Once we pay it, send us your unconditional final release of lien.',
      ],
    })
    expect(finalInEmail(to, { ...final, final: false })).toBeNull()
  })

  it('reads in Spanish for a company that chose it', () => {
    const es = { ...to, lang: 'es' as const }
    expect(acceptedEmail(es, sow, 4860)?.subject).toBe('Aceptamos su trabajo de Concrete en Fair Oaks Clinic')
    expect(acceptedEmail(es, sow, 4860)?.lines[2]).toBe('Por ahora, envíe su solicitud de pago final a Click por correo.')
    expect(finalInEmail(es, final)?.lines).toEqual([
      'Llegó su solicitud de pago final por $4,860 de Concrete para Fair Oaks Clinic.',
      'Pagamos su retención 10 días después de que el cliente nos pague.',
      'Cuando la paguemos, envíenos su liberación final de gravamen incondicional.',
    ])
  })
})
