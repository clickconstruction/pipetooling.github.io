/**
 * Print labels from anywhere (punch list #304): labels belong to a job, so the press asks *Which
 * job?* with the jobs that hold a box, then opens that job's labels window (`LabelsPrintModal`) on
 * the rows the on-site store already holds. One job with boxes skips the question. Whoever may open
 * a job's boxes may print its labels: a label shows a stencil and a code, no money.
 *
 * Since v2.7482 (the owner's ask of 2026-11-16: the window was a list of names with a count) the question says what
 * is about to print. A band on top shows what this computer prints on, the P-touch's own line where the browser
 * already has leave to use it, and one real label at its printed size. Each job is a card: its site and street, its
 * boxes and cages counted apart, the names from first to last, each place with its count, what changed, a run this
 * computer stopped today, the tape or the pages it takes, and doors that open the labels window on the rest of that
 * run, on the new boxes or on every box. Nothing prints from this window. A job whose boxes did not load says so,
 * and the foot points at Print blank stickers and Scan a label. The words and the order are
 * `lib/materials/printLabelsJobs.ts`; the two small reads `printLabelsIo.ts`.
 */
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { QRCodeSVG } from 'qrcode.react'
import { EmptyState } from '../EmptyState'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import { helpGuideHref } from '../../lib/helpGuideAnchors'
import { recoveryFailureFromError } from '../../lib/offlineRecoveryState'
import { readLabelFormat, readStoppedRun, readTapeCopies, readTapePrintedDay, readTapeWidth, writeLabelFormat } from '../../lib/materials/labelPrefs'
import { boxAddressWords, boxUrl } from '../../lib/materials/labels'
import { labelBoxes, type OnSiteFindJob } from '../../lib/materials/onSiteFind'
import { deskRowNotLoadedWords } from '../../lib/materials/onSiteReadFailed'
import { fetchJobSiteNames, fetchStickeredBoxIds } from '../../lib/materials/printLabelsIo'
import { LABEL_JOBS_SEARCH_PAST, PRINT_LABELS_NOT_YET, PRINT_LABELS_WHAT, findLabelJobs, labelJobChips, labelJobsCountWords, labelJobsInOrder, resumeWords, type LabelJobDoor, type LabelJobFacts } from '../../lib/materials/printLabelsJobs'
import { ptouchReadyLine, ptouchTapeFits } from '../../lib/materials/ptouchRaster'
import { connectPtouch, ptouchUsbAvailable, type PtouchLink } from '../../lib/materials/ptouchUsb'
import { PRINT_STICKERS_LABEL } from '../../lib/materials/stickerRun'
import { LABEL_OUTPUTS, isTapeWidth, type LabelFormat, type TapeWidthMm } from '../../lib/materials/tapeLabel'
import { formatWorkDateYmdMonthDayShort, todayYmdInAppTz } from '../../utils/dateUtils'
import LabelsPrintModal, { type LabelsStart } from './LabelsPrintModal'
import { NoUsbNote, TapeStripSample, WJ_CHIP_TONES as CHIP_TONES, WJ_ONE_COLUMN as ONE_COLUMN, WhichJobHead, useQuietPtouch, wjAmberBox as amberBox, wjBtn as btn, wjBtnPrimary as btnPrimary, wjCard as card, wjCardFirst, wjChip, wjMuted as muted, wjQuietLink as quietLink } from './WhichJobParts'

type Props = {
  jobs: ReadonlyArray<OnSiteFindJob>
  loading: boolean
  failure: { error: string | null; raw: unknown; retry: () => void }
  /** Open straight on this job (a row's Labels press). */
  jobId?: string | null
  /** Where the first box is added, offered when no job has one. */
  onAddFirst?: () => void
  onClose: () => void
  /** The foot's presses, each drawn only when handed in: stickers for the roles that may print a run, and the scan. */
  onStickers?: () => void
  onScan?: () => void
  /** Reads one job's boxes again, for a card that says it did not load. */
  onReadAgain?: (jobId: string) => void
  /** The cards' small reads, the printer and the clock; a test hands spies. */
  reads?: {
    sites?: (jobIds: ReadonlyArray<string>) => Promise<Map<string, string>>
    stickered?: (containerIds: ReadonlyArray<string>) => Promise<Set<string>>
    connect?: (options: { ask: boolean }) => Promise<PtouchLink | null>
    usbHere?: boolean
    now?: () => number
  }
}

/**
 * The window's width on a desk (v2.7194): wide enough for a job's number and a long name beside its label count. It
 * was 460, and its two grids had no column rule, so a name that did not fit widened the column past the window and
 * the window scrolled sideways, with the label counts and the close press off its right edge.
 */
export const PRINT_LABELS_WINDOW_WIDTH = 640

/** The guide the foot opens, and its heading. */
const LABELS_GUIDE = 'see-what-is-on-every-job-site-and-what-walked-away'
const LABELS_GUIDE_HEADING = 'Print a label'

/** One label as it prints, for the band: a strip of tape at its printed size, or a small Letter page. Always light, as paper is. */
function LabelSample({ format, width, box }: { format: LabelFormat; width: TapeWidthMm; box: { id: string; name: string } }) {
  if (format === 'sheet') {
    return (
      <div style={{ display: 'grid', gap: 3, justifyItems: 'center' }} data-testid="print-labels-sample-sheet">
        <div data-theme="light" aria-hidden style={{ width: 74, height: 96, boxSizing: 'border-box', background: 'var(--surface)', color: '#000', border: '1px solid var(--border-strong)', borderRadius: 2, padding: 6, display: 'grid', gap: 3, alignContent: 'start', boxShadow: '0 1px 3px rgba(0,0,0,0.18)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 900, lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{box.name}</span>
            <QRCodeSVG value={boxUrl(box.id)} size={22} level="M" bgColor="#ffffff" fgColor="#000000" marginSize={0} style={{ flex: '0 0 auto' }} />
          </div>
          {Array.from({ length: 7 }, (_, i) => <span key={i} style={{ display: 'block', height: 1, background: 'var(--border-strong)', marginTop: 6 }} />)}
        </div>
        <span style={muted}>One page a box</span>
      </div>
    )
  }
  return <TapeStripSample stencil={box.name} address={boxAddressWords(box.id).toUpperCase()} value={boxUrl(box.id)} width={width} testid="print-labels-sample-tape" />
}

export default function PrintLabelsWindow({ jobs, loading, failure, jobId = null, onAddFirst, onClose, onStickers, onScan, onReadAgain, reads }: Props) {
  const [picked, setPicked] = useState<{ jobId: string; start?: LabelsStart } | null>(jobId ? { jobId } : null)
  const [format, setFormatState] = useState<LabelFormat>(() => readLabelFormat())
  const setFormat = (f: LabelFormat) => { setFormatState(f); writeLabelFormat(f) }
  const [prefWidth] = useState<TapeWidthMm>(() => readTapeWidth())
  const [copies] = useState<number>(() => readTapeCopies())
  const [tapeDay] = useState<string | null>(() => readTapePrintedDay())
  /** A run this computer stopped part way, as it was when the window opened. */
  const [kept] = useState(() => readStoppedRun())
  const [nowMs] = useState(() => (reads?.now ?? Date.now)())
  const [query, setQuery] = useState('')
  const usbHere = useMemo(() => reads?.usbHere ?? ptouchUsbAvailable(), [reads?.usbHere])
  const tape = format === 'tape'

  const withBoxes = useMemo(() => jobs.filter((j) => labelBoxes(j).length > 0), [jobs])
  /** A job whose read failed has no boxes here: it is said, never left out. */
  const notLoaded = useMemo(() => jobs.filter((j) => j.failed && labelBoxes(j).length === 0).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })), [jobs])
  const only = withBoxes.length === 1 && notLoaded.length === 0 ? withBoxes[0]! : null
  const job = withBoxes.find((j) => j.jobId === picked?.jobId) ?? (picked == null ? only : null)
  /** The question is on the screen: the reads and the printer's line are for it alone. */
  const asking = job == null && withBoxes.length > 0

  // Each job's site (two small reads) and the boxes that already wear a sticker (one): a card reads the same without either.
  const jobIdsKey = withBoxes.map((j) => j.jobId).sort().join('|')
  const boxIdsKey = useMemo(() => withBoxes.flatMap((j) => labelBoxes(j).map((c) => c.id)).sort().join('|'), [withBoxes])
  const [sites, setSites] = useState<Map<string, string> | null>(null)
  const [stickeredIds, setStickeredIds] = useState<Set<string> | null>(null)
  const readSites = reads?.sites ?? fetchJobSiteNames
  const readStickered = reads?.stickered ?? fetchStickeredBoxIds
  useEffect(() => {
    if (!asking || !jobIdsKey) return
    let live = true
    readSites(jobIdsKey.split('|')).then((got) => { if (live) setSites(got) }).catch(() => { /* the card leaves the site out */ })
    return () => { live = false }
  }, [asking, jobIdsKey, readSites])
  useEffect(() => {
    if (!asking || !boxIdsKey) return
    let live = true
    readStickered(boxIdsKey.split('|')).then((got) => { if (live) setStickeredIds(got) }).catch(() => { /* the chip is left out */ })
    return () => { live = false }
  }, [asking, boxIdsKey, readStickered])

  // The printer's own line, where the browser already has leave to use it: a wrong tape is seen before a job is picked.
  const wantsLink = asking && tape && usbHere
  const { link, held, letGo: letGoOfPrinter } = useQuietPtouch(wantsLink, reads?.connect ?? connectPtouch)
  const open = (id: string, start?: LabelsStart) => {
    // With no printer held the window opens at once; with one, as soon as it is let go.
    if (!held()) { setPicked({ jobId: id, start }); return }
    void letGoOfPrinter().then(() => setPicked({ jobId: id, start }))
  }
  const changeFormat = () => { const next: LabelFormat = tape ? 'sheet' : 'tape'; if (next === 'sheet') void letGoOfPrinter(); setFormat(next) }
  const width: TapeWidthMm = link && isTapeWidth(link.status.tapeMm) ? link.status.tapeMm : prefWidth

  const facts = useMemo(
    () => labelJobsInOrder(withBoxes, { nowMs, today: todayYmdInAppTz(), kept, format, widthMm: width, copies, stickeredIds, siteOf: (id) => sites?.get(id) }),
    [withBoxes, nowMs, kept, format, width, copies, stickeredIds, sites],
  )
  const shown = findLabelJobs(facts, query)

  if (job) {
    return <LabelsPrintModal jobLabel={job.label} containers={labelBoxes(job)} lines={[...job.lines]} places={job.places} only={null} start={picked?.jobId === job.jobId ? picked.start : undefined} onClose={onClose} />
  }

  const sample = facts[0]?.sample ?? null
  const changeLabel = tape ? 'Change to paper' : 'Change to Brother tape'
  const door = (f: LabelJobFacts, d: LabelJobDoor, first: boolean) => (
    <button key={d.kind} type="button" style={first ? btnPrimary : btn} onClick={() => open(f.jobId, d.kind === 'rest' ? undefined : d.kind === 'all' ? { kind: 'all' } : { kind: 'ids', ids: d.ids })} data-testid={`print-labels-door-${d.kind}`}>
      {d.label}<span aria-hidden>›</span>
    </button>
  )
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Print labels" style={{ background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 12, width: `min(${PRINT_LABELS_WINDOW_WIDTH}px, 100%)`, maxHeight: 'min(90vh, 100%)', overflowX: 'hidden', overflowY: 'auto', padding: '1rem 1.25rem 1.25rem', display: 'grid', gridTemplateColumns: ONE_COLUMN, gap: '0.75rem', boxShadow: '0 12px 32px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
          <div style={{ flex: '1 1 auto', minWidth: 0, display: 'grid', gap: 2 }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Print labels</h2>
            {facts.length > 0 ? <span style={{ ...muted, fontSize: '0.85rem' }} data-testid="print-labels-what">{PRINT_LABELS_WHAT}</span> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)', minHeight: 36, minWidth: 36, flex: '0 0 auto' }}>×</button>
        </div>
        <OfflineRetryPanel failure={failure.error ? recoveryFailureFromError(failure.raw, 'The boxes did not load.') : null} onRetry={failure.retry} surface="materials-print-labels" idempotent />
        {loading && withBoxes.length === 0 ? <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading the boxes…</p> : null}
        {!loading && !failure.error && withBoxes.length === 0 && notLoaded.length === 0 ? (
          <EmptyState compact main="No job has a cage or a box yet." next={onAddFirst ? { label: 'On site', onPress: onAddFirst } : undefined} tail={onAddFirst ? 'adds the first, and its label prints from here.' : 'The first one added on site prints from here.'} />
        ) : null}
        {facts.length > 0 && sample ? (
          tape && !usbHere ? (
            /* A browser with no USB reach is told here, before a job is picked, with both ways out. */
            <NoUsbNote tid="print-labels"><button type="button" style={btn} onClick={changeFormat} data-testid="print-labels-change">{changeLabel}</button></NoUsbNote>
          ) : (
            <div style={{ borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', borderRadius: 10, background: 'var(--bg-subtle)', padding: '0.6rem 0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.6rem 0.9rem', alignItems: 'center' }} data-testid="print-labels-band" data-band={format}>
              <div style={{ flex: '1 1 240px', minWidth: 0, display: 'grid', gap: 3, fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontWeight: 700 }}>
                  {tape ? <span aria-hidden style={{ width: 9, height: 9, borderRadius: '50%', background: link ? (ptouchTapeFits(link.status) ? '#059669' : '#d97706') : 'var(--border-strong)', flex: '0 0 auto' }} /> : null}
                  <span data-testid="print-labels-prints-on">{tape ? `Brother tape · ${width} mm` : LABEL_OUTPUTS.sheet.name}</span>
                  <button type="button" style={quietLink} onClick={changeFormat} data-testid="print-labels-change">{changeLabel}</button>
                </div>
                {tape ? (
                  <>
                    <span data-testid="print-labels-printer-line">{link ? ptouchReadyLine(link.model, link.status) : 'The app prints straight to the P-touch over USB.'}</span>
                    <span style={muted}>{tapeDay ? `This computer printed tape last on ${formatWorkDateYmdMonthDayShort(tapeDay)}.` : 'This computer has not printed tape yet. The next window has the steps.'} A label is the code, the box’s name and the link.</span>
                  </>
                ) : (
                  <span style={muted}>{LABEL_OUTPUTS.sheet.words}</span>
                )}
              </div>
              <div style={{ flex: '0 1 auto', minWidth: 0, maxWidth: '100%' }}><LabelSample format={format} width={width} box={sample} /></div>
            </div>
          )
        ) : null}
        {facts.length > 0 || notLoaded.length > 0 ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem', flex: '1 1 auto' }}>Which job?{facts.length > 0 ? <> <span data-testid="print-labels-jobs-count">{labelJobsCountWords(facts.length)}</span></> : null}</p>
              {facts.length > LABEL_JOBS_SEARCH_PAST ? <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a job" aria-label="Find a job" style={{ minHeight: 36, flex: '0 1 220px', minWidth: 0, borderRadius: 8, border: '1px solid var(--border-strong)', padding: '0 0.6rem', font: 'inherit', fontSize: '0.875rem', background: 'var(--surface)', color: 'var(--text-strong)' }} data-testid="print-labels-find" /> : null}
            </div>
            {facts.length > 0 && shown.length === 0 ? <EmptyState compact {...emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'jobs', query }), { onPress: () => setQuery('') })} /> : null}
            <div style={{ display: 'grid', gridTemplateColumns: ONE_COLUMN, gap: '0.6rem' }}>
              {shown.map((f) => (
                <div key={f.jobId} style={{ ...card, ...(f.resume ? wjCardFirst : {}) }} data-testid="print-labels-card">
                  {/* The head opens the job as the row always did: on a run stopped today, else on every box. */}
                  <WhichJobHead tid="print-labels" number={f.number} name={f.name} where={f.where} count={{ n: f.labels, word: f.labels === 1 ? 'label' : 'labels' }} ariaLabel={`Open the labels of ${f.label}`} onOpen={() => open(f.jobId)} />
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-700)', overflowWrap: 'anywhere' }} data-testid="print-labels-job-facts">
                    {f.kinds}
                    {f.names ? <> · {'listed' in f.names ? f.names.listed.map((n, i) => <span key={n}>{i > 0 ? ' · ' : ''}<strong>{n}</strong></span>) : <><strong>{f.names.first}</strong> to <strong>{f.names.last}</strong></>}</> : null}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.15rem 0.75rem', fontSize: '0.8rem', color: 'var(--text-700)' }} data-testid="print-labels-job-places">
                    {f.places.map((p) => <span key={p.name}>{p.name} <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{p.n}</strong></span>)}
                  </div>
                  {labelJobChips(f).length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }} data-testid="print-labels-job-chips">
                      {labelJobChips(f).map((c) => <span key={c.words} style={{ ...wjChip, ...CHIP_TONES[c.tone] }}>{c.words}</span>)}
                    </div>
                  ) : null}
                  {f.resume ? <div role="note" style={{ ...amberBox, borderRadius: 8, padding: '0.35rem 0.6rem', fontSize: '0.82rem', fontWeight: 600 }} data-testid="print-labels-job-resume">{resumeWords(f.resume)}</div> : null}
                  <div style={{ ...muted, display: 'flex', alignItems: 'center', gap: '0.4rem' }} data-testid="print-labels-job-need">
                    {tape ? <span aria-hidden style={{ width: 14, height: 14, boxSizing: 'border-box', borderRadius: '50%', borderWidth: 3, borderStyle: 'solid', borderColor: 'var(--text-muted)', flex: '0 0 auto' }} /> : null}
                    <span>{f.need}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>{f.doors.map((d, i) => door(f, d, i === 0 && f.doors.length > 1))}</div>
                </div>
              ))}
              {notLoaded.map((j) => (
                <div key={j.jobId} style={card} data-testid="print-labels-not-loaded">
                  <span style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{j.label}</span>
                  <span role="note" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem', fontWeight: 600 }}>{deskRowNotLoadedWords(j.failed)}</span>
                  {onReadAgain ? <div><button type="button" style={btn} onClick={() => onReadAgain(j.jobId)} aria-label={`Read ${j.label} again`}>Read again</button></div> : null}
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.6rem', display: 'flex', flexWrap: 'wrap', gap: '0.25rem 1rem', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }} data-testid="print-labels-foot">
              {onStickers ? <><span>{PRINT_LABELS_NOT_YET}</span><button type="button" style={quietLink} onClick={onStickers} data-testid="print-labels-stickers">{PRINT_STICKERS_LABEL}</button></> : null}
              {onScan ? <button type="button" style={quietLink} onClick={onScan} data-testid="print-labels-scan">Scan a label</button> : null}
              <a href={helpGuideHref(LABELS_GUIDE, LABELS_GUIDE_HEADING)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)', fontWeight: 600, marginLeft: 'auto' }}>How do I print labels?</a>
            </div>
          </>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
