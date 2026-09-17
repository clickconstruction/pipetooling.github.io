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
import { asDecision, asReason, asStatus, formatPages, parsePageRange, type ReviewDecision, type SourceFile, type SubmittalItemRow } from '../../lib/submittals/submittalRevision'
import { DECISION_LABELS } from '../../lib/submittals/reviewDecisions'
import { enteredSuffix } from '../../lib/submittals/enteredDecisions'
import { ROOM_ROLE_LABELS, ROOM_ROLES, type RoomRole } from '../../../supabase/functions/_shared/submittalRoomPayload'
import type { SubmittalPersonRow } from '../../lib/submittals/submittalRoom'
import { ProductStatusChip } from './ProductStatusChip'

/** A decision the office enters on a reviewer's behalf (stage 5b): an existing person on the room, or one not on it yet. */
export type EnteredChoice = {
  decision: ReviewDecision
  note: string
  person: { id: string } | { name: string; email: string; role: RoomRole }
}

const Z = 10060

export type SubmittalItemPatch = {
  status: ProductStatus
  reason_kind: ReasonKind | null
  reason_note: string | null
  lead_time_days: number | null
  sheet_file: number | null
  sheet_pages: number[]
  sheet_source: 'estimator' | null
  /** 5b: a call entered from the reviewer's file, on their behalf. */
  entered?: EnteredChoice | null
  /** 5b: take the entered call back off the row. */
  clearDecision?: boolean
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

export function SubmittalItemEditDialog({ item, sourceFiles, people = [], canEnterDecision = false, onSave, onClose }: { item: SubmittalItemRow; sourceFiles: SourceFile[]; /** the room's people, for the on-behalf-of picker (5b) */ people?: SubmittalPersonRow[]; /** the revision was shared, so a reviewer's call makes sense */ canEnterDecision?: boolean; onSave: (patch: SubmittalItemPatch) => void; onClose: () => void }) {
  // 5b · a call entered on a reviewer's behalf
  const currentDecision = asDecision(item.review_decision)
  const [enterOpen, setEnterOpen] = useState(false)
  const [enterPerson, setEnterPerson] = useState<string>(people.find((p) => !p.closed_at && p.may_decide)?.id ?? people[0]?.id ?? 'new')
  const [enterName, setEnterName] = useState('')
  const [enterEmail, setEnterEmail] = useState('')
  const [enterRole, setEnterRole] = useState<RoomRole>('architect')
  const [enterDecision, setEnterDecision] = useState<ReviewDecision | null>(null)
  const [enterNote, setEnterNote] = useState('')
  const [clearDecision, setClearDecision] = useState(false)
  const enterNewBad = enterPerson === 'new' && !(enterName.trim() && /\S+@\S+\.\S+/.test(enterEmail.trim()))
  const enterBad = enterOpen && enterDecision != null && enterNewBad
  const entered: EnteredChoice | null = enterOpen && enterDecision && !enterNewBad ? { decision: enterDecision, note: enterNote, person: enterPerson === 'new' ? { name: enterName.trim(), email: enterEmail.trim(), role: enterRole } : { id: enterPerson } } : null
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

        {canEnterDecision ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid var(--border)', paddingTop: '0.6rem' }} data-testid="entered-call">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={fieldLabel}>Their call · on behalf of a reviewer</span>
              {currentDecision ? (
                <span style={smallMuted}>
                  now: <b style={{ color: 'var(--text-strong)' }}>{DECISION_LABELS[currentDecision]}</b>{item.reviewed_by_name ? ` · ${item.reviewed_by_name}` : ''}{enteredSuffix(item) ? ` · ${enteredSuffix(item)}` : ''}
                  {item.decision_source === 'entered' || item.decision_source === 'robot' ? (
                    <>
                      {' · '}
                      <button type="button" aria-pressed={clearDecision} onClick={() => setClearDecision((v) => !v)} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.75rem', color: clearDecision ? 'var(--text-red-700)' : 'var(--text-link)', cursor: 'pointer', textDecoration: 'underline dotted' }}>
                        {clearDecision ? 'will be cleared on Save' : 'clear it'}
                      </button>
                    </>
                  ) : null}
                </span>
              ) : null}
            </div>
            {!enterOpen ? (
              <div>
                <button type="button" onClick={() => setEnterOpen(true)} style={{ background: 'none', border: '1px dashed var(--border-strong)', borderRadius: 4, padding: '0.3rem 0.6rem', font: 'inherit', fontSize: '0.8125rem', color: 'var(--text-base)', cursor: 'pointer' }} data-testid="enter-call-open">
                  Enter a call from their PDF or email
                </button>
                <span style={{ ...smallMuted, marginLeft: '0.5rem' }}>The record reads “entered by you”; the room never shows the file.</span>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <select aria-label="Whose call" value={enterPerson} onChange={(e) => setEnterPerson(e.target.value)} style={{ padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, font: 'inherit', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text-strong)' }}>
                    {people.filter((p) => !p.closed_at).map((p) => (
                      <option key={p.id} value={p.id}>{p.name} · {ROOM_ROLE_LABELS[(p.role as RoomRole) ?? 'other'] ?? p.role}</option>
                    ))}
                    <option value="new">a reviewer not on the room…</option>
                  </select>
                  {enterPerson === 'new' ? (
                    <>
                      <input aria-label="Reviewer name" placeholder="Name" value={enterName} onChange={(e) => setEnterName(e.target.value)} style={{ padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, font: 'inherit', fontSize: '0.8125rem', flex: 1, minWidth: 120, background: 'var(--surface)', color: 'var(--text-strong)' }} />
                      <input aria-label="Reviewer email" placeholder="email" type="email" value={enterEmail} onChange={(e) => setEnterEmail(e.target.value)} style={{ padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, font: 'inherit', fontSize: '0.8125rem', flex: 1.4, minWidth: 160, background: 'var(--surface)', color: 'var(--text-strong)' }} />
                      <select aria-label="Reviewer role" value={enterRole} onChange={(e) => setEnterRole(e.target.value as RoomRole)} style={{ padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, font: 'inherit', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text-strong)' }}>
                        {ROOM_ROLES.map((r) => <option key={r} value={r}>{ROOM_ROLE_LABELS[r]}</option>)}
                      </select>
                    </>
                  ) : null}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden' }} role="group" aria-label="The call">
                    {(['approved', 'revise', 'rejected'] as const).map((d) => {
                      const on = enterDecision === d
                      return (
                        <button key={d} type="button" aria-pressed={on} onClick={() => setEnterDecision(on ? null : d)} style={{ padding: '0.35rem 0.75rem', border: 'none', font: 'inherit', fontSize: '0.8125rem', fontWeight: on ? 700 : 500, cursor: 'pointer', background: on ? (d === 'approved' ? '#1f7a3a' : d === 'revise' ? '#b0662f' : '#b42318') : 'var(--surface)', color: on ? 'white' : 'var(--text-muted)' }}>
                          {DECISION_LABELS[d]}
                        </button>
                      )
                    })}
                  </div>
                  <input aria-label="Their note" placeholder={enterDecision === 'approved' ? 'their note, if any' : 'what they need instead'} value={enterNote} onChange={(e) => setEnterNote(e.target.value)} style={{ padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, font: 'inherit', fontSize: '0.8125rem', flex: 1, minWidth: 180, background: 'var(--surface)', color: 'var(--text-strong)' }} />
                </div>
                {enterDecision && enterNewBad ? <span style={{ ...smallMuted, color: 'var(--text-amber-700)' }}>A name and an email, so the record says whose call it is.</span> : null}
              </>
            )}
          </div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.6rem' }}>
          <ProductStatusChip status={status} size="md" />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={onClose} style={{ padding: '0.45rem 0.85rem', background: 'var(--bg-muted)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit' }}>
              Cancel
            </button>
            <button
              type="button"
              disabled={leadTextBad || pagesBad || enterBad}
              onClick={() =>
                onSave({
                  status,
                  reason_kind: askWhy ? reasonKind : null,
                  reason_note: note.trim() || null,
                  lead_time_days: leadText.trim() === '' ? leadDays : parseLeadTime(leadText),
                  sheet_file: file && pages.length > 0 ? sheetFile : null,
                  sheet_pages: file ? pages : [],
                  sheet_source: file && pages.length > 0 ? 'estimator' : null,
                  entered,
                  clearDecision: clearDecision && !entered,
                })
              }
              style={{ padding: '0.45rem 0.9rem', background: leadTextBad || pagesBad || enterBad ? 'var(--bg-200)' : '#16a34a', color: leadTextBad || pagesBad || enterBad ? 'var(--text-faint)' : 'white', border: 'none', borderRadius: 4, cursor: leadTextBad || pagesBad || enterBad ? 'not-allowed' : 'pointer', font: 'inherit', fontWeight: 600 }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
