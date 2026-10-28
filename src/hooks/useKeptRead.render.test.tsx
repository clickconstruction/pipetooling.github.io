// @vitest-environment jsdom
/**
 * The kept read's hook (#183 PR 2, v2.6031). The store is a mock, so each case says what the device
 * kept; the twin and impersonation flags are mocks too. Made-up rows.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { KEPT_READ_SCHEMA, createKeptReadOnScreenStore, type KeptRead } from '../lib/keptRead'

let twin = false
let impersonating = false
vi.mock('./useIsDigitalTwin', () => ({ useIsDigitalTwin: () => twin }))
vi.mock('../lib/impersonationSession', () => ({ isImpersonationSessionActive: () => impersonating }))

const readKept = vi.fn<(key: string) => Promise<KeptRead | null>>()
const writeKept = vi.fn<(kept: KeptRead) => Promise<void>>(async () => {})
vi.mock('../lib/keptReadStore', () => ({
  readKeptRead: (key: string) => readKept(key),
  writeKeptRead: (kept: KeptRead) => writeKept(kept),
  clearKeptReads: vi.fn(async () => {}),
}))

const { useKeptRead, useKeptReadOnScreen } = await import('./useKeptRead')

type Row = { id: string }
const KEY = 'u1:pipeline:all'
const KEPT_AT = 1_700_000_000_000
const keptRows: Row[] = [{ id: 'kept-a' }, { id: 'kept-b' }]
const liveRows: Row[] = [{ id: 'live-a' }]
const stored = (over: Partial<KeptRead<Row>> = {}): KeptRead<Row> => ({ key: KEY, schema: KEPT_READ_SCHEMA, scopes: ['working', 'waiting'], readAt: KEPT_AT, rows: keptRows, ...over })

type Props = { key: string | null; rows: readonly Row[] | null; loading: boolean; scopes?: readonly string[]; covers?: readonly string[]; failed?: boolean }
const onScreen = createKeptReadOnScreenStore()
const render = (initial: Props) =>
  renderHook((p: Props) => useKeptRead<Row>(p.key, p.rows, { loading: p.loading, scopes: p.scopes ?? ['working'], covers: p.covers, failed: p.failed, onScreen }), {
    initialProps: initial,
  })

beforeEach(() => {
  twin = false
  impersonating = false
  readKept.mockReset()
  readKept.mockResolvedValue(stored())
  writeKept.mockClear()
  vi.spyOn(Date, 'now').mockReturnValue(KEPT_AT + 60_000)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('useKeptRead', () => {
  it('hands back the kept rows with their readAt while the live read runs, tells the strip, then the live rows once it lands and writes them', async () => {
    const { result, rerender } = render({ key: KEY, rows: [], loading: true })
    await waitFor(() => expect(result.current.readAt).toBe(KEPT_AT))
    expect(result.current.rows).toEqual(keptRows)
    expect(result.current.scopes).toEqual(['working', 'waiting'])
    expect(result.current.failed).toBe(false)
    expect(onScreen.read()).toBe(KEPT_AT)
    expect(readKept).toHaveBeenCalledWith(KEY)

    rerender({ key: KEY, rows: liveRows, loading: false })
    expect(result.current.rows).toEqual(liveRows)
    expect(result.current.readAt).toBeNull()
    expect(onScreen.read()).toBeNull()
    await waitFor(() => expect(writeKept).toHaveBeenCalledTimes(1))
    expect(writeKept).toHaveBeenCalledWith({ key: KEY, schema: KEPT_READ_SCHEMA, scopes: ['working'], readAt: KEPT_AT + 60_000, rows: liveRows })
  })

  it('never shows a kept read the store answers after the live read landed', async () => {
    let release: (v: KeptRead | null) => void = () => {}
    readKept.mockImplementation(() => new Promise((r) => (release = r)))
    const { result, rerender } = render({ key: KEY, rows: [], loading: true })
    await waitFor(() => expect(readKept).toHaveBeenCalled())
    rerender({ key: KEY, rows: liveRows, loading: false })
    await act(async () => release(stored()))
    expect(result.current.rows).toEqual(liveRows)
    expect(result.current.readAt).toBeNull()
  })

  it('a refresh of the landed key reads nothing kept and writes the rows again when it lands', async () => {
    const { result, rerender } = render({ key: KEY, rows: liveRows, loading: false })
    rerender({ key: KEY, rows: liveRows, loading: true })
    rerender({ key: KEY, rows: liveRows, loading: false })
    await waitFor(() => expect(writeKept).toHaveBeenCalledTimes(1))
    readKept.mockClear()
    const fresher: Row[] = [{ id: 'live-b' }]
    rerender({ key: KEY, rows: liveRows, loading: true })
    expect(result.current.readAt).toBeNull()
    rerender({ key: KEY, rows: fresher, loading: false })
    await waitFor(() => expect(writeKept).toHaveBeenCalledTimes(2))
    expect(writeKept).toHaveBeenLastCalledWith(expect.objectContaining({ rows: fresher }))
    expect(readKept).not.toHaveBeenCalled()
  })

  it('a failed live read leaves the kept rows up and says so, writes nothing, and a retry that lands replaces them', async () => {
    const { result, rerender } = render({ key: KEY, rows: [], loading: true })
    await waitFor(() => expect(result.current.readAt).toBe(KEPT_AT))
    rerender({ key: KEY, rows: [], loading: false, failed: true })
    expect(result.current.rows).toEqual(keptRows)
    expect(result.current.readAt).toBe(KEPT_AT)
    expect(result.current.failed).toBe(true)
    expect(onScreen.read()).toBe(KEPT_AT)
    expect(writeKept).not.toHaveBeenCalled()

    rerender({ key: KEY, rows: [], loading: true })
    expect(result.current.rows).toEqual(keptRows)
    expect(result.current.failed).toBe(false)
    rerender({ key: KEY, rows: liveRows, loading: false })
    expect(result.current.rows).toEqual(liveRows)
    expect(result.current.readAt).toBeNull()
    await waitFor(() => expect(writeKept).toHaveBeenCalledTimes(1))
  })

  it('a failed first read with nothing kept hands back the live rows as they are', () => {
    readKept.mockResolvedValue(null)
    const { result, rerender } = render({ key: KEY, rows: [], loading: true })
    rerender({ key: KEY, rows: [], loading: false, failed: true })
    expect(result.current).toEqual({ rows: [], readAt: null, scopes: null, failed: false })
    expect(writeKept).not.toHaveBeenCalled()
  })

  it('never keeps a half page: no edge, no write', () => {
    const { rerender } = render({ key: KEY, rows: [{ id: 'first-section' }], loading: true })
    rerender({ key: KEY, rows: [{ id: 'first-section' }, { id: 'second-section' }], loading: true })
    expect(writeKept).not.toHaveBeenCalled()
  })

  it('a kept read that does not cover a wanted scope is not shown', async () => {
    readKept.mockResolvedValue(stored({ scopes: ['working'] }))
    const { result, rerender } = render({ key: KEY, rows: [], loading: true, scopes: ['working', 'billed_all'] })
    await waitFor(() => expect(readKept).toHaveBeenCalled())
    rerender({ key: KEY, rows: [], loading: true, scopes: ['working', 'billed_all'] })
    await act(async () => {})
    expect(result.current.readAt).toBeNull()
  })

  it('writes what the landed rows cover when the page says it is wider than what it asked for', async () => {
    const { rerender } = render({ key: KEY, rows: [], loading: true, covers: [] })
    rerender({ key: KEY, rows: liveRows, loading: false, scopes: ['working'], covers: ['working', 'waiting', 'billed_all'] })
    await waitFor(() => expect(writeKept).toHaveBeenCalledTimes(1))
    expect(writeKept).toHaveBeenLastCalledWith(expect.objectContaining({ scopes: ['working', 'waiting', 'billed_all'] }))
  })

  it('a key change drops the kept rows of the old key and looks for the new one', async () => {
    const { result, rerender } = render({ key: KEY, rows: [], loading: true })
    await waitFor(() => expect(result.current.readAt).toBe(KEPT_AT))
    readKept.mockResolvedValue(null)
    rerender({ key: 'u1:pipeline:cust-9', rows: [], loading: true })
    await waitFor(() => expect(result.current.readAt).toBeNull())
    expect(result.current.rows).toEqual([])
    expect(readKept).toHaveBeenLastCalledWith('u1:pipeline:cust-9')
  })

  it('a twin never reads or writes a kept read', async () => {
    twin = true
    const { result, rerender } = render({ key: KEY, rows: [], loading: true })
    rerender({ key: KEY, rows: liveRows, loading: false })
    await act(async () => {})
    expect(result.current).toEqual({ rows: liveRows, readAt: null, scopes: null, failed: false })
    expect(readKept).not.toHaveBeenCalled()
    expect(writeKept).not.toHaveBeenCalled()
  })

  it('an impersonated session never reads or writes a kept read', async () => {
    impersonating = true
    const { rerender } = render({ key: KEY, rows: [], loading: true })
    rerender({ key: KEY, rows: liveRows, loading: false })
    await act(async () => {})
    expect(readKept).not.toHaveBeenCalled()
    expect(writeKept).not.toHaveBeenCalled()
  })

  it('does nothing with no key', async () => {
    const { result, rerender } = render({ key: null, rows: [], loading: true })
    rerender({ key: null, rows: liveRows, loading: false })
    await act(async () => {})
    expect(result.current).toEqual({ rows: liveRows, readAt: null, scopes: null, failed: false })
    expect(readKept).not.toHaveBeenCalled()
    expect(writeKept).not.toHaveBeenCalled()
  })
})

describe('useKeptReadOnScreen', () => {
  it('follows the registry', () => {
    const store = createKeptReadOnScreenStore()
    const { result } = renderHook(() => useKeptReadOnScreen(store))
    expect(result.current).toBeNull()
    act(() => store.show('board', 5))
    expect(result.current).toBe(5)
    act(() => store.hide('board'))
    expect(result.current).toBeNull()
  })
})
