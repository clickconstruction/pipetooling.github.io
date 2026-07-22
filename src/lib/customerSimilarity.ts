/**
 * Customers → "Show similar": cluster likely duplicate customers so they can be
 * merged before they cause trouble (born from a real incident: two identical
 * "John Ingram" rows created by a failed create-from-job retry).
 *
 * Two customers are considered similar when they share ANY normalized signal:
 * name, address, phone, or email. Sharing is exact after normalization
 * (case / punctuation / whitespace / phone formatting) — no fuzzy matching, so
 * every flagged pair is explainable. Groups are transitive (A~B by phone and
 * B~C by address puts all three together). Pure — no React, no supabase.
 */

export type SimilarCustomerInput = {
  id: string
  name?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
}

export type SimilarCustomerGroup = {
  /** Member ids, input order preserved. */
  ids: string[]
  /** Which signals matched inside this group, e.g. ['name', 'address']. */
  matchedBy: string[]
}

export function normalizeCustomerName(name: string | null | undefined): string {
  return (name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeCustomerAddress(address: string | null | undefined): string {
  const a = (address ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  // Too short to be a meaningful street address — don't match on it.
  return a.length >= 8 ? a : ''
}

export function normalizeCustomerPhone(phone: string | null | undefined): string {
  let d = (phone ?? '').replace(/\D+/g, '')
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1)
  return d.length >= 7 ? d : ''
}

export function normalizeCustomerEmail(email: string | null | undefined): string {
  const e = (email ?? '').trim().toLowerCase()
  return e.includes('@') ? e : ''
}

const SIGNALS = [
  { kind: 'name', key: (r: SimilarCustomerInput) => normalizeCustomerName(r.name) },
  { kind: 'address', key: (r: SimilarCustomerInput) => normalizeCustomerAddress(r.address) },
  { kind: 'phone', key: (r: SimilarCustomerInput) => normalizeCustomerPhone(r.phone) },
  { kind: 'email', key: (r: SimilarCustomerInput) => normalizeCustomerEmail(r.email) },
] as const

/** Groups of 2+ likely-duplicate customers, biggest groups first. */
export function findSimilarCustomerGroups(rows: readonly SimilarCustomerInput[]): SimilarCustomerGroup[] {
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    let r = x
    while (parent.get(r) !== r) r = parent.get(r)!
    // Path compression.
    let c = x
    while (c !== r) {
      const next = parent.get(c)!
      parent.set(c, r)
      c = next
    }
    return r
  }
  const union = (a: string, b: string) => {
    parent.set(find(a), find(b))
  }
  for (const r of rows) parent.set(r.id, r.id)

  // kind → normalized key → member ids
  const keyMembers = new Map<string, string[]>()
  for (const sig of SIGNALS) {
    for (const r of rows) {
      const key = sig.key(r)
      if (!key) continue
      const mapKey = `${sig.kind}:${key}`
      const list = keyMembers.get(mapKey)
      if (list) {
        union(r.id, list[0]!)
        list.push(r.id)
      } else {
        keyMembers.set(mapKey, [r.id])
      }
    }
  }

  const membersByRoot = new Map<string, string[]>()
  for (const r of rows) {
    const root = find(r.id)
    ;(membersByRoot.get(root) ?? membersByRoot.set(root, []).get(root)!).push(r.id)
  }

  const matchedByRoot = new Map<string, Set<string>>()
  for (const [mapKey, members] of keyMembers) {
    if (members.length < 2) continue
    const kind = mapKey.slice(0, mapKey.indexOf(':'))
    const root = find(members[0]!)
    ;(matchedByRoot.get(root) ?? matchedByRoot.set(root, new Set()).get(root)!).add(kind)
  }

  const groups: SimilarCustomerGroup[] = []
  for (const [root, ids] of membersByRoot) {
    if (ids.length < 2) continue
    const kinds = matchedByRoot.get(root) ?? new Set()
    groups.push({
      ids,
      matchedBy: SIGNALS.map((s) => s.kind).filter((k) => kinds.has(k)),
    })
  }
  groups.sort((a, b) => b.ids.length - a.ids.length || a.ids[0]!.localeCompare(b.ids[0]!))
  return groups
}
