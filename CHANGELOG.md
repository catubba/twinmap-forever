# Changelog

What changed in each version of Twinmap, newest first. The section of a version is also the text of its release on GitHub and of the addon's file on CurseForge.

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
