// @vitest-environment jsdom
/**
 * **Secrecy on this site** (punch list #439, piece 4): the block's wiring, with a fake for its reads and presses.
 * Made-up names only.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SiteSecrecyRow } from '../../lib/addresses/siteSecrecy'
import type { SiteSecrecyIo } from '../../lib/addresses/siteSecrecyIo'
import type { BookPaperRow } from '../../lib/jobs/jobPapers'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { SiteSecrecy } from './SiteSecrecy'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
// The retry panel reads the sign-in. The block itself takes its role as a prop.
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})

const SITE = { developmentId: 'dev-1' }
const book: BookPaperRow[] = [
  { id: 'book-sec', document_name: 'ZZ Test site secrecy paper', book_body_html: '<p>Say nothing.</p>', book_body_format: 'html', audience: 'staff' },
  { id: 'book-blank', document_name: 'Blank paper', book_body_html: '', book_body_format: 'html', audience: 'staff' },
  { id: 'book-set', document_name: 'Sample secrecy paper', book_body_html: null, book_body_format: 'html', audience: 'sub', settings_def: { settings: [], fields: [], levels: [] } },
]
const ON: SiteSecrecyRow = { id: 'site-1', development_id: 'dev-1', address_key: null, address: null, book_document_id: 'book-sec', paper_name: 'ZZ Test site secrecy paper', turned_on_at: '2026-11-27T18:00:00Z', turned_off_at: null }

function fakeIo(over: Partial<SiteSecrecyIo> = {}): SiteSecrecyIo {
  return {
    readLive: vi.fn(async () => null),
    readCounts: vi.fn(async () => ({ jobs: 3, signed: 5 })),
    preview: vi.fn(async () => ({ jobs: 3, people: 12 })),
    readBook: vi.fn(async () => book),
    turnOn: vi.fn(async () => ({ id: 'site-1', jobs: 3 })),
    turnOff: vi.fn(async () => undefined),
    ...over,
  }
}

afterEach(() => cleanup())

describe('SiteSecrecy', () => {
  it('off, the office reads what it does, and the press opens the panel that counts before its last press', async () => {
    const readLive = vi.fn<SiteSecrecyIo['readLive']>(async () => null)
    const io = fakeIo({ readLive })
    renderWithProviders(<SiteSecrecy site={SITE} role="assistant" io={io} />)
    const block = await screen.findByTestId('site-secrecy')
    expect(block.getAttribute('data-secrecy')).toBe('off')
    expect(within(block).getByText('Off')).toBeTruthy()
    // Nothing is counted and no paper is read until the press.
    expect(io.preview).not.toHaveBeenCalled()
    expect(io.readBook).not.toHaveBeenCalled()
    fireEvent.click(within(block).getByRole('button', { name: 'Turn on secrecy for this site' }))
    const panel = await screen.findByTestId('site-secrecy-panel')
    expect(await within(panel).findByText('3 jobs')).toBeTruthy()
    expect(within(panel).getByText('12 people')).toBeTruthy()
    expect(io.preview).toHaveBeenCalledWith(SITE)
    // A paper built from settings is not offered. One with no words is there, dead.
    const picks = within(panel).getAllByRole('radio')
    expect(picks.map((p) => p.textContent)).toEqual(['Blank paperNo words yet. Write it in the Contract Book first.', 'ZZ Test site secrecy paperFrom the Contract Book'])
    expect((picks[0] as HTMLButtonElement).disabled).toBe(true)
    // The last press is dead until a paper is picked, and it names its count.
    const last = within(panel).getByRole('button', { name: 'Turn it on and ask 12 people to sign' }) as HTMLButtonElement
    expect(last.disabled).toBe(true)
    fireEvent.click(picks[1]!)
    expect(picks[1]!.getAttribute('aria-checked')).toBe('true')
    expect(last.disabled).toBe(false)
    readLive.mockResolvedValue(ON)
    fireEvent.click(last)
    await waitFor(() => expect(io.turnOn).toHaveBeenCalledWith(SITE, 'book-sec'))
    expect(await screen.findByText('Secrecy is on. 3 jobs now ask for the paper.')).toBeTruthy()
    // The block reads again and draws the on state.
    await waitFor(() => expect(screen.getByTestId('site-secrecy').getAttribute('data-secrecy')).toBe('on'))
    expect(screen.queryByTestId('site-secrecy-panel')).toBeNull()
  })

  it('Not yet closes the panel and writes nothing', async () => {
    const io = fakeIo()
    renderWithProviders(<SiteSecrecy site={SITE} role="dev" io={io} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Turn on secrecy for this site' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Not yet' }))
    expect(screen.queryByTestId('site-secrecy-panel')).toBeNull()
    expect(io.turnOn).not.toHaveBeenCalled()
  })

  it('a refusal says its reason in the panel and leaves it open', async () => {
    const io = fakeIo({ turnOn: vi.fn(async () => Promise.reject(new Error('Blank paper has no words yet. Write it in the Contract Book first.'))) })
    renderWithProviders(<SiteSecrecy site={SITE} role="controller" io={io} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Turn on secrecy for this site' }))
    const panel = await screen.findByTestId('site-secrecy-panel')
    fireEvent.click((await within(panel).findAllByRole('radio'))[1]!)
    fireEvent.click(await within(panel).findByRole('button', { name: 'Turn it on and ask 12 people to sign' }))
    expect((await within(panel).findByRole('alert')).textContent).toBe('Blank paper has no words yet. Write it in the Contract Book first.')
    expect(screen.getByTestId('site-secrecy-panel')).toBeTruthy()
  })

  it('on, it says since when, the paper and the counts, and Turn it off asks first', async () => {
    const readLive = vi.fn<SiteSecrecyIo['readLive']>(async () => ON)
    const io = fakeIo({ readLive })
    renderWithProviders(<SiteSecrecy site={SITE} role="master_technician" io={io} />)
    const block = await screen.findByTestId('site-secrecy')
    expect(block.getAttribute('data-secrecy')).toBe('on')
    expect(within(block).getByText('Nov 27')).toBeTruthy()
    expect(within(block).getByText('ZZ Test site secrecy paper')).toBeTruthy()
    expect(await within(block).findByText('3 jobs')).toBeTruthy()
    expect(within(block).getByText('5 people')).toBeTruthy()
    expect(io.readCounts).toHaveBeenCalledWith('site-1')
    fireEvent.click(within(block).getByRole('button', { name: 'Turn it off…' }))
    expect(await screen.findByText('Turn off secrecy for this site?')).toBeTruthy()
    expect(screen.getByText('The 3 jobs here open at once. Every signature on ZZ Test site secrecy paper is kept. Turn it on again and only people who never signed are asked.')).toBeTruthy()
    expect(io.turnOff).not.toHaveBeenCalled()
    readLive.mockResolvedValue(null)
    fireEvent.click(screen.getByRole('button', { name: 'Turn secrecy off' }))
    await waitFor(() => expect(io.turnOff).toHaveBeenCalledWith('site-1'))
    await waitFor(() => expect(screen.getByTestId('site-secrecy').getAttribute('data-secrecy')).toBe('off'))
  })

  it('Keep it on leaves it on', async () => {
    const io = fakeIo({ readLive: vi.fn(async () => ON) })
    renderWithProviders(<SiteSecrecy site={SITE} role="assistant" io={io} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Turn it off…' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Keep it on' }))
    expect(io.turnOff).not.toHaveBeenCalled()
    expect(screen.getByTestId('site-secrecy').getAttribute('data-secrecy')).toBe('on')
  })

  it('a count of the signed that could not be read leaves its line out', async () => {
    const io = fakeIo({ readLive: vi.fn(async () => ON), readCounts: vi.fn(async () => ({ jobs: 2, signed: null })) })
    renderWithProviders(<SiteSecrecy site={SITE} role="assistant" io={io} />)
    const block = await screen.findByTestId('site-secrecy')
    expect(await within(block).findByText('2 jobs')).toBeTruthy()
    expect(within(block).queryByText('Signed')).toBeNull()
  })

  it('the estimator reads both states and has no press', async () => {
    const { unmount } = renderWithProviders(<SiteSecrecy site={SITE} role="estimator" io={fakeIo()} />)
    const off = await screen.findByTestId('site-secrecy')
    expect(within(off).getByText('The office turns secrecy on and off.')).toBeTruthy()
    expect(within(off).queryByRole('button')).toBeNull()
    unmount()
    renderWithProviders(<SiteSecrecy site={SITE} role="estimator" io={fakeIo({ readLive: vi.fn(async () => ON) })} />)
    const on = await screen.findByTestId('site-secrecy')
    expect(within(on).getByText('ZZ Test site secrecy paper')).toBeTruthy()
    expect(within(on).queryByRole('button')).toBeNull()
  })

  it('on a lone job the site is its address, the lead says so, and the neighbour is told when it turns on', async () => {
    const lone = { address: '12 Sample St' }
    const readLive = vi.fn<SiteSecrecyIo['readLive']>(async () => null)
    const io = fakeIo({ readLive })
    const onChanged = vi.fn()
    renderWithProviders(<SiteSecrecy site={lone} role="assistant" boxed={false} onChanged={onChanged} io={io} testId="job-site-secrecy" />)
    const block = await screen.findByTestId('job-site-secrecy')
    expect(within(block).getByText(/every job at this address/)).toBeTruthy()
    fireEvent.click(within(block).getByRole('button', { name: 'Turn on secrecy for this site' }))
    fireEvent.click((await screen.findAllByRole('radio'))[1]!)
    readLive.mockResolvedValue({ ...ON, development_id: null, address_key: '12 sample street', address: '12 Sample St' })
    fireEvent.click(await screen.findByRole('button', { name: 'Turn it on and ask 12 people to sign' }))
    await waitFor(() => expect(io.turnOn).toHaveBeenCalledWith(lone, 'book-sec'))
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    expect(io.preview).toHaveBeenCalledWith(lone)
  })

  it('a job in a development reads the on state with no press, and draws nothing while it is off', async () => {
    const { unmount, container } = renderWithProviders(<SiteSecrecy site={SITE} mode="reads" role="assistant" io={fakeIo()} testId="job-site-secrecy" />)
    await waitFor(() => expect(container.querySelector('[data-testid="job-site-secrecy"]')).toBeNull())
    unmount()
    const io = fakeIo({ readLive: vi.fn(async () => ON) })
    renderWithProviders(<SiteSecrecy site={SITE} mode="reads" role="assistant" io={io} testId="job-site-secrecy" />)
    const block = await screen.findByTestId('job-site-secrecy')
    expect(within(block).getByText('ZZ Test site secrecy paper')).toBeTruthy()
    expect(within(block).getByText('This job’s development has secrecy on. Turn it off on the development’s page.')).toBeTruthy()
    expect(within(block).queryByRole('button')).toBeNull()
  })

  it('a block that only reads says nothing of a read that failed', async () => {
    const io = fakeIo({ readLive: vi.fn(async () => Promise.reject(new Error('offline'))) })
    const { container } = renderWithProviders(<SiteSecrecy site={SITE} mode="reads" role="assistant" io={io} testId="job-site-secrecy" />)
    await waitFor(() => expect(io.readLive).toHaveBeenCalled())
    expect(container.querySelector('[data-testid="job-site-secrecy"]')).toBeNull()
  })

  it('anyone else sees nothing, and nothing is read for them', async () => {
    for (const role of ['primary', 'superintendent', 'subcontractor', 'helpers', null]) {
      const io = fakeIo()
      const { container, unmount } = renderWithProviders(<SiteSecrecy site={SITE} role={role} io={io} />)
      expect(container.querySelector('[data-testid="site-secrecy"]')).toBeNull()
      expect(io.readLive).not.toHaveBeenCalled()
      unmount()
    }
  })

  it('before the migration is pushed the block draws nothing, never a dead press', async () => {
    const io = fakeIo({ readLive: vi.fn(async () => 'not-there' as const) })
    const { container } = renderWithProviders(<SiteSecrecy site={SITE} role="assistant" io={io} />)
    await waitFor(() => expect(io.readLive).toHaveBeenCalled())
    expect(container.querySelector('[data-testid="site-secrecy"]')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('a read that fails draws the retry panel with its reason', async () => {
    const io = fakeIo({ readLive: vi.fn(async () => Promise.reject(new Error('Only the office reads a site’s secrecy.'))) })
    renderWithProviders(<SiteSecrecy site={SITE} role="assistant" io={io} />)
    const block = await screen.findByTestId('site-secrecy')
    expect(block.getAttribute('data-secrecy')).toBe('unread')
    expect(within(block).getByText(/Only the office reads a site’s secrecy\./)).toBeTruthy()
  })
})
