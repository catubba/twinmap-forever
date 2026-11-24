# Changelog

What changed in each version of Twinmap, newest first. The section of a version is also the text of its release on GitHub and of the addon's file on CurseForge.

## 0.17.0 - 2026-11-24

### New

- **Twinmap on Mac.** Twinmap now runs on Apple Silicon Macs (macOS 14 or later) with the macOS client of WoW: Forever. A download for Mac follows soon; until then the README on GitHub says how to build it. Thanks to markus-barta.
- **What's new.** After an update, Twinmap shows once what changed in the versions you skipped. Settings, About Twinmap, What's new shows it again.
- **Arrival times at your speed.** The time on the label of a point and on the band of the next stop now goes at your character's own speed, and on a mount it says so: "0:50 mounted". Thanks to Stalioot.
- **Metres.** With Twinmap in English or Chinese, Settings, General, Distances writes distances in metres. The numbers stay the game's own, as in the game's clients in other languages: only the unit changes.
- **The line on the side of the game.** In the addon's options, Position now has Left edge and Right edge too, for setups where the top of the game window is covered or off screen, such as a game stretched over two screens.

### Changed

- **Settings in a window.** Settings opens over the map, with its categories in a column on the left. Every choice is one row, and the side of the map is now in Appearance.
- **Layers is now Filters.** The button at the top of the map and its menu have a clearer name. The L key still opens it.

### Fixed

- **Followed in dungeons with the minimap in the corner.** With a minimap of some widths right against the top right corner of the screen, Twinmap did not follow your character inside dungeons. It does now.
- **No more "addon older than this app" by mistake.** A line read while the game was redrawing it could make Twinmap say the addon was too old, with the same version on both sides. Twinmap now believes only a line that checks out.

## 0.16.1 - 2026-11-24

### New

- **Ore and herbs by kind.** In Layers, the arrow beside Ore and beside Herbs opens the list of their kinds, each with the skill it asks, coloured as the game colours it for your Mining or Herbalism. Turn off the kinds you do not want on the map, or tick Hide grey to hide what no longer raises your skill: the list follows you as you learn.
- **Each herb its own icon.** Herbs on the map show their own picture on a dark disc, so Peacebloom and Silverleaf are told apart at a glance.
- **Quest rewards.** The tooltip of a quest icon shows the XP each quest gives your character, and the money it pays for the quests your game has already seen.

### Fixed

- **Ore and herbs in other languages.** With the game in a language other than English, most veins and many herbs were missing from the map since 0.16.0. They are all back, with their names in your game's language.

## 0.16.0 - 2026-11-23

### New

- **Twinmap in eight languages.** English, Français, Deutsch, Español (España), Español (Latinoamérica), Русский, 한국어 and 简体中文: every text of the app and of the addon, written with the words your game uses in each. The first run asks which one, Twinmap asks once after this update if your game is in one of them, and Settings, Language, changes it at any time. If something reads wrong in your language, tell us with Feedback.
- **Names in the language of your game.** Zones, places, quests, NPCs, items, bosses and professions come in the language your game is set to, also when Twinmap speaks another, and the search finds them as the game writes them.

## 0.15.1 - 2026-11-23

### New

- **Hardware acceleration can be turned off.** Settings, Window, Use hardware acceleration. Turn it off if the map flickers or stays black: Twinmap offers to restart, and without it the 3D view is slower.
- **The addon from GitHub.** Every release on GitHub carries the addon's zip too, so addon managers that install from GitHub, such as CurseBreaker and WowUp, can install and update Twinmap Forever. Thanks to burk3.

### Changed

- **A smoother 3D view without the GPU.** When the 3D view is drawn by the processor, its edges are not smoothed: about twice as many frames for the same work, with edges a little rougher.

## 0.15.0 - 2026-11-22

### New

- **Auction House.** A new section after Items, with the prices of the auction house your character sells at. Twinmap finds the house by itself from where you play; the house button picks another one. The categories are the game's own, each kind of an item has its own price ("of the Eagle" is not "of the Monkey"), and the page of an item lists its lots, the cheapest first. The search forgives a wrong letter, with filters for level, quality and price. The prices come every hour and are kept on your computer, so without the network the last ones still show.
- **What your things are worth.** My items, in the Auction House, prices the bags, bank and gear of all your characters on that house, beside what a vendor pays, and says which pays more once the house has taken its cut. The page of an item says who holds it, and for a weapon or a piece of armour what disenchanting it gives on average. Auction prices also show in Items, in a vendor's panel and in the popup of every item.
- **How a price moved.** The page of an item charts its lowest and typical price and how many were on sale, over the last 24 hours or 7 days. The list has a 24 hours column with a small line of the lowest price, green when it went up or stayed, red when it went down.
- **Price alerts.** Set a line on the lowest price of an item, and Twinmap tells you when the price goes below or above it, or when the item is on sale again. A met alert shows in Now, under Attention, and in the new Alerts view, and if you like the addon says it in chat to the character that set it. Alerts are checked while Twinmap is open.
- **The map turns with you.** A click on the compass, or the N key, turns the map so that your character faces up, as Rotate Minimap does in the game, in 2D and in 3D. Another click puts north up again. The 2D map has the compass now, and a drag with the right button turns it by hand.
- **Text size.** Settings, Window, Text size, from 80% to 200%, makes the whole window bigger or smaller, for screens where the text was too small to read. Ctrl with + and -, Ctrl and 0, or Ctrl with the mouse wheel do the same.
- **Pause.** The state of the link at the top of the window is a button now. Press it and Twinmap stops reading the game, and the game stops drawing the line at its edge; the map stays where you were. Press it again and it goes on.

### Changed

- **Keep the minimap clear.** Entering a dungeon or a raid, the addon shows a line in red under the minimap: Twinmap finds your place from that minimap, so keep it clear, not rotated and zoomed all the way out. A right click hides the line until the next dungeon.
- **Items like the Auction House.** The table of Items has the look of the Auction House tables: a heading bar that stays on top as you scroll, and columns you resize with the mouse.
- **Help improve Twinmap** also sends, while it is on, the NPCs you talk to that Questie does not know or places somewhere else, and what the game shows of them. What is sent, in full: [twinmap.app/privacy.html](https://twinmap.app/privacy.html#participation).

### Fixed

- **The world map from a dungeon.** Inside a dungeon, Eastern Kingdoms and Kalimdor now open the continent and keep it on show, where the map went back into the dungeon a moment later. Follow always goes back to your character.

## 0.14.0 - 2026-11-21

### New

- **The panel as wide as you like, the map on either side.** Drag the bronze handle on the edge between the map and the panel to make the panel wider or narrower; a double click puts it back. The button with two arrows on the panel's bar, the M key, or Layout in Settings put the map on the right of the panel instead of the left. The window remembers both.
- **Help improve Twinmap.** A choice, off until you turn it on, that sends anonymous data about the world of Forever so the map can be made right for everyone: pictures of the minimap inside dungeons, where bosses and rares die, the doors of dungeons, what trainers teach, and the creatures, objects and quest steps that Questie has no place for. Nothing sent names you. Twinmap asks you once, and Settings keeps the switch. What is sent, in full: [twinmap.app/privacy.html](https://twinmap.app/privacy.html#participation).

### Changed

- **Your party in the colours of their class.** On the map a warrior is tan and a paladin pink, as in the game.
- **The arrow in the game.** When Shortest Path is not guiding you, Twinmap's arrow in the game is a solid point that turns gold within 30 yards. On a route, the line under the name says which stop of how many; where the game gives no direction, a grey ring takes the arrow's place. The name is one size larger.

### Fixed

- **Thirty folders among your addons.** Twinmap no longer makes the folders TwinmapForever_R01 to R30, which nothing used any more, and takes away those an earlier version left, with the game closed. A folder of the same name that is not Twinmap's own stays.

## 0.13.0 - 2026-11-19

### New

- **Quests from far.** Zoom out past a zone and the quests to take and to hand in stay on the map, where every pin used to go. Those of one kind that would lie on each other become one pin, set a little aside from the others and from your arrow: the pointer on it lists them all with who gives them, and a click goes near enough to tell them apart.
- **An item found opens who sells it.** The search lists an item once for each vendor who sells it, the nearest first. Choose one and the map goes to that vendor, as before, and now the vendor's panel opens too, with everything sold there, the prices and how many you already hold.

### Changed

- **The title from far.** Zoomed out, the map names the continent you are looking at, Eastern Kingdoms or Kalimdor, where it named the zone that happened to be in its middle.
- **The arrow in 3D.** From afar it is half again as large, and nothing lies over it: the pins and the line of a journey leave room round it. In 2D the gold ring of an open label no longer covers it.
- **One click to download.** The buttons on twinmap.app and on GitHub now download the installer itself, where they opened the page of the release.

### Fixed

- **Dun Morogh.** Its vendors, trainers, innkeepers and other services had no pin, nor its ore and its herbs, and neither the search nor Nearby found them: from Kharanos the nearest vendor was said to be in Ironforge. Without Questie, the objectives and the hand-ins of your quests there were missing too. They are all on the map now.
- **Memory on a long journey.** The app took hundreds of MB more as you travelled across a continent, and never gave them back. The same travel now takes about a sixth of that.

The addon is the same as in 0.12.1, with the new number.

## 0.12.1 - 2026-11-19

### Changed

- **Settings, easier to read.** Two columns instead of one long list. On the left, what you choose: the game folder, the window on top, the map on your phone. On the right, what Twinmap found, each with a light: lit when it is there, and with a button to get it when it is not. The shortcuts are shown as keys.
- **Icons in the top row.** Now, Items, Feedback and Settings each have an icon: a map pin, a bag, a bug and a cog. In a narrow window and on a phone the icons stay and the words go, and the search has the room. Feedback is where you report a bug or send an idea.

### Fixed

- **Settings under the window buttons.** In a narrow window Feedback and Settings could end up under the minimize, maximize and close buttons, where they could not be clicked. The top row now makes room.
- **The picture of your character with Auto HDR.** With Auto HDR on in Windows the picture came out far too bright. It now comes out as the game shows it. If yours is too bright, open the character window in game and press Retake in Items.

Both fixes come from messages sent with Feedback: thank you.

The addon is the same as in 0.12.0, with the new number.

## 0.12.0 - 2026-11-19

### New

- **The map in 3D. One switch, 2D or 3D.** A new switch at the top of the map, beside Layers, turns the flat map into the land itself: mountains, valleys, coasts, lakes and rivers in relief, with the game's own ground painted over them. Turn it, tilt it, and zoom from a whole continent down to a single village. Your arrow, your quests, every pin, the names of the places and your route are all there, standing on the ground. Switch back to 2D whenever you like, with the button or with the 3 key: the place and the zoom stay the same. A bronze compass at the bottom left puts the north back up.
- **Look inside the mountains.** In 3D, come close to a cave, a mine or a city dug into the rock, such as Ironforge, and the ground over it opens: you see the rooms where they really are, under the hill, with your arrow and your pins down on their floor.
- **3D on your phone and tablet.** The same switch is on the map you open on your home network. One finger drags the map, two fingers pinch to zoom, turn to turn it and slide up or down to tilt it.
- **Above or below.** When your character is under something it could walk on, in a mine or swimming under a bridge, its arrow fades a little, in 2D and in 3D.
- **The right floor, with Shortest Path Forever 1.43 or later.** Where floors lie over one another, as inside Ironforge or over the canals of Stormwind, the line of your journey keeps to the floor the game guides you on. In 3D it stays on the hill when the way goes over a mine, and goes down inside when the way goes in.

### Changed

- **On a phone, the buttons keep the top row.** On a narrow map the name of the zone and its coordinates now go under the buttons.

The first start after the update builds the 3D ground from your game files, once: about 26 MB more on disk.

This version needs the new addon too: update Twinmap Forever from CurseForge.

## 0.11.1 - 2026-11-18

### New

- **Caves and mines from outside.** A new layer, Caves, under World in Layers, on by default. Zoom in on a zone and the galleries of its caves and mines show through the ground, wherever your character is: you can look into a mine before you go in. Houses keep their roofs. Buildings dug into a hill, as the dwarves' in Dun Morogh, show their inside too.

### Fixed

- **The inside of Ironforge** no longer flickers while you drag the map at one zoom level.

## 0.11.0 - 2026-11-18

### New

- **Your characters.** Twinmap now keeps a sheet of every character you play with the addon on: money, bags, bank, what is worn, statistics, skills, spells and recipes. The character in game is named at the start of the top row; click the name to look at another one. It all reads the same with the game closed. The bank is read when you open it in game, so open it once.
- **Items.** A new section beside Now. On the left, what the character wears, laid out as in the game's character window, with a picture of the character in the middle and its statistics below, the same lines the game shows. On the right, bags, reagent bag, keyring and bank as grids of slots. A filter dims what does not match, and tells you which other character holds what you are looking for. Table shows the same items as a list, with what they are worth at a vendor.
- **The picture of your character.** It is taken off your screen the first time you open the character window in game, and again when you open it wearing something else. Retake takes a new one, Save writes it as a PNG.
- **Item popups.** Hover an item in Items, in a vendor's list or on a trainer's recipe: the game's own tooltip, how worn it is today, who holds it, the nearest vendors that sell it with their price, and who drops it.
- **Vendors and trainers.** Open the label of a vendor or a trainer, from its pin or from the search, and a panel shows what the vendor sells and at what price, with how many you already hold. A class trainer shows what you can learn now, what comes at the next levels and what it costs; a profession trainer shows its recipes, and which you know.
- **Pictures of items.** Items have the game's own picture in the search, in labels and in every list.

### Changed

- **The pin of an open label.** The NPC a label is open on keeps its pin on the map even when its layer is off, with a gold ring around it.

This version needs the new addon too: update Twinmap Forever from CurseForge.

## 0.10.0 - 2026-11-17

### New

- **Relief.** The map shows the shape of the ground: hills, valleys and mountain faces in soft shade, with the light from the north-west. It is a layer of its own, Relief, under World in Layers, and it is on by default. The first start after the update reads the heights from the game's files once: about half a minute, and 80 MB more on disk.
- **The whole journey on the map.** With Shortest Path Forever 1.39 or later, a journey with a flight, a boat, a zeppelin or the tram is drawn on the map leg by leg, each in the colour the game gives it, and the walks between them follow the paths. You no longer need to open the game's world map once for that. With an older Shortest Path the In game band says what to update.

### Changed

- **A dungeon from the search.** A dungeon or a raid chosen in the search now takes the map to its door and opens its label there, as a click on the door does. Dungeon Map, in the label, opens its map, on the wing you searched for.
- **Closing a label.** With a label open, a click elsewhere on the map only closes it. The next click opens a label on its point, as before.
- **Walks on the map** follow the walking grid of Shortest Path Forever 1.41, the one it guides with in the game, and no longer climb faces steeper than the game lets you walk up.
- **Building the map.** While the map is made from the game's files, the app says that this happens only the first time, and again after a game update.

### Fixed

- **The buttons of a dungeon's label.** On a door with one dungeon, the buttons ran out of the label. Dungeon Map now has a row of its own.
- **Walks with the newest Shortest Path.** Since Shortest Path Forever 1.37 the app could not read its walking grid and fell back on an older copy of its own. It reads it again.

## 0.9.0 - 2026-11-16

### New

- **A dungeon's map from outside.** The label of a dungeon's door has a Dungeon Map button (Raid Map for a raid, and one button per map where a door leads to several, as at Ahn'Qiraj). It opens the dungeon's own map, with its rooms, levels, bosses and entrance, while you are still outside. Back to, at the top, takes you back to where you were. The search finds dungeons and raids by name too, and the wings of Scarlet Monastery and Dire Maul open the map on their wing.
- **My pins.** A new band in the Now column lists your saved pins, the nearest first, with how far they are and which way. The search finds them by the names you gave them.
- **Pins that go once you get there.** A pin set in the game with Alt and a click is now temporary: it goes away from the game and the app when you reach it. Save, in its label, keeps it among My pins. The label of a point sent with Send to game closes when you get there too.
- **Bands that fold.** A click on the title of a band (Attention, In game, My pins, Quests, Nearby) folds it away or opens it again. The app remembers which ones are folded.
- **Six more bosses on the dungeon maps.** Ras Frostwhisper, Malor the Zealous, Ribbly Screwspigot, Kirtonos the Herald (at the brazier that calls him), Darkmaster Gandling and Timmy the Cruel now have their skull.
- **Rare bosses.** The seven bosses that are not there in every run, such as Miner Johnson and Skul, have their skull in a silver ring and "(rare)" after their name.

### Fixed

- **Killed bosses in every language.** In a game that is not in English, bosses were never marked as killed. Now they are, with the new version of the addon.
- **A game with another window title.** The app looked for the game's window by its English title, so with the Chinese client it kept saying Game not running. It now finds the game whatever its title.
- **The arrow in the Deadmines cove.** Where the minimap shows nothing, as in the cove of the ship, the arrow could land hundreds of yards off. Now it waits until the minimap shows the place again.
- **Sneed's Shredder** is marked as killed together with Sneed.

## 0.8.0 - 2026-11-15

### New

- **Your corpse and the way back.** When you die the map marks your corpse, the graveyard where your ghost came back, and the way on foot between the two. If you died in a dungeon it marks the door of that dungeon instead: you live again as soon as you walk in. The marks go away when you are alive again. They have a layer of their own, Corpse and graveyard.
- **Attention.** A new block above your quests says what needs you now. Its first line is your corpse, or the dungeon to walk back into, with how far it is.
- **Bosses of the newest dungeons.** The Drowned City, Blackmaw Hold, Alcaz Prison, The Shaper's Terrace and Krol'dok Stronghold have a skull for each boss and their entrance. The places come from players' guides and may be some tens of yards off.

### Changed

- **The doors of dungeons and raids.** A door is now the swirl the game's own maps use, blue for a dungeon and green for a raid, and larger than the other pins.
- **The label of a point.** It opens a little further from its point, and a gold line ties the two, so you see at once which point it speaks of.

### Fixed

- **Bosses that stayed unmarked when killed.** Gelihast, the three Lost Dwarves of Uldaman, Doom'rel, Magmatus, The Baron and the pairs of The Temple of Atal'Hakkar are now marked as killed like the others.

## 0.7.0 - 2026-11-15

### New

- **The newest dungeons of Forever.** The Drowned City, Blackmaw Hold, Alcaz Prison, The Shaper's Terrace and Krol'dok Stronghold now have their map, which is also what your arrow needs to find its place in them. It is built on your computer from your own game, like the others. The bosses of these five are not marked yet.
- **The doors of the dungeons Forever added.** City of Dalaran, The Drowned City, Blackmaw Hold, Alcaz Prison, Excavation Site: Wetlands, Ruins of Lordaeron, The Shaper's Terrace, Krol'dok Stronghold and The Hall of Thanes now have their door on the world map, like the old dungeons.

### Changed

- **Nothing to do to get them.** The first time you open this version the app works for a few seconds on the insides of the dungeons. The map of the continents is not made again.

## 0.6.0 - 2026-11-15

### New

- **Write to us from the app.** The Feedback window now has a field to write in and a Send button: a bug or an idea reaches us without a GitHub account and without your mail program. Your message goes with the details the window shows you, and with your email address and the log only if you add them. Nothing is sent until you press Send. The buttons for GitHub and for email are still there.
- **A privacy page.** [twinmap.app/privacy.html](https://twinmap.app/privacy.html) says what a message carries, where it goes, how long it is kept and how to have it deleted.

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
