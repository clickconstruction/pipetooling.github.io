// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { SheetRail } from './SheetRail'
import { buildSheetRail } from '../../lib/subWorkOrders/sheetRail'

describe('SheetRail', () => {
  it('draws seven dots, names the state for a screen reader, and shows the label', () => {
    const rail = buildSheetRail({ coverage: { kind: 'none' }, sheetStage: 'working', agreed: 40000, open: 40000, unpriced: false })
    const { container, getByRole, getByText } = render(<SheetRail rail={rail} />)
    expect(getByRole('img').getAttribute('aria-label')).toBe('Work · no agreement')
    expect(container.querySelectorAll('span[aria-hidden="true"]').length).toBe(7 + 6)
    expect(getByText('Work · no agreement')).toBeTruthy()
  })
  it('the current dot becomes a button when a click handler is given', () => {
    const rail = buildSheetRail({ coverage: { kind: 'signed', id: 'o', subName: 'Miguel', amount: 1, signedOn: null, laborJobId: null, recordId: null }, sheetStage: 'walkthrough', agreed: 1, open: 1, unpriced: false })
    let clicks = 0
    const { getByRole } = render(<SheetRail rail={rail} onCurrentClick={() => { clicks += 1 }} showLabel={false} />)
    getByRole('button', { name: 'Inspection — change stage' }).click()
    expect(clicks).toBe(1)
  })
})
