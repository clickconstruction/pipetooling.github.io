import { describe, expect, it } from 'vitest'
import { statementWeekNudgeFromPayload } from './statementRoundEmail'
import {
  groupOfficeWeek,
  groupTitle,
  isOfficeWeekPayload,
  officeWeekStep,
  officeWeekSubject,
  officeWeekText,
  promiseLine,
  renderOfficeWeekHtml,
  type OfficeWeekItem,
  type OfficeWeekPayload,
} from './statementWeekEmail'

const item = (gc: string, amount: number, state: string, over: Partial<OfficeWeekItem> = {}): OfficeWeekItem => ({
  gc_id: `gc-${gc}`,
  gc_name: gc,
  amount,
  job_count: 2,
  oldest_age_days: 41,
  over_90: 0,
  owner_user_id: 'u-malachi',
  owner_name: 'Malachi Douglas',
  state,
  checked: state !== 'needs_certify',
  sent: state === 'needs_word' || state === 'done',
  word_in: state === 'done',
  ap_email: 'ap@x.test',
  ap_phone: null,
  last_statement_at: null,
  last_word: null,
  last_temperature: null,
  expected_pay_by: null,
  promise_late: false,
  days_late: 0,
  ...over,
})

const week = (items: OfficeWeekItem[]): OfficeWeekPayload => ({
  week_start: '2026-09-21',
  deadline: '2026-09-25',
  today: '2026-09-27',
  office: true,
  items,
  counts: {
    gcs: items.length,
    to_check: items.filter((i) => i.state === 'needs_certify').length,
    to_send: items.filter((i) => i.state === 'ready').length,
    to_send_total: items.filter((i) => i.state === 'ready').reduce((t, i) => t + i.amount, 0),
    words_due: items.filter((i) => !i.word_in && i.state !== 'skipped').length,
    done: items.filter((i) => i.state === 'done').length,
    late: items.filter((i) => i.promise_late).length,
    total: items.reduce((t, i) => t + i.amount, 0),
  },
})

const opts = { dateLabel: 'Sun, Sep 27', roundUrl: 'https://app.test/jobs?tab=stages&round=1', recipientName: 'Taunya Smith', recipientUserId: 'u-taunya', timeZone: 'America/Chicago' }

const late = item('Knight <& Sons>', 26000, 'ready', { expected_pay_by: '2026-09-20', promise_late: true, days_late: 7, last_word: { note: 'Check run is the 20th.', by: 'Malachi', at: '2026-09-18T15:00:00Z', action: 'contacted', temperature: 'warm' } })
const sample = week([late, item('Structura', 98000, 'needs_word'), item('Loberg', 22000, 'needs_certify', { owner_user_id: null, owner_name: null }), item('Harper', 30000, 'done', { owner_user_id: 'u-taunya', owner_name: 'Taunya Smith' }), item('Skipped', 12000, 'skipped')])

describe('the office week payload', () => {
  it('is told apart from the per-sender round', () => {
    expect(isOfficeWeekPayload(sample)).toBe(true)
    expect(isOfficeWeekPayload({ week_start: '2026-09-21', ready: [], held: { count: 0, total: 0 } })).toBe(false)
    expect(isOfficeWeekPayload(null)).toBe(false)
  })

  it('reads the next step off the state', () => {
    expect(['needs_certify', 'ready', 'needs_word', 'done', 'skipped'].map((state) => officeWeekStep({ state }))).toEqual(['check', 'send', 'word', null, null])
  })
})

describe('groupOfficeWeek', () => {
  it('puts the reader’s own accounts first, then the largest book, the unassigned last', () => {
    const groups = groupOfficeWeek(sample, 'u-taunya')
    expect(groups.map((g) => [groupTitle(g), g.items.map((i) => i.gc_name), g.total, g.toDo, g.late])).toEqual([
      ['Your accounts', ['Harper'], 30000, 0, 0],
      ['Call Malachi', ['Knight <& Sons>', 'Structura'], 124000, 2, 1],
      ['No account man yet', ['Loberg'], 22000, 1, 0],
    ])
  })

  it('reads the same for the account man, with his GCs as his', () => {
    expect(groupOfficeWeek(sample, 'u-malachi').map((g) => groupTitle(g))).toEqual(['Your accounts', 'Call Taunya', 'No account man yet'])
  })

  it('leaves a skipped GC out', () => {
    expect(groupOfficeWeek(sample, null).flatMap((g) => g.items.map((i) => i.gc_name))).not.toContain('Skipped')
  })
})

describe('the wording', () => {
  it('the subject says what is left, and who broke a promise', () => {
    expect(officeWeekSubject(sample, 'Taunya Smith')).toBe('Taunya, 1 GC statement to send · 1 to check · 3 words to get — 1 broke a promise')
    expect(officeWeekSubject(week([item('Harper', 30000, 'done')]), 'Taunya')).toBe('Taunya, the week’s GC statements are done')
    expect(officeWeekSubject(week([]), null)).toBe('there, no GC owes over $10,000 this week')
  })

  it('a promise reads late once it is', () => {
    expect(promiseLine(late)).toBe('promised Sep 20 — 7 days late')
    expect(promiseLine({ expected_pay_by: '2026-10-10', promise_late: false, days_late: 0 })).toBe('pays by Oct 10')
    expect(promiseLine({ expected_pay_by: null, promise_late: false, days_late: 0 })).toBe('')
  })

  it('the text email is a call list', () => {
    const text = officeWeekText(sample, opts)
    expect(text).toContain('Call Malachi — 2 GCs · $124,000 · 2 to do')
    expect(text).toContain('PROMISED SEP 20 — 7 DAYS LATE')
    expect(text).toContain('Next: Send the statement')
    expect(text).toContain('Last word: Sep 18 · warm · "Check run is the 20th." — Malachi')
    expect(text).toContain('Open the call sheet: https://app.test/jobs?tab=stages&round=1&gc=gc-Knight%20%3C%26%20Sons%3E')
    expect(text).not.toContain('yours to fix')
  })

  it('the HTML escapes names and links each group to its call sheet', () => {
    const html = renderOfficeWeekHtml(sample, opts)
    expect(html).toContain('Knight &lt;&amp; Sons&gt;')
    expect(html).not.toContain('Knight <& Sons>')
    expect(html).toContain('Open Malachi’s call sheet')
    expect(html).toContain('Open your call sheet')
    expect(html).toContain('1 GC broke a promise — start there.')
    expect(html).toContain('The week closes end of day')
  })
})

describe('statementWeekNudgeFromPayload', () => {
  it('counts the statements checked and waiting, office-wide', () => {
    expect(statementWeekNudgeFromPayload(sample)).toEqual({ count: 1, total: 26000, gcNames: ['Knight <& Sons>'], office: true, late: 1, toCheck: 1, wordsDue: 3 })
  })

  it('is quiet when nothing is ready to send', () => {
    expect(statementWeekNudgeFromPayload(week([item('Loberg', 22000, 'needs_certify')]))).toBeNull()
    expect(statementWeekNudgeFromPayload(null)).toBeNull()
  })
})
