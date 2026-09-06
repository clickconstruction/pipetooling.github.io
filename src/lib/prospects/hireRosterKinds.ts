/**
 * Roster kinds the Hire → roster hand-off may write (v2.2910, journey-map
 * J25-F5). The modal that opens when a candidate is marked hired inserts a
 * `people` row; until v2.2910 it offered only Subcontractor | Helper while the
 * pipeline's actual traffic was Office Manager hires, so office hires were
 * mis-kinded or the modal was skipped.
 *
 * The list is every value `people_kind_check` accepts except `dev` (never a
 * hire). `controller` is deliberately absent: the app's `PersonKind` union
 * knows it, but the DB CHECK constraint (baseline) does not — offering it here
 * would fail the insert.
 */
export type HireRosterKind = 'sub' | 'helper' | 'assistant' | 'estimator' | 'superintendent' | 'primary' | 'master_technician'

export const HIRE_ROSTER_KINDS: ReadonlyArray<{ kind: HireRosterKind; label: string }> = [
  { kind: 'sub', label: 'Subcontractor' },
  { kind: 'helper', label: 'Helper' },
  { kind: 'assistant', label: 'Office / assistant' },
  { kind: 'estimator', label: 'Estimator' },
  { kind: 'superintendent', label: 'Superintendent' },
  { kind: 'primary', label: 'Primary' },
  { kind: 'master_technician', label: 'Master technician' },
]

export const DEFAULT_HIRE_ROSTER_KIND: HireRosterKind = 'sub'

const KIND_HINTS: ReadonlyArray<{ kind: HireRosterKind; pattern: RegExp }> = [
  { kind: 'assistant', pattern: /\b(office|admin|assistant|dispatch|reception|bookkeep|clerk|coordinator)/i },
  { kind: 'estimator', pattern: /\bestimat/i },
  { kind: 'superintendent', pattern: /\b(superintendent|super|foreman|project manager|pm)\b/i },
  { kind: 'primary', pattern: /\bprimary\b/i },
  { kind: 'master_technician', pattern: /\bmaster\b/i },
  { kind: 'helper', pattern: /\b(helper|apprentice|laborer|labourer)/i },
]

/**
 * Pre-select the roster kind from the hiring-board role the candidate sits in
 * ("Office Manager" → assistant, "Apprentice" → helper). Anything unrecognised
 * — "Plumber", a blank role — stays Subcontractor, the historical default;
 * the modal still lets the user change it.
 */
export function suggestRosterKind(roleName: string | null | undefined): HireRosterKind {
  const name = (roleName ?? '').trim()
  if (!name) return DEFAULT_HIRE_ROSTER_KIND
  for (const hint of KIND_HINTS) {
    if (hint.pattern.test(name)) return hint.kind
  }
  return DEFAULT_HIRE_ROSTER_KIND
}

export function isHireRosterKind(value: string): value is HireRosterKind {
  return HIRE_ROSTER_KINDS.some((k) => k.kind === value)
}
