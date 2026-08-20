import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { openHtmlPrintWindow } from '../../lib/jobsDocuments/printWindow'

/**
 * Partnerships → Agreements tab (PARTNERSHIPS_PLAN.md PR 8): the partnership
 * lens over the existing People → Contracts machinery. Agreement versions for
 * the partner person, each with an editable sign-by deadline and a countdown;
 * lapsed + unsigned drafts the §8a written 30-day notice for MANUAL review
 * and send (delivery is recorded by hand; nothing auto-serves —
 * modules.auto_notice stays off pending attorney sign-off).
 */

type DocRow = {
  id: string
  document_name: string
  status: string
  sent_at: string | null
  signed_at: string | null
  sign_by: string | null
  partnership_id: string | null
  dashboard_prompt_after_clock_in: boolean
  lineage_version: number
}

type NoticeRow = {
  id: string
  generated_at: string
  sign_by_missed: string | null
  delivered_at: string | null
  delivered_via: string[]
  notice_html: string
}

export function PartnershipAgreementsTab({
  partnershipId,
  personId,
  personName,
  autoNoticeOn,
}: {
  partnershipId: string
  personId: string
  personName: string
  autoNoticeOn: boolean
}) {
  const [docs, setDocs] = useState<DocRow[] | null>(null)
  const [notices, setNotices] = useState<NoticeRow[]>([])
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    const dRes = await supabase
      .from('person_contract_documents')
      .select('id, document_name, status, sent_at, signed_at, sign_by, partnership_id, dashboard_prompt_after_clock_in, lineage_version')
      .eq('person_id', personId)
      .eq('doc_type', 'agreement')
      .order('created_at', { ascending: false })
    if (dRes.error) {
      setFailed(true)
      setDocs([])
      return
    }
    setFailed(false)
    setDocs((dRes.data ?? []) as DocRow[])
    const nRes = await supabase
      .from('partner_agreement_notices')
      .select('id, generated_at, sign_by_missed, delivered_at, delivered_via, notice_html')
      .eq('partnership_id', partnershipId)
      .order('generated_at', { ascending: false })
    setNotices(((nRes.data ?? []) as NoticeRow[]) || [])
  }, [personId, partnershipId])

  useEffect(() => {
    setDocs(null)
    void load()
  }, [load])

  async function setSignBy(docId: string, signBy: string | null) {
    setErr(null)
    const { error } = await supabase
      .from('person_contract_documents')
      .update({ sign_by: signBy, partnership_id: partnershipId })
      .eq('id', docId)
    if (error) setErr(error.message)
    await load()
  }

  async function draftNotice() {
    setBusy(true)
    setErr(null)
    const { data, error } = await supabase.rpc('generate_agreement_notice', { p_partnership_id: partnershipId })
    if (error) {
      setErr(error.message)
    } else {
      const d = (data ?? {}) as Record<string, unknown>
      if (typeof d.notice_html === 'string') openHtmlPrintWindow(d.notice_html)
      await load()
    }
    setBusy(false)
  }

  if (docs == null) {
    return <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>Loading…</p>
  }
  if (failed) {
    return (
      <p style={{ fontSize: '0.875rem', color: 'var(--text-700)', margin: '0.5rem 0 0' }}>
        Couldn’t load agreements — if the PR 8 migration hasn’t been pushed, run <code>supabase db push</code> for
        <code> 20260820210000_partner_agreements.sql</code>.
      </p>
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  const anySigned = docs.some((d) => d.status === 'signed')
  const lapsed = docs.some((d) => d.status !== 'signed' && d.sign_by != null && d.sign_by < today)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap', margin: '0.25rem 0 0.4rem' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 650 }}>Agreement versions</span>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: anySigned ? '#16a34a' : 'var(--text-amber-700)' }}>
          {anySigned ? 'signed agreement on file' : 'no signed agreement on file'}
        </span>
      </div>

      {docs.length === 0 ? (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
          No agreement documents for {personName} yet — create one under People → Contracts (doc type “agreement”), then
          manage its sign-by date here.
        </p>
      ) : (
        docs.map((d) => {
          const overdue = d.status !== 'signed' && d.sign_by != null && d.sign_by < today
          const daysLeft = d.sign_by != null ? Math.ceil((new Date(d.sign_by).getTime() - Date.now()) / 86400000) : null
          return (
            <div key={d.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.4rem 0.75rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
              <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                <b>{d.document_name}</b> <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>v{d.lineage_version}</span>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {d.status === 'signed'
                    ? `signed ${d.signed_at ?? ''}`
                    : d.status === 'sent'
                      ? `sent ${d.sent_at ? new Date(d.sent_at).toLocaleDateString() : ''}${d.dashboard_prompt_after_clock_in ? ' · prompting at clock-in' : ''}`
                      : 'not sent'}
                </div>
              </div>
              {d.status === 'signed' ? (
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#16a34a' }}>signed ✓</span>
              ) : (
                <>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    sign by
                    <input
                      type="date"
                      value={d.sign_by ?? ''}
                      onChange={(e) => void setSignBy(d.id, e.target.value || null)}
                      style={{ font: 'inherit', fontSize: '0.78rem', padding: '0.15rem 0.3rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit' }}
                    />
                  </label>
                  {d.sign_by != null ? (
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: overdue ? 'var(--text-red-600)' : 'var(--text-amber-700)' }}>
                      {overdue ? `lapsed ${d.sign_by}` : `${daysLeft} day(s) left`}
                    </span>
                  ) : null}
                </>
              )}
            </div>
          )
        })
      )}

      <div
        style={{
          border: '1px solid var(--border-strong)',
          background: lapsed ? 'var(--bg-subtle)' : 'var(--bg-muted)',
          borderRadius: 8,
          padding: '0.6rem 0.75rem',
          margin: '0.75rem 0 0',
          fontSize: '0.78rem',
          color: 'var(--text-700)',
        }}
      >
        <b style={{ display: 'block', fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: lapsed ? 'var(--text-red-600)' : 'var(--text-muted)' }}>
          {lapsed ? 'Sign-by lapsed → notice is prepared, not served' : '§8a notice path'}
        </b>
        Unsigned past its sign-by date, the app <i>drafts</i> the written 30-day termination notice (§8a) and logs it
        below for you to review, print, and send yourself — delivery is recorded by hand. Auto-serve is
        {autoNoticeOn ? ' ON in config but has no machinery behind it in this build;' : ' off;'} nothing is ever sent
        without your explicit act, pending Texas-attorney sign-off on delivery channels. Signing any current version
        moots the drafts.
        <div style={{ marginTop: '0.45rem' }}>
          <button
            type="button"
            disabled={busy || anySigned}
            title={anySigned ? 'A signed agreement is on file — no notice needed' : undefined}
            onClick={() => void draftNotice()}
            style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 650, padding: '0.3rem 0.7rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'transparent', color: anySigned ? 'var(--text-muted)' : 'var(--text-red-600)', cursor: 'pointer', opacity: busy || anySigned ? 0.55 : 1 }}
          >
            {busy ? 'Drafting…' : 'Draft §8a notice (opens print view)'}
          </button>
        </div>
      </div>

      {notices.length > 0 ? (
        <>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0.75rem 0 0.2rem' }}>
            Notice log
          </div>
          {notices.map((n) => (
            <div key={n.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.4rem 0.75rem', padding: '0.4rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.78rem' }}>
              <span style={{ flex: '1 1 220px', color: 'var(--text-700)' }}>
                Drafted {new Date(n.generated_at).toLocaleString()}
                {n.sign_by_missed ? ` · sign-by missed ${n.sign_by_missed}` : ''}
              </span>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: n.delivered_at ? 'var(--text-red-600)' : 'var(--text-muted)' }}>
                {n.delivered_at ? `delivered ${new Date(n.delivered_at).toLocaleDateString()} (${n.delivered_via.join(', ') || 'unrecorded'})` : 'draft — not delivered'}
              </span>
              <button
                type="button"
                onClick={() => openHtmlPrintWindow(n.notice_html)}
                style={{ font: 'inherit', fontSize: '0.72rem', fontWeight: 650, padding: '0.15rem 0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-link)', cursor: 'pointer' }}
              >
                view / print
              </button>
            </div>
          ))}
        </>
      ) : null}
      {err ? <p style={{ fontSize: '0.78rem', color: 'var(--text-red-600)', margin: '0.5rem 0 0' }}>{err}</p> : null}
    </div>
  )
}
