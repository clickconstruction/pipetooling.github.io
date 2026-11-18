import { useState } from 'react'

/** The sent footer's three inline forms, each value with its setter (`useLienSentFooterForms`). */
export type LienSentFooterForms = ReturnType<typeof useLienSentFooterForms>

/**
 * The state of the sent footer's three inline forms (its own file since v2.7591, out of `LienDesk.tsx` as it
 * stood). The desk calls it, not the footer: the desk clears the forms when the job changes, To do's rows open the
 * promise form with a day already in it, and a typed line is kept while the footer is off screen.
 */
export function useLienSentFooterForms() {
  /** Counsel's sign-off ask on a sent notice (#41 PR 3). */
  const [signoffOpen, setSignoffOpen] = useState(false)
  const [signoffText, setSignoffText] = useState('')
  // The GC's written okay for the owner to pay us (v2.3760).
  const [gcOkayOpen, setGcOkayOpen] = useState(false)
  const [gcOkayNote, setGcOkayNote] = useState('')
  // What they promised for the rest (punch list #274, PR 3): the footer's inline form while they are paying it down.
  const [promiseOpen, setPromiseOpen] = useState(false)
  const [promiseYmd, setPromiseYmd] = useState('')
  const [promiseAmount, setPromiseAmount] = useState('')
  const [promiseNote, setPromiseNote] = useState('')
  return { signoffOpen, setSignoffOpen, signoffText, setSignoffText, gcOkayOpen, setGcOkayOpen, gcOkayNote, setGcOkayNote, promiseOpen, setPromiseOpen, promiseYmd, setPromiseYmd, promiseAmount, setPromiseAmount, promiseNote, setPromiseNote }
}
