/**
 * The email a customer receives with their estimate link — the "Letterhead" design (v2.2747,
 * owner pick B from the 2026-09-04 mockups; the bid-room email of v2.2729 is its sibling).
 *
 * Dependency-free on purpose: `src/lib/estimateEmailLetterhead.ts` re-exports this file so the
 * staff Email preview in Estimates.tsx renders the exact message the Edge function sends, and
 * `src/lib/estimateEmailLetterhead.test.ts` imports it straight into the app's tsc program.
 *
 * Mail-client rules (learned on the bid-room email): option rows are a <table>, never flex;
 * the button is a table cell with bgcolor; explicit colors on every text node; mail-safe fonts;
 * a `color-scheme: light only` meta so dark-mode clients keep the white paper.
 *
 * What the owner's Settings template still controls: the body. Its paragraphs (blank-line
 * separated) become the opening paragraph (first) and the sign-off (the rest); a paragraph that
 * holds the accept link is dropped because the button replaces it. The subject is no longer a
 * template — it is built here so it files well: "Estimate #482 — Water heater replacement —
 * $4,380 · Click Plumbing".
 */

export type EstimateLetterheadDocKind = 'estimate' | 'change_order'
export type EstimateLetterheadBrand = 'plum' | 'elec' | null

export type EstimateLetterheadOption = { name: string; recommended: boolean; totalCents: number }

export type EstimateLetterheadSender = { name: string; email: string }

export type EstimateLetterheadInput = {
  docKind: EstimateLetterheadDocKind
  estimateNumber: number
  title: string
  totalCents: number
  /** `YYYY-MM-DD` from `estimates.valid_until`; null = no "good through" line. */
  validUntilYmd: string | null
  forAddress: string | null
  acceptUrl: string
  brand: EstimateLetterheadBrand
  /** Absolute URL of the brand banner; null/'' = no banner. */
  brandImageUrl: string | null
  /** The resolved body template (vars already substituted) — the owner's own words. */
  bodyText: string
  /** 2+ options render the ladder in place of the single total box. */
  options: EstimateLetterheadOption[]
  /** The acceptance-page footer setting, one line per entry; empty = no footer lines. */
  footerLines: string[]
  /** The staff member pressing send — Reply-To and the footer's "reach" line; null = neither. */
  sender: EstimateLetterheadSender | null
  /** "Sep 4, 2026" in the company calendar zone. */
  dateLabel: string
}

export type EstimateLetterheadEmail = { subject: string; text: string; html: string; replyTo: string | null }

export function estimateEmailCompanyName(brand: EstimateLetterheadBrand): string {
  if (brand === 'elec') return 'Click Electrical'
  if (brand === 'plum') return 'Click Plumbing'
  return 'Click Plumbing and Electrical'
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-09-18" → "Sep 18, 2026"; anything else → null. Civil date, no zone math. */
export function formatYmdForEmail(ymd: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((ymd ?? '').trim())
  if (!m) return null
  const month = MONTHS[Number(m[2]) - 1]
  const day = Number(m[3])
  if (!month || !(day >= 1 && day <= 31)) return null
  return `${month} ${day}, ${m[1]}`
}

const usdWhole = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Split the owner's template into paragraphs, dropping the one that carried the link (the
 * button replaces it), any leftover `{{accept_url}}` placeholder, and — for rows sent before
 * v2.2747, whose stored copy holds the real URL while the preview passes a placeholder — any
 * paragraph that carries an accept link at all.
 */
export function splitBodyTemplateParagraphs(bodyText: string, acceptUrl: string): { intro: string | null; closing: string[] } {
  const paras = bodyText
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .filter((p) => !(acceptUrl && p.includes(acceptUrl)) && !p.includes('{{accept_url}}') && !p.includes('/estimate/accept?'))
  const [intro, ...closing] = paras
  return { intro: intro ?? null, closing }
}

export function buildEstimateLetterheadEmail(input: EstimateLetterheadInput): EstimateLetterheadEmail {
  const isCo = input.docKind === 'change_order'
  const company = estimateEmailCompanyName(input.brand)
  const title = input.title.trim()
  const kindLabel = isCo ? 'Change order' : 'Estimate'
  const options = input.options.length >= 2 ? input.options : []
  const headlineCents = options.length > 0 ? (options.find((o) => o.recommended) ?? options[0])!.totalCents : input.totalCents
  const amount = usdWhole.format(headlineCents / 100)
  const validThrough = formatYmdForEmail(input.validUntilYmd)
  const address = (input.forAddress ?? '').trim() || null
  const { intro, closing } = splitBodyTemplateParagraphs(input.bodyText, input.acceptUrl)
  const sender = input.sender && input.sender.email.trim() ? { name: input.sender.name.trim(), email: input.sender.email.trim() } : null

  const subject = `${kindLabel} #${input.estimateNumber}${title ? ` — ${title}` : ''} — ${amount} · ${company}`
  const heading = title || (isCo ? 'Your change order' : 'Your estimate')
  const metaParts = [`${kindLabel} #${input.estimateNumber}`, address, input.dateLabel].filter((p): p is string => !!p)
  const totalLabel = isCo ? 'Net change to contract' : 'Estimate total'
  const validity = validThrough ? `Pricing is good through ${validThrough}.` : null
  const buttonLabel = isCo ? 'Review & sign the change order' : 'Review & accept the estimate'
  const reachLine = sender ? `Reply to this email to reach ${sender.name || 'us'}.` : null
  const footerLines = input.footerLines.map((l) => l.trim()).filter((l) => l.length > 0)

  // ── plain text ───────────────────────────────────────────────────────────────
  const textLines: string[] = [heading, metaParts.join(' · '), '']
  if (intro) textLines.push(intro, '')
  if (options.length > 0) {
    textLines.push('Your options — choose on the page:')
    for (const o of options) {
      textLines.push(`  ${o.recommended ? '* ' : '  '}${o.name.trim() || 'Option'}${o.recommended ? ' (our recommendation)' : ''}: ${usd.format(o.totalCents / 100)}`)
    }
  } else {
    textLines.push(`${totalLabel}: ${usd.format(input.totalCents / 100)}`)
  }
  if (validity) textLines.push(validity)
  textLines.push('', `${buttonLabel}:`, input.acceptUrl)
  if (closing.length > 0) textLines.push('', ...closing.flatMap((p, i) => (i === 0 ? [p] : ['', p])))
  if (footerLines.length > 0 || reachLine) textLines.push('', ...footerLines, ...(reachLine ? [reachLine] : []))
  const text = textLines.join('\n')

  // ── html ─────────────────────────────────────────────────────────────────────
  const e = escape
  const ink = '#1c2430'
  const muted = '#5b6675'
  const faint = '#7b8794'
  const line = '#e3e7ec'
  const font = 'font-family:Helvetica,Arial,sans-serif;'
  const para = (p: string) => `<p style="${font}font-size:15px;line-height:1.5;color:${ink};margin:0 0 16px">${e(p).replace(/\n/g, '<br />')}</p>`

  const banner = input.brandImageUrl?.trim()
    ? `<tr><td style="padding:22px 30px 0"><img src="${e(input.brandImageUrl.trim())}" alt="${e(company)}" width="140" style="max-width:140px;height:auto;display:block;border:0" /></td></tr>`
    : ''

  const amountBlock =
    options.length > 0
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:0 0 6px">` +
        options
          .map((o, i) => {
            const bg = o.recommended ? ' bgcolor="#fff7f0"' : ''
            const top = i === 0 ? '' : `border-top:1px solid ${line};`
            const lbl = `<span style="${font}font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${o.recommended ? '#9a3a06' : faint};margin-left:8px">${o.recommended ? 'Our recommendation' : 'Alternate'}</span>`
            return (
              `<tr>` +
              `<td${bg} style="${font}font-size:15px;color:${ink};padding:11px 10px;${top}">${o.recommended ? '<strong>' : ''}${e(o.name.trim() || 'Option')}${o.recommended ? '</strong>' : ''}${lbl}</td>` +
              `<td${bg} align="right" style="${font}font-size:15px;font-weight:700;color:${ink};padding:11px 10px;white-space:nowrap;${top}">${usd.format(o.totalCents / 100)}</td>` +
              `</tr>`
            )
          })
          .join('') +
        `</table>` +
        (validity ? `<p style="${font}font-size:13px;color:${muted};margin:0 0 6px">${e(validity)}</p>` : '')
      : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 6px"><tr>` +
        `<td bgcolor="#fff7f0" style="border:1px solid #f7d8c3;border-radius:6px;padding:12px 14px">` +
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>` +
        `<td style="${font}font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#9a3a06">${e(totalLabel)}</td>` +
        `<td align="right" style="${font}font-size:22px;font-weight:700;color:${ink};white-space:nowrap">${usd.format(input.totalCents / 100)}</td>` +
        `</tr>${validity ? `<tr><td colspan="2" style="${font}font-size:12.5px;color:${muted};padding-top:4px">${e(validity)}</td></tr>` : ''}</table>` +
        `</td></tr></table>`

  const button =
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 8px"><tr>` +
    `<td bgcolor="#ea580c" style="border-radius:6px"><a href="${e(input.acceptUrl)}" style="${font}display:inline-block;padding:13px 22px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border:1px solid #ea580c;border-radius:6px">${e(buttonLabel)}</a></td>` +
    `</tr></table>` +
    `<p style="${font}font-size:13px;color:${faint};margin:0 0 18px">Can&rsquo;t click the button? Open <a href="${e(input.acceptUrl)}" style="color:${muted}">${e(input.acceptUrl)}</a></p>`

  const closingBlock =
    closing.length > 0
      ? `<tr><td style="padding:0 30px 26px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="border-top:1px solid ${line};padding-top:16px">` +
        closing.map((p) => `<p style="${font}font-size:14px;line-height:1.5;color:${muted};margin:0 0 10px">${e(p).replace(/\n/g, '<br />')}</p>`).join('') +
        `</td></tr></table></td></tr>`
      : `<tr><td style="padding:0 30px 20px"></td></tr>`

  const footer =
    footerLines.length > 0 || reachLine
      ? `<tr><td style="${font}font-size:12px;line-height:1.5;color:#8593a1;background:#f7f9fb;border-top:1px solid ${line};padding:14px 30px 18px;border-radius:0 0 6px 6px">` +
        [...footerLines.map(e), ...(reachLine ? [e(reachLine)] : [])].join(' &middot; ') +
        `</td></tr>`
      : ''

  const html =
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /><meta name="color-scheme" content="light only" /><meta name="supported-color-schemes" content="light only" /><title>${e(subject)}</title></head>` +
    `<body style="margin:0;padding:0;background:#f3f5f7">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#f3f5f7"><tr><td align="center" style="padding:24px 12px">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" bgcolor="#ffffff" style="max-width:560px;width:100%;background:#ffffff;border-radius:6px">` +
    banner +
    `<tr><td style="padding:22px 30px 0">` +
    `<h1 style="${font}font-size:21px;font-weight:700;line-height:1.25;margin:0 0 4px;color:${ink}">${e(heading)}</h1>` +
    `<p style="${font}font-size:13.5px;color:${muted};margin:0 0 18px">${metaParts.map(e).join(' &middot; ')}</p>` +
    (intro ? para(intro) : '') +
    amountBlock +
    button +
    `</td></tr>` +
    closingBlock +
    footer +
    `</table></td></tr></table></body></html>`

  return { subject, text, html, replyTo: sender?.email ?? null }
}
