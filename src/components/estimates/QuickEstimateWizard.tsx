import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, ChangeEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { resolveEstimateMasterUserId } from '../../lib/estimateMasterUser'
import { notifyDispatchRequestsChanged } from '../../lib/dispatchRequestHelpers'
import { scheduleDateKeyAddDays, scheduleTodayDateKey } from '../../lib/jobScheduleChicago'
import {
  parseBallparkDollars,
  quickEstimateBallparkLine,
  quickEstimateCanSend,
  quickEstimateDispatchTitle,
  quickEstimateDraftTitle,
  quickEstimateReferenceSummary,
  quickEstimateReviewRows,
  quickEstimateWorkLine,
  type QuickEstimateBranch,
  type QuickEstimateStage,
  type QuickEstimateSummaryInput,
} from '../../lib/quickEstimate'
import type { EstimateLineItemNormalized } from '../../lib/estimateLineItemNormalize'

/**
 * Quick Estimate wizard (v2.2293, owner-approved mockup v4) — the field
 * write-up modal. Change-order-first: it opens on the user's scheduled jobs;
 * picking one IS declaring "change order on this job". "New work for someone
 * else" is the side door to a plain estimate. Every stage but the work itself
 * is skippable; ✕ saves and closes (the draft already exists from stage 1 on).
 *
 * The wizard writes a NORMAL estimate draft — the row the office already
 * edits — plus one dispatch request on send. The job's hard FK link
 * (`estimates.job_ledger_id`, unique per job) stays with the office's
 * existing flows; the picked job travels on the dispatch request, the
 * customer link, and the first line of the change description.
 */

type WizardJob = {
  id: string
  hcp: string
  name: string
  address: string
  customerId: string | null
  day: 'today' | 'tomorrow' | null
}

type WizardCustomer = { id: string; name: string; address: string | null }

type WizardPhoto = { id: string; previewUrl: string | null; filename: string }

const QUICK_ESTIMATE_PHOTO_BUCKET = 'estimate-field-photos'

/** Roles whose dashboards can carry the Quick Estimate button. */
export const QUICK_ESTIMATE_ROLES = [
  'dev',
  'master_technician',
  'primary',
  'estimator',
  'superintendent',
  'subcontractor',
] as const

export function isQuickEstimateRole(role: string | null | undefined): boolean {
  return role != null && (QUICK_ESTIMATE_ROLES as readonly string[]).includes(role)
}

function jobLabel(j: WizardJob): string {
  const head = j.hcp.trim() ? `HCP ${j.hcp.trim()} — ${j.name}` : j.name
  return head || 'Job'
}

/* ---------- field-first styles: big type, big targets, one question ---------- */

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1002,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0.5rem',
}

const sheetStyle: CSSProperties = {
  background: 'var(--surface)',
  color: 'var(--text-strong)',
  borderRadius: 14,
  border: '1px solid var(--border)',
  width: '100%',
  maxWidth: 430,
  maxHeight: 'min(92vh, 720px)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

const qStyle: CSSProperties = { fontSize: '1.35rem', fontWeight: 700, lineHeight: 1.2, margin: 0 }
const subStyle: CSSProperties = { fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }

const bigOptionStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  border: '1.5px solid var(--border-strong)',
  borderRadius: 12,
  background: 'var(--surface)',
  color: 'var(--text-strong)',
  padding: '0.8rem 0.9rem',
  cursor: 'pointer',
  fontSize: '0.95rem',
}

const dayLabelStyle: CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  margin: 0,
}

const skipStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-link)',
  fontWeight: 600,
  fontSize: '0.95rem',
  padding: '0.75rem 0',
  cursor: 'pointer',
  width: '100%',
}

const nextStyle: CSSProperties = {
  width: '100%',
  background: 'var(--text-strong)',
  color: 'var(--surface)',
  border: 'none',
  borderRadius: 12,
  padding: '0.9rem',
  fontSize: '1rem',
  fontWeight: 700,
  cursor: 'pointer',
}

const sendStyle: CSSProperties = {
  width: '100%',
  background: '#d97706',
  color: 'white',
  border: 'none',
  borderRadius: 12,
  padding: '1rem',
  fontSize: '1.05rem',
  fontWeight: 800,
  cursor: 'pointer',
}

const inputStyle: CSSProperties = {
  width: '100%',
  border: '1.5px solid var(--border-strong)',
  borderRadius: 12,
  background: 'var(--surface)',
  color: 'var(--text-strong)',
  padding: '0.75rem 0.85rem',
  fontSize: '1rem',
  boxSizing: 'border-box',
}

const chipStyle = (selected: boolean): CSSProperties => ({
  border: `1.5px solid ${selected ? '#2563eb' : 'var(--border-strong)'}`,
  background: selected ? 'var(--bg-blue-soft, rgba(37,99,235,0.08))' : 'var(--surface)',
  color: selected ? 'var(--text-link)' : 'var(--text-strong)',
  borderRadius: 999,
  padding: '0.7rem 1.1rem',
  fontSize: '1rem',
  fontWeight: 700,
  cursor: 'pointer',
})

const coBadgeStyle = (isCO: boolean): CSSProperties => ({
  alignSelf: 'flex-start',
  fontSize: '0.68rem',
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  padding: '3px 9px',
  borderRadius: 999,
  background: isCO ? 'var(--bg-amber-100)' : 'var(--bg-blue-200)',
  color: isCO ? 'var(--text-amber-800)' : 'var(--text-blue-700)',
})

export function QuickEstimateWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, role } = useAuth()
  const { showToast } = useToastContext()

  const [stage, setStage] = useState<QuickEstimateStage>('job')
  const [branch, setBranch] = useState<QuickEstimateBranch>('change_order')
  const [scheduleJobs, setScheduleJobs] = useState<WizardJob[]>([])
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [jobSearch, setJobSearch] = useState('')
  const [jobSearchResults, setJobSearchResults] = useState<WizardJob[]>([])
  const [pickedJob, setPickedJob] = useState<WizardJob | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<WizardCustomer[]>([])
  const [pickedCustomer, setPickedCustomer] = useState<WizardCustomer | null>(null)
  const [freeTypedCustomer, setFreeTypedCustomer] = useState('')
  const [freeTypedPhone, setFreeTypedPhone] = useState('')
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<WizardPhoto[]>([])
  const [photoUploading, setPhotoUploading] = useState(false)
  const [ballparkText, setBallparkText] = useState('')
  const [dispatchNote, setDispatchNote] = useState('')
  const [busy, setBusy] = useState(false)
  const estimateIdRef = useRef<string | null>(null)
  const estimateNumberRef = useRef<number | null>(null)

  const resetAll = useCallback(() => {
    setStage('job')
    setBranch('change_order')
    setJobSearch('')
    setJobSearchResults([])
    setPickedJob(null)
    setCustomerSearch('')
    setCustomerResults([])
    setPickedCustomer(null)
    setFreeTypedCustomer('')
    setFreeTypedPhone('')
    setDescription('')
    setPhotos([])
    setBallparkText('')
    setDispatchNote('')
    setBusy(false)
    estimateIdRef.current = null
    estimateNumberRef.current = null
  }, [])

  /* ---------- schedule jobs (today + tomorrow, Chicago) ---------- */

  useEffect(() => {
    if (!open || !user?.id) return
    let cancelled = false
    setScheduleLoading(true)
    void (async () => {
      try {
        const todayKey = scheduleTodayDateKey()
        const tomorrowKey = scheduleDateKeyAddDays(todayKey, 1)
        const dates = [todayKey, tomorrowKey].filter((d): d is string => !!d)
        const { data: blocks } = await supabase
          .from('job_schedule_blocks')
          .select('job_id, work_date')
          .eq('assignee_user_id', user.id)
          .in('work_date', dates)
          .not('job_id', 'is', null)
        const dayByJob = new Map<string, 'today' | 'tomorrow'>()
        for (const b of (blocks ?? []) as Array<{ job_id: string | null; work_date: string }>) {
          if (!b.job_id) continue
          const day = b.work_date === todayKey ? 'today' : 'tomorrow'
          // Today wins when a job appears on both days.
          if (dayByJob.get(b.job_id) !== 'today') dayByJob.set(b.job_id, day)
        }
        const ids = [...dayByJob.keys()]
        if (ids.length === 0) {
          if (!cancelled) setScheduleJobs([])
          return
        }
        const { data: jobs } = await supabase
          .from('jobs_ledger')
          .select('id, hcp_number, job_name, job_address, customer_id')
          .in('id', ids)
        const list: WizardJob[] = ((jobs ?? []) as Array<{
          id: string
          hcp_number: string
          job_name: string
          job_address: string
          customer_id: string | null
        }>).map((j) => ({
          id: j.id,
          hcp: j.hcp_number ?? '',
          name: j.job_name ?? '',
          address: j.job_address ?? '',
          customerId: j.customer_id,
          day: dayByJob.get(j.id) ?? null,
        }))
        list.sort((a, b) => (a.day === b.day ? a.name.localeCompare(b.name) : a.day === 'today' ? -1 : 1))
        if (!cancelled) setScheduleJobs(list)
      } catch {
        if (!cancelled) setScheduleJobs([])
      } finally {
        if (!cancelled) setScheduleLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, user?.id])

  /* ---------- "a different job…" search ---------- */

  useEffect(() => {
    const q = jobSearch.trim()
    if (!open || q.length < 2) {
      setJobSearchResults([])
      return
    }
    const t = setTimeout(() => {
      void (async () => {
        const { data } = await supabase
          .from('jobs_ledger')
          .select('id, hcp_number, job_name, job_address, customer_id')
          .or(`hcp_number.ilike.%${q}%,job_name.ilike.%${q}%,job_address.ilike.%${q}%`)
          .limit(8)
        setJobSearchResults(
          ((data ?? []) as Array<{
            id: string
            hcp_number: string
            job_name: string
            job_address: string
            customer_id: string | null
          }>).map((j) => ({
            id: j.id,
            hcp: j.hcp_number ?? '',
            name: j.job_name ?? '',
            address: j.job_address ?? '',
            customerId: j.customer_id,
            day: null,
          })),
        )
      })()
    }, 250)
    return () => clearTimeout(t)
  }, [open, jobSearch])

  /* ---------- customer search (estimate side door) ---------- */

  useEffect(() => {
    const q = customerSearch.trim()
    if (!open || q.length < 2) {
      setCustomerResults([])
      return
    }
    const t = setTimeout(() => {
      void (async () => {
        const { data } = await supabase
          .from('customers')
          .select('id, name, address')
          .is('archived_at', null)
          .ilike('name', `%${q}%`)
          .limit(8)
        setCustomerResults((data ?? []) as WizardCustomer[])
      })()
    }, 250)
    return () => clearTimeout(t)
  }, [open, customerSearch])

  /* ---------- draft persistence ---------- */

  const buildSummaryInput = useCallback(
    (): QuickEstimateSummaryInput => ({
      branch,
      jobLabel: pickedJob ? jobLabel(pickedJob) : null,
      customerLabel: pickedCustomer?.name ?? (freeTypedCustomer.trim() || null),
      description,
      photoCount: photos.length,
      ballparkCents: parseBallparkDollars(ballparkText),
      dispatchNote,
    }),
    [branch, pickedJob, pickedCustomer, freeTypedCustomer, description, photos.length, ballparkText, dispatchNote],
  )

  const buildLines = useCallback((): EstimateLineItemNormalized[] => {
    const lines: EstimateLineItemNormalized[] = []
    if (branch === 'estimate' && description.trim()) lines.push(quickEstimateWorkLine(description))
    const cents = parseBallparkDollars(ballparkText)
    if (cents != null) lines.push(quickEstimateBallparkLine(cents))
    return lines
  }, [branch, description, ballparkText])

  /** The CO narrative: the picked job pinned as line one, then his words. */
  const buildChangeDescription = useCallback((): string => {
    const parts: string[] = []
    if (pickedJob) {
      parts.push(`Job: ${jobLabel(pickedJob)}${pickedJob.address ? ` (${pickedJob.address})` : ''}`)
    }
    if (freeTypedPhone.trim()) parts.push(`Phone: ${freeTypedPhone.trim()}`)
    if (description.trim()) parts.push(description.trim())
    return parts.join('\n\n')
  }, [pickedJob, freeTypedPhone, description])

  /** Creates the draft the first time through; later calls only update. */
  const ensureDraft = useCallback(
    async (branchArg: QuickEstimateBranch, opts: { job?: WizardJob | null; customer?: WizardCustomer | null }) => {
      if (!user?.id) return null
      if (estimateIdRef.current) return estimateIdRef.current
      const masterUserId = await resolveEstimateMasterUserId(user.id, role)
      if (!masterUserId) {
        showToast('Could not determine account owner for the draft.', 'error')
        return null
      }
      const { data, error } = await supabase
        .from('estimates')
        .insert({
          master_user_id: masterUserId,
          created_by: user.id,
          title: quickEstimateDraftTitle(branchArg, freeTypedCustomer),
          line_items_snapshot: [],
          terms_snapshot: '',
          total_cents: 0,
          customer_id: opts.job?.customerId ?? opts.customer?.id ?? null,
          ...(branchArg === 'change_order' ? { doc_kind: 'change_order', change_order_fields: {} } : {}),
        })
        .select('id, estimate_number')
        .single()
      if (error || !data) {
        showToast(formatErrorMessage(error, 'Could not start the draft'), 'error')
        return null
      }
      estimateIdRef.current = (data as { id: string }).id
      estimateNumberRef.current = (data as { estimate_number: number | null }).estimate_number ?? null
      return estimateIdRef.current
    },
    [user?.id, role, freeTypedCustomer, showToast],
  )

  /** Autosave the narrative/lines — every stage transition lands here. */
  const saveProgress = useCallback(async () => {
    const id = estimateIdRef.current
    if (!id) return
    const patch: Record<string, unknown> = {
      title: quickEstimateDraftTitle(branch, freeTypedCustomer),
      line_items_snapshot: buildLines(),
    }
    if (branch === 'change_order') {
      patch.change_order_fields = { description_of_change: buildChangeDescription() }
    }
    await supabase.from('estimates').update(patch).eq('id', id).eq('status', 'draft')
  }, [branch, freeTypedCustomer, buildLines, buildChangeDescription])

  /* ---------- photos ---------- */

  const onPickPhotos = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? [])
      e.target.value = ''
      const estimateId = estimateIdRef.current
      if (files.length === 0 || !estimateId || !user?.id) return
      setPhotoUploading(true)
      try {
        for (const file of files) {
          const safeName = file.name.replace(/[^\w.\-]+/g, '_').slice(-80) || 'photo.jpg'
          const path = `${estimateId}/${crypto.randomUUID()}-${safeName}`
          const { error: upErr } = await supabase.storage
            .from(QUICK_ESTIMATE_PHOTO_BUCKET)
            .upload(path, file, { contentType: file.type || 'image/jpeg' })
          if (upErr) throw upErr
          const { data: row, error: insErr } = await supabase
            .from('estimate_field_photos')
            .insert({
              estimate_id: estimateId,
              storage_path: path,
              filename: file.name,
              mime_type: file.type || null,
              size_bytes: file.size,
              created_by: user.id,
            })
            .select('id')
            .single()
          if (insErr) throw insErr
          const { data: signed } = await supabase.storage
            .from(QUICK_ESTIMATE_PHOTO_BUCKET)
            .createSignedUrl(path, 3600)
          setPhotos((prev) => [
            ...prev,
            { id: (row as { id: string }).id, previewUrl: signed?.signedUrl ?? null, filename: file.name },
          ])
        }
      } catch (err) {
        showToast(formatErrorMessage(err, 'Photo upload failed'), 'error')
      } finally {
        setPhotoUploading(false)
      }
    },
    [user?.id, showToast],
  )

  const removePhoto = useCallback(async (photo: WizardPhoto) => {
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
    await supabase.from('estimate_field_photos').delete().eq('id', photo.id)
  }, [])

  /* ---------- stage transitions ---------- */

  const goWorkFromJob = useCallback(
    async (job: WizardJob | null) => {
      setBusy(true)
      try {
        setPickedJob(job)
        setBranch('change_order')
        const id = await ensureDraft('change_order', { job })
        if (id) setStage('work')
      } finally {
        setBusy(false)
      }
    },
    [ensureDraft],
  )

  const goWorkFromCustomer = useCallback(
    async (customer: WizardCustomer | null) => {
      setBusy(true)
      try {
        setPickedCustomer(customer)
        const id = await ensureDraft('estimate', { customer })
        if (id) setStage('work')
      } finally {
        setBusy(false)
      }
    },
    [ensureDraft],
  )

  const goCost = useCallback(async () => {
    await saveProgress()
    setStage('cost')
  }, [saveProgress])

  const goReview = useCallback(async () => {
    await saveProgress()
    setStage('review')
  }, [saveProgress])

  /** ✕ saves (drafts autosave as they go) and closes; done resets. */
  const closeAndKeep = useCallback(() => {
    if (stage !== 'done' && estimateIdRef.current) void saveProgress()
    resetAll()
    onClose()
  }, [stage, saveProgress, resetAll, onClose])

  /* ---------- send ---------- */

  const send = useCallback(async () => {
    const id = estimateIdRef.current
    if (!id || !user?.id || busy) return
    const summary = buildSummaryInput()
    if (!quickEstimateCanSend(summary)) {
      showToast('Say what the work is (or add a photo) before sending.', 'warning')
      return
    }
    setBusy(true)
    try {
      // Final content save + the dispatch stamp + "ping me on acceptance".
      const { data: current } = await supabase
        .from('estimates')
        .select('accept_notify_user_ids')
        .eq('id', id)
        .maybeSingle()
      const existingNotify = Array.isArray((current as { accept_notify_user_ids?: unknown } | null)?.accept_notify_user_ids)
        ? ((current as { accept_notify_user_ids: unknown[] }).accept_notify_user_ids.filter(
            (x): x is string => typeof x === 'string' && x.length > 0,
          ))
        : []
      const patch: Record<string, unknown> = {
        title: quickEstimateDraftTitle(branch, freeTypedCustomer),
        line_items_snapshot: buildLines(),
        sent_to_dispatch_at: new Date().toISOString(),
        accept_notify_user_ids: [...new Set([...existingNotify, user.id])],
      }
      if (branch === 'change_order') {
        patch.change_order_fields = { description_of_change: buildChangeDescription() }
      }
      const { error: updErr } = await supabase.from('estimates').update(patch).eq('id', id).eq('status', 'draft')
      if (updErr) throw updErr

      const estimateNumber = estimateNumberRef.current
      const { data: reqRow, error: reqErr } = await supabase
        .from('dispatch_requests')
        .insert({
          from_user_id: user.id,
          title: quickEstimateDispatchTitle(summary),
          links: estimateNumber != null ? [`/estimates/${estimateNumber}`] : [],
          job_ledger_id: pickedJob?.id ?? null,
          reference_summary: quickEstimateReferenceSummary(summary),
          pending_action: 'review_field_estimate',
          pending_payload: {
            estimate_id: id,
            estimate_number: estimateNumber,
            doc_kind: branch,
          },
        })
        .select('id')
        .single()
      if (reqErr || !reqRow) throw reqErr ?? new Error('Could not send to Dispatch')
      void supabase.functions.invoke('notify-dispatch-request', {
        body: { dispatch_request_id: (reqRow as { id: string }).id },
      })
      notifyDispatchRequestsChanged()
      setStage('done')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not send to Dispatch'), 'error')
    } finally {
      setBusy(false)
    }
  }, [user?.id, busy, buildSummaryInput, branch, freeTypedCustomer, buildLines, buildChangeDescription, pickedJob, showToast])

  if (!open || !user?.id) return null

  const isCO = branch === 'change_order'
  const badge = (
    <span style={coBadgeStyle(isCO)}>
      {isCO ? `CO${pickedJob ? ` · ${jobLabel(pickedJob)}` : ''}` : 'Estimate · new work'}
    </span>
  )
  const todayJobs = scheduleJobs.filter((j) => j.day === 'today')
  const tomorrowJobs = scheduleJobs.filter((j) => j.day === 'tomorrow')

  const jobOption = (j: WizardJob) => (
    <button key={j.id} type="button" style={bigOptionStyle} disabled={busy} onClick={() => void goWorkFromJob(j)}>
      <span style={{ fontWeight: 700, display: 'block' }}>{jobLabel(j)}</span>
      {j.address ? <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{j.address}</span> : null}
    </button>
  )

  return (
    <div
      style={overlayStyle}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeAndKeep()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Quick Estimate" style={sheetStyle}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.8rem 1rem',
            background: 'var(--bg-subtle)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <strong style={{ fontSize: '0.95rem' }}>⚡ Quick Estimate</strong>
          <button
            type="button"
            aria-label="Save and close"
            onClick={closeAndKeep}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-muted)' }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto' }}>
          {stage === 'job' && (
            <>
              <h2 style={qStyle}>Which job are you on?</h2>
              <p style={subStyle}>The write-up becomes a change order for that job.</p>
              {scheduleLoading ? <p style={subStyle}>Loading your schedule…</p> : null}
              {todayJobs.length > 0 && <p style={dayLabelStyle}>Today — from your schedule</p>}
              {todayJobs.map(jobOption)}
              {tomorrowJobs.length > 0 && <p style={dayLabelStyle}>Tomorrow</p>}
              {tomorrowJobs.map(jobOption)}
              <input
                style={inputStyle}
                placeholder="🔍 A different job…"
                value={jobSearch}
                onChange={(e) => setJobSearch(e.target.value)}
              />
              {jobSearchResults.map(jobOption)}
              <button type="button" style={skipStyle} disabled={busy} onClick={() => void goWorkFromJob(null)}>
                Skip — I'll say it in the notes
              </button>
              <button
                type="button"
                style={{
                  ...skipStyle,
                  color: 'var(--text-muted)',
                  borderTop: '1px dashed var(--border-strong)',
                }}
                onClick={() => {
                  setBranch('estimate')
                  setStage('customer')
                }}
              >
                Not for a job? <span style={{ color: 'var(--text-link)' }}>New work for someone else →</span>
              </button>
            </>
          )}

          {stage === 'customer' && (
            <>
              {badge}
              <h2 style={qStyle}>Who's it for?</h2>
              <input
                style={inputStyle}
                placeholder="🔍 Customer name…"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
              {customerResults.map((c) => (
                <button key={c.id} type="button" style={bigOptionStyle} disabled={busy} onClick={() => void goWorkFromCustomer(c)}>
                  <span style={{ fontWeight: 700, display: 'block' }}>{c.name}</span>
                  {c.address ? <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.address}</span> : null}
                </button>
              ))}
              <p style={dayLabelStyle}>Or just tell us</p>
              <input
                style={inputStyle}
                placeholder="A name — “Mike down the road” works"
                value={freeTypedCustomer}
                onChange={(e) => setFreeTypedCustomer(e.target.value)}
              />
              <input
                style={inputStyle}
                placeholder="Phone (optional)"
                inputMode="tel"
                value={freeTypedPhone}
                onChange={(e) => setFreeTypedPhone(e.target.value)}
              />
              <button type="button" style={nextStyle} disabled={busy} onClick={() => void goWorkFromCustomer(null)}>
                {freeTypedCustomer.trim() ? 'Next' : 'Skip — it’s in the notes'}
              </button>
            </>
          )}

          {stage === 'work' && (
            <>
              {badge}
              <h2 style={qStyle}>{isCO ? "What's the extra work?" : "What's the work?"}</h2>
              <textarea
                style={{ ...inputStyle, minHeight: 130, resize: 'vertical', fontFamily: 'inherit' }}
                placeholder="Talk or type… e.g. “They added a hose bib on the back wall and want the water heater moved to the attic.”"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <p style={{ ...subStyle, background: 'var(--bg-subtle)', borderRadius: 10, padding: '0.5rem 0.75rem' }}>
                🎙️ Tip: tap the mic on your keyboard and just talk.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {photos.map((p) => (
                  <span key={p.id} style={{ position: 'relative', display: 'inline-block' }}>
                    {p.previewUrl ? (
                      <img
                        src={p.previewUrl}
                        alt={p.filename}
                        style={{ width: 62, height: 62, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }}
                      />
                    ) : (
                      <span
                        style={{
                          width: 62,
                          height: 62,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 10,
                          background: 'var(--bg-subtle)',
                        }}
                      >
                        🖼️
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label={`Remove photo ${p.filename}`}
                      onClick={() => void removePhoto(p)}
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        width: 20,
                        height: 20,
                        borderRadius: 999,
                        border: '1px solid var(--border-strong)',
                        background: 'var(--surface)',
                        color: 'var(--text-muted)',
                        fontSize: '0.7rem',
                        lineHeight: 1,
                        cursor: 'pointer',
                      }}
                    >
                      ✕
                    </button>
                  </span>
                ))}
                <label
                  style={{
                    width: 62,
                    height: 62,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 10,
                    border: '1.5px dashed var(--border-strong)',
                    cursor: photoUploading ? 'wait' : 'pointer',
                    fontSize: '1.3rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  {photoUploading ? '…' : '＋'}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={(e) => void onPickPhotos(e)}
                    style={{ display: 'none' }}
                    disabled={photoUploading}
                  />
                </label>
              </div>
              <button type="button" style={nextStyle} disabled={busy} onClick={() => void goCost()}>
                Next
              </button>
            </>
          )}

          {stage === 'cost' && (
            <>
              {badge}
              <h2 style={qStyle}>About how much?</h2>
              <p style={subStyle}>Type a ballpark, tap a quick number, or skip. Rough is fine.</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: '1.1rem', color: 'var(--text-muted)', fontWeight: 700 }}>$</span>
                <input
                  style={{ ...inputStyle, fontSize: '1.3rem', fontWeight: 700 }}
                  placeholder="Tap to type an amount…"
                  inputMode="decimal"
                  value={ballparkText}
                  onChange={(e) => setBallparkText(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['250', '500', '1,000', '2,500'].map((v) => (
                  <button
                    key={v}
                    type="button"
                    style={chipStyle(ballparkText === v)}
                    onClick={() => setBallparkText(v)}
                  >
                    ${v}
                  </button>
                ))}
              </div>
              <button
                type="button"
                style={skipStyle}
                disabled={busy}
                onClick={() => {
                  setBallparkText('')
                  void goReview()
                }}
              >
                Skip — let the office price it
              </button>
              <button type="button" style={nextStyle} disabled={busy} onClick={() => void goReview()}>
                Next
              </button>
            </>
          )}

          {stage === 'review' && (
            <>
              <h2 style={qStyle}>Ready to send</h2>
              <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                {quickEstimateReviewRows(buildSummaryInput()).map((r) => (
                  <div
                    key={r.key}
                    style={{
                      display: 'flex',
                      gap: 10,
                      padding: '0.65rem 0.85rem',
                      borderBottom: '1px solid var(--border)',
                      alignItems: 'baseline',
                    }}
                  >
                    <span style={{ width: 18, flexShrink: 0, color: r.filled ? '#15803d' : 'var(--text-muted)' }}>
                      {r.filled ? '✓' : '—'}
                    </span>
                    <span style={{ width: 62, flexShrink: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {r.label}
                    </span>
                    <span style={{ fontSize: '0.9rem' }}>{r.value}</span>
                  </div>
                ))}
              </div>
              <input
                style={inputStyle}
                placeholder="Anything else for dispatch? (optional)"
                value={dispatchNote}
                onChange={(e) => setDispatchNote(e.target.value)}
              />
              <button type="button" style={sendStyle} disabled={busy} onClick={() => void send()}>
                {busy ? 'Sending…' : 'Send to Dispatch'}
              </button>
              <p style={{ ...subStyle, textAlign: 'center' }}>The office finishes it and sends it to the customer.</p>
            </>
          )}

          {stage === 'done' && (
            <>
              <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                <div style={{ fontSize: '3rem', color: '#15803d' }}>✓</div>
                <h2 style={{ ...qStyle, marginTop: 8 }}>Sent to Dispatch</h2>
                <p style={{ ...subStyle, maxWidth: 260, margin: '0.5rem auto 0' }}>
                  The office will price {isCO ? 'the change order' : 'the estimate'} and send it to the customer for
                  approval. You'll get an email when they accept.
                </p>
              </div>
              <button type="button" style={skipStyle} onClick={resetAll}>
                Start another
              </button>
              <button
                type="button"
                style={nextStyle}
                onClick={() => {
                  resetAll()
                  onClose()
                }}
              >
                Done
              </button>
            </>
          )}

          {isQuickEstimateRole(role) ? null : (
            <p style={subStyle}>Quick Estimate is for field roles — ask a dev if you think you should have it.</p>
          )}
        </div>
      </div>
    </div>
  )
}
