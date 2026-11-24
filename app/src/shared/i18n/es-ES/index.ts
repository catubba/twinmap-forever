// El español de España de Twinmap: the notes on every key are in en/, the rules and the glossary in the design notes (l10n.md).
import app from './app'
import map from './map'
import items from './items'
import auction from './auction'
import settings from './settings'

export default {
  common: {
    close: 'Cerrar',
  },
  units: {
    yards: '{n} m',
    metres: '{n} m',
  },
  news: {
    title: 'Novedades de Twinmap',
    updatedFrom: 'Actualizado desde la {version}.',
    again: 'Para volver a verlo: {settings}, {button}.',
    button: 'Novedades',
    changed: 'Cambios',
    fixed: 'Corregido',
    done: 'Entendido',
    goTo: 'Abrir {name}',
  },

  participate: {
    title: 'Ayuda a mejorar Twinmap',
    what: 'Twinmap puede aprender de lo que ves en el juego. Si compartes, envía lo que le ayuda a situarte mejor dentro de las mazmorras y a completar lo que le falta al mapa: el minimapa dentro de las mazmorras, dónde mueren los jefes y las criaturas poco comunes, las puertas de las mazmorras, lo que enseñan los instructores, las criaturas, objetos y misiones que Questie no conoce, y los errores de Twinmap.',
    anonymous: 'Nada de esto dice quién eres: ni nombre, ni personaje, ni cuenta.',
    later: 'Puedes cambiar de opinión en cualquier momento en las Opciones.',
    full: 'Todo lo que se envía',
    yes: 'Sí, compartir',
    no: 'No, gracias',
  },
  language: {
    step: 'Idioma',
    title: 'Elige tu idioma',
    intro: 'El idioma de Twinmap. Los nombres que vienen del juego (zonas, PNJ, objetos) siguen en el idioma de tu juego.',
    game: 'el idioma de tu juego',
    later: 'Puedes cambiarlo en cualquier momento en las Opciones.',
    newTitle: 'Twinmap ya habla tu idioma',
    newIntro: 'Elige el idioma de Twinmap. Si no eliges ninguno, seguirá en inglés.',
    done: 'Aceptar',
    label: 'Idioma de Twinmap',
    hint: 'Cambia al instante. Los nombres que vienen del juego siguen en el idioma del juego.',
  },
  app,
  map,
  items,
  auction,
  settings,
}
