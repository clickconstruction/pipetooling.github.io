import { isSelectableOption, type SearchableSelectOption } from '../components/SearchableSelect'

// Banking attribution picker: combine login `users` and roster `people` into one option list,
// encoding the entity type in the value (`u:<userId>` / `p:<personId>`) so the save knows
// whether to write user_id or person_id. People are tagged by kind (e.g. "Joe · Sub") so
// External Subcontractors (kind='sub') are recognizable next to users.

const PERSON_KIND_SHORT_LABEL: Record<string, string> = {
  sub: 'Sub',
  helper: 'Helper',
  estimator: 'Estimator',
  primary: 'Primary',
  superintendent: 'Superintendent',
  assistant: 'Assistant',
  master_technician: 'Master',
}

export function bankingPersonKindTag(kind: string | null): string {
  if (!kind) return 'Person'
  return PERSON_KIND_SHORT_LABEL[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1)
}

export type BankingAttributionPersonRow = { id: string; name: string; kind: string | null }

/** Combined picker options: users (`u:<id>`) first, then people (`p:<id>`, tagged by kind). */
export function buildBankingAttributionOptions(
  users: SearchableSelectOption[],
  people: BankingAttributionPersonRow[],
): SearchableSelectOption[] {
  const userOpts: SearchableSelectOption[] = []
  for (const o of users) {
    if (!isSelectableOption(o)) continue
    userOpts.push({ value: `u:${o.value}`, label: o.label })
  }
  const personOpts: SearchableSelectOption[] = [...people]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => ({ value: `p:${p.id}`, label: `${p.name} · ${bankingPersonKindTag(p.kind)}` }))
  return [...userOpts, ...personOpts]
}

/** Decode a picker value into the attribution columns. Empty → clear (both null). */
export function parseBankingAttributionValue(v: string): { userId: string | null; personId: string | null } {
  if (v.startsWith('u:')) return { userId: v.slice(2), personId: null }
  if (v.startsWith('p:')) return { userId: null, personId: v.slice(2) }
  return { userId: null, personId: null }
}

/** Encode a transaction's current attribution (from the pivot's source/sourceId) into a picker value. */
export function bankingAttributionValueForSource(
  source: 'user' | 'person' | 'unassigned' | null | undefined,
  id: string | null,
): string {
  if (!id) return ''
  if (source === 'user') return `u:${id}`
  if (source === 'person') return `p:${id}`
  return ''
}
