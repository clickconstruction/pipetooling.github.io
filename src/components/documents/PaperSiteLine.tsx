import type { CSSProperties } from 'react'
import { PAPER_SITE_WORDS, paperSiteSentence, type PaperSite, type SitePrintBox } from '../../lib/addresses/paperSite'
import { ValueSentence } from '../valuesInPlace/ValuesInPlace'

/**
 * The site's line in the email window of an outside party's new paper (punch list #439, piece 3). It says the site
 * the paper names, or that it names none, with the presses that name one, change it and take it off.
 *
 * Under a named site sits the box **Print the site's address on the paper** (part 3e). It is off until ticked, and
 * the words under it say what the signer reads as it stands: nothing about the site, or the very line with the
 * address. `box` is the kernel's (`sitePrintBox`): null draws no box, and a dead one cannot be ticked and says why.
 * Nothing is written here: the send writes the site and the box with the paper's row.
 *
 * Once that row is written (`kept`), the site and the box are the row's: the presses go, the box stands as it was
 * sent, and a line says so. A send that failed after the write is pressed again on the same row, so a change made
 * here in between would show one thing and send another.
 */

const siteLink: CSSProperties = { padding: '0.35rem 0', minHeight: 32, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 600, color: 'var(--text-link)' }
const printLine: CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: '0.55rem', minHeight: 44, boxSizing: 'border-box', padding: '0.3rem 0', margin: '0 0 0.25rem', fontSize: '0.8125rem', lineHeight: 1.4 }

export function PaperSiteLine({
  site,
  box,
  kept = false,
  onPick,
  onTakeOff,
  onPrint,
}: {
  site: PaperSite | null
  /** The box that prints the site's address, or null for a paper with no address to print. */
  box: SitePrintBox | null
  /** The paper's row is written: the site and the box stand as they were sent. */
  kept?: boolean
  /** Opens **Which site is it for?**. */
  onPick: () => void
  onTakeOff: () => void
  /** The box was ticked or unticked. */
  onPrint: (on: boolean) => void
}) {
  const dead = box != null && (box.dead || kept)
  return (
    <>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0 0 0.25rem', display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.15rem 0.6rem' }} data-testid="contract-send-site">
        <span>{site ? <ValueSentence text={paperSiteSentence(site)} /> : PAPER_SITE_WORDS.none}</span>
        {kept ? (
          <span>{PAPER_SITE_WORDS.kept}</span>
        ) : (
          <>
            <button type="button" style={siteLink} onClick={onPick}>
              {site ? PAPER_SITE_WORDS.change : PAPER_SITE_WORDS.name}
            </button>
            {site ? (
              <button type="button" style={siteLink} onClick={onTakeOff}>
                {PAPER_SITE_WORDS.off}
              </button>
            ) : null}
          </>
        )}
      </p>
      {box ? (
        // The whole line is the press, a fingertip tall. The box's name is its own, and the words under it are what
        // it is described by.
        <label style={{ ...printLine, cursor: dead ? 'default' : 'pointer' }} data-testid="contract-send-site-print">
          <input
            type="checkbox"
            checked={box.checked}
            disabled={dead}
            aria-label={box.label}
            aria-describedby="contract-send-site-print-hint"
            onChange={(e) => onPrint(e.target.checked)}
            style={{ width: 20, height: 20, flex: '0 0 20px', margin: '0.05rem 0 0' }}
          />
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 600, color: dead ? 'var(--text-muted)' : 'var(--text-strong)' }}>{box.label}</span>
            <span id="contract-send-site-print-hint" style={{ display: 'block', color: 'var(--text-muted)', overflowWrap: 'anywhere' }} data-testid="contract-send-site-print-hint">
              <ValueSentence text={box.hint} />
            </span>
          </span>
        </label>
      ) : null}
    </>
  )
}
