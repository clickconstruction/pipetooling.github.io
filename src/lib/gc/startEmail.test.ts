import { describe, expect, it } from 'vitest'
import { boardStateFromRows } from './boardRows'
import { awardedClinicBoardRows } from './boardTestRows'
import { pWeekday } from './portalI18n'
import { startEmailRequest, startRecipients } from './startEmail'

/** The clinic, its sitework awarded to Lonestar (Hillside's quote carried and not awarded), started with work set to begin. */
function started(startDate: string | null) {
  const base = awardedClinicBoardRows()
  return boardStateFromRows({ ...base, boardDates: { p1: { ...base.boardDates.p1!, started_on: '2026-10-10', start_date: startDate } } })
}

describe('Start’s email (the Board’s B6-c-ii)', () => {
  it('goes to each company awarded a trade on the job, never to one only carried', () => {
    expect(startRecipients(started(null), 'p1')).toEqual([{ companyId: 'lonestar', company: 'Lonestar Earthworks', trades: ['Sitework'] }])
    expect(startEmailRequest(started(null), 'p1', 'hillside', 'en')).toBeNull()
  })

  it('says the day work begins, the company’s part and how it reports, in the Portal’s words without the greeting', () => {
    expect(startEmailRequest(started('2026-10-19'), 'p1', 'lonestar', 'en')).toEqual({
      companyId: 'lonestar',
      kind: 'start',
      key: 'p1:start',
      projectId: 'p1',
      lang: 'en',
      subject: `Work starts on Hill Country Clinic ${pWeekday('en', '2026-10-19')}`,
      lines: [`Hill Country Clinic is started. Work begins ${pWeekday('en', '2026-10-19')}.`, 'Your part is Sitework.', 'Report your work in your portal as it goes. That is how you ask for each draw.'],
    })
  })

  it('says it is started when no day is set, and in Spanish for a company that reads Spanish', () => {
    expect(startEmailRequest(started(null), 'p1', 'lonestar', 'en')).toMatchObject({ subject: 'Hill Country Clinic is started', lines: ['Hill Country Clinic is started.', 'Your part is Sitework.', expect.any(String)] })
    expect(startEmailRequest(started('2026-10-19'), 'p1', 'lonestar', 'es')).toMatchObject({ subject: `El trabajo en Hill Country Clinic empieza el ${pWeekday('es', '2026-10-19')}`, lines: [expect.any(String), 'Su parte es Sitework.', expect.any(String)] })
  })

  it('keys every company’s email by the job, so a second Start sends nothing', () => {
    expect(startEmailRequest(started(null), 'p1', 'lonestar', 'en')?.key).toBe('p1:start')
  })
})
