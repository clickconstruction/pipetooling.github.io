import { describe, expect, it } from 'vitest'
import {
  checkinLedgerBody,
  DEFAULT_VEHICLE_CHECKIN_SETTINGS,
  parseVehicleCheckinAnswers,
  parseVehicleCheckinSettings,
  serializeVehicleCheckinSettings,
} from './vehicleCheckinSettings'

describe('vehicleCheckinSettings', () => {
  it('defaults when missing/garbage; round-trips', () => {
    expect(parseVehicleCheckinSettings(null)).toEqual(DEFAULT_VEHICLE_CHECKIN_SETTINGS)
    expect(parseVehicleCheckinSettings('not json')).toEqual(DEFAULT_VEHICLE_CHECKIN_SETTINGS)
    const s = { assignedDays: 5, motorPoolDays: 0, questions: [{ id: 'a', label: 'Any lights on the dash?' }, { id: 'b', label: 'Any new damage or leaks?' }] }
    expect(parseVehicleCheckinSettings(serializeVehicleCheckinSettings(s))).toEqual(s)
  })
  it('cleans bad numbers and empty questions', () => {
    const s = parseVehicleCheckinSettings(JSON.stringify({ assignedDays: -3, motorPoolDays: 'x', questions: [{ id: 'a', label: '  ' }, { id: '', label: 'no id' }, { id: 'ok', label: ' Real ' }] }))
    expect(s.assignedDays).toBe(7)
    expect(s.motorPoolDays).toBe(30)
    expect(s.questions).toEqual([{ id: 'ok', label: 'Real' }])
  })
  it('parses stored answers and writes the ledger body', () => {
    const answers = parseVehicleCheckinAnswers([
      { q: 'Any lights on the dash?', flagged: true, comment: 'ABS light' },
      { q: 'Any new damage or leaks?', flagged: false, comment: '' },
      { bad: true },
    ])
    expect(answers).toHaveLength(2)
    expect(checkinLedgerBody(answers)).toEqual({ flaggedLines: ['Any lights on the dash? — “ABS light”'], allClear: false })
    expect(checkinLedgerBody(answers.map((a) => ({ ...a, flagged: false })))).toEqual({ flaggedLines: [], allClear: true })
  })
})
