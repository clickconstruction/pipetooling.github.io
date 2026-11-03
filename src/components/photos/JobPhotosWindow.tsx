/**
 * The Job photos window (punch list #244, PR 3): one window with two faces, four doors into it (the Pipeline row's
 * camera icon, the phone card's ⋯ sheet, and from PR 4 the Job Mode card's Photos line and the job window's Photos
 * section). It opens on what is there: the job's photos by day, newest first, the words under each, a search box and
 * the source chips when the job's photos came through more than one door; **Add a photo** is the first tile. A chosen
 * photo (several at a desk; the camera on a phone for the field roles) is a tile at the top in the report form's
 * shape with the one thing the report form does not ask under it, *What does this show?*, and the stage chips; the
 * press reads *Add 2 photos to the job* and writes the words, the stage and `added_at` on each row. A tile opens the
 * Documents page's viewer with the words as its title and *Edit the words* for the taker and the office.
 *
 * Drive is the list and our rows are the words: the grid reads the view's rows for the job (every source) and lays
 * them over the job's Drive photo folders as the job window's strip reads them (`job-photos` → list), so a file put
 * in the folder by hand shows too, read by its file name. A read that fails draws `OfflineRetryPanel` with the
 * reason; an empty job names the press. The rules are `lib/photos/jobPhotoNotes.ts`.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import ResponsiveModalShell from '../ResponsiveModalShell'
import * as S from '../jobMode/sheetStyles'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { EmptyState } from '../EmptyState'
import { CameraGlyph } from '../materials/PhotoPress'
import { UploadedPhotoTile } from '../documents/UploadedPhotoTile'
import { UploadedPhotoViewer } from '../documents/UploadedPhotoViewer'
import { useAuth } from '../../hooks/useAuth'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { useJobLineProgress } from '../../hooks/useJobLineProgress'
import { useShotTiles, type ShotStage } from '../../hooks/useShotTiles'
import { useToastContext } from '../../contexts/ToastContext'
import { canLeaveJobFieldReport } from '../../lib/canLeaveJobFieldReport'
import { driveFolderIdFromUrl } from '../../lib/jobs/jobDriveFolders'
import { jobShortLabel } from '../../lib/plans/planSets'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { formatErrorMessage } from '../../utils/errorHandling'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import type { JobPhotosRead } from '../../lib/photos/jobPhotos'
import { captionWords, dayGroups, jobWindowPath, threadPath, timeWords, type SourcePick, type UploadedPhotoRow } from '../../lib/photos/uploadedPhotos'
import { pressThroughOutbox } from '../../lib/offline/pressThroughOutbox'
import { supabaseJobPhotosWindowIo, type JobPhotosWindowIo } from '../../lib/photos/jobPhotoNotesIo'
import {
  JOB_PHOTO_DESCRIPTION_MAX,
  JOB_PHOTO_WORDS,
  addPress,
  addWrites,
  addedWords,
  canEditJobPhotoWords,
  descriptionTrimmed,
  gridBySource,
  gridChips,
  gridFootWords,
  gridItems,
  gridNarrowed,
  gridSearch,
  gridTileWords,
  newPhotosLine,
  offersWordsForTheRest,
  threadLineWords,
  type JobPhotoGridItem,
} from '../../lib/photos/jobPhotoNotes'

export interface JobPhotosWindowJob {
  id: string
  hcp_number?: string | null
  click_number?: string | null
  job_name?: string | null
  job_address?: string | null
  google_drive_link?: string | null
  job_pictures_link?: string | null
}

export type { JobPhotosWindowIo } from '../../lib/photos/jobPhotoNotesIo'

const TILE = 104
const sub: CSSProperties = { margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }
const search: CSSProperties = { width: '100%', minHeight: 44, padding: '0.5rem 0.75rem', borderRadius: 8, border: '1px solid var(--border-strong)', fontSize: '0.9375rem', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text-base)' }
const chipRow: CSSProperties = { display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }
const chip: CSSProperties = { minHeight: 36, padding: '0 0.8rem', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit' }
const chipOn: CSSProperties = { ...chip, border: '2px solid #2563eb', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)' }
const dayLabel: CSSProperties = { margin: '0.25rem 0 0', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const grid: CSSProperties = { display: 'grid', gridTemplateColumns: `repeat(auto-fill, ${TILE}px)`, gap: '0.75rem 0.6rem' }
const tileBtn: CSSProperties = { display: 'grid', gap: 4, width: TILE, padding: 0, border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'var(--text-700)' }
const tileWordsStyle: CSSProperties = { fontSize: '0.75rem', lineHeight: 1.3, color: 'var(--text-strong)', fontWeight: 600, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }
const tileNone: CSSProperties = { ...tileWordsStyle, color: 'var(--text-muted)', fontWeight: 400, fontStyle: 'italic' }
const tileWho: CSSProperties = { fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const addTile: CSSProperties = { width: TILE, height: TILE, borderRadius: 8, border: '2px dashed var(--border-strong)', background: 'var(--bg-subtle)', color: 'var(--text-link)', display: 'grid', placeItems: 'center', alignContent: 'center', gap: 4, fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' }
const foot: CSSProperties = { margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }
const shotCard: CSSProperties = { display: 'grid', gridTemplateColumns: '112px 1fr', gap: '0.75rem', alignItems: 'start', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-subtle)' }
const shotCardPhone: CSSProperties = { ...shotCard, gridTemplateColumns: '1fr' }
const shotImg: CSSProperties = { width: 112, height: 112, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)', display: 'block', background: 'var(--bg-muted)' }
const shotImgPhone: CSSProperties = { ...shotImg, width: '100%', height: 180 }
const meta: CSSProperties = { fontSize: '0.72rem', lineHeight: 1.3, color: 'var(--text-muted)', marginTop: 4 }
const quiet: CSSProperties = { padding: 0, border: 'none', background: 'transparent', color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.78rem', fontWeight: 600, minHeight: 32, textAlign: 'left' }
const label: CSSProperties = { margin: 0, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)' }
const box: CSSProperties = { width: '100%', minHeight: 56, padding: '0.5rem 0.65rem', borderRadius: 6, border: '1px solid var(--border-strong)', fontSize: '0.9375rem', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical', background: 'var(--surface)', color: 'var(--text-base)' }
const ask: CSSProperties = { padding: '0.6rem 0.7rem', borderRadius: 10, background: 'var(--bg-blue-tint)', border: '1px solid var(--border-blue)', display: 'grid', gap: 6 }
const stageChip: CSSProperties = { minHeight: 48, padding: '0 0.9rem', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer', fontFamily: 'inherit' }
const stageChipOn: CSSProperties = { ...stageChip, border: '2px solid #2563eb', background: 'var(--surface)', color: 'var(--text-blue-700)' }
const deadPress: CSSProperties = { ...S.hereBtn, background: 'var(--bg-200)', color: 'var(--text-muted)', cursor: 'not-allowed' }

export function JobPhotosWindow({ job, onClose, onOpenJob, io: ioProp }: { job: JobPhotosWindowJob; onClose: () => void; onOpenJob?: () => void; io?: JobPhotosWindowIo }) {
  const io = useMemo(() => ioProp ?? supabaseJobPhotosWindowIo(), [ioProp])
  const navigate = useNavigate()
  const { showToast } = useToastContext()
  const { user, role, profileName } = useAuth()
  const authUserId = user?.id ?? null
  const phone = useNarrowViewport640()
  const cameraFirst = phone && canLeaveJobFieldReport(role)
  // A door without the job's row (the Job Mode card, PR 4) hands no links: the window reads them once.
  const linksKnown = job.google_drive_link !== undefined || job.job_pictures_link !== undefined
  const [readLinks, setReadLinks] = useState<{ drive: string | null; pictures: string | null } | null>(null)
  useEffect(() => {
    if (linksKnown) return
    let live = true
    setReadLinks(null)
    io.links(job.id).then(
      (l) => live && setReadLinks({ drive: l?.google_drive_link ?? null, pictures: l?.job_pictures_link ?? null }),
      () => live && setReadLinks({ drive: null, pictures: null }),
    )
    return () => {
      live = false
    }
  }, [io, job.id, linksKnown])
  const picturesLink = linksKnown ? job.job_pictures_link : readLinks?.pictures
  const driveLink = linksKnown ? job.google_drive_link : readLinks?.drive
  const linksSettled = linksKnown || readLinks != null
  const hasFolder = Boolean(driveFolderIdFromUrl(picturesLink) || driveFolderIdFromUrl(driveLink))
  const lineProgress = useJobLineProgress(job.id, true)
  const stages: ShotStage[] = useMemo(() => (lineProgress.lines ?? []).filter((r) => !r.drawPaid).map((r) => ({ fixtureId: r.fixtureId, name: r.name })), [lineProgress.lines])
  const host = useShotTiles({ open: true, jobId: job.id, authUserId, byName: profileName?.trim() || '', cameraFirst, io: io.shots, jobHasFolder: hasFolder })

  const [rows, setRows] = useState<UploadedPhotoRow[] | null>(null)
  const [drive, setDrive] = useState<JobPhotosRead | null>(null)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [tick, setTick] = useState(0)
  const [typed, setTyped] = useState('')
  const [source, setSource] = useState<SourcePick>('all')
  const [open, setOpen] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<{ row: UploadedPhotoRow; words: string; saving: boolean; why: string | null } | null>(null)

  useEffect(() => {
    if (!linksSettled) return
    let live = true
    setFailure(null)
    setRows(null)
    Promise.all([io.rows(job.id), hasFolder ? io.drive.list(job.id).catch(() => null) : Promise.resolve(null)]).then(
      ([r, d]) => {
        if (!live) return
        setRows(r)
        setDrive(d)
      },
      (e: unknown) => live && setFailure(recoveryFailureFromError(e, 'The photos did not read.')),
    )
    return () => {
      live = false
    }
  }, [io, job.id, hasFolder, linksSettled, tick])

  const items = useMemo(() => gridItems({ rows: rows ?? [], drive: drive?.photos ?? null, job }), [rows, drive, job])
  const chips = useMemo(() => gridChips(items, role), [items, role])
  const shown = useMemo(() => gridSearch(gridBySource(items, source), typed), [items, source, typed])
  const groups = useMemo(() => dayGroups(shown.map((it) => it.row), todayYmdInAppTz()), [shown])
  const byId = useMemo(() => new Map(shown.map((it) => [it.row.id, it])), [shown])
  const narrowed = gridNarrowed({ typed, source })
  const press = addPress({ tiles: host.tiles, adding })
  const jobLabel = [jobShortLabel(job), (job.job_address ?? '').trim()].filter(Boolean).join(' · ')

  const close = useCallback(() => {
    if (host.tiles.length) host.drop()
    onClose()
  }, [host, onClose])

  async function add() {
    if (press.dead) return
    setAdding(true)
    try {
      // A shot kept on the phone with no signal (PR 5): the whole press goes through the outbox, and the replay sends
      // the kept shots first, then lands the words on every row, then writes the thread line.
      if (host.kept > 0) {
        if (!authUserId) {
          showToast('Sign in again to add the photos.', 'warning')
          return
        }
        const outcome = await pressThroughOutbox(
          { kind: 'job-photos', userId: authUserId, pressedAt: Date.now(), payload: { jobLedgerId: job.id, photos: host.queuedPhotos() }, about: jobLabel, door: jobWindowPath(job.id) },
          { forceQueue: true },
        )
        if (outcome.kind === 'queued') {
          host.markQueued()
          host.clear(host.tiles.map((t) => t.id))
          showToast(JOB_PHOTO_WORDS.queued, 'success')
        } else if (outcome.kind === 'landed') {
          host.clear(host.tiles.map((t) => t.id))
          setTick((t) => t + 1)
        } else {
          showToast(outcome.kind === 'refused' ? outcome.message : formatErrorMessage(outcome.error, 'The photos did not add.'), 'warning')
        }
        return
      }
      const writes = addWrites(host.tiles.filter((t) => t.status === 'sent'))
      const out = await io.add(writes)
      const failed = new Set(out.failedIds)
      host.clear(writes.map((w) => w.id).filter((id) => !failed.has(id)))
      const words = addedWords(out)
      showToast(words.text, words.tone)
      if (out.added > 0) {
        setTick((t) => t + 1)
        // One line on the job's thread (call 5: a thread line, no push, no email), best-effort.
        const line = threadLineWords(writes.filter((w) => !failed.has(w.id)))
        if (authUserId && line) void io.thread(job.id, authUserId, line)
      }
    } finally {
      setAdding(false)
    }
  }

  async function saveWords() {
    if (!editing || editing.saving) return
    setEditing({ ...editing, saving: true, why: null })
    try {
      const description = descriptionTrimmed(editing.words)
      await io.editWords(editing.row.id, { description, stageName: editing.row.stage_name || null })
      setRows((prev) => (prev ? prev.map((r) => (r.id === editing.row.id ? { ...r, caption: description || r.stage_name || JOB_PHOTO_WORDS.plainCaption } : r)) : prev))
      setEditing(null)
      showToast('The words are saved.', 'success')
    } catch (e) {
      setEditing((prev) => (prev ? { ...prev, saving: false, why: formatErrorMessage(e, 'The words did not save.') } : prev))
    }
  }

  /** A text's picture opens its thread; every other photo's one door is the job (`onJob` below), never a second here. */
  const openThread = (row: UploadedPhotoRow) => {
    const to = threadPath(row)
    if (!to) return
    setOpen(null)
    onClose()
    navigate(to)
  }

  const addTileWords = cameraFirst ? JOB_PHOTO_WORDS.take : JOB_PHOTO_WORDS.add
  const emptyMake = emptyWordsWithPress(emptyWords({ kind: 'make', noun: 'photos on this job', control: addTileWords }), { onPress: () => host.openCamera() })
  const folderUrl = drive?.folder.url ?? (hasFolder ? (picturesLink ?? driveLink ?? null) : null)
  const emptyFilter = emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'photos on this job', query: typed }), {
    onPress: () => {
      setTyped('')
      setSource('all')
    },
  })

  const footer = host.tiles.length ? (
    <div style={{ ...S.footerRow, alignItems: 'center' }}>
      <button type="button" style={S.quietLink} onClick={() => host.openCamera()}>
        {cameraFirst ? JOB_PHOTO_WORDS.takeAnother : JOB_PHOTO_WORDS.another}
      </button>
      <span style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="button" style={S.secondaryBtn} onClick={close}>
          {JOB_PHOTO_WORDS.cancel}
        </button>
        <button type="button" style={press.dead ? deadPress : S.hereBtn} disabled={press.dead} onClick={() => void add()} data-job-photos-add={press.dead ? 'dead' : 'live'}>
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

  return (
    <ResponsiveModalShell title={JOB_PHOTO_WORDS.title} onRequestClose={close} footer={footer} maxWidthDesktop={720} fullScreenKey="job-photos">
      <div data-job-photos-window={job.id} style={{ display: 'grid', gap: '0.75rem' }}>
        <p style={sub}>{jobLabel}</p>
        <input {...host.inputProps} />

        {host.tiles.length ? (
          <section aria-label="New photos" style={{ display: 'grid', gap: '0.75rem' }}>
            <p style={{ ...sub, fontSize: '0.8125rem' }}>{newPhotosLine({ count: host.tiles.length, longEdge: host.tiles[0]?.longEdge ?? 1600, jobHasFolder: host.jobHasFolder })}</p>
            {host.tiles.map((t) => (
              <div key={t.id} style={phone ? shotCardPhone : shotCard} data-shot-tile={t.status}>
                <div>
                  <img src={t.previewUrl} alt="" style={phone ? shotImgPhone : shotImg} />
                  <div style={meta}>
                    {t.status === 'shrinking' ? (
                      <span>{JOB_PHOTO_WORDS.shrinking}</span>
                    ) : t.status === 'sending' ? (
                      <span style={{ color: 'var(--text-blue-700)', fontWeight: 600 }}>{JOB_PHOTO_WORDS.sending}</span>
                    ) : t.status === 'sent' ? (
                      <span style={{ color: 'var(--text-green-700)', fontWeight: 600 }}>{JOB_PHOTO_WORDS.sent}</span>
                    ) : t.status === 'kept' ? (
                      <span style={{ color: 'var(--text-amber-800)', fontWeight: 600 }}>{JOB_PHOTO_WORDS.kept}</span>
                    ) : (
                      <span style={{ color: 'var(--text-amber-800)', fontWeight: 600 }}>{t.failWhy}</span>
                    )}{' '}
                    {t.status === 'failed' ? (
                      <button type="button" style={quiet} onClick={() => host.retry(t.id)}>
                        {JOB_PHOTO_WORDS.retry}
                      </button>
                    ) : null}{' '}
                    <button type="button" style={quiet} onClick={() => host.remove(t.id)}>
                      {JOB_PHOTO_WORDS.remove}
                    </button>
                  </div>
                </div>
                <div style={{ display: 'grid', gap: '0.5rem', minWidth: 0 }}>
                  <label style={{ display: 'grid', gap: 4 }}>
                    <span style={label}>
                      {JOB_PHOTO_WORDS.what} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· {JOB_PHOTO_WORDS.optional}</span>
                    </span>
                    <textarea value={t.description} maxLength={JOB_PHOTO_DESCRIPTION_MAX} onChange={(e) => host.setDescription(t.id, e.target.value)} style={box} rows={2} data-shot-words={t.id} />
                  </label>
                  {offersWordsForTheRest(host.tiles, t.id) ? (
                    <button type="button" style={quiet} onClick={() => host.useWordsForTheRest(t.id)}>
                      {JOB_PHOTO_WORDS.useForRest}
                    </button>
                  ) : null}
                  {stages.length >= 2 ? (
                    <div style={ask}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{JOB_PHOTO_WORDS.shows}</span>
                      <div style={chipRow}>
                        {stages.map((s) => (
                          <button key={s.fixtureId} type="button" style={t.fixtureId === s.fixtureId ? stageChipOn : stageChip} aria-pressed={t.fixtureId === s.fixtureId} onClick={() => host.putOnStage(t.id, t.fixtureId === s.fixtureId ? null : s)}>
                            {s.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </section>
        ) : null}

        {failure ? (
          <OfflineRetryPanel failure={failure} onRetry={() => setTick((t) => t + 1)} surface="job-photos" idempotent />
        ) : rows == null ? (
          <p style={sub}>Reading the photos…</p>
        ) : (
          <>
            {items.length > 0 ? <input type="search" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Find a photo on this job: words, a person, a stage" aria-label="Find a photo on this job" style={search} /> : null}
            {chips.length > 0 ? (
              <div style={chipRow} role="group" aria-label="Which photos">
                {chips.map((c) => (
                  <button key={c.key} type="button" style={source === c.key ? chipOn : chip} aria-pressed={source === c.key} onClick={() => setSource(c.key)}>
                    {c.label}
                  </button>
                ))}
              </div>
            ) : null}
            {shown.length === 0 ? (
              narrowed ? (
                <EmptyState {...emptyFilter} compact />
              ) : (
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  <EmptyState {...emptyMake} compact />
                  {!hasFolder ? <p style={{ ...foot, textAlign: 'center' }}>This job has no Drive folder yet. The first photo makes one.</p> : null}
                </div>
              )
            ) : (
              groups.map((g, gi) => (
                <section key={g.ymd || `none-${gi}`} aria-label={g.label} style={{ display: 'grid', gap: '0.5rem' }}>
                  <p style={dayLabel}>{g.label}</p>
                  <div style={grid}>
                    {gi === 0 && !narrowed && !host.tiles.length ? (
                      <button type="button" style={addTile} onClick={() => host.openCamera()} data-job-photos-add-tile="">
                        <CameraGlyph size={26} />
                        {addTileWords}
                      </button>
                    ) : null}
                    {g.rows.map((row) => {
                      const it = byId.get(row.id) as JobPhotoGridItem
                      const words = gridTileWords(it)
                      const index = shown.findIndex((x) => x.row.id === row.id)
                      return (
                        <button key={row.id} type="button" style={tileBtn} onClick={() => setOpen(index)} aria-label={`${words.text} · ${words.who}: open the photo`} data-job-photo-tile={row.id}>
                          <UploadedPhotoTile row={row} io={io.photos} size={TILE} />
                          <span style={words.none ? tileNone : tileWordsStyle}>{words.text}</span>
                          <span style={tileWho}>{[words.who, timeWords(row.taken_at)].filter(Boolean).join(' · ')}</span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              ))
            )}
            {items.length > 0 ? (
              <p style={foot}>
                {gridFootWords({ count: items.length, hand: items.filter((it) => it.hand).length, folderKind: drive?.folder.kind ?? null })}
                {folderUrl ? (
                  <>
                    {' · '}
                    <button type="button" style={{ ...quiet, fontSize: '0.8125rem' }} onClick={() => openInExternalBrowser(folderUrl)}>
                      Open the folder ↗
                    </button>
                  </>
                ) : null}
              </p>
            ) : null}
          </>
        )}
      </div>

      {open != null && shown[open] ? (
        <UploadedPhotoViewer
          rows={shown.map((it) => it.row)}
          index={open}
          io={io.photos}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          onJob={
            onOpenJob
              ? () => {
                  setOpen(null)
                  onOpenJob()
                }
              : null
          }
          onSource={shown[open]?.row.source === 'message' && threadPath(shown[open]!.row) ? openThread : null}
          onPerson={(name) => {
            setOpen(null)
            setTyped(name)
          }}
          titleOf={(row) => captionWords(row)}
          onEditWords={
            shown[open]?.hand || !canEditJobPhotoWords({ role, byUserId: shown[open]?.row.by_user_id ?? null, authUserId })
              ? null
              : (row) => {
                  setOpen(null)
                  setEditing({ row, words: row.caption === row.stage_name || row.caption === JOB_PHOTO_WORDS.plainCaption ? '' : row.caption, saving: false, why: null })
                }
          }
        />
      ) : null}

      {editing ? (
        <ResponsiveModalShell
          title="Edit the words"
          onRequestClose={() => setEditing(null)}
          maxWidthDesktop={520}
          zIndex={1300}
          footer={
            <div style={{ ...S.footerRow, justifyContent: 'flex-end' }}>
              <button type="button" style={S.secondaryBtn} onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="button" style={editing.saving ? deadPress : S.hereBtn} disabled={editing.saving} onClick={() => void saveWords()}>
                {editing.saving ? 'Saving…' : 'Save the words'}
              </button>
            </div>
          }
        >
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={label}>{JOB_PHOTO_WORDS.what}</span>
            <textarea value={editing.words} maxLength={JOB_PHOTO_DESCRIPTION_MAX} onChange={(e) => setEditing({ ...editing, words: e.target.value })} style={box} rows={3} autoFocus data-edit-words="" />
            <span style={foot}>The Drive file takes the new words on the sweep’s next pass.</span>
            {editing.why ? <span style={{ ...foot, color: 'var(--text-amber-800)' }}>{editing.why}</span> : null}
          </label>
        </ResponsiveModalShell>
      ) : null}
    </ResponsiveModalShell>
  )
}

export default JobPhotosWindow
