/**
 * Send a lien waiver from a sub's pay row (v2.2970). The payment's state picks
 * one of the four Texas § 53.284 forms (kernel: lib/subWorkOrders/lienWaiverPick),
 * the office confirms the two facts, and the sub gets the normal signing email
 * with the form's boxes already filled from the sheet and the job.
 *
 * Self-contained on purpose: People → Contracts owns the general Send-for-
 * signature modal as local state; this one inserts the unsent row itself and
 * calls the same `send-contract-for-signature` function.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import {
  LIEN_WAIVER_DOCUMENT_NAMES,
  LIEN_WAIVER_FORMS,
  guessLienWaiver,
  lienWaiverForm,
  lienWaiverKindFor,
  lienWaiverMoney,
  lienWaiverSeedValues,
  type LienWaiverKind,
  type LienWaiverPaymentLike,
} from '../../lib/subWorkOrders/lienWaiverPick'

export type LienWaiverSendTarget = {
  /** people_labor_jobs.id */
  sheetId: string
  /** The sub's people.id when the sheet has exactly one roster sub; null = the office picks by name only. */
  personId: string | null
  /** The sub's name as the roster has it — becomes person_name on the document row. */
  subName: string
  /** Sheet label for the title: "Rough-in" or the HCP number. */
  sheetLabel: string
  jobNumber: string | null
  /** Click's job number (J1042) when the sheet's job is in the pipeline. */
  clickNumber: string | null
  project: string | null
  owner: string | null
  location: string | null
  payments: readonly LienWaiverPaymentLike[]
  balance: number
}

type BookEntry = { id: string; document_name: string; form_template_id: string | null }
type PriorWaiver = { id: string; document_name: string; status: string; sent_at: string | null; signed_at: string | null }

const overlay: CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)', zIndex: 1200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4vh 1rem', overflowY: 'auto' }
const panel: CSSProperties = { width: 'min(640px, 100%)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 18px 48px rgba(17,24,39,0.25)', color: 'var(--text-base)' }
const section: CSSProperties = { padding: '0.9rem 1.25rem', borderTop: '1px solid var(--border)' }
const eyebrow: CSSProperties = { fontSize: '0.6875rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }
const chip = (tone: 'green' | 'grey' | 'blue'): CSSProperties => ({
  display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600,
  ...(tone === 'green' ? { color: 'var(--text-green-700)', background: 'var(--bg-green-tint, #e8f3ea)' } : tone === 'blue' ? { color: 'var(--text-blue-700)', background: 'var(--bg-blue-tint, #e6f5fd)' } : { color: 'var(--text-muted)', background: 'var(--bg-subtle)', border: '1px solid var(--border)' }),
})
const btn: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', padding: '0.4rem 0.8rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer' }
const btnPrimary: CSSProperties = { ...btn, background: '#0ea5e9', borderColor: '#0ea5e9', color: '#fff', fontWeight: 600 }
const toggleLabel: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', cursor: 'pointer' }
const inp: CSSProperties = { font: 'inherit', fontSize: '0.875rem', padding: '0.4rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-base)', width: '100%' }

export function LienWaiverSendModal({ target, onClose, onSent }: { target: LienWaiverSendTarget; onClose: () => void; onSent?: () => void }) {
  const { showToast } = useToastContext()
  const today = todayYmdInAppTz()
  const guess = useMemo(() => guessLienWaiver({ payments: target.payments, balance: target.balance, todayYmd: today }), [target.payments, target.balance, today])
  const [settled, setSettled] = useState(guess.settled)
  const [final, setFinal] = useState(guess.final)
  const [override, setOverride] = useState<LienWaiverKind | null>(null)
  const [othersOpen, setOthersOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [emailLoaded, setEmailLoaded] = useState(false)
  const [entries, setEntries] = useState<BookEntry[] | null>(null)
  const [boxKeysByTemplate, setBoxKeysByTemplate] = useState<Map<string, string[]>>(new Map())
  const [prior, setPrior] = useState<PriorWaiver[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const kind = override ?? lienWaiverKindFor(settled, final)
  const form = lienWaiverForm(kind)
  const entry = entries?.find((e) => e.document_name === form.documentName) ?? null
  const missing = useMemo(() => (entries ? LIEN_WAIVER_FORMS.filter((f) => !entries.some((e) => e.document_name === f.documentName && e.form_template_id)).map((f) => f.short) : []), [entries])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [book, person, priorRes] = await Promise.all([
        supabase.from('contract_template_documents').select('id, document_name, form_template_id').in('document_name', [...LIEN_WAIVER_DOCUMENT_NAMES]).not('form_template_id', 'is', null),
        target.personId ? supabase.from('people').select('email').eq('id', target.personId).maybeSingle() : Promise.resolve({ data: null, error: null }),
        supabase.from('person_contract_documents').select('id, document_name, status, sent_at, signed_at').eq('person_name', target.subName).in('document_name', [...LIEN_WAIVER_DOCUMENT_NAMES]).ilike('note', `%sheet:${target.sheetId}%`).order('created_at', { ascending: false }).limit(12),
      ])
      if (cancelled) return
      const rows = (book.data ?? []) as BookEntry[]
      setEntries(rows)
      setEmail(((person.data as { email?: string | null } | null)?.email ?? '').trim())
      setEmailLoaded(true)
      setPrior((priorRes.data ?? []) as PriorWaiver[])
      const templateIds = [...new Set(rows.map((r) => r.form_template_id).filter((x): x is string => !!x))]
      if (templateIds.length) {
        const { data: tpls } = await supabase.from('contract_form_templates').select('id, schema').in('id', templateIds)
        if (cancelled) return
        const m = new Map<string, string[]>()
        for (const t of (tpls ?? []) as { id: string; schema: { boxes?: { key: string }[] } | null }[]) m.set(t.id, (t.schema?.boxes ?? []).map((b) => b.key))
        setBoxKeysByTemplate(m)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [target.personId, target.subName, target.sheetId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const amount = guess.amount
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  async function send() {
    if (!entry || !emailOk || sending) return
    setSending(true)
    setError(null)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const jwt = sess.session?.access_token
      if (!jwt) throw new Error('Not signed in.')
      const boxKeys = entry.form_template_id ? boxKeysByTemplate.get(entry.form_template_id) ?? [] : []
      const values = lienWaiverSeedValues({ kind, project: target.project, jobNo: target.clickNumber ?? target.jobNumber, amount: form.final && !form.conditional ? null : amount, owner: target.owner, location: target.location, boxKeys })
      const note = `Lien waiver · sheet:${target.sheetId} · ${target.jobNumber ?? '—'}${amount != null ? ` · ${lienWaiverMoney(amount)}` : ''} · ${form.short}`
      const row = await withSupabaseRetry<{ id: string }>(
        async () =>
          supabase
            .from('person_contract_documents')
            .insert({
              person_name: target.subName,
              document_name: form.documentName,
              contract_lineage_id: globalThis.crypto.randomUUID(),
              lineage_version: 1,
              status: 'unsent',
              applied_contract_template_document_id: entry.id,
              form_values: values,
              note,
            })
            .select('id')
            .single(),
        'file lien waiver',
      )
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-contract-for-signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string },
        body: JSON.stringify({ person_contract_document_id: row.id, signer_email: email.trim(), public_origin: typeof window !== 'undefined' ? window.location.origin : undefined }),
      })
      const json = (await res.json()) as { ok?: boolean; accept_url?: string; emailed?: boolean; email_error?: string; warning?: string; error?: string }
      if (!res.ok || !json.ok) throw new Error(json.error || 'Send failed')
      showToast(json.emailed ? `${form.short} waiver emailed to ${target.subName}.` : `Waiver filed — link ready${json.accept_url ? `: ${json.accept_url}` : ''}`, json.emailed ? 'success' : 'info')
      onSent?.()
      onClose()
    } catch (e) {
      setError(formatErrorMessage(e))
    } finally {
      setSending(false)
    }
  }

  const stepIndex = LIEN_WAIVER_FORMS.findIndex((f) => f.kind === kind)

  return (
    <div style={overlay} onClick={onClose} role="presentation">
      <div style={panel} role="dialog" aria-modal="true" aria-labelledby="lien-waiver-title" onClick={(e) => e.stopPropagation()}>
        <div style={{ ...section, borderTop: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <h2 id="lien-waiver-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 650 }}>Send a lien waiver · {target.subName}</h2>
          <span style={eyebrow}>{target.sheetLabel}{target.clickNumber ? ` · ${target.clickNumber}` : ''}</span>
        </div>

        <div style={{ ...section, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: '0.875rem' }}>
            {amount != null ? <span style={chip('blue')}>Payment {lienWaiverMoney(amount)}{guess.payment?.payment_date ? ` · ${guess.payment.payment_date.slice(0, 10)}` : ''}</span> : <span style={chip('grey')}>Nothing paid yet</span>}
            <span style={chip(settled ? 'green' : 'grey')}>{settled ? 'Settled in the bank' : 'Not settled yet'}</span>
            <span style={chip('grey')}>{final ? 'Last payment on the sheet' : 'One of several payments'}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px' }}>
            <label style={toggleLabel}><input type="checkbox" checked={settled} onChange={(e) => { setSettled(e.target.checked); setOverride(null) }} /> The money has landed in the sub's account</label>
            <label style={toggleLabel}><input type="checkbox" checked={final} onChange={(e) => { setFinal(e.target.checked); setOverride(null) }} /> This is the final payment on the sheet</label>
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            {guess.reasons.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </div>

        <div style={{ ...section, display: 'grid', gap: 8 }}>
          <p style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 650 }}>{form.documentName}</p>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{form.cite} · {override ? 'chosen by hand' : 'picked from the payment’s state'}</div>
          <p style={{ margin: 0, maxWidth: '62ch', color: 'var(--text-700)' }}>{form.why}</p>
          {!form.conditional ? (
            <div role="note" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 10, padding: '0.6rem 0.75rem', borderRadius: 8, background: 'var(--bg-amber-tint, #fff6e5)', border: '1px solid var(--border-amber, #f2c98a)', color: 'var(--text-amber-800)', fontSize: '0.8125rem' }}>
              <span aria-hidden="true">⚠</span>
              <p style={{ margin: 0 }}><b>Only after the money has landed.</b> An unconditional waiver says the sub has been paid, and Texas makes it illegal to require one before that. The form prints this warning in the largest type on the page.</p>
            </div>
          ) : null}
        </div>

        <div style={section}>
          <div style={{ ...eyebrow, marginBottom: 10 }}>Where this payment is on the job</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {LIEN_WAIVER_FORMS.map((f, i) => {
              const now = i === stepIndex
              const done = i < stepIndex
              return (
                <div key={f.kind} style={{ display: 'grid', justifyItems: 'center', textAlign: 'center', gap: 4, padding: '0 4px' }}>
                  <div aria-hidden="true" style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${now ? '#0ea5e9' : done ? 'var(--text-green-700)' : 'var(--border-strong)'}`, background: now ? '#0ea5e9' : done ? 'var(--bg-green-tint, #e8f3ea)' : 'var(--surface)', color: now ? '#fff' : done ? 'var(--text-green-700)' : 'var(--text-muted)', fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center', boxShadow: now ? '0 0 0 4px var(--bg-blue-tint, #e6f5fd)' : 'none' }}>{i + 1}</div>
                  <div style={{ fontSize: '0.6875rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>{i === 0 ? 'With each check' : i === 1 ? 'After it settles' : i === 2 ? 'With the last check' : 'After it settles'}</div>
                  <div style={{ fontSize: '0.78rem', color: now ? 'var(--text-base)' : 'var(--text-700)', fontWeight: now ? 650 : 400, lineHeight: 1.25 }}>{f.short.replace(' · ', '\n')}</div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={section}>
          <button type="button" style={{ ...btn, border: 'none', background: 'none', padding: 0, color: 'var(--text-link)', textDecoration: 'underline', textUnderlineOffset: 3 }} aria-expanded={othersOpen} onClick={() => setOthersOpen((o) => !o)}>
            {othersOpen ? 'Hide the other three' : 'Not this one? See the other three'}
          </button>
          {othersOpen ? (
            <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
              {LIEN_WAIVER_FORMS.filter((f) => f.kind !== kind).map((f) => (
                <div key={f.kind} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', padding: '0.6rem 0.75rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{f.documentName}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Use {f.when}.</div>
                  </div>
                  <button type="button" style={btn} onClick={() => { setOverride(f.kind); setOthersOpen(false) }}>Use this instead</button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div style={{ ...section, display: 'grid', gap: 8 }}>
          <label style={{ display: 'grid', gap: 4, fontSize: '0.8125rem' }}>
            <span style={eyebrow}>Sub's email for the signing link</span>
            <input type="email" style={inp} value={email} placeholder="name@example.com" onChange={(e) => setEmail(e.target.value)} disabled={!emailLoaded} />
          </label>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            Filled in for the sub: {target.project ?? '—'} · {target.clickNumber ?? target.jobNumber ?? '—'}{amount != null && !(form.final && !form.conditional) ? ` · ${lienWaiverMoney(amount)}` : ''} · owner {target.owner ?? '—'} · {target.location ?? '—'}. They can change any of it before signing.
          </div>
          {prior.length ? (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Already on this sheet: {prior.map((p) => `${p.document_name.replace(' Waiver and Release on ', ' · ')} (${p.status}${p.signed_at ? ` ${p.signed_at.slice(0, 10)}` : p.sent_at ? ` ${p.sent_at.slice(0, 10)}` : ''})`).join(' · ')}
            </div>
          ) : null}
          {entries && missing.length ? (
            <div role="alert" style={{ fontSize: '0.8125rem', color: 'var(--text-amber-800)' }}>
              Not published yet in the Contract library → Forms tab: {missing.join(', ')}. Publish the four waivers first (a dev does this once).
            </div>
          ) : null}
          {error ? <div role="alert" style={{ fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{error}</div> : null}
        </div>

        <div style={{ ...section, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Signed on the sub's phone; the signed PDF files to People → Contracts on their row.</span>
          <span style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={btn} onClick={onClose}>Cancel</button>
            <button type="button" style={{ ...btnPrimary, opacity: !entry || !emailOk || sending ? 0.55 : 1 }} disabled={!entry || !emailOk || sending} onClick={() => void send()}>
              {sending ? 'Sending…' : form.send}
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}
