import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import type { UserRole } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { createDispatchRequest } from '../../lib/dispatchRequestHelpers'
import {
  TURNAWAY_PENDING_ACTION,
  TURNAWAY_REASONS,
  TURNAWAY_TEMPLATE_NAME,
  buildTurnawayDispatchTitle,
  buildTurnawayFieldValues,
  buildTurnawayReferenceSummary,
  turnawayReasonLabel,
  type TurnawayReason,
} from '../../lib/turnaway'

type Props = {
  open: boolean
  onClose: () => void
  onSubmitted: () => void
  authUserId: string | null
  userRole?: UserRole | null
  jobId: string
  hcpNumber: string
  jobName: string
  jobAddress: string
}

const TEMPLATE_MISSING_MSG = "Turnaway reporting isn't set up yet. Contact Dispatch."

export default function TurnawayModal({
  open,
  onClose,
  onSubmitted,
  authUserId,
  userRole,
  jobId,
  hcpNumber,
  jobName,
  jobAddress,
}: Props) {
  const { showToast } = useToastContext()
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [templateLoading, setTemplateLoading] = useState(false)
  const [reason, setReason] = useState<TurnawayReason | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setReason(null)
      setNote('')
      setError(null)
      return
    }
    let cancelled = false
    setTemplateLoading(true)
    supabase
      .from('report_templates')
      .select('id')
      .eq('name', TURNAWAY_TEMPLATE_NAME)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setTemplateId((data as { id: string } | null)?.id ?? null)
        setTemplateLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!authUserId || !templateId || !reason) return
    setSaving(true)
    setError(null)

    const fv = buildTurnawayFieldValues(reason, note)

    let reportedAtLat: number | null = null
    let reportedAtLng: number | null = null
    if ('geolocation' in navigator) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 60000,
          })
        })
        reportedAtLat = pos.coords.latitude
        reportedAtLng = pos.coords.longitude
      } catch {
        // Proceed without location
      }
    }

    let inserted: { id: string } | null = null
    let err: { message: string } | null = null

    if (userRole === 'estimator') {
      // RPC accepts null for p_project_id when p_job_ledger_id is set; generated types are stricter
      const { data: reportId, error: rpcErr } = await supabase.rpc('insert_report', {
        p_template_id: templateId,
        p_field_values: fv,
        p_job_ledger_id: jobId,
        p_project_id: null as unknown as string,
        p_reported_at_lat: reportedAtLat ?? undefined,
        p_reported_at_lng: reportedAtLng ?? undefined,
      })
      err = rpcErr
      if (reportId && typeof reportId === 'string') inserted = { id: reportId }
    } else {
      const { data: sessionUser } = await supabase.auth.getUser()
      const createdByUserId = sessionUser?.user?.id ?? authUserId
      const { data: row, error: insertErr } = await supabase.from('reports').insert({
        template_id: templateId,
        created_by_user_id: createdByUserId,
        field_values: fv,
        job_ledger_id: jobId,
        project_id: null,
        ...(reportedAtLat != null &&
          reportedAtLng != null && { reported_at_lat: reportedAtLat, reported_at_lng: reportedAtLng }),
      }).select('id').single()
      err = insertErr
      inserted = row ?? null
    }
    if (err) {
      setSaving(false)
      setError(err.message)
      return
    }
    if (inserted?.id) {
      void supabase.functions
        .invoke('send-report-notification', { body: { report_id: inserted.id } })
        .catch(() => { /* notification is best-effort */ })
    }

    // The report is saved; the dispatch alert is what routes the trip charge to
    // the office, so surface its failure as a warning rather than a hard error.
    try {
      await createDispatchRequest({
        fromUserId: authUserId,
        title: buildTurnawayDispatchTitle({ jobLabel: `${hcpNumber} ${jobName}`, reason, note }),
        jobId,
        referenceSummary: buildTurnawayReferenceSummary(reason, { hcpNumber, jobName, jobAddress }),
        pendingAction: TURNAWAY_PENDING_ACTION,
      })
      showToast('Turnaway filed — dispatch notified', 'success')
    } catch {
      showToast('Turnaway report saved, but the dispatch alert failed — contact Dispatch.', 'warning')
    }
    setSaving(false)
    onSubmitted()
  }

  if (!open) return null

  const canSubmit = !!authUserId && !!templateId && !!reason && !saving

  function reasonChipStyles(r: TurnawayReason): CSSProperties {
    const selected = reason === r
    return {
      padding: '0.6rem 1rem',
      fontSize: '0.9375rem',
      borderRadius: 6,
      cursor: 'pointer',
      border: selected ? '2px solid #d97706' : '1px solid #d1d5db',
      background: selected ? '#fffbeb' : 'white',
      fontWeight: selected ? 600 : 400,
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 65,
      }}
    >
      <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 480, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Turnaway</h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', fontWeight: 500 }}>
              {hcpNumber} {jobName}
            </p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
              {jobAddress}
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#6b7280' }} aria-label="Close">×</button>
        </div>

        {!templateLoading && !templateId && (
          <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{TEMPLATE_MISSING_MSG}</p>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>What happened?</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {TURNAWAY_REASONS.map((r) => (
                <button key={r} type="button" onClick={() => setReason(r)} style={reasonChipStyles(r)}>
                  {turnawayReasonLabel(r)}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
            />
          </div>

          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
            <button
              type="submit"
              disabled={!canSubmit}
              style={{ padding: '0.5rem 1rem', background: canSubmit ? '#d97706' : '#9ca3af', color: 'white', border: 'none', borderRadius: 4, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
            >
              {saving ? 'Filing…' : 'File Turnaway'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
