/**
 * A builder as the database keeps it, and where it stands (punch list #404, step 2). The table `document_builders`
 * holds one row a builder: the draft being set up, the published copy everyone outside sees, that copy's revision,
 * and who read which revision. This file turns a row into a record the screens read, and a record into the few
 * things a screen says about it: not loaded yet, a draft, or published on a revision, with changes not published,
 * read or not.
 *
 * A builder is **read** when its read mark names the published revision. A new revision is unread again, and nothing
 * has to clear the mark for that to hold.
 *
 * Pure: no React, no supabase.
 */
import { formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'
import type { BuilderChip, DocumentBuilderEntry, DocumentBuilderKind } from './builders'

export const DOCUMENT_BUILDERS_TABLE = 'document_builders'
export const DOCUMENT_BUILDER_SELECT = 'key, kind, draft, published, revision, published_at, read_revision, read_by_name, read_on, updated_at'

export type BuilderReadMark = { revision: number; byName: string; on: string }

export type BuilderRecord = {
  key: string
  kind: DocumentBuilderKind
  /** The contents being set up, as stored. A kind's own kernel reads them (`definition.ts` for a walked builder). */
  draft: unknown
  /** The contents everyone outside sees. Null until the first publish. */
  published: unknown
  /** The published copy's number. 0 means never published. */
  revision: number
  publishedAt: string | null
  read: BuilderReadMark | null
  updatedAt: string | null
}

function isBag(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** A row of the table as a record, or null for a row that is not one. */
export function builderRecordFromRow(row: unknown): BuilderRecord | null {
  if (!isBag(row)) return null
  const { key, kind, draft, published, revision } = row
  if (typeof key !== 'string' || !key) return null
  if (kind !== 'walked' && kind !== 'filled') return null
  if (!isBag(draft)) return null
  if (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 0) return null
  const readRevision = row.read_revision
  const readBy = typeof row.read_by_name === 'string' ? row.read_by_name.trim() : ''
  const readOn = typeof row.read_on === 'string' ? row.read_on : ''
  const read = typeof readRevision === 'number' && readBy && readOn ? { revision: readRevision, byName: readBy, on: readOn } : null
  return {
    key,
    kind,
    draft,
    published: isBag(published) ? published : null,
    revision,
    publishedAt: typeof row.published_at === 'string' ? row.published_at : null,
    read,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
  }
}

/** The rows of a read, as records by builder. A row that is not a builder's is left out, never guessed at. */
export function builderRecordsByKey(rows: ReadonlyArray<unknown>): Map<string, BuilderRecord> {
  const out = new Map<string, BuilderRecord>()
  for (const row of rows) {
    const rec = builderRecordFromRow(row)
    if (rec) out.set(rec.key, rec)
  }
  return out
}

export type BuilderStanding = 'not-loaded' | 'draft' | 'published'

export function builderStanding(rec: BuilderRecord | null): BuilderStanding {
  if (!rec) return 'not-loaded'
  return rec.revision > 0 ? 'published' : 'draft'
}

/** True when the read mark names the published revision. */
export function isBuilderRead(rec: BuilderRecord | null): boolean {
  return rec != null && rec.revision > 0 && rec.read != null && rec.read.revision === rec.revision
}

/** The same JSON whatever order its keys were written in, so two copies of one definition compare equal. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (isBag(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(value[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

export function sameContents(a: unknown, b: unknown): boolean {
  return stable(a) === stable(b)
}

/** True when a published builder's draft has moved on from its published copy. */
export function hasUnpublishedChanges(rec: BuilderRecord | null): boolean {
  return rec != null && rec.revision > 0 && !sameContents(rec.draft, rec.published)
}

/**
 * Where a builder stands, as the chips on its row and on its open bar. Each says only what is so: nothing reads
 * *Published* before a publish, and the read chip names who read it and the day only while the mark is on the
 * published revision.
 */
export function builderStandingChips(entry: DocumentBuilderEntry, rec: BuilderRecord | null): BuilderChip[] {
  const standing = builderStanding(rec)
  if (!rec || standing === 'not-loaded') return [{ tone: 'wait', words: 'Not loaded yet' }]
  const chips: BuilderChip[] = []
  if (standing === 'draft') chips.push({ tone: 'wait', words: 'Draft, not published' })
  else {
    chips.push({ tone: 'ok', words: `Published, revision ${rec.revision}` })
    if (hasUnpublishedChanges(rec)) chips.push({ tone: 'warn', words: 'Changes not published' })
  }
  if (isBuilderRead(rec) && rec.read) chips.push({ tone: 'ok', words: `${entry.reader.readBy} ${rec.read.byName}, ${formatWorkDateYmdMonthDayShort(rec.read.on)}` })
  else chips.push({ tone: 'warn', words: entry.reader.unread })
  return chips
}

/** What the row's press does: load the first draft while there is none, then open. */
export function builderRowPress(rec: BuilderRecord | null): 'load' | 'open' {
  return builderStanding(rec) === 'not-loaded' ? 'load' : 'open'
}
