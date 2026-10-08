import { describe, expect, it } from 'vitest'
import { benchAnchor, followUpsToCall } from './tradeViews'
import { boardStateFromRows } from './boardRows'
import { clinicBoardRows } from './boardTestRows'

describe('the dev views’ shared rules', () => {
  it('a trade card’s id is the trade in lower case with dashes', () => {
    expect(benchAnchor('Fire sprinkler')).toBe('gc-bench-fire-sprinkler')
    expect(benchAnchor('HVAC / Controls')).toBe('gc-bench-hvac-controls')
  })

  it('Follow up counts an ask whose promised day passed, and not one waiting on a day still to come', () => {
    expect(followUpsToCall(boardStateFromRows(clinicBoardRows()))).toBe(1)
    const later = clinicBoardRows()
    later.contacts = later.contacts.map((c) => (c.promised_by ? { ...c, promised_by: '2026-10-12' } : c))
    expect(followUpsToCall(boardStateFromRows(later))).toBe(0)
  })
})
