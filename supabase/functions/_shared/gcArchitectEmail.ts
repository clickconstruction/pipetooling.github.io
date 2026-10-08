/**
 * The emails GC mode sends a project's architect while we build (the real build, the Building lane's U4b): a
 * submittal to review. Built once, so the function that sends it and the sample on Settings → What customers see
 * read the same (`gc-architect-email`; `customerSampleEmails.ts`). The Building lane's U5 adds the RFI beside it.
 */

export type GcSubmittalEmailInput = {
  architectName: string
  projectName: string
  projectAddress: string | null
  /** Its number in the register, "26 24 16-01". */
  number: string
  title: string
  kind: 'product data' | 'shop drawings' | 'samples'
  /** The trade and the company that sent it, "Electrical, Pedernales Valley Electric". */
  from: string
  /** 1 the first time it comes, 2 after one revise. */
  round: number
  /** The file the trade sent, by name, and its Drive link. */
  file: string
  driveUrl: string
  /** The trade's note with it. Empty: none. */
  note: string
  /** The day we need the answer, in words ("Mon, Oct 20"). Null: no day yet. */
  neededBy: string | null
  /** The project manager, else the sender. */
  signer: string
  companyName: string
}

type Paragraph = { text: string; href?: string }

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function buildGcSubmittalEmail(input: GcSubmittalEmailInput): { subject: string; text: string; html: string } {
  const again = input.round > 1
  const subject = `${input.projectName}: submittal ${input.number}, ${input.title}${again ? `, round ${input.round}` : ''}`
  const note = input.note.trim().replace(/[.\s]+$/, '')
  const paragraphs: Paragraph[] = [
    { text: `Hello ${input.architectName},` },
    { text: '' },
    { text: `Here is submittal ${input.number} for ${input.projectName}${input.projectAddress ? `, ${input.projectAddress}` : ''}: ${input.title}, ${input.kind}, from ${input.from}.` },
    ...(again ? [{ text: `This is round ${input.round}, sent again after your notes.` }] : []),
    { text: '' },
    { text: `The file is ${input.file}. Open it here:` },
    { text: input.driveUrl, href: input.driveUrl },
    ...(note ? [{ text: `Their note: ${note}.` }] : []),
    { text: '' },
    { text: input.neededBy ? `We need your answer by ${input.neededBy} to keep the work on time.` : 'Please send your answer when you can.' },
    { text: 'Reply to this email with your answer: approved, approved as noted, or revise with what to change.' },
    { text: '' },
    { text: 'Thank you,' },
    { text: input.signer },
    { text: input.companyName },
  ]
  const text = paragraphs.map((p) => p.text).join('\n')
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#111">${paragraphs
    .map((p) =>
      p.text === ''
        ? '<br>'
        : p.href
          ? `<p style="margin:0 0 4px"><a href="${escapeHtml(p.href)}" style="color:#1d4ed8">${escapeHtml(p.text)}</a></p>`
          : `<p style="margin:0 0 4px">${escapeHtml(p.text)}</p>`,
    )
    .join('')}</div>`
  return { subject, text, html }
}
