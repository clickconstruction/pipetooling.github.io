// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { Contact } from '../../../lib/contacts/kernel'
import type { ThreadMessage } from '../../../lib/messages/thread'
import { useThreadSlots } from './threadSlots'
import { threadFromSearch, useThreadWindow, withoutThread, withThread } from './useThreadWindow'

// Cut 4b's slots read the open thread through their own hook; here they are a marker, to see them reach the window.
vi.mock('../../changeOrders/useChangeOrderThreadSlots', () => ({
  useChangeOrderThreadSlots: () => ({ underLine: () => 'became CO 1', messageWindowFirst: () => 'Start a change order' }),
}))

const at = (url: string) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  }

describe('opening a thread on /gc (the URL holds it)', () => {
  it('reads the thread and its line from the search, and nothing when there is none', () => {
    expect(threadFromSearch(new URLSearchParams('view=followUp&thread=c-greg&at=m-1'))).toEqual({ contactId: 'c-greg', at: 'm-1' })
    expect(threadFromSearch(new URLSearchParams('thread=c-greg'))).toEqual({ contactId: 'c-greg', at: null })
    expect(threadFromSearch(new URLSearchParams('view=money'))).toBeNull()
    expect(threadFromSearch(new URLSearchParams('thread=%20'))).toBeNull()
  })

  it('opens and closes a thread and keeps the view and every other param', () => {
    const base = new URLSearchParams('view=followUp&focus=k1')
    expect(withThread(base, 'c-greg', 'm-1').toString()).toBe('view=followUp&focus=k1&thread=c-greg&at=m-1')
    expect(withThread(new URLSearchParams('thread=c-old&at=m-old'), 'c-greg').toString()).toBe('thread=c-greg')
    expect(withoutThread(new URLSearchParams('view=followUp&thread=c-greg&at=m-1')).toString()).toBe('view=followUp')
  })

  it('a press opens the thread over the view that is open, and closing it leaves the view', () => {
    const { result } = renderHook(() => ({ thread: useThreadWindow(), location: useLocation() }), { wrapper: at('/gc?view=followUp') })
    expect(result.current.thread).toMatchObject({ contactId: null, at: null })
    act(() => result.current.thread.openThread('c-greg', 'm-1'))
    expect(result.current.thread).toMatchObject({ contactId: 'c-greg', at: 'm-1' })
    expect(result.current.location.search).toBe('?view=followUp&thread=c-greg&at=m-1')
    act(() => result.current.thread.closeThread())
    expect(result.current.thread.contactId).toBeNull()
    expect(result.current.location.search).toBe('?view=followUp')
  })

  it('a link with a thread opens it', () => {
    const { result } = renderHook(() => useThreadWindow(), { wrapper: at('/gc?thread=c-elena&at=m-7') })
    expect(result.current).toMatchObject({ contactId: 'c-elena', at: 'm-7' })
  })

  it('hands the window each cut’s slots: cut 4’s flow at the side, cut 4b’s press in the message window and its chip under a line', () => {
    const { result } = renderHook(() => useThreadSlots())
    expect(Object.keys(result.current).sort()).toEqual(['messageWindowFirst', 'side', 'underLine'])
    const line = { id: 'm-1' } as ThreadMessage
    expect(result.current.underLine?.(line, {} as Contact)).toBe('became CO 1')
    expect(result.current.messageWindowFirst?.(line, '')).toBe('Start a change order')
  })
})
