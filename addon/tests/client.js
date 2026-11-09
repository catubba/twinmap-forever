// A stand-in game client: runs the addon in a Lua VM with just enough of the game's API to load it.
// The game runs Lua 5.1 and this VM is 5.3: close enough for what the addon uses, and a reason to keep
// a real-game checklist as well.
const { lua, lauxlib, lualib, to_luastring, to_jsstring } = require('fengari');
const fs = require('node:fs');
const path = require('node:path');

const STUB = `
  local printed, frames = {}, {}
  function print(...)
    local parts = {}
    for i = 1, select("#", ...) do parts[i] = tostring((select(i, ...))) end
    printed[#printed + 1] = table.concat(parts, " ")
  end
  SlashCmdList = {}
  function CreateFrame()
    local f = { events = {} }
    function f:RegisterEvent(e) self.events[e] = true end
    function f:SetScript(kind, fn) self[kind] = fn end
    frames[#frames + 1] = f
    return f
  end

  -- What the test drives.
  local ns = {}
  function T_load(name, source, chunk) return assert(load(source, "@" .. chunk))(name, ns) end
  function T_fire(event)
    for _, f in ipairs(frames) do
      if f.events[event] and f.OnEvent then f.OnEvent(f, event) end
    end
  end
  function T_slash(text)
    for key, fn in pairs(SlashCmdList) do
      local i = 1
      while _G["SLASH_" .. key .. i] do
        if _G["SLASH_" .. key .. i] == text then return fn("") end
        i = i + 1
      end
    end
    error("no such slash command: " .. text)
  end
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
  };
}

module.exports = { loadAddon };
