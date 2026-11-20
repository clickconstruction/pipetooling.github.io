/**
 * The Contract library's reads, one set of columns for every page that opens it: the packets, the Contract Book's
 * entries, who each packet is assigned to, and every person's papers. People → Contracts reads these columns in its own
 * load; Documents → Agreements reads them here when its Contract library door opens. Each table's own row security
 * answers. Browser io, not pure.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { isCompanyPaperName } from '../../../supabase/functions/_shared/companyPaper'
import { isPartyPaperName } from './paperParty'
import type { ContractBookTemplate, ContractBookTemplateDocument } from '../../components/contracts/ContractBookModal'
import type { QuickSendPersonRow } from '../contractsQuickSend'

export const CONTRACT_PACKET_COLUMNS = 'id, name, sequence_order, created_at'
export const CONTRACT_BOOK_COLUMNS =
  'id, template_id, document_name, sequence_order, book_body_html, book_body_format, tags, canonical_document_url, updated_at, book_version_date, audience, form_template_id'
export const CONTRACT_ASSIGNMENT_COLUMNS = 'id, person_name, template_id'
export const PERSON_PAPER_COLUMNS =
  'id, person_name, document_name, url, signing_body_html, signing_body_format, canonical_document_url, status, signed_at, sent_at, signer_last_viewed_at, note, dashboard_prompt_after_clock_in, applied_contract_template_document_id, applied_version_date, contract_lineage_id, lineage_version, supersedes_person_contract_document_id, form_template_id, office_completed_at'

export type ContractsLibrary = {
  templates: ContractBookTemplate[]
  templateDocuments: ContractBookTemplateDocument[]
  assignments: Array<{ id: string; person_name: string; template_id: string }>
  personDocuments: Array<QuickSendPersonRow & { note: string | null }>
}

/** The whole library, read together. Throws with the reason. */
export async function readContractsLibrary(): Promise<ContractsLibrary> {
  const [templates, templateDocuments, assignments, personDocuments] = await Promise.all([
    withSupabaseRetry(async () => supabase.from('contract_templates').select(CONTRACT_PACKET_COLUMNS).order('sequence_order'), 'read the packets'),
    withSupabaseRetry(async () => supabase.from('contract_template_documents').select(CONTRACT_BOOK_COLUMNS).order('template_id').order('sequence_order'), 'read the Contract Book'),
    withSupabaseRetry(async () => supabase.from('person_contract_assignments').select(CONTRACT_ASSIGNMENT_COLUMNS), 'read who has each packet'),
    withSupabaseRetry(async () => supabase.from('person_contract_documents').select(PERSON_PAPER_COLUMNS), 'read the papers people hold'),
  ])
  return {
    templates: (templates ?? []) as unknown as ContractBookTemplate[],
    templateDocuments: (templateDocuments ?? []) as unknown as ContractBookTemplateDocument[],
    assignments: (assignments ?? []) as unknown as ContractsLibrary['assignments'],
    // A trade partner company's papers and an outside party's (punch list #403) share the table and are no person's:
    // never listed, never counted.
    personDocuments: ((personDocuments ?? []) as unknown as ContractsLibrary['personDocuments']).filter((d) => !isCompanyPaperName(d.person_name) && !isPartyPaperName(d.person_name)),
  }
}
