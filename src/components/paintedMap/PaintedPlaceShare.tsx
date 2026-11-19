/**
 * The press that sends one place to someone (punch list #393, `paintedPlaceShare.ts`). On a phone
 * it is a link that opens Messages with the place's words and a map link to the spot. At a desk it
 * copies the same words and says so. Whoever can see a place may send it.
 *
 * **Send more…** sits beside it when the row has more to offer (v2.7844,
 * `paintedPlaceSendMore.ts`): the place with its photo, every place of the row's set, or the whole
 * map. The one press stays one press. A place with a photo says the photo stays behind.
 */
import { useState, type CSSProperties } from 'react'
import { noPhotoWords, SEND_MORE_WORDS, sendablePlaces, sendMoreWays, type SendMoreSet } from '../../lib/paintedMap/paintedPlaceSendMore'
import { placeSendMoreIo, type PlaceSendMoreIo } from '../../lib/paintedMap/paintedPlaceSendMoreIo'
import { PLACE_SHARE_WORDS, placeShareWay, placeShareWords, placeTextHref } from '../../lib/paintedMap/paintedPlaceShare'
import { isPhoneDevice } from '../../lib/quo/dial'
import { PaintedPlaceSendMore, type SendMorePlace } from './PaintedPlaceSendMore'

/** What else a row may send. */
export type PlaceShareMore = {
  /** The places this row stands with, this one among them: the job's kept places, or the map's own. */
  set: ReadonlyArray<SendMorePlace>
  setKind: SendMoreSet
  /** The place's photo in the bucket, or none. */
  photoPath?: string | null
  /** Opens the map's own Share sheet. Left out for a place that is not the map's own, and for whoever may not share the map. */
  onShareMap?: () => void
  /** The map is a job's own list of places. */
  list?: boolean
}

type Props = {
  place: SendMorePlace
  /** Send more…. Left out, the row offers the one press alone. */
  more?: PlaceShareMore
  /** For a test, and for a caller that already knows what it is running on. */
  phone?: boolean
  style?: CSSProperties
  io?: PlaceSendMoreIo
}

const quiet: CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', fontFamily: 'inherit', fontSize: '0.8125rem', textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer' }

const isPhoneHere = (): boolean => typeof navigator !== 'undefined' && isPhoneDevice(navigator.userAgent, navigator.maxTouchPoints)

export function PaintedPlaceShare({ place, more, phone, style, io = placeSendMoreIo }: Props) {
  const [said, setSaid] = useState<{ ok: boolean; words: string } | null>(null)
  const [open, setOpen] = useState(false)
  const onPhone = phone ?? isPhoneHere()
  const way = placeShareWay({ phone: onPhone })
  const words = placeShareWords(place)
  // A place with no point on the globe has no spot to send.
  if (!words) return null

  const hasPhoto = !!more?.photoPath
  const set = more ? sendablePlaces(more.set) : []
  const ways = more ? sendMoreWays({ hasPhoto, canShareFiles: hasPhoto && io.canSharePhoto(), setCount: set.length, mayShareMap: !!more.onShareMap }) : []

  const copy = async () => {
    try {
      await io.copy(words)
      setSaid({ ok: true, words: PLACE_SHARE_WORDS.copied })
    } catch {
      setSaid({ ok: false, words: PLACE_SHARE_WORDS.wouldNotCopy })
    }
  }

  return (
    <>
      <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', columnGap: '1.1rem' }}>
        {way === 'text' ? (
          <a data-place-share="text" href={placeTextHref(place) ?? undefined} style={{ ...quiet, ...style }}>
            {PLACE_SHARE_WORDS.text}
          </a>
        ) : (
          <button type="button" data-place-share="copy" style={{ ...quiet, ...style }} onClick={() => void copy()}>
            {PLACE_SHARE_WORDS.copy}
          </button>
        )}
        {ways.length > 0 ? (
          <button type="button" data-place-send-more aria-haspopup="dialog" style={{ ...quiet, ...style, color: 'var(--text-muted)' }} onClick={() => setOpen(true)}>
            {SEND_MORE_WORDS.press}
          </button>
        ) : null}
      </span>
      {hasPhoto ? (
        <span data-place-no-photo style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {noPhotoWords(way)}
        </span>
      ) : null}
      {said ? (
        <span role="status" data-place-share-said style={{ display: 'block', fontSize: '0.8125rem', color: said.ok ? 'var(--text-green-700)' : 'var(--text-amber-800)' }}>
          {said.words}
        </span>
      ) : null}
      {open && more ? (
        <PaintedPlaceSendMore place={place} photoPath={more.photoPath ?? null} ways={ways} set={set} setKind={more.setKind} phone={onPhone} list={more.list === true} onShareMap={more.onShareMap} onClose={() => setOpen(false)} io={io} />
      ) : null}
    </>
  )
}
