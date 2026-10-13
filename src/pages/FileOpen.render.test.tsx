// @vitest-environment jsdom
/**
 * A kept file's lasting link (Messages cut 6): signed in, the page goes to where the file is; signed out, it asks for a
 * sign-in and keeps the path to come back to; a file the reader may not open, or one that is not there, says so.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const auth = vi.hoisted(() => ({ user: { id: 'u-rosa' } as { id: string } | null, loading: false }))
const io = vi.hoisted(() => ({ fileTarget: vi.fn(), goToFile: vi.fn() }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => auth }))
vi.mock('../lib/files/fileOpenIo', () => io)

import FileOpen from './FileOpen'
import { POST_LOGIN_REDIRECT_KEY } from '../lib/iosPwa'

const SIGNED = 'https://project.example/storage/v1/object/sign/message-attachments/g-1/1-COI.pdf?token=t'

const open = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <FileOpen />
    </MemoryRouter>,
  )

beforeEach(() => {
  auth.user = { id: 'u-rosa' }
  auth.loading = false
  io.fileTarget.mockReset()
  io.goToFile.mockReset()
  localStorage.clear()
})
afterEach(cleanup)

describe('FileOpen', () => {
  it('goes to the file for someone who may read it', async () => {
    io.fileTarget.mockResolvedValue({ url: SIGNED })
    open('/files/messages/att-1')
    await waitFor(() => expect(io.goToFile).toHaveBeenCalledWith(SIGNED))
    expect(io.fileTarget).toHaveBeenCalledWith({ source: 'messages', id: 'att-1' })
  })

  it('says so when the reader may not open it, or it is not there', async () => {
    io.fileTarget.mockResolvedValue({ problem: 'notYours' })
    open('/files/messages/att-1')
    expect(await screen.findByText('This file is not one you can open.')).toBeTruthy()
    cleanup()
    io.fileTarget.mockRejectedValue(new Error('offline'))
    open('/files/messages/att-2')
    expect(await screen.findByText('This file is not here.')).toBeTruthy()
    expect(io.goToFile).not.toHaveBeenCalled()
  })

  it('asks for a sign-in and keeps the path to come back to', async () => {
    auth.user = null
    open('/files/messages/att-1')
    expect(await screen.findByText('Sign in to open this file.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/sign-in')
    expect(localStorage.getItem(POST_LOGIN_REDIRECT_KEY)).toBe('/files/messages/att-1')
    expect(io.fileTarget).not.toHaveBeenCalled()
  })

  it('asks for a file in a job’s Drive folder by its job and file', async () => {
    io.fileTarget.mockResolvedValue({ url: 'https://drive.google.com/file/d/1AbC-dEf_GhIjKlMnOp/view' })
    open('/files/drive/project%3A7d3c2a10-4b5e-4f60-9a7b-1c2d3e4f5a6b%3A1AbC-dEf_GhIjKlMnOp')
    await waitFor(() => expect(io.goToFile).toHaveBeenCalledWith('https://drive.google.com/file/d/1AbC-dEf_GhIjKlMnOp/view'))
    expect(io.fileTarget).toHaveBeenCalledWith({ source: 'drive', id: 'project:7d3c2a10-4b5e-4f60-9a7b-1c2d3e4f5a6b:1AbC-dEf_GhIjKlMnOp' })
  })

  it('reads nothing for a source it does not know', async () => {
    open('/files/photos/abc')
    expect(await screen.findByText('This file is not here.')).toBeTruthy()
    expect(io.fileTarget).not.toHaveBeenCalled()
  })
})
