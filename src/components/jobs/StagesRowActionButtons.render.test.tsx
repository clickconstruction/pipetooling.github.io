// @vitest-environment jsdom
/**
 * Render smokes for the Pipeline row's action icons (Stages tab decomposition PR 9): each
 * button's accessible name, click, and the boxed state the callers flag.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import {
  StagesAiaG702Button,
  StagesHazmatFeeButton,
  StagesLienInstrumentsButton,
  StagesLienReleaseButton,
  StagesTestReportButton,
} from './StagesRowActionButtons'

describe('StagesRowActionButtons', () => {
  it('every icon carries its accessible name and fires its click', () => {
    const fns = [vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn()] as const
    render(
      <>
        <StagesTestReportButton onClick={fns[0]} />
        <StagesLienInstrumentsButton onClick={fns[1]} demandOut={false} />
        <StagesLienReleaseButton onClick={fns[2]} hasRelease={false} />
        <StagesAiaG702Button onClick={fns[3]} />
        <StagesHazmatFeeButton onClick={fns[4]} hasFee={false} />
      </>,
    )
    const names = ['Open Test report', 'Lien instruments', 'Release of lien', 'Open AIA G702-G703 workbook generator', 'Create a hazmat fee for this job']
    names.forEach((name, i) => {
      fireEvent.click(screen.getByLabelText(name))
      expect(fns[i]).toHaveBeenCalledTimes(1)
    })
  })

  it('the boxed states change the title and draw the border', () => {
    render(
      <>
        <StagesLienInstrumentsButton onClick={vi.fn()} demandOut />
        <StagesLienReleaseButton onClick={vi.fn()} hasRelease />
        <StagesHazmatFeeButton onClick={vi.fn()} hasFee />
      </>,
    )
    expect(screen.getByLabelText('Lien instruments').getAttribute('title')).toMatch(/a demand letter is out/)
    expect(screen.getByLabelText('Lien instruments').style.border).toBe('2px solid rgb(180, 83, 9)')
    expect(screen.getByLabelText('Release of lien').getAttribute('title')).toMatch(/issued lien release/)
    expect(screen.getByLabelText('Release of lien').style.border).toBe('2px solid rgb(37, 99, 235)')
    expect(screen.getByLabelText('Create a hazmat fee for this job').getAttribute('title')).toMatch(/click to add another/)
    expect(screen.getByLabelText('Create a hazmat fee for this job').style.border).toBe('2px solid rgb(34, 197, 94)')
  })
})
