// The English of every text the player sees: the language every other one starts from.
// Each group says where its texts show; a note above a key says what the design notes need to translate it:
// how much room it has, what its {names} are. Keys are named for what they mean: a text whose meaning
// changes gets a new key, so the other languages cannot keep the old meaning without anyone seeing.
// Each area of the app has its file beside this one.
// A group never has a key named `other`: that word marks a text with plural forms ({ one, other }, `count` among its values).
import app from './app'
import map from './map'
import items from './items'
import auction from './auction'
import settings from './settings'

export default {
  // Words used all over the app.
  common: {
    // On a cross that closes a window or panel, read aloud only.
    close: 'Close',
  },

  // The window that asks once, after the first run, to join the participation programme (Participate.svelte).
  participate: {
    title: 'Help improve Twinmap',
    what: "Twinmap can learn from what you see in the game. If you share, it sends what helps it find you better inside dungeons and fill in what the map lacks: the minimap inside dungeons, where bosses and rares die, the doors of dungeons, what trainers teach, the creatures, objects and quests that Questie does not know, and Twinmap's own errors.",
    anonymous: 'None of it says who you are: no name, no character, no account.',
    // Followed on the same line by the link participate.full.
    later: 'You can change your mind at any time in Settings.',
    // A link that opens the full list of what is sent.
    full: 'What is sent, in full',
    // The two buttons, side by side, the same size: short.
    yes: 'Yes, share',
    no: 'No thanks',
  },
  app,
  map,
  items,
  auction,
  settings,
}
