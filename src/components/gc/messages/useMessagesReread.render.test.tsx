// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MessagesRereadContext, useMessagesReread } from './useMessagesReread'

describe('useMessagesReread', () => {
  it('does nothing with no provider, so a slot renders anywhere', () => {
    const { result } = renderHook(() => useMessagesReread())
    expect(result.current()).toBeUndefined()
  })

  it('hands a slot the page\'s read', () => {
    const reread = vi.fn()
    const wrapper = ({ children }: { children: ReactNode }) => <MessagesRereadContext.Provider value={reread}>{children}</MessagesRereadContext.Provider>
    const { result } = renderHook(() => useMessagesReread(), { wrapper })
    result.current()
    expect(reread).toHaveBeenCalledTimes(1)
  })
})
