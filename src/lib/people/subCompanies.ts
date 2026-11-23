/**
 * A sub's company on People (punch list #403, step 6, the owner's calls 3 and 7). A sub's business is a trade company
 * record (`gc_companies`) with its workers under it: each roster person points at one company through
 * `person_trade_companies` (v2.8313). People → Contracts draws a company once, with its workers under it, and each
 * worker's own papers on their row. These are the pure parts: who sits under which company, what the find box finds,
 * what entering a company does, and the words. The calls are `subCompaniesIo.ts`.
 */

import { val } from '../valuesInPlace'

/** A roster person's link to a company, as `person_trade_companies` keeps it. */
export type PersonCompanyLink = { person_id: string; company_id: string; title: string | null }

/** A trade company as far as People reads it. */
export type SubCompany = { id: string; name: string }

/** A roster person as far as the grouping reads them. */
export type RosterPerson = { id: string; name: string }

/** Where a roster name works: the company, what they are there, and the roster row the link hangs on. */
export type CompanyPlace = { company: SubCompany; title: string; personId: string }

/** A worker under a company: their roster name and what they are there. */
export type CompanyWorker = { personId: string; name: string; title: string }

/** A company with the workers the list shows under it. */
export type CompanyGroup = { company: SubCompany; workers: CompanyWorker[] }

/** The trade a company entered from People is made with. `gc_companies` asks for one, and our subs plumb. */
export const SUB_COMPANY_TRADE = 'Plumbing'

/** The words the company's row and the control say. */
export const SUB_COMPANY_WORDS = {
  tag: 'Trade company',
  label: 'their company',
  lineLabel: 'Their company',
  titleLabel: 'what they are there',
  titleLineLabel: 'What they are there',
  none: 'None on file',
  noTitle: 'Not said',
  sameAsName: 'Same as their name',
  hint: 'Pick a trade company we have, or type a new one. Empty the box to take them off.',
  titleHint: 'Owner, or what they do there. Empty the box to say nothing.',
  workers: 'Workers',
  notLinkable: 'Two people on the roster share this name, so the company cannot be kept on one of them.',
} as const

/** What the box makes of a typed company name: trimmed, inner spaces single. '' when nothing is left. */
export function companyNameTyped(typed: string): string {
  return typed.replace(/\s+/g, ' ').trim()
}

/** The company a typed name already is, whatever its case and spaces, as `person_trade_company_enter` finds one. */
export function companyNamed(companies: readonly SubCompany[], typed: string): SubCompany | null {
  const want = companyNameTyped(typed).toLowerCase()
  if (!want) return null
  return companies.find((c) => companyNameTyped(c.name).toLowerCase() === want) ?? null
}

/** Why a typed company cannot be kept, or null. An empty box takes the person off, so it is not refused here. */
export function companyKeepRefusal(typed: string): string | null {
  const name = companyNameTyped(typed)
  if (!name) return 'Type the company’s name.'
  if (name.length > 200) return 'A company’s name is 200 letters at most.'
  return null
}

/** Why a typed title cannot be kept, or null. The table keeps 200 letters at most. */
export function titleKeepRefusal(typed: string): string | null {
  return companyNameTyped(typed).length > 200 ? 'What they are there is 200 letters at most.' : null
}

/** What keeping the box does: take them off, link a company we have, or make a new one and link it. */
export type CompanyKeepPlan =
  | { kind: 'off' }
  | { kind: 'link'; company: SubCompany }
  | { kind: 'make'; name: string; trades: string[] }
  | { kind: 'refused'; why: string }

/** The plan for a kept box. The same name in any case is the company we have, as the database finds it too. */
export function companyKeepPlan(typed: string, companies: readonly SubCompany[]): CompanyKeepPlan {
  if (companyNameTyped(typed) === '') return { kind: 'off' }
  const why = companyKeepRefusal(typed)
  if (why) return { kind: 'refused', why }
  const have = companyNamed(companies, typed)
  if (have) return { kind: 'link', company: have }
  return { kind: 'make', name: companyNameTyped(typed), trades: [SUB_COMPANY_TRADE] }
}

/** The line under the open box: what Keep will do with what is typed. Null while the box says nothing yet. */
export function companyKeepPreview(typed: string, companies: readonly SubCompany[], current: string): string | null {
  const plan = companyKeepPlan(typed, companies)
  if (plan.kind === 'refused') return null
  if (plan.kind === 'off') return current ? 'Keep takes them off the company.' : null
  if (plan.kind === 'link') return 'A trade company we have.'
  return `A new trade company. Its trade is ${SUB_COMPANY_TRADE}.`
}

/** The company each roster name works for, by name. A name two roster people share is left out: it finds no one person. */
export function companyByPersonName(
  people: readonly RosterPerson[],
  links: readonly PersonCompanyLink[],
  companies: readonly SubCompany[],
): Map<string, CompanyPlace> {
  const byId = new Map(companies.map((c) => [c.id, c]))
  const linkOf = new Map(links.map((l) => [l.person_id, l]))
  const seen = new Map<string, number>()
  for (const p of people) seen.set(p.name.trim(), (seen.get(p.name.trim()) ?? 0) + 1)
  const out = new Map<string, CompanyPlace>()
  for (const p of people) {
    const name = p.name.trim()
    if ((seen.get(name) ?? 0) !== 1) continue
    const link = linkOf.get(p.id)
    const company = link ? byId.get(link.company_id) : undefined
    if (link && company) out.set(name, { company, title: (link.title ?? '').trim(), personId: p.id })
  }
  return out
}

/** One piece of the list People draws: a company with its workers under it, or a person on their own. */
export type RosterPiece = { kind: 'company'; group: CompanyGroup } | { kind: 'person'; name: string }

/**
 * The list as People draws it, in the order given: a company takes the place of its first worker in the list, with
 * every worker of it that is in `names` under it, a worker with a title first and the rest in the order given. A person who works for no company keeps their
 * place. A company none of whose workers is in `names` is left out.
 */
export function rosterByCompany(names: readonly string[], byName: ReadonlyMap<string, CompanyPlace>): RosterPiece[] {
  const pieces: RosterPiece[] = []
  const groups = new Map<string, CompanyGroup>()
  for (const name of names) {
    const at = byName.get(name.trim())
    if (!at) {
      pieces.push({ kind: 'person', name })
      continue
    }
    let group = groups.get(at.company.id)
    if (!group) {
      group = { company: at.company, workers: [] }
      groups.set(at.company.id, group)
      pieces.push({ kind: 'company', group })
    }
    group.workers.push({ personId: at.personId, name, title: at.title })
  }
  // A worker the office named a title for (the owner) leads the company's line and its rows; the rest keep their order.
  for (const piece of pieces) if (piece.kind === 'company') piece.group.workers.sort((x, y) => Number(!x.title) - Number(!y.title))
  return pieces
}

/** Whether the find box's words find this person by their company: every word is in the company's name. */
export function companyNameHolds(companyName: string | null | undefined, typed: string): boolean {
  const words = typed.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return false
  const name = (companyName ?? '').toLowerCase()
  return name !== '' && words.every((w) => name.includes(w))
}

/** *Pat Sample, Owner*: a worker as the company's line names them, the name marked as a value. */
export function workerWords(worker: Pick<CompanyWorker, 'name' | 'title'>): string {
  return worker.title ? `${val('name', worker.name)}, ${worker.title}` : val('name', worker.name)
}

/** The company row's second line: *Workers Pat Sample, Owner · Lee Sample*, each name marked as a value. */
export function companyWorkersLine(workers: readonly Pick<CompanyWorker, 'name' | 'title'>[]): string {
  return `${SUB_COMPANY_WORDS.workers} ${workers.map(workerWords).join(' · ')}`
}

/** The trade company names the box offers, sorted, each once. */
export function companySuggestions(companies: readonly SubCompany[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const c of companies) {
    const name = companyNameTyped(c.name)
    const key = name.toLowerCase()
    if (!name || seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out.sort((a, b) => a.localeCompare(b))
}
