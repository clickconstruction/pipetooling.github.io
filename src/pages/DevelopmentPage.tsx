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
import { DevelopmentJumpStrip, DEVELOPMENT_JUMP_ANCHOR, DEVELOPMENT_PHONE_QUERY } from '../components/developments/DevelopmentJumpStrip'
import { DevelopmentPieces } from '../components/developments/DevelopmentPieces'
import type { PairingProps } from '../components/developments/DevelopmentPairCells'
import { DevelopmentBackfillSheet, type BackfillSheetValues } from '../components/developments/DevelopmentBackfillSheet'
import { makeBidFromJob, undoBackfill } from '../lib/developments/backfillWrites'
import { hideFromBoardAgain, putBackOnBoard, putInDevelopment, takeOutOfDevelopment } from '../lib/developments/chipWrites'
import { DevelopmentChipConfirm, type ChipConfirmRow } from '../components/developments/DevelopmentChipConfirm'
import { useJobFormModal } from '../contexts/JobFormModalContext'
import { useAuth } from '../hooks/useAuth'
import { DevelopmentPlansCard, DevelopmentQuestionsCard } from '../components/developments/DevelopmentSideCards'
import { Card, capStyle, money, shortDay, SmallButton, LinkButton } from '../components/developments/developmentPageBits'
import OfflineRetryPanel from '../components/OfflineRetryPanel'
import { useBidPreview } from '../contexts/BidPreviewModalContext'
import { useJobDetailModal } from '../contexts/JobDetailModalContext'
import { useLedgerPrefixMap } from '../contexts/LedgerDisplayPrefixContext'
import { useToastContext } from '../contexts/ToastContext'
import { useMatchMedia } from '../hooks/useMatchMedia'
import { fetchDevelopmentPage, type DevelopmentPageData } from '../lib/developments/fetchDevelopmentPage'
import { bidMoney, bidStatusWord, headCounts, requestIsOpen, sharedAddressWords, sitePeople, type MemberBid, type MemberJob, type MemberRequest, type Members } from '../lib/developments/overview'
import { buildPieceRows } from '../lib/developments/pieces'
import { buildPlansView, type PlanCarrier } from '../lib/developments/plans'
import { readIncludeAddress, readLastLooked, readNotThese, writeIncludeAddress, writeLastLooked, writeNotThese } from '../lib/developments/sinceYouLooked'
import { siteDropWords, suggestPairs, type PairSuggestion } from '../lib/developments/pairing'
import { markBidsWon, pairJobToBid, pairMany, unpairJob } from '../lib/developments/pairingWrites'
import { batchOutcomeWords, countedLabel, pluralNoun } from '../lib/batchWords'
import { buildWhatChanged, placeSinceLine, type ChangeLine } from '../lib/developments/whatChanged'
import { formatBidLedgerNumberLabel, formatJobLedgerNumberLabel, resolveBidLedgerPrefix, resolveJobLedgerPrefix } from '../lib/ledgerDisplayPrefixes'
import { labelJobsLedgerStatusForDashboard } from '../lib/jobsLedgerStatusPipeline'
import { extractContactFromCustomer } from '../lib/jobs/jobFormCustomerDisplay'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../lib/offlineRecoveryState'
import { telHrefFor } from '../lib/phoneContact'
import { formatErrorMessage } from '../utils/errorHandling'
import type { Database } from '../types/database'

function Tile({ cap, children, sub, tone }: { cap: string; children: React.ReactNode; sub?: React.ReactNode; tone?: 'amber' | 'green' }) {
  return (
    <div style={{ padding: '10px 14px', borderRight: '1px solid var(--border)', minWidth: 0 }}>
      <div style={capStyle}>{cap}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: tone === 'amber' ? 'var(--text-amber-800)' : tone === 'green' ? 'var(--text-green-700)' : 'var(--text-strong)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{children}</div>
      {sub ? <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div> : null}
    </div>
  )
}

export default function DevelopmentPage() {
  const { id: developmentId = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const phone = useMatchMedia(DEVELOPMENT_PHONE_QUERY)
  const prefixes = useLedgerPrefixMap()
  const bidPreview = useBidPreview()
  const jobDetail = useJobDetailModal()
  const jobForm = useJobFormModal()
  const { user: authUser } = useAuth()
  const { showToast, showActionToast } = useToastContext()

  const [data, setData] = useState<DevelopmentPageData | null>(null)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [loading, setLoading] = useState(true)
  // `?all=1` opens the page with the address matches drawn (a link the owner can share while the spike runs).
  const [includeAddress, setIncludeAddress] = useState(() => searchParams.get('all') === '1' || readIncludeAddress(developmentId))
  const [lastLooked, setLastLooked] = useState<string | null>(() => readLastLooked(developmentId))
  const [hideNotInIt, setHideNotInIt] = useState(false)
  const [pairMode, setPairMode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notThese, setNotThese] = useState<Set<string>>(() => readNotThese(developmentId))
  const [backfillJob, setBackfillJob] = useState<MemberJob | null>(null)
  const [chipConfirm, setChipConfirm] = useState<{ title: string; rows: ChipConfirmRow[]; preview: React.ReactNode; previewCaption: string; confirmLabel: string; onConfirm: () => void } | null>(null)
  const [nowMs] = useState(() => Date.now())

  const load = useCallback(async () => {
    if (!developmentId) return
    setLoading(true)
    setFailure(null)
    try {
      setData(await fetchDevelopmentPage(developmentId, includeAddress))
    } catch (e) {
      setFailure(recoveryFailureFromError(e, 'The development could not be read.'))
    } finally {
      setLoading(false)
    }
  }, [developmentId, includeAddress])

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
            names: data.names,
            bidLabel,
            jobLabel,
            stageLabel: labelJobsLedgerStatusForDashboard,
            money,
            siteName: data.development.name,
            nowMs,
          })
        : [],
    [shown, data, bidLabel, jobLabel, nowMs],
  )
  const since = useMemo(() => placeSinceLine(feed, lastLooked), [feed, lastLooked])
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
  const doPair = (bidId: string, jobId: string) =>
    void run(async () => {
      await pairJobToBid(jobId, bidId)
      showToast(`Paired ${labelOfBid(bidId)} with ${labelOfJob(jobId)}.`, 'success')
    })
  const doPairMany = (pairs: Array<{ bidId: string; jobId: string }>) =>
    void run(async () => {
      const r = await pairMany(pairs)
      const words = batchOutcomeWords({ verb: 'Pair', past: 'paired', done: r.done, failed: r.failed.length, noun: 'pair' })
      showToast(r.failed.length ? `${words.line} ${r.failed.map((f) => `${labelOfJob(f.jobId)}: ${f.reason}`).join(' ')}` : words.line, words.tone)
    })
  const doUnpair = (jobId: string, bidId: string) =>
    void run(async () => {
      await unpairJob(jobId)
      showActionToast(`Unpaired ${labelOfBid(bidId)} from ${labelOfJob(jobId)}. The job keeps its customer, address and development.`, {
        label: 'Put it back',
        onClick: () => void run(async () => {
          await pairJobToBid(jobId, bidId)
          showToast(`Put back: ${labelOfBid(bidId)} with ${labelOfJob(jobId)}.`, 'success')
        }),
      })
    })
  const doMarkWon = () =>
    void run(async () => {
      const ids = wonCandidates.map((b) => b.id)
      const r = await markBidsWon(ids)
      const words = batchOutcomeWords({ verb: 'Mark won', past: 'marked won', done: r.done, failed: r.failed.length, noun: 'bid' })
      showToast(r.failed.length ? `${words.line} ${r.failed.map((f) => `${labelOfBid(f.bidId)}: ${f.reason}`).join(' ')}` : words.line, words.tone)
    })
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
  const doPutBackOnBoard = (bid: MemberBid) => {
    if (!data) return
    const words = pieceWords('bid', bid.id)
    const name = data.development.name
    const value = bidMoney(bid)
    const inIt = bid.development_id === data.development.id
    const rows: ChipConfirmRow[] = [
      { label: 'Board', before: bid.working_board_archived_at ? `hidden since ${shortDay(bid.working_board_archived_at)}` : 'hidden', after: 'Unsent/Working · its column', changes: true },
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
                showToast(`${words} is off the board again.`, 'success')
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
    onPairAll: () => doPairMany(suggestions.map((s) => ({ bidId: s.bidId, jobId: s.jobId }))),
    onNotAll: () => rememberNotThese(suggestions.map((s) => `${s.bidId}:${s.jobId}`)),
    onMakeBid: (job) => setBackfillJob(job),
    onMakeJob: doMakeJob,
  }

  const openBid = useCallback((bidId: string) => bidPreview?.openBidPreview(bidId), [bidPreview])
  const openJob = useCallback((jobId: string) => jobDetail?.openJobDetail({ jobId }), [jobDetail])
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
  const askStub = (about: string) => showToast(`Asking ships in PR 4: the question about ${about} would go to the estimators or Dispatch and come back here with its answer.`, 'info', 6000)

  if (!developmentId) return <p style={{ color: 'var(--text-muted)' }}>No development was named.</p>
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
  const newestTail = plans.newest
    ? `${plans.newest.dated ? `${shortDay(plans.newest.dated)} set` : `set filed ${shortDay(plans.newest.filedAt)}`} is the newest · ${plans.olderOrNone.length} on an older one or none`
    : shown.bids.length + shown.jobs.length > 0
      ? 'No plan set is filed on this site'
      : null

  const btn = (label: string, onClick: () => void, title?: string, primary?: boolean) => (
    <SmallButton onClick={onClick} title={title} primary={primary}>
      {label}
    </SmallButton>
  )

  return (
    <div data-testid="development-page">
      <div style={{ marginBottom: '0.4rem', display: 'flex', gap: 12, fontSize: '0.8rem' }}>
        <LinkButton onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/jobs?tab=stages'))}>← Back</LinkButton>
        <Link to="/jobs?tab=stages" style={{ color: 'var(--text-link)', textDecoration: 'none' }}>
          Pipeline
        </Link>
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
          {btn('Ask a question', () => askStub(dev.name), 'Ask the estimators or Dispatch about the site or one of its pieces (PR 4)', true)}
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
          <span style={{ color: 'var(--text-faint)' }}>No customer named on its pieces</span>
        )}
        {address ? (
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)', textDecoration: 'none' }}>
            📍 {address} · Map
          </a>
        ) : (
          <span style={{ color: 'var(--text-faint)' }}>No address yet: the first bid or job in it brings one</span>
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
            <span style={{ color: 'var(--text-faint)' }}>none on the bids</span>
          )}
        </span>
        <span>
          <span style={capStyle}>Estimating</span> {people.estimating.length ? <strong style={{ color: 'var(--text-strong)' }}>{people.estimating.join(', ')}</strong> : <span style={{ color: 'var(--text-faint)' }}>no estimator on the bids</span>}
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

      {/* The counts, the waiting one first. */}
      <div style={{ display: 'grid', gridTemplateColumns: phone ? 'repeat(2, minmax(0, 1fr))' : 'repeat(5, minmax(0, 1fr))', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', margin: '12px 0', overflow: 'hidden' }} data-testid="development-counts">
        <Tile cap="Waiting" tone={counts.waiting.count ? 'amber' : undefined} sub={counts.waiting.count ? `oldest ${counts.waiting.oldestAgeDays ?? 0} ${counts.waiting.oldestAgeDays === 1 ? 'day' : 'days'}` : 'on the estimators or Dispatch'}>
          {counts.waiting.count ? `${counts.waiting.count} ${pluralNoun('question', counts.waiting.count)}` : 'Nothing'}
        </Tile>
        <Tile cap="Bids" sub={`${counts.bids.sent} sent · ${counts.bids.undecided} not yet decided${counts.bids.offBoard ? ` · ${counts.bids.offBoard} off the board` : ''}`}>
          {counts.bids.total}
        </Tile>
        <Tile cap="Jobs" sub={`${counts.jobs.open} open · ${counts.jobs.working} working`}>
          {counts.jobs.total}
        </Tile>
        <Tile cap="Bid, not yet decided" sub={counts.bids.undecided ? `${counts.bids.undecided} ${pluralNoun('bid', counts.bids.undecided)}` : 'every bid is decided'}>
          {money(counts.bidUndecidedUsd)}
        </Tile>
        <Tile cap="Open on bills" tone={counts.openOnBillsUsd ? 'green' : undefined} sub={counts.openOnBillsUsd ? 'billed, not yet paid' : 'nothing billed is unpaid'}>
          {money(counts.openOnBillsUsd)}
        </Tile>
      </div>

      <DevelopmentJumpStrip counts={{ changed: since.newCount, pieces: pieces.filter((r) => !r.done).length, plans: plans.sets.length, questions: data.requests.length }} tail={newestTail} />

      {/* Not in it yet: the records at the address, with the spike's toggle that shows them on the page. */}
      {atAddressTotal > 0 && !hideNotInIt ? (
        <div
          data-testid="not-in-it-line"
          style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '8px 12px', marginBottom: 12, borderRadius: 8, background: 'var(--bg-amber-tint)', border: '1px solid var(--bg-amber-200)', fontSize: '0.85rem' }}
        >
          <strong style={{ color: 'var(--text-amber-800)' }}>{atAddressTotal} not in it</strong>
          <span style={{ color: 'var(--text-strong)' }}>
            {[atAddress.jobs.length ? `${atAddress.jobs.length} ${pluralNoun('job', atAddress.jobs.length)}` : '', atAddress.bids.length ? `${atAddress.bids.length} ${pluralNoun('bid', atAddress.bids.length)}` : ''].filter(Boolean).join(' and ')} share {address ?? 'this address'} and {atAddressTotal === 1 ? 'is' : 'are'} not in {dev.name}.
          </span>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
            <SmallButton onClick={toggleInclude} title="Spike only: draws them on this page as if they were in it, on this device, writing nothing">
              {includeAddress ? `Hide the ${atAddressTotal}` : `Show the ${atAddressTotal} here`}
            </SmallButton>
            <SmallButton onClick={() => showToast(`PR 3 puts the ${atAddressTotal} in ${dev.name} in one press. Until then Edit Bid and Edit Job offer it one at a time.`, 'info', 6000)} title="PR 3: one transaction, the count returned" primary>
              Put the {atAddressTotal} in {dev.name}
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
          title="What changed"
          meta={lastLooked ? `${since.newCount} since you looked · ${shortDay(lastLooked)}` : `${feed.length} ${pluralNoun('line', feed.length)} · first look`}
          right={<LinkButton onClick={markLooked}>Mark as looked</LinkButton>}
        >
          <DevelopmentFeed lines={feed} sinceIndex={since.index} lastLooked={lastLooked} openAbout={openAbout} />
        </Card>

        <Card
          id={DEVELOPMENT_JUMP_ANCHOR.pieces}
          title="Pieces"
          meta={`each bid with the job it became${plans.newest ? ` · newest set ${plans.newest.dated ? shortDay(plans.newest.dated) : shortDay(plans.newest.filedAt)}` : ''}`}
          right={
            <>
              {wonCandidates.length > 0 && !pairMode ? (
                <SmallButton onClick={doMarkWon} disabled={busy} title="Sets Won on the paired bids that have no outcome yet; the Bid Board moves them, so this press is yours">
                  {`${countedLabel('Mark the', wonCandidates.length, 'paired bid')} won`}
                </SmallButton>
              ) : null}
              {shown.bids.length + shown.jobs.length > 0 ? (
                <SmallButton onClick={() => setPairMode((v) => !v)} disabled={busy} primary={!pairMode} title="Pair each bid with the job it became in the row; one write per pair, nothing else moves">
                  {pairMode ? 'Done pairing' : 'Pair bids with jobs'}
                </SmallButton>
              ) : null}
              <Link to="/bids" style={{ color: 'var(--text-link)', textDecoration: 'none' }} title="The Bid Board, its house filter set to this development (the filter param is PR 2's)">
                Bid Board
              </Link>
              <Link to="/jobs?tab=stages" style={{ color: 'var(--text-link)', textDecoration: 'none' }} title="The Pipeline, its house filter set to this development (the filter param is PR 2's)">
                Pipeline
              </Link>
            </>
          }
        >
          {shown.bids.length + shown.jobs.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Nothing is in {dev.name} yet. Edit Bid and Edit Job have a Development picker, and a saved record at a shared address offers <strong>Put it in {dev.name}</strong>.
            </p>
          ) : (
            <DevelopmentPieces rows={pieces} bidLabel={bidLabel} jobLabel={jobLabel} names={data.names} teamMembers={data.teamMembers} openBid={openBid} openJob={openJob} notInIt={includeAddress ? notInIt : new Set()} pairing={pairing} onPutIn={doPutIn} onPutBackOnBoard={doPutBackOnBoard} busy={busy} />
          )}
        </Card>

        <Card id={DEVELOPMENT_JUMP_ANCHOR.plans} title="Plans" meta="every set on the site, newest first">
          <DevelopmentPlansCard view={plans} openCarrier={openCarrier} askAbout={(n) => askStub(`the ${n} on an older set or none`)} />
        </Card>

        <Card id={DEVELOPMENT_JUMP_ANCHOR.questions} title="Questions" meta={data.requests.length ? `${data.requests.length} on this site · ${openQuestions} waiting · open first` : 'asked here, answered in the inbox, kept here'}>
          <DevelopmentQuestionsCard requests={data.requests} names={data.names} aboutLabel={requestAbout} openAbout={(r) => (r.bid_id ? openBid(r.bid_id) : r.job_ledger_id ? openJob(r.job_ledger_id) : undefined)} />
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
