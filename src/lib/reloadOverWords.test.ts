import { beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetReloadAskForTests, askReloadOverWords, confirmReloadAsk, currentReloadAsk, endReloadAsk, mountReloadAskHost, subscribeReloadAsk } from './reloadOverWords'

describe('askReloadOverWords: a reload press, asked first over typed words', () => {
  beforeEach(() => __resetReloadAskForTests())
  const typed = () => true
  const nothingTyped = () => false

  it('with nothing typed the press reloads at once, as it always did', () => {
    mountReloadAskHost()
    const reload = vi.fn()
    expect(askReloadOverWords(reload, nothingTyped)).toBe('reloaded')
    expect(reload).toHaveBeenCalledTimes(1)
    expect(currentReloadAsk()).toBeNull()
  })

  it('with words typed nothing reloads: the bar has the ask', () => {
    mountReloadAskHost()
    const reload = vi.fn()
    expect(askReloadOverWords(reload, typed)).toBe('asked')
    expect(reload).not.toHaveBeenCalled()
    expect(currentReloadAsk()?.reload).toBe(reload)
  })

  it('with no bar on the page the press reloads at once: a press never does nothing', () => {
    const reload = vi.fn()
    expect(askReloadOverWords(reload, typed)).toBe('reloaded')
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('Reload anyway clears the ask and runs its reload once', () => {
    mountReloadAskHost()
    const reload = vi.fn(() => expect(currentReloadAsk()).toBeNull())
    askReloadOverWords(reload, typed)
    confirmReloadAsk()
    confirmReloadAsk()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('Not now forgets the ask and reloads nothing', () => {
    mountReloadAskHost()
    const reload = vi.fn()
    askReloadOverWords(reload, typed)
    endReloadAsk()
    expect(currentReloadAsk()).toBeNull()
    confirmReloadAsk()
    expect(reload).not.toHaveBeenCalled()
  })

  it('a second press while the bar is up keeps the same ask, so the walk does not start over, and takes the newer reload', () => {
    mountReloadAskHost()
    const first = vi.fn()
    const second = vi.fn()
    askReloadOverWords(first, typed)
    const id = currentReloadAsk()?.id
    askReloadOverWords(second, typed)
    expect(currentReloadAsk()?.id).toBe(id)
    confirmReloadAsk()
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('an ask after one was answered is a new one', () => {
    mountReloadAskHost()
    askReloadOverWords(vi.fn(), typed)
    const id = currentReloadAsk()?.id
    endReloadAsk()
    askReloadOverWords(vi.fn(), typed)
    expect(currentReloadAsk()?.id).not.toBe(id)
  })

  it('tells whoever listens of each change, and stops when asked to', () => {
    mountReloadAskHost()
    const heard = vi.fn()
    const stop = subscribeReloadAsk(heard)
    askReloadOverWords(vi.fn(), typed)
    endReloadAsk()
    expect(heard).toHaveBeenCalledTimes(2)
    // Nothing to forget: nobody is told.
    endReloadAsk()
    expect(heard).toHaveBeenCalledTimes(2)
    stop()
    askReloadOverWords(vi.fn(), typed)
    expect(heard).toHaveBeenCalledTimes(2)
  })

  it('the bar leaving the page forgets an ask nobody can answer, and later presses reload at once', () => {
    const leave = mountReloadAskHost()
    const reload = vi.fn()
    askReloadOverWords(reload, typed)
    leave()
    leave()
    expect(currentReloadAsk()).toBeNull()
    expect(reload).not.toHaveBeenCalled()
    expect(askReloadOverWords(reload, typed)).toBe('reloaded')
  })

  it('reads the page itself when not told: an empty page holds nothing', () => {
    mountReloadAskHost()
    const reload = vi.fn()
    expect(askReloadOverWords(reload)).toBe('reloaded')
  })
})
