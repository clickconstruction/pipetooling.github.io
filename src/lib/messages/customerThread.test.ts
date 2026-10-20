import { describe, expect, it } from 'vitest'
import { threadFromSearch } from '../../components/gc/messages/useThreadWindow'
import type { ContactKind } from '../contacts/kernel'
import { GC_THREAD_KINDS, MESSAGES_PATH, messagesButtonLabel, messagesThreadHref, threadHrefByKind } from './customerThread'

describe('a customer’s thread from their name', () => {
  it('opens the thread over the Messages page, as the thread window reads its URL', () => {
    const href = messagesThreadHref('c-dana')
    expect(href).toBe('/messages?thread=c-dana')
    const [path, search] = href.split('?')
    expect(path).toBe(MESSAGES_PATH)
    expect(threadFromSearch(new URLSearchParams(search))).toEqual({ contactId: 'c-dana', at: null })
  })

  it('opens it at a line when one is named, as the thread window reads it', () => {
    const href = messagesThreadHref('c-dana', 'm-dana-2')
    expect(href).toBe('/messages?thread=c-dana&at=m-dana-2')
    expect(threadFromSearch(new URLSearchParams(href.split('?')[1]))).toEqual({ contactId: 'c-dana', at: 'm-dana-2' })
    expect(messagesThreadHref('c-dana', null)).toBe('/messages?thread=c-dana')
  })

  it('sends Job activity’s line by who it is with: a trade partner or an architect to GC projects, anyone else here', () => {
    const kinds: ContactKind[] = ['customer', 'trade', 'arch', 'lead', 'supply_house', 'candidate', 'sub', 'unknown']
    const where = Object.fromEntries(kinds.map((k) => [k, threadHrefByKind(k, 'c-1', 'm-1').split('?')[0]]))
    expect(where).toEqual({
      customer: '/messages',
      trade: '/gc',
      arch: '/gc',
      lead: '/messages',
      supply_house: '/messages',
      candidate: '/messages',
      sub: '/messages',
      unknown: '/messages',
    })
    expect(threadHrefByKind('trade', 'c-1', 'm-1')).toBe('/gc?view=messages&thread=c-1&at=m-1')
    expect(threadHrefByKind('customer', 'c-1', 'm-1')).toBe('/messages?thread=c-1&at=m-1')
    expect([...GC_THREAD_KINDS]).toEqual(['trade', 'arch'])
  })

  it('keeps an id whole however it is spelled', () => {
    const href = messagesThreadHref('a b&c')
    expect(threadFromSearch(new URLSearchParams(href.split('?')[1]))?.contactId).toBe('a b&c')
  })

  it('names the customer on the button, or says the customer when the name is blank', () => {
    expect(messagesButtonLabel(' Dana Whitfield ')).toBe('Open Dana Whitfield’s messages')
    expect(messagesButtonLabel('')).toBe('Open the customer’s messages')
    expect(messagesButtonLabel(null)).toBe('Open the customer’s messages')
  })
})
