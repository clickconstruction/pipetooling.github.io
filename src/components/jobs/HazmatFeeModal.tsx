import { useEffect, useMemo, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import {
  createHazmatFeeIncident,
  loadHazmatClauseFromTerms,
  loadHazmatFeeDefault,
  type HazmatIncidentDraft,
  type HazmatTestimonial,
} from '../../lib/hazmatFee'
import { buildHazmatFeeNoticeHtml } from '../../lib/jobsDocuments/hazmatFeeNotice'

export type HazmatFeeModalJob = {
  id: string
  jobNumber: string
  jobName: string
  jobAddress: string
  customerName: string
}

/**
 * Hazmat Fee wizard (Jobs → Stages): documents a biohazard exposure incident
 * (photos + technician testimonials + ToS §11 snapshot) and mints the rider
 * invoice via create_hazmat_fee_incident. Four steps; evidence is mandatory.
 */
export function HazmatFeeModal({
  job,
  onClose,
  onCreated,
}: {
  job: HazmatFeeModalJob | null
  onClose: () => void
  onCreated: () => void
}) {
  const { showToast } = useToastContext()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [incidentAtLocal, setIncidentAtLocal] = useState('')
  const [description, setDescription] = useState('')
  const [exposedPeople, setExposedPeople] = useState('')
  const [stageLabel, setStageLabel] = useState('')
  const [photoLinksText, setPhotoLinksText] = useState('')
  const [testimonials, setTestimonials] = useState<Array<{ name: string; statement: string }>>([
    { name: '', statement: '' },
  ])
  const [clause, setClause] = useState<string | null>(null)
  const [clauseLoaded, setClauseLoaded] = useState(false)
  const [liabilityConfirmed, setLiabilityConfirmed] = useState(false)
  const [feeAmount, setFeeAmount] = useState<number>(500)
  const [createdDraft, setCreatedDraft] = useState<HazmatIncidentDraft | null>(null)

  useEffect(() => {
    if (!job) return
    setStep(0)
    setBusy(false)
    setError(null)
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    setIncidentAtLocal(
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`,
    )
    setDescription('')
    setExposedPeople('')
    setStageLabel('')
    setPhotoLinksText('')
    setTestimonials([{ name: '', statement: '' }])
    setLiabilityConfirmed(false)
    setCreatedDraft(null)
    setClauseLoaded(false)
    void loadHazmatClauseFromTerms().then(({ clause: c }) => {
      setClause(c)
      setClauseLoaded(true)
    })
    void loadHazmatFeeDefault().then(setFeeAmount)
  }, [job])

  const photoLinks = useMemo(
    () =>
      photoLinksText
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => /^https?:\/\/\S+$/i.test(l)),
    [photoLinksText],
  )
  const validTestimonials = useMemo(
    () => testimonials.filter((t) => t.name.trim() && t.statement.trim()),
    [testimonials],
  )

  if (!job) return null

  const stepValid =
    step === 0
      ? description.trim().length > 0 && incidentAtLocal.length > 0
      : step === 1
        ? photoLinks.length >= 1 && validTestimonials.length >= 1
        : step === 2
          ? clause != null && liabilityConfirmed
          : Number.isFinite(feeAmount) && feeAmount > 0

  const buildDraft = (): HazmatIncidentDraft => ({
    incidentAt: new Date(incidentAtLocal).toISOString(),
    description: description.trim(),
    exposedPeople: exposedPeople.trim(),
    stageLabel: stageLabel.trim() || null,
    photoLinks,
    testimonials: validTestimonials.map(
      (t): HazmatTestimonial => ({
        name: t.name.trim(),
        userId: null,
        statement: t.statement.trim(),
        givenAt: new Date().toISOString(),
      }),
    ),
    tosClauseSnapshot: clause ?? '',
    feeAmount,
  })

  const generate = async () => {
    setBusy(true)
    setError(null)
    const draft = buildDraft()
    const res = await createHazmatFeeIncident(job.id, draft)
    setBusy(false)
    if (!res.ok) {
      setError(res.error ?? 'Could not create the hazmat fee')
      return
    }
    setCreatedDraft(draft)
    showToast(`Hazmat fee created — $${feeAmount.toFixed(2)} ready to bill.`, 'success')
    onCreated()
  }

  const openNotice = (draft: HazmatIncidentDraft) => {
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(buildHazmatFeeNoticeHtml(job, draft))
    w.document.close()
  }

  const stepTitles = ['Incident', 'Evidence', 'Liability', 'Fee & generate']
  const labelStyle = { fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' } as const
  const inputStyle = {
    width: '100%',
    padding: '0.4rem 0.5rem',
    fontSize: '0.875rem',
    border: '1px solid var(--border-strong)',
    borderRadius: 4,
    boxSizing: 'border-box',
  } as const

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 1003,
      }}
      role="presentation"
      onClick={busy ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="hazmat-fee-modal-title"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          width: 'min(94vw, 560px)',
          maxHeight: '88vh',
          overflowY: 'auto',
          padding: '1rem 1.1rem',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 id="hazmat-fee-modal-title" style={{ margin: 0, color: 'var(--text-strong)' }}>
            ☣ Hazmat Fee — {job.jobNumber} · {job.jobName}
          </h3>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {createdDraft
              ? 'Created — the fee is on the job as its own ready-to-bill line.'
              : `Step ${step + 1} of 4 — ${stepTitles[step]}`}
          </p>
        </div>

        {createdDraft ? (
          <>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-700)' }}>
              A ${createdDraft.feeAmount.toFixed(2)} rider invoice was added to this job (independent of
              the main bill). Print the notice and include it when you bill the customer.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => openNotice(createdDraft)}
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.875rem', border: '1px solid #2563eb', borderRadius: 4, background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)', cursor: 'pointer', fontWeight: 600 }}
              >
                Open printable notice
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.875rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            {step === 0 ? (
              <div style={{ display: 'grid', gap: '0.6rem' }}>
                <label style={labelStyle}>
                  When did it happen?
                  <input type="datetime-local" value={incidentAtLocal} onChange={(e) => setIncidentAtLocal(e.target.value)} style={{ ...inputStyle, marginTop: 4 }} />
                </label>
                <label style={labelStyle}>
                  What happened?
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="e.g. Waste was discharged down an open pipe while a technician was working beneath it…" style={{ ...inputStyle, marginTop: 4, resize: 'vertical' }} />
                </label>
                <label style={labelStyle}>
                  Who was exposed?
                  <input type="text" value={exposedPeople} onChange={(e) => setExposedPeople(e.target.value)} placeholder="e.g. Abraham" style={{ ...inputStyle, marginTop: 4 }} />
                </label>
                <label style={labelStyle}>
                  Stage of work (optional)
                  <input type="text" value={stageLabel} onChange={(e) => setStageLabel(e.target.value)} placeholder="e.g. Top Out" style={{ ...inputStyle, marginTop: 4 }} />
                </label>
              </div>
            ) : null}

            {step === 1 ? (
              <div style={{ display: 'grid', gap: '0.6rem' }}>
                <label style={labelStyle}>
                  Photo links (one per line, at least one) — {photoLinks.length} valid
                  <textarea value={photoLinksText} onChange={(e) => setPhotoLinksText(e.target.value)} rows={3} placeholder={'https://…\nhttps://…'} style={{ ...inputStyle, marginTop: 4, resize: 'vertical' }} />
                </label>
                <span style={labelStyle}>Technician testimonials (at least one)</span>
                {testimonials.map((t, i) => (
                  <div key={i} style={{ display: 'grid', gap: 4, border: '1px solid var(--border)', borderRadius: 6, padding: '0.5rem' }}>
                    <input type="text" value={t.name} onChange={(e) => setTestimonials((prev) => prev.map((x, xi) => (xi === i ? { ...x, name: e.target.value } : x)))} placeholder="Technician name" aria-label={`Testimonial ${i + 1} technician name`} style={inputStyle} />
                    <textarea value={t.statement} onChange={(e) => setTestimonials((prev) => prev.map((x, xi) => (xi === i ? { ...x, statement: e.target.value } : x)))} rows={2} placeholder="Statement in the technician's words" aria-label={`Testimonial ${i + 1} statement`} style={{ ...inputStyle, resize: 'vertical' }} />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setTestimonials((prev) => [...prev, { name: '', statement: '' }])}
                  style={{ justifySelf: 'start', padding: '0.3rem 0.6rem', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}
                >
                  + Add another testimonial
                </button>
              </div>
            ) : null}

            {step === 2 ? (
              <div style={{ display: 'grid', gap: '0.6rem' }}>
                {!clauseLoaded ? (
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading the terms clause…</p>
                ) : clause ? (
                  <>
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      This clause is snapshotted into the incident record verbatim, so later edits to the
                      terms cannot weaken the evidence:
                    </p>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.8125rem', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.6rem', maxHeight: 220, overflowY: 'auto', color: 'var(--text-700)' }}>{clause}</pre>
                    <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: '0.875rem', color: 'var(--text-700)' }}>
                      <input type="checkbox" checked={liabilityConfirmed} onChange={(e) => setLiabilityConfirmed(e.target.checked)} style={{ marginTop: 3 }} />
                      I confirm this incident falls under the clause above and the customer is liable for
                      the biohazard remediation fee.
                    </label>
                  </>
                ) : (
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-red-700)' }}>
                    The Terms &amp; Conditions have no “11. Biohazard / Hazmat Exposure Fee” clause. Add it
                    to the terms first — without it there is no contractual basis for the fee.
                  </p>
                )}
              </div>
            ) : null}

            {step === 3 ? (
              <div style={{ display: 'grid', gap: '0.6rem' }}>
                <label style={labelStyle}>
                  Fee amount (USD)
                  <input type="number" min={1} step={50} value={feeAmount} onChange={(e) => setFeeAmount(Number(e.target.value))} style={{ ...inputStyle, marginTop: 4, width: 140 }} />
                </label>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Generating adds a <strong>${Number.isFinite(feeAmount) ? feeAmount.toFixed(2) : '—'}</strong> ready-to-bill line to this job
                  (billed separately from the main invoice) and saves the incident record with{' '}
                  {photoLinks.length} photo link{photoLinks.length === 1 ? '' : 's'}, {validTestimonials.length}{' '}
                  testimonial{validTestimonials.length === 1 ? '' : 's'}, and the terms clause snapshot.
                </p>
              </div>
            ) : null}

            {error ? (
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-red-700)', whiteSpace: 'pre-wrap' }}>{error}</p>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
              <button
                type="button"
                disabled={busy}
                onClick={step === 0 ? onClose : () => setStep((s) => s - 1)}
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.875rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-700)', cursor: busy ? 'not-allowed' : 'pointer' }}
              >
                {step === 0 ? 'Cancel' : '← Back'}
              </button>
              {step < 3 ? (
                <button
                  type="button"
                  disabled={!stepValid || busy}
                  onClick={() => setStep((s) => s + 1)}
                  style={{ padding: '0.4rem 0.85rem', fontSize: '0.875rem', fontWeight: 600, border: 'none', borderRadius: 4, background: stepValid ? '#2563eb' : 'var(--bg-muted)', color: stepValid ? 'white' : 'var(--text-faint)', cursor: stepValid ? 'pointer' : 'not-allowed' }}
                >
                  Next →
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!stepValid || busy}
                  onClick={() => void generate()}
                  style={{ padding: '0.4rem 0.85rem', fontSize: '0.875rem', fontWeight: 600, border: 'none', borderRadius: 4, background: stepValid && !busy ? '#dc2626' : 'var(--bg-muted)', color: stepValid && !busy ? 'white' : 'var(--text-faint)', cursor: stepValid && !busy ? 'pointer' : 'not-allowed' }}
                >
                  {busy ? 'Generating…' : `Generate $${Number.isFinite(feeAmount) ? feeAmount.toFixed(0) : '—'} hazmat fee`}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
