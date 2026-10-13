import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { fileHref, driveFileRouteId } from '../../../lib/files/fileRoute'
import { driveOf, fileNote, fileOpenHref, filedWords, sizeWords, type FileIcon, type LineFile } from '../../../lib/messages/lineFiles'
import { jobRefOf } from '../../../lib/messages/load'
import { cutOwnLink, loadOwnLinks, loadPortalOpensSince } from '../../../lib/messages/messagesIo'
import { canCut, opensList, sentChipWords, sentRowNote, sentWay, type OwnLinkState, type PortalOpens } from '../../../lib/messages/sentLineFiles'
import type { Contact } from '../../../lib/contacts/kernel'
import { formatErrorMessage } from '../../../utils/errorHandling'
import { Btn } from '../gcUi'
import { SaveToDrive, type SaveToDriveIo } from './SaveToDrive'

/**
 * Messages, cut 6's screens (email in): the files and links on a line, as the mock-up `email-in-mockups.html` draws them
 * (screens 1 to 3, on branch spike/gc-mode). The chips under a line's words, the line a filed paper leaves, and the
 * message window's Attachments with Open. A picture shows its badge, not a thumbnail: a thumbnail would fetch the whole
 * picture for each chip.
 */

const BADGE: Record<FileIcon, { word: string; background: string }> = {
  pdf: { word: 'PDF', background: '#c0392b' },
  image: { word: 'IMG', background: '#2a8f5a' },
  link: { word: '↗', background: '#1f5fbf' },
  file: { word: 'F', background: 'var(--text-slate-500)' },
}

export function FileBadge({ icon }: { icon: FileIcon }) {
  const badge = BADGE[icon]
  return (
    <span
      aria-hidden="true"
      style={{ width: 22, height: 22, borderRadius: 5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white', background: badge.background, flex: 'none' }}
    >
      {badge.word}
    </span>
  )
}

const chip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  maxWidth: '100%',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '4px 8px',
  fontSize: '0.75rem',
  background: 'var(--surface)',
  color: 'var(--text-base)',
  cursor: 'pointer',
  textAlign: 'left',
}

/** A line's chips. A press on one opens the message window, where Attachments has Open. */
export function LineFileChips({ files, onOpen }: { files: readonly LineFile[]; onOpen: () => void }) {
  return (
    <div data-line-files style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: '0.45rem' }}>
      {files.map((f) => {
        // A file on a line we sent says how it went (cut 7f); one that came in says its size.
        const size = sentChipWords(f) ?? (f.kept === 'link' ? 'a link' : sizeWords(f.size))
        return (
          <button key={f.id} type="button" onClick={onOpen} title={`${f.name}: ${fileNote(f)}. Open the message to open it.`} style={chip}>
            <FileBadge icon={f.icon} />
            <span style={{ overflowWrap: 'anywhere' }}>
              {f.name}
              {size && <span style={{ color: 'var(--text-muted)' }}> · {size}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** "✓ Filed as their certificate · Rosa, Oct 12", once for each paper the office filed from the line. */
export function FiledLines({ files, userNames }: { files: readonly LineFile[]; userNames: Readonly<Record<string, string>> }) {
  // Keyed by the file: two certificates filed from one email by one person on one day read the same.
  const filed = files.flatMap((f) => {
    const words = filedWords(f, userNames)
    return words ? [{ id: f.id, words }] : []
  })
  return (
    <>
      {filed.map(({ id, words }) => (
        <div key={id} data-line-filed style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: 'var(--text-green-700)' }}>
          ✓ {words}
        </div>
      ))}
    </>
  )
}

const openLink: CSSProperties = {
  padding: '0.3rem 0.7rem',
  borderRadius: 6,
  fontSize: '0.85rem',
  background: 'var(--surface)',
  color: 'var(--text-base)',
  border: '1px solid var(--border-strong)',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
}

/** Our own links' state and the cut, so a smoke hands in its own. */
export interface OwnLinksIo {
  load: (linkIds: readonly string[]) => Promise<Record<string, OwnLinkState>>
  cut: (linkId: string) => Promise<void>
  /** Their portal's opens since the line went, for a link to their portal. */
  portalOpens?: (who: Pick<Contact, 'kind' | 'gcCompanyId' | 'customerId'>, sinceIso: string) => Promise<PortalOpens | null>
}

// Read at the call, so a page whose smoke mocks messagesIo without these still loads this file.
const ownLinksIo: OwnLinksIo = { load: (ids) => loadOwnLinks(ids), cut: (id) => cutOwnLink(id), portalOpens: (who, since) => loadPortalOpensSince(who, since) }

/** Where Open goes on a file a line we sent carried: our copy, or the office's own page for a Drive file, never our public link. */
function sentOpenHref(f: LineFile, jobKey: string | null): string | null {
  const job = jobRefOf(jobKey)
  const { driveFileId } = driveOf(f)
  if (sentWay(f) === 'own' && driveFileId && job) return fileHref('drive', driveFileRouteId(job, driveFileId))
  return fileOpenHref(f)
}

/**
 * The message window's files. On a line that came in, its Attachments: each file with its size and where it is, Open
 * where it can be opened, and Save to Drive on our copy (cut 7f). On a line we sent, its Files (cut 7f, the mock-up
 * `files-out-mockups.html`, screen 6): each marked how it went, our own link with its opens, newest first and never who,
 * and Cut it off while it still opens.
 */
export function MessageFiles({
  files,
  jobKey = null,
  jobLabel = null,
  save,
  links = ownLinksIo,
  nowIso,
  who = null,
  sentAt = null,
}: {
  files: readonly LineFile[]
  /** The line's job, as the thread keys it, for Save to Drive and the office's own page. Null: on nobody's job. */
  jobKey?: string | null
  /** The job as the window names it, `B482`. */
  jobLabel?: string | null
  save?: SaveToDriveIo
  links?: OwnLinksIo
  /** The clock the opens are told against. */
  nowIso?: string
  /** The person the line went to, whose portal a link opens. */
  who?: Pick<Contact, 'kind' | 'gcCompanyId' | 'customerId'> | null
  /** When the line went, for their portal's opens since. */
  sentAt?: string | null
}) {
  const now = nowIso ?? new Date().toISOString()
  const sent = files.some((f) => sentWay(f) !== null)
  const ownIds = files.map((f) => (sentWay(f) === 'own' ? driveOf(f).driveLinkId : null)).filter((id): id is string => Boolean(id))
  const idsKey = ownIds.join(',')
  const [states, setStates] = useState<Record<string, OwnLinkState>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [cutting, setCutting] = useState<string | null>(null)
  const read = useCallback(() => {
    if (!idsKey) return
    links.load(idsKey.split(',')).then(setStates, (e: unknown) => setProblem(formatErrorMessage(e, 'Our links’ opens did not read.')))
  }, [idsKey, links])
  useEffect(read, [read])

  // A link to their portal says how often they opened their portal since the line went (cut 7f's follow-up).
  const hasPortalLink = files.some((f) => sentWay(f) === 'portal')
  const [portal, setPortal] = useState<PortalOpens | null>(null)
  // The person by their parts, since the contact object is new on every read of the thread.
  const whoKind = who?.kind ?? null
  const whoCompany = who?.gcCompanyId ?? null
  const whoCustomer = who?.customerId ?? null
  useEffect(() => {
    if (!hasPortalLink || !whoKind || !sentAt || !links.portalOpens) return
    let live = true
    links.portalOpens({ kind: whoKind, gcCompanyId: whoCompany, customerId: whoCustomer }, sentAt).then(
      (p) => live && setPortal(p),
      () => live && setPortal(null),
    )
    return () => {
      live = false
    }
  }, [hasPortalLink, whoKind, whoCompany, whoCustomer, sentAt, links])

  const cut = (linkId: string) => {
    setCutting(linkId)
    setProblem(null)
    links
      .cut(linkId)
      .then(read, (e: unknown) => setProblem(formatErrorMessage(e, 'The link was not cut off.')))
      .finally(() => setCutting(null))
  }

  return (
    <section data-message-files>
      <h3 style={{ margin: '0 0 0.3rem', fontSize: '0.9rem' }}>
        {sent ? 'Files' : 'Attachments'} ({files.length})
      </h3>
      {problem && <div style={{ color: 'var(--text-red-700)', fontSize: '0.82rem', marginBottom: '0.3rem' }}>{problem}</div>}
      {files.map((f) => {
        const way = sentWay(f)
        const linkId = driveOf(f).driveLinkId
        const state = linkId ? states[linkId] : undefined
        const href = way ? sentOpenHref(f, jobKey) : fileOpenHref(f)
        const note = way ? sentRowNote(f, state, now, portal) : [f.kept === 'link' ? '' : sizeWords(f.size), fileNote(f)].filter(Boolean).join(' · ')
        const opens = way === 'own' && state && canCut(f, state, now) ? opensList(state, now) : null
        return (
          <div key={f.id} data-message-file={f.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.4rem 0', borderTop: '1px solid var(--border)', fontSize: '0.85rem', flexWrap: 'wrap' }}>
            <FileBadge icon={f.icon} />
            <span style={{ flex: 1, minWidth: 180, overflowWrap: 'anywhere' }}>
              {f.name} <span style={{ color: 'var(--text-muted)' }}>· {note}</span>
              {opens && (
                <span data-link-opens style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {opens}
                </span>
              )}
            </span>
            {href && (
              <a href={href} target="_blank" rel="noopener noreferrer" style={openLink} aria-label={`Open ${f.name}`}>
                Open
              </a>
            )}
            {linkId && canCut(f, state, now) && (
              <Btn onClick={() => cut(linkId)} disabled={cutting === linkId} title="Our link opens nothing from now on. The file stays where it is.">
                Cut it off
              </Btn>
            )}
            {f.kept === 'copy' && !way && <SaveToDrive file={f} jobKey={jobKey} jobLabel={jobLabel} {...(save ? { save } : {})} />}
          </div>
        )
      })}
    </section>
  )
}
