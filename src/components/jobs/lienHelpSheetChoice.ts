import { useCallback, useState } from 'react'

/**
 * Whether a help sheet prints in front of a lien affidavit (punch list #314). On by default: the sheet exists because
 * the first signed batch went wrong, so the office gets it until someone turns it off. The choice is a convenience
 * kept on this computer alone; when storage is not there the sheet simply prints.
 */
const KEY = 'pt.lienHelpSheet.v1'

/** The box beside the print press. */
export const LIEN_HELP_SHEET_BOX = 'Print the help sheet first'

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

export function useLienHelpSheetChoice(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState<boolean>(read)
  const set = useCallback((next: boolean) => {
    setOn(next)
    try {
      if (next) window.localStorage.removeItem(KEY)
      else window.localStorage.setItem(KEY, 'off')
    } catch {
      /* the choice lasts for this visit */
    }
  }, [])
  return [on, set]
}
