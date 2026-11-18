import { useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import type { LienDeskJob } from '../../hooks/useLienDeskData'
import type { LienDeskEntry } from '../../lib/jobs/lienDesk'
import { lienDeskJobLabel as jobLabel } from '../../lib/jobs/lienJobLabel'
import { LIEN_NOTICE_PREVIEW_EDIT_MESSAGE, LIEN_NOTICE_PREVIEW_MESSAGE, LIEN_NOTICE_PREVIEW_SAVE_MESSAGE, buildLienNoticePreviewHtml, isTypedNoticeField, lienNoticePreviewPages, type LienNoticeFieldKey, type LienNoticePreviewInput } from '../../lib/jobs/lienNoticePreview'
import { buildLienNoticeBlocks, type FilingDocExtras, type LienNoticeFields } from '../../lib/jobsDocuments/lienFilingDocuments'

/** What the Lien desk hands the notice's preview window: the notice as the pane shows it, and the ways an edit there lands here. */
export type LienNoticePreviewDeskInput = {
  selected: LienDeskEntry | null
  job: LienDeskJob | undefined
  /** The notice's fields, the job's own defaults, its extras, the signature on the paper, and who edited the wording. */
  noticeFields: LienNoticeFields
  jobDefaults: LienNoticeFields
  docExtras: FilingDocExtras
  paneSigned: Parameters<typeof buildLienNoticeBlocks>[2] extends { signature?: infer S } | undefined ? S : never
  wordingEditedBy: string | null
  /** The cover page's and the pay page's blocks, as the packet prints them. */
  coverBlocks: LienNoticePreviewInput['coverBlocks']
  payBlocks: LienNoticePreviewInput['payBlocks']
  /** Sent for approval, or not the office's: the preview's boxes cannot write. */
  wordingLocked: boolean
  handSetClaimWords: string
  monthsList: ReadonlyArray<string>
  setWordingEdits: Dispatch<SetStateAction<Partial<LienNoticeFields>>>
  /** Counts a change for the draft's autosave. */
  touchDraft: () => void
  /** The desk's one press at a time, and the write that makes or saves the draft: the preview's Save goes through both. */
  run: (label: string, fn: () => Promise<void>, done?: string) => Promise<boolean>
  ensureDraft: (fromAutosave?: boolean) => Promise<string>
  /** The paper on the pane and the press that opens a field's box on it: a field pressed in the preview is edited here. */
  paperRef: RefObject<HTMLDivElement | null>
  startEdit: (key: LienNoticeFieldKey) => void
  /** The three pages' HTML and the count of changed fields: when any changes, the open preview is sent the pages again. */
  docHtml: string
  coverHtml: string
  payHtml: string
  wordingDiffLength: number
}

/**
 * The notice's preview in its own window (v2.3522, v2.3660; its own file since v2.7614, out of `LienDesk.tsx` as
 * it stood). The window is opened without `noopener` so it can post back: a field to focus, a typed value it
 * changed, or Save. The desk stays the source of truth. The listener checks the message's origin, that it came
 * from the window this hook opened, that the preview belongs to the job on the pane and that the wording is not
 * locked, before it layers an edit on or saves. The handler is assigned into a ref on every render, as it was, so
 * the one listener always reads the latest notice.
 */
export function useLienNoticePreview({ selected, job, noticeFields, jobDefaults, docExtras, paneSigned, wordingEditedBy, coverBlocks, payBlocks, wordingLocked, handSetClaimWords, monthsList, setWordingEdits, touchDraft, run, ensureDraft, paperRef, startEdit, docHtml, coverHtml, payHtml, wordingDiffLength }: LienNoticePreviewDeskInput) {
  const { showToast } = useToastContext()
  const previewWinRef = useRef<Window | null>(null)
  const [previewJobId, setPreviewJobId] = useState<string | null>(null)
  // Not `noopener` — the preview posts back to this window: a field to focus, or (v2.3660) a typed value
  // it changed. The desk stays the source of truth: it layers the edit on, and the effect below posts the
  // rebuilt pages back, so the preview only ever shows what these builders print.
  const previewInput = () => ({
    blocks: buildLienNoticeBlocks(noticeFields, docExtras, { signature: paneSigned }),
    fields: noticeFields,
    defaults: jobDefaults,
    editedBy: wordingEditedBy,
    coverBlocks,
    payBlocks,
  })
  const postToPreview = (saved?: 'ok' | 'failed') => {
    const win = previewWinRef.current
    if (!win || win.closed) return
    win.postMessage(lienNoticePreviewPages(previewInput(), saved), window.location.origin)
  }
  const openPreview = () => {
    if (!selected) return
    const html = buildLienNoticePreviewHtml({ ...previewInput(), jobLabel: jobLabel(job, selected.jobId), editable: !wordingLocked, handSetClaim: handSetClaimWords || undefined })
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    const win = window.open(url, '_blank')
    if (!win) showToast('Popup blocked — allow popups to preview the notice.', 'error')
    previewWinRef.current = win
    setPreviewJobId(win ? selected.jobId : null)
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
  // A preview belongs to the job it was opened on: once the desk moves to another job its boxes must not write here.
  const previewIsThisJob = previewJobId != null && previewJobId === selected?.jobId
  const onPreviewMessageRef = useRef<(ev: MessageEvent) => void>(() => {})
  onPreviewMessageRef.current = (ev: MessageEvent) => {
    if (ev.origin !== window.location.origin) return
    const d = ev.data as { type?: unknown; field?: unknown; value?: unknown } | null
    if (!d) return
    if (d.type === LIEN_NOTICE_PREVIEW_EDIT_MESSAGE) {
      if (ev.source !== previewWinRef.current || !previewIsThisJob || wordingLocked) return
      if (typeof d.field !== 'string' || !isTypedNoticeField(d.field) || typeof d.value !== 'string') return
      const field = d.field
      const value = d.value
      setWordingEdits((e) => ({ ...e, [field]: value }))
      touchDraft()
      return
    }
    if (d.type === LIEN_NOTICE_PREVIEW_SAVE_MESSAGE) {
      if (ev.source !== previewWinRef.current || !previewIsThisJob || wordingLocked || monthsList.length === 0) {
        postToPreview('failed')
        return
      }
      void run('Save draft', async () => void (await ensureDraft()), 'Draft saved.').then((ok) => postToPreview(ok ? 'ok' : 'failed'))
      return
    }
    if (d.type !== LIEN_NOTICE_PREVIEW_MESSAGE || typeof d.field !== 'string' || !isTypedNoticeField(d.field)) return
    const field = d.field
    window.setTimeout(() => {
      paperRef.current?.querySelector<HTMLElement>(`[data-field="${field}"]`)?.scrollIntoView?.({ block: 'center' })
      startEdit(field)
    }, 0)
  }
  useEffect(() => {
    const onMessage = (ev: MessageEvent) => onPreviewMessageRef.current(ev)
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])
  // Whatever changed the pages — a box here, a box there, the cover-note tick — the open preview follows.
  useEffect(() => {
    if (!previewIsThisJob) return
    postToPreview()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the pages are a function of exactly these
  }, [previewIsThisJob, docHtml, coverHtml, payHtml, wordingDiffLength, wordingEditedBy])
  return { openPreview }
}
