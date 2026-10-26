import { describe, expect, it } from 'vitest'
import {
  daysForWarmth,
  isActiveProspect,
  parseProspectDays,
  prospectDueCounts,
  prospectDueRows,
  prospectName,
  prospectsMarkNote,
  prospectsNextLine,
  prospectsSince,
  serializeProspectDays,
  type DueProspect,
} from './prospectsDue'

const NOW = '2026-10-26T15:00:00.000Z'
const DAY = 86_400_000
const ago = (days: number) => new Date(Date.parse(NOW) - days * DAY).toISOString()

function p(id: string, company: string, warmth: number, lastDaysAgo: number | null, over: Partial<DueProspect> = {}): DueProspect {
  return { id, company_name: company, contact_name: null, warmth_count: warmth, last_contact: lastDaysAgo == null ? null : ago(lastDaysAgo), created_at: ago(120), prospect_fit_status: null, converted_customer_id: null, ...over }
}

const PROSPECTS: DueProspect[] = [
  p('a', 'Westlake Custom Homes', 3, 10, { contact_name: 'Dana Whitfield' }),
  p('b', 'Trinity Oaks Church', 2, 6),
  p('c', 'Blanco River Builders', 2, 45),
  p('d', 'Maple & Finch Remodeling', 3, 26),
  p('e', 'Kestrel Homes', 1, 42),
  p('f', 'Never Touched LLC', 0, null),
  p('g', 'On Time Co', 0, 20),
  p('h', 'Gone Cold Co', 0, 5, { prospect_fit_status: 'cant_reach' }),
  p('i', 'Now A Customer', 3, 2, { converted_customer_id: 'cust-1' }),
]
const CALLBACKS = [
  { prospect_id: 'a', callback_date: ago(3), title: 'Call back: Westlake' },
  { prospect_id: 'b', callback_date: ago(1), title: null },
  // Kept: touched after the callback day.
  { prospect_id: 'g', callback_date: ago(30), title: null },
  // Not yet due.
  { prospect_id: 'e', callback_date: new Date(Date.parse(NOW) + 2 * DAY).toISOString(), title: null },
]
const DAYS = { w3: 7, w2: 14, w1: 30, w0: 60 }

describe('the owner\'s days', () => {
  it('parses the setting, keeps the default for a bad or missing field, and picks by warmth', () => {
    expect(parseProspectDays(null)).toEqual(DAYS)
    expect(parseProspectDays('{"w3":5,"w2":"10","w1":0,"w0":400}')).toEqual({ w3: 5, w2: 10, w1: 30, w0: 60 })
    expect(parseProspectDays('nope')).toEqual(DAYS)
    expect(serializeProspectDays(DAYS)).toBe('{"w3":7,"w2":14,"w1":30,"w0":60}')
    expect([daysForWarmth(DAYS, 5), daysForWarmth(DAYS, 3), daysForWarmth(DAYS, 2), daysForWarmth(DAYS, 1), daysForWarmth(DAYS, 0), daysForWarmth(DAYS, null)]).toEqual([7, 7, 14, 30, 60, 60])
  })
})

describe('prospectDueRows', () => {
  const rows = prospectDueRows({ prospects: PROSPECTS, callbacks: CALLBACKS, nowIso: NOW, days: DAYS })

  it('leaves out can\'t reach and converted, and sorts missed, past, on time, most over first', () => {
    expect(isActiveProspect({ prospect_fit_status: 'not_a_fit', converted_customer_id: null })).toBe(false)
    expect(rows.map((r) => `${r.prospect.id}:${r.state}:${r.overDays}`)).toEqual(['a:missed:3', 'b:missed:1', 'f:past:60', 'c:past:31', 'd:past:19', 'e:past:12', 'g:ontime:0'])
  })

  it('says the words', () => {
    const by = Object.fromEntries(rows.map((r) => [r.prospect.id, r]))
    expect(by.a!.name).toBe('Westlake Custom Homes · Dana Whitfield')
    expect(prospectName({ company_name: 'Acme', contact_name: 'acme' })).toBe('Acme')
    expect(by.a!.words).toBe('promised Fri, Oct 23 · 3 days over · last touch 10d ago')
    expect(by.c!.words).toBe('last touch 45d ago · due every 14 days · 31 days over')
    expect(by.f!.words).toBe('never touched · added 120d ago · due every 60 days · 60 days over')
    expect(by.g!.words).toBe('last touch 20d ago · due every 60 days')
    // A callback not yet due is not a miss, and one the prospect was touched after is kept.
    expect(by.e!.callback).toBeNull()
    expect(by.g!.callback).toBeNull()
  })

  it('counts, names the first, and writes the note', () => {
    expect(prospectDueCounts(rows)).toEqual({ missed: 2, past: 4, ontime: 1, total: 7, due: 6 })
    expect(prospectsNextLine(rows)).toBe('Call Westlake Custom Homes · Dana Whitfield · promised Fri, Oct 23 · 3 days over')
    const since = prospectsSince(rows, ago(3), NOW, () => 'Friday at 9:55 AM')
    // Crossed since the mark three days ago: a (3 over), b (1 over), and d (19 over) no; e (12) no → a and b only, plus nobody touched since.
    expect(since).toEqual({ newPast: 2, touchedSince: 0, words: 'Since the last look, Friday at 9:55 AM' })
    expect(prospectsMarkNote(rows, DAYS, since)).toBe(
      '6 past their day · 2 promised and missed · oldest 3d over (Westlake Custom Homes · Dana Whitfield, warm 3) · 1 on time of 7 · days per warmth 7 · 14 · 30 · 60 · +2 new past, 0 touched since the last look',
    )
    const onTime = prospectDueRows({ prospects: [PROSPECTS[6]!], callbacks: [], nowIso: NOW, days: DAYS })
    expect(prospectsNextLine(onTime)).toBeNull()
    expect(prospectsMarkNote([], DAYS, null)).toBeNull()
    expect(prospectsSince(rows, null, NOW, () => '')).toBeNull()
  })
})
