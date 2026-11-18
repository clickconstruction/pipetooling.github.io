import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { normalizeAddressForGeocodeKey } from '../lib/map/normalizeAddressForGeocode'
import { resolveOfficeAnchor } from '../lib/officeAddressSettings'
import type { LatLng } from '../lib/jobTravelEstimate'
import { milesFromShop } from '../lib/trips/tripPlace'
import {
  parseTripPhoneState,
  readTripHeadedHome,
  readTripJustClockIn,
  tripKindOfSession,
  tripPhoneNeedsMiles,
  tripPhoneView,
  tripQuietPaint,
  withTodayPainted,
  writeTripHeadedHome,
  writeTripJustClockIn,
  type TripPhoneAct,
  type TripPhoneState,
  type TripPhoneStorage,
  type TripPhoneView,
  type TripSessionTravel,
} from '../lib/trips/tripPhone'
import { readTripPhoneState, sendTripPhoneAct } from '../lib/trips/tripsIo'
import type { TripDayKind } from '../lib/trips/tripDays'
import { todayYmdInAppTz } from '../utils/dateUtils'
import { useAddressGeocodeCoords } from './useAddressGeocodeCoords'

/**
 * The phone's trip on the job somebody is clocked in on (punch list #379, PR 7b). The rules are
 * `lib/trips/tripPhone.ts`; this hook makes the reads and the four acts.
 *
 * **It cannot touch a clock in.** Nothing in the clock's path calls this hook or waits on it. The question
 * and the quiet paint need `sessionId`, the clock session that already exists, so they run after the clock
 * in went through. Before a clock in (`sessionId` null, the job the card says is ready to start) the hook
 * only reads, for the banner. A read that fails, a phone with no signal or a database that does not know
 * these functions yet leaves the state null: nothing is asked, nothing is shown, and the clock is as it was.
 *
 * The reads, each only when the one before says it is worth it:
 *
 * 1. `trip_phone_state`, once for a job, and once more when a clock session opens on it.
 * 2. The shop's point and the site's point from the job's address, only for somebody clocked in and only
 *    when the distance alone would decide the question (`tripPhoneNeedsMiles`).
 *
 * The kind a trip act paints comes from the open session's two stamps, which the card already holds
 * (`travel`, read by its own reload: no read is added for it): On the road while the session is an
 * On my way drive that has not arrived, else At the site (`tripKindOfSession`). Start a trip and Join
 * send that kind.
 *
 * And one quiet write (`tripQuietPaint`): a person with an open trip who is clocked in on a job of its
 * site has today painted that kind, once when the session opens and once more when the same session
 * arrives, so a morning drive turns to At the site at **I'm here**. A site day is never turned into a
 * road day, and nothing quiet paints after **Heading home** in the same session. A failure there is one
 * console warning and nothing else.
 *
 * The io is injectable for tests.
 */
export type TripPhoneIo = {
  /** The reply of `trip_phone_state`, as it came. */
  readState: (jobId: string) => Promise<unknown>
  act: (act: TripPhoneAct) => Promise<void>
  readShop: () => Promise<LatLng | null>
}

export const supabaseTripPhoneIo: TripPhoneIo = {
  readState: readTripPhoneState,
  act: sendTripPhoneAct,
  readShop: async () => {
    const anchor = await resolveOfficeAnchor()
    return anchor ? { lat: anchor.lat, lng: anchor.lng } : null
  },
}

export type TripPhone = {
  /** Null until the read is in, when it failed, and for somebody not working the job. */
  state: TripPhoneState | null
  /** The question, the banner, or nothing. */
  view: TripPhoneView
  /** Start a trip with the caller on it. Throws the database's refusal. */
  start: () => Promise<void>
  /** Join a crewmate's open trip. Throws the database's refusal. */
  join: (tripId: string) => Promise<void>
  /** Heading home: the caller's own today painted On the road. Throws the database's refusal. */
  headHome: () => Promise<void>
  /** End the trip, with how it went when something was typed. Throws the database's refusal. */
  end: (outcome: string) => Promise<void>
  /** Just clock in: remembered for this job and today on this device. */
  justClockIn: () => void
}

/** What was read, for which job, and under which key (the job and its clock session). */
type Read = { key: string; jobId: string; state: TripPhoneState | null }

export function useTripPhone({
  jobId,
  sessionId,
  travel,
  address,
  io = supabaseTripPhoneIo,
  storage,
  deviceToday = todayYmdInAppTz,
}: {
  /** The job on the card: the open clock session's, or the one ready to start. Null reads nothing (a clock in with no job). */
  jobId: string | null
  /** The open clock session on that job, or null before the clock in. A new clock in on the same job reads again. */
  sessionId: string | null
  /**
   * The open session's two stamps as the card holds them: null for a session with none, and undefined
   * while the card is still reading them (the hook then waits, or keeps what it last knew of this session).
   */
  travel: TripSessionTravel | null | undefined
  /** The job's address, for how far the site is from the shop. */
  address: string | null
  io?: TripPhoneIo
  /** The device's memory of Just clock in; the browser's own when left out, null for none. */
  storage?: TripPhoneStorage | null
  /** The company's day as the device reads it, used only when the reply names no day. */
  deviceToday?: () => string
}): TripPhone {
  const [read, setRead] = useState<Read | null>(null)
  const [shop, setShop] = useState<LatLng | null>(null)
  /** Just clock in said on this screen, kept here too so a device that cannot remember does not ask twice. */
  const [saidNo, setSaidNo] = useState<string | null>(null)
  /** The clock session Heading home was pressed in on this screen, kept here too for the same reason. */
  const [saidHome, setSaidHome] = useState<string | null>(null)
  /** The session's kind as last known, so the card's own reloads (stamps unread for a moment) change nothing. */
  const [settled, setSettled] = useState<{ sessionId: string; kind: TripDayKind } | null>(null)

  const readKey = jobId ? `${jobId}|${sessionId ?? ''}` : ''

  /** The state read. Never throws: a failure is a null state. */
  const readState = useCallback(async (): Promise<TripPhoneState | null> => {
    if (!jobId) return null
    try {
      return parseTripPhoneState(await io.readState(jobId), deviceToday())
    } catch {
      return null
    }
  }, [jobId, io, deviceToday])

  useEffect(() => {
    if (!readKey) return
    let live = true
    void readState().then((state) => live && jobId && setRead({ key: readKey, jobId, state }))
    return () => {
      live = false
    }
  }, [readKey, jobId, readState])

  // The banner keeps what was read for this job while a clock in reads it again, so it does not blink.
  const held = read && read.jobId === jobId ? read : null
  const state = held?.state ?? null
  // What a trip act paints, from the open session's stamps; null while they are not known for this session.
  const kindNow = sessionId && travel !== undefined ? tripKindOfSession(travel) : null
  useEffect(() => {
    if (!sessionId || !kindNow) return
    setSettled((prev) => (prev && prev.sessionId === sessionId && prev.kind === kindNow ? prev : { sessionId, kind: kindNow }))
  }, [sessionId, kindNow])
  const kind = kindNow ?? (settled && settled.sessionId === sessionId ? settled.kind : null)
  /** The question and the quiet paint are for somebody whose clock in went through, on a state read since, with the session's kind known. */
  const clockedIn = !!sessionId && held?.key === readKey && kind != null

  const memoryKey = state && jobId ? `${jobId}|${state.today}` : ''
  const justClockInSaid = useMemo(
    () => !!memoryKey && !!state && !!jobId && (saidNo === memoryKey || readTripJustClockIn(jobId, state.today, storage)),
    [memoryKey, state, jobId, saidNo, storage],
  )

  // How far the site is from the shop, read only when it alone would decide the question.
  const needsMiles = tripPhoneNeedsMiles(state, justClockInSaid, clockedIn)
  useEffect(() => {
    if (!needsMiles) return
    let live = true
    Promise.resolve()
      .then(() => io.readShop())
      .then(
        (p) => live && setShop(p),
        () => undefined,
      )
    return () => {
      live = false
    }
  }, [needsMiles, io])
  const addresses = useMemo(() => (address && address.trim() ? [{ key: normalizeAddressForGeocodeKey(address), display: address.trim() }] : []), [address])
  const geo = useAddressGeocodeCoords(addresses, needsMiles && addresses.length > 0, 'trip phone site point')
  const sitePoint = addresses[0] ? (geo.coords.get(addresses[0].key) ?? null) : null
  const miles = needsMiles ? milesFromShop(shop, sitePoint) : null

  // Heading home pressed in this session, today: nothing quiet paints over it until a new session.
  const headedHome = useMemo(
    () => !!sessionId && !!state && (saidHome === sessionId || readTripHeadedHome(sessionId, state.today, storage)),
    [sessionId, state, saidHome, storage],
  )

  // The quiet rule: today painted the session's kind for a person with an open trip. Once for a session
  // and its kind, so once when it opens and once more when the same session arrives.
  const paintedKey = useRef('')
  const painting = useRef<Promise<void> | null>(null)
  const quiet = tripQuietPaint({ state, clockedIn, kind, headedHome })
  useEffect(() => {
    if (!jobId || !quiet || !state?.mine) return
    const key = `${readKey}|${state.mine.tripId}|${state.today}|${quiet}`
    if (paintedKey.current === key) return
    paintedKey.current = key
    const tripId = state.mine.tripId
    painting.current = Promise.resolve()
      .then(() => io.act({ action: 'day', job_id: jobId, trip_id: tripId, kind: quiet }))
      .then(
        () => setRead((prev) => (prev && prev.jobId === jobId && prev.state ? { ...prev, state: withTodayPainted(prev.state, quiet) } : prev)),
        // The clock in already happened, so this is said once to the console and to nobody else.
        (e: unknown) => console.warn('[trips] today was not painted on the trip', e),
      )
  }, [jobId, readKey, state, quiet, io])

  /** After an act that changes whose trip this is: the state read again, in place. */
  const readAgain = useCallback(async () => {
    const next = await readState()
    if (jobId) setRead({ key: readKey, jobId, state: next })
  }, [readState, readKey, jobId])

  // Start and Join paint today the session's kind: a person who pressed On my way and is still driving starts on the road.
  const actKind: TripDayKind = kind ?? 'site'
  const start = useCallback(async () => {
    if (!jobId) return
    await io.act({ action: 'start', job_id: jobId, kind: actKind })
    await readAgain()
  }, [jobId, actKind, io, readAgain])

  const join = useCallback(
    async (tripId: string) => {
      if (!jobId) return
      await io.act({ action: 'join', job_id: jobId, trip_id: tripId, kind: actKind })
      await readAgain()
    },
    [jobId, actKind, io, readAgain],
  )

  const tripId = state?.mine?.tripId ?? null
  const headHome = useCallback(async () => {
    if (!jobId || !tripId) return
    // A quiet paint in flight lands first, so it cannot paint over the drive home.
    await painting.current
    await io.act({ action: 'day', job_id: jobId, trip_id: tripId, kind: 'road' })
    // The person's own word: nothing quiet paints today again in this clock session, on this device.
    if (sessionId && state) {
      writeTripHeadedHome(sessionId, state.today, storage)
      setSaidHome(sessionId)
    }
    setRead((prev) => (prev && prev.jobId === jobId && prev.state ? { ...prev, state: withTodayPainted(prev.state, 'road') } : prev))
  }, [jobId, tripId, sessionId, state, storage, io])

  const remember = useCallback(() => {
    if (!jobId || !state) return
    writeTripJustClockIn(jobId, state.today, storage)
    setSaidNo(`${jobId}|${state.today}`)
  }, [jobId, state, storage])

  const end = useCallback(
    async (outcome: string) => {
      if (!jobId || !tripId) return
      const words = outcome.trim()
      await io.act(words ? { action: 'end', job_id: jobId, trip_id: tripId, outcome: words } : { action: 'end', job_id: jobId, trip_id: tripId })
      // The site has had a trip now, so the question would come straight back: it waits for tomorrow.
      remember()
      setRead((prev) => (prev && prev.jobId === jobId && prev.state ? { ...prev, state: { ...prev.state, mine: null, hasTrips: true } } : prev))
    },
    [jobId, tripId, io, remember],
  )

  const view = useMemo(() => tripPhoneView({ state, miles, justClockIn: justClockInSaid, clockedIn }), [state, miles, justClockInSaid, clockedIn])

  return { state, view, start, join, headHome, end, justClockIn: remember }
}
