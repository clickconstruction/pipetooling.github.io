import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../contexts/ToastContext'
import type { LienDeskData } from '../../hooks/useLienDeskData'
import { retainageUnrecordedWhy } from '../../lib/ar/retainageSuggested'
import { batchOutcomeWords } from '../../lib/batchWords'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { lienAffidavitNoticeStanding } from '../../lib/jobs/lienAffidavitNoticeStanding'
import { lienAffidavitOwnerSends } from '../../lib/jobs/lienAffidavitNotices'
import {
  type LienBoardBinKey,
  type LienBoardChip,
  type LienBoardTileDestination,
  buildLienBoard,
  lienBoardForLeader,
  lienBoardLeaderPick,
  lienBoardLeaderUserId,
  lienBoardPick,
  lienBoardRiskPapers,
  lienBoardRiskPhrase,
  lienBoardRiskPick,
  lienBoardRowBin,
  lienBoardRowRisk,
  lienBoardRowStage,
  lienBoardSignSplit,
} from '../../lib/jobs/lienBoard'
import { lienBoardChipCard } from '../../lib/jobs/lienBoardChipCard'
import { lienBoardLatePick } from '../../lib/jobs/lienBoardDayLine'
import type { CourtesyStatus } from '../../lib/jobs/lienCourtesyNotice'
import { approveLienDeskItem, tellLeaderOfLienAffidavits, tellLeaderOfLienApproval, tellLeaderOfLienSignatures } from '../../lib/jobs/lienDeskIo'
import { lienDoNowBarParts } from '../../lib/jobs/lienDoNowBar'
import { LIEN_DO_NOW_ROWS_SELECTOR, lienDoNowFrame, lienDoNowListTop } from '../../lib/jobs/lienDoNowFrame'
import { lienDeskJobLabel as jobLabel, lienDeskJobNumber as jobNumberOf } from '../../lib/jobs/lienJobLabel'
import { lienReminderOutcome, lienReminderPlan, lienReminderWords } from '../../lib/jobs/lienLeaderReminder'
import { lienReminderAffidavitLabel, lienReminderSignatureLabel, lienReminderTally, lienReminderTextOf } from '../../lib/jobs/lienLeaderTold'
import { type LienNextUpRow, buildLienNextUp, lienViewerLeadsJob } from '../../lib/jobs/lienNextUp'
import { lienNoticeNamedMonths } from '../../lib/jobs/lienNoticeOwed'
import { lienItemUnsigned } from '../../lib/jobs/lienNoticeSignature'
import { buildLienOffPathBin } from '../../lib/jobs/lienOffPathBin'
import { buildLienPublicBin, lienPublicBoardLine } from '../../lib/jobs/lienPublicProperty'
import { type LienRowTag, lienAffidavitNoticeTag } from '../../lib/jobs/lienRowWords'
import type { LienServeJob } from '../../lib/jobs/lienServePackets'
import { mailNeedsYouRows } from '../../lib/mail/lienMailPieces'
import { formatDenverTimeOnly } from '../../utils/dateUtils'
import { formatErrorMessage } from '../../utils/errorHandling'
import { useLienDoNowRoom } from './useLienDoNowRoom'

/** What the Lien desk hands its By date view: the desk's own data and the few facts the rest of the desk also reads. */
export type LienDeskBoardInput = {
  data: LienDeskData | null
  todayYmd: string
  authRole: string | null
  authUserId: string | null
  leaderNameFor?: (masterUserId: string | null) => string
  /** The viewer is a lien leader (`isLienLeader`), and the office (`isLienOffice`). */
  leader: boolean
  office: boolean
  /** By date is the view on screen: the Board is measured, and the title's press scrolls to it, only then. */
  shown: boolean
  /** One column (a phone, or a host that stacks the desk). */
  oneColumn: boolean
  /** The courtesy notice per job, the filed affidavits not yet served and their envelopes: the desk builds them once for every view. */
  courtesyByJob: Record<string, CourtesyStatus>
  serveDue: ReadonlyArray<{ jobId: string; serveDue: string }>
  serveJobs: LienServeJob[]
  /** The desk re-reads after a write. */
  onChanged: () => void
  /** The day tile's run press: the desk opens the run on its send side. The office only; the hook asks first. */
  onOpenRun: () => void
}

/**
 * The Lien desk's By date view, less its drawing (v2.7571): the To do rows, the Board over them, what a pressed bin
 * or tile narrows the list to, the leader's one press for the lot, the find box that pins as the list comes up and
 * the reminder to the leader. Moved out of `LienDesk.tsx` as it stood: every rule is the kernel it was
 * (`lienNextUp.ts`, `lienBoard.ts`, `lienLeaderReminder.ts`), and the desk still draws `LienBoard`, `LienDoNowBar`
 * and `LienDeskNextUp` from what this returns. No read of its own.
 */
export function useLienDeskBoard({ data, todayYmd, authRole, authUserId, leaderNameFor, leader, office, shown, oneColumn, courtesyByJob, serveDue, serveJobs, onChanged, onOpenRun }: LienDeskBoardInput) {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const nextUpRows = useMemo(() => {
    if (!data) return []
    return buildLienNextUp({
      notices: data.queue.entries,
      affidavits: data.affidavits.entries,
      retainage: data.retainage.entries,
      letterTwoByJob: data.letterTwoByJob,
      courtesyByJob,
      serveDue,
      role: authRole,
      todayYmd,
      jobTitle: (jobId) => jobLabel(data.jobsById[jobId], jobId),
      gcName: (gcId) => data.gcsById[gcId]?.name ?? 'A GC',
      leaderName: (jobId) => leaderNameFor?.(data.jobsById[jobId]?.master_user_id ?? null)?.trim() || null,
      userName: (userId) => leaderNameFor?.(userId)?.trim() || null,
      mailNeedsYou: mailNeedsYouRows(data.filingsByJob, data.mailPiecesByFiling ?? {}, formatYmdMonthDay),
      retainageUnrecorded: (data.retainageUnrecorded ?? []).map((r) => ({ jobId: r.jobId, title: r.name ? r.label + ' · ' + r.name : r.label, why: retainageUnrecordedWhy(r) })),
      // The months the live notices name, by job (punch list #353, part 2): a To draft row with a notice on record names the owed month beside them.
      noticeMonthsByJob: Object.fromEntries(Object.entries(data.filingsByJob).map(([jobId, fs]) => [jobId, lienNoticeNamedMonths(fs)])),
      // v2.6734 (punch list #150): a leader's own rows are the jobs he is master of; another master's read as the office's.
      viewerUserId: authUserId,
      masterUserId: (jobId) => data.jobsById[jobId]?.master_user_id ?? null,
    })
  }, [data, authRole, authUserId, todayYmd, leaderNameFor, courtesyByJob, serveDue])
  // Whether this viewer is the leader a row's job waits on (v2.6734): the step tiles and the step card say *you* only then.
  const leadsRow = (row: LienNextUpRow): boolean => lienViewerLeadsJob({ role: authRole, viewerUserId: authUserId, masterUserId: (jobId) => data?.jobsById[jobId]?.master_user_id ?? null }, row.jobId)
  // The Board (v2.7332, the owner's ask of 2026-11-15): the month as one picture over the list, in the place of The lien
  // month strip (punch list #235) and Steps of each paper (v2.4631). The leader the tiles name is the master most of the
  // desk's jobs wait on; a pressed bin narrows the list under the Board to its jobs, as a pressed rung did.
  const boardLeaderName = useMemo(() => {
    if (!data || !leaderNameFor) return null
    const top = lienBoardLeaderUserId([...data.queue.entries, ...data.affidavits.entries], (jobId) => data.jobsById[jobId]?.master_user_id)
    return top ? leaderNameFor(top)?.trim() || null : null
  }, [data, leaderNameFor])
  const board = useMemo(
    () =>
      data
        ? buildLienBoard({
            todayYmd,
            notices: data.queue.entries,
            affidavits: data.affidavits.entries,
            retainage: data.retainage.entries,
            retainageUnrecorded: data.retainageUnrecorded?.length ?? 0,
            jobNumber: (jobId) => jobNumberOf(data.jobsById[jobId], jobId),
            jobName: (jobId) => (data.jobsById[jobId]?.job_name ?? '').trim(),
            gcName: (gcId) => data.gcsById[gcId]?.name ?? '',
            leaderName: boardLeaderName,
            publicJobIds: data.publicAskJobIds,
            // The filed liens whose copies are still to mail (punch list #366): their bin, apart from the served ones.
            serve: serveJobs.map((j) => ({ jobId: j.jobId, serveDue: j.filing.serve_due })),
          })
        : null,
    [data, todayYmd, boardLeaderName, serveJobs],
  )
  // Public property (v2.7443, Taunya's ask of 2026-11-16): the line over the Board for the jobs on a property that reads
  // as public, unanswered, with a paper still open, and the bin for the jobs already off the lien path.
  const publicLine = useMemo(() => {
    if (!data || !board) return null
    const chips = [...board.notices, ...board.affidavits].flatMap((b) => b.chips).filter((c) => c.stage !== 'sent' && c.stage !== 'filed')
    return lienPublicBoardLine({
      askingJobIds: data.publicAskJobIds ?? new Set<string>(),
      openPaperJobIds: new Set(chips.map((c) => c.jobId)),
      unpaidOf: (jobId) => chips.find((c) => c.jobId === jobId)?.openBalance ?? 0,
      addressIdOf: (jobId) => data.jobsById[jobId]?.customer_address_id ?? null,
    })
  }, [data, board])
  const publicBin = useMemo(() => buildLienPublicBin(data?.publicJobs ?? []), [data])
  // Off the lien path (v2.7526, the owner's pick of 2026-11-16): the bin for the jobs a person took off for a reason of
  // their own, and the job whose window is open, to take it off or to put it back.
  const offPathBin = useMemo(() => buildLienOffPathBin(data?.offPathJobs ?? []), [data])
  const [boardBins, setBoardBins] = useState<LienBoardBinKey[] | null>(null)
  // The leader's press (v2.7334): one counted press for the affidavits that wait on him, on the jobs he leads. Since v2.7708
  // every viewer reads every bin, and the press stands on his Awaiting Master approval bin's title line.
  const leaderView = useMemo(() => (board && leader ? lienBoardForLeader(board, { leads: (jobId) => lienViewerLeadsJob({ role: authRole, viewerUserId: authUserId, masterUserId: (id) => data?.jobsById[id]?.master_user_id ?? null }, jobId) }) : null), [board, leader, authRole, authUserId, data])
  // Approved · to sign by whose signature each notice waits on (v2.7853): a leader's *Sign N notices ›* counts the jobs he
  // leads, the rule his *Approve N affidavits* counts by. `othersLeader` is the one leader the rest wait on, when they share one.
  const signSplit = useMemo(() => {
    if (!board || !leader) return null
    const split = lienBoardSignSplit(board, (jobId) => lienViewerLeadsJob({ role: authRole, viewerUserId: authUserId, masterUserId: (id) => data?.jobsById[id]?.master_user_id ?? null }, jobId))
    const names = new Set(split.others.map((c) => leaderNameFor?.(data?.jobsById[c.jobId]?.master_user_id ?? null)?.trim() || ''))
    return { mine: split.mine.map((c) => c.jobId), others: split.others.length, othersLeader: names.size === 1 ? [...names][0] || null : null }
  }, [board, leader, authRole, authUserId, data, leaderNameFor])
  const [approvingLot, setApprovingLot] = useState(false)
  /**
   * The leader's one press (v2.7334): approves every affidavit that waits on him inside its window, one by one, keeps
   * going past one that fails and names it after, and leaves what is held where it is with its reason (a notice takes
   * his signature on its own pane; a paper past its day sends nothing on time). Asks first with the count.
   */
  const approveTheLot = async () => {
    if (!leaderView || leaderView.press.dead || approvingLot) return
    const ready = leaderView.chips.filter((c) => c.kind === 'affidavit')
    const items = ready.map((c) => data?.affidavits.entries.find((e) => e.jobId === c.jobId)?.item?.id ?? null).filter((id): id is string => Boolean(id))
    if (items.length === 0) return
    const n = items.length
    const ok = await confirmDialog({
      title: `Approve ${n} ${n === 1 ? 'affidavit' : 'affidavits'}?`,
      message: `${ready.map((c) => c.label).join(', ')}. Each is marked approved and moves to Ready to file. ${leaderView.held.length ? `${leaderView.held.length} ${leaderView.held.length === 1 ? 'stays' : 'stay'} where ${leaderView.held.length === 1 ? 'it is' : 'they are'} with the reason.` : ''}`.trim(),
      confirmLabel: leaderView.press.button.replace(/ ·.*$/, ''),
    })
    if (!ok) return
    setApprovingLot(true)
    let done = 0
    const failed: string[] = []
    try {
      for (const [i, id] of items.entries()) {
        try {
          await approveLienDeskItem(id)
          done += 1
        } catch (e) {
          failed.push(`${ready[i]?.label ?? id}: ${formatErrorMessage(e, 'did not approve')}`)
        }
      }
      const words = batchOutcomeWords({ verb: 'approve', past: 'approved', done, failed: failed.length, noun: 'affidavit' })
      showToast(failed.length ? `${words.line} ${failed.join(' · ')}` : words.line, words.tone)
      if (done > 0) onChanged()
    } finally {
      setApprovingLot(false)
    }
  }
  // The day tile's red line, pressed (v2.7371): the list shows only the papers that will not make their day as they stand.
  const [boardRisk, setBoardRisk] = useState(false)
  // The same line when it reads *N are past their day* (the owner's pick of 2026-11-18): the list shows only the late papers.
  const [boardLate, setBoardLate] = useState(false)
  // The second tile's press (v2.7448): every paper that waits on the leader, to approve or to sign, as the tile counts them.
  const [boardLeader, setBoardLeader] = useState(false)
  const boardPick = useMemo(() => (board && boardRisk ? lienBoardRiskPick(board) : board && boardLate ? lienBoardLatePick(board) : board && boardLeader ? lienBoardLeaderPick(board, boardLeaderName) : board && boardBins ? lienBoardPick(board, boardBins) : null), [board, boardBins, boardRisk, boardLate, boardLeader, boardLeaderName])
  // The same rule orders the list (punch list #362, step 2): a row whose paper the Board marks stands first under Needs you now.
  const riskPapers = useMemo(() => (board ? lienBoardRiskPapers(board) : new Map<string, number>()), [board])
  const rowRisk = useCallback((row: LienNextUpRow) => lienBoardRowRisk(riskPapers, row), [riskPapers])
  // A computer's row starts with its paper's bin, in the Board's words, and an affidavit row says where its notice stands (v2.7372, step 3).
  const rowStage = useCallback((row: LienNextUpRow) => (board ? lienBoardRowStage(board, row) : null), [board])
  // The bin itself, for a computer's list in the Board's order (punch list #362, step 4).
  const rowBin = useCallback((row: LienNextUpRow) => (board ? lienBoardRowBin(board, row) : null), [board])
  const rowNotice = useCallback(
    (row: LienNextUpRow): LienRowTag | null => {
      if (!data || row.kind !== 'affidavit' || !row.jobId) return null
      const entry = data.affidavits.entries.find((e) => e.jobId === row.jobId)
      if (!entry) return null
      // Where that notice stands (`lienAffidavitNoticeStanding.ts`): approved and waiting to be mailed is not *No notice on record*.
      const standing = lienAffidavitNoticeStanding(entry, data.queue.entries.find((e) => e.jobId === row.jobId))
      return lienAffidavitNoticeTag({ isSub: entry.isSub, noticed: Boolean(entry.gates.find((g) => g.key === 'notice')?.ok), sentOn: lienAffidavitOwnerSends(data.filingsByJob[row.jobId]).map((send) => send.sentOn), standing })
    },
    [data],
  )
  // A chip pointed at says which job it is before the press takes anyone anywhere (v2.7381, Taunya's ask of 2026-11-15):
  // the job's name, address and customer, and its paper's status, with the one thing to know as its To do row says it.
  const chipCardFor = useCallback(
    (chip: LienBoardChip) => {
      if (!data || !board) return null
      const job = data.jobsById[chip.jobId]
      const gcId = chip.gcId ?? job?.gc_customer_id ?? null
      const row = nextUpRows.find((r) => r.key === `${chip.kind}:${chip.jobId}`)
      return lienBoardChipCard(chip, board, { todayYmd, jobName: job?.job_name, address: job?.job_address, customer: job?.customer_name, gc: gcId ? data.gcsById[gcId]?.name : null, detail: row ? (row.detail ?? row.sub) : null, leader: leaderNameFor?.(job?.master_user_id ?? null) })
    },
    [data, board, nextUpRows, todayYmd, leaderNameFor],
  )
  const riskLabel = useCallback(
    (n: number) => {
      const phrase = lienBoardRiskPhrase(board?.dayWords ?? null, n)
      return `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)}`
    },
    [board],
  )
  // To do on a phone scrolls the Board, the find box and the list as one page (punch list #352, PR 0): under five
  // stacked month cards a list that took what was left got a window 26 px tall, and no row could be reached. The
  // same holds wherever the Board's columns stack (the 768 px tablet, 2026-11-15): the Board is then taller than
  // the screen, so the page scrolls as one and the list is not its own scroller.
  const [boardStacked, setBoardStacked] = useState(false)
  const doNowRef = useRef<HTMLDivElement | null>(null)
  // A computer too, wherever the Board leaves the list too little room (v2.7367, punch list #362 step 1): measured
  // on 2026-11-15, the list had 91 px under the Board at 1440 x 900. There the find box pins as the list comes up
  // (`LienDoNowBar`), with the Board's numbers and the way back; a screen tall enough for both keeps the Board put.
  const doNowRoom = useLienDoNowRoom(doNowRef, shown && Boolean(board))
  const doNow = lienDoNowFrame(oneColumn || boardStacked, doNowRoom)
  // The bar pins on the wide desk only: a phone and the stacked desk keep their find box in the page, as before.
  const doNowBarPins = doNow.mode === 'one-page' && !oneColumn && !boardStacked
  const doNowBarParts = useMemo(() => (board ? lienDoNowBarParts(board) : []), [board])
  // There a pressed bin also brings its rows up, since the Board fills the screen and the narrowed list is under it.
  const [pickBringsRows, setPickBringsRows] = useState(0)
  const pickBoardBins = useCallback((bins: LienBoardBinKey[] | null) => {
    setBoardBins((prev) => (bins && prev && prev.join('|') === bins.join('|') ? null : bins))
    setBoardRisk(false)
    setBoardLate(false)
    setBoardLeader(false)
    if (bins) setPickBringsRows((n) => n + 1)
  }, [])
  // A phone's flow (punch list #428): a stage is set, never toggled, since the page keeps it in the history entry and
  // hands it back on every visit to that entry. Null puts the list back. A set stage brings the page to its top, where
  // the pinned line is, so the stage's rows start right under it.
  const [stageBringsTop, setStageBringsTop] = useState(0)
  const setBoardStage = useCallback((key: LienBoardBinKey | null) => {
    setBoardBins(key ? [key] : null)
    if (!key) return
    setBoardRisk(false)
    setBoardLate(false)
    setBoardLeader(false)
    setStageBringsTop((n) => n + 1)
  }, [])
  useEffect(() => {
    if (stageBringsTop === 0) return
    const scroller = doNowRef.current
    if (!scroller) return
    if (typeof scroller.scrollTo === 'function') scroller.scrollTo({ top: 0 })
    else scroller.scrollTop = 0
  }, [stageBringsTop])
  const pickBoardRisk = () => {
    setBoardBins(null)
    setBoardLeader(false)
    setBoardLate(false)
    setBoardRisk(!boardRisk)
    if (!boardRisk) setPickBringsRows((n) => n + 1)
  }
  const pickBoardLate = () => {
    setBoardBins(null)
    setBoardLeader(false)
    setBoardRisk(false)
    setBoardLate(!boardLate)
    if (!boardLate) setPickBringsRows((n) => n + 1)
  }
  const pickBoardLeader = () => {
    setBoardBins(null)
    setBoardRisk(false)
    setBoardLate(false)
    setBoardLeader(!boardLeader)
    if (!boardLeader) setPickBringsRows((n) => n + 1)
  }
  // A tile's press, and the same count's press on the pinned find box (v2.7367): the run, the stage on both columns, or (v2.7371) the red line's papers.
  const openBoardTile = (d: LienBoardTileDestination) => {
    if (d.kind === 'risk') pickBoardRisk()
    else if (d.kind === 'late') pickBoardLate()
    else if (d.kind === 'leader') pickBoardLeader()
    else if (d.kind === 'run') {
      if (office) onOpenRun()
    }
  }
  useEffect(() => {
    if (pickBringsRows === 0 || doNow.mode !== 'one-page') return
    const scroller = doNowRef.current
    if (!scroller) return
    if (!doNowBarPins) {
      scroller.querySelector<HTMLElement>(LIEN_DO_NOW_ROWS_SELECTOR)?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
      return
    }
    // Where the find box pins, the page goes to the Board's bottom edge: the narrowed list starts right under the bar.
    const boardEl = scroller.querySelector<HTMLElement>('[data-lien-board]')
    if (!boardEl) return
    const top = lienDoNowListTop({ boardBottom: boardEl.getBoundingClientRect().bottom, scrollerTop: scroller.getBoundingClientRect().top, scrollTop: scroller.scrollTop })
    if (typeof scroller.scrollTo === 'function') scroller.scrollTo({ top, behavior: 'smooth' })
    else scroller.scrollTop = top
  }, [pickBringsRows, doNow.mode, doNowBarPins])
  // The title is a door (v2.7332): from any view it opens To do scrolled to the Board.
  const [boardBring, setBoardBring] = useState(0)
  useEffect(() => {
    if (boardBring === 0 || !shown) return
    doNowRef.current?.querySelector<HTMLElement>('[data-lien-board]')?.scrollIntoView?.({ block: 'start' })
  }, [boardBring, shown])
  // The office's waiting rows (punch list #101 PR 3) close the list under the leader's name when they share one.
  const nextUpWaitingOn = useMemo(() => {
    if (!data || !leaderNameFor) return null
    const names = new Set(nextUpRows.filter((r) => r.action === 'approve' && !r.button && r.jobId).map((r) => leaderNameFor(data.jobsById[r.jobId!]?.master_user_id ?? null)?.trim() || ''))
    return names.size === 1 ? [...names][0] || null : null
  }, [data, nextUpRows, leaderNameFor])
  /**
   * The press on the waiting rows' head (v2.7371, punch list #362 step 2; Taunya's ask that *Waiting on the leader* be
   * something a person can act on): reminds the leader of every paper that waits on an approval, by the message its
   * send for approval sent. A notice is one message, the affidavits one for the lot; a paper with nothing to point at
   * stays out with its reason. Asks first, keeps going past one that fails, and names it after. Nothing is written.
   */
  const waitingRows = useMemo(() => nextUpRows.filter((r) => r.action === 'approve' && !r.button && r.jobId), [nextUpRows])
  // The approved notices that wait on the leader's signature (v2.7491): in the same press, one message for the lot. The
  // rule is the one the Board's second tile and the run count *to sign* by (`lienItemUnsigned`).
  const signWaits = useMemo(() => (data?.queue.piles.ready ?? []).filter((e) => e.item?.id && lienItemUnsigned(e.item)), [data])
  // Who the press reminds, by name when every paper in it waits on one leader; else *the leader*.
  const remindWho = useMemo(() => {
    if (!data || !leaderNameFor) return null
    const names = new Set([...waitingRows.map((r) => r.jobId!), ...signWaits.map((e) => e.jobId)].map((jobId) => leaderNameFor(data.jobsById[jobId]?.master_user_id ?? null)?.trim() || ''))
    return names.size === 1 ? [...names][0] || null : null
  }, [data, waitingRows, signWaits, leaderNameFor])
  const reminderPlan = useMemo(() => {
    if (!data) return null
    return lienReminderPlan([
      ...waitingRows.map((r) => {
        const notice = r.kind === 'notice' ? data.queue.entries.find((e) => e.jobId === r.jobId) : undefined
        const affidavit = r.kind === 'affidavit' ? data.affidavits.entries.find((e) => e.jobId === r.jobId) : undefined
        // A retainage notice has its message since v2.7478: one each, as a notice's.
        const retainage = r.kind === 'retainage' ? data.retainage.entries.find((e) => e.jobId === r.jobId) : undefined
        return { kind: r.kind, label: r.title, itemId: notice?.item?.id ?? affidavit?.item?.id ?? retainage?.item?.id ?? null, dueYmd: notice?.earliestDeadline ?? affidavit?.deadline ?? retainage?.deadline ?? null }
      }),
      ...signWaits.map((e) => ({ kind: 'signature' as const, label: jobLabel(data.jobsById[e.jobId], e.jobId), itemId: e.item?.id ?? null, dueYmd: e.earliestDeadline ?? null })),
    ])
  }, [data, waitingRows, signWaits])
  const [reminding, setReminding] = useState(false)
  // When this session last sent the reminder, and for which rows: the press then says so and is dead until the rows change.
  const [reminded, setReminded] = useState<{ at: string; keys: string } | null>(null)
  const waitingKeys = [...waitingRows.map((r) => r.key), ...signWaits.map((e) => `sign:${e.item?.id ?? e.jobId}`)].join('|')
  const reminderWords = reminderPlan ? lienReminderWords(reminderPlan, remindWho, reminded && reminded.keys === waitingKeys ? reminded.at : null) : null
  const remindLeader = async () => {
    if (!reminderPlan || !reminderWords || reminderWords.dead || reminding) return
    if (!(await confirmDialog({ title: reminderWords.title, message: reminderWords.message, confirmLabel: reminderWords.confirmLabel }))) return
    setReminding(true)
    let done = 0
    const failed: Array<{ label: string; reason: string }> = []
    // Every call's answer, for the reminder's text (v2.7495): whether one went over the press, and when none did, why.
    const answers: Array<Awaited<ReturnType<typeof tellLeaderOfLienSignatures>>> = []
    const heard = <R extends (typeof answers)[number]>(r: R): R => (answers.push(r), r)
    try {
      // A reminder counts only when a message went (v2.7445): the function answers 200 when it sends nothing, and the tally reads why.
      for (const p of reminderPlan.notices) {
        const t = lienReminderTally(heard(await tellLeaderOfLienApproval(p.itemId, p.dueYmd, { remind: true })), 1)
        done += t.done
        if (t.reason) failed.push({ label: p.label, reason: t.reason })
      }
      if (reminderPlan.affidavits.length > 0) {
        const t = lienReminderTally(heard(await tellLeaderOfLienAffidavits(reminderPlan.affidavits.map((p) => ({ itemId: p.itemId, dueYmd: p.dueYmd })), { remind: true })), reminderPlan.affidavits.length)
        done += t.done
        if (t.reason) failed.push({ label: lienReminderAffidavitLabel(reminderPlan.affidavits.map((p) => p.label), t.missed), reason: t.reason })
      }
      // The notices to sign (v2.7491): one call and one message for the lot, counted by what the function told him of.
      if (reminderPlan.signatures.length > 0) {
        const t = lienReminderTally(heard(await tellLeaderOfLienSignatures(reminderPlan.signatures.map((p) => ({ itemId: p.itemId, dueYmd: p.dueYmd })))), reminderPlan.signatures.length, 'signature')
        done += t.done
        if (t.reason) failed.push({ label: lienReminderSignatureLabel(reminderPlan.signatures.map((p) => p.label), t.missed), reason: t.reason })
      }
      const said = lienReminderOutcome({ done, failed }, remindWho, lienReminderTextOf(answers))
      showToast(said.line, said.tone)
      if (done > 0) setReminded({ at: formatDenverTimeOnly(Date.now()), keys: waitingKeys })
    } finally {
      setReminding(false)
    }
  }
  // The title is a door (v2.7332): the desk's press counts here, and the Board comes into view once By date is shown.
  const bringBoard = useCallback(() => setBoardBring((n) => n + 1), [])
  return {
    nextUpRows,
    leadsRow,
    board,
    publicLine,
    publicBin,
    offPathBin,
    leaderView,
    signSplit,
    approvingLot,
    approveTheLot,
    boardPick,
    rowRisk,
    rowStage,
    rowBin,
    rowNotice,
    chipCardFor,
    riskLabel,
    setBoardStacked,
    doNowRef,
    doNow,
    doNowBarPins,
    doNowBarParts,
    pickBoardBins,
    setBoardStage,
    openBoardTile,
    bringBoard,
    nextUpWaitingOn,
    waitingRows,
    reminderPlan,
    reminding,
    reminderWords,
    remindLeader,
  }
}
