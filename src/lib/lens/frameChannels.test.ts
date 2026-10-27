import { describe, expect, it } from 'vitest'
import { frameCookieJar, frameLocks } from './frameChannels'

describe('a sealed frame\'s own locks', () => {
  it('queues exclusive locks per name and answers ifAvailable with null while held', async () => {
    const locks = frameLocks()
    const order: string[] = []
    let release!: () => void
    const first = locks.request('lock:sb-x-auth-token', async () => {
      order.push('first in')
      await new Promise<void>((r) => (release = r))
      order.push('first out')
    })
    const skipped = await locks.request('lock:sb-x-auth-token', { ifAvailable: true }, (l) => (l === null ? 'busy' : 'got it'))
    expect(skipped).toBe('busy')
    const second = locks.request('lock:sb-x-auth-token', async () => order.push('second'))
    await new Promise((r) => setTimeout(r, 0))
    expect(await locks.query()).toMatchObject({ held: [{ name: 'lock:sb-x-auth-token' }], pending: [{ name: 'lock:sb-x-auth-token' }] })
    release()
    await Promise.all([first, second])
    expect(order).toEqual(['first in', 'first out', 'second'])
  })

  it('leaves the queue with an AbortError when the wait is aborted', async () => {
    const locks = frameLocks()
    let release!: () => void
    const first = locks.request('n', () => new Promise<void>((r) => (release = r)))
    const ctl = new AbortController()
    const waiting = locks.request('n', { signal: ctl.signal }, () => 'never')
    ctl.abort()
    await expect(waiting).rejects.toMatchObject({ name: 'AbortError' })
    await new Promise((r) => setTimeout(r, 0))
    release()
    await first
  })
})

describe('a sealed frame\'s own cookie jar', () => {
  it('reads and writes as document.cookie does, and forgets an expired cookie', () => {
    const jar = frameCookieJar()
    jar.set('seen=1; path=/')
    jar.set('lang=es')
    expect(jar.get()).toBe('seen=1; lang=es')
    jar.set('seen=; expires=Thu, 01 Jan 1970 00:00:00 GMT')
    jar.set('lang=en; max-age=0')
    expect(jar.get()).toBe('')
  })
})
