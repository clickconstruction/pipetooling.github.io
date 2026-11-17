import type { ReactNode, RefObject } from 'react'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { correctionGateWords } from '../../lib/jobs/lienClaimCorrection'
import { LIEN_ASK_REASON_LABELS, PUBLIC_OWNER_DESK_SENTENCE, type LienAskReason, type draftReadiness } from '../../lib/jobs/lienDesk'
import { lienFootBlockedSentence, type LienGateKey, type buildLienDeskGates } from '../../lib/jobs/lienDeskGates'
import { lienFooter, type LienSignWay } from '../../lib/jobs/lienFooterMenu'
import type { LienDeskDraftFields } from '../../lib/jobs/lienNoticeDraft'
import type { LienPayOffer } from '../../lib/jobs/lienPayOffer'
import { setLienDeskItemOffer } from '../../lib/jobs/lienPayOfferIo'
import { LIEN_RUN_NOW_TO_PRINT } from '../../lib/jobs/lienRunWords'
import type { LienSentPacketFacts } from '../../lib/jobs/lienSentPacket'
import { defaultWordNote, wordRecordBlock } from '../../lib/jobs/lienWord'
import { demandDate } from '../../lib/jobsDocuments/demandLetter'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { lienBtnStyle as btn } from './lienDeskButtonStyles'
import type { LienNoticeFooterContext } from './LienDeskLeaderFooters'
import { LienFootMenu } from './LienFootMenu'
import type { LienNoticeSignLineFrame, LienNoticeSignLineHandle } from './LienNoticeSignLine'
import { LienWordRecordRow } from './LienWordRecordRow'

/** What the draft footer reads beyond the other footers' context (v2.7594): the draft itself, its gates and its ways to sign. */
export type LienDraftFooterContext = LienNoticeFooterContext & {
  /** Whether the draft can go (the readiness rule and something billed), the rule's own answer, and the gates' rows. */
  ready: boolean
  readiness: ReturnType<typeof draftReadiness>
  gates: ReturnType<typeof buildLienDeskGates>['gates']
  pickGate: (key: LienGateKey) => void
  paneRef: RefObject<HTMLDivElement | null>
  /** Why this notice asks the leader, and whether the GC's send rule is live. */
  askReason: LienAskReason | null
  ruleLive: boolean
  /** The pay offer on the draft. */
  offer: LienPayOffer | null
  /** The way he signs the draft, his code's readiness on someone else's screen, and the line when it is a pad or his code. */
  draftSignWay: LienSignWay
  setSignWay: (way: LienSignWay) => void
  codeReady: boolean
  signRef: RefObject<LienNoticeSignLineHandle>
  draftSignLine: (frame?: LienNoticeSignLineFrame) => ReactNode
  /** The draft row: its fields as they stand, the write that makes or saves it, and the autosave's word. */
  draftFields: () => LienDeskDraftFields
  ensureDraft: (fromAutosave?: boolean) => Promise<string>
  draftSave: 'idle' | 'saving' | 'saved'
  signItem: (itemId: string, fields: unknown, approveToo: boolean) => Promise<void>
  sendToLeader: () => unknown
  setPenDraft: (draft: { id: string; fields: unknown } | null) => void
  /** A notice already sent on this job (v2.6624): its first packet, letter two's clock and the three doors it keeps. */
  first: LienSentPacketFacts['first']
  lt: LienSentPacketFacts['lt']
  courtesyUnrecordedBand: ReactNode
  courtesyDoor: ReactNode
  letterTwoDoor: ReactNode
}

/**
 * The draft footer (v2.3776, punch list #36; its own file since v2.7594, out of `LienDesk.tsx` as it stood): one row,
 * the state and its why on the left and one press on the right. Blocked, the press is the way to the gate that
 * blocks. Open, it is Send for approval for the office, or Sign and approve for the leader, with Sign another way
 * and He signed the paper in the menus. The by-hand, pen and word records stand in for it while they are open.
 *
 * The leader's Sign and approve from a draft saves the draft, saves the offer and signs with the approval in one
 * press. It does not send the draft for approval first. That is as it was.
 */
export function LienDeskDraftFooter({ ctx }: { ctx: LienDraftFooterContext }) {
  const { selected, monthsList, todayYmd, authRole, authName, leader, office, otherScreen, busy, leaderName, gc, promise, claimGate, wordOpen, setWordOpen, wordNote, setWordNote, wordChannel, setWordChannel, wordPreview, offerProblem, offerBox, offerSwitch, byHandPane, penPane, sendOnWord, setByHandOpen, setPenOpen, run, askReason, codeReady, draftFields, draftSave, draftSignWay, ensureDraft, gates, offer, paneRef, pickGate, readiness, ready, ruleLive, sendToLeader, setPenDraft, setSignWay, signItem, signRef, draftSignLine, first, lt, courtesyUnrecordedBand, courtesyDoor, letterTwoDoor } = ctx
  const blocked = !ready
  // The draft footer (v2.3776, punch list #36): ONE row — the state and its verb on the left, Save draft and the primary
  // on the right (the quiet Skip left in v2.4743: a month nobody sends closes on its own and is noted as missed).
  // The envelope line sits above the paper; the why is a parenthetical, not a sentence. Blocked, the primary is the way to the gate that blocks (a dim dead button taught nothing).
  const firstBlocker = gates.find((g) => g.tone === 'blocker') ?? null
  // One press per footer (v2.7324): the kernel names the press, the line beside it and the menus; the route is
  // the office's — a live send rule puts it in the run, the hold rule parks it, a claim set by hand goes to him whatever the rule.
  const foot = lienFooter({
    role: authRole,
    paper: 'notice',
    leaderName,
    blocked,
    route: claimGate ? 'leader' : ruleLive && !promise ? 'run' : selected.policy === 'hold' && !promise ? 'hold' : 'leader',
    sign: { way: draftSignWay, otherScreen, codeReady },
    pen: monthsList.length > 0,
  })
  const pickDoor = (key: string) => {
    if (key === 'word') {
      setWordNote(defaultWordNote(leaderName, demandDate(todayYmd)))
      setWordOpen(true)
    } else if (key === 'pen') {
      // v2.7297: the pen door on the draft — the paper printed and he signed it; the record approves the notice on his word.
      void run('He signed the paper', async () => { const id = await ensureDraft(); setPenDraft({ id, fields: draftFields() }); setPenOpen(true) })
    } else if (key.startsWith('sign:')) {
      const way = key.slice(5) as LienSignWay
      setSignWay(way)
      signRef.current?.setMode(way)
    }
  }
  // Blocked, the footer says the stop and the one thing to do in plain words (v2.4797); the gate's button is the way there.
  const stateWords = blocked ? lienFootBlockedSentence(firstBlocker, monthsList.length) : foot.primary?.line ?? ''
  const stateWhy = blocked
    ? readiness.reason === 'public_owner'
      ? PUBLIC_OWNER_DESK_SENTENCE
      : ''
    : leader
      ? promise
        ? `they promised ${formatYmdMonthDay(promise.promisedYmd)} — the paper or their word`
        : askReason && askReason !== 'no_rule'
          ? LIEN_ASK_REASON_LABELS[askReason]
          : ''
      : claimGate
        ? correctionGateWords(claimGate)
        : ruleLive && !promise
          ? 'standing “send” rule'
          : selected.policy === 'send' && !promise
            ? 'first notice to this GC — the rule starts with the next one'
            : selected.policy === 'hold' && !promise
              ? 're-asks before the deadline'
              : promise
                ? `they promised ${formatYmdMonthDay(promise.promisedYmd)} — the paper or their word`
                : askReason && askReason !== 'no_rule'
                  ? LIEN_ASK_REASON_LABELS[askReason]
                  : `no standing rule for ${gc?.name ?? 'this GC'}`
  // v2.7386: with a pad or his code on the draft, the line's box holds the footer (the awaiting footer's shape, v2.7382); his typed name still needs no box.
  const draftBoxed = leader && !blocked && draftSignWay !== 'type' && foot.primary?.key === 'approve'
  const draftApprove = () => run('Sign and approve', async () => { const id = await ensureDraft(); await setLienDeskItemOffer(id, offer); await signItem(id, draftFields(), true) }, offer ? `Signed and approved with a ${offer.pct}% offer. ${LIEN_RUN_NOW_TO_PRINT}` : `Signed and approved. ${LIEN_RUN_NOW_TO_PRINT}`)
  const draftSavedWords = draftSave !== 'idle' ? <span className="lienFootWhy" data-lien-desk-saved={draftSave}> · {draftSave === 'saving' ? 'Saving…' : '✓ Saved'}</span> : null
  return (
    <>
      {byHandPane ? (
        byHandPane
      ) : penPane ? (
        penPane
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
          actionLabel="Approve on his word ▸"
          onAction={sendOnWord}
          actionDisabled={busy || !wordNote.trim()}
          actionBlock={wordRecordBlock(claimGate, wordChannel)}
          onCancel={() => setWordOpen(false)}
          btn={btn}
        />
      ) : (
        <>
        {leader && !blocked ? offerBox() : null}
        {leader && !blocked && draftSignWay !== 'type' && !draftBoxed ? draftSignLine() : null}
        {selected.sentItem && first ? (
          // The notice that went (v2.6624, punch list #248): its day, letter two's clock and its two doors ride above the draft row, so the next months draft while the reminders stay one press away.
          <div className="lienFootRow" data-lien-desk-sent-doors style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            <span>
              Sent <strong style={{ color: 'var(--text-700)' }}>{first.sent_at ? demandDate(calendarYmdInAppTzFromIso(first.sent_at)) : ''}</strong>
              {lt?.words ? ` · ${lt.words}` : lt?.day != null ? ` · day ${lt.day}` : ''} · the next notice drafts below
            </span>
            <span className="lienFootSpacer" />
            {courtesyUnrecordedBand}
            {courtesyDoor}
            {letterTwoDoor}
          </div>
        ) : null}
        {draftBoxed ? (
          <div data-lien-desk-next data-blocked="no">
            {draftSignLine({
              call: (
                <>
                  <span aria-hidden="true">→</span> {stateWhy ? stateWords.replace(/\.$/, '') : stateWords}
                </>
              ),
              note: (
                <>
                  {stateWhy ? <span className="lienFootWhy"> · {stateWhy}</span> : null}
                  {draftSavedWords}
                </>
              ),
              press: (
                <button type="button" className="lienSignFramePress" onClick={draftApprove} disabled={busy || Boolean(offerProblem)} title={foot.primary?.line} data-lien-desk-approve>
                  {foot.primary?.label}
                </button>
              ),
              strip: (
                <>
                  {foot.menus.map((m) => (
                    <LienFootMenu key={m.key} menu={m} disabled={busy} style={btn('plain', busy)} onPick={pickDoor} />
                  ))}
                  <span className="lienSignFramePush">
                    {offerSwitch()}
                    {foot.links.includes('by_hand') && monthsList.length > 0 ? (
                      <button type="button" className="lienFootLink" onClick={() => setByHandOpen(true)} disabled={busy} data-lien-desk-by-hand title="The paper was printed here and went out by hand — record when, how, what it claimed, and which jobs at the property it covered">Already mailed? Record it ›</button>
                    ) : null}
                  </span>
                </>
              ),
            })}
          </div>
        ) : (
        <div className="lienFootRow" data-lien-desk-next data-blocked={blocked ? 'yes' : 'no'}>
          <span className="lienFootState">
            <span aria-hidden="true">{blocked ? '✗' : '→'}</span> {stateWhy ? stateWords.replace(/\.$/, '') : stateWords}
            {stateWhy ? <span className="lienFootWhy"> · {stateWhy}</span> : null}
            {draftSavedWords}
          </span>
          <span className="lienFootSpacer" />
          {leader && !blocked ? offerSwitch() : null}
          {foot.links.includes('by_hand') && monthsList.length > 0 ? (
            <button type="button" className="lienFootSkip" onClick={() => setByHandOpen(true)} disabled={busy} data-lien-desk-by-hand title="The paper was printed here and went out by hand — record when, how, what it claimed, and which jobs at the property it covered">
              <span className="lienByHandWords">Already mailed?{' '}<br />Record it…</span>
            </button>
          ) : null}
          <div className="lienFootActions">
            {foot.menus.map((m) => (
              <LienFootMenu key={m.key} menu={m} disabled={busy} style={btn('plain', busy)} onPick={pickDoor} />
            ))}
            {blocked ? (
              <button type="button" onClick={() => (firstBlocker ? pickGate(firstBlocker.key) : paneRef.current?.scrollTo?.({ top: 0, behavior: 'smooth' }))} style={btn('primary')} data-lien-desk-go-to-gate>
                {firstBlocker ? `Go to gate ${firstBlocker.n} ▴` : 'Show what is missing ▴'}
              </button>
            ) : foot.primary?.key === 'approve' ? (
              <button type="button" onClick={draftApprove} disabled={busy || Boolean(offerProblem)} style={btn('green', busy || Boolean(offerProblem))} title={foot.primary.line} data-lien-desk-approve>
                {foot.primary.label}
              </button>
            ) : (
              <button type="button" onClick={sendToLeader} disabled={busy || !office} style={btn('primary', busy || !office)} title={foot.primary?.line} data-lien-desk-ask>
                {foot.primary?.label}
              </button>
            )}
          </div>
        </div>
        )}
        </>
      )}
    </>
  )
}
