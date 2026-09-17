/**
 * A reviewer's own file on a revision (Submittals stage 5b): the architect who marks up the
 * PDF or answers by email instead of using the room. Stored on `bid_submittals.reviewer_files`
 * (jsonb) with the object in the bid-submittals bucket under <bid>/<rev>/reviewer/. The room
 * never shows these; the office types the decisions onto the rows (`enteredDecisions.ts`).
 */

export type ReviewerFileKind = 'redline' | 'email'

export type ReviewerFile = {
  path: string
  name: string
  kind: ReviewerFileKind
  droppedAt: string
  droppedBy: string | null
  droppedByName: string | null
  /** The reviewer the file came from, when the office said so. */
  personId: string | null
  personName: string | null
}

const EMAIL_EXT = /\.(eml|msg|txt|html?)$/i

/** A PDF is a redline; an .eml / .msg / .txt / .html is a forwarded email; anything else is refused (null). */
export function reviewerFileKind(name: string, mime?: string | null): ReviewerFileKind | null {
  const n = name.trim().toLowerCase()
  if (n.endsWith('.pdf') || mime === 'application/pdf') return 'redline'
  if (EMAIL_EXT.test(n) || mime === 'message/rfc822') return 'email'
  return null
}

/** The bucket path: <bid>/<rev>/reviewer/<index>-<safe name>. */
export function reviewerFilePath(bidId: string, revId: string, index: number, name: string): string {
  const safe = name.trim().replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'file'
  return `${bidId}/${revId}/reviewer/${index}-${safe}`
}

export function parseReviewerFiles(json: unknown): ReviewerFile[] {
  if (!Array.isArray(json)) return []
  const out: ReviewerFile[] = []
  for (const raw of json) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const path = typeof r.path === 'string' ? r.path : ''
    if (!path) continue
    out.push({
      path,
      name: typeof r.name === 'string' ? r.name : path.split('/').pop() ?? 'file',
      kind: r.kind === 'email' ? 'email' : 'redline',
      droppedAt: typeof r.dropped_at === 'string' ? r.dropped_at : '',
      droppedBy: typeof r.dropped_by === 'string' ? r.dropped_by : null,
      droppedByName: typeof r.dropped_by_name === 'string' ? r.dropped_by_name : null,
      personId: typeof r.person_id === 'string' ? r.person_id : null,
      personName: typeof r.person_name === 'string' ? r.person_name : null,
    })
  }
  return out
}

export function serializeReviewerFiles(files: ReadonlyArray<ReviewerFile>): Array<Record<string, unknown>> {
  return files.map((f) => ({ path: f.path, name: f.name, kind: f.kind, dropped_at: f.droppedAt, dropped_by: f.droppedBy, dropped_by_name: f.droppedByName, person_id: f.personId, person_name: f.personName }))
}

function short(iso: string, tz: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: tz })
}

/** "Dana Whitfield's redlined PDF · dropped Sep 17 by Wendi" — the file card's line. */
export function describeReviewerFile(f: ReviewerFile, tz: string): string {
  const whose = f.personName ? `${f.personName}'s ` : 'a reviewer\'s '
  const what = f.kind === 'email' ? 'forwarded email' : 'redlined PDF'
  const when = short(f.droppedAt, tz)
  const by = f.droppedByName ? ` by ${f.droppedByName}` : ''
  return `${whose}${what}${when ? ` · dropped ${when}${by}` : by ? ` · dropped${by}` : ''}`
}

/** "2 rows entered by hand on this revision" — the card's header note; "" when none. */
export function describeEnteredCount(entered: number): string {
  if (entered <= 0) return ''
  return `${entered} row${entered === 1 ? '' : 's'} entered by hand on this revision`
}
