import { describe, expect, it } from 'vitest'
import { commonHouseId, proposedWords, rowAnswers, rowFilterChips, rowMatchesFilter, rowsTableShape } from './rowsTableModel'

const row = (o: Partial<{ status: string; sheet_pages: number[]; review_decision: string | null }> = {}) => ({ status: 'proposed', sheet_pages: [] as number[], review_decision: null as string | null, ...o })

describe('rowsTableShape', () => {
  it('a bid built from the takeoff has nothing to compare to', () => {
    expect(rowsTableShape([{ specified_manufacturer: null, specified_model: null }, { specified_manufacturer: ' ', specified_model: '' }])).toBe('takeoff')
  })
  it('a schedule on the bid, or one row that carries what was specified, makes it the schedule shape', () => {
    expect(rowsTableShape([{ specified_manufacturer: null, specified_model: null }], 3)).toBe('schedule')
    expect(rowsTableShape([{ specified_manufacturer: 'TOTO', specified_model: null }])).toBe('schedule')
    expect(rowsTableShape([])).toBe('takeoff')
  })
})

describe('rowFilterChips', () => {
  // The SpaceX draft, in small: sheets owed, one row with no product, some answered.
  const rows = [
    row({ sheet_pages: [6] }),
    row(),
    row({ sheet_pages: [30], review_decision: 'rejected' }),
    row({ sheet_pages: [48], review_decision: 'approved' }),
    row({ status: 'missing' }),
  ]

  it('All first, then each count above zero, in a fixed order', () => {
    expect(rowFilterChips(rows).map((c) => `${c.label} ${c.count}`)).toEqual(['All 5', 'Need a cut sheet 1', 'No product 1', 'Sent back 1', 'No answer yet 3'])
  })

  it('"No answer yet" waits until some row is answered: before that it is every row', () => {
    expect(rowFilterChips([row(), row({ sheet_pages: [1] })]).map((c) => c.label)).toEqual(['All', 'Need a cut sheet'])
  })

  it('an alternate or a design change with no reason leads the chips: it is what holds the package', () => {
    const rows2 = [{ ...row({ status: 'alternate', sheet_pages: [1] }), reason_kind: null }, { ...row({ status: 'alternate', sheet_pages: [2] }), reason_kind: 'lead_time' }, { ...row({ status: 'design_change' }), reason_kind: null }]
    expect(rowFilterChips(rows2).map((c) => `${c.label} ${c.count}`)).toEqual(['All 3', 'Need a reason 2', 'Need a cut sheet 1'])
    expect(rows2.map((r) => rowMatchesFilter('reason', r))).toEqual([true, false, true])
  })

  it('nothing to narrow to, no chips', () => {
    expect(rowFilterChips([row({ sheet_pages: [1] }), row({ sheet_pages: [2] })])).toEqual([])
    expect(rowFilterChips([])).toEqual([])
  })

  it('each chip keeps the rows it counted; a row with no product is not owed a sheet', () => {
    expect(rows.map((r) => rowMatchesFilter('sheet', r))).toEqual([false, true, false, false, false])
    expect(rows.map((r) => rowMatchesFilter('product', r))).toEqual([false, false, false, false, true])
    expect(rows.map((r) => rowMatchesFilter('sentBack', r))).toEqual([false, false, true, false, false])
    expect(rows.map((r) => rowMatchesFilter('noAnswer', r))).toEqual([true, true, false, false, true])
    expect(rows.every((r) => rowMatchesFilter('all', r))).toBe(true)
  })
})

describe('rowAnswers', () => {
  const part = (id: string, seq: number, review_decision: string | null = null, o: Partial<{ on_submittal: boolean; review_note: string | null; decision_source: string }> = {}) => ({ id, sequence_order: seq, on_submittal: true, review_decision, review_note: null as string | null, decision_source: 'room', ...o })

  it('an answered part carries its own mark; the others are waiting', () => {
    const a = rowAnswers({ review_decision: 'rejected', review_note: 'TOTO T25S51E#CP: TEL145' }, [part('sink', 1), part('faucet', 2, 'rejected', { review_note: ' TEL145 ' }), part('grid', 3)])
    expect([...a.byPart]).toEqual([['faucet', { tone: 'rejected', word: 'Rejected', note: 'TEL145', carried: false }]])
    expect(a.mixed).toBe(true)
    expect(a.row).toBeNull()
    expect(a.none).toBe(false)
  })

  it('every part answered is not mixed; an order-only part never counts; a carried approval says so', () => {
    const a = rowAnswers({ review_decision: 'approved', review_note: null }, [part('a', 1, 'approved', { decision_source: 'carried' }), part('stop', 2, null, { on_submittal: false })])
    expect(a.mixed).toBe(false)
    expect(a.byPart.get('a')?.carried).toBe(true)
  })

  it('no part answered: the row’s own answer, with its note', () => {
    const a = rowAnswers({ review_decision: 'revise', review_note: 'resubmit in white' }, [part('a', 1)])
    expect(a.row).toEqual({ tone: 'revise', word: 'Revise', note: 'resubmit in white', carried: false })
    expect(a.byPart.size).toBe(0)
    expect(rowAnswers({ review_decision: 'approved', review_note: null }, []).row?.word).toBe('Approved')
  })

  it('nothing answered is said once', () => {
    expect(rowAnswers({ review_decision: null, review_note: null }, [part('a', 1), part('b', 2)])).toMatchObject({ none: true, mixed: false, row: null })
  })
})

describe('commonHouseId', () => {
  const p = (supply_house_id: string | null, sequence_order = 1) => ({ supply_house_id, sequence_order })
  it('the one house every row buys from, by its parts or by the row itself', () => {
    const parts = new Map([['a', [p('nws'), p('nws', 2)]]])
    expect(commonHouseId([{ id: 'a', supply_house_id: null }, { id: 'b', supply_house_id: 'nws' }], parts)).toBe('nws')
  })
  it('two houses, or a row with none, is not common', () => {
    expect(commonHouseId([{ id: 'a', supply_house_id: 'nws' }, { id: 'b', supply_house_id: 'moore' }], new Map())).toBeNull()
    expect(commonHouseId([{ id: 'a', supply_house_id: 'nws' }, { id: 'b', supply_house_id: null }], new Map())).toBeNull()
    expect(commonHouseId([{ id: 'a', supply_house_id: null }], new Map([['a', [p('nws'), p('moore', 2)]]]))).toBeNull()
    expect(commonHouseId([], new Map())).toBeNull()
  })
})

describe('proposedWords', () => {
  it('says the status once, for all, some or none of the rows', () => {
    expect(proposedWords([{ status: 'proposed' }, { status: 'proposed' }])).toBe('Every row is Proposed')
    expect(proposedWords([{ status: 'proposed' }])).toBe('The row is Proposed')
    expect(proposedWords([{ status: 'proposed' }, { status: 'missing' }, { status: 'proposed' }])).toBe('2 of 3 rows are Proposed')
    expect(proposedWords([{ status: 'missing' }])).toBe('')
  })
})
