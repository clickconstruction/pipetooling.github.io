/**
 * Where `/people?tab=contracts&doc=<id>` lands on People → Contracts (v2.7924).
 *
 * Three doors write that address: the signing page's thank-you and the person timeline, both on a signed paper, and a
 * waiting line of Documents → Agreements (`agreementDoor`), on a paper that is not signed. Until v2.7924 the tab opened
 * the signed record window on every id, and a waiting paper answered with an error. The choice now waits for the tab's
 * own read of the papers: a signed paper opens its signed record as before, and one that is not signed opens its
 * person's line with that paper in view, where Send and Resend are.
 *
 * Since v2.8436 a waiting line of a trade company's paper writes the address too. A company's paper is no person's, so
 * the tab keeps it off its list of papers and draws it under the company's row, above the company's workers. The landing
 * knows such a paper by `companyPapers` and its company by `companies`: it opens the paper under its company's row, and
 * for a company no one on the roster works at it says the paper is kept in GC mode. Before, such an id fell to the
 * signed record window, which answers an unsigned paper with an error.
 */

export type ContractsDocLinkRow = {
  id: string
  person_name: string
  document_name: string
  status: string
}

/** A trade company's paper as the tab's read saw it. `companyId` is null for a name that carries no id. */
export type ContractsDocLinkCompanyPaper = {
  id: string
  companyId: string | null
  document_name: string
  status: string
}

/** A trade company the tab knows, with the roster names it draws under the company's row. None: the company has no row. */
export type ContractsDocLinkCompany = {
  id: string
  name: string
  workerNames: readonly string[]
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
  /** A trade company's paper, under its company's row: scrolled to and marked. `workerNames` are who the row sits over. */
  | { kind: 'company-paper'; documentId: string; companyId: string; workerNames: readonly string[] }
  /** A trade company's paper whose company has no row here: no one on the roster works there. `companyName` may be ''. */
  | { kind: 'company-off-roster'; companyName: string; documentName: string }

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
  /** The trade companies' papers the same read saw, which `documents` leaves out. Left out: the tab keeps none. */
  companyPapers?: readonly ContractsDocLinkCompanyPaper[]
  /** The trade companies the tab read, each with the roster names under its row. */
  companies?: readonly ContractsDocLinkCompany[]
  /**
   * True once the companies are read, or for a reader who reads none. A company's paper waits for it, so a read that is
   * still out, or one that failed and is read again, never answers that the company has no row.
   */
  companiesLoaded?: boolean
}): ContractsDocLanding {
  const { docId } = args
  if (!docId) return { kind: 'none' }
  // A tab with no names yet has no row to land on: its page is still reading the roster.
  if (!args.loaded || args.activeNames.length + args.archivedNames.length === 0) return { kind: 'wait' }
  const row = args.documents.find((d) => d.id.toLowerCase() === docId.toLowerCase())
  const companyPaper = row ? undefined : args.companyPapers?.find((d) => d.id.toLowerCase() === docId.toLowerCase())
  if (companyPaper && companyPaper.status !== 'signed') {
    if (!args.companiesLoaded) return { kind: 'wait' }
    const company = companyPaper.companyId ? args.companies?.find((c) => c.id === companyPaper.companyId) : undefined
    if (company && company.workerNames.length > 0) return { kind: 'company-paper', documentId: companyPaper.id, companyId: company.id, workerNames: company.workerNames }
    return { kind: 'company-off-roster', companyName: company?.name ?? '', documentName: companyPaper.document_name }
  }
  if (!row || row.status === 'signed') return { kind: 'signed-record', documentId: row?.id ?? companyPaper?.id ?? docId }
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

/** What the tab says when a trade company's paper has no row on it: no one on the roster works at the company. */
export function contractsDocCompanyOffRosterWords(landing: { companyName: string; documentName: string }): string {
  const paper = landing.documentName.trim() || 'This paper'
  const company = landing.companyName.trim() || 'a trade company'
  return `${paper} is with ${company}. No one on the People list works there, so the paper has no line on this tab. It is kept in GC mode.`
}

/**
 * The trade companies as the landing reads them: every company the tab read, each with the roster names the tab draws
 * under its row (`rosterByCompany`'s pieces over the living names). A company with no worker there has no row.
 */
export function contractsDocLinkCompanies(
  companies: readonly { id: string; name: string }[],
  pieces: readonly ({ kind: 'company'; group: { company: { id: string }; workers: readonly { name: string }[] } } | { kind: 'person' })[],
): ContractsDocLinkCompany[] {
  const workers = new Map<string, string[]>()
  for (const piece of pieces) if (piece.kind === 'company') workers.set(piece.group.company.id, piece.group.workers.map((w) => w.name))
  return companies.map((c) => ({ id: c.id, name: c.name, workerNames: workers.get(c.id) ?? [] }))
}
