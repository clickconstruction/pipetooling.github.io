// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TypedHoldNote, TypedHoursStamp } from './TypedHoursStamp'
import type { TypedEntry, TypedStamp } from '../../lib/clock/typedHours'

function entry(over: Partial<TypedEntry> = {}): TypedEntry {
  return {
    id: 'e1',
    kind: 'added',
    typedBy: 'taunya',
    typedByName: 'Taunya',
    typedAt: new Date().toISOString(),
    seconds: 39600,
    daySecondsBefore: 0,
    daySecondsAfter: 39600,
    self: false,
    confirmedByName: null,
    confirmedAt: null,
    ...over,
  }
}
const stamp = (entries: TypedEntry[], hold: TypedStamp['hold'] = null): TypedStamp => ({ hold, entries })

describe('TypedHoursStamp', () => {
  it('draws nothing on a punch', () => {
    const { container } = render(<TypedHoursStamp stamp={undefined} size="full" />)
    expect(container.textContent).toBe('')
    render(<TypedHoursStamp stamp={stamp([])} size="dot" />)
    expect(screen.queryByTestId('typed-hours-stamp')).toBeNull()
  })

  it('full: who typed it, and the day before and after', () => {
    render(<TypedHoursStamp stamp={stamp([entry()])} size="full" workDate="2026-09-25" />)
    const el = screen.getByTestId('typed-hours-stamp')
    expect(el.textContent).toContain('typed by Taunya')
    expect(el.textContent).toContain('Nothing recorded → 11.0h')
  })

  it('full: says who gave the second look', () => {
    render(<TypedHoursStamp stamp={stamp([entry({ confirmedAt: new Date().toISOString(), confirmedByName: 'Cora' })])} size="full" />)
    expect(screen.getByTestId('typed-hours-stamp').textContent).toContain('looked at by Cora')
  })

  it('compact: the name, with the whole sentence in the title', () => {
    render(<TypedHoursStamp stamp={stamp([entry({ daySecondsBefore: 23400, daySecondsAfter: 32400 })])} size="compact" />)
    const el = screen.getByTestId('typed-hours-stamp')
    expect(el.textContent).toContain('Taunya')
    expect(el.getAttribute('title')).toContain('typed by Taunya')
    expect(el.getAttribute('title')).toContain('6.5h → 9.0h')
  })

  it('dot: a pencil that says the sentence to a screen reader', () => {
    render(<TypedHoursStamp stamp={stamp([entry()])} size="dot" />)
    const el = screen.getByTestId('typed-hours-stamp')
    expect(el.textContent).toBe('✎')
    expect(el.getAttribute('aria-label')).toContain('typed by Taunya')
  })

  it('a trim shows on the full row only, and quietly', () => {
    const trimmed = stamp([entry({ kind: 'trimmed', seconds: 14400, daySecondsBefore: 43200, daySecondsAfter: 28800 })])
    const { unmount } = render(<TypedHoursStamp stamp={trimmed} size="full" />)
    expect(screen.getByTestId('typed-hours-trim').textContent).toContain('trimmed by Taunya')
    expect(screen.getByTestId('typed-hours-trim').textContent).toContain('12.0h → 8.0h')
    unmount()
    render(<TypedHoursStamp stamp={trimmed} size="compact" />)
    expect(screen.queryByTestId('typed-hours-trim')).toBeNull()
    expect(screen.queryByTestId('typed-hours-stamp')).toBeNull()
  })

  it('the hold note says why there is no Approve', () => {
    render(<TypedHoldNote hold="typed" />)
    expect(screen.getByTestId('typed-hours-hold').textContent).toBe('You typed these — waiting on a second person')
  })
})
