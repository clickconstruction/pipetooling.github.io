// @vitest-environment jsdom
/**
 * The release sheet's firm chooser (v2.6227, punch list #222 PR 3): on a shared county each firm that could take the
 * account is a choice with its role, its fee model and what Click keeps; the pick goes to the header's switch.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import LegalReleaseFirmChooser from './LegalReleaseFirmChooser'
import { firmForAccount } from '../../../lib/legal/firmForAccount'
import type { LegalFirmRow } from '../../../lib/legal/legalMatters'

const firm = (id: string, name: string, pct: number, cost: number) => ({ id, name, active: true, contingency_pct: pct, filing_cost: cost }) as unknown as LegalFirmRow
const ALAMO = firm('alamo', 'Alamo Collections Law, PLLC', 33, 400)
const SNELL = firm('snell', 'Snell Law Firm, PLLC', 33, 350)
const job = { jobId: 'j1', label: '904', county: 'Comal', from: 'record' as const, balance: 2140 }

describe('LegalReleaseFirmChooser', () => {
  it('lists the first call and the firm that also covers the county, with what Click keeps on each, and the pick switches', () => {
    const account = firmForAccount({ jobs: [job], matterFirmId: null, assignments: new Map([['Comal', 'alamo']]), also: new Map([['Comal', ['snell']]]), firms: [ALAMO, SNELL] })
    const onPick = vi.fn()
    render(<LegalReleaseFirmChooser account={account} pickedId="alamo" balance={2140} alsoByCounty={new Map([['Comal', ['snell']]])} onPick={onPick} />)
    expect(screen.getByRole('radiogroup', { name: 'Which firm takes it' })).toBeTruthy()
    const words = [...document.querySelectorAll('[data-legal-release-firm-words]')].map((e) => e.textContent)
    expect(words).toEqual([
      'first call for Comal County · 33% · $400 filing · Click keeps ~$1,033.80',
      'also covers Comal County · 33% · $350 filing · Click keeps ~$1,083.80',
    ])
    expect((document.querySelector('[data-legal-release-firm="alamo"] input') as HTMLInputElement).checked).toBe(true)
    fireEvent.click(document.querySelector('[data-legal-release-firm="snell"] input')!)
    expect(onPick).toHaveBeenCalledWith('snell')
  })

  it('draws nothing when one firm could take it', () => {
    const account = firmForAccount({ jobs: [job], matterFirmId: null, assignments: new Map([['Comal', 'alamo']]), firms: [ALAMO, SNELL] })
    const { container } = render(<LegalReleaseFirmChooser account={account} pickedId="alamo" balance={2140} alsoByCounty={new Map()} onPick={vi.fn()} />)
    expect(container.innerHTML).toBe('')
  })
})
