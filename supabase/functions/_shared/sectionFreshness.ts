/**
 * One text, many views (punch list #315, upgrade 5a): when each section of an HR document last changed, and how many
 * entries were written since.
 *
 * A summary or a narrative is rewritten a section at a time, so the document's own date says only that something
 * moved. A reader of section 12 needs to know whether section 12 moved. The trigger keeps every prior version
 * (`person_file_revisions`, each with the moment it was replaced), so the answer is already on the file: walk the
 * versions back from the text as it stands, and a section last changed at the moment the newest version that reads
 * differently was replaced.
 *
 * Pure, with no app import, so the People → HR tab (`src/lib/people/sectionFreshness.ts` is its door) and the dev
 * seat can draw from one implementation. Nothing here reads the network or writes.
 */

export type DocSection = {
  /** Stable within one text: the heading's words in lower case, with `#2`, `#3` on a heading written again. */
  key: string
  /** The heading's words, markdown marks stripped. `''` for words above the first heading. */
  heading: string
  /** 1 to 6; 0 for the words above the first heading. */
  level: number
  /** The lines under the heading, up to the next heading of any level, trimmed. */
  body: string
}

/** A prior version of the document, as `person_file_revisions` keeps it. */
export type DocRevision = { content: string; replaced_at: string }

/** An entry on the file: when it was written, and the section numbers its words cite (`N§16`). */
export type FreshnessEntry = { created_at: string; cites?: ReadonlyArray<number> }

export type SectionFreshness = {
  key: string
  heading: string
  level: number
  /** The moment the section took the words it has now; null when the file gives no moment at all. */
  changedAt: string | null
  /**
   * True when the section reads the same in the oldest version in hand, so it changed at or before `changedAt` and
   * the exact moment is older than what was read.
   */
  atLeast: boolean
  /** Entries written after `changedAt`. With `atLeast` the true count may be higher. */
  newerEntries: number
  /** Of those, the entries whose words cite this section's number. 0 for a heading with no number. */
  newerCiting: number
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/
const FENCE_RE = /^\s*(```|~~~)/

/** The sections of a markdown text, in order. A `#` inside a fenced block is not a heading. */
export function docSections(markdown: string): DocSection[] {
  const out: DocSection[] = []
  const seen = new Map<string, number>()
  let heading = ''
  let level = 0
  let lines: string[] = []
  let inFence = false
  const close = () => {
    const body = lines.join('\n').trim()
    lines = []
    // Words above the first heading are a section only when there are some.
    if (level === 0 && body === '') return
    const base = heading.toLowerCase().replace(/\s+/g, ' ').trim()
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    out.push({ key: n === 1 ? base : `${base}#${n}`, heading, level, body })
  }
  for (const line of markdown.split('\n')) {
    if (FENCE_RE.test(line)) {
      inFence = !inFence
      lines.push(line)
      continue
    }
    const m = inFence ? null : HEADING_RE.exec(line)
    const text = m ? m[2]!.replace(/`/g, '').replace(/\*\*/g, '').trim() : ''
    if (!m || text === '') {
      lines.push(line)
      continue
    }
    close()
    heading = text
    level = m[1]!.length
  }
  close()
  return out
}

/** Two bodies read the same when only their spacing differs: a rewrite that reflows a paragraph is not a change. */
function sameWords(a: string, b: string): boolean {
  return a.replace(/\s+/g, ' ').trim() === b.replace(/\s+/g, ' ').trim()
}

/** The number a heading carries, as the citations read it: `16. Bidding conduct` → 16, `§3 The shop` → 3. */
export function sectionNumber(heading: string): number | null {
  const m = /^\s*(?:§\s*)?(\d{1,3})(?:[.:)]|\s+[-–—]|\s)/.exec(heading)
  return m ? Number(m[1]) : null
}

/**
 * Each section of the document as it stands, with the moment it took its present words.
 *
 * `revisions` are the prior versions in any order. A revision's `replaced_at` is the moment the next version began,
 * so the newest revision's is the moment the present text began. A section that reads the same in a revision was
 * already there before that revision was replaced; the walk goes back until one reads differently or has no such
 * section, and the section changed when THAT one was replaced.
 *
 * With no revision the document was written once, at `updatedAt`. When every revision in hand reads the same, the
 * section is at least as old as the oldest one's start, which the file does not record: `changedAt` is the oldest
 * `replaced_at` and `atLeast` says the true moment is earlier. A caller that read only the newest revisions gets the
 * same answer for the same reason: the oldest one read is the bound.
 */
export function sectionFreshness(input: { content: string; updatedAt: string | null; revisions: ReadonlyArray<DocRevision>; entries: ReadonlyArray<FreshnessEntry> }): SectionFreshness[] {
  const newestFirst = [...input.revisions].sort((a, b) => (a.replaced_at < b.replaced_at ? 1 : a.replaced_at > b.replaced_at ? -1 : 0))
  const prior = newestFirst.map((r) => ({ at: r.replaced_at, byKey: new Map(docSections(r.content).map((s) => [s.key, s.body])) }))
  return docSections(input.content).map((s) => {
    let changedAt: string | null = input.updatedAt
    let atLeast = false
    if (prior.length > 0) {
      const differs = prior.findIndex((v) => {
        const was = v.byKey.get(s.key)
        return was === undefined || !sameWords(was, s.body)
      })
      if (differs === -1) {
        changedAt = prior[prior.length - 1]!.at
        atLeast = true
      } else {
        changedAt = prior[differs]!.at
      }
    }
    const n = sectionNumber(s.heading)
    let newerEntries = 0
    let newerCiting = 0
    if (changedAt) {
      for (const e of input.entries) {
        if (!(e.created_at > changedAt)) continue
        newerEntries += 1
        if (n !== null && e.cites?.includes(n)) newerCiting += 1
      }
    }
    return { key: s.key, heading: s.heading, level: s.level, changedAt, atLeast, newerEntries, newerCiting }
  })
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** An ISO moment as a day in words, on the calendar day `ymdOf` answers for it (the app's zone, passed in). */
function dayWords(iso: string, ymdOf: (iso: string) => string): string {
  const ymd = ymdOf(iso)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  const month = m ? MONTHS[Number(m[2]) - 1] : undefined
  return m && month ? `${month} ${Number(m[3])}, ${m[1]}` : ymd
}

/** *changed Nov 3, 2026* · *not changed since before Oct 1, 2026* · *no date on file*. */
export function sectionChangedWords(f: Pick<SectionFreshness, 'changedAt' | 'atLeast'>, ymdOf: (iso: string) => string): string {
  if (!f.changedAt) return 'no date on file'
  return f.atLeast ? `not changed since before ${dayWords(f.changedAt, ymdOf)}` : `changed ${dayWords(f.changedAt, ymdOf)}`
}

/** *no entries since* · *4 entries since* · *4 entries since, 2 cite it* · *at least 12 entries since*. */
export function sectionNewerWords(f: Pick<SectionFreshness, 'changedAt' | 'atLeast' | 'newerEntries' | 'newerCiting'>): string {
  if (!f.changedAt) return ''
  if (f.newerEntries === 0) return f.atLeast ? 'no entries since then' : 'no entries since'
  const count = `${f.atLeast ? 'at least ' : ''}${f.newerEntries} ${f.newerEntries === 1 ? 'entry' : 'entries'} since`
  if (f.newerCiting === 0) return count
  return `${count}, ${f.newerCiting} ${f.newerCiting === 1 ? 'cites' : 'cite'} it`
}

/** Whether a reader should look again before relying on the section: an entry that cites it was written since. */
export function sectionNeedsALook(f: Pick<SectionFreshness, 'newerCiting'>): boolean {
  return f.newerCiting > 0
}

/** The head line over the list: *9 sections · 2 cited by entries written since they last changed*. */
export function sectionFreshnessHeadWords(rows: ReadonlyArray<Pick<SectionFreshness, 'newerCiting'>>): string {
  const look = rows.filter(sectionNeedsALook).length
  const sections = `${rows.length} ${rows.length === 1 ? 'section' : 'sections'}`
  if (look === 0) return `${sections} · none cited by an entry written since it last changed`
  return `${sections} · ${look} cited by ${look === 1 ? 'an entry' : 'entries'} written since ${look === 1 ? 'it' : 'they'} last changed`
}
