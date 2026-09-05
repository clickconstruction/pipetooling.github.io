import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { supabase } from '../../../lib/supabase'
import { PdfPageCanvas } from '../formStudio/PdfPageCanvas'
import { FormFillOverlay } from './FormFillOverlay'
import { schemaForParty, type FormBox, type FormSchema, type FormValues } from '../../../lib/forms/formSchema'
import { acceptDigitsInput, errorsByBox, fillProgress, setOneOfValue, toggleCheckbox } from '../../../lib/forms/formFillState'
import { buildPaperEntryRequest, checkScanFile, missingRequired, paperEntryBlockers } from '../../../lib/forms/formPaperEntry'
import { todayYmdInAppTz } from '../../../utils/dateUtils'
import { CARD } from '../../../lib/portal/portalTheme'

/**
 * Enter from paper (Contract Forms PR 6). A staff member keys a sub's
 * handwritten form into the same boxes the sub would have filled on the
 * signing page, attaches the scan, records who signed the paper and when,
 * and files it as signed on paper. Reuses the signer's overlay; the rail
 * replaces the signature pad.
 */

export type PaperEntryFormChoice = { bookEntryId: string; documentName: string }

type Prepared = { schema: FormSchema; templateUrl: string; documentName: string; docType: string; revisionLabel: string }

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const PAGE_WIDTH_PX = 560

export function ContractFormPaperEntryModal({ personName, personId, forms, onClose, onFiled }: { personName: string; personId: string | null; forms: PaperEntryFormChoice[]; onClose: () => void; onFiled: () => void }) {
  const [choice, setChoice] = useState<PaperEntryFormChoice | null>(forms.length === 1 ? forms[0]! : null)
  const [prepared, setPrepared] = useState<Prepared | null>(null)
  const [pdf, setPdf] = useState<ArrayBuffer | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [values, setValues] = useState<FormValues>({})
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const [scan, setScan] = useState<{ file: File; base64: string } | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [signerName, setSignerName] = useState('')
  const [signedOn, setSignedOn] = useState(() => todayYmdInAppTz())
  const [attested, setAttested] = useState(false)
  const [submitting, setSubmitting] = useState<'file' | 'skip' | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!choice) return
    let cancelled = false
    setPrepared(null)
    setPdf(null)
    setLoadError(null)
    void (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession()
        const jwt = sess.session?.access_token
        if (!jwt) throw new Error('Not signed in.')
        const res = await fetch(`${supabaseUrl}/functions/v1/contract-form-paper-entry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}`, apikey: anonKey },
          body: JSON.stringify({ action: 'prepare', book_entry_id: choice.bookEntryId }),
        })
        const j = (await res.json()) as Prepared & { ok?: boolean; error?: string }
        if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`)
        if (cancelled) return
        // Two-party forms: the paper carries the signer's half; the office section is completed from the record.
        setPrepared({ ...j, schema: schemaForParty(j.schema, 'signer') })
        // Roster prefill the way the signer gets it: the name box.
        const nameBox = j.schema.boxes.find((b) => b.prefill === 'person_name')
        if (nameBox) setValues({ [nameBox.key]: personName })
        const pdfRes = await fetch(j.templateUrl)
        if (!pdfRes.ok) throw new Error(`Could not load the form (HTTP ${pdfRes.status}).`)
        const bytes = await pdfRes.arrayBuffer()
        if (!cancelled) setPdf(bytes)
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [choice, personName])

  const schema = prepared?.schema ?? null
  const pageWidth = schema?.pages[0]?.width ?? 612
  const scale = PAGE_WIDTH_PX / pageWidth
  const pages = useMemo(() => (schema ? schema.pages.map((p, i) => ({ page: p, pageNo: i + 1 })).filter(({ pageNo }) => pageNo === 1 || schema.boxes.some((b) => b.page === pageNo)) : []), [schema])
  const errors = useMemo(() => (schema ? errorsByBox(schema, values) : {}), [schema, values])
  const missing = useMemo(() => (schema ? missingRequired(schema, values) : []), [schema, values])
  const progress = useMemo(() => (schema ? fillProgress(schema, values) : null), [schema, values])
  const anyValue = Object.values(values).some((v) => (typeof v === 'boolean' ? v : typeof v === 'string' && v.trim().length > 0))
  const signedOnLabel = useMemo(() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(signedOn)
    if (!m) return ''
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  }, [signedOn])

  const setText = useCallback(
    (box: FormBox, raw: string) => {
      if (!schema) return
      if (box.oneOf) setValues((v) => setOneOfValue(schema, v, box.key, raw))
      else setValues((v) => ({ ...v, [box.key]: box.type === 'digits' ? acceptDigitsInput(box, raw) : raw }))
    },
    [schema],
  )
  const toggle = useCallback(
    (key: string) => {
      if (!schema) return
      setValues((v) => toggleCheckbox(schema, v, key))
    },
    [schema],
  )

  async function pickScan(file: File | null) {
    setScanError(null)
    if (!file) {
      setScan(null)
      return
    }
    const check = checkScanFile({ type: file.type, size: file.size, name: file.name })
    if (!check.ok) {
      setScanError(check.error)
      setScan(null)
      return
    }
    const buf = await file.arrayBuffer()
    let bin = ''
    const bytes = new Uint8Array(buf)
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    setScan({ file, base64: btoa(bin) })
  }

  const blockers = paperEntryBlockers({ signerPrintedName: signerName, signedOnYmd: signedOn, attested, hasScan: Boolean(scan), skipBoxes: false, anyValue })
  const skipBlockers = paperEntryBlockers({ signerPrintedName: signerName, signedOnYmd: signedOn, attested, hasScan: Boolean(scan), skipBoxes: true, anyValue })

  async function file(skipBoxes: boolean) {
    if (!choice) return
    setSubmitting(skipBoxes ? 'skip' : 'file')
    setSubmitError(null)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const jwt = sess.session?.access_token
      if (!jwt) throw new Error('Not signed in.')
      const body = buildPaperEntryRequest({
        bookEntryId: choice.bookEntryId,
        personName,
        personId,
        values,
        signerPrintedName: signerName,
        signedOnYmd: signedOn,
        skipBoxes,
        scan: scan ? { base64: scan.base64, mime: scan.file.type || 'application/octet-stream', filename: scan.file.name } : null,
      })
      const res = await fetch(`${supabaseUrl}/functions/v1/contract-form-paper-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}`, apikey: anonKey },
        body: JSON.stringify(body),
      })
      const j = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`)
      onFiled()
      onClose()
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Enter from paper" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 16, padding: '1rem' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 10, padding: '1rem 1.15rem 0.9rem', width: 'min(96vw, 1000px)', maxHeight: '94vh', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: '1.125rem' }}>Enter from paper{choice ? ` — ${choice.documentName}` : ''}</h3>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>for {personName}</span>
          <button type="button" onClick={onClose} aria-label="Close" style={{ ...btn, marginLeft: 'auto' }}>
            ✕
          </button>
        </div>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Type what is written on the paper into the boxes, exactly as written. Nothing here is sent to the sub; you are filing on their behalf.</p>

        {!choice ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
            {forms.map((f) => (
              <button key={f.bookEntryId} type="button" onClick={() => setChoice(f)} style={{ ...btn, padding: '0.7rem 0.9rem', textAlign: 'left', fontSize: '0.9rem' }}>
                {f.documentName}
              </button>
            ))}
          </div>
        ) : loadError ? (
          <p style={{ margin: 0, color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{loadError}</p>
        ) : !schema || !pdf ? (
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading the form…</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `minmax(0, ${PAGE_WIDTH_PX}px) minmax(260px, 1fr)`, gap: '1rem', alignItems: 'start' }}>
            <div>
              <div style={{ overflow: 'auto', maxHeight: '64vh', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-subtle)', padding: '0.5rem' }}>
                {pages.map(({ page, pageNo }, i) => (
                  <div key={pageNo} style={{ position: 'relative', width: page.width * scale, height: page.height * scale, margin: `${i === 0 ? 0 : 10}px auto 0`, boxShadow: '0 1px 4px rgba(0,0,0,.18)', background: CARD }}>
                    <PdfPageCanvas bytes={pdf} page={pageNo} scale={scale} />
                    <FormFillOverlay schema={schema} pageNo={pageNo} scale={scale} values={values} lang="en" focusedKey={focusedKey} errors={{}} todayLabel={signedOnLabel} signature={null} onFocus={setFocusedKey} onText={setText} onToggle={toggle} />
                  </div>
                ))}
              </div>
              <p style={{ margin: '0.4rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {progress ? `${progress.done} of ${progress.total} boxes typed` : ''}
                {missing.length > 0 ? ` · blank on the paper (required): ${missing.map((m) => m.label).join(', ')}` : ' · every required box has an answer'}
                {Object.keys(errors).length > 0 ? ` · check: ${Object.values(errors).slice(0, 2).join('; ')}` : ''}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', fontSize: '0.8125rem' }}>
              <section style={card}>
                <h4 style={h4}>The paper</h4>
                <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => void pickScan(e.target.files?.[0] ?? null)} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => fileRef.current?.click()} style={btn}>
                    {scan ? 'Replace the scan…' : 'Attach a photo or PDF of the paper…'}
                  </button>
                  {scan ? (
                    <span style={{ color: 'var(--text-muted)' }}>
                      <strong style={{ color: 'var(--text-strong)' }}>{scan.file.name}</strong> · {(scan.file.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                  ) : null}
                </div>
                {scanError ? <p style={{ margin: '0.4rem 0 0', color: 'var(--text-red-700)' }}>{scanError}</p> : null}
                <p style={{ margin: '0.4rem 0 0', color: 'var(--text-muted)', fontSize: '0.75rem' }}>Filed with the record as the source. The sub&rsquo;s signature stays on the scan; nothing is drawn on the Sign Here line.</p>
              </section>

              <section style={card}>
                <h4 style={h4}>Signed on the paper</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <label>
                    <span style={k}>Signed by (printed)</span>
                    <input style={inp} value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="As written on the paper" />
                  </label>
                  <label>
                    <span style={k}>Date on the paper</span>
                    <input style={inp} type="date" value={signedOn} onChange={(e) => setSignedOn(e.target.value)} />
                  </label>
                </div>
              </section>

              <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', cursor: 'pointer' }}>
                <input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)} style={{ marginTop: 3 }} />
                <span>I typed this exactly as it appears on the paper, including anything crossed out or left blank.</span>
              </label>

              <div style={{ background: 'var(--bg-subtle)', borderRadius: 6, padding: '0.5rem 0.7rem', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                Sensitive boxes are written into the PDF only, as on the signing page; the row keeps the last four. Missing required answers never block filing: they are listed on the record so you can ask the sub for the rest.
              </div>

              {submitError ? (
                <p role="alert" style={{ margin: 0, color: 'var(--text-red-700)' }}>
                  {submitError}
                </p>
              ) : null}
              {blockers.length > 0 ? <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.75rem' }}>Before filing: {blockers.join(' ')}</p> : null}
            </div>
          </div>
        )}

        {choice && schema ? (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.2rem' }}>
            <button type="button" onClick={() => void file(true)} disabled={!!submitting || skipBlockers.length > 0} title={skipBlockers.length > 0 ? skipBlockers.join(' ') : 'File the scan only, without typing the boxes (today’s behaviour)'} style={{ ...btn, border: 'none', color: 'var(--text-muted)', marginRight: 'auto' }}>
              {submitting === 'skip' ? 'Filing…' : 'Skip the boxes, just file the scan'}
            </button>
            <button type="button" onClick={onClose} disabled={!!submitting} style={btn}>
              Cancel
            </button>
            <button type="button" onClick={() => void file(false)} disabled={!!submitting || blockers.length > 0} style={{ ...btn, background: 'var(--text-blue-700, #1d4ed8)', color: '#fff', borderColor: 'transparent', fontWeight: 700 }}>
              {submitting === 'file' ? 'Filing…' : 'File as signed on paper'}
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
