-- Twinmap Forever, the in-game half. It reads and draws; it never acts for the player.
local _, ns = ...

ns.VERSION = "0.15.1" -- same as the .toc; a test keeps the two in step
ns.PROTOCOL = 2 -- the app refuses a strip whose protocol it does not know; 2 since the app tells everything through the fonts, so that an app from before says to update itself

-- The player's choices, saved by the game in TwinmapForeverDB.
local DEFAULTS = {
  paused = false,    -- true: nothing is drawn
  position = "TOP",  -- edge of the window the strip sits on: "TOP" or "BOTTOM"
  mode = "steady",   -- "steady": every block normal, then in negative. "fast": normal only
  -- Temporary, for the camouflage trials (sliders in Options.lua). These defaults are the values
  -- that hide the strip best on a real screen; the player can still move every one of them.
  on = 30,           -- ms a block stays up; 0: one frame
  neg = 30,          -- ms its negative stays up; 0: one frame
  gap = 0,           -- ms of rest after each showing
  cycles = 1,        -- times a block and its negative are shown
  base = 0,          -- a color channel that is off, of 255
  amp = 50,          -- how much brighter a channel that is on
  idle = "flat",     -- between blocks: "hide", "flat" (an even line), "repeat" (the last block again)
}
ns.DEFAULTS = DEFAULTS

local frame = CreateFrame("Frame")
frame:RegisterEvent("PLAYER_LOGIN")
frame:SetScript("OnEvent", function()
  TwinmapForeverDB = TwinmapForeverDB or {}
  ns.db = TwinmapForeverDB
  -- A default that changed reaches who never moved it: what they have saved is the default of
  -- before. defaults: the last change of this kind the saved choices have been through.
  if (ns.db.defaults or 1) < 2 and ns.db.amp == 100 then ns.db.amp = 50 end
  ns.db.defaults = 2
  for key, value in pairs(DEFAULTS) do
    if ns.db[key] == nil then ns.db[key] = value end
  end
  ns.ready = true
end)

SLASH_TWINMAP1 = "/twinmap"
SlashCmdList["TWINMAP"] = function(msg)
  local word = (msg or ""):lower():match("^%s*(.-)%s*$")
  if word == "skip" then
    if not ns.SkipStop() then ns.Say("command.noRoute") end
  elseif word == "pause" then
    ns.db.paused = not ns.db.paused
    ns.Say(ns.db.paused and "command.paused" or "command.on")
    if ns.linkPaused then ns.Say("command.appPausedToo") end
  else
    print(ns.T("status.version", { version = ns.VERSION, protocol = ns.PROTOCOL }))
    if ns.linkPaused then print(ns.L["status.appPaused"]) end
    if ns.signal ~= "waiting" and ns.signal ~= "reading" then
      print(ns.T("status.noInbox", { why = ns.signal }))
    end
  end
end
