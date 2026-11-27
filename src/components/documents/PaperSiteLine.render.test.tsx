// @vitest-environment jsdom
/**
 * The site's line in the email window: its presses stand a fingertip tall on a phone (finding 294) and keep their own
 * height at a desk. Every address here is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { PaperSiteLine } from './PaperSiteLine'

const narrow = vi.hoisted(() => ({ on: false }))
vi.mock('../../hooks/useNarrowViewport640', () => ({ useNarrowViewport640: () => narrow.on }))

afterEach(() => cleanup())

const noop = () => undefined
const SITE = { kind: 'address' as const, key: '12 sample street', address: '12 Sample St' }
const heights = (names: string[]) => names.map((name) => (screen.getByRole('button', { name }) as HTMLButtonElement).style.minHeight)

describe('PaperSiteLine', () => {
  it('on a phone Name a site…, Change the site… and Take the site off each stand 44 px tall', () => {
    narrow.on = true
    const first = render(<PaperSiteLine site={null} box={null} onPick={noop} onTakeOff={noop} onPrint={noop} />)
    expect(heights(['Name a site…'])).toEqual(['44px'])
    first.unmount()
    render(<PaperSiteLine site={SITE} box={null} onPick={noop} onTakeOff={noop} onPrint={noop} />)
    expect(heights(['Change the site…', 'Take the site off'])).toEqual(['44px', '44px'])
  })

  it('at a desk they keep the height they had', () => {
    narrow.on = false
    render(<PaperSiteLine site={SITE} box={null} onPick={noop} onTakeOff={noop} onPrint={noop} />)
    expect(heights(['Change the site…', 'Take the site off'])).toEqual(['32px', '32px'])
  })

  it('a paper whose row is written has no press on the line, at either width', () => {
    narrow.on = true
    render(<PaperSiteLine site={SITE} box={null} kept onPick={noop} onTakeOff={noop} onPrint={noop} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
