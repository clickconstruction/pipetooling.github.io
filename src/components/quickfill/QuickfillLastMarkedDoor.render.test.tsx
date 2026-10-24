// @vitest-environment jsdom
/**
 * The *Last marked* and *last look* words as a door to a station's Mark history (punch list
 * #156, v2.5826): a press with the station's name in its accessible name, plain words when the
 * station keeps no history; and the round screen draws its *last look* words through it.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import { QuickfillLastMarkedDoor } from './QuickfillLastMarkedDoor'
import { QuickfillRoundScreen } from './QuickfillRoundScreen'

beforeAll(installDomShims)
afterEach(() => cleanup())

const noop = () => {}

function roundScreen(props: { personal?: boolean; countLine?: string; lastLook?: string | null; onHistory?: () => void }) {
  return (
    <QuickfillRoundScreen
      label="Assistant Dailys"
      position={{ index: 4, total: 28 }}
      question="Are today's assistant dailys done?"
      countLine={props.countLine ?? '5 open'}
      lastLook={props.lastLook === undefined ? 'last look 22h ago · Dana' : props.lastLook}
      liveCount={5}
      needsNote={false}
      personal={props.personal ?? false}
      marking={false}
      onBack={noop}
      onSkip={noop}
      onLooked={noop}
      onHistory={props.onHistory ?? noop}
    >
      <p>the station</p>
    </QuickfillRoundScreen>
  )
}

describe('QuickfillLastMarkedDoor · the words that open the history (punch list #156)', () => {
  it('is a press that opens the history, named for the station', () => {
    const onOpen = vi.fn()
    renderWithProviders(<QuickfillLastMarkedDoor text="Last marked: Oct 23, 9:54 AM" stationLabel="Office Arriving" onOpen={onOpen} />)
    const door = screen.getByRole('button', { name: 'Last marked: Oct 23, 9:54 AM. Open the mark history for Office Arriving' })
    expect(door.textContent).toBe('Last marked: Oct 23, 9:54 AM')
    fireEvent.click(door)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('stays plain words with its hover when the station keeps no history', () => {
    renderWithProviders(<QuickfillLastMarkedDoor text="Last marked: Oct 23, 10:08 AM" stationLabel="Schedule" title="Last time this section was marked up to date" />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Last marked: Oct 23, 10:08 AM').getAttribute('title')).toBe('Last time this section was marked up to date')
  })
})

describe('QuickfillRoundScreen · the last look words are a door', () => {
  it('draws the count, then the last look words as a press on onHistory', () => {
    const onHistory = vi.fn()
    renderWithProviders(roundScreen({ onHistory }))
    const door = screen.getByTestId('quickfill-last-marked-door')
    expect(door.textContent).toBe('last look 22h ago · Dana')
    expect(door.parentElement?.textContent).toBe('5 open · last look 22h ago · Dana')
    fireEvent.click(door)
    expect(onHistory).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: '📈 history' })).toBeTruthy()
  })

  it('a station with no count shows the last look alone, and a personal door has none', () => {
    renderWithProviders(roundScreen({ countLine: '', lastLook: 'never marked' }))
    expect(screen.getByTestId('quickfill-last-marked-door').parentElement?.textContent).toBe('never marked')
    cleanup()
    renderWithProviders(roundScreen({ personal: true, lastLook: null, countLine: '' }))
    expect(screen.queryByTestId('quickfill-last-marked-door')).toBeNull()
  })
})
