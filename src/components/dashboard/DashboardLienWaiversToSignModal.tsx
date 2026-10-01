import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { FileCheck2 } from 'lucide-react'
import type { EstimateAcceptSubmitPayload } from '../estimates/EstimateAcceptBody'
import { LienWaiverSignAgree, LienWaiverSignOnPage } from '../jobs/LienWaiverSignOnPage'
import { lienWaiverSignPayload, type LienWaiverSignOnPageHandle } from '../../lib/jobs/lienWaiverSignPayload'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { lienInboxJobLabel, type LienInboxRow } from '../../lib/jobs/lienReleaseInboxLanes'
import { isLienWaiverFormType, lienReleaseFormLabel, lienReleaseSnapshotToWaiverFields } from '../../lib/jobs/lienReleaseTracking'
import { resolveLienWaiverRecipient, signLienRelease } from '../../lib/jobs/lienReleaseSignIo'
import { sendLienReleaseEmailToCustomer } from '../../lib/sendLienReleaseEmail'
import { LIEN_WAIVER_FORM_CITES, buildLienWaiverFoot, buildLienWaiverParagraphs, lienWaiverDate, lienWaiverTitle, type LienWaiverFormType } from '../../lib/jobsDocuments/lienWaiverRelease'
import { supabase } from '../../lib/supabase'

/**
 * The leader's seat — Waivers to sign (v2.4276; punch-list mock-up board 2 of the GC-waiver train).
 * The list on the left is every lien release awaiting MY signature (`useLienSignatureLanes().toSign`,
 * the same rows the Needs You card counts); the page on the right is the one I have picked, read in
 * full, with the pad under it. Signing is one signature per instrument (`signLienRelease`), then the
 * waiver is emailed to whoever pays the bill when an address is on file, and the next row loads.
 * Sending is a courtesy on top of the signature: a failed send leaves the row signed and in the
 * office's "Signed — ready to send" lane.
 */
const OVERLAY_Z = 1120

const chip = (tone: 'amber' | 'slate'): CSSProperties => ({
  display: 'inline-block',
  fontSize: '0.6875rem',
  fontWeight: 600,
  padding: '0.05rem 0.5rem',
  borderRadius: 999,
  whiteSpace: 'nowrap',
  background: tone === 'amber' ? 'var(--bg-amber-100)' : 'var(--bg-subtle)',
  color: tone === 'amber' ? 'var(--text-amber-800)' : 'var(--text-700)',
  border: tone === 'amber' ? 'none' : '1px solid var(--border)',
})

function jobNumberOf(r: LienInboxRow): string {
  return [r.job?.hcp_number, r.job?.click_number].map((v) => (v ?? '').trim()).find(Boolean) ?? '—'
}

export function DashboardLienWaiversToSignModal({ open, onClose, rows, onChanged }: { open: boolean; onClose: () => void; rows: LienInboxRow[]; onChanged: () => void }) {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const isNarrow = useNarrowViewport640()
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [printedName, setPrintedName] = useState('')
  // v2.4335: he signs on the page's own line; the pad is read when the button is pressed.
  const padRef = useRef<LienWaiverSignOnPageHandle>(null)
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [recipient, setRecipient] = useState<{ email: string; name: string } | null | 'loading'>('loading')
  // Send after signing — on by default; untick to sign alone (the office sends from the job).
  const [sendAfter, setSendAfter] = useState(true)
  const [payorById, setPayorById] = useState<Record<string, string>>({})

  const picked = useMemo(() => rows.find((r) => r.id === pickedId) ?? rows[0] ?? null, [rows, pickedId])

  // The picked row's page and its recipient.
  useEffect(() => {
    if (!open || !picked) return
    setPrintedName(lienReleaseSnapshotToWaiverFields(picked).signerName)
    setAgreed(false)
    setFormError(null)
    setRecipient('loading')
    let cancelled = false
    void resolveLienWaiverRecipient(picked.job_id).then((r) => {
      if (!cancelled) setRecipient(r)
    })
    return () => {
      cancelled = true
    }
  }, [open, picked?.id])

  // Who each row's bill goes to — the GC's name on a sub job — for the list, in one read.
  useEffect(() => {
    if (!open || rows.length === 0) return
    let cancelled = false
    void (async () => {
      try {
        const jobIds = [...new Set(rows.map((r) => r.job_id))]
        const { data } = await supabase.from('jobs_ledger').select('id, customer_name, gc_customer_id, gcCustomer:customers!jobs_ledger_gc_customer_id_fkey(name)').in('id', jobIds)
        if (cancelled) return
        const next: Record<string, string> = {}
        for (const j of (data ?? []) as Array<{ id: string; customer_name: string | null; gcCustomer: { name: string | null } | { name: string | null }[] | null }>) {
          const gc = Array.isArray(j.gcCustomer) ? j.gcCustomer[0] : j.gcCustomer
          next[j.id] = (gc?.name ?? '').trim() || (j.customer_name ?? '').trim() || ''
        }
        setPayorById(next)
      } catch {
        /* the list shows the job alone */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, rows])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape' || busy) return
      e.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose, busy])

  const sign = useCallback(
    async (payload: EstimateAcceptSubmitPayload) => {
      if (!picked || busy) return
      setBusy(true)
      setFormError(null)
      try {
        const formType: LienWaiverFormType = isLienWaiverFormType(picked.form_type) ? picked.form_type : 'conditional_progress'
        const fields = lienReleaseSnapshotToWaiverFields(picked)
        const r = await signLienRelease({ releaseId: picked.id, formType, fields, payload, signer: { userId: user?.id ?? null }, onDevice: null })
        if (!r.ok) {
          setFormError(r.message)
          return
        }
        const to = sendAfter && recipient !== 'loading' ? recipient : null
        if (to) {
          const signedRow: LienInboxRow = { ...picked, status: 'signed', signed_at: r.signedAtIso, signer_consented_at: r.signedAtIso, signer_printed_name: payload.printedName, signer_user_id: user?.id ?? null }
          const sent = await sendLienReleaseEmailToCustomer(
            signedRow,
            { id: picked.job_id, customer_email: picked.job?.customer_email ?? null, hcp_number: picked.job?.hcp_number ?? null, click_number: picked.job?.click_number ?? null },
            { recipient: to.email, billLabel: `${jobNumberOf(picked)} ${(picked.job?.job_name ?? '').trim()}`.trim() },
          )
          showToast(sent.ok ? `Signed and sent to ${to.name}.` : `Signed. Not sent — ${sent.message}`, sent.ok ? 'success' : 'warning')
        } else {
          showToast(sendAfter ? 'Signed. No email on file — the office sends it from the job.' : 'Signed. Not sent — it waits in Signed · ready to send.', 'success')
        }
        const idx = rows.findIndex((x) => x.id === picked.id)
        const next = rows[idx + 1] ?? rows[idx - 1] ?? null
        setPickedId(next?.id ?? null)
        onChanged()
        if (!next) onClose()
      } finally {
        setBusy(false)
      }
    },
    [picked, busy, recipient, sendAfter, rows, user?.id, showToast, onChanged, onClose],
  )

  if (!open) return null
  const total = rows.reduce((s, r) => s + Number(r.amount ?? 0), 0)
  const formType: LienWaiverFormType | null = picked ? (isLienWaiverFormType(picked.form_type) ? picked.form_type : 'conditional_progress') : null
  const fields = picked ? lienReleaseSnapshotToWaiverFields(picked) : null
  const payorName = picked ? payorById[picked.job_id] || (recipient !== 'loading' && recipient ? recipient.name : '') : ''

  return (
    <div role="presentation" onClick={() => !busy && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: OVERLAY_Z, padding: '1rem', boxSizing: 'border-box' }}>
      <div role="dialog" aria-modal="true" aria-labelledby="lien-waivers-sign-title" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 10, width: 'min(1100px, calc(100vw - 2rem))', maxHeight: 'min(92vh, 900px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} data-testid="lien-waivers-sign">
        <div style={{ padding: isNarrow ? '0.75rem 0.85rem' : '0.9rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <FileCheck2 size={18} aria-hidden style={{ color: 'var(--text-link)' }} />
          <h2 id="lien-waivers-sign-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700 }}>Waivers to sign</h2>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {rows.length} · {total.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
          </span>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" style={{ marginLeft: 'auto', width: 32, height: 32, border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 6, cursor: 'pointer', color: 'inherit', font: 'inherit' }}>
            ×
          </button>
        </div>

        {rows.length === 0 ? (
          <p style={{ margin: 0, padding: '1.25rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nothing waits for your signature.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '340px minmax(0, 1fr)', minHeight: 0, flex: 1, overflow: 'hidden' }}>
            <div style={{ borderRight: isNarrow ? 'none' : '1px solid var(--border)', borderBottom: isNarrow ? '1px solid var(--border)' : 'none', overflowY: 'auto', maxHeight: isNarrow ? 180 : undefined }} data-testid="lien-waivers-list">
              {rows.map((r) => {
                const on = picked?.id === r.id
                const label = lienReleaseFormLabel(r.form_type)
                const conditional = label.startsWith('Conditional')
                return (
                  <button key={r.id} type="button" aria-pressed={on} onClick={() => setPickedId(r.id)} disabled={busy} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.15rem 0.6rem', width: '100%', textAlign: 'left', padding: '0.7rem 0.85rem', border: 'none', borderBottom: '1px solid var(--border)', borderLeft: `3px solid ${on ? 'var(--text-strong)' : 'transparent'}`, background: on ? 'var(--bg-subtle)' : 'transparent', cursor: 'pointer', font: 'inherit', color: 'inherit' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{payorById[r.job_id] || lienInboxJobLabel(r)}</span>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem', fontVariantNumeric: 'tabular-nums' }}>{Number(r.amount ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lienInboxJobLabel(r)}</span>
                    <span style={chip(conditional ? 'amber' : 'slate')}>{label}</span>
                  </button>
                )
              })}
              <div style={{ padding: '0.75rem 0.85rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Each one is signed on its own. The next loads after you sign.</div>
            </div>

            {picked && formType && fields ? (
              <div style={{ overflowY: 'auto', background: 'var(--bg-subtle)', padding: isNarrow ? '0.75rem' : '1rem 1.25rem', display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : 'minmax(0, 1fr) 260px', gap: '1rem', alignItems: 'start' }}>
                <div data-theme="light" data-testid="lien-waivers-page" style={{ background: 'var(--surface)', color: 'var(--text-base)', border: '1px solid var(--border)', borderRadius: 4, padding: '1.25rem 1.4rem', fontFamily: "Georgia, 'Times New Roman', serif", fontSize: '0.8125rem', lineHeight: 1.7, boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}>
                  <p style={{ textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 0.9em' }}>{lienWaiverTitle(formType)}</p>
                  {buildLienWaiverParagraphs(formType, fields).map((para, i) => (
                    <p key={i} style={{ margin: '0 0 0.7em' }}>
                      {para}
                    </p>
                  ))}
                  <LienWaiverSignOnPage key={picked.id} ref={padRef} foot={buildLienWaiverFoot(fields, null)} signedLabel={`Signed ${lienWaiverDate(todayYmdInAppTz())}`} allowTyped disabled={busy} />
                </div>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.25rem 0.9rem 0.9rem', fontSize: '0.8125rem' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
                    {lienReleaseFormLabel(picked.form_type)} · {LIEN_WAIVER_FORM_CITES[formType]}
                  </div>
                  <div style={{ marginTop: '0.35rem', color: 'var(--text-700)' }}>
                    {recipient === 'loading' ? (
                      'Finding who it goes to…'
                    ) : recipient ? (
                      <label style={{ display: 'flex', gap: '0.45rem', alignItems: 'flex-start', cursor: 'pointer' }}>
                        <input type="checkbox" checked={sendAfter} onChange={(e) => setSendAfter(e.target.checked)} disabled={busy} style={{ marginTop: 3 }} data-testid="lien-waivers-send-after" />
                        <span>
                          Send to <b>{recipient.name}</b> ({recipient.email}) once signed. Untick to sign alone.
                        </span>
                      </label>
                    ) : (
                      'No email on file for the payor — signed, it waits in the office’s Signed · ready to send lane.'
                    )}
                  </div>
                  <div style={{ marginTop: '0.75rem' }}>
                    <LienWaiverSignAgree
                      disclosure="By signing, you acknowledge that you have read this release of lien and agree to issue it. Drawing or typing your signature here has the same force and effect as your written signature under the federal ESIGN Act (15 U.S.C. § 7001) and the Texas UETA (Bus. & Com. Code ch. 322), and it prints on every copy of this document."
                      agreeLabel="I have read this release and agree that my electronic signature is as binding as ink."
                      agreed={agreed}
                      onAgreedChange={(v) => {
                        setAgreed(v)
                        setFormError(null)
                      }}
                      error={formError}
                      submitting={busy}
                      submitLabel={sendAfter && recipient !== 'loading' && recipient ? `✍ Sign · send to ${payorName || recipient.name}` : '✍ Sign'}
                      onSubmit={() => {
                        const r = lienWaiverSignPayload(padRef.current, printedName, agreed)
                        if ('error' in r) {
                          setFormError(r.error)
                          return
                        }
                        void sign(r.payload)
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
