import type { Json } from '../types/database'

/**
 * Clusters candidate duplicate pairs (from `find_possible_duplicate_mercury_transactions`)
 * into connected groups via union-find, so three identical charges become one
 * group of three rather than three separate pairs. Pure / React-free.
 */

export type DuplicateTxLite = {
  id: string
  amount: number
  counterpartyName: string | null
  postedAt: string | null
  createdAt: string
  kind: string
  mercuryAccountId: string
  source: string
  raw: Json | null
}

export type DuplicatePair = {
  a: DuplicateTxLite
  b: DuplicateTxLite
  manualInvolved: boolean
  daysApart: number
}

export type DuplicateCluster = {
  /** Stable id derived from the sorted member ids. */
  key: string
  members: DuplicateTxLite[]
  /** True when any member is a manual entry — the real duplicate vector. */
  manualInvolved: boolean
  maxDaysApart: number
  /** Canonical `lo|hi` keys for every observed pair in the cluster (for dismissal). */
  pairKeys: string[]
}

/** Canonical order-independent key for a pair of transaction ids. */
export function duplicatePairKey(id1: string, id2: string): string {
  return id1 < id2 ? `${id1}|${id2}` : `${id2}|${id1}`
}

class UnionFind {
  private parent = new Map<string, string>()

  find(x: string): string {
    let root = this.parent.get(x) ?? x
    if (root === x) {
      this.parent.set(x, x)
      return x
    }
    root = this.find(root)
    this.parent.set(x, root)
    return root
  }

  union(a: string, b: string): void {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.parent.set(ra, rb)
  }
}

export function clusterDuplicatePairs(pairs: DuplicatePair[]): DuplicateCluster[] {
  const uf = new UnionFind()
  const txById = new Map<string, DuplicateTxLite>()
  for (const p of pairs) {
    txById.set(p.a.id, p.a)
    txById.set(p.b.id, p.b)
    uf.union(p.a.id, p.b.id)
  }

  type Acc = { ids: Set<string>; maxDaysApart: number; pairKeys: Set<string> }
  const groups = new Map<string, Acc>()
  for (const p of pairs) {
    const root = uf.find(p.a.id)
    let g = groups.get(root)
    if (!g) {
      g = { ids: new Set(), maxDaysApart: 0, pairKeys: new Set() }
      groups.set(root, g)
    }
    g.ids.add(p.a.id)
    g.ids.add(p.b.id)
    g.maxDaysApart = Math.max(g.maxDaysApart, p.daysApart)
    g.pairKeys.add(duplicatePairKey(p.a.id, p.b.id))
  }

  const clusters: DuplicateCluster[] = []
  for (const g of groups.values()) {
    const memberIds = [...g.ids].sort()
    const members = memberIds
      .map((id) => txById.get(id))
      .filter((m): m is DuplicateTxLite => m != null)
      // Show synced rows first then manual, then chronological — keeps the likely
      // keeper at the top while making the suspect manual entry easy to spot.
      .sort((x, y) => {
        if (x.source !== y.source) return x.source === 'manual' ? 1 : -1
        const xt = x.postedAt ?? x.createdAt
        const yt = y.postedAt ?? y.createdAt
        return xt < yt ? -1 : xt > yt ? 1 : x.id.localeCompare(y.id)
      })
    clusters.push({
      key: memberIds.join('|'),
      members,
      manualInvolved: members.some((m) => m.source === 'manual'),
      maxDaysApart: g.maxDaysApart,
      pairKeys: [...g.pairKeys],
    })
  }

  // Manual-involved first (the actionable ones), then larger clusters, then key.
  return clusters.sort(
    (a, b) =>
      Number(b.manualInvolved) - Number(a.manualInvolved) ||
      b.members.length - a.members.length ||
      a.key.localeCompare(b.key),
  )
}
