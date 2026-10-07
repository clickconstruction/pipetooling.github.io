import { describe, expect, it } from 'vitest'
import { gradePatch, gradeSummary, normalizeTag, planScheduleGrade, productHead, rowProductWords } from './gradeAgainstSchedule'
import type { SpecifiedInput } from './buildSubmittalRows'
import type { SubmittalPartRow } from './itemParts'
import type { SubmittalItemRow } from './submittalRevision'

const item = (o: Partial<SubmittalItemRow> & { id: string; tag: string }): SubmittalItemRow => ({
  submittal_id: 'rev-1', sequence_order: 1, specified_manufacturer: null, specified_model: null, specified_description: null, submitted_manufacturer: null, submitted_model: null, submitted_label: null,
  supply_house_id: null, source_quote_line_id: null, source_count_row_id: 'cr-1', status: 'proposed', reason_kind: null, reason_note: null, lead_time_days: null, sheet_file: null, sheet_pages: [], sheet_source: null, carried_from_item_id: null,
  review_decision: null, review_note: null, reviewed_by_name: null, reviewed_by_person_id: null, reviewed_by_email: null, reviewed_at: null, created_at: '', updated_at: '', ...o,
} as SubmittalItemRow)
const part = (label: string, on_submittal = true): SubmittalPartRow => ({ id: label, item_id: 'x', bid_id: 'b', label, on_submittal, quantity: 1, sequence_order: 1, source: 'takeoff' } as unknown as SubmittalPartRow)
const spec = (tag: string, manufacturer: string | null, model: string | null, description: string | null = null): SpecifiedInput => ({ tag, fixture: null, manufacturer, model, description })

const schedule = [spec('WC-1', 'TOTO', 'CT728CUVG#01', 'Wall-hung flushometer toilet'), spec('WC-2', 'TOTO', 'CT728CUVG#01'), spec('LAV-1', 'KOHLER', 'K-2005'), spec('HB-3', 'WOODFORD', 'B74'), spec('FD-1', null, null, 'Floor drain, by contractor')]

describe('planScheduleGrade', () => {
  it('a Proposed row whose tag the schedule names takes the plans’ product and the status the comparison gives', () => {
    const items = [
      item({ id: 'wc', tag: 'WC-1, WC-2', submitted_label: 'TOTO CT728CUVG#01 + TOTO TET2UB31#SS' }),
      item({ id: 'lav', tag: 'LAV-1', submitted_label: 'TSL.MON.B.38.2.PS1.BK MONOLITH' }),
      item({ id: 'hb', tag: 'HB-3', submitted_label: 'WOODFORD B74C' }),
      item({ id: 'ur', tag: 'UR-1', submitted_label: 'TOTO UT105UVG#01' }),
    ]
    const plan = planScheduleGrade(items, schedule)
    expect(plan.rows.map((r) => [r.tag, r.scheduleTag, r.from, r.to, r.near])).toEqual([
      ['WC-1, WC-2', 'WC-1', 'proposed', 'as_specified', false],
      ['LAV-1', 'LAV-1', 'proposed', 'alternate', false],
      ['HB-3', 'HB-3', 'proposed', 'as_specified', true],
    ])
    expect(plan.rows[0]!.specified).toEqual({ manufacturer: 'TOTO', model: 'CT728CUVG#01', description: 'Wall-hung flushometer toilet' })
    expect(plan.skipped).toEqual([{ itemId: 'ur', tag: 'UR-1', why: 'not_on_schedule' }])
    expect(gradePatch(plan.rows[1]!)).toEqual({ specified_manufacturer: 'KOHLER', specified_model: 'K-2005', specified_description: null, status: 'alternate' })
    expect(gradeSummary(plan.rows)).toBe('2 as specified (1 to check) · 1 alternate, say why')
  })

  it('a row’s parts the GC sees are what is compared; order-only parts are not', () => {
    const parts = new Map([['wc', [part('MAINLINE ML1055SSC000 seat'), part('TOTO CT728CUVG#01 bowl'), part('BRASSCRA PLB113XP stop', false)]]])
    const items = [item({ id: 'wc', tag: 'WC-1', submitted_label: 'something else' })]
    const plan = planScheduleGrade(items, schedule, parts)
    expect(plan.rows[0]).toMatchObject({ to: 'as_specified', product: 'MAINLINE ML1055SSC000 seat + TOTO CT728CUVG#01 bowl' })
    expect(rowProductWords(items[0]!, [])).toBe('something else')
    expect(rowProductWords(item({ id: 'x', tag: 'X', submitted_manufacturer: 'TOTO', submitted_model: 'UT105UVG' }))).toBe('TOTO UT105UVG')
    expect(productHead('MAINLINE ML1055SSC000 seat + TOTO CT728CUVG#01 bowl')).toBe('MAINLINE ML1055SSC000 + TOTO CT728CUVG#01')
  })

  it('a Missing row from the takeoff takes the plans’ product and stays Missing; one typed by hand, or already graded, is left alone', () => {
    const items = [
      item({ id: 'sink', tag: 'LAV-1', status: 'missing', submitted_label: null }),
      item({ id: 'hand', tag: 'HB-3', status: 'missing', source_count_row_id: null }),
      item({ id: 'done', tag: 'WC-1', status: 'alternate', specified_model: 'CT728CUVG#01', submitted_label: 'KOHLER' }),
      item({ id: 'acc', tag: '', status: 'accessory', submitted_label: 'carrier' }),
    ]
    const plan = planScheduleGrade(items, schedule)
    expect(plan.rows.map((r) => [r.itemId, r.from, r.to])).toEqual([['sink', 'missing', 'missing']])
    expect(plan.rows[0]!.specified.model).toBe('K-2005')
    expect(plan.skipped).toEqual([])
  })

  it('a schedule line with no product named leaves the status alone; two tags naming two products are left for the estimator; tags read loosely', () => {
    const items = [
      item({ id: 'fd', tag: 'FD-1', submitted_label: 'JRSMITH 2005' }),
      item({ id: 'mix', tag: 'LAV-1, HB-3', submitted_label: 'KOHLER K-2005' }),
      item({ id: 'loose', tag: 'wc 1', submitted_label: 'TOTO CT728CUVG#01' }),
    ]
    const plan = planScheduleGrade(items, schedule)
    expect(plan.rows.map((r) => [r.itemId, r.to, r.specified.description])).toEqual([['fd', 'proposed', 'Floor drain, by contractor'], ['loose', 'as_specified', 'Wall-hung flushometer toilet']])
    expect(plan.skipped).toEqual([{ itemId: 'mix', tag: 'LAV-1, HB-3', why: 'two_tags_differ' }])
    expect(normalizeTag(' wc-1 ')).toBe('WC1')
    // No schedule, no plan.
    expect(planScheduleGrade(items, [])).toEqual({ rows: [], skipped: items.map((it) => ({ itemId: it.id, tag: it.tag, why: 'not_on_schedule' })) })
  })
})
