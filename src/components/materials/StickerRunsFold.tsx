/**
 * Runs (punch list #329, PR 2, v2.7272): the fold under a job's boxes on Jobs → Materials that lists each run of
 * stickers printed for the job, newest first: its range and count, how many are on boxes and not used yet, who
 * printed it and when. **Reprint** prints the whole run again, the same codes, so nothing can collide; **Print the
 * rest** prints the stickers still blank. Both open the stickers window on a run already minted, which mints nothing.
 * Reads `sticker_runs` and `box_stickers` under the caller's own RLS (`stickerRunsIo.ts`); the words are
 * `stickerRun.ts` and `stickers.ts`. Nothing here when the job has no run.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { recoveryFailureFromError } from '../../lib/offlineRecoveryState'
import { blankStickersOf, printRestLabel, reprintLabel, runCountsOf, runsFoldWords, stickerRunByLine, stickerRunTitle, type MintedSticker, type StickerRun } from '../../lib/materials/stickerRun'
import { fetchStickerRuns, type StickerRunWithStickers } from '../../lib/materials/stickerRunsIo'
import { onBoxesWords, unusedStickersWords } from '../../lib/materials/stickers'
import { calendarYmdInAppTzFromIso, formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'
import OfflineRetryPanel from '../OfflineRetryPanel'

type Props = {
  jobId: string
  /** Ticks when a run was minted here, so the fold reads again. */
  refreshKey?: number
  /** Opens the stickers window on a run: the whole run, or the stickers handed. */
  onPrint: (run: StickerRun, stickers: MintedSticker[], title: string) => void
  /** The read; a test hands a spy. */
  fetch?: (jobId: string) => Promise<StickerRunWithStickers[]>
}

const wrap: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '0.5rem 0.9rem' }
const summary: CSSProperties = { cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-muted)', minHeight: 36, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }
const row: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', padding: '0.5rem 0', borderTop: '1px solid var(--border)' }
const press: CSSProperties = { minHeight: 36, padding: '0 0.75rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.85rem' }

export default function StickerRunsFold({ jobId, refreshKey = 0, onPrint, fetch = fetchStickerRuns }: Props) {
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
    <details style={wrap} data-testid="sticker-runs-fold">
      <summary style={summary}>
        <span>{runsFoldWords(runs.length)}</span>
        <span style={{ ...muted, fontWeight: 400 }}>Blank stickers printed for this job, and how many are on boxes.</span>
      </summary>
      <div style={{ display: 'grid' }}>
        {runs.map(({ run, stickers }) => {
          const counts = runCountsOf(stickers)
          const blank = blankStickersOf(stickers)
          const day = run.printedAt ? formatWorkDateYmdMonthDayShort(calendarYmdInAppTzFromIso(run.printedAt)) : ''
          const unused = unusedStickersWords(counts)
          const title = stickerRunTitle(run)
          /** The rest is its own press only while some are on boxes; with none placed, Reprint prints the same stickers. */
          const restIsOwn = blank.length > 0 && blank.length < stickers.length
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
                {restIsOwn ? <button type="button" style={press} onClick={() => onPrint(run, blank, printRestLabel(blank).replace(/^Print the rest, ?/, 'The rest, '))} data-testid="sticker-run-rest">{printRestLabel(blank)}</button> : null}
                <button type="button" style={press} disabled={stickers.length === 0} onClick={() => onPrint(run, stickers.map(({ id, number, code }) => ({ id, number, code })), title)} data-testid="sticker-run-reprint">{reprintLabel(stickers.length)}</button>
              </span>
            </div>
          )
        })}
      </div>
    </details>
  )
}
