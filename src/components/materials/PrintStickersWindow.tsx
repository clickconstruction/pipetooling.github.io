/**
 * Print future stickers from the Materials strip (punch list #329, PR 2, v2.7272): a run belongs to the job its new
 * boxes go on, so the press asks *Which job?* as Print labels does, over the jobs the on-site desk holds, then opens
 * that job's stickers window (`PrintStickersModal`). One job skips the question. A job with no box yet is listed too:
 * stickers come before boxes, and the first run is often for a site the app has not seen.
 *
 * Since v2.7492 (the owner's call 5 of 2026-11-16, after Print labels' window in v2.7482) the question says what a
 * run would add to. A band on top shows the tape, the P-touch's own line where the browser already has leave to use
 * it, and one sticker at its printed size with the name a new run opens on. Each job is a card: its site and street,
 * the boxes it holds, the runs printed for it so far, the stickers reserved and not on a box yet with who reserved
 * them, and the name a new run opens on. A job whose boxes did not load says so, and the foot points at Print labels
 * and Scan a label. The words are `lib/materials/reserveStickersJobs.ts`, the reads `reserveStickersIo.ts`, the
 * shared pieces `WhichJobParts.tsx`.
 *
 * Since v2.7523 (the owner, 2026-11-16: *I can see stickers that were reserved, but I don't see any tools to print
 * them*) the reserved line carries the press that prints them, one for each run that holds some
 * (`ReservedPrintPresses.tsx`): it opens the stickers window on that run, which mints nothing. The line before
 * **Print future stickers** then says that press reserves new ones.
 */
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { EmptyState } from '../EmptyState'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import { helpGuideHref } from '../../lib/helpGuideAnchors'
import { recoveryFailureFromError } from '../../lib/offlineRecoveryState'
import { readTapeWidth } from '../../lib/materials/labelPrefs'
import type { OnSiteFindJob } from '../../lib/materials/onSiteFind'
import { deskRowNotLoadedWords } from '../../lib/materials/onSiteReadFailed'
import { LABEL_JOBS_SEARCH_PAST } from '../../lib/materials/printLabelsJobs'
import { ptouchReadyLine, ptouchTapeFits } from '../../lib/materials/ptouchRaster'
import { connectPtouch, ptouchUsbAvailable, type PtouchLink } from '../../lib/materials/ptouchUsb'
import { fetchSitesOfJobs, fetchStickerRunsOfJobs } from '../../lib/materials/reserveStickersIo'
import { RESERVE_ALREADY_IN, RESERVE_OPEN_JOB_LABEL, RESERVE_WHICH_JOB, boxCountAside, findStickerJobs, nextNameWords, runsSoFarWords, stickerJobsInOrder, type StickerJobsInput } from '../../lib/materials/reserveStickersJobs'
import { STICKER_PREVIEW_CODE_WORDS, previewStrip } from '../../lib/materials/stickerPreview'
import { PRINT_STICKERS_LABEL, STICKERS_GUIDE, STICKERS_GUIDE_HEADING, STICKERS_GUIDE_QUESTION, stickerReserveWords } from '../../lib/materials/stickerRun'
import { isTapeWidth, type TapeWidthMm } from '../../lib/materials/tapeLabel'
import { calendarYmdInAppTzFromIso, formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'
import PrintStickersModal, { type StickerRunToPrint } from './PrintStickersModal'
import ReservedPrintPresses from './ReservedPrintPresses'
import { PRINT_LABELS_WINDOW_WIDTH } from './PrintLabelsWindow'
import { NoUsbNote, TapeStripSample, WJ_ONE_COLUMN, WhichJobHead, useQuietPtouch, wjAmberBox, wjBtn, wjBtnPrimary, wjCard, wjCardFirst, wjMuted, wjQuietLink } from './WhichJobParts'

type Props = {
  jobs: ReadonlyArray<OnSiteFindJob>
  role: string | null | undefined
  loading: boolean
  failure: { error: string | null; raw: unknown; retry: () => void }
  /** Where the first job's boxes are added, offered when the desk holds no job. */
  onAddFirst?: () => void
  onClose: () => void
  /** The foot's presses, each drawn only when handed in: the labels of boxes already made, and the scan. */
  onLabels?: () => void
  onScan?: () => void
  /** Opens a job's own page, where reserved stickers are put on their boxes. */
  onOpenJob?: (jobId: string) => void
  /** Reads one job's boxes again, for a card that says it did not load. */
  onReadAgain?: (jobId: string) => void
  /** The cards' reads and the printer; a test hands spies. */
  reads?: {
    runs?: (jobIds: ReadonlyArray<string>) => Promise<StickerJobsInput['runsOf']>
    sites?: (jobIds: ReadonlyArray<string>) => Promise<StickerJobsInput['sitesOf']>
    connect?: (options: { ask: boolean }) => Promise<PtouchLink | null>
    usbHere?: boolean
  }
}

const dayWords = (iso: string) => formatWorkDateYmdMonthDayShort(calendarYmdInAppTzFromIso(iso))

export default function PrintStickersWindow({ jobs, role, loading, failure, onAddFirst, onClose, onLabels, onScan, onOpenJob, onReadAgain, reads }: Props) {
  const [picked, setPicked] = useState<string | null>(null)
  /** The run a reserved line's press picked with its job (v2.7523): the stickers window opens on it and mints nothing. */
  const [pickedRun, setPickedRun] = useState<StickerRunToPrint | null>(null)
  const [prefWidth] = useState<TapeWidthMm>(() => readTapeWidth())
  const [query, setQuery] = useState('')
  const usbHere = useMemo(() => reads?.usbHere ?? ptouchUsbAvailable(), [reads?.usbHere])
  const only = jobs.length === 1 ? jobs[0]! : null
  const job = jobs.find((j) => j.jobId === picked) ?? (picked == null ? only : null)
  /** The question is on the screen: the reads and the printer's line are for it alone. */
  const asking = job == null && jobs.length > 0

  // Each job's runs (two reads for the whole list) and its site with the site's names: a card reads the same without either.
  const jobIdsKey = jobs.map((j) => j.jobId).sort().join('|')
  const [runsOf, setRunsOf] = useState<StickerJobsInput['runsOf']>(null)
  const [sitesOf, setSitesOf] = useState<StickerJobsInput['sitesOf']>(null)
  const readRuns = reads?.runs ?? fetchStickerRunsOfJobs
  const readSites = reads?.sites ?? fetchSitesOfJobs
  useEffect(() => {
    if (!asking || !jobIdsKey) return
    let live = true
    readRuns(jobIdsKey.split('|')).then((got) => { if (live) setRunsOf(got) }).catch(() => { /* the cards leave the runs out */ })
    return () => { live = false }
  }, [asking, jobIdsKey, readRuns])
  useEffect(() => {
    if (!asking || !jobIdsKey) return
    let live = true
    readSites(jobIdsKey.split('|')).then((got) => { if (live) setSitesOf(got) }).catch(() => { /* the cards leave the site and the next name out */ })
    return () => { live = false }
  }, [asking, jobIdsKey, readSites])

  // The printer's own line, where the browser already has leave to use it: a wrong tape is seen before a job is picked.
  const { link, held, letGo } = useQuietPtouch(asking && usbHere, reads?.connect ?? connectPtouch)
  const open = (id: string, run: StickerRunToPrint | null = null) => {
    // The stickers window opens its own link to the printer, so this one is let go first.
    const pick = () => { setPickedRun(run); setPicked(id) }
    if (!held()) { pick(); return }
    void letGo().then(pick)
  }
  const width: TapeWidthMm = link && isTapeWidth(link.status.tapeMm) ? link.status.tapeMm : prefWidth

  const facts = useMemo(() => stickerJobsInOrder(jobs, { runsOf, sitesOf, dayWords }), [jobs, runsOf, sitesOf])
  const shown = findStickerJobs(facts, query)

  if (job) {
    return <PrintStickersModal jobId={job.jobId} jobLabel={job.label} role={role} run={pickedRun} onClose={onClose} />
  }

  /** The band's sticker: the name the first job's next run opens on, or a sticker with no name until that is read. */
  const sampleName = facts[0]?.nextName ?? null
  const sample = previewStrip(0, sampleName)
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={PRINT_STICKERS_LABEL} style={{ background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 12, width: `min(${PRINT_LABELS_WINDOW_WIDTH}px, 100%)`, maxHeight: 'min(90vh, 100%)', overflowX: 'hidden', overflowY: 'auto', padding: '1rem 1.25rem 1.25rem', display: 'grid', gridTemplateColumns: WJ_ONE_COLUMN, gap: '0.75rem', boxShadow: '0 12px 32px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
          <div style={{ flex: '1 1 auto', minWidth: 0, display: 'grid', gap: 2 }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{PRINT_STICKERS_LABEL}</h2>
            {facts.length > 0 ? <span style={{ ...wjMuted, fontSize: '0.85rem' }} data-testid="print-stickers-what">{stickerReserveWords(true)}</span> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)', minHeight: 36, minWidth: 36, flex: '0 0 auto' }}>×</button>
        </div>
        <OfflineRetryPanel failure={failure.error ? recoveryFailureFromError(failure.raw, 'The jobs did not load.') : null} onRetry={failure.retry} surface="materials-print-stickers" idempotent />
        {loading && jobs.length === 0 ? <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading the jobs…</p> : null}
        {!loading && !failure.error && jobs.length === 0 ? (
          <EmptyState compact main="No job has anything on site yet." next={onAddFirst ? { label: 'On site', onPress: onAddFirst } : undefined} tail={onAddFirst ? `opens a job’s page, where ${PRINT_STICKERS_LABEL} prints its first run.` : 'A job’s own Materials page prints its first run.'} />
        ) : null}
        {facts.length > 0 ? (
          <>
            {usbHere ? (
              <div style={{ borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', borderRadius: 10, background: 'var(--bg-subtle)', padding: '0.6rem 0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.6rem 0.9rem', alignItems: 'center' }} data-testid="print-stickers-band" data-band="tape">
                <div style={{ flex: '1 1 240px', minWidth: 0, display: 'grid', gap: 3, fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontWeight: 700 }}>
                    <span aria-hidden style={{ width: 9, height: 9, borderRadius: '50%', background: link ? (ptouchTapeFits(link.status) ? '#059669' : '#d97706') : 'var(--border-strong)', flex: '0 0 auto' }} />
                    <span data-testid="print-stickers-prints-on">Brother tape · {width} mm</span>
                  </div>
                  <span data-testid="print-stickers-printer-line">{link ? ptouchReadyLine(link.model, link.status) : 'The app prints straight to the P-touch over USB.'}</span>
                  <span style={wjMuted}>{STICKER_PREVIEW_CODE_WORDS}</span>
                </div>
                <div style={{ flex: '0 1 auto', minWidth: 0, maxWidth: '100%' }}>
                  <TapeStripSample stencil={sample.stencil} small={sample.small} address={sample.address} value={sample.value} width={width} caption={(mm) => `One sticker, about ${mm} mm`} testid="print-stickers-sample" />
                </div>
              </div>
            ) : (
              <NoUsbNote tid="print-stickers" />
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem', flex: '1 1 auto' }}>{RESERVE_WHICH_JOB}</p>
              {facts.length > LABEL_JOBS_SEARCH_PAST ? <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a job" aria-label="Find a job" style={{ minHeight: 36, flex: '0 1 220px', minWidth: 0, borderRadius: 8, border: '1px solid var(--border-strong)', padding: '0 0.6rem', font: 'inherit', fontSize: '0.875rem', background: 'var(--surface)', color: 'var(--text-strong)' }} data-testid="print-stickers-find" /> : null}
            </div>
            {shown.length === 0 ? <EmptyState compact {...emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'jobs', query }), { onPress: () => setQuery('') })} /> : null}
            <div style={{ display: 'grid', gridTemplateColumns: WJ_ONE_COLUMN, gap: '0.6rem' }}>
              {shown.map((f) => {
                const next = nextNameWords(f.nextName, f.toPrint.length > 0)
                const toJob = f.reserved.count > 0 && onOpenJob ? onOpenJob : null
                return (
                  <div key={f.jobId} style={{ ...wjCard, ...(f.reserved.count > 0 ? wjCardFirst : {}) }} data-testid="print-stickers-card">
                    <WhichJobHead tid="print-stickers" number={f.number} name={f.name} where={f.where} count={f.boxes > 0 ? { n: f.boxes, word: f.boxes === 1 ? 'box' : 'boxes' } : undefined} aside={f.failed ? '' : boxCountAside(f.boxes)} ariaLabel={`${PRINT_STICKERS_LABEL} for ${f.label}`} onOpen={() => open(f.jobId)} />
                    {f.failed && f.boxes === 0 ? (
                      /* A read that failed is not a job with no box: it is said, with the way to read it again. */
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }} data-testid="print-stickers-not-loaded">
                        <span role="note" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem', fontWeight: 600 }}>{deskRowNotLoadedWords(f.failed)}</span>
                        {onReadAgain ? <button type="button" style={{ ...wjBtn, minHeight: 32 }} onClick={() => onReadAgain(f.jobId)} aria-label={`Read ${f.label} again`}>Read again</button> : null}
                      </div>
                    ) : null}
                    {f.boxes > 0 ? (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-700)', overflowWrap: 'anywhere' }} data-testid="print-stickers-job-facts">
                        {f.kinds}
                        {f.names ? <> · {'listed' in f.names ? f.names.listed.map((n, i) => <span key={n}>{i > 0 ? ' · ' : ''}<strong>{n}</strong></span>) : <><strong>{f.names.first}</strong> to <strong>{f.names.last}</strong></>}</> : null}
                      </div>
                    ) : null}
                    {f.soFar ? <div style={{ fontSize: '0.8rem', color: 'var(--text-700)' }} data-testid="print-stickers-job-runs">{runsSoFarWords(f.soFar)}</div> : null}
                    {f.reservedWords ? (
                      <div style={{ ...wjAmberBox, borderRadius: 8, padding: '0.35rem 0.6rem', fontSize: '0.82rem', fontWeight: 600, display: 'grid', gridTemplateColumns: WJ_ONE_COLUMN, gap: '0.4rem' }}>
                        <div role="note" data-testid="print-stickers-job-reserved">{f.reservedWords}</div>
                        {/* The press that prints them, right where they are named (v2.7523): the same stickers and links, nothing minted. */}
                        <ReservedPrintPresses runs={f.toPrint} role={role} onPrint={(run) => open(f.jobId, run)} tid="print-stickers-reserved" pressStyle={{ ...wjBtn, whiteSpace: 'normal', padding: '0.3rem 0.75rem' }} noteStyle={{ color: 'var(--text-amber-800)' }} />
                      </div>
                    ) : null}
                    {next ? <div style={wjMuted} data-testid="print-stickers-job-next">{next}</div> : null}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      <button type="button" style={toJob ? wjBtnPrimary : wjBtn} onClick={() => open(f.jobId)} data-testid="print-stickers-door-reserve">{PRINT_STICKERS_LABEL}<span aria-hidden>›</span></button>
                      {toJob ? <button type="button" style={wjBtn} onClick={() => toJob(f.jobId)} data-testid="print-stickers-door-job">{RESERVE_OPEN_JOB_LABEL}<span aria-hidden>›</span></button> : null}
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.6rem', display: 'flex', flexWrap: 'wrap', gap: '0.25rem 1rem', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }} data-testid="print-stickers-foot">
              {onLabels ? <><span>{RESERVE_ALREADY_IN}</span><button type="button" style={wjQuietLink} onClick={onLabels} data-testid="print-stickers-labels">Print labels</button></> : null}
              {onScan ? <button type="button" style={wjQuietLink} onClick={onScan} data-testid="print-stickers-scan">Scan a label</button> : null}
              <a href={helpGuideHref(STICKERS_GUIDE, STICKERS_GUIDE_HEADING)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)', fontWeight: 600, marginLeft: 'auto' }}>{STICKERS_GUIDE_QUESTION}</a>
            </div>
          </>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
