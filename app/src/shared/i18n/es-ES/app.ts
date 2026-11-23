// El español de España de app: the notes on every key are in en/app.ts.
export default {
  top: {
    sections: 'Secciones',
    now: 'Ahora',
    items: 'Objetos',
    auctionHouse: 'Casa de subastas',
    // The game has no short form of Casa de subastas: CS, as players write it.
    auctionHouseShort: 'CS',
    pause: 'Pausar Twinmap',
    resume: 'Reanudar Twinmap',
    sendsLeft: { one: 'Queda {count} envío', many: 'Quedan {count} envíos', other: 'Quedan {count} envíos' },
    // Our choice: the game has no "Feedback" button. Named again in tiles.failedHelp.
    feedback: 'Comentarios',
    feedbackHint: 'Informar de un error o proponer una idea',
    settings: 'Opciones',
  },

  link: {
    paused: 'En pausa',
    closed: 'Juego cerrado',
    closedLine: 'El juego no está abierto. El mapa sigue funcionando; tu posición aparece cuando entras en el juego.',
    minimized: 'Juego minimizado',
    minimizedLine: 'Juego minimizado. Tu posición aparece cuando su ventana vuelve a la pantalla.',
    // "app" in the short state words, "aplicación" in full sentences.
    updateApp: 'Actualizar la app',
    updateAddon: 'Actualizar el addon',
    newerAddon: 'El addon Twinmap Forever es más reciente que esta aplicación (protocolo {addon}, esta aplicación usa el {app}). Cierra Twinmap y vuelve a abrirlo: se actualiza solo al iniciarse.',
    newerAddonMac: 'El addon Twinmap Forever es más reciente que esta aplicación (protocolo {addon}, esta aplicación usa el {app}). Descarga el Twinmap más reciente para macOS. Si macOS no lo abre, elige "Abrir igualmente" en "Ajustes del Sistema > Privacidad y seguridad".',
    olderAddon: 'El addon Twinmap Forever es más antiguo que esta aplicación (protocolo {addon}, esta aplicación usa el {app}). Actualiza el addon desde CurseForge y reinicia el juego.',
    connecting: 'Conectando',
    lost: 'Conexión perdida',
    lostLine: 'No llega ninguna señal del juego. Inicia sesión y comprueba que el addon Twinmap Forever está activado y que su franja no está en pausa.',
    screenRecording: 'Twinmap aún no puede leer la ventana del juego. Permite Twinmap en "Ajustes del Sistema > Privacidad y seguridad > Grabación de pantalla y del audio del sistema", y luego vuelve a abrir Twinmap.',
    combat: 'En combate, solo posición',
    connected: 'Conectado',
    minimapTurns: 'Dentro de una mazmorra, tu posición se lee del minimapa, y no se puede mientras el minimapa gira: desactiva "Rotar minimapa" en el juego.',
    noRooms: 'Twinmap no tiene imágenes de esta mazmorra: aquí dentro no se muestra tu posición.',
    noMinimap: 'Dentro de una mazmorra, tu posición se lee del minimapa, pero el juego no lo proporciona: actualiza el addon Twinmap Forever y mantén el minimapa en pantalla.',
    looking: 'Buscando tu posición. Se lee del minimapa del juego: mantenlo en pantalla, sin nada encima.',
  },

  map: {
    addonMissing: 'El addon Twinmap Forever no está en tu juego, así que no puede llegar ninguna posición. Descárgalo de CurseForge y reinicia el juego.',
    getAddon: 'Descargar de CurseForge',
    paused: 'Twinmap está en pausa: el mapa se queda donde estabas y no sigue a tu personaje.',
    resume: 'Reanudar',
    unknownZone: 'Zona desconocida',
  },

  tiles: {
    builtOnce: 'Solo ocurre la primera vez y de nuevo tras cada actualización del juego.',
    noGameHelp: 'Elige la carpeta donde está instalado World of Warcraft: Forever, la que contiene _forever_.',
    failedHelp: 'Twinmap no ha podido leer los archivos del juego. Cierra el lanzador del juego si lo está actualizando o reparando y vuelve a intentarlo. Si vuelve a fallar, repara el juego desde el lanzador y avísanos con el botón Comentarios.',
    looking: 'Buscando el juego.',
    noGame: 'No se ha encontrado la carpeta del juego.',
    converting: 'Creando el mapa a partir de los archivos de tu juego, {percent} %.',
    // "teselas": the usual word in Spain for the tiles of a map.
    ready: 'Mapa: {tiles} teselas listas, juego {version}, {rooms} salas',
    readyReading: 'Mapa: {tiles} teselas listas, juego {version}, leyendo las salas',
    readyNoRooms: 'Mapa: {tiles} teselas listas, juego {version}, salas sin leer ({problem})',
    failed: 'No se ha podido crear el mapa: {message}',
    chooseFolder: 'Elegir carpeta del juego',
    retry: 'Reintentar',
  },

  elsewhere: {
    title: 'Termina la configuración en el ordenador',
    text: 'Twinmap aún se está configurando en el ordenador, que indica lo que falta por hacer. El mapa se abrirá aquí automáticamente cuando esté listo.',
  },

  panel: {
    close: 'Cerrar',
    open: 'Misiones y alrededores',
    mapLeft: 'Mapa a la izquierda (M)',
    mapRight: 'Mapa a la derecha (M)',
    showing: 'Mostrando: {name}',
    // A character name is one word with no article, so "a" never needs to become "al".
    backTo: 'Volver a {name}',
    level: 'Nivel {level}',
    levelPercent: 'Nivel {level}, {percent} %',
    xp: '{xp} de {max} PE',
    experience: 'Experiencia',
    width: 'Anchura del panel',
    widthHint: 'Arrastra para cambiar el tamaño. Haz doble clic para reiniciar.',
  },

  now: {
    attention: 'Atención',
    inGame: 'En el juego',
    pins: 'Mis marcas',
    quests: 'Misiones',
    nearby: 'Alrededores',
    handIn: 'Entregar',
    objective: 'Objetivo',
    quest: 'Misión',
    entrance: 'Entrada',
    corpse: 'Cadáver',
    flight: 'Maestro de vuelo',
    inn: 'Tabernero',
    bank: 'Banco',
    auction: 'Subastador',
    // Cut from the game's "Maestro de establos": the word column widens to its longest word and squeezes the name.
    stable: 'Establos',
    trainer: 'Instructor',
    repair: 'Reparación',
    vendor: 'Mercader',
    onSale: 'En venta',
    cheaper: 'Más barato',
    dearer: 'Más caro',
    otherContinent: 'En el otro continente',
    yards: '{yards} m',
    finding: 'Buscando el trayecto',
    updateHint: 'Actualiza Shortest Path y el addon Twinmap Forever para ver aquí todo el trayecto',
  },

  journey: {
    // "Trayecto", not "Ruta": Ruta is Twinmap's own Route.
    name: 'Trayecto',
    seconds: '{seconds} s',
    minutes: '{minutes} min',
    hours: '{hours} h {minutes} min',
  },

  death: {
    corpse: 'Tu cadáver',
  },

  send: {
    pointNoZone: 'Este punto no está en ninguna zona que el juego pueda marcar.',
    stopNoZone: 'Una parada no está en ninguna zona que el juego pueda marcar.',
    notConnected: 'El juego no está conectado.',
    notListening: 'El juego aún no está escuchando. Si sigue así, actualiza el addon y reinicia el juego.',
    reload: 'Escribe /reload en el juego para volver a enviar.',
    restart: 'Reinicia el juego una vez: la conexión desde Twinmap se abrirá la próxima vez que lo inicies.',
    pin: 'Marca',
    stop: 'Parada',
  },

  firstRun: {
    steps: 'Pasos',
    building: 'Creando el mapa',
    secondsLeft: { one: 'queda alrededor de {count} segundo', many: 'quedan unos {count} segundos', other: 'quedan unos {count} segundos' },
    minutesLeft: { one: 'queda alrededor de {count} min', many: 'quedan unos {count} min', other: 'quedan unos {count} min' },
    // "Saltar", as the game's own skip (GS SKIP "Mantener para saltar").
    skip: 'Saltar y ver el mapa',
    back: 'Volver',
    next: 'Siguiente',
    toMap: 'Ir al mapa',
    chooseFolder: 'Elegir carpeta del juego',
    chooseAnother: 'Elegir otra carpeta',
    getAddon: 'Descargar Twinmap Forever de CurseForge',
    getOptional: 'Descargar {name} de CurseForge',
    retry: 'Reintentar',
    photosensitivity: 'Advertencia de fotosensibilidad: el addon envía datos cambiando los colores de una línea de un píxel en el borde de la ventana del juego, muchas veces por segundo. Sus opciones en el juego permiten ralentizarlo o pausarlo.',
    game: {
      title: 'Encontrar el juego',
      intro: 'Twinmap necesita saber dónde está instalado World of Warcraft: Forever. Solo lee esa carpeta; nunca cambia nada en ella.',
      found: 'Encontrado.',
      notFound: 'No se ha encontrado el juego en este PC.',
      choose: 'Elige la carpeta donde está instalado: la que contiene _forever_.',
    },
    map: {
      title: 'Crear el mapa',
      intro: 'Twinmap dibuja su mapa a partir de los archivos de tu propio juego, así que siempre coincide con tu versión del juego. Se hace una vez, y de nuevo solo cuando el juego se actualiza. No se descarga nada.',
      waiting: 'Esperando la carpeta del juego.',
      opening: 'Abriendo los archivos del juego.',
      reading: 'Leyendo las imágenes del mundo del propio juego.',
      failed: 'No se ha podido crear el mapa.',
      ready: 'El mapa está listo.',
      tiles: '{count} teselas de la versión {version} del juego.',
    },
    addon: {
      title: 'Obtener el addon',
      intro: 'El addon Twinmap Forever le dice a esta aplicación dónde está tu personaje. Se instala como cualquier otro addon, desde CurseForge.',
      installed: 'Instalado.',
      inFolder: 'Twinmap Forever {version} está en la carpeta AddOns del juego.',
      notYet: 'Aún no está instalado.',
      howTo: 'Instálalo con la aplicación de CurseForge. Sin esa aplicación, descarga el archivo desde la misma página y descomprímelo en _forever_\\Interface\\AddOns.',
      howToMac: 'Instálalo con la aplicación de CurseForge. Sin esa aplicación, descarga el archivo desde la misma página y descomprímelo en _forever_/Interface/AddOns.',
      notices: 'Esta página detecta por sí sola cuando el addon está instalado.',
    },
    extras: {
      title: 'Addons opcionales',
      intro: 'Ninguno es necesario. Cuando uno está instalado, Twinmap muestra más.',
      questie: 'QuestieDB: instalado. El mapa muestra quién ofrece cada servicio, los minerales, las hierbas y las misiones de tu registro. Si además tienes Questie activo, muestra las mismas misiones que Questie, incluidas las que puedes aceptar.',
      noQuestie: 'QuestieDB: no instalado. Viene con Twinmap Forever desde la aplicación de CurseForge. Sin él, el mapa no muestra PNJ, servicios ni misiones.',
      shortestPath: 'Shortest Path: instalado. El mapa mostrará su trayecto, y los destinos que envíes al juego se alcanzarán por los caminos.',
      noShortestPath: 'Shortest Path: no instalado. Con él, el mapa muestra el trayecto que planea, y los destinos que envíes al juego se alcanzan por los caminos.',
    },
    play: {
      title: 'Iniciar el juego',
      // "entra en el mundo", as the game's button (GS ENTER_WORLD "Entrar en el mundo").
      intro: 'Inicia World of Warcraft: Forever y entra en el mundo con un personaje. Tu posición aparecerá aquí automáticamente.',
      connected: 'Conectado. Tu posición está llegando.',
      silent: 'El juego está abierto, pero aún no llega nada del addon.',
      minimized: 'El juego está minimizado. Vuelve a poner su ventana en pantalla.',
      waiting: 'Esperando el juego.',
      // "Addons" is how the esES character list button is written (GS ADDONS).
      tick: 'En la lista de personajes, abre Addons y asegúrate de que Twinmap Forever esté marcado.',
    },
  },

  update: {
    updating: 'Actualizando',
    updatingTo: 'Actualizando a la versión {version}',
    installing: 'Instalando la versión {version}',
    reopen: 'Twinmap se volverá a abrir en unos segundos',
    downloading: 'Descargando la nueva versión',
  },

  web: {
    noAnswer: 'Twinmap en el ordenador no ha respondido.',
    chooseOnComputer: 'Elige la carpeta del juego en Twinmap, en el ordenador.',
  },

  main: {
    pickFolder: '¿Dónde está instalado World of Warcraft: Forever?',
    notGame: 'World of Warcraft: Forever no está en esa carpeta. Elige la que contiene _forever_.',
    savePicture: 'Guardar la imagen: {name}',
    noNetwork: 'Este ordenador no está conectado a ninguna red local.',
    portTaken: 'Otro programa está usando el puerto {port}.',
    scanAgain: 'Abre las opciones de Twinmap en el ordenador y vuelve a escanear el código.',
    nothingToSend: 'No hay nada que enviar.',
    cannotWrite: 'Twinmap no ha podido escribir junto al addon en la carpeta del juego.',
  },

  found: {
    npc: 'PNJ',
    // "ofrecida por", not "de {giver}": "por" never joins with an article (de El, del).
    quest: 'Misión ofrecida por {giver}',
    questLevel: 'Misión de nivel {level}, ofrecida por {giver}',
    soldBy: 'Mercader: {name}',
    // As the game's "Botín de jefe: %s".
    droppedBy: 'Botín: {name}',
    foundIn: 'Encontrado en {name}',
    questNumber: 'Misión {id}',
    // Under an NPC: the game's names of the NPCs themselves (minimap tracking), lower case.
    services: {
      flight: 'maestro de vuelo',
      inn: 'tabernero',
      vendor: 'mercader',
      repair: 'reparación',
      trainer: 'instructor',
      bank: 'banquero',
      auction: 'subastador',
      stable: 'maestro de establos',
    },
  },
}
