// @vitest-environment jsdom
/** Settings → Jobs & billing → Photos (punch list #189, PR 5b): the three sizes, the office's pick read and saved. */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

let stored = 'medium'
vi.mock('../../lib/photos/reportPhotosIo', () => ({
  loadReportPhotoSize: () => Promise.resolve(stored),
  setReportPhotoSize: (s: string) => {
    stored = s
    return Promise.resolve()
  },
}))

import ReportPhotoSizeSettingsBlock from './ReportPhotoSizeSettingsBlock'
import { renderWithProviders } from '../../test/renderSmokeMocks'

describe('ReportPhotoSizeSettingsBlock', () => {
  it('reads Medium as the pick, names the three edges, and saves a pick on the tap', async () => {
    stored = 'medium'
    renderWithProviders(<ReportPhotoSizeSettingsBlock canSet />)
    const medium = (await screen.findByRole('radio', { name: /Medium/ })) as HTMLInputElement
    await waitFor(() => expect(medium.checked).toBe(true))
    expect(screen.getByText('1200 px · about 150 KB')).toBeTruthy()
    expect(screen.getByText('1600 px · about 300 KB')).toBeTruthy()
    expect(screen.getByText('2400 px · about 700 KB')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: /Large/ }))
    await waitFor(() => expect(stored).toBe('large'))
    expect((screen.getByRole('radio', { name: /Large/ }) as HTMLInputElement).checked).toBe(true)
  })

  it('a role that cannot set it reads the pick with the radios dead', async () => {
    stored = 'small'
    renderWithProviders(<ReportPhotoSizeSettingsBlock canSet={false} />)
    const small = (await screen.findByRole('radio', { name: /Small/ })) as HTMLInputElement
    await waitFor(() => expect(small.checked).toBe(true))
    expect(small.disabled).toBe(true)
    expect(screen.getByText(/A master or a dev picks the size/)).toBeTruthy()
  })
})
