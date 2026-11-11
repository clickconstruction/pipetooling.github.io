/**
 * The bid's Files window (punch list #306, PRs 5 and 7), behind the Bid Board's Links column. Five rows in the
 * column's own order: Photos, Project folder, Plans, CountTooling, Bid submission. The photos icon opens it on the
 * photos, which are the first row (`useBidPhotosPanel.tsx`, the Photos window's own rules and read). A grey icon
 * opens it on its row, with the photos folded away so nothing is read for them, and with the box for that link open.
 * A blue icon on the board never opens this window: it goes straight out, as it always did.
 *
 * A row the bid has offers **Open ↗** and **Change**. A row it does not have offers **Set the link**. Either opens a
 * box under the row: paste the link and **Save the link** writes the column the bid's form writes. The project
 * folder's box also offers **Make the project folder**, which the `bid-photos` function makes in the shared Drive.
 * The plans row's **Add a set** opens the form's own plan sets field (`BidPlanSetsField`). **Open Edit bid** in a box
 * is the door to the whole form. A training account reads the rows and is offered no change.
 *
 * The rows and the pasted link's rules are `lib/bids/bidFilesWindow.ts`; the writes are `lib/bids/bidFilesIo.ts`.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import * as S from '../jobMode/sheetStyles'
import { CameraGlyph } from '../materials/PhotoPress'
import { useAuth } from '../../hooks/useAuth'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { useToastContext } from '../../contexts/ToastContext'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { formatErrorMessage } from '../../utils/errorHandling'
import type { BidFormFocus } from '../../lib/bids/bidFormFocus'
import type { BidPhotosWindowIo } from '../../lib/bids/bidPhotosIo'
import { supabaseBidFilesIo, type BidFilesIo } from '../../lib/bids/bidFilesIo'
import {
  BID_FILES_WORDS,
  BID_FILE_LINK_LABEL,
  BID_FILE_LINK_PLACEHOLDER,
  BID_FILE_LINK_SAVED,
  filesWindowLabel,
  linkDraft,
  madeFolderWords,
  type BidFileKind,
  type BidFileRow,
  type PastedLinkKind,
} from '../../lib/bids/bidFilesWindow'
import { BidLinkGlyph } from './bidLinkGlyphs'
import { BidPlanSetsField } from './BidPlanSetsField'
import { useBidPhotosPanel, type BidPhotosWindowBid } from './useBidPhotosPanel'

type LinkKind = Exclude<BidFileKind, 'photos'>

/** What the bid holds today, for the boxes: the link each starts from, and what the plan sets field reads. */
export interface BidFilesLinks {
  driveLink: string | null
  countLink: string | null
  submissionLink: string | null
  /** The plans link the robot reads. */
  plansLink: string | null
  /** The plan set the price stands on, `bids.priced_on_set_id`. */
  pricedOnSetId: string | null
}

const sub: CSSProperties = { margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }
const rowBox: CSSProperties = { display: 'grid', gap: '0.6rem', padding: '0.7rem 0.75rem', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', minWidth: 0 }
const rowPressed: CSSProperties = { ...rowBox, borderColor: '#2563eb', boxShadow: '0 0 0 2px var(--bg-blue-tint)' }
const rowHead: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flexWrap: 'wrap' }
const iconBox: CSSProperties = { flex: 'none', width: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
const names: CSSProperties = { flex: '1 1 9rem', minWidth: 0, display: 'grid', gap: 1 }
const rowTitle: CSSProperties = { fontWeight: 700, color: 'var(--text-strong)', fontSize: '0.9375rem' }
const rowLine: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)', overflowWrap: 'anywhere' }
const smallBtn: CSSProperties = { minHeight: 36, padding: '0 0.8rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flex: 'none' }
const smallBlue: CSSProperties = { ...smallBtn, border: 'none', background: '#1d4ed8', color: 'white' }
const smallDead: CSSProperties = { ...smallBtn, border: 'none', background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'not-allowed' }
const openList: CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.4rem' }
const openItem: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0.55rem', borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border)' }
const editBox: CSSProperties = { display: 'grid', gap: '0.55rem', padding: '0.65rem 0.7rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-subtle)', minWidth: 0 }
const fieldLabel: CSSProperties = { display: 'grid', gap: 4, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)' }
const linkBox: CSSProperties = { flex: 1, minWidth: 0, minHeight: 40, padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-strong)', fontSize: '0.9375rem', fontFamily: 'inherit', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text-base)' }
const editFoot: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }
const quiet: CSSProperties = { padding: 0, border: 'none', background: 'transparent', color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, minHeight: 32, textAlign: 'left' }

const iconColor = (there: boolean): CSSProperties => ({ ...iconBox, color: there ? 'var(--text-blue-500)' : 'var(--text-faint)', opacity: there ? 1 : 0.7 })

export function BidFilesModal({
  bid,
  rows,
  links,
  startOn,
  onClose,
  onChanged,
  onFilesChanged,
  onEditBid,
  io,
  filesIo = supabaseBidFilesIo,
}: {
  bid: BidPhotosWindowBid
  /** The bid's five rows (`bidFileRows`), photos first. */
  rows: readonly BidFileRow[]
  links: BidFilesLinks
  /** The row whose icon was pressed: the photos open, or a link's row marked, brought into view and ready to set. */
  startOn: BidFileKind
  onClose: () => void
  /** A photo was added: the page reads the counts again. */
  onChanged?: () => void
  /** A link was set, a set of plans added, the folder made: the page reads the bid and its plan sets again. */
  onFilesChanged?: () => void
  /** Opens Edit bid landed on a field. The window closes first. */
  onEditBid: (focus: BidFormFocus) => void
  io?: BidPhotosWindowIo
  filesIo?: BidFilesIo
}) {
  const { readOnly } = useAuth()
  const { showToast } = useToastContext()
  const canEdit = !readOnly
  const [photosOpen, setPhotosOpen] = useState(startOn === 'photos')
  const panel = useBidPhotosPanel({ bid, onClose, onChanged, io, enabled: photosOpen, showLabel: false })
  const pressedRef = useRef<HTMLElement | null>(null)
  // A thumb needs 44 px; a desk keeps the rows short.
  const phone = useNarrowViewport640()
  const tall = (style: CSSProperties): CSSProperties => (phone ? { ...style, minHeight: 44 } : style)
  const plain = tall(smallBtn)
  const blue = tall(smallBlue)
  const dead = tall(smallDead)

  const startRow = rows.find((r) => r.kind === startOn)
  // A grey icon is a link to set: its box is open when the window is. Plans keep their field folded until asked.
  const [editing, setEditing] = useState<LinkKind | null>(() => (canEdit && startRow && startOn !== 'photos' && startOn !== 'plans' && !startRow.there ? startOn : null))
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState<'save' | 'make' | null>(null)
  const [error, setError] = useState<string | null>(null)

  // The plan sets field writes its own rows and has no word for the page. Opened once, the page reads again when
  // the field is put away and when the window closes, by whichever press.
  const plansTouched = useRef(false)
  const filesChangedRef = useRef(onFilesChanged)
  filesChangedRef.current = onFilesChanged
  useEffect(
    () => () => {
      if (plansTouched.current) filesChangedRef.current?.()
    },
    [],
  )

  useEffect(() => {
    if (startOn === 'photos') return
    try {
      pressedRef.current?.scrollIntoView({ block: 'center' })
    } catch {
      /* jsdom */
    }
  }, [startOn])

  const photos = rows.find((r) => r.kind === 'photos')
  const linkRows = rows.filter((r) => r.kind !== 'photos')
  const current: Record<PastedLinkKind, string | null> = { folder: links.driveLink, count: links.countLink, submission: links.submissionLink }

  const toEdit = (focus: BidFormFocus) => {
    panel.close()
    onEditBid(focus)
  }

  const openEditor = (kind: LinkKind) => {
    setError(null)
    setDraft(kind === 'plans' ? '' : (current[kind] ?? ''))
    if (kind === 'plans') plansTouched.current = true
    setEditing(kind)
  }

  const closeEditor = () => {
    if (editing === 'plans') onFilesChanged?.()
    setEditing(null)
    setError(null)
  }

  async function save(kind: PastedLinkKind) {
    const judged = linkDraft(kind, draft, current[kind])
    if (judged.dead || !judged.value || busy) return
    setBusy('save')
    setError(null)
    try {
      await filesIo.saveLink(bid.id, kind, judged.value)
      showToast(BID_FILE_LINK_SAVED[kind], 'success')
      setEditing(null)
      onFilesChanged?.()
    } catch (e) {
      setError(formatErrorMessage(e, 'The link did not save.'))
    } finally {
      setBusy(null)
    }
  }

  async function makeFolder() {
    if (busy) return
    setBusy('make')
    setError(null)
    try {
      const made = await filesIo.makeFolder(bid.id)
      showToast(madeFolderWords(made.projectName), 'success')
      setEditing(null)
      onFilesChanged?.()
    } catch (e) {
      setError(formatErrorMessage(e, 'The folder was not made.'))
    } finally {
      setBusy(null)
    }
  }

  async function paste() {
    try {
      setDraft((await navigator.clipboard.readText()).trim())
      setError(null)
    } catch {
      setError('The clipboard did not read. Paste with the keyboard.')
    }
  }

  /** The plan sets field named a set for the robot: the bid's plans link takes it, as the form's field does. */
  async function robotSet(link: string) {
    setError(null)
    try {
      await filesIo.savePlansLink(bid.id, link)
      onFilesChanged?.()
    } catch (e) {
      setError(formatErrorMessage(e, 'The plans link did not save.'))
    }
  }

  const closeFoot = (
    <div style={{ ...S.footerRow, justifyContent: 'flex-end' }}>
      <button type="button" style={S.secondaryBtn} onClick={panel.close}>
        {BID_FILES_WORDS.close}
      </button>
    </div>
  )

  return (
    <ResponsiveModalShell title={panel.viewing ? panel.title : BID_FILES_WORDS.title} onRequestClose={panel.close} footer={photosOpen ? panel.footer : closeFoot} maxWidthDesktop={760} fullScreenKey="bid-files">
      {panel.viewing ? (
        panel.body
      ) : (
        <div data-bid-files-window={bid.id} role="group" aria-label={filesWindowLabel(bid.label)} style={{ display: 'grid', gap: '0.6rem' }}>
          <p style={sub}>{bid.label}</p>
          {canEdit ? null : <p style={{ ...sub, fontSize: '0.8125rem' }}>{BID_FILES_WORDS.trainingWhy}</p>}

          {photos ? (
            <section style={rowBox} data-bid-file-row="photos" data-there={photos.there ? 'yes' : 'no'} aria-label={photos.title}>
              <div style={rowHead}>
                <span style={iconColor(photos.there)}>
                  <CameraGlyph size={22} />
                </span>
                <span style={names}>
                  <span style={rowTitle}>{photos.title}</span>
                  {/* Open, the photos say their own count over the grid. */}
                  {photos.line && !photosOpen ? <span style={rowLine}>{photos.line}</span> : null}
                </span>
                {photosOpen ? null : (
                  <button type="button" style={photos.there ? plain : blue} onClick={() => setPhotosOpen(true)} data-bid-files-photos-open="">
                    {photos.there ? BID_FILES_WORDS.showPhotos : BID_FILES_WORDS.addPhotos}
                  </button>
                )}
              </div>
              {photosOpen ? panel.body : null}
            </section>
          ) : null}

          {linkRows.map((row) => {
            const kind = row.kind as LinkKind
            const pressed = startOn === row.kind
            const only = row.opens.length === 1 ? row.opens[0]! : null
            const open = editing === kind
            const judged = open && kind !== 'plans' ? linkDraft(kind, draft, current[kind]) : null
            const setLabel = kind === 'plans' ? BID_FILES_WORDS.addSet : row.there ? BID_FILES_WORDS.change : BID_FILES_WORDS.setLink
            return (
              <section
                key={row.kind}
                ref={pressed ? (el) => { pressedRef.current = el } : undefined}
                style={pressed ? rowPressed : rowBox}
                data-bid-file-row={row.kind}
                data-there={row.there ? 'yes' : 'no'}
                data-pressed={pressed ? 'yes' : undefined}
                aria-label={row.title}
              >
                <div style={rowHead}>
                  <span style={iconColor(row.there)}>
                    <BidLinkGlyph kind={kind} size={22} />
                  </span>
                  <span style={names}>
                    <span style={rowTitle}>{row.title}</span>
                    <span style={rowLine}>{row.line}</span>
                  </span>
                  {canEdit && !open ? (
                    <button type="button" style={pressed && !row.there ? blue : plain} onClick={() => openEditor(kind)} data-bid-file-set={row.kind}>
                      {setLabel}
                    </button>
                  ) : null}
                  {only ? (
                    <button type="button" style={plain} title={only.href} onClick={() => openInExternalBrowser(only.href)}>
                      {BID_FILES_WORDS.open}
                    </button>
                  ) : null}
                </div>

                {row.opens.length > 1 && !(open && kind === 'plans') ? (
                  <ul style={openList}>
                    {row.opens.map((o) => (
                      <li key={o.href} style={openItem} data-bid-file-open={row.kind}>
                        <span style={{ flex: 1, minWidth: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-strong)', overflowWrap: 'anywhere' }}>{o.name}</span>
                        <button type="button" style={plain} title={o.href} onClick={() => openInExternalBrowser(o.href)}>
                          {BID_FILES_WORDS.open}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {open && kind === 'plans' ? (
                  <div style={editBox} data-bid-file-edit="plans">
                    <BidPlanSetsField bidId={bid.id} plansLink={links.plansLink ?? ''} onRobotSetChange={(link) => void robotSet(link)} pricedOnSetId={links.pricedOnSetId} host="window" />
                    {error ? (
                      <p style={{ ...S.warn, margin: 0 }} role="alert">
                        {error}
                      </p>
                    ) : null}
                    <div style={editFoot}>
                      {row.focus ? (
                        <button type="button" style={quiet} onClick={() => toEdit(row.focus as BidFormFocus)}>
                          {BID_FILES_WORDS.openEditBid}
                        </button>
                      ) : null}
                      <span style={{ flex: 1 }} />
                      <button type="button" style={plain} onClick={closeEditor}>
                        {BID_FILES_WORDS.done}
                      </button>
                    </div>
                  </div>
                ) : null}

                {open && kind !== 'plans' && judged ? (
                  <form
                    style={editBox}
                    data-bid-file-edit={kind}
                    onSubmit={(e) => {
                      e.preventDefault()
                      void save(kind)
                    }}
                  >
                    <label style={fieldLabel}>
                      {BID_FILE_LINK_LABEL[kind]}
                      <span style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', minWidth: 0 }}>
                        <input type="url" inputMode="url" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={BID_FILE_LINK_PLACEHOLDER[kind]} style={linkBox} data-bid-file-link={kind} />
                        <button type="button" style={plain} onClick={() => void paste()}>
                          {BID_FILES_WORDS.paste}
                        </button>
                      </span>
                    </label>
                    {judged.why || judged.note ? <p style={{ ...sub, fontSize: '0.8125rem', color: 'var(--text-amber-800)' }}>{judged.why ?? judged.note}</p> : null}
                    {error ? (
                      <p style={{ ...S.warn, margin: 0 }} role="alert">
                        {error}
                      </p>
                    ) : null}
                    {kind === 'folder' && !row.there ? (
                      <div style={{ ...editFoot, justifyContent: 'space-between' }} data-bid-file-make="">
                        <span style={{ ...sub, fontSize: '0.8125rem', flex: '1 1 12rem' }}>{BID_FILES_WORDS.makeFolderWhy}</span>
                        <button type="button" style={busy ? dead : plain} disabled={busy != null} onClick={() => void makeFolder()}>
                          {busy === 'make' ? BID_FILES_WORDS.making : BID_FILES_WORDS.makeFolder}
                        </button>
                      </div>
                    ) : null}
                    <div style={editFoot}>
                      {row.focus ? (
                        <button type="button" style={quiet} onClick={() => toEdit(row.focus as BidFormFocus)}>
                          {BID_FILES_WORDS.openEditBid}
                        </button>
                      ) : null}
                      <span style={{ flex: 1 }} />
                      <button type="button" style={plain} onClick={closeEditor}>
                        {BID_FILES_WORDS.cancel}
                      </button>
                      <button type="submit" style={judged.dead || busy ? dead : blue} disabled={judged.dead || busy != null} data-bid-file-save={judged.dead || busy ? 'dead' : 'live'}>
                        {busy === 'save' ? BID_FILES_WORDS.saving : BID_FILES_WORDS.saveLink}
                      </button>
                    </div>
                  </form>
                ) : null}
              </section>
            )
          })}
        </div>
      )}
    </ResponsiveModalShell>
  )
}

export default BidFilesModal
