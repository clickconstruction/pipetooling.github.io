// @vitest-environment jsdom
/**
 * The History legend (the owner, 2026-11-02): the ? press opens the window, which reads every mark
 * under its chip with its name and its words, and Close shuts it.
 */
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { HISTORY_LEGEND } from '../../lib/developments/historyLegend'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { HistoryLegendPress } from './HistoryLegendWindow'

afterEach(() => cleanup())

describe('HistoryLegendPress', () => {
  it('opens the legend with every mark under its chip, and Close shuts it', () => {
    renderWithProviders(<HistoryLegendPress />)
    expect(screen.queryByTestId('history-legend')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'What the marks mean' }))
    expect(screen.getByText('What the marks mean')).toBeTruthy()
    expect(screen.getAllByTestId('history-legend-row')).toHaveLength(HISTORY_LEGEND.length)
    expect(screen.getByText('A note')).toBeTruthy()
    expect(screen.getByText('A job or a bid moved to a new status or stage, or a new job or bid was made.')).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Money' })).toBeTruthy()
    // The shell has its own ✕; the footer's Close is the one with the word on it.
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' }).find((b) => b.textContent === 'Close')!)
    expect(screen.queryByTestId('history-legend')).toBeNull()
  })
})
