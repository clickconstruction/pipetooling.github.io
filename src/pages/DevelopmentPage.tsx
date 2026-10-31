/**
 * The Development page (punch list #208 PR 2, design spike 2026-10-28): `/developments/:id`, the
 * Customer Hub's sibling. The head (the house, the name, the customer, the address the members
 * share, the site's people, the counts with the waiting one first), a jump strip over one page of
 * cards: What changed (with *You last looked* inside it), Pieces (each bid with the job it became),
 * Plans and Questions. It opens from the house line on a Bid window or a Job window.
 *
 * The spike reads the real site without a write: the members by `development_id`, and the records at
 * the members' address that are not in it behind the toggle *Show the N here*, so the owner can walk
 * the page full while PR 1's *Put it in* fills the development one record at a time (PR 3 fills it
 * in one press).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import DevelopmentHouseIcon from '../components/icons/DevelopmentHouseIcon'
import { DevelopmentFeed } from '../components/developments/DevelopmentFeed'
import { DevelopmentJumpStrip, DEVELOPMENT_JUMP_ANCHOR, DEVELOPMENT_PHONE_QUERY, type DevelopmentJumpKey, type DevelopmentLook } from '../components/developments/DevelopmentJumpStrip'
import { DevelopmentPieces } from '../components/developments/DevelopmentPieces'
import type { PairingProps } from '../components/developments/DevelopmentPairCells'
import { DevelopmentBackfillSheet, type BackfillSheetValues } from '../components/developments/DevelopmentBackfillSheet'
import { makeBidFromJob, undoBackfill } from '../lib/developments/backfillWrites'
import { hideFromBoardAgain, putAllInDevelopment, putBackOnBoard, putInDevelopment, takeOutOfDevelopment } from '../lib/developments/chipWrites'
import { putInConfirmRows, putInLabel, putInOutcomeWords, putInPreviewLines } from '../lib/developments/putIn'
import { askRow, askSentWords, askTitleForPlans, type AskDraft } from '../lib/developments/ask'
import { sendAsk } from '../lib/developments/askWrites'
import { DevelopmentAskSheet, type AskAboutOption, type AskPreset } from '../components/developments/DevelopmentAskSheet'
import { DevelopmentChipConfirm, type ChipConfirmRow } from '../components/developments/DevelopmentChipConfirm'
import { useJobFormModal } from '../contexts/JobFormModalContext'
import { useAuth } from '../hooks/useAuth'
import { DevelopmentPlansCard, DevelopmentQuestionsCard } from '../components/developments/DevelopmentSideCards'
import { Card, capStyle, FoldButton, money, shortDay, SmallButton, LinkButton } from '../components/developments/developmentPageBits'
import { DevelopmentCounts, type CountTileSpec } from '../components/developments/DevelopmentCounts'
import { buildAtAddressCard, buildCountCard, type CountCard, type CountDoor, type CountFootDoor, type CountKey, type CountPress } from '../lib/developments/countCards'
import { DevelopmentNotInChips, type NotInChip } from '../components/developments/DevelopmentNotInChips'
import { DevelopmentMoney } from '../components/developments/DevelopmentMoney'
import { buildSiteMoney, moneyLookWords, MONEY_SORT_LABELS, type MoneySortMode } from '../lib/developments/siteMoney'
import { countKeysFor, developmentDoorFor, jobDoorClosedWords, OFFICE_READS_MONEY, OFFICE_READS_MONEY_CHIP } from '../lib/developments/readDoor'
import { isFolded, readFolds, readMoneySort, toggleFold, writeFolds, writeMoneySort } from '../lib/developments/devicePrefs'
import { todayYmdInAppTz } from '../utils/dateUtils'
import OfflineRetryPanel from '../components/OfflineRetryPanel'
import { useBidPreview } from '../contexts/BidPreviewModalContext'
import { useJobDetailModal } from '../contexts/JobDetailModalContext'
import { useLedgerPrefixMap } from '../contexts/LedgerDisplayPrefixContext'
import { useToastContext } from '../contexts/ToastContext'
import { useMatchMedia } from '../hooks/useMatchMedia'
import { fetchDevelopmentPage, type DevelopmentPageData } from '../lib/developments/fetchDevelopmentPage'
import { bidMoney, bidStatusWord, bidUndecided, headCounts, requestIsOpen, sharedAddressWords, sitePeople, type MemberBid, type MemberJob, type MemberRequest, type Members } from '../lib/developments/overview'
import { buildPieceRows } from '../lib/developments/pieces'
import { buildPlansView, plansAskOnRecord, plansNeedWords, type PlanCarrier } from '../lib/developments/plans'
import { readIncludeAddress, readLastLooked, readNotThese, writeIncludeAddress, writeLastLooked, writeNotThese } from '../lib/developments/sinceYouLooked'
import { siteDropWords, suggestPairs, type PairSuggestion } from '../lib/developments/pairing'
import { markWonConfirm, markedWonBack, pairAllConfirm, pairConfirm, pairedAllBack, pairedWords, unpairConfirm, unpairedWords, type PairingConfirm } from '../lib/developments/pairingConfirm'
import { markBidsWon, pairJobToBid, pairMany, unmarkBidsWon, unpairJob, unpairMany } from '../lib/developments/pairingWrites'
import { batchOutcomeWords, countedLabel, pluralNoun } from '../lib/batchWords'
import { buildWhatChanged, filterChangeLines, placeSinceLine, type ChangeLine } from '../lib/developments/whatChanged'
import { aboutIsPiece, entryLine, narrowLines, narrowedWords, onRecordNotes, type HistoryChip, type HistoryDraft, type HistoryEntry, type HistoryPiece } from '../lib/developments/history'
import { keepHistoryEntry } from '../lib/developments/historyWrites'
import { DevelopmentHistoryChips, DevelopmentHistoryComposer, type HistoryAboutOption } from '../components/developments/DevelopmentHistoryTools'
import { EmptyState } from '../components/EmptyState'
import { DevelopmentLineWindow } from '../components/developments/DevelopmentLineWindow'
import { formatBidLedgerNumberLabel, formatJobLedgerNumberLabel, resolveBidLedgerPrefix, resolveJobLedgerPrefix } from '../lib/ledgerDisplayPrefixes'
import { labelJobsLedgerStatusForDashboard } from '../lib/jobsLedgerStatusPipeline'
import { extractContactFromCustomer } from '../lib/jobs/jobFormCustomerDisplay'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../lib/offlineRecoveryState'
import { telHrefFor } from '../lib/phoneContact'
import { formatErrorMessage } from '../utils/errorHandling'
import type { Database } from '../types/database'


export default function DevelopmentPage() {
  const { id: developmentId = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const phone = useMatchMedia(DEVELOPMENT_PHONE_QUERY)
  // The Money look's order and folds, and which looks are folded, remembered on the device.
  const [moneySort, setMoneySort] = useState<MoneySortMode>(() => readMoneySort(developmentId))
  const [moneyFolds, setMoneyFolds] = useState<ReadonlySet<string>>(() => readFolds(developmentId, 'money'))
  const [lookFolds, setLookFolds] = useState<ReadonlySet<string>>(() => readFolds(developmentId, 'looks'))
  const setMoneySortMode = (mode: MoneySortMode) => {
    setMoneySort(mode)
    writeMoneySort(developmentId, mode)
  }
  const toggleMoneyFold = (key: string, defaultFolded: boolean) =>
    setMoneyFolds((prev) => {
      const next = toggleFold(prev, key, defaultFolded)
      writeFolds(developmentId, 'money', next)
      return next
    })
  const toggleLook = (key: string) =>
    setLookFolds((prev) => {
      const next = toggleFold(prev, key, false)
      writeFolds(developmentId, 'looks', next)
      return next
    })
  const prefixes = useLedgerPrefixMap()
  const bidPreview = useBidPreview()
  const jobDetail = useJobDetailModal()
  const jobForm = useJobFormModal()
  const { user: authUser, role, loading: authLoading } = useAuth()
  // The reader's door (PR 6): the office reads every table and the money; an estimator reads the pieces through the definer read and sees no dollar and no Job window.
  const door = developmentDoorFor(role)
  const moneyShown = door === 'office'
  const { showToast, showActionToast } = useToastContext()

  const [data, setData] = useState<DevelopmentPageData | null>(null)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [loading, setLoading] = useState(true)
  // `?all=1` opens the page with the address matches drawn (a link the owner can share while the spike runs).
  const [includeAddress, setIncludeAddress] = useState(() => searchParams.get('all') === '1' || readIncludeAddress(developmentId))
  const [lastLooked, setLastLooked] = useState<string | null>(() => readLastLooked(developmentId))
  const [hideNotInIt, setHideNotInIt] = useState(false)
  const [pairMode, setPairMode] = useState(false)
  const [olderOpen, setOlderOpen] = useState(false)
  const [feedQuery, setFeedQuery] = useState('')
  // The History look (the owner's pick A of history-mockup.html): the chips that narrow, the piece from a Pieces row, the whole of a long line, the composer's door, and the entries people keep (read with the page, a kept one prepended).
  const [histChip, setHistChip] = useState<HistoryChip>('all')
  const [histPiece, setHistPiece] = useState<HistoryPiece | null>(null)
  const [lineOpen, setLineOpen] = useState<ChangeLine | null>(null)
  const [writing, setWriting] = useState(false)
  // Ask a question (PR 4): the window's preset from the press that opened it, and the send in flight.
  const [ask, setAsk] = useState<AskPreset | null>(null)
  const [asking, setAsking] = useState(false)
  const [keeping, setKeeping] = useState(false)
  const [kept, setKept] = useState<HistoryEntry[]>([])
  const entries = useMemo<HistoryEntry[]>(() => [...kept, ...(data?.historyEntries ?? [])], [kept, data])
  const [busy, setBusy] = useState(false)
  const [notThese, setNotThese] = useState<Set<string>>(() => readNotThese(developmentId))
  const [backfillJob, setBackfillJob] = useState<MemberJob | null>(null)
  const [chipConfirm, setChipConfirm] = useState<{ title: string; rows: ChipConfirmRow[]; preview: React.ReactNode; previewCaption: string; confirmLabel: string; onConfirm: () => void } | null>(null)
  const [nowMs] = useState(() => Date.now())

  const load = useCallback(async () => {
    // The door is known only once the role is: a read before that would take the overview door for the office.
    if (!developmentId || authLoading) return
    setLoading(true)
    setFailure(null)
    try {
      setData(await fetchDevelopmentPage(developmentId, includeAddress, door))
    } catch (e) {
      setFailure(recoveryFailureFromError(e, 'The development could not be read.'))
    } finally {
      setLoading(false)
    }
  }, [developmentId, includeAddress, authLoading, door])

  useEffect(() => {
    void load()
  }, [load])

  const bidLabel = useCallback((b: MemberBid) => formatBidLedgerNumberLabel(resolveBidLedgerPrefix(b.service_type_id, prefixes), b.bid_number), [prefixes])
  const jobLabel = useCallback((j: MemberJob) => formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixes), j.hcp_number, j.click_number), [prefixes])

  const shown: Members | null = useMemo(() => {
    if (!data) return null
    return includeAddress ? { bids: [...data.inIt.bids, ...data.atAddress.bids], jobs: [...data.inIt.jobs, ...data.atAddress.jobs] } : data.inIt
  }, [data, includeAddress])

  const counts = useMemo(() => (shown && data ? headCounts(shown, data.requests, nowMs) : null), [shown, data, nowMs])
  const people = useMemo(() => (shown && data ? sitePeople({ members: shown, names: data.names, teamMembers: data.teamMembers, jobLabel }) : null), [shown, data, jobLabel])
  const plans = useMemo(() => (shown && data ? buildPlansView({ members: shown, bidChanges: data.bidChanges, names: data.names, bidLabel, jobLabel }) : null), [shown, data, bidLabel, jobLabel])
  const pieces = useMemo(() => (shown && data && plans ? buildPieceRows({ members: shown, requests: data.requests, plans, customerName: data.customer?.name ?? null, nowMs }) : []), [shown, data, plans, nowMs])
  const feed = useMemo<ChangeLine[]>(
    () =>
      shown && data
        ? buildWhatChanged({
            members: shown,
            requests: data.requests,
            submissionEntries: data.submissionEntries,
            bidChanges: data.bidChanges,
            statusEvents: data.statusEvents,
            invoices: data.invoices,
            payments: data.payments,
            threadNotes: data.threadNotes,
            bidNotes: data.bidNotes,
            entryLines: entries.map((e) =>
              entryLine(e, {
                site: data.development.name,
                job: (id) => {
                  const j = shown.jobs.find((x) => x.id === id)
                  return j ? { kind: 'job', id, label: `${jobLabel(j)} ${(j.job_name ?? '').trim()}`.trim() } : null
                },
                bid: (id) => {
                  const b = shown.bids.find((x) => x.id === id)
                  return b ? { kind: 'bid', id, label: `${bidLabel(b)} ${(b.project_name ?? '').trim()}`.trim() } : null
                },
                customer: (id) => (data.customer && data.customer.id === id ? data.customer.name : null),
              }),
            ),
            customerContacts: data.customerContacts,
            customerNames: new Map(data.customers.map((c) => [c.id, c.name])),
            names: data.names,
            bidLabel,
            jobLabel,
            stageLabel: labelJobsLedgerStatusForDashboard,
            money,
            shortDay,
            siteName: data.development.name,
            nowMs,
          })
        : [],
    [shown, data, entries, bidLabel, jobLabel, nowMs],
  )
  const since = useMemo(() => placeSinceLine(feed, lastLooked), [feed, lastLooked])
  const feedShown = useMemo(() => narrowLines(feed, histChip, histPiece), [feed, histChip, histPiece])
  const sinceShown = useMemo(() => placeSinceLine(feedShown, lastLooked), [feedShown, lastLooked])
  // The Plans question read back (PR 5): the open one, or the newest answered.
  const plansAsk = useMemo(() => (data ? plansAskOnRecord(data.requests, nowMs) : null), [data, nowMs])
  const historyAbouts = useMemo<HistoryAboutOption[]>(() => {
    if (!shown || !data) return []
    const jobs = shown.jobs.map((j) => ({ key: `job:${j.id}`, label: `${jobLabel(j)} ${(j.job_name ?? '').trim()}`.trim(), about: { kind: 'job' as const, id: j.id }, group: 'jobs' as const }))
    const bids = shown.bids.map((b) => ({ key: `bid:${b.id}`, label: `${bidLabel(b)} ${(b.project_name ?? '').trim()}`.trim(), about: { kind: 'bid' as const, id: b.id }, group: 'bids' as const }))
    const customer = data.customer ? [{ key: 'customer', label: data.customer.name, about: { kind: 'customer' as const, id: data.customer.id }, group: 'customer' as const }] : []
    return [{ key: 'site', label: `🏠 ${data.development.name}`, about: { kind: 'site' as const }, group: 'site' as const }, ...jobs, ...bids, ...customer]
  }, [shown, data, jobLabel, bidLabel])
  // The undated notes the records carry (the owner, mid-build: *all the job, bid, and customer comments along side it*), drawn under the chips.
  const onRecord = useMemo(() => (shown && data ? onRecordNotes(shown, data.customers, { bidLabel, jobLabel }) : []), [shown, data, bidLabel, jobLabel])
  const notInIt = useMemo(() => {
    const s = new Set<string>()
    for (const b of data?.atAddress.bids ?? []) s.add(`bid:${b.id}`)
    for (const j of data?.atAddress.jobs ?? []) s.add(`job:${j.id}`)
    return s
  }, [data])

  // Pair mode (the owner's ask): the unpaired bids and jobs among the rows shown, and the suggestions by name.
  const unpairedBids = useMemo(() => (shown ? shown.bids.filter((b) => !shown.jobs.some((j) => j.bid_id === b.id)) : []), [shown])
  const unpairedJobs = useMemo(() => (shown ? shown.jobs.filter((j) => !j.bid_id) : []), [shown])
  const suggestions = useMemo<PairSuggestion[]>(() => {
    if (!shown || !data) return []
    const drop = siteDropWords({ developmentName: data.development.name, address: sharedAddressWords(shown), customerName: data.customer?.name ?? null })
    return suggestPairs({ bids: unpairedBids, jobs: unpairedJobs, drop }).filter((s) => !notThese.has(`${s.bidId}:${s.jobId}`))
  }, [shown, data, unpairedBids, unpairedJobs, notThese])
  const wonCandidates = useMemo(() => (shown ? shown.bids.filter((b) => !b.outcome && shown.jobs.some((j) => j.bid_id === b.id)) : []), [shown])
  const pairedBids = useMemo(
    () => (shown ? shown.bids.filter((b) => shown.jobs.some((j) => j.bid_id === b.id)).map((b) => ({ bid: b, jobLabels: shown.jobs.filter((j) => j.bid_id === b.id).map(jobLabel) })) : []),
    [shown, jobLabel],
  )
  const hiddenJobIds = useMemo(() => new Set([...notThese].filter((k) => k.startsWith('nobid:')).map((k) => k.slice('nobid:'.length))), [notThese])

  const run = async (work: () => Promise<void>) => {
    setBusy(true)
    try {
      await work()
      await load()
    } catch (e) {
      showToast(formatErrorMessage(e, 'The change did not take.'), 'error')
    } finally {
      setBusy(false)
    }
  }
  const labelOfBid = (id: string) => {
    const b = shown?.bids.find((x) => x.id === id)
    return b ? bidLabel(b) : 'the bid'
  }
  const labelOfJob = (id: string) => {
    const j = shown?.jobs.find((x) => x.id === id)
    return j ? jobLabel(j) : 'the job'
  }
  // The pairing's writes (the pairing step): each opens a confirm window in the chips' shape first, and its toast carries the way back.
  const labels = { bidLabel, jobLabel }
  const jobsOfBid = (bidId: string) => shown?.jobs.filter((j) => j.bid_id === bidId) ?? []
  const previewBlock = (lines: string[], more: number) => (
    <div style={{ fontSize: '0.8rem', display: 'grid', gap: 2 }}>
      {lines.map((l) => (
        <div key={l}>{l}</div>
      ))}
      {more > 0 ? <div style={{ color: 'var(--text-faint)' }}>and {more} more</div> : null}
    </div>
  )
  const confirmThen = (w: PairingConfirm, work: () => Promise<void>) =>
    setChipConfirm({
      title: w.title,
      rows: w.rows,
      preview: previewBlock(w.previewLines, w.previewMore),
      previewCaption: w.previewCaption,
      confirmLabel: w.confirmLabel,
      onConfirm: () => {
        setChipConfirm(null)
        void run(work)
      },
    })
  const doPair = (bidId: string, jobId: string) => {
    if (!data || !shown) return
    const bid = shown.bids.find((x) => x.id === bidId)
    const job = shown.jobs.find((x) => x.id === jobId)
    if (!bid || !job) return
    const w = pairConfirm({ bid, job, bidJobs: jobsOfBid(bidId), suggestion: suggestions.find((s) => s.bidId === bidId && s.jobId === jobId) ?? null, customerName: data.customer?.name ?? null, developmentName: data.development.name, labels })
    confirmThen(w, async () => {
      await pairJobToBid(jobId, bidId)
      const t = pairedWords(bid, job, labels)
      showActionToast(t.line, {
        label: t.back,
        onClick: () =>
          void run(async () => {
            await unpairJob(jobId)
            showToast(t.undone, 'success')
          }),
      })
    })
  }
  const doPairAll = () => {
    if (!data || !shown) return
    const pairs = suggestions
      .map((s) => {
        const bid = unpairedBids.find((b) => b.id === s.bidId)
        const job = unpairedJobs.find((j) => j.id === s.jobId)
        return bid && job ? { bid, job, suggestion: s } : null
      })
      .filter((p): p is { bid: MemberBid; job: MemberJob; suggestion: PairSuggestion } => p !== null)
    if (pairs.length === 0) return
    const w = pairAllConfirm({ pairs, pairedNow: shown.jobs.filter((j) => !!j.bid_id).length, unpairedBids: unpairedBids.length, unpairedJobs: unpairedJobs.length, developmentName: data.development.name, labels })
    confirmThen(w, async () => {
      const r = await pairMany(pairs.map((p) => ({ jobId: p.job.id, bidId: p.bid.id })))
      const words = batchOutcomeWords({ verb: 'Pair', past: 'paired', done: r.done, failed: r.failed.length, noun: 'pair' })
      const line = r.failed.length ? `${words.line} ${r.failed.map((f) => `${labelOfJob(f.jobId)}: ${f.reason}`).join(' ')}` : words.line
      const took = pairs.filter((p) => !r.failed.some((f) => f.jobId === p.job.id)).map((p) => p.job.id)
      if (took.length === 0) {
        showToast(line, words.tone)
        return
      }
      const back = pairedAllBack(took.length)
      showActionToast(
        line,
        {
          label: back.back,
          onClick: () =>
            void run(async () => {
              const u = await unpairMany(took)
              const undone = batchOutcomeWords({ verb: 'unpair', past: 'unpaired', done: u.done, failed: u.failed.length, noun: 'pair' })
              showToast(u.failed.length ? `${undone.line} ${u.failed.map((f) => `${labelOfJob(f.jobId)}: ${f.reason}`).join(' ')}` : back.undone, undone.tone)
            }),
        },
        { type: words.tone },
      )
    })
  }
  const doUnpair = (jobId: string, bidId: string) => {
    if (!data || !shown) return
    const bid = shown.bids.find((x) => x.id === bidId)
    const job = shown.jobs.find((x) => x.id === jobId)
    if (!bid || !job) return
    const w = unpairConfirm({ bid, job, bidJobs: jobsOfBid(bidId), customerName: data.customer?.name ?? null, developmentName: data.development.name, labels })
    confirmThen(w, async () => {
      await unpairJob(jobId)
      const t = unpairedWords(bid, job, labels)
      showActionToast(t.line, {
        label: t.back,
        onClick: () =>
          void run(async () => {
            await pairJobToBid(jobId, bidId)
            showToast(t.undone, 'success')
          }),
      })
    })
  }
  const doMarkWon = () => {
    if (!data || !shown || wonCandidates.length === 0) return
    const bids = wonCandidates.map((b) => ({ bid: b, jobs: jobsOfBid(b.id) }))
    const w = markWonConfirm({ bids, wonNow: shown.bids.filter((b) => bidStatusWord(b) === 'won').length, undecidedNow: shown.bids.filter(bidUndecided).length, labels })
    confirmThen(w, async () => {
      const ids = bids.map((x) => x.bid.id)
      const r = await markBidsWon(ids)
      const words = batchOutcomeWords({ verb: 'mark won', past: 'marked', done: r.done, failed: r.failed.length, noun: ['bid won', 'bids won'] })
      const line = r.failed.length ? `${words.line} ${r.failed.map((f) => `${labelOfBid(f.bidId)}: ${f.reason}`).join(' ')}` : words.line
      const took = ids.filter((id) => !r.failed.some((f) => f.bidId === id))
      if (took.length === 0) {
        showToast(line, words.tone)
        return
      }
      const back = markedWonBack(took.length)
      showActionToast(
        line,
        {
          label: back.back,
          onClick: () =>
            void run(async () => {
              const u = await unmarkBidsWon(took)
              const undone = batchOutcomeWords({ verb: 'undo', past: 'undone', done: u.done, failed: u.failed.length, noun: 'bid' })
              showToast(u.failed.length ? `${undone.line} ${u.failed.map((f) => `${labelOfBid(f.bidId)}: ${f.reason}`).join(' ')}` : back.undone, undone.tone)
            }),
        },
        { type: words.tone },
      )
    })
  }
  const notTheseFor = (sug: PairSuggestion) => {
    const next = new Set(notThese)
    next.add(`${sug.bidId}:${sug.jobId}`)
    writeNotThese(developmentId, next)
    setNotThese(next)
  }
  const rememberNotThese = (keys: string[], toggle = false) => {
    const next = new Set(notThese)
    for (const k of keys) {
      if (toggle && next.has(k)) next.delete(k)
      else next.add(k)
    }
    writeNotThese(developmentId, next)
    setNotThese(next)
  }
  const doMakeBid = (job: MemberJob, v: BackfillSheetValues) =>
    void run(async () => {
      if (!authUser?.id || !data) throw new Error('Sign in first.')
      const made = await makeBidFromJob({
        jobId: job.id,
        jobLabel: jobLabel(job),
        projectName: v.projectName,
        address: job.job_address,
        customerId: job.customer_id,
        developmentId: job.development_id ?? data.development.id,
        serviceTypeId: job.service_type_id,
        estimatorId: job.account_manager_user_id ?? null,
        wonFor: v.wonFor,
        wonOn: v.wonOn,
        createdBy: authUser.id,
      })
      setBackfillJob(null)
      const label = made.bidNumber ? `${formatBidLedgerNumberLabel(resolveBidLedgerPrefix(job.service_type_id, prefixes), made.bidNumber)} ${v.projectName}` : v.projectName
      showActionToast(`Made ${label}${v.wonFor != null ? `, won for ${money(v.wonFor)}` : ''}, paired with ${jobLabel(job)}.`, {
        label: 'Undo',
        onClick: () =>
          void run(async () => {
            await undoBackfill(job.id, made.bidId)
            showToast(`Undone: ${label} is gone and ${jobLabel(job)} has no bid again.`, 'success')
          }),
      })
    })
  const doMakeJob = (bid: MemberBid) => {
    if (!jobForm) return
    jobForm.openNewJob({ prefillBidId: bid.id, onSaved: () => void load() })
  }
  const pieceWords = (kind: 'bid' | 'job', id: string): string => {
    if (kind === 'bid') {
      const b = shown?.bids.find((x) => x.id === id)
      return b ? `${bidLabel(b)} ${(b.project_name ?? '').trim()}`.trim() : 'the bid'
    }
    const j = shown?.jobs.find((x) => x.id === id)
    return j ? `${jobLabel(j)} ${(j.job_name ?? '').trim()}`.trim() : 'the job'
  }
  const houseLine = (name: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)', fontSize: '0.82rem' }}>
      <DevelopmentHouseIcon size={12} /> {name}
    </span>
  )
  const doPutIn = (kind: 'bid' | 'job', id: string) => {
    if (!data || !shown) return
    const name = data.development.name
    const words = pieceWords(kind, id)
    const customer = data.customer?.name ?? '—'
    const rows: ChipConfirmRow[] = []
    let preview: React.ReactNode = null
    if (kind === 'job') {
      const j = shown.jobs.find((x) => x.id === id)
      if (!j) return
      rows.push(
        { label: 'Development', before: '—', after: name, changes: true },
        { label: 'Customer', before: (j.customer_name ?? customer).trim() || '—', after: null, changes: false },
        { label: 'Address', before: (j.job_address ?? '').trim() || '—', after: null, changes: false },
        { label: 'Stage', before: labelJobsLedgerStatusForDashboard(j.status), after: null, changes: false },
        { label: 'Revenue', before: j.revenue ? money(j.revenue) : '$0', after: null, changes: false },
        { label: 'Pipeline house filter', before: `${data.inIt.jobs.length} ${pluralNoun('job', data.inIt.jobs.length)}`, after: `${data.inIt.jobs.length + 1} ${pluralNoun('job', data.inIt.jobs.length + 1)}`, changes: true },
      )
      preview = (
        <div>
          <div>
            <span style={{ color: 'var(--text-link)', fontWeight: 700 }}>{jobLabel(j)}</span> <strong>{(j.job_name ?? '').trim()}</strong>
            {(j.customer_name ?? '').trim() || data.customer?.name ? <span style={{ color: 'var(--text-muted)' }}> · {(j.customer_name ?? '').trim() || data.customer?.name}</span> : null}
          </div>
          {houseLine(name)}
        </div>
      )
    } else {
      const b = shown.bids.find((x) => x.id === id)
      if (!b) return
      const value = bidMoney(b)
      rows.push(
        { label: 'Development', before: '—', after: name, changes: true },
        { label: 'Customer', before: customer, after: null, changes: false },
        { label: 'Address', before: (b.address ?? '').trim() || '—', after: null, changes: false },
        { label: 'Status', before: bidStatusWord(b), after: null, changes: false },
        { label: 'Price', before: value != null ? money(value) : 'no price yet', after: null, changes: false },
        { label: 'Bid Board house filter', before: `${data.inIt.bids.length} ${pluralNoun('bid', data.inIt.bids.length)}`, after: `${data.inIt.bids.length + 1} ${pluralNoun('bid', data.inIt.bids.length + 1)}`, changes: true },
      )
      preview = (
        <div>
          <div>
            <span style={{ color: 'var(--text-link)', fontWeight: 700 }}>{bidLabel(b)}</span> <strong>{(b.project_name ?? '').trim()}</strong>
          </div>
          {houseLine(name)}
        </div>
      )
    }
    setChipConfirm({
      title: `Put ${words} in ${name}?`,
      rows,
      preview,
      previewCaption: kind === 'job' ? 'As it will read on the Pipeline and the Job window' : 'As it will read on the Bid Board and the Bid window',
      confirmLabel: `Put it in ${name}`,
      onConfirm: () => {
        setChipConfirm(null)
        void run(async () => {
          await putInDevelopment(kind, id, data.development.id)
          showActionToast(`Put ${words} in ${name}.`, {
            label: 'Take it out',
            onClick: () =>
              void run(async () => {
                await takeOutOfDevelopment(kind, id)
                showToast(`${words} is out of ${name} again.`, 'success')
              }),
          })
        })
      },
    })
  }
  // Put the N in (PR 3): the window shows the counts now and after and the pieces, then one transaction.
  const doPutAllIn = () => {
    if (!data) return
    const name = data.development.name
    const at = data.atAddress
    const rows = putInConfirmRows({ atAddress: at, inIt: data.inIt, name, address: address ?? null, customerName: data.customer?.name ?? null })
    const preview = putInPreviewLines(at, { bidLabel, jobLabel })
    setChipConfirm({
      title: putInLabel(at, name),
      rows: rows.map((r) => ({ label: r.label, before: r.before, after: r.after, changes: r.changes })),
      preview: previewBlock(preview.lines, preview.more),
      previewCaption: 'The jobs and bids that go in',
      confirmLabel: putInLabel(at, name),
      onConfirm: () => {
        setChipConfirm(null)
        void run(async () => {
          const moved = await putAllInDevelopment(data.development.id, at.bids.map((b) => b.id), at.jobs.map((j) => j.id))
          showToast(putInOutcomeWords(moved, { bids: at.bids.length, jobs: at.jobs.length }, name), moved.bids + moved.jobs > 0 ? 'success' : 'info', 7000)
        })
      },
    })
  }
  const doPutBackOnBoard = (bid: MemberBid) => {
    if (!data) return
    const words = pieceWords('bid', bid.id)
    const name = data.development.name
    const value = bidMoney(bid)
    const inIt = bid.development_id === data.development.id
    const rows: ChipConfirmRow[] = [
      { label: 'Board', before: bid.working_board_archived_at ? `archived ${shortDay(bid.working_board_archived_at)}` : 'archived', after: 'Unsent/Working · its column', changes: true },
      { label: 'Sent', before: bid.bid_date_sent ? shortDay(bid.bid_date_sent) : '—', after: null, changes: false },
      { label: 'Outcome', before: bid.outcome ?? '—', after: null, changes: false },
      { label: 'Price', before: value != null ? money(value) : 'no price yet', after: null, changes: false },
      { label: 'Development', before: inIt ? name : `not in ${name}`, after: null, changes: false },
    ]
    const at = bid.working_board_archived_at
    const by = bid.working_board_archived_by ?? null
    setChipConfirm({
      title: `Put ${words} back on the board?`,
      rows,
      preview: (
        <div style={{ display: 'inline-block', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', background: 'var(--surface)', minWidth: 220, fontSize: '0.84rem' }}>
          <span style={{ color: 'var(--text-link)', fontWeight: 700 }}>{bidLabel(bid)}</span> · <strong>{(bid.project_name ?? '').trim()}</strong>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>{(bid.address ?? '').trim()}</div>
        </div>
      ),
      previewCaption: 'As it will read on the Unsent/Working board',
      confirmLabel: 'Put it back on the board',
      onConfirm: () => {
        setChipConfirm(null)
        void run(async () => {
          await putBackOnBoard(bid.id)
          showActionToast(`${words} is back on the Unsent/Working board.`, {
            label: 'Hide it again',
            onClick: () =>
              void run(async () => {
                if (!at) return
                await hideFromBoardAgain(bid.id, at, by)
                showToast(`${words} is archived again.`, 'success')
              }),
          })
        })
      },
    })
  }
  const pairing: PairingProps = {
    on: pairMode,
    suggestions,
    unpairedBids,
    unpairedJobs,
    pairedBids,
    busy,
    onPair: doPair,
    onUnpair: doUnpair,
    onNotThese: notTheseFor,
    onNoBid: (jobId) => rememberNotThese([`nobid:${jobId}`], true),
    hiddenJobIds,
    onPairAll: doPairAll,
    onNotAll: () => rememberNotThese(suggestions.map((s) => `${s.bidId}:${s.jobId}`)),
    onMakeBid: (job) => setBackfillJob(job),
    onMakeJob: doMakeJob,
  }

  const openBid = useCallback((bidId: string) => bidPreview?.openBidPreview(bidId), [bidPreview])
  // The Job window reads jobs_ledger itself, so for the overview door a job's number says where the job opens instead.
  const openJob = useCallback(
    (jobId: string) => {
      if (door === 'office') {
        jobDetail?.openJobDetail({ jobId })
        return
      }
      const j = shown?.jobs.find((x) => x.id === jobId)
      showToast(jobDoorClosedWords(j ? jobLabel(j) : 'The job'), 'info', 6000)
    },
    [door, jobDetail, shown, jobLabel, showToast],
  )
  const openAbout = useCallback(
    (about: ChangeLine['about']) => {
      if (about.kind === 'bid' && about.id) openBid(about.id)
      else if (about.kind === 'job' && about.id) openJob(about.id)
    },
    [openBid, openJob],
  )
  const openCarrier = useCallback((c: PlanCarrier) => (c.kind === 'bid' ? openBid(c.id) : openJob(c.id)), [openBid, openJob])
  const requestAbout = useCallback(
    (r: MemberRequest): string => {
      const b = r.bid_id ? shown?.bids.find((x) => x.id === r.bid_id) : null
      const j = r.job_ledger_id ? shown?.jobs.find((x) => x.id === r.job_ledger_id) : null
      if (b) return `${bidLabel(b)} ${(b.project_name ?? '').trim()}`.trim()
      if (j) return `${jobLabel(j)} ${(j.job_name ?? '').trim()}`.trim()
      return data?.development.name ?? 'the site'
    },
    [shown, data, bidLabel, jobLabel],
  )

  const markLooked = () => {
    const iso = new Date().toISOString()
    writeLastLooked(developmentId, iso)
    setLastLooked(iso)
  }
  const toggleInclude = () => {
    const next = !includeAddress
    writeIncludeAddress(developmentId, next)
    setIncludeAddress(next)
  }
  const openAsk = (preset: AskPreset = {}) => setAsk(preset)
  const askOptions: AskAboutOption[] = [
    { key: 'site', label: `🏠 ${data?.development.name ?? ''}`, about: { kind: 'site' }, group: 'site' },
    ...(shown?.jobs ?? []).map((j) => ({ key: `job:${j.id}`, label: `${jobLabel(j)} ${(j.job_name ?? '').trim()}`.trim(), about: { kind: 'job' as const, id: j.id, label: `${jobLabel(j)} ${(j.job_name ?? '').trim()}`.trim() }, group: 'jobs' as const })),
    ...(shown?.bids ?? []).map((b) => ({ key: `bid:${b.id}`, label: `${bidLabel(b)} ${(b.project_name ?? '').trim()}`.trim(), about: { kind: 'bid' as const, id: b.id, label: `${bidLabel(b)} ${(b.project_name ?? '').trim()}`.trim() }, group: 'bids' as const })),
  ]
  // The send: the lane's own row with one reference, the lane's push, the page read again; a failure names its reason.
  const sendAskDraft = async (draft: AskDraft): Promise<boolean> => {
    if (!authUser?.id || !data) {
      showToast('Sign in first.', 'error', 5000)
      return false
    }
    setAsking(true)
    try {
      const out = await sendAsk(draft.lane, askRow(draft, developmentId, data.development.name, authUser.id))
      showToast(out.pushed ? askSentWords(draft, data.development.name) : `${askSentWords(draft, data.development.name)} The push did not go: ${out.pushError ?? 'no reason given'}.`, out.pushed ? 'success' : 'warning', 7000)
      await load()
      return true
    } catch (e) {
      showToast(`Not asked: ${formatErrorMessage(e)}`, 'error', 6000)
      return false
    } finally {
      setAsking(false)
    }
  }

  if (!developmentId) return <EmptyState main="This link names no development." next={{ label: 'Pipeline', to: '/jobs?tab=stages' }} tail="has every job with its development." />
  if (failure) {
    return (
      <div style={{ padding: '1rem 0' }}>
        <OfflineRetryPanel failure={failure} onRetry={() => void load()} idempotent surface="development-page" />
      </div>
    )
  }
  if (loading && !data) return <p style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>Reading the site…</p>
  if (!data || !shown || !counts || !people || !plans) return null

  const dev = data.development
  const customerRow = data.customer as (Database['public']['Tables']['customers']['Row'] & { contact_info: unknown }) | null
  const contact = customerRow ? extractContactFromCustomer(customerRow as Database['public']['Tables']['customers']['Row']) : { phone: '', email: '' }
  const address = sharedAddressWords(shown)
  const atAddress = data.atAddress
  const atAddressTotal = atAddress.bids.length + atAddress.jobs.length
  const whoIsThis = data.gcCustomer?.name ?? data.customer?.name ?? null
  const openQuestions = data.requests.filter(requestIsOpen).length
  // The Money look: the site's band and the live jobs in stage sections, from the same rows.
  const siteMoney = buildSiteMoney({ members: shown, invoices: data.invoices, names: data.names, teamMembers: data.teamMembers, jobLabel, paySpeed: data.paySpeed, todayYmd: todayYmdInAppTz() })
  const moneyWords = moneyLookWords(siteMoney, money)

  // The strip's five looks: the plain count with its noun, and in amber what in it needs the leader.
  const activePieces = pieces.filter((r) => !r.done).length
  const looks: Record<DevelopmentJumpKey, DevelopmentLook> = {
    changed: { n: since.newCount, count: `${since.newCount} new`, need: since.newCount > 0 ? `${since.newCount} new` : null },
    pieces: { n: activePieces, count: String(activePieces), need: suggestions.length > 0 ? `${suggestions.length} likely ${suggestions.length === 1 ? 'pair' : 'pairs'}` : null },
    money: moneyShown ? { n: siteMoney.band.jobs, count: moneyWords.count, need: moneyWords.need } : { n: 0, count: OFFICE_READS_MONEY_CHIP, need: null },
    plans: { n: plans.sets.length, count: `${plans.sets.length} ${plans.sets.length === 1 ? 'set' : 'sets'}`, need: plansNeedWords(plans) },
    questions: {
      n: data.requests.length,
      count: openQuestions > 0 && openQuestions === data.requests.length ? `${openQuestions} waiting` : String(data.requests.length),
      need: openQuestions > 0 ? `${openQuestions} waiting` : null,
    },
  }

  // The newest bid: where the GC contact and the estimator live when the head has none (the owner, 2026-10-28: *do all 8*, item 4).
  const newestBid = [...shown.bids].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))[0] ?? null
  // The counts' cards (the owner's pick A): what each tile holds, from the same rows the counts read.
  const cardInputs = { members: shown, atAddress: includeAddress ? { bids: [], jobs: [] } : atAddress, requests: data.requests, names: data.names, teamMembers: data.teamMembers, bidLabel, jobLabel, stageLabel: labelJobsLedgerStatusForDashboard, money, shortDay, nowMs: Date.now(), siteName: dev.name, reader: door }
  const cards: Record<CountKey, CountCard> = {
    waiting: buildCountCard('waiting', cardInputs),
    bids: buildCountCard('bids', cardInputs),
    jobs: buildCountCard('jobs', cardInputs),
    bidUndecided: buildCountCard('bidUndecided', cardInputs),
    openOnBills: buildCountCard('openOnBills', cardInputs),
  }
  // The office's five; the overview door's three, with no dollar in them (`countKeysFor`).
  const tileKeys = countKeysFor(door)
  const tiles: CountTileSpec[] = (
    [
      { key: 'waiting', cap: 'Waiting', tone: counts.waiting.count ? 'amber' : undefined, value: counts.waiting.count ? `${counts.waiting.count} ${pluralNoun('question', counts.waiting.count)}` : 'Nothing', sub: counts.waiting.count ? `oldest ${counts.waiting.oldestAgeDays ?? 0} ${counts.waiting.oldestAgeDays === 1 ? 'day' : 'days'}` : 'on the office' },
      { key: 'bids', cap: 'Bids', value: counts.bids.total, sub: `${counts.bids.sent} sent · ${counts.bids.undecided} undecided${counts.bids.archived ? ` · ${counts.bids.archived} archived` : ''}` },
      { key: 'jobs', cap: 'Jobs', value: counts.jobs.total, sub: `${counts.jobs.open} open · ${counts.jobs.working} working` },
      { key: 'bidUndecided', cap: 'Bid, undecided', value: money(counts.bidUndecidedUsd), sub: counts.bids.undecided ? `${counts.bids.undecided} ${pluralNoun('bid', counts.bids.undecided)}` : counts.bids.archived ? 'none in play' : 'every bid is decided' },
      { key: 'openOnBills', cap: 'Open on bills', tone: counts.openOnBillsUsd ? 'green' : undefined, value: money(counts.openOnBillsUsd), sub: counts.openOnBillsUsd ? 'billed, not yet paid' : 'nothing unpaid' },
    ] as CountTileSpec[]
  ).filter((t) => tileKeys.includes(t.key))
  // Each look folds to one line that says what its strip chip says.
  const foldFor = (key: DevelopmentJumpKey, line: string) => ({ open: !isFolded(lookFolds, key, false), onToggle: () => toggleLook(key), line })
  const lineOf = (look: DevelopmentLook) => (look.need && look.need !== look.count ? `${look.count} · ${look.need}` : look.need ?? look.count)
  const moneyLine = siteMoney.band.jobs
    ? `${siteMoney.band.pct != null ? `${siteMoney.band.pct}% done · ` : ''}${money(siteMoney.band.value)} · ${money(siteMoney.band.left)} left${siteMoney.band.pastDue ? ` · ${siteMoney.band.pastDue} past due` : ''}`
    : 'no job yet'
  const goToQuestions = () => document.getElementById(DEVELOPMENT_JUMP_ANCHOR.questions)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const openCountRow = (door: CountDoor) => {
    if (door.kind === 'bid') openBid(door.id)
    else if (door.kind === 'job') openJob(door.id)
    else goToQuestions()
  }
  // The presses on a card's kind rows: the two asks (PR 4's sheet), PR 3's one press.
  const pressCount = (action: CountPress) => {
    if (action === 'askEstimators') openAsk({ lane: 'estimators' })
    else if (action === 'askDispatch') openAsk({ lane: 'dispatch' })
    else doPutAllIn()
  }
  const goToPieces = () => document.getElementById(DEVELOPMENT_JUMP_ANCHOR.pieces)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const openCountFoot = (foot: CountFootDoor) => {
    if (foot === 'bids') navigate('/bids')
    // The Pipeline and GC Review are the office's pages; the overview door's reader is sent to the Pieces table here.
    else if (foot === 'jobs' || foot === 'gcReview') {
      if (!moneyShown) goToPieces()
      else navigate(foot === 'jobs' ? '/jobs?tab=stages' : '/jobs?tab=stages&gcReview=1')
    } else if (foot === 'pieces') {
      // The chip card's foot: draw the at-address pieces in the table (the spike's toggle) and go there.
      if (!includeAddress) toggleInclude()
      window.setTimeout(() => document.getElementById(DEVELOPMENT_JUMP_ANCHOR.pieces)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
    } else goToQuestions()
  }
  // The *not in it* line's chips, each with its card: the at-address pieces by stage or status (the owner's pick A of not-in-hover-mockup.html).
  const street = address ? address.split(',')[0]?.trim() || null : null
  const chipInputs = { ...cardInputs, atAddress }
  const notInChips: NotInChip[] = [
    ...(atAddress.jobs.length ? [{ key: 'jobs' as const, label: `${atAddress.jobs.length} ${pluralNoun('job', atAddress.jobs.length)}`, card: buildAtAddressCard('jobs', chipInputs, street, includeAddress) }] : []),
    ...(atAddress.bids.length ? [{ key: 'bids' as const, label: `${atAddress.bids.length} ${pluralNoun('bid', atAddress.bids.length)}`, card: buildAtAddressCard('bids', chipInputs, street, includeAddress) }] : []),
  ]

  // The History look's one write: keep an entry; it reads at the top at once, and the failure names its reason.
  const keepHistory = async (draft: HistoryDraft): Promise<boolean> => {
    if (!authUser?.id) {
      showToast('Sign in first.', 'error', 5000)
      return false
    }
    setKeeping(true)
    try {
      const entry = await keepHistoryEntry(draft, developmentId, { userId: authUser.id, name: data.names.get(authUser.id) ?? null })
      setKept((prev) => [entry, ...prev])
      return true
    } catch (e) {
      showToast(`Not kept: ${formatErrorMessage(e)}`, 'error', 6000)
      return false
    } finally {
      setKeeping(false)
    }
  }
  // A Pieces row's *history ›* door: the stream narrowed to that piece, the card open, the page there.
  const showPieceHistory = (piece: HistoryPiece) => {
    setHistPiece(piece)
    setHistChip('all')
    setWriting(true)
    if (isFolded(lookFolds, 'changed', false)) toggleLook('changed')
    window.setTimeout(() => document.getElementById(DEVELOPMENT_JUMP_ANCHOR.changed)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30)
  }
  const narrowed = histChip !== 'all' || histPiece !== null
  const onRecordShown = histChip === 'all' || histChip === 'wrote' ? onRecord.filter((n) => aboutIsPiece(n.about, histPiece)) : []
  // The card's body shows with something new, a search, a narrowing, the older lines open or the composer asked for; otherwise the card is one line (the owner, 2026-10-28: compact).
  const historyOpen = !!feedQuery.trim() || !lastLooked || since.newCount > 0 || olderOpen || writing || narrowed

  const btn = (label: string, onClick: () => void, title?: string, primary?: boolean) => (
    <SmallButton onClick={onClick} title={title} primary={primary}>
      {label}
    </SmallButton>
  )

  return (
    <div data-testid="development-page">
      {/* The whole of a long History line (the owner, 2026-10-29: the rest in a modal). */}
      <DevelopmentLineWindow line={lineOpen} onClose={() => setLineOpen(null)} openAbout={(a) => { setLineOpen(null); openAbout(a) }} />
      <DevelopmentAskSheet open={ask !== null} preset={ask} options={askOptions} siteName={dev.name} busy={asking} onSend={sendAskDraft} onClose={() => setAsk(null)} />
      <div style={{ marginBottom: '0.4rem', display: 'flex', gap: 12, fontSize: '0.8rem' }}>
        <LinkButton onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(moneyShown ? '/jobs?tab=stages' : '/bids'))}>← Back</LinkButton>
        {moneyShown ? (
          <Link to="/jobs?tab=stages" style={{ color: 'var(--text-link)', textDecoration: 'none' }}>
            Pipeline
          </Link>
        ) : null}
        <Link to="/bids" style={{ color: 'var(--text-link)', textDecoration: 'none' }}>
          Bid Board
        </Link>
      </div>

      {/* The head: the house, the name, who, where, the people, the two presses. */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '1.45rem', color: 'var(--text-strong)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <DevelopmentHouseIcon size={20} style={{ color: 'var(--text-muted)' }} />
          {dev.name.trim() || '—'}
        </h1>
        {dev.archived_at ? <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '1px 8px', borderRadius: 9999, background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>Archived</span> : null}
        <span style={{ fontSize: '0.78rem', color: 'var(--text-faint)' }}>Development since {shortDay(dev.created_at)}</span>
        <div style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
          {btn('Ask a question', () => openAsk(), 'Ask the estimators or Dispatch about the site or one of its jobs or bids; the answer comes back under Questions', true)}
          {btn('Edit', () => navigate('/settings?tab=settings-jobs'), 'Rename, the default GC, archive: Settings → Jobs & dispatch → Manage developments')}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', padding: '6px 0 4px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        {whoIsThis ? (
          data.customer ? (
            <Link to={`/customers/${data.customer.id}`} style={{ color: 'var(--text-link)', textDecoration: 'none', fontWeight: 600 }}>
              {whoIsThis}
            </Link>
          ) : (
            <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{whoIsThis}</span>
          )
        ) : (
          <span style={{ color: 'var(--text-faint)' }}>none on its jobs or bids yet</span>
        )}
        {address ? (
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)', textDecoration: 'none' }}>
            📍 {address} · Map
          </a>
        ) : (
          <span style={{ color: 'var(--text-faint)' }}>none yet · the first bid or job in it brings one</span>
        )}
        {dev.city ? <span>{dev.city}</span> : null}
        {contact.phone ? (
          <a href={telHrefFor(contact.phone)} style={{ color: 'var(--text-link)', textDecoration: 'none' }}>
            📞 {contact.phone}
          </a>
        ) : null}
      </div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', padding: '2px 0 10px', borderBottom: '1px solid var(--border)', fontSize: '0.82rem' }}>
        <span>
          <span style={capStyle}>GC contact</span>{' '}
          {people.gcContact ? (
            <>
              <strong style={{ color: 'var(--text-strong)' }}>{people.gcContact.name}</strong>
              {people.gcContact.phone ? (
                <>
                  {' · '}
                  <a href={telHrefFor(people.gcContact.phone)} style={{ color: 'var(--text-link)', textDecoration: 'none' }}>
                    {people.gcContact.phone}
                  </a>
                </>
              ) : null}
            </>
          ) : (
            <LinkButton onClick={() => (newestBid ? openBid(newestBid.id) : navigate('/settings?tab=settings-jobs'))} title={newestBid ? 'The GC contact lives on a bid: this opens the newest one, its Edit tab has the contact' : 'No bid yet: the development\'s default GC is set under Settings → Jobs & dispatch → Manage developments'}>
              none yet · add one
            </LinkButton>
          )}
        </span>
        <span>
          <span style={capStyle}>Estimating</span> {people.estimating.length ? <strong style={{ color: 'var(--text-strong)' }}>{people.estimating.join(', ')}</strong> : <LinkButton onClick={() => (newestBid ? openBid(newestBid.id) : navigate('/bids'))} title={newestBid ? 'The estimator is picked on a bid: this opens the newest one' : 'No bid yet: the Bid Board makes one'}>none yet · pick one</LinkButton>}
        </span>
        <span>
          <span style={capStyle}>On site</span>{' '}
          {people.onSite ? (
            <>
              <strong style={{ color: 'var(--text-strong)' }}>{people.onSite.names.length ? people.onSite.names.join(', ') : 'a crew'}</strong>
              {people.onSite.jobLabel ? <span style={{ color: 'var(--text-muted)' }}> on {people.onSite.jobLabel}</span> : null}
              {people.onSite.since ? <span style={{ color: 'var(--text-muted)' }}> · last work {shortDay(people.onSite.since)}</span> : null}
            </>
          ) : (
            <span style={{ color: 'var(--text-faint)' }}>no job working</span>
          )}
        </span>
      </div>

      {/* The counts, the waiting one first; each tile holds its card. */}
      <DevelopmentCounts tiles={tiles} cards={cards} phone={phone} onRow={openCountRow} onFoot={openCountFoot} onPress={pressCount} />

      <DevelopmentJumpStrip looks={looks} />

      {/* Not in it yet: the records at the address, with the spike's toggle that shows them on the page. */}
      {atAddressTotal > 0 && !hideNotInIt ? (
        <div
          data-testid="not-in-it-line"
          style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '8px 12px', marginBottom: 12, borderRadius: 8, background: 'var(--bg-amber-tint)', border: '1px solid var(--bg-amber-200)', fontSize: '0.85rem' }}
        >
          {/* The owner's pick C (not-in-line-mockup.html): the development wears the house, the address the pin, the counts are chips. */}
          <strong style={{ color: 'var(--text-amber-800)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {atAddressTotal} not in <DevelopmentHouseIcon size={12} aria-label="the development" /> {dev.name}
          </strong>
          {/* The chips open their details on hover, pinned on press, a sheet on a phone (the owner's pick A of not-in-hover-mockup.html). */}
          <DevelopmentNotInChips chips={notInChips} phone={phone} onRow={openCountRow} onFoot={openCountFoot} onPress={pressCount} />
          <span style={{ color: 'var(--text-strong)' }}>
            at <span aria-label="the address">📍</span> {address ?? 'this address'} {atAddressTotal === 1 ? 'is' : 'are'} not in the development.
          </span>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
            <SmallButton onClick={toggleInclude} title="Draws them on this page as if they were in it, on this device only; writes nothing">
              {includeAddress ? `Hide the ${atAddressTotal}` : `Show the ${atAddressTotal} here`}
            </SmallButton>
            <SmallButton onClick={doPutAllIn} title="Every bid and job at this address into the development, in one transaction, after a window shows what changes" primary disabled={busy}>
              {putInLabel(atAddress, dev.name)}
            </SmallButton>
            <SmallButton onClick={() => setHideNotInIt(true)} title="Hides this line until the page is opened again">
              Not these
            </SmallButton>
          </span>
        </div>
      ) : null}
      {atAddressTotal === 0 && !hideNotInIt && shown.bids.length + shown.jobs.length > 0 && !includeAddress ? null : null}

      <div style={{ display: 'grid', gap: 14 }}>
        <Card
          id={DEVELOPMENT_JUMP_ANCHOR.changed}
          title="History" fold={foldFor('changed', `${since.newCount} new · ${feed.length} lines`)}
          meta={
            feedQuery.trim()
              ? `${filterChangeLines(feedShown, feedQuery).length} of ${feedShown.length} ${pluralNoun('line', feedShown.length)} match`
              : narrowed
                ? narrowedWords(feedShown.length, feed.length, histChip, histPiece)
                : lastLooked
                  ? since.newCount === 0
                    ? `nothing since you looked · ${shortDay(lastLooked)}`
                    : `${since.newCount} since you looked · ${shortDay(lastLooked)}`
                  : `${feed.length} ${pluralNoun('line', feed.length)} · first look`
          }
          right={
            <>
              {/* The search (the owner, 2026-10-28): people, jobs or bids, across every line, new and old, the kept lines too. */}
              {feed.length > 0 ? (
                <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                  <input
                    value={feedQuery}
                    onChange={(e) => setFeedQuery(e.target.value)}
                    placeholder="Search people, jobs, bids, words"
                    aria-label="Search the history"
                    data-testid="feed-search"
                    style={{ height: 30, width: 'min(240px, 60vw)', padding: '0 26px 0 10px', border: '1px solid var(--border-strong)', borderRadius: 5, font: 'inherit', fontSize: '0.8rem', background: 'var(--surface)', color: 'var(--text-strong)' }}
                  />
                  {feedQuery ? (
                    <button type="button" onClick={() => setFeedQuery('')} aria-label="Clear the search" title="Clear" style={{ position: 'absolute', right: 4, border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', font: 'inherit', fontSize: '0.9rem', lineHeight: 1, padding: '2px 4px' }}>
                      ×
                    </button>
                  ) : null}
                </span>
              ) : null}
              {feedQuery.trim() || narrowed ? null : lastLooked && since.newCount === 0 ? (
                // Nothing new: the card is one line (the owner, 2026-10-28), the button opens the older lines, Write opens the composer.
                <>
                  {feed.length > 0 ? <FoldButton open={olderOpen} label={olderOpen ? `Hide the ${feed.length} older` : `Show ${feed.length} older`} onClick={() => setOlderOpen((v) => !v)} testId="feed-fold" /> : null}
                  {historyOpen ? null : (
                    <LinkButton onClick={() => setWriting(true)} title="Keep a line: what happened, when, about which piece">
                      Write ›
                    </LinkButton>
                  )}
                </>
              ) : (
                <LinkButton onClick={markLooked}>Mark as looked</LinkButton>
              )}
            </>
          }
        >
          {historyOpen ? (
            <>
              <DevelopmentHistoryComposer options={historyAbouts} phone={phone} busy={keeping} onKeep={keepHistory} />
              <DevelopmentHistoryChips chip={histChip} onChip={setHistChip} piece={histPiece} onClearPiece={() => setHistPiece(null)} />
              {onRecordShown.length > 0 ? (
                <div data-testid="history-on-record" style={{ marginBottom: 10, padding: '6px 10px', border: '1px dashed var(--border-strong)', borderRadius: 6, fontSize: '0.8rem' }}>
                  <div style={{ ...capStyle, marginBottom: 2 }} title="Notes the records carry with no date: a bid's notes, a job's collections note, the customer's terms">
                    On record · {onRecordShown.length}
                  </div>
                  {onRecordShown.map((n) => (
                    <div key={n.key} style={{ display: 'flex', gap: 6, alignItems: 'baseline', padding: '2px 0', minWidth: 0, flexWrap: 'wrap' }} data-testid="history-on-record-line">
                      <strong style={{ color: 'var(--text-strong)', flex: 'none' }}>{n.label}</strong>
                      <span style={{ color: 'var(--text-faint)' }}>·</span>
                      {n.about.id && n.about.kind !== 'customer' ? (
                        <LinkButton onClick={() => openAbout(n.about)} nowrap>
                          {n.about.label}
                        </LinkButton>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{n.about.label}</span>
                      )}
                      <span style={{ color: 'var(--text-muted)', minWidth: 0 }}>· {n.text}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {narrowed && feedShown.length === 0 ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }} data-testid="history-narrow-empty">
                  <span className="developmentCountChip">0 lines</span>
                  <LinkButton
                    onClick={() => {
                      setHistChip('all')
                      setHistPiece(null)
                    }}
                  >
                    Show everything
                  </LinkButton>
                </div>
              ) : (
                <DevelopmentFeed lines={feedShown} sinceIndex={sinceShown.index} lastLooked={lastLooked} openAbout={openAbout} olderOpen={olderOpen} onToggleOlder={() => setOlderOpen((v) => !v)} query={feedQuery} onMore={setLineOpen} />
              )}
            </>
          ) : null}
        </Card>

        <Card
          id={DEVELOPMENT_JUMP_ANCHOR.pieces}
          title="Jobs & bids" fold={foldFor('pieces', `${activePieces} working or waiting · ${pieces.length - activePieces} paid${suggestions.length ? ` · ${suggestions.length} likely ${suggestions.length === 1 ? 'pair' : 'pairs'}` : ''}`)}
          meta={`each bid with the job it became${plans.newest ? ` · newest set ${plans.newest.dated ? shortDay(plans.newest.dated) : shortDay(plans.newest.filedAt)}` : ''}`}
          right={
            <>
              {wonCandidates.length > 0 && !pairMode ? (
                <SmallButton onClick={doMarkWon} disabled={busy} title="Sets Won on the paired bids that have no outcome yet, after a window shows what changes; the Bid Board moves them, so this press is yours">
                  {`${countedLabel('Mark the', wonCandidates.length, 'paired bid')} won`}
                </SmallButton>
              ) : null}
              {/* Pairing writes the job's bid link, which the overview door's reader cannot: the press is the office's. */}
              {shown.bids.length + shown.jobs.length > 0 && moneyShown ? (
                <SmallButton onClick={() => setPairMode((v) => !v)} disabled={busy} primary={!pairMode} title="Pair each bid with the job it became in the row; a window shows each pair before it is kept, one write per pair, nothing else moves">
                  {pairMode ? 'Done pairing' : 'Pair bids with jobs'}
                </SmallButton>
              ) : null}
              <Link to="/bids" style={{ color: 'var(--text-link)', textDecoration: 'none' }} title="The Bid Board, its house filter set to this development (the filter comes next)">
                Bid Board
              </Link>
              {moneyShown ? (
                <Link to="/jobs?tab=stages" style={{ color: 'var(--text-link)', textDecoration: 'none' }} title="The Pipeline, its house filter set to this development (the filter comes next)">
                  Pipeline
                </Link>
              ) : null}
            </>
          }
        >
          {shown.bids.length + shown.jobs.length === 0 ? (
            <EmptyState main={`Nothing in ${dev.name} yet.`} next={{ label: 'Bid Board', to: '/bids' }} tail={`and the Pipeline have a Development picker on Edit Bid and Edit Job, and a saved record at a shared address offers Put it in ${dev.name}.`} compact />
          ) : (
            <DevelopmentPieces rows={pieces} bidLabel={bidLabel} jobLabel={jobLabel} names={data.names} teamMembers={data.teamMembers} openBid={openBid} openJob={openJob} notInIt={includeAddress ? notInIt : new Set()} developmentName={dev.name} pairing={moneyShown ? pairing : undefined} onPutIn={doPutIn} onPutBackOnBoard={doPutBackOnBoard} onHistory={showPieceHistory} busy={busy} moneyShown={moneyShown} />
          )}
        </Card>

        {moneyShown ? (
          <Card
            id={DEVELOPMENT_JUMP_ANCHOR.money}
            title="Money"
            fold={foldFor('money', moneyLine)}
            meta={`where the site's money is · ${siteMoney.band.jobs} ${siteMoney.band.jobs === 1 ? 'job' : 'jobs'}`}
            right={
              <>
                {moneySort !== 'tightest' ? (
                  <button type="button" className="developmentSortedChip" onClick={() => setMoneySortMode('tightest')} title="Back to tightest first" data-testid="money-sorted-chip">
                    Sorted: {MONEY_SORT_LABELS[moneySort]} <span aria-hidden>×</span>
                  </button>
                ) : null}
                <Link to="/jobs?tab=stages&gcReview=1" style={{ color: 'var(--text-link)', textDecoration: 'none' }} title="GC Review's statement for this development (By development)">
                  GC Review · this development ›
                </Link>
              </>
            }
          >
            <DevelopmentMoney model={siteMoney} phone={phone} sort={moneySort} onSort={setMoneySortMode} isFolded={(k, d) => isFolded(moneyFolds, k, d)} onToggleFold={toggleMoneyFold} openJob={openJob} onAskForDate={(jobId) => openJob(jobId)} onLienDesk={() => navigate('/jobs?tab=stages&liendesk=1')} />
          </Card>
        ) : (
          // The overview door (PR 6): the look is one line, with nothing to open; the figures live on the office's pages.
          <Card id={DEVELOPMENT_JUMP_ANCHOR.money} title="Money" meta={<span data-testid="money-office-line">{OFFICE_READS_MONEY}</span>}>
            {null}
          </Card>
        )}

        <Card id={DEVELOPMENT_JUMP_ANCHOR.plans} title="Plans" fold={foldFor('plans', lineOf(looks.plans))} meta="every set on the site, newest first">
          <DevelopmentPlansCard view={plans} openCarrier={openCarrier} askAbout={(n) => openAsk({ lane: 'estimators', title: askTitleForPlans(n) })} askOnRecord={plansAsk} openQuestions={goToQuestions} />
        </Card>

        <Card id={DEVELOPMENT_JUMP_ANCHOR.questions} title="Questions" fold={foldFor('questions', lineOf(looks.questions))} meta={data.requests.length ? `${data.requests.length} on this site · ${openQuestions} waiting · open first` : 'what a site waits on'}>
          <DevelopmentQuestionsCard requests={data.requests} names={data.names} aboutLabel={requestAbout} openAbout={(r) => (r.bid_id ? openBid(r.bid_id) : r.job_ledger_id ? openJob(r.job_ledger_id) : undefined)} waitingCard={cards.waiting} onRow={openCountRow} onPress={pressCount} />
        </Card>
      </div>
      {chipConfirm ? (
        <DevelopmentChipConfirm title={chipConfirm.title} rows={chipConfirm.rows} preview={chipConfirm.preview} previewCaption={chipConfirm.previewCaption} confirmLabel={chipConfirm.confirmLabel} busy={busy} onConfirm={chipConfirm.onConfirm} onCancel={() => setChipConfirm(null)} />
      ) : null}
      {backfillJob ? (
        <DevelopmentBackfillSheet
          job={backfillJob}
          jobLabel={jobLabel(backfillJob)}
          developmentName={dev.name}
          customerName={data.customer?.name ?? null}
          estimatorName={backfillJob.account_manager_user_id ? data.names.get(backfillJob.account_manager_user_id) ?? null : null}
          busy={busy}
          onMake={(v) => doMakeBid(backfillJob, v)}
          onClose={() => setBackfillJob(null)}
        />
      ) : null}
    </div>
  )
}
