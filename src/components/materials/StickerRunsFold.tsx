/**
 * Runs (punch list #329, PR 2, v2.7272): the fold under a job's boxes on Jobs → Materials that lists each run of
 * stickers printed for the job, newest first: its range and count, how many are on boxes and not used yet, who
 * printed it and when. **Reprint** prints the whole run again, the same codes, so nothing can collide; **Print the
 * rest** prints the stickers still blank. Both open the stickers window on a run already minted, which mints nothing.
 * Reads `sticker_runs` and `box_stickers` under the caller's own RLS (`stickerRunsIo.ts`); the words are
 * `stickerRun.ts` and `stickers.ts`. Nothing here when the job has no run. A named run with stickers still blank has
 * a third press, **These are on boxes** (design section 10, PR 10, v2.7406): it hands the run's blank names up, and
 * the page opens the form that puts a range of them on their boxes with no scan (`StickersOnBoxes.tsx`).
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { recoveryFailureFromError } from '../../lib/offlineRecoveryState'
import { blankStickersOf, printRestLabel, reprintLabel, runCountsOf, runsFoldWords, stickerRunByLine, stickerRunTitle, type MintedSticker, type StickerRun } from '../../lib/materials/stickerRun'
import { fetchStickerRuns, type StickerRunWithStickers } from '../../lib/materials/stickerRunsIo'
import { ON_BOXES_LABEL } from '../../lib/materials/stickersOnBoxes'
import { namesSpanWords } from '../../lib/materials/stickerNames'
import { onBoxesWords, unusedStickersWords } from '../../lib/materials/stickers'
import { calendarYmdInAppTzFromIso, formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'
import OfflineRetryPanel from '../OfflineRetryPanel'

type Props = {
  jobId: string
  /** Ticks when a run was minted here, so the fold reads again. */
  refreshKey?: number
  /** Ticks when the page's *stickers not yet on a box* line is pressed (v2.7298): the fold opens. */
  openKey?: number
  /** Opens the stickers window on a run: the whole run, or the stickers handed. */
  onPrint: (run: StickerRun, stickers: MintedSticker[], title: string) => void
  /** Opens These are on boxes on a named run: its blank names, in number order. Left out where the page has no form for it. */
  onPlaceRange?: (run: StickerRun, blankNames: string[]) => void
  /** The read; a test hands a spy. */
  fetch?: (jobId: string) => Promise<StickerRunWithStickers[]>
}

const wrap: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '0.5rem 0.9rem' }
const summary: CSSProperties = { cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-muted)', minHeight: 36, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }
const row: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', padding: '0.5rem 0', borderTop: '1px solid var(--border)' }
const press: CSSProperties = { minHeight: 36, padding: '0 0.75rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.85rem' }

export default function StickerRunsFold({ jobId, refreshKey = 0, openKey = 0, onPrint, onPlaceRange, fetch = fetchStickerRuns }: Props) {
  const [open, setOpen] = useState(false)
  useEffect(() => { if (openKey > 0) setOpen(true) }, [openKey])
  const [runs, setRuns] = useState<StickerRunWithStickers[] | null>(null)
  const [failure, setFailure] = useState<unknown>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let live = true
    setFailure(null)
    fetch(jobId)
      .then((got) => { if (live) setRuns(got) })
      .catch((e: unknown) => { if (live) setFailure(e) })
    return () => { live = false }
  }, [jobId, refreshKey, tick, fetch])
  if (failure) {
    return <OfflineRetryPanel failure={recoveryFailureFromError(failure, 'The runs of stickers did not load.')} onRetry={() => setTick((t) => t + 1)} surface="materials-sticker-runs" idempotent />
  }
  if (!runs || runs.length === 0) return null
  return (
    <details style={wrap} data-testid="sticker-runs-fold" open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary style={summary}>
        <span>{runsFoldWords(runs.length)}</span>
        <span style={{ ...muted, fontWeight: 400 }}>Blank stickers printed for this job, and how many are on boxes.</span>
      </summary>
      <div style={{ display: 'grid' }}>
        {runs.map(({ run, stickers }) => {
          const counts = runCountsOf(stickers)
          const blank = blankStickersOf(stickers)
          const day = run.printedAt ? formatWorkDateYmdMonthDayShort(calendarYmdInAppTzFromIso(run.printedAt)) : ''
          const title = stickerRunTitle(run)
          /** The rest is its own press only while some are on boxes; with none placed, Reprint prints the same stickers. */
          const restIsOwn = blank.length > 0 && blank.length < stickers.length
          /** The blank stickers' names, when every one has one: what These are on boxes can place without a scan. */
          const blankNames = blank.length > 0 && blank.every((s) => s.boxName) ? blank.map((s) => s.boxName as string) : []
          /** *3 stickers not used yet, G79 to G81*: which, by name, when the run has names. A run with none says how many. */
          const unusedHead = unusedStickersWords(counts)
          const unused = unusedHead && blankNames.length > 0 && run.names ? `${unusedHead}, ${namesSpanWords(blankNames, run.names)}` : unusedHead
          return (
            <div key={run.id} style={row} data-testid="sticker-run-row">
              <div style={{ display: 'grid', gap: '0.15rem', minWidth: 0, flex: '1 1 260px' }}>
                <b style={{ fontSize: '1rem' }}>{title}</b>
                <span style={muted}>{stickerRunByLine(run, day)}</span>
                <span style={muted} data-testid="sticker-run-counts">
                  {onBoxesWords(counts)}{unused ? ` · ${unused}` : ''}{counts.lost > 0 ? ` · ${counts.lost} marked lost` : ''}
                </span>
              </div>
              <span style={{ display: 'inline-flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {onPlaceRange && blankNames.length > 0 ? <button type="button" style={press} title="Put a range of this run's stickers on their boxes in one press, with no scan" onClick={() => onPlaceRange(run, blankNames)} data-testid="sticker-run-on-boxes">{ON_BOXES_LABEL}</button> : null}
                {restIsOwn ? <button type="button" style={press} onClick={() => onPrint(run, blank, printRestLabel(blank).replace(/^Print the rest, ?/, 'The rest, '))} data-testid="sticker-run-rest">{printRestLabel(blank)}</button> : null}
                <button type="button" style={press} disabled={stickers.length === 0} onClick={() => onPrint(run, stickers.map(({ id, number, code, boxName }) => ({ id, number, code, boxName })), title)} data-testid="sticker-run-reprint">{reprintLabel(stickers.length)}</button>
              </span>
            </div>
          )
        })}
      </div>
    </details>
  )
}
