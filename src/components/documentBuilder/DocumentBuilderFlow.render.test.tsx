// @vitest-environment jsdom
/**
 * Render smoke for the document builder's flow (punch list #404, the flow of #389): the disclaimer's box opens the
 * later steps, a topic's page leads with the breach lines and changes as its slider moves, the slider marks the basis, the review lists what the site must have, the paper switched
 * Off skips to the review, and the review's press says what it did. The rules are held by `documentBuilder.test.ts`;
 * this holds the wiring.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DocumentBuilderFlow } from './DocumentBuilderFlow'
import { SECRECY_PAPER_FIXTURE as DEF } from '../../lib/documentBuilder/secrecyPaper.fixture'

afterEach(cleanup)

const heading = () => screen.getByRole('heading', { level: 2 }).textContent
const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
// The track runs 100 units between two stops, so the handle can glide.
const slide = (to: number) => fireEvent.change(screen.getByRole('slider'), { target: { value: String(to * 100) } })
const carried = () => Array.from(document.querySelectorAll('li[data-quiet]')).map((li) => li.textContent)

function open() {
  render(<DocumentBuilderFlow def={DEF} />)
  fireEvent.click(screen.getByRole('checkbox', { name: 'I have read this.' }))
}

describe('DocumentBuilderFlow', () => {
  it('opens on the disclaimer and holds every later step shut until the box is ticked', () => {
    render(<DocumentBuilderFlow def={DEF} />)
    expect(heading()).toBe('Before you start')
    expect(screen.getByText('Step 1 of 11')).toBeTruthy()
    expect(screen.getByText('Placeholder words, for an attorney to confirm.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Next: The basis' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Step 4: Photos and video' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: 'I have read this.' }))
    expect((screen.getByRole('button', { name: 'Step 4: Photos and video' }) as HTMLButtonElement).disabled).toBe(false)
    press('Next: The basis')
    expect(heading()).toBe('The basis')
  })

  it('changes a topic page as its slider moves, and puts what is new above what also applies', () => {
    open()
    press('Step 4: Photos and video')
    expect(heading()).toBe('Photos and videoStandard')
    expect(screen.queryByText('Also applies')).toBeNull()
    expect(screen.queryByText(/^New at/)).toBeNull()
    slide(2)
    expect(heading()).toBe('Photos and videoElevated')
    expect(screen.getAllByText('New at Elevated')).toHaveLength(1)
    expect(screen.getByText('Wording B')).toBeTruthy()
    expect(screen.getByText('Also applies')).toBeTruthy()
    expect(carried()).toHaveLength(3)
    expect(carried()).not.toContain('Taking a photo that shows people, screens or signs.')
    slide(4)
    expect(screen.getByText('What the site must have')).toBeTruthy()
  })

  it('leads a topic page with the breach lines, then the site, then the clause as one strip', () => {
    open()
    press('Step 6: Getting on site')
    slide(4)
    const order = ['What puts a person in breach', 'What the site must have', 'The core clause'].map((t) => screen.getByText(t))
    expect(order[0]?.compareDocumentPosition(order[1] as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(order[1]?.compareDocumentPosition(order[2] as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(screen.getAllByText(/^Placeholder words/)).toHaveLength(1)
  })

  it('marks the basis on a topic slider, and a press on that stop is the way back', () => {
    open()
    press('Step 4: Photos and video')
    expect(screen.getByRole('button', { name: 'Standard, the basis' }).getAttribute('aria-current')).toBe('true')
    slide(4)
    expect(heading()).toBe('Photos and videoStrict')
    expect(screen.getByRole('button', { name: 'Standard, the basis' }).getAttribute('aria-current')).toBeNull()
    press('Standard, the basis')
    expect(heading()).toBe('Photos and videoStandard')
    expect(screen.queryByText('What the site must have')).toBeNull()
    press('Step 2: The basis')
    expect(screen.queryByRole('button', { name: /the basis$/ })).toBeNull()
  })

  it('moves one stop for an arrow key, and never past the ends', () => {
    open()
    press('Step 4: Photos and video')
    const handle = screen.getByRole('slider')
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(heading()).toBe('Photos and videoElevated')
    fireEvent.keyDown(handle, { key: 'End' })
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(heading()).toBe('Photos and videoStrict')
    fireEvent.keyDown(handle, { key: 'Home' })
    expect(heading()).toBe('Photos and videoOff')
  })

  it('leaves a clause out when a topic is slid to Off, and never lets a topic in every paper go Off', () => {
    open()
    press('Step 4: Photos and video')
    slide(0)
    expect(screen.getByText('Section 5: Photos and video is left out of the paper.')).toBeTruthy()
    press('Step 8: How long secrecy lasts')
    expect(heading()).toBe('How long secrecy lastsStandardIn every paper')
    slide(0)
    expect(heading()).toBe('How long secrecy lastsStandardIn every paper')
    expect((screen.getByRole('button', { name: 'Off' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('reviews the paper as it stands: its level, what the site must have, and a row that opens each topic', () => {
    open()
    press('Step 6: Getting on site')
    slide(4)
    press('Step 11: Review')
    expect(screen.getByText('Standard, 1 page off it')).toBeTruthy()
    expect(screen.getByText('Your basis is Standard. 1 page is off it.')).toBeTruthy()
    const site = screen.getByText('What this site must have').parentElement as HTMLElement
    expect(site.textContent).toContain('Escorts free to walk with each person in a marked area.')
    expect(site.textContent).toContain('Marked areas, with signs.')
    expect(screen.getByText('Nothing reaches a signer until this press.')).toBeTruthy()
    press('Confirm and require this paper')
    expect(screen.getByText('Required. 14 people asked to sign. You are first.')).toBeTruthy()
    press('Change Getting on site')
    expect(heading()).toBe('Getting on siteStrict')
  })

  it('shows what the picked level does above the basis slider, and changes it as the basis moves', () => {
    open()
    press('Next: The basis')
    const facts = () => document.querySelector('[data-level-facts]')?.textContent ?? null
    expect(facts()).toBe('Secrecy lasts3 yearsTime to return files10 daysTime to report a leak3 daysThe site must have3 things')
    slide(3)
    expect(document.querySelector('button[aria-pressed="true"]')?.textContent).toContain('Aggressive')
    expect(facts()).toBe('Secrecy lasts7 yearsTime to return files5 daysTime to report a leak24 hoursThe site must have6 things')
    slide(0)
    expect(document.querySelector('button[aria-pressed="true"]')).toBeNull()
    expect(facts()).toBeNull()
  })

  it('skips from the basis to the review when the paper is switched Off', () => {
    open()
    press('Next: The basis')
    slide(0)
    expect(screen.getByText('Off. This job requires no secrecy paper.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Step 5: Phones and devices' }) as HTMLButtonElement).disabled).toBe(true)
    press('Next: Review')
    expect(heading()).toBe('Review')
    expect((screen.getByRole('button', { name: 'Nothing to require' }) as HTMLButtonElement).disabled).toBe(true)
    press('Back')
    expect(heading()).toBe('The basis')
    press(/Elevated.*Aligned with hospitals/)
    expect(screen.getByText('Every page is on Elevated.')).toBeTruthy()
  })

  it('has no press on the last step for someone who only looks, and says so under Back', () => {
    render(<DocumentBuilderFlow def={DEF} look={{ lastStep: 'A made-up last line.' }} />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'I have read this.' }))
    press('Step 11: Review')
    expect(screen.queryByRole('button', { name: DEF.words.confirmPress })).toBeNull()
    expect(screen.queryByText(DEF.words.beforeConfirm)).toBeNull()
    expect(screen.getByText('A made-up last line.')).toBeTruthy()
    press('Back')
    expect(screen.getByText('Step 10 of 11')).toBeTruthy()
  })
})
