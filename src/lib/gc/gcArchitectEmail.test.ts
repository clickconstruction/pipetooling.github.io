/**
 * The architect's emails while we build (the Building lane's U4b): a submittal's newest round as `gc-architect-email`
 * sends it and Settings → What customers see shows it (`buildGcSubmittalEmail`).
 */
import { describe, expect, it } from 'vitest'
import { buildGcSubmittalEmail, type GcSubmittalEmailInput } from '../../../supabase/functions/_shared/gcArchitectEmail'

const base: GcSubmittalEmailInput = {
  architectName: 'Avery Lin',
  projectName: 'Fair Oaks Clinic',
  projectAddress: '1 Sample Rd, Boerne',
  number: '26 24 16-01',
  title: 'Panelboards',
  kind: 'product data',
  from: 'Electrical, Pedernales Valley Electric',
  round: 1,
  file: 'PVE-panelboards.pdf',
  driveUrl: 'https://drive.google.com/file/d/abc/view',
  note: '',
  neededBy: 'Mon, Oct 20',
  signer: 'Jordan Reyes',
  companyName: 'Click Construction',
}

describe('buildGcSubmittalEmail', () => {
  it('names the submittal, the file and its link, the day we need it, and how to answer', () => {
    const e = buildGcSubmittalEmail(base)
    expect(e.subject).toBe('Fair Oaks Clinic: submittal 26 24 16-01, Panelboards')
    expect(e.text).toBe(
      [
        'Hello Avery Lin,',
        '',
        'Here is submittal 26 24 16-01 for Fair Oaks Clinic, 1 Sample Rd, Boerne: Panelboards, product data, from Electrical, Pedernales Valley Electric.',
        '',
        'The file is PVE-panelboards.pdf. Open it here:',
        'https://drive.google.com/file/d/abc/view',
        '',
        'We need your answer by Mon, Oct 20 to keep the work on time.',
        'Reply to this email with your answer: approved, approved as noted, or revise with what to change.',
        '',
        'Thank you,',
        'Jordan Reyes',
        'Click Construction',
      ].join('\n'),
    )
    expect(e.html).toContain('<a href="https://drive.google.com/file/d/abc/view" style="color:#1d4ed8">https://drive.google.com/file/d/abc/view</a>')
  })

  it('says a second round is sent again, carries the trade’s note, and asks plainly with no day', () => {
    const e = buildGcSubmittalEmail({ ...base, round: 2, file: 'PVE-panelboards-r1.pdf', note: 'Ratings added. ', neededBy: null, projectAddress: null })
    expect(e.subject).toBe('Fair Oaks Clinic: submittal 26 24 16-01, Panelboards, round 2')
    expect(e.text).toContain('Here is submittal 26 24 16-01 for Fair Oaks Clinic: Panelboards, product data, from Electrical, Pedernales Valley Electric.\nThis is round 2, sent again after your notes.')
    expect(e.text).toContain('Their note: Ratings added.')
    expect(e.text).toContain('Please send your answer when you can.')
  })

  it('escapes what was typed in the HTML', () => {
    const e = buildGcSubmittalEmail({ ...base, title: 'Doors <and> frames & hardware', driveUrl: 'https://drive.google.com/file/d/x"y/view' })
    expect(e.html).toContain('Doors &lt;and&gt; frames &amp; hardware')
    expect(e.html).toContain('href="https://drive.google.com/file/d/x&quot;y/view"')
  })
})
