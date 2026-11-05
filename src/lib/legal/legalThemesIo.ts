import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { LegalTheme, LegalThemeMark, MarkTarget, ProvesBy, ThemeDraft } from './legalThemes'

/**
 * The themes' reads and writes (v2.6545): the catalog and its marks, under the tables' dev-only RLS. A table not there
 * yet (the migration not pushed) reads as empty, so the card and the views still draw; a write says why it could not.
 * Themes change their words and retire; marks are never deleted, only stamped (the trigger holds the rest).
 */

const db = supabase as unknown as SupabaseClient

const missing = (e: { code?: string; message?: string } | null | undefined): boolean => !!e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist/i.test(e.message ?? ''))

export type ThemesLoad = { themes: LegalTheme[]; marks: LegalThemeMark[]; heldWhy: string | null }

/** Every theme, and every mark (live and removed) — the catalog card counts them; a view narrows to its person or matter. */
export async function loadThemes(scope: { personId?: string; matterId?: string } = {}): Promise<ThemesLoad> {
  const t = await db.from('legal_themes').select('*').order('name')
  if (t.error) return { themes: [], marks: [], heldWhy: missing(t.error) ? null : t.error.message }
  let q = db.from('legal_theme_marks').select('*').order('marked_at')
  if (scope.personId) q = q.eq('person_id', scope.personId)
  if (scope.matterId) q = q.eq('matter_id', scope.matterId)
  const m = await q
  if (m.error) return { themes: (t.data ?? []) as LegalTheme[], marks: [], heldWhy: missing(m.error) ? null : m.error.message }
  return { themes: (t.data ?? []) as LegalTheme[], marks: (m.data ?? []) as LegalThemeMark[], heldWhy: null }
}

export type ThemeWriteOutcome = { ok: true; id: string } | { ok: false; why: string }

export async function addTheme(d: ThemeDraft, authUserId: string | null): Promise<ThemeWriteOutcome> {
  const r = await db.from('legal_themes').insert({ name: d.name.trim(), what_counts: d.whatCounts.trim(), counsel_words: d.counselWords.trim(), created_by: authUserId }).select('id').single()
  if (r.error) return { ok: false, why: missing(r.error) ? 'Themes are not on this database yet: the migration has not been pushed.' : r.error.message }
  return { ok: true, id: (r.data as { id: string }).id }
}

export async function updateTheme(id: string, d: ThemeDraft): Promise<ThemeWriteOutcome> {
  const r = await db.from('legal_themes').update({ name: d.name.trim(), what_counts: d.whatCounts.trim(), counsel_words: d.counselWords.trim(), updated_at: new Date().toISOString() }).eq('id', id)
  return r.error ? { ok: false, why: r.error.message } : { ok: true, id }
}

/** Retire a theme (its marks keep their meaning), or bring one back. */
export async function retireTheme(id: string, retire: boolean, authUserId: string | null): Promise<ThemeWriteOutcome> {
  const r = await db.from('legal_themes').update(retire ? { retired_at: new Date().toISOString(), retired_by: authUserId, updated_at: new Date().toISOString() } : { retired_at: null, retired_by: null, updated_at: new Date().toISOString() }).eq('id', id)
  return r.error ? { ok: false, why: r.error.message } : { ok: true, id }
}

/** A dev keeps a theme the agent proposed: it stands as the office's own. */
export async function keepTheme(id: string): Promise<ThemeWriteOutcome> {
  const r = await db.from('legal_themes').update({ kept_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id)
  return r.error ? { ok: false, why: r.error.message } : { ok: true, id }
}

// ─── marks (v2.6546) ───────────────────────────────────────────────────────

export type AddMarksArgs = {
  themeIds: string[]
  targets: MarkTarget[]
  personId: string | null
  matterId: string | null
  why: string
  provesBy: ProvesBy | null
  authUserId: string | null
  /** True when the agent or the seat proposes; a person's own mark stands as kept. */
  proposed?: boolean
}

export type AddMarksOutcome = { ok: true; made: number; already: number; failWhy: string | null } | { ok: false; why: string }

/** One row a theme a thing; a thing that already carries the theme counts as already, and the rest are still written. */
export async function addMarks(a: AddMarksArgs): Promise<AddMarksOutcome> {
  let made = 0
  let already = 0
  const failures: string[] = []
  const now = new Date().toISOString()
  for (const themeId of a.themeIds) {
    for (const t of a.targets) {
      const r = await db.from('legal_theme_marks').insert({
        theme_id: themeId,
        target_kind: t.kind,
        target_id: t.id,
        person_id: a.personId,
        matter_id: a.matterId,
        why: a.why.trim(),
        proves_by: a.provesBy,
        marked_by: a.authUserId,
        proposed: a.proposed ?? false,
        kept_at: a.proposed ? null : now,
        kept_by: a.proposed ? null : a.authUserId,
      })
      if (!r.error) {
        made += 1
        continue
      }
      if (r.error.code === '23505') {
        already += 1
        continue
      }
      if (missing(r.error)) return { ok: false, why: 'Themes are not on this database yet: the migration has not been pushed.' }
      failures.push(r.error.message)
    }
  }
  if (made === 0 && already === 0 && failures.length > 0) return { ok: false, why: failures[0]! }
  return { ok: true, made, already, failWhy: failures.length > 0 ? failures[0]! : null }
}

export type MarkWriteOutcome = { ok: true } | { ok: false; why: string }

/** A mark comes off with a reason; the row stays, stamped. */
export async function removeMark(id: string, why: string, authUserId: string | null): Promise<MarkWriteOutcome> {
  const r = await db.from('legal_theme_marks').update({ removed_at: new Date().toISOString(), removed_by: authUserId, removed_why: why.trim() }).eq('id', id)
  return r.error ? { ok: false, why: r.error.message } : { ok: true }
}

/** A dev keeps a mark the agent proposed. */
export async function keepMark(id: string, authUserId: string | null): Promise<MarkWriteOutcome> {
  const r = await db.from('legal_theme_marks').update({ kept_at: new Date().toISOString(), kept_by: authUserId }).eq('id', id)
  return r.error ? { ok: false, why: r.error.message } : { ok: true }
}
