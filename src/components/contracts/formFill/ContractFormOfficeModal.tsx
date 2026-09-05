import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../../lib/supabase'
import { PdfPageCanvas } from '../formStudio/PdfPageCanvas'
import { FormFillOverlay } from './FormFillOverlay'
import type { FormBox, FormSchema, FormValues } from '../../../lib/forms/formSchema'
import { acceptDigitsInput, errorsByBox, fillProgress, setOneOfValue, toggleCheckbox } from '../../../lib/forms/formFillState'
import { missingRequired } from '../../../lib/forms/formPaperEntry'
import { OFFICE_ATTESTATION, type PartyRegion } from '../../../lib/forms/formParties'
import { pdfRectToScreen } from '../../../lib/forms/formSchema'
import { useMatchMedia } from '../../../hooks/useMatchMedia'
import { CARD, INK } from '../../../lib/portal/portalTheme'

/**
 * Complete the office section (Contract Forms PR 7). For a two-party form
 * (the I-9), the signer's half is already on the filed PDF; this modal shows
 * that PDF with only the office's boxes over it, a staff member fills them,
 * types the name that signs for the office, and the function flattens the
 * finished document. One-shot: once completed the PDF is final.
 */

type Prepared = {
  schema: FormSchema
  pdfUrl: string
  officeValues: FormValues
  completed: { at: string; by: string | null; printedName: string | null; attestedAt?: string | null } | null
  /** Who signed the signer's half, when, and how (PR 8). */
  signer?: { printedName: string | null; signedAt: string | null; source: string | null }
  /** The signer's regions, shaded as locked (PR 8). */
  signerRegions?: PartyRegion[]
  documentName: string
  personName: string
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const PAGE_WIDTH_PX = 560

export function ContractFormOfficeModal({ documentId, onClose, onCompleted }: { documentId: string; onClose: () => void; onCompleted: () => void }) {
  const [prepared, setPrepared] = useState<Prepared | null>(null)
  const [pdf, setPdf] = useState<ArrayBuffer | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [values, setValues] = useState<FormValues>({})
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const [signerName, setSignerName] = useState('')
  const [attested, setAttested] = useState(false)
  const narrow = useMatchMedia('(max-width: 900px)')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession()
        const jwt = sess.session?.access_token
        if (!jwt) throw new Error('Not signed in.')
        const res = await fetch(`${supabaseUrl}/functions/v1/complete-contract-form-office`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}`, apikey: anonKey },
          body: JSON.stringify({ action: 'prepare', person_contract_document_id: documentId }),
        })
        const j = (await res.json()) as Prepared & { ok?: boolean; error?: string }
        if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`)
        if (cancelled) return
        setPrepared(j)
        setValues(j.officeValues ?? {})
        const { data: me } = await supabase.auth.getUser()
        const myName = (me.user?.user_metadata as { name?: string } | undefined)?.name
        if (myName && !j.completed) setSignerName(myName)
        const pdfRes = await fetch(j.pdfUrl)
        if (!pdfRes.ok) throw new Error(`Could not load the filed PDF (HTTP ${pdfRes.status}).`)
        const bytes = await pdfRes.arrayBuffer()
        if (!cancelled) setPdf(bytes)
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [documentId])

  const schema = prepared?.schema ?? null
  const done = prepared?.completed ?? null
  const pageWidth = schema?.pages[0]?.width ?? 612
  const scale = PAGE_WIDTH_PX / pageWidth
  const pages = useMemo(() => (schema ? schema.pages.map((p, i) => ({ page: p, pageNo: i + 1 })).filter(({ pageNo }) => schema.boxes.some((b) => b.page === pageNo)) : []), [schema])
  const errors = useMemo(() => (schema ? errorsByBox(schema, values) : {}), [schema, values])
  const missing = useMemo(() => (schema ? missingRequired(schema, values) : []), [schema, values])
  const progress = useMemo(() => (schema ? fillProgress(schema, values) : null), [schema, values])
  const todayLabel = useMemo(() => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date()), [])

  const setText = useCallback(
    (box: FormBox, raw: string) => {
      if (!schema || done) return
      if (box.oneOf) setValues((v) => setOneOfValue(schema, v, box.key, raw))
      else setValues((v) => ({ ...v, [box.key]: box.type === 'digits' ? acceptDigitsInput(box, raw) : raw }))
    },
    [schema, done],
  )
  const toggle = useCallback(
    (key: string) => {
      if (!schema || done) return
      setValues((v) => toggleCheckbox(schema, v, key))
    },
    [schema, done],
  )

  const blockers: string[] = []
  if (!signerName.trim()) blockers.push('Type the name that signs for the office.')
  if (Object.keys(errors).length > 0) blockers.push(Object.values(errors)[0]!)
  if (!attested) blockers.push('Tick the attestation.')
  const signedLine = prepared?.signer
    ? `${prepared.signer.source === 'paper' ? 'Keyed from paper' : 'Signed'}${prepared.signer.printedName ? ` by ${prepared.signer.printedName}` : ''}${prepared.signer.signedAt ? ` on ${prepared.signer.signedAt.slice(0, 10)}` : ''}`
    : null
  const isI9 = /I-9/i.test(prepared?.documentName ?? '')

  async function complete() {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const jwt = sess.session?.access_token
      if (!jwt) throw new Error('Not signed in.')
      const res = await fetch(`${supabaseUrl}/functions/v1/complete-contract-form-office`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}`, apikey: anonKey },
        body: JSON.stringify({ action: 'complete', person_contract_document_id: documentId, officeValues: values, office_signer_printed_name: signerName.trim(), attested: true }),
      })
      const j = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`)
      onCompleted()
      onClose()
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Complete the office section" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 17, padding: '1rem' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 10, padding: '1rem 1.15rem 0.9rem', width: 'min(96vw, 1000px)', maxHeight: '94vh', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: '1.125rem' }}>{done ? 'Office section' : 'Complete the office section'}{prepared ? ` — ${prepared.documentName}` : ''}</h3>
          {prepared ? <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>for {prepared.personName}</span> : null}
          <button type="button" onClick={onClose} aria-label="Close" style={{ ...btn, marginLeft: 'auto' }}>
            ✕
          </button>
        </div>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {done
            ? `Completed ${new Date(done.at).toLocaleString()}${done.by ? ` by ${done.by}` : ''}${done.printedName ? `, signed as ${done.printedName}` : ''}${done.attestedAt ? ', attested' : ''}. The PDF is final.`
            : 'The signer’s half is already on the page and locked. Fill the office boxes, tick the attestation, and sign for the office with your typed name. This finishes the PDF; it cannot be edited afterwards.'}
        </p>
        {!done && prepared ? (
          <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {signedLine ? (
              <span>
                Signer&rsquo;s half <strong style={{ color: 'var(--text-strong)' }}>{signedLine}</strong>
              </span>
            ) : null}
            {isI9 ? (
              <span>
                Section 2 <strong style={{ color: 'var(--text-strong)' }}>due within 3 business days of the first day of work</strong>
              </span>
            ) : null}
          </div>
        ) : null}

        {loadError ? (
          <p style={{ margin: 0, color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{loadError}</p>
        ) : !schema || !pdf ? (
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading the filed PDF…</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : `minmax(0, ${PAGE_WIDTH_PX}px) minmax(240px, 1fr)`, gap: '1rem', alignItems: 'start' }}>
            <div>
              <div style={{ overflow: 'auto', maxHeight: '64vh', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-subtle)', padding: '0.5rem' }}>
                {pages.map(({ page, pageNo }, i) => (
                  <div key={pageNo} style={{ position: 'relative', width: page.width * scale, height: page.height * scale, margin: `${i === 0 ? 0 : 10}px auto 0`, boxShadow: '0 1px 4px rgba(0,0,0,.18)', background: CARD }}>
                    <PdfPageCanvas bytes={pdf} page={pageNo} scale={scale} />
                    {(prepared?.signerRegions ?? [])
                      .filter((r) => r.page === pageNo)
                      .map((r, ri) => {
                        const sr = pdfRectToScreen(r.rect, page, scale)
                        return (
                          <div key={ri} aria-hidden style={{ position: 'absolute', left: sr.left, top: sr.top, width: sr.width, height: sr.height, background: 'rgba(22,40,60,0.05)', borderBottom: '1px dashed rgba(22,40,60,0.35)', pointerEvents: 'none' }}>
                            <span style={{ position: 'absolute', right: 8, top: 6, fontSize: 10, fontWeight: 600, color: INK, background: CARD, border: '1px solid rgba(22,40,60,0.25)', borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' }}>{done ? 'Signed by the employee' : 'Signed by the employee · locked'}</span>
                          </div>
                        )
                      })}
                    {done ? null : <FormFillOverlay schema={schema} pageNo={pageNo} scale={scale} values={values} lang="en" focusedKey={focusedKey} errors={errors} todayLabel={todayLabel} signature={signerName.trim() ? { mode: 'type', text: signerName.trim() } : null} onFocus={setFocusedKey} onText={setText} onToggle={toggle} />}
                  </div>
                ))}
              </div>
              {!done && progress ? (
                <p style={{ margin: '0.4rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {progress.done} of {progress.total} office boxes filled{missing.length > 0 ? ` · still required: ${missing.map((m) => m.label).join(', ')}` : ' · every required box has an answer'}
                </p>
              ) : null}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', fontSize: '0.8125rem' }}>
              {!done ? (
                <>
                  <section style={card}>
                    <h4 style={h4}>{isI9 ? 'What you examined' : 'The office boxes'}</h4>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.75rem', lineHeight: 1.45 }}>
                      {isI9 ? 'One List A document, or one from List B and one from List C, exactly as each document reads. ' : 'Type each box as it should appear on the finished form. '}
                      {progress ? `${progress.requiredDone} of ${progress.required} required done.` : ''}
                    </p>
                  </section>
                  <section style={card}>
                    <h4 style={h4}>Signing for the office</h4>
                    <label>
                      <span style={k}>Your name and title, as it should appear</span>
                      <input style={inp} value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="e.g. Robert Douglas, Owner" />
                    </label>
                    <p style={{ margin: '0.4rem 0 0', color: 'var(--text-muted)', fontSize: '0.75rem' }}>Typed in cursive into the office signature box; office date boxes get today&rsquo;s date.</p>
                  </section>
                  <section style={{ ...card, borderColor: 'var(--border-strong)' }}>
                    <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', cursor: 'pointer', fontSize: '0.8125rem', lineHeight: 1.45 }}>
                      <input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)} style={{ marginTop: 3 }} />
                      <span>
                        <strong>I attest, under penalty of perjury,</strong>
                        {OFFICE_ATTESTATION.replace(/^I attest, under penalty of perjury,/, '')}
                      </span>
                    </label>
                    <p style={{ margin: '0.4rem 0 0', color: 'var(--text-muted)', fontSize: '0.75rem' }}>The form&rsquo;s own certification is printed on the page. The button stays off until this is ticked.</p>
                  </section>
                  <div style={{ background: 'var(--bg-subtle)', borderRadius: 6, padding: '0.5rem 0.7rem', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                    Completing flattens the PDF: the signer&rsquo;s answers and yours become page content nobody can edit. Sensitive office boxes, if any, live in the PDF only.
                  </div>
                  {submitError ? (
                    <p role="alert" style={{ margin: 0, color: 'var(--text-red-700)' }}>
                      {submitError}
                    </p>
                  ) : null}
                  {blockers.length > 0 ? <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.75rem' }}>Before completing: {blockers.join(' ')}</p> : null}
                </>
              ) : (
                <section style={card}>
                  <h4 style={h4}>Recorded office answers</h4>
                  {Object.keys(values).length === 0 ? (
                    <p style={{ margin: 0, color: 'var(--text-muted)' }}>None stored on the row.</p>
                  ) : (
                    <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(100px, max-content) 1fr', gap: '0.2rem 0.7rem', margin: 0 }}>
                      {schema.boxes
                        .filter((b) => values[b.key] !== undefined && values[b.key] !== '' && values[b.key] !== false)
                        .sort((a, b) => a.order - b.order)
                        .map((b) => (
                          <div key={b.key} style={{ display: 'contents' }}>
                            <dt style={{ color: 'var(--text-muted)' }}>{b.label || b.key}</dt>
                            <dd style={{ margin: 0 }}>{values[b.key] === true ? 'Yes' : String(values[b.key])}</dd>
                          </div>
                        ))}
                    </dl>
                  )}
                </section>
              )}
            </div>
          </div>
        )}

        {schema && !done ? (
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
            <button type="button" onClick={onClose} disabled={submitting} style={btn}>
              Cancel
            </button>
            <button type="button" onClick={() => void complete()} disabled={submitting || blockers.length > 0} style={{ ...btn, background: 'var(--text-blue-700, #1d4ed8)', color: '#fff', borderColor: 'transparent', fontWeight: 700 }}>
              {submitting ? 'Completing…' : 'Complete and finish the PDF'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

const btn: CSSProperties = { padding: '0.4rem 0.8rem', fontSize: '0.8125rem', fontWeight: 600, border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer', fontFamily: 'inherit' }
const inp: CSSProperties = { boxSizing: 'border-box', width: '100%', padding: '0.4rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem', fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text-strong)', display: 'block', marginTop: '0.2rem' }
const card: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.85rem', background: 'var(--surface)' }
const h4: CSSProperties = { margin: '0 0 0.4rem', fontSize: '0.8125rem' }
const k: CSSProperties = { fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }
