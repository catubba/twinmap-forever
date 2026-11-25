// The workspaces of the app's window (M20): the tabs at the top, each a layout of panels (dockview), kept in
// settings.json with the one open. Only the app's own window keeps them: a phone on the home network has the defaults.

/** The version of what is kept: another one is not read, and the defaults are laid out again. */
export const WORKSPACES_VERSION = 1

/** The panels there are, by their id: a panel of a layout kept that is none of these is taken out, but for Items, which
 * became the four of the Character workspace (M20-F8). */
export const PANELS = ['map', 'now', 'character', 'bags', 'bank', 'inventory', 'ah'] as const

/** The panels of the Character workspace, in the order they are laid out at first. */
export const CHARACTER = ['character', 'bags', 'bank', 'inventory'] as const

/** A workspace by its id; the name the player gave it, if any (without, the default one in the language spoken, never
 * translated once written); its layout as dockview gives it (toJSON). */
export type Workspace = { id: string; name?: string; layout: unknown }

export type Workspaces = { version: typeof WORKSPACES_VERSION; open: number; spaces: Workspace[] }

/** At most this many workspaces. */
export const MOST = 6

/** A name the player writes, at most this long. */
export const NAME_MOST = 32

// The name as written, trimmed and cut short; undefined for none.
const nameOf = (name: unknown): string | undefined => (typeof name === 'string' && name.trim() ? name.trim().slice(0, NAME_MOST) : undefined)

/** What was kept, if it is ours and of this version; undefined otherwise. The layouts are looked into by dockview. */
export function workspacesOf(kept: unknown): Workspaces | undefined {
  if (typeof kept !== 'object' || !kept) return undefined
  const { version, open, spaces } = kept as Record<string, unknown>
  if (version !== WORKSPACES_VERSION || !Array.isArray(spaces) || !spaces.length || spaces.length > MOST) return undefined
  const ok = spaces.every((s: unknown) => {
    if (typeof s !== 'object' || !s) return false
    const { id, layout } = s as Record<string, unknown>
    return typeof id === 'string' && /^[\w-]{1,40}$/.test(id) && typeof layout === 'object' && layout !== null
  })
  if (!ok || new Set(spaces.map((s: Workspace) => s.id)).size !== spaces.length) return undefined
  return {
    version,
    open: Number.isInteger(open) && (open as number) >= 0 && (open as number) < spaces.length ? (open as number) : 0,
    spaces: spaces.map(({ id, name, layout }: Workspace) => {
      const named = nameOf(name)
      return named ? { id, name: named, layout } : { id, layout }
    }),
  }
}
