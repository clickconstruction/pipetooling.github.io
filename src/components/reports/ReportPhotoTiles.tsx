import type { CSSProperties } from 'react'
import { CameraGlyph } from '../materials/PhotoPress'
import { REPORT_PHOTO_WORDS, tileNeedsStage, type ReportPhotoTile } from '../../lib/photos/reportPhotos'
import { shrinkWords } from '../../lib/photos/shrink'
import { STAGE_QUICK_PICK_MIN_HEIGHT } from '../../lib/reports/stagePct'

const TILE = 96

const tileFrame: CSSProperties = {
  width: TILE,
  display: 'grid',
  gap: 4,
  justifyItems: 'stretch',
}

const img: CSSProperties = {
  width: TILE,
  height: TILE,
  objectFit: 'cover',
  borderRadius: 10,
  border: '1px solid var(--border)',
  display: 'block',
  background: 'var(--bg-muted)',
}

const small: CSSProperties = {
  fontSize: '0.72rem',
  lineHeight: 1.25,
  color: 'var(--text-muted)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const quiet: CSSProperties = {
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: 'var(--text-link)',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: '0.75rem',
  fontWeight: 600,
  minHeight: 32,
  textAlign: 'left',
}

/** A stage to put a photo on: the job's priced lines, as the report's rows name them. */
export type ReportPhotoStage = { fixtureId: string; name: string }

/**
 * The tiles at the top of a camera-first report (punch list #189, PR 5b; the mock-up's section 6, frames 2 and 4):
 * each shot with its thumbnail and what the shrink did (*4.2 MB → 310 KB · 1600 px*, *Shrinking…*, *Sending…*, or
 * why it did not send with Retry), Remove under each, and a Take another tile that opens the camera. Under a new
 * tile on a job with stages, a row of 48 px chips asks which stage it shows; a one-stage job never asks. The host
 * owns the tiles and the camera; this component only draws.
 */
export function ReportPhotoTiles({
  tiles,
  stages,
  onTake,
  onStage,
  onRemove,
  onRetry,
  captureWords,
}: {
  tiles: ReadonlyArray<ReportPhotoTile>
  stages: ReadonlyArray<ReportPhotoStage>
  onTake: () => void
  onStage: (tileId: string, stage: ReportPhotoStage) => void
  onRemove: (tileId: string) => void
  onRetry: (tileId: string) => void
  /** The camera tile's words: Take a photo with no tile yet, else Take another; Add a photo at a desk. */
  captureWords: string
}) {
  const asking = tiles.find((t) => t.status !== 'failed' && tileNeedsStage(t, stages.length)) ?? null
  return (
    <div data-testid="report-photo-tiles">
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {tiles.map((t) => {
          const words =
            t.status === 'shrinking'
              ? REPORT_PHOTO_WORDS.shrinking
              : t.status === 'sending'
                ? REPORT_PHOTO_WORDS.sending
                : t.status === 'failed'
                  ? (t.failWhy ?? 'Did not send.')
                  : shrinkWords({ before: t.originalBytes, after: t.bytes, longEdge: t.longEdge, shrunk: t.shrunk })
          return (
            <div key={t.id} style={tileFrame} data-testid="report-photo-tile" data-status={t.status}>
              <img src={t.previewUrl} alt={t.stageName ? `Photo of ${t.stageName}` : 'Photo for the report'} style={img} />
              <span style={{ ...small, color: t.status === 'failed' ? 'var(--text-amber-800)' : 'var(--text-muted)', fontWeight: t.status === 'failed' ? 600 : 500, whiteSpace: 'normal' }}>{words}</span>
              {t.stageName ? <span style={{ ...small, color: 'var(--text-blue-700)', fontWeight: 600 }}>{t.stageName}</span> : null}
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                {t.status === 'failed' ? (
                  <button type="button" style={quiet} onClick={() => onRetry(t.id)}>
                    {REPORT_PHOTO_WORDS.retry}
                  </button>
                ) : null}
                <button type="button" style={{ ...quiet, color: 'var(--text-muted)' }} onClick={() => onRemove(t.id)} aria-label={`Remove ${t.stageName ? `the photo of ${t.stageName}` : 'this photo'}`}>
                  {REPORT_PHOTO_WORDS.remove}
                </button>
              </div>
            </div>
          )
        })}
        <button
          type="button"
          onClick={onTake}
          aria-label={`${captureWords}: open the camera`}
          style={{ ...tileFrame, height: TILE, borderRadius: 10, border: '1px dashed var(--border-strong)', background: 'var(--surface)', color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.8rem', fontWeight: 700, display: 'grid', placeItems: 'center', gap: 4, alignContent: 'center' }}
        >
          <CameraGlyph size={22} />
          {captureWords}
        </button>
      </div>
      {asking ? (
        <div data-testid="report-photo-stage-ask" style={{ marginTop: '0.6rem', padding: '0.6rem 0.7rem', borderRadius: 10, background: 'var(--bg-blue-tint)', border: '1px solid var(--border-blue)' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6 }}>{REPORT_PHOTO_WORDS.shows}</div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {stages.map((s) => (
              <button
                key={s.fixtureId}
                type="button"
                onClick={() => onStage(asking.id, s)}
                aria-label={`This photo shows ${s.name}`}
                style={{ minHeight: STAGE_QUICK_PICK_MIN_HEIGHT, padding: '0 0.9rem', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** The thumbnails on a stage's row, with the camera for that stage (the mock-up's section 3: a photo hangs on its stage). */
export function StageRowPhotos({ tiles, onCamera, stageName }: { tiles: ReadonlyArray<ReportPhotoTile>; onCamera: () => void; stageName: string }) {
  return (
    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', padding: '0 0.7rem 0.5rem' }} data-testid="stage-row-photos">
      {tiles.map((t) => (
        <img key={t.id} src={t.previewUrl} alt={`Photo of ${stageName}`} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />
      ))}
      <button
        type="button"
        onClick={onCamera}
        aria-label={`${REPORT_PHOTO_WORDS.cameraOnStage}: ${stageName}`}
        title={REPORT_PHOTO_WORDS.cameraOnStage}
        style={{ width: 44, height: 44, borderRadius: 8, border: '1px dashed var(--border-strong)', background: 'var(--surface)', color: 'var(--text-link)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
      >
        <CameraGlyph size={18} />
      </button>
    </div>
  )
}
