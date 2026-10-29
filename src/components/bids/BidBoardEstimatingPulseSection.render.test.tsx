// @vitest-environment jsdom
/**
 * Render smoke for the Health section's field band (v2.5980): each name tag sits in a box
 * anchored on the nearer band edge, so a tag at either end stays inside the band, and its
 * stem is a separate piece on the true won %. jsdom can't lay out, so this pins the wiring
 * from `pulseBandTagBox`; the kernel tests and the live checks carry the geometry. The
 * band's width is mocked, so the third row a crowded phone band opens (punch list #203)
 * can be drawn here: its 58 px stem, the room the band keeps under it, and the caption
 * below the last row.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, within } from '@testing-library/react'
import { BidBoardEstimatingPulseSection } from './BidBoardEstimatingPulseSection'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { renderWithProviders } from '../../test/renderSmokeMocks'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

/** The band's measured width for the next render: null reads as "not measured yet", as jsdom would give. */
const measured = vi.hoisted(() => ({ px: null as number | null }))
vi.mock('../../hooks/useMeasuredWidth', () => ({
  useMeasuredWidth: () => [{ current: null }, measured.px],
}))

beforeEach(() => {
  measured.px = null
})
afterEach(() => cleanup())

function bid(id: string, estId: string, estName: string, outcome: string): BidWithBuilder {
  return {
    id,
    bid_date_sent: '2026-08-17T18:00:00Z',
    bid_value: 100000,
    outcome,
    estimator_id: estId,
    estimator: { name: estName, email: `${estId}@x.com` },
    account_manager_id: null,
    account_manager: null,
  } as unknown as BidWithBuilder
}

describe('BidBoardEstimatingPulseSection field band', () => {
  it('anchors an end tag on its edge and keeps each stem on the true won %', async () => {
    renderWithProviders(
      <BidBoardEstimatingPulseSection
        filteredBids={[
          bid('a', 'u1', 'Cy', 'lost'),
          bid('b', 'u1', 'Cy', 'lost'),
          bid('c', 'u2', 'Blake', 'won'),
          bid('d', 'u2', 'Blake', 'won'),
          bid('e', 'u3', 'Eve', 'won'),
          bid('f', 'u3', 'Eve', 'lost'),
          bid('g', 'u3', 'Eve', 'lost'),
          bid('h', 'u3', 'Eve', 'lost'),
        ]}
      />,
    )
    const band = within((await screen.findByText('Where everyone stands')).parentElement!)
    // Cy 0%, Eve 25%, ALL 37.5%, Blake 100%.
    const box = (label: string) => band.getByText(label).closest('[title]')!.parentElement as HTMLElement
    expect(box('Cy').style).toMatchObject({ left: '0px', right: '', minWidth: '0%' })
    expect(box('Eve').style).toMatchObject({ left: '0px', right: '', minWidth: '50%' })
    expect(box('ALL').style).toMatchObject({ left: '0px', right: '', minWidth: '75%' })
    expect(box('Blake').style).toMatchObject({ left: '', right: '0px', minWidth: '0%' })
    for (const label of ['Cy', 'Eve', 'Blake']) {
      const pill = band.getByText(label).closest('[title]') as HTMLElement
      const stem = [...document.querySelectorAll<HTMLElement>('[aria-hidden="true"][title]')].find(
        (el) => el.title === pill.title,
      )
      expect(stem, `${label} has its stem`).toBeTruthy()
      expect(stem!.parentElement).toBe(box(label).parentElement)
    }
    // Two rows: the band keeps its 4.6rem under it, and the caption reads below the last row.
    const wrap = box('Cy').parentElement as HTMLElement
    expect(wrap.style.marginBottom).toBe('4.6rem')
    const caption = band.getByText(/0% – 100% Won rate/)
    expect(wrap.compareDocumentPosition(caption) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(caption.style.margin).toBe('0px')
  })

  it('on a phone-wide band, hangs the third tag on one mark from a 58 px stem and keeps room for it', async () => {
    measured.px = 343
    renderWithProviders(
      <BidBoardEstimatingPulseSection
        filteredBids={[
          bid('a', 'u1', 'Ann', 'won'),
          bid('b', 'u1', 'Ann', 'lost'),
          bid('c', 'u2', 'Bea', 'won'),
          bid('d', 'u2', 'Bea', 'lost'),
        ]}
      />,
    )
    const band = within((await screen.findByText('Where everyone stands')).parentElement!)
    // Ann 50%, Bea 50%, ALL 50%: three tags on one mark, so ALL takes the third row.
    const stemOf = (label: string) => {
      const pill = band.getByText(label).closest('[title]') as HTMLElement
      return [...document.querySelectorAll<HTMLElement>('[aria-hidden="true"][title]')].find((el) => el.title === pill.title)!
    }
    expect(stemOf('Ann').style.height).toBe('10px')
    expect(stemOf('Bea').style.height).toBe('34px')
    expect(stemOf('ALL').style.height).toBe('58px')
    const wrap = stemOf('ALL').parentElement as HTMLElement
    expect(wrap.style.marginBottom).toMatch(/^calc\(.*24px.*\)$/)
    expect(wrap.style.marginBottom).toContain('4.6rem')
    const caption = band.getByText(/0% – 100% Won rate/)
    expect(wrap.compareDocumentPosition(caption) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
