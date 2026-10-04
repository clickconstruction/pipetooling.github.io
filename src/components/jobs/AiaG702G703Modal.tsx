import { Fragment, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { LimitedJobDetailSnapshot } from '../../types/limitedJobDetailSnapshot'
import {
  AIA_FIELD_DEFS,
  AIA_MODAL_DETAILS_GROUP_SUMMARY,
  AIA_TEMPLATE_PUBLIC_PATH,
  type AiaFieldDef,
  type AiaFieldKey,
  type AiaFieldValues,
  type AiaModalDetailsGroupId,
  type AiaPrefillFacts,
  aiaDownloadFilename,
  buildAiaPrefillFromJob,
} from '../../lib/aiaG702G703Template'
import { fetchAndFillAiaTemplate } from '../../lib/fillAiaG702G703Workbook'
import { buildAiaPreview } from '../../lib/aiaG702G703Preview'
import { loadAiaPrefillFacts } from '../../lib/aiaG702G703PrefillIo'
import {
  type SavedPayApplication,
  carryForwardPayApplication,
  nextApplicationNumber,
  payApplicationLabel,
  payApplicationWriteFromForm,
  previousPayApplication,
  sortPayApplications,
} from '../../lib/aiaPayApplications'
import { PayApplicationNumberTaken, deletePayApplication, loadPayApplications, savePayApplication } from '../../lib/aiaPayApplicationsIo'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import AiaG702G703Paper from './AiaG702G703Paper'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import { fetchPhysicalInvoiceIssuerFromAppSettings, getPhysicalInvoiceIssuerDraft } from '../../lib/physicalInvoiceIssuer'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'

function triggerDownloadArrayBuffer(ab: ArrayBuffer, filename: string): void {
  const blob = new Blob([ab], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const swatch: CSSProperties = { display: 'inline-block', width: 22, height: 12, borderRadius: 2 }

function applicationChipStyle(on: boolean): CSSProperties {
  return {
    padding: '0.25rem 0.6rem',
    fontSize: '0.8125rem',
    borderRadius: 999,
    cursor: 'pointer',
    border: '1px solid var(--border-strong)',
    background: on ? 'var(--text-strong)' : 'var(--surface)',
    color: on ? 'var(--surface)' : 'var(--text-700)',
    fontVariantNumeric: 'tabular-nums',
  }
}

function emptyFormState(): Record<AiaFieldKey, string> {
  const o = {} as Record<AiaFieldKey, string>
  for (const def of AIA_FIELD_DEFS) {
    o[def.key] = ''
  }
  return o
}

type AiaModalFieldSegment =
  | { type: 'field'; def: AiaFieldDef }
  | { type: 'group'; groupId: AiaModalDetailsGroupId; defs: AiaFieldDef[] }

function buildAiaModalFieldSegments(defs: readonly AiaFieldDef[]): AiaModalFieldSegment[] {
  const segments: AiaModalFieldSegment[] = []
  let i = 0
  while (i < defs.length) {
    const current = defs[i]!
    const gid = current.detailsGroupId
    if (gid) {
      const groupDefs: AiaFieldDef[] = []
      while (i < defs.length && defs[i]!.detailsGroupId === gid) {
        groupDefs.push(defs[i]!)
        i++
      }
      segments.push({ type: 'group', groupId: gid, defs: groupDefs })
    } else {
      segments.push({ type: 'field', def: current })
      i++
    }
  }
  return segments
}

/** Field values (a prefill, a saved application) as the form's strings. */
function fieldValuesToFormState(values: AiaFieldValues): Record<AiaFieldKey, string> {
  const next = emptyFormState()
  for (const def of AIA_FIELD_DEFS) {
    const v = values[def.key]
    if (v === undefined || v === '') continue
    next[def.key] = typeof v === 'number' ? String(v) : v
  }
  return next
}

function formStateToFieldValues(form: Record<AiaFieldKey, string>): AiaFieldValues {
  const out: AiaFieldValues = {}
  for (const def of AIA_FIELD_DEFS) {
    const s = form[def.key]?.trim() ?? ''
    if (!s) continue
    if (def.kind === 'number') {
      const n = Number(s.replace(/,/g, ''))
      if (Number.isFinite(n)) out[def.key] = n
    } else if (def.kind === 'percent') {
      const n = Number(s.replace(/,/g, '').replace(/%\s*$/, '').trim())
      if (Number.isFinite(n)) out[def.key] = n
    } else {
      out[def.key] = s
    }
  }
  return out
}

export default function AiaG702G703Modal({
  open,
  onClose,
  job,
  hcpForFilename,
}: {
  open: boolean
  onClose: () => void
  job: JobWithDetails | LimitedJobDetailSnapshot | null
  hcpForFilename: string
}) {
  const { role: authRole } = useAuth()
  const { showToast } = useToastContext()
  const [form, setForm] = useState<Record<AiaFieldKey, string>>(emptyFormState)
  const [generating, setGenerating] = useState(false)
  // Side by side from 1000px: the paper on the left, the form on the right. Under that, one at a time.
  const wide = useMatchMedia('(min-width: 1000px)')
  const [narrowView, setNarrowView] = useState<'form' | 'preview'>('form')
  const [activeKey, setActiveKey] = useState<AiaFieldKey | null>(null)
  const [changeOrdersOpen, setChangeOrdersOpen] = useState(false)
  const preview = useMemo(() => buildAiaPreview(formStateToFieldValues(form)), [form])

  /** A box pressed on the paper: put the cursor in its field. */
  const pickField = useCallback((key: AiaFieldKey) => {
    setActiveKey(key)
    setNarrowView('form')
    if (AIA_FIELD_DEFS.find((d) => d.key === key)?.detailsGroupId) setChangeOrdersOpen(true)
    window.setTimeout(() => {
      const input = document.getElementById(`aia-field-${key}`)
      if (!input) return
      input.focus()
      if (typeof input.scrollIntoView === 'function') input.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 0)
  }, [])

  // The payer's address and the signed contract's day, read once per opening. Reset reuses them.
  const [facts, setFacts] = useState<AiaPrefillFacts | null>(null)
  // The job's saved applications, and which one is open (null = a new one, not saved yet).
  const [saved, setSaved] = useState<SavedPayApplication[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  // The form as it was loaded or last saved: what "you typed something" is measured against.
  const [baseline, setBaseline] = useState<Record<AiaFieldKey, string>>(emptyFormState)
  const [saving, setSaving] = useState(false)
  const confirm = useConfirmDialog()

  const openApp = saved.find((a) => a.id === openId) ?? null
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(baseline), [form, baseline])

  const loadForm = useCallback((values: AiaFieldValues) => {
    const next = fieldValuesToFormState(values)
    setForm(next)
    setBaseline(next)
  }, [])

  /** A new application's starting form: the job today, carried on from the last saved application when there is one. */
  const newApplicationValues = useCallback(
    (list: ReadonlyArray<SavedPayApplication>, withFacts: AiaPrefillFacts | null): AiaFieldValues => {
      if (!job) return {}
      const jobPrefill = buildAiaPrefillFromJob(job, getPhysicalInvoiceIssuerDraft(), withFacts)
      const last = previousPayApplication(list, nextApplicationNumber(list))
      return last ? carryForwardPayApplication(last, jobPrefill) : jobPrefill
    },
    [job],
  )

  useEffect(() => {
    if (!open || !job) return
    let cancelled = false
    void (async () => {
      const [, loadedFacts, list] = await Promise.all([
        fetchPhysicalInvoiceIssuerFromAppSettings({ authRole }),
        loadAiaPrefillFacts(job.id).catch(() => null),
        loadPayApplications(job.id).catch(() => [] as SavedPayApplication[]),
      ])
      if (cancelled) return
      setFacts(loadedFacts)
      setSaved(list)
      setOpenId(null)
      loadForm(newApplicationValues(list, loadedFacts))
    })()
    return () => {
      cancelled = true
    }
  }, [open, job, authRole, loadForm, newApplicationValues])

  const titleId = 'aia-g702-g703-modal-title'

  /** True when nothing typed would be lost, or the person says to leave it. */
  const mayLeave = async (): Promise<boolean> => {
    if (!dirty) return true
    return confirm({
      title: 'Leave without saving?',
      message: 'What you typed on this application is not saved on the job.',
      confirmLabel: 'Leave',
      cancelLabel: 'Stay',
    })
  }

  const requestClose = async () => {
    if (await mayLeave()) onClose()
  }

  const showApplication = async (app: SavedPayApplication | null) => {
    if ((app?.id ?? null) === openId && !dirty) return
    if (!(await mayLeave())) return
    setOpenId(app?.id ?? null)
    loadForm(app ? app.fields : newApplicationValues(saved, facts))
  }

  /** Back to where this application started: the saved one as saved, a new one as the job and the last one give it. */
  const resetForm = () => loadForm(openApp ? openApp.fields : newApplicationValues(saved, facts))

  type SaveOutcome = { saved: SavedPayApplication } | { notSaved: string }

  /** Save the form on the job as its application number. Never throws: the reason comes back as words. */
  const saveOnJob = async (values: AiaFieldValues): Promise<SaveOutcome> => {
    if (!job) return { notSaved: 'No job is open.' }
    const write = payApplicationWriteFromForm(job.id, values)
    if (!write.ok) return { notSaved: write.reason }
    try {
      const row = await savePayApplication(write.row, openId)
      setSaved((list) => sortPayApplications([...list.filter((a) => a.id !== row.id), row]))
      setOpenId(row.id)
      setBaseline(form)
      return { saved: row }
    } catch (e) {
      if (e instanceof PayApplicationNumberTaken) {
        return { notSaved: `Application ${e.applicationNumber} is already saved on this job. Open it from the list, or use another number.` }
      }
      console.error(e)
      return { notSaved: 'The application could not be saved on the job.' }
    }
  }

  const onSave = async () => {
    setSaving(true)
    try {
      const outcome = await saveOnJob(formStateToFieldValues(form))
      if ('saved' in outcome) showToast(`Application ${outcome.saved.applicationNumber} saved on the job.`, 'success')
      else showToast(outcome.notSaved, 'error')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    if (!openApp) return
    const ok = await confirm({
      title: `Delete application ${openApp.applicationNumber}?`,
      message: 'It comes off the job. A later application keeps the previous amounts it was saved with.',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    try {
      await deletePayApplication(openApp.id)
      const rest = saved.filter((a) => a.id !== openApp.id)
      setSaved(rest)
      setOpenId(null)
      loadForm(newApplicationValues(rest, facts))
      showToast(`Application ${openApp.applicationNumber} deleted.`, 'success')
    } catch (e) {
      console.error(e)
      showToast('The application could not be deleted.', 'error')
    }
  }

  const onGenerate = async () => {
    if (!job) return
    setGenerating(true)
    try {
      const values = formStateToFieldValues(form)
      const ab = await fetchAndFillAiaTemplate(AIA_TEMPLATE_PUBLIC_PATH, values)
      const jobNumber = effectiveJobLedgerNumber(hcpForFilename || job.hcp_number, 'click_number' in job ? job.click_number : null)
      triggerDownloadArrayBuffer(ab, aiaDownloadFilename(jobNumber || job.id, values.g702_n5_project))
      // What went out is kept on the job, so the next application can start from it.
      const outcome = await saveOnJob(values)
      if ('saved' in outcome) showToast(`Workbook downloaded. Application ${outcome.saved.applicationNumber} saved on the job.`, 'success')
      else showToast(`Workbook downloaded. Not saved on the job: ${outcome.notSaved}`, 'warning')
    } catch (e) {
      console.error(e)
      showToast(e instanceof Error ? e.message : 'Could not generate workbook.', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const fieldSegments = useMemo(() => buildAiaModalFieldSegments(AIA_FIELD_DEFS), [])

  const showPaper = wide || narrowView === 'preview'

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1006,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))',
      }}
      onClick={() => void requestClose()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') void requestClose()
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          maxWidth: wide ? 1360 : 560,
          width: '100%',
          maxHeight: 'min(90vh, 100%)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          ...(wide
            ? { height: 'min(92vh, 940px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }
            : { overflow: 'auto' }),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          .aia-g702-details-wrap .aia-g702-details-summary::-webkit-details-marker {
            display: none;
          }
          .aia-g702-details-wrap .aia-g702-details-summary {
            list-style: none;
          }
          .aia-g702-details-wrap .aia-g702-details-chevron {
            display: inline-block;
            font-size: 0.55rem;
            line-height: 1;
            transform: rotate(-90deg);
            transition: transform 0.12s ease;
            color: #6b7280;
          }
          .aia-g702-details-wrap[open] .aia-g702-details-chevron {
            transform: rotate(0deg);
          }
        `}</style>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <FileSpreadsheet size={22} color="#16a34a" aria-hidden />
          <h2 id={titleId} style={{ margin: 0, fontSize: '1.125rem', flex: 1 }}>
            AIA G702-G703
          </h2>
          {wide ? null : (
            <div role="group" aria-label="Form or preview" style={{ display: 'flex' }}>
              {(['form', 'preview'] as const).map((view, i) => (
                <button
                  key={view}
                  type="button"
                  aria-pressed={narrowView === view}
                  onClick={() => setNarrowView(view)}
                  style={{
                    padding: '0.3rem 0.7rem',
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    border: '1px solid var(--border-strong)',
                    borderLeft: i === 0 ? '1px solid var(--border-strong)' : 'none',
                    borderRadius: i === 0 ? '4px 0 0 4px' : '0 4px 4px 0',
                    background: narrowView === view ? 'var(--text-strong)' : 'var(--surface)',
                    color: narrowView === view ? 'var(--surface)' : 'var(--text-700)',
                  }}
                >
                  {view === 'form' ? 'Form' : 'Preview'}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => void requestClose()}
            aria-label="Close"
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '1.5rem',
              lineHeight: 1,
              color: 'var(--text-muted)',
              padding: '0.25rem',
            }}
          >
            ×
          </button>
        </div>

        <div style={wide ? { display: 'flex', flex: 1, minHeight: 0 } : undefined}>
        {showPaper ? (
          <div
            data-testid="aia-preview-pane"
            style={{
              background: 'var(--bg-muted)',
              ...(wide ? { flex: 1, minWidth: 0, overflow: 'auto' } : {}),
            }}
          >
            <div
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 1,
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '0.35rem 0.9rem',
                padding: '0.5rem 1rem',
                fontSize: '0.8125rem',
                color: 'var(--text-700)',
                background: 'var(--bg-muted)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <strong>Preview of the download</strong>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ ...swatch, background: 'var(--bg-blue-tint)', borderBottom: '1px solid var(--border-blue)' }} />
                From the form
              </span>
              <span>Plain numbers are the sheet&apos;s math</span>
            </div>
            <div style={{ padding: '1rem' }}>
              <AiaG702G703Paper preview={preview} activeKey={activeKey} onPick={pickField} />
            </div>
          </div>
        ) : null}
        <div
          style={
            wide
              ? {
                  width: 400,
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
                  borderLeft: '1px solid var(--border)',
                }
              : undefined
          }
        >
        <div
          style={{
            padding: '1rem 1.25rem',
            ...(wide ? { flex: 1, minHeight: 0, overflow: 'auto' } : {}),
            ...(!wide && narrowView === 'preview' ? { display: 'none' } : {}),
          }}
        >
          <div data-testid="aia-applications" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.9rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
              APPLICATIONS ON THIS JOB
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {saved.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  aria-pressed={app.id === openId}
                  onClick={() => void showApplication(app)}
                  style={applicationChipStyle(app.id === openId)}
                >
                  {payApplicationLabel(app)}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={openId == null}
                onClick={() => void showApplication(null)}
                style={applicationChipStyle(openId == null)}
              >
                New · {nextApplicationNumber(saved)}
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-600)' }}>
              <span style={{ flex: 1 }}>
                {openApp
                  ? `Application ${openApp.applicationNumber} is saved on the job. You can change it and save it again.`
                  : saved.length > 0
                    ? `A new application. It starts from application ${saved[saved.length - 1]!.applicationNumber}: that work is now previous work.`
                    : 'Nothing is saved on this job yet. Save keeps this application here, and the next one starts from it.'}
              </span>
              {openApp ? (
                <button
                  type="button"
                  onClick={() => void onDelete()}
                  style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-red-700)', textDecoration: 'underline' }}
                >
                  Delete
                </button>
              ) : null}
            </div>
          </div>
          <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-600)' }}>
            Values are written into the G702/G703 workbook. A field left empty is empty in the download. Adjust
            fields, then generate the workbook.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {fieldSegments.map((seg) =>
              seg.type === 'field' ? (
                <Fragment key={seg.def.key}>
                  {seg.def.key === 'g702_n5_project' ? (
                    <h3
                      style={{
                        margin: 0,
                        fontSize: '0.9375rem',
                        fontWeight: 700,
                        color: 'var(--text-strong)',
                        letterSpacing: '0.02em',
                        textAlign: 'center',
                      }}
                    >
                      G702
                    </h3>
                  ) : null}
                  {seg.def.key === 'g703_k2_project' ? (
                    <h3
                      style={{
                        margin: 0,
                        paddingTop: '0.5rem',
                        borderTop: '1px solid var(--border)',
                        fontSize: '0.9375rem',
                        fontWeight: 700,
                        color: 'var(--text-strong)',
                        letterSpacing: '0.02em',
                        textAlign: 'center',
                      }}
                    >
                      G703
                    </h3>
                  ) : null}
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }}>{seg.def.label}</span>
                    {seg.def.kind === 'textarea' ? (
                      <textarea
                        id={`aia-field-${seg.def.key}`}
                        onFocus={() => setActiveKey(seg.def.key)}
                        value={form[seg.def.key]}
                        onChange={(e) => setForm((f) => ({ ...f, [seg.def.key]: e.target.value }))}
                        rows={3}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          fontSize: '0.875rem',
                          padding: '0.5rem',
                          borderRadius: 4,
                          border: '1px solid var(--border-strong)',
                        }}
                      />
                    ) : (
                      <input
                        type="text"
                        inputMode={
                          seg.def.kind === 'number' || seg.def.kind === 'percent' ? 'decimal' : undefined
                        }
                        id={`aia-field-${seg.def.key}`}
                        onFocus={() => setActiveKey(seg.def.key)}
                        value={form[seg.def.key]}
                        onChange={(e) => setForm((f) => ({ ...f, [seg.def.key]: e.target.value }))}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          fontSize: '0.875rem',
                          padding: '0.5rem',
                          borderRadius: 4,
                          border: '1px solid var(--border-strong)',
                        }}
                      />
                    )}
                  </label>
                </Fragment>
              ) : (
                <details
                  key={seg.groupId}
                  className="aia-g702-details-wrap"
                  open={changeOrdersOpen}
                  onToggle={(e) => setChangeOrdersOpen(e.currentTarget.open)}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '0.5rem 0.75rem',
                    background: 'var(--bg-page)',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                  }}
                >
                  <summary
                    className="aia-g702-details-summary"
                    style={{
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: 'var(--text-700)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      width: '100%',
                      boxSizing: 'border-box',
                      textAlign: 'center',
                    }}
                  >
                    <span>{AIA_MODAL_DETAILS_GROUP_SUMMARY[seg.groupId]}</span>
                    <span className="aia-g702-details-chevron" aria-hidden>
                      ▼
                    </span>
                  </summary>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      paddingTop: '0.5rem',
                    }}
                  >
                    {seg.defs.map((def) => (
                      <label
                        key={def.key}
                        style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}
                      >
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }}>
                          {def.label}
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          id={`aia-field-${def.key}`}
                          onFocus={() => setActiveKey(def.key)}
                          value={form[def.key]}
                          onChange={(e) => setForm((f) => ({ ...f, [def.key]: e.target.value }))}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            fontSize: '0.875rem',
                            padding: '0.5rem',
                            borderRadius: 4,
                            border: '1px solid var(--border-strong)',
                            background: 'var(--surface)',
                          }}
                        />
                      </label>
                    ))}
                  </div>
                </details>
              ),
            )}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            justifyContent: 'flex-end',
            padding: '1rem 1.25rem',
            borderTop: '1px solid var(--border)',
          }}
        >
          <button
            type="button"
            onClick={resetForm}
            disabled={!job}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--bg-muted)',
              color: 'var(--text-700)',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              cursor: job ? 'pointer' : 'not-allowed',
              fontSize: '0.875rem',
            }}
          >
            {openApp ? 'Reset to saved' : 'Reset from job'}
          </button>
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saving || generating || !job}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--surface)',
              color: 'var(--text-strong)',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              cursor: saving || generating || !job ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
              opacity: saving || generating || !job ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onGenerate}
            disabled={generating || !job}
            style={{
              padding: '0.5rem 1rem',
              background: '#16a34a',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: generating || !job ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              opacity: generating || !job ? 0.7 : 1,
            }}
          >
            {generating ? 'Generating…' : 'Generate'}
          </button>
        </div>
        </div>
        </div>
      </div>
    </div>
  )
}
