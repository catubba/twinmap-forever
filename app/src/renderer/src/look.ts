// How the map looks, in one place (M21-F1): the colours of its pins (marks.ts), of the character's arrow on the 2D
// map and on the 3D view (Map.svelte, arrow3d.ts) and of its lines (Map.svelte, pins3d.ts), and the arrow until the
// player chooses another in Settings > Appearance (the choice is kept in arrow.svelte.ts).

export const COLOURS = {
  edge: '#000', // round every pin and under every line
  text: '#f3ead9', // what is drawn on a pin: a skull, a flag
  quest: '#ffd100',
  objective: '#ff5a4d',
  areas: ['#ffd166', '#ef476f', '#06d6a0', '#4cc9f0', '#f78c6b', '#c77dff', '#8ac926', '#ff9f1c'], // objectives as areas: a colour each quest (M21-F5)
  service: '#7fc8ff',
  resource: '#d9a066',
  boss: '#a3201a',
  slain: '#3a3431',
  struck: '#e0352b', // the stroke over a boss slain
  rareRing: '#d5d9df',
  rareRingSlain: '#7d8189',
  rare: '#fff6c2',
  corpse: '#b9a88c',
  mine: '#ffd100', // the flag of one of My pins the game's arrow follows
  route: '#fff', // the way of Route
  journey: '#ffd100', // the way of a journey of Shortest Path, and its goal
  wayBack: '#e0703a', // from the graveyard back to the corpse
  flights: '#7fc8ff', // the net of flight routes
  legs: { flight: '#33ff59', boat: '#00bfff', zeppelin: '#ff591a', tram: '#ff8000', lift: '#ff8000' } as Record<string, string>,
} as const

/** The character's arrow as it is until the player chooses: a shape and a style come here too when there is more than one. */
export const ARROW = { colour: '#ffd100', size: 1 }
/** The sizes offered, of the arrow as it was drawn: 28 px on the 2D map, 8 yards and never under 30 px on the 3D view. */
export const ARROW_SIZES = [0.75, 1, 1.25, 1.5, 2]

