// @vitest-environment jsdom
/**
 * The row chip (v2.3769): a task sent from a job — `{{1:1016 · Mission faucet}} — <task>`
 * with the job door as link [1] — renders the job as a chip and drops the dash;
 * every other token keeps today's underlined link.
 */
import { describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ChecklistTitleWithLinks } from './ChecklistTitleWithLinks'

const JOB_URL = 'https://clicktooling.com/jobs?jobDetail=0060850d-ab27-4bd6-a67f-144308f9b6cd'

describe('ChecklistTitleWithLinks job chip (v2.3769)', () => {
  it('renders a job-door token as the chip — number badge, name, opens the job — and drops the dash', () => {
    const { container } = render(
      <ChecklistTitleWithLinks title="{{1:1016 · Mission faucet}} — Pick up the Moen cartridge" links={[JOB_URL]} />
    )
    const chip = screen.getByTestId('checklist-job-chip') as HTMLAnchorElement
    expect(chip.getAttribute('href')).toBe(JOB_URL)
    expect(chip.textContent).toContain('1016')
    expect(chip.textContent).toContain('Mission faucet')
    expect(chip.style.textDecoration).toBe('none')
    expect(container.textContent).not.toContain('—')
    expect(container.textContent).toContain('Pick up the Moen cartridge')
    cleanup()
  })

  it('leaves a token whose link is not a job door as the underlined link, dash and all', () => {
    const { container } = render(
      <ChecklistTitleWithLinks title="Van 3 — Change the battery {{1:vehicle}}" links={['https://clicktooling.com/people?tab=vehicles']} />
    )
    expect(screen.queryByTestId('checklist-job-chip')).toBeNull()
    const link = container.querySelector('a') as HTMLAnchorElement
    expect(link.textContent).toBe('vehicle')
    expect(link.style.textDecoration).toBe('underline')
    expect(container.textContent).toContain('Van 3 — Change the battery')
    cleanup()
  })

  it('keeps [n] links and plain titles exactly as before', () => {
    const { container } = render(<ChecklistTitleWithLinks title="Order the copper [1]" links={['https://supplyhouse.example/x']} />)
    expect(screen.queryByTestId('checklist-job-chip')).toBeNull()
    expect(container.querySelector('a')?.textContent).toBe('[1]')
    cleanup()
    const plain = render(<ChecklistTitleWithLinks title="Call Structura about the Friday pour" links={[]} />)
    expect(plain.container.textContent).toBe('Call Structura about the Friday pour')
    cleanup()
  })
})
