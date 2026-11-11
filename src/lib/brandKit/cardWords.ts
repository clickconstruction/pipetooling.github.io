/**
 * Cards and footers (punch list #313) — the words on the card *Your card and footer* and on the
 * photo sheet. A first-timer reads them, so they keep to `plainWords.ts`: one idea a sentence,
 * the control's exact name, no glue inside a sentence.
 */

/** The longest a name on the card or a title may be; the database holds both to the same. */
export const CARD_NAME_MAX = 80

export const CARD_WORDS = {
  title: 'Your card and footer',
  lead: 'Your photo and your facts make your email footer and your business card. Change one here and both redraw.',
  loading: 'Reading your card…',
  notRead: 'Your card could not be read.',
  notYet: 'Your card and footer arrive with the next update.',

  addPhoto: 'Add a photo',
  changePhoto: 'Change the photo',
  ringEmpty: 'Add a photo to fill the ring.',

  nameLabel: 'Name on the card',
  nameHint: 'Your full name, as a customer should read it.',
  titleLabel: 'Title',
  titleHint: 'The same title your email signature uses. Leave it empty and the line is left off.',
  emailLabel: 'Email',
  emailHint: 'From My Profile.',
  mobileLabel: 'Mobile',
  mobileHint: 'Your phone in My Profile.',
  officeLabel: 'Office',
  officeHint: 'The company’s line. It is the same for everyone.',
  tooLong: `Keep it to ${CARD_NAME_MAX} characters.`,

  lookLabel: 'Look',
  lookHint: 'The owner approved these. Pick one and your footer and your card both change.',
  lookSaved: 'Look saved',
  lookNotSaved: 'The look was not saved.',

  save: 'Save the card',
  saving: 'Saving…',
  saved: 'Card saved',
  notSaved: 'The card was not saved.',

  footerHead: 'Email footer',
  cardHead: 'Business card',
  downloadPicture: 'Download the picture',
  copyPicture: 'Copy the picture',
  downloadPrint: 'Download the print file',
  downloadSheet: 'Download a sheet of ten',
  making: 'Making it…',
  pictureFoot: 'The picture is the footer as designed. Upload it as your signature in your mail.',
  printFoot: 'The print file is for a print shop. It has the front and the back, with bleed and crop marks. The sheet of ten is for card stock in the office printer.',
  pictureDone: 'Picture downloaded',
  pictureCopied: 'Picture copied. Paste it into your mail.',
  cannotCopy: 'This browser cannot copy a picture. Press Download the picture.',
  printDone: 'Print file downloaded',
  sheetDone: 'Sheet downloaded',
  notMade: 'It could not be made.',

  whereHead: 'Where it goes in your mail',
  where: [
    ['Gmail on a computer.', 'Open Settings, then See all settings, then Signature. Press the Insert image button and choose Upload. Pick the picture. Press Save Changes at the bottom.'],
    ['Gmail on a phone.', 'It uses the signature you set on a computer. It does so unless you set a phone signature.'],
    ['Apple Mail or Outlook.', 'Press Copy the picture. Open the signature settings and paste.'],
  ] as const,

  holdNoPhoto: 'Add a photo to make your footer and your card.',
  holdNoEmail: 'Your account has no email. Add one in My Profile.',
  holdNoName: 'Your account has no name. Add one in My Profile.',

  sheetTitle: 'Your photo',
  sheetLead: 'Drag the picture so the face sits in the ring. Slide to zoom.',
  zoom: 'Zoom',
  takePhoto: 'Take a photo',
  choosePhoto: 'Choose a photo',
  savePhoto: 'Save the photo',
  photoSaved: 'Photo saved',
  photoNotSaved: 'The photo was not saved.',
  photoNotRead: 'That file is not a picture the app can read.',
  sheetFoot: 'The office can see your photo. Nobody else can until you send a footer.',
} as const

/** The same card opened by the office for a teammate: their name leads where "Your" did. */
export function cardWordsFor(teammate: string | null) {
  if (!teammate) return CARD_WORDS
  const first = teammate.trim().split(/\s+/)[0] || teammate
  return {
    ...CARD_WORDS,
    title: `Card and footer for ${teammate}`,
    lead: 'Their photo and their facts make their email footer and their business card. Change one here and both redraw.',
    loading: 'Reading the card…',
    notRead: 'The card could not be read.',
    lookHint: 'The owner approved these. Pick one and their footer and their card both change.',
    nameHint: 'Their full name, as a customer should read it.',
    titleHint: 'The same title their email signature uses. Leave it empty and the line is left off.',
    emailHint: 'Their sign-in email.',
    mobileHint: 'The phone on their account.',
    pictureFoot: 'The picture is the footer as designed. Send it to them to upload as their signature.',
    holdNoPhoto: `Add a photo to make the footer and the card for ${first}.`,
    holdNoEmail: `${first} has no email on their account.`,
    holdNoName: `${first} has no name on their account.`,
    sheetTitle: `Photo for ${teammate}`,
    sheetFoot: 'The office and the person can see this photo. Nobody else can until a footer is sent.',
  }
}

export type CardWords = ReturnType<typeof cardWordsFor>

/** The owner's card, *Card and footer looks*, on Settings → People & teams. */
export const LOOKS_WORDS = {
  title: 'Card and footer looks',
  lead: 'Switch a look on to offer it to the team. The default is what a person gets until they pick.',
  loading: 'Reading the looks…',
  notRead: 'The looks could not be read.',
  defaultLabel: 'Default',
  offered: 'Offered',
  notOffered: 'Not offered',
  defaultStays: 'Pick another default first.',
  saved: 'Looks saved',
  notSaved: 'The looks were not saved.',
  foot: 'Switching a look off moves the people on it to the default. Their next footer and card are drawn in the default.',
} as const

/** How many people a look is drawn for, as the owner's card says it. */
export function lookUseWords(n: number): string {
  return n === 1 ? '1 person uses it.' : `${n} people use it.`
}
