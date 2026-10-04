# The trade's portal in Spanish: words for the other lanes

The trade's portal reads in English or Spanish, kept on the company's record (`Partner.lang`, the
owner's call 2026-10-03). Two pieces inside it belong to other lanes: the Building lane's pay
application door (`GcBuildingPayApp.tsx`) and the Board lane's bid tab (`GcBidTabs.tsx`,
`bidTabResult` in `gcBids.ts`). Both now read in Spanish on the words this page gave them, so the
portal reads in one voice. Every Spanish string that ships is listed at the end, for a native
speaker to read. The Spanish follows the sub portal's
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
| your quote (a trade's own number; owner, 2026-10-04) | su cotización (feminine: "Envíela", "válida") |
| the quotes | las cotizaciones |
| our bid (ours, to the owner) | nuestra propuesta |
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
| Fix and resend pay application {n} | Corregir y reenviar la solicitud {n} |
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

## For a native speaker to read

Every Spanish string the trade's portal shows, 589 in all, drawn from the code on 2026-10-04.
They're grouped by screen, English on the left. Please mark anything that reads wrong, stiff or
unclear, and write the better words beside it. The Portal lane makes the changes and passes the
other lanes theirs.

**The slots in curly brackets** are filled in when the page is drawn:

- `{gc}` is our company's short name, "Click".
- `{project}`, `{trade}`, `{trades}`, `{company}`, `{contact}`, `{first}`, `{name}`, `{architect}`,
  `{address}` and `{phone}` are names, an address or a phone number.
- `{label}`, `{set}`, `{sets}` and `{plans}` name a set of plans, such as "Addendum 1". `{id}` is a
  sheet number, such as "E-201". `{title}` is a sheet's old name, such as "Site plan".
- `{date}`, `{by}`, `{start}`, `{finish}`, `{when}` and `{since}` are dates, such as "8 oct" or "jue 8 oct".
  `{ago}` is how long ago, such as "hace 3 días".
- `{amount}`, `{approved}`, `{asked}`, `{held}`, `{contract}`, `{paid}`, `{left}`, `{price}`, `{x}`
  and `{y}` are dollar amounts.
- `{n}`, `{m}`, `{i}`, `{days}` and `{pct}` are numbers.
- `{list}` is a list of sheet numbers. `{items}` is a list of lines of their price. `{line}` is
  one line's name.
- `{what}` is a piece of work the office typed, and `{who}` is who does it instead: a trade, the
  owner or Click.
- `{note}`, `{description}`, `{text}`, `{reason}`, `{about}`, `{schedule}`, `{mark}`, `{step}`
  and `{waiver}` are words from elsewhere in the portal or typed by someone.

**What stays as typed:** trade names ("Electrical"), project names, the notes the office writes on a
plan set, a question and its answer, and our superintendent's punch list notes stay in the words
they were written in. The portal does not translate them.

### The portal (the Portal lane's words, `gcPortalI18n.ts`)

#### The letterhead and the project page

| English | Español |
|---|---|
| Español | English |
| Trade partner portal | Portal de subcontratistas |
| ← Everything with {gc} | ← Todo con {gc} |
| General contractor: {name} · Hello, {contact}. | Contratista general: {name} · Hola, {contact}. |
| You have no open invitation on this project. | No tiene una invitación abierta en este proyecto. |
| Close | Cerrar |
|  and  |  y  |
|  or  |  o  |

#### A trade's plans, bid tab and result

| English | Español |
|---|---|
| {trade} · plans | {trade} · planos |
| issued {date} | emitido el {date} |
| Open the plans | Abrir los planos |
| you have the latest set | tiene el juego más reciente |
| Look at the plans | Ver los planos |
| New for {trade} since you last looked | Nuevo para {trade} desde la última vez que entró |
| Taken out: {list}. | Se quitaron: {list}. |
| Sheets {list}. | Hojas {list}. |
| {label} does not change {trade}. Open it so you price on the newest set. | {label} no cambia {trade}. Ábralo para cotizar con el juego más reciente. |
| {trade} · bid tab | {trade} · tabla de precios |
| Thank you for your quote. This is how the quotes came in. | Gracias por su cotización. Así llegaron las cotizaciones. |
| {gc} shared how the quotes came in on {date}. | {gc} compartió cómo llegaron las cotizaciones el {date}. |
| See the bid tab | Ver la tabla de precios |
| {trade} · result | {trade} · resultado |
| This one went to another company. Thank you for your quote. | Este trabajo fue para otra empresa. Gracias por su cotización. |
| {gc} did not win this project. | {gc} no ganó este proyecto. |
| The owner stopped this project or put it on hold. | El dueño detuvo este proyecto o lo puso en pausa. |
| You do not need to send a quote. Thank you for your time. | No necesita enviar su cotización. Gracias por su tiempo. |
| Thank you for your quote. | Gracias por su cotización. |
| {trade} · invitation | {trade} · invitación |
| You passed on this one. | Usted no cotizó este. |

#### The bid form

| English | Español |
|---|---|
| {trade} · invitation to quote | {trade} · invitación a cotizar |
| Your quote is due | Su cotización vence el |
| {n} days | {n} días |
| past due | vencido |
| Your quote: | Su cotización: |
| on {plans}, sent {date}. | con {plans}, enviado el {date}. |
| Good until {date}. | Válido hasta el {date}. |
| Alternates: | Alternativas: |
| Your quote file: | Archivo de su cotización: |
| Your quote ran out {date}. Send it again to keep it good. | Su cotización venció el {date}. Envíela de nuevo para que siga válida. |
| Send it again | Enviarlo de nuevo |
| The plans changed for your trade after you quoted. | Los planos de su especialidad cambiaron después de que cotizó. |
| Confirm your quote or change it. | Confirme su cotización o cámbiela. |
| Open the plans above, then confirm your quote or change it. | Abra los planos de arriba y luego confirme su cotización o cámbiela. |
| {gc} cannot tell if your quote covers {items}. Answer it so your quote compares fairly. | {gc} no sabe si su cotización incluye {items}. Contéstelo para que su cotización se compare de forma justa. |
| Answer it | Contestar |
| My quote stands on the new plans | Mantengo mi cotización |
| Open the plans first. | Primero abra los planos. |
| Change my quote | Cambiar mi cotización |
| Tick what your quote covers. Untick what it leaves out. Tap a sheet number to open it. | Marque lo que incluye su cotización. Desmarque lo que no incluye. Toque un número de hoja para abrirla. |
| {gc} cannot tell if your quote covers it. | {gc} no sabe si su cotización lo incluye. |
| It is in my quote | Está incluido en mi cotización |
| It is left out | No está incluido |
| Also changed in {sets} | También cambió en {sets} |
| Your quote | Su cotización |
| Anything we should know | Algo que debamos saber |
| Send my new quote | Enviar mi nueva cotización |
| Send my quote | Enviar mi cotización |
| Pass on this one | No cotizar este |
| Keep my quote as it is | Dejar mi cotización como está |
| Answer each line first. | Primero conteste cada partida. |
| Not ready yet? Tell {gc} when your quote will come. | ¿Todavía no está listo? Dígale a {gc} cuándo llegará su cotización. |
| The day your quote will come | El día que llegará su cotización |
| Give a new day | Dar un nuevo día |
| Change the day | Cambiar el día |
| Tell {gc} | Avisar a {gc} |

#### The bid form past the number

| English | Español |
|---|---|
| Not in your scope | Fuera de su alcance |
| Leave these out of your quote. Someone else does them. | No los incluya en su cotización. Otra persona los hace. |
| {what} ({who} does it) | {what} (lo hace {who}) |
| the owner | el dueño |
| Your quote is good for | Su cotización es válida por |
| Alternates | Alternativas |
| · another way to do the work, at a different price. You do not have to give one. | · otra forma de hacer el trabajo, a otro precio. No es obligatorio. |
| Remove | Quitar |
| What is different, like LED high bays | Qué cambia, por ejemplo lámparas LED |
| What is different | Qué cambia |
| adds | suma |
| takes off | resta |
| Adds or takes off | Suma o resta |
| How much | Cuánto |
| Add it | Agregar |
| Your quote file | El archivo de su cotización |
| · attach it if you have one. The amount above is the one that counts. | · adjúntelo si tiene uno. El monto de arriba es el que cuenta. |
| {gc} cannot tell if your quote covers these. Your quote stays as you sent it. | {gc} no sabe si su cotización incluye esto. Su cotización se queda como la envió. |
| Send my answer | Enviar mi respuesta |
| {label} adds {amount} | {label} suma {amount} |
| {label} takes off {amount} | {label} resta {amount} |

#### The statement of work and getting paid

| English | Español |
|---|---|
| Our daily log has you on site 1 day since {since}, on {date}. | Nuestro registro diario lo tiene en la obra 1 día desde el {since}, el {date}. |
| Our daily log has you on site {n} days since {since}, the last on {date}. | Nuestro registro diario lo tiene en la obra {n} días desde el {since}, el último el {date}. |
| Our daily log has not had you on site since {since}. | Nuestro registro diario no lo ha tenido en la obra desde el {since}. |
| {trade} · you got the job | {trade} · el trabajo es suyo |
| {gc} picked your quote. Your statement of work is being written. | {gc} eligió su cotización. Estamos preparando su orden de trabajo. |
| {trade} · statement of work | {trade} · orden de trabajo |
| {pct}% held until the end · based on {plans} | {pct}% retenido hasta el final · con base en {plans} |
| Sign the statement of work | Firmar la orden de trabajo |
| Sign the master agreement first. | Primero firme el contrato maestro. |
| signed {date} | firmado el {date} |
| {trade} · report your work and get paid | {trade} · reporte su avance y cobre |
| paid through {pct}% | pagado hasta {pct}% |
| Percent done, {line} | Porcentaje de avance, {line} |
| {pct}% done | {pct}% terminado |
| Draw {n} | Pago {n} |
| {gc} is reviewing it | {gc} lo está revisando |
| approved, payment coming | aprobado, el pago viene en camino |
| paid | pagado |
| of {asked} asked | de {asked} pedidos |
| Sign the unconditional waiver | Firmar la renuncia incondicional |
| Paid so far {paid} · held {held} · left to bill {left} | Pagado hasta hoy {paid} · retenido {held} · por facturar {left} |

#### The company's home

| English | Español |
|---|---|
| Hello, {name}. | Hola, {name}. |
| This is everything {company} has with {gc}. The link is yours. Keep it. | Aquí está todo lo que {company} tiene con {gc}. El enlace es suyo. Guárdelo. |
| Needs you | Pendiente para usted |
| Nothing needs you right now. | Por ahora no hay nada pendiente. |
| Your money | Su dinero |
| Paid to you | Pagado a usted |
| Held until the end | Retenido hasta el final |
| Approved, on the way | Aprobado, en camino |
| {gc} is looking at | {gc} está revisando |
| Your jobs | Sus trabajos |
| Asked to quote | Invitado a cotizar |
| Before | Anteriores |
| went to another company | fue para otra empresa |
| {gc} did not win it | {gc} no lo ganó |
| stopped or on hold | detenido o en pausa |
| you passed | no cotizó |
| {gc} won the job. {trade} is not picked yet. | {gc} ganó el proyecto. Todavía no se elige a nadie para {trade}. |
| {gc} sent its bid {date}. The owner picks next. | {gc} envió su propuesta el {date}. Ahora decide el dueño. |
| No due day yet. | Todavía no hay fecha límite. |
| Was due {date}. | Venció el {date}. |
| Due today, {date}. | Vence hoy, {date}. |
| Due {date}, 1 day left. | Vence el {date}, falta 1 día. |
| Due {date}, {n} days left. | Vence el {date}, faltan {n} días. |
| your quote {amount} | su cotización {amount} |
| your day passed | ya pasó su fecha |
| no quote yet | sin cotización todavía |
| your quote ran out | su cotización venció |
| plans changed | cambiaron los planos |
| a line to answer | una partida por contestar |
| statement of work being written | preparando la orden de trabajo |
| sign the statement of work | firme la orden de trabajo |
| closed out | cerrado |
| closing out | en cierre |
| pay application {n} sent back | solicitud de pago {n} devuelta |
| Work {pct}% done · paid {paid} · held {held} | Avance {pct}% · pagado {paid} · retenido {held} |
| Welcome | Bienvenida |
| Welcome, {name}. | Le damos la bienvenida, {name}. |
| {gc} asked {company} to quote {trade} on {project}. | {gc} invitó a {company} a cotizar {trade} en {project}. |
| {gc} added {company} to its trade partners. | {gc} agregó a {company} a sus subcontratistas. |
| This portal is where you work with us. | En este portal trabaja con nosotros. |
| It holds every job, the plans, your paperwork and your pay. There is no password. The link is yours, so keep it. | Aquí están todos sus trabajos, los planos, sus documentos y sus pagos. No hay contraseña. El enlace es suyo, así que guárdelo. |
| Open the plans before you price. | Abra los planos antes de cotizar. |
| Send your quote by the day it is due. Not for you? Press Pass on this one. | Envíe su cotización antes de la fecha límite. ¿No le interesa? Toque No cotizar este. |
| Send your insurance and W-9 when you can. We need them before any work starts. | Envíe su seguro y su W-9 cuando pueda. Los necesitamos antes de empezar cualquier trabajo. |
| Got it | Entendido |

#### Paperwork

| English | Español |
|---|---|
| Your company | Su empresa |
| Tell us about your company | Cuéntenos de su empresa |
| {gc} checks a company it has not worked with before. You can quote now. {gc} can pick your quote once you are approved. | {gc} revisa a las empresas con las que no ha trabajado. Ya puede cotizar. {gc} puede elegir su cotización cuando apruebe a su empresa. |
| not sent yet | todavía no la envía |
| {gc} is checking it · sent {date} | {gc} la está revisando · enviada el {date} |
| approved | aprobada |
| approved for jobs up to {amount} each | aprobada para trabajos de hasta {amount} cada uno |
| {gc} cannot work with you right now | {gc} no puede trabajar con usted por ahora |
| Your license: its kind and number | Su licencia: el tipo y el número |
| Your insurance company and your limits | Su aseguradora y sus límites |
| Years in business | Años en el negocio |
| Two or three people we can call, with their phone numbers | Dos o tres personas a quienes podemos llamar, con sus teléfonos |
| Jobs like this one you have done | Trabajos como este que ha hecho |
| You can send your quote now. {gc} can pick it once your company is approved. | Ya puede enviar su cotización. {gc} puede elegirla cuando apruebe a su empresa. |
| Your paperwork with {gc} | Sus documentos con {gc} |
| Master agreement | Contrato maestro |
| Read and sign | Leer y firmar |
| {gc} sends it when they pick your quote | {gc} lo envía cuando elige su cotización |
| Insurance certificate | Certificado de seguro |
| Send a newer one | Enviar uno más reciente |
| Send your certificate | Enviar su certificado |
| W-9 | W-9 |
| on file | en archivo |
| none on file | no tenemos |
| ran out {date} | venció el {date} |
| good to {date} | vigente hasta el {date} |
| runs out {date}, in {n} days | vence el {date}, en {n} días |
| runs out tomorrow, {date} | vence mañana, {date} |
| runs out today | vence hoy |
| Fill in your W-9 | Llenar su W-9 |
| You sign the master agreement once. Each job after that is a short statement of work. | El contrato maestro se firma una sola vez. Después, cada trabajo es una orden de trabajo corta. |
| A photo or PDF of the certificate | Una foto o PDF del certificado |
| The day the policy runs out | El día que vence la póliza |
| Send it to {gc} | Enviarlo a {gc} |
| Not now | Ahora no |
| Prototype: sending works without a file. | Prototipo: se puede enviar sin archivo. |
| Business name, as on your taxes | Nombre del negocio, como aparece en sus impuestos |
| What kind of business | Tipo de negocio |
| Tax ID number, nine digits | Número de identificación fiscal, nueve dígitos |
| I certify this W-9 is true. | Certifico que este W-9 es verdadero. |
| Sign the W-9 | Firmar el W-9 |
| LLC | LLC |
| Corporation | Corporación |
| Sole owner | Dueño único |
| Partnership | Sociedad |

#### The master agreement

| English | Español |
|---|---|
| Master agreement | Contrato maestro |
| Between {company} and {gc} | Entre {company} y {gc} |
| Type your full name to sign | Escriba su nombre completo para firmar |
| I read the master agreement and I agree to it. | Leí el contrato maestro y estoy de acuerdo. |
| Sign the master agreement | Firmar el contrato maestro |
| You sign this once. It covers every job you do for {gc}. Each job then gets a short statement of work. | Esto se firma una sola vez. Cubre todos los trabajos que haga para {gc}. Después, cada trabajo lleva una orden de trabajo corta. |
| Each job | Cada trabajo |
| A job starts with a statement of work. You sign it in this portal. It says the work, the price and the plans it is based on. Nothing is owed on a job without one. | Cada trabajo empieza con una orden de trabajo. Usted la firma en este portal. Dice el trabajo, el precio y los planos en que se basa. Sin orden de trabajo no se debe nada. |
| The plans | Los planos |
| Your quote is based on one set of plans. When a new set changes your trade, {gc} tells you. You confirm your quote or send a new one. | Su cotización se basa en un juego de planos. Cuando un juego nuevo cambia su especialidad, {gc} le avisa. Usted confirma su cotización o manda una nueva. |
| Changes | Cambios |
| Work outside the statement of work needs a change in writing first. {gc} adds it to the statement of work before you start it. | El trabajo fuera de la orden de trabajo necesita primero un cambio por escrito. {gc} lo agrega a la orden de trabajo antes de que usted empiece. |
| Your paperwork | Sus documentos |
| Keep your insurance current and a W-9 on file. {gc} cannot send a statement of work or pay a draw without them. | Mantenga su seguro vigente y su W-9 en archivo. Sin ellos, {gc} no puede enviar una orden de trabajo ni pagar. |
| Getting paid | Cómo se le paga |
| Report how far along each line of the work is. Then ask for a draw in this portal. {gc} holds back part of each draw until the job is done. Each statement of work says how much. | Reporte el avance de cada partida del trabajo. Luego pida su pago en este portal. {gc} retiene una parte de cada pago hasta que termine el trabajo. Cada orden de trabajo dice cuánto. |
| Lien waivers | Renuncias de gravamen |
| Sign a conditional waiver when you ask for a draw. Sign the unconditional waiver once that draw is paid. | Firme una renuncia condicional cuando pida un pago. Firme la renuncia incondicional cuando se le pague. |
| Prototype. The real portal shows the Master Subcontract Agreement from the contract library here. | Prototipo. El portal real muestra aquí el Contrato Maestro de Subcontratación de la biblioteca de contratos. |

#### The plans window and the sheet numbers

| English | Español |
|---|---|
| taken out | se quitó |
| Taken out | Se quitaron |
| taken out in {set} | se quitó en {set} |
| Taken out. It stays here so you can read what you priced. | Se quitó. Sigue aquí para que pueda ver lo que cotizó. |
| A newer set revised this section | Un juego más reciente revisó esta sección |
| was {title} | antes {title} |
| renamed | cambió de nombre |
| Taken out in {sets}: | Se quitó en {sets}: |
| {project} · plans | {project} · planos |
| {address} · drawn by {architect} | {address} · dibujado por {architect} |
| newest | más reciente |
| An older set. {label} replaced it. | Un juego anterior. {label} lo reemplazó. |
| This set changes {trade}. | Este juego cambia {trade}. |
| This set does not change {trade}. | Este juego no cambia {trade}. |
| new | nueva |
| changed | cambió |
| added in {set} | agregada en {set} |
| changed in {set} | cambió en {set} |
| ← Back | ← Atrás |
| Next → | Siguiente → |
| Sheet {i} of {n} | Hoja {i} de {n} |
| Plan set | Juego de planos |
| Open {id} | Abrir {id} |
| {sets} touches these lines of your quote. | {sets} toca estas partidas de su cotización. |
| reads every {trade} sheet | usa todas las hojas de {trade} |
| read every {trade} sheet | usan todas las hojas de {trade} |
| Also changed | También cambió |
| Changed in {sets} | Cambió en {sets} |

#### Questions about the plans

| English | Español |
|---|---|
| {trade} · questions about the plans | {trade} · preguntas sobre los planos |
| Ask about the plans. Every company on this trade gets the answer, without your name. | Pregunte sobre los planos. Todas las empresas de esta especialidad reciben la respuesta, sin su nombre. |
| Ask before {date}. Questions close that day. | Pregunte antes del {date}. Ese día se cierran las preguntas. |
| Questions closed {date}, three days before quotes are due. | Las preguntas se cerraron el {date}, tres días antes de la fecha de entrega. |
| Your question | Su pregunta |
| Sheets it is about, if any (like E-301) | Hojas a las que se refiere, si aplica (como E-301) |
| Send the question | Enviar la pregunta |
| You asked {date} | Usted preguntó el {date} |
| Another company asked {date} | Otra empresa preguntó el {date} |
| waiting on {gc} | en espera de {gc} |
| with the architect | con el arquitecto |
| Answer, {date}: | Respuesta, {date}: |
| Part of {set}. | Incluida en {set}. |
| A question about the {trade} plans on {project} has an answer. | Una pregunta sobre los planos de {trade} en {project} tiene respuesta. |
| An answer about the {trade} plans on {project} | Una respuesta sobre los planos de {trade} en {project} |
| A question about the {trade} plans on {project} has an answer. | Una pregunta sobre los planos de {trade} en {project} tiene respuesta. |
| The question: {text} | La pregunta: {text} |
| The answer: {text} | La respuesta: {text} |
| It is part of {set}. | Está incluida en {set}. |

#### Who to call

| English | Español |
|---|---|
| Who to call | A quién llamar |
| superintendent, on site | superintendente en obra |
| project manager | gerente de proyecto |
| project manager, while we bid this job | gerente de proyecto, mientras preparamos nuestra propuesta |
| pay and paperwork | pagos y documentos |
| Call | Llamar |
| Text | Mensaje |
| Email | Correo |
| Questions about pay: {name}, {phone}. | Preguntas sobre pagos: {name}, {phone}. |

#### Your pay

| English | Español |
|---|---|
| Your pay | Sus pagos |
| Every pay application on your jobs with {gc}, newest first. {gc} pays an approved one within {days} days. | Cada solicitud de pago de sus trabajos con {gc}, la más reciente primero. {gc} paga una aprobada en {days} días o menos. |
| See every payment | Ver todos los pagos |
| On the way | En camino |
| {gc} is checking | {gc} está revisando |
| One payment is late. Call {gc}. | Un pago está atrasado. Llame a {gc}. |
| {n} payments are late. Call {gc}. | {n} pagos están atrasados. Llame a {gc}. |
| pay application {n} | solicitud de pago {n} |
| final pay application | solicitud de pago final |
| held {held} | retenido {held} |
| asked {date} | pedido el {date} |
| approved {date} | aprobado el {date} |
| paid {date} | pagado el {date} |
| payment by {date} | pago a más tardar el {date} |
| payment was due {date} | el pago vencía el {date} |
| paid back {date} | devuelto el {date} |
| comes back {date} | se devuelve el {date} |
| comes back after {gc} accepts your work and the owner pays {gc} | se devuelve después de que {gc} acepte su trabajo y el dueño le pague a {gc} |
| contract {contract} · paid {paid} · left to bill {left} | contrato {contract} · pagado {paid} · por facturar {left} |
| No pay applications yet. | Todavía no hay solicitudes de pago. |

#### The weekly look-ahead

| English | Español |
|---|---|
| Your next three weeks | Sus próximas tres semanas |
| {gc} plans these from the schedule. At the end of each week, mark each one done or not done. | {gc} las planea con el calendario de obra. Al final de cada semana, marque cada una como hecha o no hecha. |
| Last week · {date} | Semana pasada · {date} |
| This week · {date} | Esta semana · {date} |
| Next week · {date} | La próxima semana · {date} |
| Week of {date} | Semana del {date} |
| planned {start} to {finish} | planeado del {start} al {finish} |
| Done | Hecho |
| Not done | No hecho |
| Why not? | ¿Por qué no? |
| Send | Enviar |
| Change | Cambiar |
| you marked it done · {gc} will check | lo marcó como hecho · {gc} lo revisará |
| you marked it not done: {reason} · {gc} will check | lo marcó como no hecho: {reason} · {gc} lo revisará |
| {gc} checked: done | {gc} revisó: hecho |
| {gc} checked: not done | {gc} revisó: no hecho |
| {gc} checked: not done, {reason} | {gc} revisó: no hecho, {reason} |
| You had marked it {mark}. | Usted lo había marcado como {mark}. |
| done | hecho |
| not done | no hecho |
| Nothing planned for you this week. | No hay nada planeado para usted esta semana. |
| weather | clima |
| the trade before | el oficio anterior |
| materials | materiales |
| crew | personal |
| other | otro |

#### Their messages

| English | Español |
|---|---|
| What {gc} sent {company}, newest first. Every message carries the same link. | Lo que {gc} envió a {company}, lo más reciente primero. Cada mensaje lleva el mismo enlace. |
| Nothing sent yet. | Todavía no se ha enviado nada. |
| To {contact}, {company} | Para {contact}, {company} |
| Open your portal | Abrir su portal |
| This link is yours. It holds every job you have with us. There is no password. | Este enlace es suyo. Aquí están todos sus trabajos con nosotros. No hay contraseña. |
| Thank you, | Gracias, |
| Hello {first}, | Hola {first}: |
| {gc} asks you to quote {trade} on {project} | {gc} lo invita a cotizar {trade} en {project} |
| We would like your quote for {trade} on {project}. | Nos gustaría recibir su cotización de {trade} para {project}. |
| Your quote is due {date}. | Su cotización vence el {date}. |
| Plans to price: {label}, issued {date}. | Planos para cotizar: {label}, emitidos el {date}. |
| Leave these out. Someone else does them: | No incluya esto. Otra persona lo hace: |
| Your quote should cover these lines. | Su cotización debe incluir estas partidas. |
|  by {date} |  a más tardar el {date} |
| A reminder: {about} | Recordatorio: {about} |
| A reminder about your {trade} quote for {project}. | Le recordamos su cotización de {trade} para {project}. |
| It is due {date}. | Vence el {date}. |
| Open your portal to send it. Not ready? Tell us the day it will come. | Abra su portal para enviarlo. ¿No está listo? Díganos qué día llegará. |
| How the {trade} quotes came in on {project} | Cómo llegaron las cotizaciones de {trade} en {project} |
| Thank you for your quote. We share every bid tab with the companies that quoted. | Gracias por su cotización. Compartimos cada tabla de precios con las empresas que cotizaron. |
| Open your portal to see where you stood. | Abra su portal para ver en qué lugar quedó. |
| {label} for {project} | {label} de {project} |
| {label} for {project} is out. {note} | Ya salió {label} de {project}. {note} |
| It changes {trades}. Open it, then confirm your quote or change it. | Cambia {trades}. Ábralo y luego confirme su cotización o cámbiela. |
| It does not change {trades}. Open it so you price on the newest set. | No cambia {trades}. Ábralo para cotizar con el juego más reciente. |
| Your master agreement with {gc} | Su contrato maestro con {gc} |
| Here is our master agreement. You sign it once, and it covers every job you do for us. | Aquí está nuestro contrato maestro. Se firma una sola vez y cubre todos los trabajos que haga para nosotros. |
| After that, each job is a short statement of work. | Después, cada trabajo es una orden de trabajo corta. |
| Open your portal to read it and sign it. | Abra su portal para leerlo y firmarlo. |
| Your statement of work for {trade} on {project} | Su orden de trabajo de {trade} para {project} |
| We picked your quote for {trade} on {project}. Thank you. | Elegimos su cotización de {trade} para {project}. Gracias. |
| Your statement of work is ready: {price}, based on the {plans}. | Su orden de trabajo está lista: {price}, con base en {plans}. |
| We hold back {pct}% of each draw until the job is done. | Retenemos el {pct}% de cada pago hasta que termine el trabajo. |
| Open your portal to read it and sign it. | Abra su portal para leerla y firmarla. |
| Work starts on {project} {date} | El trabajo en {project} empieza el {date} |
| {project} is started | {project} ya empezó |
| {project} is started. Work begins {date}. | {project} ya empezó. El trabajo comienza el {date}. |
| {project} is started. | {project} ya empezó. |
| Your part is {trades}. | Su parte es {trades}. |
| Report your work in your portal as it goes. That is how you ask for each draw. | Reporte su avance en su portal conforme avance. Así pide cada pago. |
|  {date} |  el {date} |
| Change order {n} on {project} | Orden de cambio {n} de {project} |
| We have a change to your {trade} work on {project}: {description}. | Tenemos un cambio en su trabajo de {trade} en {project}: {description}. |
| It adds {amount} to your statement of work. | Suma {amount} a su orden de trabajo. |
| It takes off {amount} from your statement of work. | Resta {amount} de su orden de trabajo. |
| Open your portal to read it and sign it. | Abra su portal para leerla y firmarla. |
| Pay application {n} on {project} is paid | La solicitud de pago {n} de {project} está pagada |
| Your retainage on {project} is paid | Su retención de {project} está pagada |
| We paid {amount} for pay application {n} on {trade} for {project}. | Pagamos {amount} por la solicitud de pago {n} de {trade} para {project}. |
| We paid back the {amount} we held on {trade} for {project}. | Le devolvimos los {amount} que retuvimos de {trade} en {project}. |
| We hold {amount} of it until the job is done. | Retenemos {amount} hasta que termine el trabajo. |
| Sign the unconditional waiver for it in your portal. | Firme la renuncia incondicional en su portal. |
| Sign your unconditional final release of lien in your portal. | Firme su liberación final de gravamen incondicional en su portal. |
| Your insurance runs out {date} | Su seguro vence el {date} |
| The insurance certificate {gc} has on file for you runs out {date}. | El certificado de seguro que {gc} tiene de usted vence el {date}. |
| We cannot pay a draw without current insurance. | No podemos pagarle sin un seguro vigente. |
| Send the new certificate in your portal. | Envíe el certificado nuevo en su portal. |
| Your company is approved to work with {gc} | Su empresa está aprobada para trabajar con {gc} |
| {gc} checked your company and approved it. | {gc} revisó su empresa y la aprobó. |
| You can be picked for jobs up to {amount} each. | Lo pueden elegir para trabajos de hasta {amount} cada uno. |
| About working with {gc} | Sobre trabajar con {gc} |
| {gc} checked your company and cannot work with you right now. Thank you for your time. | {gc} revisó su empresa y por ahora no puede trabajar con usted. Gracias por su tiempo. |
| {project}: {gc} is not building it | {project}: {gc} no lo va a construir |
| This is about {trade} on {project}. | Le escribimos sobre {trade} en {project}. |
| Pay application {n} on {project}: approved for less | Solicitud de pago {n} de {project}: aprobada por menos |
| We approved {approved} of the {asked} you asked for on pay application {n} for {trade} on {project}. | Aprobamos {approved} de los {asked} que pidió en la solicitud de pago {n} de {trade} para {project}. |
| The rest is still yours to ask for once the work is there. | El resto lo puede pedir cuando el trabajo esté hecho. |
|  soon |  pronto |

#### Needs you

| English | Español |
|---|---|
| Read and sign the master agreement. Your statement of work waits on it. | Lea y firme el contrato maestro. Su orden de trabajo depende de eso. |
| Read and sign the master agreement. | Lea y firme el contrato maestro. |
| Your insurance ran out {date}. Send a new certificate. | Su seguro venció el {date}. Envíe un certificado nuevo. |
| Send your insurance certificate. | Envíe su certificado de seguro. |
| Your insurance runs out {date}, in {n} days. Send a new certificate before then. | Su seguro vence el {date}, en {n} días. Envíe un certificado nuevo antes de esa fecha. |
| Your insurance runs out tomorrow, {date}. Send a new certificate. | Su seguro vence mañana, {date}. Envíe un certificado nuevo. |
| Your insurance runs out today, {date}. Send a new certificate. | Su seguro vence hoy, {date}. Envíe un certificado nuevo. |
| Tell {gc} about your company. {gc} can pick your quote once you are approved. | Cuéntele a {gc} de su empresa. {gc} puede elegir su cotización cuando apruebe a su empresa. |
| Fill in your W-9. | Llene su W-9. |
| The plans changed for {trade} on {project}. Confirm your quote or change it. | Cambiaron los planos de {trade} en {project}. Confirme su cotización o cámbiela. |
| Answer one line of your {trade} quote for {project}. | Conteste una partida de su cotización de {trade} para {project}. |
| Answer {n} lines of your {trade} quote for {project}. | Conteste {n} partidas de su cotización de {trade} para {project}. |
| Your {trade} quote for {project} ran out {date}. Send it again to keep it good. | Su cotización de {trade} para {project} venció el {date}. Envíela de nuevo para que siga válida. |
| You said your {trade} quote for {project} would come {date}. Send it or give a new day. | Usted dijo que su cotización de {trade} para {project} llegaría el {date}. Envíela o dé un nuevo día. |
| Your {trade} quote for {project} was due {date}. | Su cotización de {trade} para {project} venció el {date}. |
| 1 punch item to fix on {trade} for {project}. | Tiene 1 pendiente por arreglar en {trade} para {project}. |
| {n} punch items to fix on {trade} for {project}. | Tiene {n} pendientes por arreglar en {trade} para {project}. |
| {gc} checked one and it is not fixed yet. | {gc} revisó uno y todavía no está arreglado. |
| {gc} checked {n} and they are not fixed yet. | {gc} revisó {n} y todavía no están arreglados. |
| Send your {trade} quote for {project} by {date}. | Envíe su cotización de {trade} para {project} a más tardar el {date}. |
| Open the plans and send your {trade} quote for {project} by {date}. | Abra los planos y envíe su cotización de {trade} para {project} a más tardar el {date}. |
| Open {label} on {project}. It does not change {trade}. | Abra {label} de {project}. No cambia {trade}. |
| See how the {trade} quotes came in on {project}. | Vea cómo llegaron las cotizaciones de {trade} en {project}. |
| Sign your {trade} statement of work for {project}. | Firme su orden de trabajo de {trade} para {project}. |
| Draw {n} on {project} is paid. Sign the unconditional waiver. | El pago {n} de {project} ya se pagó. Firme la renuncia incondicional. |
| {gc} sent pay application {n} on {project} back. Fix it and send it again. | {gc} le devolvió la solicitud de pago {n} de {project}. Corríjala y envíela de nuevo. |
| Send your final pay application for {project}. It asks for the {amount} {gc} holds, with your conditional final release of lien. | Envíe su solicitud de pago final de {project}. Pide los {amount} que {gc} retiene, con su liberación final de gravamen condicional. |
| Your retainage on {project} is paid. Sign your unconditional final release of lien. | Su retención de {project} ya se pagó. Firme su liberación final de gravamen incondicional. |
| You can ask {gc} for {amount} on {project}. | Puede pedirle a {gc} {amount} de {project}. |
| Sign change order {n} on {project}. It adds {amount}. | Firme la orden de cambio {n} de {project}. Suma {amount}. |
| Sign change order {n} on {project}. It takes off {amount}. | Firme la orden de cambio {n} de {project}. Resta {amount}. |
| Mark this week's work on {project}: {n} to mark. | Marque el trabajo de esta semana en {project}: {n} por marcar. |
| Mark last week's work on {project}: {n} still to mark. | Marque el trabajo de la semana pasada en {project}: faltan {n}. |
| {gc} approved {approved} of the {asked} you asked for on {project}. The rest is still yours to ask for. | {gc} aprobó {approved} de los {asked} que pidió en {project}. El resto lo puede seguir pidiendo. |

#### The day a company promised

| English | Español |
|---|---|
| You told {gc} your quote will come by {date}. | Le dijo a {gc} que su cotización llegaría a más tardar el {date}. |
| You told {gc} your quote will come today. | Le dijo a {gc} que su cotización llegaría hoy. |
| You told {gc} your quote would come by {date}. That day passed {ago}. Send your quote or give a new day. | Le dijo a {gc} que su cotización llegaría a más tardar el {date}. Esa fecha pasó {ago}. Envíe su cotización o dé un nuevo día. |
| yesterday | ayer |
| {n} days ago | hace {n} días |

#### Dates and the plans' disciplines

| English | Español |
|---|---|
| Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec | ene feb mar abr may jun jul ago sep oct nov dic |
| Sun Mon Tue Wed Thu Fri Sat | dom lun mar mié jue vie sáb |
| Oct 8 · Thu Oct 8 | 8 oct · jue 8 oct |

| English | Español |
|---|---|
| General | General |
| Civil | Civil |
| Architectural | Arquitectónico |
| Interiors | Interiores |
| Structural | Estructural |
| Mechanical | Mecánico |
| Electrical | Eléctrico |
| Plumbing | Plomería |
| Fire protection | Protección contra incendios |
| Landscape | Paisaje |
| Technology | Tecnología |
| Other | Otras |

### The pay application, closeout and punch list (the Building lane's words, `gcBuildingWords.ts`)

#### The door: a change order to sign

| English | Español |
|---|---|
| Change order {n} to your statement of work. | Orden de cambio {n} a su orden de trabajo. |
| It adds {amount}. | Suma {amount}. |
| It takes {amount} off. | Resta {amount}. |
| Time: {schedule}. | Tiempo: {schedule}. |
| Sign the change | Firmar el cambio |
| Sign the master agreement first. | Primero firme el contrato maestro. |

#### The door: asking for a draw

| English | Español |
|---|---|
| Pay application {n} is with {gc}. They are checking it. | La solicitud de pago {n} está con {gc}. La están revisando. |
| See pay application {n} | Ver la solicitud de pago {n} |
| {gc} sent pay application {n} back {date}. | {gc} le devolvió la solicitud de pago {n} el {date}. |
| Fix it and send it again. | Corríjala y envíela de nuevo. |
| {line}: {gc} sees {n}%. You asked for {m}%. | {line}: {gc} ve {n}%. Usted pidió {m}%. |
| Go on with pay application {n} | Seguir con la solicitud de pago {n} |

#### Short in Spanish: the long form is too wide for a button on a phone (Portal lane, 2026-10-03).

| English | Español |
|---|---|
| Fix and resend pay application {n} | Corregir y reenviar la solicitud {n} |
| Fill out pay application {n} | Llenar la solicitud de pago {n} |
| {gc} approved {x} of the {y} you asked for on pay application {n}. {note} The rest is still yours to ask for. | {gc} aprobó {x} de los {y} que pidió en la solicitud de pago {n}. {note} El resto lo puede seguir pidiendo. |
| You can ask for {amount} now. Most of the pay application is filled in for you. | Puede pedir {amount} ahora. La mayor parte de la solicitud de pago ya está llena. |
| Report your work above. Then fill out the pay application to ask for a draw. | Reporte su avance arriba. Luego llene la solicitud de pago para pedir un pago. |

#### The door once every line is billed: the trade's closeout

| English | Español |
|---|---|
| You are closed out on this job. | Su cierre en este trabajo está completo. |
| {gc} paid back the {amount} it held. Thank you. | {gc} le devolvió los {amount} que retuvo. Gracias. |
| Closeout. | Cierre. |
| All your work is billed. {gc} holds {amount} until the end. That is your retainage. | Todo su trabajo está facturado. {gc} retiene {amount} hasta el final. Esa es su retención. |
| {gc} sent your final pay application back {date}. | {gc} le devolvió su solicitud de pago final el {date}. |
| {gc} accepted your work {date}. | {gc} aceptó su trabajo el {date}. |
| {gc} walks the work with you and checks the punch list. | {gc} revisa el trabajo con usted y la lista de pendientes. |
| Your final pay application is with {gc}. | Su solicitud de pago final está con {gc}. |
| Ask for the {amount} with a final pay application. | Pida los {amount} con una solicitud de pago final. |
| See it | Verla |
| Fill out the final pay application | Llenar la solicitud de pago final |
| It opens once {gc} accepts your work. | Se abre cuando {gc} acepte su trabajo. |
| {gc} paid your retainage. | {gc} le pagó su retención. |
| {gc} approved it. Payment is coming. | {gc} la aprobó. El pago viene en camino. |
| {gc} pays your retainage {date}, {days} days after the owner paid {gc}. | {gc} le paga su retención el {date}, {days} días después de que el dueño le pagó a {gc}. |
| {gc} pays your retainage {days} days after the owner pays {gc} its own. | {gc} le paga su retención {days} días después de que el dueño le pague a {gc} la suya. |
| Sign the unconditional final release of lien below. | Firme abajo su liberación final de gravamen incondicional. |
| Last, you sign the unconditional final release of lien. | Al final, firme su liberación final de gravamen incondicional. |

#### The window's head and a sent application

| English | Español |
|---|---|
| Pay application {n} | Solicitud de pago {n} |
| Final pay application {n} | Solicitud de pago final {n} |
|  · sent back |  · devuelta |
|  · revised |  · corregida |
| {trade} · {company} · {project} · the 702 and 703 forms | {trade} · {company} · {project} · los formularios 702 y 703 |
| Close | Cerrar |
| You sent this {date}. | Usted la envió el {date}. |
| {name} signed it with a {waiver} for {amount}. | {name} la firmó con una {waiver} por {amount}. |
| conditional lien waiver | renuncia condicional |
| conditional final release of lien | liberación final de gravamen condicional |
| This draw was asked for before pay applications. The form is rebuilt from the draw. | Este pago se pidió antes de las solicitudes de pago. El formulario se rehízo a partir del pago. |
| {gc} approved {x} of the {y} asked. | {gc} aprobó {x} de los {y} que se pidieron. |
| {gc} sent it back {date}. | {gc} la devolvió el {date}. |

#### The four steps

| English | Español |
|---|---|
| Check your work | Revise su avance |
| Check it is all done | Revise que todo esté terminado |
| Fill in a few details | Llene unos datos |
| Sign it | Fírmela |
| Send it to {gc} | Envíela a {gc} |
| Done | Listo |
| You are here | Está aquí |
| Waiting | En espera |
| Every line is billed at 100%. This application asks for the retainage. | Todas las partidas están facturadas al 100%. Esta solicitud pide la retención. |
| {gc} sent this back. Its numbers are in where it sees less. Change a line if you see it differently. | {gc} la devolvió. Sus números están donde ve menos avance. Cambie una partida si usted lo ve distinto. |
| Each line starts at what you reported. Change a line if it moved. | Cada partida empieza con lo que usted reportó. Cámbiela si avanzó. |
| Nothing new to bill yet. Raise a line that moved. | Todavía no hay nada nuevo que facturar. Suba una partida que haya avanzado. |
| 100% billed | 100% facturado |
| Retainage held: | Retención: |
|  · paid through {n}% |  · pagado hasta {n}% |
|  · {gc} sees {n}% |  · {gc} ve {n}% |
| {n}% done | {n}% terminado |
| Percent done, {line} | Porcentaje terminado, {line} |
| Work this period: | Trabajo de este periodo: |
| Pick the last day this draw covers. Your address goes on the form. | Elija el último día que cubre este pago. Su dirección va en el formulario. |
| Period ends | Fin del periodo |
| Your mailing address | Su dirección postal |
| On file from your last one. | En archivo de la anterior. |
| We keep it for next time. | Lo guardamos para la próxima vez. |
| Street, city, state, zip | Calle, ciudad, estado, código postal |
| License line | Licencia |
| If your trade needs one. | Si su especialidad la necesita. |
| Type your name and title. Then tick the waiver box. | Escriba su nombre y su puesto. Luego marque la casilla de la renuncia. |
| Your name | Su nombre |
| Your title | Su puesto |
| Owner, office manager | Dueño, gerente de oficina |
| I sign the {waiver} for {amount}. | Firmo la {waiver} por {amount}. |
| Opens when 1 to 3 are done | Se abre cuando los pasos 1 a 3 estén listos |
| {gc} checks it and pays back the retainage. | {gc} la revisa y le devuelve la retención. |
| {gc} checks it and pays the draw. | {gc} la revisa y le paga. |
| You ask for {amount}. That is everything {gc} held back. | Usted pide {amount}. Es todo lo que {gc} retuvo. |
| You ask for {amount}. {gc} holds {pct}% of the work until the end. | Usted pide {amount}. {gc} retiene el {pct}% del trabajo hasta el final. |
| Send to {gc} | Enviar a {gc} |
| The form | El formulario |
| it fills in as you work | se llena mientras usted trabaja |
| You are on step {n} of 4 · {step} | Está en el paso {n} de 4 · {step} |
| All four steps done | Los cuatro pasos están listos |

#### The tags on the form: which step fills which part

| English | Español |
|---|---|
| 1 · Your work | 1 · Su avance |
| 2 · Your details | 2 · Sus datos |
| 3 · You sign here | 3 · Firme aquí |
| 4 · What you ask for | 4 · Lo que pide |

#### The paper: the G702

| English | Español |
|---|---|
| Page 1 · 702 | Página 1 · 702 |
| Page 2 · 703 | Página 2 · 703 |
| Application and certificate for payment | Solicitud y certificado de pago |
| AIA G702 · page 1 of 2 | AIA G702 · página 1 de 2 |
|  · final, retainage release |  · final, liberación de la retención |
| To | Para |
| From | De |
| Contract for | Contrato de |
| Project | Proyecto |
| Via architect | Por medio del arquitecto |
| Application no. | Solicitud n.º |
| Period to | Periodo hasta |
| Contract date | Fecha del contrato |
| Application for payment | Solicitud de pago |
| Original contract sum | Suma original del contrato |
| Net change by change orders | Cambio neto por órdenes de cambio |
| Contract sum to date | Suma del contrato a la fecha |
| Total completed and stored to date, from the 703 | Total terminado y almacenado a la fecha, del 703 |
| Retainage, {pct}% of completed work | Retención, {pct}% del trabajo terminado |
| Retainage, released on this final application | Retención, liberada en esta solicitud final |
| Total earned less retainage | Total ganado menos la retención |
| Less previous certificates for payment | Menos los certificados de pago anteriores |
| Current payment due | Pago actual adeudado |
| Balance to finish, including retainage | Saldo por terminar, incluida la retención |
| Change orders: none on this contract | Órdenes de cambio: ninguna en este contrato |
| Change orders: {n} signed, {amount} in all | Órdenes de cambio: {n} firmadas, {amount} en total |
| The undersigned certifies that the work covered by this application is done as shown. Everyone owed for earlier payments has been paid. The current payment shown is now due. A {waiver} for {amount} is signed with it. | El abajo firmante certifica que el trabajo de esta solicitud está hecho como se muestra. A todos los que se les debía por pagos anteriores ya se les pagó. El pago actual que se muestra ya vence. Con ella se firma una {waiver} por {amount}. |
| Title | Puesto |
| Date | Fecha |
| today | hoy |
| By {name} for {company} | Por {name} para {company} |
| Certificate for payment · {gc} fills this in | Certificado de pago · {gc} lo llena |
| Amount certified | Monto certificado |
| By | Por |

#### The paper: the G703

| English | Español |
|---|---|
| Continuation sheet | Hoja de continuación |
| AIA G703 · page 2 of 2 | AIA G703 · página 2 de 2 |
| Item | Partida |
| Work | Trabajo |
| Scheduled value | Valor programado |
| Previous | Anterior |
| This period | Este periodo |
| Stored | Almacenado |
| Done to date | Terminado a la fecha |
| Balance | Saldo |
| Retainage | Retención |
| Grand total | Total general |

#### The punch list in the trade's portal (2026-10-03)

| English | Español |
|---|---|
| Punch list from {gc} | Lista de pendientes de {gc} |
| {n} to fix | {n} por arreglar |
| It is fixed | Ya está arreglado |
| Waiting on {gc} to check it. | Esperando que {gc} lo revise. |
| {gc} checked it {date}. It is not fixed yet. | {gc} lo revisó el {date}. Todavía no está arreglado. |
| Checked by {gc}: {n}. | Revisados por {gc}: {n}. |
| {label} failed on your work {date}. | {label} no pasó en su trabajo el {date}. |
| The re-inspection is {date}. Fix it before then. | La reinspección es el {date}. Arréglelo antes de esa fecha. |
| Fix each one, then tell {gc} here. {gc} checks it on the job. Your work is accepted once every item is checked. | Arregle cada uno y avísele a {gc} aquí. {gc} lo revisa en la obra. Su trabajo se acepta cuando todos estén revisados. |

### The bid tab (the Board lane's words, `bidTabResult` in `gcBids.ts` and the table in `GcBidTabs.tsx`)

#### The line above the table, in each case

| English | Español |
|---|---|
| Click sent its bid. The owner has not picked a builder yet. | Click envió su propuesta. El dueño todavía no elige constructor. |
| Click sent its bid on Oct 2. The owner has not picked a builder yet. | Click envió su propuesta el 2 oct. El dueño todavía no elige constructor. |
| Click won the project. This trade is not awarded yet. | Click ganó el proyecto. Esta especialidad todavía no se adjudica. |
| Click won the project. This trade is yours. | Click ganó el proyecto. Esta especialidad es suya. |
| Click won the project. This trade went to another company. | Click ganó el proyecto. Esta especialidad fue para otra empresa. |
| Click did not win this project. Thank you for your quote. | Click no ganó este proyecto. Gracias por su precio. |
| The owner stopped this project or put it on hold. Thank you for your quote. | El dueño detuvo este proyecto o lo puso en pausa. Gracias por su precio. |

#### The table

| English | Español |
|---|---|
| Rank | Lugar |
| Company | Empresa |
| Quote | Cotización |
| Over the low | Arriba de la más baja |
| low | la más baja |
| (you) | (usted) |
| awarded | adjudicada |
| Another company | Otra empresa |
