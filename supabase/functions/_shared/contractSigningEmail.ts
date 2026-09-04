/**
 * The email a person receives when staff send them a contract to sign (v2.2773 — "Paper",
 * owner pick B from the 2026-09-04 mockups). It is the sub portal's own identity on purpose:
 * same paper, same CLICK. wordmark, same ink rule and copper eyebrow — the signed copy ends up
 * on that page's "Your paperwork on file" card, so the email should look like a page of the
 * same thing.
 *
 * Dependency-free on purpose: `src/lib/contractSigningEmail.ts` re-exports this file so the
 * send dialog's preview renders the exact message `send-contract-for-signature` sends, and
 * `src/lib/contractSigningEmail.test.ts` imports it straight into the app's tsc program.
 *
 * Mail-client rules (learned on the bid-room and estimate emails): the steps are a <table>,
 * never flex; the button is a table cell with bgcolor; explicit colors on every text node;
 * mail-safe fonts; a `color-scheme: light only` meta so dark-mode clients keep the paper.
 *
 * What the staff member still controls per send: the subject (overrides the default) and the
 * opening message (their own words, blank-line paragraphs; '' = the default line).
 */

export type ContractSigningEmailSender = { name: string; email: string }

export type ContractSigningEmailInput = {
  documentName: string
  personName: string
  acceptUrl: string
  /** `YYYY-MM-DD` the link stops working (company calendar); null = no expiry line. */
  expiresYmd: string | null
  /** `YYYY-MM-DD` the email is sent (company calendar). */
  sentYmd: string
  /** Per-send subject; '' = the default. Clamped to 200 chars. */
  subjectOverride: string
  /** Per-send opening message, plain text; '' = the default line. Clamped to 4000 chars. */
  introPlain: string
  /** The staff member pressing send — Reply-To and the "reach" line; null = neither. */
  sender: ContractSigningEmailSender | null
  /** The person's live portal address (`https://my.clickplumbing.com/<slug>`); null = no page. */
  portalUrl: string | null
  /** Office phone for the footer; null/'' = "call or text the office" without a number. */
  officePhone: string | null
}

export type ContractSigningEmail = {
  subject: string
  text: string
  html: string
  replyTo: string | null
  /** Display name for the From mailbox (the verified address stays EMAIL_FROM's). */
  fromName: string
}

/** Matches the signing page's title link and the portal letterhead (`PORTAL_COMPANY.name`). */
export const CONTRACT_SIGNING_EMAIL_COMPANY = 'Click Plumbing and Electrical'

export const CONTRACT_SIGNING_EMAIL_MAX_SUBJECT = 200
export const CONTRACT_SIGNING_EMAIL_MAX_INTRO = 4000

export const CONTRACT_SIGNING_EMAIL_DEFAULT_INTRO = 'Here is your agreement to read and sign. It only takes a couple of minutes on your phone.'

export function contractSigningEmailDefaultSubject(documentName: string): string {
  return `Please sign: ${documentName.trim() || 'your agreement'} · ${CONTRACT_SIGNING_EMAIL_COMPANY}`
}

export function clampContractEmailSubject(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const t = raw.trim()
  return t.length > CONTRACT_SIGNING_EMAIL_MAX_SUBJECT ? t.slice(0, CONTRACT_SIGNING_EMAIL_MAX_SUBJECT) : t
}

export function clampContractEmailIntro(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const t = raw.trim().replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
  return t.length > CONTRACT_SIGNING_EMAIL_MAX_INTRO ? t.slice(0, CONTRACT_SIGNING_EMAIL_MAX_INTRO) : t
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-09-18" → "Sep 18, 2026"; anything else → null. Civil date, no zone math. */
export function formatYmdForContractEmail(ymd: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((ymd ?? '').trim())
  if (!m) return null
  const month = MONTHS[Number(m[2]) - 1]
  const day = Number(m[3])
  if (!month || !(day >= 1 && day <= 31)) return null
  return `${month} ${day}, ${m[1]}`
}

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Blank-line separated paragraphs; single newlines survive as line breaks. */
export function splitIntroParagraphs(intro: string): string[] {
  return intro
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
}

/** "https://my.clickplumbing.com/slug" → "my.clickplumbing.com/slug" for reading aloud. */
export function portalUrlForDisplay(url: string): string {
  return url.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '')
}

export function buildContractSigningEmail(input: ContractSigningEmailInput): ContractSigningEmail {
  const company = CONTRACT_SIGNING_EMAIL_COMPANY
  const documentName = input.documentName.trim() || 'Agreement'
  const personName = input.personName.trim()
  const subject = clampContractEmailSubject(input.subjectOverride) || contractSigningEmailDefaultSubject(documentName)
  const introParas = splitIntroParagraphs(clampContractEmailIntro(input.introPlain) || CONTRACT_SIGNING_EMAIL_DEFAULT_INTRO)
  const sender = input.sender && input.sender.email.trim() ? { name: input.sender.name.trim(), email: input.sender.email.trim() } : null
  const senderFirst = sender?.name ? sender.name.split(/\s+/)[0]! : ''
  const sentLabel = formatYmdForContractEmail(input.sentYmd) ?? ''
  const expiresLabel = formatYmdForContractEmail(input.expiresYmd)
  const portalUrl = (input.portalUrl ?? '').trim() || null
  const portalDisplay = portalUrl ? portalUrlForDisplay(portalUrl) : null
  const phone = (input.officePhone ?? '').trim() || null

  const steps = ['Open the page below', 'Read the agreement (about 2 minutes)', 'Type or draw your signature. That is it.']
  const buttonLabel = 'Read and sign'
  const sentBy = sender?.name ? `Sent to you by ${sender.name} · ${company}` : `Sent to you by ${company}`
  const keepLine = portalDisplay
    ? `Once you have signed, it stays on your page. ${portalDisplay} keeps your jobs, your pay, and your paperwork, so builders never hold up a check over a missing form.`
    : 'Once you have signed, we keep the copy on file, so you never have to send it again.'
  const spanishLine = '¿Prefiere español? La página tiene un botón Español arriba a la derecha.'
  const reachLine = sender
    ? `Questions? Reply to this email to reach ${senderFirst || 'us'}${phone ? `, or call or text the office at ${phone}` : ', or call or text the office'}.`
    : `Questions? ${phone ? `Call or text the office at ${phone}` : 'Call or text the office'}.`

  // ── plain text ───────────────────────────────────────────────────────────────
  const textLines: string[] = [company, `Paperwork to sign${personName ? ` · For ${personName}` : ''}${sentLabel ? ` · ${sentLabel}` : ''}`, '']
  textLines.push('One document to sign', documentName, sentBy, '')
  textLines.push(...introParas.flatMap((p, i) => (i === 0 ? [p] : ['', p])), '')
  textLines.push(...steps.map((s, i) => `${i + 1}. ${s}`), '')
  textLines.push(`${buttonLabel}:`, input.acceptUrl)
  if (expiresLabel) textLines.push(`This link works until ${expiresLabel}.`)
  textLines.push('', keepLine, '', spanishLine, '', reachLine)
  const text = textLines.join('\n')

  // ── html (the portal palette: src/lib/portal/portalTheme.ts) ─────────────────
  const e = escape
  const ink = '#16283c'
  const paper = '#f6f3ec'
  const card = '#fdfcf9'
  const muted = '#5a6b7e'
  const faint = '#8a97a6'
  const hair = '#ddd6c8'
  const copper = '#b0662f'
  const band = '#f1ece2'
  const font = "font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"
  const para = (p: string, first: boolean) => `<p style="${font}font-size:15px;line-height:1.55;color:${ink};margin:${first ? '18px' : '10px'} 0 0">${e(p).replace(/\n/g, '<br />')}</p>`

  const stepRows = steps
    .map(
      (s, i) =>
        `<tr><td style="${font}padding:10px 12px;${i < steps.length - 1 ? `border-bottom:1px solid ${hair};` : ''}font-size:13.5px;color:${ink}">` +
        `<span style="display:inline-block;width:18px;height:18px;border-radius:9px;background:${ink};color:#ffffff;font-size:11px;font-weight:700;text-align:center;line-height:18px;margin-right:8px">${i + 1}</span>${e(s)}</td></tr>`,
    )
    .join('')

  const html =
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /><meta name="color-scheme" content="light only" /><meta name="supported-color-schemes" content="light only" /><title>${e(subject)}</title></head>` +
    `<body style="margin:0;padding:0;background:${paper}">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${paper}"><tr><td align="center" style="padding:20px 12px 28px">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%">` +
    // letterhead
    `<tr><td style="padding:0 6px">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>` +
    `<td style="vertical-align:bottom;${font}"><div style="font-size:26px;font-weight:900;letter-spacing:-0.03em;line-height:1;color:${ink}">CLICK<span style="color:${copper}">.</span></div>` +
    `<div style="font-size:10px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:${muted};margin-top:4px">Plumbing, Electrical, and HVAC</div></td>` +
    `<td align="right" style="vertical-align:bottom;${font}font-size:11px;color:${muted};line-height:1.6">Paperwork to sign${personName ? `<br />For ${e(personName)}` : ''}${sentLabel ? `<br />${e(sentLabel)}` : ''}</td>` +
    `</tr></table>` +
    `<div style="height:3px;background:${ink};margin:12px 0 0;font-size:0;line-height:0">&nbsp;</div>` +
    `</td></tr>` +
    // body
    `<tr><td style="padding:20px 6px 0;${font}">` +
    `<div style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${copper}">One document to sign</div>` +
    `<h1 style="${font}font-size:22px;font-weight:800;letter-spacing:-0.01em;line-height:1.2;margin:4px 0 0;color:${ink}">${e(documentName)}</h1>` +
    `<div style="font-size:13px;color:${muted};margin-top:5px">${e(sentBy)}</div>` +
    introParas.map((p, i) => para(p, i === 0)).join('') +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${card}" style="margin:18px 0 0;background:${card};border:1px solid ${hair};border-radius:8px;border-collapse:separate">${stepRows}</table>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 8px"><tr>` +
    `<td bgcolor="${ink}" style="border-radius:6px"><a href="${e(input.acceptUrl)}" style="${font}display:inline-block;padding:13px 24px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border:1px solid ${ink};border-radius:6px">${e(buttonLabel)}</a></td>` +
    `</tr></table>` +
    `<p style="${font}font-size:12px;color:${faint};margin:0 0 18px">Or open <a href="${e(input.acceptUrl)}" style="color:${muted}">${e(input.acceptUrl)}</a>${expiresLabel ? ` &middot; works until ${e(expiresLabel)}` : ''}</p>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${band}" style="background:${band};border-radius:8px"><tr>` +
    `<td style="${font}padding:11px 13px;font-size:13px;line-height:1.55;color:${ink}"><strong>${portalDisplay ? 'Once you have signed, it stays on your page.' : 'Once you have signed, we keep the copy on file.'}</strong> ${portalDisplay ? `${e(portalDisplay)} keeps your jobs, your pay, and your paperwork, so builders never hold up a check over a missing form.` : 'You never have to send it again.'}</td>` +
    `</tr></table>` +
    `<p style="${font}font-size:12.5px;color:${muted};margin:16px 0 0;line-height:1.55">${e('¿Prefiere español? La página tiene un botón ')}<strong>Español</strong>${e(' arriba a la derecha.')}</p>` +
    `<div style="height:1px;background:${hair};margin:16px 0 10px;font-size:0;line-height:0">&nbsp;</div>` +
    `<p style="${font}font-size:12px;color:${faint};margin:0;line-height:1.5">${e(reachLine)}</p>` +
    `</td></tr>` +
    `</table></td></tr></table></body></html>`

  return { subject, text, html, replyTo: sender?.email ?? null, fromName: company }
}
