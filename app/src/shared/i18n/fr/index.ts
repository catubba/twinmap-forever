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
  units: {
    yards: '{n} m',
    metres: '{n} m',
  },
  news: {
    title: 'Nouveautés de Twinmap',
    updatedFrom: 'Mis à jour depuis la {version}.',
    again: 'Pour revoir cette fenêtre : {settings}, {button}.',
    button: 'Nouveautés',
    changed: 'Modifié',
    fixed: 'Corrigé',
    done: 'Compris',
    goTo: 'Ouvrir {name}',
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
  language: {
    step: 'Langue',
    title: 'Choisissez votre langue',
    intro: 'La langue de Twinmap. Les noms qui viennent du jeu (zones, PNJ, objets) restent dans la langue de votre jeu.',
    game: 'la langue de votre jeu',
    later: 'Vous pourrez la changer à tout moment dans les Options.',
    newTitle: 'Twinmap parle maintenant votre langue',
    newIntro: 'Choisissez la langue de Twinmap. Sans choix, il reste en anglais.',
    done: 'Valider',
    label: 'Langue de Twinmap',
    hint: 'Change tout de suite. Les noms qui viennent du jeu restent dans la langue du jeu.',
  },
  app,
  map,
  items,
  auction,
  settings,
}
