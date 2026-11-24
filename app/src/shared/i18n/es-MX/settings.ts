// El español de Latinoamérica de las opciones: the notes on every key are in en/settings.ts.
export default {
  // The game's menu entry is "Opciones" (GS GAMEMENU_OPTIONS), not "Configuración".
  title: 'Opciones',
  categories: {
    label: 'Categorías',
    general: 'General',
    appearance: 'Apariencia',
    game: 'Juego y addons',
    privacy: 'Privacidad',
    about: 'Acerca de Twinmap',
  },

  gameFolder: {
    title: 'Carpeta del juego',
    notFound: 'No encontrada',
    change: 'Cambiar carpeta',
    choose: 'Elegir la carpeta del juego',
  },

  distances: {
    label: 'Distancias',
    yards: 'Yardas',
    metres: 'Metros',
  },

  layout: {
    label: 'Mapa',
    left: 'A la izquierda',
    right: 'A la derecha',
    hint: 'M lo cambia de lado en cualquier momento.',
  },

  window: {
    onTop: 'Mantener Twinmap sobre las demás ventanas',
    textSize: 'Tamaño del texto',
    gpu: 'Usar aceleración por hardware',
    gpuHint: 'Desactívala si el mapa parpadea o se queda en negro. Sin ella, la vista 3D es más lenta.',
    restartNeeded: 'Se aplica al reiniciar Twinmap.',
    restartNow: 'Reiniciar ahora',
  },

  phone: {
    title: 'Celular y tableta',
    share: 'Mostrar el mapa en mis otros dispositivos',
    codeLabel: 'La dirección de al lado, como código para la cámara del celular',
    scan: 'Escanea el código o abre',
    homeOnly: 'Solo para dispositivos en la red de tu casa. Es posible que Windows te pida una vez que lo permitas.',
  },

  participate: {
    share: 'Compartir datos anónimos sobre el mundo de Forever',
    // Rares are "Raro" on the game's map legend. Chat is "Chat", as in the game.
    what: 'Desactivado mientras no lo actives. Twinmap envía lo que le ayuda a ubicarte mejor dentro de los calabozos y a completar lo que le falta al mapa: el minimapa dentro de los calabozos, dónde mueren los jefes y los enemigos raros, las entradas de los calabozos, lo que enseñan los instructores, las criaturas, objetos y misiones que Questie no conoce, y los propios errores de Twinmap. Nunca un nombre, un personaje, una cuenta, el chat ni el resto de tu pantalla. Si lo desactivas, ya no se envía nada.',
  },

  found: {
    inFolder: 'Encontrado en la carpeta',
    // The game says "addon" in its texts (GS DISABLE_ADDONS "Desactivar addons").
    addon: 'Addon Twinmap Forever',
    questie: 'PNJ, servicios y misiones',
    optional: 'opcional',
    installed: 'Instalado',
    get: 'Descargar de CurseForge',
    map: 'Mapa',
    mapLooking: 'Buscando',
    mapNoGame: 'Esperando la carpeta del juego',
    // No space before %, as Intl es-MX writes it.
    mapBuilding: 'Generando, {percent}%',
    // Masculine: it is "el mapa".
    mapFailed: 'No generado: {message}',
    mapReady: 'Listo, juego {version}',
  },

  version: {
    updates: 'Se actualiza al iniciar. El addon se actualiza a través de CurseForge.',
    report: 'Reportar un error o una idea',
    firstRun: 'Repetir los primeros pasos',
  },

  keys: {
    // Key Bindings in the game: "Teclado" (GS KEY_BINDINGS).
    title: 'Teclado',
    layers: 'Filtros',
    follow: 'Activar o desactivar Seguir',
    north: 'El mapa gira con tu personaje, o el norte arriba',
    side: 'Mapa al otro lado del panel',
    fullScreen: 'Pantalla completa',
    ctrl: 'Ctrl',
    zoom: 'Tamaño del texto, también Ctrl y la rueda fuera del mapa',
    // "estas opciones": the page is called Opciones.
    close: 'Cierra una etiqueta, Filtros, estas opciones',
    arrows: 'Flechas',
    move: 'Mover el mapa y hacer zoom',
    // The game's short name of the button (GS KEY_BUTTON2 "Botón dcho. ratón"): the drag goes in turn.
    rightDrag: 'Botón dcho.',
    turn: 'Arrastrar para girar el mapa',
    // The game's "Barra espaciadora" (GS KEY_SPACE) is too long for a key cap.
    space: 'Espacio',
    label: 'Etiqueta en el centro del mapa',
  },

  about: {
    // Product and licence names stay as they are.
    what: 'Un mapa en vivo de World of Warcraft: Forever para tu segunda pantalla. Software libre bajo la GNU General Public License, versión 3. Se ofrece sin ninguna garantía.',
    notAffiliated: 'No está afiliado a Blizzard Entertainment ni cuenta con su respaldo. World of Warcraft es una marca comercial de Blizzard Entertainment, Inc.',
    built: {
      one: 'Creado con: la licencia de {count} proyecto incluido',
      many: 'Creado con: las licencias de los {count} proyectos incluidos',
      other: 'Creado con: las licencias de los {count} proyectos incluidos',
    },
    seeText: 'Ver el texto',
  },

  feedback: {
    title: 'Comentarios',
    // A GitHub issue is "reporte", as Latin American players say it.
    intro: '¿Encontraste un error o tienes una idea? Cuéntanos. Escribe aquí y presiona Enviar, abre un reporte en GitHub o escribe un correo. Verás cada palabra antes de que se envíe.',
    placeholder: 'Qué pasó o qué te gustaría',
    message: 'Tu mensaje',
    email: 'Tu correo, si quieres una respuesta',
    withLog: 'Adjuntar el registro',
    send: 'Enviar',
    sending: 'Enviando',
    github: 'Abrir reporte en GitHub',
    letter: 'Escribir un correo',
    sent: 'Enviado. Gracias.',
    carries: 'Enviar hace llegar tu mensaje al desarrollador de Twinmap: el texto que escribiste, los detalles que se muestran aquí, y tu correo y el registro solo si los adjuntas. No se envía nada hasta que presiones Enviar.',
    privacy: 'Privacidad',
    // The address goes after a colon, not after "a".
    noGithub: '¿No tienes cuenta de GitHub? Escríbenos en inglés o en italiano: {email}',
    details: 'Lo que Twinmap añade a tu mensaje',
    logCopy: 'Si es un error, el registro ayuda: es lo que Twinmap anota de lo que le pasa (inicio, juego encontrado, mapa, conexión). Adjúntalo a tu envío, o cópialo y pégalo en un reporte o un correo.',
    log: 'Si es un error, el registro ayuda: es lo que Twinmap anota de lo que le pasa (inicio, juego encontrado, mapa, conexión). Adjúntalo a tu envío.',
    copyDetails: 'Copiar detalles',
    copyLog: 'Copiar registro',
    copied: 'Copiado',
    close: 'Cerrar',
    letterTop: 'Qué pasó o qué te gustaría:',
    fails: {
      empty: 'Escribe primero tu mensaje.',
      tooLong: 'Tu mensaje es demasiado largo: {most} caracteres como máximo.',
      tooMany: 'Demasiados mensajes en poco tiempo. Espera un minuto y vuelve a enviarlo.',
      badEmail: 'La dirección de correo no parece válida.',
      notDelivered: 'No se pudo entregar el mensaje. Inténtalo más tarde o usa GitHub o el correo.',
      noAnswer: 'El servidor no responde. Revisa tu conexión y vuelve a enviarlo.',
    },
  },
}
