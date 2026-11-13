import { describe, expect, it } from 'vitest'
import { payCalendarJobOf } from './payCalendarJob'

describe('payCalendarJobOf (punch list #341)', () => {
  it("names the job in the board's words, with its development", () => {
    expect(payCalendarJobOf({ id: 'j1', hcp_number: '1412', click_number: 'C88', job_name: ' Larkfield retail shell ', development_id: 'd1', development: { name: 'Larkfield Commons' } })).toEqual({
      id: 'j1',
      label: '1412 · Larkfield retail shell',
      developmentId: 'd1',
      developmentName: 'Larkfield Commons',
    })
  })

  it('falls back to the Click number, a dash and the word Job', () => {
    expect(payCalendarJobOf({ id: 'j2', hcp_number: null, click_number: 'C88', job_name: 'Lot 4' }).label).toBe('C88 · Lot 4')
    expect(payCalendarJobOf({ id: 'j3' })).toEqual({ id: 'j3', label: '— · Job', developmentId: null, developmentName: null })
  })
})
