-- Every text the player reads in the game, in the language of the game (GetLocale()). English is where every key
-- starts, with a note on where its text shows; another language is a table of its own, ns.texts.<code>, in a file
-- loaded after this one. A key a language has not got shows its English. The rules for writing a language are in the
-- design notes (l10n.md), with its glossary of the game's own words; the app's texts are in app/src/shared/i18n.
-- The addon's name and the /twinmap commands stay as they are in every language.
local _, ns = ...

ns.texts = {
  enUS = {
    -- A line in the chat. {line}: one of the lines below, which start in lower case.
    ["say"] = "Twinmap Forever: {line}",

    -- /twinmap (TwinmapForever.lua).
    ["command.noRoute"] = "no route to skip on.",
    ["command.paused"] = "strip paused.",
    ["command.on"] = "strip on.",
    ["command.appPausedToo"] = "Twinmap has paused the strip too. Resume it there.",
    -- /twinmap status, each on a line of its own, not after "Twinmap Forever:". {version}: as 0.15.1; {protocol}: a number.
    ["status.version"] = "Twinmap Forever {version}, protocol {protocol}",
    ["status.appPaused"] = "Twinmap has paused the strip. Resume it there, or /reload.",
    -- {why}: a short reason in English, for a report to the developer.
    ["status.noInbox"] = "Nothing can arrive from Twinmap in this session ({why}). Open Twinmap once, then restart the game.",

    -- A newer addon (Inbox.lua). {version}: the newer one; {current}: this one.
    ["inbox.newer"] = "a newer version ({version}) is available on CurseForge. You are using {current}.",

    -- The arrow on screen and what it says in the chat (Arrow.lua, Pin.lua, Marks.lua). {name}: a pin, a stop or a place.
    ["arrow.followed"] = "{name} is followed: the arrow points to it.",
    ["arrow.afterRoute"] = "{name} is followed once the route is done.",
    ["arrow.unfollowed"] = "{name} is no longer followed.",
    ["arrow.nextStop"] = "that is the next stop of the route: /twinmap skip moves on.",
    ["arrow.onRoute"] = "the arrow follows the route: /twinmap skip moves on.",
    ["arrow.arrived"] = "you are at {name}.",
    -- Under the name on the arrow, short. {yards}: a whole number.
    ["arrow.yards"] = "{yards} yd",
    ["arrow.noWay"] = "no direction from here",
    -- {far}: arrow.yards or arrow.noWay; {index} of {count}: the stop of the route.
    ["arrow.stopOf"] = "{far} · stop {index} of {count}",
    -- The name of a pin or a point that came without one.
    ["pin.default"] = "Pin",
    ["pin.point"] = "The point",

    -- The pins on the game's map (Marks.lua): the chat, and the tooltip over a pin.
    ["marks.removed"] = "{name} is no longer among your pins.",
    -- {count}: how many pins the app has not taken yet.
    ["marks.waiting"] = "open Twinmap before setting more pins: it has not taken the last {count} yet.",
    ["marks.set"] = "{name} is a pin until you get there. Save it in Twinmap to keep it.",
    ["marks.tip"] = "Twinmap pin. Click follows it.",
    ["marks.tipFollowed"] = "Twinmap pin, followed. Click stops following it.",
    ["marks.tipRemove"] = "Alt and right click removes it.",

    -- The route (Route.lua). {index} of {count}: the stop reached; {name}: the stop.
    ["route.stop"] = "stop {index} of {count}, {name}.",
    ["route.complete"] = "route complete.",
    -- A stop that came without a name. {index}: its number.
    ["route.defaultStop"] = "Stop {index}",

    -- An alert on a price of the auction house, said once in the chat (Alerts.lua). {item}: its name; {price}: the price
    -- now, in coins; {limit}: the price the player set; {hour}: the hour of the prices, as 14:00.
    ["alerts.again"] = "{item} is on sale again, from {price} at the auction house.",
    ["alerts.againHour"] = "{item} is on sale again, from {price} at the auction house (prices of {hour}).",
    ["alerts.below"] = "{item} is at {price}, below {limit} at the auction house.",
    ["alerts.belowHour"] = "{item} is at {price}, below {limit} at the auction house (prices of {hour}).",
    ["alerts.above"] = "{item} is at {price}, above {limit} at the auction house.",
    ["alerts.aboveHour"] = "{item} is at {price}, above {limit} at the auction house (prices of {hour}).",

    -- The red line under the minimap inside a dungeon, on two lines, and its tooltip (Strip.lua).
    ["strip.reminder"] = "Twinmap: keep the minimap clear,\nnot rotated, zoomed all the way out",
    ["strip.tip"] = "Inside dungeons the app finds your place from this minimap.",
    ["strip.tipHide"] = "Right-click to hide it until the next dungeon.",

    -- The addon's page in the game's settings (Options.lua). A button reads options.row: "Strip: On". Buttons are 180 wide.
    ["options.warning"] = "Photosensitivity warning: Twinmap sends data to the app by changing the colors of a one pixel line at the edge of the game window, many times per second. If flickering light affects you, keep the mode on Steady, or pause the strip. You can also pause it at any time with /twinmap pause.",
    -- {label}: a setting; {value}: its value.
    ["options.row"] = "{label}: {value}",
    ["options.strip"] = "Strip",
    ["options.strip.on"] = "On",
    ["options.strip.paused"] = "Paused",
    ["options.strip.hint"] = "Paused: nothing is drawn, and the app stops following your character.",
    ["options.position"] = "Position",
    ["options.position.top"] = "Top edge",
    ["options.position.bottom"] = "Bottom edge",
    ["options.position.hint"] = "The edge of the game window the line sits on.",
    ["options.mode"] = "Mode",
    ["options.mode.steady"] = "Steady",
    ["options.mode.fast"] = "Fast",
    ["options.mode.hint"] = "Steady: every block is followed by its negative, so the line looks still. Fast: twice the speed, more flicker.",
    ["options.idle"] = "Between blocks",
    ["options.idle.hide"] = "Hidden",
    ["options.idle.flat"] = "Even line",
    ["options.idle.repeat"] = "Repeat last block",
    ["options.idle.hint"] = "Trial. Repeat last block keeps the line busy all the time: the hardest case to hide, and the one to tune on.",
    -- The camouflage trials, temporary: a label above each slider, options.row with the value and its unit.
    ["options.trials"] = "Camouflage trials (temporary)",
    ["options.trials.on"] = "Block shown",
    ["options.trials.neg"] = "Negative shown",
    ["options.trials.gap"] = "Rest after each showing",
    ["options.trials.cycles"] = "Times a block is shown",
    ["options.trials.base"] = "Dark level",
    ["options.trials.amp"] = "Contrast",
    -- {n}: the value of a slider.
    ["options.unit.frames"] = "{n} ms (0: one frame)",
    ["options.unit.ms"] = "{n} ms",
    ["options.unit.of255"] = "{n} of 255",
    ["options.unit.none"] = "{n}",
    ["options.reset"] = "Reset to defaults",
  },
}

-- The texts of the game's language, read when first asked for (every file asks after all are loaded or at load,
-- both after GetLocale() knows). enGB and any language without a table speak English.
ns.L = setmetatable({}, {
  __index = function(_, key)
    local own = ns.texts[GetLocale and GetLocale() or "enUS"]
    return own and own[key] or ns.texts.enUS[key] or key
  end,
})

-- A text with its {names} filled from values. A value is put in as it is, with no pattern read in it.
function ns.T(key, values)
  local text = ns.L[key]
  if not values then return text end
  return (text:gsub("{(%a+)}", function(name)
    local value = values[name]
    if value ~= nil then return tostring(value) end
  end))
end

-- A line in the chat, after the addon's name.
function ns.Say(key, values)
  print(ns.T("say", { line = ns.T(key, values) }))
end
