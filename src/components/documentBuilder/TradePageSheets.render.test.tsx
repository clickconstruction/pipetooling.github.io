// @vitest-environment jsdom
/**
 * A job's insurance sheet on a trade partner's own page (punch list #404, step 5): nothing for a company sent none,
 * who the certificate must name, the sheet opened in place with the office told once, and the mail to their
 * insurance agent only while the sheet's link is on. Every name here is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { INSURANCE_SHEET_FIXTURE } from '../../lib/documentBuilder/insuranceSheet.fixture'
import { layOver, startJobSheet } from '../../lib/documentBuilder/sheet'
import type { TradeSheet } from '../../lib/documentBuilder/tradePageSheets'
import { TradePageSheets, TradeSheetsContext } from './TradePageSheets'

afterEach(cleanup)

const sheet = (over: Partial<TradeSheet> = {}): TradeSheet => ({
  sheetId: 's1',
  projectId: 'p1',
  job: 'Cedar Park Medical Office',
  revision: 1,
  sheet: layOver(INSURANCE_SHEET_FIXTURE, startJobSheet({ name: 'Cedar Park Medical Office', place: '410 Sample Street', insured: ['Pecan Ridge Holdings', 'Lone Oak Property Management'] })),
  linkCode: 'abcdefgh23456789',
  opened: false,
  changed: false,
  ...over,
})

function draw(sheets: TradeSheet[], lang: 'en' | 'es' = 'en') {
  const opened = vi.fn()
  render(
    <TradeSheetsContext.Provider value={{ sheets, opened }}>
      <TradePageSheets lang={lang} />
    </TradeSheetsContext.Provider>,
  )
  return opened
}

describe('TradePageSheets', () => {
  it('draws nothing for a company that was sent no sheet', () => {
    draw([])
    expect(document.querySelector('[data-trade-sheets]')).toBeNull()
  })

  it('says who the certificate must name on the job, and marks a sheet not opened yet', () => {
    draw([sheet()])
    expect(screen.getByText('What your certificate must show')).toBeTruthy()
    expect(screen.getByText('Cedar Park Medical Office')).toBeTruthy()
    expect(screen.getByText('It must name Pecan Ridge Holdings and Lone Oak Property Management.')).toBeTruthy()
    expect(screen.getByText('New')).toBeTruthy()
  })

  it('opens the sheet in place, tells the office once, and closes it', () => {
    const opened = draw([sheet()])
    fireEvent.click(screen.getByRole('button', { name: 'Open the sheet' }))
    expect(opened).toHaveBeenCalledWith('s1')
    expect(screen.getByText('INSURANCE REQUIREMENTS')).toBeTruthy()
    expect(screen.getByText('Revision 1 · Cedar Park Medical Office')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open it on its own page to print' }).getAttribute('href')).toBe(`${window.location.origin}/d/abcdefgh23456789`)
    fireEvent.click(screen.getByRole('button', { name: 'Close the sheet' }))
    expect(screen.queryByText('INSURANCE REQUIREMENTS')).toBeNull()
    expect(opened).toHaveBeenCalledTimes(1)
  })

  it('offers the mail to their insurance agent only while the sheet’s link is on', () => {
    draw([sheet(), sheet({ sheetId: 's2', job: 'Mesa Verde Retail Shell', linkCode: null })])
    const links = screen.getAllByRole('link', { name: 'Send it to my insurance agent' })
    expect(links).toHaveLength(1)
    expect(decodeURIComponent(links[0]?.getAttribute('href') ?? '')).toContain(`${window.location.origin}/d/abcdefgh23456789`)
  })

  it('says a sheet changed since they opened it', () => {
    draw([sheet({ opened: false, changed: true })])
    expect(screen.getByText('Changed since you opened it')).toBeTruthy()
    expect(screen.queryByText('New')).toBeNull()
  })

  it('reads in Spanish around the sheet, and says the sheet is in English', () => {
    draw([sheet()], 'es')
    expect(screen.getByText('Debe nombrar a Pecan Ridge Holdings y Lone Oak Property Management.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir la hoja' }))
    expect(screen.getByText('La hoja está en inglés. La lee su agente de seguros.')).toBeTruthy()
    expect(screen.getByText('INSURANCE REQUIREMENTS')).toBeTruthy()
  })
})
