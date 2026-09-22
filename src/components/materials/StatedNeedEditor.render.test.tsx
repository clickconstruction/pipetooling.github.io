// @vitest-environment jsdom
/**
 * Render-smoke tests for StatedNeedEditor's open/close derivation (v2.3731):
 * the reset effect only fires when the row underneath changes, never on mount,
 * so a click right after a data-load commit cannot be overwritten by it.
 */
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'

const smoke = vi.hoisted(() => ({ setCalls: [] as Array<[string, string | null | undefined]> }))

vi.mock('../../lib/materials/setPoCodeStatedNeed', () => ({
  setPoCodeStatedNeed: async (id: string, text: string | null | undefined) => {
    smoke.setCalls.push([id, text])
    const t = (text ?? '').trim()
    return t ? t : null
  },
}))

import { StatedNeedEditor } from './StatedNeedEditor'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import {
  STATED_NEED_ADD_LINK,
  STATED_NEED_ASK_AFTER,
  STATED_NEED_COLUMN,
  STATED_NEED_SAVE_LABEL,
} from '../../lib/materials/poCodeStatedNeed'

describe('StatedNeedEditor — reset only when the row changes (v2.3731)', () => {
  it('link mode: the add link opens the box, and a same-props re-render leaves it open', async () => {
    const { rerender } = renderWithProviders(
      <StatedNeedEditor entryId="e-1" current={null} mode="link" onSaved={() => {}} />,
    )
    expect(screen.queryByLabelText(STATED_NEED_COLUMN)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: STATED_NEED_ADD_LINK }))
    expect(screen.getByLabelText(STATED_NEED_COLUMN)).toBeTruthy()
    // The parent re-rendering with identical props (a ledger refetch that changed nothing)
    // must not close the box: the effect sees the same key and returns.
    await act(async () => {
      rerender(<StatedNeedEditor entryId="e-1" current={null} mode="link" onSaved={() => {}} />)
    })
    expect(screen.getByLabelText(STATED_NEED_COLUMN)).toBeTruthy()
  })

  it('link mode: a different row underneath resets the box closed', async () => {
    const { rerender } = renderWithProviders(
      <StatedNeedEditor entryId="e-1" current={null} mode="link" onSaved={() => {}} />,
    )
    fireEvent.click(screen.getByRole('button', { name: STATED_NEED_ADD_LINK }))
    expect(screen.getByLabelText(STATED_NEED_COLUMN)).toBeTruthy()
    await act(async () => {
      rerender(<StatedNeedEditor entryId="e-2" current={null} mode="link" onSaved={() => {}} />)
    })
    expect(screen.queryByLabelText(STATED_NEED_COLUMN)).toBeNull()
    expect(screen.getByRole('button', { name: STATED_NEED_ADD_LINK })).toBeTruthy()
  })

  it('ask mode: starts open with nothing written, and Write it down hands the claim up and closes', async () => {
    smoke.setCalls = []
    const saved: Array<string | null> = []
    renderWithProviders(
      <StatedNeedEditor entryId="e-new" current={null} mode="ask" onSaved={(n) => saved.push(n)} />,
    )
    const box = screen.getByLabelText(STATED_NEED_ASK_AFTER)
    fireEvent.change(box, { target: { value: ' two tubes ' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: STATED_NEED_SAVE_LABEL }))
    })
    expect(smoke.setCalls.map(([id]) => id)).toEqual(['e-new'])
    expect(saved).toEqual(['two tubes'])
  })
})
