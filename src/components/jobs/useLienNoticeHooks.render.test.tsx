// @vitest-environment jsdom
/**
 * Two of the notice's hooks on their own (v2.7611): his signing code on someone else's screen, and the pay page
 * behind the notice with its lines typed in place. Inside the desk both are held by `LienDesk.render.test.tsx`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { useLienCodeSigner } from './useLienCodeSigner'
import { useLienDeskPayPage, type LienDeskPayPageInput, type LienPayLineEditing } from './useLienDeskPayPage'

const io = vi.hoisted(() => ({ reads: [] as string[], answer: { set: true, lockedUntilIso: null } as unknown, fail: false, rows: [] as unknown[] }))
vi.mock('../../lib/jobs/lienDeskSignIo', () => ({
  lienSignCodeStatus: (masterId: string) => {
    io.reads.push(masterId)
    return io.fail ? Promise.reject(new Error('down')) : Promise.resolve(io.answer)
  },
}))
vi.mock('../../hooks/useNoticePayPage', () => ({ useNoticePayPage: () => ({ rows: io.rows, assets: {}, bills: [], job: null, loading: false, refresh: () => {} }) }))
vi.mock('../../contexts/ToastContext', () => ({ useToastContext: () => ({ showToast: () => {} }) }))

afterEach(() => {
  cleanup()
  io.reads.length = 0
  io.fail = false
  io.answer = { set: true, lockedUntilIso: null }
  io.rows = []
})

describe('useLienCodeSigner', () => {
  it('on his own screen there is no code signer and nothing is read', () => {
    const { result } = renderHook(() => useLienCodeSigner({ otherScreen: false, masterId: 'master-1', leaderName: 'ZZ Test Leader', jobId: 'job-1' }))
    expect(result.current.codeSigner).toBeNull()
    expect(result.current.codeReady).toBe(false)
    expect(io.reads).toEqual([])
  })

  it('on someone else’s screen it reads his code once, and is ready when the code is set', async () => {
    const { result } = renderHook(() => useLienCodeSigner({ otherScreen: true, masterId: 'master-1', leaderName: 'ZZ Test Leader', jobId: 'job-1' }))
    expect(result.current.codeSigner?.status).toBe('loading')
    await waitFor(() => expect(result.current.codeReady).toBe(true))
    expect(result.current.codeSigner?.firstName).toBe('ZZ')
    expect(io.reads).toEqual(['master-1'])
  })

  it('a read that fails says the code is not live', async () => {
    io.fail = true
    const { result } = renderHook(() => useLienCodeSigner({ otherScreen: true, masterId: 'master-1', leaderName: 'ZZ Test Leader', jobId: 'job-1' }))
    await waitFor(() => expect(result.current.codeSigner?.status).toBe('not_live'))
    expect(result.current.codeReady).toBe(false)
  })

  it('reads again for a new job, and when a refused code says the status went stale; a problem clears with the read', async () => {
    const { result, rerender } = renderHook(({ jobId }) => useLienCodeSigner({ otherScreen: true, masterId: 'master-1', leaderName: 'ZZ Test Leader', jobId }), { initialProps: { jobId: 'job-1' } })
    await waitFor(() => expect(io.reads).toHaveLength(1))
    act(() => result.current.setCodeProblem('Wrong code. 2 tries left.'))
    expect(result.current.codeProblem).toBe('Wrong code. 2 tries left.')
    rerender({ jobId: 'job-2' })
    await waitFor(() => expect(io.reads).toHaveLength(2))
    expect(result.current.codeProblem).toBeNull()
    act(() => result.current.refreshCodeStatus())
    await waitFor(() => expect(io.reads).toHaveLength(3))
  })
})

describe('useLienDeskPayPage', () => {
  const rows = [{ invoiceId: 'inv-1', label: 'Invoice #9001-1', description: 'Rough-in', openAmount: 500, payable: true }]
  const useHarness = (over: Partial<LienDeskPayPageInput> = {}, touchDraft = () => {}) => {
    const [payLineEdits, setPayLineEdits] = useState<Record<string, string>>({})
    const [payEditing, setPayEditing] = useState<LienPayLineEditing | null>(null)
    const page = useLienDeskPayPage({ selected: null, job: undefined, openBalance: 0, issuer: null, onChanged: () => {}, billCustomer: null, noticeFields: {} as never, docExtras: {} as never, storedDraft: null, coverBlocks: [], offer: null, wordingLocked: false, payLineEdits, setPayLineEdits, payEditing, setPayEditing, payPaperRef: { current: null }, payInputRef: { current: null }, touchDraft, ...over })
    return { page, payLineEdits, payEditing, setPayEditing }
  }

  it('with no job on the pane there is no page, and billing says where it opens', () => {
    const { result } = renderHook(() => useHarness())
    expect(result.current.page.payHtml).toBe('')
    expect(result.current.page.payBlocks).toEqual([])
    expect(result.current.page.unbilled).toBe(0)
    expect(result.current.page.billWhy).toBe('Billing opens from the Pipeline on this screen')
    expect(result.current.page.payChangedCount).toBe(0)
  })

  it('a typed line is kept trimmed, counts as changed and touches the draft', () => {
    io.rows = rows
    const touchDraft = vi.fn()
    const { result } = renderHook(() => useHarness({}, touchDraft))
    act(() => result.current.setPayEditing({ invoiceId: 'inv-1', value: '  Rough-in, second floor  ', rect: { top: 0, left: 0, width: 10, height: 10 }, font: '' }))
    act(() => result.current.page.commitPayEdit())
    expect(result.current.payEditing).toBeNull()
    expect(result.current.payLineEdits).toEqual({ 'inv-1': 'Rough-in, second floor' })
    expect(result.current.page.payChanged).toEqual({ 'inv-1': 'Rough-in, second floor' })
    expect(result.current.page.payChangedCount).toBe(1)
    expect(touchDraft).toHaveBeenCalled()
  })

  it('a line typed back to the bill’s own words is not a change', () => {
    io.rows = rows
    const { result } = renderHook(() => useHarness())
    act(() => result.current.setPayEditing({ invoiceId: 'inv-1', value: 'Rough-in', rect: { top: 0, left: 0, width: 10, height: 10 }, font: '' }))
    act(() => result.current.page.commitPayEdit())
    expect(result.current.page.payChangedCount).toBe(0)
  })

  it('committing with nothing being typed changes nothing', () => {
    const touchDraft = vi.fn()
    const { result } = renderHook(() => useHarness({}, touchDraft))
    act(() => result.current.page.commitPayEdit())
    expect(result.current.payLineEdits).toEqual({})
    expect(touchDraft).not.toHaveBeenCalled()
  })
})
