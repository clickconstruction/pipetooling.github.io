// @vitest-environment jsdom
/**
 * Messages, cut 2's screens, C2: the pieces cut 3's reply box takes (v2.5319). A note's day to come back
 * (`NoteBackDay`), the settle the owed strip hands the box (`useOwedSettling`, active for one person, a done that writes
 * the note on the line's job and never toasts, an empty note refused before any write, a refusal keeping the settle),
 * and the line over the box while it settles (`SettlingNote`).
 */
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { owedStore } from '../../lib/followUp/owedStore'
import { OWED_DONE_NEEDS_A_NOTE, type Owed } from '../../lib/messages/owed'
import { NoteBackDay } from './NoteBackDay'
import { SettlingNote } from './SettlingNote'
import { useOwedSettling } from './useOwedSettling'
import { useOwedAfterSend, useThreadOwed } from './useThreadOwed'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const OWED: Owed = { what: 'the start date', byYmd: '2026-10-05', byWords: null, markedBy: 'Rosa', markedAt: '2026-09-26T19:30:00.000Z' }

afterEach(() => {
  cleanup()
  act(() => {
    owedStore.cancel(owedStore.get().contactId)
    owedStore.unpublish(owedStore.get().open?.contactId ?? null)
  })
})

describe('NoteBackDay', () => {
  it('picks a chip, keeps words that are not a day, and clears with No day', () => {
    const onChange = vi.fn()
    const { rerender } = render(<NoteBackDay value={null} onChange={onChange} todayYmd="2026-10-02" />)
    fireEvent.click(screen.getByRole('button', { name: 'Mon Oct 5' }))
    expect(onChange).toHaveBeenLastCalledWith({ ymd: '2026-10-05', words: null })

    const typed = screen.getByRole('textbox', { name: 'A day to bring it back' })
    fireEvent.change(typed, { target: { value: 'after the walk' } })
    expect(screen.getByText('Cannot read that as a day. Enter keeps it as typed.')).toBeTruthy()
    fireEvent.keyDown(typed, { key: 'Enter' })
    expect(onChange).toHaveBeenLastCalledWith({ ymd: null, words: 'after the walk' })

    rerender(<NoteBackDay value={{ ymd: '2026-10-05', words: null }} onChange={onChange} todayYmd="2026-10-02" />)
    expect(screen.getByRole('button', { name: 'Mon Oct 5' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'No day ×' }))
    expect(onChange).toHaveBeenLastCalledWith(null)
  })
})

describe('useOwedSettling', () => {
  it('is active only for the person being settled, and Not done yet ends it', () => {
    const { result, rerender } = renderHook(({ id }: { id: string | null }) => useOwedSettling(id, { owedDone: vi.fn() }), { initialProps: { id: 'priya' } })
    expect(result.current.active).toBe(false)
    act(() => owedStore.start('priya', OWED))
    expect(result.current).toMatchObject({ active: true, owed: OWED })
    rerender({ id: 'greg' })
    expect(result.current).toMatchObject({ active: false, owed: null })
    rerender({ id: 'priya' })
    act(() => result.current.cancel())
    expect(result.current.active).toBe(false)
  })

  it('done writes the note on the line’s job and moves the version; an empty note is refused before any write', async () => {
    const owedDone = vi.fn(async () => 'n1')
    const { result } = renderHook(() => useOwedSettling('priya', { owedDone }))
    act(() => owedStore.start('priya', OWED))
    await expect(result.current.done('   ', 'project:p1')).rejects.toThrow(OWED_DONE_NEEDS_A_NOTE)
    expect(owedDone).not.toHaveBeenCalled()

    const before = owedStore.get().version
    await act(async () => {
      await result.current.done(' Sent the start date by email. ', 'project:p1')
    })
    expect(owedDone).toHaveBeenCalledWith('priya', 'Sent the start date by email.', { kind: 'project', id: 'p1' })
    expect(owedStore.get().version).toBe(before + 1)
    expect(result.current.active).toBe(false)
  })

  it('a refused write keeps the settle, so the box keeps its draft', async () => {
    const owedDone = vi.fn(async () => Promise.reject(new Error('That conversation is not there.')))
    const { result } = renderHook(() => useOwedSettling('priya', { owedDone }))
    act(() => owedStore.start('priya', OWED))
    await expect(result.current.done('Sent it.', null)).rejects.toThrow('That conversation is not there.')
    expect(owedDone).toHaveBeenCalledWith('priya', 'Sent it.', null)
    expect(result.current.active).toBe(true)
  })
})

describe('SettlingNote', () => {
  it('says what we owed and who marked it, with Not done yet', () => {
    const onNotYet = vi.fn()
    render(<SettlingNote owed={OWED} onNotYet={onNotYet} nowIso="2026-10-02T17:00:00.000Z" />)
    expect(screen.getByText('Marking it done: we owed the start date · by Mon Oct 5')).toBeTruthy()
    expect(screen.getByText(/^· marked by Rosa, /)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Not done yet' }))
    expect(onNotYet).toHaveBeenCalledTimes(1)
  })
})

describe('useThreadOwed and useOwedAfterSend (the box’s send window)', () => {
  it('reads what cut 2 read for the open person, and nothing for anyone else', () => {
    const { result, rerender } = renderHook(({ id }: { id: string | null }) => useThreadOwed(id), { initialProps: { id: 'priya' } })
    expect(result.current).toEqual({ owed: null, loaded: false })
    act(() => owedStore.publish('priya', OWED))
    expect(result.current).toEqual({ owed: OWED, loaded: true })
    rerender({ id: 'greg' })
    expect(result.current).toEqual({ owed: null, loaded: false })
  })

  it('marks what we still owe and a send that got it done, each letting cut 2 read again', async () => {
    const io = { markOwed: vi.fn(async () => 'o1'), owedSentDone: vi.fn(async () => undefined) }
    const { result } = renderHook(() => useOwedAfterSend('priya', io))
    const before = owedStore.get().version
    await act(async () => {
      await result.current.mark(' the start date ', { ymd: '2026-10-05', words: null })
    })
    expect(io.markOwed).toHaveBeenCalledWith('priya', 'the start date', { ymd: '2026-10-05', words: null })
    await act(async () => {
      await result.current.sentDone('m9')
    })
    expect(io.owedSentDone).toHaveBeenCalledWith('priya', 'm9')
    expect(owedStore.get().version).toBe(before + 2)
    await expect(result.current.mark('  ', { ymd: null, words: null })).rejects.toThrow('Say what we still owe them.')
    expect(io.markOwed).toHaveBeenCalledTimes(1)
  })
})
