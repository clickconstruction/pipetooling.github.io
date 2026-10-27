/**
 * The drafted field report on the form (punch list #186, item 1, PR 2, v2.5916): what the form sends `report-draft`
 * (the words said, the job's lines with their numbers, the text fields), what comes back (`ReportDraft`), and how the
 * draft lands on the form. Notes gets three short lines (what was done, the parts, the next step) under whatever it
 * held; the lines the tech named get their percents; both are marked drafted until touched, and the words said sit
 * under a fold with the lines the draft set and the words each came from. Nothing is written until Save report. Pure;
 * `voiceDraftIo.ts` asks the function and `ReportVoiceNote` runs the states.
 */
import type { StageProgressRow } from './stageProgressReport'
import { linePct, type LinePicks } from './lineProgressReport'

export interface DraftLineIn {
  id: string
  name: string
  pct: number | null
}

export interface DraftRequest {
  transcript: string
  lang: string
  jobName: string
  lines: DraftLineIn[]
  fields: string[]
}

export interface DraftLineOut {
  id: string
  pct: number
  from: string
}

export interface ReportDraft {
  notes: { done: string; parts: string; next: string }
  lines: DraftLineOut[]
  language: string
}

/** What `report-draft` answers the form: the draft and what it cost, or why there is none. */
export type DraftAnswer = { ok: true; draft: ReportDraft; cents: number | null } | { ok: false; reason: 'noKey' | 'failed'; words: string }

/** The form's one call for a draft; `voiceDraftIo.ts` makes the real one, a smoke hands a fake. */
export type RequestDraft = (request: DraftRequest) => Promise<DraftAnswer>

/** What a report form gives the Talk it through button so it can draft: the job, its lines, the call, and where the draft lands. */
export interface VoiceDraftHost {
  jobName: string
  lines: readonly StageProgressRow[] | null
  picks: LinePicks
  request: RequestDraft
  /** The draft on the form: the host writes Notes and the lines' picks and keeps the marks and the fold. */
  onDraft: (draft: ReportDraft, heard: { text: string; lang: string }) => void
}

/** What the form asks for: the words, the phone's language, the job, its lines as they stand, the text fields. */
export function draftRequest(p: {
  transcript: string
  lang: string
  jobName: string
  lines: readonly StageProgressRow[] | null
  picks: LinePicks
  fields: ReadonlyArray<{ label: string; input_type?: string | null }>
}): DraftRequest {
  return {
    transcript: p.transcript,
    lang: p.lang,
    jobName: p.jobName,
    lines: (p.lines ?? []).map((row) => ({ id: row.fixtureId, name: row.name, pct: row.drawPaid ? 100 : linePct(row, p.picks) })),
    fields: p.fields.filter((f) => (f.input_type ?? 'long_text') === 'long_text').map((f) => f.label),
  }
}

/** The function's answer as a draft; null when it is not one. */
export function parseDraft(json: unknown): ReportDraft | null {
  if (!json || typeof json !== 'object') return null
  const o = json as Record<string, unknown>
  const n = (o.notes && typeof o.notes === 'object' ? o.notes : null) as Record<string, unknown> | null
  if (!n) return null
  const t = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
  const lines: DraftLineOut[] = Array.isArray(o.lines)
    ? o.lines
        .map((raw) => (raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}))
        .filter((l) => typeof l.id === 'string' && typeof l.pct === 'number' && Number.isFinite(l.pct))
        .map((l) => ({ id: l.id as string, pct: Math.max(0, Math.min(100, Math.round(l.pct as number))), from: t(l.from) }))
    : []
  return { notes: { done: t(n.done), parts: t(n.parts), next: t(n.next) }, lines, language: t(o.language).toLowerCase() || 'en' }
}

/** Notes as the draft writes it: what was done, then the parts, then the next step, each its own line, none empty. */
export function draftNotesText(notes: ReportDraft['notes']): string {
  return [notes.done, notes.parts ? `Parts: ${notes.parts}` : '', notes.next ? `Next: ${notes.next}` : ''].filter(Boolean).join('\n')
}

/** The draft on the form: the Notes field's new text (under what it held) and the lines' picks, with what was drafted. */
export function applyDraft(
  draft: ReportDraft,
  form: { notesLabel: string; notesValue: string; lines: readonly StageProgressRow[] | null },
): { notesValue: string; picks: DraftLineOut[]; draftedFields: string[]; draftedLines: string[] } {
  const text = draftNotesText(draft.notes)
  const was = form.notesValue.trim()
  const notesValue = text ? (was ? `${was}\n\n${text}` : text) : form.notesValue
  const known = new Map((form.lines ?? []).filter((r) => !r.drawPaid).map((r) => [r.fixtureId, r]))
  const picks = draft.lines.filter((l) => known.has(l.id))
  return {
    notesValue,
    picks,
    draftedFields: text ? [form.notesLabel] : [],
    draftedLines: picks.map((l) => l.id),
  }
}

/** What the fold lists for each line the draft set: "Rough In → 100, from “rough-in is done”". */
export function draftedLineWords(draft: ReportDraft, lines: readonly StageProgressRow[] | null): string[] {
  const names = new Map((lines ?? []).map((r) => [r.fixtureId, r.name]))
  return draft.lines.filter((l) => names.has(l.id)).map((l) => `${names.get(l.id)} → ${l.pct}${l.from ? `, from “${l.from}”` : ''}`)
}

/** The words the form shows, held to the plain-words rule in the tests. */
export const DRAFT_WORDS = {
  mark: 'Drafted from your voice note. Tap to change.',
  /** The fold's title by the language heard. */
  foldTitle: (language: string) => (language.startsWith('es') ? 'Lo que dijiste' : 'What you said'),
  foldLines: 'The lines it set',
  drafting: 'Drafting the report from your words…',
  drafted: (seconds: number, cents: number | null) => `Drafted from ${Math.round(seconds)} seconds of talk.${cents != null ? ` ${centsWords(cents)}` : ''} Read it, then save.`,
  noKey: 'No model key yet, so the words are in Notes as you said them.',
  failed: 'The draft could not be made, so the words are in Notes as you said them.',
} as const

/** "Less than a cent." or "About 2 cents." */
export function centsWords(cents: number): string {
  if (cents < 1) return 'Less than a cent.'
  const n = Math.round(cents)
  return `About ${n} cent${n === 1 ? '' : 's'}.`
}
