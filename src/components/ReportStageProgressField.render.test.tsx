// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ReportStageProgressField } from './ReportStageProgressField'
import type { StageProgressRow } from '../lib/reports/stageProgressReport'

const stages: StageProgressRow[] = [
  { fixtureId: 'u', name: 'Underground', kind: 'order', sequenceOrder: 1, weightPct: 25, progressPct: 100, drawPaid: true },
  { fixtureId: 'r', name: 'Rough-in', kind: 'order', sequenceOrder: 2, weightPct: 35, progressPct: 60, drawPaid: false },
  { fixtureId: 't', name: 'Top-out', kind: 'order', sequenceOrder: 3, weightPct: 15, progressPct: null, drawPaid: false },
]

describe('ReportStageProgressField (v2.3192)', () => {
  it('lists the stages with weights, shows the derived job % with the arithmetic, and reports picks and slides', () => {
    const onPick = vi.fn()
    const onPct = vi.fn()
    const onSwitch = vi.fn()
    render(<ReportStageProgressField label="How complete is the job?" stages={stages} pick={{ fixtureId: 'r', pct: 60 }} onPick={onPick} onPct={onPct} onSwitchToWholeJob={onSwitch} />)
    expect(screen.getByText('Underground')).toBeTruthy()
    expect(screen.getByText(/25% of the job · draw paid/)).toBeTruthy()
    expect(screen.getByText('46% of the job')).toBeTruthy()
    expect(screen.getByText(/Rough-in 60% × 35% = 21 pts/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Set Rough-in to 100 percent/ }))
    expect(onPct).toHaveBeenCalledWith(100)
    fireEvent.click(screen.getByText('Top-out'))
    expect(onPick).toHaveBeenCalledWith('t')
    fireEvent.click(screen.getByText('Set the whole-job % instead'))
    expect(onSwitch).toHaveBeenCalled()
  })
})
