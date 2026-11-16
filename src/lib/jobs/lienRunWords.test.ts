import { describe, expect, it } from 'vitest'
import { LIEN_RUN_ACT, LIEN_RUN_NOW_TO_MAIL, LIEN_RUN_NOW_TO_PRINT, LIEN_RUN_STEP, LIEN_RUN_THEN_TO_MAIL, LIEN_RUN_THEN_TO_PRINT, lienRunActFor, lienRunActLabel, lienRunWindowTitle } from './lienRunWords'
import { LIEN_DESK_PILES } from './lienDesk'
import { runDoorWords } from './lienDeskRun'
import { lienRunPill } from './lienRunChecklist'
import { plainWordsFailures } from '../plainWords'

describe('one name for each step between a notice’s approval and its mailing (v2.7448)', () => {
  it('names the two steps: to print until the packet prints, to mail until its mail numbers are in', () => {
    expect(LIEN_RUN_STEP).toEqual({ toPrint: 'Approved · to print', toMail: 'Approved · to mail' })
  })

  it('names the two presses by what the person does at the counter', () => {
    expect(LIEN_RUN_ACT).toEqual({ print: 'Print and mail', record: 'Enter mail numbers' })
  })
})

describe('lienRunActFor: which press the notices call for', () => {
  it('is print while anything approved is still to print, whatever is printed beside it', () => {
    expect(lienRunActFor({ toPrint: 15, printed: 0 })).toBe('print')
    expect(lienRunActFor({ toPrint: 1, printed: 8 })).toBe('print')
  })

  it('is record when only printed ones wait on their mail numbers', () => {
    expect(lienRunActFor({ toPrint: 0, printed: 4 })).toBe('record')
    expect(lienRunActFor({ toPrint: 0, printed: 1 })).toBe('record')
  })

  it('is print with nothing at all, so an empty desk keeps the first press’s name', () => {
    expect(lienRunActFor({ toPrint: 0, printed: 0 })).toBe('print')
  })
})

describe('lienRunActLabel: a press with its count', () => {
  it('print carries a bare figure after the act', () => {
    expect(lienRunActLabel('print', 15)).toBe('Print and mail 15')
    expect(lienRunActLabel('print', 1)).toBe('Print and mail 1')
  })

  it('record sets its figure off with a dot, since a bare figure after numbers would read as one of them', () => {
    expect(lienRunActLabel('record', 4)).toBe('Enter mail numbers · 4')
    expect(lienRunActLabel('record', 1)).toBe('Enter mail numbers · 1')
  })

  it('no count, null or zero reads the bare act, for both presses', () => {
    for (const act of ['print', 'record'] as const) {
      expect(lienRunActLabel(act)).toBe(LIEN_RUN_ACT[act])
      expect(lienRunActLabel(act, null)).toBe(LIEN_RUN_ACT[act])
      expect(lienRunActLabel(act, 0)).toBe(LIEN_RUN_ACT[act])
    }
    expect(lienRunActLabel('print')).toBe('Print and mail')
    expect(lienRunActLabel('record', 0)).toBe('Enter mail numbers')
  })
})

describe('lienRunWindowTitle: the act the window is open on and how many notices it holds', () => {
  it('says notices for several and notice for one, on both acts', () => {
    expect(lienRunWindowTitle('print', 6)).toBe('Print and mail · 6 notices')
    expect(lienRunWindowTitle('record', 6)).toBe('Enter mail numbers · 6 notices')
    expect(lienRunWindowTitle('print', 1)).toBe('Print and mail · 1 notice')
    expect(lienRunWindowTitle('record', 1)).toBe('Enter mail numbers · 1 notice')
  })
})

describe('where an approved notice stands, as a sentence', () => {
  it('says the step with no dot and no run in it, now and after a press still to come', () => {
    expect(LIEN_RUN_NOW_TO_PRINT).toBe('It now waits to print.')
    expect(LIEN_RUN_NOW_TO_MAIL).toBe('It now waits to mail.')
    expect(LIEN_RUN_THEN_TO_PRINT).toBe('It then waits to print.')
    expect(LIEN_RUN_THEN_TO_MAIL).toBe('It then waits to mail.')
  })

  it('every sentence reads in plain words', () => {
    for (const line of [LIEN_RUN_NOW_TO_PRINT, LIEN_RUN_NOW_TO_MAIL, LIEN_RUN_THEN_TO_PRINT, LIEN_RUN_THEN_TO_MAIL]) expect(plainWordsFailures(line), line).toEqual([])
  })
})

describe('the kernels agree on the words (v2.7448): a step or a press reads one way wherever it is drawn', () => {
  const pileLabel = (key: 'ready' | 'printed') => LIEN_DESK_PILES.find((p) => p.key === key)!.label

  it('By paper’s piles carry the two step names', () => {
    expect(pileLabel('ready')).toBe(LIEN_RUN_STEP.toPrint)
    expect(pileLabel('printed')).toBe(LIEN_RUN_STEP.toMail)
  })

  it('the title bar’s door starts with the press, with its count as the press writes it', () => {
    expect(lienRunPill({ toPrint: 15, printed: 0, mailed: 0 }).words).toBe(`${LIEN_RUN_ACT.print} 15`)
    expect(lienRunPill({ toPrint: 15, printed: 0, mailed: 0 }).words).toBe(lienRunActLabel('print', 15))
    expect(lienRunPill({ toPrint: 0, printed: 4, mailed: 0 }).words).toBe(`${LIEN_RUN_ACT.record} · 4`)
    expect(lienRunPill({ toPrint: 0, printed: 4, mailed: 0 }).words).toBe(lienRunActLabel('record', 4))
    // Some mailed: the press still comes first, then how far the mailing is.
    expect(lienRunPill({ toPrint: 15, printed: 0, mailed: 3 }).words).toBe(`${LIEN_RUN_ACT.print} 15 · 3 of 18 mailed`)
    expect(lienRunPill({ toPrint: 0, printed: 4, mailed: 3 }).words).toBe(`${LIEN_RUN_ACT.record} · 4 · 3 of 7 mailed`)
  })

  it('the door’s words are the act’s, and the door and the title bar pick the same act from the same counts', () => {
    expect(runDoorWords({ ready: 15, printed: 0, retReady: 0 })).toEqual({ act: 'print', label: LIEN_RUN_ACT.print, count: 15 })
    expect(runDoorWords({ ready: 0, printed: 4, retReady: 0 })).toEqual({ act: 'record', label: LIEN_RUN_ACT.record, count: 4 })
    // A retainage notice approved is still to print, so the door stays on the first press.
    expect(runDoorWords({ ready: 0, printed: 4, retReady: 1 })).toEqual({ act: 'print', label: LIEN_RUN_ACT.print, count: 5 })
    for (const [toPrint, printed] of [[15, 0], [2, 5], [0, 4], [0, 0]] as const) {
      const door = runDoorWords({ ready: toPrint, printed, retReady: 0 })
      expect(door.act).toBe(lienRunActFor({ toPrint, printed }))
      expect(door.label).toBe(LIEN_RUN_ACT[door.act])
      const pill = lienRunPill({ toPrint, printed, mailed: 0 }).words
      expect(pill).toBe(toPrint + printed === 0 ? '' : lienRunActLabel(door.act, door.count))
    }
  })
})
