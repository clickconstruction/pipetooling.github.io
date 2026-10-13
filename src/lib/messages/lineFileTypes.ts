/**
 * Messages, cut 6 (email in): a file or a link on a thread line, as `lineFiles.ts` reads it from a `message_attachments`
 * row. Types alone, so `thread.ts` and the edge kernel copy (`scripts/edge-kernels.mjs`) take them without
 * `lineFiles.ts`'s code. `lineFiles.ts` re-exports them.
 */
import type { PaperGuess } from '../emailIn/paperGuess'

/** Our copy, a file left in Gmail (too big, or not copied), or a link. */
export type FileKept = 'copy' | 'tooBig' | 'notCopied' | 'link'

export type FileIcon = 'pdf' | 'image' | 'link' | 'file'

export interface LineFile {
  id: string
  name: string
  mime: string | null
  size: number | null
  kept: FileKept
  /** A link's own address. */
  url: string | null
  icon: FileIcon
  paper: PaperGuess | null
  paperAnswer: 'filed' | 'not_it' | null
  paperAnsweredBy: string | null
  paperAnsweredAt: string | null
}
