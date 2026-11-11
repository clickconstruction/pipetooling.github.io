/**
 * A bid's photos, for a window to hold (punch list #306): the first row of the bid's Files window (`BidFilesModal`)
 * and the Photos window (`BidPhotosWindow`). It opens on what the bid has: its photos, newest first, with who added
 * each and the day. Photos are added by a pick or a drop at a desk and by the camera on a phone. A chosen photo is a
 * tile at the top with an optional name; the press says what it does with its count, and the first time on a bid it
 * names the folder it makes: *Make the folder and add 3 photos*. The photo is in the app the moment it is picked and
 * the sweep files it in Drive, so a bid folder the app cannot file into costs a delay and never a photo; the panel
 * says why when that is so.
 *
 * The read is the `bid-photos` function's (`lib/bids/bidPhotosIo.ts`); a read that fails draws `OfflineRetryPanel`
 * with its reason. The rules are `lib/bids/bidPhotoWindow.ts`.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type DragEvent, type ReactNode } from 'react'
import * as S from '../jobMode/sheetStyles'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { EmptyState } from '../EmptyState'
import { CameraGlyph } from '../materials/PhotoPress'
import { useAuth } from '../../hooks/useAuth'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { useShotTileEngine } from '../../hooks/useShotTiles'
import { useToastContext } from '../../contexts/ToastContext'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { drivePhotoUrl } from '../../lib/photos/jobPhotos'
import { fileTimeOrNow } from '../../lib/photos/shotTiles'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { supabaseBidPhotosWindowIo, type BidPhotosRead, type BidPhotosWindowIo } from '../../lib/bids/bidPhotosIo'
import { BidPhotoFull, BidPhotoThumb } from './BidPhotoPictures'
import {
  BID_PHOTO_NAME_MAX,
  BID_PHOTO_WORDS,
  addPress,
  addWrites,
  addedWords,
  driveSilentWords,
  gridHeadWords,
  gridTileWords,
  heldFilesWords,
  newestFirst,
  sortPickedFiles,
  tileStatusWords,
  whereWords,
  type BidPhotoTile,
  type HeldFile,
} from '../../lib/bids/bidPhotoWindow'

export interface BidPhotosWindowBid {
  id: string
  /** The bid as the board names it: *b598 Quarry Road Storage Bunker*. */
  label: string
}

const TILE = 132
const sub: CSSProperties = { margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }
const headRow: CSSProperties = { display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }
const headCount: CSSProperties = { fontWeight: 700, color: 'var(--text-strong)', fontSize: '0.9375rem' }
const smallBtn: CSSProperties = { minHeight: 36, padding: '0 0.8rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit' }
const smallBlue: CSSProperties = { ...smallBtn, border: 'none', background: '#1d4ed8', color: 'white' }
const smallDead: CSSProperties = { ...smallBtn, border: 'none', background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'not-allowed' }
const bigBlue: CSSProperties = { ...S.hereBtn, width: '100%' }
const bigPlain: CSSProperties = { ...S.secondaryBtn, width: '100%' }
const deadPress: CSSProperties = { ...S.hereBtn, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'not-allowed' }
const grid: CSSProperties = { display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${TILE}px, 1fr))`, gap: '0.75rem 0.6rem' }
const tileBtn: CSSProperties = { display: 'grid', gap: 3, padding: 0, border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'var(--text-700)', minWidth: 0 }
const thumbBox: CSSProperties = { position: 'relative', aspectRatio: '4 / 3', width: '100%', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-muted)', overflow: 'hidden', display: 'block' }
const tileName: CSSProperties = { fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const tileUnnamed: CSSProperties = { ...tileName, fontWeight: 400, color: 'var(--text-muted)' }
const tileWho: CSSProperties = { fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const waitChip: CSSProperties = { position: 'absolute', left: 4, bottom: 4, fontSize: '0.65rem', fontWeight: 700, borderRadius: 999, padding: '1px 7px', background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' }
const hold: CSSProperties = { ...S.warn, margin: 0, display: 'grid', gap: 4 }
const where: CSSProperties = { padding: '0.55rem 0.7rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-subtle)', fontSize: '0.8125rem', color: 'var(--text-700)', display: 'grid', gap: 3 }
const wherePath: CSSProperties = { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.78rem', color: 'var(--text-strong)', overflowWrap: 'anywhere' }
const shotCard: CSSProperties = { display: 'grid', gridTemplateColumns: '96px 1fr', gap: '0.7rem', alignItems: 'start', padding: '0.6rem', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-subtle)' }
const shotImg: CSSProperties = { width: 96, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', display: 'block', background: 'var(--bg-muted)' }
const nameBox: CSSProperties = { width: '100%', minHeight: 40, padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-strong)', fontSize: '0.9375rem', fontFamily: 'inherit', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text-base)' }
const quiet: CSSProperties = { padding: 0, border: 'none', background: 'transparent', color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.78rem', fontWeight: 600, minHeight: 32, textAlign: 'left' }
const dropZone: CSSProperties = { border: '2px dashed var(--border-strong)', borderRadius: 10, padding: '1rem 0.75rem', textAlign: 'center', color: 'var(--text-700)', background: 'var(--bg-subtle)', display: 'grid', gap: 8, justifyItems: 'center', fontSize: '0.875rem' }
const dropOver: CSSProperties = { ...dropZone, borderColor: '#2563eb', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)' }
const dropVeil: CSSProperties = { position: 'absolute', inset: 0, zIndex: 2, borderRadius: 10, border: '2px dashed #2563eb', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)', opacity: 0.94, display: 'grid', placeItems: 'center', alignContent: 'center', gap: 8, fontSize: '1rem', pointerEvents: 'none' }
const TONE: Record<'quiet' | 'busy' | 'good' | 'warn', CSSProperties> = {
  quiet: { color: 'var(--text-muted)' },
  busy: { color: 'var(--text-blue-700)', fontWeight: 600 },
  good: { color: 'var(--text-green-700)', fontWeight: 600 },
  warn: { color: 'var(--text-amber-800)', fontWeight: 600 },
}

export interface BidPhotosPanelInput {
  bid: BidPhotosWindowBid
  onClose: () => void
  onChanged?: () => void
  io?: BidPhotosWindowIo
  /** False while the photos are folded away in the bid's Files window: nothing is read and no camera is held. */
  enabled?: boolean
  /** The bid's name over the photos. A host that names the bid itself leaves it out. */
  showLabel?: boolean
}

/** The photos as a host window draws them: its title, what goes in it, and its foot. */
export interface BidPhotosPanel {
  title: string
  /** One photo is open at full size: the host shows it alone. */
  viewing: boolean
  body: ReactNode
  footer: ReactNode
  /** Close the window, dropping any photo picked and not added. */
  close: () => void
}

/** One set of rules and one read, whichever window draws the photos. */
export function useBidPhotosPanel({ bid, onClose, onChanged, io: ioProp, enabled = true, showLabel = true }: BidPhotosPanelInput): BidPhotosPanel {
  const io = useMemo(() => ioProp ?? supabaseBidPhotosWindowIo(), [ioProp])
  const { showToast } = useToastContext()
  const { user, profileName, readOnly } = useAuth()
  const authUserId = user?.id ?? null
  const phone = useNarrowViewport640()

  const [read, setRead] = useState<BidPhotosRead | null>(null)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [tick, setTick] = useState(0)
  const [adding, setAdding] = useState(false)
  const [held, setHeld] = useState<HeldFile[]>([])
  const [over, setOver] = useState(false)
  const [open, setOpen] = useState<number | null>(null)
  const pickRef = useRef<HTMLInputElement>(null)
  const changedRef = useRef(onChanged)
  changedRef.current = onChanged

  const host = useShotTileEngine<BidPhotoTile>({
    open: enabled,
    jobId: bid.id,
    authUserId,
    byName: profileName?.trim() || '',
    cameraFirst: phone,
    io: io.shots,
    // The engine's own folder read is a job's; the bid's comes with the window's read.
    jobHasFolder: read?.folder ? read.folder.kind === 'ready' : null,
    tile: (base) => ({ ...base, name: '' }),
    multiple: true,
    // No shot is kept on the phone yet: a send lost to the signal keeps its tile with Retry.
    sendErrorName: 'BidPhotoKeptLater',
    noJobWords: 'That bid is gone.',
    pickedAt: (file) => fileTimeOrNow(file),
    testId: 'bid-photos-camera',
  })

  useEffect(() => {
    if (!enabled) return
    let live = true
    setFailure(null)
    io.load(bid.id).then(
      (r) => {
        if (!live) return
        setRead(r)
        // The read took pictures on from the Drive folder: the board's count is behind until it reads again.
        if (r.adopted > 0) changedRef.current?.()
      },
      (e: unknown) => live && setFailure(recoveryFailureFromError(e, 'The bid’s photos did not read.')),
    )
    return () => {
      live = false
    }
  }, [io, bid.id, tick, enabled])

  const photos = useMemo(() => newestFirst(read?.photos ?? []), [read])
  const today = todayYmdInAppTz()
  const press = addPress({ tiles: host.tiles, adding, folder: read?.folder ?? null })
  const whereLine = whereWords(read?.folder ?? null, host.tiles.length)
  const folderUrl = read?.folder?.photosUrl ?? read?.folder?.projectUrl ?? null
  const waiting = photos.filter((p) => !p.filed_at).length
  const holdWhy = read?.folder?.hold ?? null
  const heldLine = heldFilesWords(held)
  const canAdd = !readOnly

  /** Files from a pick or a drop: the pictures go to the engine through its own handler, the rest are named. */
  const hand = useCallback(
    (files: File[]) => {
      const sorted = sortPickedFiles(files)
      setHeld(sorted.held)
      if (sorted.photos.length === 0) return
      host.inputProps.onChange({ target: { files: sorted.photos, value: '' } } as unknown as ChangeEvent<HTMLInputElement>)
    },
    [host.inputProps],
  )

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    hand(files)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setOver(false)
    if (!canAdd) return
    hand(Array.from(e.dataTransfer?.files ?? []))
  }

  const close = useCallback(() => {
    if (host.tiles.length) host.drop()
    onClose()
  }, [host, onClose])

  async function add() {
    if (press.dead) return
    setAdding(true)
    try {
      const writes = addWrites(host.tiles)
      const out = await io.add(writes)
      const failed = new Set(out.failedIds)
      host.clear(writes.map((w) => w.id).filter((id) => !failed.has(id)))
      const words = addedWords(out)
      showToast(words.text, words.tone)
      if (out.added > 0) {
        setHeld([])
        setTick((t) => t + 1)
        onChanged?.()
      }
    } finally {
      setAdding(false)
    }
  }

  const pickFiles = () => pickRef.current?.click()
  const openRow = open != null ? photos[open] : null

  const footer = openRow ? (
    <div style={S.footerRow}>
      <button type="button" style={S.secondaryBtn} onClick={() => setOpen(null)}>
        Back to the photos
      </button>
      <span style={{ display: 'flex', gap: '0.5rem' }}>
        {open != null && open > 0 ? (
          <button type="button" style={S.secondaryBtn} onClick={() => setOpen(open - 1)} aria-label="The photo before">
            ‹
          </button>
        ) : null}
        {open != null && open < photos.length - 1 ? (
          <button type="button" style={S.secondaryBtn} onClick={() => setOpen(open + 1)} aria-label="The next photo">
            ›
          </button>
        ) : null}
        {openRow.drive_file_id ? (
          <button type="button" style={S.secondaryBtn} onClick={() => openInExternalBrowser(drivePhotoUrl(openRow.drive_file_id as string))}>
            {BID_PHOTO_WORDS.openFolder}
          </button>
        ) : null}
      </span>
    </div>
  ) : host.tiles.length ? (
    <div style={{ ...S.footerRow, alignItems: 'center', flexWrap: 'wrap' }}>
      <button type="button" style={S.quietLink} onClick={() => (phone ? host.openCamera() : pickFiles())}>
        {phone ? BID_PHOTO_WORDS.takeAnother : BID_PHOTO_WORDS.pickMore}
      </button>
      <span style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="button" style={S.secondaryBtn} onClick={close}>
          {BID_PHOTO_WORDS.cancel}
        </button>
        <button type="button" style={press.dead ? deadPress : S.hereBtn} disabled={press.dead} onClick={() => void add()} data-bid-photos-add={press.dead ? 'dead' : 'live'}>
          {press.label}
        </button>
      </span>
    </div>
  ) : (
    <div style={{ ...S.footerRow, justifyContent: 'flex-end' }}>
      <button type="button" style={S.secondaryBtn} onClick={close}>
        Close
      </button>
    </div>
  )

  const addControls = !canAdd ? (
    <p style={sub}>{BID_PHOTO_WORDS.trainingWhy}</p>
  ) : phone ? (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      <button type="button" style={bigBlue} onClick={() => host.openCamera()}>
        {BID_PHOTO_WORDS.take}
      </button>
      <button type="button" style={bigPlain} onClick={pickFiles}>
        {BID_PHOTO_WORDS.pick}
      </button>
    </div>
  ) : (
    <div style={over ? dropOver : dropZone} data-bid-photos-drop={over ? 'over' : 'idle'}>
      <b>{BID_PHOTO_WORDS.drop}</b>
      <button type="button" style={smallBlue} onClick={pickFiles}>
        Pick files
      </button>
      <span style={{ ...sub, fontSize: '0.78rem' }}>Photos are made smaller before they go up.</span>
    </div>
  )

  const body = (
      <div
        data-bid-photos-window={bid.id}
        style={{ display: 'grid', gap: '0.75rem', position: 'relative' }}
        onDragOver={(e) => {
          if (!canAdd || phone) return
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <input {...host.inputProps} />
        {over && canAdd && !openRow && photos.length > 0 ? (
          <div style={dropVeil} data-bid-photos-drop="over" aria-hidden>
            <CameraGlyph size={28} />
            <b>{BID_PHOTO_WORDS.drop}</b>
          </div>
        ) : null}
        <input ref={pickRef} type="file" accept="image/*" multiple onChange={onPick} tabIndex={-1} aria-hidden style={{ display: 'none' }} data-testid="bid-photos-pick" />

        {openRow ? (
          <div data-bid-photo-open={openRow.id} style={{ display: 'grid', gap: '0.5rem', justifyItems: 'center' }}>
            <BidPhotoFull bidId={bid.id} row={openRow} preview={read?.previews[openRow.id] ?? null} io={io} />
            <p style={sub}>{[gridTileWords(openRow, today).who, gridTileWords(openRow, today).waiting].filter(Boolean).join(' · ')}</p>
            {!openRow.filed_at && openRow.fail_why ? <p style={{ ...sub, color: 'var(--text-amber-800)' }}>{openRow.fail_why}</p> : null}
          </div>
        ) : (
          <>
            {showLabel ? <p style={sub}>{bid.label}</p> : null}

            {holdWhy && (waiting > 0 || host.tiles.length > 0) ? (
              <div style={hold} role="status" data-bid-photos-hold="">
                <b>{waiting > 0 ? 'The photos are safe in the app. They are not in Drive yet.' : 'New photos will wait in the app before they reach Drive.'}</b>
                <span>{holdWhy}</span>
              </div>
            ) : null}
            {read?.driveWhy ? (
              <p style={{ ...S.warn, margin: 0 }} role="status" data-bid-photos-drive-silent="">
                {driveSilentWords(read.driveWhy)}
              </p>
            ) : null}

            {host.tiles.length ? (
              <section aria-label="New photos" style={{ display: 'grid', gap: '0.6rem' }}>
                {host.tiles.map((t) => {
                  const words = tileStatusWords(t)
                  return (
                    <div key={t.id} style={shotCard} data-shot-tile={t.status}>
                      <img src={t.previewUrl} alt="" style={shotImg} />
                      <div style={{ display: 'grid', gap: '0.35rem', minWidth: 0 }}>
                        <label style={{ display: 'grid', gap: 3 }}>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)' }}>
                            {BID_PHOTO_WORDS.nameLabel} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· {BID_PHOTO_WORDS.optional}</span>
                          </span>
                          <input type="text" value={t.name} maxLength={BID_PHOTO_NAME_MAX} onChange={(e) => host.edit(t.id, (tile) => ({ ...tile, name: e.target.value }))} style={nameBox} data-shot-name={t.id} />
                        </label>
                        <div style={{ fontSize: '0.78rem', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={TONE[words.tone]}>{words.text}</span>
                          {t.status === 'failed' ? (
                            <button type="button" style={quiet} onClick={() => host.retry(t.id)}>
                              {BID_PHOTO_WORDS.retry}
                            </button>
                          ) : null}
                          <button type="button" style={quiet} onClick={() => host.remove(t.id)}>
                            {BID_PHOTO_WORDS.remove}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {whereLine ? (
                  <div style={where} data-bid-photos-where="">
                    <span>{whereLine.lead}</span>
                    <span style={wherePath}>{whereLine.path}</span>
                  </div>
                ) : null}
              </section>
            ) : null}
            {heldLine ? (
              <p style={{ ...S.warn, margin: 0 }} role="status" data-bid-photos-held="">
                {heldLine}
              </p>
            ) : null}

            {failure ? (
              <OfflineRetryPanel failure={failure} onRetry={() => setTick((t) => t + 1)} surface="bid-photos" idempotent />
            ) : read == null ? (
              <p style={sub}>{BID_PHOTO_WORDS.reading}</p>
            ) : photos.length === 0 ? (
              host.tiles.length ? null : (
                <div style={{ display: 'grid', gap: '0.6rem' }}>
                  {canAdd ? (
                    <EmptyState {...emptyWordsWithPress(emptyWords({ kind: 'make', noun: 'photos on this bid', control: phone ? BID_PHOTO_WORDS.take : BID_PHOTO_WORDS.add }), { onPress: () => (phone ? host.openCamera() : pickFiles()) })} compact />
                  ) : (
                    <EmptyState main="No photos on this bid yet." compact />
                  )}
                  {addControls}
                  {whereWords(read.folder, 2) && read.folder?.kind !== 'ready' ? <p style={{ ...sub, fontSize: '0.8125rem', textAlign: 'center' }}>The first photo makes the folder: {whereWords(read.folder, 2)?.path}</p> : null}
                </div>
              )
            ) : (
              <>
                <div style={headRow}>
                  <span style={headCount}>{gridHeadWords(photos)}</span>
                  <span style={{ ...sub, fontSize: '0.8125rem' }}>newest first</span>
                  <span style={{ flex: 1 }} />
                  {folderUrl ? (
                    <button type="button" style={smallBtn} onClick={() => openInExternalBrowser(folderUrl)}>
                      {BID_PHOTO_WORDS.openFolder}
                    </button>
                  ) : null}
                  {host.tiles.length === 0 && !phone ? (
                    <button type="button" style={canAdd ? smallBlue : smallDead} disabled={!canAdd} title={canAdd ? undefined : BID_PHOTO_WORDS.trainingWhy} onClick={pickFiles} data-bid-photos-add-more="">
                      {BID_PHOTO_WORDS.add}
                    </button>
                  ) : null}
                </div>
                {host.tiles.length === 0 && phone ? addControls : null}
                <div style={grid}>
                  {photos.map((row, index) => {
                    const words = gridTileWords(row, today)
                    return (
                      <button key={row.id} type="button" style={tileBtn} onClick={() => setOpen(index)} aria-label={`${words.name} · ${words.who}: open the photo`} data-bid-photo-tile={row.id}>
                        <span style={thumbBox}>
                          <BidPhotoThumb bidId={bid.id} row={row} preview={read.previews[row.id] ?? null} io={io} />
                          {words.waiting ? (
                            <span style={waitChip} title={row.fail_why ?? undefined}>
                              {words.waiting}
                            </span>
                          ) : null}
                        </span>
                        <span style={words.unnamed ? tileUnnamed : tileName}>{words.name}</span>
                        <span style={tileWho}>{words.who}</span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
  )

  return { title: openRow ? openRow.name || BID_PHOTO_WORDS.plainName : BID_PHOTO_WORDS.title, viewing: Boolean(openRow), body, footer, close }
}
