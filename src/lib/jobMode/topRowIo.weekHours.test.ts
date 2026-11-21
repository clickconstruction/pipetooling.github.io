/**
 * The week's hours the day's row reads for itself on a page with no hours card (the Short view of Job Mode).
 * The rule is the hours card's own: the week's hours for a person with a row on the board, zero for an answer
 * with nothing on the clock, and nothing for nobody to read. Every name here is made up.
 */
import { describe, expect, it, vi } from 'vitest'
import { buildUtilizationBoard, type AvailableHoursAnswer, type UtilizationPerson, type UtilizationSession } from '../people/utilization'
import { localAvailabilityIo } from '../people/availabilityIo'

let sessions: UtilizationSession[] = []
let answers: AvailableHoursAnswer[] = []
const seen: Array<{ userId: string; isSalary: boolean; salariedWeek: readonly number[] | null }> = []

vi.mock('../supabase', () => ({ supabase: {} }))
vi.mock('../paintedMap/paintedMapPressIo', () => ({ loadPaintOfficeJobId: async () => null }))
vi.mock('../people/fetchUtilizationBoard', () => ({
  fetchMyUtilization: async (args: { userId: string; name: string; role: string; isSalary: boolean; salariedWeek?: readonly number[] | null }) => {
    seen.push({ userId: args.userId, isSalary: args.isSalary, salariedWeek: args.salariedWeek ?? null })
    const me: UtilizationPerson = { id: args.userId, name: args.name, role: args.role, isSalary: args.isSalary, recordsHoursButSalary: false, salariedWeek: args.salariedWeek ?? null }
    const board = buildUtilizationBoard({ todayYmd: '2026-11-08', nowMs: Date.parse('2026-11-08T15:00:00-06:00'), people: [me], sessions, answers })
    return { board, people: [me], startYmd: '2026-09-20', endYmd: '2026-11-14' }
  },
}))

const { loadTopRowWeekHours } = await import('./topRowIo')

const punch = (from: string, to: string): UtilizationSession => ({ user_id: 'u-sup', work_date: '2026-11-08', clocked_in_at: `2026-11-08T${from}:00-06:00`, clocked_out_at: `2026-11-08T${to}:00-06:00`, approved_at: null, rejected_at: null, revoked_at: null, origin: 'user_punch' })
const me = { userId: 'u-sup', name: 'Dana Whitlow', role: 'superintendent', isSalary: false, io: localAvailabilityIo() }

describe('loadTopRowWeekHours', () => {
  it('the week so far for a person with hours on the clock', async () => {
    sessions = [punch('07:00', '11:30'), punch('12:00', '13:15')]
    answers = []
    expect(await loadTopRowWeekHours(me)).toBe(5.8)
  })

  it('zero for an answer with nothing on the clock, and nothing for nobody to read', async () => {
    sessions = []
    answers = [{ user_id: 'u-sup', hours_per_week: 38, days: null, effective_from: '2026-11-01', set_by: 'u-sup', set_at: '2026-11-01T10:00:00Z' }]
    expect(await loadTopRowWeekHours(me)).toBe(0)
    answers = []
    expect(await loadTopRowWeekHours(me)).toBeNull()
  })

  it('reads as the person and their pay setup', async () => {
    seen.length = 0
    sessions = []
    answers = []
    await loadTopRowWeekHours({ ...me, isSalary: true, salariedWeek: [0, 6, 6, 6, 6, 6, 0] })
    expect(seen).toEqual([{ userId: 'u-sup', isSalary: true, salariedWeek: [0, 6, 6, 6, 6, 6, 0] }])
  })
})
