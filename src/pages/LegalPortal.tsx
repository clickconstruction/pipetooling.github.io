import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { staffAwarePublicHeaders } from '../lib/publicFunctionStaffHeaders'
import { LEGAL_SAMPLE_BANNER_TEXT, sampleStateFromToken } from '../lib/customerSampleMode'
import { SampleModeBanner } from '../components/SampleModeBanner'
import { PUBLIC_PREVIEW_PARAM, isPreviewFlag } from '../lib/publicViewCounting'
import { CARD, COPPER, FAINT, HAIR, INK, MUTED, NOTE_BAND, PAPER, PAPER_GREEN, PAPER_RED, PORTAL_FONT } from '../lib/portal/portalTheme'
import { formatLegalMoney, type LegalPacket } from '../lib/legal/legalPacket'
import { buildFirmPacketPrintHtml } from '../lib/legal/legalFirmPacketPrint'
import { openHtmlPrintWindow } from '../lib/jobsDocuments/printWindow'
import { FIRM_EMAIL_MODE_WORDS, firmRecipientStatusWords, firmSavedWords, legalFirmStageWords } from '../lib/legal/legalFirmWords'
import { PORTAL_QUIET_RELOAD_FAILED, portalPayloadIsStale } from '../lib/legal/legalPortalFreshness'
import { buildMatterPacket, parseLegalPortalPayload, portalFeeModel, type LegalPortalMatter, type LegalPortalPayload, type LegalPortalRecipient } from '../lib/legal/legalPortalPayload'
import { WEEKDAY_LABELS } from '../lib/legal/legalMatters'
import { legalNotReachingLine } from '../lib/legal/legalNotifyLedger'
import { FirmMatterView } from '../components/jobs/legal/LegalFirmMatterView'
import { orderFirmMatters } from '../lib/legal/legalFirmMatterOrder'
import LegalPortalLienGrid from '../components/jobs/legal/LegalPortalLienGrid'
import { askKindWords, openAsks } from '../lib/legal/legalAsks'
import { confirmationNotice, type LegalActAnswer, type LegalActNotice } from '../lib/legal/legalPortalNotice'
import { firmFacingErrorLine } from '../lib/legal/legalPortalErrors'
import { portalH, type FirmTab } from '../components/jobs/legal/legalFirmMatterViewShared'

/**
 * The collections law firm's portal (Legal portal PR 3): the no-login page
 * behind the firm's capability link (`/legal?t=<token>`). Every matter the
 * office marked attorney-ready, each as the same five-section packet the
 * office desk shows — Account · Paper · Record of contact · Evidence · Fees & steps —
 * built by the one packet kernel from the records `legal-portal` returns (held
 * entries never arrive). Plus the company's particulars for filing and the exhibits
 * as links. Every word here is the firm's (`legalFirmWords.ts`, punch list #85 item 3), not the office's. Read-only; the firm's own acts (fees, steps, questions, payments
 * received) land with PR 4. Same paper as the customer statement, pinned light.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

type PageState = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; payload: LegalPortalPayload }
/** One act on the portal; `said` words the line shown after a success (the default is `firmSavedWords`, what happens next for that act). */
type Act = (payload: Record<string, unknown>, said?: (answer: LegalActAnswer) => LegalActNotice) => Promise<boolean>

const card: CSSProperties = { background: CARD, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }
const cap: CSSProperties = { fontSize: 11, color: FAINT, textTransform: 'uppercase', letterSpacing: '0.07em' }
const num: CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
const btn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, padding: '6px 12px', borderRadius: 5, border: `1px solid ${COPPER}`, color: COPPER, background: CARD, cursor: 'pointer' }

export default function LegalPortal() {
  const [params] = useSearchParams()
  const token = params.get('t') || params.get('token') || ''
  const sample = sampleStateFromToken(token)
  const preview = isPreviewFlag(params.get(PUBLIC_PREVIEW_PARAM))
  const [state, setState] = useState<PageState>({ kind: 'loading' })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<FirmTab>('account')
  const [panel, setPanel] = useState<'matters' | 'grid' | 'notifications'>('matters')
  const [reloadTick, setReloadTick] = useState(0)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [noticeWarn, setNoticeWarn] = useState(false)
  /** When the payload last arrived (item 22): the PDF links in it open for fifteen minutes. */
  const loadedAtRef = useRef<number | null>(null)
  /** True while the load in flight is the quiet ten-minute reload: it never swaps the page for the error card. */
  const quietRef = useRef(false)

  /** One POST to submit-legal-portal; reloads the payload on success. */
  const act: Act = async (payload, said) => {
    // What customers see (v2.3512): the sample portal saves nothing.
    if (sample) {
      setNotice('Sample — nothing is saved here.')
      setNoticeWarn(false)
      return true
    }
    setBusy(true)
    setNotice(null)
    setNoticeWarn(false)
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/submit-legal-portal`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await staffAwarePublicHeaders()) }, body: JSON.stringify({ token, ...payload }) })
      const body = (await res.json().catch(() => null)) as LegalActAnswer | null
      if (!res.ok || !body?.ok) {
        setNotice(res.ok ? 'Could not save that. Please try again.' : firmFacingErrorLine(res.status, body))
        return false
      }
      setReloadTick((t) => t + 1)
      const line = said ? said(body) : { text: firmSavedWords(payload), warn: false }
      setNotice(line.text)
      setNoticeWarn(line.warn)
      return true
    } catch {
      setNotice('Could not reach the office. Check your connection and try again.')
      return false
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!token) {
      setState({ kind: 'error', message: 'This link is missing its key. Please use the exact link the office sent you.' })
      return
    }
    let cancelled = false
    // The quiet reload (item 22) keeps the page it already shows when it fails, and says so on the notice line.
    const quiet = quietRef.current
    quietRef.current = false
    const fail = (message: string) => {
      if (quiet) {
        setNotice(PORTAL_QUIET_RELOAD_FAILED)
        setNoticeWarn(true)
        return
      }
      setState({ kind: 'error', message })
    }
    void (async () => {
      try {
        // `refresh=1`: the quiet reload is not a new visit, so the function writes no page-view row for it.
        const res = await fetch(`${supabaseUrl}/functions/v1/legal-portal?token=${encodeURIComponent(token)}${preview ? `&${PUBLIC_PREVIEW_PARAM}=1` : ''}${quiet ? '&refresh=1' : ''}`, { headers: await staffAwarePublicHeaders() })
        const body = (await res.json().catch(() => null)) as unknown
        if (cancelled) return
        if (!res.ok) {
          // Item 7 (#85): a 4xx keeps the words written for the firm; an unexpected 5xx reads as one plain sentence.
          fail(firmFacingErrorLine(res.status, body))
          return
        }
        const payload = parseLegalPortalPayload(body)
        if (!payload) {
          fail('The portal answered in a shape this page does not understand. Please contact the office.')
          return
        }
        setState({ kind: 'ready', payload })
        loadedAtRef.current = Date.now()
        // The first matter in the page's order opens by itself and stays pinned (the effect below).
      } catch {
        if (!cancelled) fail('We could not open the portal. Please check your connection and try again.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, preview, reloadTick])

  // Item 22 (#85): reload quietly before the signed PDF links run out — when the tab comes back into view,
  // and on a one-minute check while it is in view. The selected matter and tab stay as they are.
  useEffect(() => {
    if (sample) return
    const check = () => {
      if (document.visibilityState === 'visible' && portalPayloadIsStale(loadedAtRef.current, Date.now())) {
        loadedAtRef.current = Date.now()
        quietRef.current = true
        setReloadTick((t) => t + 1)
      }
    }
    const timer = window.setInterval(check, 60_000)
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
    }
  }, [sample])

  // Item 22 (#85): the address bar carries the firm's key, so no page this one opens learns it.
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'referrer'
    meta.content = 'no-referrer'
    document.head.appendChild(meta)
    return () => {
      meta.remove()
    }
  }, [])

  const payload = state.kind === 'ready' ? state.payload : null
  const fee = useMemo(() => (payload ? portalFeeModel(payload) : { contingencyPct: 0.33, filingCost: 350 }), [payload])
  const packets = useMemo(() => {
    const out = new Map<string, LegalPacket | null>()
    if (!payload) return out
    for (const m of payload.matters) out.set(m.id, buildMatterPacket(m, payload.preparedOn, fee))
    return out
  }, [payload, fee])
  /** Largest balance first, the newest referral breaking a tie; the function's order (oldest referral first) after that (punch list #85, item 11). */
  const matters = useMemo(() => (payload ? orderFirmMatters(payload.matters, (m) => packets.get(m.id)?.account.totals.balance ?? null) : []), [payload, packets])
  // Pin the first matter in the page's order on first load, so a refetch after an act that changes a
  // balance (and so the order) cannot swap the matter the firm has open.
  const firstMatterId = matters[0]?.id ?? null
  useEffect(() => {
    if (selectedId == null && firstMatterId != null) setSelectedId(firstMatterId)
  }, [selectedId, firstMatterId])
  const selected: LegalPortalMatter | null = matters.find((m) => m.id === selectedId) ?? matters[0] ?? null
  const packet = selected ? (packets.get(selected.id) ?? null) : null

  return (
    <div data-theme="light" className="legalPortalPage" style={{ background: PAPER, color: INK, minHeight: '100vh', fontFamily: PORTAL_FONT }}>
      <div style={{ maxWidth: 1040, margin: '0 auto' }}>
        {sample ? <SampleModeBanner text={LEGAL_SAMPLE_BANNER_TEXT} /> : null}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `2px solid ${COPPER}`, paddingBottom: 10, marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{payload?.company.name ?? 'Legal portal'}</div>
            <div style={{ fontSize: 12, color: MUTED }}>Collections referred to counsel{payload ? ` · prepared ${payload.preparedOn}` : ''} · no sign-in, one revocable link</div>
          </div>
          {payload ? (
            <div className="legalPortalHeadAside" style={{ textAlign: 'right', fontSize: 12.5, color: MUTED }}>
              For <b style={{ color: INK }}>{payload.firm.name}</b>{payload.firm.handling_name ? ` · ${payload.firm.handling_name}` : ''}<br />
              {payload.matters.length} matter{payload.matters.length === 1 ? '' : 's'} · {formatLegalMoney(payload.matters.reduce((s, m) => s + (packets.get(m.id)?.account.totals.balance ?? 0), 0))} in balance
            </div>
          ) : null}
        </div>

        {payload ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, borderBottom: `1px solid ${HAIR}`, marginBottom: 14, fontSize: 13 }}>
            {(payload.lienBook ? (['matters', 'grid', 'notifications'] as const) : (['matters', 'notifications'] as const)).map((p) => (
              <button key={p} type="button" onClick={() => setPanel(p)} style={{ background: 'none', border: 'none', padding: '6px 12px', color: panel === p ? INK : MUTED, borderBottom: panel === p ? `2px solid ${COPPER}` : '2px solid transparent', fontWeight: panel === p ? 700 : 500, cursor: 'pointer', font: 'inherit', fontSize: 13 }}>
                {p === 'matters' ? `Matters · ${payload.matters.length}` : p === 'grid' ? 'Lien grid' : `Notifications · ${payload.recipients.length} ${payload.recipients.length === 1 ? 'person' : 'people'}`}
              </button>
            ))}
          </div>
        ) : null}
        {payload && panel === 'notifications' ? <NotificationsPanel payload={payload} act={act} busy={busy} notice={notice} noticeWarn={noticeWarn} /> : null}
        {payload && panel === 'grid' && payload.lienBook ? <LegalPortalLienGrid raw={payload.lienBook} todayYmd={payload.preparedOn} companyName={payload.company.name} /> : null}
        {state.kind === 'loading' ? <p style={{ color: MUTED }}>Opening the portal…</p> : null}
        {state.kind === 'error' ? <div style={{ ...card, textAlign: 'center', padding: 40 }}><b>We couldn’t open this page.</b><br /><span style={{ color: MUTED }}>{state.message}</span></div> : null}

        {payload && panel === 'matters' && payload.matters.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', padding: 40 }}><b>No matters yet.</b><br /><span style={{ color: MUTED }}>Accounts appear here the moment the office marks them attorney-ready.</span></div>
        ) : null}

        {payload && panel === 'matters' && selected && packet ? (
          <div className="legalPortalSplit">
            <div className="legalPortalMain">
              <FirmMatterView
                packet={packet}
                companyName={payload.company.name}
                matter={{ payerName: selected.payer.name, noteToFirm: selected.noteToFirm, contracts: selected.contracts, entries: selected.entries }}
                tab={tab}
                onTab={setTab}
                acts={<><FirmAsks matter={selected} act={act} busy={busy} /><FirmActs matter={selected} act={act} busy={busy} notice={notice} /></>}
                onPrint={() => { if (!openHtmlPrintWindow(buildFirmPacketPrintHtml(packet, { preparedOn: payload.preparedOn, companyName: payload.company.name, firm: { name: payload.firm.name, handling: payload.firm.handling_name ?? '' }, matter: { stage: selected.stage, noteToFirm: selected.noteToFirm, releasedAt: selected.releasedAt, entries: selected.entries }, particulars: payload.particulars }))) setNotice('Your browser blocked the print window. Allow pop-ups and try again.') }}
              />
            </div>
            <div className="legalPortalList">
              <div style={cap}>Matters{matters.length > 1 ? ' · largest balance first' : ''}</div>
              {matters.map((m) => {
                const p = packets.get(m.id)
                const on = m.id === selected.id
                return (
                  <button key={m.id} type="button" onClick={() => { setSelectedId(m.id); setTab('account') }} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 12px', alignItems: 'center', width: '100%', textAlign: 'left', padding: '10px 12px', marginTop: 8, background: CARD, border: `1px solid ${on ? COPPER : HAIR}`, borderRadius: 6, color: INK, cursor: 'pointer', font: 'inherit' }}>
                    <b style={{ fontSize: 13.5 }}>{m.payer.name}</b>
                    <span style={{ ...num, fontSize: 13.5, fontWeight: 600 }}>{p ? formatLegalMoney(p.account.totals.balance) : '—'}</span>
                    <span style={{ fontSize: 11.5, color: MUTED }}>{m.jobs.length} job{m.jobs.length === 1 ? '' : 's'}{m.releasedAt ? ` · referred ${m.releasedAt}` : ''}{m.handling ? ` · handling ${m.handling}` : ''}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: NOTE_BAND, color: MUTED, justifySelf: 'end' }}>{legalFirmStageWords(m.stage)}</span>
                  </button>
                )
              })}
            </div>
            <div className="legalPortalAside">
              <div style={{ ...card, marginTop: 14, fontSize: 12.5, color: MUTED }}>
                <b style={{ color: INK }}>Particulars for filing</b>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 10px', marginTop: 6 }}>
                  <span>Legal entity</span><span style={{ color: INK }}>{payload.particulars.entity || payload.company.name}</span>
                  <span>License</span><span style={{ color: INK }}>{payload.particulars.license || '—'}</span>
                  <span>Registered agent</span><span style={{ color: INK }}>{payload.particulars.agent || '—'}</span>
                  <span>Custodian of records</span><span style={{ color: INK }}>{payload.particulars.custodian || '—'}</span>
                  <span>Affiant</span><span style={{ color: INK }}>{payload.particulars.affiant || '—'}</span>
                  <span>Office</span><span style={{ color: INK }}>{[payload.particulars.phone || payload.company.phone, payload.particulars.email || payload.company.email].filter(Boolean).join(' · ') || '—'}</span>
                  <span>W-9 / EIN</span><span style={{ color: INK }}>{payload.particulars.w9 || 'on request from the office'}</span>
                </div>
              </div>
              <div style={{ ...card, marginTop: 12, fontSize: 12.5, color: MUTED }}>
                <b style={{ color: INK }}>What is here</b><br />Each account referred to you, as one lettered packet. The statement of account, the agreements and notices, the record of contact, the field evidence and the account history. Print packet makes the PDF.<br /><br />
                <b style={{ color: INK }}>What you can record</b><br />On Fees &amp; steps you add fees and costs and record a step. A step is demand sent, suit filed, judgment entered or settled. You can also record a payment you received and ask the office a question. The office sees each one and answers here.<br /><br /><b style={{ color: INK }}>What stays with the office</b><br />Applying payments, changing a job, and contacting the customer. Only accounts referred to you are listed here. The Lien grid shows dates and dollars for each job with a lien month, and nothing anyone said.
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** From the office (#41 PR 3): the office's open asks — a question, or a sign-off on one job — answered here. */
function FirmAsks({ matter, act, busy }: { matter: LegalPortalMatter; act: Act; busy: boolean }) {
  const [notes, setNotes] = useState<Record<string, string>>({})
  const asks = openAsks(matter.entries)
  if (asks.length === 0) return null
  const input: CSSProperties = { font: 'inherit', fontSize: 13, padding: '5px 8px', border: `1px solid ${HAIR}`, borderRadius: 4, background: 'var(--surface)', color: INK, flex: '1 1 200px', minWidth: 0 }
  const answer = (askId: string, signedOff?: boolean) => async () => {
    const note = (notes[askId] ?? '').trim()
    if (signedOff == null && !note) return
    if (await act({ kind: 'answer', matterId: matter.id, askId, note, ...(signedOff == null ? {} : { signedOff }) })) setNotes((n) => ({ ...n, [askId]: '' }))
  }
  return (
    <div style={{ marginTop: 12 }} data-legal-portal-asks>
      <div style={portalH}>From the office · {asks.length} waiting on you</div>
      {asks.map((a) => (
        <div key={a.id} style={{ background: NOTE_BAND, borderRadius: 6, padding: '8px 10px', fontSize: 12.5, marginBottom: 8 }}>
          <div><b>{askKindWords(a)}</b>{a.askedOn ? <span style={{ color: MUTED }}> · asked {a.askedOn}{a.askedBy ? ` by ${a.askedBy}` : ''}</span> : null}</div>
          <div style={{ color: MUTED, marginTop: 2 }}>{a.body}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
            {a.flavor === 'signoff' ? (
              <>
                <button type="button" disabled={busy} onClick={answer(a.id, true)} style={{ ...btn, background: COPPER, color: '#fff', borderColor: COPPER }}>Signed off</button>
                <button type="button" disabled={busy} onClick={answer(a.id, false)} style={btn}>Not yet</button>
                <input value={notes[a.id] ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))} placeholder="a note for the office (optional)" style={input} />
              </>
            ) : (
              <>
                <input value={notes[a.id] ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))} placeholder="your answer" style={input} />
                <button type="button" disabled={busy || !(notes[a.id] ?? '').trim()} onClick={answer(a.id)} style={{ ...btn, background: COPPER, color: '#fff', borderColor: COPPER }}>Answer</button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

/** The firm's four acts (PR 4): add a fee or cost, record a step, record a payment received, ask the office. */
function FirmActs({ matter, act, busy, notice }: { matter: LegalPortalMatter; act: Act; busy: boolean; notice: string | null }) {
  const [feeKind, setFeeKind] = useState<'fee' | 'cost'>('fee')
  const [feeAmount, setFeeAmount] = useState('')
  const [feeNote, setFeeNote] = useState('')
  const [stage, setStage] = useState<'demand' | 'suit' | 'judgment' | 'settled'>('demand')
  const [stepNote, setStepNote] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [payNote, setPayNote] = useState('')
  const [question, setQuestion] = useState('')
  const input: CSSProperties = { font: 'inherit', fontSize: 13, padding: '5px 8px', border: `1px solid ${HAIR}`, borderRadius: 4, background: 'var(--surface)', color: INK, width: '100%' }
  const lab: CSSProperties = { display: 'grid', gap: 3, fontSize: 11.5, color: MUTED }
  const submit = (payload: Record<string, unknown>, after: () => void) => async (e: FormEvent) => {
    e.preventDefault()
    if (await act({ ...payload, matterId: matter.id })) after()
  }
  return (
    <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
      {notice ? <div style={{ fontSize: 12.5, padding: '6px 10px', background: NOTE_BAND, borderRadius: 4 }}>{notice}</div> : null}
      <form onSubmit={submit({ kind: feeKind, amount: Number(feeAmount), note: feeNote }, () => { setFeeAmount(''); setFeeNote('') })} className="legalPortalForm legalPortalForm--fee">
        <label style={lab}>Fee or cost<select value={feeKind} onChange={(e) => setFeeKind(e.target.value as 'fee' | 'cost')} style={input}><option value="fee">Attorney fee</option><option value="cost">Cost (filing, service)</option></select></label>
        <label style={lab}>Amount<input type="number" min={1} step="0.01" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} placeholder="450" required style={input} /></label>
        <label style={lab}>Note<input value={feeNote} onChange={(e) => setFeeNote(e.target.value)} placeholder="Demand letter on firm letterhead" required style={input} /></label>
        <button type="submit" disabled={busy} style={btn}>+ Add fee or cost</button>
      </form>
      <form onSubmit={submit({ kind: 'step', stage, note: stepNote }, () => setStepNote(''))} className="legalPortalForm legalPortalForm--note">
        <label style={lab}>Record a step<select value={stage} onChange={(e) => setStage(e.target.value as 'demand' | 'suit' | 'judgment' | 'settled')} style={input}><option value="demand">Demand sent on firm letterhead</option><option value="suit">Suit filed</option><option value="judgment">Judgment entered</option><option value="settled">Settled</option></select></label>
        <label style={lab}>Detail<input value={stepNote} onChange={(e) => setStepNote(e.target.value)} placeholder="Court, cause no., amount, terms…" style={input} /></label>
        <button type="submit" disabled={busy} style={btn}>Record step</button>
      </form>
      <form onSubmit={submit({ kind: 'payment_received', amount: Number(payAmount), note: payNote }, () => { setPayAmount(''); setPayNote('') })} className="legalPortalForm legalPortalForm--note">
        <label style={lab}>Payment received<input type="number" min={1} step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="Amount" required style={input} /></label>
        <label style={lab}>Check no., date, from whom<input value={payNote} onChange={(e) => setPayNote(e.target.value)} style={input} /></label>
        <button type="submit" disabled={busy} style={btn}>Record payment</button>
      </form>
      <form onSubmit={submit({ kind: 'question', note: question }, () => setQuestion(''))} className="legalPortalForm legalPortalForm--ask">
        <label style={lab}>Ask the office<input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. Do you have the signed change order for the HVAC add?" required style={input} /></label>
        <button type="submit" disabled={busy} style={btn}>Send</button>
      </form>
      <p style={{ fontSize: 11.5, color: FAINT, margin: 0 }}>The office applies a payment you report to the job and records your contingency. A step you record sets the matter's stage for you and the office.</p>
    </div>
  )
}

/** The firm runs its own inbox (PR 5): people, one rule each — right away or a weekly digest — and only-my-matters. */
function NotificationsPanel({ payload, act, busy, notice, noticeWarn }: { payload: LegalPortalPayload; act: Act; busy: boolean; notice: string | null; noticeWarn: boolean }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('paralegal')
  const input: CSSProperties = { font: 'inherit', fontSize: 13, padding: '5px 8px', border: `1px solid ${HAIR}`, borderRadius: 4, background: CARD, color: INK, width: '100%' }
  const lab: CSSProperties = { display: 'grid', gap: 3, fontSize: 11.5, color: MUTED }
  const small: CSSProperties = { ...btn, padding: '3px 9px', fontSize: 12 }
  const ghost: CSSProperties = { ...small, borderColor: HAIR, color: MUTED }
  const rule = (r: LegalPortalRecipient, patch: Record<string, unknown>) => void act({ kind: 'recipient_rules', recipientId: r.id, mode: r.mode, scope: r.scope, digestWeekday: r.digestWeekday, digestTime: r.digestTime, ...patch })
  const onAdd = async (e: FormEvent) => {
    e.preventDefault()
    const who = name.trim()
    const address = email.trim().toLowerCase()
    if (await act({ kind: 'recipient_add', name, email, role }, (answer) => confirmationNotice(who, address, answer))) {
      setName('')
      setEmail('')
    }
  }
  return (
    <div className="legalPortalPair">
      <div>
        {payload.firmPaused ? <div style={{ ...card, borderColor: PAPER_RED, color: PAPER_RED, marginBottom: 12, fontSize: 13 }}>{payload.company.name} has paused all emails to the firm. The portal still works; ask the office to resume.</div> : null}
        {notice ? <div role={noticeWarn ? 'alert' : 'status'} data-legal-notice={noticeWarn ? 'warn' : 'ok'} style={{ fontSize: 12.5, padding: '6px 10px', background: NOTE_BAND, borderRadius: 4, marginBottom: 10, color: noticeWarn ? PAPER_RED : undefined, fontWeight: noticeWarn ? 600 : undefined }}>{notice}</div> : null}
        {payload.recipients.length === 0 ? <div style={card}><b>Nobody at the firm is on the list yet.</b><br /><span style={{ color: MUTED, fontSize: 13 }}>Add the people who should hear from {payload.company.name}. Each gets one confirmation email and nothing else until they click it.</span></div> : null}
        {payload.recipients.map((r) => (
          <div key={r.id} style={{ ...card, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <div><b>{r.name}</b> <span style={{ color: MUTED, fontSize: 12.5 }}>{r.email}{r.role ? ` · ${r.role}` : ''}</span></div>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: r.paused ? PAPER_RED : r.confirmed ? PAPER_GREEN : COPPER }}>{firmRecipientStatusWords(r)}</span>
            </div>
            {r.failingSince && !r.paused ? <div data-legal-not-reaching style={{ color: PAPER_RED, fontSize: 12.5, marginTop: 6 }}>{legalNotReachingLine({ email: r.email, sinceYmd: r.failingSince, confirmed: r.confirmed, mode: r.mode }, 'firm')}</div> : null}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 8, fontSize: 13 }}>
              <span style={{ color: MUTED }}>Emails</span>
              <span style={{ display: 'inline-flex', border: `1px solid ${HAIR}`, borderRadius: 999, overflow: 'hidden', fontSize: 11.5, fontWeight: 700 }}>
                {(['now', 'digest'] as const).map((m) => <button key={m} type="button" disabled={busy} onClick={() => rule(r, { mode: m })} style={{ padding: '3px 10px', border: 'none', background: r.mode === m ? COPPER : 'transparent', color: r.mode === m ? '#fff' : FAINT, cursor: 'pointer', font: 'inherit', fontSize: 11.5, fontWeight: 700 }}>{FIRM_EMAIL_MODE_WORDS[m]}</button>)}
              </span>
              {r.mode === 'digest' ? (
                <>
                  {[1, 2, 3, 4, 5].map((d) => <button key={d} type="button" disabled={busy} onClick={() => rule(r, { digestWeekday: d })} style={r.digestWeekday === d ? small : ghost}>{WEEKDAY_LABELS[d]}</button>)}
                  <select value={r.digestTime} disabled={busy} onChange={(e) => rule(r, { digestTime: e.target.value })} style={{ ...input, width: 'auto' }}>
                    {['06:00', '07:00', '08:00', '09:00', '12:00', '16:00'].map((t) => <option key={t} value={t}>{t} Central</option>)}
                  </select>
                </>
              ) : null}
              <span className="legalRecipientScope" style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6 }}>
                <button type="button" disabled={busy} onClick={() => rule(r, { scope: 'mine' })} style={r.scope === 'mine' ? small : ghost}>Only my matters</button>
                <button type="button" disabled={busy} onClick={() => rule(r, { scope: 'all' })} style={r.scope === 'all' ? small : ghost}>Every matter</button>
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {!r.confirmed ? <button type="button" disabled={busy} onClick={() => void act({ kind: 'recipient_resend', recipientId: r.id }, (answer) => confirmationNotice(r.name, r.email, answer, true))} style={ghost}>Resend the confirmation</button> : null}
              {r.paused ? <button type="button" disabled={busy} onClick={() => void act({ kind: 'recipient_resume', recipientId: r.id })} style={small}>Turn emails back on</button> : <button type="button" disabled={busy} onClick={() => void act({ kind: 'recipient_stop', recipientId: r.id })} style={{ ...ghost, color: PAPER_RED, borderColor: PAPER_RED }}>Stop emails to this person</button>}
            </div>
          </div>
        ))}
      </div>
      <div>
        <div style={card}>
          <div style={cap}>Add a person at the firm</div>
          <form onSubmit={onAdd} style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            <label style={lab}>Name<input value={name} onChange={(e) => setName(e.target.value)} required style={input} /></label>
            <label style={lab}>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={input} /></label>
            <label style={lab}>Role<select value={role} onChange={(e) => setRole(e.target.value)} style={input}><option value="paralegal">paralegal</option><option value="attorney">attorney</option><option value="billing">billing</option></select></label>
            <button type="submit" disabled={busy} style={{ ...btn, justifyContent: 'center' }}>Send them a confirmation</button>
          </form>
        </div>
        <div style={{ ...card, marginTop: 12, fontSize: 12.5, color: MUTED }}>
          <b style={{ color: INK }}>How this behaves</b><br />Each person chooses an email for each event or a weekly digest, and every matter or only the ones they handle. A new address gets one confirmation email and nothing else until they click it. Every email carries a one-click link to stop. {payload.company.name} can pause all emails to the firm or remove a person; you see that here when it happens.<br /><br />
          <b style={{ color: INK }}>What you hear about</b><br />A new account referred to you, the office answering a question, and a referral withdrawn. Each comes as its own email or in the digest. The digest also lists every open matter.
        </div>
      </div>
    </div>
  )
}

