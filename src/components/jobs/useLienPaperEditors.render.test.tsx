// @vitest-environment jsdom
/**
 * The wording editor and the notice's preview window on their own (v2.7614). The preview's listener is the desk's
 * one place that takes messages from another window, so every check it makes before writing is pinned here.
 * Inside the desk both are held by `LienDesk.render.test.tsx`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useState } from 'react'
import { LIEN_NOTICE_PREVIEW_EDIT_MESSAGE, LIEN_NOTICE_PREVIEW_SAVE_MESSAGE, LIEN_NOTICE_TYPED_FIELDS } from '../../lib/jobs/lienNoticePreview'
import { useLienNoticePreview, type LienNoticePreviewDeskInput } from './useLienNoticePreview'
import { useLienWordingEditor, type LienWordingEditing, type LienWordingEditorInput } from './useLienWordingEditor'

const toasts = vi.hoisted(() => [] as string[])
vi.mock('../../contexts/ToastContext', () => ({ useToastContext: () => ({ showToast: (words: string) => toasts.push(words) }) }))
vi.mock('../../lib/jobsDocuments/lienFilingDocuments', () => ({ buildLienNoticeBlocks: () => [] }))
vi.mock('../../lib/jobs/lienNoticePreview', async (orig) => ({
  ...(await orig<typeof import('../../lib/jobs/lienNoticePreview')>()),
  buildLienNoticePreviewHtml: () => '<html></html>',
  lienNoticePreviewPages: (_input: unknown, saved?: string) => ({ type: 'pages', saved }),
}))

const FIELD = LIEN_NOTICE_TYPED_FIELDS[0]!
const selected = { jobId: 'job-1' } as never

afterEach(() => {
  cleanup()
  toasts.length = 0
  vi.restoreAllMocks()
})

describe('useLienWordingEditor', () => {
  const useHarness = (over: Partial<LienWordingEditorInput> = {}, touchDraft = () => {}) => {
    const [wordingEdits, setWordingEdits] = useState<Record<string, string | undefined>>({})
    const [editing, setEditing] = useState<LienWordingEditing | null>(null)
    const [claimOpenSignal, setClaimOpenSignal] = useState(0)
    const editor = useLienWordingEditor({ selected, paperRef: { current: null }, editInputRef: { current: null }, paneRef: { current: null }, sourceTripRef: { current: null }, wordingLocked: false, noticeFields: { [FIELD]: 'typed words' } as never, jobDefaults: { [FIELD]: 'the job’s own words' } as never, editing, setEditing, setWordingEdits: setWordingEdits as never, setClaimOpenSignal, touchDraft, onOpenEditJob: () => {}, ...over })
    return { editor, wordingEdits, editing, setEditing, claimOpenSignal }
  }
  const click = (html: string, pick: string) => {
    const paper = document.createElement('div')
    paper.innerHTML = html
    document.body.appendChild(paper)
    return { target: paper.querySelector(pick) } as never
  }

  it('committing the box keeps the typed words and touches the draft; with no box it does nothing', () => {
    const touchDraft = vi.fn()
    const { result } = renderHook(() => useHarness({}, touchDraft))
    act(() => result.current.editor.commitEdit())
    expect(touchDraft).not.toHaveBeenCalled()
    act(() => result.current.setEditing({ key: FIELD, value: 'new words', rect: { top: 0, left: 0, width: 1, height: 1 }, font: '' }))
    act(() => result.current.editor.commitEdit())
    expect(result.current.editing).toBeNull()
    expect(result.current.wordingEdits).toEqual({ [FIELD]: 'new words' })
    expect(touchDraft).toHaveBeenCalledTimes(1)
  })

  it('a reset puts the job’s own words back, and a locked paper ignores it', () => {
    const open = renderHook(() => useHarness())
    act(() => open.result.current.editor.onPaperClick(click(`<span data-field="${FIELD}"><button data-reset="${FIELD}">reset</button></span>`, '[data-reset]')))
    expect(open.result.current.wordingEdits).toEqual({ [FIELD]: 'the job’s own words' })
    const locked = renderHook(() => useHarness({ wordingLocked: true }))
    act(() => locked.result.current.editor.onPaperClick(click(`<span data-field="${FIELD}"><button data-reset="${FIELD}">reset</button></span>`, '[data-reset]')))
    expect(locked.result.current.wordingEdits).toEqual({})
  })

  it('a press on a typed field of a locked paper says why, and opens no box', () => {
    const { result } = renderHook(() => useHarness({ wordingLocked: true }))
    act(() => result.current.editor.onPaperClick(click(`<span data-field="${FIELD}">words</span>`, '[data-field]')))
    expect(toasts).toEqual(['Sent for approval — pull it back to a draft to change the wording.'])
    expect(result.current.editing).toBeNull()
  })

  it('a plain value’s door goes where it is set: the GC on the job, the claim on the pane', () => {
    const onOpenEditJob = vi.fn()
    const trip = { current: null as { field: string; before: string } | null }
    const { result } = renderHook(() => useHarness({ onOpenEditJob, sourceTripRef: trip as never, noticeFields: { originalContractorName: 'ZZ Test Builder' } as never }))
    act(() => result.current.editor.onPaperClick(click('<span data-field="originalContractorName" data-door="gc">ZZ Test Builder</span>', '[data-field]')))
    expect(onOpenEditJob).toHaveBeenCalledWith('job-1', 'gc')
    expect(trip.current).toEqual({ field: 'originalContractorName', before: 'ZZ Test Builder' })
    act(() => result.current.editor.onPaperClick(click('<span data-field="claimAmount" data-door="claim">$</span>', '[data-field]')))
    expect(result.current.claimOpenSignal).toBe(1)
  })
})

describe('useLienNoticePreview', () => {
  let preview: Window
  beforeEach(() => {
    const frame = document.createElement('iframe')
    document.body.appendChild(frame)
    preview = frame.contentWindow as Window
    vi.spyOn(window, 'open').mockImplementation(() => preview)
    vi.spyOn(preview, 'postMessage').mockImplementation(() => {})
    ;(URL as unknown as { createObjectURL: () => string }).createObjectURL = () => 'blob:test'
    ;(URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {}
  })

  const mount = (over: Partial<LienNoticePreviewDeskInput> = {}) => {
    const setWordingEdits = vi.fn()
    const run = vi.fn(async (_label: string, fn: () => Promise<void>) => {
      await fn()
      return true
    })
    const ensureDraft = vi.fn(async () => 'draft-1')
    const props: LienNoticePreviewDeskInput = { selected, job: undefined, noticeFields: {} as never, jobDefaults: {} as never, docExtras: {} as never, paneSigned: null as never, wordingEditedBy: null, coverBlocks: [], payBlocks: [], wordingLocked: false, handSetClaimWords: '', monthsList: ['2026-10'], setWordingEdits, touchDraft: vi.fn(), run, ensureDraft, paperRef: { current: null }, startEdit: vi.fn(), docHtml: '', coverHtml: '', payHtml: '', wordingDiffLength: 0, ...over }
    const hook = renderHook((p: LienNoticePreviewDeskInput) => useLienNoticePreview(p), { initialProps: props })
    return { ...hook, props, setWordingEdits, run, ensureDraft }
  }
  const post = (data: unknown, from: { origin?: string; source?: Window | null } = {}) =>
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data, origin: from.origin ?? window.location.origin, source: from.source === undefined ? preview : from.source }))
    })
  const edit = { type: LIEN_NOTICE_PREVIEW_EDIT_MESSAGE, field: FIELD, value: 'from the preview' }

  it('an edit from the preview this desk opened, on this job, is layered on', () => {
    const m = mount()
    act(() => m.result.current.openPreview())
    post(edit)
    expect(m.setWordingEdits).toHaveBeenCalledTimes(1)
    expect(m.props.touchDraft).toHaveBeenCalledTimes(1)
  })

  it('ignores an edit from another origin, from another window, or before any preview is open', () => {
    const m = mount()
    post(edit)
    act(() => m.result.current.openPreview())
    post(edit, { origin: 'https://elsewhere.example' })
    post(edit, { source: window })
    expect(m.setWordingEdits).not.toHaveBeenCalled()
  })

  it('ignores an edit once the desk has moved to another job, and while the wording is locked', () => {
    const m = mount()
    act(() => m.result.current.openPreview())
    m.rerender({ ...m.props, selected: { jobId: 'job-2' } as never })
    post(edit)
    m.rerender({ ...m.props, wordingLocked: true })
    post(edit)
    expect(m.setWordingEdits).not.toHaveBeenCalled()
  })

  it('ignores an edit that names a field nobody types, or carries no words', () => {
    const m = mount()
    act(() => m.result.current.openPreview())
    post({ ...edit, field: 'claimAmount' })
    post({ ...edit, value: 5 })
    expect(m.setWordingEdits).not.toHaveBeenCalled()
  })

  it('Save from the preview saves the draft through the desk’s one press, and answers the preview', async () => {
    const m = mount()
    act(() => m.result.current.openPreview())
    post({ type: LIEN_NOTICE_PREVIEW_SAVE_MESSAGE })
    await vi.waitFor(() => expect(m.ensureDraft).toHaveBeenCalledTimes(1))
    expect(m.run.mock.calls[0]![0]).toBe('Save draft')
    await vi.waitFor(() => expect(preview.postMessage).toHaveBeenCalledWith({ type: 'pages', saved: 'ok' }, window.location.origin))
  })

  it('Save with no month picked, or on a locked notice, saves nothing and says it failed', () => {
    const m = mount({ monthsList: [] })
    act(() => m.result.current.openPreview())
    post({ type: LIEN_NOTICE_PREVIEW_SAVE_MESSAGE })
    expect(m.ensureDraft).not.toHaveBeenCalled()
    expect(preview.postMessage).toHaveBeenCalledWith({ type: 'pages', saved: 'failed' }, window.location.origin)
  })

  it('a blocked popup says so and leaves no preview to write from', () => {
    vi.spyOn(window, 'open').mockImplementation(() => null)
    const m = mount()
    act(() => m.result.current.openPreview())
    expect(toasts).toEqual(['Popup blocked — allow popups to preview the notice.'])
    post(edit, { source: null })
    expect(m.setWordingEdits).not.toHaveBeenCalled()
  })
})
