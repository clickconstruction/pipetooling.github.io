/**
 * The Utilization board's reads: the roster (every active person with a login), the window's
 * recorded clock sessions (paged, as the Man hours card reads them), the pay flags through
 * `list_people_pay_flags` (so a viewer with no pay access still learns who is salaried), the
 * recorded days off, and the answers through the availability door. Pure after the reads:
 * `buildUtilizationBoard` does the counting.
 *
 * Who can read other people's sessions is RLS's call (`clock_sessions select access`: dev,
 * payroll access, assistant and controller, else one's own), so a viewer the policy keeps to
 * their own rows gets a board of one.
 */
import { supabase } from '../supabase'
import { fetchAllRows } from '../supabasePaging'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { calendarYmdInAppTzFromIso, todayYmdInAppTz } from '../../utils/dateUtils'
import { fetchUserTimeOffForUsersInRange } from '../userTimeOffByCell'
import type { AvailabilityIo } from './availabilityIo'
import { buildPayFlagsIndex, type PayFlagRpcRow } from './payFlagsIndex'
import { fetchRosterPeople } from './rosterPeople'
import { buildUtilizationBoard, payWeeksEndingAt, UTILIZATION_WEEKS, type UtilizationBoard, type UtilizationPerson, type UtilizationSession } from './utilization'

const SESSION_SELECT = 'user_id, work_date, clocked_in_at, clocked_out_at, approved_at, rejected_at, revoked_at, origin'

/** The window's sessions, paged: every one not rejected or revoked, open ones included (the kernel counts today's to now). */
export async function fetchUtilizationSessions(startYmd: string, endYmd: string): Promise<UtilizationSession[]> {
  const makeQ = () =>
    supabase
      .from('clock_sessions')
      .select(SESSION_SELECT)
      .gte('work_date', startYmd)
      .lte('work_date', endYmd)
      .is('rejected_at', null)
      .is('revoked_at', null)
      .order('id')
  return fetchAllRows(
    async (from, to) => ({
      data: (await withSupabaseRetry(async () => makeQ().range(from, to), 'load utilization clock sessions')) as unknown as UtilizationSession[] | null,
      error: null,
    }),
    'load utilization clock sessions',
  )
}

export type UtilizationBoardRead = {
  board: UtilizationBoard
  /** The people the board was built over, for the office's Change hours picker. */
  people: UtilizationPerson[]
  startYmd: string
  endYmd: string
}

/** The whole board for the signed-in viewer, `weeks` pay weeks ending with the current one. */
export async function fetchUtilizationBoard(io: AvailabilityIo, opts: { weeks?: number; todayYmd?: string; nowMs?: number } = {}): Promise<UtilizationBoardRead> {
  const todayYmd = opts.todayYmd ?? todayYmdInAppTz()
  const nowMs = opts.nowMs ?? Date.now()
  const weeks = payWeeksEndingAt(todayYmd, opts.weeks ?? UTILIZATION_WEEKS)
  const startYmd = weeks[0]!.start
  const endYmd = weeks[weeks.length - 1]!.end

  const [roster, sessions, payFlagRows] = await Promise.all([
    fetchRosterPeople(supabase),
    fetchUtilizationSessions(startYmd, endYmd),
    withSupabaseRetry(async () => await supabase.rpc('list_people_pay_flags'), 'list people pay flags') as Promise<PayFlagRpcRow[] | null>,
  ])
  const flags = buildPayFlagsIndex(payFlagRows)

  const people: UtilizationPerson[] = []
  for (const r of roster) {
    if (!r.user_id || !r.has_login || r.is_digital_twin || r.is_sample || r.is_walk_tester || r.is_dev) continue
    // Someone who left inside the window keeps the weeks they worked: their archive day or end date closes their roster.
    const archivedYmd = [r.user_archived_at, r.person_archived_at].filter((v): v is string => Boolean(v)).map((iso) => calendarYmdInAppTzFromIso(iso)).sort()[0] ?? null
    const endYmd = [r.end_date, archivedYmd].filter((v): v is string => Boolean(v)).sort()[0] ?? null
    if (!r.is_active_roster && (!endYmd || endYmd < startYmd)) continue
    const f = flags.get({ personId: r.person_id, name: r.pay_name })
    people.push({
      id: r.user_id,
      name: r.pay_name,
      role: r.role ?? r.kind ?? '',
      isSalary: f?.isSalary === true,
      recordsHoursButSalary: f?.recordHoursButSalary === true,
      startYmd: r.start_date,
      endYmd,
    })
  }
  const userIds = people.map((p) => p.id)
  const [timeOff, answers] = await Promise.all([fetchUserTimeOffForUsersInRange(userIds, startYmd, endYmd), io.listAnswers(userIds)])
  // The kernel counts the same weeks the reads covered; left to its default it would count eight
  // and read the weeks outside a narrower window (an assistant's) as nothing recorded.
  const board = buildUtilizationBoard({
    todayYmd,
    nowMs,
    weeks: weeks.length,
    people,
    sessions,
    answers,
    timeOff: timeOff.data.map((t) => ({ user_id: t.user_id, startYmd: t.start_date, endYmd: t.end_date })),
  })
  return { board, people, startYmd, endYmd }
}

/** One person's own weeks for My Time: their sessions (their own rows under RLS), their days off and their answers. */
export async function fetchMyUtilization(args: { userId: string; name: string; role: string; isSalary: boolean; io: AvailabilityIo; weeks?: number }): Promise<UtilizationBoardRead> {
  const todayYmd = todayYmdInAppTz()
  const nowMs = Date.now()
  const weeks = payWeeksEndingAt(todayYmd, args.weeks ?? UTILIZATION_WEEKS)
  const startYmd = weeks[0]!.start
  const endYmd = weeks[weeks.length - 1]!.end
  const [sessions, timeOff, answers] = await Promise.all([
    withSupabaseRetry(async () => await supabase.from('clock_sessions').select(SESSION_SELECT).eq('user_id', args.userId).gte('work_date', startYmd).lte('work_date', endYmd).is('rejected_at', null).is('revoked_at', null), 'load my utilization clock sessions') as Promise<UtilizationSession[] | null>,
    fetchUserTimeOffForUsersInRange([args.userId], startYmd, endYmd),
    args.io.listAnswers([args.userId]),
  ])
  const person: UtilizationPerson = { id: args.userId, name: args.name, role: args.role, isSalary: args.isSalary, recordsHoursButSalary: false }
  const board = buildUtilizationBoard({
    todayYmd,
    nowMs,
    weeks: weeks.length,
    people: [person],
    sessions: sessions ?? [],
    answers,
    timeOff: timeOff.data.map((t) => ({ user_id: t.user_id, startYmd: t.start_date, endYmd: t.end_date })),
  })
  return { board, people: [person], startYmd, endYmd }
}
