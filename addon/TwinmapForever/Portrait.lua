-- The character's picture, for the app: it reads it off the screen, as it does the minimap. While
-- the character window shows the model with nothing over it, the section "model" says whose it is
-- and where: { key = full name, x, y, w, h }, the pixels of its left and top edge from the top left
-- of the window, its width and its height. With the window closed, or a tooltip or the pointer over
-- the model, the section is empty, and the app takes no picture. Sent in a fight too: a window
-- closed there must not be left open in the app's eyes.
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

local function Build()
  local model = CharacterModelScene or CharacterModelFrame
  if not model then return end -- the game has not made the window yet: nothing to say of it
  local key = ns.ready and ns.Key()
  if not key or Try(model.IsVisible, model) ~= true or Try(model.IsMouseOver, model) then return {} end
  local l, r, t, b = Edges(model)
  local _, physH = GetPhysicalScreenSize()
  if not l or not Num(physH) then return {} end
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
