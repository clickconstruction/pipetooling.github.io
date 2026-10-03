# The trade's portal in Spanish: words for the other lanes

The trade's portal reads in English or Spanish, kept on the company's record (`Partner.lang`, the
owner's call 2026-10-03). Two pieces inside it belong to other lanes and still read English: the
Building lane's pay application door (`GcBuildingPayApp.tsx`, including "Sign the change"; now
built) and the Board lane's bid tab table (`GcBidTabs.tsx`, `bidTabResult` in `gcBids.ts`). This page gives each
lane the words, so the portal reads in one voice. The Spanish follows the sub portal's
(`src/lib/subPortal/subPortalI18n.ts`): formal *usted*, plain Mexican construction words. A native
speaker should read it before anything ships (README, question 25).

## How to read the language

- `import { usePortalLang } from './gcPortalLang'`, then `const { lang } = usePortalLang()`. It is
  `'es'` or `'en'` inside the portal and `'en'` anywhere else (the context's default), so a
  component the office also shows stays English there with no change.
- Dates: `pDate(lang, iso)` gives "8 oct", `pWeekday(lang, iso)` gives "jue 8 oct" (from the barrel,
  `gcModel`). Money is the same in both.
- Keep your words in your own file, a small `{ en, es }` table like `gcPortalI18n.ts`. Or ask the
  Portal lane to add your keys to `gcPortalI18n.ts`; then you call `t('key', { blanks })`.
- What the office typed (project names, trades, scope lines, notes, change order descriptions)
  stays as typed.

## The shared words

Use these so a company reads one word for one thing across the portal.

| English | Spanish |
|---|---|
| your number, your bid | su precio |
| quote, the quotes | cotización, las cotizaciones |
| statement of work | orden de trabajo |
| master agreement | contrato maestro |
| change order | orden de cambio |
| pay application | solicitud de pago |
| draw (Draw 2) | pago (Pago 2) |
| retainage, held | retención, retenido |
| conditional / unconditional waiver | renuncia condicional / incondicional |
| conditional / unconditional final release of lien | liberación final de gravamen condicional / incondicional |
| line (of scope, of the schedule of values) | partida |
| plans, plan set, sheet | planos, juego de planos, hoja |
| bid tab | tabla de precios |
| trade (the work) | especialidad |
| trade partner | subcontratista |
| the owner (of the project) | el dueño |
| report your work, percent done | reporte su avance, % terminado |
| sent back, approved, paid | devuelta, aprobada, pagada (a pay application is feminine) |
| due | vence |

## The Building lane: the pay application door

Built (Building lane, 2026-10-03, `gcBuildingWords.ts`): the door, the closeout list, the window's
steps and the 702 and 703 forms themselves read Spanish in a Spanish portal; the office's copy from
Draws stays English. The owner chose to translate the forms too. The form's own line names and
column headers are in one block at the end of `gcBuildingWords.ts`, for the native speaker's read.

| English | Spanish |
|---|---|
| Fill out pay application {n} | Llenar la solicitud de pago {n} |
| Go on with pay application {n} | Seguir con la solicitud de pago {n} |
| Fix and resend pay application {n} | Corregir y reenviar la solicitud de pago {n} |
| Check your work · Fill in a few details · Sign it · Send it to {gc} | Revise su avance · Llene unos datos · Fírmela · Envíela a {gc} |
| You are on step {n} of 4 · {step} | Está en el paso {n} de 4 · {step} |
| All four steps done | Los cuatro pasos están listos |
| The form | El formulario |
| Report your work above. Then fill out the pay application to ask for a draw. | Reporte su avance arriba. Luego llene la solicitud de pago para pedir un pago. |
| Pay application {n} is with {gc}. They are checking it. | La solicitud de pago {n} está con {gc}. La están revisando. |
| {gc} sent pay application {n} back {date}. Fix it and send it again. | {gc} le devolvió la solicitud de pago {n} el {date}. Corríjala y envíela de nuevo. |
| {line}: {gc} sees {n}%. You asked for {m}%. | {line}: {gc} ve {n}%. Usted pidió {m}%. |
| {gc} sent this back. Its numbers are in where it sees less. Change a line if you see it differently. | {gc} la devolvió. Sus números están donde ve menos avance. Cambie una partida si usted lo ve distinto. |
| {gc} approved {x} of the {y} you asked for on pay application {n}. {note} The rest is still yours to ask for. | {gc} aprobó {x} de los {y} que pidió en la solicitud de pago {n}. {note} El resto lo puede seguir pidiendo. |
| Each line starts at what you reported. Change a line if it moved. | Cada partida empieza con lo que usted reportó. Cámbiela si avanzó. |
| Nothing new to bill yet. Raise a line that moved. | Todavía no hay nada nuevo que facturar. Suba una partida que haya avanzado. |
| 100% billed · paid through {n}% | 100% facturado · pagado hasta {n}% |
| On file from your last one. · We keep it for next time. | En archivo de la anterior. · Lo guardamos para la próxima vez. |
| {gc} checks it and pays the draw. | {gc} la revisa y le paga. |
| {gc} checks it and pays back the retainage. | {gc} la revisa y le devuelve la retención. |
| You sent this | Usted la envió |
| Pay application {n} · sent back · revised | Solicitud de pago {n} · devuelta · corregida |
| Final pay application {n} | Solicitud de pago final {n} |
| Sign the master agreement first. | Primero firme el contrato maestro. |
| Sign the change | Firmar el cambio |
| It adds {x}. · It takes {x} off. · Time: {schedule}. | Suma {x}. · Resta {x}. · Tiempo: {schedule}. |
| Closeout. | Cierre. |
| {gc} walks the work with you and checks the punch list. | {gc} revisa el trabajo con usted y la lista de pendientes. |
| {gc} accepted your work {date}. | {gc} aceptó su trabajo el {date}. |
| It opens once {gc} accepts your work. | Se abre cuando {gc} acepte su trabajo. |
| Check it is all done | Revise que todo esté terminado |
| Every line is billed at 100%. This application asks for the retainage. | Todas las partidas están facturadas al 100%. Esta solicitud pide la retención. |
| Ask for the {x} with a final pay application. | Pida los {x} con una solicitud de pago final. |
| Your final pay application is with {gc}. | Su solicitud de pago final está con {gc}. |
| {gc} approved it. Payment is coming. | {gc} la aprobó. El pago viene en camino. |
| {gc} pays your retainage {date}, {days} days after the owner paid {gc}. | {gc} le paga su retención el {date}, {days} días después de que el dueño le pagó a {gc}. |
| {gc} pays your retainage {days} days after the owner pays {gc} its own. | {gc} le paga su retención {days} días después de que el dueño le pague a {gc} la suya. |
| {gc} paid your retainage. | {gc} le pagó su retención. |
| Sign the unconditional final release of lien below. | Firme abajo su liberación final de gravamen incondicional. |
| Last, you sign the unconditional final release of lien. | Al final, firme su liberación final de gravamen incondicional. |
| You are closed out on this job. | Su cierre en este trabajo está completo. |

## The Board lane: the bid tab inside the portal

| English | Spanish |
|---|---|
| Rank · Company · Quote · Over the low | Lugar · Empresa · Cotización · Arriba de la más baja |
| low | la más baja |
| (you) | (usted) |
| awarded | adjudicada |
| Another company | Otra empresa |
| {gc} sent its bid on {date}. The owner has not picked a builder yet. | {gc} envió su propuesta el {date}. El dueño todavía no elige constructor. |
| {gc} won the project. This trade is not awarded yet. | {gc} ganó el proyecto. Esta especialidad todavía no se adjudica. |
| {gc} won the project. This trade is yours. | {gc} ganó el proyecto. Esta especialidad es suya. |
| {gc} won the project. This trade went to another company. | {gc} ganó el proyecto. Esta especialidad fue para otra empresa. |

`bidTabResult` would take a `lang` (default `'en'`), the way the portal's own words do
(`portalPromiseLine`, `alternateWords`).
