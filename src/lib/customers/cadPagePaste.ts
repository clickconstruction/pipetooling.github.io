/**
 * "Paste the CAD page" parser (customer properties train, PR 4 — v2.3010).
 *
 * When the statewide roll has no parcel under the pin, the office finds the
 * property on the county appraisal district's site, selects the whole page,
 * copies, and pastes it here. The district sites (BIS "esearch" for most of
 * the service area, TrueAutomation for Bexar, the big-county custom sites)
 * all label the same handful of facts — "Legal Description:", "Owner Name:",
 * "Mailing Address:", "Exemptions:" — so a label table is enough. Each value
 * runs from its label to the next known label or a blank line, across line
 * breaks, because copied tables put the label and value on separate lines.
 * Pure; the record panel applies the result through `applyProposalToFields`.
 */

export type CadPasteResult = {
  propId: string
  legalDescription: string
  ownerName: string
  mailingAddress: string
  situsAddress: string
  /** 'yes' when an exemptions line names a homestead, 'no' when it exists and does not, 'unknown' when absent. */
  homestead: 'yes' | 'no' | 'unknown'
  /** Labels that were found, in page order — for the "Found in the paste" summary. */
  found: Array<'propId' | 'legalDescription' | 'ownerName' | 'mailingAddress' | 'situsAddress' | 'exemptions'>
}

type Field = keyof Omit<CadPasteResult, 'homestead' | 'found'> | 'exemptions'

/** Label spellings per field, most specific first. Matched at a line start (after optional bullets / table noise). */
const LABELS: Array<{ field: Field; re: RegExp }> = [
  { field: 'propId', re: /^(?:property\s*id|prop(?:erty)?\s*#|prop\s*id|account(?:\s*(?:number|no\.?|#))?|quick\s*ref(?:erence)?\s*id|r\s*number)\s*:?/i },
  { field: 'legalDescription', re: /^(?:legal\s*description|legal\s*desc\.?|legal)\s*:?/i },
  { field: 'ownerName', re: /^(?:owner\s*name|owner(?:\(s\))?|owner\s*of\s*record|current\s*owner|name)\s*:?/i },
  { field: 'mailingAddress', re: /^(?:mailing\s*address|owner\s*(?:mailing\s*)?address|mail(?:ing)?\s*addr\.?|address\s*\(mailing\))\s*:?/i },
  { field: 'situsAddress', re: /^(?:situs(?:\s*address)?|property\s*address|property\s*location|location\s*address|site\s*address)\s*:?/i },
  { field: 'exemptions', re: /^(?:exemptions?|exemption\s*codes?)\s*:?/i },
]

/** Labels that end a value without starting one we keep. */
const STOP_LABELS =
  /^(?:geographic\s*id|geo\s*id|type|agent(?:\s*code)?|property\s*use(?:\s*code)?|neighborhood(?:\s*cd)?|map\s*id|deed\s*date|deed\s*book|deed\s*page|abstract\/subdivision|abstract|subdivision|acreage|land\s*value|improvement\s*value|market\s*value|appraised\s*value|assessed\s*value|total\s*value|values?|taxing\s*jurisdictions?|jurisdiction|protest|arb|year|tax\s*year|%\s*ownership|ownership|percent|dba|doing\s*business\s*as|history|sales?\s*history|improvements?|land|segments?|sketch|map)\s*:?\s*$/i

function stripLineNoise(line: string): string {
  return line.replace(/^[\s•\-\*\|\t]+/, '').replace(/[\s\|\t]+$/, '').trim()
}

function matchLabel(line: string): { field: Field; rest: string } | null {
  for (const { field, re } of LABELS) {
    const m = line.match(re)
    if (m) {
      const rest = line.slice(m[0].length).replace(/^\s*[:\-–]\s*/, '').trim()
      // Without a colon: a bare "Owner" / "Location" line is a section
      // heading, and a long tail is prose — neither is a label.
      if (!/[:]/.test(m[0]) && (rest.length === 0 || rest.length > 60)) continue
      return { field, rest }
    }
  }
  return null
}

function tidy(s: string): string {
  return s
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/\s+/g, ' ')
    .replace(/^,\s*|,\s*$/g, '')
    .trim()
}

/** "PROPERTY ID: 442365 FOR YEAR 2026" → "442365". */
function tidyPropId(s: string): string {
  const m = s.match(/([A-Z]?\d[\w-]*)/i)
  return m ? m[1]! : s.trim()
}

export function parseCadPagePaste(text: string): CadPasteResult {
  const out: CadPasteResult = { propId: '', legalDescription: '', ownerName: '', mailingAddress: '', situsAddress: '', homestead: 'unknown', found: [] }
  const raw: Record<Field, string> = { propId: '', legalDescription: '', ownerName: '', mailingAddress: '', situsAddress: '', exemptions: '' }
  const seen = new Set<Field>()
  const lines = (text ?? '').replace(/\r/g, '').split('\n')
  let current: Field | null = null
  for (const rawLine of lines) {
    const line = stripLineNoise(rawLine)
    if (line === '') {
      current = null
      continue
    }
    const hit = matchLabel(line)
    if (hit) {
      if (seen.has(hit.field)) {
        // Second occurrence (e.g. "Owner Name" again in a history table): keep the first.
        current = null
        continue
      }
      seen.add(hit.field)
      out.found.push(hit.field)
      raw[hit.field] = hit.rest
      current = hit.field
      continue
    }
    if (STOP_LABELS.test(line) || /^[A-Za-z][A-Za-z /&%#()\-]{1,40}:\s*$/.test(line) || /^[A-Za-z][A-Za-z /&%#()\-]{1,40}:\s+\S/.test(line)) {
      // Another labelled row we do not keep — the current value ends.
      current = null
      continue
    }
    if (current) {
      raw[current] = raw[current] ? `${raw[current]} ${line}` : line
      // Single-line facts stop after their first line; addresses and legal descriptions may wrap.
      if (current === 'propId' || current === 'ownerName' || current === 'exemptions') current = null
    }
  }
  out.propId = tidyPropId(raw.propId)
  out.legalDescription = tidy(raw.legalDescription)
  out.ownerName = tidy(raw.ownerName)
  out.mailingAddress = tidy(raw.mailingAddress)
  out.situsAddress = tidy(raw.situsAddress)
  if (seen.has('exemptions')) {
    const ex = raw.exemptions.trim()
    out.homestead = /\b(?:HS|HOMESTEAD|OV65|DP)\b/i.test(ex) && /\b(?:HS|HOMESTEAD)\b/i.test(ex) ? 'yes' : 'no'
  }
  return out
}

/** Anything worth applying? */
export function cadPasteHasFacts(r: CadPasteResult): boolean {
  return Boolean(r.legalDescription || r.ownerName || r.mailingAddress || r.propId)
}
