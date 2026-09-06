/**
 * Click's Direct Deposit Authorization — a one-page form the employee fills
 * and signs on the signing page. Routing and account numbers are sensitive:
 * they live only in the signed PDF; the row keeps the last four.
 */
import { newAuthoredDoc, writeAuthored } from './lib'
import { COMPANY, COMPANY_ADDRESS, COMPANY_TAGLINE, OUT_DIR } from './company'

export async function buildDirectDeposit() {
  const { doc, addPage } = await newAuthoredDoc()
  const p = addPage(1)
  p.letterhead(COMPANY, COMPANY_TAGLINE, [COMPANY_ADDRESS])
  p.title('Direct Deposit Authorization')
  p.subtitle('Payroll · complete one form per account. Attach a voided check or a letter from your bank.')

  p.paragraph(
    `I authorize ${COMPANY} to deposit my pay electronically to the account below, and to withdraw from that account any amount deposited in error. This authorization stays in effect until I give ${COMPANY} written notice to change or cancel it, and I understand the office needs up to two pay periods to process a change.`,
    { gapAfter: 8 },
  )

  p.fieldRow([
    { box: { key: 'employee_name', type: 'text', label: 'Your full name', labelEs: 'Su nombre completo', required: true, prefill: 'person_name', sample: 'Taunya Rachelle' }, label: 'Employee name', frac: 0.62 },
    { box: { key: 'employee_phone', type: 'digits', label: 'Your phone', labelEs: 'Su teléfono', mask: '###-###-####', prefill: 'person_phone', sample: '5125550142' }, label: 'Phone', frac: 0.38 },
  ])

  p.paragraph('Bank account', { bold: true, gapAfter: 0 })
  p.fieldRow([
    { box: { key: 'bank_name', type: 'text', label: 'Bank or credit union name', labelEs: 'Nombre del banco o cooperativa', required: true, sample: 'Frost Bank' }, label: 'Bank name', frac: 0.62 },
    { box: { key: 'bank_city_state', type: 'text', label: 'Bank city and state', labelEs: 'Ciudad y estado del banco', sample: 'Austin, TX' }, label: 'City, state', frac: 0.38 },
  ])
  p.fieldRow([
    {
      box: { key: 'routing_number', type: 'digits', label: 'Routing number (9 digits)', labelEs: 'Número de ruta (9 dígitos)', mask: '#########', required: true, sensitive: true, help: 'The nine digits at the bottom left of a check. Kept only in the signed form.', helpEs: 'Los nueve dígitos abajo a la izquierda de un cheque. Se guardan solo en el formulario firmado.', sample: '114000093', fontSize: 11 },
      label: 'Routing number',
      frac: 0.42,
      height: 18,
    },
    {
      box: { key: 'account_number', type: 'text', label: 'Account number', labelEs: 'Número de cuenta', required: true, sensitive: true, maxLength: 17, help: 'Up to 17 digits. Kept only in the signed form.', helpEs: 'Hasta 17 dígitos. Se guarda solo en el formulario firmado.', sample: '0004417802', fontSize: 11 },
      label: 'Account number',
      frac: 0.58,
      height: 18,
    },
  ])
  // Owner ask (2026-09-06): business vs personal matters to the bank file, so four types, one row.
  p.paragraph('Account type', { bold: true, gapAfter: 0 })
  p.checkRow('', [
    { key: 'type_business_checking', label: 'Business checking', labelEs: 'Cheques de negocio', sample: 'true' },
    { key: 'type_business_savings', label: 'Business savings', labelEs: 'Ahorros de negocio' },
    { key: 'type_personal_checking', label: 'Personal checking', labelEs: 'Cheques personal' },
    { key: 'type_personal_savings', label: 'Personal savings', labelEs: 'Ahorros personal' },
  ], 'account_type', 'Account type', true)

  // Owner ask (2026-09-06): a third choice — a percentage of what is due — beside all-or-fixed.
  p.paragraph('How much to deposit', { bold: true, gapAfter: 0 })
  p.checkRow('', [
    { key: 'deposit_all', label: 'My entire net pay', labelEs: 'Todo mi pago neto', sample: 'true' },
    { key: 'deposit_partial', label: 'A fixed dollar amount each pay period (write it below)', labelEs: 'Una cantidad fija en dólares cada período de pago' },
  ], 'deposit_kind', 'How much to deposit', true)
  p.checkRow('', [
    { key: 'deposit_percent', label: 'A percentage of the amount due to me each pay period (write it below)', labelEs: 'Un porcentaje de la cantidad que se me debe cada período de pago' },
  ], 'deposit_kind', 'How much to deposit', true)
  p.fieldRow([
    { box: { key: 'deposit_amount', type: 'text', label: 'Fixed dollar amount per pay period', labelEs: 'Cantidad fija en dólares por período de pago', advanced: true, help: 'Only if you chose a fixed amount above. The rest of your pay is paid by check.', helpEs: 'Solo si eligió una cantidad fija. El resto se paga con cheque.' }, label: 'Fixed amount ($)', frac: 0.26 },
    { box: { key: 'deposit_percent_value', type: 'digits', label: 'Percentage of the amount due', labelEs: 'Porcentaje de la cantidad debida', mask: '###', maxLength: 3, advanced: true, help: 'Only if you chose a percentage above — 1 to 100. The rest of your pay is paid by check.', helpEs: 'Solo si eligió un porcentaje — de 1 a 100. El resto se paga con cheque.' }, label: 'Percentage (%)', frac: 0.22 },
    { box: { key: 'notes', type: 'text', label: 'Anything the office should know', labelEs: 'Algo que la oficina deba saber', advanced: true }, label: 'Notes (optional)', frac: 0.52 },
  ])

  p.paragraph(
    'Attach a voided check or a bank letter showing the routing and account numbers. Your first deposit may be a test deposit, with that pay period paid by paper check.',
    { size: 8.5, gapAfter: 4 },
  )
  p.paragraph('By signing, I confirm the account above is mine and the numbers are correct.', { size: 9.5, bold: true, gapAfter: 0 })
  p.signatureBlock({ signature: 'signature', date: 'date' }, { signature: 'Employee signature', date: 'Date' }, undefined, { signature: 'Firma del empleado', date: 'Fecha' })
  p.footer(`${COMPANY} · Direct Deposit Authorization · v1 (2026-09)`)

  await writeAuthored(doc, p.schema(1), `${OUT_DIR}/direct-deposit-authorization`, 'Direct Deposit Authorization')
}
