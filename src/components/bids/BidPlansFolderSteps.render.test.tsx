// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BidPlansFolderSteps } from './BidPlansFolderSteps'

const invoke = vi.fn()
vi.mock('../../lib/supabase', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }))

describe('BidPlansFolderSteps (v2.4162)', () => {
  it('names the division folder, gives the name to copy, and Find fills the link in', async () => {
    invoke.mockResolvedValueOnce({ data: { found: true, id: 'F1', link: 'https://drive.google.com/drive/folders/F1', pdfs: 2 }, error: null })
    const onFound = vi.fn()
    renderWithProviders(<BidPlansFolderSteps projectName=" Marcos Pizza Boerne " bidNumber="367" bidId={null} serviceTypeName="Plumbing" onFound={onFound} />)
    expect(screen.getByText('1 · Open the plumbing bid folder')).toBeTruthy()
    expect(screen.getByTestId('open-division-folder').getAttribute('href')).toBe('https://drive.google.com/drive/folders/1HRAnLDgQ-0__1o4umf59w6zpfW3rFvtB')
    expect(screen.getByTestId('plans-folder-name').textContent).toBe('Marcos Pizza Boerne')
    fireEvent.click(screen.getByTestId('find-plans-folder'))
    await waitFor(() => expect(onFound).toHaveBeenCalledWith('https://drive.google.com/drive/folders/F1', 2))
    expect(invoke).toHaveBeenCalledWith('plan-fetch', { body: { find_folder: { parent_id: '1HRAnLDgQ-0__1o4umf59w6zpfW3rFvtB', name: 'Marcos Pizza Boerne' } } })
    expect(screen.getByTestId('find-line').textContent).toBe('Found the folder · 2 PDFs. The link is filled in.')
  })

  it('not found says what to check; no service type holds Find', async () => {
    invoke.mockResolvedValueOnce({ data: { found: false }, error: null })
    const { unmount } = renderWithProviders(<BidPlansFolderSteps projectName="Marcos" bidNumber="" bidId={null} serviceTypeName="Plumbing" onFound={() => {}} />)
    fireEvent.click(screen.getByTestId('find-plans-folder'))
    await waitFor(() => expect(screen.getByTestId('find-line').textContent).toMatch(/^Not there yet\. Is the folder named exactly “Marcos”/))
    unmount()
    renderWithProviders(<BidPlansFolderSteps projectName="Marcos" bidNumber="" bidId={null} serviceTypeName="" onFound={() => {}} />)
    expect((screen.getByTestId('find-plans-folder') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Pick the service type first. It says which bid folder this is.')).toBeTruthy()
  })
})
