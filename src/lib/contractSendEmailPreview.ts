/**
 * Client-side preview for the contract signing email. Keep in sync with
 * `supabase/functions/send-contract-for-signature/index.ts` (subject, intro, HTML body).
 */

const MAX_EMAIL_SUBJECT_LEN = 200
const MAX_EMAIL_INTRO_LEN = 4000

function clampEmailSubject(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const t = raw.trim()
  return t.length > MAX_EMAIL_SUBJECT_LEN ? t.slice(0, MAX_EMAIL_SUBJECT_LEN) : t
}

function clampEmailIntro(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const t = raw.trim().replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
  return t.length > MAX_EMAIL_INTRO_LEN ? t.slice(0, MAX_EMAIL_INTRO_LEN) : t
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Split on blank lines into paragraphs; single newlines become `<br>`. */
function introPlainToHtmlBlocks(intro: string): string {
  const parts = intro
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length === 0) return `<p>${escapeHtml(intro)}</p>`
  return parts
    .map((block) => {
      const withBr = escapeHtml(block).replace(/\n/g, '<br>')
      return `<p>${withBr}</p>`
    })
    .join('')
}

const DEFAULT_INTRO_PLAIN = 'Please review and sign your contract.'

export function buildContractSendEmailPreview(params: {
  documentName: string
  personName: string
  emailSubject: string
  emailIntroPlain: string
  /** Signing URL is unknown until send; use a placeholder (e.g. … token). */
  linkPlaceholder: string
}): { subject: string; htmlBody: string; textPlain: string } {
  const { documentName, personName, emailSubject, emailIntroPlain, linkPlaceholder } = params

  const subjectTrimmed = clampEmailSubject(emailSubject)
  const subject =
    subjectTrimmed || `Sign contract: ${documentName} (${personName})`

  const introTrimmed = clampEmailIntro(emailIntroPlain)
  const introPlain = introTrimmed || DEFAULT_INTRO_PLAIN

  const textPlain =
    `${introPlain}\n\n` +
    `Document: ${documentName}\n` +
    `Open this link to sign:\n${linkPlaceholder}\n`

  const introHtml = introPlainToHtmlBlocks(introPlain)
  const htmlBody =
    `${introHtml}` +
    `<p><strong>${escapeHtml(documentName)}</strong> — ${escapeHtml(personName)}</p>` +
    `<p><a href="${escapeHtml(linkPlaceholder)}">Open signing page</a></p>`

  return { subject, htmlBody, textPlain }
}
