// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import type { LensAsk, LensEngine } from './answer/lensEngine'
import { authStorageKey } from './lensAuth'
import { parseLensName, type LensConfig } from './lensName'
import { LENS_PEOPLE } from './lensPeople'
import { QuietSocket } from './quietSocket'
import { installSeal } from './seal'

const SUPABASE = 'https://lenstest.supabase.co'

type FreshDom = new (html: string, o: { url: string }) => { window: Window & typeof globalThis }

/** A fresh window per test, so one test's seal never leaks into the next. jsdom ships no types here. */
async function freshWindow(): Promise<Window & typeof globalThis> {
  const name = 'jsdom'
  const { JSDOM } = (await import(/* @vite-ignore */ name)) as { JSDOM: FreshDom }
  return new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://app.example.com/dashboard' }).window
}

async function frame(cfg: LensConfig = { as: 'estimator', mood: 'full', theme: 'dark' }) {
  const win = await freshWindow()
  const realStorage = win.localStorage
  const realFetch = vi.fn(async () => new Response('real'))
  const realOpen = vi.fn(() => null)
  win.fetch = realFetch as unknown as typeof fetch
  win.open = realOpen as unknown as typeof win.open
  const handle = vi.fn(async (_url: URL, _req: unknown) => new Response(JSON.stringify([{ ok: true }]), { status: 200 }))
  const load = async () => ({ createLensEngine: (_c: LensConfig, _o: { report: (a: LensAsk) => void }) => ({ world: null, handle }) as unknown as LensEngine })
  const state = installSeal(win, cfg, SUPABASE, load)
  return { win, realStorage, realFetch, realOpen, handle, state }
}

describe('the seal', () => {
  it('changes nothing in a window the lens did not name', () => {
    expect(parseLensName(window.name)).toBeNull()
    expect(window.__lens).toBeUndefined()
  })

  it('swaps storage for memory seeded with the person\'s session and the theme, and never touches the real one', async () => {
    const { win, realStorage } = await frame()
    const key = authStorageKey(SUPABASE)
    const session = JSON.parse(win.localStorage.getItem(key) ?? 'null')
    expect(session.user.id).toBe(LENS_PEOPLE.estimator.id)
    expect(win.localStorage.getItem('themeOverride')).toBe('dark')
    win.localStorage.setItem('pinned', 'x')
    win.sessionStorage.setItem('draft', 'y')
    expect(realStorage.getItem('pinned')).toBeNull()
    expect(realStorage.getItem(key)).toBeNull()
  })

  it('sends the Supabase address to the world and every other address out', async () => {
    const { win, realFetch, handle } = await frame()
    const res = await win.fetch(`${SUPABASE}/rest/v1/jobs?select=*`, { method: 'GET', headers: { apikey: 'k' } })
    expect(await res.json()).toEqual([{ ok: true }])
    expect(handle).toHaveBeenCalledTimes(1)
    expect(String(handle.mock.calls[0]![0])).toBe(`${SUPABASE}/rest/v1/jobs?select=*`)
    expect(realFetch).not.toHaveBeenCalled()
    await win.fetch('https://tile.openstreetmap.org/1/1/1.png')
    expect(realFetch).toHaveBeenCalledTimes(1)
  })

  it('quiets the realtime socket, hides IndexedDB and the caches, and answers the sensors', async () => {
    const { win } = await frame({ as: 'subcontractor', mood: 'offline', theme: 'light' })
    const ws = new win.WebSocket(`${SUPABASE.replace('https', 'wss')}/realtime/v1/websocket?apikey=k`)
    expect(ws).toBeInstanceOf(QuietSocket)
    expect(win.indexedDB).toBeUndefined()
    expect(await win.caches.keys()).toEqual([])
    expect(win.navigator.onLine).toBe(false)
    expect(win.Notification.permission).toBe('denied')
  })

  it('opens a new tab sealed, under a name of its own', async () => {
    const { win, realOpen } = await frame()
    win.open('/jobs?tab=stages', '_blank')
    const name = (realOpen.mock.calls[0] as unknown[])[1] as string
    expect(parseLensName(name)).toMatchObject({ as: 'estimator', mood: 'full', theme: 'dark' })
    win.open('https://stripe.com/x', '_blank')
    expect((realOpen.mock.calls[1] as unknown[])[1]).toBe('_blank')
  })

  it('marks the frame, so it is never taken for the real app', async () => {
    const { win } = await frame()
    if (win.document.readyState === 'loading') await new Promise((r) => win.document.addEventListener('DOMContentLoaded', r))
    expect(win.document.querySelector('[data-lens-mark]')?.textContent).toBe('Lens · invented data · Estimator')
  })
})
