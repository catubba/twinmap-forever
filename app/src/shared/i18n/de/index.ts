// Das Deutsch von Twinmap: the notes on every key are in en/, the rules and the glossary in the design notes (l10n.md).
import app from './app'
import map from './map'
import items from './items'
import auction from './auction'
import settings from './settings'

export default {
  common: {
    close: 'Schließen',
  },
  units: {
    yards: '{n} m',
    metres: '{n} m',
  },
  news: {
    title: 'Neu in Twinmap',
    updatedFrom: 'Aktualisiert von {version}.',
    again: 'Wieder anzeigen: {settings}, {button}.',
    button: 'Neuigkeiten',
    changed: 'Geändert',
    fixed: 'Behoben',
    done: 'Verstanden',
    goTo: '{name} öffnen',
  },

  participate: {
    title: 'Helft, Twinmap zu verbessern',
    what: 'Twinmap kann aus dem lernen, was Ihr im Spiel seht. Wenn Ihr teilt, schickt es, was ihm hilft, Euch in Dungeons besser zu finden und zu ergänzen, was der Karte fehlt: die Minikarte in Dungeons, wo Bosse und seltene Gegner sterben, die Eingänge der Dungeons, was Lehrer beibringen, die Kreaturen, Objekte und Quests, die Questie nicht kennt, und die Fehler von Twinmap selbst.',
    anonymous: 'Nichts davon verrät, wer Ihr seid: kein Name, kein Charakter, kein Account.',
    later: 'Ihr könnt es Euch jederzeit in den Optionen anders überlegen.',
    full: 'Alles, was gesendet wird',
    yes: 'Ja, teilen',
    no: 'Nein, danke',
  },
  language: {
    step: 'Sprache',
    title: 'Wählt Eure Sprache',
    intro: 'Die Sprache von Twinmap. Namen aus dem Spiel (Zonen, NSC, Gegenstände) bleiben in der Sprache Eures Spiels.',
    game: 'die Sprache Eures Spiels',
    later: 'Ihr könnt sie jederzeit in den Optionen ändern.',
    newTitle: 'Twinmap spricht jetzt Eure Sprache',
    newIntro: 'Wählt die Sprache von Twinmap. Ohne Auswahl bleibt es Englisch.',
    done: 'Fertig',
    label: 'Sprache von Twinmap',
    hint: 'Ändert sich sofort. Namen aus dem Spiel bleiben in der Sprache des Spiels.',
  },
  app,
  map,
  items,
  auction,
  settings,
}
