/**
 * GC mode, the real build, PR 1b: a set's Google Drive link, moved word for word from the GC mode
 * prototype (branch spike/gc-mode, `gcNewProject.ts`; the owner, 2026-10-04: "I want to always have
 * it go to a Google Drive link"). What a link points at, and what stops one. The sharing check
 * itself is the `gc-drive-access` function (PR 5 of the plan); the prototype's stand-in stays there.
 */

/** A Google Drive file or folder link, read: what it points at and its id. Null: not a Drive link. */
export function driveLink(url: string): { kind: 'file' | 'folder'; id: string } | null {
  const u = url.trim().replace(/^(?!https?:\/\/)(?=drive\.google\.com)/, 'https://')
  const file = u.match(/^https?:\/\/drive\.google\.com\/(?:u\/\d+\/)?file\/d\/([\w-]{10,})/) ?? u.match(/^https?:\/\/drive\.google\.com\/open\?id=([\w-]{10,})/)
  if (file?.[1]) return { kind: 'file', id: file[1] }
  const folder = u.match(/^https?:\/\/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([\w-]{10,})/)
  if (folder?.[1]) return { kind: 'folder', id: folder[1] }
  return null
}

/**
 * What stops a set's Drive link, for a window's footer. Null: the link is fine. A link only some
 * people can open is a warning, not a stop (the owner, 2026-10-04: "When the link is blocked and our
 * helper cannot see the link without an account, we should give a warning.").
 */
export function driveLinkProblem(url: string): string | null {
  if (url.trim() === '') return 'Add the Google Drive link to the plans.'
  if (!driveLink(url)) return 'The plans link is not a Google Drive link.'
  return null
}
