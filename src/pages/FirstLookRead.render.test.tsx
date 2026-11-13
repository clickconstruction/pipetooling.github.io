// @vitest-environment jsdom
/**
 * Punch list #319 PR 7: the tech's page for one look. A look the reader may not see says so; the asked tech sees the
 * photos, the video and the customer's words, picks one of two answers, adds a note and sends it; the send is dead
 * until one is picked; someone who was not asked and is not the office reads and cannot answer.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import type { ThreadLook, ThreadLookFile } from '../lib/firstLook/card'
import { fakeFirstLookThreadIo } from '../test/fakeFirstLookIo'
import { renderWithProviders } from '../test/renderSmokeMocks'
import FirstLookRead from './FirstLookRead'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
const who = vi.hoisted(() => ({ role: 'primary', id: 'u-luis' }))
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: who.id }, role: who.role, profileName: 'Luis Ortega', loading: false }),
  useOptionalAuth: () => ({ user: { id: who.id }, role: who.role, profileName: 'Luis Ortega', loading: false }),
}))

const ID = '11111111-2222-4333-8444-555555555555'
const LOOK: ThreadLook = { id: ID, contact_id: 'dana', asked_by_name: 'Rosa', made_at: '2026-11-12T15:00:00.000Z', expires_at: '2026-11-19T15:00:00.000Z', opened_at: null, sent_at: '2026-11-12T15:30:00.000Z', looked_at: null, closed_at: null, place: 'Kitchen', words: 'It drips at night', asked_tech_ids: ['u-luis'], asked_tech_at: '2026-11-12T16:00:00.000Z' }
const PHOTO: ThreadLookFile = { id: 'F1', look_id: ID, kind: 'photo', mime: 'image/jpeg', storage_path: `${ID}/kept/F1.jpg`, bytes: 1, seconds: null, finished_at: '2026-11-12T15:10:00.000Z' }
const VIDEO: ThreadLookFile = { id: 'F2', look_id: ID, kind: 'video', mime: 'video/mp4', storage_path: `${ID}/kept/F2.mp4`, bytes: 1, seconds: 12, finished_at: '2026-11-12T15:11:00.000Z' }

function draw(io = fakeFirstLookThreadIo({ lookById: vi.fn(async () => ({ look: LOOK, files: [PHOTO, VIDEO] })) }), path = `/first-look/${ID}`) {
  renderWithProviders(
    <Routes>
      <Route path="/first-look/:id" element={<FirstLookRead io={io} />} />
    </Routes>,
    { route: path },
  )
  return io
}

afterEach(() => {
  cleanup()
  who.role = 'primary'
  who.id = 'u-luis'
})

describe('a tech’s page for one look (punch list #319 PR 7)', () => {
  it('a look the reader may not see says so in words', async () => {
    draw(fakeFirstLookThreadIo())
    expect(await screen.findByText('This look is not yours to see, or it is gone.')).toBeTruthy()
  })

  it('an address that is not a look’s asks the database nothing', async () => {
    const io = draw(fakeFirstLookThreadIo(), '/first-look/not-an-id')
    expect(await screen.findByText('This look is not yours to see, or it is gone.')).toBeTruthy()
    expect(io.lookById).not.toHaveBeenCalled()
  })

  it('the asked tech sees the look, picks an answer, adds a note and sends it', async () => {
    const io = draw()
    expect(await screen.findByText('It drips at night')).toBeTruthy()
    expect((document.querySelector('[data-look-file="photo"] img') as HTMLImageElement).src).toBe(`https://files.test/${ID}/kept/F1.jpg`)
    expect(document.querySelector('[data-look-file="video"]')).toBeTruthy()
    const send = screen.getByRole('button', { name: 'Send my answer' }) as HTMLButtonElement
    expect(send.disabled).toBe(true)
    fireEvent.click(screen.getByRole('radio', { name: 'I can price it from this' }))
    fireEvent.change(screen.getByLabelText('A note for the office'), { target: { value: ' Bring a 3/4 inch stop. ' } })
    expect(send.disabled).toBe(false)
    fireEvent.click(send)
    await waitFor(() => expect(io.answer).toHaveBeenCalledWith(ID, 'can_price', 'Bring a 3/4 inch stop.'))
    expect(await screen.findByRole('status')).toBeTruthy()
  })

  it('shows an answer already given', async () => {
    draw(fakeFirstLookThreadIo({ lookById: vi.fn(async () => ({ look: { ...LOOK, tech_read: 'needs_visit', tech_note: 'The valve is behind tile.', tech_read_name: 'Luis Ortega' }, files: [PHOTO] })) }))
    expect(await screen.findByText('Luis: Needs a visit to price. The valve is behind tile.')).toBeTruthy()
  })

  it('a crew member who was not asked reads and cannot answer; the office can', async () => {
    who.id = 'u-someone-else'
    who.role = 'helpers'
    draw()
    expect(await screen.findByText('Only the tech it was asked of answers here.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Send my answer' })).toBeNull()
    cleanup()
    who.role = 'assistant'
    draw()
    expect(await screen.findByRole('button', { name: 'Send my answer' })).toBeTruthy()
  })
})
