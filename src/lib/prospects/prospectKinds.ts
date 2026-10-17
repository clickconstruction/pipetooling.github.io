/**
 * Prospects' three kinds of company (v2.5559, punch list #110). The page was one deck for
 * customers: a GC or an owner who could send us plans for our trades. Now that the company can
 * be the GC, it also finds the two things GC mode needs more of and had no lane for: owners,
 * developers and architects with a job we could build as the GC, and trade companies for the
 * bench. One deck serves all three, with the kind as a column on `prospects`; what differs per
 * kind lives here: the words on the tab, the card and the last press of the outcome row, where
 * a kind lands when the call goes well, and the facts the New Prospect window asks for.
 *
 * Everything here is pure.
 */

export type ProspectKind = 'customer' | 'gc_lead' | 'sub'

export const PROSPECT_KINDS: readonly ProspectKind[] = ['customer', 'gc_lead', 'sub']

export function isProspectKind(value: unknown): value is ProspectKind {
  return value === 'customer' || value === 'gc_lead' || value === 'sub'
}

/** The `?kind=` value for each kind; the customer deck keeps the bare URL it always had. */
export const PROSPECT_KIND_URL_KEYS: Record<ProspectKind, string> = {
  customer: 'customers',
  gc_lead: 'gc-leads',
  sub: 'subs',
}

export function kindFromUrlKey(value: string | null | undefined): ProspectKind {
  if (value === 'gc-leads') return 'gc_lead'
  if (value === 'subs') return 'sub'
  return 'customer'
}

export function urlKeyForKind(kind: ProspectKind): string {
  return PROSPECT_KIND_URL_KEYS[kind]
}

export interface ProspectKindWords {
  /** The top tab. */
  tab: string
  /** "a customer", for sentences. */
  one: string
  /** The kind card's line on New Prospect: who this is. */
  card: string
  /** The last press of the outcome row: what happens when the call goes well. */
  lastPress: string
  /** Its hover text. */
  lastPressTitle: string
  /** The Prospect List's section for the ones that went well, and its chip. */
  landed: string
  /** The queue's word for a row that went well. */
  landedChip: string
  /** Not a fit's hover text. */
  notAFitTitle: string
  /** The Activity report's heading. */
  activity: string
}

export const PROSPECT_KIND_WORDS: Record<ProspectKind, ProspectKindWords> = {
  customer: {
    tab: 'Customers',
    one: 'a customer',
    card: 'A GC or an owner who could send us plans for our trades.',
    lastPress: 'Converted ✓',
    lastPressTitle:
      'They became a customer — opens Add customer prefilled from this prospect; Save creates the customer and takes the prospect out of the calling queue',
    landed: 'Converted',
    landedChip: 'Converted',
    notAFitTitle: 'Not a plumbing fit — leaves the calling queue (find it under No longer a fit on the Prospect List)',
    activity: 'Customers',
  },
  gc_lead: {
    tab: 'Jobs to GC',
    one: 'a job to GC',
    card: "An owner, developer, architect or owner's rep with a job we could build as the GC.",
    lastPress: 'Asked us ✓',
    lastPressTitle:
      'They asked us to bid — opens Add customer prefilled from this prospect; Save makes the customer and takes the prospect out of the calling queue',
    landed: 'Asked us',
    landedChip: 'Asked us',
    notAFitTitle: 'Not a job for us — leaves the calling queue (find it under No longer a fit on the list)',
    activity: 'Jobs to GC',
  },
  sub: {
    tab: 'Subs',
    one: 'a sub',
    card: 'A company that does a trade we buy out.',
    lastPress: 'Add to the bench ✓',
    lastPressTitle:
      "They will quote for us — opens the bench's Add a company filled from this prospect; Save puts the company on Trade partners and takes the prospect out of the calling queue",
    landed: 'On the bench',
    landedChip: 'On the bench',
    notAFitTitle: 'Not a company we would hire — leaves the calling queue (find it under No longer a fit on the list)',
    activity: 'Subs',
  },
}

/** Who a GC lead is. On a GC project a developer is the owner we work for and an architect is the firm that drew the plans. */
export type ProspectCompanyRole = 'owner' | 'developer' | 'architect' | 'ownersRep' | 'gc'

export const PROSPECT_COMPANY_ROLES: readonly { role: ProspectCompanyRole; label: string }[] = [
  { role: 'owner', label: 'The owner' },
  { role: 'developer', label: 'A developer' },
  { role: 'architect', label: 'An architect' },
  { role: 'ownersRep', label: "An owner's rep" },
  { role: 'gc', label: 'Another general contractor' },
]

export function isProspectCompanyRole(value: unknown): value is ProspectCompanyRole {
  return PROSPECT_COMPANY_ROLES.some((r) => r.role === value)
}

/** The short word for the card's chip: "Owner", "Architect". Null when the lead has no role yet. */
export function companyRoleChip(role: string | null | undefined): string | null {
  switch (role) {
    case 'owner':
      return 'Owner'
    case 'developer':
      return 'Developer'
    case 'architect':
      return 'Architect'
    case 'ownersRep':
      return "Owner's rep"
    case 'gc':
      return 'General contractor'
    default:
      return null
  }
}

/** Where we found them: the suggestions under the Source box. The caller may type anything. */
export const PROSPECT_SOURCES: readonly string[] = [
  "A GC's sub list",
  'PlanHub',
  'BuildingConnected',
  'A permit',
  'A referral',
  'The architect',
  'A supply house',
  'Drove by',
]

export const PROSPECT_LANGS: readonly { lang: 'en' | 'es'; label: string }[] = [
  { lang: 'en', label: 'English' },
  { lang: 'es', label: 'Spanish' },
]

export function langLabel(lang: string | null | undefined): string | null {
  return PROSPECT_LANGS.find((l) => l.lang === lang)?.label ?? null
}

/** "Concrete, fire sprinkler" → ["Concrete", "fire sprinkler"]: trimmed, blanks dropped, doubles dropped (case-blind). */
export function parseTradesText(text: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of text.split(/[,;\n]/)) {
    const t = raw.trim()
    if (!t) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}

export function tradesText(trades: readonly string[] | null | undefined): string {
  return (trades ?? []).join(', ')
}

/** The sub's columns the bench's Add a company reads. */
export type BenchableProspect = {
  company_name: string | null
  contact_name: string | null
  phone_number: string | null
  email: string | null
  address: string | null
  trades: string[] | null
  max_miles: number | null
  lang?: string | null
  /** v2.5603: the person's cell, the license and the Maps link, when the row has them. */
  contact_phone?: string | null
  license?: string | null
  maps_url?: string | null
}

/** What `gc_add_company` takes (the bench's `NewCompanyDraft`), spelled here so the kernel stays free of the client. */
export type BenchDraft = {
  name: string
  trades: string[]
  contactName: string
  phone: string
  email: string
  address: string
  maxMiles: number | null
  known: boolean
  lang?: 'en' | 'es'
  /** v2.5603: the sub's license and Google Maps profile ride to the bench. */
  license?: string
  mapsUrl?: string
}

/** Add to the bench's prefill: the sub's facts in the bench's shape. The company is new to us unless the caller says otherwise. */
export function benchDraftFromProspect(p: BenchableProspect): BenchDraft {
  const miles = p.max_miles != null && p.max_miles > 0 ? Math.round(p.max_miles) : null
  const draft: BenchDraft = {
    name: (p.company_name ?? '').trim() || (p.contact_name ?? '').trim(),
    trades: [...(p.trades ?? [])],
    contactName: (p.contact_name ?? '').trim(),
    // The number that reaches the person first (v2.5603): their cell, else the company line.
    phone: (p.contact_phone ?? '').trim() || (p.phone_number ?? '').trim(),
    email: (p.email ?? '').trim(),
    address: (p.address ?? '').trim(),
    maxMiles: miles,
    known: false,
  }
  if (p.lang === 'en' || p.lang === 'es') draft.lang = p.lang
  const license = (p.license ?? '').trim()
  if (license) draft.license = license
  const mapsUrl = (p.maps_url ?? '').trim()
  if (mapsUrl) draft.mapsUrl = mapsUrl
  return draft
}

/** The `prospect_comments` line that records a sub landing on the bench. */
export function prospectBenchCommentText(companyName: string): string {
  const name = companyName.trim() || 'the company'
  return `Added to the bench: ${name} (/gc?view=partners)`
}

/** The small facts under the company's name on the card: what the kind knows. Empty for a customer with no source. */
export function prospectKindFacts(p: {
  kind: string | null | undefined
  trades?: string[] | null
  max_miles?: number | null
  lang?: string | null
  source?: string | null
  company_role?: string | null
}): string[] {
  const facts: string[] = []
  if (p.kind === 'sub') {
    if (p.max_miles != null && p.max_miles > 0) facts.push(`goes up to ${p.max_miles} mi`)
    const lang = langLabel(p.lang)
    if (lang) facts.push(lang)
  }
  if (p.kind === 'gc_lead') {
    const role = companyRoleChip(p.company_role)
    if (role) facts.push(role)
  }
  const source = (p.source ?? '').trim()
  if (source) facts.push(`from ${source}`)
  return facts
}

/** The toast when the last press lands. */
export function prospectLandedToast(kind: ProspectKind, prospectName: string, targetName: string): string {
  const who = prospectName.trim() || 'Prospect'
  if (kind === 'sub') return `${who} is on the bench`
  if (kind === 'gc_lead') return `${who} asked us → ${targetName.trim() || 'customer'}`
  return `${who} converted → ${targetName.trim() || 'customer'}`
}
