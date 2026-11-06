// dev-mcp's plan_matter_open_person / apply_matter_open_person (v2.6582, punch list #269 PR 3b): open a matter on a
// person's HR file — the analysis for counsel standing on the person instead of a Collections payer
// (legal_matters.kind = 'person', v2.6543; docs/HR_FILES.md → The tab → Matter) — through the file's own RPC
// legal_person_matter_open (migration 20261105220000, devs only, one matter a person), behind the seat's plan → apply
// grammar. No new RPC and no dry-run wrapper: the dry run is the server's own read of the person and of any matter
// standing on them as the dev, and the plan hash commits to both — so a matter opened since the plan, by anyone, refuses
// the apply, and a matter that already stands is refused at the plan with its id, since the RPC would only answer it.
// Pure: no network, no env. Tests: src/lib/devMcp/devMcpPersonMatter.test.ts.

type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const PERSON_MATTER_HANDLING_NAME_MAX = 200

export const PERSON_MATTER_VERBS = ['plan_matter_open_person', 'apply_matter_open_person'] as const
export type PersonMatterVerb = (typeof PERSON_MATTER_VERBS)[number]
export function isPersonMatterVerb(verb: string): verb is PersonMatterVerb {
  return (PERSON_MATTER_VERBS as readonly string[]).includes(verb)
}

/** What a person-matter verb carries, after the shape check: the person as given (a people.id or a login's users.id) and the handling name if any. */
export type PersonMatterPayload = { person_id: string; handling_name?: string }

/** The columns the server reads from people for the dry run; the second read, by account_user_id, takes a login's id. */
export const PERSON_MATTER_PERSON_SELECT = 'id,name,kind,archived_at,account_user_id'
export type PersonMatterPersonRow = { id: string; name: string; kind: string; archived_at: string | null; account_user_id: string | null }

/** The columns the server reads from legal_matters by person_id. */
export const PERSON_MATTER_STANDING_SELECT = 'id,stage,closed_at,closed_reason,handling_name,person_id,updated_at'
export type PersonMatterStandingRow = { id: string; stage: string; closed_at: string | null; closed_reason: string; handling_name: string; person_id: string | null; updated_at: string }

export type PersonMatterInput = { ok: true; p: PersonMatterPayload; target: string } | { ok: false; error: string }

/** The ask's shape, refused in words: a person's id, and a handling name under the cap when given. */
export function personMatterInput(verb: PersonMatterVerb, input: Json): PersonMatterInput {
  const matter = obj(input.matter)
  const shape = `${verb} needs matter — { person_id (a people.id, or a login's users.id as find_person lists it; get_person_file resolves a name), handling_name? (the firm's or the office's name for the matter, under ${PERSON_MATTER_HANDLING_NAME_MAX} characters) }.`
  if (!matter) return { ok: false, error: shape }
  const str = (k: string) => (typeof matter[k] === 'string' ? (matter[k] as string).trim() : '')
  const personId = str('person_id').toLowerCase()
  if (!UUID_RE.test(personId)) return { ok: false, error: shape }
  const p: PersonMatterPayload = { person_id: personId }
  const handling = str('handling_name')
  if (handling) {
    if (handling.length > PERSON_MATTER_HANDLING_NAME_MAX) return { ok: false, error: `${verb}: keep the handling name under ${PERSON_MATTER_HANDLING_NAME_MAX} characters.` }
    p.handling_name = handling
  }
  return { ok: true, p, target: personId }
}

/** The stage in the HR file's words (`personMatterStageWords` on the app side): Closed first, then the desk's label. */
export function personMatterStageWords(m: Pick<PersonMatterStandingRow, 'stage' | 'closed_at' | 'closed_reason'>): string {
  if (m.closed_at) return `Closed${m.closed_reason ? ` · ${m.closed_reason}` : ''}`
  switch (m.stage) {
    case 'review': return 'Under review'
    case 'in_house': return 'In house'
    case 'settled': return 'Settled'
    case 'uncollectible': return 'Uncollectible'
    default: return 'With the firm'
  }
}

export type PersonMatterDryRun = { ok: true; reply: Json } | { ok: false; refused: string }

/** The verbs to write on a matter once it stands, named in one place. */
export const PERSON_MATTER_NEXT_VERBS = 'plan_matter_narrative (the narrative for the firm), plan_matter_document (a paper with what it shows), plan_matter_plan_item (a step), plan_theme_marks (the themes on its documents and events)'

/**
 * The dry run: the person as the roster has them and the matter as the RPC would open it. No such person, or a matter
 * already standing, is refused in words — the RPC would answer the standing one without making anything, and a plan on
 * it has nothing to commit to.
 */
export function personMatterDryRun(p: PersonMatterPayload, person: PersonMatterPersonRow | null, standing: PersonMatterStandingRow | null, calendarYmd: (iso: string) => string): PersonMatterDryRun {
  if (!person) return { ok: false, refused: `No person ${p.person_id} — not a people.id or a login's users.id, or RLS hides them from you. find_person by name lists the login's id; get_person_file names the people row.` }
  if (standing) {
    const when = standing.updated_at ? ` · last changed ${calendarYmd(standing.updated_at) || standing.updated_at}` : ''
    return { ok: false, refused: `Nothing to plan: a matter already stands on ${person.name} (matter_id ${standing.id}, ${personMatterStageWords(standing)}${standing.handling_name ? `, ${standing.handling_name}` : ''}${when}). One matter a person. Write on it instead: ${PERSON_MATTER_NEXT_VERBS}; get_person_file and read_rows on legal_matters by person_id show it.` }
  }
  return {
    ok: true,
    reply: {
      dry_run: true,
      person: { id: person.id, name: person.name, kind: person.kind, archived: Boolean(person.archived_at) },
      matter: null,
      after: { kind: 'person', stage: 'review', stage_words: 'Under review', payer_name: person.name, handling_name: p.handling_name ?? '', released: false },
      then: `apply opens it through legal_person_matter_open as you: one matter a person, Under review, nothing released to a firm, its rows a dev's on every legal table. The HR file's Matter view draws it and the file's fact strip wears Matter · Under review. Then write on its matter_id: ${PERSON_MATTER_NEXT_VERBS}.`,
    },
  }
}

/** The HR file's own RPC the apply POSTs, and its body — never the generic door. The person is the resolved people.id. */
export function personMatterRpc(p: PersonMatterPayload, peopleId: string): { rpc: 'legal_person_matter_open'; body: Json } {
  return { rpc: 'legal_person_matter_open', body: { p_person_id: peopleId, p_handling_name: p.handling_name ?? '' } }
}

/** The line after the write, from the RPC's own answer ({ ok, matter_id, stage, closed, made, person_name }). */
export function personMatterAppliedWords(rpcReply: unknown, personName: string): string {
  const r = obj(rpcReply) ?? {}
  const who = personName || (typeof r.person_name === 'string' && r.person_name) || 'the person'
  const id = typeof r.matter_id === 'string' ? r.matter_id : ''
  if (r.made === false) return `Nothing new: a matter already stood on ${who}${id ? ` (matter_id ${id})` : ''} before this apply reached it. Write on it: ${PERSON_MATTER_NEXT_VERBS}.`
  return `Opened: matter ${id} stands on ${who}, Under review, nothing released; the HR file's Matter view draws it. Write on it now: ${PERSON_MATTER_NEXT_VERBS}.`
}
