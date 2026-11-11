// A stand-in game client: runs the addon in a Lua VM with just enough of the game's API to load it.
// The game runs Lua 5.1 and this VM is 5.3: close enough for what the addon uses, and a reason to keep
// a real-game checklist as well.
const { lua, lauxlib, lualib, to_luastring, to_jsstring } = require('fengari');
const fs = require('node:fs');
const path = require('node:path');

const STUB = `
  local printed, frames, strips, now = {}, {}, {}, 100
  function print(...)
    local parts = {}
    for i = 1, select("#", ...) do parts[i] = tostring((select(i, ...))) end
    printed[#printed + 1] = table.concat(parts, " ")
  end
  SlashCmdList = {}

  -- The world the addon reads. A test changes it with lua().
  GAME = { width = 1920, height = 1080, zone = "Elwynn Forest", sub = "Goldshire", map = 1429, x = 0.4234, y = 0.6571, facing = 1.5708 }
  function GetTime() return now end
  function GetPhysicalScreenSize() return GAME.width, GAME.height end
  function GetZoneText() return GAME.zone end
  function GetSubZoneText() return GAME.sub end
  function GetPlayerFacing() return GAME.facing end
  function IsIndoors() return GAME.indoors == true end
  -- GAME.instance = { name, kind, id } inside a dungeon; GAME.north, GAME.west where the game tells the place in yards.
  function GetInstanceInfo()
    local i = GAME.instance
    if i then return i.name, i.kind, 1, "Normal", 5, 0, false, i.id end
    return "Eastern Kingdoms", "none", 0, "", 0, 0, false, 0
  end
  function UnitPosition()
    if GAME.north then return GAME.north, GAME.west, 0, GAME.instance and GAME.instance.id or 0 end
  end
  function InCombatLockdown() return GAME.combat == true end
  -- GAME.level, GAME.xp, GAME.xpMax, GAME.rested: unset, the game tells nothing of the character.
  function UnitLevel() return GAME.level end
  function UnitXP() return GAME.xp end
  function UnitXPMax() return GAME.xpMax end
  function GetXPExhaustion() return GAME.rested end
  function UnitFactionGroup() return GAME.faction end -- "Alliance", "Horde"; unset, the game does not tell
  Settings = {
    RegisterCanvasLayoutCategory = function(panel, name) return { panel = panel, name = name } end,
    RegisterAddOnCategory = function(category) SETTINGS_CATEGORY = category end,
  }
  C_Map = {
    GetBestMapForUnit = function() return GAME.map end,
    GetPlayerMapPosition = function() return GAME.x and { x = GAME.x, y = GAME.y } end,
  }
  UIParent = {}
  LEVELS = {} -- every channel value a texture was given, as a key

  -- Frames and textures answer every method; only what a test looks at does something.
  local function noop() end
  local Widget = { __index = function() return noop end }
  function CreateFrame(_, name)
    local f, cells = setmetatable({ events = {} }, Widget), {}
    if name then _G[name] = f end
    function f:RegisterEvent(e) self.events[e] = true end
    function f:SetScript(kind, fn) self[kind] = fn end
    function f:SetPoint(point) self.point = point end
    function f:SetScale(scale) self.scale = scale end
    function f:SetText(text) self.text = text end
    function f:CreateFontString() return setmetatable({}, Widget) end
    function f:CreateTexture()
      local t = setmetatable({}, Widget)
      -- A channel is on above GAME.threshold: half, unless a test draws the strip with other levels.
      function t:SetColorTexture(r, g, b)
        local th = GAME.threshold or 0.5
        self.v = (r > th and 4 or 0) + (g > th and 2 or 0) + (b > th and 1 or 0)
        LEVELS[r], LEVELS[g], LEVELS[b] = true, true, true
      end
      function t:Show() self.shown = true end
      function t:Hide() self.shown = false end
      cells[#cells + 1] = t
      return t
    end
    -- A frame with textures is a strip: showing it records the row of cells on screen.
    function f:Show()
      local row = {}
      for _, t in ipairs(cells) do
        if t.shown then row[#row + 1] = t.v end
      end
      if #row > 0 then strips[#strips + 1] = table.concat(row) end
    end
    frames[#frames + 1] = f
    return f
  end

  -- What the test drives.
  local ns = {}
  function T_load(name, source, chunk) return assert(load(source, "@" .. chunk))(name, ns) end
  function T_fire(event)
    for _, f in ipairs(frames) do
      local fn = rawget(f, "OnEvent")
      if f.events[event] and fn then fn(f, event) end
    end
  end
  function T_run(seconds)
    local step = 1 / 60
    for _ = 1, math.floor(tonumber(seconds) / step + 0.5) do
      now = now + step
      for _, f in ipairs(frames) do
        local fn = rawget(f, "OnUpdate")
        if fn then fn(f, step) end
      end
    end
  end
  function T_strips() return table.concat(strips, "\\n") end
  function T_lua(code) return assert(load(code))(ns) end -- the code reads the addon's table as ...
  function T_slash(text)
    local command, rest = text:match("^(%S+)%s*(.*)$")
    for key, fn in pairs(SlashCmdList) do
      local i = 1
      while _G["SLASH_" .. key .. i] do
        if _G["SLASH_" .. key .. i] == command then return fn(rest) end
        i = i + 1
      end
    end
    error("no such slash command: " .. text)
  end
  function T_click(name) return rawget(_G[name], "OnClick")(_G[name]) end
  function T_slide(name, value) return rawget(_G[name], "OnValueChanged")(_G[name], tonumber(value)) end
  function T_printed() return table.concat(printed, "\\n") end
  function T_ns(key) return tostring(ns[key]) end
`;

// Reads a .toc: its "## Key: value" lines and the files it lists, in order.
function readToc(file) {
  const meta = {}, files = [];
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^##\s*([^:]+):\s*(.*)$/.exec(line);
    if (m) meta[m[1].trim()] = m[2].trim();
    else if (line.trim() && !line.startsWith('#')) files.push(line.trim().replace(/\\/g, '/'));
  }
  return { meta, files };
}

function loadAddon(dir) {
  const name = path.basename(dir), toc = readToc(path.join(dir, name + '.toc'));
  const L = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(L);

  // Calls a global Lua function with string arguments and returns its first result as a string.
  const call = (fn, ...args) => {
    lua.lua_getglobal(L, to_luastring(fn));
    for (const a of args) lua.lua_pushstring(L, to_luastring(a));
    if (lua.lua_pcall(L, args.length, 1, 0) !== lua.LUA_OK) throw new Error(to_jsstring(lua.lua_tostring(L, -1)));
    const out = lua.lua_isnil(L, -1) ? null : to_jsstring(lauxlib.luaL_tolstring(L, -1));
    lua.lua_settop(L, 0);
    return out;
  };

  if (lauxlib.luaL_dostring(L, to_luastring(STUB)) !== lua.LUA_OK) throw new Error(to_jsstring(lua.lua_tostring(L, -1)));
  for (const f of toc.files) call('T_load', name, fs.readFileSync(path.join(dir, f), 'utf8'), f);

  return {
    meta: toc.meta,
    fire: (event) => call('T_fire', event),
    slash: (text) => call('T_slash', text),
    printed: () => call('T_printed'),
    ns: (key) => call('T_ns', key),
    lua: (code) => call('T_lua', code),
    click: (name) => call('T_click', name),
    // Drags a slider to a value.
    slide: (name, value) => call('T_slide', name, String(value)),
    run: (seconds) => call('T_run', String(seconds)),
    // Every strip drawn so far, oldest first, each a string of cells 0 to 7.
    strips: () => (call('T_strips') || '').split('\n').filter(Boolean),
  };
}

module.exports = { loadAddon };
