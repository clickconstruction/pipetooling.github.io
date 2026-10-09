/**
 * The architect's emails while we build (the Building lane's U4b and U5b): a submittal's newest round and an RFI, as
 * `gc-architect-email` sends them and Settings → What customers see shows them (`buildGcSubmittalEmail`,
 * `buildGcRfiEmail`).
 */
import { describe, expect, it } from 'vitest'
import { buildGcRfiEmail, buildGcSubmittalEmail, type GcRfiEmailInput, type GcSubmittalEmailInput } from '../../../supabase/functions/_shared/gcArchitectEmail'

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

const rfi: GcRfiEmailInput = {
  architectName: 'Avery Lin',
  projectName: 'Fair Oaks Clinic',
  projectAddress: '1 Sample Rd, Boerne',
  label: 'RFI-004',
  question: ' The roof curb on A-501 is 48 by 60 inches. The approved rooftop unit needs 54 by 72. Which size do we set? ',
  sheets: ['A-501', 'M-101'],
  from: 'Summit Roofing, Roofing',
  holds: ['Roof curbs'],
  neededBy: 'Fri, Oct 9',
  signer: 'Jordan Reyes',
  companyName: 'Click Construction',
}

describe('buildGcRfiEmail', () => {
  it('names the RFI, who asked, its sheets, the work it holds, the day we need it, and how to answer', () => {
    const e = buildGcRfiEmail(rfi)
    expect(e.subject).toBe('Fair Oaks Clinic: RFI-004, a question about A-501 and M-101')
    expect(e.text).toBe(
      [
        'Hello Avery Lin,',
        '',
        'RFI-004 on Fair Oaks Clinic, 1 Sample Rd, Boerne comes from Summit Roofing, Roofing, about A-501 and M-101:',
        '',
        'The roof curb on A-501 is 48 by 60 inches. The approved rooftop unit needs 54 by 72. Which size do we set?',
        '',
        'It holds Roof curbs until it is answered.',
        'We need your answer by Fri, Oct 9 to keep the work on time.',
        'Reply to this email with your answer. If it changes the cost or the days, please say so.',
        '',
        'Thank you,',
        'Jordan Reyes',
        'Click Construction',
      ].join('\n'),
    )
  })

  it('asks about the plans with no sheets, lists every held line, and asks plainly with no day', () => {
    const e = buildGcRfiEmail({ ...rfi, sheets: [], from: 'our superintendent', holds: ['Footings', 'Slab', 'Roof curbs'], neededBy: null, projectAddress: null })
    expect(e.subject).toBe('Fair Oaks Clinic: RFI-004, a question about the plans')
    expect(e.text).toContain('RFI-004 on Fair Oaks Clinic comes from our superintendent, about the plans:')
    expect(e.text).toContain('It holds Footings, Slab and Roof curbs until it is answered.')
    expect(e.text).toContain('Please send your answer when you can.')
  })

  it('says nothing of held work when it holds none, and escapes what was typed in the HTML', () => {
    const e = buildGcRfiEmail({ ...rfi, holds: [], question: 'Is the <b> tag & "quote" safe?' })
    expect(e.text).not.toContain('It holds')
    expect(e.html).toContain('Is the &lt;b&gt; tag &amp; &quot;quote&quot; safe?')
  })
})
