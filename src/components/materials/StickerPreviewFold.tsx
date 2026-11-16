/**
 * What the stickers will look like (punch list #329, v2.7304): the fold at the foot of the Print blank stickers window,
 * above its presses, closed until this device leaves it open (`labelPrefs.ts`). Opened, it draws the first six strips
 * of the run at the tape's width through the printer's own drawing (`TapeStripBitmap`), so the preview and the tape
 * agree: the run's real numbers, read as the foot line reads the last run's end, each sticker's copies together, the
 * QR and the dashed code from the sample code, and one line that says so. A run that names its boxes (section 10,
 * v2.7391) draws each name large with its number small over the address, as it will print. Then *and 194 more, to 0202* with **Show
 * all 200**, which draws the rest once each at half size, capped at 200 with its words. The test strip is drawn the
 * same way, so the fold also says what Print 1 test strip prints. The rows are `lib/materials/stickerPreview.ts`.
 */
import { useState, type CSSProperties } from 'react'
import { readStickerPreviewOpen, writeStickerPreviewOpen } from '../../lib/materials/labelPrefs'
import { ptouchTapeDots } from '../../lib/materials/ptouchRaster'
import {
  previewHeadWords,
  STICKER_PREVIEW_CODE_WORDS,
  STICKER_PREVIEW_NAMED_CODE_WORDS,
  STICKER_PREVIEW_NO_COUNT_WORDS,
  STICKER_PREVIEW_READING_WORDS,
  STICKER_PREVIEW_TEST_WORDS,
  STICKER_PREVIEW_TITLE,
  stickerPreview,
} from '../../lib/materials/stickerPreview'
import { STICKER_TEST_STRIP } from '../../lib/materials/stickerRun'
import type { TapeWidthMm } from '../../lib/materials/tapeLabel'
import TapeStripBitmap from './TapeStripBitmap'

type Props = {
  /** Where the last run ended; null for the first run, undefined while it is read. */
  lastNumber: number | null | undefined
  /** How many the ask would mint; 0 while the ask holds no count the database would take. */
  count: number
  copies: number
  width: TapeWidthMm
  /** The run's box names in print order (section 10, v2.7391), as many as `count`; null or left out for a run of numbers only. */
  names?: ReadonlyArray<string> | null
}

const wrap: CSSProperties = { borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '0.5rem 0.9rem' }
const summary: CSSProperties = { cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-muted)', minHeight: 36, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.85rem' }
const quietLink: CSSProperties = { background: 'none', border: 'none', padding: 0, minHeight: 28, color: 'var(--text-link)', font: 'inherit', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }

const noop = () => {}

export default function StickerPreviewFold({ lastNumber, count, copies, width, names = null }: Props) {
  const [open, setOpen] = useState<boolean>(() => readStickerPreviewOpen())
  const [all, setAll] = useState(false)
  const dots = ptouchTapeDots(width) ?? 128
  const preview = stickerPreview({ lastNumber: lastNumber ?? null, count, copies, all, names })
  return (
    <details style={wrap} data-testid="stickers-preview" open={open} onToggle={(e) => { const o = (e.currentTarget as HTMLDetailsElement).open; setOpen(o); writeStickerPreviewOpen(o) }}>
      <summary style={summary}>{STICKER_PREVIEW_TITLE}</summary>
      {open ? (
        <div style={{ display: 'grid', gap: '0.5rem', paddingTop: '0.25rem' }}>
          {lastNumber === undefined ? (
            <span style={muted} data-testid="stickers-preview-reading">{STICKER_PREVIEW_READING_WORDS}</span>
          ) : count < 1 ? (
            <span style={muted} data-testid="stickers-preview-empty">{STICKER_PREVIEW_NO_COUNT_WORDS}</span>
          ) : (
            <>
              <span style={muted} data-testid="stickers-preview-head">{previewHeadWords(preview.head, count)}</span>
              <div style={{ display: 'grid', gap: '0.35rem', justifyItems: 'start' }} data-testid="stickers-preview-strips">
                {preview.head.map((r) => <TapeStripBitmap key={`${r.strip.id}:${r.copy}`} id={r.strip.id} stencil={r.strip.stencil} address={r.strip.address} value={r.strip.value} words={r.strip.words} number={r.strip.number} stencilSmall={r.strip.small} dots={dots} onDrawn={noop} />)}
              </div>
              {preview.moreWords || preview.showAllLabel ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  {preview.moreWords ? <span style={muted} data-testid="stickers-preview-more">{preview.moreWords}</span> : null}
                  {preview.showAllLabel ? <button type="button" style={quietLink} onClick={() => setAll(true)} data-testid="stickers-preview-show-all">{preview.showAllLabel}</button> : null}
                </div>
              ) : null}
              {preview.rest.length > 0 ? (
                <div style={{ display: 'grid', gap: '0.25rem', justifyItems: 'start' }} data-testid="stickers-preview-rest">
                  {preview.rest.map((r) => <TapeStripBitmap key={r.strip.id} id={r.strip.id} stencil={r.strip.stencil} address={r.strip.address} value={r.strip.value} words={r.strip.words} number={r.strip.number} stencilSmall={r.strip.small} dots={dots} height={Math.round(dots / 2)} onDrawn={noop} />)}
                </div>
              ) : null}
              {preview.cappedWords ? <span style={muted} data-testid="stickers-preview-capped">{preview.cappedWords}</span> : null}
              <span style={muted} data-testid="stickers-preview-code-words">{names && names.length > 0 ? STICKER_PREVIEW_NAMED_CODE_WORDS : STICKER_PREVIEW_CODE_WORDS}</span>
            </>
          )}
          <span style={{ ...muted, marginTop: '0.25rem' }} data-testid="stickers-preview-test-words">{STICKER_PREVIEW_TEST_WORDS}</span>
          <TapeStripBitmap id={`preview-${STICKER_TEST_STRIP.id}`} stencil={STICKER_TEST_STRIP.stencil} address={STICKER_TEST_STRIP.address} value={STICKER_TEST_STRIP.value} words={STICKER_TEST_STRIP.words} dots={dots} onDrawn={noop} />
        </div>
      ) : null}
    </details>
  )
}
