// @vitest-environment jsdom
/**
 * Render smokes for a builder on a GC's own page (punch list #404, step 9), against a fixture: the block says what it
 * is and that it is new, one about all their jobs leads and one about a job sits under that job's name, the press
 * opens the builder to walk and tells the office once, and the sample page tells nobody. A GC can look only. Every
 * name is made up, and the builder's contents are the placeholder fixture.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { customerBuildersFrom, type CustomerBuilder } from '../../lib/documentBuilder/customerPageBuilders'
import { SECRECY_PAPER_FIXTURE } from '../../lib/documentBuilder/secrecyPaper.fixture'
import { PortalBuilders } from './PortalBuilders'

vi.mock('../../lib/publicFunctionStaffHeaders', () => ({ staffAwarePublicHeaders: async () => ({ apikey: 'anon' }) }))

const TOKEN = 'tok-zz-0123456789abcdef'
const sent = (over: Record<string, unknown> = {}): CustomerBuilder =>
  customerBuildersFrom([{ sendId: 's1', builderKey: 'sub-nda', aboutJobId: null, aboutJob: null, revision: 2, contents: JSON.parse(JSON.stringify(SECRECY_PAPER_FIXTURE)), openedOn: null, opened: false, changed: false, ...over }])[0] as CustomerBuilder

type Call = { url: string; body: Record<string, unknown> | null }
let calls: Call[] = []
beforeEach(() => {
  calls = []
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    calls.push({ url: String(url), body: typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : null })
    return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const block = (jobId?: string) => (jobId ? (document.querySelector(`[data-portal-builder-job="${jobId}"]`) as HTMLElement) : (document.querySelector('[data-portal-builders]') as HTMLElement))

describe('PortalBuilders', () => {
  it('draws nothing for a customer who was sent none', () => {
    render(<PortalBuilders builders={[]} token={TOKEN} company="Made-up Plumbing" />)
    expect(document.querySelector('[data-portal-builders]')).toBeNull()
  })

  it('says what it is, that it is new, and that they can only look', () => {
    render(<PortalBuilders builders={[sent()]} token={TOKEN} company="Made-up Plumbing" />)
    expect(screen.getByText('Secrecy on your jobs')).toBeTruthy()
    expect(screen.getByText('New')).toBeTruthy()
    expect(screen.getByText('See how Made-up Plumbing binds the people it brings onto your jobs. Pick a level and read what it asks.')).toBeTruthy()
    expect(screen.getByText('You can look. Nothing is sent.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open the Sub NDA builder' })).toBeTruthy()
  })

  it('puts one about all their jobs at the top, and one about a job under that job\u2019s name', () => {
    render(<PortalBuilders builders={[sent({ sendId: 'p', aboutJobId: 'j1', aboutJob: 'Pike Street clinic · Job 1180' }), sent({ sendId: 'a' })]} token={TOKEN} company="Made-up Plumbing" jobOrder={['j1']} />)
    const blocks = [...block().querySelectorAll('[data-portal-builder]')]
    expect(blocks).toHaveLength(2)
    expect(within(blocks[0] as HTMLElement).getByText('Secrecy on your jobs')).toBeTruthy()
    expect(within(block('j1')).getByText('Pike Street clinic · Job 1180')).toBeTruthy()
    expect(within(block('j1')).getByText('Secrecy on this job')).toBeTruthy()
  })

  it('opens the builder to walk, tells the office once, and drops the New chip', async () => {
    render(<PortalBuilders builders={[sent()]} token={TOKEN} company="Made-up Plumbing" />)
    fireEvent.click(screen.getByRole('button', { name: 'Open the Sub NDA builder' }))
    // The flow's first page: the disclaimer, as published.
    expect(await screen.findByText(SECRECY_PAPER_FIXTURE.notice.title)).toBeTruthy()
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0]?.url).toMatch(/\/functions\/v1\/document-builder-send$/)
    expect(calls[0]?.body).toEqual({ action: 'opened', portalToken: TOKEN, builderKey: 'sub-nda' })
    expect(screen.queryByText('New')).toBeNull()
    // Closing and opening again tells nobody twice.
    fireEvent.click(screen.getByRole('button', { name: 'Close the builder' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open the Sub NDA builder' }))
    await screen.findByText(SECRECY_PAPER_FIXTURE.notice.title)
    expect(calls).toHaveLength(1)
  })

  it('says it changed since they opened it, with the day they did', () => {
    render(<PortalBuilders builders={[sent({ changed: true, openedOn: '2026-11-21' })]} token={TOKEN} company="Made-up Plumbing" />)
    expect(screen.getByText('Changed since you opened it')).toBeTruthy()
    expect(screen.getByText('You opened this on Nov 21. You can look. Nothing is sent.')).toBeTruthy()
  })

  it('tells nobody from the sample page', async () => {
    render(<PortalBuilders builders={[sent()]} token="sample" company="Made-up Plumbing" />)
    fireEvent.click(screen.getByRole('button', { name: 'Open the Sub NDA builder' }))
    await screen.findByText(SECRECY_PAPER_FIXTURE.notice.title)
    expect(calls).toHaveLength(0)
  })
})
