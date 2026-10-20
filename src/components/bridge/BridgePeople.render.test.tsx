// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { useState } from 'react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgePeople } from './BridgePeople'

function Host() {
  const [open, setOpen] = useState(false)
  return (
    <BridgePeople summary="pay week Oct 4–10 (so far) · Malachi +$5.6k, Abraham +$4.1k on approved hours" open={open} onToggle={() => setOpen((o) => !o)}>
      <div>the rows</div>
    </BridgePeople>
  )
}

describe('BridgePeople', () => {
  it('shows the summary closed, opens on the button and hides again', () => {
    renderWithProviders(<Host />)
    expect(screen.getByTestId('bridge-people-summary').textContent).toContain('Malachi +$5.6k')
    expect(screen.queryByText('the rows')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show the rows and the days' }))
    expect(screen.getByText('the rows')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Hide the rows' }))
    expect(screen.queryByText('the rows')).toBeNull()
  })
})
