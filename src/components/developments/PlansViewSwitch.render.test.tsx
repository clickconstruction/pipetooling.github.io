// @vitest-environment jsdom
/**
 * The Plans look's switch (punch list #367): two presses, the one in use pressed, and labels that never wrap,
 * since on a phone-width window the label *By date* broke onto a second line.
 */
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { PlansViewSwitch } from './PlansViewSwitch'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

afterEach(cleanup)

describe('PlansViewSwitch', () => {
  it('names the two views, presses the one in use, and hands a press to the page', () => {
    const picked: string[] = []
    renderWithProviders(<PlansViewSwitch view="part" onChange={(v) => picked.push(v)} phone={false} />)
    const group = screen.getByRole('group', { name: 'Plans views' })
    expect([...group.querySelectorAll('button')].map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['By part', 'true'],
      ['By date', 'false'],
    ])
    fireEvent.click(screen.getByRole('button', { name: 'By date' }))
    expect(picked).toEqual(['date'])
  })

  it('never lets a label wrap, on a phone or a desktop', () => {
    for (const phone of [true, false]) {
      const { unmount } = renderWithProviders(<PlansViewSwitch view="date" onChange={() => undefined} phone={phone} />)
      for (const b of screen.getAllByRole('button')) expect(b.style.whiteSpace).toBe('nowrap')
      // The switch keeps its own width: the head's flex row never squeezes it.
      expect(screen.getByTestId('plans-views').style.flex).toBe('0 0 auto')
      unmount()
    }
  })
})
