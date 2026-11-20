/**
 * A picture an email program put inside a mail's words, told by its name alone (v2.7556, v2.7954). It sits on the
 * mail's line as a file like any other, and it is not a set of plans or a paper. The bid's press and the paper's
 * press both ask here (`bidMailSet.ts`, `planSetFiles.ts`), so one rule says what a mail's real files are. Pure.
 */

/** *image001.png*: the picture an email program puts inside the mail's words, most often the logo in a signature. */
const SIGNATURE_PICTURE = /^image\d{0,4}\.(png|jpe?g|gif|bmp)$/i

/**
 * Gmail's picture of a Google Drive link: a long Google key, the size it was drawn at, and a picture's extension,
 * *<key>=w1200-h630-p.png*. The key is one run of letters, digits, dashes and underscores, so a name a person typed
 * (a space, a short word before the *=*) is still a file.
 */
const LINK_PREVIEW_PICTURE = /^[\w-]{20,}=w\d{2,5}-h\d{2,5}(-[a-z0-9]{1,8})*\.(png|jpe?g|gif|webp|bmp)$/i

/**
 * A picture an email program put inside the mail's words, by its name alone. Two kinds: the logo in a signature
 * (*image001.png*, v2.7556, found on the first look at real mail: most mail carries one), and the picture Gmail
 * draws of a Drive link beside the link itself (*<key>=w1200-h630-p.png*, v2.7954, found on job mail whose only
 * content was the link). Either sits on the line as a file like any other, and neither is a set of plans or a
 * paper. A mail that carries nothing else offers no press, and beside a real file it starts unticked. A person
 * can still tick it.
 */
export function isInlinePicture(f: { name: string }): boolean {
  const name = f.name.trim()
  return SIGNATURE_PICTURE.test(name) || LINK_PREVIEW_PICTURE.test(name)
}
