// @vitest-environment jsdom
/**
 * Render smokes for Before we start on the GC's page (punch list #382, PR 9). Nothing is ticked for them, one link
 * ticks all, the press names its count, a day is sent by itself, a bullet that waits on its photo cannot be ticked
 * again, the settled list says how we know, and crew confirmed reads the firm day. Every name and day is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { GcPageStage } from '../../lib/startChecks/gcPage'
import { PortalStartChecks } from './PortalStartChecks'

vi.mock('../../lib/materials/photoShrink', () => ({ shrinkPhoto: async (file: File) => ({ blob: file, width: 10, height: 10, shrunk: true }) }))

const TOKEN = 'tok-zz-0123456789abcdef'
const stage = (over: Partial<GcPageStage> = {}): GcPageStage => ({
  fixtureId: 'fx-1',
  name: 'Top Out',
  need: [
    { id: 'b1', words: 'The framing inspection has passed.', wantsPhoto: false, waitsOnPhoto: false },
    { id: 'b2', words: 'Framing is done and the roof is dried in.', wantsPhoto: true, waitsOnPhoto: false },
    { id: 'b3', words: 'The slab is poured.', wantsPhoto: true, waitsOnPhoto: true },
  ],
  settled: [{ id: 'b4', words: 'Power is on for our tools.', how: 'we saw it on site' }],
  marks: [true, false, false, false],
  pct: 25,
  crewConfirmedFor: null,
  ...over,
})

type Call = { url: string; method: string; body: Record<string, unknown> | null }
let calls: Call[] = []
let answer: (call: Call) => { status: number; json: unknown } = () => ({ status: 200, json: { ok: true } })
beforeEach(() => {
  calls = []
  answer = () => ({ status: 200, json: { ok: true } })
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const call: Call = { url: String(url), method: init.method ?? 'GET', body: typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : null }
    calls.push(call)
    const a = answer(call)
    return { ok: a.status >= 200 && a.status < 300, status: a.status, json: async () => a.json } as Response
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const mount = (s: GcPageStage = stage()) => render(<PortalStartChecks jobId="job-zz-1" jobLabel="J2101" jobAddress="12 Heron Way" stage={s} token={TOKEN} todayYmd="2026-11-20" phone="555-0100" />)
const need = (id: string) => document.querySelector(`[data-start-need="${id}"]`) as HTMLElement

describe('PortalStartChecks', () => {
  it('ticks nothing for them, and the press is dead until they tick', () => {
    mount()
    expect(screen.getByRole('heading', { name: 'Before we start Top Out' })).toBeTruthy()
    expect(screen.getByText('Still needed from you · 3')).toBeTruthy()
    expect(screen.getAllByRole('checkbox').map((c) => c.getAttribute('aria-checked'))).toEqual(['false', 'false'])
    expect((screen.getByRole('button', { name: 'Tick what is ready' }) as HTMLButtonElement).disabled).toBe(true)
    expect(need('b2').textContent).toContain('A photo would settle this one.')
    // Their word is already in on the third: it has no box to tick, and says a photo would settle it.
    expect(need('b3').textContent).toContain('You told us. A photo would settle it.')
    expect(screen.getByText('Already settled · 1')).toBeTruthy()
    expect(document.querySelector('[data-start-settled="b4"]')?.textContent).toBe('✓ Power is on for our tools. (we saw it on site)')
    expect(screen.getByRole('img', { name: '25% ready' })).toBeTruthy()
  })

  it('every press on the card is a full thumb: 44 px for the tick box, the words presses, the day and both sends', () => {
    mount()
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(2)
    for (const c of boxes) {
      expect(c.tagName).toBe('BUTTON')
      expect(parseFloat(c.style.width)).toBeGreaterThanOrEqual(44)
      expect(parseFloat(c.style.height)).toBeGreaterThanOrEqual(44)
      // The box is still drawn 30 px, inside its press.
      const drawn = c.querySelector('[data-start-box]') as HTMLElement
      expect([drawn.style.width, drawn.style.height]).toEqual(['30px', '30px'])
    }
    const wordsPresses = [screen.getByRole('button', { name: 'All of these are ready' }), ...screen.getAllByRole('button', { name: 'I am adding a photo' })]
    expect(wordsPresses).toHaveLength(4)
    for (const p of wordsPresses) {
      expect(p.style.minHeight).toBe('44px')
      expect(p.style.display).toBe('inline-flex')
    }
    expect((screen.getByLabelText('Not ready yet? It will be ready') as HTMLElement).style.minHeight).toBe('44px')
    expect(screen.getByRole('button', { name: 'Send the day' }).style.minHeight).toBe('44px')
    expect(screen.getByRole('button', { name: 'Tick what is ready' }).style.minHeight).toBe('44px')
    // The press ticks as the box did, and the tick is drawn in the box.
    fireEvent.click(boxes[0] as HTMLElement)
    expect(screen.getAllByRole('checkbox')[0]?.getAttribute('aria-checked')).toBe('true')
    expect(screen.getAllByRole('checkbox')[0]?.querySelector('[data-start-box]')?.textContent).toBe('✓')
  })

  it('one link ticks them all, the press names its count, and one send carries them', async () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'All of these are ready' }))
    expect(need('b1').dataset.ticked).toBe('yes')
    fireEvent.click(screen.getByRole('button', { name: 'Yes, 2 are ready' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Thank you. We have it.'))
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toContain('/functions/v1/submit-portal-request')
    expect(calls[0]?.body).toEqual({ token: TOKEN, kind: 'start_check_answer', jobId: 'job-zz-1', fixtureId: 'fx-1', ready: ['b1', 'b2'], photos: [], readyDay: null })
    // The plain one is settled. The one that asks for a photo stays, waiting on it.
    expect(need('b1')).toBeNull()
    expect(need('b2').textContent).toContain('You told us. A photo would settle it.')
    expect(document.querySelector('[data-start-settled="b1"]')?.textContent).toContain('you told us today')
  })

  it('a photo is asked a slot, uploaded to it, and sent as a yes with their photo', async () => {
    answer = (c) => (c.body?.kind === 'start_check_photo' ? { status: 200, json: { ok: true, bucket: 'start-check-photos', path: 'job-zz-1/page-b3-1.jpg', signedUrl: 'https://storage.example/sign/abc' } } : { status: 200, json: { ok: true } })
    mount()
    const input = screen.getByLabelText('A photo for this item') as HTMLInputElement
    fireEvent.click(within3().getByRole('button', { name: 'I am adding a photo' }))
    fireEvent.change(input, { target: { files: [new File(['x'.repeat(40)], 'slab.jpg', { type: 'image/jpeg' })] } })
    await waitFor(() => expect(need('b3').textContent).toContain('Photo added: slab.jpg'))
    expect(calls.map((c) => [c.method, c.body?.kind ?? c.url])).toEqual([
      ['POST', 'start_check_photo'],
      ['PUT', 'https://storage.example/sign/abc'],
    ])
    expect(calls[0]?.body).toMatchObject({ jobId: 'job-zz-1', fixtureId: 'fx-1', bulletId: 'b3', bytes: 40, type: 'image/jpeg' })
    fireEvent.click(screen.getByRole('button', { name: 'Yes, 1 is ready' }))
    await waitFor(() => expect(need('b3')).toBeNull())
    expect(calls[2]?.body).toMatchObject({ kind: 'start_check_answer', ready: [], photos: [{ bulletId: 'b3', path: 'job-zz-1/page-b3-1.jpg', fileName: 'slab.jpg', bytes: 40 }] })
    expect(document.querySelector('[data-start-settled="b3"]')?.textContent).toContain('your photo, today')
  })

  it('Not ready yet sends a day by itself', async () => {
    mount()
    const send = screen.getByRole('button', { name: 'Send the day' }) as HTMLButtonElement
    expect(send.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Not ready yet? It will be ready'), { target: { value: '2026-12-03' } })
    fireEvent.click(send)
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Thank you. We have Thu Dec 3.'))
    expect(calls[0]?.body).toMatchObject({ kind: 'start_check_answer', ready: [], photos: [], readyDay: '2026-12-03' })
  })

  it('a send that is refused says so and keeps the ticks', async () => {
    answer = () => ({ status: 400, json: { error: 'Your page has changed. Please open it again.' } })
    mount()
    fireEvent.click(screen.getAllByRole('checkbox')[0] as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: 'Yes, 1 is ready' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Yes, 1 is ready' })).toBeTruthy())
    expect(need('b1').dataset.ticked).toBe('yes')
    expect(screen.queryByRole('status')).toBeNull()
    // The class of the failure and the door to the office, as every portal send draws it.
    expect(screen.getByRole('alert').getAttribute('data-portal-failure')).toBe('refused')
    expect(screen.getByRole('alert').querySelector('a')?.getAttribute('href')).toContain('5550100')
  })

  it('after our Go with nothing open it reads crew confirmed for the day', () => {
    mount(stage({ need: [], settled: [{ id: 'b4', words: 'Power is on for our tools.', how: 'you told us Nov 14' }], marks: [true], pct: 100, crewConfirmedFor: '2026-12-01' }))
    expect(document.querySelector('[data-start-confirmed]')?.textContent).toBe('Crew confirmed for Tue Dec 1.')
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByText(/Still needed/)).toBeNull()
  })

  it('a sample link sends nothing', async () => {
    cleanup()
    render(<PortalStartChecks jobId="job-zz-1" jobLabel="J2101" stage={stage()} token="sample-gc" todayYmd="2026-11-20" />)
    fireEvent.click(screen.getAllByRole('checkbox')[0] as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: /Yes, 1 is ready/ }))
    await waitFor(() => expect(screen.queryByRole('status')).toBeTruthy())
    expect(calls).toEqual([])
  })
})

function within3() {
  const el = need('b3')
  return { getByRole: (role: string, o: { name: string }) => Array.from(el.querySelectorAll(role === 'button' ? 'button' : role)).find((b) => b.textContent?.trim() === o.name) as HTMLElement }
}
