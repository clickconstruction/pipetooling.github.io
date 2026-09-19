// @vitest-environment jsdom
/**
 * Render smoke for the person strips (v2.3508): the loader is mocked; the cards, pills, the
 * "Open as <name>" link with the preview flag, and the action door are what is checked. The
 * state rules live in personJourney.test.ts.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { PersonJourney } from '../../lib/journeys/personJourney'

const journey: PersonJourney = {
  subject: { kind: 'customer', id: 'c1', name: 'Michael Palmer' },
  journeys: ['homeowner'],
  summary: 'customer · 1 job · portal never visited',
  steps: {
    'estimate-email': { state: 'opened', headline: 'Sent Jul 29 · opened Jul 30', detail: '#1042 · 2 opens', link: null, action: { label: 'Open the estimate', to: '/estimates/e1' } },
    'job-contract-page': { state: 'sent', headline: 'Waiting 10 days · never opened', link: '/contract/sign?t=tok', action: { label: 'Edit & re-send', to: '/jobs?jobDetail=j1' } },
    'customer-portal': { state: 'never', headline: 'No portal link yet', link: null, action: { label: 'Share their portal', to: '/customers/c1' } },
    'demand-letter': { state: 'na', headline: 'Not needed', link: null, action: null },
  },
}

const loadPersonJourney = vi.fn(async () => journey)
vi.mock('../../lib/journeys/loadPersonJourney', () => ({
  loadPersonJourney: (...args: unknown[]) => loadPersonJourney(...(args as [])),
}))

import { PersonJourneyStrips, personLinkHref } from './PersonJourneyStrips'

describe('PersonJourneyStrips', () => {
  it('renders one card per journey step with the state pill, the headline, the person link and the door', async () => {
    renderWithProviders(<PersonJourneyStrips subject={journey.subject} />)
    await waitFor(() => expect(screen.getByTestId('person-journey')).toBeTruthy())
    expect(screen.getByText('Sent Jul 29 · opened Jul 30')).toBeTruthy()
    expect(screen.getByText('Waiting 10 days · never opened')).toBeTruthy()
    const open = screen.getByText('Open as Michael →') as HTMLAnchorElement
    expect(open.getAttribute('href')).toContain('/contract/sign?t=tok')
    expect(open.getAttribute('href')).toContain('preview=1')
    expect(open.getAttribute('target')).toBe('_blank')
    expect(screen.getByText('Edit & re-send →').closest('a')?.getAttribute('href')).toBe('/jobs?jobDetail=j1')
    expect(screen.getByText('Share their portal →')).toBeTruthy()
    // a step the kernel did not answer is not drawn; an n/a step is drawn dimmed
    expect(screen.queryByText('Terms page')).toBeNull()
    expect(screen.getByText('Not needed').closest('[data-state]')?.getAttribute('data-state')).toBe('na')
    // pills
    expect(screen.getAllByText('Opened').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Not yet').length).toBeGreaterThan(0)
  })

  it('personLinkHref: same-origin paths get the preview flag, absolute URLs pass through', () => {
    expect(personLinkHref('https://invoice.stripe.com/x')).toBe('https://invoice.stripe.com/x')
    expect(personLinkHref('/portal?t=abc')).toContain('/portal?t=abc')
    expect(personLinkHref('/portal?t=abc')).toContain('preview=1')
  })
  it('narrows to one job when asked (v2.3615): the loader gets the job id and the strip says so', async () => {
    renderWithProviders(<PersonJourneyStrips subject={journey.subject} jobId="j1" compact />)
    await waitFor(() => expect(screen.getByTestId('person-journey')).toBeTruthy())
    const last = loadPersonJourney.mock.calls[loadPersonJourney.mock.calls.length - 1] as unknown[]
    expect(last[2]).toEqual({ jobId: 'j1' })
    expect(screen.getByText(/journey on this job, as it actually went/)).toBeTruthy()
  })
})
