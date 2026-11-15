/**
 * GC difficulty rating (punch list #357, PR 3): the reads behind the Paying scale, for one GC. The pay-speed read is
 * the Pipeline's own (`get_billed_customer_pay_speeds`; refused outside the money roles, which reads as "could not be
 * read"), the GC pace here is the Collect desk's (`payPace.ts` over `loadPaceFacts`), and the calendar is the GC's
 * own (`payCalendarIo.ts`). Each read fails on its own: a GC pace or a calendar that cannot be read leaves that part
 * out, and only the pay-speed read decides whether the point can be read at all.
 */
import { supabase } from '../supabase'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { parsePaySpeedsRpc, type PaySpeedData } from '../jobs/billedExpectedPay'
import { calendarSourceFor, indexPayCalendars } from '../jobs/payCalendar'
import { loadPayerPayCalendars } from '../jobs/payCalendarIo'
import { gcPaceHere, PAY_SPEED_MIN_SAMPLES } from '../jobs/payPace'
import { loadPaceFacts } from '../jobs/payPaceIo'
import type { DifficultyPayingInputs } from './difficultyPaying'

async function readPaySpeeds(): Promise<PaySpeedData | null> {
  const { data, error } = await supabase.rpc('get_billed_customer_pay_speeds' as never)
  if (error) throw error
  return parsePaySpeedsRpc(data as unknown)
}

export async function loadDifficultyPayingInputs(customerId: string): Promise<DifficultyPayingInputs> {
  const todayYmd = todayYmdInAppTz()
  const [speeds, facts, calendars] = await Promise.all([
    readPaySpeeds().catch(() => null),
    loadPaceFacts(supabase).catch(() => null),
    loadPayerPayCalendars(supabase, customerId).catch(() => []),
  ])
  const pace = speeds && facts ? gcPaceHere(speeds, facts.gcPayerIds, PAY_SPEED_MIN_SAMPLES) : { stat: null, payers: 0 }
  return {
    readable: speeds != null,
    own: speeds?.customers[customerId] ?? null,
    receipts: speeds?.receipts[customerId] ?? [],
    gcPace: pace.stat ? { medianDays: pace.stat.medianDays, payers: pace.payers } : null,
    calendar: calendarSourceFor(indexPayCalendars(calendars), { payerId: customerId }).calendar,
    todayYmd,
  }
}
