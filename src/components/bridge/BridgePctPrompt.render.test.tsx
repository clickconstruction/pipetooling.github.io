// @vitest-environment jsdom
/**
 * Render smokes for the percents prompt (v2.5245): the strip's line, the list
 * biggest contract first, and a Set press mounting the dashboard's percent
 * modal on that job. A set row reads set at the bottom, and the done line
 * turns the dot green.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as Record<string, unknown> & { from: (table: string) => unknown }
  const originalFrom = stub.from.bind(stub)
  stub.from = (table: string) => {
    if (table === 'jobs_ledger') {
      const builder: Record<string, unknown> = {}
      for (const m of ['select', 'eq']) builder[m] = () => builder
      builder.maybeSingle = () => Promise.resolve({ data: { pct_complete: null, status: 'working' }, error: null })
      return builder
    }
    return originalFrom(table)
  }
  return { supabase: stub }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

import { BridgePctPrompt } from './BridgePctPrompt'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { buildPctPrompt } from '../../lib/bridge/pctPrompt'
import type { BuildJob } from '../../lib/bridge/buildPace'

const job = (id: string, name: string, revenueUsd: number | null, pctComplete: number | null): BuildJob => ({ id, label: `J${id} · ${name}`, hcpNumber: `J${id}`, jobName: name, revenueUsd, pctComplete, status: 'working', createdYmd: '2026-07-01' })

describe('BridgePctPrompt', () => {
  it('draws the line, opens the list biggest first, and mounts the percent modal on Set', async () => {
    const prompt = buildPctPrompt([job('949', 'Dominguez- Run camera', 86_000, null), job('951', 'Ortiz repipe', 240_000, null), job('960', 'Lee remodel', 50_000, 30)], new Map())!
    const onSaved = vi.fn()
    renderWithProviders(<BridgePctPrompt prompt={prompt} onSaved={onSaved} />)
    expect(screen.getByTestId('bridge-pct-prompt-line').textContent).toBe('2 open jobs have no %. $326k of contract reads as half done.')
    expect(screen.queryByTestId('bridge-pct-prompt-list')).toBeNull()
    const toggle = screen.getByTestId('bridge-pct-prompt-toggle')
    expect(toggle.textContent).toBe('Set the %s')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    const rows = screen.getAllByTestId('bridge-pct-prompt-row')
    expect(rows.map((r) => r.textContent)).toEqual(['J951 · Ortiz repipe$240kno %Set', 'J949 · Dominguez- Run camera$86kno %Set'])
    expect(screen.getByTestId('bridge-pct-prompt-note').textContent).toContain('Each set files a status report on the job')
    fireEvent.click(screen.getAllByTestId('bridge-pct-prompt-set')[0]!)
    expect(screen.getByRole('dialog', { name: 'Update % done for J951 · Ortiz repipe' })).toBeTruthy()
    await waitFor(() => expect(screen.getByText('Save 0%')).toBeTruthy())
    fireEvent.click(screen.getByText('Not now'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('reads a set row at the bottom and the done line once none is left', () => {
    const prompt = buildPctPrompt([job('949', 'Dominguez- Run camera', 86_000, 60)], new Map([['949', 60]]))!
    renderWithProviders(<BridgePctPrompt prompt={prompt} onSaved={vi.fn()} />)
    expect(screen.getByTestId('bridge-pct-prompt-line').textContent).toBe('Every open job with a contract has a %.')
    fireEvent.click(screen.getByTestId('bridge-pct-prompt-toggle'))
    expect(screen.getByTestId('bridge-pct-prompt-status').textContent).toBe('60% · set')
    expect(screen.getByTestId('bridge-pct-prompt-set').textContent).toBe('Change')
  })
})
