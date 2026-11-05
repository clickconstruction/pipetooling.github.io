/**
 * Themes on the record (v2.6545, punch list #269 T1): a theme is a plain-words name for a pattern the office wants to
 * find again across a large record — *Dishonesty*, *Disrespectful conduct*, *Interference with the business* — a
 * company-wide word with one line on what counts and optional words for counsel, retired and never deleted. A mark is a
 * row on something that already exists (an HR entry, a piece of evidence, a matter's document or event) carrying why
 * it fits and how it proves the theme. Pure: no React, no supabase, no app import — it lives in
 * `supabase/functions/_shared/` so the Settings card, the pickers, the By theme view and the dev seat read one set of
 * words and rules; `src/lib/legal/legalThemes.ts` is the app's door to it.
 */

export type ProvesBy = 'document' | 'own_words' | 'firsthand' | 'relayed'

/** How a mark proves its theme, strongest first: the matrix's A, B, C grade asked at the moment of marking. */
export const PROVES_BY: ReadonlyArray<{ key: ProvesBy; label: string; short: string }> = [
  { key: 'document', label: 'a document', short: 'by a document' },
  { key: 'own_words', label: 'their own words', short: 'by their own words' },
  { key: 'firsthand', label: 'a firsthand account', short: 'firsthand' },
  { key: 'relayed', label: 'a relayed account', short: 'relayed' },
]

export function provesByWords(key: ProvesBy | null | undefined): string {
  return PROVES_BY.find((p) => p.key === key)?.label ?? ''
}

export type MarkTargetKind = 'hr_entry' | 'hr_evidence' | 'matter_document' | 'matter_entry'

export type LegalTheme = {
  id: string
  name: string
  what_counts: string
  counsel_words: string
  created_by: string | null
  created_at: string
  updated_at: string
  retired_at: string | null
  retired_by: string | null
  proposed_by_agent: boolean
  kept_at: string | null
}

export type LegalThemeMark = {
  id: string
  theme_id: string
  target_kind: MarkTargetKind
  target_id: string
  person_id: string | null
  matter_id: string | null
  why: string
  proves_by: ProvesBy | null
  marked_by: string | null
  marked_at: string
  author_label: string | null
  proposed: boolean
  kept_at: string | null
  kept_by: string | null
  removed_at: string | null
  removed_by: string | null
  removed_why: string
}

export const THEME_NAME_MAX = 80
export const THEME_WHAT_COUNTS_MAX = 400
export const THEME_COUNSEL_WORDS_MAX = 200
export const MARK_WHY_MAX = 200

export type ThemeDraft = { name: string; whatCounts: string; counselWords: string }

/** Why a theme cannot be saved as typed; null when it can. A name, under the caps, not a standing theme's name. */
export function themeDraftProblem(d: ThemeDraft, standing: ReadonlyArray<Pick<LegalTheme, 'id' | 'name' | 'retired_at'>>, editingId: string | null = null): string | null {
  const name = d.name.trim()
  if (!name) return 'Give the theme a name.'
  if (name.length > THEME_NAME_MAX) return `The name is over ${THEME_NAME_MAX} characters.`
  if (d.whatCounts.length > THEME_WHAT_COUNTS_MAX) return `What counts is over ${THEME_WHAT_COUNTS_MAX} characters.`
  if (d.counselWords.length > THEME_COUNSEL_WORDS_MAX) return `Counsel’s words are over ${THEME_COUNSEL_WORDS_MAX} characters.`
  const taken = standing.find((t) => !t.retired_at && t.id !== editingId && t.name.trim().toLowerCase() === name.toLowerCase())
  if (taken) return `A theme named ${taken.name.trim()} already stands.`
  return null
}

/** A theme that stands: not retired. */
export function themeStands(t: Pick<LegalTheme, 'retired_at'>): boolean {
  return !t.retired_at
}

/** Standing themes by name, the agent's proposals among them, then the retired ones by name. */
export function sortThemes<T extends Pick<LegalTheme, 'name' | 'retired_at'>>(themes: ReadonlyArray<T>): T[] {
  const byName = (a: T, b: T) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
  return [...themes.filter((t) => !t.retired_at).sort(byName), ...themes.filter((t) => !!t.retired_at).sort(byName)]
}

/** A mark that stands: not removed. */
export function markStands(m: Pick<LegalThemeMark, 'removed_at'>): boolean {
  return !m.removed_at
}

/** Live marks by theme id. */
export function marksByTheme<M extends Pick<LegalThemeMark, 'theme_id' | 'removed_at'>>(marks: ReadonlyArray<M>): Map<string, M[]> {
  const out = new Map<string, M[]>()
  for (const m of marks) {
    if (m.removed_at) continue
    const list = out.get(m.theme_id) ?? []
    list.push(m)
    out.set(m.theme_id, list)
  }
  return out
}

/** `17 marks` · `1 mark` · `no marks yet`. */
export function markCountWords(n: number): string {
  if (n <= 0) return 'no marks yet'
  return n === 1 ? '1 mark' : `${n} marks`
}

/** `9 by a document · 3 by their own words · 2 firsthand · 0 relayed`, the proof counts a person says to counsel. */
export function proofCountsWords(marks: ReadonlyArray<Pick<LegalThemeMark, 'proves_by' | 'removed_at'>>): string {
  const live = marks.filter((m) => !m.removed_at)
  return PROVES_BY.map((p) => `${live.filter((m) => m.proves_by === p.key).length} ${p.short}`).join(' · ')
}

/** `2 proposed by the agent, not yet kept`; '' when none. */
export function proposedCountWords(marks: ReadonlyArray<Pick<LegalThemeMark, 'proposed' | 'kept_at' | 'removed_at'>>): string {
  const n = marks.filter((m) => !m.removed_at && m.proposed && !m.kept_at).length
  return n === 0 ? '' : `${n} proposed by the agent, not yet kept`
}

/** A standing mark the agent proposed and no dev has kept: drawn dashed, with Keep and Drop. */
export function markIsProposed(m: Pick<LegalThemeMark, 'proposed' | 'kept_at' | 'removed_at'>): boolean {
  return !m.removed_at && m.proposed && !m.kept_at
}
