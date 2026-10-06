// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'

vi.mock('../../lib/ownerAutoConfirmSetting', () => ({
  fetchOwnerAutoConfirmFromRoll: async () => true,
  setOwnerAutoConfirmFromRoll: async () => {},
}))

import OwnerAutoConfirmSettingsBlock from './OwnerAutoConfirmSettingsBlock'

describe('OwnerAutoConfirmSettingsBlock', () => {
  it('says the nightly lookup covers every GC job with no owner, hours or not (#87 F, v2.3747)', async () => {
    renderWithProviders(<OwnerAutoConfirmSettingsBlock />)
    const box = screen.getByLabelText('Save owners from the appraisal roll automatically') as HTMLInputElement
    await waitFor(() => expect(box.checked).toBe(true))
    const block = screen.getByTestId('owner-auto-confirm-block')
    expect(block.textContent).toContain('Every night, GC jobs with no owner get the roll’s answer saved as')
    expect(block.textContent).not.toContain('approved hours')
  })
})
