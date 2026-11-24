import type { ReactNode } from 'react'
import type { LienDeskData, LienDeskGc, LienDeskJob } from '../../hooks/useLienDeskData'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { COURTESY_FROM_DAY, PROMISE_BUTTON, courtesyFooterSentence, type CourtesyPromise } from '../../lib/jobs/lienCourtesyNotice'
import { noteGcAuthorizedDirectPay, notePromiseOnNotice } from '../../lib/jobs/lienDeskIo'
import { letterTwoIsDue } from '../../lib/jobs/lienLetterTwo'
import { affidavitPileFor, ownerCallWords } from '../../lib/jobs/lienOwnerCall'
import type { LienSentPacketFacts } from '../../lib/jobs/lienSentPacket'
import { addJobPaymentPromise } from '../../lib/jobs/paymentChaseIo'
import { demandDate, demandMoney } from '../../lib/jobsDocuments/demandLetter'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { defaultSignoffAsk, type LegalSignoffState } from '../../lib/legal/legalAsks'
import { filingMailCostWords, filingMailLines, mailPiecesNeedingYou } from '../../lib/mail/lienMailPieces'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { lienBtnStyle as btn } from './lienDeskButtonStyles'
import { lienRowChipStyle as chip } from './lienDeskRowStyles'
import LienMailPieceDoors from './LienMailPieceDoors'
import LienTrackingOwedEditor from './LienTrackingOwedEditor'
import type { LienSentFooterForms } from './useLienSentFooterForms'
import { MoneyText } from '../Money'

/**
 * The footer of a sent notice (v2.3760; its own file since v2.7591, out of `LienDesk.tsx` as it stood): what has
 * happened since the packet went out, then one of four rows: what they promised for the rest (punch list #274), the
 * GC's written okay, the ask to counsel (v2.3790), or the sentence with the doors. The facts are
 * `lienSentPacketFacts`; the forms' state is the desk's (`useLienSentFooterForms`), so a typed line is kept
 * while the footer is off screen. It holds no state of its own.
 */
export function LienDeskSentFooter({
  forms,
  facts,
  signoff,
  signoffLine,
  legalSignoff,
  data,
  jobId,
  job,
  gc,
  office,
  busy,
  run,
  authName,
  onChanged,
  onOpenOwnerCall,
  doors,
  proof,
}: {
  /** The three inline forms' state, kept by the desk. */
  forms: LienSentFooterForms
  /** The sent packet's facts for this job (`lienSentPacketFacts`). */
  facts: LienSentPacketFacts
  /** Counsel's sign-off on this job, and its words; null with no matter at the firm. */
  signoff: LegalSignoffState | null
  signoffLine: string
  legalSignoff?: { stateFor: (jobId: string) => LegalSignoffState | null; ask: (jobId: string, text: string) => Promise<string | null> } | null
  data: LienDeskData | null
  jobId: string
  job: LienDeskJob | undefined
  gc: LienDeskGc | undefined
  office: boolean
  /** The desk's one press at a time (`useLienDeskRunner`). */
  busy: boolean
  run: (label: string, fn: () => Promise<void>, done?: string) => Promise<boolean>
  authName: string
  onChanged: () => void
  /** Record the owner's call…: the desk opens the dialog. */
  onOpenOwnerCall: () => void
  /** The doors a sent notice keeps, drawn last: the courtesy record, the courtesy notice and the attorney's letter. */
  doors: ReactNode
  /** What went out (`LienFilingMailProof`): the mailed files and each envelope's receipt, under the facts. */
  proof?: ReactNode
}) {
  const { first, lt, call, courtesy, courtesyClaim, sentFiling, trackingOwed, jobBalance } = facts
  const { gcOkayOpen, setGcOkayOpen, gcOkayNote, setGcOkayNote, signoffOpen, setSignoffOpen, signoffText, setSignoffText, promiseOpen, setPromiseOpen, promiseYmd, setPromiseYmd, promiseAmount, setPromiseAmount, promiseNote, setPromiseNote } = forms
  const noteOkay = () => {
    if (!first) return
    void run('Note the GC’s okay', async () => noteGcAuthorizedDirectPay(first, { name: authName, note: gcOkayNote }), 'Noted — the attorney’s letter is off; the owner may pay us against a release.').then((ok) => {
      if (ok) {
        setGcOkayOpen(false)
        setGcOkayNote('')
      }
    })
  }
  // Record what they promised (punch list #274, PR 3): the day goes on the job, as the Stages board's promise does, so every board reads one; the amount and their words stay on the notice.
  const promiseDay = /^\d{4}-\d{2}-\d{2}$/.test(promiseYmd) ? promiseYmd : null
  const promiseAmountN = promiseAmount.replace(/[$,\s]/g, '') === '' ? null : Number(promiseAmount.replace(/[$,\s]/g, ''))
  const promiseAmountBad = promiseAmountN != null && (!Number.isFinite(promiseAmountN) || promiseAmountN <= 0)
  const recordPromise = () => {
    if (!first || promiseAmountBad) return
    const record: CourtesyPromise = { at: new Date().toISOString(), by: authName, ymd: promiseDay, amount: promiseAmountN, note: promiseNote.trim() }
    void run(
      PROMISE_BUTTON,
      async () => {
        if (promiseDay) await addJobPaymentPromise({ jobId: jobId, ymd: promiseDay, saidBy: null, channel: null, note: promiseNote.trim() || null })
        await notePromiseOnNotice(first, record)
      },
      promiseDay ? `Recorded — the desk asks again ${formatYmdMonthDay(promiseDay)}.` : 'Recorded — the desk asks again a week after the payment.',
    ).then((ok) => {
      if (ok) {
        setPromiseOpen(false)
        setPromiseYmd('')
        setPromiseAmount('')
        setPromiseNote('')
      }
    })
  }
  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }} data-lien-since-sent>
        <span>Sent <strong style={{ color: 'var(--text-700)' }}>{first?.sent_at ? demandDate(calendarYmdInAppTzFromIso(first.sent_at)) : ''}</strong> · in the job's Lien window</span>
        {lt && lt.day != null ? <span>Day <strong style={{ color: 'var(--text-700)' }}>{lt.day}</strong></span> : null}
        <span>GC paid: <strong style={{ color: 'var(--text-700)' }}>{jobBalance <= 0.005 ? 'yes' : 'no'}</strong></span>
        <span>GC authorized direct pay: <strong style={{ color: 'var(--text-700)' }}>{lt?.gcAuthorized ? `yes · ${formatYmdMonthDay(calendarYmdInAppTzFromIso(lt.gcAuthorized.at))}${lt.gcAuthorized.note ? ` · ${lt.gcAuthorized.note}` : ''}` : 'no'}</strong></span>
        {sentFiling && trackingOwed.length ? <LienTrackingOwedEditor filing={sentFiling} onSaved={onChanged} /> : null}
        {sentFiling && (data?.mailPiecesByFiling?.[sentFiling.id]?.length ?? 0) > 0 ? (
          <span data-lien-mail-status style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.3rem 0.8rem' }}>
            {filingMailLines(data!.mailPiecesByFiling![sentFiling.id]!, formatYmdMonthDay).map((l) => (
              <span key={l.id}>Through Docsmit, {l.who.toLowerCase()}: <strong style={{ color: l.tone === 'green' ? 'var(--text-green-800)' : l.tone === 'red' ? 'var(--text-red-600)' : l.tone === 'amber' ? 'var(--text-amber-700, var(--text-amber-700))' : 'var(--text-700)' }}>{l.words}</strong>{l.tracking ? <span style={{ color: 'var(--text-muted)' }}> · {l.tracking}</span> : null}{l.cost ? <span style={{ color: 'var(--text-muted)' }}> · {l.cost}</span> : null}</span>
            ))}
            {filingMailCostWords(data!.mailPiecesByFiling![sentFiling.id]!) ? <span data-lien-mail-cost><MoneyText text={filingMailCostWords(data!.mailPiecesByFiling![sentFiling.id]!)} /></span> : null}
            {/* The doors (6b-3): under the lines, one set per envelope that came back, for the office. */}
            {office ? mailPiecesNeedingYou(data!.mailPiecesByFiling![sentFiling.id]!).map((p) => (
              <LienMailPieceDoors key={p.id} piece={p} jobNumber={job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) : null} onChanged={onChanged} />
            )) : null}
          </span>
        ) : null}
        {lt?.letterTwo ? <span>The attorney’s letter: <strong style={{ color: 'var(--text-700)' }}>{lt.words}</strong></span> : null}
        {signoff ? <span data-lien-counsel-signoff style={signoff.state === 'signed_off' ? { color: 'var(--text-green-800)' } : signoff.state === 'declined' ? { color: 'var(--text-red-600)' } : undefined}>Counsel: <strong style={{ color: 'inherit' }}>{signoffLine || 'not asked'}</strong></span> : null}
        <span data-lien-owner-called>Owner called: <strong style={{ color: 'var(--text-700)' }}>{call ? ownerCallWords(call, formatYmdMonthDay, formatUsdNoCents) : 'not yet'}</strong>{call && affidavitPileFor(call) ? <span style={{ ...chip('var(--bg-green-tint)', 'var(--text-green-800)'), marginLeft: 6 }}>Pile {affidavitPileFor(call)}</span> : null}</span>
        {courtesy && courtesy.state !== 'none' ? <span data-lien-courtesy-state={courtesy.state}>Courtesy notice: <strong style={{ color: courtesy.state === 'held' ? 'var(--text-red-600)' : 'var(--text-700)' }}>{courtesy.state === 'due' ? (courtesy.lastSentAt ? courtesy.words : 'not yet') : courtesy.state === 'waiting' ? `from day ${COURTESY_FROM_DAY}` : courtesy.state === 'held' ? courtesy.reason : courtesy.words}</strong></span> : null}
        {courtesy?.paying?.promise ? <span data-lien-promise>They promised: <strong style={{ color: 'var(--text-700)' }}>{[courtesy.paying.promise.amount ? formatUsdNoCents(courtesy.paying.promise.amount) : '', courtesy.paying.promise.ymd ? `by ${formatYmdMonthDay(courtesy.paying.promise.ymd)}` : '', courtesy.paying.promise.note ? `“${courtesy.paying.promise.note}”` : ''].filter(Boolean).join(' · ') || 'recorded'}{courtesy.paying.promise.by ? ` · ${courtesy.paying.promise.by}` : ''}</strong></span> : null}
      </div>
      {proof}
      {promiseOpen && courtesy?.state === 'paying' ? (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem' }} data-lien-promise-form>
          <span>What they promised for the rest ({formatUsdNoCents(courtesy.paying?.stillOwed ?? jobBalance)} still owed):</span>
          <input type="date" value={promiseYmd} onChange={(ev) => setPromiseYmd(ev.target.value)} aria-label="The day they promised" style={{ padding: '4px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', font: 'inherit', fontSize: '0.8125rem' }} />
          <input value={promiseAmount} onChange={(ev) => setPromiseAmount(ev.target.value)} placeholder={formatUsdNoCents(courtesy.paying?.stillOwed ?? jobBalance)} aria-label="The amount they promised" inputMode="decimal" style={{ width: 110, padding: '4px 8px', border: `1px solid ${promiseAmountBad ? 'var(--text-red-600)' : 'var(--border-strong)'}`, borderRadius: 6, background: 'var(--surface)', color: 'inherit', font: 'inherit', fontSize: '0.8125rem' }} />
          <input value={promiseNote} onChange={(ev) => setPromiseNote(ev.target.value)} placeholder="their words, who said it" aria-label="Their words" style={{ flex: '1 1 180px', padding: '4px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', font: 'inherit', fontSize: '0.8125rem' }} />
          <button type="button" onClick={recordPromise} disabled={busy || promiseAmountBad || (!promiseDay && !promiseAmountN && !promiseNote.trim())} style={btn('green', busy || promiseAmountBad || (!promiseDay && !promiseAmountN && !promiseNote.trim()))} data-lien-promise-record>Record it ▸</button>
          <button type="button" onClick={() => setPromiseOpen(false)} style={btn('plain')}>Cancel</button>
          <span style={{ flexBasis: '100%', color: 'var(--text-muted)' }}>{promiseDay ? `The desk asks again ${formatYmdMonthDay(promiseDay)}. The Stages board reads the same day.` : `With no day the desk asks again ${courtesy.paying ? formatYmdMonthDay(courtesy.paying.until) : 'a week after the payment'}.`} The lien’s day does not move.</span>
        </div>
      ) : gcOkayOpen ? (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem' }}>
          <span>The GC's written okay for the owner to pay us — where it is and when:</span>
          <input value={gcOkayNote} onChange={(ev) => setGcOkayNote(ev.target.value)} placeholder="email from Harborline, Sep 15" aria-label="The GC's okay — where and when" style={{ flex: '1 1 200px', padding: '4px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', font: 'inherit', fontSize: '0.8125rem' }} />
          <button type="button" onClick={noteOkay} disabled={busy || !gcOkayNote.trim()} style={btn('green', busy || !gcOkayNote.trim())} data-lien-gc-okay-record>Record it ▸</button>
          <button type="button" onClick={() => setGcOkayOpen(false)} style={btn('plain')}>Cancel</button>
        </div>
      ) : signoffOpen ? (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem' }} data-lien-desk-signoff>
          <span style={{ color: 'var(--text-muted)' }}>Ask counsel to sign off on {gc?.name ?? 'the GC'}'s job:</span>
          <input value={signoffText} onChange={(ev) => setSignoffText(ev.target.value)} aria-label="The ask" style={{ flex: '1 1 260px', padding: '4px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', font: 'inherit', fontSize: '0.8125rem' }} />
          <button type="button" disabled={busy || !signoffText.trim()} style={btn('primary', busy || !signoffText.trim())} onClick={() => void run('Ask counsel', async () => { const err = await legalSignoff!.ask(jobId, signoffText.trim()); if (err) throw new Error(err) }, 'Asked — the firm sees it on their portal; their answer lands on your Needs You list.').then((ok) => { if (ok) setSignoffOpen(false) })}>Send to the firm</button>
          <button type="button" onClick={() => setSignoffOpen(false)} style={btn('plain')}>Cancel</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          <span>
            {courtesy && (courtesy.state === 'due' || courtesy.state === 'sent' || courtesy.state === 'affidavit_week' || courtesy.state === 'paying') ? courtesyFooterSentence(courtesy, demandMoney(String(courtesyClaim))) : lt?.state === 'sent' ? 'The attorney’s letter went out. The next step is the affidavit, on its own date.' : lt?.state === 'gc_authorized' ? 'The GC said the owner may pay us — take the check against a release; no second letter.' : lt?.state === 'paid' || jobBalance <= 0.005 ? 'Paid — nothing more to send.' : lt && letterTwoIsDue(lt) ? `The attorney’s letter goes 10–14 days after the packet when the GC has neither paid nor authorized a direct payment — day ${lt.day}${lt.state === 'overdue' ? ', past the 14' : ''}. Same form, same two recipients, the GC copied by the same mail.` : `The attorney’s letter goes 10–14 days after the packet if the GC has neither paid nor authorized a direct payment${lt?.day != null ? ` — day ${lt.day} today` : ''}.`}
          </span>
          <span style={{ flex: 1 }} />
          {office && first && signoff && signoff.state !== 'asked' && jobBalance > 0.005 ? <button type="button" onClick={() => { setSignoffText(defaultSignoffAsk({ gcName: gc?.name ?? '', amount: `$${Math.round(jobBalance).toLocaleString('en-US')}` })); setSignoffOpen(true) }} disabled={busy} style={btn('plain', busy)} data-lien-desk-ask-signoff title="The owner wants to pay Click direct while the GC is silent — counsel signs off per job before the office takes the check (counsel's memo)">Ask counsel to sign off…</button> : null}
          {office && first ? <button type="button" onClick={onOpenOwnerCall} disabled={busy} style={btn('plain', busy)} data-lien-owner-call-door>{call ? 'The owner called again…' : 'Record the owner’s call…'}</button> : null}
          {office && first && courtesy?.state === 'paying' ? <button type="button" onClick={() => setPromiseOpen(true)} disabled={busy} style={btn(courtesy.paying?.promise ? 'plain' : 'amber', busy)} data-lien-promise-door title="They are paying it down. Record the day and the amount they gave for the rest; the desk asks again on that day. The day also reads on the Stages board.">{courtesy.paying?.promise ? 'They promised again…' : `${PROMISE_BUTTON}…`}</button> : null}
          {office && first && !lt?.gcAuthorized && jobBalance > 0.005 && lt?.state !== 'sent' ? <button type="button" onClick={() => setGcOkayOpen(true)} disabled={busy} style={btn('plain', busy)} data-lien-gc-okay>The GC authorized direct pay…</button> : null}
          {doors}
        </div>
      )}
    </>
  )
}
