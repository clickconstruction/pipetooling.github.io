/**
 * The presses that print a job's reserved stickers (punch list #329, v2.7523; the owner, 2026-11-16: *I can see
 * stickers that were reserved, but I don't see any tools to print them*). One press for each run that still holds
 * reserved stickers, *Print the 58 reserved stickers, G93 to G150*, drawn wherever a screen names them: the *Which
 * job?* card, the job's own line over its boxes and the Print future stickers window's ask. A press hands its run up,
 * and the site opens the stickers window on it, which mints nothing.
 *
 * Under the presses one line says so, since **Print future stickers** beside them reserves new ones. A role the
 * database does not let print a run (`canMintStickers`) sees the presses dead with the reason in its place, never
 * missing. With more than one run each press says who printed its run and when. The words are `reservedPrint.ts`.
 */
import type { CSSProperties } from 'react'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { PRINT_RESERVED_SAME_WORDS, reservedRunByLine, type ReservedRunPrint } from '../../lib/materials/reservedPrint'
import { canMintStickers, STICKER_MINT_WHO } from '../../lib/materials/stickerRun'
import { calendarYmdInAppTzFromIso, formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'

type Props = {
  runs: ReadonlyArray<ReservedRunPrint>
  role: string | null | undefined
  onPrint: (run: ReservedRunPrint) => void
  /** The window the presses sit in is minting or printing: they rest until it is done. */
  busy?: boolean
  /** The test ids' stem: `<tid>` on the group, `<tid>-press` on each press and `<tid>-note` on the line under them. */
  tid: string
  pressStyle?: CSSProperties
  noteStyle?: CSSProperties
}

const basePress: CSSProperties = { minHeight: 36, padding: '0 0.75rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left' }
const deadPress: CSSProperties = { background: DEAD_PRESS_FILL, borderColor: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'default' }
const baseNote: CSSProperties = { fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }

const dayWords = (iso: string) => formatWorkDateYmdMonthDayShort(calendarYmdInAppTzFromIso(iso))

export default function ReservedPrintPresses({ runs, role, onPrint, busy = false, tid, pressStyle, noteStyle }: Props) {
  if (runs.length === 0) return null
  const may = canMintStickers(role)
  const dead = !may || busy
  return (
    <div style={{ display: 'grid', gap: '0.3rem', minWidth: 0 }} data-testid={tid}>
      {runs.map((r) => {
        const by = reservedRunByLine(r, runs, dayWords)
        return (
          <div key={r.run.id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem 0.6rem', flexWrap: 'wrap', minWidth: 0 }}>
            <button
              type="button"
              disabled={dead}
              aria-disabled={dead}
              aria-label={may ? undefined : `${r.label}. ${STICKER_MINT_WHO}`}
              title={may ? PRINT_RESERVED_SAME_WORDS : STICKER_MINT_WHO}
              style={{ ...basePress, ...pressStyle, ...(dead ? deadPress : {}) }}
              onClick={() => onPrint(r)}
              data-testid={`${tid}-press`}
            >
              {r.label}
            </button>
            {by ? <span style={{ ...baseNote, ...noteStyle }} data-testid={`${tid}-by`}>{by}</span> : null}
          </div>
        )
      })}
      {/* What the press does, or why it is dead: never a new reservation, and never a press that is simply missing. */}
      <span role={may ? undefined : 'note'} style={{ ...baseNote, ...noteStyle }} data-testid={`${tid}-note`}>{may ? PRINT_RESERVED_SAME_WORDS : STICKER_MINT_WHO}</span>
    </div>
  )
}
