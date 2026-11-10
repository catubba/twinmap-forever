-- The addon's page in the game's settings: where the strip sits, how it is drawn, and its pause.
local _, ns = ...

local WARNING = "Photosensitivity warning: Twinmap sends data to the app by changing the colors of a one pixel line "
  .. "at the edge of the game window, many times per second. If flickering light affects you, keep the mode on "
  .. "Steady, or pause the strip. You can also pause it at any time with /twinmap pause."

-- key in the saved settings, label, the values a click cycles through with their names, hint
local ROWS = {
  { key = "paused", label = "Strip", values = { false, true }, names = { "On", "Paused" },
    hint = "Paused: nothing is drawn, and the app stops following your character." },
  { key = "position", label = "Position", values = { "TOP", "BOTTOM" }, names = { "Top edge", "Bottom edge" },
    hint = "The edge of the game window the line sits on." },
  { key = "mode", label = "Mode", values = { "steady", "fast" }, names = { "Steady", "Fast" },
    hint = "Steady: every block is followed by its negative, so the line looks still. Fast: twice the speed, more flicker." },
}

local function IndexOf(row)
  for i, value in ipairs(row.values) do
    if value == ns.db[row.key] then return i end
  end
  return 1
end

local panel = CreateFrame("Frame")

local title = panel:CreateFontString(nil, "ARTWORK", "GameFontNormalLarge")
title:SetPoint("TOPLEFT", 16, -16)
title:SetText("Twinmap Forever")

local warning = panel:CreateFontString(nil, "ARTWORK", "GameFontHighlight")
warning:SetPoint("TOPLEFT", title, "BOTTOMLEFT", 0, -12)
warning:SetWidth(560)
warning:SetJustifyH("LEFT")
warning:SetText(WARNING)

local function Refresh()
  for _, row in ipairs(ROWS) do
    row.button:SetText(row.label .. ": " .. row.names[IndexOf(row)])
  end
end

for i, row in ipairs(ROWS) do
  local button = CreateFrame("Button", "TwinmapForeverOption" .. i, panel, "UIPanelButtonTemplate")
  button:SetSize(180, 24)
  button:SetPoint("TOPLEFT", warning, "BOTTOMLEFT", 0, -20 - (i - 1) * 56)
  button:SetScript("OnClick", function()
    ns.db[row.key] = row.values[IndexOf(row) % #row.values + 1]
    Refresh()
  end)
  row.button = button

  local hint = panel:CreateFontString(nil, "ARTWORK", "GameFontHighlightSmall")
  hint:SetPoint("TOPLEFT", button, "BOTTOMLEFT", 2, -4)
  hint:SetWidth(560)
  hint:SetJustifyH("LEFT")
  hint:SetText(row.hint)
end

panel:SetScript("OnShow", Refresh) -- /twinmap pause may have changed a value meanwhile

Settings.RegisterAddOnCategory(Settings.RegisterCanvasLayoutCategory(panel, "Twinmap Forever"))
