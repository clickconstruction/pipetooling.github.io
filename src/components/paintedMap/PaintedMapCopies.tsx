/**
 * A copy of a painted map (punch list #345, PR 4b): a picture, and a page to print or save as a
 * PDF. For the people who will not open a link, and for paper: a gate guard, a delivery ticket,
 * the binder in the truck.
 *
 * A link can be ended and stays current. A copy cannot be taken back and goes out of date. So the
 * link sits above this in the sheet, a copy says the day it was made, and when a link is out on
 * this device the copy carries its address and its code back to the map as it is today.
 *
 * A print counts as a send: the page that printed is filed with the job (`printWhenReadyAndFile`).
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { PORTAL_COMPANY } from '../../../supabase/functions/_shared/portalCompany'
import { payQrSvgMarkup } from '../../lib/billing/payQr'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { canSharePhoto, downloadFile, sharePhoto } from '../../lib/materials/photoShare'
import { lineHowWords, lineLengthWords, mapSummaryWords, type NumberedPlace, type PaintedLine } from '../../lib/paintedMap/paintedMap'
import { paintedPlacePhotoUrls } from '../../lib/paintedMap/paintedMapIo'
import { linkEndsWords } from '../../lib/paintedMap/paintedMapLink'
import { copyMadeWords, pictureFileName, PAINTED_MAP_COPY_WORDS } from '../../lib/paintedMap/paintedMapPicture'
import { blobToDataUrl, drawPaintedMapPicture, photoThumbDataUrl, type PictureInput } from '../../lib/paintedMap/paintedMapPictureIo'
import { buildPaintedMapPrintHtml, paintedMapPrintTitle, PAINTED_MAP_PRINT_KIND } from '../../lib/paintedMap/paintedMapPrint'
import { printWhenReadyAndFile } from '../../lib/sent/sentCopiesIo'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { formatErrorMessage } from '../../utils/errorHandling'

/** The browser and network parts, so a test can stand in for them. */
export type PaintedMapCopiesIo = {
  draw: (input: PictureInput) => Promise<{ blob: Blob; tilesMissing: number } | null>
  dataUrl: (blob: Blob) => Promise<string | null>
  photoUrls: (paths: ReadonlyArray<string | null>) => Promise<Map<string, string>>
  thumb: (url: string) => Promise<string | null>
  qr: (url: string) => Promise<string>
  print: (build: () => Promise<string>, filing: { kind: string; title: string; jobIds: string[]; source: { table: string; id: string } }) => Promise<boolean>
  canShare: (file: File) => boolean
  share: (file: File, title: string) => Promise<boolean>
  download: (file: File) => void
  today: () => string
}

const liveIo: PaintedMapCopiesIo = {
  draw: drawPaintedMapPicture,
  dataUrl: blobToDataUrl,
  photoUrls: paintedPlacePhotoUrls,
  thumb: photoThumbDataUrl,
  qr: (url) => payQrSvgMarkup(url, 180, null),
  print: (build, filing) => printWhenReadyAndFile(build, filing),
  canShare: canSharePhoto,
  share: sharePhoto,
  download: downloadFile,
  today: () => todayYmdInAppTz(),
}

type Props = {
  map: { id: string; name: string; words: string; jobId: string | null }
  lines: ReadonlyArray<PaintedLine>
  places: ReadonlyArray<NumberedPlace>
  /** The link this device holds for the map, when one is out. A copy then carries it. */
  link: { url: string; endsOn: string | null } | null
  io?: PaintedMapCopiesIo
}

const press: CSSProperties = { minHeight: 48, padding: '0 0.9rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer' }
const bluePress: CSSProperties = { ...press, background: '#2563eb', borderColor: '#2563eb', color: '#fff' }
const deadPress: CSSProperties = { ...press, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, borderColor: 'var(--border)', cursor: 'default' }
const rowPress: CSSProperties = { display: 'grid', gap: '0.1rem', width: '100%', textAlign: 'left', padding: '0.55rem 0.7rem', borderRadius: 9, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer', minHeight: 52 }
const sub: CSSProperties = { fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-muted)' }
const note: CSSProperties = { margin: 0, fontSize: '0.875rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', borderRadius: 8, padding: '0.45rem 0.6rem' }

export function PaintedMapCopies({ map, lines, places, link, io = liveIo }: Props) {
  const [picture, setPicture] = useState<{ file: File; url: string; tilesMissing: number } | null>(null)
  const [drawing, setDrawing] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [said, setSaid] = useState<string | null>(null)
  const pictureUrl = useRef<string | null>(null)

  // The preview's address is this sheet's to let go of.
  useEffect(
    () => () => {
      if (pictureUrl.current) URL.revokeObjectURL(pictureUrl.current)
    },
    [],
  )

  const company = PORTAL_COMPANY.name
  const made = copyMadeWords(io.today())
  const pictureLines = lines.map((l) => ({ points: l.points, poorParts: l.poorParts }))
  const picturePlaces = places.map((p) => ({ number: p.number, name: p.name, words: p.words, lat: p.lat, lng: p.lng }))
  const summary = mapSummaryWords(lines, places.length)

  const makePicture = async () => {
    if (drawing) return
    setDrawing(true)
    setError(null)
    setSaid(null)
    try {
      const foot = [[company, made].filter(Boolean).join(' · '), ...(link ? [link.url.replace(/^https?:\/\//, '')] : []), ...(lines.length > 0 ? [PAINTED_MAP_COPY_WORDS.guide] : [])]
      const drawn = await io.draw({ lines: pictureLines, places: picturePlaces, band: { name: map.name, summary: summary.charAt(0).toUpperCase() + summary.slice(1), foot } })
      if (!drawn) {
        setError('The picture was not made. This browser would not draw it.')
        return
      }
      if (pictureUrl.current) URL.revokeObjectURL(pictureUrl.current)
      const file = new File([drawn.blob], pictureFileName(map.name), { type: 'image/jpeg' })
      pictureUrl.current = URL.createObjectURL(file)
      setPicture({ file, url: pictureUrl.current, tilesMissing: drawn.tilesMissing })
    } catch (e) {
      setError(formatErrorMessage(e, 'The picture was not made.'))
    } finally {
      setDrawing(false)
    }
  }

  // Sharing must start inside the press, so the picture is made first and handed over on a press of its own.
  const handOver = async () => {
    if (!picture) return
    setError(null)
    try {
      if (io.canShare(picture.file)) {
        if (await io.share(picture.file, map.name)) setSaid('The picture was handed to your phone to send.')
      } else {
        io.download(picture.file)
        setSaid(`Saved as ${picture.file.name}, where this browser keeps its downloads.`)
      }
    } catch (e) {
      setError(formatErrorMessage(e, 'The picture was not sent.'))
    }
  }

  const print = async () => {
    if (printing) return
    setPrinting(true)
    setError(null)
    setSaid(null)
    try {
      const ok = await io.print(
        async () => {
          const [drawn, photoUrls, qrSvg] = await Promise.all([io.draw({ lines: pictureLines, places: picturePlaces, band: null }), io.photoUrls(places.map((p) => p.photoPath)), link ? io.qr(link.url) : Promise.resolve('')])
          const pictureData = drawn ? await io.dataUrl(drawn.blob) : null
          const printPlaces = await Promise.all(
            places.map(async (p) => {
              const url = p.photoPath ? photoUrls.get(p.photoPath) : undefined
              return { number: p.number, name: p.name, words: p.words, photo: url ? await io.thumb(url) : null }
            }),
          )
          return buildPaintedMapPrintHtml({
            company: { name: company, phone: PORTAL_COMPANY.phone },
            name: map.name,
            words: map.words,
            picture: pictureData,
            places: printPlaces,
            lines: lines.map((l) => {
              const w = lineLengthWords(l)
              return `${w.lead}${w.tail ? `, ${w.tail}` : ''} · ${lineHowWords(l)}`
            }),
            link: link ? { url: link.url, qrSvg, endsWords: linkEndsWords(link.endsOn) ?? '' } : null,
            madeWords: made,
          })
        },
        { kind: PAINTED_MAP_PRINT_KIND, title: paintedMapPrintTitle(map.name), jobIds: map.jobId ? [map.jobId] : [], source: { table: 'painted_maps', id: map.id } },
      )
      if (ok) setSaid(map.jobId ? 'The page opened to print. A copy is kept with the job.' : 'The page opened to print. A copy is kept in Documents.')
      else setError('The page did not open. Allow pop-ups for this site, then press again.')
    } catch (e) {
      setError(formatErrorMessage(e, 'The page was not made.'))
    } finally {
      setPrinting(false)
    }
  }

  const shares = picture ? io.canShare(picture.file) : false

  return (
    <div data-painted-copies style={{ display: 'grid', gap: '0.6rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
      <div style={{ display: 'grid', gap: '0.15rem' }}>
        <b style={{ fontSize: '0.9375rem' }}>Or hand over a copy</b>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>{PAINTED_MAP_COPY_WORDS.rule}</span>
      </div>
      {error ? <p role="alert" style={note}>{error}</p> : null}
      {said ? <p role="status" data-painted-copies-said style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-green-700)' }}>{said}</p> : null}

      {picture ? (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <img data-painted-picture src={picture.url} alt={`A picture of ${map.name}`} style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />
          {picture.tilesMissing > 0 ? <p role="status" style={note}>Part of the picture under the line did not load. The line and the places are right. Press Make it again where the signal is better.</p> : null}
          <button type="button" data-painted-picture-send style={{ ...bluePress, minHeight: 52 }} onClick={() => void handOver()}>
            {shares ? 'Share the picture' : 'Save the picture'}
          </button>
          <button type="button" style={drawing ? deadPress : press} disabled={drawing} onClick={() => void makePicture()}>
            {drawing ? 'Making the picture…' : 'Make it again'}
          </button>
        </div>
      ) : (
        <button type="button" data-painted-picture-make style={drawing ? { ...rowPress, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'default' } : rowPress} disabled={drawing} onClick={() => void makePicture()}>
          {drawing ? 'Making the picture…' : 'Make a picture'}
          <span style={sub}>The map, its places and the day, as one image. It shows in a text without a press.</span>
        </button>
      )}

      <button type="button" data-painted-print style={printing ? { ...rowPress, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'default' } : rowPress} disabled={printing} onClick={() => void print()}>
        {printing ? 'Making the page…' : 'Print, or save as a PDF'}
        <span style={sub}>{link ? 'One page with the map, the places and a code to scan. A copy is kept with the job.' : 'One page with the map and the places. Make a link first and the page carries its code.'}</span>
      </button>
    </div>
  )
}
