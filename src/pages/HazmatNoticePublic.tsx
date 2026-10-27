import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { buildHazmatFeeNoticeHtml } from '../lib/jobsDocuments/hazmatFeeNotice'
import type { HazmatIncidentDraft, HazmatTestimonial } from '../lib/hazmatFee'
import { portalFailure, portalFailureKind, type PortalFailureCause } from '../lib/portal/portalFailure'
import { PortalFailureNote } from '../components/portal/PortalFailureNote'

/**
 * Public (tokenized) Biohazard Remediation Fee Notice — linked from the Stripe
 * invoice footer, since Stripe emails cannot carry attachments. Anon-readable
 * only via `get_hazmat_notice_by_token` (exact uuid token; testimonial user
 * ids stripped server-side). Renders the same printable document the office
 * sees, inside an iframe so its print styling stays intact.
 *
 * A failure reads by its class (v2.5965): a lost signal says *No connection* with Try again, a token
 * that matches no notice is a gone link, and any other refusal reads *We couldn't open this page.*
 */
export default function HazmatNoticePublic() {
  const [searchParams] = useSearchParams()
  const token = (searchParams.get('token') ?? '').trim()
  const [loading, setLoading] = useState(true)
  /** The page's own words for a link that cannot be a notice's. */
  const [error, setError] = useState<string | null>(null)
  /** The notice did not open, by class (v2.5965). */
  const [failure, setFailure] = useState<PortalFailureCause | null>(null)
  /** Bumped by Try again: the notice is read again. */
  const [reloadKey, setReloadKey] = useState(0)
  const [noticeHtml, setNoticeHtml] = useState<string | null>(null)
  const frameRef = useRef<HTMLIFrameElement | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
      setError('This notice link is invalid.')
      setLoading(false)
      return
    }
    void (async () => {
      try {
        const { data, error: rpcErr } = await supabase.rpc('get_hazmat_notice_by_token', { p_token: token })
        if (cancelled) return
        // A refused or dead read by its class (a dead signal comes back as the result's error); no notice for the token is a gone link.
        if (rpcErr) {
          setFailure(portalFailureKind(rpcErr))
          return
        }
        if (data == null) {
          setFailure('gone')
          return
        }
        const d = data as {
          incident_at?: string
          description?: string
          exposed_people?: string
          stage_label?: string | null
          photo_links?: unknown
          testimonials?: unknown
          tos_clause_snapshot?: string
          fee_amount?: number | string
          job_number?: string
          job_name?: string
          job_address?: string
          customer_name?: string
        }
        const draft: HazmatIncidentDraft = {
          incidentAt: d.incident_at ?? '',
          description: d.description ?? '',
          exposedPeople: d.exposed_people ?? '',
          stageLabel: d.stage_label ?? null,
          photoLinks: Array.isArray(d.photo_links)
            ? d.photo_links.filter((p): p is string => typeof p === 'string')
            : [],
          testimonials: Array.isArray(d.testimonials)
            ? d.testimonials.flatMap((t): HazmatTestimonial[] => {
                if (t == null || typeof t !== 'object') return []
                const o = t as { name?: unknown; statement?: unknown; given_at?: unknown }
                if (typeof o.name !== 'string' || typeof o.statement !== 'string') return []
                return [{ name: o.name, userId: null, statement: o.statement, givenAt: typeof o.given_at === 'string' ? o.given_at : '' }]
              })
            : [],
          tosClauseSnapshot: d.tos_clause_snapshot ?? '',
          feeAmount: Number(d.fee_amount) || 0,
        }
        setNoticeHtml(
          buildHazmatFeeNoticeHtml(
            {
              jobNumber: d.job_number ?? '—',
              jobName: d.job_name ?? 'Job',
              jobAddress: d.job_address ?? '—',
              customerName: d.customer_name ?? '—',
            },
            draft,
          ),
        )
      } catch (e) {
        if (!cancelled) setFailure(portalFailureKind(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, reloadKey])

  const failed = failure ? portalFailure(failure, 'open') : null

  const frame = useMemo(
    () =>
      noticeHtml ? (
        <iframe
          ref={frameRef}
          title="Biohazard Remediation Fee Notice"
          srcDoc={noticeHtml}
          style={{ border: 'none', width: '100%', flex: 1, background: 'var(--surface)' }}
        />
      ) : null,
    [noticeHtml],
  )

  return (
    <div
      data-theme="light"
      style={{
        fontFamily: 'system-ui, sans-serif',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-subtle)',
      }}
    >
      {loading ? <p style={{ padding: '2rem', textAlign: 'center' }}>Loading…</p> : null}
      {error ? <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-red-700)' }}>{error}</p> : null}
      {failed ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ margin: 0, color: 'var(--text-red-700)' }}>{failed.message}</p>
          <PortalFailureNote
            failure={failed}
            doorsOnly
            onTryAgain={() => {
              setFailure(null)
              setLoading(true)
              setReloadKey((n) => n + 1)
            }}
            style={{ justifyContent: 'center', marginTop: '0.75rem' }}
          />
        </div>
      ) : null}
      {noticeHtml ? (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              padding: '0.5rem 1rem',
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface)',
            }}
          >
            <button
              type="button"
              onClick={() => frameRef.current?.contentWindow?.print()}
              style={{
                padding: '0.4rem 0.9rem',
                fontSize: '0.875rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 6,
                background: 'var(--surface)',
                cursor: 'pointer',
              }}
            >
              Print
            </button>
          </div>
          {frame}
        </>
      ) : null}
    </div>
  )
}
