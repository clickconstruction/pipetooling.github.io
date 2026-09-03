import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import {
  EMAIL_CATALOG,
  EMAIL_CATALOG_GROUP_LABELS,
  type EmailCatalogEntry,
  type EmailCatalogGroup,
} from '../../lib/emailCatalog'
/** Minimal template shape — the tab's engine rows satisfy it. */
type EmailTemplateRow = { template_type: string; subject: string }

/**
 * Settings → Email templates: the outbound-email catalog (v2.2656, PR 1 of
 * the email-wording plan) — every email the app can send, grouped, with
 * audience/attachment chips, its live subject where a template exists, its
 * wording status (editable below / estimate settings / hardcoded until PR 2-3
 * adopt it), and per-type last-sent stats from email_send_log (rows stamp
 * email_type as senders adopt). Read-only index; editing happens in the
 * template cards below (rows scroll to them).
 */
export default function SettingsEmailCatalogSection({ templates }: { templates: EmailTemplateRow[] }) {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const [stats, setStats] = useState<Map<string, { last: string; count30: number }>>(() => new Map())
  // v2.2732: fixed-design emails preview with the viewer as the signer (the real send is signed by the sender).
  const [viewer, setViewer] = useState<{ name: string; email: string; phone: string } | null>(null)
  useEffect(() => {
    if (!user) return
    let cancelled = false
    void supabase
      .from('users')
      .select('name, email, phone')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return
        const row = data as { name: string | null; email: string | null; phone: string | null }
        setViewer({ name: (row.name ?? '').trim(), email: (row.email ?? '').trim(), phone: (row.phone ?? '').trim() })
      })
    return () => {
      cancelled = true
    }
  }, [user])
  const openPreview = (e: EmailCatalogEntry) => {
    if (!e.preview) return
    const { html } = e.preview({ origin: window.location.origin, viewer })
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    // Same pattern as the template "Open as email" (v2.2662): no 'noopener' feature string.
    const win = window.open(url, '_blank')
    if (win) win.opener = null
    else showToast('Pop-up blocked — allow pop-ups for this site to open the preview.', 'error')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
        const { data } = await supabase
          .from('email_send_log')
          .select('email_type, sent_at')
          .not('email_type', 'is', null)
          .gte('sent_at', since)
          .order('sent_at', { ascending: false })
          .limit(5000)
        if (cancelled) return
        const m = new Map<string, { last: string; count30: number }>()
        for (const r of data ?? []) {
          const t = r.email_type as string
          const cur = m.get(t)
          if (cur) cur.count30 += 1
          else m.set(t, { last: r.sent_at ?? '', count30: 1 })
        }
        setStats(m)
      } catch {
        /* stats are garnish — the catalog renders without them */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const templateByType = useMemo(() => new Map(templates.map((t) => [t.template_type, t])), [templates])

  const groups = Object.keys(EMAIL_CATALOG_GROUP_LABELS) as EmailCatalogGroup[]

  function subjectFor(e: EmailCatalogEntry): string {
    if (e.editable.kind === 'templates' && e.editable.templateTypes.length === 1) {
      const row = templateByType.get(e.editable.templateTypes[0] ?? '')
      if (row?.subject) return row.subject
    }
    return e.subjectExample
  }

  function statusChip(e: EmailCatalogEntry): { label: string; style: React.CSSProperties } {
    const base: React.CSSProperties = { fontSize: '0.68rem', fontWeight: 700, padding: '0.05rem 0.45rem', borderRadius: 9999, whiteSpace: 'nowrap' }
    if (e.editable.kind === 'templates') {
      const customized = e.editable.templateTypes.some((t) => templateByType.has(t))
      return customized
        ? { label: 'customized', style: { ...base, background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' } }
        : { label: 'editable below', style: { ...base, background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)' } }
    }
    if (e.editable.kind === 'estimate_settings') {
      return { label: 'estimate settings', style: { ...base, background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)' } }
    }
    return { label: 'hardcoded', style: { ...base, background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border)' } }
  }

  function lastSentLabel(e: EmailCatalogEntry): string {
    const s = stats.get(e.id)
    if (!s) return '—'
    const d = new Date(s.last)
    const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
    const when = days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days}d ago`
    return `${when} · ${s.count30} in 30d`
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: '1rem', overflow: 'hidden' }}>
      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Outbound email catalog</h3>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Every email the app can send. Emails marked <strong>editable below</strong> have template cards further down this
          page; <strong>hardcoded</strong> wording becomes editable as senders adopt the template engine. Wording only —
          attached documents (invoices, releases, notices) are never edited here. Send counts appear as senders start
          stamping their type on the send log.
        </p>
      </div>
      {groups.map((g) => (
        <div key={g}>
          <div style={{ padding: '0.5rem 1rem 0.15rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {EMAIL_CATALOG_GROUP_LABELS[g]}
          </div>
          {EMAIL_CATALOG.filter((e) => e.group === g).map((e) => {
            const chip = statusChip(e)
            return (
              <div
                key={e.id}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', padding: '0.45rem 1rem', borderTop: '1px solid var(--bg-subtle)' }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {e.name}
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '0.05rem 0.45rem',
                        borderRadius: 9999,
                        whiteSpace: 'nowrap',
                        background: e.audience === 'customer' ? 'var(--bg-blue-tint)' : 'var(--bg-amber-100)',
                        color: e.audience === 'customer' ? 'var(--text-blue-700)' : 'var(--text-amber-800)',
                      }}
                    >
                      {e.audience}
                    </span>
                    {e.attachment ? (
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>📎 {e.attachment}</span>
                    ) : null}
                    <span style={chip.style}>{chip.label}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Subject: {subjectFor(e)}
                    {e.variants?.length ? <span style={{ color: 'var(--text-faint)' }}> · +{e.variants.join(', +')}</span> : null}
                  </div>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}>
                  {e.preview ? (
                    <button
                      type="button"
                      onClick={() => openPreview(e)}
                      title="Open this email, rendered with sample data, in a new tab — signed by you"
                      style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, background: 'var(--bg-sky-tint)', color: 'var(--text-sky-700)', border: '1px solid var(--border-sky)', borderRadius: 5, cursor: 'pointer' }}
                    >
                      Preview
                    </button>
                  ) : null}
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}>{lastSentLabel(e)}</span>
                </span>
              </div>
            )
          })}
        </div>
      ))}
      <div style={{ padding: '0.5rem 1rem 0.75rem', fontSize: '0.72rem', color: 'var(--text-faint)', borderTop: '1px solid var(--bg-subtle)' }}>
        Not composed by the app (and so not editable here): Stripe's own invoice emails, and Supabase auth emails (sign-up
        confirmation, password reset).
      </div>
    </div>
  )
}
