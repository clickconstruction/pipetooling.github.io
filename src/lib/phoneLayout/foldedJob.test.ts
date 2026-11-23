import { afterEach, describe, expect, it, vi } from 'vitest'
import { foldedJobId, setFoldedJobId, subscribeFoldedJob } from './foldedJob'

afterEach(() => setFoldedJobId(null))

describe('the job whose squares the card holds', () => {
  it('is none until the card says one', () => {
    expect(foldedJobId()).toBeNull()
  })

  it('is the job the card last said, and none again when the card lets go', () => {
    setFoldedJobId('job-1')
    expect(foldedJobId()).toBe('job-1')
    setFoldedJobId(null)
    expect(foldedJobId()).toBeNull()
  })

  it('reads an empty id as none', () => {
    setFoldedJobId('')
    expect(foldedJobId()).toBeNull()
  })

  it('tells whoever listens, once a change, and not for the same job said twice', () => {
    const heard = vi.fn()
    const stop = subscribeFoldedJob(heard)
    setFoldedJobId('job-1')
    setFoldedJobId('job-1')
    expect(heard).toHaveBeenCalledTimes(1)
    setFoldedJobId('job-2')
    expect(heard).toHaveBeenCalledTimes(2)
    stop()
    setFoldedJobId(null)
    expect(heard).toHaveBeenCalledTimes(2)
  })
})
