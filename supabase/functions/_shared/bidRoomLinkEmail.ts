/**
 * The email a GC receives with their bid-room link (v2.2729 — "Letterhead").
 *
 * Dependency-free so `src/lib/bidRoomLinkEmail.test.ts` can import it straight into the app's
 * tsc program. Everything a mail client is known to break is avoided on purpose:
 *   - option rows are a <table>, never flex (clients strip display:flex → name runs into price)
 *   - the button is a table cell with bgcolor (an <a> with an inline background loses its fill in
 *     dark-mode clients and renders as a highlighted link — the owner's screenshot)
 *   - mail-safe font stacks, explicit colors on every text node, a `color-scheme: light only` meta
 */
import { escapeHtmlForEmail } from './estimateEmailBrandImage.ts'
import type { SharedBidRoomPayload } from './bidRoomPayload.ts'

export type BidRoomLinkEmailSender = { name: string; email: string; phone: string }

export type BidRoomLinkEmailInput = {
  payload: SharedBidRoomPayload
  link: string
  /** Absolute URL of the brand banner (`/brand/click-plum.png` on the public origin); '' = no banner. */
  brandImageUrl: string
  revNumber: number
  /** The revision note the estimator typed when publishing — shown on revised sends. */
  revNote: string | null
  /** The staff member pressing send; null = no signature block. */
  sender: BidRoomLinkEmailSender | null
  /** "Sept 3, 2026" in the company calendar zone. */
  dateLabel: string
}

export type BidRoomLinkEmail = { subject: string; text: string; html: string; replyTo: string | null }

export function companyNameForBrand(brand: string | null): string {
  return brand === 'elec' ? 'Click Electrical' : 'Click Plumbing'
}

/** "…subject to acceptance within thirty (30) days…" → 30. Null when the terms don't say. */
export function validityDaysFromTerms(terms: string): number | null {
  const m = /\((\d{1,3})\)\s*days?/i.exec(terms) ?? /\b(\d{1,3})\s+days?\b/i.exec(terms)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const usdWhole = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

function trimOrNull(s: string | null | undefined): string | null {
  const t = (s ?? '').trim()
  return t ? t : null
}

export function buildBidRoomLinkEmail(input: BidRoomLinkEmailInput): BidRoomLinkEmail {
  const { payload, link, sender } = input
  const project = trimOrNull(payload.project_name) ?? 'your project'
  const trade = trimOrNull(payload.service_type_name) ?? 'Plumbing'
  const company = companyNameForBrand(payload.header_brand)
  const base = payload.options.find((o) => o.is_base) ?? payload.options[0] ?? null
  const revised = input.revNumber > 1
  const revNote = trimOrNull(input.revNote)
  const validityDays = validityDaysFromTerms(payload.terms)
  const address = trimOrNull(payload.project_address)
  const gc = trimOrNull(payload.gc_name)

  const subject = revised
    ? `Revised ${trade.toLowerCase()} proposal — ${project}${base ? ` — ${usdWhole.format(base.total_cents / 100)}` : ''} · ${company} (rev ${input.revNumber})`
    : `${trade} proposal — ${project}${base ? ` — ${usdWhole.format(base.total_cents / 100)}` : ''} · ${company}`

  const metaParts = [address, gc ? `prepared for ${gc}` : null, revised ? `revision ${input.revNumber} · ${input.dateLabel}` : input.dateLabel].filter(
    (p): p is string => !!p,
  )
  const intro = revised
    ? `We've revised our ${trade.toLowerCase()} proposal. Your link below is the same one — it always shows the current revision, and anything you sign applies to what's on the page at that moment.`
    : `Please review our ${trade.toLowerCase()} proposal. Pick the option that fits the project and sign on the page — the link below is yours for the life of the bid and always shows the current revision.`
  const validity = validityDays ? `Pricing is good for ${validityDays} days.` : null
  const optionLabel = (o: { is_base: boolean }) => (o.is_base ? 'Our recommendation' : 'Alternate')

  // ── plain text ───────────────────────────────────────────────────────────────
  const textLines: string[] = [
    `${trade} proposal for ${project}`,
    metaParts.join(' · '),
    '',
    intro,
    '',
    ...(revNote ? [`What changed in revision ${input.revNumber}: ${revNote}`, ''] : []),
    ...payload.options.map((o) => `  ${o.is_base ? '* ' : '  '}${o.name || 'Option'} (${optionLabel(o).toLowerCase()}): ${usd.format(o.total_cents / 100)}`),
    '',
    `Review, choose and sign here:`,
    link,
    ...(validity ? ['', validity] : []),
  ]
  if (sender) {
    textLines.push('', `${sender.name}${sender.name ? ' · ' : ''}Estimator, ${company}`, [sender.phone, sender.email].filter(Boolean).join(' · '))
  }
  textLines.push('', 'Click Plumbing and Electrical')
  const text = textLines.join('\n')

  // ── html ─────────────────────────────────────────────────────────────────────
  const e = escapeHtmlForEmail
  const ink = '#1c2430'
  const muted = '#5b6675'
  const faint = '#7b8794'
  const line = '#e3e7ec'
  const font = "font-family:Helvetica,Arial,sans-serif;"
  const optionRows = payload.options
    .map((o, i) => {
      const bg = o.is_base ? ' bgcolor="#fff7f0"' : ''
      const top = i === 0 ? '' : `border-top:1px solid ${line};`
      const lbl = `<span style="${font}font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${o.is_base ? '#9a3a06' : faint};margin-left:8px">${optionLabel(o)}</span>`
      return (
        `<tr>` +
        `<td${bg} style="${font}font-size:15px;color:${ink};padding:11px 10px;${top}">${o.is_base ? '<strong>' : ''}${e(o.name || 'Option')}${o.is_base ? '</strong>' : ''}${lbl}</td>` +
        `<td${bg} align="right" style="${font}font-size:15px;font-weight:700;color:${ink};padding:11px 10px;white-space:nowrap;${top}">${usd.format(o.total_cents / 100)}</td>` +
        `</tr>`
      )
    })
    .join('')

  const banner = input.brandImageUrl
    ? `<tr><td style="padding:22px 30px 0"><img src="${e(input.brandImageUrl)}" alt="${e(company)}" width="140" style="max-width:140px;height:auto;display:block;border:0" /></td></tr>`
    : ''
  const noteBlock = revNote
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 18px"><tr><td style="${font}font-size:15px;color:${ink};background:#f7f9fb;border-left:3px solid #ea580c;padding:12px 14px"><strong>What changed in revision ${input.revNumber}:</strong> ${e(revNote)}</td></tr></table>`
    : ''
  const button =
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 8px"><tr>` +
    `<td bgcolor="#ea580c" style="border-radius:6px"><a href="${e(link)}" style="${font}display:inline-block;padding:13px 22px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border:1px solid #ea580c;border-radius:6px">${revised ? 'Review the revised proposal' : 'Review &amp; sign the proposal'}</a></td>` +
    `</tr></table>`
  const signature = sender
    ? `<tr><td style="padding:0 30px 26px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="${font}font-size:14px;color:${muted};border-top:1px solid ${line};padding-top:16px">` +
      `<strong style="color:${ink}">${e(sender.name)}</strong>${sender.name ? ' · ' : ''}Estimator, ${e(company)}<br />` +
      `${[sender.phone, sender.email].filter(Boolean).map(e).join(' · ')}</td></tr></table></td></tr>`
    : ''

  const html =
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /><meta name="color-scheme" content="light only" /><meta name="supported-color-schemes" content="light only" /><title>${e(subject)}</title></head>` +
    `<body style="margin:0;padding:0;background:#f3f5f7">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#f3f5f7"><tr><td align="center" style="padding:24px 12px">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" bgcolor="#ffffff" style="max-width:560px;width:100%;background:#ffffff;border-radius:6px">` +
    banner +
    `<tr><td style="padding:22px 30px 0">` +
    `<h1 style="${font}font-size:21px;font-weight:700;line-height:1.25;margin:0 0 4px;color:${ink}">${e(revised ? `Revised ${trade.toLowerCase()} proposal for ${project}` : `${trade} proposal for ${project}`)}</h1>` +
    `<p style="${font}font-size:13.5px;color:${muted};margin:0 0 18px">${metaParts.map(e).join(' &middot; ')}</p>` +
    `<p style="${font}font-size:15px;line-height:1.5;color:${ink};margin:0 0 16px">${e(intro)}</p>` +
    noteBlock +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse">${optionRows}</table>` +
    button +
    `<p style="${font}font-size:13px;color:${faint};margin:8px 0 0">${validity ? `${e(validity)} ` : ''}Can&rsquo;t click the button? Open <a href="${e(link)}" style="color:${muted}">${e(link)}</a></p>` +
    `</td></tr>` +
    (signature || `<tr><td style="padding:0 30px 26px"></td></tr>`) +
    `<tr><td style="${font}font-size:12px;color:#8593a1;background:#f7f9fb;border-top:1px solid ${line};padding:14px 30px 18px;border-radius:0 0 6px 6px">Click Plumbing and Electrical${sender?.email ? ` &middot; reply to this email to reach ${e(sender.name || 'your estimator')}` : ''}</td></tr>` +
    `</table></td></tr></table></body></html>`

  return { subject, text, html, replyTo: sender?.email ? sender.email : null }
}
