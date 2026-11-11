import { qrMatrix } from '../../../supabase/functions/_shared/qrMatrix'
import { bytesToBase64, qrPngBytes } from '../../../supabase/functions/_shared/qrPng'
import { APP_ORIGIN } from '../appOrigin'
import { helpShareUrl } from '../helpShareCard'

/**
 * The code a lien help sheet prints in its corner (punch list #314, change 11): it opens the full guide on a phone.
 * Drawn here, not in `lienHelpSheet.ts`, so the sheet's kernel stays words and HTML; the caller hands the markup in.
 */

/** The guide a lien help sheet points at. `lienHelpGuideCode.test.ts` holds it to a guide that exists. */
export const LIEN_HELP_GUIDE_SLUG = 'file-a-lien-and-never-miss-its-deadlines'

/** The guide's public address: its share page, which opens the guide for a signed-in reader. */
export function lienHelpGuideUrl(): string {
  return helpShareUrl(APP_ORIGIN, LIEN_HELP_GUIDE_SLUG)
}

let cached: string | null = null

/** The code as markup for the sheet's foot; '' when the address cannot be drawn as a code. Drawn once and kept. */
export function lienHelpGuideCode(): string {
  if (cached !== null) return cached
  const modules = qrMatrix(lienHelpGuideUrl())
  cached = modules ? `<img alt="" src="data:image/png;base64,${bytesToBase64(qrPngBytes(modules))}"/>` : ''
  return cached
}
