/**
 * One submittal row's editor (Submittals stage 2b): the status (the seven,
 * including the estimator's superseded / equal / design change), the reason
 * chips and note for an alternate or a design change, the lead time (the
 * presets or typed), and the cut sheet as a file + page range typed from the
 * vendor PDF (stage 3 makes the pages a tap). Save writes the item row.
 */
import { useState, type CSSProperties } from 'react'

import { needsReason, REASON_LABELS, STATUS_LABELS, type ProductStatus, type ReasonKind } from '../../lib/submittals/productStatus'
import { describeLeadTime, LEAD_TIME_PRESETS, parseLeadTime } from '../../lib/submittals/leadTime'
import { asReason, asStatus, formatPages, parsePageRange, type SourceFile, type SubmittalItemRow } from '../../lib/submittals/submittalRevision'
import { ProductStatusChip } from './ProductStatusChip'

const Z = 10060

export type SubmittalItemPatch = {
  status: ProductStatus
  reason_kind: ReasonKind | null
  reason_note: string | null
  lead_time_days: number | null
  sheet_file: number | null
  sheet_pages: number[]
  sheet_source: 'estimator' | null
}

const REASON_CHIP_LABELS: Record<ReasonKind, string> = {
  lead_time: 'Long lead time',
  discontinued: 'Discontinued',
  in_stock: 'In stock',
  equal: 'Or-equal clause',
  cost: 'Cost',
  other: 'Other',
}

const STATUS_ORDER: ProductStatus[] = ['as_specified', 'superseded', 'equal', 'alternate', 'design_change', 'missing', 'accessory']

const chipButton = (on: boolean): CSSProperties => ({
  padding: '0.3rem 0.7rem',
  borderRadius: 999,
  border: on ? '2px solid #16a34a' : '1px solid var(--border-strong)',
  background: on ? 'var(--bg-green-tint)' : 'var(--surface)',
  color: 'var(--text-strong)',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: '0.8125rem',
  fontWeight: on ? 700 : 500,
})
const fieldLabel: CSSProperties = { fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const inputStyle: CSSProperties = { padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, font: 'inherit', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text-strong)' }

export function SubmittalItemEditDialog({ item, sourceFiles, onSave, onClose }: { item: SubmittalItemRow; sourceFiles: SourceFile[]; onSave: (patch: SubmittalItemPatch) => void; onClose: () => void }) {
  const [status, setStatus] = useState<ProductStatus>(asStatus(item.status))
  const [reasonKind, setReasonKind] = useState<ReasonKind | null>(asReason(item.reason_kind))
  const [note, setNote] = useState(item.reason_note ?? '')
  const presetDays = new Set(LEAD_TIME_PRESETS.map((p) => p.days))
  const [leadDays, setLeadDays] = useState<number | null>(item.lead_time_days)
  const [leadText, setLeadText] = useState(item.lead_time_days != null && !presetDays.has(item.lead_time_days) ? (describeLeadTime(item.lead_time_days) ?? '') : '')
  const [sheetFile, setSheetFile] = useState<number | null>(item.sheet_file != null && sourceFiles[item.sheet_file] ? item.sheet_file : sourceFiles.length > 0 && (item.sheet_pages ?? []).length === 0 ? null : item.sheet_file)
  const [pagesText, setPagesText] = useState((item.sheet_pages ?? []).length > 0 ? formatPages(item.sheet_pages).replace(/^p\./, '') : '')
  const leadTextBad = leadText.trim() !== '' && parseLeadTime(leadText) == null
  const file = sheetFile != null ? sourceFiles[sheetFile] ?? null : null
  const pages = file ? parsePageRange(pagesText, file.pages) : []
  const pagesBad = pagesText.trim() !== '' && (file == null || pages.length === 0)
  const askWhy = needsReason(status)
  const title = item.tag.trim() ? `${item.tag} · ${[item.specified_manufacturer, item.specified_model].filter(Boolean).join(' ') || item.specified_description || ''}` : `Accessory · ${item.submitted_label ?? ''}`
  const smallMuted: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: Z, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', overflowY: 'auto' }} role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label={`Edit ${item.tag.trim() || 'accessory'}`} style={{ background: 'var(--surface)', borderRadius: 8, maxWidth: 600, width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', padding: '1.1rem 1.25rem 0.9rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }} onMouseDown={(e) => e.stopPropagation()}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-strong)' }}>{title}</h3>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--text-base)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Submitted</span> {item.submitted_label ?? '—'}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <span style={fieldLabel}>Status</span>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {STATUS_ORDER.map((s) => (
              <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)} style={chipButton(status === s)}>
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {askWhy ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span style={fieldLabel}>Why this product</span>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {(Object.keys(REASON_LABELS) as ReasonKind[]).map((k) => (
                <button key={k} type="button" aria-pressed={reasonKind === k} onClick={() => setReasonKind(reasonKind === k ? null : k)} style={chipButton(reasonKind === k)}>
                  {REASON_CHIP_LABELS[k]}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <span style={fieldLabel}>Note · what the GC will read</span>
          <textarea aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="CT708 discontinued; CT728 is the current replacement…" style={{ ...inputStyle, resize: 'vertical' }} />
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <span style={fieldLabel}>Lead time</span>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {LEAD_TIME_PRESETS.map((p) => {
              const on = leadText.trim() === '' && leadDays === p.days
              return (
                <button key={p.days} type="button" aria-pressed={on} onClick={() => { setLeadText(''); setLeadDays(on ? null : p.days) }} style={chipButton(on)}>
                  {p.label}
                </button>
              )
            })}
            <input type="text" aria-label="Lead time, typed" placeholder="or type it: 3 wk · 10 days" value={leadText} onChange={(e) => { setLeadText(e.target.value); setLeadDays(parseLeadTime(e.target.value)) }} style={{ ...inputStyle, flex: '1 1 9rem', minWidth: '8rem', borderColor: leadTextBad ? '#dc2626' : 'var(--border-strong)' }} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <span style={fieldLabel}>Cut sheet</span>
          {sourceFiles.length === 0 ? (
            <span style={smallMuted}>Drop the vendor's PDF on the tab first; then name the pages here.</span>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <select aria-label="Vendor file" value={sheetFile ?? ''} onChange={(e) => setSheetFile(e.target.value === '' ? null : Number(e.target.value))} style={inputStyle}>
                <option value="">No sheet</option>
                {sourceFiles.map((f, i) => (
                  <option key={f.path} value={i}>
                    {f.name} · {f.pages} page{f.pages === 1 ? '' : 's'}
                  </option>
                ))}
              </select>
              <input type="text" aria-label="Pages" placeholder="pages: 3-4" value={pagesText} disabled={file == null} onChange={(e) => setPagesText(e.target.value)} style={{ ...inputStyle, width: '9rem', borderColor: pagesBad ? '#dc2626' : 'var(--border-strong)' }} />
              <span style={smallMuted}>{file ? (pages.length > 0 ? formatPages(pages) : `1–${file.pages}`) : ''}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.6rem' }}>
          <ProductStatusChip status={status} size="md" />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={onClose} style={{ padding: '0.45rem 0.85rem', background: 'var(--bg-muted)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit' }}>
              Cancel
            </button>
            <button
              type="button"
              disabled={leadTextBad || pagesBad}
              onClick={() =>
                onSave({
                  status,
                  reason_kind: askWhy ? reasonKind : null,
                  reason_note: note.trim() || null,
                  lead_time_days: leadText.trim() === '' ? leadDays : parseLeadTime(leadText),
                  sheet_file: file && pages.length > 0 ? sheetFile : null,
                  sheet_pages: file ? pages : [],
                  sheet_source: file && pages.length > 0 ? 'estimator' : null,
                })
              }
              style={{ padding: '0.45rem 0.9rem', background: leadTextBad || pagesBad ? 'var(--bg-200)' : '#16a34a', color: leadTextBad || pagesBad ? 'var(--text-faint)' : 'white', border: 'none', borderRadius: 4, cursor: leadTextBad || pagesBad ? 'not-allowed' : 'pointer', font: 'inherit', fontWeight: 600 }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
