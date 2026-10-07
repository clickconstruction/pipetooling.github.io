---
name: "The Spanish voice: one word for each thing, across every string a trade reads"
rows: the Portal's Spanish (PORTAL_SPANISH.md, 985 strings), round five
branch: spike/spanish-voice (from origin/spike/gc-mode at 7fe31975f)
status: built 2026-10-06 on spike/spanish-voice with the lead's go on picks 1 and 2 (Helper 1). The fifteen strings changed as below, no English. The pin is gcSpanishVoice.test.ts, and the list is redrawn by the script (985 strings). As built, six rows left the hand table, not five, since a trade is pinned too. The tú possessives (tuyo, tuya, tuyos, tuyas) joined the markers.
---

# The Spanish voice

## What I read

- **Every Spanish string a trade can read**, the 985 in `PORTAL_SPANISH.md`. I redrew the list
  from today's code with `portal-spanish-list.ts` first: it came out identical to the committed
  one, so the list is current.
- **The keys** in `gcPortalI18n.ts` and `gcBuildingWords.ts`, and `EXCLUSION_ES`.
- **The inline Spanish in the kernels and components.** None sits outside the list's sources. The
  Gantt's newer portal words (the dates moved, the start reminders, *We will be late*, *People a
  day on site*, the portal's chart) all come through `gcPortalI18n` keys. The one stray is the
  conjunction *y* in `gcCompanyPeople.ts`, which needs nothing.

Then, for each thing below, I matched every row whose English names it against how its Spanish
says it, and I scanned all 1,000 rows for the other words a writer might reach for.

## The fourteen, and the one word for each

| Thing | The one word | What the Spanish says today | What changes |
|---|---|---|---|
| master agreement | **contrato maestro** | 16 of 16 rows | nothing |
| statement of work | **orden de trabajo** | 27 of 27 rows | nothing |
| insurance certificate | **certificado de seguro**; *certificado* once *seguro* is named in the same string or message | 14 rows say it whole. 4 say *certificado* right after *Su seguro vence…*, and one message line (`mCoiOpen`) after its message's first line names it | two labels with no *seguro* near them say just *certificado* (below) |
| a draw | **pago** (*Pago 2*) | 23 rows, as the shared words already say | nothing |
| a pay application | **solicitud de pago**; *solicitud* once named | 32 rows whole, 6 after it is named | nothing |
| a change order | **orden de cambio** | 19 rows | two strings about the order itself say just *cambio* (below). *Cambio* stays where it is a change the trade asks for (*Pedir un cambio*) and in the headings *Cambios* and *Contratos y cambios*. |
| a submittal | **documento para aprobación** | 4 rows | G-114's start reminder says *submittal*, in English, inside the Spanish (below) |
| an RFI | **pregunta** (*preguntas sobre los planos*) | 14 of 14 rows | nothing |
| the daily log | **registro diario** | 3 of 3 rows | nothing |
| the look-ahead | **las próximas tres semanas** (*Sus próximas tres semanas*) | the title and its marks, *hecho* and *no hecho* | nothing. *Esta semana y las tres siguientes* is another view, four weeks across every job, and keeps its own words. |
| a late notice | the **atraso** family: *atrasarse*, *atrasado*, *atraso* | 6 rows, and *Vamos a atrasarnos* | the submittals' *{n} días de retraso* (below) |
| a crew count | **personas al día** (*Personas al día en la obra*) | 3 of 3 rows | nothing |
| the dates to meet | **fechas a cumplir** | no Spanish string names them | nothing today. The trade's portal shows its own bars, never the job's dates to meet. The word is kept for when they come. |
| the form of address | **usted** | every row: no *tú* pronoun, no *tú* verb, and every imperative an *usted* form (*Abra*, *Envíe*, *Firme*, *Díganos*, *Pregúntele*, *Fírmela*) | nothing |

## Found while reading: four more things said two or three ways

| Thing | The one word | What the Spanish says today | What changes |
|---|---|---|---|
| the schedule | **cronograma** | *cronograma* 3 times (the portal's chart, *Your dates moved*), *calendario de obra* once (the look-ahead), *programa* once (your weeks) | the two odd ones (below) |
| a trade | **especialidad**, as the shared words already say | *especialidad* 7 times, *oficio* twice | the two *oficio* rows (below) |
| billed | **facturado**, *facturación* | *facturado* in Building's pay application words (*100% facturado*, *nada nuevo que facturar*); *cobrado* and *cobro* in the schedule of values | the four *cobro* rows (below). *Cobre* stays for "get paid". |
| a crew | **cuadrilla** | *cuadrilla* twice (the start reminder, your weeks), *personal* once (the look-ahead's reason) | the reason chip (below) |

One I would leave: **a job** is *trabajo* 23 times, *obra* 6 times (the weeks across every job)
and *proyecto* twice. *Trabajo* is also "work", so one word would write *su trabajo en todos los
trabajos*. That one is a question for the native speaker, not a rule.

## The fifteen strings, before and after

Only the Spanish changes, and no English sentence does.

| Key | Today | After |
|---|---|---|
| `mStartNeedSubmittal` | Su submittal {number}, {title}: {state}. El trabajo no puede comenzar hasta que esté aprobado. | Su documento para aprobación {number}, {title}: {state}. El trabajo no puede comenzar hasta que esté aprobado. |
| `subLate` (Building) | {n} días de retraso. | {n} días de atraso. |
| `signChange` (Building) | Firmar el cambio | Firmar la orden de cambio |
| `term3` | …necesita primero un cambio por escrito… | …necesita primero una orden de cambio por escrito… |
| `sendCert` | Enviar su certificado | Enviar su certificado de seguro |
| `certFile` | Una foto o PDF del certificado | Una foto o PDF del certificado de seguro |
| `reasonTradeBefore` | el oficio anterior | la especialidad anterior |
| `EXCLUSION_ES` *Blocking for others* | Bloqueo para otros oficios | Bloqueo para otras especialidades |
| `reasonCrew` | personal | cuadrilla |
| `lookIntro` | {gc} las planea con el calendario de obra… | {gc} las planea con el cronograma… |
| `wkNone` | Nada suyo en el programa esta semana. | Nada suyo en el cronograma esta semana. |
| `sovBilledNone` | Todavía no hay nada cobrado. | Todavía no hay nada facturado. |
| `sovBilledAll` | Cobrado {amount} a la fecha: todas las partidas de su desglose. | Facturado {amount} a la fecha: todas las partidas de su desglose. |
| `sovBilled` | Cobrado {amount} a la fecha: {where}. | Facturado {amount} a la fecha: {where}. |
| `sovSowHelp` | …para que {gc} lea su cobro en sus propias partidas… | …para que {gc} lea su facturación en sus propias partidas… |

## The pin

- **`gcSpanishVoice.ts`** (new, out of the barrel) holds the table above as data, `SPANISH_TERMS`.
  Each row has the thing, the one word, the words retired today, and the words kept out: what a
  writer might reach for, which no string uses yet.
  - Retired today: *submittal*, *retraso*, *calendario de obra*, *programa*, *oficio*, *cobrado*
    and *cobro*.
  - Kept out: *acuerdo maestro*, *convenio maestro*, *contrato marco*, *declaración de trabajo*,
    *constancia de seguro*, *comprobante de seguro*, *desembolso*, *anticipo*, *estimación*,
    *aplicación de pago*, *factura*, *orden de modificación*, *solicitud de información*, *RFI*,
    *bitácora*, *reporte diario*, *diario de obra*, *vista anticipada*, *look-ahead*, *demora*,
    *trabajadores al día*, *hitos*.
  - The *tú* markers: *tú*, *tu*, *tus*, *te*, *ti*, *contigo*, and the *tú* forms of *poder*,
    *tener*, *deber*, *necesitar*, *querer*, *estar*, *ser*, *saber* and *ir*.
- **One corpus for the list and the pin.** `spanishCorpus(read)` in the same file gathers every
  Spanish string the way the list script does today:
  - the portal's and Building's keys
  - the exclusions
  - the bid tab's lines and table
  - the dates and disciplines
  - the papers the office sends
  - the Follow up drafts
  - the notary block

  The script and the test both read that one corpus, so a string the list shows is always a string
  the pin scans. The script's own gathering moves there, and the list it writes comes out the same.
- **`gcSpanishVoice.test.ts`** scans every string in the corpus for every retired word, every
  kept-out word and every *tú* marker. Each match must stand alone as a word, ignoring case and
  accents. It fails naming the string's English and the word found. It also holds that each one
  word shows up at least once, except the dates to meet.
- **`PORTAL_SPANISH.md` is redrawn by the script, never by hand.** The tables come out with the
  fifteen strings changed, and the count stays 985.

## Files

- `src/lib/gcMode/gcPortalI18n.ts`: thirteen Spanish values.
- `src/lib/gcMode/gcBuildingWords.ts`: two.
- `src/lib/gcMode/gcSpanishVoice.ts` and `src/lib/gcMode/gcSpanishVoice.test.ts`: new.
- `to-dos/gc-mode/portal-spanish-list.ts`: reads the corpus from `gcSpanishVoice.ts` and prints
  the pinned table.
- `to-dos/gc-mode/PORTAL_SPANISH.md`: redrawn.

The golden test does not move. It reads no Spanish.

## Left out, and why

- **A job** stays as it is, *trabajo*, *obra* or *proyecto* by the sentence (above).
- **No English sentence changes**, and nothing the office typed is translated.
- **Words outside these things**, like *fecha* beside *día* for "day", read naturally both ways.
  They are the native speaker's to judge.
- **A test that the list is current** (pick 3) stays out, by the lead's word, because it would fail
  other lanes' pieces in flight.

## Is this the best we can do?

1. **One corpus for the list and the pin.** Copying the list's gathering into the test would let
   the two drift apart. A new source added to the list would then go unscanned. **I pick it.** The
   script's gathering moves, unchanged, into `gcSpanishVoice.ts`.
2. **The shared words drawn from the pin.** `PORTAL_SPANISH.md` keeps a hand table, *The shared
   words*, that already holds five of these things. I would have the script print the pinned table
   into the drawn part of the list, as *One word for each thing*. The five rows would then leave the
   hand table, which points at it instead. One home for each word, and the list can never disagree
   with the test. **I pick it.** The hand table keeps every word the pin does not hold, like
   *partida*, *retención* and *desglose por etapas*.
3. **A test that the list is current**, failing when a word changes in the code and nobody
   redrew the list. It would hold every lane to the rule in `HANDOFF.md`'s gotchas. **Not now.**
   It would fail other lanes' pieces in flight for a step they may not know about yet. It is the
   lead's call whether to add it.
