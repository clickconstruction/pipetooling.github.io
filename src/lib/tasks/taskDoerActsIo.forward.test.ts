/**
 * Forward tells whoever takes the task (v2.7563): Hand it on's words, sent through the same push, and nothing sent
 * when there is nobody else to tell.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: {} }))

import { tellForwardTaker } from './taskDoerActsIo'

const TASK = { byUserId: 'u-me', toUserId: 'u-hal', instanceId: 'i-1', taskTitle: 'Sort the fittings wall' }

describe('tellForwardTaker', () => {
  it('sends the taker the hand-on push in the forwarder’s name', async () => {
    const tell = vi.fn(async () => {})
    await tellForwardTaker(TASK, { tell, nameOf: async () => 'Theo' })
    expect(tell).toHaveBeenCalledWith({ giverId: 'u-hal', instanceId: 'i-1', title: 'A task was handed to you', body: 'Theo handed you "Sort the fittings wall".' })
  })

  it('still sends when the name cannot be read', async () => {
    const tell = vi.fn(async () => {})
    await tellForwardTaker(TASK, { tell, nameOf: async () => { throw new Error('offline') } })
    expect(tell.mock.calls[0][0].body).toBe('Someone handed you "Sort the fittings wall".')
  })

  it('tells nobody when the task comes back to the forwarder', async () => {
    const tell = vi.fn(async () => {})
    await tellForwardTaker({ ...TASK, toUserId: 'u-me' }, { tell, nameOf: async () => 'Theo' })
    expect(tell).not.toHaveBeenCalled()
  })
})
