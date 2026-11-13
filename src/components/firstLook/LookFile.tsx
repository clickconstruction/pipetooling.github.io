/**
 * One file of a First look, wherever it is drawn (punch list #319): the thread's card, the estimate's strip and the
 * Job Mode card. A photo is a small picture that opens full size, a video plays in place, and either becomes a named
 * chip with Open when the browser cannot draw it (an iPhone's HEIC in Chrome, a video it cannot play). Its own small
 * file, so a tech's card does not load the thread's card to draw a picture.
 */
import { useState, type CSSProperties } from 'react'
import { LOOK_CARD_WORDS } from '../../lib/firstLook/card'

const fileChip: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '0.3rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-base)', background: 'var(--surface)', display: 'inline-flex', gap: 6, alignItems: 'center' }
const thumb: CSSProperties = { width: 76, height: 76, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }
/** One file on the card: a photo as a picture, a video in a player, either as a named chip when the browser cannot draw it. */
export function LookFile({ kind, url, label, texted }: { kind: 'photo' | 'video'; url: string | undefined; label: string; texted: boolean }) {
  const [failed, setFailed] = useState(false)
  const title = texted ? `${label}, ${LOOK_CARD_WORDS.texted}` : label
  if (!url) {
    return (
      <span data-look-file="waiting" style={fileChip} title={LOOK_CARD_WORDS.notDrawn}>
        {label}
      </span>
    )
  }
  if (failed) {
    return (
      <span data-look-file="chip" style={fileChip} title={kind === 'video' ? LOOK_CARD_WORDS.videoNotPlayed : undefined}>
        {label}
        <a href={url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-link)', fontWeight: 600 }}>
          {LOOK_CARD_WORDS.open}
        </a>
      </span>
    )
  }
  if (kind === 'video') {
    return (
      <video data-look-file="video" controls preload="metadata" src={url} title={title} aria-label={title} onError={() => setFailed(true)} style={{ maxWidth: 'min(100%, 260px)', maxHeight: 180, borderRadius: 8, border: '1px solid var(--border)' }} />
    )
  }
  return (
    <a data-look-file="photo" href={url} target="_blank" rel="noreferrer" title={title}>
      <img src={url} alt={title} loading="lazy" onError={() => setFailed(true)} style={thumb} />
    </a>
  )
}

