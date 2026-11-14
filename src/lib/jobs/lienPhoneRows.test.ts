import { describe, expect, it } from 'vitest'
import { lienPhoneAmounts, lienPhoneGroups, lienPhoneLeftWords, lienPhoneStepWords, lienPhoneTone } from './lienPhoneRows'
import type { LienNextUpGroup, LienNextUpRow } from './lienNextUp'

const row = (key: string, over: Partial<LienNextUpRow> = {}): LienNextUpRow => ({
  key, kind: 'affidavit', jobId: key, gcId: null, title: key, sub: '', dueOn: '2026-11-16', daysLeft: 3, severity: 'red', group: 'now', action: 'file_affidavit', button: 'File the affidavit',
  target: { open: 'affidavits', jobId: key }, ...over,
})
const g = (group: LienNextUpGroup, label: string, rows: LienNextUpRow[]) => ({ group, label, rows })
const amounts = (m: Record<string, number>) => (r: LienNextUpRow) => (r.jobId && m[r.jobId] != null ? m[r.jobId]! : null)

describe('lienPhoneGroups', () => {
  it('pools Needs you now and Coming up and splits them by the day, soonest first, with the money each day holds', () => {
    const out = lienPhoneGroups(
      [
        g('now', 'Needs you now', [row('a'), row('b'), row('late', { dueOn: '2026-11-10', daysLeft: -3 })]),
        g('coming', 'Coming up', [row('c', { dueOn: '2026-12-15', daysLeft: 32, group: 'coming' })]),
      ],
      amounts({ a: 8400, b: 6125, late: 500, c: 1000 }),
    )
    expect(out.map((x) => x.key)).toEqual(['day:2026-11-10', 'day:2026-11-16', 'day:2026-12-15'])
    expect(out.map((x) => x.label)).toEqual(['Was due Tue Nov 10', 'Due Mon Nov 16', 'Due Tue Dec 15'])
    expect(out.map((x) => x.left)).toEqual(['3 days late', '3 days', '32 days'])
    expect(out.map((x) => x.tone)).toEqual(['red', 'red', 'quiet'])
    expect(out.map((x) => x.amount)).toEqual([500, 14525, 1000])
    expect(out[1]!.rows.map((r) => r.key)).toEqual(['a', 'b'])
    expect(out.every((x) => x.group === 'day')).toBe(true)
  })

  it('the groups that say whose move it is keep their place and their words', () => {
    const out = lienPhoneGroups(
      [
        g('sign', 'Only you can sign', [row('s', { group: 'sign' })]),
        g('mine', 'Only you can approve', [row('m', { group: 'mine' })]),
        g('now', 'Needs you now', [row('a')]),
        g('reminders', 'Reminders', [row('r', { group: 'reminders', dueOn: null, daysLeft: null })]),
        g('coming', 'Coming up', [row('c', { dueOn: '2026-11-20', daysLeft: 7, group: 'coming' })]),
        g('waiting', 'Waiting on Sam', [row('w', { group: 'waiting' })]),
      ],
      () => null,
    )
    // The days stand where Needs you now stood; Coming up's rows are among them, not after the reminders.
    expect(out.map((x) => x.key)).toEqual(['sign', 'mine', 'day:2026-11-16', 'day:2026-11-20', 'reminders', 'waiting'])
    expect(out.map((x) => x.label)).toEqual(['Only you can sign', 'Only you can approve', 'Due Mon Nov 16', 'Due Fri Nov 20', 'Reminders', 'Waiting on Sam'])
    expect(out.find((x) => x.key === 'waiting')!.left).toBeNull()
    expect(out.find((x) => x.key === 'day:2026-11-20')!.tone).toBe('amber')
  })

  it('a row with no day of its own comes last among the days, under its own head', () => {
    const out = lienPhoneGroups([g('now', 'Needs you now', [row('none', { dueOn: null, daysLeft: null }), row('a')])], () => null)
    expect(out.map((x) => x.key)).toEqual(['day:2026-11-16', 'day:none'])
    expect(out[1]).toMatchObject({ label: 'No day set', left: null, tone: 'quiet' })
  })

  it('a job with two papers on one day is counted once in the day’s money', () => {
    const out = lienPhoneGroups([g('now', 'Needs you now', [row('n1', { jobId: 'j', kind: 'notice' }), row('a1', { jobId: 'j' }), row('b')])], amounts({ j: 3000, b: 1000 }))
    expect(out[0]!.amount).toBe(4000)
  })

  it('no known amount is no amount, not zero', () => {
    expect(lienPhoneGroups([g('now', 'Needs you now', [row('a')])], () => null)[0]!.amount).toBeNull()
  })

  it('a pressed step’s two groups pass through as they are', () => {
    const out = lienPhoneGroups([g('step_on', 'On File it', [row('a', { group: 'step_on' })]), g('step_other', 'Everything else', [row('b', { group: 'step_other' })])], () => null)
    expect(out.map((x) => [x.key, x.label, x.left])).toEqual([['step_on', 'On File it', null], ['step_other', 'Everything else', null]])
  })

  it('nothing in, nothing out', () => {
    expect(lienPhoneGroups([], () => null)).toEqual([])
  })
})

describe('lienPhoneLeftWords and lienPhoneTone', () => {
  it('says the days as a person would', () => {
    expect([3, 1, 0, -1, -4].map(lienPhoneLeftWords)).toEqual(['3 days', '1 day', 'today', '1 day late', '4 days late'])
  })
  it('is red inside three days or late, amber inside a week', () => {
    expect([-2, 0, 3, 4, 7, 8, null].map(lienPhoneTone)).toEqual(['red', 'red', 'red', 'amber', 'amber', 'quiet', 'quiet'])
  })
})

describe('lienPhoneAmounts', () => {
  const amountFor = lienPhoneAmounts({
    notices: [{ jobId: 'j1', openBalance: 1000 }, { jobId: 'j2', openBalance: 0 }],
    affidavits: [{ jobId: 'j1', openBalance: 1200 }, { jobId: 'j3', openBalance: 700 }],
    retainage: [{ jobId: 'j4', openBalance: 300 }],
  })

  it('a row reads its own kind of entry first', () => {
    expect(amountFor({ kind: 'notice', jobId: 'j1' })).toBe(1000)
    expect(amountFor({ kind: 'affidavit', jobId: 'j1' })).toBe(1200)
    expect(amountFor({ kind: 'retainage', jobId: 'j4' })).toBe(300)
  })

  it('and falls back to another list that knows the job', () => {
    expect(amountFor({ kind: 'notice', jobId: 'j3' })).toBe(700)
  })

  it('a run row, an unknown job and a job with nothing open have no amount', () => {
    expect(amountFor({ kind: 'notice', jobId: null })).toBeNull()
    expect(amountFor({ kind: 'notice', jobId: 'nope' })).toBeNull()
    expect(amountFor({ kind: 'notice', jobId: 'j2' })).toBeNull()
  })
})

describe('lienPhoneStepWords', () => {
  it('names the step the row stands on and whose it is', () => {
    expect(lienPhoneStepWords({ ladder: 'affidavit', step: 4 }, 'affidavit', false)).toBe('File · you')
    expect(lienPhoneStepWords({ ladder: 'notice', step: 3 }, 'notice', false)).toBe('Approve · leader')
    expect(lienPhoneStepWords({ ladder: 'notice', step: 3 }, 'notice', true)).toBe('Approve · you')
    expect(lienPhoneStepWords({ ladder: 'notice', step: 1 }, 'notice', true)).toBe('Owner · office')
  })
  it('is empty for a row on no step', () => {
    expect(lienPhoneStepWords(null, 'notice', false)).toBe('')
  })
})
