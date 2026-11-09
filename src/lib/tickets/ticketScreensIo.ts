/**
 * The io the ticket screens mount (punch list #295, PR 2): one object, so a render smoke passes its own and the
 * screens never import the client. The defaults are the real reads and writes.
 */
import type { LedgerPrefixMap } from '../ledgerDisplayPrefixes'
import type { ChooseJobRow } from '../tally/chooseJobSearch'
import type { TicketJobFacts } from './ticketJobs'
import { loadJobsForTicketPick, loadTicketJobFacts, loadTicketSheetFacts, type TicketSheetFacts } from './ticketSheetIo'
import { changeTicketJob, listMyTickets, removeTicket, sendTicketPage, ticketPageUrl, type TicketPageDraft, type TicketWithPages } from './ticketsIo'

export interface TicketScreensIo {
  sheetFacts: (userId: string, prefixMap: LedgerPrefixMap) => Promise<{ facts: TicketSheetFacts; fresh: boolean }>
  allJobs: () => Promise<ChooseJobRow[]>
  list: (userId: string) => Promise<TicketWithPages[]>
  jobFacts: (jobIds: readonly string[], prefixMap: LedgerPrefixMap) => Promise<Map<string, TicketJobFacts>>
  pageUrl: (storagePath: string | null) => Promise<string | null>
  changeJob: (ticketId: string, write: { job_id: string | null; also_job_ids: string[]; no_one_job: boolean; po_entry_id: string | null }) => Promise<void>
  remove: (ticketId: string) => Promise<void>
  addPage: (ticket: { id: string; uploaderId: string }, page: TicketPageDraft) => Promise<unknown>
}

export const ticketScreensIo: TicketScreensIo = {
  sheetFacts: loadTicketSheetFacts,
  allJobs: loadJobsForTicketPick,
  list: (userId) => listMyTickets(userId),
  jobFacts: loadTicketJobFacts,
  pageUrl: ticketPageUrl,
  changeJob: changeTicketJob,
  remove: removeTicket,
  addPage: sendTicketPage,
}
