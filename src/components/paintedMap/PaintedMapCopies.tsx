/**
 * A copy of a painted map (punch list #345, PR 4b): a picture, and a page to print or save as a
 * PDF. For the people who will not open a link, and for paper: a gate guard, a delivery ticket,
 * the binder in the truck.
 *
 * A link can be ended and stays current. A copy cannot be taken back and goes out of date. So the
 * link's presses come first in the sheet, a copy says the day it was made, and it carries the
 * link's address and code back to the map as it is today.
 *
 * Since punch list #394 the sheet has no Make a link step, so a copy makes the link itself
 * (`ensureLink`): a page or a picture never goes out with no way back. With no signal the copy is
 * still made, without the link.
 *
 * The sheet draws the parts where they belong: **Make a picture** as a tile among the first
 * presses, the picture alone on the sheet once it is made (`PaintedMapPictureView`), and the page
 * and the two files behind **Print or a file** (`PaintedMapCopiesFold`). One hook holds them
 * (`usePaintedMapCopies`).
 *
 * A print counts as a send: the page that printed is filed with the job (`printWhenReadyAndFile`).
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { PaintedMapShareIcon } from './PaintedMapShareIcon'
import { PORTAL_COMPANY } from '../../../supabase/functions/_shared/portalCompany'
import { payQrSvgMarkup } from '../../lib/billing/payQr'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { canSharePhoto, downloadFile, sharePhoto } from '../../lib/materials/photoShare'
import { lineHowWords, lineLengthWords, mapSummaryWords, type NumberedPlace, type PaintedLine } from '../../lib/paintedMap/paintedMap'
import { paintedPlacePhotoUrls } from '../../lib/paintedMap/paintedMapIo'
import { paintedMapFile, PAINTED_MAP_FILE_WORDS, type PaintedMapFileKind } from '../../lib/paintedMap/paintedMapFiles'
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

/** The map as a copy needs it: its name and words, its lines and its places. */
export type PaintedMapWhole = { map: { id: string; name: string; words: string; jobId: string | null }; lines: ReadonlyArray<PaintedLine>; places: ReadonlyArray<NumberedPlace> }

/** The link a copy carries: its address and the day it ends. */
export type PaintedMapCopyLink = { url: string; endsOn: string | null }

type Input = {
  /** Left out, there is nothing to copy and every press here does nothing. */
  whole: PaintedMapWhole | null
  /** The link this device holds for the map, when one is out. A copy then carries it. */
  link: PaintedMapCopyLink | null
  /** Makes the link when none is out, and says nothing when it cannot: the copy is made without it. */
  ensureLink?: () => Promise<PaintedMapCopyLink | null>
  io?: PaintedMapCopiesIo
}

/** What the sheet reads and presses. */
export type PaintedMapCopiesState = {
  mapName: string
  picture: { file: File; url: string; tilesMissing: number } | null
  drawing: boolean
  printing: boolean
  error: string | null
  said: string | null
  /** The picture goes to the phone's share sheet. Otherwise it is saved as a file. */
  shares: boolean
  /** True when a picture was made. */
  makePicture: () => Promise<boolean>
  handOver: () => Promise<void>
  print: () => Promise<void>
  handFile: (kind: PaintedMapFileKind) => Promise<void>
}

const NO_MAP: PaintedMapWhole['map'] = { id: '', name: '', words: '', jobId: null }

const press: CSSProperties = { minHeight: 48, padding: '0 0.9rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer' }
const bluePress: CSSProperties = { ...press, background: '#2563eb', borderColor: '#2563eb', color: '#fff' }
const deadPress: CSSProperties = { ...press, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, borderColor: 'var(--border)', cursor: 'default' }
const rowPress: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.7rem', width: '100%', textAlign: 'left', padding: '0.3rem 0.8rem', borderRadius: 10, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer', minHeight: 48 }
const sub: CSSProperties = { fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-muted)' }
const note: CSSProperties = { margin: 0, fontSize: '0.875rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', borderRadius: 8, padding: '0.45rem 0.6rem' }

export function usePaintedMapCopies({ whole, link, ensureLink, io = liveIo }: Input): PaintedMapCopiesState {
  const map = whole?.map ?? NO_MAP
  const lines = whole?.lines ?? []
  const places = whole?.places ?? []
  /** The link a copy carries: the one that is out, else one made now, else none. */
  const heldLink = async (): Promise<PaintedMapCopyLink | null> => link ?? (ensureLink ? await ensureLink().catch(() => null) : null)
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
  const picturePlaces = places.map((p) => ({ number: p.number, name: p.name, words: p.words, lat: p.lat, lng: p.lng, kind: p.kind ?? null }))
  const summary = mapSummaryWords(lines, places.length)

  const makePicture = async (): Promise<boolean> => {
    if (drawing || !whole) return false
    setDrawing(true)
    setError(null)
    setSaid(null)
    try {
      const held = await heldLink()
      const foot = [[company, made].filter(Boolean).join(' · '), ...(held ? [held.url.replace(/^https?:\/\//, '')] : []), ...(lines.length > 0 ? [PAINTED_MAP_COPY_WORDS.guide] : [])]
      const drawn = await io.draw({ lines: pictureLines, places: picturePlaces, band: { name: map.name, summary: summary.charAt(0).toUpperCase() + summary.slice(1), foot } })
      if (!drawn) {
        setError('The picture was not made. This browser would not draw it.')
        return false
      }
      if (pictureUrl.current) URL.revokeObjectURL(pictureUrl.current)
      const file = new File([drawn.blob], pictureFileName(map.name), { type: 'image/jpeg' })
      pictureUrl.current = URL.createObjectURL(file)
      setPicture({ file, url: pictureUrl.current, tilesMissing: drawn.tilesMissing })
      return true
    } catch (e) {
      setError(formatErrorMessage(e, 'The picture was not made.'))
      return false
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
    if (printing || !whole) return
    setPrinting(true)
    setError(null)
    setSaid(null)
    try {
      const ok = await io.print(
        // The link is made in here and not before: the page's window must open inside the press.
        async () => {
          const held = await heldLink()
          const [drawn, photoUrls, qrSvg] = await Promise.all([io.draw({ lines: pictureLines, places: picturePlaces, band: null }), io.photoUrls(places.map((p) => p.photoPath)), held ? io.qr(held.url) : Promise.resolve('')])
          const pictureData = drawn ? await io.dataUrl(drawn.blob) : null
          const printPlaces = await Promise.all(
            places.map(async (p) => {
              const url = p.photoPath ? photoUrls.get(p.photoPath) : undefined
              return { number: p.number, name: p.name, words: p.words, kind: p.kind ?? null, photo: url ? await io.thumb(url) : null }
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
            link: held ? { url: held.url, qrSvg, endsWords: linkEndsWords(held.endsOn) ?? '' } : null,
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

  // A file for another map: the lines and the places with their words, and nothing else.
  const handFile = async (kind: PaintedMapFileKind) => {
    if (!whole) return
    setError(null)
    setSaid(null)
    try {
      const built = paintedMapFile(kind, {
        name: map.name,
        words: map.words,
        lines: lines.map((l) => {
          const w = lineLengthWords(l)
          return { points: l.points, label: l.label, lengthWords: `${w.lead}${w.tail ? `, ${w.tail}` : ''}` }
        }),
        places: picturePlaces,
        company,
        madeWords: made,
      })
      const file = new File([built.text], built.name, { type: built.type })
      if (io.canShare(file)) {
        if (await io.share(file, map.name)) setSaid('The file was handed to your phone to send.')
      } else {
        io.download(file)
        setSaid(`Saved as ${file.name}, where this browser keeps its downloads.`)
      }
    } catch (e) {
      setError(formatErrorMessage(e, 'The file was not made.'))
    }
  }

  const shares = picture ? io.canShare(picture.file) : false

  return { mapName: map.name, picture, drawing, printing, error, said, shares, makePicture, handOver, print, handFile }
}

/** What a copy said or could not do, in the sheet's own marks. */
function CopiesSaid({ copies }: { copies: PaintedMapCopiesState }) {
  return (
    <>
      {copies.error ? <p role="alert" style={note}>{copies.error}</p> : null}
      {copies.said ? <p role="status" data-painted-copies-said style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-green-700)' }}>{copies.said}</p> : null}
    </>
  )
}

/**
 * The picture, alone on the sheet: what it is, the copy's rule before it goes, and one blue press.
 * Sharing must start inside a press, so the picture was made first and is handed over here.
 */
export function PaintedMapPictureView({ copies, onBack, backWords }: { copies: PaintedMapCopiesState; onBack: () => void; backWords: string }) {
  const picture = copies.picture
  if (!picture) return null
  return (
    <div data-painted-picture-view style={{ display: 'grid', gap: '0.55rem' }}>
      <img data-painted-picture src={picture.url} alt={`A picture of ${copies.mapName}`} style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />
      {picture.tilesMissing > 0 ? <p role="status" style={note}>Part of the picture under the line did not load. The line and the places are right. Press Make it again where the signal is better.</p> : null}
      <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-700)' }}>{PAINTED_MAP_COPY_WORDS.rule}</p>
      <CopiesSaid copies={copies} />
      <button type="button" data-painted-picture-send style={{ ...bluePress, minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', fontSize: '1.0625rem', borderRadius: 10 }} onClick={() => void copies.handOver()}>
        <PaintedMapShareIcon name={copies.shares ? 'another' : 'picture'} />
        {copies.shares ? 'Share the picture' : 'Save the picture'}
      </button>
      <button type="button" style={copies.drawing ? deadPress : press} disabled={copies.drawing} onClick={() => void copies.makePicture()}>
        {copies.drawing ? 'Making the picture…' : 'Make it again'}
      </button>
      <button type="button" data-painted-picture-back onClick={onBack} style={{ justifySelf: 'start', minHeight: 44, padding: '0 0.2rem', background: 'none', border: 'none', color: 'var(--text-link)', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
        ‹ {backWords}
      </button>
    </div>
  )
}

/** Behind **Print or a file**: the copy's rule, the page to print, and the two files for another map. */
export function PaintedMapCopiesFold({ copies }: { copies: PaintedMapCopiesState }) {
  return (
    <div data-painted-copies style={{ display: 'grid', gap: '0.5rem' }}>
      <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-700)' }}>{PAINTED_MAP_COPY_WORDS.rule}</p>
      <button type="button" data-painted-print style={copies.printing ? { ...rowPress, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, borderColor: 'var(--border)', cursor: 'default' } : rowPress} disabled={copies.printing} onClick={() => void copies.print()}>
        <PaintedMapShareIcon name="print" size={22} color={copies.printing ? 'currentColor' : 'var(--text-link)'} />
        {copies.printing ? 'Making the page…' : 'Print, or save as a PDF'}
      </button>
      <p data-painted-files style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-700)' }}>
        <b>A file for another map.</b> The lines and the places with their words. No photos.
      </p>
      {(['kml', 'gpx'] as const).map((kind) => (
        <button key={kind} type="button" data-painted-file={kind} style={{ ...rowPress, minHeight: 52 }} onClick={() => void copies.handFile(kind)}>
          <PaintedMapShareIcon name="file" size={22} color="var(--text-link)" />
          <span style={{ display: 'grid', gap: 1 }}>
            {PAINTED_MAP_FILE_WORDS[kind].press}
            <span style={sub}>{PAINTED_MAP_FILE_WORDS[kind].forWhat}</span>
          </span>
        </button>
      ))}
      <CopiesSaid copies={copies} />
    </div>
  )
}
