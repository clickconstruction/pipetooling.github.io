/**
 * Packet (contract template) helpers for the Contract library + Assign
 * packets modals (v2.1411). "Packet" is the UI name for a `contract_templates`
 * row — a bundle of library documents assigned to people as a set. Pure
 * functions over the Contracts tab caches.
 */

export type PacketAssignment = { person_name: string; template_id: string }
export type PacketTemplateDocument = { template_id: string; document_name: string }
export type PacketPersonDocument = { person_name: string; document_name: string }

/** True when the row carries anything a person/staff produced — never auto-delete these as empty placeholders. */
export function personContractDocumentHasStaffData(
  pcd: {
    url: string | null
    signed_at: string | null
    note: string | null
    signing_body_html: string | null
    canonical_document_url: string | null
  } | null | undefined,
): boolean {
  if (!pcd) return false
  return !!(
    pcd.url?.trim() ||
    pcd.signed_at ||
    pcd.note?.trim() ||
    pcd.signing_body_html?.trim() ||
    pcd.canonical_document_url?.trim()
  )
}

/** Per-packet list metadata: document and assignee counts for the master list. */
export function packetStats(input: {
  templateId: string
  templateDocuments: readonly PacketTemplateDocument[]
  assignments: readonly PacketAssignment[]
}): { docCount: number; peopleCount: number } {
  let docCount = 0
  for (const d of input.templateDocuments) if (d.template_id === input.templateId) docCount++
  const people = new Set<string>()
  for (const a of input.assignments) if (a.template_id === input.templateId) people.add(a.person_name)
  return { docCount, peopleCount: people.size }
}

export type PacketSaveConsequence = {
  /** Doc name → assigned people who have NO copy of it yet (an unsent copy will be created). */
  addedDocs: { documentName: string; peopleNeedingCopy: number }[]
  removedDocs: string[]
  assigneeCount: number
}

/**
 * What saving a packet's document checklist will do: newly checked documents
 * are created as unsent for every assignee who has no copy; unchecked
 * documents leave the packet (empty placeholders are cleaned up, anything
 * with staff data stays on file).
 */
export function packetSaveConsequence(input: {
  templateId: string | null
  checkedDocNames: readonly string[]
  currentDocNames: readonly string[]
  assignments: readonly PacketAssignment[]
  personDocuments: readonly PacketPersonDocument[]
}): PacketSaveConsequence {
  const current = new Set(input.currentDocNames)
  const checked = new Set(input.checkedDocNames)
  const assignees = new Set<string>()
  if (input.templateId) {
    for (const a of input.assignments) if (a.template_id === input.templateId) assignees.add(a.person_name)
  }
  const docNamesByPerson = new Map<string, Set<string>>()
  for (const pd of input.personDocuments) {
    if (!assignees.has(pd.person_name)) continue
    const set = docNamesByPerson.get(pd.person_name) ?? new Set<string>()
    set.add(pd.document_name)
    docNamesByPerson.set(pd.person_name, set)
  }
  const addedDocs: { documentName: string; peopleNeedingCopy: number }[] = []
  for (const documentName of input.checkedDocNames) {
    if (current.has(documentName)) continue
    let needing = 0
    for (const person of assignees) {
      if (!docNamesByPerson.get(person)?.has(documentName)) needing++
    }
    addedDocs.push({ documentName, peopleNeedingCopy: needing })
  }
  const removedDocs = input.currentDocNames.filter((n) => !checked.has(n))
  return { addedDocs, removedDocs, assigneeCount: assignees.size }
}

/**
 * What assigning the selected packets will land on the person: the document
 * names (across all selected packets, deduped) they have no copy of yet —
 * each is created as an unsent copy on Assign.
 */
export function assignPacketsConsequence(input: {
  personName: string
  selectedTemplateIds: readonly string[]
  templateDocuments: readonly PacketTemplateDocument[]
  personDocuments: readonly PacketPersonDocument[]
}): { newDocNames: string[] } {
  const selected = new Set(input.selectedTemplateIds)
  const packetDocNames = new Set<string>()
  for (const td of input.templateDocuments) {
    if (selected.has(td.template_id)) packetDocNames.add(td.document_name)
  }
  const existing = new Set<string>()
  for (const pd of input.personDocuments) {
    if (pd.person_name === input.personName) existing.add(pd.document_name)
  }
  const newDocNames = [...packetDocNames].filter((n) => !existing.has(n)).sort((a, b) => a.localeCompare(b))
  return { newDocNames }
}
