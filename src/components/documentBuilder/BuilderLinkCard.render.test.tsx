// @vitest-environment jsdom
/**
 * The link card on the Document builder tab (punch list #404, step 4): nothing is read until there is something
 * published, the link shows on the app's own address with Copy, a new link asks first and stops the old one, the
 * link is switched off and on, and a refusal names its reason.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { DocumentBuilderLinkState } from '../../lib/documentBuilder/link'
import { BuilderLinkCard, type BuilderLinkCardIo } from './BuilderLinkCard'

afterEach(cleanup)

const WORDS = { title: "This sheet's link", notPublished: "Publish this job's sheet first. A link then opens it.", on: 'Anyone with the link can read and print this one sheet.', off: 'The link is off.' }
const ON = (code = 'abcdefgh23456789', opened = 0): DocumentBuilderLinkState => ({ on: true, code, madeAt: '2026-11-20T15:00:00Z', opened, lastOpenedAt: opened ? '2026-11-21T15:00:00Z' : null })
const landed = (value: DocumentBuilderLinkState) => ({ ok: true as const, value })

function open(over: Partial<BuilderLinkCardIo> = {}, published = true) {
  const io = {
    read: vi.fn(async () => landed(ON())),
    make: vi.fn(async () => landed(ON('zyxwvuts98765432'))),
    end: vi.fn(async () => landed({ on: false })),
    copy: vi.fn(async () => true),
    ...over,
  }
  renderWithProviders(<BuilderLinkCard builderKey="insurance" sheetId="sheet-cedar" published={published} words={WORDS} io={io as unknown as BuilderLinkCardIo} />)
  return io
}

describe('BuilderLinkCard', () => {
  it('reads no link until something is published, and says what to do first', () => {
    const io = open({}, false)
    expect(screen.getByText("Publish this job's sheet first. A link then opens it.")).toBeTruthy()
    expect(io.read).not.toHaveBeenCalled()
  })

  it('shows the link on the app’s own address and copies it', async () => {
    const io = open()
    expect((await screen.findByTestId('builder-link-url')).textContent).toBe(`${window.location.origin}/d/abcdefgh23456789`)
    expect(io.read).toHaveBeenCalledWith('insurance', 'sheet-cedar')
    expect(screen.getByText(/Not opened by anyone outside yet\./)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Copy the link' }))
    expect(await screen.findByText('Copied')).toBeTruthy()
    expect(io.copy).toHaveBeenCalledWith(`${window.location.origin}/d/abcdefgh23456789`)
  })

  it('says how often someone outside opened it', async () => {
    open({ read: vi.fn(async () => landed(ON('abcdefgh23456789', 3))) })
    expect(await screen.findByText(/Opened 3 times by someone outside, last on /)).toBeTruthy()
  })

  it('asks before a new link stops the old one, and shows the new one', async () => {
    const io = open()
    fireEvent.click(await screen.findByRole('button', { name: 'Make a new link' }))
    expect(await screen.findByText('The link you have now stops working. Anyone you gave it to needs the new one.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Keep this link' }))
    expect(io.make).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Make a new link' }))
    const confirm = (await screen.findAllByRole('button', { name: 'Make a new link' })).at(-1) as HTMLElement
    fireEvent.click(confirm)
    await waitFor(() => expect(screen.getByTestId('builder-link-url').textContent).toBe(`${window.location.origin}/d/zyxwvuts98765432`))
    expect(io.make).toHaveBeenCalledWith('insurance', 'sheet-cedar')
  })

  it('switches the link off, after asking, and on again', async () => {
    const io = open()
    fireEvent.click(await screen.findByRole('button', { name: 'Switch the link off' }))
    const confirm = (await screen.findAllByRole('button', { name: 'Switch the link off' })).at(-1) as HTMLElement
    fireEvent.click(confirm)
    expect(await screen.findByText('The link is off.')).toBeTruthy()
    expect(io.end).toHaveBeenCalledWith('insurance', 'sheet-cedar')
    fireEvent.click(screen.getByRole('button', { name: 'Switch the link on' }))
    expect((await screen.findByTestId('builder-link-url')).textContent).toBe(`${window.location.origin}/d/zyxwvuts98765432`)
  })

  it('names the reason when the link cannot be read or made', async () => {
    open({ read: vi.fn(async () => ({ ok: false as const, error: 'Only a dev manages a link for now.' })) })
    expect((await screen.findByRole('alert')).textContent).toBe('Only a dev manages a link for now.')
    cleanup()
    open({ read: vi.fn(async () => landed({ on: false })), make: vi.fn(async () => ({ ok: false as const, error: 'Publish it first. A link then opens it.' })) })
    fireEvent.click(await screen.findByRole('button', { name: 'Switch the link on' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Publish it first. A link then opens it.')
  })
})
