import type { ReactNode } from 'react'
import type { LienDeskData, LienDeskGc } from '../../hooks/useLienDeskData'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { workMonthLabel } from '../../lib/jobs/forecastWorkMonths'
import type { correctionSendGate } from '../../lib/jobs/lienClaimCorrection'
import { LIEN_NOTICE_POLICIES, canSendLienOnWord as canSendOnWord, holdUntilFor, type LienDeskEntry, type LienNoticePolicy } from '../../lib/jobs/lienDesk'
import { confirmLienPenSignature, disownLienPenSignature } from '../../lib/jobs/lienDeskSignIo'
import { awaitingChip, heldChip, printedChip, readyChip, shortDay as footShortDay } from '../../lib/jobs/lienFootChip'
import { lienChipSigned, lienFieldsHash, signatureColumnsOf } from '../../lib/jobs/lienNoticeSignature'
import { lienOfferChipWords, lienOfferFromItem } from '../../lib/jobs/lienPayOffer'
import { lienRunOnePlan } from '../../lib/jobs/lienRunOne'
import { runTakenBackOf, takenBackChipWords } from '../../lib/jobs/lienRunTakeBack'
import { lienRunActLabel } from '../../lib/jobs/lienRunWords'
import { LIEN_SIGN_AGAIN_HINT, LIEN_SIGN_AGAIN_LABEL, signAgainOffered } from '../../lib/jobs/lienSignAgain'
import { defaultWordNote, wordRecordBlock, type LienWordChannel, type wordRecordPreview } from '../../lib/jobs/lienWord'
import { demandDate } from '../../lib/jobsDocuments/demandLetter'
import { lienBtnStyle as btn } from './lienDeskButtonStyles'
import { LienFootChipView as FootChip } from './LienFootChipView'
import type { LienNoticeSignLineCodeSigner, LienNoticeSignLineFrame } from './LienNoticeSignLine'
import { LienWordRecordRow } from './LienWordRecordRow'

/**
 * What a notice's footer reads from the Lien desk (v2.7593). The four footers here were branches of one block
 * inside `LienDesk.tsx`, and read the desk's selection, roles, words and presses directly. They read the same
 * things from this one object now, so each name is the desk's own and the move changes nothing. The desk builds
 * it for the job on the pane; the footers hold no state.
 */
export type LienNoticeFooterContext = {
  /** The job on the pane and its months, oldest first; `monthsWord` is how the footer says them. */
  selected: LienDeskEntry
  monthsList: string[]
  monthsWord: string
  todayYmd: string
  authRole: string | null
  authName: string
  /** The viewer is a lien leader, the office, and whether this screen is not the job's own leader's. */
  leader: boolean
  office: boolean
  otherScreen: boolean
  /** The desk's one press at a time (`useLienDeskRunner`). */
  busy: boolean
  run: (label: string, fn: () => Promise<void>, done?: string) => Promise<boolean>
  leaderName: string
  leaderNameFor?: (masterUserId: string | null) => string
  gc: LienDeskGc | undefined
  /** The leader's signing code on someone else's screen; null on his own. */
  codeSigner: LienNoticeSignLineCodeSigner | null
  promise: LienDeskData['promisesByJob'][string] | null
  claimGate: ReturnType<typeof correctionSendGate>
  counts: LienDeskData['queue']['counts'] | undefined
  runCount: number
  /** The leader's one-screen approve on a phone (v2.4881), its Details fold and its Not yet row. */
  simpleApprove: boolean
  detailsOpen: boolean
  notYetOpen: boolean
  setNotYetOpen: (open: boolean) => void
  holdOpen: 'promised' | 'call_first' | null
  setHoldOpen: (reason: 'promised' | 'call_first' | null) => void
  rulePick: LienNoticePolicy | null
  /** Approve on his word: the record's row, its words and how he said it. */
  wordOpen: boolean
  setWordOpen: (open: boolean) => void
  wordNote: string
  setWordNote: (note: string) => void
  wordChannel: LienWordChannel
  setWordChannel: (channel: LienWordChannel) => void
  wordPreview: ReturnType<typeof wordRecordPreview> | undefined
  /** Why the pay offer's day cannot stand; null when it can or there is no offer. */
  offerProblem: string | null
  /** The notice's signature line, and the pay offer's box and switch, drawn by the desk over its own signature ref and offer. */
  signLine: (compact?: boolean, frame?: LienNoticeSignLineFrame) => ReactNode
  offerBox: (onSave?: () => void, saved?: boolean) => ReactNode
  offerSwitch: () => ReactNode
  /** The by-hand and pen records' panes, which stand in for the footer while they are open; null otherwise. */
  byHandPane: ReactNode
  penPane: ReactNode
  approve: () => unknown
  signOnly: () => unknown
  sendOnWord: () => unknown
  pullBack: () => unknown
  saveOffer: () => unknown
  hold: (reason: 'promised' | 'call_first') => unknown
  backToReady: () => Promise<void>
  signAgain: () => Promise<void>
  setByHandOpen: (open: boolean) => void
  setPenOpen: (open: boolean) => void
  setRunOpen: (open: boolean) => void
  openRunOnOne: (itemId: string) => void
  monthlyRunNotices: (gcId: string | null, onlyItemId: string | null) => ReadonlyArray<NonNullable<Parameters<typeof lienRunOnePlan>[0]>>
}

/** A notice that waits on the leader (out of `LienDesk.tsx` as it stood): his line with Sign and approve, the hold reasons and the ways out; or, for the office, the waiting chip with Leader here, Approve and the word's record. */
export function LienDeskAwaitingFooter({ ctx }: { ctx: LienNoticeFooterContext }) {
  const { selected, monthsList, monthsWord, todayYmd, authRole, authName, leader, office, otherScreen, busy, leaderName, promise, claimGate, simpleApprove, detailsOpen, notYetOpen, setNotYetOpen, holdOpen, setHoldOpen, rulePick, wordOpen, setWordOpen, wordNote, setWordNote, wordChannel, setWordChannel, wordPreview, offerProblem, signLine, offerBox, offerSwitch, byHandPane, approve, sendOnWord, pullBack, hold, setByHandOpen } = ctx
  return byHandPane ?? (leader ? (
    <>
      {holdOpen ? (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem' }}>
          <span>
            Holds until <strong>{formatYmdMonthDay(holdUntilFor(holdOpen, selected.earliestDeadline, promise?.promisedYmd ?? null, todayYmd))}</strong>, then asks again.{' '}
            <span style={{ color: 'var(--text-red-600)' }}>{monthsList[0] ? `${workMonthLabel(monthsList[0])}'s lien right ends ${selected.earliestDeadline ? demandDate(selected.earliestDeadline) : ''}.` : ''}</span>
          </span>
          <button type="button" onClick={() => hold(holdOpen)} disabled={busy} style={btn('amber', busy)}>Hold</button>
          <button type="button" onClick={() => setHoldOpen(null)} style={btn('plain')}>Cancel</button>
        </div>
      ) : simpleApprove ? (
        notYetOpen ? (
          <div className="lienFootRow" data-lien-desk-not-yet>
            <button type="button" onClick={() => setHoldOpen('promised')} disabled={busy} style={btn('plain', busy)}>Hold — they promised…</button>
            <button type="button" onClick={() => setHoldOpen('call_first')} disabled={busy} style={btn('plain', busy)}>Hold — I'll call first</button>
            <button type="button" onClick={pullBack} disabled={busy} style={btn('plain', busy)}>Back to the office</button>
            <button type="button" onClick={() => setNotYetOpen(false)} style={btn('plain')}>Cancel</button>
          </div>
        ) : (
          <div data-lien-desk-phone-approve style={{ display: 'grid', gap: '0.5rem' }}>
            {signLine(true)}
            {detailsOpen ? offerSwitch() : null}
            <button type="button" onClick={approve} disabled={busy || Boolean(offerProblem)} style={{ ...btn('green', busy || Boolean(offerProblem)), width: '100%', padding: '12px 14px', fontSize: '1rem' }}>Sign and approve ▸</button>
            <button type="button" onClick={() => setNotYetOpen(true)} disabled={busy} style={{ ...btn('plain', busy), width: '100%', padding: '10px 14px' }}>Not yet</button>
          </div>
        )
      ) : (
        <>
        {offerBox()}
        {/* v2.7382 (Taunya's ask): one box. The paper on the left, the call and the one press beside it with the code, the other ways out as a quiet strip. */}
        <div data-lien-desk-next data-blocked="no">
          {signLine(false, {
            call: (
              <>
                <span aria-hidden="true">→</span> Your call on {monthsWord}
              </>
            ),
            note: rulePick ? <span className="lienFootWhy"> · keeps the rule “{LIEN_NOTICE_POLICIES.find((p) => p.key === rulePick)?.label}”</span> : null,
            press: (
              <button type="button" className="lienSignFramePress" onClick={approve} disabled={busy || Boolean(offerProblem)}>Sign and approve &amp; next ▸</button>
            ),
            strip: (
              <>
                <span className="lienSignFrameLead">Not yet</span>
                <button type="button" className="lienFootLink" onClick={() => setHoldOpen('promised')} disabled={busy}>Hold — they promised…</button>
                <button type="button" className="lienFootLink" onClick={() => setHoldOpen('call_first')} disabled={busy}>Hold — I'll call first</button>
                <button type="button" className="lienFootLink" onClick={pullBack} disabled={busy}>Back to the office</button>
                <span className="lienSignFramePush">
                  {offerSwitch()}
                  <button type="button" className="lienFootLink" onClick={() => setByHandOpen(true)} disabled={busy} data-lien-desk-by-hand title="The paper was printed here and already went out by hand — record it instead of approving">Already mailed? Record it ›</button>
                </span>
              </>
            ),
          })}
        </div>
        </>
      )}
    </>
  ) : wordOpen ? (
    <LienWordRecordRow
      note={wordNote}
      onNote={setWordNote}
      channel={wordChannel}
      onChannel={setWordChannel}
      radioName="word-channel"
      recorderName={authName}
      leaderName={leaderName}
      preview={wordPreview}
      leadIn="Leader here"
      actionLabel="Approve on his word ▸"
      onAction={sendOnWord}
      actionDisabled={busy || !wordNote.trim()}
      actionBlock={wordRecordBlock(claimGate, wordChannel)}
      onCancel={() => setWordOpen(false)}
      btn={btn}
    />
  ) : (
    <>
    {otherScreen && office ? (
      // v2.5791: the master signs on the office's screen with his code or his hand; the spoken word stays the other door.
      <div data-lien-desk-office-sign style={{ marginBottom: '0.5rem' }}>
        {signLine(false, {
          call: (
            <>
              <span aria-hidden="true">→</span> His code or his hand here
            </>
          ),
          note: <span className="lienFootWhy"> · The record names your screen.</span>,
          press: (
            <button type="button" className="lienSignFramePress" onClick={approve} disabled={busy} data-lien-desk-office-sign-press>Sign and approve ▸</button>
          ),
        })}
      </div>
    ) : null}
    <div className="lienFootRow" data-lien-desk-foot="awaiting">
      <FootChip chip={awaitingChip(selected.item)} data-lien-desk-awaiting-words />
      <span className="lienFootSpacer" />
      <button type="button" className="lienFootLink" onClick={() => setByHandOpen(true)} disabled={!office || busy} data-lien-desk-by-hand title="The paper was printed here and already went out by hand — record it, and this stops waiting">
        Already mailed? Record it ›
      </button>
      {canSendOnWord(authRole) ? (
        <button type="button" className="lienFootLink" onClick={pullBack} disabled={busy || !office}>Pull back to draft</button>
      ) : (
        <button type="button" onClick={pullBack} disabled={busy || !office} style={btn('plain', busy || !office)}>Pull back to draft</button>
      )}
      {canSendOnWord(authRole) ? (
        <button
          type="button"
          onClick={() => { setWordNote(defaultWordNote(leaderName, demandDate(todayYmd))); setWordChannel('standing_over'); setWordOpen(true) }}
          disabled={busy}
          style={btn('primary', busy)}
          data-lien-desk-leader-here
          title="The leader is beside you — write down that he is standing here or typing it in, and it goes to Approved · to print on his word. This is the approval step."
        >
          Leader here, Approve ▸
        </button>
      ) : null}
    </div>
    </>
  ))
}

/** An approved notice, ready to print (as it stood): the offer, the signature line while it is unsigned, a pen or code signature waiting on his word, and the row with the run's two presses. */
export function LienDeskReadyFooter({ ctx }: { ctx: LienNoticeFooterContext }) {
  const { selected, monthsWord, leader, office, otherScreen, busy, leaderName, leaderNameFor, gc, codeSigner, runCount, signLine, offerBox, offerSwitch, byHandPane, penPane, signOnly, pullBack, saveOffer, signAgain, setByHandOpen, setPenOpen, setRunOpen, openRunOnOne, monthlyRunNotices, run } = ctx
  const itemOffer = lienOfferFromItem(selected.item)
  const readySignedRaw = selected.item ? lienChipSigned(signatureColumnsOf(selected.item), lienFieldsHash(selected.item.fields)) : null
  const readyDevice = selected.item ? signatureColumnsOf(selected.item).signed_on_device_of : null
  const readySigned = readySignedRaw && readySignedRaw !== 'unsigned' ? { ...readySignedRaw, recordedByName: readySignedRaw.recordedBy ? (leaderNameFor?.(readySignedRaw.recordedBy) ?? null) : null, onDeviceName: readyDevice ? (leaderNameFor?.(readyDevice) ?? null) : null } : readySignedRaw
  // The pen train, PR 3, and the code (v2.5791): a signature placed for him — by the office's pen record, or by his own code on someone else's screen — waits on his word; nothing blocks on it.
  const penAwaits = readySigned && readySigned !== 'unsigned' && (readySigned.mode === 'pen' || readySigned.mode === 'code') && !readySigned.confirmedAt
  const codeAwaits = Boolean(penAwaits && readySigned && typeof readySigned === 'object' && readySigned.mode === 'code')
  // v2.7386: an unsigned ready notice's line is the footer's box; Sign ▸ sits beside the code and the row is the box's strip.
  const readyBoxed = (leader || (office && otherScreen)) && readySigned === 'unsigned'
  // Just this one (v2.7512): what the run would print for this notice alone, counted by the run's own envelopes.
  const readyItemId = selected.item?.id ?? null
  const onePlan = lienRunOnePlan(readyItemId ? monthlyRunNotices(null, readyItemId)[0] : null)
  const readyRow = (
    <div className="lienFootRow" data-lien-desk-foot="ready">
      <FootChip chip={readyChip(selected.item, gc?.name, itemOffer ? lienOfferChipWords(itemOffer) : null, leaderName, takenBackChipWords(runTakenBackOf(selected.item?.fields)), readySigned)} data-lien-desk-ready-words />
      {leader && selected.item?.approval_mode === 'word' ? (
        <button type="button" className="lienFootLink" onClick={pullBack} disabled={busy} title="Pull it back to the office's draft — it has not gone out">Not what I said</button>
      ) : null}
      <span className="lienFootSpacer" />
      {leader ? offerSwitch() : null}
      {office && readySigned === 'unsigned' ? (
        <button type="button" className="lienFootLink" onClick={() => setPenOpen(true)} disabled={busy} data-lien-desk-pen title="He signed the printed paper with a pen: write down who, when, how you know, and add the signed page">
          He signed the paper ›
        </button>
      ) : null}
      {signAgainOffered({ item: selected.item, office, leader, disownOffered: Boolean(leader && !otherScreen && penAwaits) }) ? (
        <button type="button" className="lienFootLink" onClick={() => void signAgain()} disabled={busy} data-lien-desk-sign-again title={LIEN_SIGN_AGAIN_HINT}>
          {LIEN_SIGN_AGAIN_LABEL}
        </button>
      ) : null}
      <button type="button" className="lienFootLink" onClick={() => setByHandOpen(true)} disabled={!office || busy} data-lien-desk-by-hand title="The paper was printed here and already went out by hand. Record it here instead of printing and mailing it again">
        Already mailed? Record it ›
      </button>
      <button type="button" className="lienFootLink" onClick={() => (readyItemId ? openRunOnOne(readyItemId) : undefined)} disabled={!office || !readyItemId} title={onePlan.title} data-lien-desk-just-this-one data-envelopes={onePlan.sets.length} data-held={onePlan.held.length}>
        {onePlan.label}
      </button>
      <button type="button" onClick={() => setRunOpen(true)} disabled={!office} style={btn('primary', !office)} title="Every approved notice as one packet and one tracking form">
        {lienRunActLabel('print', runCount)} ▸
      </button>
    </div>
  )
  return byHandPane ?? penPane ?? (
    <>
    {leader ? offerBox(saveOffer, itemOffer != null) : null}
    {/* v2.6733 (punch list #150): the office's Ready footer carries the master's line too — his code or his hand on this screen, beside the pen record. */}
    {readyBoxed
      ? signLine(false, {
          call: (
            <>
              <span aria-hidden="true">→</span> {otherScreen ? `${codeSigner?.firstName ?? 'The leader'}’s signature` : 'Your signature'} on {monthsWord}
            </>
          ),
          press: leader ? (
            <button type="button" className="lienSignFramePress" onClick={signOnly} disabled={busy} data-lien-desk-sign title={otherScreen ? `Approved on his word; ${codeSigner?.firstName ?? 'the leader'} signs here with his code or his hand, and the record names your screen` : 'Approved on your word; your signature goes on the paper'}>Sign ▸</button>
          ) : (
            <button type="button" className="lienSignFramePress" onClick={signOnly} disabled={busy} data-lien-desk-office-sign-press title="His code or his hand here. The record names your screen">Sign ▸</button>
          ),
          strip: readyRow,
        })
      : null}
    {leader && !otherScreen && penAwaits && selected.item ? (
      // The pen train, PR 3: the office wrote down his pen signature; his word strengthens the record, his No clears it.
      // v2.6734: his word alone — on another master's job the group is not drawn, since the guard takes a confirm only from the signer's own sign-in.
      <div data-lien-desk-pen-confirm data-lien-desk-confirm-mode={codeAwaits ? 'code' : 'pen'} role="group" aria-label={codeAwaits ? 'A signature by your code, waiting on your word' : 'A pen signature recorded for you'} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', padding: '0.5rem 0.75rem', marginBottom: '0.5rem', borderRadius: 8, border: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)', fontSize: '0.8125rem' }}>
        <span style={{ flex: '1 1 16rem' }}>
          {codeAwaits ? (
            <>
              <strong>Your signing code signed this notice</strong> on {(readySigned.onDeviceName ?? '').trim() || 'the office'}’s screen{readySigned.at ? ` · ${footShortDay(readySigned.at)}` : ''}. Nothing waits on your word; it makes the record stronger. Not you? Press Not me, then change your code under Settings, Your account.
            </>
          ) : (
            <>
              <strong>{(readySigned.recordedByName ?? '').trim() || 'The office'} recorded your pen signature</strong> on this notice{readySigned.at ? ` · signed ${footShortDay(readySigned.at)}` : ''}. Nothing waits on your word; it makes the record stronger.
            </>
          )}
        </span>
        <button type="button" onClick={() => run(codeAwaits ? 'Confirm the code signature' : 'Confirm the pen signature', () => confirmLienPenSignature(selected.item!.id), 'Confirmed — the record carries your word too.')} disabled={busy} style={btn('green', busy)} data-lien-desk-pen-yes>{codeAwaits ? 'Yes, it was me ▸' : 'Yes, I signed it ▸'}</button>
        <button type="button" className="lienFootLink" onClick={() => run(codeAwaits ? 'Disown the code signature' : 'Disown the pen signature', () => disownLienPenSignature(selected.item!.id), 'Cleared — the notice is unsigned again and the run holds it.')} disabled={busy} data-lien-desk-pen-no title="The record is wrong: it clears, the approval stands, and the run holds the notice until it is signed again">{codeAwaits ? 'Not me' : 'Not what I signed'}</button>
      </div>
    ) : null}
    {readyBoxed ? null : readyRow}
    </>
  )
}

/** A printed notice (v2.4568, as it stood): back to Approved, already mailed, and the run as the checklist where its mail numbers go. */
export function LienDeskPrintedFooter({ ctx }: { ctx: LienNoticeFooterContext }) {
  const { selected, office, busy, counts, runCount, byHandPane, backToReady, setByHandOpen, setRunOpen } = ctx
  // v2.4568: a printed notice had no footer at all. The run is where its tracking numbers are typed and the mailing recorded.
  const printedAt = (selected.item as { printed_at?: string | null } | null)?.printed_at ?? null
  return byHandPane ?? (
    <div data-lien-desk-printed-footer className="lienFootRow" data-lien-desk-foot="printed">
      <FootChip chip={printedChip({ printed_at: printedAt })} />
      <span className="lienFootSpacer" />
      <button type="button" className="lienFootLink" onClick={() => void backToReady()} disabled={!office || busy} title="It was not mailed: put it back in Approved · to print. The approval stands, and a signature on it comes off">
        Back to Approved · to print
      </button>
      <button type="button" className="lienFootLink" onClick={() => setByHandOpen(true)} disabled={!office || busy} data-lien-desk-by-hand title="The paper already went out by hand. Record it here instead of entering mail numbers">
        Already mailed? Record it ›
      </button>
      <button type="button" onClick={() => setRunOpen(true)} disabled={!office} style={btn('primary', !office)} title="The run as a checklist: this notice's Printed, Signed and Mailed ticks, the tracking box under Mailed">
        {lienRunActLabel('record', counts?.printed ?? runCount)} ▸
      </button>
    </div>
  )
}

/** A held notice (as it stood): why it is held and when the lien right ends, with the leader's line to release it. */
export function LienDeskHeldFooter({ ctx }: { ctx: LienNoticeFooterContext }) {
  const { selected, monthsList, monthsWord, leader, office, busy, gc, signLine, byHandPane, approve, pullBack, setByHandOpen } = ctx
  const heldRow = (
    <div className="lienFootRow" data-lien-desk-foot="held">
      <FootChip chip={heldChip(selected.item, gc?.name)} data-lien-desk-held-words />
      {monthsList[0] ? <span className="lienFootRed">{`${workMonthLabel(monthsList[0])}'s lien right ends ${selected.earliestDeadline ? demandDate(selected.earliestDeadline) : ''}.`}</span> : null}
      <span className="lienFootSpacer" />
      <button type="button" className="lienFootLink" onClick={() => setByHandOpen(true)} disabled={!office || busy} data-lien-desk-by-hand title="The paper was printed here and already went out by hand — record it, and this stops waiting">
        Already mailed? Record it ›
      </button>
      {leader ? (
        <>
          <button type="button" className="lienFootLink" onClick={pullBack} disabled={busy || !office}>Back to draft</button>
        </>
      ) : (
        <button type="button" onClick={pullBack} disabled={busy || !office} style={btn('plain', busy || !office)}>Back to draft</button>
      )}
    </div>
  )
  return byHandPane ?? (
    <>
    {/* v2.7386: his line is the footer's box. The press that releases the hold sits beside the code and the row is the box's strip. */}
    {leader
      ? signLine(false, {
          call: (
            <>
              <span aria-hidden="true">→</span> Your call on {monthsWord}
            </>
          ),
          press: (
            <button type="button" className="lienSignFramePress" onClick={approve} disabled={busy}>Release the hold, sign and approve ▸</button>
          ),
          strip: heldRow,
        })
      : heldRow}
    </>
  )
}
