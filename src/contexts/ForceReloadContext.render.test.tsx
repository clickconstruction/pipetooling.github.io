// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  const heard: Array<{ type: string; filter: { event: string }; run: () => void }> = []
  const channel = {
    on: vi.fn((type: string, filter: { event: string }, run: () => void) => {
      heard.push({ type, filter, run })
      return channel
    }),
    subscribe: vi.fn(() => channel),
    send: vi.fn(async () => 'ok' as const),
  }
  return {
    heard,
    channel,
    openChannel: vi.fn((_topic: string, _options?: unknown) => channel),
    removeChannel: vi.fn(),
    hardReloadFromRoot: vi.fn(),
  }
})

vi.mock('../lib/supabase', () => ({
  supabase: { channel: h.openChannel, removeChannel: h.removeChannel },
}))
vi.mock('../lib/hardReload', () => ({ hardReloadFromRoot: h.hardReloadFromRoot }))

import { ForceReloadProvider, useForceReload } from './ForceReloadContext'

function Press() {
  const forceReload = useForceReload()
  return (
    <button type="button" onClick={() => forceReload?.forceEveryoneToReload()}>
      send
    </button>
  )
}

describe('ForceReloadProvider (v2.8532): the signal is on a private channel', () => {
  beforeEach(() => {
    h.heard.length = 0
    h.channel.on.mockClear()
    h.channel.subscribe.mockClear()
    h.channel.send.mockClear()
    h.openChannel.mockClear()
    h.removeChannel.mockClear()
    h.hardReloadFromRoot.mockClear()
    sessionStorage.clear()
  })
  afterEach(cleanup)

  it('joins the private channel, never the open one of the same name', () => {
    render(
      <ForceReloadProvider>
        <Press />
      </ForceReloadProvider>,
    )
    expect(h.openChannel).toHaveBeenCalledTimes(1)
    expect(h.openChannel).toHaveBeenCalledWith('force-reload', { config: { private: true } })
    expect(h.channel.subscribe).toHaveBeenCalledTimes(1)
    expect(h.heard).toHaveLength(1)
    expect(h.heard[0]?.type).toBe('broadcast')
    expect(h.heard[0]?.filter).toEqual({ event: 'force_reload' })
  })

  it('reloads this copy when the signal comes, and once for two signals inside five seconds', () => {
    render(
      <ForceReloadProvider>
        <Press />
      </ForceReloadProvider>,
    )
    act(() => h.heard[0]?.run())
    act(() => h.heard[0]?.run())
    expect(h.hardReloadFromRoot).toHaveBeenCalledTimes(1)
  })

  it('a press sends the one event on that channel, and reloads nothing here', () => {
    render(
      <ForceReloadProvider>
        <Press />
      </ForceReloadProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'send' }))
    expect(h.channel.send).toHaveBeenCalledTimes(1)
    expect(h.channel.send).toHaveBeenCalledWith({ type: 'broadcast', event: 'force_reload', payload: {} })
    expect(h.hardReloadFromRoot).not.toHaveBeenCalled()
  })

  it('leaves the channel when the app’s signed-in shell goes away', () => {
    const { unmount } = render(
      <ForceReloadProvider>
        <Press />
      </ForceReloadProvider>,
    )
    unmount()
    expect(h.removeChannel).toHaveBeenCalledTimes(1)
    expect(h.removeChannel).toHaveBeenCalledWith(h.channel)
  })
})
