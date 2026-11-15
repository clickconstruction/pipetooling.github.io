/**
 * The Scan a label page's typed code (punch list #294, v2.6799). Until v2.7379 this file also kept the last box a phone
 * scanned for a day, so the bare `/b` page could search that box's site; what is in a box needs a sign-in now, and
 * nothing is kept on the phone.
 */

/** The code as a person types it into the box on the Scan a label page: capitals, the dash put in after four. */
export function typedCodeWords(raw: string): string {
  const c = raw.replace(/[^0-9a-z]/gi, '').toUpperCase().slice(0, 8)
  return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c
}
