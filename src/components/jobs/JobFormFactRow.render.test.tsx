// @vitest-environment jsdom
/**
 * A row of the job form's Edit tab counts its editor being opened (v2.8704, punch list #190): one press row
 * under the row's name, by the row's body or its pencil alike. Closing writes none, and a read-only row has
 * no press at all.
 */
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const opened = vi.fn()
vi.mock('../../lib/navClickViewer', () => ({ recordJobEditRowOpened: (label: string) => opened(label) }))

import { JobFormFactRow } from './JobFormFactRow'

function Row({ label }: { label: string }) {
  const [open, setOpen] = useState(false)
  return (
    <JobFormFactRow label={label} value="ZZ Test Hand" expanded={open} onToggle={() => setOpen((v) => !v)}>
      <button type="button">ZZ Test Hand</button>
    </JobFormFactRow>
  )
}

afterEach(() => {
  cleanup()
  opened.mockClear()
})

describe('JobFormFactRow: the press count', () => {
  it('counts the pencil opening the editor once, and not its closing', () => {
    render(<Row label="Team" />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit Team' }))
    expect(opened.mock.calls).toEqual([['Team']])
    expect(screen.getByRole('region', { name: 'Team editor' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close Team editor' }))
    expect(opened).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('region', { name: 'Team editor' })).toBeNull()
  })

  it('counts a press on the row’s body the same way, once', () => {
    const view = render(<Row label="Account man" />)
    fireEvent.click(view.container.querySelector('[data-fact-row="Account man"]')!)
    expect(opened.mock.calls).toEqual([['Account man']])
  })

  it('counts nothing for a press inside the open editor', () => {
    render(<Row label="Team" />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit Team' }))
    fireEvent.click(screen.getByRole('button', { name: 'ZZ Test Hand' }))
    expect(opened).toHaveBeenCalledTimes(1)
  })

  it('a read-only row has no pencil and counts nothing', () => {
    const view = render(<JobFormFactRow label="Contract" value="Signed" />)
    expect(screen.queryByRole('button')).toBeNull()
    fireEvent.click(view.container.querySelector('[data-fact-row="Contract"]')!)
    expect(opened).not.toHaveBeenCalled()
  })
})
