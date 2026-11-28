export function createTrust(): { trusted(session: number | null): boolean; decoded(session: number): void; clear(): void } {
  let trustedSession: number | null = null
  return {
    trusted: session => session !== null && session === trustedSession,
    decoded: session => { trustedSession = session },
    clear: () => { trustedSession = null }
  }
}
