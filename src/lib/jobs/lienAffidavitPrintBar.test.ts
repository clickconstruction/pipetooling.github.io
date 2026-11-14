import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { LIEN_PRINT_WITH_LABEL, lienAffidavitPrintBarStatus, lienPrintWithChips } from './lienAffidavitPrintBar'

describe('the print bar over the Affidavits list says each thing once (v2.7209)', () => {
  it('the status line counts what this press prints', () => {
    expect(lienAffidavitPrintBarStatus({ ready: 0, gated: 0 }).ready).toBe('None ready to print')
    expect(lienAffidavitPrintBarStatus({ ready: 1, gated: 0 }).ready).toBe('1 ready to print')
    expect(lienAffidavitPrintBarStatus({ ready: 12, gated: 0 }).ready).toBe('12 ready to print')
  })

  it('the status words keep the fact the old sentence carried: the short form, ready to file', () => {
    expect(lienAffidavitPrintBarStatus({ ready: 0, gated: 2 }).readyTip).toBe('None of the affidavits on the short form is ready to file.')
    expect(lienAffidavitPrintBarStatus({ ready: 1, gated: 0 }).readyTip).toBe('1 affidavit on the short form is ready to file.')
    expect(lienAffidavitPrintBarStatus({ ready: 12, gated: 0 }).readyTip).toBe('12 affidavits on the short form are ready to file.')
  })

  it('no held paper draws no amber press', () => {
    expect(lienAffidavitPrintBarStatus({ ready: 12, gated: 0 }).held).toBeNull()
    expect(lienAffidavitPrintBarStatus({ ready: 0, gated: 0 }).held).toBeNull()
  })

  it('one held paper: the press, its tip, the line over the narrowed list and the way back', () => {
    expect(lienAffidavitPrintBarStatus({ ready: 12, gated: 1 }).held).toEqual({
      press: '1 held, not in this print',
      tip: '1 ready affidavit is held by a gate and is left out. Its row says why.',
      showing: 'Showing the 1 held paper. Its row says why.',
      back: 'Show every paper',
    })
  })

  it('many held papers say each row says why', () => {
    expect(lienAffidavitPrintBarStatus({ ready: 12, gated: 3 }).held).toEqual({
      press: '3 held, not in this print',
      tip: '3 ready affidavits are held by a gate and are left out. Each row says why.',
      showing: 'Showing the 3 held papers. Each row says why.',
      back: 'Show every paper',
    })
    // Held papers are counted whether or not anything is left to print.
    expect(lienAffidavitPrintBarStatus({ ready: 0, gated: 3 }).held?.press).toBe('3 held, not in this print')
  })

  it('three chips under one label, and the copies say what they cost', () => {
    expect(LIEN_PRINT_WITH_LABEL).toBe('Print with')
    expect(lienPrintWithChips(14)).toEqual([
      { key: 'help_sheet', label: 'Help sheet' },
      { key: 'notice_record', label: 'Notice record' },
      { key: 'notice_copies', label: 'Notice copies, about 14 pages' },
    ])
    expect(lienPrintWithChips(1)[2]).toEqual({ key: 'notice_copies', label: 'Notice copies, 1 page' })
  })

  it('no notice that keeps its words: no copies chip', () => {
    expect(lienPrintWithChips(0).map((c) => c.key)).toEqual(['help_sheet', 'notice_record'])
  })

  it('every word is plain', () => {
    const words = [0, 1, 12].flatMap((ready) =>
      [0, 1, 3].flatMap((gated) => {
        const s = lienAffidavitPrintBarStatus({ ready, gated })
        return [s.ready, s.readyTip, ...(s.held ? [s.held.press, s.held.tip, s.held.showing, s.held.back] : [])]
      }),
    )
    for (const s of [...words, LIEN_PRINT_WITH_LABEL, ...lienPrintWithChips(14).map((c) => c.label), ...lienPrintWithChips(1).map((c) => c.label)]) expect(plainWordsFailures(s), s).toEqual([])
  })
})
