import { describe, expect, it } from 'vitest'
import { CALL_SCRIPT_RECORDS_ASK, CALL_SCRIPT_RECORDS_DOOR, callScriptLetterLine, callScriptOpeningLine, callScriptOpenings, callScriptRecordsJob, genericCallFacts } from './lienCallScript'
import type { CallLetterFacts } from './lienOwnerCallScript'

const fmt = { day: (ymd: string) => ymd, money: (n: number) => `$${n}` }
const letter: CallLetterFacts = { jobLabel: '273 · Dunmere (Linmoor)', property: '1204 Linmoor Dr, Austin, TX', ownerName: 'Dunmere Linmoor', gcName: 'RLC- Dunmere Mallin', us: 'Click', instrument: 'notice_53_056', letterKind: 'residential', mailedOn: '2026-09-08', amount: '$17,585.00', months: 'April, June, July and August 2026', signer: 'Malachi Whites, Master Plumber', phone: '(512) 360-0599', affidavitBy: '2026-11-16' }

describe('lienCallScript (v2.4731)', () => {
  it('opens with counsel’s line for the letter in hand, and reads plainly with no job under the reader', () => {
    expect(callScriptOpeningLine(letter, fmt)).toBe('Thanks for calling about the notice on 1204 Linmoor Dr. First — you did nothing wrong by paying RLC- Dunmere Mallin. You didn’t hire us, and this is not a lawsuit. Tell me where things stand with RLC- Dunmere Mallin and I’ll tell you exactly what this means for you.')
    expect(callScriptOpeningLine(genericCallFacts('Click'), fmt)).toBe('Thanks for calling about the notice on your property. First — you did nothing wrong by paying your builder. You didn’t hire us, and this is not a lawsuit. Tell me where things stand with your builder and I’ll tell you exactly what this means for you.')
    expect(genericCallFacts('  ').us).toBe('us')
  })
  it('the six openings carry the call sheet’s own next lines and cites', () => {
    const o = callScriptOpenings(letter, fmt)
    expect(o.map((x) => x.key)).toEqual(['paid', 'owes', 'sued', 'gc_silent', 'pay_us', 'callback'])
    expect(o[0]).toMatchObject({ chip: 'Paid my builder', words: '“I already paid RLC- Dunmere Mallin — everything.”', cites: '§ 53.084(a) · § 53.101' })
    expect(o[0]!.say).toMatch(/^Then what you already paid is between us and RLC- Dunmere Mallin/)
    expect(o[1]!.say).toContain('hold back $17,585.00')
    expect(o[4]!.cites).toBe('counsel’s sign-off on this job first')
    expect(callScriptOpenings(genericCallFacts('Click'), fmt)[1]!.say).toContain('hold back the amount on the letter')
  })
  it('sums the letter in their hand on one line', () => {
    expect(callScriptLetterLine(letter, fmt)).toBe('mailed 2026-09-08 · claims $17,585.00 · for April, June, July and August 2026 · affidavit by 2026-11-16')
    expect(callScriptLetterLine({ ...letter, mailedOn: '', affidavitBy: '', months: '', instrument: 'retainage_53_057' }, fmt)).toBe('not mailed yet · claims $17,585.00 · retainage')
  })
})

describe('the call window’s records row (v2.7780)', () => {
  it('asks in the owner’s words and keeps the door’s own name', () => {
    expect(CALL_SCRIPT_RECORDS_ASK).toBe('Asking what we billed and what was paid?')
    expect(CALL_SCRIPT_RECORDS_DOOR).toBe('An owner asked for records')
  })
  it('hands the records window the paper open in By paper’s pane, by its kind', () => {
    const open = { notice: 'j1', affidavit: 'j2', retainage: 'j3' }
    expect(callScriptRecordsJob({ kind: 'notice', ...open })).toBe('j1')
    expect(callScriptRecordsJob({ kind: 'affidavit', ...open })).toBe('j2')
    expect(callScriptRecordsJob({ kind: 'retainage', ...open })).toBe('j3')
    expect(callScriptRecordsJob({ kind: 'affidavit', notice: 'j1', affidavit: null, retainage: null })).toBeNull()
  })
  it('hands none from a view with no pane, whatever notice the desk still holds: the window starts at the owner picker', () => {
    for (const kind of ['next', 'calendar', 'timeline']) {
      expect(callScriptRecordsJob({ kind, notice: 'j1', affidavit: 'j2', retainage: 'j3' })).toBeNull()
    }
  })
})
