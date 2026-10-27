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

/** Stands in for the browser's one BroadcastChannel bus: every same-origin window hears every post. */
class SharedBus {
  static open = new Set<SharedBus>()
  onmessage: ((e: { data: unknown }) => void) | null = null
  constructor(public name: string) {
    SharedBus.open.add(this)
  }
  postMessage(data: unknown) {
    for (const o of SharedBus.open) if (o !== this && o.name === this.name) setTimeout(() => o.onmessage?.({ data }), 0)
  }
  close() {
    SharedBus.open.delete(this)
  }
}

async function frame(cfg: LensConfig = { as: 'estimator', mood: 'full', theme: 'dark' }) {
  const win = await freshWindow()
  ;(win as unknown as { BroadcastChannel: unknown }).BroadcastChannel = SharedBus
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

  it('keeps its BroadcastChannel to itself, so the auth client never reaches the dev\'s window', async () => {
    const { win } = await frame()
    const got: unknown[] = []
    const outside = new SharedBus('sb-lenstest-auth-token')
    outside.onmessage = (e) => got.push(['outside', e.data])
    const inside = new win.BroadcastChannel('sb-lenstest-auth-token')
    const sibling = new win.BroadcastChannel('sb-lenstest-auth-token')
    sibling.onmessage = (e) => got.push(['sibling', e.data])
    inside.onmessage = (e) => got.push(['inside', e.data])
    inside.postMessage({ event: 'SIGNED_IN' })
    outside.postMessage({ event: 'TOKEN_REFRESHED', session: 'the dev\'s real one' })
    await new Promise((r) => setTimeout(r, 20))
    expect(got).toEqual([['sibling', { event: 'SIGNED_IN' }]])
    outside.close()
  })

  it('keeps its locks, its cookies and its storage events to itself', async () => {
    const { win } = await frame()
    const ran = await win.navigator.locks.request('lock:sb-lenstest-auth-token', async () => 'ran')
    expect(ran).toBe('ran')
    win.document.cookie = 'seen=1'
    expect(win.document.cookie).toBe('seen=1')
    const heard: string[] = []
    win.addEventListener('storage', (e) => heard.push(String(e.key)))
    win.dispatchEvent(new win.StorageEvent('storage', { key: 'themeOverride', newValue: 'dark' }))
    expect(heard).toEqual(['themeOverride'])
  })

  it('keeps what the frame\'s console and window catch, for the audit', async () => {
    const { win, state } = await frame()
    win.console.error('Failed to load team labor crew days', { circular: win })
    win.dispatchEvent(new win.ErrorEvent('error', { message: 'boom' }))
    expect(state.errors[0]).toMatch(/^Failed to load team labor crew days /)
    expect(state.errors[1]).toBe('Uncaught: boom')
  })

  it('marks the frame, so it is never taken for the real app', async () => {
    const { win } = await frame()
    if (win.document.readyState === 'loading') await new Promise((r) => win.document.addEventListener('DOMContentLoaded', r))
    expect(win.document.querySelector('[data-lens-mark]')?.textContent).toBe('Lens · invented data · Estimator')
  })
})
