/**
 * Messages, cut 7e: a file on the message as `messages-email` takes it (`_shared/messagesEmailFiles.ts`'s `EmailFileAsk`).
 * The one list's key says where the file lives (`jobFiles.ts`): `drive:<id>`, `plans:<set>` with its Drive folder,
 * `arrived:<id>`, `sent:<copy>:<path>` and `paper:<paper>:<id>`. A file from this computer or a photo carries its bytes.
 * How it goes is `outgoing.ts`'s `waysOut`; a link names their portal's page when `linkFor` would, so the function opens
 * their portal there. Pure.
 */
import { driveLink } from '../gc/drive'
import { portalHasPage, type JobFile, type PortalPage } from './jobFiles'
import type { Audience, FileWay, WayOut } from './outgoing'

export type EmailFileSource = 'drive' | 'arrived' | 'sent' | 'paper' | 'device'

export interface EmailFileAsk {
  key: string
  source: EmailFileSource
  ref: string
  path: string | null
  name: string
  mime: string
  way: WayOut
  page: PortalPage | null
  base64?: string
  landing?: 'sent' | 'photos'
}

/** A file from this computer or a photo: its bytes as base64 and its type. */
export interface DeviceBytes {
  base64: string
  mime: string
}

/**
 * The file as the function takes it, or null when the app cannot say where it lives: a plan set with no Drive folder,
 * or a file from this computer with no bytes read. `job` is the one list's row for a job's file.
 */
export function emailFileAsk(w: FileWay, ctx: { audience: Audience; hasPortal: boolean; job?: JobFile | null; device?: DeviceBytes | null }): EmailFileAsk | null {
  const f = w.file
  const portalPage = f.portalPage
  const page =
    w.way === 'link' && portalPage && ctx.hasPortal && (ctx.audience === 'trade' || ctx.audience === 'customer') && portalHasPage(ctx.audience, portalPage) ? portalPage : null
  const base = { key: f.key, name: f.name, way: w.way, page }

  if (f.from !== 'job') {
    if (!ctx.device?.base64) return null
    return { ...base, source: 'device', ref: '', path: null, mime: ctx.device.mime, base64: ctx.device.base64, landing: f.from === 'photo' ? 'photos' : 'sent' }
  }
  const [head, ...rest] = f.key.split(':')
  const tail = rest.join(':')
  if (head === 'drive' && tail) return { ...base, source: 'drive', ref: tail, path: null, mime: '' }
  if (head === 'plans') {
    const folder = ctx.job?.driveUrl ? driveLink(ctx.job.driveUrl) : null
    return folder ? { ...base, source: 'drive', ref: folder.id, path: null, mime: '' } : null
  }
  if (head === 'arrived' && tail) return { ...base, source: 'arrived', ref: tail, path: null, mime: '' }
  if (head === 'sent') {
    const at = tail.indexOf(':')
    return at > 0 ? { ...base, source: 'sent', ref: tail.slice(0, at), path: tail.slice(at + 1), mime: '' } : null
  }
  if (head === 'paper' && tail) return { ...base, source: 'paper', ref: tail, path: null, mime: '' }
  return null
}
