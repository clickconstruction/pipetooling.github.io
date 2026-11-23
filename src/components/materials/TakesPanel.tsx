/**
 * Take from a box, read back (v2.7828, step 4): a job's or a box's takes, one card a take, with what was taken and
 * its pictures side by side: the box as the person before left it, the box as found, the box after
 * (`lib/materials/takes.ts`). Nothing compares two pictures. A person looks, and a chip says first what is missing.
 * Drawn on the phone's box screen and in the office's History on Materials; the pictures come from the first place
 * that holds them (`boxPhotoBytesIo.ts`) and a press opens one whole.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { EmptyState } from '../EmptyState'
import { readBoxPhotoBytes } from '../../lib/materials/boxPhotoBytesIo'
import { boxPhotoMissingWords, boxPhotoOpenLabel } from '../../lib/materials/boxPhotoSource'
import type { PhotoNote } from '../../lib/materials/photo'
import { takeAsLeft, takeChip, takeFilterChips, takeLinesWords, takePasses, takeTitle, type Take, type TakeFilter } from '../../lib/materials/takes'
import { BoxPhotoViewer, CameraGlyph } from './PhotoPress'

const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.85rem' }
const tile: CSSProperties = { width: '100%', aspectRatio: '4 / 3', borderRadius: 8, overflow: 'hidden', display: 'block', background: 'var(--bg-subtle)' }
const pill = (on: boolean): CSSProperties => ({ minHeight: 36, padding: '0 0.75rem', borderRadius: 999, borderWidth: 1, borderStyle: 'solid', borderColor: on ? 'var(--text-strong)' : 'var(--border-strong)', background: on ? 'var(--text-strong)' : 'var(--surface)', color: on ? 'var(--bg-page)' : 'var(--text-strong)', font: 'inherit', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' })
const chipStyle = (tone: 'green' | 'amber'): CSSProperties => ({ fontSize: '0.75rem', fontWeight: 600, padding: '0.1rem 0.55rem', borderRadius: 999, borderWidth: 1, borderStyle: 'solid', whiteSpace: 'nowrap', ...(tone === 'green' ? { borderColor: 'var(--text-green-700)', color: 'var(--text-green-700)', background: 'var(--bg-green-tint)' } : { borderColor: 'var(--text-amber-800)', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)' }) })

/** A take's tile is at most this wide, in CSS pixels: the small copy of a shot this phone holds is sized for it. */
const TAKE_TILE_CSS_EDGE = 210

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
function day(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** One picture of a take, or a dashed square that says there is none. A press opens the picture whole. */
function TakeTile({ photo, caption, none }: { photo: PhotoNote | null; caption: string; none: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)
  const [open, setOpen] = useState(false)
  const key = photo ? `${photo.id}:${photo.status}:${photo.driveFileId ?? ''}` : ''
  useEffect(() => {
    if (!photo) return
    let live = true
    let made: string | null = null
    setUrl(null)
    setMissing(false)
    void readBoxPhotoBytes(photo, 'thumb', TAKE_TILE_CSS_EDGE).then(
      (got) => {
        const u = got?.url
        if (!u) { if (live) setMissing(true); return }
        if (!live) { URL.revokeObjectURL(u); return }
        made = u
        setUrl(u)
      },
      () => { if (live) setMissing(true) },
    )
    return () => { live = false; if (made) URL.revokeObjectURL(made) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const empty: CSSProperties = { ...tile, border: '1px dashed var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--text-faint)', fontSize: '0.75rem', padding: '0.25rem' }
  return (
    <figure style={{ margin: 0, display: 'grid', gap: '0.25rem', minWidth: 0 }}>
      {photo && url ? (
        <button type="button" aria-label={boxPhotoOpenLabel(photo)} onClick={() => setOpen(true)} style={{ padding: 0, border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer', lineHeight: 0, overflow: 'hidden' }}>
          <img src={url} alt={photo.fileName} style={{ ...tile, borderRadius: 0, objectFit: 'cover' }} />
        </button>
      ) : photo ? (
        <span style={empty} title={missing ? boxPhotoMissingWords(photo) : undefined} data-testid="take-tile-waiting"><CameraGlyph size={18} /></span>
      ) : (
        <span style={empty} data-testid="take-tile-none">{none}</span>
      )}
      <figcaption style={{ ...muted, fontSize: '0.75rem', overflowWrap: 'anywhere' }}>{caption}</figcaption>
      {open && photo ? <BoxPhotoViewer photo={photo} onClose={() => setOpen(false)} /> : null}
    </figure>
  )
}

export default function TakesPanel({ takes, all, labelOf, heading, filters = false, limit }: {
  takes: ReadonlyArray<Take>
  /** Every take the box before this one's could be among: the photo as left is looked up here. Defaults to `takes`. */
  all?: ReadonlyArray<Take>
  labelOf: (containerId: string) => string
  heading?: string
  /** The office's chips: all, a photo missing, nothing marked. */
  filters?: boolean
  /** Show this many, with a press for the rest. */
  limit?: number
}) {
  const [filter, setFilter] = useState<TakeFilter>('all')
  const [more, setMore] = useState(false)
  const pool = all ?? takes
  const passing = takes.filter((t) => takePasses(t, filter))
  const shown = limit != null && !more ? passing.slice(0, limit) : passing
  return (
    <div style={{ display: 'grid', gap: '0.6rem', gridTemplateColumns: 'minmax(0, 1fr)' }} data-testid="takes-panel">
      {heading ? <div style={{ ...muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.72rem' }}>{heading}</div> : null}
      {filters ? (
        <div role="group" aria-label="Which takes" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {takeFilterChips(takes).map((c) => <button key={c.key} type="button" aria-pressed={filter === c.key} style={pill(filter === c.key)} onClick={() => setFilter(c.key)}>{c.words} · {c.n}</button>)}
        </div>
      ) : null}
      {takes.length === 0 ? <EmptyState compact main="Nothing taken with photos yet." tail="A take shows here when someone presses Take on a box’s screen." /> : passing.length === 0 ? <EmptyState compact main="Nothing waiting on this filter." next={{ label: 'All takes', onPress: () => setFilter('all') }} tail="shows every take." /> : null}
      {shown.map((t) => {
        const chip = takeChip(t.state)
        const left = takeAsLeft(pool, t)
        const words = takeLinesWords(t)
        return (
          <div key={t.id} style={{ background: 'var(--surface)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', borderRadius: 10, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.45rem' }} data-testid="take-card" data-state={t.state}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.6rem', alignItems: 'baseline' }}>
              <b>{takeTitle(t, labelOf(t.containerId))}</b>
              <span style={muted}>{when(t.at)}</span>
              <span style={chipStyle(chip.tone)}>{chip.words}</span>
            </div>
            {words ? <div style={muted}>{words}</div> : null}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${left ? 3 : 2}, minmax(0, 1fr))`, gap: '0.4rem', maxWidth: left ? 620 : 420 }}>
              {left ? <TakeTile photo={left} caption={`As left by ${left.byName} · ${day(left.at)}`} none="" /> : null}
              <TakeTile photo={t.before} caption="As found" none="No photo as found" />
              <TakeTile photo={t.after} caption="After" none="No photo after" />
            </div>
          </div>
        )
      })}
      {limit != null && passing.length > limit ? <button type="button" style={{ background: 'none', border: 'none', padding: 0, minHeight: 36, color: 'var(--text-link)', textDecoration: 'underline', font: 'inherit', cursor: 'pointer', justifySelf: 'start' }} onClick={() => setMore((m) => !m)}>{more ? `Show the newest ${limit}` : `Show all ${passing.length} takes`}</button> : null}
    </div>
  )
}
