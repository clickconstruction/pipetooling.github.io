// @vitest-environment jsdom
/**
 * Render smokes for a GC proposing a stricter setting (punch list #389, step 6), against a fixture: the press opens
 * the panel, a stop looser than the job's is dead, the send waits on a stricter topic, the notice's tick and a typed
 * name, and one press posts the proposal and says it is with the office. Where the last proposal stands reads above
 * the press. Every name and word is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { PROPOSAL_WORDS } from '../../lib/contracts/jobPaperProposal'
import { parseGcJobPapers, type GcJobPaper } from '../../lib/portal/gcJobPapers'
import { GC_PROPOSE } from '../../lib/portal/gcPaperPropose'
import { PortalJobPaperPropose } from './PortalJobPaperPropose'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const listed = {
  settings: [
    { key: 'photos', label: 'Photos and video', choices: [
      { key: 'off', label: 'Off', says: 'Placeholder: no photo rule.', out: true },
      { key: 'standard', label: 'Standard', says: 'Placeholder: ask first.' },
      { key: 'strict', label: 'Strict', says: 'Placeholder: no photos.' },
    ] },
    { key: 'term', label: 'How long', choices: [
      { key: 'short', label: 'Short', says: 'Placeholder: a short term.' },
      { key: 'long', label: 'Long', says: 'Placeholder: a long term.' },
    ] },
  ],
  levels: [
    { key: 'standard', label: 'Standard', alignedWith: 'Aligned with a placeholder place', picks: { photos: 'standard', term: 'short' } },
    { key: 'strict', label: 'Strict', alignedWith: 'Aligned with another placeholder place', picks: { photos: 'strict', term: 'long' } },
  ],
  notice: { title: 'Before you start', tick: 'I have read this.', lines: ['Placeholder notice line.'] },
}

function paper(over: Record<string, unknown> = {}): GcJobPaper {
  return parseGcJobPapers([{ jobId: 'job-1', jobLabel: 'Sample job', papers: [{ id: '11111111-2222-3333-4444-555555555555', name: 'Sample secrecy paper', settingsRevision: 1, said: [], signed: 0, total: 3, view: 'businesses', businesses: [], signers: [], propose: { def: listed, picks: { photos: 'standard', term: 'short' }, basis: 'standard' }, ...over }] }])[0]!.papers[0]!
}

const TOKEN = 'made-up-portal-token-000000'
const topic = (key: string) => document.querySelector(`[data-portal-job-paper-propose-topic="${key}"]`) as HTMLElement
const sendPress = () => document.querySelector('[data-portal-job-paper-propose-send]') as HTMLButtonElement
const line = () => (document.querySelector('[data-portal-job-paper-propose-line]') as HTMLElement).textContent

describe('PortalJobPaperPropose', () => {
  it('draws nothing with no list and no proposal, and no press without the page’s own link', () => {
    const { rerender } = render(<PortalJobPaperPropose paper={paper({ propose: null })} token={TOKEN} />)
    expect(document.querySelector('[data-portal-job-paper-propose]')).toBeNull()
    rerender(<PortalJobPaperPropose paper={paper()} token="" />)
    expect(document.querySelector('[data-portal-job-paper-propose]')).toBeNull()
  })

  it('opens on the notice and the office’s sliders, with every looser stop dead', () => {
    render(<PortalJobPaperPropose paper={paper()} token={TOKEN} />)
    const open = screen.getByRole('button', { name: GC_PROPOSE.press })
    expect(open.style.minHeight).toBe('44px')
    fireEvent.click(open)
    const panel = screen.getByRole('group', { name: GC_PROPOSE.title })
    expect(within(panel).getByText('Placeholder notice line.')).toBeTruthy()
    expect(within(panel).getByRole('slider', { name: 'Photos and video' })).toBeTruthy()
    // Off is looser than the job's Standard: it cannot be picked, and it says why.
    const off = within(topic('photos')).getByRole('button', { name: 'Off' }) as HTMLButtonElement
    expect(off.disabled).toBe(true)
    expect(off.title).toBe(GC_PROPOSE.floorWhy)
    expect((within(topic('photos')).getByRole('button', { name: 'Strict' }) as HTMLButtonElement).disabled).toBe(false)
    expect(topic('photos').textContent).toContain('Standard. Placeholder: ask first.')
    // Nothing is stricter yet, so the send is dead and says so.
    expect(sendPress().disabled).toBe(true)
    expect(line()).toBe(PROPOSAL_WORDS.nothing)
  })

  it('waits on a stricter topic, the tick and a name, then posts and says it is with the office', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, proposedAt: '2026-11-25T02:00:00+00:00' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<PortalJobPaperPropose paper={paper()} token={TOKEN} />)
    fireEvent.click(screen.getByRole('button', { name: GC_PROPOSE.press }))
    fireEvent.click(within(topic('photos')).getByRole('button', { name: 'Strict' }))
    expect(topic('photos').textContent).toContain('Strict. Placeholder: no photos.')
    expect(line()).toBe(PROPOSAL_WORDS.notice)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(line()).toBe(PROPOSAL_WORDS.name)
    fireEvent.change(screen.getByLabelText(GC_PROPOSE.nameLabel), { target: { value: '  Greta Sample ' } })
    expect(line()).toBe(GC_PROPOSE.nothingChanges)
    expect(sendPress().disabled).toBe(false)
    expect(sendPress().style.minHeight).toBe('44px')
    fireEvent.click(sendPress())
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('/functions/v1/submit-portal-request')
    expect(JSON.parse(String(init.body))).toEqual({ token: TOKEN, kind: 'job_paper_proposal', requiredPaperId: '11111111-2222-3333-4444-555555555555', picks: { photos: 'strict', term: 'short' }, name: 'Greta Sample', noticeRead: true })
    await waitFor(() => expect(document.querySelector('[data-portal-job-paper-proposal="waiting"]')).not.toBeNull())
    expect(document.querySelector('[data-portal-job-paper-proposal]')?.textContent).toContain(`is with our office. ${GC_PROPOSE.nothingChanges}`)
    // The panel shuts, and the press is there for another.
    expect(screen.queryByRole('group', { name: GC_PROPOSE.title })).toBeNull()
    expect(screen.getByRole('button', { name: GC_PROPOSE.press })).toBeTruthy()
  })

  it('says a refusal as a failure and keeps what was picked', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'That is many proposals in one hour.' }), { status: 400 })))
    render(<PortalJobPaperPropose paper={paper({ propose: { def: { ...listed, notice: undefined }, picks: { photos: 'standard', term: 'short' }, basis: 'standard' } })} token={TOKEN} phone="(512) 555-0142" />)
    fireEvent.click(screen.getByRole('button', { name: GC_PROPOSE.press }))
    // A list with no notice asks for no tick.
    expect(screen.queryByRole('checkbox')).toBeNull()
    fireEvent.click(within(topic('term')).getByRole('button', { name: 'Strict' }))
    fireEvent.change(screen.getByLabelText(GC_PROPOSE.nameLabel), { target: { value: 'Greta Sample' } })
    fireEvent.click(sendPress())
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(topic('term').textContent).toContain('Long. Placeholder: a long term.')
    expect(screen.getByRole('group', { name: GC_PROPOSE.title })).toBeTruthy()
  })

  it('says where the last proposal stands, with the office’s reason for a decline', () => {
    render(<PortalJobPaperPropose paper={paper({ proposal: { state: 'declined', byName: 'Greta Sample', proposedAt: '2026-11-24T18:00:00+00:00', decidedAt: '2026-11-24T20:00:00+00:00', why: 'Placeholder reason.', picks: { photos: 'strict', term: 'short' } } })} token={TOKEN} />)
    const last = document.querySelector('[data-portal-job-paper-proposal="declined"]') as HTMLElement
    expect(last.textContent).toContain('Declined')
    expect(last.textContent).toContain('Our office declined your proposal of Nov 24, 2026 on Nov 24, 2026.')
    expect(last.textContent).toContain('Placeholder reason.')
    expect(screen.getByRole('button', { name: GC_PROPOSE.press })).toBeTruthy()
  })

  it('still says where a proposal stands when the list did not come', () => {
    render(<PortalJobPaperPropose paper={paper({ propose: null, proposal: { state: 'waiting', byName: 'Greta Sample', proposedAt: '2026-11-24T18:00:00+00:00', decidedAt: null, why: null, picks: {} } })} token={TOKEN} />)
    expect(document.querySelector('[data-portal-job-paper-proposal="waiting"]')).not.toBeNull()
    expect(screen.queryByRole('button', { name: GC_PROPOSE.press })).toBeNull()
  })
})
