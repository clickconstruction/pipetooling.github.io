/**
 * A walked builder's link (punch list #404, step 8): what the page at `/d/<code>` draws when a link opened a builder,
 * and the words of the link's card on the builder's editor. Whoever holds the link walks the published revision,
 * page by page, and only looks: nothing they pick is saved or sent.
 *
 * The edge function answers a builder as `{ kind: 'builder', builder, revision, contents }`, the published copy and
 * never a draft. Only its shape is checked here (`parsePaperDef`): a paper that was published must still open for
 * the person holding its link when a rule of the paper is tightened later. A builder whose contents are not a paper
 * to walk, a filled one say, is not drawn at all.
 *
 * Pure: no React, no supabase, no clock.
 */
import { parsePaperDef } from './definition'
import type { PaperDef } from './documentBuilder'

/** What someone outside reads as a builder's name. *Sub NDA* is the office's own word for it. */
const OUTSIDE_NAMES: Record<string, string> = { 'sub-nda': 'Secrecy on your jobs' }

export const WALKED_LINK_WORDS = {
  /** The name of a walked builder the page has no outside name for. */
  name: 'A paper to walk',
  /** Under the flow, on the page a link opens. */
  lookOnly: 'This page is a look at the paper. Nothing you pick here is saved or sent.',
  /** Under the last step, where the editor's flow has its press. */
  lastStep: 'That is the whole paper. Press Back to look at a page again.',
} as const

export type WalkedLinkPage = {
  /** The page's heading, in the words of someone outside. */
  name: string
  /** *Revision 3*, beside the heading. */
  stamp: string
  def: PaperDef
}

/** A link's builder as a paper to walk, or null when what it holds is not shaped like one. */
export function walkedLinkPage(view: { builder: string; revision: number; contents: unknown }): WalkedLinkPage | null {
  const parsed = parsePaperDef(view.contents)
  if (!parsed.ok) return null
  return { name: OUTSIDE_NAMES[view.builder] ?? WALKED_LINK_WORDS.name, stamp: `Revision ${view.revision}`, def: parsed.def }
}

export type BuilderLinkCardWords = { title: string; notPublished: string; on: string; off: string }

/** The words of a walked builder's link card. `revision` is the published one, 0 before the first publish. */
export function walkedLinkCardWords(revision: number): BuilderLinkCardWords {
  return {
    title: "This builder's link",
    notPublished: 'Publish a revision first. A link then opens it.',
    on: `Anyone with the link walks revision ${revision}, page by page. They only look. Nothing they pick is saved or sent. A revision you publish later shows on the same link.`,
    off: 'The link is off. Nobody can open this builder by link.',
  }
}
