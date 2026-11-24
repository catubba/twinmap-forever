// El español de Latinoamérica de Twinmap: the notes on every key are in en/, the rules and the glossary in the design notes (l10n.md).
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
    what: 'Twinmap puede aprender de lo que ves en el juego. Si compartes, envía lo que le sirve para ubicarte mejor dentro de los calabozos y completar lo que le falta al mapa: el minimapa dentro de los calabozos, dónde mueren los jefes y las criaturas raras, las puertas de los calabozos, lo que enseñan los instructores, las criaturas, objetos y misiones que Questie no conoce, y los errores de Twinmap.',
    anonymous: 'Nada de esto dice quién eres: ni nombre, ni personaje, ni cuenta.',
    later: 'Puedes cambiar de opinión cuando quieras en Opciones.',
    full: 'Todo lo que se envía',
    yes: 'Sí, compartir',
    no: 'No, gracias',
  },
  language: {
    step: 'Idioma',
    title: 'Elige tu idioma',
    intro: 'El idioma de Twinmap. Los nombres que vienen del juego (zonas, PNJ, objetos) se quedan en el idioma de tu juego.',
    game: 'el idioma de tu juego',
    later: 'Puedes cambiarlo cuando quieras en Opciones.',
    newTitle: 'Twinmap ahora habla tu idioma',
    newIntro: 'Elige el idioma de Twinmap. Si no eliges uno, se queda en inglés.',
    done: 'Aceptar',
    label: 'Idioma de Twinmap',
    hint: 'Cambia de inmediato. Los nombres que vienen del juego se quedan en el idioma del juego.',
  },
  app,
  map,
  items,
  auction,
  settings,
}
