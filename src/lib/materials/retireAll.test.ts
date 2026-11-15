import { describe, expect, it } from 'vitest'
import type { Container, ContainerLine } from './onSite'
import { heldWords, RETIRE_ALL_TITLE, retireAllConfirmLabel, retireAllConfirmWords, retireAllOutcomeWords, retireAllPlan, retireAllUndoHeldWords, retireAllUndoneWords, retireAllWords } from './retireAll'

const container = (id: string, label: string, kind: Container['kind'] = 'cage', extra: Partial<Container> = {}): Container => ({ id, jobId: 'j1', label, kind, where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-11-01T12:00:00Z', ...extra })
const line = (containerId: string, partName: string, onHand: number, extra: Partial<ContainerLine> = {}): ContainerLine => ({ containerId, partKey: `n:${partName.toLowerCase()}`, partId: null, partName, manufacturer: null, onHand, lastTouchedAt: null, lastTouchedBy: null, lastCountAt: null, lastCountBy: null, lastCountDiff: null, cannotFindSinceCount: 0, ...extra })

const zz1 = container('zz1', 'ZZ1')
const zz2 = container('zz2', 'ZZ2', 'box')
const zz4 = container('zz4', 'ZZ4')
const unsorted = container('u', 'Unsorted', 'unsorted')
const gone = container('old', 'ZZ3', 'cage', { retiredAt: '2026-11-10T12:00:00Z' })
const boxes = [zz1, zz2, zz4, unsorted, gone]
const lines = [line('zz1', 'Test elbow', 8), line('u', 'Pex', 40)]

describe('retireAllPlan', () => {
  it('sends the empty live boxes and holds the one with parts, with its reason', () => {
    const plan = retireAllPlan(boxes, lines)
    expect(plan.go.map((c) => c.label)).toEqual(['ZZ2', 'ZZ4'])
    expect(plan.held).toEqual([{ box: zz1, words: 'ZZ1 holds 8 Test elbow.' }])
  })

  it('never lists Unsorted or a retired box, held or going', () => {
    const plan = retireAllPlan(boxes, lines)
    const labels = [...plan.go, ...plan.held.map((h) => h.box)].map((c) => c.label)
    expect(labels).not.toContain('Unsorted')
    expect(labels).not.toContain('ZZ3')
  })

  it("lets a box go whose only lines are a Can't find or a shortfall with nothing left, as the phone's Retire does", () => {
    const plan = retireAllPlan([zz2], [line('zz2', 'Toilet', 0, { cannotFindSinceCount: 2, lastCountDiff: -2 })])
    expect(plan.go.map((c) => c.label)).toEqual(['ZZ2'])
    expect(plan.held).toEqual([])
  })

  it('keeps the order the page lists the boxes in', () => {
    const plan = retireAllPlan([zz4, zz2], [])
    expect(plan.go.map((c) => c.label)).toEqual(['ZZ4', 'ZZ2'])
  })
})

describe('heldWords', () => {
  it('names the one part a box holds, G12 holds 24 toilets', () => {
    expect(heldWords({ label: 'G12' }, [line('g12', 'toilets', 24)])).toBe('G12 holds 24 toilets.')
  })

  it('counts the pieces and the lines when a box holds more than one part', () => {
    expect(heldWords({ label: 'G12' }, [line('g12', 'toilets', 24), line('g12', 'sinks', 3), line('g12', 'gone', 0)])).toBe('G12 holds 27 pieces on 2 lines.')
  })
})

describe('retireAllWords', () => {
  it('counts the empty boxes on the button and names the held one beside it', () => {
    const w = retireAllWords(retireAllPlan(boxes, lines))
    expect(w).toEqual({ button: 'Retire 2 empty boxes · 1 holds parts ▸', foot: '1 is held. It stays here with the reason. The 2 ready ones retire now.', dead: false })
  })

  it('reads the bare count with no foot when nothing is held', () => {
    expect(retireAllWords(retireAllPlan([zz2, zz4], []))).toEqual({ button: 'Retire 2 empty boxes', foot: null, dead: false })
    expect(retireAllWords(retireAllPlan([zz2], [])).button).toBe('Retire 1 empty box')
  })

  it('is dead with its reason when every live box holds parts', () => {
    expect(retireAllWords(retireAllPlan([zz1], lines))).toEqual({ button: 'Retire ▸', foot: 'ZZ1 still holds parts. Move them or mark them used first.', dead: true })
    expect(retireAllWords(retireAllPlan([zz1, container('g2', 'G2')], [...lines, line('g2', 'Sink', 1)])).foot).toBe('Every box still holds parts. Move them or mark them used first.')
  })

  it('is dead with no foot when the job has no live box', () => {
    expect(retireAllWords(retireAllPlan([unsorted, gone], lines))).toEqual({ button: 'Retire', foot: null, dead: true })
  })
})

describe('the confirm window', () => {
  it('lists what goes, then what is held with its reason, and puts the verb with its count on the button', () => {
    const plan = retireAllPlan(boxes, lines)
    expect(RETIRE_ALL_TITLE).toBe('Retire every box on this job?')
    expect(retireAllConfirmLabel(plan)).toBe('Retire 2 empty boxes')
    expect(retireAllConfirmWords(plan)).toBe('These 2 are empty and leave this job:\nZZ2 box\nZZ4 cage\n\nOne stays with its parts:\nZZ1 holds 8 Test elbow.\n\nA retired box keeps its stickers and its history. Undo brings them all back for one minute.')
  })

  it('reads one box as a sentence and leaves the held block out when nothing is held', () => {
    const plan = retireAllPlan([zz2], [])
    expect(retireAllConfirmLabel(plan)).toBe('Retire 1 empty box')
    expect(retireAllConfirmWords(plan)).toBe('ZZ2 box is empty and leaves this job.\n\nA retired box keeps its stickers and its history. Undo brings them all back for one minute.')
  })
})

describe('retireAllOutcomeWords', () => {
  it('says what was retired and names the held box', () => {
    expect(retireAllOutcomeWords({ retired: [zz2, zz4], held: [{ box: zz1, words: 'ZZ1 holds 8 Test elbow.' }], failed: [] })).toEqual({ line: 'Retired 2 boxes. ZZ1 stays with its parts.', tone: 'success' })
  })

  it('keeps going past a failure and names it with its reason', () => {
    expect(retireAllOutcomeWords({ retired: [zz2], held: [], failed: [{ box: zz4, reason: 'The office said no.' }] })).toEqual({ line: 'Retired 1 box. 1 did not retire. ZZ4 did not retire: The office said no.', tone: 'warning' })
    expect(retireAllOutcomeWords({ retired: [], held: [{ box: zz1, words: 'x' }, { box: zz2, words: 'y' }], failed: [{ box: zz4, reason: 'Lost.' }] })).toEqual({ line: 'Nothing retired. 1 did not retire. 2 stay with their parts. ZZ4 did not retire: Lost.', tone: 'error' })
  })
})

describe('the way back', () => {
  it('counts the boxes Undo brought back', () => {
    expect(retireAllUndoneWords(1)).toBe('1 box is back on the job. Its label works again.')
    expect(retireAllUndoneWords(2)).toBe('2 boxes are back on the job. Their labels work again.')
  })

  it('names each box Undo could not bring back with the verdict\'s reason', () => {
    expect(retireAllUndoHeldWords([{ box: zz2, words: 'A live box on this job already carries ZZ2. Retire it first, or give it another stencil.' }])).toBe('ZZ2 did not come back. A live box on this job already carries ZZ2. Retire it first, or give it another stencil.')
  })
})
