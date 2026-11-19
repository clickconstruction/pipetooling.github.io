/**
 * Documents → Agreements, sending a paper from the tab: the reads. The Contract Book as a job's Add a paper reads it,
 * every person's papers as People → Contracts reads them for its quick send, and the roster. Each table's own row
 * security answers, so a role the Book is closed to reads none of it. Browser io, not pure; the rules are
 * `agreementsSend.ts`.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { isCompanyPaperName } from '../../../supabase/functions/_shared/companyPaper'
import type { QuickSendPersonRow } from '../contractsQuickSend'
import type { BookPaperRow } from '../jobs/jobPapers'
import { supabaseJobPapersIo } from '../jobs/jobPapersIo'
import { fetchRosterPeople } from '../people/rosterPeople'
import { sendRosterNames } from './agreementsSend'

export type AgreementsSendBook = {
  book: BookPaperRow[]
  personDocuments: QuickSendPersonRow[]
  rosterNames: string[]
}

/** The columns a quick send reads of a person's paper. */
export const QUICK_SEND_PERSON_COLUMNS = 'id, person_name, document_name, status, lineage_version, sent_at, signer_last_viewed_at, signed_at, url, signing_body_html, signing_body_format, canonical_document_url'

/** Everything the send needs, read together. Throws with the reason. */
export async function readAgreementsSendBook(): Promise<AgreementsSendBook> {
  const [book, docs, roster] = await Promise.all([
    supabaseJobPapersIo.readBook(),
    withSupabaseRetry(async () => supabase.from('person_contract_documents').select(QUICK_SEND_PERSON_COLUMNS), 'read the papers people hold'),
    fetchRosterPeople(supabase),
  ])
  return {
    book,
    // A trade partner company's papers share the table and are no person's: never offered, never counted.
    personDocuments: ((docs ?? []) as unknown as QuickSendPersonRow[]).filter((d) => !isCompanyPaperName(d.person_name)),
    rosterNames: sendRosterNames(roster),
  }
}
