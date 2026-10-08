// @vitest-environment jsdom
/**
 * usePeopleMergeDuplicates (#46 row 6, v2.4945): the Hours tab's person/user duplicates. Looked
 * for only while the tab is open to a pay viewer; Merge finds the account, merges, reloads pay
 * config, drops the row and lets the page reload the grid; a failed merge says why and frees the
 * button; the page's invite flow drops the one it merged.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'

vi.mock('../lib/supabase', () => ({ supabase: {} }))
const merge = vi.hoisted(() => ({ mergePersonIntoUser: vi.fn((..._args: unknown[]) => Promise.resolve()) }))
vi.mock('../lib/mergePersonUserDuplicates', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/mergePersonUserDuplicates')>()
  return { ...actual, mergePersonIntoUser: merge.mergePersonIntoUser }
})

import { usePeopleMergeDuplicates, type UsePeopleMergeDuplicatesInput } from './usePeopleMergeDuplicates'

const PAY = { hourly_wage: 30, is_salary: false, record_hours_but_salary: false }
const setError = vi.fn()
const loadPayConfig = vi.fn(() => Promise.resolve())
const afterMerge = vi.fn()

// Bobby on the roster and Robert Smith's account share an email; the pay row is under Bobby.
const BASE: UsePeopleMergeDuplicatesInput = {
  enabled: true,
  people: [
    { id: 'p-bobby', name: 'Bobby', email: 'bob@example.com' },
    { id: 'p-ana', name: 'Ana Ruiz', email: null },
  ],
  users: [{ id: 'u-robert', name: 'Robert Smith', email: 'Bob@example.com' }],
  payConfig: { Bobby: { person_name: 'Bobby', ...PAY }, 'Ana Ruiz': { person_name: 'Ana Ruiz', ...PAY } },
  setError,
  loadPayConfig,
  afterMerge,
}
const BOBBY = { personName: 'Bobby', userDisplayName: 'Robert Smith', email: 'bob@example.com' }

beforeEach(() => {
  merge.mergePersonIntoUser.mockReset()
  merge.mergePersonIntoUser.mockImplementation(() => Promise.resolve())
  setError.mockClear()
  loadPayConfig.mockClear()
  afterMerge.mockClear()
})
afterEach(cleanup)

describe('usePeopleMergeDuplicates', () => {
  it('finds the duplicates while enabled, and none otherwise', async () => {
    const { result, rerender } = renderHook((p: UsePeopleMergeDuplicatesInput) => usePeopleMergeDuplicates(p), { initialProps: BASE })
    await waitFor(() => expect(result.current.mergeDuplicates).toEqual([BOBBY]))
    rerender({ ...BASE, enabled: false })
    await waitFor(() => expect(result.current.mergeDuplicates).toEqual([]))
    rerender({ ...BASE, payConfig: {} })
    await waitFor(() => expect(result.current.mergeDuplicates).toEqual([]))
  })

  it('Merge finds the account by email, merges, reloads pay config, drops the row, then lets the page reload', async () => {
    const { result } = renderHook(() => usePeopleMergeDuplicates(BASE))
    await waitFor(() => expect(result.current.mergeDuplicates).toHaveLength(1))
    await act(async () => {
      await result.current.handleMergeDuplicate(BOBBY)
    })
    expect(merge.mergePersonIntoUser).toHaveBeenCalledWith('Bobby', 'Robert Smith', BASE.payConfig, 'u-robert', [
      { id: 'p-bobby', name: 'Bobby', email: 'bob@example.com' },
      { id: 'p-ana', name: 'Ana Ruiz', email: null },
    ])
    expect(setError).toHaveBeenCalledWith(null)
    expect(loadPayConfig).toHaveBeenCalledTimes(1)
    expect(afterMerge).toHaveBeenCalledTimes(1)
    expect(result.current.mergeDuplicates).toEqual([])
    expect(result.current.mergingPersonName).toBeNull()
  })

  it('with no email, the account is found by the pay name, then by the display name', async () => {
    const users = [{ id: 'u-robert', name: 'Robert Smith', email: null }]
    const { result } = renderHook(() => usePeopleMergeDuplicates({ ...BASE, users }))
    await act(async () => {
      await result.current.handleMergeDuplicate({ ...BOBBY, email: '' })
    })
    expect(merge.mergePersonIntoUser.mock.calls[0]?.[3]).toBe('u-robert')
  })

  it('a failed merge says why, keeps the row and frees the button', async () => {
    merge.mergePersonIntoUser.mockImplementation(() => Promise.reject(new Error('Pay row is locked')))
    const { result } = renderHook(() => usePeopleMergeDuplicates(BASE))
    await waitFor(() => expect(result.current.mergeDuplicates).toHaveLength(1))
    await act(async () => {
      await result.current.handleMergeDuplicate(BOBBY)
    })
    expect(setError).toHaveBeenLastCalledWith('Pay row is locked')
    expect(loadPayConfig).not.toHaveBeenCalled()
    expect(afterMerge).not.toHaveBeenCalled()
    expect(result.current.mergeDuplicates).toEqual([BOBBY])
    expect(result.current.mergingPersonName).toBeNull()
  })

  it('shows the row as merging while the merge runs', async () => {
    let finish: () => void = () => {}
    merge.mergePersonIntoUser.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve }))
    const { result } = renderHook(() => usePeopleMergeDuplicates(BASE))
    let pending: Promise<void> = Promise.resolve()
    act(() => {
      pending = result.current.handleMergeDuplicate(BOBBY)
    })
    expect(result.current.mergingPersonName).toBe('Bobby')
    await act(async () => {
      finish()
      await pending
    })
    expect(result.current.mergingPersonName).toBeNull()
  })

  it('the invite flow drops the duplicate it merged', async () => {
    const { result } = renderHook(() => usePeopleMergeDuplicates(BASE))
    await waitFor(() => expect(result.current.mergeDuplicates).toHaveLength(1))
    act(() => result.current.dropMergeDuplicate('Bobby'))
    expect(result.current.mergeDuplicates).toEqual([])
  })
})
