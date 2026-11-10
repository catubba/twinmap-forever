-- Twinmap Forever, the in-game half. It reads and draws; it never acts for the player.
local _, ns = ...

ns.VERSION = "0.0.0" -- same as the .toc; a test keeps the two in step
ns.PROTOCOL = 1 -- the app refuses a strip whose protocol it does not know

-- The player's choices, saved by the game in TwinmapForeverDB.
local DEFAULTS = {
  paused = false,    -- true: nothing is drawn
  position = "TOP",  -- edge of the window the strip sits on: "TOP" or "BOTTOM"
  mode = "steady",   -- "steady": every block normal, then in negative. "fast": normal only
  -- Temporary, for the camouflage trials (sliders in Options.lua). These defaults are the strip as
  -- measured in M1-F5; once values are chosen they become constants in Strip.lua and the sliders go.
  on = 50,           -- ms a block stays up; 0: one frame
  neg = 50,          -- ms its negative stays up; 0: one frame
  gap = 0,           -- ms of rest after each showing
  cycles = 1,        -- times a block and its negative are shown
  base = 0,          -- a color channel that is off, of 255
  amp = 255,         -- how much brighter a channel that is on
  idle = "hide",     -- between blocks: "hide", "flat" (an even line), "repeat" (the last block again)
}
ns.DEFAULTS = DEFAULTS

local frame = CreateFrame("Frame")
frame:RegisterEvent("PLAYER_LOGIN")
frame:SetScript("OnEvent", function()
  TwinmapForeverDB = TwinmapForeverDB or {}
  ns.db = TwinmapForeverDB
  for key, value in pairs(DEFAULTS) do
    if ns.db[key] == nil then ns.db[key] = value end
  end
  ns.ready = true
end)

SLASH_TWINMAP1 = "/twinmap"
SlashCmdList["TWINMAP"] = function(msg)
  if (msg or ""):lower():match("^%s*(.-)%s*$") == "pause" then
    ns.db.paused = not ns.db.paused
    print(ns.db.paused and "Twinmap Forever: strip paused." or "Twinmap Forever: strip on.")
  else
    print(("Twinmap Forever %s, protocol %d"):format(ns.VERSION, ns.PROTOCOL))
  end
end
