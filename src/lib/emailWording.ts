/**
 * Client-side email wording overrides (v2.2658, PR 2 of the email plan):
 * senders that compose copy in the browser check `email_templates` for a
 * dev-saved override before falling back to their built-in wording. Same
 * `{{var}}` semantics as the server senders (invite-user et al.): only the
 * provided keys substitute; an unknown token stays visible so a typo shows
 * itself instead of vanishing. Fail-soft everywhere — if the table can't be
 * read, the built-in copy sends.
 */
import { supabase } from './supabase'

export type EmailWording = { subject: string; body: string }

/** Replace {{key}} for provided keys only; unknown tokens remain literal. */
export function renderEmailWording(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] ?? '' : whole,
  )
}

/** Escape for the HTML body variant (senders convert \n → <br> after). */
export function escapeEmailHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const cache = new Map<string, EmailWording | null>()

/** Dev-saved override for a template type, cached per session; null = none/unreadable. */
export async function fetchEmailWordingOverride(templateType: string): Promise<EmailWording | null> {
  if (cache.has(templateType)) return cache.get(templateType) ?? null
  try {
    const { data } = await supabase
      .from('email_templates')
      .select('subject, body')
      .eq('template_type', templateType)
      .maybeSingle()
    const wording =
      data && data.subject.trim() && data.body.trim() ? { subject: data.subject, body: data.body } : null
    cache.set(templateType, wording)
    return wording
  } catch {
    cache.set(templateType, null)
    return null
  }
}

/** Test hook — the session cache would otherwise leak between vitest cases. */
export function clearEmailWordingCacheForTests(): void {
  cache.clear()
}

/**
 * The resolved wording for a send: override (rendered) when present, else the
 * built-in fallback. `text` is the plain body; `html` is the escaped body
 * with newlines as <br> — senders with richer built-in HTML keep it only on
 * the fallback path.
 */
export async function resolveEmailWording(
  templateType: string,
  vars: Record<string, string>,
  fallback: EmailWording,
): Promise<{ subject: string; text: string; html: string; overridden: boolean }> {
  const override = await fetchEmailWordingOverride(templateType)
  const source = override ?? fallback
  const subject = renderEmailWording(source.subject, vars)
  const text = renderEmailWording(source.body, vars)
  return {
    subject,
    text,
    html: escapeEmailHtml(text).replace(/\n/g, '<br>'),
    overridden: override != null,
  }
}
