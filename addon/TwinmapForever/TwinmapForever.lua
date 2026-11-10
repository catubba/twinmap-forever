-- Twinmap Forever, the in-game half. It reads and draws; it never acts for the player.
local _, ns = ...

ns.VERSION = "0.0.0" -- same as the .toc; a test keeps the two in step
ns.PROTOCOL = 1 -- the app refuses a strip whose protocol it does not know

-- The player's choices, saved by the game in TwinmapForeverDB.
local DEFAULTS = {
  paused = false,    -- true: nothing is drawn
  position = "TOP",  -- edge of the window the strip sits on: "TOP" or "BOTTOM"
  mode = "steady",   -- "steady": every block normal, then in negative. "fast": normal only
}

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
