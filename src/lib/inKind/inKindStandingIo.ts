/**
 * Where every customer stands on paying in kind, read once and shared (punch list #301, mock-up 2): the Customers
 * list, the customer's page, a job and the Bill window all read the same answer. The read is the In kind page's own,
 * with the bank for the monthly deals, held for a minute and dropped when a deal changes.
 */
import { isMonthlyArrangement } from './inKindLedger'
import { monthsWithBank, type BankPaidLine } from './inKindBank'
import { inKindStandings, type InKindStanding } from './inKindChip'
import { IN_KIND_CHANGED_EVENT } from './inKindCreditsDue'
import { loadAllInKind, loadInKindArrangement, loadInKindBankLines, setInKindArrangementJobs } from './inKindIo'
import { inKindListRows } from './inKindList'
import { todayYmdInAppTz } from '../../utils/dateUtils'

export async function readInKindStandings(): Promise<Map<string, InKindStanding>> {
  const deals = await loadAllInKind()
  const bank = new Map<string, BankPaidLine[] | null>()
  await Promise.all(
    deals.map(async (d) => {
      const a = d.arrangement
      if (a.ended_at || !isMonthlyArrangement(a) || !a.starts_on || !a.bank_payee.trim()) return
      try {
        bank.set(a.id, await loadInKindBankLines(a.bank_payee, a.starts_on))
      } catch {
        bank.set(a.id, null)
      }
    }),
  )
  const today = todayYmdInAppTz()
  const monthsById = new Map(deals.map((d) => [d.arrangement.id, monthsWithBank(d.arrangement, d.lines, bank.get(d.arrangement.id), today)]))
  return inKindStandings(inKindListRows(deals, monthsById))
}

const HOLD_MS = 60_000
let held: { at: number; read: Promise<Map<string, InKindStanding>> } | null = null

/** The shared read. A failed read is not held, so the next caller tries again. */
export function loadInKindStandings(): Promise<Map<string, InKindStanding>> {
  if (held && Date.now() - held.at < HOLD_MS) return held.read
  const read = readInKindStandings()
  held = { at: Date.now(), read }
  read.catch(() => {
    if (held?.read === read) held = null
  })
  return read
}

export function dropInKindStandings(): void {
  held = null
}

/** Puts one more job on a deal, beside the jobs already on it. */
export async function addJobToInKindArrangement(arrangementId: string, jobId: string): Promise<void> {
  const deal = await loadInKindArrangement(arrangementId)
  if (!deal) throw new Error('That arrangement is gone.')
  const ids = new Set(deal.jobs.map((j) => j.id))
  ids.add(jobId)
  await setInKindArrangementJobs(arrangementId, [...ids])
  dropInKindStandings()
  window.dispatchEvent(new Event(IN_KIND_CHANGED_EVENT))
}
