import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'

/**
 * Assign a packet (contract template) to a person and materialize its
 * documents — the Contracts tab's `materializePacketForPerson`, lifted so the
 * Person Desk assigns through the same writes (PR 3). Name-keyed, like the tab.
 */
export type PacketTemplateDoc = {
  id: string
  template_id: string
  document_name: string
  book_body_html: string | null
  book_body_format: string
  canonical_document_url?: string | null
}

export type PacketPersonDoc = {
  id: string
  person_name: string
  document_name: string
  signing_body_html: string | null
  lineage_version: number
}

export async function materializePacketForPerson(args: { personName: string; templateId: string; templateDocs: readonly PacketTemplateDoc[]; personDocs: readonly PacketPersonDoc[] }): Promise<void> {
  const { personName, templateId, templateDocs, personDocs } = args
  await withSupabaseRetry(async () => supabase.from('person_contract_assignments').insert({ person_name: personName, template_id: templateId }), 'assign packet to person')
  for (const td of templateDocs.filter((d) => d.template_id === templateId)) {
    const candidates = personDocs.filter((d) => d.person_name === personName && d.document_name === td.document_name)
    const existing = candidates.length === 0 ? undefined : [...candidates].sort((a, b) => b.lineage_version - a.lineage_version)[0]
    const fillSigningFromBook = !existing?.signing_body_html?.trim()
    if (existing) {
      const updatePayload = fillSigningFromBook
        ? { canonical_document_url: td.canonical_document_url?.trim() || null, signing_body_html: td.book_body_html ?? null, signing_body_format: td.book_body_format, applied_contract_template_document_id: td.id }
        : { canonical_document_url: td.canonical_document_url?.trim() || null, applied_contract_template_document_id: td.id }
      await withSupabaseRetry(async () => supabase.from('person_contract_documents').update(updatePayload).eq('id', existing.id), 'create person contract documents')
    } else {
      const lid = globalThis.crypto.randomUUID()
      await withSupabaseRetry(
        async () =>
          supabase.from('person_contract_documents').insert({
            person_name: personName,
            document_name: td.document_name,
            contract_lineage_id: lid,
            lineage_version: 1,
            supersedes_person_contract_document_id: null,
            status: 'unsent',
            canonical_document_url: td.canonical_document_url?.trim() || null,
            signing_body_html: fillSigningFromBook ? td.book_body_html ?? null : null,
            signing_body_format: fillSigningFromBook ? td.book_body_format : 'html',
            applied_contract_template_document_id: td.id,
          }),
        'create person contract documents',
      )
    }
  }
}
