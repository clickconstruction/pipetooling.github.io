// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { Contact } from '../../../lib/contacts/kernel'
import { lineFilesFromRows } from '../../../lib/messages/lineFiles'
import { SPINE_ATTACHMENTS } from '../../../lib/messages/spineRows'
import type { ThreadMessage } from '../../../lib/messages/thread'
import { PaperOffers } from './PaperOffers'
import { useThreadSlots } from './threadSlots'
import { threadFromSearch, useThreadWindow, withoutThread, withThread } from './useThreadWindow'

// Cut 2's slots (Follow up) and cut 4b's read the open thread through their own hooks; here they are markers, to see them reach the window.
const cut2 = vi.hoisted(() => ({ headerRight: () => null, statusRow: () => null, menuRows: () => [] }))
vi.mock('../../followUp/useFollowUpThreadSlots', () => ({ useFollowUpThreadSlots: () => cut2 }))
vi.mock('../../changeOrders/useChangeOrderThreadSlots', () => ({
  useChangeOrderThreadSlots: () => ({ underLine: () => 'became CO 1', messageWindowFirst: () => 'Start a change order' }),
}))
// R8 · 8's slots fill nothing here, so cut 4b's reach the window as themselves.
vi.mock('../../estimates/useEstimateLineThreadSlots', () => ({ useEstimateLineThreadSlots: () => ({}) }))

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

  it('hands the window each cut’s slots: cut 2’s who has it, status row and ⋯ rows, cut 3’s reply box, cut 4’s flow at the side, cut 4b’s press in the message window and its chip under a line, then cut 6’s paper offer', () => {
    const { result } = renderHook(() => useThreadSlots())
    expect(Object.keys(result.current).sort()).toEqual(['box', 'headerRight', 'menuRows', 'messageWindowFirst', 'side', 'statusRow', 'underLine'])
    expect(result.current.headerRight).toBe(cut2.headerRight)
    expect(result.current.statusRow).toBe(cut2.statusRow)
    expect(result.current.menuRows?.({} as Contact)).toEqual([])
    const line = { id: 'm-1' } as ThreadMessage
    expect(result.current.underLine?.(line, {} as Contact)).toBe('became CO 1')
    expect(result.current.messageWindowFirst?.(line, '')).toBe('Start a change order')
    // A trade partner's certificate on the line draws cut 4b's chip, then cut 6's offer.
    const coi = lineFilesFromRows([{ ...SPINE_ATTACHMENTS[0]!, message_id: 'm-1', paper: 'coi' }]).get('m-1')!
    const both = result.current.underLine?.({ ...line, files: coi }, { kind: 'trade', company: 'Hillside Excavation', name: 'Greg Paulk' } as Contact) as ReactElement<{ children: ReactElement<{ children: unknown }>[] }>
    const drawn = both.props.children.map((part) => part.props.children)
    expect(drawn[0]).toBe('became CO 1')
    expect((drawn[1] as ReactElement).type).toBe(PaperOffers)
  })
})
