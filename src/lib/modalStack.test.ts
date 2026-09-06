import { beforeEach, describe, expect, it } from 'vitest'

import { isTopmostModal, modalStackDepth, registerModal, resetModalStackForTests, unregisterModal } from './modalStack'

describe('modalStack', () => {
  beforeEach(() => resetModalStackForTests())

  it('the only open modal is topmost', () => {
    const a = registerModal()
    expect(isTopmostModal(a)).toBe(true)
    expect(modalStackDepth()).toBe(1)
  })

  it('a modal opened later is topmost; the one underneath is not (Escape on New Job leaves Edit Bid alone)', () => {
    const editBid = registerModal()
    const newJob = registerModal()
    expect(isTopmostModal(newJob)).toBe(true)
    expect(isTopmostModal(editBid)).toBe(false)
  })

  it('closing the top modal hands topmost back to the one underneath', () => {
    const editBid = registerModal()
    const newJob = registerModal()
    unregisterModal(newJob)
    expect(isTopmostModal(editBid)).toBe(true)
    expect(modalStackDepth()).toBe(1)
  })

  it('a lower modal can unmount first without disturbing the top', () => {
    const lower = registerModal()
    const top = registerModal()
    unregisterModal(lower)
    expect(isTopmostModal(top)).toBe(true)
    expect(modalStackDepth()).toBe(1)
  })

  it('unregistering twice or an unknown id is a no-op', () => {
    const a = registerModal()
    unregisterModal(a)
    unregisterModal(a)
    unregisterModal(9999)
    expect(modalStackDepth()).toBe(0)
    expect(isTopmostModal(a)).toBe(false)
  })

  it('handles are unique across registrations', () => {
    const a = registerModal()
    unregisterModal(a)
    const b = registerModal()
    expect(b).not.toBe(a)
  })
})
