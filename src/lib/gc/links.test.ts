import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { threadFromSearch } from '../../components/gc/messages/useThreadWindow'
import { billDayFromSearch, billDayHref, GC_FOLLOW_UP_HREF, GC_MESSAGES_HREF, GC_MONEY_HREF, GC_PROJECT_WORDS, gcFocusFromSearch, gcProjectHref, gcViewFromSearch, messagesThreadHref } from './links'

describe('GC project links', () => {
  it('opens a GC project on its card on the GC projects page', () => {
    expect(gcProjectHref('ef8905d1-039a-4cbc-9d69-9468cfea50e0')).toBe('/gc?focus=ef8905d1-039a-4cbc-9d69-9468cfea50e0')
    expect(gcFocusFromSearch(new URLSearchParams('focus=abc'))).toBe('abc')
    expect(gcFocusFromSearch(new URLSearchParams('book=1'))).toBeNull()
    expect(gcFocusFromSearch(new URLSearchParams('focus=%20'))).toBeNull()
  })

  it('opens the GC projects page on the view a link names', () => {
    expect(gcViewFromSearch(new URLSearchParams(GC_FOLLOW_UP_HREF.split('?')[1]))).toBe('followUp')
    expect(gcViewFromSearch(new URLSearchParams('view=partners'))).toBe('partners')
    expect(gcViewFromSearch(new URLSearchParams(GC_MONEY_HREF.split('?')[1]))).toBe('money')
    expect(gcViewFromSearch(new URLSearchParams(GC_MESSAGES_HREF.split('?')[1]))).toBe('messages')
    expect(gcViewFromSearch(new URLSearchParams('focus=abc'))).toBe('board')
    expect(gcViewFromSearch(new URLSearchParams('view=portals'))).toBe('board')
  })

  it('opens Bill day’s From the trades on one job, in the Money view', () => {
    const href = billDayHref('ef8905d1-039a-4cbc-9d69-9468cfea50e0')
    expect(href).toBe('/gc?view=money&billday=ef8905d1-039a-4cbc-9d69-9468cfea50e0')
    const search = new URLSearchParams(href.split('?')[1])
    expect([gcViewFromSearch(search), billDayFromSearch(search)]).toEqual(['money', 'ef8905d1-039a-4cbc-9d69-9468cfea50e0'])
    expect(billDayFromSearch(new URLSearchParams('view=money'))).toBeNull()
    expect(billDayFromSearch(new URLSearchParams('billday=%20'))).toBeNull()
  })

  it('opens a person’s thread over Messages, at a line when one is named', () => {
    const href = messagesThreadHref('c-dana', 'm-dana-2')
    expect(href).toBe('/gc?view=messages&thread=c-dana&at=m-dana-2')
    const search = new URLSearchParams(href.split('?')[1])
    expect(gcViewFromSearch(search)).toBe('messages')
    expect(threadFromSearch(search)).toEqual({ contactId: 'c-dana', at: 'm-dana-2' })
    expect(threadFromSearch(new URLSearchParams(messagesThreadHref('c-dana').split('?')[1]))).toEqual({ contactId: 'c-dana', at: null })
  })

  it('says it in plain words', () => {
    for (const [key, words] of Object.entries(GC_PROJECT_WORDS)) expect(plainWordsFailures(words), key).toEqual([])
  })
})
