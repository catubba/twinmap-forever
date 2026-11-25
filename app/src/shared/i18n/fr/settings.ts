// Le français des options: les notes sur chaque clé sont dans en/settings.ts.
export default {
  // The game's menu entry is "Options" (GS GAMEMENU_OPTIONS), not "Réglages".
  title: 'Options',
  categories: {
    label: 'Catégories',
    general: 'Général',
    appearance: 'Apparence',
    game: 'Jeu et addons',
    privacy: 'Confidentialité',
    about: 'À propos de Twinmap',
  },

  gameFolder: {
    title: 'Dossier du jeu',
    notFound: 'Introuvable',
    change: 'Changer de dossier',
    choose: 'Choisir le dossier du jeu',
  },

  distances: {
    label: 'Distances',
    yards: 'Yards',
    metres: 'Mètres',
  },

  layout: {
    label: 'Carte',
    left: 'À gauche',
    right: 'À droite',
    hint: 'M la fait passer de l’autre côté à tout moment.',
    custom: 'Votre disposition place la carte : déplacez-la avec {edit}.',
  },

  window: {
    onTop: 'Garder Twinmap au-dessus des autres fenêtres',
    textSize: 'Taille du texte',
    gpu: 'Utiliser l’accélération matérielle',
    gpuHint: 'Désactivez-la si la carte clignote ou reste noire. Sans elle, la vue 3D est plus lente.',
    restartNeeded: 'Prend effet au redémarrage de Twinmap.',
    // "Redémarrer maintenant" is long for a button on the same line: the verb alone says it.
    restartNow: 'Redémarrer',
  },

  phone: {
    title: 'Téléphone et tablette',
    share: 'Afficher la carte sur mes autres appareils',
    codeLabel: 'L’adresse ci-contre, sous forme de code pour l’appareil photo d’un téléphone',
    scan: 'Scannez le code, ou ouvrez',
    homeOnly: 'Uniquement pour les appareils de votre réseau domestique. Windows peut demander une fois de l’autoriser.',
  },

  participate: {
    share: 'Partager des données anonymes sur le monde de Forever',
    // "the doors of dungeons" are the entrances on the map: "entrées", as French players name them. Chat is "Discussion", as in the game.
    what: 'Désactivé tant que vous ne l’activez pas. Twinmap envoie ce qui l’aide à mieux vous situer dans les donjons et à compléter ce qui manque à la carte : la minicarte dans les donjons, l’endroit où meurent les boss et les rares, les entrées des donjons, ce qu’enseignent les maîtres, les créatures, objets et quêtes que Questie ne connaît pas, et ses propres erreurs. Jamais un nom, un personnage, un compte, la discussion ou le reste de votre écran. Désactivez-le et plus rien n’est envoyé.',
  },

  found: {
    inFolder: 'Trouvé dans ce dossier',
    addon: 'Addon Twinmap Forever',
    questie: 'PNJ, services et quêtes',
    optional: 'facultatif',
    installed: 'Installé',
    get: 'Obtenir sur CurseForge',
    map: 'Carte',
    mapLooking: 'Recherche en cours',
    mapNoGame: 'En attente du dossier du jeu',
    // French writes a narrow no-break space before %, as Intl fr-FR does.
    mapBuilding: 'En construction, {percent} %',
    // Feminine: it is "la carte".
    mapFailed: 'Non construite : {message}',
    mapReady: 'Prête, jeu {version}',
  },

  version: {
    updates: 'Se met à jour au démarrage. L’addon se met à jour via CurseForge.',
    report: 'Signaler un bug ou une idée',
    firstRun: 'Refaire les premiers pas',
  },

  keys: {
    // Key Bindings in the game: "Raccourcis" (GS KEY_BINDINGS).
    title: 'Raccourcis',
    layers: 'Filtres',
    follow: 'Activer ou désactiver Suivre',
    north: 'La carte tourne avec votre personnage, ou le nord en haut',
    side: 'Carte de l’autre côté du panneau',
    spaces: 'Les sections du haut, de gauche à droite',
    fullScreen: 'Plein écran',
    ctrl: 'Ctrl',
    zoom: 'Taille du texte, aussi Ctrl et la molette hors de la carte',
    // "ces options": the page is called Options.
    close: 'Ferme une étiquette, les Filtres, ces options',
    arrows: 'Flèches',
    move: 'Déplacer la carte et zoomer',
    // How French players name holding the right button while moving the mouse.
    rightDrag: 'Clic droit maintenu',
    turn: 'Tourner la carte',
    // The game's name of the key (KEY_SPACE).
    space: 'Espace',
    label: 'Étiquette au centre de la carte',
  },

  about: {
    // Product and licence names stay as they are.
    what: 'Une carte en direct de World of Warcraft: Forever pour votre second écran. Logiciel libre sous la GNU General Public License, version 3. Fourni sans aucune garantie.',
    notAffiliated: 'Non affilié à Blizzard Entertainment, ni approuvé par cette société. World of Warcraft est une marque commerciale de Blizzard Entertainment, Inc.',
    // French "one" covers 0 and 1.
    built: {
      one: 'Conçu avec : la licence de {count} projet inclus',
      many: 'Conçu avec : les licences des {count} projets inclus',
      other: 'Conçu avec : les licences des {count} projets inclus',
    },
    seeText: 'Voir le texte',
  },

  feedback: {
    // "Avis", as the button that opens it (fr/app.ts, top.feedback).
    title: 'Avis',
    // A GitHub issue is "ticket", the common French word for it.
    intro: 'Vous avez trouvé un bug ou vous avez une idée ? Dites-le-nous. Écrivez ici et cliquez sur Envoyer, ouvrez un ticket sur GitHub ou écrivez un e-mail. Vous voyez chaque mot avant l’envoi.',
    placeholder: 'Ce qui s’est passé, ou ce que vous aimeriez',
    message: 'Votre message',
    email: 'Votre e-mail, si vous voulez une réponse',
    withLog: 'Joindre le journal',
    send: 'Envoyer',
    sending: 'Envoi',
    github: 'Ouvrir un ticket sur GitHub',
    letter: 'Écrire un e-mail',
    sent: 'Envoyé. Merci.',
    carries: 'Le bouton Envoyer transmet votre message au développeur de Twinmap : le texte que vous avez écrit, les détails affichés ici, et votre e-mail et le journal seulement si vous les ajoutez. Rien n’est envoyé tant que vous n’avez pas cliqué sur Envoyer.',
    privacy: 'Confidentialité',
    // The address goes after a colon, not after "à".
    noGithub: 'Pas de compte GitHub ? Écrivez en anglais ou en italien : {email}',
    details: 'Ce que Twinmap ajoute à votre message',
    logCopy: 'Pour un bug, le journal aide : c’est le relevé que Twinmap tient de ce qui lui arrive (démarrage, jeu trouvé, carte, liaison). Joignez-le à votre envoi, ou copiez-le et collez-le dans un ticket ou un e-mail.',
    log: 'Pour un bug, le journal aide : c’est le relevé que Twinmap tient de ce qui lui arrive (démarrage, jeu trouvé, carte, liaison). Joignez-le à votre envoi.',
    copyDetails: 'Copier les détails',
    copyLog: 'Copier le journal',
    copied: 'Copié',
    close: 'Fermer',
    letterTop: 'Ce qui s’est passé, ou ce que vous aimeriez :',
    fails: {
      empty: 'Écrivez d’abord votre message.',
      tooLong: 'Votre message est trop long : {most} caractères au maximum.',
      tooMany: 'Trop de messages en peu de temps. Attendez une minute et renvoyez-le.',
      badEmail: 'L’adresse e-mail ne semble pas valide.',
      notDelivered: 'Le message n’a pas pu être transmis. Réessayez plus tard, ou passez par GitHub ou par e-mail.',
      noAnswer: 'Pas de réponse du serveur. Vérifiez votre connexion et renvoyez le message.',
    },
  },
}
