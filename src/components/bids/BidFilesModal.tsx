/**
 * The bid's Files window (punch list #306, PR 5), behind the Bid Board's Links column. Five rows in the column's own
 * order: Photos, Project folder, Plans, CountTooling, Bid submission. The photos icon opens it on the photos, which
 * are the first row (`useBidPhotosPanel`, the Photos window's own rules and read, `useBidPhotosPanel.tsx`). A grey icon opens it on its row,
 * with the photos folded away so nothing is read for them. A row the bid has offers **Open ↗**. A row it does not
 * have says what sets it and opens Edit bid landed on that field. A blue icon on the board never opens this window:
 * it goes straight out, as it always did.
 *
 * The rows are `lib/bids/bidFilesWindow.ts`.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import * as S from '../jobMode/sheetStyles'
import { CameraGlyph } from '../materials/PhotoPress'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import type { BidFormFocus } from '../../lib/bids/bidFormFocus'
import type { BidPhotosWindowIo } from '../../lib/bids/bidPhotosIo'
import { BID_FILES_WORDS, filesWindowLabel, missingRowWords, type BidFileKind, type BidFileRow } from '../../lib/bids/bidFilesWindow'
import { BidLinkGlyph } from './bidLinkGlyphs'
import { useBidPhotosPanel, type BidPhotosWindowBid } from './useBidPhotosPanel'

const sub: CSSProperties = { margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }
const rowBox: CSSProperties = { display: 'grid', gap: '0.6rem', padding: '0.7rem 0.75rem', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)' }
const rowPressed: CSSProperties = { ...rowBox, borderColor: '#2563eb', boxShadow: '0 0 0 2px var(--bg-blue-tint)' }
const rowHead: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flexWrap: 'wrap' }
const iconBox: CSSProperties = { flex: 'none', width: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
const names: CSSProperties = { flex: '1 1 9rem', minWidth: 0, display: 'grid', gap: 1 }
const rowTitle: CSSProperties = { fontWeight: 700, color: 'var(--text-strong)', fontSize: '0.9375rem' }
const rowLine: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)', overflowWrap: 'anywhere' }
const smallBtn: CSSProperties = { minHeight: 36, padding: '0 0.8rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flex: 'none' }
const smallBlue: CSSProperties = { ...smallBtn, border: 'none', background: '#1d4ed8', color: 'white' }
const openList: CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.4rem' }
const openItem: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0.55rem', borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border)' }

const iconColor = (there: boolean): CSSProperties => ({ ...iconBox, color: there ? 'var(--text-blue-500)' : 'var(--text-faint)', opacity: there ? 1 : 0.7 })

export function BidFilesModal({
  bid,
  rows,
  startOn,
  onClose,
  onChanged,
  onEditBid,
  io,
}: {
  bid: BidPhotosWindowBid
  /** The bid's five rows (`bidFileRows`), photos first. */
  rows: readonly BidFileRow[]
  /** The row whose icon was pressed: the photos open, or a link's row marked and brought into view. */
  startOn: BidFileKind
  onClose: () => void
  /** A photo was added: the page reads the counts again. */
  onChanged?: () => void
  /** Opens Edit bid landed on a field. The window closes first. */
  onEditBid: (focus: BidFormFocus) => void
  io?: BidPhotosWindowIo
}) {
  const [photosOpen, setPhotosOpen] = useState(startOn === 'photos')
  const panel = useBidPhotosPanel({ bid, onClose, onChanged, io, enabled: photosOpen, showLabel: false })
  const pressedRef = useRef<HTMLElement | null>(null)
  // A thumb needs 44 px; a desk keeps the rows short.
  const phone = useNarrowViewport640()
  const plain: CSSProperties = phone ? { ...smallBtn, minHeight: 44 } : smallBtn
  const blue: CSSProperties = phone ? { ...smallBlue, minHeight: 44 } : smallBlue

  useEffect(() => {
    if (startOn === 'photos') return
    try {
      pressedRef.current?.scrollIntoView({ block: 'center' })
    } catch {
      /* jsdom */
    }
  }, [startOn])

  const photos = rows.find((r) => r.kind === 'photos')
  const links = rows.filter((r) => r.kind !== 'photos')

  const toEdit = (focus: BidFormFocus) => {
    panel.close()
    onEditBid(focus)
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

          {links.map((row) => {
            const kind = row.kind as Exclude<BidFileKind, 'photos'>
            const pressed = startOn === row.kind
            const only = row.opens.length === 1 ? row.opens[0]! : null
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
                  {only ? (
                    <button type="button" style={plain} title={only.href} onClick={() => openInExternalBrowser(only.href)}>
                      {BID_FILES_WORDS.open}
                    </button>
                  ) : null}
                  {row.focus ? (
                    <button type="button" style={pressed ? blue : plain} onClick={() => toEdit(row.focus as BidFormFocus)} data-bid-file-set={row.kind}>
                      {BID_FILES_WORDS.setOnBid}
                    </button>
                  ) : null}
                </div>
                {row.focus ? <p style={{ ...sub, fontSize: '0.8125rem' }}>{missingRowWords(kind)}</p> : null}
                {row.opens.length > 1 ? (
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
              </section>
            )
          })}
        </div>
      )}
    </ResponsiveModalShell>
  )
}

export default BidFilesModal
