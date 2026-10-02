// @vitest-environment jsdom
/**
 * One step on the Release of Lien rail, click to look (v2.4337): a folded step is a button that
 * opens it read-only in place, with the note on how to change it and a Fold button; its number on
 * the rail does the same. A step that is not folded has no fold controls.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { LienReleaseStepRow, LienWaiverSignedLook } from './LienReleaseStepRow'
import type { ReleaseStep } from '../../lib/jobs/lienReleaseSteps'

afterEach(cleanup)

const FOLDED: ReleaseStep = { n: 3, key: 'amount', state: 'done', waitsFor: null, folded: true }

describe('LienReleaseStepRow — click to look (v2.4337)', () => {
  it('a folded step is a button named for the step; clicking it, or its number, asks to open it', () => {
    const onToggle = vi.fn()
    const onDot = vi.fn()
    render(
      <LienReleaseStepRow step={FOLDED} title="Check the amount" summary="$17,777.51 · paid so far" onToggle={onToggle} onDot={onDot}>
        <div>the amount box</div>
      </LienReleaseStepRow>,
    )
    const btn = screen.getByRole('button', { name: '3 · Check the amount' })
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByText('$17,777.51 · paid so far')).toBeTruthy()
    expect(screen.getByText('Look ›')).toBeTruthy()
    // Folded: the step's content is not drawn.
    expect(screen.queryByText('the amount box')).toBeNull()
    fireEvent.click(btn)
    expect(onToggle).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('lien-step-3').querySelector('.lienStep-dot')!)
    expect(onDot).toHaveBeenCalledTimes(1)
  })

  it('opened: the content shows with the read-only note, and Fold closes it', () => {
    const onToggle = vi.fn()
    render(
      <LienReleaseStepRow step={FOLDED} open title="Check the amount" summary="$17,777.51" onToggle={onToggle} lookNote="Read only. It is signed.">
        <div>the amount box</div>
      </LienReleaseStepRow>,
    )
    const card = screen.getByTestId('lien-step-3')
    expect(within(card).getByText('the amount box')).toBeTruthy()
    expect(within(card).getByText('Read only. It is signed.')).toBeTruthy()
    const fold = within(card).getByRole('button', { name: 'Fold' })
    expect(fold.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(fold)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('a step that is not folded draws no fold controls', () => {
    render(
      <LienReleaseStepRow step={{ ...FOLDED, folded: false }} title="Check the amount" say="The amount comes from the bills.">
        <div>the amount box</div>
      </LienReleaseStepRow>,
    )
    expect(screen.queryByRole('button', { name: 'Fold' })).toBeNull()
    expect(screen.queryByText('Look ›')).toBeNull()
    expect(screen.getByText('the amount box')).toBeTruthy()
  })
})

describe('LienWaiverSignedLook — step 5 opened after signing', () => {
  it('says who signed, his title, for whom, and the audit sentence', () => {
    render(
      <LienWaiverSignedLook
        name="Malachi Whites"
        title="Owner"
        company="Click Plumbing and Electrical"
        auditLine="Drawn by Malachi Whites in ClickTooling on Oct 1, 2026 at 4:23 PM CT, on Robert’s screen, consent recorded."
      />,
    )
    const box = screen.getByTestId('lien-waiver-signed-look')
    expect(box.textContent).toContain('Signed by Malachi Whites, Owner for Click Plumbing and Electrical')
    expect(box.textContent).toContain('on Robert’s screen, consent recorded.')
  })
  it('no title set: the line reads without one', () => {
    render(<LienWaiverSignedLook name="Malachi Whites" title="  " company="Click Plumbing and Electrical" auditLine={null} />)
    expect(screen.getByTestId('lien-waiver-signed-look').textContent).toBe('Signed by Malachi Whites for Click Plumbing and Electrical')
  })
})

