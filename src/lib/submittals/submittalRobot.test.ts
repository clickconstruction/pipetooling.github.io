import { describe, expect, it } from 'vitest'
import { describeTask, parseRedlineAnnotations, parseScheduleRows, parseSheetGuesses, scheduleRowInserts, summarizeRedlines, summarizeScheduleRows, summarizeSheetGuesses } from '../../../supabase/functions/_shared/submittalRobot'

describe('submittalRobot · read_schedule', () => {
  it('cleans the rows: tags required and upper-cased, duplicates keep the surer, sorted numerically', () => {
    const p = parseScheduleRows([{ tag: 'wc-10', fixture: 'water closet', manufacturer: 'TOTO', model: 'CT708UVG#01', confidence: 0.95 }, { tag: 'WC-2', confidence: 0.4 }, { tag: 'wc-2', model: 'CT708', confidence: 0.8 }, { fixture: 'no tag' }, 'junk', { tag: 'DWH-1', description: 'Rheem 40 gal', confidence: 2 }])
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.rows.map((r) => [r.tag, r.model, r.confidence])).toEqual([['DWH-1', null, 1], ['WC-2', 'CT708', 0.8], ['WC-10', 'CT708UVG#01', 0.95]])
    expect(summarizeScheduleRows(p.rows)).toBe('3 tags · 3 sure')
    expect(summarizeScheduleRows([...p.rows, { tag: 'X', fixture: null, manufacturer: null, model: null, description: null, confidence: 0.3 }])).toBe('4 tags · 3 sure · 1 want a look')
    expect(scheduleRowInserts('b1', p.rows.slice(0, 1), 'twin')[0]).toEqual({ bid_id: 'b1', tag: 'DWH-1', fixture: null, manufacturer: null, model: null, description: 'Rheem 40 gal', source: 'robot', confirmed_at: null, confirmed_by: null, created_by: 'twin' })
  })
  it('refuses nothing usable', () => {
    expect(parseScheduleRows([{ fixture: 'x' }])).toMatchObject({ ok: false })
    expect(parseScheduleRows('x')).toMatchObject({ ok: false })
  })
})

describe('submittalRobot · file_cut_sheets', () => {
  it('one guess per page inside the file, skipped pages never guessed, sorted', () => {
    const p = parseSheetGuesses({ guesses: [{ page: 3, tag: 'wc-1', confidence: 0.9 }, { page: 3, tag: 'WC-2', confidence: 0.5 }, { page: 1, tag: 'DWH-1', confidence: 0.6 }, { page: 40, tag: 'X' }, { page: 2 }], skipped: [5, 5, 3, 99] }, 31)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.value.guesses).toEqual([{ page: 1, tag: 'DWH-1', confidence: 0.6 }, { page: 3, tag: 'WC-1', confidence: 0.9 }])
    expect(p.value.skipped).toEqual([5])
    expect(summarizeSheetGuesses(p.value)).toBe('1 page matched to tags · 1 unsure · 1 page skipped')
    expect(parseSheetGuesses({ guesses: [] }, 4)).toMatchObject({ ok: false })
  })
})

describe('submittalRobot · read_redlines', () => {
  it('keeps text or a tag; a mark with no tag is a question; summarises', () => {
    const p = parseRedlineAnnotations([{ page: 2, tag: 'dwh-1', text: 'RH375 per specs?', proposed: 'revise', confidence: 0.85 }, { page: 2, tag: 'RD-2', text: '21512?', proposed: 'revise', confidence: 0.5 }, { tag: 'WC-1', text: 'SC534 per spec', proposed: 'rejected', confidence: 0.9 }, { text: 'water budget is by fixture — same body?', proposed: 'revise' }, { page: 9 }])
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.annotations).toHaveLength(4)
    expect(p.annotations[3]).toMatchObject({ tag: null, proposed: 'question' })
    expect(summarizeRedlines(p.annotations)).toBe('4 annotations · 2 read as decisions · 1 unsure · 1 is a question for the thread')
  })
})

describe('describeTask', () => {
  it('reads the state and, when ready, the summary of the result', () => {
    expect(describeTask({ kind: 'read_schedule', status: 'queued', result: null })).toBe('robot · read the schedule · queued')
    expect(describeTask({ kind: 'read_schedule', status: 'ready', result: { rows: [{ tag: 'A', confidence: 0.9 }, { tag: 'B', confidence: 0.2 }] } })).toBe('robot · read the schedule · ready · 2 tags · 1 sure · 1 want a look')
    expect(describeTask({ kind: 'file_cut_sheets', status: 'ready', result: { guesses: [{ page: 1, tag: 'A', confidence: 0.9 }], skipped: [2] } }, 4)).toBe('robot · split the file by tag · ready · 1 page matched to tags · 1 page skipped')
    expect(describeTask({ kind: 'read_redlines', status: 'blocked', result: null, summary: 'the PDF has no text layer' })).toBe('robot · read the redlines · blocked · the PDF has no text layer')
    expect(describeTask({ kind: 'read_redlines', status: 'done', result: null })).toBe('robot · read the redlines · confirmed')
  })
})
