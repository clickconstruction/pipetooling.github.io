/**
 * Agreements-tab gating kernel: which documents count as THIS partnership's
 * agreement. A person can carry older signed paperwork (sub handbooks,
 * installation agreements) that has nothing to do with the partnership deal —
 * only documents explicitly linked via person_contract_documents.partnership_id
 * satisfy the "signed" chip, drive the lapse state, or block the §8a notice.
 */

export type AgreementGatingDoc = {
  status: string
  sign_by: string | null
  partnership_id: string | null
}

export function isLinkedToPartnership(doc: { partnership_id: string | null }, partnershipId: string): boolean {
  return doc.partnership_id === partnershipId
}

/** Split into this deal's documents vs the person's other agreement paperwork. */
export function partitionAgreementDocs<T extends { partnership_id: string | null }>(
  docs: T[],
  partnershipId: string,
): { linked: T[]; others: T[] } {
  const linked: T[] = []
  const others: T[] = []
  for (const d of docs) (isLinkedToPartnership(d, partnershipId) ? linked : others).push(d)
  return { linked, others }
}

/**
 * Deal-scoped signature state. `todayYmd` is the company-calendar date
 * (America/Chicago), never a UTC slice.
 */
export function agreementGating(
  docs: AgreementGatingDoc[],
  partnershipId: string,
  todayYmd: string,
): { dealSigned: boolean; lapsed: boolean } {
  const linked = docs.filter((d) => isLinkedToPartnership(d, partnershipId))
  const dealSigned = linked.some((d) => d.status === 'signed')
  const lapsed = !dealSigned && linked.some((d) => d.status !== 'signed' && d.sign_by != null && d.sign_by < todayYmd)
  return { dealSigned, lapsed }
}
