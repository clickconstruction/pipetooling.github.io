/**
 * Messages, cut 10 (photos saved on arrival): the name a photo takes in its job's Drive folder, Team only › Photos, the
 * way the prototype's file agent names it (`quo-messages-mockup.html` draft 9 on branch spike/gc-mode): "named by day,
 * sender and caption", as in *2026-10-02 Priya Raman · Ceiling tile op 3.jpg*. For now the caption is the words (the
 * owner's lean, 2026-10-13): the file's own name when a person gave it one, else the words of the line it came on, else
 * *Photo* and its place on the line. Claude reading the picture comes later.
 */
import { chicagoDay } from '../messages/thread'

/** The longest caption a name carries, cut on a word. */
export const PHOTO_CAPTION_MAX = 60

export interface PhotoNameInput {
  /** When the line arrived. The name carries Chicago's day. */
  at: string
  /** Who sent it: the person's name, else their number or address. */
  sender: string
  /** The file's own name as it came: *Ceiling tile.jpg*, *IMG_2041.HEIC*, *picture-1.jpg*. */
  fileName: string
  mime: string | null
  /** The words of the line it came on. */
  words: string
  /** Its place among the line's files, from 1. */
  place: number
}

const EXT_BY_MIME: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/pjpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/tiff': 'tif',
  'image/bmp': 'bmp',
  'application/pdf': 'pdf',
  'text/vcard': 'vcf',
  'text/x-vcard': 'vcf',
  'video/mp4': 'mp4',
  'video/3gpp': '3gp',
  'video/quicktime': 'mov',
  'audio/amr': 'amr',
}

/** A file's ending, without the dot: from its type, else from its own name, else none. */
export function extOf(mime: string | null, fileName = ''): string {
  const byMime = EXT_BY_MIME[(mime ?? '').toLowerCase().split(';')[0]!.trim()]
  if (byMime) return byMime
  return /\.([a-z0-9]{1,5})$/i.exec(fileName.trim())?.[1]?.toLowerCase() ?? ''
}

/** A name with its ending taken off. */
function stem(fileName: string): string {
  return fileName.trim().replace(/\.[a-z0-9]{1,5}$/i, '')
}

/**
 * A name a phone or an app made, which says nothing a person chose: *IMG_2041*, *PXL_20261002_141233*, *image0*,
 * *picture-1*, *Screenshot 2026-10-02 at 2.14.33 PM*, *WhatsApp Image 2026-10-02 at 14.12.33*, a long hex id.
 */
export function madeUpName(fileName: string): boolean {
  const s = stem(fileName).toLowerCase()
  if (/^[0-9a-f-]{16,}$/.test(s)) return true
  return /^(?:img|image|photo|picture|pic|dscn?|dscf|pxl|mvimg|gopr|dji|scan|screenshot|screen shot|whatsapp image|signal|attachment|file|untitled)?[\s_.-]*[\d\s_.:()-]*(?:at[\s\d_.:-]*(?:am|pm)?)?$/.test(s)
}

/** Drive takes almost any name, but a computer saving it may not: no slashes, colons, stars, quotes, commas or the like. */
export function driveSafe(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|,;#%{}~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.\s]+$/, '')
}

/** At most `max` characters, cut at the last whole word that fits. */
function cutOnWord(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max + 1)
  const space = cut.lastIndexOf(' ')
  return (space > 0 ? cut.slice(0, space) : text.slice(0, max)).replace(/[.\s]+$/, '')
}

/** The caption: the file's own name when a person gave it one, else the line's words, else *Photo* and its place. */
export function photoCaption(input: Pick<PhotoNameInput, 'fileName' | 'words' | 'place'>): string {
  if (!madeUpName(input.fileName)) {
    const own = cutOnWord(driveSafe(stem(input.fileName)), PHOTO_CAPTION_MAX)
    if (own) return own
  }
  const words = cutOnWord(driveSafe(input.words), PHOTO_CAPTION_MAX)
  return words || `Photo ${input.place}`
}

/**
 * The name in the job's Photos folder: *2026-10-02 Priya Raman · Ceiling tile op 3.jpg*. A name the folder already
 * holds (`taken`, any case) takes the next *(2)*, *(3)*, so two photos never share a name.
 */
export function photoDriveName(input: PhotoNameInput, taken: ReadonlySet<string> = new Set()): string {
  const sender = driveSafe(input.sender) || 'Someone'
  const base = `${chicagoDay(input.at)} ${sender} · ${photoCaption(input)}`
  const ext = extOf(input.mime, input.fileName)
  const withExt = (s: string) => (ext ? `${s}.${ext}` : s)
  const lower = new Set([...taken].map((t) => t.toLowerCase()))
  let name = withExt(base)
  for (let n = 2; lower.has(name.toLowerCase()); n++) name = withExt(`${base} (${n})`)
  return name
}
