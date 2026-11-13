// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BoxCode from './BoxCode'
import type { Container } from '../lib/materials/onSite'
import type { CodeLookup, StickerFacts } from '../lib/materials/stickers'

/** The door a scanned code opens, signed in (v2.7072, punch list #329): a label, and a sticker in each of its states. */

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, loading: false }) }))
vi.mock('../components/materials/BoxPublicPage', () => ({ BoxPublicPage: () => <div data-testid="public-page" /> }))
const resolveBoxCode = vi.fn<(code: string) => Promise<CodeLookup>>()
vi.mock('../lib/materials/onSiteStore', () => ({ resolveBoxCode: (code: string) => resolveBoxCode(code) }))

const r76: Container = { id: 'box-r76', jobId: 'job-juniper', label: 'R76', kind: 'cage', where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-11-01T00:00:00Z' }
const blank: StickerFacts = { id: 's147', number: 147, code: '9B1C0D2E', state: 'blank', containerId: null, containerLabel: null, containerKind: null, containerRetiredAt: null, jobId: null, placedByName: null, placedAt: null, lostAt: null, runId: 'run-1', runJobId: 'job-juniper' }
const onR76: StickerFacts = { ...blank, state: 'on_box', containerId: 'box-r76', containerLabel: 'R76', containerKind: 'cage', jobId: 'job-juniper', placedByName: 'Marcus', placedAt: '2026-11-14T15:00:00Z' }

function Tally() {
  const { search } = useLocation()
  return <div data-testid="tally">{search}</div>
}

function mount(code = '9b1c0d2e') {
  return render(
    <MemoryRouter initialEntries={[`/b/${code}`]}>
      <Routes>
        <Route path="/b/:code" element={<BoxCode />} />
        <Route path="/tally" element={<Tally />} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  resolveBoxCode.mockReset()
})

describe('BoxCode, signed in', () => {
  it('a label printed before stickers still opens its box on the On site tab', async () => {
    resolveBoxCode.mockResolvedValue({ kind: 'box', container: r76, sticker: null })
    mount('4f2a-9c18')
    expect((await screen.findByTestId('tally')).textContent).toBe('?tab=on-site&job=job-juniper&container=box-r76')
    // the code is asked as the label prints it, the dash dropped
    expect(resolveBoxCode).toHaveBeenCalledWith('4F2A9C18')
  })

  it('a sticker on a box goes to that box as a label does', async () => {
    resolveBoxCode.mockResolvedValue({ kind: 'box', container: r76, sticker: onR76 })
    mount()
    expect((await screen.findByTestId('tally')).textContent).toBe('?tab=on-site&job=job-juniper&container=box-r76')
  })

  it('a blank sticker gets a plain page that says it is on no box yet', async () => {
    resolveBoxCode.mockResolvedValue({ kind: 'blank', sticker: blank })
    mount()
    const title = await screen.findByTestId('box-code-title')
    expect(title.textContent).toBe('Sticker 0147 is not on a box yet')
    expect(title.getAttribute('data-kind')).toBe('blank')
    expect(screen.getByTestId('box-code-detail').textContent).toBe('Nobody has said which box it is on.')
    expect(screen.getByText('Open On site').getAttribute('href')).toBe('/tally?tab=on-site')
    expect(screen.queryByTestId('tally')).toBeNull()
  })

  it('a lost sticker says where it was', async () => {
    resolveBoxCode.mockResolvedValue({ kind: 'lost', sticker: { ...onR76, state: 'lost', lostAt: '2026-11-14T16:00:00Z' } })
    mount()
    expect((await screen.findByTestId('box-code-title')).textContent).toBe('Sticker 0147 was marked lost')
    expect(screen.getByTestId('box-code-detail').textContent).toBe('It was on R76. It no longer opens that box.')
  })

  it('a sticker on a retired box, and one on a job the reader is not on, each say so', async () => {
    resolveBoxCode.mockResolvedValue({ kind: 'retired', sticker: { ...onR76, containerRetiredAt: '2026-11-10T00:00:00Z' } })
    mount()
    expect((await screen.findByTestId('box-code-title')).textContent).toBe('Sticker 0147 is on R76, which was retired')
    cleanup()
    resolveBoxCode.mockResolvedValue({ kind: 'out_of_reach', sticker: onR76 })
    mount()
    expect((await screen.findByTestId('box-code-title')).textContent).toBe('Sticker 0147 is on a box of a job you are not on')
    expect(screen.getByTestId('box-code-detail').textContent).toBe('Ask the office to add you to that job.')
  })

  it('a code nothing carries reads as before, and a failed read names its reason', async () => {
    resolveBoxCode.mockResolvedValue({ kind: 'none' })
    mount()
    expect((await screen.findByTestId('box-code-title')).textContent).toBe('9B1C-0D2E is not a box on any job')
    cleanup()
    resolveBoxCode.mockRejectedValue({ message: 'permission denied for table job_containers' })
    mount()
    const title = await screen.findByTestId('box-code-title')
    expect(title.textContent).toBe('Box 9B1C-0D2E did not open')
    expect(title.getAttribute('data-kind')).toBe('error')
    expect(screen.getByTestId('box-code-detail').textContent).toContain('permission denied for table job_containers')
  })
})
