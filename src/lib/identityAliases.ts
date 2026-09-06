import { supabase } from './supabase'
import { normalizeIdentityKey } from './identityKey'

/**
 * Identity aliases (Tier 5 X7): the merges the key cannot make on its own, recorded once and
 * applied at every join. `identity_aliases(kind, alias_key) → canonical_key` with a `decision`:
 * `merge` folds the alias into the canonical spelling; `keep` records "these are different,
 * stop asking". Keys are `normalizeIdentityKey` output.
 */

export type IdentityKind = 'builder' | 'manufacturer' | 'crew_name'
export type IdentityAliasDecision = 'merge' | 'keep'

export type IdentityAliasRow = {
  kind: IdentityKind
  alias_key: string
  canonical_key: string
  canonical_name: string
  decision: IdentityAliasDecision
}

export type IdentityAliasMap = ReadonlyMap<string, IdentityAliasRow>

/** Follow `merge` aliases to the canonical key (bounded, so a cycle cannot spin). */
export function canonicalIdentityKey(key: string, aliases: IdentityAliasMap): string {
  let cur = key
  for (let i = 0; i < 8; i++) {
    const row = aliases.get(cur)
    if (!row || row.decision !== 'merge' || row.canonical_key === cur) return cur
    cur = row.canonical_key
  }
  return cur
}

/** The display name the canonical spelling carries, when an alias set one. */
export function canonicalIdentityName(key: string, aliases: IdentityAliasMap): string | null {
  const canon = canonicalIdentityKey(key, aliases)
  for (const row of aliases.values()) {
    if (row.decision === 'merge' && row.canonical_key === canon && row.canonical_name) return row.canonical_name
  }
  return null
}

/** A pair a person already answered ("keep") should not be offered again. */
export function identityPairKept(a: string, b: string, aliases: IdentityAliasMap): boolean {
  const ra = aliases.get(a)
  const rb = aliases.get(b)
  return (ra?.decision === 'keep' && ra.canonical_key === b) || (rb?.decision === 'keep' && rb.canonical_key === a)
}

export function builderNameKey(name: string | null | undefined, aliases: IdentityAliasMap): string {
  return `name:${canonicalIdentityKey(normalizeIdentityKey(name), aliases)}`
}

export async function loadIdentityAliases(kind: IdentityKind): Promise<IdentityAliasMap> {
  const { data, error } = await supabase.from('identity_aliases').select('kind, alias_key, canonical_key, canonical_name, decision').eq('kind', kind)
  // A missing table (migration not pushed yet) reads as "no aliases".
  if (error) return new Map()
  const map = new Map<string, IdentityAliasRow>()
  for (const r of (data ?? []) as IdentityAliasRow[]) map.set(r.alias_key, r)
  return map
}

export async function saveIdentityAlias(row: Omit<IdentityAliasRow, 'kind'> & { kind: IdentityKind }, createdBy: string | null): Promise<string | null> {
  const { error } = await supabase.from('identity_aliases').upsert({ ...row, created_by: createdBy }, { onConflict: 'kind,alias_key' })
  return error ? error.message : null
}
