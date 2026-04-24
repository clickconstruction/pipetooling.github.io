import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
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
  aiaDownloadFilename,
  buildAiaPrefillFromJob,
} from '../../lib/aiaG702G703Template'
import { fetchAndFillAiaTemplate } from '../../lib/fillAiaG702G703Workbook'
import { getPhysicalInvoiceIssuerDraft } from '../../lib/physicalInvoiceIssuer'
import { useToastContext } from '../../contexts/ToastContext'

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
  const { showToast } = useToastContext()
  const [form, setForm] = useState<Record<AiaFieldKey, string>>(emptyFormState)
  const [generating, setGenerating] = useState(false)

  const applyPrefill = useCallback(() => {
    if (!job) return
    const issuer = getPhysicalInvoiceIssuerDraft()
    const pre = buildAiaPrefillFromJob(job, issuer)
    setForm(() => {
      const next = emptyFormState()
      for (const def of AIA_FIELD_DEFS) {
        const v = pre[def.key]
        if (v === undefined || v === '') continue
        next[def.key] = typeof v === 'number' ? String(v) : v
      }
      return next
    })
  }, [job])

  useEffect(() => {
    if (!open || !job) return
    applyPrefill()
  }, [open, job, applyPrefill])

  const titleId = 'aia-g702-g703-modal-title'

  const onGenerate = async () => {
    if (!job) return
    setGenerating(true)
    try {
      const values = formStateToFieldValues(form)
      const ab = await fetchAndFillAiaTemplate(AIA_TEMPLATE_PUBLIC_PATH, values)
      triggerDownloadArrayBuffer(ab, aiaDownloadFilename(hcpForFilename || job.hcp_number || job.id))
      showToast('AIA workbook downloaded.', 'success')
    } catch (e) {
      console.error(e)
      showToast(e instanceof Error ? e.message : 'Could not generate workbook.', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const fieldSegments = useMemo(() => buildAiaModalFieldSegments(AIA_FIELD_DEFS), [])

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
        padding: '1rem',
      }}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          maxWidth: 560,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
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
            borderBottom: '1px solid #e5e7eb',
          }}
        >
          <FileSpreadsheet size={22} color="#16a34a" aria-hidden />
          <h2 id={titleId} style={{ margin: 0, fontSize: '1.125rem', flex: 1 }}>
            AIA G702-G703
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '1.5rem',
              lineHeight: 1,
              color: '#6b7280',
              padding: '0.25rem',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '1rem 1.25rem' }}>
          <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#4b5563' }}>
            Values are written into the Mission Hills G702/G703 template. Adjust fields, then generate the
            workbook.
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
                        color: '#111827',
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
                        borderTop: '1px solid #e5e7eb',
                        fontSize: '0.9375rem',
                        fontWeight: 700,
                        color: '#111827',
                        letterSpacing: '0.02em',
                        textAlign: 'center',
                      }}
                    >
                      G703
                    </h3>
                  ) : null}
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>{seg.def.label}</span>
                    {seg.def.kind === 'textarea' ? (
                      <textarea
                        value={form[seg.def.key]}
                        onChange={(e) => setForm((f) => ({ ...f, [seg.def.key]: e.target.value }))}
                        rows={3}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          fontSize: '0.875rem',
                          padding: '0.5rem',
                          borderRadius: 4,
                          border: '1px solid #d1d5db',
                        }}
                      />
                    ) : (
                      <input
                        type="text"
                        inputMode={
                          seg.def.kind === 'number' || seg.def.kind === 'percent' ? 'decimal' : undefined
                        }
                        value={form[seg.def.key]}
                        onChange={(e) => setForm((f) => ({ ...f, [seg.def.key]: e.target.value }))}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          fontSize: '0.875rem',
                          padding: '0.5rem',
                          borderRadius: 4,
                          border: '1px solid #d1d5db',
                        }}
                      />
                    )}
                  </label>
                </Fragment>
              ) : (
                <details
                  key={seg.groupId}
                  className="aia-g702-details-wrap"
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    padding: '0.5rem 0.75rem',
                    background: '#fafafa',
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
                      color: '#374151',
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
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>
                          {def.label}
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={form[def.key]}
                          onChange={(e) => setForm((f) => ({ ...f, [def.key]: e.target.value }))}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            fontSize: '0.875rem',
                            padding: '0.5rem',
                            borderRadius: 4,
                            border: '1px solid #d1d5db',
                            background: '#fff',
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
            borderTop: '1px solid #e5e7eb',
          }}
        >
          <button
            type="button"
            onClick={applyPrefill}
            disabled={!job}
            style={{
              padding: '0.5rem 1rem',
              background: '#f3f4f6',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              cursor: job ? 'pointer' : 'not-allowed',
              fontSize: '0.875rem',
            }}
          >
            Reset from job
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
  )
}
