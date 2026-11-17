-- The character's picture, for the app: it reads it off the screen, as it does the minimap. While
-- the character window shows the model with nothing over it, the section "model" says whose it is
-- and where: { key = full name, x, y, w, h }, the pixels of its left and top edge from the top left
-- of the window, its width and its height. With the window closed, or a tooltip or the pointer over
-- the model, the section is empty, and the app takes no picture. Sent in a fight too: a window
-- closed there must not be left open in the app's eyes.
-- The game's model reaches behind the slots of what is worn and under its own buttons (zoom, turn):
-- what is told is the part between the two columns of slots, over the weapons and under the buttons.
local _, ns = ...

local function Ok(ok, ...) if ok then return ... end end
local function Try(f, ...) if f then return Ok(pcall(f, ...)) end end
local function Num(v) if type(v) == "number" and not (issecretvalue and issecretvalue(v)) then return v end end

local TIPS = { "GameTooltip", "ShoppingTooltip1", "ShoppingTooltip2", "ItemRefTooltip" }

-- Left, right, top and bottom of a frame in the units of the whole screen, 768 from foot to top.
local function Edges(f)
  local l, r, t, b = Num(Try(f.GetLeft, f)), Num(Try(f.GetRight, f)), Num(Try(f.GetTop, f)), Num(Try(f.GetBottom, f))
  local s = Num(Try(f.GetEffectiveScale, f))
  if l and r and t and b and s then return l * s, r * s, t * s, b * s end
end

local MARGIN = 4 -- units left free beside a slot: its border is drawn a little past it

-- The model's edges drawn in by what the game lays over it.
local function Clear(model, l, r, t, b)
  local function Of(f)
    if f and Try(f.IsVisible, f) == true then return Edges(f) end
  end
  local _, headRight = Of(CharacterHeadSlot)
  local handsLeft = Of(CharacterHandsSlot)
  local _, _, weaponTop = Of(CharacterMainHandSlot)
  local _, _, _, buttonsFoot = Of(model.ControlFrame)
  if headRight and headRight > l and headRight + MARGIN < r then l = headRight + MARGIN end
  if handsLeft and handsLeft < r and handsLeft - MARGIN > l then r = handsLeft - MARGIN end
  if weaponTop and weaponTop > b and weaponTop + MARGIN < t then b = weaponTop + MARGIN end
  if buttonsFoot and buttonsFoot < t and buttonsFoot > b then t = buttonsFoot end
  return l, r, t, b
end

local function Build()
  local model = CharacterModelScene or CharacterModelFrame
  if not model then return end -- the game has not made the window yet: nothing to say of it
  local key = ns.ready and ns.Key()
  if not key or Try(model.IsVisible, model) ~= true or Try(model.IsMouseOver, model) then return {} end
  local l, r, t, b = Edges(model)
  local _, physH = GetPhysicalScreenSize()
  if not l or not Num(physH) then return {} end
  l, r, t, b = Clear(model, l, r, t, b)
  for _, name in ipairs(TIPS) do
    local tip = _G[name]
    if tip and Try(tip.IsVisible, tip) == true then
      local tl, tr, tt, tb = Edges(tip)
      if tl and tl < r and tr > l and tb < t and tt > b then return {} end
    end
  end
  local pixel = physH / 768
  local function Px(v) return math.floor(v * pixel + 0.5) end
  return { key = key, x = Px(l), y = physH - Px(t), w = Px(r - l), h = Px(t - b) }
end

ns.sections[#ns.sections + 1] = { name = "model", period = 0.25, build = Build, combat = true }
