// Le français de Twinmap: the notes on every key are in en/, the rules and the glossary in the design notes (l10n.md).
import app from './app'
import map from './map'
import items from './items'
import auction from './auction'
import settings from './settings'

export default {
  common: {
    close: 'Fermer',
  },

  participate: {
    title: 'Aidez à améliorer Twinmap',
    what: 'Twinmap peut apprendre de ce que vous voyez en jeu. Si vous partagez, il envoie ce qui l’aide à mieux vous situer dans les donjons et à compléter ce qui manque à la carte : la minicarte dans les donjons, l’endroit où meurent les boss et les rares, les portes des donjons, ce qu’enseignent les maîtres, les créatures, objets et quêtes que Questie ne connaît pas, et les erreurs de Twinmap.',
    anonymous: 'Rien de tout cela ne dit qui vous êtes : ni nom, ni personnage, ni compte.',
    later: 'Vous pouvez changer d’avis à tout moment dans les Options.',
    full: 'Tout ce qui est envoyé',
    yes: 'Oui, partager',
    no: 'Non merci',
  },
  app,
  map,
  items,
  auction,
  settings,
}
