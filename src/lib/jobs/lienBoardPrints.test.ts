import { describe, expect, it } from 'vitest'
import { lienBoardAffidavitPrint, lienBoardMailNumbersPress, lienBoardNoticePrint } from './lienBoardPrints'

describe('lienBoardNoticePrint — the print under the notices’ column (v2.7470, punch list #362)', () => {
  it('names how many can print now, and says how many wait on the leader’s signature with the door to them', () => {
    expect(lienBoardNoticePrint({ toPrint: 15, waits: 7, printed: 0, leaderName: 'Malachi' })).toEqual({
      kind: 'notice',
      bin: 'notice:to_print',
      act: 'print_run',
      label: 'Print and mail 8 notices',
      dead: false,
      short: { label: 'Print and mail 8 notices', left: '7 wait' },
      left: { words: '7 wait on Malachi’s signature', door: 'See them' },
      note: null,
    })
    expect(lienBoardNoticePrint({ toPrint: 1, waits: 0, printed: 3 })).toMatchObject({ label: 'Print and mail 1 notice', dead: false, left: null, short: { left: null } })
  })
  it('is dead only when nothing can print: every approved notice waits on a signature', () => {
    const side = lienBoardNoticePrint({ toPrint: 1, waits: 1, printed: 0 })!
    expect(side).toMatchObject({ label: 'Print and mail notices', dead: true, left: { words: '1 waits on the leader’s signature', door: 'See it' }, short: { left: '1 waits' } })
  })
  it('reads Enter mail numbers once every approved notice has printed, as the run’s own door does', () => {
    expect(lienBoardNoticePrint({ toPrint: 0, waits: 0, printed: 4 })).toMatchObject({ act: 'record_run', bin: 'notice:in_mail', label: 'Enter mail numbers · 4', dead: false, left: null })
  })
  it('names the bin its press empties, and hands Approved · to mail its own door only while notices still wait to print (v2.7708)', () => {
    expect(lienBoardNoticePrint({ toPrint: 2, waits: 0, printed: 4 })!.bin).toBe('notice:to_print')
    expect(lienBoardMailNumbersPress({ toPrint: 2, printed: 4 })).toEqual({ label: 'Enter mail numbers · 4' })
    // Every notice printed: the notices' own press is that door, so the bin gets no second one.
    expect(lienBoardMailNumbersPress({ toPrint: 0, printed: 4 })).toBeNull()
    expect(lienBoardMailNumbersPress({ toPrint: 2, printed: 0 })).toBeNull()
  })
  it('draws nothing when no approved notice is on the desk, and never counts more waiting than there are to print', () => {
    expect(lienBoardNoticePrint({ toPrint: 0, waits: 0, printed: 0 })).toBeNull()
    expect(lienBoardNoticePrint({ toPrint: 2, waits: 5, printed: 0 })).toMatchObject({ dead: true, left: { words: '2 wait on the leader’s signature' } })
  })
})

describe('lienBoardAffidavitPrint — the print under the affidavits’ column', () => {
  it('carries the print’s own name and count, what it leaves out, and what it prints with', () => {
    expect(lienBoardAffidavitPrint({ ready: 10, held: 2, earlierForm: 0, with: ['the help sheet', 'the notice records'] })).toEqual({
      kind: 'affidavit',
      bin: 'affidavit:ready',
      act: 'print_affidavits',
      label: 'Print 10 for notarization',
      dead: false,
      short: { label: 'Print 10 for notarization', left: '2 held' },
      left: { words: '2 held on a property fact', door: 'See them' },
      note: { words: 'Prints with the help sheet and the notice records', door: 'Change' },
    })
  })
  it('says the earlier form apart from a property fact, and lists three pages with commas', () => {
    const side = lienBoardAffidavitPrint({ ready: 3, held: 1, earlierForm: 1, with: ['the help sheet', 'the notice records', 'copies of the notices'] })!
    expect(side.left).toEqual({ words: '1 held on a property fact · 1 on the earlier form', door: 'See them' })
    expect(side.note!.words).toBe('Prints with the help sheet, the notice records and copies of the notices')
    expect(lienBoardAffidavitPrint({ ready: 3, held: 0, earlierForm: 0, with: [] })).toMatchObject({ left: null, note: { words: 'Prints the affidavits alone' }, short: { left: null } })
  })
  it('is dead when every approved paper is held, draws nothing with none approved, and says shown while a find narrows it', () => {
    expect(lienBoardAffidavitPrint({ ready: 0, held: 1, earlierForm: 0, with: ['the help sheet'] })).toMatchObject({ label: 'Print for notarization', dead: true, note: null, left: { words: '1 held on a property fact', door: 'See it' } })
    expect(lienBoardAffidavitPrint({ ready: 0, held: 0, earlierForm: 0, with: [] })).toBeNull()
    expect(lienBoardAffidavitPrint({ ready: 3, held: 0, earlierForm: 0, with: [], shown: true })!.label).toBe('Print 3 shown for notarization')
  })
})
