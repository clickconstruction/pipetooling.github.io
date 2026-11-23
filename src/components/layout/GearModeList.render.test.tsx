// @vitest-environment jsdom
/**
 * Render smoke for the gear menu's mode list (punch list #425): the rows it is handed in their order,
 * the one dot on the mode drawn, and that a press says which row.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { GearModeList } from './GearModeList'
import { GEAR_MODE_LIST_ORDER } from '../../lib/gearMenuSections'
import { MODE_ROW_WORDS, type ModeRowThird } from '../../lib/modeRow'

const rows = () => screen.queryAllByRole('radio')

describe('GearModeList', () => {
  afterEach(() => cleanup())

  it('reads Dashboard, Job Mode, Task Mode as one group named Mode, with the row’s own words', () => {
    render(<GearModeList rows={GEAR_MODE_LIST_ORDER} on="full" onPick={() => {}} />)
    expect(screen.getByRole('radiogroup', { name: MODE_ROW_WORDS.group })).toBeTruthy()
    expect(rows().map((r) => r.textContent)).toEqual(['Dashboard', 'Job Mode', 'Task Mode'])
  })

  it('marks one row, the mode the page is drawn in', () => {
    for (const on of ['full', 'job', 'task'] as ModeRowThird[]) {
      const view = render(<GearModeList rows={GEAR_MODE_LIST_ORDER} on={on} onPick={() => {}} />)
      const checked = rows().filter((r) => r.getAttribute('aria-checked') === 'true')
      expect(checked.map((r) => r.getAttribute('data-gear-mode')), on).toEqual([on])
      expect(checked[0]!.style.fontWeight, on).toBe('600')
      view.unmount()
    }
  })

  it('tells each row’s next press in its tip', () => {
    render(<GearModeList rows={GEAR_MODE_LIST_ORDER} on="job" onPick={() => {}} />)
    expect(rows().map((r) => r.title)).toEqual(['Switch to the Dashboard', 'Job Mode is on', 'Turn Task Mode on. This device shows only your checklist.'])
  })

  it('a press says which row, the one already on too', () => {
    const onPick = vi.fn()
    render(<GearModeList rows={GEAR_MODE_LIST_ORDER} on="full" onPick={onPick} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Task Mode' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Dashboard' }))
    expect(onPick.mock.calls.map((c) => c[0])).toEqual(['task', 'full'])
  })

  it('draws only the rows it is handed, and nothing at all for none', () => {
    const view = render(<GearModeList rows={['full', 'task']} on="full" onPick={() => {}} />)
    expect(rows().map((r) => r.textContent)).toEqual(['Dashboard', 'Task Mode'])
    view.unmount()
    expect(render(<GearModeList rows={[]} on="full" onPick={() => {}} />).container.innerHTML).toBe('')
  })
})
