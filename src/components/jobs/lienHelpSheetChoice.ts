import { useCallback, useState } from 'react'

/**
 * Whether a help sheet prints in front of a lien affidavit (punch list #314). On by default: the sheet exists because
 * the first signed batch went wrong, so the office gets it until someone turns it off. The choice is a convenience
 * kept on this computer alone; when storage is not there the sheet simply prints.
 */
const KEY = 'pt.lienHelpSheet.v1'

/** The box beside the Lien window's print press. On the desk's print bar it is the chip *Help sheet* (`lienPrintWithChips`, v2.7209). */
export const LIEN_HELP_SHEET_BOX = 'Print the help sheet first'

/**
 * Whether the notice record prints with a lien affidavit (punch list #322): what was mailed before it and each
 * copy's mail number, and from the Lien window a copy of each notice behind it. Its own box, because the two pages have different readers:
 * the help sheet teaches a signer, and the record is what an attorney or a teammate checks the paper against. On by
 * default, kept on this computer alone, as the help sheet's is.
 */
const RECORD_KEY = 'pt.lienNoticeRecord.v1'

/** The box beside the Lien window's print press, under the help sheet's. On the desk's print bar it is the chip *Notice record*. */
export const LIEN_NOTICE_RECORD_BOX = 'Print the notice record'

/**
 * Whether a batch print adds a copy of each notice behind its notice records (punch list #322). Off by default, the
 * one box that is: a batch of eighteen papers has twenty or more notices behind it, and a run's packet once reached
 * 154 pages. The Lien window's own print has no such box; there the copies come with the notice record. On the desk's
 * print bar it is the chip *Notice copies, about N pages* (`lienPrintWithChips`).
 */
const COPIES_KEY = 'pt.lienNoticeCopiesBatch.v1'

function read(key: string, fallback: boolean): boolean {
  try {
    const kept = window.localStorage.getItem(key)
    return kept === 'on' ? true : kept === 'off' ? false : fallback
  } catch {
    return fallback
  }
}

/** A choice kept on this computer: nothing is stored while it stands at its default. */
function useChoice(key: string, fallback = true): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState<boolean>(() => read(key, fallback))
  const set = useCallback(
    (next: boolean) => {
      setOn(next)
      try {
        if (next === fallback) window.localStorage.removeItem(key)
        else window.localStorage.setItem(key, next ? 'on' : 'off')
      } catch {
        /* the choice lasts for this visit */
      }
    },
    [key, fallback],
  )
  return [on, set]
}

export function useLienHelpSheetChoice(): [boolean, (on: boolean) => void] {
  return useChoice(KEY)
}

export function useLienNoticeRecordChoice(): [boolean, (on: boolean) => void] {
  return useChoice(RECORD_KEY)
}

export function useLienNoticeCopiesBatchChoice(): [boolean, (on: boolean) => void] {
  return useChoice(COPIES_KEY, false)
}
