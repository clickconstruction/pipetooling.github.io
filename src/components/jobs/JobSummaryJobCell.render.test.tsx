// @vitest-environment jsdom
/**
 * Render smokes for JobSummaryJobCell (v2.3176) — the one identity cell on
 * Jobs → Job Summary that folded Job # · Name · Address into two lines.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { JobSummaryJobCell } from './JobSummaryJobCell'

describe('JobSummaryJobCell', () => {
  it('puts the number, name and chips on line 1 and the address on line 2 with the full text on hover', () => {
    render(
      <JobSummaryJobCell
        expanded={false}
        hcpNumber="754"
        clickNumber={null}
        serviceTypeName="Plumbing"
        jobName="Lavender Springs Assisted Living"
        address="501 Ranch to Market Rd 3237, Wimberley, TX 78676"
        chips={<span>✂ write-down</span>}
      />,
    )
    const cell = screen.getByTestId('job-summary-job-cell')
    expect(cell.textContent).toContain('J754')
    expect(cell.textContent).toContain('plum')
    expect(cell.textContent).toContain('Lavender Springs Assisted Living')
    expect(cell.textContent).toContain('✂ write-down')
    expect(cell.textContent).toContain('▶')
    const addr = screen.getByTitle('501 Ranch to Market Rd 3237, Wimberley, TX 78676')
    expect(addr.textContent).toBe('501 Ranch to Market Rd 3237, Wimberley, TX 78676')
    expect(addr.style.textOverflow).toBe('ellipsis')
  })

  it('shows the open caret when expanded and dashes for a missing name and address', () => {
    render(<JobSummaryJobCell expanded hcpNumber={null} clickNumber="812" jobName={null} address="   " />)
    const cell = screen.getByTestId('job-summary-job-cell')
    expect(cell.textContent).toContain('▼')
    expect(cell.textContent).toContain('J812')
    expect((cell.textContent?.match(/—/g) ?? []).length).toBe(2)
    expect(screen.queryByTitle(/./)).toBeNull()
  })
})
