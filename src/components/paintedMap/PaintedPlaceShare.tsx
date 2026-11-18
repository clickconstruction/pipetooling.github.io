/**
 * The press that sends one place to someone (punch list #393, `paintedPlaceShare.ts`). On a phone
 * it is a link that opens Messages with the place's words and a map link to the spot. At a desk it
 * copies the same words and says so. Whoever can see a place may send it.
 */
import { useState, type CSSProperties } from 'react'
import { PLACE_SHARE_WORDS, placeShareWay, placeShareWords, placeTextHref } from '../../lib/paintedMap/paintedPlaceShare'
import { isPhoneDevice } from '../../lib/quo/dial'

type Props = {
  place: { name: string; words?: string | null; kind?: string | null; lat: number; lng: number }
  /** For a test, and for a caller that already knows what it is running on. */
  phone?: boolean
  style?: CSSProperties
}

const quiet: CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', fontFamily: 'inherit', fontSize: '0.8125rem', textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer' }

const isPhoneHere = (): boolean => typeof navigator !== 'undefined' && isPhoneDevice(navigator.userAgent, navigator.maxTouchPoints)

export function PaintedPlaceShare({ place, phone, style }: Props) {
  const [said, setSaid] = useState<{ ok: boolean; words: string } | null>(null)
  const way = placeShareWay({ phone: phone ?? isPhoneHere() })
  const words = placeShareWords(place)
  // A place with no point on the globe has no spot to send.
  if (!words) return null

  if (way === 'text') {
    return (
      <a data-place-share="text" href={placeTextHref(place) ?? undefined} style={{ ...quiet, ...style }}>
        {PLACE_SHARE_WORDS.text}
      </a>
    )
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(words)
      setSaid({ ok: true, words: PLACE_SHARE_WORDS.copied })
    } catch {
      setSaid({ ok: false, words: PLACE_SHARE_WORDS.wouldNotCopy })
    }
  }
  return (
    <>
      <button type="button" data-place-share="copy" style={{ ...quiet, ...style }} onClick={() => void copy()}>
        {PLACE_SHARE_WORDS.copy}
      </button>
      {said ? (
        <span role="status" data-place-share-said style={{ display: 'block', fontSize: '0.8125rem', color: said.ok ? 'var(--text-green-700)' : 'var(--text-amber-800)' }}>
          {said.words}
        </span>
      ) : null}
    </>
  )
}
