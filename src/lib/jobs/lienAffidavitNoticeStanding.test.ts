import { describe, expect, it } from 'vitest'
import type { LienDeskPile } from './lienDesk'
import { lienAffidavitNoticePile, lienAffidavitNoticeStanding, lienAffidavitNoticeStandingOnDesk, lienAffidavitNoticeWaits, lienAffidavitNoticeWords, type LienAffidavitNoticeStanding, type LienAffidavitNoticeWaiting } from './lienAffidavitNoticeStanding'

const gates = (noticeOk: boolean) => [
  { key: 'owner' as const, ok: true },
  { key: 'notice' as const, ok: noticeOk },
]
const sub = (noticeOk: boolean) => ({ isSub: true, gates: gates(noticeOk) })
const at = (pile: LienDeskPile, dueMonths: string[] = ['2026-09']) => ({ pile, dueMonths })

describe('lienAffidavitNoticeStanding', () => {
  it('a job contracted with the owner needs no notice, whatever stands on the desk', () => {
    expect(lienAffidavitNoticeStanding({ isSub: false, gates: gates(false) }, at('ready'))).toBe('not_needed')
  })
  it('a mailing on record opens the gate, whatever the newest notice is doing', () => {
    expect(lienAffidavitNoticeStanding(sub(true), at('ready'))).toBe('on_record')
    expect(lienAffidavitNoticeStanding(sub(true), null)).toBe('on_record')
  })
  it('a closed gate reads the pile the job’s notice stands in', () => {
    const cases: Array<[LienDeskPile, LienAffidavitNoticeStanding]> = [
      ['needs_owner', 'needs_owner'],
      ['to_draft', 'to_send'],
      ['awaiting', 'awaiting'],
      ['held', 'held'],
      ['ready', 'approved'],
      ['printed', 'printed'],
      ['sent', 'unrecorded'],
    ]
    for (const [pile, standing] of cases) expect(lienAffidavitNoticeStanding(sub(false), at(pile))).toBe(standing)
  })
  it('a closed window with a month still open is still to send; with none open, or no notice row at all, it is the late notice', () => {
    expect(lienAffidavitNoticeStanding(sub(false), at('missed', ['2026-09']))).toBe('to_send')
    expect(lienAffidavitNoticeStanding(sub(false), at('missed', []))).toBe('late')
    expect(lienAffidavitNoticeStanding(sub(false), null)).toBe('late')
    expect(lienAffidavitNoticeStanding(sub(false), undefined)).toBe('late')
  })
  it('a gate list with no notice gate reads as closed', () => {
    expect(lienAffidavitNoticeStanding({ isSub: true, gates: [] }, at('ready'))).toBe('approved')
  })
})

describe('lienAffidavitNoticeWaits', () => {
  it('is true only while the gate is closed', () => {
    expect(lienAffidavitNoticeWaits('approved')).toBe(true)
    expect(lienAffidavitNoticeWaits('late')).toBe(true)
    expect(lienAffidavitNoticeWaits('on_record')).toBe(false)
    expect(lienAffidavitNoticeWaits('not_needed')).toBe(false)
    expect(lienAffidavitNoticeWaits(null)).toBe(false)
    expect(lienAffidavitNoticeWaits(undefined)).toBe(false)
  })
})

const WAITING: LienAffidavitNoticeWaiting[] = ['late', 'needs_owner', 'to_send', 'awaiting', 'held', 'approved', 'printed', 'unrecorded']

describe('lienAffidavitNoticeWords', () => {
  it('the late notice keeps the words every screen had', () => {
    expect(lienAffidavitNoticeWords('late')).toEqual({
      tag: { tone: 'warn', words: 'No notice on record' },
      sub: 'send the § 53.056 notice first — late is allowed while this window is open',
      detail: 'Send the § 53.056 notice first. Late is allowed while this window is open.',
      fact: '',
      door: 'Send the notice first ›',
      band: 'Send the notice first ›',
      foot: 'Send the § 53.056 notice first. A late one counts while this window is open.',
      short: 'no § 53.056 notice on the job',
    })
  })
  it('an approved notice is said to be approved and not mailed, and nobody is told to send it', () => {
    expect(lienAffidavitNoticeWords('approved')).toEqual({
      tag: { tone: 'warn', words: 'Notice approved · not mailed yet' },
      sub: 'its § 53.056 notice is approved and not mailed yet',
      detail: 'Its § 53.056 notice is approved and not mailed yet.',
      fact: 'approved · not mailed yet',
      door: 'Open the notice ›',
      band: 'Mail the notice first ›',
      foot: 'The § 53.056 notice is approved and not mailed yet. Mail it and record the mailing first.',
      short: '§ 53.056 notice not mailed yet',
    })
    expect(lienAffidavitNoticeWords('printed').tag.words).toBe('Notice printed · not mailed yet')
    expect(lienAffidavitNoticeWords('printed').band).toBe('Mail the notice first ›')
  })
  it('only the late notice says *send … first* or *no notice*; every other standing says where the notice stands', () => {
    for (const s of WAITING.filter((x) => x !== 'late')) {
      const w = lienAffidavitNoticeWords(s)
      const all = [w.tag.words, w.sub, w.detail, w.fact, w.door, w.band, w.foot, w.short].join(' | ')
      expect(all, s).not.toMatch(/send the (§ 53\.056 )?notice first/i)
      expect(all, s).not.toMatch(/no (§ 53\.056 )?notice on/i)
      expect(w.tag.tone, s).toBe('warn')
      expect(w.fact, s).not.toBe('')
    }
  })
  it('every sentence is plain: one idea, no dash, semicolon or parenthesis, outside the late notice’s kept words', () => {
    for (const s of WAITING.filter((x) => x !== 'late')) {
      const w = lienAffidavitNoticeWords(s, { leader: 'Sam' })
      for (const words of [w.detail, w.foot]) {
        expect(words, s).not.toMatch(/[—–;()]/)
        for (const sentence of words.split(/(?<=\.)\s+/)) expect(sentence.split(/\s+/).length, `${s}: ${sentence}`).toBeLessThanOrEqual(20)
      }
    }
  })
  it('a notice that waits on approval names the leader, or *the leader* without a name', () => {
    expect(lienAffidavitNoticeWords('awaiting', { leader: ' Sam ' }).detail).toBe('Its § 53.056 notice waits on Sam’s approval.')
    expect(lienAffidavitNoticeWords('awaiting').detail).toBe('Its § 53.056 notice waits on the leader’s approval.')
    expect(lienAffidavitNoticeWords('awaiting', { leader: 'Sam' }).foot).toBe('The § 53.056 notice waits on Sam’s approval. It must be mailed and recorded first.')
  })
})

describe('lienAffidavitNoticeStandingOnDesk', () => {
  it('reads the standing from the notice’s pile alone, and gives null to a reader that cannot know', () => {
    expect(lienAffidavitNoticeStandingOnDesk('ready')).toBe('approved')
    expect(lienAffidavitNoticeStandingOnDesk('printed')).toBe('printed')
    expect(lienAffidavitNoticeStandingOnDesk('awaiting')).toBe('awaiting')
    expect(lienAffidavitNoticeStandingOnDesk('to_draft')).toBe('to_send')
    expect(lienAffidavitNoticeStandingOnDesk('held')).toBe('held')
    expect(lienAffidavitNoticeStandingOnDesk('needs_owner')).toBe('needs_owner')
    expect(lienAffidavitNoticeStandingOnDesk('sent')).toBe('unrecorded')
    expect(lienAffidavitNoticeStandingOnDesk('missed')).toBe('late')
    for (const none of ['', null, undefined] as const) expect(lienAffidavitNoticeStandingOnDesk(none)).toBeNull()
  })
})

describe('lienAffidavitNoticePile', () => {
  it('is the notice’s own pile, or Missed with no notice row', () => {
    expect(lienAffidavitNoticePile({ pile: 'ready' })).toBe('ready')
    expect(lienAffidavitNoticePile(null)).toBe('missed')
  })
})
