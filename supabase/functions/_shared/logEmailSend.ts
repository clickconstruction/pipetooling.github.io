/**
 * Best-effort append to public.email_send_log (source 'app') — the app-side
 * feed for Settings → Notifications → "Most recent emails sent".
 *
 * Never throws: a logging failure must never fail or delay a send that already
 * happened. Uses raw PostgREST with the service role (the table has no client
 * write policies). `on_conflict=resend_email_id` + ignore-duplicates means a
 * webhook row that raced us first wins (it may already carry `delivered`).
 */
export async function logEmailSendBestEffort(args: {
  resendEmailId?: string | null
  to: string[]
  from: string
  subject: string
  /** EMAIL_CATALOG id (src/lib/emailCatalog.ts) — feeds per-type stats in Settings (v2.2656). */
  emailType?: string | null
}): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) return
    await fetch(`${supabaseUrl}/rest/v1/email_send_log?on_conflict=resend_email_id`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates',
      },
      body: JSON.stringify({
        resend_email_id: args.resendEmailId ?? null,
        sent_at: new Date().toISOString(),
        from_email: args.from,
        to_emails: args.to,
        subject: args.subject,
        last_event: 'sent',
        source: 'app',
        ...(args.emailType ? { email_type: args.emailType } : {}),
      }),
    })
  } catch {
    // best-effort only
  }
}
