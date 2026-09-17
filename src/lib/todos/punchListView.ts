import {
  GROUP_LABELS,
  GROUP_ORDER,
  REPO_BLOB,
  REPO_COMMITS,
  dirForFile,
  mockupLabel,
  type BoardGroup,
  type BoardItem,
} from './todoBoard'

/**
 * The Punch list page's pure half: what a row links to, which rows a filter shows, how
 * the picks add up. The page (`src/pages/PunchList.tsx`) renders these; the data is
 * `src/content/punchList.generated.json`, rendered from the to-dos' front matter by
 * `npm run check:todo-drift -- --fix`.
 */

export type PunchPick = 'do' | 'later' | 'drop'
export type PunchFilter = 'all' | 'unsorted' | PunchPick

export interface PickRecord {
  pick: PunchPick | ''
  note: string
  /** ISO timestamp of the last change. */
  at: string
  /** Who last changed it — a user id for a shared pick; '' for a device-local one. */
  by: string
  /** Their name as the row came back (`users.name`); '' when unknown. Display only. */
  byName: string
}

/** A `punch_list_picks` row as the page selects it, with the user joined for the name. */
export interface PunchPickRow {
  slug: string
  pick: string
  note: string
  updated_at: string
  updated_by: string | null
  users?: { name: string | null } | null
}

/** Rows → the map the page renders; an unknown pick value reads as none. */
export function picksFromRows(rows: readonly PunchPickRow[]): PickMap {
  const out: PickMap = {}
  for (const r of rows) {
    const pick = r.pick === 'do' || r.pick === 'later' || r.pick === 'drop' ? r.pick : ''
    out[r.slug] = { pick, note: r.note ?? '', at: r.updated_at ?? '', by: r.updated_by ?? '', byName: r.users?.name ?? '' }
  }
  return out
}

/** "Robert · Sep 17" — who last touched the row and when; '' when nothing has been picked. */
export function byLine(rec: PickRecord | undefined, locale?: string): string {
  if (!rec || (!rec.pick && !rec.note)) return ''
  const who = rec.byName || (rec.by ? 'Someone' : 'this device')
  if (!rec.at) return who
  const d = new Date(rec.at)
  if (Number.isNaN(d.getTime())) return who
  return `${who} · ${d.toLocaleDateString(locale, { month: 'short', day: 'numeric' })}`
}

export type PickMap = Record<string, PickRecord | undefined>

export const PUNCH_FILTERS: readonly PunchFilter[] = ['all', 'unsorted', 'do', 'later', 'drop']

export const GROUP_BLURBS: Record<BoardGroup, string> = {
  ready: 'Planned, unblocked, the plan names the first PR. These can start today.',
  close: 'Built and on main. What is left is a deletion, a script the owner runs, or a dated wait.',
  gated: 'The code is ready to be written; a yes / no from the owner, Wendi, Taunya or the attorney comes first.',
  waiting: 'Deliberately parked until a measurement window passes.',
  residual: 'Small leftovers from shipped trains. Low priority by their own status line; cheap to pick off in a quiet hour.',
}

/** A pointer row is a standing list, not an open item: no pick, not counted. */
export function isOpenItem(item: Pick<BoardItem, 'pointer'>): boolean {
  return !item.pointer
}

export function pickOf(picks: PickMap, slug: string): PunchPick | '' {
  return picks[slug]?.pick ?? ''
}

export interface PickCounts {
  all: number
  unsorted: number
  do: number
  later: number
  drop: number
}

export function countPicks(items: readonly BoardItem[], picks: PickMap): PickCounts {
  const counts: PickCounts = { all: 0, unsorted: 0, do: 0, later: 0, drop: 0 }
  for (const it of items) {
    if (!isOpenItem(it)) continue
    counts.all++
    const p = pickOf(picks, it.slug)
    if (p) counts[p]++
    else counts.unsorted++
  }
  return counts
}

/** Whether a row shows under a filter. Standing lists show only under All. */
export function rowVisible(item: BoardItem, picks: PickMap, filter: PunchFilter): boolean {
  if (!isOpenItem(item)) return filter === 'all'
  if (filter === 'all') return true
  const p = pickOf(picks, item.slug)
  return filter === 'unsorted' ? !p : p === filter
}

/** Rows per group, in the order the page shows them; empty groups left out. */
export function groupRows(items: readonly BoardItem[]): Array<{ group: BoardGroup; label: string; items: BoardItem[] }> {
  return GROUP_ORDER.map((group) => ({
    group,
    label: GROUP_LABELS[group],
    items: items.filter((i) => i.group === group),
  })).filter((g) => g.items.length > 0)
}

/** Toggle: picking the current pick again clears it. */
export function nextPick(current: PunchPick | '', clicked: PunchPick): PunchPick | '' {
  return current === clicked ? '' : clicked
}

/** A pick record updated in place, stamped now. */
export function withPick(
  prior: PickRecord | undefined,
  patch: Partial<Pick<PickRecord, 'pick' | 'note'>>,
  nowIso: string,
  by = '',
  byName = '',
): PickRecord {
  return { pick: '', note: '', ...prior, ...patch, at: nowIso, by, byName }
}

// ---- links --------------------------------------------------------------------------------

/** The mock-up as the app serves it: the build copies `to-dos/**` html into dist at the same path. */
export function mockupHref(path: string): string {
  return `/${path}`
}

export function fileHref(item: Pick<BoardItem, 'file'>): string {
  return `${REPO_BLOB}${item.file}`
}

export function isFolderTodo(item: Pick<BoardItem, 'file'>): boolean {
  return item.file.endsWith('/README.md')
}

/** Every PR that touched the to-do: the folder's history for a folder to-do, the file's otherwise. */
export function historyHref(item: Pick<BoardItem, 'file'>): string {
  return `${REPO_COMMITS}${isFolderTodo(item) ? dirForFile(item.file) : item.file}`
}

export function folderHref(item: Pick<BoardItem, 'file'>): string | null {
  return isFolderTodo(item) ? `${REPO_BLOB.replace('/blob/', '/tree/')}${dirForFile(item.file)}` : null
}

export function fragmentHref(version: string): string {
  return `${REPO_BLOB}docs/recent-features/${version}.md`
}

export interface LinkChip {
  kind: 'mockup' | 'artifact' | 'history' | 'folder'
  label: string
  href: string
  /** For a mock-up, its repo path (the title attribute). */
  title?: string
}

export function linkChips(item: BoardItem): LinkChip[] {
  const chips: LinkChip[] = [
    ...item.mockups.map((m) => ({ kind: 'mockup' as const, label: mockupLabel(item, m), href: mockupHref(m), title: m })),
    ...item.artifacts.map((a) => ({ kind: 'artifact' as const, label: a.label, href: a.url })),
    { kind: 'history', label: 'history', href: historyHref(item) },
  ]
  const folder = folderHref(item)
  if (folder) chips.push({ kind: 'folder', label: 'folder', href: folder })
  return chips
}

/** The version chip split so each `v2.NNNN` can be a link and the words between stay text. */
export function versionSegments(ver: string): Array<{ text: string; version: string | null }> {
  const out: Array<{ text: string; version: string | null }> = []
  const re = /\bv2\.\d{3,4}\b/g
  let last = 0
  for (const m of ver.matchAll(re)) {
    const i = m.index ?? 0
    if (i > last) out.push({ text: ver.slice(last, i), version: null })
    out.push({ text: m[0], version: m[0] })
    last = i + m[0].length
  }
  if (last < ver.length) out.push({ text: ver.slice(last), version: null })
  return out
}

/** Device-local picks (PR 1): the key the page stores them under. */
export const LOCAL_PICKS_KEY = 'pt-punch-picks'

export function parseLocalPicks(raw: string | null): PickMap {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const out: PickMap = {}
    for (const [slug, rec] of Object.entries(parsed as Record<string, unknown>)) {
      if (!rec || typeof rec !== 'object') continue
      const r = rec as Partial<PickRecord>
      const pick = r.pick === 'do' || r.pick === 'later' || r.pick === 'drop' ? r.pick : ''
      out[slug] = { pick, note: typeof r.note === 'string' ? r.note : '', at: typeof r.at === 'string' ? r.at : '', by: typeof r.by === 'string' ? r.by : '', byName: '' }
    }
    return out
  } catch {
    return {}
  }
}
