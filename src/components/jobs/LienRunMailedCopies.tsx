import { useRef, useState } from 'react'
import type { LienRunRow } from '../../lib/jobs/lienRunChecklist'
import { LIEN_MAILED_COPY_ACCEPT, LIEN_MAILED_COPY_WORDS, lienMailedCopyKey, lienMailedCopyTakeOffAsk, type LienMailedCopy } from '../../lib/jobs/lienMailedCopies'
import { TAKE_OFF_FILE_WORDS } from '../../lib/jobs/jobFolderTrash'

/**
 * What was mailed, on one row of the run's checklist (the owner's ask of 2026-11-16): the files the notice has, each
 * a link that opens it in Drive, and on a printed paper row the press that adds one. Since v2.7525 a listed file has
 * **Take off** beside it. It asks first, under the files, and says the file stays in Drive. Since v2.7635 a file
 * that did not go up leaves its reason under the row, with **Try again** where the same file can go again.
 * Since v2.7699 a file taken off goes to Drive's trash: the ask says so, and the line under the row says where the
 * file is now, with **Put it back**.
 *
 * The block lived inside `LienRunChecklist.tsx` until v2.7525. It is its own file so the checklist, which several
 * changes touch at once, holds one line for it.
 */
export type LienRunMailedCopiesPress = {
  onAdd: (row: LienRunRow, file: File) => void
  /** The row a file is going up for. */
  addingItemId: string | null
  /** Take one file off the row's list. Absent = the files show with no way to take one off. */
  onRemove?: (row: LienRunRow, copy: LienMailedCopy) => void
  /** The row a file is coming off. */
  removingItemId?: string | null
  /** The file that did not go up, with its reason (v2.7635); `retry` is whether the same file can go again. */
  failed?: { itemId: string; words: string; retry: boolean } | null
  /** Send the failed file again. */
  onRetry?: (row: LienRunRow) => void
  /**
   * The file just taken off this row, with where it is now (v2.7699): in Drive's trash, or still in Drive with the
   * reason. `canRetry` offers the trash a second try. `working` names what is under way.
   */
  off?: { itemId: string; words: string; canRetry: boolean; working: 'trash' | 'back' | null } | null
  /** Send the taken-off file to Drive's trash again. */
  onTrashAgain?: (row: LienRunRow) => void
  /** List the taken-off file on the notice again, out of the trash. */
  onPutBack?: (row: LienRunRow) => void
}

/** The press that takes the file: a button over a hidden picker, so the keyboard reaches it as any button. */
function MailedCopyPress({ row, has, adding, dead, onAdd }: { row: LienRunRow; has: boolean; adding: boolean; dead: boolean; onAdd: (row: LienRunRow, file: File) => void }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={LIEN_MAILED_COPY_ACCEPT}
        hidden
        data-testid={`run-check-copy-file-${row.itemId}`}
        onChange={(ev) => {
          const file = ev.target.files?.[0]
          ev.target.value = ''
          if (file) onAdd(row, file)
        }}
      />
      <button type="button" onClick={() => input.current?.click()} disabled={dead} title={LIEN_MAILED_COPY_WORDS.title} className="lienRunCheckCopyAdd" data-testid={`run-check-copy-add-${row.itemId}`}>
        {adding ? LIEN_MAILED_COPY_WORDS.adding : has ? LIEN_MAILED_COPY_WORDS.another : LIEN_MAILED_COPY_WORDS.add}
      </button>
    </>
  )
}

export default function LienRunMailedCopies({ row, canAdd, busy, press }: { row: LienRunRow; /** The paper has printed, so a file can be added. */ canAdd: boolean; busy: boolean; press?: LienRunMailedCopiesPress }) {
  // The file the ask is about, by its key; null when nothing is asked.
  const [asking, setAsking] = useState<string | null>(null)
  const working = press?.addingItemId != null || press?.removingItemId != null
  const dead = busy || working
  const removing = press?.removingItemId === row.itemId
  const asked = asking ? row.mailedCopies.find((c) => lienMailedCopyKey(c) === asking) ?? null : null
  const failed = press?.failed?.itemId === row.itemId ? press.failed : null
  const off = press?.off?.itemId === row.itemId ? press.off : null
  return (
    <div className="lienRunCheckCopies" data-testid={`run-check-copies-${row.itemId}`}>
      {row.mailedCopies.map((c, i) => (
        <span key={lienMailedCopyKey(c)} className="lienRunCheckCopy">
          <a href={c.url} target="_blank" rel="noreferrer" title={`${c.name} · ${LIEN_MAILED_COPY_WORDS.open}`}>
            ✓ {c.name} ›
          </a>
          {press?.onRemove ? (
            <button type="button" onClick={() => setAsking(lienMailedCopyKey(c))} disabled={dead || asked != null} aria-label={`${LIEN_MAILED_COPY_WORDS.takeOff}: ${c.name}`} className="lienRunCheckCopyOff" data-testid={`run-check-copy-off-${row.itemId}-${i}`}>
              {LIEN_MAILED_COPY_WORDS.takeOff}
            </button>
          ) : null}
        </span>
      ))}
      {press && canAdd ? <MailedCopyPress row={row} has={row.mailedCopies.length > 0} adding={press.addingItemId === row.itemId} dead={dead || asked != null} onAdd={press.onAdd} /> : null}
      {asked && press?.onRemove ? (
        <div className="lienRunCheckCopyAsk" role="group" aria-label={lienMailedCopyTakeOffAsk(asked.name)} data-testid={`run-check-copy-ask-${row.itemId}`}>
          <span>{lienMailedCopyTakeOffAsk(asked.name)}</span>
          <button
            type="button"
            onClick={() => {
              setAsking(null)
              press.onRemove?.(row, asked)
            }}
            disabled={dead}
            className="lienRunCheckCopyAdd"
            data-testid={`run-check-copy-off-yes-${row.itemId}`}
          >
            {LIEN_MAILED_COPY_WORDS.takeOffConfirm}
          </button>
          <button type="button" onClick={() => setAsking(null)} disabled={dead} className="lienRunCheckCopyAdd" data-testid={`run-check-copy-off-no-${row.itemId}`}>
            {LIEN_MAILED_COPY_WORDS.keep}
          </button>
        </div>
      ) : removing ? (
        <span className="lienRunCheckCopyBusy" role="status">{LIEN_MAILED_COPY_WORDS.takingOff}</span>
      ) : null}
      {off && !asked ? (
        <div className="lienRunCheckCopyAsk" role="status" data-testid={`run-check-copy-off-line-${row.itemId}`}>
          <span>{off.working === 'trash' ? TAKE_OFF_FILE_WORDS.moving : off.working === 'back' ? TAKE_OFF_FILE_WORDS.puttingBack : off.words}</span>
          {off.canRetry && press?.onTrashAgain && !off.working ? (
            <button type="button" onClick={() => press.onTrashAgain?.(row)} disabled={dead} className="lienRunCheckCopyAdd" data-testid={`run-check-copy-trash-again-${row.itemId}`}>
              {TAKE_OFF_FILE_WORDS.tryAgain}
            </button>
          ) : null}
          {press?.onPutBack && !off.working ? (
            <button type="button" onClick={() => press.onPutBack?.(row)} disabled={dead} className="lienRunCheckCopyAdd" data-testid={`run-check-copy-put-back-${row.itemId}`}>
              {TAKE_OFF_FILE_WORDS.putBack}
            </button>
          ) : null}
        </div>
      ) : null}
      {failed && press?.addingItemId !== row.itemId ? (
        <div className="lienRunCheckCopyAsk" role="alert" data-testid={`run-check-copy-failed-${row.itemId}`}>
          <span style={{ color: 'var(--text-red-700)' }}>{failed.words}</span>
          {failed.retry && press?.onRetry ? (
            <button type="button" onClick={() => press.onRetry?.(row)} disabled={dead} className="lienRunCheckCopyAdd" data-testid={`run-check-copy-retry-${row.itemId}`}>
              {LIEN_MAILED_COPY_WORDS.tryAgain}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
