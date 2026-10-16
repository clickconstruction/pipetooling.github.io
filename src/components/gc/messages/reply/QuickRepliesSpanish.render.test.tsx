// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/renderSmokeMocks'
import { DEMO_NOW } from '../../../../lib/messages/messagesDemo'
import { spineMessagesView } from '../../../../lib/messages/spineRows'
import type { JobTile } from '../../../../lib/messages/jobTiles'
import type { ReplyIo } from '../../../../lib/messages/replyIo'
import type { QuickReply } from '../../../../lib/quickReplies/kernel'
import type { QuickRepliesIo } from '../../../../lib/quickReplies/quickRepliesIo'
import { OpenThreadContext, type OpenThread } from '../openThread'
import { ReplyBox } from './ReplyBox'

// Send texts is on here, so a text writes as it will once the owner turns it on (`ReplyBox.textsOn` holds the off box).
vi.mock('./useTextsOn', () => ({ useTextsOn: () => true }))

/**
 * R3: the strip in the language the person reads. Greg, the demo's trade partner, is kept here as reading Spanish, with
 * the residential prototype's line in both languages and one in English only. The owner's switch for Spanish
 * (`PORTAL_SPANISH_ON`) is off on main, so each case sets it.
 */

const gate = vi.hoisted(() => ({ on: true }))
vi.mock('../../../../lib/gc/portalI18n', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../../lib/gc/portalI18n')>()
  return {
    ...real,
    get PORTAL_SPANISH_ON() {
      return gate.on
    },
  }
})

const line = (id: string, text: string, textEs: string | null): QuickReply => ({
  id,
  text,
  textEs,
  for: 'any',
  stepId: null,
  scope: 'team',
  addedBy: 'u-rosa',
  addedAt: Date.parse('2026-09-30T13:10:00.000Z'),
  removed: false,
  uses: {},
  lastUsed: null,
})

const LINES = [
  line('a1', '{first}, we are on our way.', '{first}, vamos en camino.'),
  line('a2', 'Got it, thank you.', null),
]

const quickIo = (): QuickRepliesIo => ({
  loadLines: vi.fn(() => Promise.resolve(LINES)),
  loadVersions: vi.fn(() => Promise.resolve({})),
  press: vi.fn(() => Promise.resolve()),
  add: vi.fn(() => Promise.resolve('q-new')),
  edit: vi.fn(() => Promise.resolve(1)),
  remove: vi.fn(() => Promise.resolve()),
  restore: vi.fn(() => Promise.resolve()),
  setPress: vi.fn(() => Promise.resolve(1)),
})

const replyIo = (): ReplyIo => ({
  loadSender: vi.fn(() => Promise.resolve({ name: 'Robert' })),
  addNote: vi.fn(() => Promise.resolve('m-note')),
  sendEmail: vi.fn(() => Promise.resolve('m-email')),
  sendText: vi.fn(() => Promise.resolve('m-text')),
})

async function openStrip(lang: 'es' | 'en' | undefined) {
  const view = spineMessagesView()
  const greg = view.contacts.find((c) => c.id === 'c-greg')!
  const contact = lang ? { ...greg, lang } : greg
  const open: OpenThread = {
    contact,
    lines: view.messages.filter((m) => m.contactId === 'c-greg'),
    jobFilter: null,
    rail: view.rails['c-greg'] ?? [],
    tiles: view.tiles,
    userNames: view.userNames,
    nowIso: DEMO_NOW,
    searchJobs: vi.fn(() => Promise.resolve([] as JobTile[])),
  }
  renderWithProviders(
    <OpenThreadContext.Provider value={open}>
      <ReplyBox contact={contact} io={replyIo()} quickIo={quickIo()} />
    </OpenThreadContext.Provider>,
  )
  const el = document.querySelector('[data-reply-box]') as HTMLElement
  fireEvent.click(within(el).getByRole('button', { name: /Quick replies/ }))
  await waitFor(() => expect(el.querySelector('[data-qr-line="a1"]')).toBeTruthy())
  return el
}

const words = (el: HTMLElement, id: string) => el.querySelector(`[data-qr-line="${id}"]`)?.textContent

beforeEach(() => {
  localStorage.clear()
  gate.on = true
})

describe('the strip in the language the person reads (Messages R3)', () => {
  it('shows a Spanish reader the Spanish once the switch is on, says so, and fills the box in Spanish', async () => {
    const el = await openStrip('es')
    expect(words(el, 'a1')).toBe('Greg, vamos en camino.')
    expect(el.querySelector('[data-qr-strip="open"]')?.textContent).toContain('· in Spanish')
    fireEvent.click(el.querySelector('[data-qr-line="a1"]') as HTMLElement)
    expect((within(el).getByRole('textbox', { name: 'Write to Greg Paulk' }) as HTMLTextAreaElement).value).toBe('Greg, vamos en camino.')
  })

  it('keeps the English while the owner’s switch for Spanish is off', async () => {
    gate.on = false
    const el = await openStrip('es')
    expect(words(el, 'a1')).toBe('Greg, we are on our way.')
    expect(el.querySelector('[data-qr-strip="open"]')?.textContent).not.toContain('in Spanish')
  })

  it('sends a line with no Spanish in English', async () => {
    const el = await openStrip('es')
    expect(words(el, 'a2')).toBe('Got it, thank you.')
  })

  it('gives a person with no language set every line in English', async () => {
    const el = await openStrip(undefined)
    expect(words(el, 'a1')).toBe('Greg, we are on our way.')
    expect(el.querySelector('[data-qr-strip="open"]')?.textContent).not.toContain('in Spanish')
  })
})
