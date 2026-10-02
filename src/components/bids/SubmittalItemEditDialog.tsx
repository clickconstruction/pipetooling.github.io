/**
 * One submittal row's editor (Submittals stage 2b): the status (the seven,
 * including the estimator's superseded / equal / design change), the reason
 * chips and note for an alternate or a design change, the lead time (the
 * presets or typed), and the cut sheet as a file + page range typed from the
 * vendor PDF (stage 3 makes the pages a tap). Save writes the item row.
 *
 * The supply house is the office's own fact — who the part is bought from — so
 * it can be set on any revision, shared or not; the GC's room never shows it.
 *
 * A row with parts (2026-10-01) is edited part by part: each part's house, lead time and stage
 * live on the part, and the row's own house and lead time are read from them.
 *
 * The window is never taller than the screen: the title and the Save row hold still and the
 * fields between them scroll. A centred window taller than the screen cannot be scrolled to its top.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react'

import { needsReason, REASON_LABELS, STATUS_LABELS, type ProductStatus, type ReasonKind } from '../../lib/submittals/productStatus'
import { describeLeadTime, LEAD_TIME_PRESETS, parseLeadTime } from '../../lib/submittals/leadTime'
import { asDecision, asReason, asStatus, formatPages, parsePageRange, type ReviewDecision, type SourceFile, type SubmittalItemRow } from '../../lib/submittals/submittalRevision'
import { DECISION_LABELS } from '../../lib/submittals/reviewDecisions'
import { ENTERED_ON_MIN, enteredOnProblem, enteredSuffix } from '../../lib/submittals/enteredDecisions'
import { initialReviewerPick, reviewerChoiceFrom, reviewerPickBad, type ReviewerChoice, type ReviewerPick } from '../../lib/submittals/reviewerPick'
import type { SubmittalPersonRow } from '../../lib/submittals/submittalRoom'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { ProductStatusChip } from './ProductStatusChip'
import { SubmittalPartsEditor } from './SubmittalPartsEditor'
import { assemblyLine, partLeadTextsBad, partToDraft, rollUpFromParts, splitPartLabel, type PartDraft, type PartLeadTexts, type SubmittalPartRow } from '../../lib/submittals/itemParts'
import { SubmittalReviewerPicker } from './SubmittalReviewerPicker'

/** A decision the office enters on a reviewer's behalf (stage 5b): an existing person on the room, or one not on it yet. */
export type EnteredChoice = {
  decision: ReviewDecision
  note: string
  person: ReviewerChoice
  /** The day of their call (YYYY-MM-DD) when it is not today: an approval that came by email last week. */
  on?: string
  /** On a row with parts (2026-10-01): the parts the call covers; absent = every part the GC sees. */
  partIds?: string[]
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
  /** By hand (v2.4090): the tag and the product, typed on a draft — a row with no pick behind it. */
  tag?: string
  submitted_label?: string | null
  /** The house the part is bought from — on the patch only when the picker was changed. */
  supply_house_id?: string | null
  /** 5b: a call entered from the reviewer's file, on their behalf. */
  entered?: EnteredChoice | null
  /** 5b: take the entered call back off the row. */
  clearDecision?: boolean
  /** The row's parts as the editor left them (2026-10-01); absent when the row has none. */
  parts?: PartDraft[]
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

export function SubmittalItemEditDialog({ item, sourceFiles, people = [], houses = [], parts = [], canEnterDecision = false, canEditProduct = false, focusPartId = null, focusHouse = false, onSave, onClose }: { item: SubmittalItemRow; sourceFiles: SourceFile[]; /** the part a Procure line opened the window on (2026-10-02) */ focusPartId?: string | null; /** a Procure line opened the window on a row with no parts: its house box is scrolled to and ready */ focusHouse?: boolean; /** the row's parts (2026-10-01) */ parts?: ReadonlyArray<SubmittalPartRow>; /** the supply houses to pick from; none hides the picker */ houses?: ReadonlyArray<{ id: string; name: string }>; /** the room's people, for the on-behalf-of picker (5b) */ people?: SubmittalPersonRow[]; /** the revision was shared, so a reviewer's call makes sense */ canEnterDecision?: boolean; /** a draft: the tag and the product can be typed (v2.4090) */ canEditProduct?: boolean; onSave: (patch: SubmittalItemPatch) => void; onClose: () => void }) {
  const [tagText, setTagText] = useState(item.tag)
  const [submittedText, setSubmittedText] = useState(item.submitted_label ?? [item.submitted_manufacturer, item.submitted_model].filter(Boolean).join(' '))
  const [houseId, setHouseId] = useState<string | null>(item.supply_house_id ?? null)
  // 2026-10-01 · the row's parts; null = the row is one product typed as a line.
  const [partDrafts, setPartDrafts] = useState<PartDraft[] | null>(() => (parts.length > 0 ? parts.map(partToDraft) : null))
  const [partLeadTexts, setPartLeadTexts] = useState<PartLeadTexts>({})
  const partsBad = partDrafts != null && partLeadTextsBad(partLeadTexts, partDrafts.length)
  const partsRollUp = partDrafts ? rollUpFromParts(partDrafts.filter((d) => d.label.trim()).map((d, i) => ({ ...d, label: d.label.trim(), sequence_order: i + 1 }))) : null
  const houseChanged = houseId !== (item.supply_house_id ?? null)
  // 5b · a call entered on a reviewer's behalf
  const currentDecision = asDecision(item.review_decision)
  const [enterOpen, setEnterOpen] = useState(false)
  const [enterPick, setEnterPick] = useState<ReviewerPick>(() => initialReviewerPick(people))
  const [enterDecision, setEnterDecision] = useState<ReviewDecision | null>(null)
  const [enterNote, setEnterNote] = useState('')
  const today = todayYmdInAppTz()
  const [enterOn, setEnterOn] = useState(today)
  const [clearDecision, setClearDecision] = useState(false)
  // 2026-10-01 · a call entered on a row with parts covers the parts ticked here; all the GC sees to start.
  const gcParts = parts.filter((p) => p.on_submittal)
  const [enterParts, setEnterParts] = useState<Set<string>>(() => new Set(gcParts.map((p) => p.id)))
  const enterPartsNone = gcParts.length > 0 && enterParts.size === 0
  const enterNewBad = reviewerPickBad(enterPick)
  const enterOnProblem = enteredOnProblem(enterOn, today)
  const enterBad = enterOpen && enterDecision != null && (enterNewBad || enterOnProblem != null || enterPartsNone)
  const partsChosen = gcParts.length > 0 && enterParts.size < gcParts.length ? { partIds: gcParts.filter((p) => enterParts.has(p.id)).map((p) => p.id) } : {}
  const entered: EnteredChoice | null = enterOpen && enterDecision && !enterNewBad && !enterOnProblem && !enterPartsNone ? { decision: enterDecision, note: enterNote, person: reviewerChoiceFrom(enterPick), ...(enterOn && enterOn !== today ? { on: enterOn } : {}), ...partsChosen } : null
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
  const houseRef = useRef<HTMLSelectElement | null>(null)
  // Read once, on open: the window keeps its own place after that.
  const focusHouseOnOpen = useRef(focusHouse)
  useEffect(() => {
    const el = focusHouseOnOpen.current ? houseRef.current : null
    if (!el) return
    el.scrollIntoView?.({ block: 'center' })
    el.focus({ preventScroll: true })
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: Z, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))' }} role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label={`Edit ${item.tag.trim() || 'accessory'}`} style={{ background: 'var(--surface)', borderRadius: 8, maxWidth: partDrafts != null ? 760 : 600, width: '100%', maxHeight: '100%', minHeight: 0, boxShadow: '0 10px 40px rgba(0,0,0,0.2)', padding: '1.1rem 1.25rem 0.9rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }} onMouseDown={(e) => e.stopPropagation()}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-strong)' }}>{title}</h3>
          {canEditProduct ? (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
              <input type="text" aria-label="Tag" placeholder="tag (WC-1)" value={tagText} onChange={(e) => setTagText(e.target.value)} style={{ padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, font: 'inherit', fontSize: '0.8125rem', width: '7rem', background: 'var(--surface)', color: 'var(--text-strong)' }} />
              {partDrafts == null ? <input type="text" aria-label="Submitted product" placeholder="the product you are submitting — make, model, size" value={submittedText} onChange={(e) => setSubmittedText(e.target.value)} style={{ padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, font: 'inherit', fontSize: '0.8125rem', flex: 1, minWidth: '14rem', background: 'var(--surface)', color: 'var(--text-strong)' }} /> : null}
            </div>
          ) : partDrafts == null ? (
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--text-base)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Submitted</span> {item.submitted_label ?? '—'}
            </p>
          ) : null}
          {partDrafts == null && canEditProduct ? (
            <button
              type="button"
              onClick={() => setPartDrafts([{ label: submittedText.trim(), quantity: 1, on_submittal: true, supply_house_id: houseId, lead_time_days: item.lead_time_days, stage: null }])}
              style={{ marginTop: '0.35rem', background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.75rem', color: 'var(--text-link)', textDecoration: 'underline', cursor: 'pointer' }}
              data-testid="list-as-parts"
            >
              List it as parts, each bought on its own
            </button>
          ) : null}
        </div>

        {/* The fields scroll; the title above and the Save row below hold still. */}
        <div data-testid="edit-row-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', margin: '0 -1.25rem', padding: '0.15rem 1.25rem' }}>
        {partDrafts != null ? (
          <SubmittalPartsEditor drafts={partDrafts} onChange={setPartDrafts} leadTexts={partLeadTexts} onLeadTexts={setPartLeadTexts} houses={houses} canEditProduct={canEditProduct} assembly={assemblyLine(parts)} focusId={focusPartId} />
        ) : null}

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

        {houses.length > 0 && partDrafts == null ? (
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span style={fieldLabel}>Supply house · office only</span>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <select ref={houseRef} aria-label="Supply house" value={houseId ?? ''} onChange={(e) => setHouseId(e.target.value || null)} style={{ ...inputStyle, minWidth: '12rem' }}>
                <option value="">No house</option>
                {/* A house the list no longer carries still reads, so opening the row never drops it. */}
                {houseId && !houses.some((h) => h.id === houseId) ? <option value={houseId}>The house on this row</option> : null}
                {houses.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
              <span style={smallMuted}>Who you buy it from. It prints on the procurement log. The GC's room never shows it.</span>
            </div>
          </label>
        ) : null}

        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <span style={fieldLabel}>Note · what the GC will read</span>
          <textarea aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="CT708 discontinued; CT728 is the current replacement…" style={{ ...inputStyle, resize: 'vertical' }} />
        </label>

        {partDrafts != null ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }} data-testid="parts-roll-up">
            <span style={fieldLabel}>Lead time</span>
            <span style={smallMuted}>{partsRollUp?.lead_time_days != null ? `${describeLeadTime(partsRollUp.lead_time_days)}, the longest among the parts the GC sees.` : 'Set on each part above. The row reads the longest.'}</span>
          </div>
        ) : (
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
        )}

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
                <span style={{ ...smallMuted, marginLeft: '0.5rem' }}>This only records their call. Nobody is emailed. The record reads “entered by you”. The room never shows the file.</span>
              </div>
            ) : (
              <>
                <SubmittalReviewerPicker people={people} value={enterPick} onChange={setEnterPick} />
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
                  <label style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    on
                    <input type="date" aria-label="The day of their call" title="The day they made the call. It dates the row and the procurement log's Released." value={enterOn} min={ENTERED_ON_MIN} max={today} onChange={(e) => setEnterOn(e.target.value)} style={{ ...inputStyle, borderColor: enterOnProblem ? '#dc2626' : 'var(--border-strong)' }} />
                  </label>
                  <input aria-label="Their note" placeholder={enterDecision === 'approved' ? 'their note, if any' : 'what they need instead'} value={enterNote} onChange={(e) => setEnterNote(e.target.value)} style={{ padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, font: 'inherit', fontSize: '0.8125rem', flex: 1, minWidth: 180, background: 'var(--surface)', color: 'var(--text-strong)' }} />
                </div>
                {gcParts.length > 1 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }} data-testid="entered-call-parts">
                    <span style={smallMuted}>The parts this call covers</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.75rem' }}>
                      {gcParts.map((p) => (
                        <label key={p.id} style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-base)' }}>
                          <input type="checkbox" checked={enterParts.has(p.id)} onChange={(e) => setEnterParts((cur) => { const next = new Set(cur); if (e.target.checked) next.add(p.id); else next.delete(p.id); return next })} />
                          {splitPartLabel(p.label).head}
                          {p.review_decision ? <span style={smallMuted}> · now {DECISION_LABELS[p.review_decision as ReviewDecision] ?? p.review_decision}</span> : null}
                        </label>
                      ))}
                    </div>
                    {enterPartsNone ? <span style={{ ...smallMuted, color: 'var(--text-amber-700)' }}>Tick at least one part.</span> : null}
                  </div>
                ) : null}
                {enterDecision && enterNewBad ? <span style={{ ...smallMuted, color: 'var(--text-amber-700)' }}>A name and an email, so the record says whose call it is.</span> : null}
                {enterOnProblem ? <span style={{ ...smallMuted, color: 'var(--text-amber-700)' }}>{enterOnProblem}</span> : null}
              </>
            )}
          </div>
        ) : null}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.6rem', flexShrink: 0 }}>
          <ProductStatusChip status={status} size="md" />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={onClose} style={{ padding: '0.45rem 0.85rem', background: 'var(--bg-muted)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit' }}>
              Cancel
            </button>
            <button
              type="button"
              disabled={leadTextBad || pagesBad || enterBad || partsBad}
              onClick={() =>
                onSave({
                  status,
                  reason_kind: askWhy ? reasonKind : null,
                  reason_note: note.trim() || null,
                  lead_time_days: leadText.trim() === '' ? leadDays : parseLeadTime(leadText),
                  sheet_file: file && pages.length > 0 ? sheetFile : null,
                  sheet_pages: file ? pages : [],
                  sheet_source: file && pages.length > 0 ? 'estimator' : null,
                  ...(canEditProduct ? { ...(tagText.trim() !== item.tag.trim() ? { tag: tagText.trim().toUpperCase() } : {}), ...(partDrafts == null ? { submitted_label: submittedText.trim() || null } : {}) } : {}),
                  ...(houseChanged && partDrafts == null ? { supply_house_id: houseId } : {}),
                  ...(partDrafts != null ? { parts: partDrafts } : {}),
                  entered,
                  clearDecision: clearDecision && !entered,
                })
              }
              style={{ padding: '0.45rem 0.9rem', background: leadTextBad || pagesBad || enterBad || partsBad ? 'var(--bg-200)' : '#16a34a', color: leadTextBad || pagesBad || enterBad || partsBad ? 'var(--text-faint)' : 'white', border: 'none', borderRadius: 4, cursor: leadTextBad || pagesBad || enterBad || partsBad ? 'not-allowed' : 'pointer', font: 'inherit', fontWeight: 600 }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
