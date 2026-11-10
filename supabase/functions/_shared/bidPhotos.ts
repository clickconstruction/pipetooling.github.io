/**
 * Bid photos (punch list #306): the rules the `bid-photos` function and the `photo-save` sweep share, pure, so the
 * app's tests read them as the functions do. A photo added to a bid waits in the `bid-photos` bucket with a row in
 * `bid_photos`; the sweep files it into the bid's project folder under Team only › Photos, the place a picture saved
 * from a text onto a bid already lands (`landingPath('photos')`, `_shared/driveLink.ts`). A bid with no project folder
 * gets one made in the jobs root, named by the office's bid pattern, the way `drive-intake` makes it. A picture found in
 * the photo folder with no row (dragged in through Drive, saved from a text) is adopted as a row, so the board counts it.
 *
 * No imports, so the app's tests import it as the functions do.
 */

/** The private bucket a bid photo waits in, as `<bid_id>/<photo_id>.jpg`. */
export const BID_PHOTOS_BUCKET = 'bid-photos'

/** Where a bid's photos land inside its project folder. The same path a text's photo takes. */
export const BID_PHOTO_FOLDER_PATH = ['Team only', 'Photos'] as const

/** The path as people read it: *Team only › Photos*. */
export const BID_PHOTO_FOLDER_WORDS = BID_PHOTO_FOLDER_PATH.join(' › ')

/** The sweep leaves a photo it could not file alone this long, then tries again. The cron's clause holds the same hour. */
export const BID_PHOTO_RETRY_MS = 60 * 60 * 1000

/** Rows the sweep takes in one run. */
export const BID_PHOTO_BATCH = 20

/** The caption an unnamed bid photo's Drive file takes after its day and sender. */
export const BID_PHOTO_PLAIN_CAPTION = 'Bid photo'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DRIVE_ID = /^[A-Za-z0-9_-]{10,200}$/

/** What the function is asked. `make` writes to Drive and to the bid; the others read. */
export type BidPhotosAsk =
  | { action: 'list'; bidId: string }
  | { action: 'make'; bidId: string }
  | { action: 'thumb' | 'full'; bidId: string; fileId: string }

/** The request body as an ask, or null when it is not one this door takes. */
export function parseBidPhotosAsk(body: unknown): BidPhotosAsk | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  const bidId = typeof b.bid_id === 'string' && UUID.test(b.bid_id) ? b.bid_id.toLowerCase() : null
  if (!bidId) return null
  if (b.action === 'list' || b.action === 'make') return { action: b.action, bidId }
  if (b.action === 'thumb' || b.action === 'full') {
    const fileId = typeof b.file_id === 'string' && DRIVE_ID.test(b.file_id) ? b.file_id : null
    return fileId ? { action: b.action, bidId, fileId } : null
  }
  return null
}

/** Whether the ask changes anything. A training account and a twin are refused these and answered the rest. */
export function bidPhotosAskWrites(ask: BidPhotosAsk): boolean {
  return ask.action === 'make'
}

/** A name Drive takes: no slashes or control characters, single spaces, no dot at either end, 150 characters at most. */
export function driveSafeName(raw: string): string {
  return raw
    .replace(/[\\/\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '')
    .trim()
    .slice(0, 150)
    .trim()
}

/** A file name without its ending: *Riser at C4.jpg* → *Riser at C4*. A name with no ending is itself. */
export function fileStem(name: string): string {
  const m = /^(.*\S)\.[A-Za-z0-9]{1,5}$/.exec(name.trim())
  return m ? m[1]! : name.trim()
}

/** The ending for a picture's type: jpg, png, webp, heic, gif; jpg when the type says nothing. */
export function photoExt(mime: string | null | undefined): string {
  const m = (mime ?? '').toLowerCase()
  if (m.includes('png')) return 'png'
  if (m.includes('webp')) return 'webp'
  if (m.includes('heic') || m.includes('heif')) return 'heic'
  if (m.includes('gif')) return 'gif'
  return 'jpg'
}

/**
 * The Drive file name of a photo a person named: the name and the picture's ending, *Mechanical room north.jpg*. A name
 * the folder already holds (`taken`, any case) takes the next *(2)*, *(3)*. Null when the row has no name; the sweep
 * then names the file by day and sender, as a text's photo is named.
 */
export function namedPhotoFileName(name: string, mime: string | null | undefined, taken: ReadonlySet<string> = new Set()): string | null {
  const stem = driveSafeName(fileStem(name))
  if (!stem) return null
  const ext = photoExt(mime)
  const lower = new Set([...taken].map((t) => t.toLowerCase()))
  let out = `${stem}.${ext}`
  for (let n = 2; lower.has(out.toLowerCase()); n++) out = `${stem} (${n}).${ext}`
  return out
}

/** A picture as Drive lists it in the bid's photo folder. */
export interface ListedBidPhoto {
  id: string
  name: string
  mime: string | null
  bytes: number | null
  /** When Drive first held it. */
  created: string | null
  /** Who put it there, as Drive names them, or null (the app itself, or nobody Drive names). */
  by: string | null
}

/** A row the function adopts for a picture the folder holds and the table does not. */
export interface AdoptedBidPhoto {
  bid_id: string
  name: string
  by_name: string
  taken_at: string
  added_at: string
  filed_at: string
  bytes: number
  drive_file_id: string
}

/** The person a picture is adopted under: Drive's name for them; an address is not a name, so it reads as nobody. */
export function adoptedByName(by: string | null | undefined): string {
  const name = (by ?? '').trim()
  return name.includes('@') ? '' : name.slice(0, 120)
}

/**
 * The rows to adopt: every picture in the folder whose Drive id no row of the bid carries. It reads as added and
 * filed at the moment Drive first held it, under the name Drive shows without its ending, by whoever Drive names.
 * `known` holds the Drive ids of the bid's rows, the removed ones too, so a photo removed in the app and restored
 * from Drive's trash by hand does not come back as a second row.
 */
export function strayPhotoRows(bidId: string, listed: readonly ListedBidPhoto[], known: ReadonlySet<string>, nowIso: string): AdoptedBidPhoto[] {
  const out: AdoptedBidPhoto[] = []
  const seen = new Set<string>()
  for (const f of listed) {
    if (known.has(f.id) || seen.has(f.id)) continue
    seen.add(f.id)
    const at = f.created && !Number.isNaN(Date.parse(f.created)) ? new Date(f.created).toISOString() : nowIso
    out.push({
      bid_id: bidId,
      name: driveSafeName(fileStem(f.name)).slice(0, 200),
      by_name: adoptedByName(f.by),
      taken_at: at,
      added_at: at,
      filed_at: at,
      bytes: f.bytes != null && Number.isFinite(f.bytes) && f.bytes >= 0 ? Math.min(Math.round(f.bytes), 2147483647) : 0,
      drive_file_id: f.id,
    })
  }
  return out
}

/** What the app saw when it looked at a bid's project folder, the write check's kinds (`WriteCheckSeen`). */
export type BidFolderSeen = 'ok' | 'outside_drive' | 'cannot_open' | 'cannot_write' | 'not_a_folder'

/**
 * Why a bid's photos are not in Drive yet, in the app's words, or null when the app can file there. `canActAsPerson`
 * is true when the app may file as a Workspace person (`DRIVE_IMPERSONATE_USER`), which is how a file reaches a folder
 * in a personal Drive. Every reason ends by saying the photo is safe.
 */
export function bidFolderHoldWords(seen: BidFolderSeen, appEmail: string, owner: string | null, canActAsPerson: boolean): string | null {
  const safe = 'The photos are safe in the app and file themselves once it is fixed.'
  switch (seen) {
    case 'ok':
      return null
    case 'outside_drive': {
      if (canActAsPerson) return null
      const whose = owner ? `${owner}’s My Drive` : 'a personal Drive'
      return `This bid’s project folder is in ${whose}, where the app can make folders but cannot save a file. Move the folder into the company’s shared Drive. ${safe}`
    }
    case 'cannot_open':
      return `The app cannot open this bid’s project folder. Share it with ${appEmail} as an editor. ${safe}`
    case 'cannot_write':
      return `The app can open this bid’s project folder but cannot add to it. Share it with ${appEmail} as an editor. ${safe}`
    case 'not_a_folder':
      return `This bid’s project folder link is not a Drive folder. Fix it on the bid, under Files & links. ${safe}`
  }
}

/** The words when the bid's Project Folder field holds something that is not a Drive folder link. */
export const BID_LINK_NOT_A_FOLDER_WORDS = bidFolderHoldWords('not_a_folder', '', null, false)!

/** Drive's quota refusal, which is how a folder in a personal Drive answers an upload. */
export function isQuotaRefusal(raw: string): boolean {
  return /storage quota/i.test(raw)
}

/**
 * The sweep's reason for one photo it could not file, in the app's words: Drive's quota refusal reads as the folder
 * being in a personal Drive; anything else is Drive's own sentence, cut to the column's 300 characters.
 */
export function bidPhotoFailWords(raw: string): string {
  return (isQuotaRefusal(raw) ? bidFolderHoldWords('outside_drive', '', null, false)! : raw).slice(0, 300)
}

/** Whether a row that failed is due another try: never tried, or tried an hour or more ago. */
export function bidPhotoDueATry(triedAt: string | null | undefined, nowMs: number): boolean {
  if (!triedAt) return true
  const t = Date.parse(triedAt)
  return Number.isNaN(t) || nowMs - t >= BID_PHOTO_RETRY_MS
}

/** The bid's folders as the window reads them: nothing yet, the project folder alone, or the photo folder ready. */
export interface BidPhotoFolderState {
  /** `none`: the bid has no project folder. `project`: it has one, the photo folder is not made. `ready`: both exist. */
  kind: 'none' | 'project' | 'ready'
  /** The project folder's name: Drive's when it exists, the name it will be made under when it does not. */
  projectName: string
  projectUrl: string | null
  photosUrl: string | null
  /** Why photos are not filing, or null. Set with any kind but `none`. */
  hold: string | null
}

/** The line that names where a bid's photos go: *Quarry Road Storage Bunker › Team only › Photos*. */
export function bidPhotoPathWords(projectName: string): string {
  return `${projectName} › ${BID_PHOTO_FOLDER_WORDS}`
}
