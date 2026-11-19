import { describe, expect, it } from 'vitest'
import { LIEN_SERVE_FORM_WORDS, LIEN_SERVE_STAGE_WORDS, lienServeFormHead, lienServeLandingFocus, lienServeLandingSelector, lienServeStage, lienServeStageCounts, lienServeStageDoor, lienServeStageDoorWords } from './lienServeStage'

const filing = (id: string, sends: unknown[] = []) => ({ id, sends })

describe('where a filed lien’s copies stand', () => {
  it('is to print until a print is filed, or a number or a receipt says the copies went out', () => {
    expect(lienServeStage(filing('f1'), [])).toBe('print')
    expect(lienServeStage(filing('f1'), ['f1'])).toBe('record')
    expect(lienServeStage(filing('f1'), new Set(['f1']))).toBe('record')
    // Printed elsewhere and mailed: a number on the filing says so with no print on file.
    expect(lienServeStage(filing('f1', [{ recipient: 'owner', method: 'certified_mail', tracking: '9507 01' }]), [])).toBe('record')
    expect(lienServeStage(filing('f1', [{ recipient: 'owner', method: 'certified_mail', tracking: '', receipt_url: 'https://drive.example/r1' }]), null)).toBe('record')
    // A send with nothing on it, and a read that is not in, change nothing.
    expect(lienServeStage(filing('f1', [{ recipient: 'owner', method: 'certified_mail', tracking: ' ' }]), undefined)).toBe('print')
    // Another lien's print is not this one's.
    expect(lienServeStage(filing('f1'), ['f2'])).toBe('print')
    // A lien the app did not draw has no copy to print: a photocopy is mailed, so its door is the numbers' from the start.
    expect(lienServeStage({ id: 'f1', sends: [], fields: null }, [])).toBe('record')
    expect(lienServeStage({ id: 'f1', sends: [], fields: { ownerName: 'Maple Row LLC', propertyAddress: '12 Elm St', unpaidAmount: '' } }, [])).toBe('record')
    expect(lienServeStage({ id: 'f1', sends: [], fields: { ownerName: 'Maple Row LLC', propertyAddress: '12 Elm St', unpaidAmount: '900.00' } }, [])).toBe('print')
  })

  it('names each stage once, the same on every door', () => {
    expect(LIEN_SERVE_STAGE_WORDS).toEqual({ print: 'Print the copies to mail', record: 'Enter mail numbers' })
    expect([lienServeStageDoor('print'), lienServeStageDoor('record')]).toEqual(['Print the copies to mail ›', 'Enter mail numbers ›'])
    // No door for this step says Mail or Record service: neither says which half it opens.
    for (const w of Object.values(LIEN_SERVE_STAGE_WORDS)) expect(/^Mail\b|Record service/.test(w)).toBe(false)
  })

  it('names the Lien window’s form as the doors do', () => {
    expect(LIEN_SERVE_FORM_WORDS).toEqual({ opener: 'Enter mail numbers…', title: 'Enter mail numbers', day: 'Mailed on', save: 'Record the mailing', failed: 'Could not record the mailing.' })
    expect(lienServeFormHead('November 23, 2026')).toBe('Enter mail numbers for the filed copies (mail by November 23, 2026)')
    expect(lienServeFormHead(' ')).toBe('Enter mail numbers for the filed copies')
  })

  it('names the door for many liens by the stage they are at', () => {
    expect(lienServeStageDoorWords({ toPrint: 9, owed: 9 })).toEqual({ label: 'Print 9 liens’ copies ›', stage: 'print' })
    // Some of each: both halves are named with their counts, so neither door is hidden behind the other.
    expect(lienServeStageDoorWords({ toPrint: 1, owed: 11 })).toEqual({ label: 'Print 1 · Enter mail numbers 10 ›', stage: 'both' })
    expect(lienServeStageDoorWords({ toPrint: 1, owed: 1 })).toEqual({ label: 'Print 1 lien’s copies ›', stage: 'print' })
    expect(lienServeStageDoorWords({ toPrint: 0, owed: 12 })).toEqual({ label: 'Enter mail numbers · 12 ›', stage: 'record' })
    expect(lienServeStageDoorWords({ toPrint: 0, owed: 0 })).toBeNull()
  })

  it('counts a held lien as owed and never as to print', () => {
    const ready = [{ job: { filing: filing('f1') } }, { job: { filing: filing('f2') } }]
    const held = [{}]
    expect(lienServeStageCounts({ ready, held }, [])).toEqual({ toPrint: 2, owed: 3 })
    expect(lienServeStageCounts({ ready, held }, ['f1'])).toEqual({ toPrint: 1, owed: 3 })
    expect(lienServeStageCounts({ ready, held }, ['f1', 'f2'])).toEqual({ toPrint: 0, owed: 3 })
    // Held alone: nothing can print, so the door is the numbers'.
    expect(lienServeStageDoorWords(lienServeStageCounts({ ready: [], held }, []))?.label).toBe('Enter mail numbers · 1 ›')
  })

  it('lands the copies window on the half the door named', () => {
    expect(lienServeLandingSelector({ part: 'print' })).toBe('[data-lien-serve-print-part]')
    expect(lienServeLandingSelector({ part: 'numbers' })).toBe('[data-lien-serve-numbers-part] > h3')
    expect(lienServeLandingSelector({ part: 'numbers', jobId: 'j1', recipient: 'original_contractor' })).toBe('[data-lien-serve-job="j1"] [data-lien-serve-envelope="original_contractor"]')
    expect(lienServeLandingSelector({ part: 'numbers', jobId: 'j1' })).toBe('[data-lien-serve-job="j1"] [data-lien-serve-envelope="owner"]')
    // The mailed day lands on the lien's whole row, the cursor on its Mailed box (v2.7883).
    expect(lienServeLandingSelector({ part: 'numbers', jobId: 'j1', tick: true })).toBe('[data-lien-serve-job="j1"]')
    expect([lienServeLandingFocus({ part: 'numbers', jobId: 'j1', tick: true }), lienServeLandingFocus({ part: 'numbers', jobId: 'j1', cursor: true }), lienServeLandingFocus({ part: 'numbers' }), lienServeLandingFocus({ part: 'print' })]).toEqual(['input[type="checkbox"]', 'input[type="text"]', null, null])
  })
})
