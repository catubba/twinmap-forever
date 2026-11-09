-- Twinmap Forever, the in-game half. It reads and draws; it never acts for the player.
local _, ns = ...

ns.VERSION = "0.0.0" -- same as the .toc; a test keeps the two in step
ns.PROTOCOL = 1 -- the app refuses a strip whose protocol it does not know

local frame = CreateFrame("Frame")
frame:RegisterEvent("PLAYER_LOGIN")
frame:SetScript("OnEvent", function()
  ns.ready = true
end)

SLASH_TWINMAP1 = "/twinmap"
SlashCmdList["TWINMAP"] = function()
  print(("Twinmap Forever %s, protocol %d"):format(ns.VERSION, ns.PROTOCOL))
end
