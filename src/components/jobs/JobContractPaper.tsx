/**
 * The paper is the form (the Contract window, PR 2 of 5): the agreement laid out as the customer
 * will see it — letterhead, heading, the work, the price and payment line, the terms, the
 * signature frames — and edited in place. Hover a line and it says it edits; press it and the
 * editor opens where the text was; blur or Enter keeps it. Empty things are ghost lines
 * (*+ not included…*) that become fields only when pressed. The amount stays the job's number
 * with its door; the terms stay the Contract Book's with Read and Edit. Locked (out for
 * signature, or signed) the same paper renders read-only. Presentational: the window owns state.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { ContractBodyDisplay } from '../contracts/ContractBodyDisplay'
import { formatContractMoney, jobContractHeading, PAYMENT_TERMS_PRESETS, paymentTermsSentence, type JobContractFields, type JobContractIssuer, type PaymentTermsKey } from '../../lib/jobs/jobContractDocument'
import { contractAmountDoorLabel, contractAmountSourceLabel, type ContractAmountSource } from '../../lib/jobs/contractAmountSource'

export type JobContractPaperProps = {
  job: Pick<JobWithDetails, 'job_address' | 'job_name' | 'customer_name'>
  jobNumber: string
  issuer: JobContractIssuer | null
  brandImageUrl?: string | null
  dateLabel: string
  revision: number
  editable: boolean
  fields: JobContractFields
  setField: <K extends keyof JobContractFields>(key: K, value: JobContractFields[K]) => void
  scopeText: string
  applyScopeText: (text: string) => void
  recipientName: string
  setRecipientName: (v: string) => void
  /** v2.3707: the job's number and its source; the draft's own number only ever shows up as a drift line. */
  amount: {
    src: ContractAmountSource
    /** The frozen number on a sent or signed row. */
    frozenCents: number | null
    drift: { draftCents: number | null } | null
    onOpenJob: (() => void) | null
    onUseJobAmount: () => void
  }
  terms: {
    name: string
    clauseCount: number
    versionLabel: string | null
    bodyHtml: string
    bodyFormat: string
    open: boolean
    onToggle: () => void
    /** The office may edit this document (a Contract Book document, on a draft). */
    onEdit: (() => void) | null
    /** Built-in wording: the sentence that says how to make it the office's. */
    builtInNote: string | null
  }
  signature: { printedName: string; auditLine: string } | null
}

const INK = 'var(--text-strong)'
const INK_2 = 'var(--text-700)'
const INK_3 = 'var(--text-muted)'
const BRAND = '#c2410c'
const BRAND_2 = '#7c2d12'
const RULE = 'var(--border-rule)'
const EDIT_BG = '#f4f7ff'
const EDIT_LINE = '#93a7f0'
const EDIT_INK = '#2b3f9e'

const paper: CSSProperties = { background: 'var(--surface)', color: INK, borderRadius: 10, padding: 'clamp(0.9rem, 3vw, 1.4rem) clamp(0.9rem, 3vw, 1.5rem) 1.4rem', font: '13px/1.5 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', boxShadow: '0 4px 24px rgba(0,0,0,0.18)', border: `1px solid ${RULE}`, minWidth: 0 }
const h2: CSSProperties = { font: '700 10px/1 -apple-system, "Segoe UI", Roboto, sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase', color: BRAND, margin: '18px 0 6px' }
const kv: CSSProperties = { color: 'var(--text-600)', fontSize: 12 }
const ghost: CSSProperties = { color: 'var(--text-faint)', fontStyle: 'italic', fontSize: 11.5, background: 'none', border: 'none', padding: '1px 2px', font: 'inherit', cursor: 'pointer', textAlign: 'left', borderRadius: 4 }
const editorInput: CSSProperties = { width: '100%', boxSizing: 'border-box', font: 'inherit', fontSize: 13, color: INK, background: EDIT_BG, border: `1px solid ${EDIT_LINE}`, borderRadius: 4, padding: '3px 6px' }
const chipBtn = (on: boolean): CSSProperties => ({ border: `1px solid ${on ? '#7b96f7' : '#cdd5e3'}`, borderRadius: 999, padding: '2px 9px', font: 'inherit', fontSize: 11, fontWeight: 600, color: on ? EDIT_INK : INK_2, background: on ? '#e6ecff' : 'var(--surface)', cursor: 'pointer' })
const linkBtn: CSSProperties = { background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: 11, color: '#4f63c4', textDecoration: 'underline', cursor: 'pointer' }

/** A line of the paper that edits in place: the view is a button (hover says it edits); pressed, the editor takes its place. */
function Editable({ editable, editing, onOpen, title, testId, children, editor }: { editable: boolean; editing: boolean; onOpen: () => void; title: string; testId: string; children: ReactNode; editor: ReactNode }) {
  const [hover, setHover] = useState(false)
  if (!editable) return <div data-testid={testId}>{children}</div>
  if (editing) return <div data-testid={`${testId}-editor`}>{editor}</div>
  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={title}
      data-testid={testId}
      style={{ display: 'block', width: '100%', textAlign: 'left', background: hover ? EDIT_BG : 'transparent', border: 'none', borderRadius: 4, outline: hover ? `1px dashed ${EDIT_LINE}` : '1px dashed transparent', outlineOffset: 3, padding: 0, margin: 0, font: 'inherit', color: 'inherit', cursor: 'text', position: 'relative' }}
    >
      {children}
      {hover ? <span aria-hidden style={{ position: 'absolute', right: -18, top: 0, fontSize: 11, color: '#6b7fd1' }}>✎</span> : null}
    </button>
  )
}

function useAutoFocus<T extends HTMLElement>(on: boolean) {
  const ref = useRef<T | null>(null)
  useEffect(() => {
    if (on) ref.current?.focus()
  }, [on])
  return ref
}

function TextLine({ editable, value, onChange, label, ghostLabel, prefix, testId, style }: { editable: boolean; value: string; onChange: (v: string) => void; label: string; ghostLabel: string; prefix?: string; testId: string; style?: CSSProperties }) {
  const [editing, setEditing] = useState(false)
  const ref = useAutoFocus<HTMLInputElement>(editing)
  const trimmed = value.trim()
  if (!editable && !trimmed) return null
  return (
    <Editable
      editable={editable}
      editing={editing}
      onOpen={() => setEditing(true)}
      title={`Edit — ${label}`}
      testId={testId}
      editor={
        <input
          ref={ref}
          style={editorInput}
          value={value}
          aria-label={label}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') setEditing(false)
          }}
        />
      }
    >
      {trimmed ? (
        <span style={style}>
          {prefix ?? ''}
          {trimmed}
        </span>
      ) : (
        <span style={ghost}>{ghostLabel}</span>
      )}
    </Editable>
  )
}

export default function JobContractPaper(p: JobContractPaperProps) {
  const [scopeEditing, setScopeEditing] = useState(false)
  const [payEditing, setPayEditing] = useState(false)
  const [datesEditing, setDatesEditing] = useState(false)
  const [nameEditing, setNameEditing] = useState(false)
  const scopeRef = useAutoFocus<HTMLTextAreaElement>(scopeEditing)
  const nameRef = useAutoFocus<HTMLInputElement>(nameEditing)
  const f = p.fields
  const scope = f.scope_lines.map((l) => l.trim()).filter(Boolean)
  const amountCents = p.editable ? p.amount.src.cents : p.amount.frozenCents
  const dates = [f.start_date ? `Start: ${f.start_date}` : '', f.completion_date ? `Estimated completion: ${f.completion_date}` : ''].filter(Boolean).join(' · ')
  const issuer = p.issuer

  return (
    <div data-theme="light" style={paper} data-testid="contract-paper">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', borderBottom: `2px solid ${BRAND}`, paddingBottom: 9 }}>
        <div style={{ fontWeight: 700, color: BRAND_2, fontSize: 14 }}>
          {issuer?.companyName || 'Contractor'}
          <div style={{ fontWeight: 400, color: 'var(--text-600)', fontSize: 11, whiteSpace: 'pre-line' }}>{[issuer?.addressText, issuer?.phone, issuer?.email].filter(Boolean).join('\n')}</div>
        </div>
        {p.brandImageUrl ? <img src={p.brandImageUrl} alt="" style={{ maxWidth: 140, maxHeight: 56 }} /> : null}
      </div>

      <h1 style={{ font: '700 19px/1.2 -apple-system, "Segoe UI", Roboto, sans-serif', margin: '14px 0 3px', color: INK }}>{jobContractHeading(p.job)}</h1>
      <div style={{ ...kv, display: 'flex', flexWrap: 'wrap', gap: '0 4px', alignItems: 'baseline' }}>
        <span>
          Job <b style={{ color: INK }}>#{p.jobNumber}</b> · for{' '}
        </span>
        {p.editable ? (
          nameEditing ? (
            <input ref={nameRef} style={{ ...editorInput, width: 'auto', minWidth: 160, fontSize: 12 }} value={p.recipientName} aria-label="Signer's name" onChange={(e) => p.setRecipientName(e.target.value)} onBlur={() => setNameEditing(false)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setNameEditing(false) }} data-testid="paper-name-editor" />
          ) : (
            <button type="button" onClick={() => setNameEditing(true)} title="Edit — the signer's name" data-testid="paper-name" style={{ background: 'none', border: 'none', borderBottom: `1px dashed ${EDIT_LINE}`, padding: 0, font: 'inherit', fontSize: 12, fontWeight: 700, color: INK, cursor: 'text' }}>
              {p.recipientName.trim() || p.job.customer_name || 'Customer'}
            </button>
          )
        ) : (
          <b style={{ color: INK }}>{p.recipientName.trim() || p.job.customer_name || 'Customer'}</b>
        )}
        <span>
          {' '}· {p.dateLabel}
          {p.revision > 1 ? ` · rev ${p.revision}` : ''}
        </span>
      </div>
      {p.job.job_address ? <div style={kv}>Property: {p.job.job_address}</div> : null}
      <div style={{ marginTop: 8 }}>
        <TextLine editable={p.editable} value={f.note} onChange={(v) => p.setField('note', v)} label="A line the customer reads before the work" ghostLabel="+ a line the customer reads before the work" testId="paper-note" style={{ fontSize: 13 }} />
      </div>

      <h2 style={h2}>Work we&apos;ll do</h2>
      <Editable
        editable={p.editable}
        editing={scopeEditing}
        onOpen={() => setScopeEditing(true)}
        title="Edit — one line per item, in the customer's words"
        testId="paper-scope"
        editor={
          <div style={{ display: 'grid', gap: 4 }}>
            <textarea ref={scopeRef} style={{ ...editorInput, minHeight: 84, resize: 'vertical', lineHeight: 1.45 }} value={p.scopeText} aria-label="Work we'll do — one line per item" onChange={(e) => p.applyScopeText(e.target.value)} onBlur={() => setScopeEditing(false)} data-testid="paper-scope-textarea" />
            <span style={{ fontSize: 11, color: INK_3 }}>One line per item. Click away to keep it.</span>
          </div>
        }
      >
        {scope.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {scope.map((l, i) => (
              <li key={i} style={{ margin: '2px 0' }}>{l}</li>
            ))}
          </ul>
        ) : (
          <span style={p.editable ? ghost : { ...kv }}>{p.editable ? '+ what we will do, one line per item' : 'Scope as discussed.'}</span>
        )}
      </Editable>
      <div style={{ display: 'grid', gap: 2, marginTop: 6 }}>
        <TextLine editable={p.editable} value={f.exclusions} onChange={(v) => p.setField('exclusions', v)} label="Not included" ghostLabel="+ not included: drywall repair, painting, permits by others…" prefix="Not included: " testId="paper-exclusions" style={{ ...kv }} />
        <Editable
          editable={p.editable}
          editing={datesEditing}
          onOpen={() => setDatesEditing(true)}
          title="Edit — the start and the estimated completion"
          testId="paper-dates"
          editor={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="date" style={{ ...editorInput, width: 'auto' }} value={f.start_date ?? ''} aria-label="Start date" onChange={(e) => p.setField('start_date', e.target.value || null)} />
              <span style={kv}>to</span>
              <input type="date" style={{ ...editorInput, width: 'auto' }} value={f.completion_date ?? ''} aria-label="Estimated completion date" onChange={(e) => p.setField('completion_date', e.target.value || null)} />
              <button type="button" style={linkBtn} onClick={() => setDatesEditing(false)}>
                Done
              </button>
            </div>
          }
        >
          {dates ? <span style={kv}>{dates}</span> : p.editable ? <span style={ghost}>+ start and estimated completion</span> : null}
        </Editable>
      </div>

      <h2 style={h2}>Price &amp; payment</h2>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', fontWeight: 700, fontSize: 15, borderTop: `1px solid ${RULE}`, paddingTop: 7, marginTop: 6, flexWrap: 'wrap' }} data-testid="contract-amount">
        <span>Contract amount</span>
        <span style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span style={{ fontVariantNumeric: 'tabular-nums', ...(amountCents == null ? { color: INK_3, fontWeight: 600, fontSize: 13 } : {}) }} data-testid="contract-amount-value">
            {amountCents != null ? formatContractMoney(amountCents) : p.editable ? 'No amount' : 'Billed at completion (time and materials)'}
          </span>
          {p.editable ? (
            <span style={{ fontSize: 11, fontWeight: 400, color: INK_3 }}>
              {contractAmountSourceLabel(p.amount.src, (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))}
              {' · '}
              {p.amount.onOpenJob ? (
                <button type="button" style={linkBtn} onClick={p.amount.onOpenJob} data-testid="contract-amount-door">
                  {contractAmountDoorLabel(p.amount.src)}
                </button>
              ) : (
                <span>change it on the job</span>
              )}
            </span>
          ) : null}
        </span>
      </div>
      {p.editable && p.amount.drift ? (
        <div style={{ display: 'flex', gap: '4px 10px', alignItems: 'center', flexWrap: 'wrap', marginTop: 6, padding: '5px 8px', borderRadius: 6, background: '#fff7e6', border: '1px solid #f3d9a4', color: '#7a4b00', fontSize: 11.5 }} data-testid="contract-amount-drift">
          <span>
            This draft still says <b>{p.amount.drift.draftCents != null ? formatContractMoney(p.amount.drift.draftCents) : 'time and materials'}</b>, typed before the number came from the job.
          </span>
          <button type="button" style={{ ...chipBtn(false), borderColor: '#f3d9a4', color: '#7a4b00' }} onClick={p.amount.onUseJobAmount} data-testid="contract-amount-use-job">
            Use the job&apos;s {p.amount.src.cents != null ? formatContractMoney(p.amount.src.cents) : 'no amount'}
          </button>
        </div>
      ) : null}
      <div style={{ marginTop: 6 }}>
        <Editable
          editable={p.editable}
          editing={payEditing}
          onOpen={() => setPayEditing(true)}
          title="Edit — pick the payment line"
          testId="paper-payment"
          editor={
            <div style={{ display: 'grid', gap: 6 }} data-testid="paper-payment-chips">
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {PAYMENT_TERMS_PRESETS.map((preset) => (
                  <button key={preset.key} type="button" style={chipBtn(f.payment_terms_key === preset.key)} aria-pressed={f.payment_terms_key === preset.key} onClick={() => p.setField('payment_terms_key', preset.key as PaymentTermsKey)}>
                    {preset.label}
                  </button>
                ))}
              </div>
              {f.payment_terms_key === 'custom' ? <input style={editorInput} value={f.payment_terms_text} aria-label="Payment terms" placeholder="Describe the payment terms" onChange={(e) => p.setField('payment_terms_text', e.target.value)} /> : null}
              <span style={{ ...kv, color: INK_2 }}>{paymentTermsSentence({ ...f, amount_cents: amountCents })}</span>
              <button type="button" style={{ ...linkBtn, justifySelf: 'start' }} onClick={() => setPayEditing(false)}>
                Done
              </button>
            </div>
          }
        >
          <span style={{ ...kv, color: INK_2 }}>{paymentTermsSentence({ ...f, amount_cents: amountCents })}</span>
        </Editable>
      </div>

      <h2 style={{ ...h2, display: 'flex', gap: '4px 8px', alignItems: 'baseline', flexWrap: 'wrap' }} data-testid="contract-terms-row">
        <span>Terms · {p.terms.name}</span>
        <span style={{ font: '400 11px/1.4 -apple-system, "Segoe UI", Roboto, sans-serif', letterSpacing: 0, textTransform: 'none', color: INK_3 }}>
          {p.terms.clauseCount > 0 ? `${p.terms.clauseCount} clauses · ` : ''}
          {p.terms.versionLabel ? `updated ${p.terms.versionLabel} · ` : ''}
          <button type="button" style={linkBtn} onClick={p.terms.onToggle} aria-expanded={p.terms.open} data-testid="contract-terms-read">
            {p.terms.open ? 'collapse' : 'read all'}
          </button>
          {p.terms.onEdit ? (
            <>
              {' · '}
              <button type="button" style={linkBtn} onClick={p.terms.onEdit} data-testid="contract-terms-edit">
                edit the wording
              </button>
            </>
          ) : null}
        </span>
      </h2>
      {p.terms.builtInNote ? <div style={{ ...kv, fontSize: 11, marginBottom: 4 }}>{p.terms.builtInNote}</div> : null}
      <div style={{ position: 'relative', maxHeight: p.terms.open ? undefined : 118, overflow: 'hidden' }}>
        <ContractBodyDisplay format={p.terms.bodyFormat} bodyHtml={p.terms.bodyHtml} scrollStyles={{ fontSize: 11.5, color: 'var(--text-gray-800)', lineHeight: 1.5 }} />
        {!p.terms.open ? <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 44, background: 'linear-gradient(rgba(255,255,255,0), var(--surface))' }} /> : null}
      </div>

      <div style={{ marginTop: 22, borderTop: `1px solid ${RULE}`, paddingTop: 12 }} data-testid="paper-signature">
        {p.signature ? (
          <div style={{ fontSize: 12, color: INK_2 }}>
            <b style={{ color: INK }}>✍ {p.signature.printedName}</b>
            <div style={{ fontSize: 11, color: INK_3 }}>{p.signature.auditLine}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', border: `1.5px dashed ${BRAND}`, borderRadius: 6, padding: '14px 18px 10px', minWidth: 200, color: 'var(--text-faint)', fontSize: 12 }}>
              <span style={{ position: 'absolute', top: -8, left: 10, background: 'var(--surface)', padding: '0 6px', font: '700 9px/1 -apple-system, sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase', color: BRAND }}>Customer</span>
              {p.recipientName.trim() || p.job.customer_name || 'The customer'} signs here
              <div style={{ fontSize: 11 }}>☐ I agree to sign electronically.</div>
            </div>
            {issuer?.licenseLine || issuer?.companyName ? (
              <div style={{ position: 'relative', border: `1.5px solid ${RULE}`, borderRadius: 6, padding: '14px 18px 10px', minWidth: 200, color: 'var(--text-600)', fontSize: 12 }}>
                <span style={{ position: 'absolute', top: -8, left: 10, background: 'var(--surface)', padding: '0 6px', font: '700 9px/1 -apple-system, sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase', color: INK_3 }}>Contractor</span>
                {issuer.licenseLine || issuer.companyName}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
