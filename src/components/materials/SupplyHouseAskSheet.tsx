import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { CallPhoneButton } from '../CallPhoneButton'
import { formatCurrency } from '../../lib/format'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { saveSupplierWords } from '../../lib/jobs/lienSupplierWordIo'
import { parseSupplierWordBalance, lienSupplierSaidWords } from '../../lib/jobs/lienJobSuppliers'
import { fetchPhysicalInvoiceIssuerFromAppSettings, getPhysicalInvoiceIssuerDraft } from '../../lib/physicalInvoiceIssuer'
import { formatErrorMessage } from '../../utils/errorHandling'
import {
  houseAskChanges,
  houseAskMailto,
  houseAskMessage,
  houseAskStartingAnswer,
  houseAskSubject,
  pickAskRep,
  type HouseAsk,
  type HouseAskAnswer,
  type HouseAskContact,
  type HouseAskJob,
} from '../../lib/materials/houseAsk'

const input: CSSProperties = { minHeight: 34, padding: '0 9px', border: '1px solid var(--border-strong)', borderRadius: 6, font: 'inherit', fontSize: '0.8125rem', color: 'var(--text-strong)', background: 'var(--surface)', minWidth: 0, width: '100%', boxSizing: 'border-box' }
const plainBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'none' }
const small: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }

function noticeWords(j: HouseAskJob, houseName: string): { text: string; tone: 'amber' | 'plain' | 'muted' } {
  const n = j.notice
  if (n.kind === 'said') return { text: `goes out ${formatYmdMonthDay(n.ymd)} · ${j.word ? lienSupplierSaidWords(houseName, j.word) : 'they said so'}`, tone: n.daysLeft < 0 ? 'muted' : n.soon ? 'amber' : 'plain' }
  if (n.kind === 'open') return { text: `by ${formatYmdMonthDay(n.ymd)} · our estimate`, tone: n.soon ? 'amber' : 'plain' }
  if (n.kind === 'closed') return { text: `window closed ${formatYmdMonthDay(n.ymd)} · our estimate`, tone: 'muted' }
  return { text: 'no date to count from', tone: 'muted' }
}
const INK = { amber: 'var(--text-amber-800)', plain: 'var(--text-700)', muted: 'var(--text-muted)' } as const

/**
 * Ask a house (v2.4443): one supply house at a time, the way the call goes. Every job with a
 * balance there by our books, who to ask and the message that asks, and the house's answers
 * typed down the list and saved together. The answers are the Lien desk's They told us…
 * (`job_supply_house_words`), so they show on the desk and on each job's statement at once.
 * The app sends nothing: the message is copied, or opens in the person's own mail.
 */
export function SupplyHouseAskSheet({ asks, authName, isMobile, onClose, onSaved }: { asks: ReadonlyArray<HouseAsk>; authName: string; isMobile: boolean; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToastContext()
  const [houseId, setHouseId] = useState<string>(asks[0]?.houseId ?? '')
  // Typed answers, by "house:job": switching houses keeps what was typed for the others.
  const [answers, setAnswers] = useState<Record<string, HouseAskAnswer>>({})
  const [saidBy, setSaidBy] = useState<Record<string, string>>({})
  const [contacts, setContacts] = useState<HouseAskContact[]>([])
  const [company, setCompany] = useState(() => getPhysicalInvoiceIssuerDraft().companyName ?? '')
  const [busy, setBusy] = useState(false)
  const [messageOpen, setMessageOpen] = useState(false)

  useEffect(() => {
    let live = true
    void supabase
      .from('supply_house_contacts')
      .select('id, supply_house_id, name, label, email, phone, role, is_default, archived_at')
      .is('archived_at', null)
      .then(({ data }) => {
        if (live) setContacts((data ?? []) as HouseAskContact[])
      })
    void fetchPhysicalInvoiceIssuerFromAppSettings()
      .then(() => {
        // The fetch fills the session's issuer; read the name from it.
        const name = getPhysicalInvoiceIssuerDraft().companyName
        if (live && name) setCompany(name)
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [])

  const ask = asks.find((a) => a.houseId === houseId) ?? asks[0] ?? null
  const rep = useMemo(() => (ask ? pickAskRep(contacts, ask.houseId) : null), [contacts, ask])
  const who = ask ? (saidBy[ask.houseId] ?? rep?.name ?? '') : ''
  const message = useMemo(() => (ask ? houseAskMessage(ask, { repName: rep?.name, senderName: authName, company }) : ''), [ask, rep, authName, company])
  const subject = ask ? houseAskSubject(ask, company) : ''
  const answerOf = (a: HouseAsk, j: HouseAskJob): HouseAskAnswer => answers[`${a.houseId}:${j.jobId}`] ?? houseAskStartingAnswer(j)
  // Every house's typed answers are saved together, each under the name given for its house.
  const pending = useMemo(
    () =>
      asks.map((a) => {
        const mine: Record<string, HouseAskAnswer> = {}
        for (const j of a.jobs) {
          const typed = answers[`${a.houseId}:${j.jobId}`]
          if (typed) mine[j.jobId] = typed
        }
        return houseAskChanges(a, mine, { saidBy: saidBy[a.houseId] ?? pickAskRep(contacts, a.houseId)?.name ?? '', notedByName: authName })
      }),
    [asks, answers, saidBy, contacts, authName],
  )
  const saves = pending.flatMap((p) => p.saves)
  const bad = new Set(pending.flatMap((p) => p.badJobIds))
  const dirty = Object.keys(answers).length > 0

  if (!ask) return null

  const setAnswer = (j: HouseAskJob, patch: Partial<HouseAskAnswer>) => setAnswers((prev) => ({ ...prev, [`${ask.houseId}:${j.jobId}`]: { ...answerOf(ask, j), ...patch } }))
  const copy = (done: string) => {
    if (!navigator.clipboard) {
      showToast('Could not copy. Open the message and copy it by hand.', 'error')
      return
    }
    navigator.clipboard.writeText(`${subject}\n\n${message}`).then(
      () => showToast(done, 'success'),
      () => showToast('Could not copy. Open the message and copy it by hand.', 'error'),
    )
  }
  const save = async () => {
    if (busy || saves.length === 0 || bad.size > 0) return
    setBusy(true)
    try {
      await saveSupplierWords(saves)
      showToast(`Saved ${saves.length} ${saves.length === 1 ? 'answer' : 'answers'}. The Lien desk shows them too.`, 'success')
      onSaved()
      onClose()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the answers'), 'error')
    } finally {
      setBusy(false)
    }
  }
  const mail = rep?.email ? houseAskMailto(rep.email, subject, message) : null
  const tall = isMobile ? { minHeight: 44 } : null

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: isMobile ? 'env(safe-area-inset-top, 0px) 0 env(safe-area-inset-bottom, 0px)' : 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      onClick={(e) => {
        e.stopPropagation()
        // A click outside closes the sheet only while nothing is typed: a call's answers are not lost to a stray click.
        if (e.target === e.currentTarget && !dirty) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ask a supply house"
        data-house-ask-sheet={ask.name}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: isMobile ? 0 : 10, width: isMobile ? '100%' : 'min(960px, 100%)', height: isMobile ? '100%' : undefined, maxHeight: isMobile ? '100%' : 'calc(100dvh - 2rem)', boxShadow: '0 20px 50px rgba(0,0,0,0.25)', display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr) auto', fontSize: '0.8125rem' }}
      >
        <div style={{ padding: '0.8rem 1rem 0.6rem', borderBottom: '1px solid var(--border)', display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: '1.0625rem', flex: 1 }}>Ask a house</h3>
            <button type="button" onClick={onClose} aria-label="Close" style={{ width: 36, height: 36, border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.3rem', lineHeight: 1, color: 'var(--text-muted)' }}>×</button>
          </div>
          <div role="tablist" aria-label="Supply house" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
            {asks.map((a) => {
              const on = a.houseId === ask.houseId
              return (
                <button key={a.houseId} type="button" role="tab" aria-selected={on} onClick={() => setHouseId(a.houseId)} data-house-ask-tab={a.name} style={{ ...plainBtn, ...tall, borderRadius: 999, background: on ? '#2563eb' : 'var(--surface)', color: on ? '#fff' : 'var(--text-700)', borderColor: on ? 'transparent' : 'var(--border-strong)', flex: 'none' }}>
                  {a.name} <span style={{ marginLeft: 6, opacity: 0.8, fontVariantNumeric: 'tabular-nums' }}>{a.jobs.length}</span>
                </button>
              )
            })}
          </div>
          <div data-house-ask-summary style={{ color: 'var(--text-700)' }}>
            <strong>{ask.jobs.length} {ask.jobs.length === 1 ? 'job' : 'jobs'}</strong> · ${formatCurrency(ask.owed)} owed by our books
            {ask.firstYmd ? <> · first notice {formatYmdMonthDay(ask.firstYmd)}</> : null}
            {ask.paidInFullJobs ? <span style={{ color: 'var(--text-red-700)', fontWeight: 600 }}> · {ask.paidInFullJobs} paid in full by the customer</span> : null}
            {ask.answered ? <> · {ask.answered} answered</> : null}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <span style={{ minWidth: 0 }}>
              {rep ? (
                <>
                  Ask <strong>{rep.name || 'the house'}</strong>
                  {rep.email ? <span style={{ color: 'var(--text-muted)' }}> · {rep.email}</span> : null}
                  {!rep.billing ? <span data-house-ask-rep-role style={{ color: 'var(--text-amber-800)' }}> · the {rep.roleWords} contact. No billing contact is on file.</span> : null}
                </>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>No one is on file for this house. Add a contact under Supply houses.</span>
              )}
            </span>
            <span style={{ flex: 1 }} />
            {rep?.phone ? <CallPhoneButton phone={rep.phone} ariaLabel={`Call ${rep.name || ask.name}`} /> : null}
            {mail ? (
              <a
                href={mail.href}
                data-house-ask-email
                onClick={() => {
                  if (!mail.whole) copy('The list is long, so the message is copied. Paste it into the email.')
                }}
                style={{ ...plainBtn, ...tall }}
              >
                Email the ask
              </a>
            ) : null}
            <button type="button" onClick={() => copy('Copied. Paste it into an email or a text.')} data-house-ask-copy style={{ ...plainBtn, ...tall }}>
              Copy the ask
            </button>
            <button type="button" onClick={() => setMessageOpen((o) => !o)} aria-expanded={messageOpen} style={{ border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', padding: 0 }}>
              {messageOpen ? 'Hide the message' : 'Read the message'}
            </button>
          </div>
          {messageOpen ? (
            <pre data-house-ask-message style={{ margin: 0, padding: '0.6rem 0.75rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)', font: 'inherit', fontSize: '0.8125rem', whiteSpace: 'pre-wrap', maxHeight: '30dvh', overflowY: 'auto' }}>
              {subject}
              {'\n\n'}
              {message}
            </pre>
          ) : null}
        </div>

        <div style={{ overflowY: 'auto', minHeight: 0 }}>
          {!isMobile ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1.1fr) minmax(0, 1.2fr) 130px 150px', gap: '0 12px', padding: '0.45rem 1rem', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--surface)' }}>
              <span>JOB</span>
              <span>OUR BOOKS</span>
              <span>ITS OWN NOTICE</span>
              <span>THEIR BALANCE</span>
              <span>THEIR NOTICE GOES OUT</span>
            </div>
          ) : null}
          {ask.jobs.map((j) => {
            const a = answerOf(ask, j)
            const nw = noticeWords(j, ask.name)
            const isBad = bad.has(j.jobId) || !parseSupplierWordBalance(a.balance).ok
            const paidNote = parseSupplierWordBalance(a.balance)
            const saysPaid = paidNote.ok && paidNote.value === 0 && j.owed > 0.005
            const job = (
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{j.number} · {j.name}</div>
                {j.address ? <div style={small}>{j.address}</div> : null}
                <div style={{ fontSize: '0.75rem', marginTop: 1 }}>
                  {j.customerPaidInFull ? <span style={{ color: 'var(--text-red-700)', fontWeight: 600 }}>customer paid in full</span> : <span style={{ color: 'var(--text-muted)' }}>customer owes us ${formatCurrency(j.openToUs)}</span>}
                </div>
              </div>
            )
            const books = (
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>${formatCurrency(j.owed)}</div>
                <div style={small}>
                  {j.unpaidCount} unpaid{j.unpaidSince ? ` · since ${j.unpaidSince}` : ''}
                </div>
              </div>
            )
            const notice = <div style={{ color: INK[nw.tone], fontWeight: nw.tone === 'amber' ? 600 : undefined, minWidth: 0 }}>{nw.text}</div>
            const balanceInput = (
              <input
                type="text"
                inputMode="decimal"
                value={a.balance}
                onChange={(e) => setAnswer(j, { balance: e.target.value })}
                placeholder="their figure"
                aria-label={`${ask.name}'s balance on ${j.number} ${j.name}`}
                aria-invalid={isBad}
                style={{ ...input, ...tall, ...(isBad ? { borderColor: 'var(--text-red-700)' } : null) }}
              />
            )
            const dayInput = <input type="date" value={a.noticeYmd} onChange={(e) => setAnswer(j, { noticeYmd: e.target.value })} aria-label={`The day ${ask.name}'s notice goes out on ${j.number} ${j.name}`} style={{ ...input, ...tall }} />
            const hints = (
              <>
                {isBad ? <div style={{ fontSize: '0.75rem', color: 'var(--text-red-700)' }}>Type the balance as a number, like 8,950.00.</div> : null}
                {saysPaid ? <div style={{ fontSize: '0.75rem', color: 'var(--text-amber-800)' }}>They show nothing owed. Our books show ${formatCurrency(j.owed)}: mark those invoices paid under Supply houses.</div> : null}
              </>
            )
            return isMobile ? (
              <div key={j.jobId} data-house-ask-job={j.number} style={{ padding: '0.65rem 1rem', borderBottom: '1px solid var(--border)', display: 'grid', gap: 6 }}>
                {job}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                  {books}
                  <div style={{ fontSize: '0.75rem', textAlign: 'right' }}>{notice}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                  <label style={{ display: 'grid', gap: 3, ...small }}>Their balance{balanceInput}</label>
                  <label style={{ display: 'grid', gap: 3, ...small }}>Notice goes out{dayInput}</label>
                </div>
                {hints}
              </div>
            ) : (
              <div key={j.jobId} data-house-ask-job={j.number} style={{ padding: '0.55rem 1rem', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1.1fr) minmax(0, 1.2fr) 130px 150px', gap: '0 12px', alignItems: 'center' }}>
                  {job}
                  {books}
                  <div style={{ fontSize: '0.75rem' }}>{notice}</div>
                  {balanceInput}
                  {dayInput}
                </div>
                {hints}
              </div>
            )
          })}
        </div>

        <div style={{ padding: '0.65rem 1rem', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, borderRadius: isMobile ? 0 : '0 0 10px 10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-600)', flex: '1 1 14rem', minWidth: 0 }}>
            <span style={{ whiteSpace: 'nowrap' }}>Who said it</span>
            <input type="text" value={who} onChange={(e) => setSaidBy((prev) => ({ ...prev, [ask.houseId]: e.target.value }))} style={{ ...input, ...tall, maxWidth: 240 }} />
          </label>
          <span data-house-ask-pending style={{ color: 'var(--text-muted)' }}>
            {bad.size > 0 ? 'Fix the balance marked in red.' : saves.length === 0 ? 'Type an answer to save it.' : `${saves.length} ${saves.length === 1 ? 'answer' : 'answers'} to save`}
          </span>
          <button type="button" disabled={busy} onClick={onClose} style={{ ...plainBtn, ...tall }}>
            {dirty ? 'Close without saving' : 'Close'}
          </button>
          <button type="button" disabled={busy || saves.length === 0 || bad.size > 0} onClick={() => void save()} style={{ ...plainBtn, ...tall, border: '1px solid transparent', background: '#2563eb', color: '#fff', opacity: busy || saves.length === 0 || bad.size > 0 ? 0.55 : 1 }}>
            {busy ? 'Saving…' : saves.length > 1 ? `Save ${saves.length} answers` : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
