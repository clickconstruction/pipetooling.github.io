// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeHeadline } from './BridgeHeadline'
import { buildHeadline, cashLight, netPositionLight } from '../../lib/bridge/headline'
import { buildVectorGrid } from '../../lib/bridge/vectorDays'
import { buildWeekCards } from '../../lib/bridge/weekCard'
import type { VectorSession } from '../../lib/bridge/vectors'

const TODAY = '2026-10-10'
const people = [{ userId: 'u1', name: 'Abraham', role: 'helpers', archived: false }]
const wages = [{ userId: 'u1', fieldWage: 40, officeWage: null, isSalary: false }]
const rates = new Map([['j1', 100]])
const labels = new Map([['j1', '1047 Magnus Sewer Line']])
const s = (workDate: string, hours: number): VectorSession => ({ userId: 'u1', workDate, hours, jobId: 'j1', onBid: false, officeJob: false, approved: true, pending: false })

describe('BridgeHeadline week cards', () => {
  it('a bar is a button; pressing it opens the week’s card', () => {
    const common = { zoom: 'weeks' as const, anchorYmd: TODAY, todayYmd: TODAY, people, wages, sessions: [s('2026-09-22', 10), s('2026-09-23', 10)], ratePerHourByJob: rates, jobLabels: labels }
    const recorded = buildVectorGrid({ ...common, mode: 'recorded' })
    const approved = buildVectorGrid({ ...common, mode: 'approved' })
    const headline = buildHeadline({ recorded, approved })
    const cards = buildWeekCards({ headline, recorded, approved, dateRange: (a, b) => `${a}–${b}` })
    renderWithProviders(<BridgeHeadline headline={headline} cards={cards} loading={false} error={null} net={netPositionLight(null)} cash={cashLight(null)} />)
    expect(screen.queryByTestId('bridge-week-card')).toBeNull()
    fireEvent.click(screen.getByTestId('bridge-headline-bar-2026-09-20'))
    const card = screen.getByTestId('bridge-week-card')
    expect(card.textContent).toContain('Pay week 2026-09-20–2026-09-26')
    expect(card.textContent).toContain('1047 Magnus Sewer Line')
    expect(card.textContent).toContain('20h on record')
    fireEvent.click(screen.getByTestId('bridge-headline-bar-2026-09-20'))
    expect(screen.queryByTestId('bridge-week-card')).toBeNull()
  })
})
