/**
 * Server-side email wording overrides (v2.2659, PR 3 of the email plan).
 * Digest/dispatch functions ask email_templates for a dev-saved row before
 * composing: `subject` templates the subject line; `body` is an INTRO
 * PARAGRAPH prepended above the built content (digest bodies are data tables
 * — wording-only means the subject and the words around the data, never the
 * data). Same {{var}} semantics as the client kernel: provided keys only,
 * unknown tokens stay visible. Fail-soft: any error → built-in wording.
 */

export function renderServerEmailWording(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] ?? '' : whole,
  )
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export type ServerEmailWording = {
  subject: string
  /** Rendered intro paragraph (plain text), when a template body exists. */
  introText: string | null
  /** The same intro escaped + <br>-joined, ready to prepend to an HTML body. */
  introHtml: string | null
  overridden: boolean
}

export async function resolveServerEmailWording(
  templateType: string,
  vars: Record<string, string>,
  fallbackSubject: string,
): Promise<ServerEmailWording> {
  const builtin: ServerEmailWording = { subject: fallbackSubject, introText: null, introHtml: null, overridden: false }
  // Every template gets {{default_subject}} for free — the built-in subject
  // carries payload-derived labels (dates, job numbers) a static override
  // would otherwise lose.
  const allVars = { ...vars, default_subject: fallbackSubject }
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) return builtin
    const res = await fetch(
      `${supabaseUrl}/rest/v1/email_templates?template_type=eq.${encodeURIComponent(templateType)}&select=subject,body&limit=1`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    )
    if (!res.ok) return builtin
    const rows = (await res.json()) as Array<{ subject?: string; body?: string }>
    const row = rows[0]
    if (!row) return builtin
    const subject = (row.subject ?? '').trim() ? renderServerEmailWording(row.subject as string, allVars) : fallbackSubject
    const introText = (row.body ?? '').trim() ? renderServerEmailWording(row.body as string, allVars) : null
    return {
      subject,
      introText,
      introHtml: introText ? `<p>${escapeHtml(introText).replace(/\n/g, '<br>')}</p>` : null,
      overridden: true,
    }
  } catch {
    return builtin
  }
}
