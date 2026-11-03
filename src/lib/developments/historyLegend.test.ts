import { describe, expect, it } from 'vitest'
import { HISTORY_CHIPS, HISTORY_SOURCES, lineMatchesChip } from './history'
import { plainWordsFailures } from '../plainWords'
import { HISTORY_LEGEND, HISTORY_LEGEND_INTRO, historyMark, legendByChip, legendChipLabel } from './historyLegend'
import type { ChangeKind, ChangeLine } from './whatChanged'

const KINDS: ChangeKind[] = ['asked', 'answered', 'sent', 'contact', 'won', 'lost', 'plans', 'stage', 'billed', 'paid', 'note', 'new_bid', 'new_job', 'entry']

const line = (kind: ChangeKind, source?: ChangeLine['source']): ChangeLine => ({ id: 'x', at: '2026-11-02T15:00:00Z', kind, verb: '', about: { kind: 'site', id: null, label: '' }, detail: null, by: null, waitingDays: null, ...(source ? { source } : {}) })

describe('historyMark: one mark per kind', () => {
  it('gives every kind a glyph and a tone, and an entry its source’s', () => {
    for (const k of KINDS) {
      const m = historyMark(k)
      expect(m.glyph.length).toBeGreaterThan(0)
      expect(['grey', 'blue', 'green', 'red', 'amber']).toContain(m.tone)
    }
    expect(historyMark('entry', 'email')).toEqual({ glyph: '✉', tone: 'amber' })
    expect(historyMark('entry', 'note')).toEqual({ glyph: '✎', tone: 'grey' })
    expect(historyMark('entry')).toEqual({ glyph: '✎', tone: 'grey' })
    expect(historyMark('stage')).toEqual({ glyph: '◆', tone: 'blue' })
    expect(historyMark('lost').tone).toBe('red')
  })
})

describe('the legend', () => {
  it('names every source and every kind once, under the chip that narrows to it', () => {
    for (const s of HISTORY_SOURCES) expect(HISTORY_LEGEND.find((r) => r.key === s.key || (s.key === 'note' && r.key === 'note')), s.key).toBeTruthy()
    for (const r of HISTORY_LEGEND) {
      const probe = r.key === 'note' ? line('note') : ['email', 'call', 'text', 'on_site', 'letter'].includes(r.key) ? line('entry', r.key as ChangeLine['source']) : line(r.key as ChangeKind)
      expect(lineMatchesChip(probe, r.chip), `${r.key} under ${r.chip}`).toBe(true)
      expect(legendChipLabel(r.chip).length).toBeGreaterThan(0)
    }
    expect(new Set(HISTORY_LEGEND.map((r) => r.key)).size).toBe(HISTORY_LEGEND.length)
  })
  it('groups by chip in the chips’ own order, leaving Everything out', () => {
    const groups = legendByChip()
    expect(groups.map((g) => g.chip)).toEqual(HISTORY_CHIPS.filter((c) => c.key !== 'all').map((c) => c.key))
    expect(groups.find((g) => g.chip === 'money')!.rows.map((r) => r.key)).toEqual(['billed', 'paid'])
  })
  it('reads in plain words', () => {
    expect(plainWordsFailures(HISTORY_LEGEND_INTRO)).toEqual([])
    for (const r of HISTORY_LEGEND) expect(plainWordsFailures(r.words), r.key).toEqual([])
  })
})
