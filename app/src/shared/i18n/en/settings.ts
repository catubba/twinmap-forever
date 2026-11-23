// The English of settings: see en/index.ts for how a key is written and noted.
export default {
  // The Settings page (Settings.svelte): its title and the button back, side by side at the top.
  title: 'Settings',
  // A button: short.
  back: 'Back to the map',

  // The group that shows the game folder and lets the player pick it.
  gameFolder: {
    title: 'Game folder',
    // In place of the folder, when none was found.
    notFound: 'Not found',
    // Buttons beside the folder: short.
    change: 'Change folder',
    choose: 'Choose the game folder',
  },

  // The group that puts the map on one side of the panel: two choices, one under the other.
  layout: {
    title: 'Layout',
    mapLeft: 'Map on the left',
    mapRight: 'Map on the right',
  },

  // The group of the app's window: switches, the text size and the hardware acceleration.
  window: {
    title: 'Window',
    onTop: 'Keep Twinmap on top of other windows',
    // Followed by a list of sizes: 80%, 90%, 100%...
    textSize: 'Text size',
    gpu: 'Use hardware acceleration',
    // Under the switch gpu.
    gpuHint: 'Turn it off if the map flickers or stays black. Without it the 3D view is slower.',
    // After the switch gpu is changed, followed on the same line by the button restartNow.
    restartNeeded: 'Takes effect when Twinmap restarts.',
    // A button: short.
    restartNow: 'Restart now',
  },

  // The group that shows the map to a phone or a tablet on the home network.
  phone: {
    title: 'Phone and tablet',
    share: 'Show the map to my other devices',
    // Read aloud only: a square code that a phone's camera reads, beside the address it holds.
    codeLabel: 'The address beside, as a code for the camera of a phone',
    // Beside the code, followed on the next line by the address (http://...).
    scan: 'Scan the code, or open',
    homeOnly: 'For devices on your home network only. Windows may ask once to allow it.',
  },

  // The group of the participation programme: its title is participate.title.
  participate: {
    share: 'Share anonymous data about the world of Forever',
    // Under the switch, followed on the same line by the link participate.full.
    what: "Off unless you turn it on. Twinmap sends what helps it find you better inside dungeons and fill in what the map lacks: the minimap inside dungeons, where bosses and rares die, the doors of dungeons, what trainers teach, the creatures, objects and quests that Questie does not know, and Twinmap's own errors. Never a name, a character, an account, the chat, or the rest of your screen. Turn it off and nothing more is sent.",
  },

  // The group "What Twinmap found": each line a name on the left and, on the right, what was found or a button.
  found: {
    title: 'What Twinmap found',
    addon: 'Twinmap Forever addon',
    // Small, after the name QuestieDB.
    questie: 'NPCs, services and quests',
    // Small, after the name Shortest Path.
    optional: 'optional',
    // On the right of an addon that is there.
    installed: 'Installed',
    // A button on the right of an addon that is missing: short.
    get: 'Get it on CurseForge',
    map: 'Map',
    // On the right of map, how the map stands.
    mapLooking: 'Looking',
    mapNoGame: 'Waiting for the game folder',
    // {percent} is a whole number from 0 to 100.
    mapBuilding: 'Being built, {percent}%',
    // {message} is the error, as the app got it, often in English.
    mapFailed: 'Not built: {message}',
    // {version} is the game's version, such as 1.15.7.
    mapReady: 'Ready, game {version}',
  },

  // The group about the app: its title is "Twinmap" and the version.
  version: {
    updates: 'Updates itself when it starts. The addon updates through CurseForge.',
    // Buttons side by side.
    report: 'Report a bug or an idea',
    firstRun: 'Go through the first steps again',
  },

  // The table of the keyboard shortcuts: each line a key on the left and what it does on the right.
  keys: {
    title: 'Shortcuts',
    // Beside the key L.
    layers: 'Layers',
    // Beside the key F.
    follow: 'Follow on and off',
    // Beside the key N.
    north: 'The map turns with your character, or north up',
    // Beside the key M.
    side: 'Map on the other side of the panel',
    // Beside the key F11.
    fullScreen: 'Full screen',
    // The name of a key: Control, as printed on the keyboards of the language (Strg in German). Short.
    ctrl: 'Ctrl',
    // Beside the keys Ctrl, +, -, 0.
    zoom: 'Text size, also Ctrl and the wheel outside the map',
    // Beside the key Esc.
    close: 'Closes a label, Layers, these settings',
    // The name of a key: the arrow keys. Short.
    arrows: 'Arrows',
    // Beside the keys Arrows, +, -.
    move: 'Move and zoom the map',
    // The name of a key: dragging with the right mouse button. Short.
    rightDrag: 'Right drag',
    // Beside rightDrag.
    turn: 'Turn the map',
    // The name of a key: the space bar. Short.
    space: 'Space',
    // Beside space.
    label: 'Label on the middle of the map',
  },

  // Small print at the bottom of Settings, beside the app's mark.
  about: {
    what: 'A live map of World of Warcraft: Forever for your second screen. Free software under the GNU General Public License, version 3. It comes with no warranty.',
    notAffiliated: 'Not affiliated with or endorsed by Blizzard Entertainment. World of Warcraft is a trademark of Blizzard Entertainment, Inc.',
    // Opens the list of the projects inside the app. {count} is how many.
    built: { other: 'Built with: the licences of the {count} projects inside' },
    // On the right of a project whose licence has no known name: it opens below.
    seeText: 'See the text',
  },

  // The Feedback window (Feedback.svelte), opened from Settings and the menu.
  feedback: {
    title: 'Feedback',
    intro: 'Found a bug, or have an idea? Tell us. Write here and press Send, or open an issue on GitHub, or write an email. You see every word before it leaves.',
    // Inside the empty box where the player writes.
    placeholder: 'What happened, or what you would like',
    // Read aloud only: the box where the player writes.
    message: 'Your message',
    // Inside the empty box of the email, and read aloud.
    email: 'Your email, if you want an answer',
    // A choice with a tick.
    withLog: 'Add the log',
    // The buttons, side by side: short. sending shows on send while the message goes.
    send: 'Send',
    sending: 'Sending',
    github: 'Open an issue on GitHub',
    letter: 'Write an email',
    // Under the buttons, once the message is delivered.
    sent: 'Sent. Thank you.',
    // Followed on the same line by the link privacy.
    carries: 'Send delivers your message to the Twinmap developer: the text you wrote, the details shown here, and your email and the log only if you add them. Nothing is sent until you press Send.',
    // A link to the privacy page: short.
    privacy: 'Privacy',
    // {email} is the developer's address. The developer reads English and Italian only.
    noGithub: 'No GitHub account? Write to {email}, in English or in Italian.',
    // Above the details the app adds, shown as they are (they stay in English).
    details: 'What Twinmap adds to your message',
    // Under the details, when the window can copy (in the app).
    logCopy: "For a bug, the log helps: it is Twinmap's own record of what happened to it (started, game found, map, link). Add it to what you send, or copy it and paste it into an issue or an email.",
    // The same, where the window cannot copy (a phone).
    log: "For a bug, the log helps: it is Twinmap's own record of what happened to it (started, game found, map, link). Add it to what you send.",
    // Buttons at the bottom, side by side: short. copied replaces the one pressed.
    copyDetails: 'Copy details',
    copyLog: 'Copy log',
    copied: 'Copied',
    close: 'Close',
    // At the top of a new GitHub issue or email, above the room for the player's words.
    letterTop: 'What happened, or what you would like:',
    // Under the buttons, in red, when Send fails.
    fails: {
      empty: 'Write your message first.',
      // {most} is the most characters a message may have, written without separators (5000).
      tooLong: 'Your message is too long: {most} characters at most.',
      tooMany: 'Too many messages in a short time. Wait a minute and send again.',
      badEmail: 'The email address does not look right.',
      notDelivered: 'The message could not be delivered. Try again later, or use GitHub or email.',
      noAnswer: 'No answer from the server. Check your connection and send again.',
    },
  },
}
