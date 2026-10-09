/**
 * Division 22 rules manager kernel (v2.5054, PR 1 of the manager train — `to-dos/division-22-rules-manager.md`).
 *
 * The ledger (`spec_section_match_rules`) decides each fixture name by the first rule, in priority order, whose
 * pattern catches it (`classifySpecSection`). This kernel answers what a person managing that ledger needs before
 * touching it, using the same order and the same test so it can never disagree with the classifier:
 *   - each rule's standing — the names it decides, the names it catches but an earlier rule decides (shadowed),
 *     or nothing at all (idle);
 *   - the effect of a draft add, edit or delete — every name whose outcome or section changes, and the coverage
 *     before and after;
 *   - what is wrong with a draft (refusals) and what deserves a second look (warnings);
 *   - the rules grouped under their sections for the manager's list.
 * Pure: no database, no React.
 */

import { classifySpecSection, type SpecSectionMatchKind, type SpecSectionMatchRule } from './classifySpecSection'
import { foldFixtureNameSpellings, type FixtureNameAuditInput } from './specSectionAudit'

/** A ledger row as the manager holds it: the classifier's rule plus its id. */
export type LedgerRule = SpecSectionMatchRule & { id: string }

/** The same order `classifySpecSection` applies: ascending priority, input order kept on a tie. */
export function orderRules<T extends SpecSectionMatchRule>(rules: ReadonlyArray<T>): T[] {
  return [...rules].sort((a, b) => a.priority - b.priority)
}

/** Whether one rule's pattern catches a name, ignoring every other rule (case-insensitive, trimmed). */
export function ruleCatches(rule: SpecSectionMatchRule, name: string): boolean {
  const needle = name.trim().toLowerCase()
  const pattern = rule.pattern.trim().toLowerCase()
  if (!needle || !pattern) return false
  if (rule.matchKind === 'exact') return needle === pattern
  if (rule.matchKind === 'starts_with') return needle.startsWith(pattern)
  return needle.includes(pattern)
}

export type RuleStanding = {
  id: string
  /** `deciding`: decides at least one name. `shadowed`: catches names, but an earlier rule decides every one. `idle`: catches none. */
  state: 'deciding' | 'shadowed' | 'idle'
  /** Names this rule decides. */
  wins: number
  /** Bids behind the names it decides. */
  winBids: number
  /** Names it catches that an earlier rule decides. */
  shadowed: number
  /** Up to `sampleSize` decided names, most bids first. */
  sampleWins: string[]
  /** For a shadowed name: which rule decides it instead (first `sampleSize`, most bids first). */
  sampleShadowedBy: Array<{ fixture: string; byRuleId: string }>
}

/** Every rule's standing against the audit's names (`spec_section_fixture_name_audit`), spellings folded as the audit folds them. */
export function ruleStandings(
  rules: ReadonlyArray<LedgerRule>,
  names: ReadonlyArray<FixtureNameAuditInput>,
  sampleSize = 5,
): Map<string, RuleStanding> {
  const ordered = orderRules(rules)
  const decided = new Map<string, Array<{ fixture: string; bidCount: number }>>()
  const shadowedBy = new Map<string, Array<{ fixture: string; bidCount: number; byRuleId: string }>>()
  for (const n of foldFixtureNameSpellings(names)) {
    let winner: LedgerRule | null = null
    for (const rule of ordered) {
      if (!ruleCatches(rule, n.fixture)) continue
      if (!winner) {
        winner = rule
        const list = decided.get(rule.id) ?? []
        list.push({ fixture: n.fixture, bidCount: n.bidCount })
        decided.set(rule.id, list)
      } else {
        const list = shadowedBy.get(rule.id) ?? []
        list.push({ fixture: n.fixture, bidCount: n.bidCount, byRuleId: winner.id })
        shadowedBy.set(rule.id, list)
      }
    }
  }
  const byBids = (a: { fixture: string; bidCount: number }, b: { fixture: string; bidCount: number }) =>
    b.bidCount - a.bidCount || a.fixture.localeCompare(b.fixture)
  const out = new Map<string, RuleStanding>()
  for (const rule of rules) {
    const wins = [...(decided.get(rule.id) ?? [])].sort(byBids)
    const lost = [...(shadowedBy.get(rule.id) ?? [])].sort(byBids)
    out.set(rule.id, {
      id: rule.id,
      state: wins.length > 0 ? 'deciding' : lost.length > 0 ? 'shadowed' : 'idle',
      wins: wins.length,
      winBids: wins.reduce((s, w) => s + w.bidCount, 0),
      shadowed: lost.length,
      sampleWins: wins.slice(0, sampleSize).map((w) => w.fixture),
      sampleShadowedBy: lost.slice(0, sampleSize).map((l) => ({ fixture: l.fixture, byRuleId: l.byRuleId })),
    })
  }
  return out
}

/** A rule as the manager's form holds it before it is saved. */
export type RuleDraft = { pattern: string; matchKind: SpecSectionMatchKind; sectionCode: string | null; priority: number }

export type RuleChange =
  | { kind: 'add'; draft: RuleDraft }
  | { kind: 'edit'; id: string; draft: RuleDraft }
  | { kind: 'delete'; id: string }

/** The id a draft added rule carries inside a preview. */
export const DRAFT_RULE_ID = 'draft'

/** The ledger after a change, for previews only (nothing is saved). An edit keeps the rule's place among equal priorities. */
export function applyRuleChange(rules: ReadonlyArray<LedgerRule>, change: RuleChange): LedgerRule[] {
  if (change.kind === 'delete') return rules.filter((r) => r.id !== change.id)
  if (change.kind === 'edit') return rules.map((r) => (r.id === change.id ? { id: r.id, ...change.draft } : r))
  return [...rules, { id: DRAFT_RULE_ID, ...change.draft }]
}

export type NameOutcome = { outcome: 'matched'; sectionCode: string } | { outcome: 'no-code' } | { outcome: 'unmatched' }

export type NameShift = { fixture: string; bidCount: number; before: NameOutcome; after: NameOutcome }

export type RuleChangePreview = {
  /** Every name whose outcome or section changes, most bids first. */
  shifts: NameShift[]
  /** Uncoded before, decided after (a section or a deliberate no-code). */
  newlyCoded: number
  /** Decided before, uncoded after. */
  newlyUncoded: number
  /** Decided both times, but differently (another section, or section ↔ no-code). */
  recoded: number
  /** 0–100, rounded, as the audit counts it (no-code is covered); 100 when there are no names. */
  coverageBefore: number
  coverageAfter: number
}

function outcomeOf(name: string, rules: ReadonlyArray<SpecSectionMatchRule>): NameOutcome {
  const m = classifySpecSection(name, rules)
  if (m.outcome === 'matched') return { outcome: 'matched', sectionCode: m.sectionCode }
  return m.outcome === 'no-code' ? { outcome: 'no-code' } : { outcome: 'unmatched' }
}

function sameOutcome(a: NameOutcome, b: NameOutcome): boolean {
  if (a.outcome !== b.outcome) return false
  return a.outcome !== 'matched' || a.sectionCode === (b as { sectionCode: string }).sectionCode
}

/** What a change would do to every name, before anything is saved. */
export function previewRuleChange(
  rules: ReadonlyArray<LedgerRule>,
  names: ReadonlyArray<FixtureNameAuditInput>,
  change: RuleChange,
): RuleChangePreview {
  const after = applyRuleChange(rules, change)
  const shifts: NameShift[] = []
  let coveredBefore = 0
  let coveredAfter = 0
  let total = 0
  for (const n of foldFixtureNameSpellings(names)) {
    total += 1
    const b = outcomeOf(n.fixture, rules)
    const a = outcomeOf(n.fixture, after)
    if (b.outcome !== 'unmatched') coveredBefore += 1
    if (a.outcome !== 'unmatched') coveredAfter += 1
    if (!sameOutcome(b, a)) shifts.push({ fixture: n.fixture, bidCount: n.bidCount, before: b, after: a })
  }
  shifts.sort((x, y) => y.bidCount - x.bidCount || x.fixture.localeCompare(y.fixture))
  const pct = (covered: number) => (total === 0 ? 100 : Math.round((covered / total) * 100))
  return {
    shifts,
    newlyCoded: shifts.filter((s) => s.before.outcome === 'unmatched').length,
    newlyUncoded: shifts.filter((s) => s.after.outcome === 'unmatched').length,
    recoded: shifts.filter((s) => s.before.outcome !== 'unmatched' && s.after.outcome !== 'unmatched').length,
    coverageBefore: pct(coveredBefore),
    coverageAfter: pct(coveredAfter),
  }
}

export type RuleProblem = { level: 'refuse' | 'warn'; message: string }

/** A `contains` or `starts with` pattern this short catches more than it means: "CO" catches COPPER. */
export const SHORT_PATTERN_MAX = 2

/** What stops a draft from saving (`refuse`) and what deserves a second look (`warn`). `editingId` is the rule being edited, if any. */
export function validateRuleDraft(
  draft: RuleDraft,
  rules: ReadonlyArray<LedgerRule>,
  sectionCodes: ReadonlySet<string>,
  editingId?: string,
): RuleProblem[] {
  const problems: RuleProblem[] = []
  const pattern = draft.pattern.trim()
  if (!pattern) problems.push({ level: 'refuse', message: 'Type the words the rule looks for.' })
  if (draft.sectionCode != null && !sectionCodes.has(draft.sectionCode)) {
    problems.push({ level: 'refuse', message: `There is no section ${draft.sectionCode}. Add the section first.` })
  }
  if (!Number.isInteger(draft.priority) || draft.priority < 1) {
    problems.push({ level: 'refuse', message: 'The order is a whole number of 1 or more.' })
  }
  const key = pattern.toLowerCase()
  const twin = key
    ? rules.find((r) => r.id !== editingId && r.matchKind === draft.matchKind && r.pattern.trim().toLowerCase() === key)
    : undefined
  if (twin) problems.push({ level: 'refuse', message: `A rule already looks for “${twin.pattern.trim()}” this way. Edit that rule instead.` })
  if (key && draft.matchKind !== 'exact' && key.length <= SHORT_PATTERN_MAX) {
    problems.push({
      level: 'warn',
      message: `“${pattern}” is short, so it catches more than it means: “CO” catches COPPER. Use “exactly”, or a longer pattern.`,
    })
  }
  return problems
}

/** Where a priority sits among the ledger's bands (a hint for the order field; the ledger does not enforce bands). */
export function priorityBand(priority: number): 'seeded names' | 'pinned names' | 'patterns' | 'catch-alls' {
  if (priority < 60) return 'seeded names'
  if (priority < 100) return 'pinned names'
  if (priority < 700) return 'patterns'
  return 'catch-alls'
}

export type SectionRuleGroup = {
  /** Null for the deliberate no-code rules. */
  code: string | null
  title: string
  /** In the order they decide. */
  rules: LedgerRule[]
}

/**
 * The rules under their sections for the manager's list: sections in code order (every section, even one with no
 * rules), then the no-code rules last. A rule naming a section that is not in `sections` is grouped under its code
 * with the title "Unknown section", so nothing disappears from the list.
 */
export function groupRulesBySection(
  rules: ReadonlyArray<LedgerRule>,
  sections: ReadonlyArray<{ code: string; title: string }>,
): SectionRuleGroup[] {
  const ordered = orderRules(rules)
  const titles = new Map(sections.map((s) => [s.code, s.title]))
  const codes = new Set(sections.map((s) => s.code))
  for (const r of ordered) if (r.sectionCode != null) codes.add(r.sectionCode)
  const groups: SectionRuleGroup[] = [...codes]
    .sort((a, b) => a.localeCompare(b))
    .map((code) => ({ code, title: titles.get(code) ?? 'Unknown section', rules: ordered.filter((r) => r.sectionCode === code) }))
  groups.push({ code: null, title: 'No code (deliberately)', rules: ordered.filter((r) => r.sectionCode == null) })
  return groups
}

export type SectionTally = {
  /** Null for the deliberate no-code rules. */
  code: string | null
  title: string
  /** Rules filed under the section. */
  rules: number
  /** Names those rules decide. */
  names: number
  /** Bids behind those names. */
  bids: number
}

/** Per-section totals for the manager's Sections tab (v2.5058), in the same order as the groups. */
export function sectionTallies(groups: ReadonlyArray<SectionRuleGroup>, standings: ReadonlyMap<string, RuleStanding>): SectionTally[] {
  return groups.map((g) => ({
    code: g.code,
    title: g.title,
    rules: g.rules.length,
    names: g.rules.reduce((s, r) => s + (standings.get(r.id)?.wins ?? 0), 0),
    bids: g.rules.reduce((s, r) => s + (standings.get(r.id)?.winBids ?? 0), 0),
  }))
}
