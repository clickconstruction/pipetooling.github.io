/**
 * Pure kernel for the Pipeline Activity cell's mini-feed (Option A of the
 * "Pipeline Activity column — presentation options" mockup): turns the per-job
 * thread stats (latest note + latest report metadata, already loaded by the
 * board — no new queries) into ordered one-line feed items, newest first.
 */

export interface StagesActivityFeedItem {
  kind: 'note' | 'report'
  atIso: string
  atMs: number
  /** Trimmed author display name; '' when unknown. */
  author: string
  /** Trimmed one-line preview text; '' when the note has no loadable body. */
  body: string
}

export interface StagesActivityFeedInput {
  lastNoteAt: string | null
  lastNoteAuthorName: string | null
  lastNoteBody: string | null
  /** Fallbacks derived from the loaded thread activity when the stat row lacks them. */
  fallbackNoteAuthorName?: string | null
  fallbackNoteBody?: string | null
  lastReportAt: string | null
  lastReportAuthorName: string | null
  lastReportPreview: string | null
  lastReportTemplateName: string | null
}

function wireMs(iso: string | null | undefined): number | null {
  if (iso == null || !String(iso).trim()) return null
  const t = Date.parse(String(iso))
  return Number.isNaN(t) ? null : t
}

export function computeStagesActivityFeedItems(input: StagesActivityFeedInput): StagesActivityFeedItem[] {
  const items: StagesActivityFeedItem[] = []
  const noteMs = wireMs(input.lastNoteAt)
  if (noteMs != null) {
    items.push({
      kind: 'note',
      atIso: String(input.lastNoteAt),
      atMs: noteMs,
      author: input.lastNoteAuthorName?.trim() || input.fallbackNoteAuthorName?.trim() || '',
      body: input.lastNoteBody?.trim() || input.fallbackNoteBody?.trim() || '',
    })
  }
  const reportMs = wireMs(input.lastReportAt)
  if (reportMs != null) {
    // Reports show their preview text like notes do (v2.1044) — the
    // "Report: <template>" label only fills in when there is no preview.
    const tmpl = input.lastReportTemplateName?.trim() || 'Report'
    items.push({
      kind: 'report',
      atIso: String(input.lastReportAt),
      atMs: reportMs,
      author: input.lastReportAuthorName?.trim() || '',
      body: input.lastReportPreview?.trim() || `Report: ${tmpl}`,
    })
  }
  items.sort((a, b) => b.atMs - a.atMs)
  return items
}
