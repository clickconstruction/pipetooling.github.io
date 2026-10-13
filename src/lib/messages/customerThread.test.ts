import { describe, expect, it } from 'vitest'
import { threadFromSearch } from '../../components/gc/messages/useThreadWindow'
import { MESSAGES_PATH, messagesButtonLabel, messagesThreadHref } from './customerThread'

describe('a customer’s thread from their name', () => {
  it('opens the thread over the Messages page, as the thread window reads its URL', () => {
    const href = messagesThreadHref('c-dana')
    expect(href).toBe('/messages?thread=c-dana')
    const [path, search] = href.split('?')
    expect(path).toBe(MESSAGES_PATH)
    expect(threadFromSearch(new URLSearchParams(search))).toEqual({ contactId: 'c-dana', at: null })
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
