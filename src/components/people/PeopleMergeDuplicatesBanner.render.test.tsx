// @vitest-environment jsdom
/** The Hours tab's duplicates banner (#46 row 6, v2.4945): the count, one row per duplicate, Merge, and Merging… while one runs. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import PeopleMergeDuplicatesBanner from './PeopleMergeDuplicatesBanner'

afterEach(cleanup)

const BOBBY = { personName: 'Bobby', userDisplayName: 'Robert Smith', email: 'bob@example.com' }
const JO = { personName: 'Jo', userDisplayName: 'Joanna Park', email: 'jo@example.com' }

describe('PeopleMergeDuplicatesBanner', () => {
  it('draws nothing when there are no duplicates', () => {
    const { container } = render(<PeopleMergeDuplicatesBanner duplicates={[]} mergingPersonName={null} onMerge={vi.fn()} />)
    expect(container.innerHTML).toBe('')
  })

  it('says how many, lists each pair, and Merge hands that pair back', () => {
    const onMerge = vi.fn()
    render(<PeopleMergeDuplicatesBanner duplicates={[BOBBY, JO]} mergingPersonName={null} onMerge={onMerge} />)
    expect(screen.getByText('Found 2 duplicates: person name vs user. Merge to consolidate.')).toBeTruthy()
    expect(screen.getByText('Bobby → Robert Smith')).toBeTruthy()
    expect(screen.getByText('Jo → Joanna Park')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'Merge' })[1]!)
    expect(onMerge).toHaveBeenCalledWith(JO)
  })

  it('one duplicate reads singular; the row being merged says Merging… and is disabled', () => {
    render(<PeopleMergeDuplicatesBanner duplicates={[BOBBY]} mergingPersonName="Bobby" onMerge={vi.fn()} />)
    expect(screen.getByText('Found 1 duplicate: person name vs user. Merge to consolidate.')).toBeTruthy()
    const button = screen.getByRole('button', { name: 'Merging…' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })
})
