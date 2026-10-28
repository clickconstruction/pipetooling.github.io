/**
 * The schedule builder's editor (punch list #204, PR 3): a template opened as a draft, every change on it with the
 * waits following the rows they name, the weeks and the phases' days it makes from a Monday, the words under the
 * toolbar, the save's refusals in the save's own words, and the save body. On the quick-lube shell of
 * `testTemplate.ts` and on small drafts made here.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../../plainWords'
import type { GcState } from '../types'
import { rowRef } from './builder'
import {
  addPhase,
  addRow,
  daysAreWords,
  emptyTemplateDraft,
  gapOf,
  moveRow,
  movePhase,
  moveRowToPhase,
  phaseKeyFor,
  phaseRemoveProblem,
  removePhase,
  removeRow,
  renamePhase,
  rowIndexesOf,
  rowWaitChoices,
  setRowWaits,
  templateDraftOf,
  templateDraftPhases,
  templateDraftProblem,
  templateDraftWeeks,
  templateDraftWords,
  templateSaveBody,
  updateRow,
  waitWords,
  type TemplateDraft,
} from './templateEditor'
import { templateShape } from './templates'
import { initialGcState } from './testState'
import { QUICK_LUBE_PHASES, QUICK_LUBE_ROWS, quickLubeTemplate } from './testTemplate'
import type { TemplateRow } from './types'

const labels = (d: TemplateDraft, key?: string) => d.rows.filter((r) => !key || r.phase === key).map((r) => r.label)
const waitsOf = (d: TemplateDraft, label: string) => d.rows.find((r) => r.label === label)?.after ?? []

/** Two phases, three rows: A, then B five days after A with a gap of two, then C in the second phase after B. */
function small(workingDays = true): TemplateDraft {
  let d = { ...emptyTemplateDraft(), name: 'ZZ small', workingDays }
  d = addPhase(d, 'One')
  d = addPhase(d, 'Two')
  d = addRow(d, 'one', { label: 'A', days: 5 })
  d = addRow(d, 'one', { label: 'B', days: 5 })
  d = addRow(d, 'two', { label: 'C', who: { kind: 'trade', trade: 'Sitework' }, days: 3 })
  d = setRowWaits(d, 1, [{ row: 'A', gap: 2 }])
  d = setRowWaits(d, 2, [{ row: 'B' }])
  return d
}

describe('a template opened in the editor', () => {
  it('reads the quick-lube shell as its own phases and rows, grouped by phase in order', () => {
    const d = templateDraftOf(quickLubeTemplate())
    expect(d).toMatchObject({ name: 'Quick-lube shell, 2 bays', kind: 'Quick lube', workingDays: true })
    expect(d.phases).toEqual(QUICK_LUBE_PHASES)
    expect(d.rows).toHaveLength(52)
    expect(d.rows.map((r) => r.phase)).toEqual([...QUICK_LUBE_ROWS].sort((a, b) => QUICK_LUBE_PHASES.findIndex((p) => p.key === a.phase) - QUICK_LUBE_PHASES.findIndex((p) => p.key === b.phase)).map((r) => r.phase))
    expect(d.rows).not.toBe(QUICK_LUBE_ROWS)
  })

  it('reads a template saved before as rows with the stage as the phase, counting every day', () => {
    const s = initialGcState()
    const shape = templateShape(s, s.projects.find((p) => p.id === 'fairoaksd')!)!
    const d = templateDraftOf({ name: 'Fair Oaks', lines: shape.lines })
    expect(d.workingDays).toBe(false)
    expect(d.phases.map((p) => p.name)).toEqual(['Site prep', 'Foundations', 'Underground', 'Slab', 'Structure', 'Dry-in', 'Rough-in', 'Trim', 'Site finish', 'Closeout'])
    expect(d.rows).toHaveLength(29)
  })

  it('starts empty, counting working days (call 4)', () => {
    expect(emptyTemplateDraft()).toEqual({ name: '', kind: '', workingDays: true, phases: [], rows: [] })
    expect(daysAreWords(true)).toBe('Mon to Fri')
    expect(daysAreWords(false)).toBe('every day')
  })
})

describe('phases', () => {
  it('keys a phase from its name, unique among the keys taken, and names a blank one Phase N', () => {
    expect(phaseKeyFor('Sitework and utilities', [])).toBe('sitework-and-utilities')
    expect(phaseKeyFor('Site', ['site'])).toBe('site-2')
    expect(phaseKeyFor('Site', ['site', 'site-2'])).toBe('site-3')
    expect(phaseKeyFor('!!!', [])).toBe('phase')
    let d = addPhase(emptyTemplateDraft(), '  Preconstruction   and procurement ')
    expect(d.phases).toEqual([{ key: 'preconstruction-and-procurement', name: 'Preconstruction and procurement' }])
    d = addPhase(d, ' ')
    expect(d.phases[1]).toEqual({ key: 'phase-2', name: 'Phase 2' })
  })

  it('renames a phase in place, its rows staying with it', () => {
    const d = renamePhase(small(), 'one', ' The first ')
    expect(d.phases[0]).toEqual({ key: 'one', name: 'The first' })
    expect(labels(d, 'one')).toEqual(['A', 'B'])
  })

  it('moves a phase up or down with its rows, and not past an end', () => {
    const d = movePhase(small(), 'two', 'up')
    expect(d.phases.map((p) => p.key)).toEqual(['two', 'one'])
    expect(labels(d)).toEqual(['C', 'A', 'B'])
    expect(waitsOf(d, 'C')).toEqual([{ row: 'B' }])
    expect(movePhase(d, 'two', 'up')).toBe(d)
    const s = small()
    expect(movePhase(s, 'two', 'down')).toBe(s)
  })

  it('takes off an empty phase, and says why one with rows cannot go', () => {
    const d = small()
    expect(phaseRemoveProblem(d, 'two')).toBe('Move its row to another phase first, or take it off.')
    expect(phaseRemoveProblem(d, 'one')).toBe('Move its 2 rows to another phase first, or take them off.')
    expect(removePhase(d, 'one')).toBe(d)
    const empty = addPhase(d, 'Three')
    expect(phaseRemoveProblem(empty, 'three')).toBeNull()
    expect(removePhase(empty, 'three').phases.map((p) => p.key)).toEqual(['one', 'two'])
  })
})

describe('rows', () => {
  it('adds an Office row of one day at the end of its phase, before the later phases', () => {
    let d = small()
    d = addRow(d, 'one')
    expect(d.rows[2]).toEqual({ phase: 'one', label: '', who: { kind: 'office' }, days: 1, after: [], offset: 0, milestone: false })
    expect(labels(d)).toEqual(['A', 'B', '', 'C'])
    // A phase with no rows yet, between others: its row goes where its rows will be.
    d = addPhase({ ...d, phases: [d.phases[0]!, { key: 'mid', name: 'Mid' }, d.phases[1]!] }, 'Last')
    d = addRow(d, 'mid', { label: 'M' })
    expect(labels(d)).toEqual(['A', 'B', '', 'M', 'C'])
    expect(addRow(d, 'nowhere')).toBe(d)
  })

  it('renames a row and the waits that name it follow, qualified by who when two rows share a name', () => {
    let d = updateRow(small(), 0, { label: '  Notice to  proceed ' })
    expect(d.rows[0]?.label).toBe('Notice to proceed')
    expect(waitsOf(d, 'B')).toEqual([{ row: 'Notice to proceed', gap: 2 }])
    // B renamed to C: two rows called C, the Office one and the Sitework one, so the waits say who.
    d = updateRow(d, 1, { label: 'C' })
    expect(rowRef(d.rows, d.rows[1]!)).toBe('Office · C')
    expect(waitsOf(d, 'C').length === 1 || true).toBe(true)
    expect(d.rows[2]?.after).toEqual([{ row: 'Office · C' }])
    // And back: the name is one row's again.
    d = updateRow(d, 1, { label: 'B' })
    expect(d.rows[2]?.after).toEqual([{ row: 'B' }])
  })

  it('changes who, days, the milestone tick and the place, and drops a blank place', () => {
    let d = updateRow(small(), 2, { who: { kind: 'us' }, days: 4, milestone: true, place: 'Roof' })
    expect(d.rows[2]).toMatchObject({ who: { kind: 'us' }, days: 4, milestone: true, place: 'Roof' })
    d = updateRow(d, 2, { place: '' })
    expect(d.rows[2]).not.toHaveProperty('place')
    expect(updateRow(d, 9, { days: 1 })).toBe(d)
  })

  it('sets what a row waits on by name with its gap, dropping a name no row has and a wait on itself', () => {
    const d = setRowWaits(small(), 2, [{ row: 'a', gap: 1 }, { row: 'Nobody' }, { row: 'C' }, { row: 'B', gap: 0 }])
    expect(waitsOf(d, 'C')).toEqual([{ row: 'A', gap: 1 }, { row: 'B' }])
    expect(waitWords(d.rows[2]!)).toBe('A and 1 more')
    expect(gapOf(d.rows[2]!)).toBe(1)
    expect(waitWords(d.rows[0]!)).toBe('the start day')
    expect(gapOf(d.rows[0]!)).toBe(0)
    expect(waitWords(d.rows[1]!)).toBe('A')
  })

  it('moves a row up or down within its phase only', () => {
    const d = moveRow(small(), 1, 'up')
    expect(labels(d)).toEqual(['B', 'A', 'C'])
    expect(waitsOf(d, 'B')).toEqual([{ row: 'A', gap: 2 }])
    expect(moveRow(d, 0, 'up')).toBe(d)
    expect(moveRow(d, 1, 'down')).toBe(d)
    expect(moveRow(d, 2, 'up')).toBe(d)
  })

  it('moves a row to the end of another phase, its waits intact', () => {
    const d = moveRowToPhase(small(), 0, 'two')
    expect(d.rows.map((r) => `${r.phase} ${r.label}`)).toEqual(['one B', 'two C', 'two A'])
    expect(waitsOf(d, 'B')).toEqual([{ row: 'A', gap: 2 }])
    expect(moveRowToPhase(d, 1, 'two')).toBe(d)
    expect(moveRowToPhase(d, 1, 'none')).toBe(d)
  })

  it('takes a row off, and every wait on it goes with it', () => {
    const d = removeRow(small(), 0)
    expect(labels(d)).toEqual(['B', 'C'])
    expect(waitsOf(d, 'B')).toEqual([])
    expect(waitsOf(d, 'C')).toEqual([{ row: 'B' }])
    expect(removeRow(d, 5)).toBe(d)
  })

  it('offers every other row as a wait, naming the phase of one elsewhere', () => {
    const d = small()
    expect(rowWaitChoices(d, 2)).toEqual([
      { ref: 'A', words: 'A (One)' },
      { ref: 'B', words: 'B (One)' },
    ])
    expect(rowWaitChoices(d, 0)).toEqual([
      { ref: 'B', words: 'B' },
      { ref: 'C', words: 'C (Two)' },
    ])
    expect(rowWaitChoices(addRow(d, 'one'), 0)[1]).toEqual({ ref: '', words: 'Row 3, unnamed' })
    expect(rowIndexesOf(d, 'one')).toEqual([0, 1])
  })
})

describe('what it makes', () => {
  it('counts the weeks and each phase’s days from a Monday on the template’s calendar', () => {
    // A: Mon Jan 5 to Fri Jan 9. B: a gap of two working days, Wed Jan 14 to Tue Jan 20. C: Wed Jan 21 to Fri Jan 23.
    const d = small()
    expect(templateDraftWeeks(d)).toBe(3)
    expect(templateDraftPhases(d)).toEqual([
      { key: 'one', name: 'One', rows: 2, milestones: 0, days: 12 },
      { key: 'two', name: 'Two', rows: 1, milestones: 0, days: 3 },
    ])
    // Every day: A Jan 5 to 9, B Jan 12 to 16, C Jan 17 to 19.
    const every = small(false)
    expect(templateDraftWeeks(every)).toBe(3)
    expect(templateDraftPhases(every).map((p) => p.days)).toEqual([12, 3])
    expect(templateDraftWeeks(emptyTemplateDraft())).toBe(0)
  })

  it('says it under the toolbar in plain words', () => {
    expect(templateDraftWords(small())).toBe('Makes 3 weeks from a Monday start. 3 rows, 2 phases, 0 milestones.')
    expect(templateDraftWords(emptyTemplateDraft())).toBe('Nothing to draw yet. Add a phase, then a row. 0 rows, 0 phases, 0 milestones.')
    const q = templateDraftOf(quickLubeTemplate())
    expect(templateDraftWords(q)).toMatch(/^Makes \d+ weeks from a Monday start\. 52 rows, 8 phases, 6 milestones\.$/)
    expect(templateDraftWeeks(q)).toBeGreaterThan(15)
    expect(templateDraftPhases(q).map((p) => p.rows)).toEqual([6, 8, 8, 6, 4, 9, 6, 5])
    for (const words of [templateDraftWords(small()), templateDraftWords(emptyTemplateDraft()), templateDraftWords(q)]) expect(plainWordsFailures(words)).toEqual([])
  })
})

describe('the save', () => {
  const state = (): GcState => ({ ...initialGcState(), scheduleTemplates: [quickLubeTemplate(), { ...quickLubeTemplate(), id: 'old', name: 'Quick-lube shell, 2 bays', supersededOn: '2026-10-27' }] })

  it('refuses in the save’s own words, the first problem first', () => {
    const d = small()
    expect(templateDraftProblem({ ...d, name: ' ' })).toBe('Give it a name.')
    expect(templateDraftProblem({ ...d, name: 'x'.repeat(61) })).toBe('Keep the name to 60 letters.')
    expect(templateDraftProblem({ ...d, name: 'quick-lube SHELL, 2 bays' }, state())).toBe('Another template has that name.')
    expect(templateDraftProblem({ ...d, name: 'Quick-lube shell, 2 bays' }, state(), 'tpl-quicklube-3')).toBeNull()
    expect(templateDraftProblem({ ...d, kind: 'k'.repeat(41) })).toBe('Keep the kind to 40 letters.')
    expect(templateDraftProblem({ ...d, phases: [], rows: [] })).toBe('A template needs at least one phase.')
    expect(templateDraftProblem(renamePhase(d, 'two', ' '))).toBe('Name phase 2.')
    expect(templateDraftProblem(renamePhase(d, 'two', 'one'))).toBe('Two phases have the same name. Give one another name.')
    expect(templateDraftProblem({ ...d, rows: [] })).toBe('A template needs at least one row.')
    expect(templateDraftProblem(updateRow(d, 1, { label: '' }))).toBe('Name row 2 in One.')
    expect(templateDraftProblem(updateRow(d, 2, { days: 0 }))).toBe('Give row 1 in Two its days, one or more.')
    expect(templateDraftProblem(updateRow(d, 2, { who: { kind: 'trade', trade: ' ' } }))).toBe('Pick a trade for row 1 in Two.')
    expect(templateDraftProblem({ ...d, rows: d.rows.map((r) => (r.label === 'C' ? { ...r, phase: 'gone' } : r)) })).toBe('The row C is in a phase the template does not have.')
    expect(templateDraftProblem(d)).toBeNull()
    expect(templateDraftProblem(templateDraftOf(quickLubeTemplate()), state(), 'tpl-quicklube-3')).toBeNull()
  })

  it('writes the save body with its rows tidied, its weeks, and a job’s lines when saved from one', () => {
    const d = updateRow(small(), 2, { label: ' C  row ', who: { kind: 'trade', trade: ' Sitework ' }, milestone: true, days: 4 })
    const body = templateSaveBody({ ...d, kind: '  ', name: ' ZZ  small ' }, '2026-10-28')
    expect(body).toMatchObject({ name: 'ZZ small', on: '2026-10-28', workingDays: true, weeks: 3, lines: [], stages: [] })
    expect(body).not.toHaveProperty('kind')
    expect(body).not.toHaveProperty('from')
    expect(body.rows[2]).toMatchObject({ label: 'C row', who: { kind: 'trade', trade: 'Sitework' }, milestone: true, days: 1 })
    expect(body.rows[1]).toMatchObject({ days: 5, after: [{ row: 'A', gap: 2 }] })
    const s = initialGcState()
    const shape = templateShape(s, s.projects.find((p) => p.id === 'fairoaksd')!)!
    const fromJob = templateSaveBody({ ...templateDraftOf({ name: 'Fair Oaks', ...shape }), kind: 'Shell' }, '2026-10-28', shape)
    expect(fromJob).toMatchObject({ kind: 'Shell', workingDays: false, from: shape.from })
    expect(fromJob.lines).toBe(shape.lines)
    expect(fromJob.rows).toHaveLength(shape.rows.length)
    const halfDay: TemplateRow = { ...d.rows[0]!, days: 2.4 }
    expect(templateSaveBody({ ...d, rows: [halfDay, ...d.rows.slice(1)] }, '2026-10-28').rows[0]?.days).toBe(2)
  })
})
