import { describe, expect, it } from 'vitest'
import { answerLines, answerNeedsReviewer, answerSaveLabel, answerSummary, answerWrites, approveOpenLines, clearLines, initialAnswerDrafts, ROW_LINE, tapAnswer } from './answerEntry'
import type { SubmittalPartRow } from './itemParts'

const part = (id: string, label: string, seq: number, extra: Partial<SubmittalPartRow> = {}): SubmittalPartRow => ({ id, item_id: 'i1', bid_id: 'b1', sequence_order: seq, label, manufacturer: null, model: null, description: null, quantity: 1, on_submittal: true, source: 'takeoff', part_id: null, source_line_id: null, source_template_item_id: null, assembly: null, priced_label: null, reason_note: null, supply_house_id: null, lead_time_days: null, stage: null, sheet_file: null, sheet_pages: [], review_decision: null, review_note: null, reviewed_at: null, reviewed_by_name: null, reviewed_by_email: null, reviewed_by_person_id: null, decision_source: 'room', decision_entered_by: null, decision_entered_by_name: null, procure_key: `k-${id}`, carried_from_part_id: null, created_at: '', updated_at: '', ...extra })
const row = { submitted_label: 'TOTO CT728 kit', submitted_manufacturer: 'TOTO', submitted_model: 'CT728', review_decision: null, review_note: null, reviewed_by_name: null, decision_source: 'room' }

// BP375's WC-1, WC-2 as Wendi had it: five parts the GC sees, the flush valve already rejected by her own entry, and one order-only stop.
const wc = [
  part('bowl', 'TOTO CT728CUVG#01', 1),
  part('valve', 'TOTO TET2UB31#SS', 2, { review_decision: 'rejected', review_note: 'TET2UA31#SS', reviewed_by_name: 'structura', decision_source: 'entered' }),
  part('seat', 'MAINLINE ML1055SSC000 WHT ELONG', 3),
  part('stop', 'BRASSCRA PLB113XP ANG', 4, { on_submittal: false }),
  part('carrier', 'JOSAM 12694 4" NH double adjustable horizontal closet carrier', 5),
]

describe('answerLines', () => {
  it('one line per part the GC sees, in order, starting on the call each part carries', () => {
    const lines = answerLines(row, [wc[4]!, ...wc.slice(0, 4)])
    expect(lines.map((l) => l.key)).toEqual(['bowl', 'valve', 'seat', 'carrier'])
    expect(lines[1]).toMatchObject({ head: 'TOTO TET2UB31#SS', current: 'rejected', currentNote: 'TET2UA31#SS', currentBy: 'structura', canClear: true })
    expect(lines[2]).toMatchObject({ head: 'MAINLINE ML1055SSC000', words: 'WHT ELONG', current: null, canClear: true })
    expect(initialAnswerDrafts(lines).valve).toEqual({ decision: 'rejected', note: 'TET2UA31#SS' })
  })

  it('a row with no part the GC sees is one line, the row itself; a call made on the room cannot be emptied', () => {
    const lines = answerLines({ ...row, review_decision: 'approved', reviewed_by_name: 'Dana Whitfield', decision_source: 'room' }, [part('stop', 'ANGLE STOP', 1, { on_submittal: false })])
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ key: ROW_LINE, partId: null, head: 'TOTO CT728', current: 'approved', currentBy: 'Dana Whitfield', canClear: false })
  })
})

describe('tapping answers', () => {
  const lines = answerLines(row, wc)
  it('a tap picks, a second tap on an entered or fresh answer takes it off, and a room call stays', () => {
    let d = initialAnswerDrafts(lines)
    d = tapAnswer(lines[0]!, d, 'approved')
    expect(d.bowl!.decision).toBe('approved')
    d = tapAnswer(lines[0]!, d, 'approved')
    expect(d.bowl!.decision).toBeNull()
    d = tapAnswer(lines[1]!, d, 'rejected')
    expect(d.valve!.decision).toBeNull()
    const room = answerLines(row, [part('p', 'TOTO X1', 1, { review_decision: 'approved', decision_source: 'room' })])
    expect(tapAnswer(room[0]!, initialAnswerDrafts(room), 'approved').p!.decision).toBe('approved')
    expect(tapAnswer(room[0]!, initialAnswerDrafts(room), 'revise').p!.decision).toBe('revise')
  })

  it('All approved fills only the open lines; Clear all empties what can be emptied', () => {
    const all = approveOpenLines(lines, initialAnswerDrafts(lines))
    expect(Object.values(all).map((x) => x.decision)).toEqual(['approved', 'rejected', 'approved', 'approved'])
    const mixed = answerLines(row, [part('a', 'A1', 1, { review_decision: 'approved', decision_source: 'room' }), part('b', 'B1', 2, { review_decision: 'revise', decision_source: 'entered' })])
    const cleared = clearLines(mixed, tapAnswer(mixed[0]!, initialAnswerDrafts(mixed), 'rejected'))
    expect(cleared.a).toMatchObject({ decision: 'approved' })
    expect(cleared.b).toMatchObject({ decision: null })
  })
})

describe('answerWrites', () => {
  const lines = answerLines(row, wc)
  it('"approved, except the flush valve" is one save: the three open parts in one write, the valve untouched', () => {
    const drafts = approveOpenLines(lines, initialAnswerDrafts(lines))
    const w = answerWrites(lines, drafts)
    expect(w.sets).toEqual([{ decision: 'approved', note: '', partIds: ['bowl', 'seat', 'carrier'], row: false }])
    expect(w.clearPartIds).toEqual([])
    expect(w.counts).toEqual({ approved: 3, revise: 0, rejected: 0 })
    expect(w.changed).toBe(3)
    expect(answerSaveLabel(w)).toBe('Record 3 answers')
    expect(answerSummary(lines, drafts)).toEqual({ words: '3 approved · 1 rejected', open: 0 })
    expect(answerNeedsReviewer(w)).toBe(true)
  })

  it('parts that share an answer but not a note are separate writes; a changed note alone is a change', () => {
    let d = initialAnswerDrafts(lines)
    d = tapAnswer(lines[0]!, d, 'revise')
    d = { ...d, bowl: { ...d.bowl!, note: 'elongated bowl' } }
    d = tapAnswer(lines[2]!, d, 'revise')
    d = { ...d, valve: { ...d.valve!, note: 'hold 1.0 gpf' } }
    const w = answerWrites(lines, d)
    expect(w.sets).toEqual([
      { decision: 'revise', note: 'elongated bowl', partIds: ['bowl'], row: false },
      { decision: 'rejected', note: 'hold 1.0 gpf', partIds: ['valve'], row: false },
      { decision: 'revise', note: '', partIds: ['seat'], row: false },
    ])
    expect(answerSaveLabel(w)).toBe('Record 3 answers')
  })

  it('taking one part back clears that part alone and needs no reviewer; nothing changed saves nothing', () => {
    const none = answerWrites(lines, initialAnswerDrafts(lines))
    expect(none.changed).toBe(0)
    expect(answerSaveLabel(none)).toBe('Nothing to save')
    const back = answerWrites(lines, tapAnswer(lines[1]!, initialAnswerDrafts(lines), 'rejected'))
    expect(back).toMatchObject({ sets: [], clearPartIds: ['valve'], clearRow: false, changed: 1 })
    expect(answerSaveLabel(back)).toBe('Take back 1 answer')
    expect(answerNeedsReviewer(back)).toBe(false)
    const both = answerWrites(lines, tapAnswer(lines[0]!, tapAnswer(lines[1]!, initialAnswerDrafts(lines), 'rejected'), 'approved'))
    expect(answerSaveLabel(both)).toBe('Save 2 changes')
  })

  it('a row with no parts writes the row itself, and takes its own entered call back', () => {
    const one = answerLines(row, [])
    const set = answerWrites(one, tapAnswer(one[0]!, initialAnswerDrafts(one), 'approved'))
    expect(set.sets).toEqual([{ decision: 'approved', note: '', partIds: [], row: true }])
    expect(answerSaveLabel(set)).toBe('Record 1 answer')
    const entered = answerLines({ ...row, review_decision: 'revise', decision_source: 'entered' }, [])
    const back = answerWrites(entered, tapAnswer(entered[0]!, initialAnswerDrafts(entered), 'revise'))
    expect(back).toMatchObject({ sets: [], clearPartIds: [], clearRow: true })
    expect(answerSummary(entered, initialAnswerDrafts(entered))).toEqual({ words: '1 revise', open: 0 })
  })
})
