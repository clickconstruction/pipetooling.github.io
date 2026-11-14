// @vitest-environment jsdom
import { act, render } from '@testing-library/react'
import { useRef, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { elementsAbove, useTopEdge } from './useTopEdge'

/** jsdom lays nothing out, so the page's top edge is the sum of the heights the test gives the boxes above it. */
function fakeLayout() {
  return vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const top = elementsAbove(this).reduce((sum, el) => sum + Number((el as HTMLElement).dataset.h ?? 0), 0)
    return { top, bottom: top, left: 0, right: 0, width: 0, height: 0, x: 0, y: top, toJSON: () => ({}) } as DOMRect
  })
}

function Shell({ banner }: { banner: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const top = useTopEdge(ref)
  return (
    <div>
      {banner ? <div data-banner data-h="53" /> : null}
      <header data-h="67" />
      <main>
        <div ref={ref} data-page data-top={top} />
      </main>
    </div>
  )
}

function Toggle() {
  const [banner, setBanner] = useState(true)
  return (
    <>
      <Shell banner={banner} />
      <button type="button" onClick={() => setBanner(false)}>Dismiss</button>
    </>
  )
}

const flush = () => act(async () => { await Promise.resolve() })

describe('useTopEdge', () => {
  afterEach(() => vi.restoreAllMocks())

  it('elementsAbove: the earlier siblings of the element and of every box it sits in', () => {
    const { container } = render(<Shell banner />)
    const page = container.querySelector('[data-page]')!
    const above = elementsAbove(page)
    expect(above).toContain(container.querySelector('[data-banner]'))
    expect(above).toContain(container.querySelector('header'))
    expect(above).not.toContain(container.querySelector('main'))
  })

  it('reads the top edge when drawn', () => {
    fakeLayout()
    const { container } = render(<Shell banner />)
    expect(container.querySelector('[data-page]')!.getAttribute('data-top')).toBe('120')
  })

  it('reads it again when a banner above closes, so the page takes the room back', async () => {
    fakeLayout()
    const { container, getByText } = render(<Toggle />)
    const page = () => container.querySelector('[data-page]')!.getAttribute('data-top')
    expect(page()).toBe('120')
    await act(async () => { getByText('Dismiss').click() })
    await flush()
    expect(page()).toBe('67')
  })

  it('reads it again on a window resize', async () => {
    fakeLayout()
    const { container } = render(<Shell banner />)
    const header = container.querySelector('header') as HTMLElement
    header.dataset.h = '113'
    await act(async () => { window.dispatchEvent(new Event('resize')) })
    expect(container.querySelector('[data-page]')!.getAttribute('data-top')).toBe('166')
  })
})
