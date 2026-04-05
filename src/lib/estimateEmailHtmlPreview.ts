/**
 * HTML body for estimate customer email preview (matches Resend HTML from Edge).
 * Keep in sync with `supabase/functions/_shared/estimateEmailBrandImage.ts` (buildEstimateEmailHtml + escapes).
 */

function escapeHtmlForEmail(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeHtmlAttributeValue(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

/**
 * Builds HTML body: optional centered logo, then escaped plain body with newlines as `<br>`.
 */
export function buildEstimateEmailHtml(
  bodyPlain: string,
  opts?: { imageUrl: string; imageAlt: string },
): string {
  const bodyHtml = escapeHtmlForEmail(bodyPlain).replace(/\n/g, '<br>')
  if (!opts?.imageUrl?.trim()) return bodyHtml
  const src = escapeHtmlAttributeValue(opts.imageUrl.trim())
  const alt = escapeHtmlAttributeValue(opts.imageAlt.trim() || 'Logo')
  const header =
    `<div style="text-align:center;margin-bottom:1rem">` +
    `<img src="${src}" alt="${alt}" width="140" style="max-width:140px;height:auto;display:inline-block;border:0" />` +
    `</div>`
  return header + bodyHtml
}
