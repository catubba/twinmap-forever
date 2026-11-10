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
  { key = "idle", label = "Between blocks", values = { "hide", "flat", "repeat" }, names = { "Hidden", "Even line", "Repeat last block" },
    hint = "Trial. Repeat last block keeps the line busy all the time: the hardest case to hide, and the one to tune on." },
}

-- Temporary, for the camouflage trials: remove with the settings they change once values are chosen.
-- key in the saved settings, label, lowest, highest, what follows the number
local SLIDERS = {
  { key = "on", label = "Block shown", min = 0, max = 200, unit = " ms (0: one frame)" },
  { key = "neg", label = "Negative shown", min = 0, max = 200, unit = " ms (0: one frame)" },
  { key = "gap", label = "Rest after each showing", min = 0, max = 500, unit = " ms" },
  { key = "cycles", label = "Times a block is shown", min = 1, max = 60, unit = "" },
  { key = "base", label = "Dark level", min = 0, max = 254, unit = " of 255" },
  { key = "amp", label = "Contrast", min = 1, max = 255, unit = " of 255" },
}

-- The strip paints a block once and shows it many times: this tells it the looks changed.
local function Changed()
  ns.tuneStamp = (ns.tuneStamp or 0) + 1
end

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
  for _, s in ipairs(SLIDERS) do
    s.slider:SetValue(ns.db[s.key])
    s.text:SetText(s.label .. ": " .. ns.db[s.key] .. s.unit)
  end
end

for i, row in ipairs(ROWS) do
  local button = CreateFrame("Button", "TwinmapForeverOption" .. i, panel, "UIPanelButtonTemplate")
  button:SetSize(180, 24)
  button:SetPoint("TOPLEFT", warning, "BOTTOMLEFT", 0, -20 - (i - 1) * 56)
  button:SetScript("OnClick", function()
    ns.db[row.key] = row.values[IndexOf(row) % #row.values + 1]
    Changed()
    Refresh()
  end)
  row.button = button

  local hint = panel:CreateFontString(nil, "ARTWORK", "GameFontHighlightSmall")
  hint:SetPoint("TOPLEFT", button, "BOTTOMLEFT", 2, -4)
  hint:SetWidth(560)
  hint:SetJustifyH("LEFT")
  hint:SetText(row.hint)
end

local heading = panel:CreateFontString(nil, "ARTWORK", "GameFontNormal")
heading:SetPoint("TOPLEFT", ROWS[#ROWS].button, "BOTTOMLEFT", 0, -44)
heading:SetText("Camouflage trials (temporary)")

-- No template: none is sure to exist on this client. Two columns; the mouse wheel moves by one.
for i, s in ipairs(SLIDERS) do
  local slider = CreateFrame("Slider", "TwinmapForeverTune" .. i, panel)
  slider:SetOrientation("HORIZONTAL")
  slider:SetSize(250, 16)
  slider:SetPoint("TOPLEFT", heading, "BOTTOMLEFT", (i - 1) % 2 * 290, -26 - math.floor((i - 1) / 2) * 44)
  slider:SetMinMaxValues(s.min, s.max)
  slider:SetValueStep(1)
  slider:SetObeyStepOnDrag(true)
  local track = slider:CreateTexture(nil, "BACKGROUND")
  track:SetPoint("LEFT")
  track:SetPoint("RIGHT")
  track:SetHeight(4)
  track:SetColorTexture(0.35, 0.35, 0.35, 1)
  local thumb = slider:CreateTexture(nil, "ARTWORK")
  thumb:SetSize(10, 18)
  thumb:SetColorTexture(1, 0.82, 0, 1)
  slider:SetThumbTexture(thumb)
  slider:EnableMouseWheel(true)
  slider:SetScript("OnMouseWheel", function(self, delta) self:SetValue(self:GetValue() + delta) end)
  slider:SetScript("OnValueChanged", function(_, value)
    value = math.floor(value + 0.5)
    if value == ns.db[s.key] then return end
    ns.db[s.key] = value
    Changed()
    s.text:SetText(s.label .. ": " .. value .. s.unit)
  end)
  s.slider = slider
  s.text = panel:CreateFontString(nil, "ARTWORK", "GameFontHighlightSmall")
  s.text:SetPoint("BOTTOMLEFT", slider, "TOPLEFT", 0, 4)
end

local reset = CreateFrame("Button", "TwinmapForeverTuneReset", panel, "UIPanelButtonTemplate")
reset:SetSize(180, 24)
reset:SetPoint("TOPLEFT", heading, "BOTTOMLEFT", 0, -26 - math.ceil(#SLIDERS / 2) * 44)
reset:SetText("Back to the usual strip")
reset:SetScript("OnClick", function()
  for _, s in ipairs(SLIDERS) do ns.db[s.key] = ns.DEFAULTS[s.key] end
  ns.db.idle = ns.DEFAULTS.idle
  Changed()
  Refresh()
end)

panel:SetScript("OnShow", Refresh) -- /twinmap pause may have changed a value meanwhile

Settings.RegisterAddOnCategory(Settings.RegisterCanvasLayoutCategory(panel, "Twinmap Forever"))
