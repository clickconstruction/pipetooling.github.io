import { useEffect, useState } from 'react'
import { lienLastWorkDay, lienLastWorkDayPatch, lienLastWorkDayProblem, type LienLastWorkJob } from '../../lib/jobs/lienLastWorkDay'
import { lienLastWorkOpeningDay, lienLastWorkSavedWords } from '../../lib/jobs/lienLastWorkDoor'
import { LienLastWorkDayConfirm } from './LienLastWorkDayConfirm'
import { useLienLastWorkDayWrite } from './useLienLastWorkDayWrite'

export type LienLastWorkDayWindowProps = {
  jobId: string
  job: LienLastWorkJob | null | undefined
  todayYmd: string
  userId: string | null
  /** After a save: the caller re-reads the job and the desk. The window closes itself first. */
  onSaved: () => void
  onClose: () => void
  /** "922 · Michael Palvern": the window's subtitle. */
  jobLabel?: string
  /** The months with approved hours (YYYY-MM), for the window's dates. */
  clockMonths?: ReadonlyArray<string>
  noticedMonths?: ReadonlyArray<string>
  affidavitMonths?: ReadonlyArray<string>
  /** 'residential' | 'commercial'; '' or absent draws the words without the table. */
  propertyKind?: string
  /** The day the window opens on, and its setter, when the caller keeps the day (the line's editor). Left out, the window opens on the job's day and keeps its own. */
  day?: string
  onDay?: (day: string) => void
}

/**
 * The window that sets a last day of work by hand, with its write (v2.7684): `LienLastWorkDayConfirm` shows what
 * moves and asks why, and *Set the day* saves the day, the reason, who and when on the job. The line's *Save the
 * day* opens it on the day typed in the editor. The press under the timeline's LAST WORK stop opens it on the day
 * the job reads today (empty over a stand-in, `lienLastWorkOpeningDay`), and the day is picked in the window itself.
 * Clock hours and pay are never touched.
 */
export function LienLastWorkDayWindow({ jobId, job, todayYmd, userId, onSaved, onClose, jobLabel, clockMonths, noticedMonths, affidavitMonths, propertyKind, day: dayProp, onDay }: LienLastWorkDayWindowProps) {
  const d = lienLastWorkDay(job)
  // Opened from the timeline's press, the window keeps the day itself. A stand-in is no day anyone said, so it opens empty and asks for one.
  const openingDay = lienLastWorkOpeningDay(d)
  const [ownDay, setOwnDay] = useState(openingDay)
  const [note, setNote] = useState(d.note)
  const day = dayProp ?? ownDay
  const setDay = onDay ?? setOwnDay
  const { busy, write } = useLienLastWorkDayWrite(jobId, onSaved)
  // A different job under an open window starts over on that job's day and reason.
  useEffect(() => {
    setOwnDay(openingDay)
    setNote(d.note)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the job's identity and its day decide; `d` is rebuilt every render
  }, [jobId, job?.lien_last_work_on, job?.last_work_date])
  const confirm = async () => {
    if (lienLastWorkDayProblem(day, todayYmd) || !note.trim()) return
    if (await write(lienLastWorkDayPatch(day, note, userId, new Date().toISOString()), lienLastWorkSavedWords(day))) onClose()
  }
  return (
    <LienLastWorkDayConfirm
      jobLabel={jobLabel ?? ''}
      input={{ currentDay: d.day, currentSource: d.source, lastSessionDay: job?.last_work_date ?? null, clockMonths: clockMonths ?? [], noticedMonths: noticedMonths ?? [], affidavitMonths: affidavitMonths ?? [], propertyKind: propertyKind ?? '', todayYmd }}
      day={day}
      onDay={setDay}
      note={note}
      onNote={setNote}
      onConfirm={() => void confirm()}
      onCancel={onClose}
      busy={busy}
      startOn={dayProp === undefined ? 'day' : 'reason'}
    />
  )
}
