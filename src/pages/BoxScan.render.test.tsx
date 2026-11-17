// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BoxScan from './BoxScan'

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: null, loading: false }) }))

function mount() {
  return render(
    <MemoryRouter initialEntries={['/b']}>
      <Routes>
        <Route path="/b" element={<BoxScan />} />
        <Route path="/b/:code" element={<div data-testid="box-page">box page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('BoxScan (the bare /b page, v2.6799)', () => {
  it('names the tab while it is open and gives the tab back when it closes (v2.7630)', () => {
    document.title = 'ClickTooling'
    const view = mount()
    // The tab read the app's name, where a box's own page reads the box and the company.
    expect(document.title).toBe('Scan a label · Click Plumbing & Electrical')
    view.unmount()
    // Nothing else sets the title, so a name left behind stayed on the tab through the sign-in and after it.
    expect(document.title).toBe('ClickTooling')
  })

  it('puts the dash in as the code is typed and opens the box', async () => {
    mount()
    const input = screen.getByTestId('box-scan-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '4f2a9c' } })
    expect(input.value).toBe('4F2A-9C')
    fireEvent.click(screen.getByTestId('box-scan-open'))
    expect(screen.getByTestId('box-scan-slip').textContent).toContain('all eight characters')
    fireEvent.change(input, { target: { value: '4f2a-9c18' } })
    fireEvent.click(screen.getByTestId('box-scan-open'))
    expect(await screen.findByTestId('box-page')).toBeTruthy()
  })

  it('offers no search of a site, even on a phone that scanned a box before v2.7379: what is in a box needs a sign-in', () => {
    localStorage.setItem('pt.boxPage.last', JSON.stringify({ code: '4F2A9C18', stencil: 'B3', kind: 'cage', at: Date.now() - 60_000 }))
    mount()
    expect(screen.queryByTestId('box-scan-last')).toBeNull()
    expect(screen.queryByTestId('box-scan-find')).toBeNull()
    expect(screen.getByTestId('box-scan-open')).toBeTruthy()
  })
})
