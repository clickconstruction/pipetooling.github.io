import { describe, expect, it } from 'vitest'
import type { Container } from './onSite'
import { bringBackLabel, broughtBackWords, retiredContainers, retiredFoldWords, retiredWords, UNDO_RETIRE_MS, unretireVerdict } from './unretire'

const container = (id: string, label: string, kind: Container['kind'], extra: Partial<Container> = {}): Container => ({ id, jobId: 'j1', label, kind, where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-10-01T12:00:00Z', ...extra })

const live = container('a1', 'A1', 'cage')
const goneA1 = container('a1-old', 'A1', 'cage', { retiredAt: '2026-10-20T15:00:00Z' })
const goneB2 = container('b2', 'B2', 'box', { retiredAt: '2026-10-28T15:00:00Z' })
const goneUnsorted = container('u', 'Unsorted', 'unsorted', { retiredAt: '2026-10-29T15:00:00Z' })
const otherJob = container('b2-other', 'B2', 'box', { jobId: 'j2' })
const all = [live, goneA1, goneB2, goneUnsorted, otherJob]

describe('unretireVerdict', () => {
  it('lets a retired box come back when no live box on the job carries its stencil', () => {
    expect(unretireVerdict(all, 'b2')).toEqual({ ok: true })
  })

  it('refuses when a live container on the same job took the stencil, naming its kind', () => {
    expect(unretireVerdict(all, 'a1-old')).toEqual({ ok: false, reason: 'clash', words: 'A live cage on this job already carries A1. Retire it first, or give it another stencil.' })
  })

  it('reads the stencil without case or spaces, as the search does', () => {
    const spaced = container('g4', 'g 4', 'box')
    const gone = container('g4-old', 'G4', 'box', { retiredAt: '2026-10-20T15:00:00Z' })
    expect(unretireVerdict([spaced, gone], 'g4-old').ok).toBe(false)
  })

  it('ignores a same stencil on another job', () => {
    expect(unretireVerdict(all, 'b2').ok).toBe(true)
  })

  it('names a box that is already live, and one that is not on the job', () => {
    expect(unretireVerdict(all, 'a1')).toEqual({ ok: false, reason: 'live', words: 'A1 is already on the job.' })
    expect(unretireVerdict(all, 'zz')).toEqual({ ok: false, reason: 'gone', words: 'That box is not on this job.' })
  })
})

describe('retiredContainers', () => {
  it('lists the retired cages and boxes newest first and never the Unsorted row', () => {
    expect(retiredContainers(all).map((c) => c.id)).toEqual(['b2', 'a1-old'])
  })
})

describe('the words', () => {
  it('read as the toast, the press and the fold do', () => {
    expect(retiredWords(goneB2)).toBe('B2 retired.')
    expect(broughtBackWords(goneB2)).toBe('B2 is back on the job. Its label works again.')
    expect(bringBackLabel(goneB2)).toBe('Bring back B2')
    expect(retiredFoldWords(2)).toBe('Retired · 2')
    expect(UNDO_RETIRE_MS).toBe(60_000)
  })
})
