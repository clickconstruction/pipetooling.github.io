/**
 * What the Bridge leaves out (spike candidate 7, punch list #303): a list a person sets on the page, of whole
 * developments, customers or addresses whose jobs, bids and estimates the Bridge does not count.
 *
 * The owner, 2026-11-11: "I also need you to exclude all the gundog bids." Asked whether the rest of the Bridge
 * should leave Gun Dog out too: "Yes, the whole Bridge". Then: "Because we're adding gundog to excluded, I need to
 * add something in the graphical user interface that also shows this So a user can choose to exclude or not exclude
 * gundog in the future Or any specific development, or any specific customer Or any specific address."
 *
 * A rule names one thing:
 * - a **development**, by its id: every job and bid on it;
 * - a **customer**, by its id: every job, bid and estimate of that customer, and every job that customer is the
 *   general contractor on;
 * - an **address**, by its words: every job, bid and estimate whose address holds those words.
 *
 * The list is one `app_settings` row, `bridge_left_out_v1`. Until someone saves it the Bridge leaves out the
 * development named Gun Dog (`defaultLeftOut`), which is what the owner asked for the day this was drawn. A job that
 * matches a rule leaves through the same set of ids every Bridge read already takes for the ZZ test jobs, so it is
 * left out exactly where a test job is. The bank's cash and the overhead pool are not a job's and stay whole.
 *
 * Pure: `leftOutIo.ts` reads and saves the row and finds the jobs.
 */

export const BRIDGE_LEFT_OUT_SETTING_KEY = 'bridge_left_out_v1'
/** An address rule shorter than this would match half the town. */
export const LEFT_OUT_ADDRESS_MIN = 5

export type LeftOutKind = 'development' | 'customer' | 'address'

export type LeftOutRule = {
  kind: LeftOutKind
  /** The development's or the customer's id; for an address, its words lowercased. */
  key: string
  /** The name shown on the page: the development's or customer's name, or the address as typed. */
  label: string
}

export const LEFT_OUT_KIND_WORDS: Record<LeftOutKind, string> = { development: 'Development', customer: 'Customer', address: 'Address' }

/** An address as the rules compare it: lowercased, one space between words. */
export function addressWords(text: string | null | undefined): string {
  return (text ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

const isKind = (v: unknown): v is LeftOutKind => v === 'development' || v === 'customer' || v === 'address'

/** The saved list; anything that is not a rule is dropped, and a rule named twice is kept once. `null` for no saved row. */
export function parseLeftOut(text: string | null | undefined): LeftOutRule[] | null {
  if (text == null || text.trim() === '') return null
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (!Array.isArray(raw)) return null
  const out: LeftOutRule[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const { kind, key, label } = r as Record<string, unknown>
    if (!isKind(kind) || typeof key !== 'string' || key.trim() === '') continue
    const rule: LeftOutRule = { kind, key: kind === 'address' ? addressWords(key) : key, label: typeof label === 'string' && label.trim() ? label.trim() : key }
    if (!out.some((x) => sameRule(x, rule))) out.push(rule)
  }
  return out
}

export function leftOutText(rules: ReadonlyArray<LeftOutRule>): string {
  return JSON.stringify(rules.map((r) => ({ kind: r.kind, key: r.key, label: r.label })))
}

export function sameRule(a: LeftOutRule, b: LeftOutRule): boolean {
  return a.kind === b.kind && a.key === b.key
}

/** The list with one more rule, or the same list when it is already there. */
export function withRule(rules: ReadonlyArray<LeftOutRule>, rule: LeftOutRule): LeftOutRule[] {
  return rules.some((r) => sameRule(r, rule)) ? [...rules] : [...rules, rule]
}

export function withoutRule(rules: ReadonlyArray<LeftOutRule>, rule: LeftOutRule): LeftOutRule[] {
  return rules.filter((r) => !sameRule(r, rule))
}

/** A rule for an address as someone typed it, or null when it is too short to mean one place. */
export function addressRule(typed: string): LeftOutRule | null {
  const key = addressWords(typed)
  return key.length >= LEFT_OUT_ADDRESS_MIN ? { kind: 'address', key, label: typed.trim().replace(/\s+/g, ' ') } : null
}

/** Until the list is saved: the development named Gun Dog, when the company has one. */
export function defaultLeftOut(developments: ReadonlyArray<{ id: string; name: string | null }>): LeftOutRule[] {
  return developments.filter((d) => /^\s*gun\s*dog\s*$/i.test(d.name ?? '')).map((d) => ({ kind: 'development' as const, key: d.id, label: (d.name ?? 'Gun Dog').trim() }))
}

/** What a job, a bid or an estimate carries that a rule can name. */
export type LeftOutFacts = { developmentId?: string | null; customerId?: string | null; gcCustomerId?: string | null; address?: string | null }

export function isLeftOut(facts: LeftOutFacts, rules: ReadonlyArray<LeftOutRule>): boolean {
  if (rules.length === 0) return false
  const address = addressWords(facts.address)
  return rules.some((r) => {
    if (r.kind === 'development') return facts.developmentId != null && facts.developmentId === r.key
    if (r.kind === 'customer') return (facts.customerId != null && facts.customerId === r.key) || (facts.gcCustomerId != null && facts.gcCustomerId === r.key)
    return address !== '' && address.includes(r.key)
  })
}

/** A short key for the list, so a read made under one list is not reused under another. */
export function leftOutKey(rules: ReadonlyArray<LeftOutRule>): string {
  return rules
    .map((r) => `${r.kind}:${r.key}`)
    .sort()
    .join('|')
}

/** One sentence for the page: what is left out, by name. */
export function leftOutWords(rules: ReadonlyArray<LeftOutRule>): string {
  if (rules.length === 0) return 'Nothing is left out.'
  const names = rules.map((r) => r.label)
  const list = names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return `Leaves out ${list}.`
}
