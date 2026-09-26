/**
 * The trade a lien letter names (v2.3849). Counsel's letters of 2026-09-22 say
 * "the plumbing contractor" because Click is a plumber; the form's *Type of
 * labor or materials* defaulted to "Plumbing labor and materials" for the same
 * reason — and an electrical job went out with a form the office could retype
 * and a letter that still said plumbing. Every job has a service type
 * (`jobs_ledger.service_type_id` → `service_types.name`: Plumbing, Electrical,
 * …), so the words come from it. A blank or unknown name reads as plumbing, as
 * before. Pure.
 */

export type LienTradeWords = {
  /** "plumbing contractor" / "electrical contractor" / "HVAC contractor" — "We are the {contractor} on your project". */
  contractor: string
  /** "the plumbing" / "the electrical work" / "the HVAC work" — "We did {work} on your home". */
  work: string
  /** "installed the plumbing" / "did the electrical work" — counsel's residential opening keeps its verb on a plumbing job. */
  installed: string
  /** "Plumbing labor and materials" / "Electrical labor and materials" — the form's default *Type of labor or materials*. */
  laborMaterials: string
}

const DEFAULT_TRADE = 'Plumbing'

/** The name as a sentence says it: an acronym stays upper-case (HVAC), anything else lower-cases (Electrical → electrical). */
function inSentence(name: string): string {
  return /^[A-Z0-9&/ ]+$/.test(name) && /[A-Z]{2}/.test(name) ? name : name.toLowerCase()
}

/** The name as the form's line starts: first letter up, the rest as typed (plumbing → Plumbing, HVAC → HVAC). */
function asLine(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1)
}

export function lienTradeWords(serviceTypeName: string | null | undefined): LienTradeWords {
  const name = (serviceTypeName ?? '').trim().replace(/\s+/g, ' ') || DEFAULT_TRADE
  const low = inSentence(name)
  const plumbing = low === 'plumbing'
  const work = plumbing ? 'the plumbing' : `the ${low} work`
  return {
    contractor: `${low} contractor`,
    work,
    installed: plumbing ? 'installed the plumbing' : `did ${work}`,
    laborMaterials: `${asLine(name)} labor and materials`,
  }
}
