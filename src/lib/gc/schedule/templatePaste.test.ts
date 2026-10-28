/**
 * The schedule builder's paste (punch list #204, PR 4): rows pasted as a spreadsheet pastes them, read line by line
 * with what could not be read said, then put on a draft with the waits by name.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../../plainWords'
import { rowRef } from './builder'
import { addPhase, addRow, emptyTemplateDraft, templateDraftOf, templateDraftProblem } from './templateEditor'
import { applyPaste, pasteWords, readPastedRows, whoFromWords } from './templatePaste'
import { quickLubeTemplate } from './testTemplate'

const T = '\t'
const PASTE = [
  ['Phase', 'Row', 'Who', 'Days', 'Waits on', 'Gap', 'Milestone'].join(T),
  ['Preconstruction and procurement', 'Notice to proceed', 'Office', '5', '', '', ''].join(T),
  ['', 'Submittals and permits', 'Office', '15', 'Notice to proceed', '', ''].join(T),
  ['', 'Start date', 'office', '', 'Notice to proceed', '5', 'yes'].join(T),
  ['Sitework and utilities', 'Mobilize', 'Sitework', '3', 'Start date', '0', 'no'].join(T),
  ['', 'Underground sanitary sewer', 'Us', '15', 'Mobilize', '1', ''].join(T),
  ['', 'Site electrical conduits', 'Electrical', '5', 'Underground sanitary sewer', '', ''].join(T),
  ['', 'Roof on', 'Roofing', '1', 'Site electrical conduits', '', 'x'].join(T),
].join('\n')

describe('reading a paste', () => {
  it('reads the rows, the phases in order, who, days, waits with gaps and the milestone marks, skipping the heading', () => {
    const r = readPastedRows(PASTE)
    expect(r.phases).toEqual(['Preconstruction and procurement', 'Sitework and utilities'])
    expect(r.rows).toHaveLength(7)
    expect(r.held).toEqual([])
    expect(r.dropped).toEqual([])
    expect(r.rows[0]).toMatchObject({ line: 2, phase: 'Preconstruction and procurement', label: 'Notice to proceed', who: { kind: 'office' }, days: 5, milestone: false, wait: null })
    expect(r.rows[1]).toMatchObject({ phase: 'Preconstruction and procurement', wait: { on: { pasted: 0 }, gap: 0 } })
    // A milestone is one day whatever the days cell says, and its wait keeps the gap.
    expect(r.rows[2]).toMatchObject({ label: 'Start date', days: 1, milestone: true, wait: { on: { pasted: 0 }, gap: 5 } })
    expect(r.rows[3]).toMatchObject({ phase: 'Sitework and utilities', who: { kind: 'trade', trade: 'Sitework' }, wait: { on: { pasted: 2 }, gap: 0 } })
    expect(r.rows[4]).toMatchObject({ who: { kind: 'us' }, days: 15, wait: { on: { pasted: 3 }, gap: 1 } })
    expect(r.rows[6]).toMatchObject({ who: { kind: 'trade', trade: 'Roofing' }, milestone: true })
    expect(pasteWords(r)).toEqual(['Read 7 rows in 2 phases, 2 of them dates to meet.'])
  })

  it('reads who in the office’s words', () => {
    expect(whoFromWords('')).toEqual({ kind: 'office' })
    expect(whoFromWords(' OFFICE ')).toEqual({ kind: 'office' })
    expect(whoFromWords('us')).toEqual({ kind: 'us' })
    expect(whoFromWords('Our own crew')).toEqual({ kind: 'us' })
    expect(whoFromWords(' Fire  sprinkler ')).toEqual({ kind: 'trade', trade: 'Fire sprinkler' })
  })

  it('holds a line it cannot read and says why, and reads the rest', () => {
    const r = readPastedRows(['Just words with no tab', ['', 'No phase yet', 'Office', '2'].join(T), ['One', '', 'Office', '2'].join(T), ['One', 'Bad days', 'Office', 'five'].join(T), ['One', 'Bad gap', 'Office', '2', 'Good', 'two'].join(T), ['One', 'Good', 'Office', '2'].join(T), '', ['', 'Zero days', 'Office', '0'].join(T)].join('\n'))
    expect(r.rows.map((x) => x.label)).toEqual(['Good'])
    expect(r.held).toEqual([
      { line: 1, why: 'has no tab between the phase and the row' },
      { line: 2, why: 'has no phase, and no line above it names one' },
      { line: 3, why: 'has no row name' },
      { line: 4, why: 'needs its days as a whole number, one or more' },
      { line: 5, why: 'needs its gap as a whole number' },
      { line: 8, why: 'needs its days as a whole number, one or more' },
    ])
    const words = pasteWords(r)
    expect(words[0]).toBe('Read 1 row in 1 phase.')
    expect(words[1]).toBe('6 lines could not be read.')
    expect(words[2]).toBe('Line 1 has no tab between the phase and the row.')
    expect(words).toHaveLength(8)
    for (const w of words) expect(plainWordsFailures(w)).toEqual([])
  })

  it('drops a wait on a row nobody is called and says so, and finds one of the draft’s rows by name', () => {
    const d = addRow(addPhase(emptyTemplateDraft(), 'Precon'), 'precon', { label: 'Notice to proceed', days: 5 })
    const r = readPastedRows([['Site', 'Mobilize', 'Sitework', '3', 'notice to proceed', '2'].join(T), ['', 'Grading', 'Sitework', '7', 'Slab pour', ''].join(T)].join('\n'), d.rows)
    expect(r.rows[0]?.wait).toEqual({ on: { existing: 'Notice to proceed' }, gap: 2 })
    expect(r.rows[1]?.wait).toBeNull()
    expect(r.dropped).toEqual([{ line: 2, waitsOn: 'Slab pour' }])
    expect(pasteWords(r)[1]).toBe('Line 2 waits on Slab pour, which no row is called. It starts on the start day.')
    expect(pasteWords(readPastedRows(''))).toEqual(['No row read yet.'])
  })
})

describe('the paste on a draft', () => {
  it('adds the phases and rows to an empty draft, each wait by name with its gap, and the draft can be saved', () => {
    const d = applyPaste({ ...emptyTemplateDraft(), name: 'ZZ pasted' }, readPastedRows(PASTE))
    expect(d.phases).toEqual([
      { key: 'preconstruction-and-procurement', name: 'Preconstruction and procurement' },
      { key: 'sitework-and-utilities', name: 'Sitework and utilities' },
    ])
    expect(d.rows.map((r) => `${r.phase}: ${r.label}`)).toEqual([
      'preconstruction-and-procurement: Notice to proceed',
      'preconstruction-and-procurement: Submittals and permits',
      'preconstruction-and-procurement: Start date',
      'sitework-and-utilities: Mobilize',
      'sitework-and-utilities: Underground sanitary sewer',
      'sitework-and-utilities: Site electrical conduits',
      'sitework-and-utilities: Roof on',
    ])
    expect(d.rows[2]).toMatchObject({ after: [{ row: 'Notice to proceed', gap: 5 }], milestone: true, days: 1 })
    expect(d.rows[4]).toMatchObject({ after: [{ row: 'Mobilize', gap: 1 }], who: { kind: 'us' } })
    expect(d.rows[6]).toMatchObject({ after: [{ row: 'Site electrical conduits' }] })
    expect(templateDraftProblem(d)).toBeNull()
  })

  it('puts the rows on a draft that has phases: a phase matched by name takes its rows at its end, a wait may name the draft’s own row, and a shared name is qualified', () => {
    const q = templateDraftOf(quickLubeTemplate())
    const before = q.rows.length
    const r = readPastedRows([['sitework AND utilities', 'Site lighting bases', 'Electrical', '2', 'Notice to proceed and precon meeting', '', ''].join(T), ['Landscape', 'Underground', 'Landscaping', '4', 'Site lighting bases', '1', ''].join(T)].join('\n'), q.rows)
    expect(r.rows[0]?.wait).toEqual({ on: { existing: 'Notice to proceed and precon meeting' }, gap: 0 })
    const d = applyPaste(q, r)
    expect(d.phases.map((p) => p.name)).toEqual([...q.phases.map((p) => p.name), 'Landscape'])
    expect(d.rows).toHaveLength(before + 2)
    const siteRows = d.rows.filter((x) => x.phase === 'site')
    expect(siteRows[siteRows.length - 1]).toMatchObject({ label: 'Site lighting bases', after: [{ row: 'Notice to proceed and precon meeting' }] })
    // Two rows called Underground now: ours in the shell and Landscaping's pasted one, so the wait on the new one says who.
    const pasted = d.rows[d.rows.length - 1]!
    expect(pasted).toMatchObject({ phase: 'landscape', label: 'Underground', who: { kind: 'trade', trade: 'Landscaping' }, after: [{ row: 'Site lighting bases', gap: 1 }] })
    expect(rowRef(d.rows, pasted)).toBe('Landscaping · Underground')
  })
})
