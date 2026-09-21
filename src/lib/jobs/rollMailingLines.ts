import { titleCaseUpperWords } from '../customers/propertyRecord'

/**
 * The appraisal roll's mailing address as envelope lines (display only — what
 * Use saves is untouched). The roll hands back one string, and the districts
 * write "care of" as a leading `%`:
 *   "% SABRA HEALTH CARE REIT INC 18500 VON KARMAN AVE STE 550, IRVINE, CA 92612"
 * which read on the desk as "mail to % Sabra…" and wrapped mid-street. Here it
 * becomes c/o + street + "City, ST ZIP", each on its own line.
 *
 * Every step falls back to the tidied whole string: a shape this does not
 * recognise is shown as the roll wrote it, never rearranged on a guess.
 */
export interface RollMailingLines {
  /** "Sabra Health Care Reit Inc" — '' when the roll names no care-of. */
  careOf: string
  /** Street line(s), then "City, ST ZIP". At least one line when the input is not blank. */
  lines: string[]
}

const CARE_OF_LEAD = /^(?:%|c\/o\b|attn\b:?|attention\b:?)\s*/i
/** A street number ("18500", "12B") or the start of a PO box — where the care-of name ends. */
const isStreetStart = (tokens: string[], i: number): boolean => {
  const t = tokens[i] ?? ''
  if (/^\d+[A-Z]?$/i.test(t)) return i + 1 < tokens.length
  return /^P\.?O\.?$/i.test(t) && /^BOX$/i.test(tokens[i + 1] ?? '')
}

const STATE_ZIP = /^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/

function titleCaseLine(s: string): string {
  return titleCaseUpperWords(s).replace(/\bPo Box\b/g, 'PO Box')
}

export function rollMailingLines(raw: string | null | undefined): RollMailingLines {
  const whole = (raw ?? '').replace(/\s+,/g, ',').replace(/\s+/g, ' ').trim()
  if (!whole) return { careOf: '', lines: [] }

  let careOf = ''
  let rest = whole
  if (CARE_OF_LEAD.test(whole)) {
    const tokens = whole.replace(CARE_OF_LEAD, '').split(' ')
    const at = tokens.findIndex((_, i) => i > 0 && isStreetStart(tokens, i))
    if (at > 0) {
      careOf = titleCaseLine(tokens.slice(0, at).join(' ').replace(/,$/, ''))
      rest = tokens.slice(at).join(' ')
    }
  }

  const parts = rest.split(',').map((p) => p.trim()).filter(Boolean)
  const last = parts[parts.length - 1] ?? ''
  const m = STATE_ZIP.exec(last)
  if (m && parts.length >= 3) {
    const city = titleCaseLine(parts[parts.length - 2] ?? '')
    const street = parts.slice(0, -2).map(titleCaseLine)
    return { careOf, lines: [...street, `${city}, ${(m[1] ?? '').toUpperCase()} ${m[2] ?? ''}`] }
  }
  return { careOf, lines: [titleCaseLine(rest)] }
}
