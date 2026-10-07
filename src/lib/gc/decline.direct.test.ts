/**
 * Main's own tests for why a company is out of an ask (the owner, 2026-10-04; the Board's B2-i): the
 * quick picks' words, the log line, the chip and its hover, and a company's record of the asks it
 * passed on, run through the kernels on the test data. The spike's own case: Comal Iron is out of
 * Boerne Retail Shell's structural steel.
 */
import { describe, expect, it } from 'vitest'
import { DECLINE_REASONS, declineLogWords, declineReasonLabel, declinedTitle, declinedWords, partnerDeclines } from './decline'
import { initialGcState } from './schedule/testState'
import type { GcState, Invite } from './types'

const steel = (s: GcState) => s.projects.find((p) => p.id === 'boerne')!.packages.find((k) => k.id === 'steel')!

describe('why a company is out', () => {
  it('has six quick picks, each in plain words', () => {
    expect(DECLINE_REASONS.map((r) => r.key)).toEqual(['busy', 'far', 'size', 'scope', 'terms', 'other'])
    expect([declineReasonLabel('far'), declineLogWords('size', ''), declineLogWords('other', 'our retainage')]).toEqual(['too far', 'too big or too small', '"our retainage"'])
  })

  it('a decline taken by phone with a reason reads on the chip and its hover; one without reads passed', () => {
    const s = initialGcState()
    const comal = steel(s).invites.find((i) => i.partnerId === 'comal')!
    expect([declinedWords(comal), declinedTitle(comal)]).toEqual(['passed', undefined])
    const why: Invite = { ...comal, declinedWhy: 'wont', declineReason: { reason: 'busy', note: 'two jobs in Kerrville', on: '2026-09-29' } }
    expect([declinedWords(why), declinedTitle(why)]).toEqual(['will not do it · too busy', 'too busy: two jobs in Kerrville. Written down Sep 29.'])
  })

  it('a company keeps the asks it passed on with a reason', () => {
    const s = initialGcState()
    expect(partnerDeclines(s, 'comal')).toEqual([])
    const withWhy: GcState = {
      ...s,
      projects: s.projects.map((p) =>
        p.id === 'boerne'
          ? { ...p, packages: p.packages.map((k) => (k.id === 'steel' ? { ...k, invites: k.invites.map((i) => (i.partnerId === 'comal' ? { ...i, declinedWhy: 'cant' as const, declineReason: { reason: 'far' as const, note: '', on: '2026-09-29' } } : i)) } : k)) }
          : p,
      ),
    }
    expect(partnerDeclines(withWhy, 'comal').map((d) => [d.project.id, d.pkg.id, d.invite.id])).toEqual([['boerne', 'steel', 'steel-comal']])
  })
})
