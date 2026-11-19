/**
 * Where `/people?tab=contracts&doc=<id>` lands on People → Contracts (v2.7924).
 *
 * Three doors write that address: the signing page's thank-you and the person timeline, both on a signed paper, and a
 * waiting line of Documents → Agreements (`agreementDoor`), on a paper that is not signed. Until v2.7924 the tab opened
 * the signed record window on every id, and a waiting paper answered with an error. The choice now waits for the tab's
 * own read of the papers: a signed paper opens its signed record as before, and one that is not signed opens its
 * person's line with that paper in view, where Send and Resend are.
 */

export type ContractsDocLinkRow = {
  id: string
  person_name: string
  document_name: string
  status: string
}

export type ContractsDocLanding =
  /** No `doc` on the address, or not an id. */
  | { kind: 'none' }
  /** The tab has not read its papers or its names yet: decide on the next pass. */
  | { kind: 'wait' }
  /** The signed record window. Also the answer for an id the tab does not list: the window reads it and says why. */
  | { kind: 'signed-record'; documentId: string }
  /** The paper's own row under its person, opened, scrolled to and marked. `archived` opens the Archived section. */
  | { kind: 'paper-row'; documentId: string; personName: string; archived: boolean }
  /** The paper is for a name no line of the tab carries, so there is no row to show. */
  | { kind: 'off-roster'; personName: string; documentName: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The `doc` id off an address's query, or null when it carries none or one that is not an id. */
export function contractsDocLinkId(search: string | null | undefined): string | null {
  const id = new URLSearchParams(search ?? '').get('doc')?.trim() ?? ''
  return UUID.test(id) ? id : null
}

export function contractsDocLanding(args: {
  docId: string | null
  /** True once the tab's first read of its papers has come back, whether or not it read anything. */
  loaded: boolean
  documents: readonly ContractsDocLinkRow[]
  /** The names the tab lists, living first. */
  activeNames: readonly string[]
  archivedNames: readonly string[]
}): ContractsDocLanding {
  const { docId } = args
  if (!docId) return { kind: 'none' }
  // A tab with no names yet has no row to land on: its page is still reading the roster.
  if (!args.loaded || args.activeNames.length + args.archivedNames.length === 0) return { kind: 'wait' }
  const row = args.documents.find((d) => d.id.toLowerCase() === docId.toLowerCase())
  if (!row || row.status === 'signed') return { kind: 'signed-record', documentId: row?.id ?? docId }
  if (args.activeNames.includes(row.person_name)) return { kind: 'paper-row', documentId: row.id, personName: row.person_name, archived: false }
  if (args.archivedNames.includes(row.person_name)) return { kind: 'paper-row', documentId: row.id, personName: row.person_name, archived: true }
  return { kind: 'off-roster', personName: row.person_name, documentName: row.document_name }
}

/** What the tab says when the paper's person has no line on it. */
export function contractsDocOffRosterWords(landing: { personName: string; documentName: string }): string {
  const paper = landing.documentName.trim() || 'This paper'
  const who = landing.personName.trim()
  if (!who) return `${paper} has no name on it, so it has no line on this tab.`
  return `${paper} is for ${who}. That name is not on the People list, so the paper has no line on this tab.`
}
