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
  -- The tests read the strip at full contrast with nothing between blocks, as a player may set it;
  -- the values a new install starts with are checked in trials.test.js.
  TwinmapForeverDB = { on = 50, neg = 50, amp = 255, idle = "hide" }

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
  -- The game's own map pin: WAYPOINT is where it stands, TRACKED whether it is followed on screen.
  -- GAME.noPinMap: a map the game allows no pin on.
  C_Map = {
    GetBestMapForUnit = function() return GAME.map end,
    GetMapInfo = function(map) return { mapID = map, name = GAME.zone } end,
    -- The world of the stand-in: every zone map is 2000 yards a side, its middle (map - 1429) times
    -- 5000 yards north of Elwynn's and as far west as it. GAME.noWorld: a map the game tells no place of.
    GetWorldPosFromMapPos = function(map, at)
      if map == GAME.noWorld then return end
      return 0, CreateVector2D((map - 1429) * 5000 + (0.5 - at.y) * 2000, (0.5 - at.x) * 2000)
    end,
    GetMapPosFromWorldPos = function(_, world, map)
      return map, CreateVector2D(0.5 - world.y / 2000, 0.5 - (world.x - (map - 1429) * 5000) / 2000)
    end,
    -- The place on a map is told only for the map the character is on.
    GetPlayerMapPosition = function(map) return GAME.x and (map == nil or map == GAME.map) and { x = GAME.x, y = GAME.y } or nil end,
    CanSetUserWaypointOnMap = function(map) return map ~= GAME.noPinMap end,
    SetUserWaypoint = function(point) WAYPOINT = point end,
    ClearUserWaypoint = function() WAYPOINT, TRACKED = nil, nil end,
  }
  function CreateVector2D(x, y) return { x = x, y = y, GetXY = function(self) return self.x, self.y end } end
  C_Minimap = { GetViewRadius = function() return GAME.miniRadius end }
  function GetCVar(name) return GAME.cvars and GAME.cvars[name] end
  UiMapPoint = { CreateFromCoordinates = function(map, x, y) return { m = map, x = x, y = y } end }
  C_SuperTrack = { SetSuperTrackedUserWaypoint = function(on) TRACKED = on end }
  LEVELS = {} -- every channel value a texture was given, as a key
  -- The game's world map: GAME.mapOpen, and GAME.shown the map on it. Its canvas is 1000 by 600.
  function hooksecurefunc() end
  function IsAltKeyDown() return GAME.alt == true end
  WorldMapFrame = { OnMapChanged = true }
  function WorldMapFrame:HookScript() end
  function WorldMapFrame:AddCanvasClickHandler(handler) MAP_CLICK = handler end
  function WorldMapFrame:IsShown() return GAME.mapOpen == true end
  function WorldMapFrame:GetMapID() return GAME.shown end
  function WorldMapFrame:GetCanvasScale() return GAME.canvasScale or 1 end
  function WorldMapFrame:GetCanvas()
    if not CANVAS then
      CANVAS = CreateFrame("Frame")
      function CANVAS:GetWidth() return 1000 end
      function CANVAS:GetHeight() return 600 end
      function CANVAS:GetFrameLevel() return 1 end
    end
    return CANVAS
  end

  -- Frames and textures answer every method; only what a test looks at does something.
  local function noop() end
  local Widget = { __index = function() return noop end }
  -- Fonts as measured in the game: a new name says no once and loads late, then stays cached with
  -- what the file said, through /reload. Until then the text measures the font it had. A width
  -- comes back to the whole pixel, 0.064 pixels a unit, with the trailing letter C in it.
  local fontCache, slots = {}, {}
  UIParent = {}
  function UIParent:CreateFontString()
    local s = setmetatable({ widths = false, text = "" }, Widget)
    function s:SetFont(path)
      if path:find("FRIZQT") then self.widths = false return true end
      if fontCache[path] == nil then fontCache[path] = false return false end
      fontCache[path] = fontCache[path] or T_fontWidths(path) or false
      if not fontCache[path] then return false end
      self.widths = fontCache[path]
      return true
    end
    function s:SetText(text) self.text = text end
    function s:GetStringWidth()
      if not self.widths then return 90 end
      local a, b, c = self.text:byte(1, 3)
      local glyph = #self.text == 2 and a - 64 or 4 + (a - 0xE0) * 4096 + (b - 0x80) * 64 + (c - 0x80) - 0xE000
      local hi, lo = self.widths:byte(1 + 4 * glyph, 2 + 4 * glyph)
      return math.floor(32 + (hi and hi * 256 + lo or 0) * 0.064 + 0.5)
    end
    return s
  end
  C_EncodingUtil = { DeserializeJSON = function(text) return load(T_jsonAsLua(text))() end }
  -- The slots the app wrote, loaded as the game does: once each, until the interface is reloaded.
  C_AddOns = {
    IsAddOnLoaded = function(name) return slots[name] == true end,
    LoadAddOn = function(name)
      local source = not GAME.slotsOff and T_slotSource(name)
      if not source then return false, "MISSING" end
      slots[name] = true
      assert(load(source, "=" .. name))()
      return true
    end,
  }
  function T_slots()
    local n = 0
    for _ in pairs(slots) do n = n + 1 end
    return n
  end

  function CreateFrame(_, name)
    local f, cells = setmetatable({ events = {} }, Widget), {}
    if name then _G[name] = f end
    function f:RegisterEvent(e) self.events[e] = true end
    function f:SetScript(kind, fn) self[kind] = fn end
    function f:SetPoint(point, _, _, x, y) self.point, self.x, self.y = point, x, y end
    function f:Hide() self.shown = false end
    function f:SetScale(scale) self.scale = scale end
    function f:SetText(text) self.text = text end
    function f:CreateFontString()
      local s = setmetatable({}, Widget)
      function s:SetText(text) self.text = text end
      return s
    end
    -- A line keeps where it starts and ends, and whether it is shown.
    function f:CreateLine()
      local line = setmetatable({}, Widget)
      function line:SetStartPoint(_, _, x, y) self.sx, self.sy = x, y end
      function line:SetEndPoint(_, _, x, y) self.ex, self.ey = x, y end
      function line:SetShown(on) self.on = on end
      return line
    end
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
      self.shown = true
      local row = {}
      for _, t in ipairs(cells) do
        if t.shown == true then row[#row + 1] = t.v end -- only a cell that was shown: a texture never shown answers anything
      end
      if #row > 0 then strips[#strips + 1] = table.concat(row) end
    end
    frames[#frames + 1] = f
    return f
  end

  -- What the test drives.
  local ns = {}
  function T_load(name, source, chunk) return assert(load(source, "@" .. chunk))(name, ns) end
  -- /reload: the interface starts over, the saved variables and the fonts already read stay.
  function T_reload() frames, slots, ns, SlashCmdList, TwinmapForeverArrow = {}, {}, {}, {}, nil end
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
  -- The flags of ours on the world map, in order of name: "name x y", in pixels of the canvas from its top left.
  function T_flags()
    local out = {}
    for _, f in ipairs(frames) do
      if rawget(f, "part") ~= nil and f.shown then out[#out + 1] = ("%s %.0f %.0f"):format(f.name, f.x * (f.scale or 1), -f.y * (f.scale or 1)) end
    end
    table.sort(out)
    return table.concat(out, "; ")
  end
  -- The flags of ours on the minimap, in order of name: "name x y", in pixels right and up from its middle.
  function T_miniFlags()
    local out = {}
    for _, f in ipairs(frames) do
      if rawget(f, "mini") and f.shown then out[#out + 1] = ("%s %d %d"):format(f.name, math.floor(f.x * (f.scale or 1) + 0.5), math.floor(f.y * (f.scale or 1) + 0.5)) end
    end
    table.sort(out)
    return table.concat(out, "; ")
  end
  -- The arrow of ours: "name | how far | where its tip is, in pixels right and up from its middle", or nothing when it is not shown.
  function T_arrow()
    local a = TwinmapForeverArrow
    if not (a and a.shown) then return nil end
    local tip = a.lines[4]
    return ("%s | %s | %s"):format(a.name.text, a.far.text, tip.on and ("%.0f %.0f"):format(tip.ex, tip.ey) or "no tip")
  end
  function T_arrowClick(button) return rawget(TwinmapForeverArrow, "OnMouseUp")(TwinmapForeverArrow, button) end
  -- A click on the world map, at a place 0 to 1 from its top left: gives back whether an addon took it.
  function T_mapClick(button, x, y) return tostring(MAP_CLICK ~= nil and MAP_CLICK(WorldMapFrame, button, tonumber(x), tonumber(y))) end
  -- A click on the flag of that name, with a button of the mouse.
  function T_flagClick(name, button)
    for _, f in ipairs(frames) do
      if rawget(f, "part") ~= nil and f.shown and f.name == name then return rawget(f, "OnMouseUp")(f, button) end
    end
    error("no flag on the map: " .. name)
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

// addons: the AddOns folder the fonts and the slots are read from, as the app wrote them; without it there are none.
function loadAddon(dir, { addons } = {}) {
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

  const inAddons = (...parts) => (addons ? path.join(addons, ...parts) : null);
  const register = (name, fn) => lua.lua_register(L, to_luastring(name), (l) => {
    const out = fn(to_jsstring(lauxlib.luaL_checkstring(l, 1)));
    if (out === null) return 0;
    lua.lua_pushstring(l, typeof out === 'string' ? to_luastring(out) : out);
    return 1;
  });
  // The widths of a font of the bank, 4 bytes a letter, as they are in the file; nothing for a file that is not there.
  register('T_fontWidths', (name) => {
    const file = inAddons(...name.split('\\').slice(2));
    if (!file || !fs.existsSync(file)) return null;
    const font = fs.readFileSync(file);
    for (let i = 0; i < font.readUInt16BE(4); i++) {
      const at = 12 + i * 16;
      if (font.toString('latin1', at, at + 4) === 'hmtx') return Uint8Array.from(font.subarray(font.readUInt32BE(at + 8), font.readUInt32BE(at + 8) + font.readUInt32BE(at + 12)));
    }
    return null;
  });
  // The game's own JSON reader, as Lua source for this one.
  const luaOf = (v) => (v === null ? 'nil' : Array.isArray(v) ? '{' + v.map(luaOf).join(',') + '}'
    : typeof v === 'object' ? '{' + Object.entries(v).map(([k, x]) => `[${JSON.stringify(k)}]=${luaOf(x)}`).join(',') + '}' : JSON.stringify(v));
  register('T_jsonAsLua', (text) => 'return ' + luaOf(JSON.parse(text)));
  register('T_slotSource', (name) => {
    const file = inAddons(name, 'Inbox.lua');
    return file && fs.existsSync(file) ? Uint8Array.from(fs.readFileSync(file)) : null;
  });

  if (lauxlib.luaL_dostring(L, to_luastring(STUB)) !== lua.LUA_OK) throw new Error(to_jsstring(lua.lua_tostring(L, -1)));
  const run = () => {
    for (const f of toc.files) call('T_load', name, fs.readFileSync(path.join(dir, f), 'utf8'), f);
  };
  run();

  return {
    meta: toc.meta,
    fire: (event) => call('T_fire', event),
    // /reload: the addon is loaded again, with what it saved.
    reload: () => {
      call('T_reload');
      run();
    },
    // How many slots were loaded since the last reload.
    slots: () => Number(call('T_slots')),
    slash: (text) => call('T_slash', text),
    printed: () => call('T_printed'),
    ns: (key) => call('T_ns', key),
    lua: (code) => call('T_lua', code),
    click: (name) => call('T_click', name),
    flags: () => call('T_flags') || '',
    flagClick: (name, button) => call('T_flagClick', name, button),
    miniFlags: () => call('T_miniFlags') || '',
    arrow: () => call('T_arrow'),
    arrowClick: (button) => call('T_arrowClick', button),
    mapClick: (button, x, y) => call('T_mapClick', button, String(x), String(y)) === 'true',
    // Drags a slider to a value.
    slide: (name, value) => call('T_slide', name, String(value)),
    run: (seconds) => call('T_run', String(seconds)),
    // Every strip drawn so far, oldest first, each a string of cells 0 to 7.
    strips: () => (call('T_strips') || '').split('\n').filter(Boolean),
  };
}

module.exports = { loadAddon };
