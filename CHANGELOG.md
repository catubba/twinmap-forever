# Changelog

What changed in each version of Twinmap, newest first. The section of a version is also the text of its release on GitHub and of the addon's file on CurseForge.

## 0.5.0 - 2026-11-15

### New

- **Your companions inside dungeons.** In a dungeon or a raid the game tells addons nothing of where anyone is, so a companion in there had no disc on the map. Each Twinmap now tells the group the place it finds for its own character, and your companions are on the map of the dungeon with you. Each of them needs Twinmap at this version, app and addon. A companion without it is shown without a place inside, as before.

### Changed

- **What you send to the game arrives without a /reload.** After some pins and routes the app could ask you to type /reload in the game before it would send again. It no longer does: there is no limit to what you send, it arrives in a fight too, and a send the game missed goes again by itself.
- **Update the app and the addon together.** The addon of this version needs the app of this version. If the app says "Update the app", close Twinmap and open it again: it updates itself when it starts. An addon not updated yet still works with the new app.

### Fixed

- **The arrow in the wrong part of a dungeon.** In a dungeon whose parts look alike the arrow could take long to come and then stand in the wrong part, outside every room. Seen in Scarlet Monastery, where a character in the Library was shown in the Graveyard.

## 0.4.0 - 2026-11-14

### New

- **Bosses you killed are marked.** On the map of a dungeon a boss you killed turns dark, with a red cut across its skull and its name struck out. In a raid, where bosses have no place on the map, the name is struck out in the list. The marks stay through a /reload and a walk back in, and start again when the dungeon is reset. Needs the new addon, and for now a game played in English: bosses are told by their names.

### Changed

- **Bosses are skulls, with their names.** A boss on the map of a dungeon was a plain red dot that told its name only under the pointer. It is now a skull on a dark red disc, with its name always written under it.

### Fixed

- **The map is built on a game installed without English.** On a game installed in another language only, the setup stopped at "the game has no table of its maps". Twinmap now reads the game's tables in the language your game has, and the names on the map are in that language.
- **A companion who left the group stays off the map of the dungeon.** Their disc could come back at its last place on your way out.

## 0.3.3 - 2026-11-14

### New

- **Each objective shows what it asks for.** The objectives of your quests were all the same small red dot. They are now larger, with a sign on each: a sword for a creature to slay, a pouch for something to loot, a cog for an object to use, a speech bubble for someone to talk to, a star for a place to reach. A soft red light under them makes them easier to find. Needs the new addon: with the old one the dots stay as they were.

### Changed

- **The corner of the map tells what you are looking at.** When you move the map away from your character, the zone and the coordinates at the top left are now those of the middle of the map, not your character's. Press Follow and they are yours again.

### Fixed

- **The last of the stutter while moving.** About once every twenty seconds the addon still took the game more than five milliseconds in a single frame. That work is now spread over several frames. Update the addon and type /reload once.

## 0.3.2 - 2026-11-14

### New

- **The addon tells you when it is out of date.** When a newer version is on CurseForge, a line in the game's chat says so once each time you log in, until you update. The app is what tells the addon, so it needs Twinmap open. You will see it from the update after this one.

### Changed

- **The line at the edge of the game window is harder to see.** Its two colors are now half as far apart. If you never moved the Contrast slider in the addon's settings, yours takes the new value at your next login; a value you chose stays as it is.
- **Reset to defaults.** The button in the addon's settings now puts back every choice on the page, not the sliders only.

### Fixed

- **A slight stutter in the game while moving.** Drawing the line that carries your position to the app took the game several milliseconds, four times a second while your character moved. On a fast screen it showed as a slight stutter. It now takes about a ninth of that. Thanks to the player who reported it on CurseForge. Update the addon and type /reload once.

## 0.3.1 - 2026-11-14

### Fixed

- **"The map could not be built: not a BLTE container".** On some PCs the game keeps a few of its files in a form Twinmap did not expect, and the map was never built, even with the game fully installed and repaired. Twinmap now reads both forms.

### Changed

- **Updates are quicker, and you see them happen.** Putting a new version in place took about sixteen seconds with nothing on screen, and the app looked closed. It now takes five or six: the small window says what is going on, the installer shows its progress, and Twinmap opens right after. You will see all of it from the update after this one; this one is already a few seconds shorter.

## 0.3.0 - 2026-11-14

### New

- **Your group on the map.** The companions of your party are on the map with you, each one a disc in a colour of their own, with a shield, a cross or a sword on it for tank, healer and damage. Everyone in the party shows, with or without Twinmap; a companion who has Twinmap too is followed more closely when far from you. A new layer, Companions, turns them on and off. Inside dungeons and raids companions are not shown yet. Update the addon and type /reload once.

### Fixed

- **The bottom of the map cut off in a smaller window.** With a long Nearby list, a window that was not full screen lost the bottom of the map, with Follow and the zoom buttons, and the end of the panel. The panel now scrolls and the map stays whole.
- **A clearer error when the map cannot be built.** "not a BLTE container" now says which file of the game could not be read, and tells when the game is not fully downloaded.

## 0.2.0 - 2026-11-13

### New

- **Your quests without Questie.** The map now shows the quests of your log even if you do not use Questie: where to hand in what is done, and where to find what is left. With Questie installed nothing changes, and you also see the quests you can take.

### Changed

- **QuestieDB comes with the addon.** The map reads its NPCs, items and quests from QuestieDB, so the CurseForge app now installs it together with Twinmap Forever. If you install addons by hand, get QuestieDB too. Questie itself stays optional.

## 0.1.2 - 2026-11-13

### Fixed

- **"Type /reload in the game to send again" after a few sends.** With a scaled interface the addon could misread what the app sent, and use up everything it can receive in a couple of minutes, even after a /reload. Send to game, routes and your pins on the game's map now keep working. Update the addon and type /reload once.

### Changed

- **Search finds the nearest seller.** An item sold by more than one vendor showed only one of them, sometimes on the other side of the world. The search now shows the nearest vendors that sell it to your faction.

## 0.1.1 - 2026-11-13

### New

- **Click a pin to open it.** A click on a quest, a service, ore, an herb or the entrance of a dungeon now opens its label: who or what is there, where it is and how far on foot, with Send to game, Add to route and Save. Until now these pins only showed a name under the pointer.

### Changed

- **A fuller record for bug reports.** The record that Feedback copies now lists what the app sent to the game and how many sends the game can still take before a /reload. It holds no positions.

## 0.1.0 - 2026-11-13

The first public version of Twinmap: an interactive map of World of Warcraft: Forever for your second screen, which follows your character in real time.

- **Real-time position.** Your arrow moves on the map as you move in the game.
- **Even inside dungeons.** In dungeons and raids the arrow moves through the rooms, with the bosses marked.
- **Your quests, as Questie shows them.** Available quests, turn-ins and objectives.
- **Services and resources.** Flight masters, inns, vendors, repair, trainers, banks, ore and herbs, each one a layer you turn on or off.
- **Search.** NPCs, items, quests and zones, with the distance on foot.
- **From the map to the game.** Mark a point or build a route on Twinmap, and it appears in the game with an arrow to follow.
- **Phone and tablet.** Open the same map in the browser of a phone, a tablet or a laptop on your home network.
