/**
 * The Photos look (punch list #247, PR 1; the owner, 2026-11-02: *a one row multiple column photo gallery we can
 * scroll through at the bottom of developments*): the Development page's sixth look. One row, every column a
 * thumbnail, newest at the left, scrolled sideways by the wheel, the trackpad, a swipe or the arrow keys, a faint
 * day tick over the first tile of each day, and *Show more* at the right end. Above the row a job picker and the
 * source chips the Photos tab has. A tile opens the viewer Documents → Photos uses, with Previous and Next through
 * the row as shown. The rows and the reads are the page's `useSitePhotos`; the rules are `lib/photos/sitePhotos.ts`.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { boxOnSiteLink } from '../../lib/materials/boxSearch'
import { EmptyState } from '../EmptyState'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { UploadedPhotoTile } from '../documents/UploadedPhotoTile'
import { UploadedPhotoViewer } from '../documents/UploadedPhotoViewer'
import { captionWords, sourceChips, threadPath, type SourcePick, type UploadedPhotoRow } from '../../lib/photos/uploadedPhotos'
import { galleryTiles, jobPickWords, jobPicks, jobPicksShown, moreJobsWords, moreTileWords, personChipWords, photosFootWords, rowsByPerson, sitePhotosEmptyWords, sitePhotosNarrowed, tileWords } from '../../lib/photos/sitePhotos'
import type { SitePhotosState } from '../../hooks/useSitePhotos'
import { capStyle } from './developmentPageBits'

const chip = (on: boolean): CSSProperties => ({
  border: `1px solid ${on ? '#3b82f6' : 'var(--border-strong)'}`,
  background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
  color: on ? 'var(--text-blue-700)' : 'var(--text-700)',
  borderRadius: 999,
  padding: '2px 9px',
  fontSize: '0.76rem',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  font: 'inherit',
  lineHeight: 1.4,
})
const tileBtn: CSSProperties = { border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', position: 'relative', display: 'block', borderRadius: 8 }
/** The tile's words on a dark band at its foot, so they read over a bright photo and over the grey placeholder alike. */
const tag: CSSProperties = { position: 'absolute', left: 0, right: 0, bottom: 0, padding: '14px 5px 4px', background: 'linear-gradient(rgba(0,0,0,0), rgba(0,0,0,.6))', borderRadius: '0 0 8px 8px', color: '#fff', fontSize: '0.66rem', fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,.7)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left', pointerEvents: 'none' }
const tickStyle: CSSProperties = { ...capStyle, lineHeight: '16px', height: 16, whiteSpace: 'nowrap', display: 'block' }

export function DevelopmentPhotosLook({
  state,
  pieces,
  role,
  phone,
  siteName,
  openJob,
  goToPieces,
}: {
  state: SitePhotosState
  /** The site's jobs and bids as the page labels them, for the picker and the tiles' words. */
  pieces: ReadonlyArray<{ id: string; label: string }>
  role: string | null | undefined
  phone: boolean
  siteName: string
  openJob: (jobId: string) => void
  /** The empty state's press: the Jobs & bids look, where the jobs that fill the row are. */
  goToPieces: () => void
}) {
  const navigate = useNavigate()
  const { io, census, rows, more, reading, failure, source, setSource, jobId, setJobId, person, setPerson } = state
  const [open, setOpen] = useState<number | null>(null)
  const [picksOpen, setPicksOpen] = useState(false)
  const rowRef = useRef<HTMLDivElement | null>(null)
  const size = phone ? 96 : 112

  const shown = useMemo(() => rowsByPerson(rows, person), [rows, person])
  const tiles = useMemo(() => galleryTiles(shown, todayYmdInAppTz(), more && !person, census?.total ?? null), [shown, more, person, census])
  const picks = useMemo(() => jobPicks(census, pieces), [census, pieces])
  const pickRow = useMemo(() => jobPicksShown(picks, jobId, picksOpen), [picks, jobId, picksOpen])
  const labelOf = useMemo(() => new Map(pieces.map((p) => [p.id, p.label.split(' ')[0] ?? p.label])), [pieces])
  const narrowed = sitePhotosNarrowed({ jobId, source }, person)
  const empty = sitePhotosEmptyWords(narrowed, siteName)
  const sources = sourceChips(role)

  // The wheel scrolls the row sideways (the owner: *scroll through*); a listener of our own, since React's is passive.
  useEffect(() => {
    const el = rowRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      if (el.scrollWidth <= el.clientWidth) return
      el.scrollLeft += e.deltaY
      e.preventDefault()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [tiles.length])

  // The arrow keys move a focused tile.
  const onRowKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const buttons = Array.from(rowRef.current?.querySelectorAll<HTMLButtonElement>('button[data-tile]') ?? [])
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (at < 0) return
    const next = buttons[at + (e.key === 'ArrowRight' ? 1 : -1)]
    if (next) {
      next.focus()
      next.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      e.preventDefault()
    }
  }

  const openJobOf = useCallback(
    (row: UploadedPhotoRow) => {
      if (!row.job_id) return
      setOpen(null)
      openJob(row.job_id)
    },
    [openJob],
  )
  // The source's door on the viewer: the box's On site tab, the thread at its line, the job for a checklist's shot; a report's shot has the job.
  const sourceDoor = useCallback(
    (row: UploadedPhotoRow): ((row: UploadedPhotoRow) => void) | null => {
      if (row.source === 'box' && row.job_id && row.container_id) {
        const to = boxOnSiteLink(row.job_id, row.container_id)
        return () => navigate(to)
      }
      if (row.source === 'message') {
        const to = threadPath(row)
        return to ? () => navigate(to) : null
      }
      if (row.source === 'checklist' && row.job_id) return () => openJobOf(row)
      return null
    },
    [navigate, openJobOf],
  )

  const pickChips = (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: phone ? 'nowrap' : 'wrap', overflowX: phone ? 'auto' : undefined, paddingBottom: phone ? 4 : 0 }} data-testid="site-photos-jobs">
      <span style={{ ...capStyle, flex: 'none' }}>Job</span>
      {pickRow.picks.map((p) => {
        const on = p.key === 'all' ? jobId === null : jobId === p.key
        return (
          <button key={p.key} type="button" style={chip(on)} aria-pressed={on} onClick={() => setJobId(p.key === 'all' ? null : p.key)} data-testid={`site-photos-job-${p.key}`}>
            {jobPickWords(p)}
          </button>
        )
      })}
      {pickRow.folded > 0 ? (
        <button type="button" style={chip(false)} onClick={() => setPicksOpen(true)} data-testid="site-photos-more-jobs">
          {moreJobsWords(pickRow.folded)}
        </button>
      ) : null}
    </div>
  )
  const sourceRow = (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: phone ? 'nowrap' : 'wrap', overflowX: phone ? 'auto' : undefined, paddingBottom: phone ? 4 : 0 }} data-testid="site-photos-sources">
      <span style={{ ...capStyle, flex: 'none' }}>Source</span>
      {sources.map((c) => (
        <button key={c.key} type="button" style={chip(source === c.key)} aria-pressed={source === c.key} onClick={() => setSource(c.key as SourcePick)} data-testid={`site-photos-source-${c.key}`}>
          {c.label}
        </button>
      ))}
      {person ? (
        <button type="button" style={{ ...chip(true), borderColor: 'var(--text-amber-800)', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)' }} onClick={() => setPerson(null)} title="Every person's photos again" data-testid="site-photos-person">
          {personChipWords(person)} <span aria-hidden>×</span>
        </button>
      ) : null}
    </div>
  )

  return (
    <div style={{ display: 'grid', gap: 8 }} data-testid="site-photos-look">
      {picks.length > 1 ? pickChips : null}
      {census && census.total > 0 ? sourceRow : null}
      {failure ? <OfflineRetryPanel failure={failure} onRetry={state.reload} surface="development-photos" idempotent busy={reading} /> : null}
      {!failure && shown.length === 0 && !reading ? (
        <div data-testid="site-photos-empty">
          <EmptyState main={empty.main} next={narrowed ? undefined : { label: 'Jobs & bids', onPress: goToPieces }} tail={empty.tail} compact />
        </div>
      ) : null}
      {!failure && shown.length === 0 && reading ? <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Reading the site’s photos…</p> : null}
      {shown.length > 0 ? (
        <>
          <div ref={rowRef} onKeyDown={onRowKey} role="list" aria-label="The site's photos, newest first" data-testid="site-photos-row" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '2px 0 8px', alignItems: 'flex-end', scrollbarWidth: 'thin' }}>
            {tiles.map((t) =>
              t.kind === 'more' ? (
                <div key="more" role="listitem" style={{ flex: 'none', display: 'grid', gridTemplateRows: '16px auto', gap: 3 }}>
                  <span style={tickStyle} aria-hidden />
                  <button type="button" data-tile onClick={state.showMore} disabled={reading} data-testid="site-photos-more" style={{ ...tileBtn, width: size, height: size, border: '1px solid var(--border-blue)', background: 'var(--bg-blue-tint)', color: 'var(--text-link)', fontWeight: 700, fontSize: '0.8rem', lineHeight: 1.25, display: 'grid', placeItems: 'center', cursor: reading ? 'wait' : 'pointer' }}>
                    <span>
                      {reading ? 'Reading…' : 'Show more'}
                      {moreTileWords(t.left) ? (
                        <>
                          <br />
                          <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>{moreTileWords(t.left)}</span>
                        </>
                      ) : null}
                    </span>
                  </button>
                </div>
              ) : (
                <div key={`${t.row.source}-${t.row.id}`} role="listitem" data-testid="site-photos-tile" data-day-start={t.tick ? '1' : undefined} style={{ flex: 'none', display: 'grid', gridTemplateRows: '16px auto', gap: 3, ...(t.tick ? { borderLeft: '2px solid var(--border-strong)', paddingLeft: 8, marginLeft: 2 } : {}) }}>
                  {t.tick ? (
                    <span style={tickStyle} data-testid="site-photos-tick">
                      {t.tick}
                    </span>
                  ) : (
                    <span style={tickStyle} aria-hidden />
                  )}
                  <button type="button" data-tile aria-label={`Open ${captionWords(t.row)}`} onClick={() => setOpen(t.index)} style={{ ...tileBtn, width: size, height: size }}>
                    <UploadedPhotoTile row={t.row} io={io.photos} size={size} />
                    <span style={tag}>{tileWords(t.row, (t.row.job_id && labelOf.get(t.row.job_id)) || (t.row.bid_id && labelOf.get(t.row.bid_id)) || null)}</span>
                  </button>
                </div>
              ),
            )}
          </div>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: 10, flexWrap: 'wrap' }} data-testid="site-photos-foot">
            <span>{photosFootWords(shown.length, census, narrowed)}</span>
            <Link to="/documents?tab=photos" style={{ color: 'var(--text-link)', textDecoration: 'none' }} title="Every photo uploaded, every site, with where each one is">
              Every site’s photos ›
            </Link>
          </p>
        </>
      ) : null}
      {open != null && shown[open] ? (
        <UploadedPhotoViewer
          rows={shown}
          index={open}
          io={io.photos}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          onJob={openJobOf}
          onSource={sourceDoor(shown[open]!)}
          onPerson={(name) => {
            setPerson(name)
            setOpen(null)
          }}
        />
      ) : null}
    </div>
  )
}

export default DevelopmentPhotosLook
