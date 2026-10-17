/**
 * Calls (v2.5596, punch list #115): the app's own call scripts by step, as the residential customer flow is seeded
 * (`20261016050000_call_tasks.sql` writes the same words to `flow_steps.call_script`), and the words the receipt uses
 * until the office writes a script on the step in Settings → Flows. With the quick replies' blanks (`blanks.ts`). Pure.
 */
export interface CallScript {
  text: string
  textEs: string
}

/** The seeded scripts, by the residential flow's step id. */
export const SEED_CALL_SCRIPTS: Readonly<Record<'booked' | 'estimate' | 'approved', CallScript>> = {
  booked: {
    text: 'Hi {first}, this is {me} with Click Plumbing. You should have a text from us with the window for {day}, {window}. Does that still work for you? {tech} will text you when on the way.',
    textEs: 'Hola {first}, le habla {me} de Click Plumbing. Le llegó un mensaje nuestro con la ventana del {day}, {window}. ¿Le sigue funcionando? {tech} le avisará cuando vaya en camino.',
  },
  estimate: {
    text: 'Hi {first}, this is {me} with Click Plumbing. I just sent your estimate for {job}, {amount}. Do you have two minutes for me to walk you through it? You can approve from the link whenever you are ready.',
    textEs: 'Hola {first}, le habla {me} de Click Plumbing. Acabo de enviarle el presupuesto de {job}, {amount}. ¿Tiene dos minutos para que se lo explique? Puede aprobarlo desde el enlace cuando guste.',
  },
  approved: {
    text: 'Hi {first}, this is {me} with Click Plumbing. Checking in on the estimate for {job}. Any questions I can answer before you decide?',
    textEs: 'Hola {first}, le habla {me} de Click Plumbing. Le llamo por el presupuesto de {job}. ¿Tiene alguna pregunta antes de decidir?',
  },
}
