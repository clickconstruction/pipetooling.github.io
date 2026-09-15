/**
 * Cut-sheet assignment state (Submittals 1a): which pages of which dropped
 * vendor PDF go on which submittal row. Pure — the modal holds a SheetState
 * and calls these; nothing here touches a PDF.
 *
 * Pages are 1-based. `fileIndex` is the drop order of the file.
 */

export type SheetAssignment = { fileIndex: number; page: number; tag: string }
export type SheetState = ReadonlyArray<SheetAssignment>

function same(a: SheetAssignment, fileIndex: number, page: number, tag: string): boolean {
  return a.fileIndex === fileIndex && a.page === page && a.tag === tag
}

/** Adds the (file, page, tag) triple; a duplicate is a no-op. */
export function assignPage(state: SheetState, fileIndex: number, page: number, tag: string): SheetAssignment[] {
  if (state.some((a) => same(a, fileIndex, page, tag))) return [...state]
  return [...state, { fileIndex, page, tag }]
}

/** Removes the page from the tag; with no tag, from every tag on that page. */
export function unassignPage(state: SheetState, fileIndex: number, page: number, tag?: string): SheetAssignment[] {
  return state.filter((a) => !(a.fileIndex === fileIndex && a.page === page && (tag === undefined || a.tag === tag)))
}

function ascending(pages: Iterable<number>): number[] {
  return [...new Set(pages)].sort((a, b) => a - b)
}

/** The tag's pages, grouped by file (files in ascending index), pages ascending. */
export function pagesForTag(state: SheetState, tag: string): Array<{ fileIndex: number; pages: number[] }> {
  const byFile = new Map<number, number[]>()
  for (const a of state) {
    if (a.tag !== tag) continue
    const list = byFile.get(a.fileIndex) ?? []
    list.push(a.page)
    byFile.set(a.fileIndex, list)
  }
  return [...byFile.entries()]
    .sort(([a], [b]) => a - b)
    .map(([fileIndex, pages]) => ({ fileIndex, pages: ascending(pages) }))
}

/** Pages that sit on two or more tags. */
export function conflicts(state: SheetState): Array<{ fileIndex: number; page: number; tags: string[] }> {
  const byPage = new Map<string, { fileIndex: number; page: number; tags: string[] }>()
  for (const a of state) {
    const key = `${a.fileIndex}:${a.page}`
    const entry = byPage.get(key) ?? { fileIndex: a.fileIndex, page: a.page, tags: [] }
    if (!entry.tags.includes(a.tag)) entry.tags.push(a.tag)
    byPage.set(key, entry)
  }
  return [...byPage.values()]
    .filter((e) => e.tags.length >= 2)
    .sort((a, b) => a.fileIndex - b.fileIndex || a.page - b.page)
}

/** The file's pages on any row — ascending, unique. */
export function keptPages(state: SheetState, fileIndex: number): number[] {
  return ascending(state.filter((a) => a.fileIndex === fileIndex).map((a) => a.page))
}

/** The file's pages on no row (1..pageCount minus the kept ones). */
export function unusedPages(state: SheetState, fileIndex: number, pageCount: number): number[] {
  const kept = new Set(keptPages(state, fileIndex))
  const out: number[] = []
  for (let p = 1; p <= pageCount; p++) if (!kept.has(p)) out.push(p)
  return out
}

/** The tags (in the given order) with no page on any file. */
export function tagsWithoutSheets(tags: ReadonlyArray<string>, state: SheetState): string[] {
  const covered = new Set(state.map((a) => a.tag))
  return tags.filter((t) => !covered.has(t))
}

/**
 * After a file is trimmed (see ./trimPdf), renumber its assignments with the
 * old→new page map; an assignment whose page is not in the map is dropped.
 * Other files are untouched.
 */
export function remapAfterTrim(state: SheetState, fileIndex: number, map: Record<number, number>): SheetAssignment[] {
  const out: SheetAssignment[] = []
  for (const a of state) {
    if (a.fileIndex !== fileIndex) {
      out.push(a)
      continue
    }
    const next = map[a.page]
    if (next === undefined) continue
    out.push({ fileIndex, page: next, tag: a.tag })
  }
  return out
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/** "6 of 31 pages on rows · 25 not used" — "no pages on rows yet" when none. */
export function describeFooter(state: SheetState, fileIndex: number, pageCount: number): string {
  const kept = keptPages(state, fileIndex).filter((p) => p >= 1 && p <= pageCount).length
  if (kept === 0) return `${plural(pageCount, 'page', 'pages')} · none on rows yet`
  const unused = pageCount - kept
  const head = `${kept} of ${plural(pageCount, 'page', 'pages')} on rows`
  return unused === 0 ? `${head} · all used` : `${head} · ${unused} not used`
}
