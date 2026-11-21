/**
 * The link of a published sheet or builder, on the Document builder tab (punch list #404, steps 4 and 8): a second
 * way in, for someone with no page of their own. A dev switches it on, copies it, makes a new one or switches it off.
 * A new link stops the old one, and the page asks before it does.
 *
 * The database keeps only the hash of the link's code. The edge function makes the code again for a dev who asks,
 * so the link reads the same here on any day and on any device.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import type { Landed } from '../../lib/documentBuilder/documentBuildersIo'
import { DOCUMENT_BUILDER_LINK_ADDRESS_LOST, documentBuilderLinkOffWords, documentBuilderLinkOpenWords, documentBuilderLinkUrl, type DocumentBuilderLinkOpen, type DocumentBuilderLinkState } from '../../lib/documentBuilder/link'
import { endBuilderLink, makeBuilderLink, readBuilderLink } from '../../lib/documentBuilder/linkIo'
import { plural } from '../../lib/documentBuilder/sheet'
import { formatDenverCalendarDayShort, formatDenverDateTimeShort } from '../../utils/dateUtils'
import { ValueLine, ValueLines, WorkedOutValue } from '../valuesInPlace/ValuesInPlace'

export type BuilderLinkCardIo = {
  read: typeof readBuilderLink
  make: typeof makeBuilderLink
  end: typeof endBuilderLink
  /** Puts the link on the clipboard. False when the browser refuses. */
  copy: (text: string) => Promise<boolean>
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export const BUILDER_LINK_CARD_IO: BuilderLinkCardIo = { read: readBuilderLink, make: makeBuilderLink, end: endBuilderLink, copy: copyToClipboard }

type Props = {
  builderKey: string
  /** The job's sheet the link opens. Null for a link to the builder itself. */
  sheetId: string | null
  /** False while nothing is published: a link opens only what is published. */
  published: boolean
  /** The card's title and what a link opens, in the builder's own words. */
  words: { title: string; notPublished: string; on: string; off: string }
  /** A number that goes up when something outside the card may have moved the link: the card reads it again. */
  refresh?: number
  io?: BuilderLinkCardIo
}

const CARD: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', display: 'grid', gap: 10, minWidth: 0 }
const CARD_TITLE: CSSProperties = { margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-strong)' }
const MUTED: CSSProperties = { margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }
const REFUSAL: CSSProperties = { margin: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-red-700)' }
const URL_BOX: CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.8rem', lineHeight: 1.4, background: 'var(--bg-muted)', borderRadius: 8, padding: '8px 10px', overflowWrap: 'anywhere', color: 'var(--text-700)' }
const SECOND_PRESS: CSSProperties = { border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 9, padding: '7px 12px', fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 600, minHeight: 38, cursor: 'pointer' }
const SMALL_PRESS: CSSProperties = { border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-link)', borderRadius: 8, padding: '3px 10px', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 600, minHeight: 32, cursor: 'pointer' }
const OK_CHIP: CSSProperties = { display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '1px 8px', fontSize: '0.72rem', fontWeight: 600, background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' }
const BTNS: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }

/**
 * Who opened the link, newest first: when, who, and what is known of them. A person with an account is named.
 * Someone with no account is shown by where the open came from and their browser.
 */
function LinkOpens({ opens, total }: { opens: ReadonlyArray<DocumentBuilderLinkOpen>; total: number }) {
  if (opens.length === 0) return null
  return (
    <div style={{ display: 'grid', gap: 6, minWidth: 0 }} data-testid="builder-link-opens">
      <p style={{ ...MUTED, fontWeight: 600, color: 'var(--text-strong)' }}>
        Who opened it: <WorkedOutValue>{total}</WorkedOutValue>
        {total > opens.length ? ` in all, the newest ${opens.length} below` : ''}
      </p>
      <ValueLines>
        {opens.map((open, i) => {
          const said = documentBuilderLinkOpenWords(open)
          return (
            <ValueLine key={`${open.at}-${i}`} label={formatDenverDateTimeShort(Date.parse(open.at))}>
              <WorkedOutValue>{said.who}</WorkedOutValue>
              {said.detail ? <span style={{ color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>{` · ${said.detail}`}</span> : null}
            </ValueLine>
          )
        })}
      </ValueLines>
    </div>
  )
}

export function BuilderLinkCard({ builderKey, sheetId, published, words, refresh = 0, io = BUILDER_LINK_CARD_IO }: Props) {
  const confirmDialog = useConfirmDialog()
  const [link, setLink] = useState<DocumentBuilderLinkState | null>(null)
  const [refusal, setRefusal] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!published) {
      setLink(null)
      return
    }
    let cancelled = false
    setRefusal(null)
    setCopied(false)
    void io.read(builderKey, sheetId).then((res) => {
      if (cancelled) return
      if (res.ok) setLink(res.value)
      else setRefusal(res.error)
    })
    return () => {
      cancelled = true
    }
  }, [io, builderKey, sheetId, published, refresh])

  const run = async (act: () => Promise<Landed<DocumentBuilderLinkState>>) => {
    if (busy) return
    setBusy(true)
    setRefusal(null)
    setCopied(false)
    const res = await act()
    setBusy(false)
    if (res.ok) setLink(res.value)
    else setRefusal(res.error)
  }
  const makeNew = async () => {
    if (!(await confirmDialog({ title: 'Make a new link', message: 'The link you have now stops working. Anyone you gave it to needs the new one.', confirmLabel: 'Make a new link', cancelLabel: 'Keep this link' }))) return
    await run(() => io.make(builderKey, sheetId))
  }
  const switchOff = async () => {
    if (!(await confirmDialog({ title: 'Switch the link off', message: 'Nobody can open this by link until you switch it on again. Switching it on makes a new link.', confirmLabel: 'Switch the link off', cancelLabel: 'Keep it on', danger: true }))) return
    await run(() => io.end(builderKey, sheetId))
  }

  const url = link?.on && link.code ? documentBuilderLinkUrl(window.location.origin, link.code) : ''
  return (
    <div style={CARD}>
      <h3 style={CARD_TITLE}>{words.title}</h3>
      {!published ? (
        <p style={MUTED}>{words.notPublished}</p>
      ) : link == null ? (
        refusal ? null : (
          <p style={MUTED}>Reading the link…</p>
        )
      ) : link.on ? (
        <>
          {url ? (
            <div style={URL_BOX} data-testid="builder-link-url">
              {url}
            </div>
          ) : (
            <p style={MUTED}>{DOCUMENT_BUILDER_LINK_ADDRESS_LOST}</p>
          )}
          <div style={BTNS}>
            {url ? (
              <button
                type="button"
                style={SECOND_PRESS}
                onClick={() =>
                  void io.copy(url).then((ok) => {
                    setCopied(ok)
                    if (!ok) setRefusal('The browser would not copy the link. Select it above and copy it by hand.')
                  })
                }
              >
                Copy the link
              </button>
            ) : null}
            <button type="button" disabled={busy} style={SMALL_PRESS} onClick={() => void makeNew()}>
              Make a new link
            </button>
            <button type="button" disabled={busy} style={SMALL_PRESS} onClick={() => void switchOff()}>
              Switch the link off
            </button>
            {copied ? <span style={OK_CHIP}>Copied</span> : null}
          </div>
          <p style={MUTED}>{words.on}</p>
          <p style={MUTED}>
            {`Made ${formatDenverCalendarDayShort(Date.parse(link.madeAt))}. `}
            {link.opened > 0 ? `Opened ${plural(link.opened, 'time', 'times')} by someone outside${link.lastOpenedAt ? `, last on ${formatDenverCalendarDayShort(Date.parse(link.lastOpenedAt))}` : ''}.` : 'Not opened by anyone outside yet.'}
          </p>
        </>
      ) : (
        <>
          <p style={MUTED}>{documentBuilderLinkOffWords(link, link.endedAt ? formatDenverCalendarDayShort(Date.parse(link.endedAt)) : '', words.off)}</p>
          <div style={BTNS}>
            <button type="button" disabled={busy} style={SECOND_PRESS} onClick={() => void run(() => io.make(builderKey, sheetId))}>
              Switch the link on
            </button>
          </div>
        </>
      )}
      {published && link?.opens ? <LinkOpens opens={link.opens} total={link.opensTotal ?? link.opens.length} /> : null}
      {refusal ? (
        <p role="alert" style={REFUSAL}>
          {refusal}
        </p>
      ) : null}
    </div>
  )
}
