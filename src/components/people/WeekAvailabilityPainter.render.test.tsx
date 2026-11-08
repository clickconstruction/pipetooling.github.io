// @vitest-environment jsdom
/**
 * Render smoke for the week painter: the words under the grid follow the drawing, a day's name
 * toggles the day, a preset fills the week, and the time boxes set one day exactly.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_WEEK, type WeekDays } from '../../lib/people/weekAvailability'
import { WeekAvailabilityPainter } from './WeekAvailabilityPainter'

function Host({ start = DEFAULT_WEEK }: { start?: WeekDays }) {
  const [days, setDays] = useState<WeekDays>(start)
  return <WeekAvailabilityPainter value={days} onChange={setDays} />
}

afterEach(cleanup)

describe('WeekAvailabilityPainter', () => {
  it('draws the week in words, toggles a day by its name, and takes a preset', () => {
    render(<Host />)
    expect(screen.getByRole('img', { name: /Hours you can work, Mon–Fri 7a–3p\. Off Sat and Sun\./ })).toBeTruthy()
    expect(screen.getByText('40 h a week')).toBeTruthy()
    fireEvent.click(screen.getByTitle('Turn Fri off'))
    expect(screen.getByRole('img', { name: /Mon–Thu 7a–3p\. Off Fri, Sat and Sun\./ })).toBeTruthy()
    expect(screen.getByText('32 h a week')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Mon–Fri 7a–3:30p' }))
    expect(screen.getByText('42.5 h a week')).toBeTruthy()
  })

  it('sets one day from the time boxes', () => {
    render(<Host />)
    fireEvent.click(screen.getByRole('button', { name: 'Fri 7a–3p' }))
    fireEvent.change(screen.getByLabelText('Fri end'), { target: { value: '15:00' } })
    fireEvent.change(screen.getByLabelText('Fri start'), { target: { value: '06:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Set Fri' }))
    expect(screen.getByRole('img', { name: /Mon–Thu 7a–3p, Fri 6a–3p\./ })).toBeTruthy()
  })
})
