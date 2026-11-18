import { useEffect, type Dispatch, type MouseEvent, type MutableRefObject, type RefObject, type SetStateAction } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import type { LienDeskEntry } from '../../lib/jobs/lienDesk'
import { isTypedNoticeField, type LienNoticeFieldKey } from '../../lib/jobs/lienNoticePreview'
import type { LienNoticeFields } from '../../lib/jobsDocuments/lienFilingDocuments'

/** A field of the notice being typed in place: the field, the words so far, and where its box sits over the paper. */
export type LienWordingEditing = { key: LienNoticeFieldKey; value: string; rect: { top: number; left: number; width: number; height: number }; font: string }

/** What the Lien desk hands the wording editor: the paper it draws, the notice's fields, and the typed words' state. */
export type LienWordingEditorInput = {
  selected: LienDeskEntry | null
  /** The paper's container and the box's input. The box is placed against the paper, so the two share one `position: relative` parent in the pane. */
  paperRef: RefObject<HTMLDivElement | null>
  editInputRef: RefObject<HTMLInputElement | null>
  paneRef: RefObject<HTMLDivElement | null>
  /** A plain value's door (v2.3697): the field it left for and what it read then, so the desk rings it when it comes back changed. */
  sourceTripRef: MutableRefObject<{ field: LienNoticeFieldKey; before: string } | null>
  /** Sent for approval, or not the office's: nothing can be typed over. */
  wordingLocked: boolean
  noticeFields: LienNoticeFields
  jobDefaults: LienNoticeFields
  editing: LienWordingEditing | null
  setEditing: Dispatch<SetStateAction<LienWordingEditing | null>>
  setWordingEdits: Dispatch<SetStateAction<Partial<LienNoticeFields>>>
  setClaimOpenSignal: Dispatch<SetStateAction<number>>
  /** Counts a change for the draft's autosave. */
  touchDraft: () => void
  onOpenEditJob: (jobId: string, focus?: 'property-record' | 'gc' | 'lien-contract') => void
  onOpenCompanySettings?: (field: 'companyName' | 'addressText') => void
}

/**
 * The notice's wording, typed in place on the paper (v2.3522; its own file since v2.7614, out of `LienDesk.tsx` as
 * it stood). A press on a typed field opens a box measured against the paper; a press on a plain value goes to
 * where it is set; a reset puts the job's own words back. The typed words and the field being typed stay the
 * desk's state, which clears them when the job changes.
 */
export function useLienWordingEditor({ selected, paperRef, editInputRef, paneRef, sourceTripRef, wordingLocked, noticeFields, jobDefaults, editing, setEditing, setWordingEdits, setClaimOpenSignal, touchDraft, onOpenEditJob, onOpenCompanySettings }: LienWordingEditorInput) {
  const { showToast } = useToastContext()
  const startEdit = (key: LienNoticeFieldKey) => {
    const wrap = paperRef.current
    const el = wrap?.querySelector<HTMLElement>(`[data-field="${key}"]`)
    if (!wrap || !el || wordingLocked) return
    const target = el.querySelector<HTMLElement>('[data-field-text]') ?? el
    const r = target.getBoundingClientRect()
    const w = wrap.getBoundingClientRect()
    const cs = typeof window !== 'undefined' && typeof window.getComputedStyle === 'function' ? window.getComputedStyle(target) : null
    setEditing({ key, value: noticeFields[key] ?? '', rect: { top: r.top - w.top, left: r.left - w.left, width: r.width, height: r.height }, font: cs?.font ?? '' })
  }
  const onPaperClick = (ev: MouseEvent<HTMLDivElement>) => {
    const t = ev.target as HTMLElement
    const reset = t.closest<HTMLElement>('[data-reset]')?.getAttribute('data-reset')
    if (reset && isTypedNoticeField(reset)) {
      if (!wordingLocked) {
        setWordingEdits((e) => ({ ...e, [reset]: jobDefaults[reset] }))
        touchDraft()
      }
      return
    }
    const el = t.closest<HTMLElement>('[data-field]')
    const key = el?.getAttribute('data-field') ?? ''
    if (!el) return
    if (!isTypedNoticeField(key)) {
      // A plain value's door (v2.3697): land where it is set, on the field, and ring it here when it comes back changed.
      const door = el.getAttribute('data-door')
      if (!door || !selected) return
      const k = key as LienNoticeFieldKey
      sourceTripRef.current = { field: k, before: noticeFields[k] ?? '' }
      if (door === 'gc') onOpenEditJob(selected.jobId, 'gc')
      else if (door === 'company') onOpenCompanySettings?.(k === 'claimantAddress' ? 'addressText' : 'companyName')
      else if (door === 'claim') {
        paneRef.current?.querySelector('[data-lien-claim-box], [data-lien-claim-editor]')?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
        setClaimOpenSignal((n) => n + 1)
      }
      return
    }
    if (wordingLocked) {
      showToast('Sent for approval — pull it back to a draft to change the wording.', 'info')
      return
    }
    startEdit(key)
  }
  const commitEdit = () => {
    setEditing((e) => {
      if (e) {
        setWordingEdits((w) => ({ ...w, [e.key]: e.value }))
        touchDraft()
      }
      return null
    })
  }
  useEffect(() => {
    if (editing) editInputRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.key])
  return { startEdit, onPaperClick, commitEdit }
}
