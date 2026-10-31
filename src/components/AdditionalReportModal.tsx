import { useState, useEffect, useLayoutEffect, useRef, type ChangeEvent, type CSSProperties, type ReactNode } from 'react'
import { Folder, Images } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import { useAuth, type UserRole } from '../hooks/useAuth'
import { useToastContext } from '../contexts/ToastContext'
import {
  additionalReportModalBlueChipTemplate,
  additionalReportModalTemplateChipLabel,
  findStatusReportTemplateId,
  isJobCompleteTemplateName,
} from '../lib/reportTemplateDisplayName'
import { isTurnawayTemplateName } from '../lib/turnaway'
import AutoGrowTextarea from './AutoGrowTextarea'
import OfflineRetryPanel from './OfflineRetryPanel'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../lib/offlineRecoveryState'
import { fieldValueForSubmit, percentFieldValueForSubmit } from '../lib/reportTemplateFieldDisplay'
import { reportSaysJobComplete } from '../lib/reportReadyToBillPrompt'
import { propagateReportPctToJob } from '../lib/propagateReportPctToJob'
import { validateReportSignatureDataUrlForSubmit } from '../lib/reportSignatureField'
import { openInExternalBrowser } from '../lib/openInExternalBrowser'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { ReportTemplatePercentField } from './ReportTemplatePercentField'
import { ReportLinesProgressField } from './ReportLinesProgressField'
import { ReportVoiceNote } from './reports/ReportVoiceNote'
import { DraftedMark, HeardFold } from './reports/VoiceDraftBits'
import { useReportVoiceDraft } from '../hooks/useReportVoiceDraft'
import { REPORT_FIELD_LABEL_STAGE_PROGRESS } from '../lib/reports/stageProgressReport'
import { MARK_EACH_LINE_LINK, lineProgressFieldValue } from '../lib/reports/lineProgressReport'
import { fieldPctStartValue } from '../lib/jobs/fieldPctUpdate'
import { canLeaveJobFieldReport } from '../lib/canLeaveJobFieldReport'
import { useNarrowViewport640 } from '../hooks/useNarrowViewport640'
import { ReportPhotoTiles, StageRowPhotos, type ReportPhotoStage } from './reports/ReportPhotoTiles'
import {
  REPORT_PHOTO_WORDS,
  newPhotoId,
  newPhotoLine,
  photosInFlight,
  photosSentence,
  reportPhotoCaption,
  reportSaveWords,
  sentTiles,
  tilesOnStage,
  type ReportPhotoTile,
} from '../lib/photos/reportPhotos'
import { attachReportPhotos, discardReportPhotos, loadReportPhotoSize, sendReportPhoto } from '../lib/photos/reportPhotosIo'
import { edgeFor, shrinkReportPhoto, shrinkWords, withinCap, type ReportPhotoSize } from '../lib/photos/shrink'
import { STAGE_PCT_WORDS } from '../lib/reports/stagePct'
import { stampMovedLines, useJobLineProgress } from '../hooks/useJobLineProgress'
import { pressThroughOutbox } from '../lib/offline/pressThroughOutbox'
import { KEPT_ON_PHONE_WORDS } from '../lib/offline/pendingSession'
import { reportIdOf } from '../lib/offline/afterLanding'
import { ReportTemplateSignatureField } from './ReportTemplateSignatureField'
import { MarkJobReadyToBillPrompt } from './jobs/MarkJobReadyToBillPrompt'
import JobReportsModal from './JobReportsModal'
import { stripAddressZip } from '../lib/dashboardScheduleCardLines'
import { STICKY_MODAL_CLOSE_BUTTON_STYLE, stickyModalHeaderStyle, stickyModalPanelStyle } from '../lib/stickyModalHeaderStyle'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../lib/deadPress'

type ReportTemplate = Database['public']['Tables']['report_templates']['Row']
type ReportTemplateField = Database['public']['Tables']['report_template_fields']['Row']

const TOAST_NO_CUSTOMER_FILES =
  "Customer Files isn't linked for this job yet. Contact Dispatch to have it added."

const TOAST_NO_CUSTOMER_PICTURES =
  "Customer Pictures isn't linked for this job yet. Contact Dispatch to have it added."

/** Placeholder nudges for the stock template questions (v2.1554); unknown labels get none. */
const REPORT_FIELD_PLACEHOLDERS: Record<string, string> = {
  'What is the status of the job?': 'What got done, what\u2019s blocking\u2026',
  'What needs to be done to get to the next stage?': 'Parts, trades, or a return visit\u2026',
}

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  /** Invoked after a report is saved from the nested Job Reports UI (Dashboard refreshes assigned-job nag state). */
  onReportSaved?: () => void
  authUserId: string | null
  userRole?: UserRole | null
  jobId: string
  hcpNumber: string
  jobName: string
  jobAddress: string
  /** Backdrop stacking; clock-out review uses 1000+ so nested leave-report must stack above it. */
  overlayZIndex?: number
}

export default function AdditionalReportModal({
  open,
  onClose,
  onSaved,
  onReportSaved,
  authUserId,
  userRole,
  jobId,
  hcpNumber,
  jobName,
  jobAddress,
  overlayZIndex = 765,
}: Props) {
  const { profileName } = useAuth()
  const { showToast } = useToastContext()
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [templateFields, setTemplateFields] = useState<Record<string, ReportTemplateField[]>>({})
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Last save failure with its class; the panel offers Retry only for a network failure. */
  const [submitFailure, setSubmitFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [showJobReportsModal, setShowJobReportsModal] = useState(false)
  const [jobLinksLoading, setJobLinksLoading] = useState(false)
  const [customerFilesUrl, setCustomerFilesUrl] = useState('')
  const [customerPicturesUrl, setCustomerPicturesUrl] = useState('')
  /** The job's number on record, as the card shows it (punch list #189, PR 5a): the percent opens on it, not on 0. */
  const [jobPctSeed, setJobPctSeed] = useState<number | null>(null)
  // The camera-first report (punch list #189, PR 5b): on a phone, for the roles that file from the field, the press
  // opens the camera and the shots are tiles over the form; the office's size, and the stage the next shot lands on.
  const phone = useNarrowViewport640()
  const cameraFirst = phone && canLeaveJobFieldReport(userRole)
  const [tiles, setTiles] = useState<ReportPhotoTile[]>([])
  const [photoSize, setPhotoSize] = useState<ReportPhotoSize>('medium')
  const [lastShrink, setLastShrink] = useState<string | null>(null)
  const [showOtherTypes, setShowOtherTypes] = useState(false)
  const [showWhatIsNext, setShowWhatIsNext] = useState(false)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const cameraStageRef = useRef<ReportPhotoStage | null>(null)
  const cameraOpenedRef = useRef(false)
  const originalsRef = useRef<Map<string, File>>(new Map())
  const urlsRef = useRef<string[]>([])
  const attachedRef = useRef(false)
  const [readyToBillJob, setReadyToBillJob] = useState<{ id: string; hcpNumber: string; jobName: string } | null>(null)
  // Report by line (punch list #130, v2.5663): the job's priced lines, two or more; null = the plain slider.
  const lineProgress = useJobLineProgress(jobId, open)
  // Talk it through drafts the report (punch list #186, item 1, v2.5916): Notes and the named lines, marked until touched.
  const voiceDraft = useReportVoiceDraft({ fields: templateFields[selectedTemplateId] ?? [], jobName: jobName, lineProgress, setFieldValues })
  const linesActive = lineProgress.lines != null
  const percentFieldLabel = (templateFields[selectedTemplateId] ?? []).find((f) => f.input_type === 'percent_0_100')?.label ?? null
  // The percent the report files: what the lines say once something moved; until then the job's own number.
  const lineDerivedPct = linesActive ? (lineProgress.moved.length > 0 ? lineProgress.derivedPct : (lineProgress.recordedPct ?? lineProgress.derivedPct)) : null
  useEffect(() => {
    if (lineDerivedPct == null || !percentFieldLabel) return
    const next = String(lineDerivedPct)
    setFieldValues((prev) => (prev[percentFieldLabel] === next ? prev : { ...prev, [percentFieldLabel]: next }))
  }, [lineDerivedPct, percentFieldLabel])
  // The whole-job percent opens on the job's number (the card's follow-up: an untouched Save on a one-line job wrote 0).
  // Only an untouched field is seeded, so a tech's pick is never overwritten by a late read.
  useEffect(() => {
    if (!open || jobPctSeed == null || !percentFieldLabel || linesActive) return
    const seed = String(jobPctSeed)
    setFieldValues((prev) => (prev[percentFieldLabel] === undefined ? { ...prev, [percentFieldLabel]: seed } : prev))
  }, [open, jobPctSeed, percentFieldLabel, linesActive])

  // Escape closes the form as its Close does (v2.5691). The job window underneath ignores Escape while the form is
  // up (`detailEscBlocked`), so the key answered nothing here; a layer above the form that handles Escape itself
  // marks the event handled first and is left alone.
  const closeRef = useRef<() => void>(() => undefined)
  closeRef.current = handleClose
  useEffect(() => {
    if (!open) return
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape' || ev.defaultPrevented) return
      ev.preventDefault()
      closeRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  useEffect(() => {
    if (!open) {
      setJobLinksLoading(false)
      setCustomerFilesUrl('')
      setCustomerPicturesUrl('')
      setJobPctSeed(null)
      return
    }
    let cancelled = false
    setJobLinksLoading(true)
    ;(async () => {
      try {
        const data = await withSupabaseRetry(
          async () =>
            await supabase
              .from('jobs_ledger')
              .select('google_drive_link, job_pictures_link, pct_complete, status')
              .eq('id', jobId)
              .maybeSingle(),
          'AdditionalReportModal job customer links',
        )
        if (cancelled) return
        const row =
          data && typeof data === 'object' && data !== null
            ? (data as { google_drive_link?: string | null; job_pictures_link?: string | null; pct_complete?: number | null; status?: string | null })
            : null
        setCustomerFilesUrl((row?.google_drive_link ?? '').trim())
        setCustomerPicturesUrl((row?.job_pictures_link ?? '').trim())
        setJobPctSeed(row ? fieldPctStartValue(row.pct_complete ?? null, row.status ?? null) : null)
      } catch {
        if (!cancelled) {
          setCustomerFilesUrl('')
          setCustomerPicturesUrl('')
        }
      } finally {
        if (!cancelled) setJobLinksLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, jobId])

  useEffect(() => {
    if (!open) return
    supabase.from('report_templates').select('*').order('sequence_order').then(({ data }) => {
      // Turnaway is filed only through the Job Mode TurnawayModal (which also
      // creates the dispatch request); Job Complete is retired (Status at 100%
      // covers it). Keep both out of the generic picker.
      const list = ((data as ReportTemplate[]) ?? []).filter(
        (t) => !isTurnawayTemplateName(t.name) && !isJobCompleteTemplateName(t.name),
      )
      setTemplates(list)
      if (list.length > 0) {
        const id = findStatusReportTemplateId(list) ?? list[0]?.id
        if (id) setSelectedTemplateId(id)
      }
    })
  }, [open])

  useEffect(() => {
    if (!selectedTemplateId) return
    supabase
      .from('report_template_fields')
      .select('*')
      .eq('template_id', selectedTemplateId)
      .order('sequence_order')
      .then(({ data }) => {
        const fields = (data as ReportTemplateField[]) ?? []
        setTemplateFields((prev) => ({ ...prev, [selectedTemplateId]: fields }))
        // Deliberately NOT clearing fieldValues (v2.1025): values key on field
        // label and submit/copy read only the current template's fields, so
        // switching report types keeps everything typed. reset() still clears.
      })
  }, [selectedTemplateId])

  useEffect(() => {
    if (!open) return
    let live = true
    void loadReportPhotoSize().then((size) => {
      if (live) setPhotoSize(size)
    })
    return () => {
      live = false
    }
  }, [open])

  // The press opens the camera (the mock-up's section 6, frame 1): once per open, in the same task as the press that
  // opened the form, so a phone takes it as the tech's own tap. Cancel on the camera leaves the form with Take a photo.
  useLayoutEffect(() => {
    if (!open) {
      cameraOpenedRef.current = false
      return
    }
    if (cameraFirst && !cameraOpenedRef.current) {
      cameraOpenedRef.current = true
      cameraInputRef.current?.click()
    }
  }, [open, cameraFirst])

  function keepUrl(url: string): string {
    urlsRef.current.push(url)
    return url
  }

  /** The shots of a form that was not saved leave the bucket and the table; every object URL is let go. */
  function dropTiles() {
    const unsaved = attachedRef.current ? [] : tiles.filter((t) => t.status === 'sent').map((t) => ({ id: t.id, storagePath: t.storagePath }))
    if (unsaved.length) void discardReportPhotos(unsaved)
    for (const u of urlsRef.current) URL.revokeObjectURL(u)
    urlsRef.current = []
    originalsRef.current.clear()
    attachedRef.current = false
    setTiles([])
    setLastShrink(null)
    setShowOtherTypes(false)
    setShowWhatIsNext(false)
  }

  function openCamera(stage: ReportPhotoStage | null) {
    cameraStageRef.current = stage
    cameraInputRef.current?.click()
  }

  /** Shrink on the phone, then send: the tile reads each step, and a failure keeps the tile with Retry. */
  async function shrinkAndSend(id: string, file: File, takenAt: string) {
    try {
      const shot = await shrinkReportPhoto(file, photoSize)
      if (!withinCap(shot.blob.size)) throw new Error('The photo is over 2 MB even after the shrink.')
      const preview = shot.shrunk ? keepUrl(URL.createObjectURL(shot.blob)) : null
      setTiles((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: 'sending', bytes: shot.blob.size, width: shot.width, height: shot.height, shrunk: shot.shrunk, ...(preview ? { previewUrl: preview } : null) } : t)),
      )
      setLastShrink(shrinkWords({ before: file.size, after: shot.blob.size, longEdge: edgeFor(photoSize), shrunk: shot.shrunk }))
      if (!authUserId) throw new Error('Sign in again to send a photo.')
      const sent = await sendReportPhoto({ id, jobId, blob: shot.blob, byUserId: authUserId, byName: profileName?.trim() || '', takenAt, originalBytes: file.size, width: shot.width, height: shot.height })
      setTiles((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'sent', storagePath: sent.storagePath, failWhy: null } : t)))
    } catch (err) {
      setTiles((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'failed', failWhy: formatErrorMessage(err, 'The photo did not send.') } : t)))
    }
  }

  function onCameraFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const stage = cameraStageRef.current
    cameraStageRef.current = null
    const id = newPhotoId()
    const takenAt = new Date().toISOString()
    originalsRef.current.set(id, file)
    setTiles((prev) => [
      ...prev,
      {
        id,
        status: 'shrinking',
        previewUrl: keepUrl(URL.createObjectURL(file)),
        originalBytes: file.size,
        bytes: 0,
        width: 0,
        height: 0,
        longEdge: edgeFor(photoSize),
        shrunk: false,
        fixtureId: stage?.fixtureId ?? null,
        stageName: stage?.name ?? null,
        storagePath: null,
        takenAt,
        failWhy: null,
      },
    ])
    void shrinkAndSend(id, file, takenAt)
  }

  function retryTile(id: string) {
    const file = originalsRef.current.get(id)
    const tile = tiles.find((t) => t.id === id)
    if (!file || !tile) return
    setTiles((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'shrinking', failWhy: null } : t)))
    void shrinkAndSend(id, file, tile.takenAt)
  }

  function removeTile(id: string) {
    const tile = tiles.find((t) => t.id === id)
    if (!tile) return
    if (tile.status === 'sent') void discardReportPhotos([{ id: tile.id, storagePath: tile.storagePath }])
    originalsRef.current.delete(id)
    setTiles((prev) => prev.filter((t) => t.id !== id))
  }

  function putTileOnStage(tileId: string, stage: ReportPhotoStage) {
    setTiles((prev) => prev.map((t) => (t.id === tileId ? { ...t, fixtureId: stage.fixtureId, stageName: stage.name } : t)))
  }

  /** The stages a photo can sit on: the job's priced lines, a paid one never (its number is locked). */
  const photoStages: ReportPhotoStage[] = (lineProgress.lines ?? []).filter((r) => !r.drawPaid).map((r) => ({ fixtureId: r.fixtureId, name: r.name }))
  const jobHasFolder = jobLinksLoading ? null : Boolean(customerFilesUrl || customerPicturesUrl)

  function reset() {
    setFieldValues({})
    voiceDraft.reset()
    setError(null)
    dropTiles()
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    void submitReport()
  }

  /** The save itself, separated from the form event so the offline Retry panel can re-run it (J2-F3). */
  async function submitReport() {
    if (!authUserId || !selectedTemplateId) return
    setSaving(true)
    setError(null)
    setSubmitFailure(null)
    const fields = templateFields[selectedTemplateId] ?? []
    for (const f of fields) {
      if ((f.input_type ?? 'long_text') === 'signature_png') {
        const msg = validateReportSignatureDataUrlForSubmit(fieldValues[f.label] ?? '')
        if (msg) {
          setError(msg)
          setSaving(false)
          return
        }
      }
    }
    const fv: Record<string, string> = {}
    for (const f of fields) {
      // An untouched percent files the job's number, as the field and Save already say, even when Save is pressed in
      // the moment before the seed effect has put it in `fieldValues` (that moment filed 0): the kernel's rule.
      fv[f.label] = fieldValueForSubmit(f, fieldValues, { percentSeed: jobPctSeed, linesActive })
    }
    // Report by line (v2.5663): the number the lines add up to is the percent field, the moved lines in words beside it.
    if (linesActive && lineProgress.lines && percentFieldLabel && lineDerivedPct != null) {
      fv[percentFieldLabel] = String(lineDerivedPct)
      const moves = lineProgressFieldValue(lineProgress.lines, lineProgress.picks, lineProgress.recordedPct)
      if (moves) fv[REPORT_FIELD_LABEL_STAGE_PROGRESS] = moves
    }
    // The photos' clause beside the moves (punch list #189, PR 5b): the office reads the Stage progress line and knows.
    const riding = sentTiles(tiles)
    const photoWords = photosSentence(riding)
    if (photoWords) fv[REPORT_FIELD_LABEL_STAGE_PROGRESS] = [fv[REPORT_FIELD_LABEL_STAGE_PROGRESS], photoWords].filter(Boolean).join(' · ')

    let reportedAtLat: number | null = null
    let reportedAtLng: number | null = null
    if ('geolocation' in navigator) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 60000,
          })
        })
        reportedAtLat = pos.coords.latitude
        reportedAtLng = pos.coords.longitude
      } catch {
        // Proceed without location
      }
    }

    // Through the outbox (punch list #163 PR 3): sent at once when it can be, kept on the phone when it cannot.
    // The server lands it for an estimator through insert_report and for everyone else under their own policy.
    // A report with photos is never kept: its shots live on this form, so it stays open with Retry until the
    // signal is back (the photos' own queue is #189's PR 7).
    const hasPhotos = tiles.length > 0
    const movedLines = linesActive && lineProgress.moved.length > 0 ? lineProgress.moved.map((m) => ({ fixtureId: m.fixtureId, to: m.to })) : undefined
    const outcome = await pressThroughOutbox(
      {
        kind: 'field-report',
        userId: authUserId,
        pressedAt: Date.now(),
        payload: {
          templateId: selectedTemplateId,
          fieldValues: fv,
          jobLedgerId: jobId,
          projectId: null,
          bidId: null,
          lat: reportedAtLat != null && reportedAtLng != null ? reportedAtLat : null,
          lng: reportedAtLat != null && reportedAtLng != null ? reportedAtLng : null,
          movedLines,
        },
        about: [hcpNumber, jobName].filter((x) => x && x !== '—').join(' · '),
        door: '/dashboard',
      },
      hasPhotos ? { allowed: false } : undefined,
    )
    setSaving(false)
    if (outcome.kind === 'refused' || outcome.kind === 'failed') {
      // Class-decided (v2.2843): a fetch-layer failure gets Retry; a refused insert says why.
      setSubmitFailure(outcome.kind === 'refused' ? { kind: 'server', message: outcome.message } : recoveryFailureFromError(outcome.error, 'Could not save the report'))
      return
    }
    if (outcome.kind === 'queued') {
      // The notifications, the moved lines and the job's percent follow when it lands (`afterLanding`).
      showToast(KEPT_ON_PHONE_WORDS, 'success')
      onSaved()
      handleClose()
      return
    }
    const landedId = reportIdOf(outcome.result)
    const inserted: { id: string } | null = landedId ? { id: landedId } : null
    // The photos ride with the report (punch list #189, PR 5b): each sent shot takes the report's id, its stage and
    // the words it is named by. A shot that did not attach says so; the report itself is saved either way.
    if (inserted?.id && riding.length > 0) {
      const firstLong = fields.find((f) => (f.input_type ?? 'long_text') === 'long_text')?.label ?? null
      const whatGotDone = firstLong ? (fv[firstLong] ?? '') : ''
      const attached = await attachReportPhotos(
        inserted.id,
        riding.map((t) => ({ id: t.id, fixtureId: t.fixtureId, stageName: t.stageName, caption: reportPhotoCaption({ stageName: t.stageName, whatGotDone }) })),
      )
      attachedRef.current = true
      if (attached.failed.length) {
        showToast(`Report saved, but ${attached.failed.length === 1 ? 'a photo' : `${attached.failed.length} photos`} did not attach: ${attached.failed[0]}`, 'warning')
      }
    }
    // Best-effort report notification + subscriber emails (fire-and-forget; report is already saved).
    if (inserted?.id) {
      void supabase.functions
        .invoke('send-report-notification', { body: { report_id: inserted.id } })
        .catch(() => { /* notification is best-effort */ })
      void supabase.functions
        .invoke('send-report-email', { body: { report_id: inserted.id } })
        .catch(() => { /* report email is best-effort */ })
    }
    // Report by line (v2.5663): stamp each moved line on its row, best-effort.
    if (linesActive && lineProgress.moved.length > 0) {
      await stampMovedLines(jobId, lineProgress.moved, inserted?.id ?? null)
    }
    // Mirror the report's completion percent into jobs_ledger.pct_complete
    // (best-effort), then offer Ready to bill when a 100% report lands on a
    // Working job.
    const { jobStatus, pctError } = await propagateReportPctToJob(jobId, fv)
    if (pctError) {
      showToast(`Report saved, but the job's % done could not update: ${pctError}`, 'warning')
    }
    if (reportSaysJobComplete(fv) && jobStatus === 'working') {
      setReadyToBillJob({ id: jobId, hcpNumber: hcpNumber || '—', jobName: jobName || '—' })
      return
    }
    onSaved()
    handleClose()
  }

  function finishReadyToBillPrompt() {
    setReadyToBillJob(null)
    onSaved()
    handleClose()
  }

  // Freeze the page behind the modal — dragging inside it used to scroll the
  // list underneath on a phone, and closing then landed somewhere else.
  useBodyScrollLock(open)

  if (!open) return null

  if (readyToBillJob) {
    return <MarkJobReadyToBillPrompt job={readyToBillJob} onClose={finishReadyToBillPrompt} />
  }

  const fields = templateFields[selectedTemplateId] ?? []
  // Save waits for a shot still on its way (the queue of #163 takes this over in PR 7).
  const canSubmit = Boolean(selectedTemplateId && authUserId) && !photosInFlight(tiles)
  // The percent the report files, for Save's words. A type with no percent field (a Note, a Walk) files none even on a
  // job with stage lines, so Save names none (v2.6126); an untouched field reads the job's own number, the same rule
  // Save files by (v2.6132), so the button never promises what Save will not file.
  const jobPctForSave = !percentFieldLabel
    ? null
    : linesActive
      ? (lineDerivedPct ?? 0)
      : Number.parseInt(percentFieldValueForSubmit(fieldValues[percentFieldLabel], jobPctSeed), 10) || 0

  function reportTypeChipStyles(templateId: string, templateName: string): CSSProperties {
    const selected = selectedTemplateId === templateId
    const blueIdle = additionalReportModalBlueChipTemplate(templateName)
    const base: CSSProperties = {
      padding: '0.5rem 1rem',
      fontSize: '0.875rem',
      borderRadius: 4,
      cursor: 'pointer',
    }
    if (selected) {
      return {
        ...base,
        border: '2px solid #3b82f6',
        background: 'var(--bg-blue-tint)',
        fontWeight: 600,
      }
    }
    if (blueIdle) {
      return {
        ...base,
        border: '1px solid #3b82f6',
        background: 'var(--bg-blue-tint)',
        color: 'var(--text-blue-800)',
        fontWeight: 500,
      }
    }
    return {
      ...base,
      border: '1px solid var(--border-strong)',
      background: 'var(--surface)',
      fontWeight: 400,
    }
  }
  return (
    <>
    <div
      style={{
        position: 'fixed',
        padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: overlayZIndex,
      }}
    >
      {/* Sticky-header pattern (originated here in v2.990, now shared across the
          scrolling modals): the panel is the scroller and the × used to scroll
          away with it. See stickyModalHeaderStyle.ts for why the panel carries
          no top padding. */}
      <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', borderRadius: 8, maxHeight: 'min(90vh, 100%)', overflow: 'auto', ...stickyModalPanelStyle(560) }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '0.75rem',
          ...stickyModalHeaderStyle(),
        }}>
          <div style={{ minWidth: 0 }}>
            {/* v2.1554: four header lines become two — job in the title, zip-less address under it. */}
            <h2
              style={{
                margin: 0,
                fontSize: '1.05rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {hcpNumber} {jobName}
            </h2>
            <p
              style={{
                margin: '0.15rem 0 0',
                fontSize: '0.8125rem',
                color: 'var(--text-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {stripAddressZip(jobAddress)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            style={STICKY_MODAL_CLOSE_BUTTON_STYLE}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'center',
            marginBottom: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            disabled={jobLinksLoading}
            onClick={() => {
              if (jobLinksLoading) return
              if (customerFilesUrl) openInExternalBrowser(customerFilesUrl)
              else showToast(TOAST_NO_CUSTOMER_FILES, 'warning', undefined, undefined, 'center')
            }}
            aria-label={
              jobLinksLoading
                ? 'Loading Customer Files link'
                : customerFilesUrl
                  ? 'Open Customer Files link'
                  : 'Customer Files not linked; contact Dispatch'
            }
            title={
              jobLinksLoading
                ? 'Loading…'
                : customerFilesUrl
                  ? 'Open Customer Files'
                  : TOAST_NO_CUSTOMER_FILES
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              padding: 0,
              border: `1px solid ${
                jobLinksLoading ? 'var(--border)' : customerFilesUrl ? 'var(--border-indigo-soft)' : 'var(--border-red)'
              }`,
              borderRadius: 6,
              background: 'var(--surface)',
              cursor: jobLinksLoading ? 'not-allowed' : 'pointer',
              opacity: jobLinksLoading ? 0.85 : 1,
              color: jobLinksLoading ? '#9ca3af' : customerFilesUrl ? 'var(--text-link)' : 'var(--text-red-600)',
            }}
          >
            <Folder size={22} strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            disabled={jobLinksLoading}
            onClick={() => {
              if (jobLinksLoading) return
              if (customerPicturesUrl) openInExternalBrowser(customerPicturesUrl)
              else showToast(TOAST_NO_CUSTOMER_PICTURES, 'warning', undefined, undefined, 'center')
            }}
            aria-label={
              jobLinksLoading
                ? 'Loading Customer Pictures link'
                : customerPicturesUrl
                  ? 'Open Customer Pictures link'
                  : 'Customer Pictures not linked; contact Dispatch'
            }
            title={
              jobLinksLoading
                ? 'Loading…'
                : customerPicturesUrl
                  ? 'Open Customer Pictures'
                  : TOAST_NO_CUSTOMER_PICTURES
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              padding: 0,
              border: `1px solid ${
                jobLinksLoading ? 'var(--border)' : customerPicturesUrl ? 'var(--border-indigo-soft)' : 'var(--border-red)'
              }`,
              borderRadius: 6,
              background: 'var(--surface)',
              cursor: jobLinksLoading ? 'not-allowed' : 'pointer',
              opacity: jobLinksLoading ? 0.85 : 1,
              color: jobLinksLoading ? '#9ca3af' : customerPicturesUrl ? 'var(--text-link)' : 'var(--text-red-600)',
            }}
          >
            <Images size={22} strokeWidth={2} aria-hidden />
          </button>
          {/* Opens the job's reports — yours and your crew-mates' (v2.1546). */}
          <button
            type="button"
            onClick={() => setShowJobReportsModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              marginLeft: 'auto',
              height: 40,
              padding: '0 0.75rem',
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: 'var(--text-link)',
              background: 'var(--surface)',
              border: '1px solid var(--border-indigo-soft)',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Reports for this Job
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* The camera (punch list #189, PR 5b): the back camera on a phone, the file picker at a desk. One shot a press. */}
          <input ref={cameraInputRef} type="file" accept="image/*" capture={cameraFirst ? 'environment' : undefined} onChange={onCameraFile} tabIndex={-1} aria-hidden style={{ display: 'none' }} data-testid="report-camera-input" />
          {(() => {
            const photosBlock = (
              <div style={{ marginBottom: '1rem' }} data-testid="report-photos-block">
                {lastShrink ? <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>{newPhotoLine({ shrinkWords: lastShrink, jobHasFolder })}</div> : null}
                <ReportPhotoTiles
                  tiles={tiles}
                  stages={photoStages}
                  onTake={() => openCamera(null)}
                  onStage={putTileOnStage}
                  onRemove={removeTile}
                  onRetry={retryTile}
                  captureWords={cameraFirst ? (tiles.length ? REPORT_PHOTO_WORDS.another : REPORT_PHOTO_WORDS.take) : REPORT_PHOTO_WORDS.add}
                />
              </div>
            )
            const reportTypeBlock = (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Report type:</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTemplateId(t.id)}
                      style={reportTypeChipStyles(t.id, t.name)}
                    >
                      {additionalReportModalTemplateChipLabel(t.name, userRole)}
                    </button>
                  ))}
                </div>
              </div>
            )
            const voiceBlock = (
              /* Talk it through (punch list #186, item 1, v2.5912): the phone's own speech into Notes, read before Save report. */
              <ReportVoiceNote fields={fields} draft={voiceDraft.host} onHeard={(label, merge) => setFieldValues((prev) => ({ ...prev, [label]: merge(prev[label] ?? '') }))} />
            )
            const renderField = (f: ReportTemplateField, phoneMain = false): ReactNode => {
              const t = f.input_type ?? 'long_text'
              if (t === 'percent_0_100') {
                if (linesActive && lineProgress.lines) {
                  return (
                    <ReportLinesProgressField
                      key={f.id}
                      rows={lineProgress.lines}
                      picks={lineProgress.picks}
                      openId={lineProgress.openId}
                      onOpen={lineProgress.setOpenId}
                      onPct={lineProgress.setPick}
                      recordedPct={lineProgress.recordedPct}
                      onSwitchToWholeJob={() => lineProgress.setLinesMode(false)}
                      rowFoot={(r) => (r.drawPaid ? null : <StageRowPhotos tiles={tilesOnStage(tiles, r.fixtureId)} stageName={r.name} onCamera={() => openCamera({ fixtureId: r.fixtureId, name: r.name })} />)}
                    />
                  )
                }
                return (
                  <div key={f.id}>
                    <ReportTemplatePercentField
                      id={`additional-report-pct-${f.id}`}
                      label={f.label}
                      value={fieldValues[f.label] ?? (jobPctSeed != null ? String(jobPctSeed) : '0')}
                      onChange={(v) => setFieldValues((prev) => ({ ...prev, [f.label]: v }))}
                      hint={
                        jobPctSeed == null
                          ? null
                          : (fieldValues[f.label] ?? String(jobPctSeed)) === String(jobPctSeed)
                            ? `Opens on the job's ${jobPctSeed}%. Leave it, and the report files ${jobPctSeed}%.`
                            : `Was ${jobPctSeed}%.`
                      }
                    />
                    {lineProgress.hasLines && !lineProgress.linesMode ? (
                      <button
                        type="button"
                        onClick={() => lineProgress.setLinesMode(true)}
                        style={{ marginTop: -4, marginBottom: '0.75rem', padding: 0, border: 'none', background: 'transparent', color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.78rem' }}
                      >
                        {MARK_EACH_LINE_LINK}
                      </button>
                    ) : null}
                  </div>
                )
              }
              if (t === 'signature_png') {
                return (
                  <ReportTemplateSignatureField
                    key={f.id}
                    reactKeyPrefix={`add-${selectedTemplateId}-${f.id}`}
                    id={`additional-report-sig-${f.id}`}
                    label={f.label}
                    value={fieldValues[f.label] ?? ''}
                    onChange={(v) => setFieldValues((prev) => ({ ...prev, [f.label]: v }))}
                    captionBelowCanvas={profileName?.trim() ? profileName : null}
                  />
                )
              }
              return (
                <div key={f.id} style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>
                    {phoneMain ? REPORT_PHOTO_WORDS.whatGotDone : f.label}
                    {phoneMain ? <span style={{ marginLeft: 6, fontWeight: 400, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{REPORT_PHOTO_WORDS.optional}</span> : null}
                  </label>
                  <AutoGrowTextarea
                    value={fieldValues[f.label] ?? ''}
                    onChange={(e) => {
                      setFieldValues((prev) => ({ ...prev, [f.label]: e.target.value }))
                      voiceDraft.dropDraftMark(f.label)
                    }}
                    rows={3}
                    placeholder={REPORT_FIELD_PLACEHOLDERS[f.label]}
                    aria-label={f.label}
                    style={{ width: '100%', padding: '0.5rem', fontSize: phoneMain ? '1rem' : undefined, border: `1px solid ${voiceDraft.draftMarks.has(f.label) ? 'var(--border-blue)' : 'var(--border-strong)'}`, borderRadius: 4 }}
                  />
                  {voiceDraft.draftMarks.has(f.label) ? <DraftedMark /> : null}
                </div>
              )
            }
            const foldLink = (words: string, open: boolean, toggle: () => void, testId: string): ReactNode => (
              <button type="button" onClick={toggle} aria-expanded={open} data-testid={testId} style={{ display: 'block', margin: '0 0 0.75rem', padding: '0.4rem 0', minHeight: 44, border: 'none', background: 'transparent', color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.875rem', fontWeight: 600 }}>
                {words} {open ? '▴' : '▾'}
              </button>
            )
            if (!cameraFirst) {
              // A desk, or an office role on a phone: the form as it was, with the photos under the report type.
              return (
                <>
                  {voiceBlock}
                  {reportTypeBlock}
                  {photosBlock}
                  {fields.length > 0 ? (
                    <div style={{ marginBottom: '1rem' }}>
                      {fields.map((f) => renderField(f))}
                      {voiceDraft.heard ? <HeardFold heard={voiceDraft.heard.text} language={voiceDraft.heard.language} lines={voiceDraft.heard.lines} /> : null}
                    </div>
                  ) : null}
                </>
              )
            }
            // The camera-first form (the mock-up's section 3): the photos, the stages, one optional box, the rest under a link.
            const percentFields = fields.filter((f) => (f.input_type ?? 'long_text') === 'percent_0_100')
            const longFields = fields.filter((f) => (f.input_type ?? 'long_text') === 'long_text')
            const mainLong = longFields[0] ?? null
            const restFields = fields.filter((f) => f !== mainLong && (f.input_type ?? 'long_text') !== 'percent_0_100')
            return (
              <>
                {photosBlock}
                {percentFields.map((f) => renderField(f))}
                {voiceBlock}
                {mainLong ? renderField(mainLong, true) : null}
                {voiceDraft.heard ? <HeardFold heard={voiceDraft.heard.text} language={voiceDraft.heard.language} lines={voiceDraft.heard.lines} /> : null}
                {restFields.length > 0 ? foldLink(REPORT_PHOTO_WORDS.whatIsNext, showWhatIsNext, () => setShowWhatIsNext((v) => !v), 'report-fold-next') : null}
                {showWhatIsNext ? restFields.map((f) => renderField(f)) : null}
                {templates.length > 1 ? foldLink(REPORT_PHOTO_WORDS.otherTypes, showOtherTypes, () => setShowOtherTypes((v) => !v), 'report-fold-types') : null}
                {showOtherTypes ? reportTypeBlock : null}
              </>
            )
          })()}

          {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p>}
          <OfflineRetryPanel
            failure={submitFailure}
            onRetry={submitReport}
            surface={'additional-report'}
            busy={saving}
            style={{ marginBottom: '1rem' }}
          />

          {/* v2.1554: Cancel demoted to quiet text on the left; Save alone on the right. On the camera-first form the foot sticks to the
              bottom of the scroll, Not now beside a Save that names what it writes (punch list #189, PR 5b). */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              borderTop: '1px solid var(--border)',
              paddingTop: '0.75rem',
              ...(cameraFirst ? { position: 'sticky', bottom: 0, background: 'var(--surface)', paddingBottom: '0.5rem' } : null),
            }}
          >
            <button type="button" onClick={handleClose} style={{ padding: '0.5rem 0.75rem', minHeight: cameraFirst ? 48 : undefined, border: cameraFirst ? '1px solid var(--border-strong)' : 'none', borderRadius: cameraFirst ? 10 : undefined, background: cameraFirst ? 'var(--surface)' : 'none', color: cameraFirst ? 'var(--text-strong)' : 'var(--text-muted)', cursor: 'pointer', fontSize: cameraFirst ? '0.9375rem' : '0.875rem', fontWeight: cameraFirst ? 600 : undefined }}>
              {cameraFirst ? STAGE_PCT_WORDS.notNow : 'Cancel'}
            </button>
            <button type="submit" disabled={!canSubmit || saving} style={{ marginLeft: 'auto', flex: cameraFirst ? 1 : undefined, minHeight: cameraFirst ? 48 : undefined, padding: '0.5rem 1.25rem', background: canSubmit && !saving ? '#2563eb' : DEAD_PRESS_FILL, color: canSubmit && !saving ? 'white' : DEAD_PRESS_TEXT, border: 'none', borderRadius: cameraFirst ? 10 : 6, fontWeight: 600, fontSize: cameraFirst ? '0.9375rem' : undefined, cursor: canSubmit && !saving ? 'pointer' : 'not-allowed' }}>
              {cameraFirst ? reportSaveWords({ jobPct: jobPctForSave, tiles, saving }) : saving ? 'Saving…' : photosInFlight(tiles) ? reportSaveWords({ jobPct: jobPctForSave, tiles, saving }) : 'Save report'}
            </button>
          </div>
        </form>
      </div>
    </div>
    {showJobReportsModal && (
      <JobReportsModal
        open={showJobReportsModal}
        onClose={() => setShowJobReportsModal(false)}
        jobId={jobId}
        hcpNumber={hcpNumber}
        jobName={jobName}
        jobAddress={jobAddress}
        authUserId={authUserId}
        userRole={userRole}
        zIndex={overlayZIndex + 5}
        onReportSaved={onReportSaved}
      />
    )}
    </>
  )
}
