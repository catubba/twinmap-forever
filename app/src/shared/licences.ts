// The file THIRD-PARTY-LICENSES, read back into its entries for the About section.

export interface ThirdParty {
  name: string
  /** Who made it, where it is from, what the app uses it for: the lines under its name. */
  about: string
  /** Its licence, in full. */
  licence: string
}

/** Each entry of the file: a heading between two lines of equals signs, then the text up to the next heading. */
export function thirdParties(text: string): ThirdParty[] {
  const parts = text.replace(/\r\n/g, '\n').split(/^={20,}$/m)
  const out: ThirdParty[] = []
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const [name = '', ...about] = parts[i]!.trim().split('\n')
    out.push({ name: name.trim(), about: about.join(' ').replace(/\s+/g, ' ').trim(), licence: parts[i + 1]!.trim() })
  }
  return out
}
