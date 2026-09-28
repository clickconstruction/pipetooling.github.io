// @vitest-environment jsdom
/**
 * The Dashboard's two canvas adapters hand `scrollZoomAfterClick` to the shared
 * canvases (v2.3963) — the card's own render test stands in for the adapters,
 * so the hand-off is checked here.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { PinsMapCanvasProps } from '../map/PinsMapCanvas'
import type { DashboardJobsMapPin } from '../../lib/dashboardJobsMap'
import DashboardJobsMapCanvas from './DashboardJobsMapCanvas'
import DashboardJobsMapGoogleCanvas from './DashboardJobsMapGoogleCanvas'

vi.mock('../map/PinsMapCanvas', () => ({
  default: (p: PinsMapCanvasProps) => <div data-testid="canvas" data-scroll-gate={String(p.scrollZoomAfterClick ?? false)} />,
}))
vi.mock('../map/PinsMapGoogleCanvas', () => ({
  default: (p: PinsMapCanvasProps) => <div data-testid="google-canvas" data-scroll-gate={String(p.scrollZoomAfterClick ?? false)} />,
}))

const pins: DashboardJobsMapPin[] = []
const base = { pins, selectedId: null, onSelect: () => {}, onOpenJob: () => {}, onDirections: () => {}, fitSignal: 0, height: 300, isMobile: false }

describe('Dashboard map canvas adapters', () => {
  it('pass scrollZoomAfterClick through to the Leaflet canvas, and leave it off when the card does not ask', () => {
    const on = render(<DashboardJobsMapCanvas {...base} scrollZoomAfterClick />)
    expect(screen.getByTestId('canvas').getAttribute('data-scroll-gate')).toBe('true')
    on.unmount()
    render(<DashboardJobsMapCanvas {...base} />)
    expect(screen.getByTestId('canvas').getAttribute('data-scroll-gate')).toBe('false')
  })

  it('pass scrollZoomAfterClick through to the Google canvas, and leave it off when the card does not ask', () => {
    const on = render(<DashboardJobsMapGoogleCanvas {...base} apiKey="k" onUnavailable={() => {}} scrollZoomAfterClick />)
    expect(screen.getByTestId('google-canvas').getAttribute('data-scroll-gate')).toBe('true')
    on.unmount()
    render(<DashboardJobsMapGoogleCanvas {...base} apiKey="k" onUnavailable={() => {}} />)
    expect(screen.getByTestId('google-canvas').getAttribute('data-scroll-gate')).toBe('false')
  })
})
