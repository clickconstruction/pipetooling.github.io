import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useToastContext } from '../../../../contexts/ToastContext'
import { useOptionalAuth } from '../../../../hooks/useAuth'
import { openFlowStep, useFlowNow } from '../../../../hooks/useFlowNow'
import { SEED_FLOWS } from '../../../../lib/flows/seed'
import { NOTE_BACK_PRESS, NOTE_BACK_TIP, noteBackToast } from '../../../../lib/followUp/queue'
import { OWED_DONE_NEEDS_A_NOTE, OWED_DONE_PLACEHOLDER, OWED_DONE_SEND, OWED_DONE_TOAST, type DayKept } from '../../../../lib/messages/owed'
import { todayYmdInAppTz, ymdDaysBetween } from '../../../../utils/dateUtils'
import { NoteBackDay } from '../../../followUp/NoteBackDay'
import { SettlingNote } from '../../../followUp/SettlingNote'
import { useOwedSettling } from '../../../followUp/useOwedSettling'
import { fillLine } from '../../../../lib/quickReplies/blanks'
import { replyFills, sendWaits } from '../../../../lib/quickReplies/filling'
import { appLinesForStage, isAppLine } from '../../../../lib/messages/stageLines'
import { lineWords } from '../../../../lib/quickReplies/spanish'
import { customerLang } from '../../../../lib/messages/customerLang'
import { findWhere, qrKindOf, stepsByKind, type QuickReply } from '../../../../lib/quickReplies/kernel'
import { paperTeamLine, SLASH_HINT, slashHead, slashLines, slashMove, slashPaperKind, slashPick, slashTotal, slashWordAt } from '../../../../lib/quickReplies/slash'
import { supabaseQuickRepliesIo, type QuickRepliesIo } from '../../../../lib/quickReplies/quickRepliesIo'
import {
  boxPlaceholder,
  countLine,
  defaultReplyKind,
  fromLine,
  goesOut,
  NOTE_ASIDE,
  REPLY_KINDS,
  replyRecipient,
  sentWords,
  textBoxBlocked,
  type ComposeCompany,
  type ReplyKind,
} from '../../../../lib/messages/compose'
import { lastWroteTo, type BoxSettings } from '../../../../lib/messages/boxes'
import { jobRefOf } from '../../../../lib/messages/jobKeys'
import { defaultPaperFills, listedPapers, paperFills, paperLineWords, papersTitle, type Paper } from '../../../../lib/messages/papers'
import { supabasePapersIo, type PapersIo } from '../../../../lib/messages/papersIo'
import { replyCompany, replyJob, tieWords, TIE_TIP, type ReplyTie } from '../../../../lib/messages/replyBox'
import { loadBoxSettings, SENDS_FROM_BOXES, supabaseReplyIo, type ReplyIo } from '../../../../lib/messages/replyIo'
import { TextsWaitLine } from './TextsWaitLine'
import { supabaseAttachIo, type AttachIo } from '../../../../lib/messages/attachIo'
import { addDraftFile, chipHover } from '../../../../lib/documents/outgoing'
import { sizeWords } from '../../../../lib/documents/jobFiles'
import { audienceOf, STARRED_FORMS, type ReplyFile } from '../../../../lib/messages/replyFiles'
import { portalHasPage } from '../../../../lib/documents/jobFiles'
import { FLOW_PAPERS } from '../../../../lib/flows/facts'
import { firstName, type Contact } from '../../../../lib/contacts/kernel'
import { formatErrorMessage } from '../../../../utils/errorHandling'
import { Btn } from '../../gcUi'
import { JobPickerWindow } from '../JobPickerWindow'
import { useOpenThread } from '../openThread'
import { useMessagesReread } from '../useMessagesReread'
import { AttachPicker } from './AttachPicker'
import { FindReplyWindow } from './FindReplyWindow'
import { QuickRepliesEditor } from './QuickRepliesEditor'
import { CUSTOMER_BAR, CUSTOMER_LOOK, KIND_LOOK, RING } from './kindLook'
import { QuickRepliesStrip } from './QuickRepliesStrip'
import { SendWindow } from './SendWindow'
import { SlashList } from './SlashList'
import { usePapers } from './usePapers'
import { useQuickReplies } from './useQuickReplies'
import { useTextsOn } from './useTextsOn'

/** The flows' steps for each kind of person, to name a line's step. The seed until the flows table is read here. */
const STEPS = stepsByKind(SEED_FLOWS)

/** The Text tab's words while Send texts is off, in the send window's amber. */
const WAIT_LOOK = { margin: 0, fontSize: '0.85rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', borderRadius: 6, padding: '0.45rem 0.6rem' } as const

/** The strip's fold is kept on this computer, as the prototype kept it. */
const QR_OPEN_KEY = 'msgQrOpen'
const readOpen = (): boolean => {
  try {
    return localStorage.getItem(QR_OPEN_KEY) === '1'
  } catch {
    return false
  }
}
/** The person folded the strip themselves, so a job's box leaves it folded (v2.5629). */
const foldedByHand = (): boolean => {
  try {
    return localStorage.getItem(QR_OPEN_KEY) === '0'
  } catch {
    return false
  }
}
const keepOpen = (open: boolean) => {
  try {
    localStorage.setItem(QR_OPEN_KEY, open ? '1' : '0')
  } catch {
    // A browser that keeps nothing still folds and opens; it just forgets.
  }
}

/**
 * Messages, cut 3's screens: the reply box at the foot of a person's thread (`ThreadSlots.box`). The kinds row (Text,
 * Email, Note, the chosen one ringed), the box in the kind's colour with the from line floating in it while it is empty,
 * the count line under it, then *Tie to* at the left and the send at the right. A note goes from here; a text or an
 * email opens the send window first, where nothing goes until its Send. Every word is `compose.ts`'s.
 *
 * It reads the open thread (`useOpenThread`) for the job in view, the rail and our texts; with no window around it (a
 * smoke) it still draws, with no choices for *Tie to*.
 *
 * In a job's window (residential R2) it is given `job`: the reply is tied to that job, *Tie to* names it with no
 * picker, and a text or an email to a customer takes the customer's orange (`CUSTOMER_LOOK`). `kinds` keeps the kinds
 * it offers; with one, the caller's own row chose it and the box draws none.
 *
 * R3: a quick reply goes into the box with its blanks filled from what the box knows (`replyFills`: their first name,
 * yours, the job's name in a job's window or the tied job's). A blank it cannot fill stays in the words, and a text or an email waits until the
 * person fills it (`sendWaits`). A line goes in the language the person reads (`customerLang`), which stays English
 * until the owner's one switch for Spanish, `PORTAL_SPANISH_ON`, is on.
 *
 * Quick replies by keyboard (punch list #126): a `/` at the start of the box, or after a space or a line break, opens
 * `SlashList` above the box, narrowed by the words after it (`quickReplies/slash.ts`). ↑ ↓ move, Enter or Tab puts the
 * line in place of the `/` word, Escape closes the list and nothing else, and a pick counts as a press.
 *
 * Cut 5's switch: while Send texts reads off (`useTextsOn`), the Text tab draws `TextsWaitLine` in place of the strip, the
 * box and the send row, so nobody writes a text the server would refuse. The kinds row stays, to choose an email.
 */
export function ReplyBox({
  contact,
  io: ioGiven,
  quickIo,
  papersIo,
  job,
  billLink = null,
  stageStepIds = [],
  openStrip = false,
  kinds,
  attachIo,
  loadBoxes = loadBoxSettings,
}: {
  contact: Contact
  io?: ReplyIo
  quickIo?: QuickRepliesIo
  /** Punch list #127: the customer's bills and estimates, for `{amount}`, `{number}` and `{bill}`; a smoke hands its own. */
  papersIo?: PapersIo
  /** The job's window: the job every reply here is tied to, and its name. */
  job?: { key: string; name: string }
  /** The job's newest billed bill's pay page, for `{bill}` (v2.5628): the job's box and the Pipeline's sheet read it; the thread's foot has no one job. */
  billLink?: string | null
  /** A job's box (v2.5629): the steps the job's stage speaks to; their lines lead the strip, the app's own words standing in for a step with no team line. */
  stageStepIds?: readonly string[]
  /** A job's box opens the strip on its own, unless the person folded it by hand. */
  openStrip?: boolean
  /** The kinds it offers, in `REPLY_KINDS`' order. All three when left out. */
  kinds?: readonly ReplyKind[]
  /** What Attach reads (cut 7f): the job's files, their portal, a file from this computer. */
  attachIo?: AttachIo
  /** The two boxes as Settings keeps them (R6), for the from line; a smoke hands its own. */
  loadBoxes?: () => Promise<BoxSettings | null>
}) {
  const open = useOpenThread()
  const reread = useMessagesReread()
  const { showToast } = useToastContext()
  const auth = useOptionalAuth()
  const me = auth?.user?.id ?? ''
  const io = useMemo(() => ioGiven ?? supabaseReplyIo(), [ioGiven])
  const qio = useMemo(() => quickIo ?? supabaseQuickRepliesIo(), [quickIo])
  const aio = attachIo ?? supabaseAttachIo
  const to = useMemo(() => replyRecipient(contact), [contact])
  const offered = useMemo(() => REPLY_KINDS.filter((k) => !kinds || kinds.includes(k.kind)), [kinds])
  const [chosen, setKind] = useState<ReplyKind>(() => defaultReplyKind(to))
  // The kind it was on, while it is offered; else the first it offers (the caller's row moved it).
  const kind: ReplyKind = offered.some((k) => k.kind === chosen) ? chosen : (offered[0]?.kind ?? chosen)
  const [stripOpen, setStripOpen] = useState(readOpen)
  const [finding, setFinding] = useState(false)
  // The quick replies editor is open; its add row starts with these words when there are any (the prototype's editQuick).
  const [adding, setAdding] = useState<string | null>(null)
  const [body, setBody] = useState('')
  // Punch list #126: where the caret is, so a `/` word at it opens the list; the lines are read the first time it does.
  const [caret, setCaret] = useState(0)
  const slashTyped = slashWordAt(body, caret)
  // A job's box opens the strip on its own (v2.5629), so its lines are read then too, not only the app's stage line.
  const stripShown = stripOpen || (openStrip && !foldedByHand())
  const quick = useQuickReplies(qio, me, goesOut(kind) && (stripShown || finding || slashTyped !== null))
  // #127: their bills and estimates, read when the lines are, so a line about money fills from the right bill.
  const pio = useMemo(() => papersIo ?? supabasePapersIo(), [papersIo])
  const papers = usePapers(pio, contact.kind === 'customer' ? (contact.customerId ?? null) : null, goesOut(kind) && (stripShown || finding || slashTyped !== null))
  const [tie, setTie] = useState<ReplyTie>(undefined)
  const [picking, setPicking] = useState(false)
  const [sending, setSending] = useState<'text' | 'email' | null>(null)
  // Cut 7f: the files on the reply, Attach's picker, and whether a link to their portal is on.
  const [files, setFiles] = useState<ReplyFile[]>([])
  const [attaching, setAttaching] = useState(false)
  const [hasPortal, setHasPortal] = useState(false)
  const audience = audienceOf(contact.kind)
  // Read by the person's parts, since the contact object is new on every read of the thread.
  const { kind: whoKind, gcCompanyId, customerId } = contact
  useEffect(() => {
    let live = true
    aio.hasPortal({ kind: whoKind, gcCompanyId, customerId }).then(
      (on) => live && setHasPortal(on),
      () => live && setHasPortal(false),
    )
    return () => {
      live = false
    }
  }, [aio, whoKind, gcCompanyId, customerId])
  const [busy, setBusy] = useState(false)
  // Cut 2: marking what we owe done with a team note (the owed strip's press), and a note's day to come back.
  const settling = useOwedSettling(contact.id)
  const [back, setBack] = useState<DayKept | null>(null)
  const [backOpen, setBackOpen] = useState(false)
  const [settleProblem, setSettleProblem] = useState<string | null>(null)
  // While a settle is under way the box is a team note; the kind chosen comes back after it, untouched.
  const shown: ReplyKind = settling.active ? 'note' : kind
  // Until the switch is read the box draws as before; the send window holds the text until it reads on.
  const textsOn = useTextsOn()
  const textWaits = shown === 'text' && textsOn === false

  const jobFilter = open?.jobFilter ?? null
  const jobKey = job ? job.key : replyJob(tie, jobFilter, contact.defaultJobId)
  const tiles = open?.tiles ?? {}
  const tieLabel = tieWords(tie, jobFilter, contact.defaultJobId, tiles)
  // The box it goes from (R6): the one they last wrote to, else their kind's. Read only once the sends use the boxes.
  const [boxes, setBoxes] = useState<BoxSettings | null>(null)
  useEffect(() => {
    if (!SENDS_FROM_BOXES) return
    let live = true
    loadBoxes()
      .then((b) => live && setBoxes(b))
      // Unread, the from line keeps today's words, which name no box.
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [loadBoxes])
  const lines = open?.lines
  const wroteTo = useMemo(() => lastWroteTo(lines ?? []), [lines])
  const company: ComposeCompany = useMemo(
    () => replyCompany(jobKey, SENDS_FROM_BOXES ? { settings: boxes, kind: contact.kind, wroteTo } : null),
    [jobKey, boxes, contact.kind, wroteTo],
  )
  const blocked = textBoxBlocked(shown, to)
  const count = goesOut(shown) ? countLine(shown, body) : null
  const sendLabel = settling.active ? OWED_DONE_SEND : (REPLY_KINDS.find((k) => k.kind === shown)?.send ?? 'Send')
  const orange = Boolean(job) && contact.kind === 'customer' && goesOut(shown)

  /** After a send or a note: the box empties and the page reads again, with one toast for all it did. */
  const after = (sentKind: ReplyKind, more?: string | null) => {
    setBody('')
    setTie(undefined)
    setFiles([])
    showToast([sentWords(sentKind, company), more].filter(Boolean).join(' '), 'success')
    reread()
  }

  const settle = async (text: string) => {
    if (!text) {
      setSettleProblem(OWED_DONE_NEEDS_A_NOTE)
      return
    }
    setSettleProblem(null)
    setBusy(true)
    try {
      await settling.done(text, jobKey)
      setBody('')
      setTie(undefined)
      showToast(OWED_DONE_TOAST, 'success')
      reread()
    } catch (e) {
      setSettleProblem(formatErrorMessage(e, 'It was not marked done.'))
    } finally {
      setBusy(false)
    }
  }

  const press = async () => {
    const text = body.trim()
    if (settling.active) {
      await settle(text)
      return
    }
    if (!text) {
      showToast(kind === 'note' ? 'Write the note first.' : 'Write the message first.', 'info')
      return
    }
    if (kind !== 'note') {
      setSending(kind)
      return
    }
    setBusy(true)
    try {
      await io.addNote(contact.id, text, jobKey, back)
      after('note', noteBackToast(back))
      setBack(null)
      setBackOpen(false)
    } catch (e) {
      showToast(formatErrorMessage(e, 'The note was not added.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const theirs = (open?.rail ?? []).map((k) => tiles[k]).filter((t): t is NonNullable<typeof t> => Boolean(t))

  // Quick replies: typing folds an open strip until the box is empty again; a press on the folded line peeks at it.
  const [peek, setPeek] = useState(false)
  // The step they are on, cut 4's read (`useFlowNow`, one read shared with the flow panel). Undefined while it reads,
  // so nothing is said until it lands; null when nothing is on, they are off the flow, or the read failed.
  const flowNow = useFlowNow(contact.id)
  const nowStepId = flowNow?.stepId ?? null
  // Cut 7f: the step's forms they fill in on their portal (the W-9, the MSA), starred at the top of Attach, only when a
  // link to their portal is on and it has the papers page.
  const starredForms = useMemo(
    () =>
      hasPortal && (audience === 'trade' || audience === 'customer') && portalHasPage(audience, 'papers')
        ? (flowNow?.papers ?? []).filter((p) => STARRED_FORMS.has(p)).map((p) => ({ paper: p, short: FLOW_PAPERS[p].short }))
        : [],
    [hasPortal, audience, flowNow],
  )
  // The live flow names the step; the seed names the rest of their kind's steps.
  const kindSteps = flowNow ? [{ id: flowNow.stepId, name: flowNow.stepName }, ...(STEPS[qrKindOf(contact.kind)] ?? [])] : (STEPS[qrKindOf(contact.kind)] ?? [])
  const first = contact.kind === 'unknown' ? contact.name : firstName(contact)
  // #127: the bill a line about money speaks of: the job's newest open bill when the reply is a Pipeline job's, else theirs.
  const pipelineJob = jobRefOf(jobKey)
  const paper = papers ? defaultPaperFills(papers, pipelineJob?.kind === 'pipeline' ? pipelineJob.id : null, Boolean(job)) : undefined
  const fills = replyFills({ first: contact.kind === 'unknown' ? null : first, myName: open?.userNames[me] ?? auth?.profileName ?? null, jobName: job?.name ?? ((jobKey && tiles[jobKey]?.name) || null), billLink, paper })
  const waits = goesOut(shown) ? sendWaits(body) : null
  const lang = customerLang(contact)
  const where =
    flowNow === undefined
      ? null
      : findWhere({
          step: flowNow ? { name: flowNow.stepName, done: flowNow.finishes } : null,
          who: flowNow?.who ?? 'us',
          firstName: first,
          daysOn: flowNow?.sinceYmd ? ymdDaysBetween(flowNow.sinceYmd, todayYmdInAppTz()) : null,
          off: false,
        })
  const use = (q: QuickReply) => {
    setBody(fillLine(lineWords(q, lang), fills).text)
    setFinding(false)
    setPeek(false)
    if (!isAppLine(q)) quick.press(q, contact.id)
  }
  // The strip's lines on a job's box: the app's own for a stage step the team has no line on, then the team's.
  const stripLines = useMemo(
    () => (stageStepIds.length ? [...appLinesForStage(stageStepIds, quick.lines ?? []), ...(quick.lines ?? [])] : quick.lines),
    [stageStepIds, quick.lines],
  )

  // Punch list #126: the `/` list. Escape shuts it for the `/` word it was on (`slashShut`, that word's start) until the
  // word is gone; ↑ ↓ light a row (`slashLit`, kept with the words it was lit for, so new words light the first row).
  const listId = useId()
  const boxRef = useRef<HTMLTextAreaElement>(null)
  const caretAfter = useRef<number | null>(null)
  const [slashShut, setSlashShut] = useState<number | null>(null)
  const [slashLit, setSlashLit] = useState<{ key: string; at: number }>({ key: '', at: 0 })
  const slashWord = goesOut(shown) && !textWaits && !settling.active ? slashTyped : null
  const slashOpen = slashWord !== null && slashWord.start !== slashShut
  const slashKey = slashWord ? `${slashWord.start}:${slashWord.words}` : ''
  const slashInput = { kind: contact.kind, nowStepId, stageStepIds, steps: kindSteps, me }
  const slashRows = slashOpen && stripLines ? slashLines(stripLines, slashInput, slashWord.words) : []
  // #127 PR 2: words that call their papers (`/bill`, `/estimate`) list them after the lines, the job's first.
  const paperKind = slashOpen ? slashPaperKind(slashWord.words) : null
  const slashPapers = paperKind && papers ? listedPapers(papers, paperKind, pipelineJob?.kind === 'pipeline' ? pipelineJob.id : null) : []
  const slashCount = slashRows.length + slashPapers.length
  const lit = slashLit.key === slashKey ? Math.min(slashLit.at, Math.max(0, slashCount - 1)) : 0
  useEffect(() => {
    // After a pick the caret lands after the line, in the box, as typing would leave it.
    const at = caretAfter.current
    if (at === null) return
    caretAfter.current = null
    boxRef.current?.focus()
    boxRef.current?.setSelectionRange(at, at)
  }, [body])
  /** The caret moved or the words changed: a `/` word gone takes Escape's shut with it. */
  const caretAt = (text: string, at: number) => {
    setCaret(at)
    if (slashShut !== null && slashWordAt(text, at)?.start !== slashShut) setSlashShut(null)
  }
  const pickSlash = (q: QuickReply) => {
    if (!slashWord) return
    const next = slashPick(body, slashWord, fillLine(lineWords(q, lang), fills).text)
    caretAfter.current = next.caret
    setBody(next.text)
    setCaret(next.caret)
    setPeek(false)
    if (!isAppLine(q)) quick.press(q, contact.id)
  }
  /** A paper picked: the team's line for it when there is one, else the app's words, filled for that paper. */
  const pickPaper = (p: Paper) => {
    if (!slashWord) return
    const team = paperTeamLine(stripLines ?? [], contact.kind, p.kind === 'bill' ? { kind: 'bill', open: p.open } : { kind: 'estimate' }, me)
    const words = team ? lineWords(team, lang) : paperLineWords(p)
    const next = slashPick(body, slashWord, fillLine(words, { ...fills, ...paperFills(p) }).text)
    caretAfter.current = next.caret
    setBody(next.text)
    setCaret(next.caret)
    setPeek(false)
    if (team && !isAppLine(team)) quick.press(team, contact.id)
  }
  const slashKeys = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!slashOpen || !slashWord || e.nativeEvent.isComposing) return
    if (e.key === 'Escape') {
      // The list closes, and the window around the box stays open.
      e.preventDefault()
      e.stopPropagation()
      setSlashShut(slashWord.start)
      return
    }
    if (!slashCount) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setSlashLit({ key: slashKey, at: slashMove(lit, slashCount, e.key === 'ArrowDown' ? 1 : -1) })
    } else if ((e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault()
      if (lit < slashRows.length) pickSlash(slashRows[lit]!)
      else pickPaper(slashPapers[lit - slashRows.length]!)
    }
  }

  return (
    <div
      data-reply-box
      style={{
        // In a job's window the panel's card holds it, so it takes no foot of its own.
        ...(job ? null : { background: 'var(--surface)', borderTop: '1px solid var(--border)', boxShadow: '0 -6px 14px -10px rgba(15, 23, 42, 0.3)', padding: '0.6rem 0.9rem 0.75rem' }),
        display: 'grid',
        gap: '0.4rem',
        position: 'relative',
      }}
    >
      {offered.length > 1 && (
        <div role="radiogroup" aria-label="Reply as" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {offered.map((k) => (
            <button
              key={k.kind}
              type="button"
              role="radio"
              aria-checked={shown === k.kind}
              aria-disabled={settling.active || undefined}
              onClick={() => !settling.active && setKind(k.kind)}
              style={{ ...KIND_LOOK[k.kind], borderWidth: 1, borderStyle: 'solid', borderRadius: 6, padding: '0.2rem 0.7rem', fontSize: '0.82rem', cursor: settling.active ? 'not-allowed' : 'pointer', ...(shown === k.kind ? RING : null) }}
            >
              {k.label}
            </button>
          ))}
          {shown === 'note' && <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{NOTE_ASIDE.join(' · ')}</span>}
        </div>
      )}

      {textWaits && (
        <p data-reply-texts-wait role="status" style={WAIT_LOOK}>
          <TextsWaitLine />
        </p>
      )}

      {goesOut(shown) && !textWaits && (
        <QuickRepliesStrip
          kind={contact.kind}
          lines={stripLines}
          me={me}
          nowStepId={nowStepId}
          stageStepIds={stageStepIds}
          steps={kindSteps}
          fills={fills}
          lang={lang}
          open={stripShown && (!body.trim() || peek)}
          problem={quick.problem}
          onOpen={(o) => {
            setStripOpen(o)
            keepOpen(o)
            setPeek(o && Boolean(body.trim()))
          }}
          onUse={use}
          onFind={() => setFinding(true)}
          onEdit={() => setAdding('')}
          onAdd={(words) => setAdding(words)}
        />
      )}

      {settling.active && settling.owed && <SettlingNote owed={settling.owed} onNotYet={settling.cancel} nowIso={open?.nowIso} />}
      {shown === 'note' && !settling.active && (backOpen || back) && (
        <NoteBackDay
          value={back}
          onChange={(day) => {
            setBack(day)
            // "No day ×" clears it, and the chips fold back to the press.
            if (!day) setBackOpen(false)
          }}
          todayYmd={todayYmdInAppTz()}
        />
      )}

      {slashOpen && slashWord && (
        <SlashList
          id={listId}
          rows={slashRows}
          active={lit}
          words={slashWord.words}
          fills={fills}
          lang={lang}
          steps={kindSteps}
          head={slashHead(contact.kind === 'unknown' ? null : first, slashRows.length, stripLines ? slashTotal(stripLines, slashInput) : 0)}
          reading={!stripLines && !quick.problem}
          problem={quick.problem}
          onPick={pickSlash}
          papers={slashPapers}
          papersTitle={paperKind ? papersTitle(contact.kind === 'unknown' ? null : first, paperKind) : ''}
          onPickPaper={pickPaper}
          onHover={(at) => setSlashLit({ key: slashKey, at })}
        />
      )}

      {!textWaits && (
        <div style={{ position: 'relative' }}>
          <textarea
            ref={boxRef}
            aria-label={shown === 'note' ? 'A note for the team' : `Write to ${contact.name}`}
            aria-autocomplete={goesOut(shown) ? 'list' : undefined}
            aria-controls={slashOpen && slashCount ? listId : undefined}
            aria-activedescendant={slashOpen && slashCount ? `${listId}-${lit}` : undefined}
            value={body}
            onChange={(e) => {
              setBody(e.target.value)
              caretAt(e.target.value, e.target.selectionStart ?? e.target.value.length)
              if (settleProblem) setSettleProblem(null)
            }}
            onSelect={(e) => caretAt(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
            onKeyDown={slashKeys}
            placeholder={settling.active ? OWED_DONE_PLACEHOLDER : goesOut(shown) ? `${boxPlaceholder(shown, contact.name)} ${SLASH_HINT}` : boxPlaceholder(shown, contact.name)}
            disabled={Boolean(blocked) || busy}
            rows={3}
            data-reply-look={orange ? 'customer' : shown}
            style={{
              ...(orange ? CUSTOMER_LOOK : KIND_LOOK[shown]),
              width: '100%',
              minHeight: 64,
              resize: 'vertical',
              display: 'block',
              borderWidth: 1, borderStyle: 'solid',
              ...(orange ? CUSTOMER_BAR : null),
              borderRadius: 8,
              padding: '0.5rem 0.6rem',
              font: 'inherit',
              fontSize: '0.9rem',
              boxSizing: 'border-box',
            }}
          />
          {goesOut(shown) && !body && (
            <span
              data-reply-from
              aria-hidden="true"
              style={{ position: 'absolute', right: '0.6rem', bottom: '0.45rem', fontSize: '0.72rem', color: 'var(--text-muted)', pointerEvents: 'none' }}
            >
              {fromLine(shown, company).join(' · ')}
            </span>
          )}
        </div>
      )}

      {settleProblem && (
        <div role="alert" style={{ fontSize: '0.8rem', color: 'var(--text-red-700)' }}>
          {settleProblem}
        </div>
      )}

      {!textWaits && count && count.parts.length > 0 && (
        <div data-reply-count style={{ fontSize: '0.75rem', color: count.long ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>
          {count.parts.join(' · ')}
        </div>
      )}

      {goesOut(shown) && !textWaits && !settling.active && files.length > 0 && (
        <div data-reply-files style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {files.map((f) => (
            <span
              key={f.draft.key}
              data-reply-file={f.draft.key}
              title={chipHover(f.draft).join(' ')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', borderRadius: 8, padding: '3px 4px 3px 8px', fontSize: '0.75rem', background: 'var(--surface)' }}
            >
              <span style={{ overflowWrap: 'anywhere' }}>
                {f.draft.name}
                {sizeWords(f.draft.bytes) && <span style={{ color: 'var(--text-muted)' }}> · {sizeWords(f.draft.bytes)}</span>}
              </span>
              <button
                type="button"
                aria-label={`Take ${f.draft.name} off the message`}
                onClick={() => setFiles((all) => all.filter((x) => x.draft.key !== f.draft.key))}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1, padding: '0 0.2rem' }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {!textWaits && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {job ? (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-600)' }}>
              Tie to: <span data-reply-tie>{job.name}</span>
            </span>
          ) : (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-600)' }}>
              Tie to:{' '}
              <button
                type="button"
                data-reply-tie
                title={`${TIE_TIP.title}. ${TIE_TIP.does} ${TIE_TIP.changes}`}
                onClick={() => setPicking(true)}
                style={{ border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', padding: '0.15rem 0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}
              >
                {tieLabel.job}
                {tieLabel.aside && <span style={{ color: 'var(--text-muted)' }}> · {tieLabel.aside}</span>} ▾
              </button>
            </span>
          )}
          <span style={{ flex: 1 }} />
          {shown === 'note' && !settling.active && !backOpen && !back && (
            <button
              type="button"
              data-reply-back
              title={NOTE_BACK_TIP}
              onClick={() => setBackOpen(true)}
              style={{ border: 'none', background: 'transparent', color: 'var(--text-blue-700)', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              {NOTE_BACK_PRESS}
            </button>
          )}
          {blocked && <span style={{ fontSize: '0.8rem', color: 'var(--text-red-700)' }}>{blocked}</span>}
          {!blocked && waits && (
            <span data-reply-waits style={{ fontSize: '0.8rem', color: 'var(--text-amber-800)' }}>
              {waits}
            </span>
          )}
          {goesOut(shown) && !settling.active && (
            <Btn onClick={() => setAttaching(true)} title="Adds a file from the job, this computer or a photo. The send window shows how each goes.">
              Attach
            </Btn>
          )}
          <Btn
            kind="primary"
            onClick={() => void press()}
            disabled={Boolean(blocked) || Boolean(waits) || busy}
            title={
              settling.active
                ? 'Marks what we owed done and keeps your words in the thread. The row closes as any note does.'
                : shown === 'note'
                  ? 'Adds the note to the thread and closes the row. Only the team sees it.'
                  : 'Shows it the way they will see it, before it goes. Nothing sends until you press Send there.'
            }
          >
            {sendLabel}
          </Btn>
        </div>
      )}

      {picking && (
        <JobPickerWindow
          title="Tie this reply to a job"
          theirs={theirs}
          untie
          searchJobs={open?.searchJobs ?? (async () => [])}
          onPick={(key) => {
            setPicking(false)
            setTie(key)
          }}
          onClose={() => setPicking(false)}
        />
      )}

      {finding && (
        <FindReplyWindow
          contact={contact}
          lines={quick.lines ?? []}
          threadLines={open?.lines ?? []}
          me={me}
          nowStepId={nowStepId}
          steps={kindSteps}
          fills={fills}
          lang={lang}
          where={where}
          onOpenStep={
            flowNow
              ? () => {
                  setFinding(false)
                  openFlowStep(contact.id, flowNow.stepId, flowNow.jobId)
                }
              : undefined
          }
          onUse={use}
          onAdd={(words) => {
            setFinding(false)
            setAdding(words)
          }}
          onEdit={() => {
            setFinding(false)
            setAdding('')
          }}
          onClose={() => setFinding(false)}
        />
      )}

      {adding !== null && (
        <QuickRepliesEditor
          io={qio}
          me={me}
          steps={STEPS}
          names={open?.userNames ?? {}}
          contactNames={{ [contact.id]: contact.name }}
          fills={fills}
          previewTo={contact.kind === 'unknown' ? null : first}
          initialAdd={adding}
          onChanged={quick.reload}
          onClose={() => setAdding(null)}
        />
      )}

      {attaching && (
        <AttachPicker
          jobKey={jobKey}
          starred={starredForms}
          stepName={flowNow?.stepName ?? null}
          jobName={jobKey && tiles[jobKey] ? `${tiles[jobKey]!.num} ${tiles[jobKey]!.name}` : job && job.key === jobKey ? job.name : null}
          audience={audience}
          hasPortal={hasPortal}
          io={aio}
          onPick={(f) => {
            const added = addDraftFile(
              files.map((x) => x.draft),
              f.draft,
            )
            if (!added.ok) showToast(added.toast, 'info')
            else setFiles((all) => [...all, f])
            setAttaching(false)
          }}
          onClose={() => setAttaching(false)}
        />
      )}

      {sending && (
        <SendWindow
          contact={contact}
          kind={sending}
          body={body.trim()}
          jobKey={jobKey}
          company={company}
          io={io}
          files={files}
          audience={audience}
          hasPortal={hasPortal}
          attachIo={aio}
          onKind={setSending}
          onClose={() => setSending(null)}
          onSent={(sentKind, more) => {
            setSending(null)
            setKind(sentKind)
            after(sentKind, more)
          }}
        />
      )}
    </div>
  )
}
