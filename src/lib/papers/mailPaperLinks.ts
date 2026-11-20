/**
 * What a job's mail carries that a paper can hold (v2.7973, punch list #368): a real file, or a link to a file on a
 * file host (Google Drive, Dropbox and the rest of `fileLinks.ts`). Most papers in the app are a Drive link and no
 * file, so **Keep this mail as a paper** shows on either, in Messages and in My email alike, and the form's Link box
 * starts with the mail's link. A mail with neither has no press on either screen. Pure.
 */
import { fileHost } from '../emailIn/fileLinks'
import { decodeEntities } from '../emailIn/gmailMessage'

/** Whether the mail has something a paper can hold: a real file (a picture from inside its words not counted) or a file link. */
export function mailHasPaper(m: { files: number; links: number }): boolean {
  return m.files > 0 || m.links > 0
}

/**
 * A link as the mail's words gave it, without what clings to its end: the mark an email program leaves where a
 * picture sat (U+FFFC, found on real mail right after a Drive link, which stored the one link twice), or a no-break
 * or zero-width space.
 */
export function cleanMailLink(url: string): string {
  return url.trim().replace(/[\uFFFC\uFFFD\u00A0\u200B-\u200D\uFEFF\s]+$/u, '')
}

/** The mail's file links, each once, in the mail's order: cleaned, and two that differ only by what clung to the end read as one. */
export function mailPaperLinks(urls: ReadonlyArray<string | null | undefined>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of urls) {
    const url = cleanMailLink(raw ?? '')
    if (!url || seen.has(url) || !fileHost(url)) continue
    seen.add(url)
    out.push(url)
  }
  return out
}

// The two reads `gmailMessage.ts` makes of a mail's words, kept here so the reader of My email finds the same links
// the line in Messages holds, without a change to a kernel the functions copy.
const URL_IN_TEXT = /https?:\/\/[^\s<>"'()]+[^\s<>"'().,;:!?]/gi
const HREF = /<a\b[^>]*\bhref\s*=\s*(["'])(https?:\/\/[^"']+)\1/gi

/** The file links in a mail's words, for a mail read straight from the box (My email): behind the HTML's links first, then in the text. */
export function fileLinksInWords(mail: { bodyText?: string | null; bodyHtml?: string | null }): string[] {
  const found: string[] = []
  for (const hit of (mail.bodyHtml ?? '').matchAll(HREF)) found.push(decodeEntities(hit[2]!))
  for (const hit of (mail.bodyText ?? '').matchAll(URL_IN_TEXT)) found.push(hit[0])
  return mailPaperLinks(found)
}

/** What a link is, in two words, so two links from one mail can be told apart in the form: *Google Doc*, *Drive folder*. */
export function linkKindWords(url: string): string {
  let path = ''
  try {
    path = new URL(url).pathname
  } catch {
    return 'Link'
  }
  const host = fileHost(url)
  if (host === 'drive') {
    if (/\/document\/d\//.test(path)) return 'Google Doc'
    if (/\/spreadsheets\/d\//.test(path)) return 'Google Sheet'
    if (/\/presentation\/d\//.test(path)) return 'Google Slides'
    if (/\/folders\//.test(path)) return 'Drive folder'
    return 'Drive file'
  }
  if (host === 'dropbox') return 'Dropbox link'
  if (host === 'box') return 'Box link'
  if (host === 'wetransfer') return 'WeTransfer link'
  if (host === 'onedrive') return 'OneDrive link'
  if (host === 'sharepoint') return 'SharePoint link'
  return 'Link'
}

/** The choices the form offers when the mail carries more than one link: *1. Google Doc*, *2. Drive folder*. */
export function mailLinkChoices(links: ReadonlyArray<string>): Array<{ url: string; label: string }> {
  return links.map((url, i) => ({ url, label: `${i + 1}. ${linkKindWords(url)}` }))
}

export const MAIL_PAPER_LINK_WORDS = {
  /** Under the Link box when the mail's own link fills it. */
  filled: 'Filled from the mail. Change it if the paper lives somewhere else.',
  /** The row that picks among the mail's links. */
  pick: 'Mail’s links',
  open: 'Open it',
} as const
