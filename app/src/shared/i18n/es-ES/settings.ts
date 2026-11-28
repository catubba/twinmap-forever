// El español de España de las opciones: the notes on every key are in en/settings.ts.
export default {
  // The game's menu entry is "Opciones" (GS GAMEMENU_OPTIONS), not "Configuración".
  title: 'Opciones',
  categories: {
    label: 'Categorías',
    general: 'General',
    appearance: 'Apariencia',
    graphics: 'Gráficos',
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
    custom: 'Tu disposición coloca el mapa: muévelo con {edit}.',
  },

  mapLook: {
    label: 'Mapa 2D',
    tiles: 'Minimapa',
    parchment: 'Mapa del mundo',
    hint: 'Como mapa del mundo se dibuja igual que el mapa del juego, con cada zona explorada y sin los nombres de lugares de Twinmap. La vista 3D mantiene el minimapa.',
  },

  arrow: {
    title: 'Flecha',
    colour: 'Color',
    size: 'Tamaño',
    default: 'Predeterminado',
  },

  icons: {
    label: 'Iconos del mapa',
    game: 'Juego',
    hint: 'Para misiones disponibles, misiones por entregar y objetivos. Donde los iconos elegidos no tienen uno, se muestra el de Twinmap.',
  },

  objectives: {
    label: 'Objetivos',
    icons: 'Iconos',
    areas: 'Áreas',
    hint: 'Las áreas, como en el mapa del juego, se dibujan alrededor de los lugares donde Questie sitúa cada objetivo.',
  },

  graphics: {
    quality: 'Calidad',
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
    custom: 'Personalizada',
    qualityHint: 'Ajusta todo lo de abajo a la vez. Al cambiar una opción, pasa a Personalizada.',
    view3d: 'Vista 3D',
    buildings: 'Edificios',
    cost: 'Cada opción consume memoria y tiempo de la tarjeta gráfica. Se guarda en esta ventana: el móvil o la tableta guardan su propia elección.',
    trees: 'Árboles',
    density: 'Cuántos árboles',
    few: 'Pocos',
    some: 'Algunos',
    many: 'Muchos',
    treesHint: 'Los bosques densos se aclaran y no se dibujan hojas alrededor del personaje: el suelo y los caminos se ven.',
    objects: 'Objetos',
    objectsHint: 'Vallas, carros, farolas, tiendas, braseros.',
    ground: 'Textura del suelo de cerca',
    groundHint: 'De cerca, el suelo se dibuja con las texturas del juego y se ve nítido.',
    daynight: 'Día y noche',
    daynightHint: 'La luz sigue la hora del día en el juego y por la noche se encienden las ventanas. El anillo bajo el nombre de la zona mueve el sol; un clic vuelve a la hora del juego.',
    dungeons: 'Mazmorra 3D (experimental)',
    dungeonsHint: 'Mazmorras y bandas en la vista 3D, con las salas abiertas desde arriba. Aún en construcción: puede verse mal o ir lenta.',
    memory: 'Memoria de la tarjeta gráfica: {amount}',
    amount: 'unos {mb} MB',
    costMb: '+{mb} MB',
    card: 'Tarjeta gráfica',
  },

  window: {
    onTop: 'Mantener Twinmap sobre las demás ventanas',
    textSize: 'Tamaño del texto',
    gpu: 'Usar aceleración por hardware',
    gpuHint: 'Desactívala si el mapa parpadea o se queda en negro. Sin ella, la vista 3D va más lenta.',
    restartNeeded: 'Se aplica al reiniciar Twinmap.',
    // Restarting the app, as Windows says it; not the game's Reset.
    restartNow: 'Reiniciar ahora',
  },

  phone: {
    title: 'Móvil y tableta',
    share: 'Mostrar el mapa en mis otros dispositivos',
    codeLabel: 'La dirección de al lado, como código para la cámara del móvil',
    scan: 'Escanea el código o abre',
    homeOnly: 'Solo para dispositivos de tu red de casa. Puede que Windows te pida una vez que lo permitas.',
  },

  participate: {
    share: 'Compartir datos anónimos sobre el mundo de Forever',
    // Rares are "Poco común" on the game's map legend. Chat is "Chat", as in the game.
    what: 'Desactivado mientras no lo actives. Twinmap envía lo que le ayuda a situarte mejor dentro de las mazmorras y a completar lo que le falta al mapa: el minimapa dentro de las mazmorras, dónde mueren los jefes y los enemigos poco comunes, las entradas de las mazmorras, lo que enseñan los instructores, las criaturas, objetos y misiones que Questie no conoce, y los propios errores de Twinmap. Nunca un nombre, un personaje, una cuenta, el chat ni el resto de tu pantalla. Si lo desactivas, no se envía nada más.',
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
    // A no-break space before %, as Intl es-ES writes it.
    mapBuilding: 'Generando, {percent} %',
    // Masculine: it is "el mapa".
    mapFailed: 'No generado: {message}',
    mapReady: 'Listo, juego {version}',
  },

  version: {
    updates: 'Se actualiza al iniciarse. El addon se actualiza a través de CurseForge.',
    report: 'Comunicar un error o una idea',
    firstRun: 'Repetir los primeros pasos',
  },

  keys: {
    // "Configurar teclado" (GS KEY_BINDINGS) is a verb, wrong over a table that changes nothing.
    title: 'Atajos de teclado',
    layers: 'Filtros',
    follow: 'Activar o desactivar Seguir',
    north: 'El mapa gira con tu personaje, o el norte arriba',
    side: 'Mapa al otro lado del panel',
    spaces: 'Las secciones de arriba, de izquierda a derecha',
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
    what: 'Un mapa en directo de World of Warcraft: Forever para tu segunda pantalla. Software libre bajo la GNU General Public License, versión 3. Se ofrece sin ninguna garantía.',
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
    // A GitHub issue is "incidencia", as Spanish developers call it.
    intro: '¿Has encontrado un error o tienes una idea? Cuéntanoslo. Escribe aquí y pulsa Enviar, abre una incidencia en GitHub o escribe un correo. Verás cada palabra antes de que se envíe.',
    placeholder: 'Qué ha pasado o qué te gustaría',
    message: 'Tu mensaje',
    email: 'Tu correo, si quieres respuesta',
    withLog: 'Adjuntar el registro',
    send: 'Enviar',
    sending: 'Enviando',
    github: 'Abrir incidencia en GitHub',
    letter: 'Escribir un correo',
    sent: 'Enviado. Gracias.',
    carries: 'Enviar hace llegar tu mensaje al desarrollador de Twinmap: el texto que has escrito, los detalles que se muestran aquí, y tu correo y el registro solo si los adjuntas. No se envía nada hasta que pulses Enviar.',
    privacy: 'Privacidad',
    // The address goes after a colon, not after "a".
    noGithub: '¿No tienes cuenta de GitHub? Escríbenos en inglés o en italiano: {email}',
    details: 'Lo que Twinmap añade a tu mensaje',
    logCopy: 'Si es un error, el registro ayuda: es lo que Twinmap anota de lo que le pasa (inicio, juego encontrado, mapa, conexión). Adjúntalo a tu envío, o cópialo y pégalo en una incidencia o un correo.',
    log: 'Si es un error, el registro ayuda: es lo que Twinmap anota de lo que le pasa (inicio, juego encontrado, mapa, conexión). Adjúntalo a tu envío.',
    copyDetails: 'Copiar detalles',
    copyLog: 'Copiar registro',
    copied: 'Copiado',
    close: 'Cerrar',
    letterTop: 'Qué ha pasado o qué te gustaría:',
    fails: {
      empty: 'Escribe primero tu mensaje.',
      tooLong: 'Tu mensaje es demasiado largo: {most} caracteres como máximo.',
      tooMany: 'Demasiados mensajes en poco tiempo. Espera un minuto y vuelve a enviarlo.',
      badEmail: 'La dirección de correo no parece correcta.',
      notDelivered: 'No se ha podido entregar el mensaje. Inténtalo más tarde o usa GitHub o el correo.',
      noAnswer: 'El servidor no responde. Comprueba tu conexión y vuelve a enviarlo.',
    },
  },
}
