// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BoxScan from './BoxScan'
import { rememberLastBox } from '../lib/materials/boxPageMemory'

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

  it('offers the site search when this phone scanned a box today, and not otherwise', () => {
    mount()
    expect(screen.queryByTestId('box-scan-last')).toBeNull()
    cleanup()
    rememberLastBox({ code: '4F2A9C18', stencil: 'B3', kind: 'cage' })
    mount()
    expect(screen.getByTestId('box-scan-last').textContent).toContain('You scanned Cage B3 today')
    expect(screen.getByTestId('box-scan-find').getAttribute('href')).toBe('/b/4f2a9c18?find=1')
  })
})
