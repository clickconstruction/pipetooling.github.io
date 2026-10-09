// @vitest-environment jsdom
/**
 * The sample estimate on the customer page (v2.5112, punch list #103): the page draws the options
 * the sample serves through the save kernel — two choices with the ★ on the tank, and the add-on
 * unticked — and the approval starts on the ★ choice's total. The function is a stand-in serving
 * `sampleEstimateResponse`, the body get-estimate-for-customer returns for the sample token.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { installDomShims } from '../test/renderSmokeMocks'
import { sampleEstimateResponse } from '../../supabase/functions/_shared/customerSampleFixtures'
import EstimateAccept from './EstimateAccept'

beforeEach(() => {
  installDomShims()
  vi.stubGlobal('scrollTo', vi.fn())
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const json = (body: unknown) => ({ ok: true, json: async () => body }) as unknown as Response
    if (url.includes('get-estimate-for-customer')) return json(sampleEstimateResponse([], 'live', '2026-10-09').body)
    return json({})
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('EstimateAccept · the sample estimate (v2.5112, #103)', () => {
  it('offers both choices and the add-on, the add-on unticked, and approves the ★ choice by default', async () => {
    render(
      <MemoryRouter initialEntries={['/estimate/accept?t=sample']}>
        <EstimateAccept />
      </MemoryRouter>,
    )
    const addOn = await screen.findByRole('checkbox', { name: /Hot water recirculation pump/ })
    expect(addOn.getAttribute('aria-checked')).toBe('false')
    expect(screen.getAllByText(/50-gal gas tank, like for like/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Tankless gas heater/).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /^Approve “50-gal gas tank, like for like” — \$4,380\.00$|^Approve "50-gal gas tank, like for like" — \$4,380\.00$/ }).length).toBeGreaterThan(0)
  })
})
