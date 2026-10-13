// @vitest-environment jsdom
/**
 * Render smoke for Messages cut 7d's `/f/<link>` page: it asks drive-link's open door once, forwards to the file it
 * answers (Drive's viewer or the function's stream), says a link cut off or ended in the mock-up's words, names an
 * unknown or too-big link, and offers to try again when the read fails.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../lib/publicFunctionStaffHeaders', () => ({ staffAwarePublicHeaders: async () => ({ apikey: 'anon', Authorization: 'Bearer anon' }) }))

import FileLinkPage from './FileLinkPage'

const TOKEN = 'k3Pw9xQaB7cD2eF4gH6iJ8'
const STREAM = `https://abc.supabase.co/functions/v1/drive-link?t=${TOKEN}&raw=1`
const urls: string[] = []
let reply: () => Promise<{ ok: boolean; json: () => Promise<unknown> }>

beforeEach(() => {
  urls.length = 0
  reply = async () => ({ ok: true, json: async () => ({ kind: 'stream', url: STREAM, name: 'Rock clause, marked up.pdf' }) })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      urls.push(url)
      return reply()
    }),
  )
})
afterEach(() => vi.unstubAllGlobals())

function open(path = `/f/${TOKEN}`) {
  const go = vi.fn()
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/f/:link" element={<FileLinkPage go={go} />} />
      </Routes>
    </MemoryRouter>,
  )
  return { go }
}

describe('FileLinkPage (/f/<link>)', () => {
  it('asks the open door once, says the file is opening, and forwards to it', async () => {
    const { go } = open()
    expect((await screen.findByRole('status')).textContent).toContain('Opening Rock clause, marked up.pdf…')
    expect(screen.getByText('From Click Construction.')).toBeTruthy()
    await waitFor(() => expect(go).toHaveBeenCalledWith(STREAM))
    expect(urls).toHaveLength(1)
    expect(urls[0]).toContain(`/functions/v1/drive-link?t=${TOKEN}`)
    expect(urls[0]).not.toContain('preview')
  })

  it('sends a Plans file to Drive’s own viewer, and passes the office’s preview flag', async () => {
    reply = async () => ({ ok: true, json: async () => ({ kind: 'drive', url: 'https://drive.google.com/file/d/plans/view', name: 'Boerne plans, rev 2.pdf' }) })
    const { go } = open(`/f/${TOKEN}?preview=1`)
    await waitFor(() => expect(go).toHaveBeenCalledWith('https://drive.google.com/file/d/plans/view'))
    expect(urls[0]).toContain('&preview=1')
  })

  it('says a link that was cut off in the mock-up’s words, and goes nowhere', async () => {
    reply = async () => ({ ok: false, json: async () => ({ kind: 'off', why: 'cut' }) })
    const { go } = open()
    const off = await screen.findByRole('alert')
    expect(off.textContent).toContain('This link was turned off.')
    expect(off.textContent).toContain('Ask Click Construction for a new one.')
    expect(go).not.toHaveBeenCalled()
  })

  it('names a link it does not know, without asking the open door', async () => {
    open('/f/not-a-link')
    expect((await screen.findByRole('alert')).textContent).toBe('This link does not open a file. Check that it was copied whole.')
    expect(urls).toHaveLength(0)
  })

  it('says a file is too big to open from a link', async () => {
    reply = async () => ({ ok: false, json: async () => ({ kind: 'off', why: 'tooBig' }) })
    open()
    expect((await screen.findByRole('alert')).textContent).toBe('This file is too big to open from a link. Ask Click Construction to send it another way.')
  })

  it('offers to try again when the read fails, and opens on the second try', async () => {
    reply = async () => {
      throw new Error('offline')
    }
    const { go } = open()
    expect((await screen.findByRole('alert')).textContent).toBe('The link did not open. Try again in a minute.')
    reply = async () => ({ ok: true, json: async () => ({ kind: 'stream', url: STREAM, name: 'Rock clause, marked up.pdf' }) })
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(go).toHaveBeenCalledWith(STREAM))
    expect(urls).toHaveLength(2)
  })
})
