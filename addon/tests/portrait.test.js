const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { loadAddon } = require('./client');
const { decodeStrip } = require('./decode');

const DIR = path.join(__dirname, '..', 'TwinmapForever');

// The model of the character window, 231 by 320 units at a scale of 0.64, on a window 1440 pixels high;
// and the game's tooltip, off to the right of it until GAME.tipOver.
const WINDOW = `GAME.surname, GAME.height = "Sucameli", 1440
  local function Frame(shown, edges)
    return {
      IsVisible = function() return shown() end,
      IsMouseOver = function() return GAME.pointerOver == true end,
      GetEffectiveScale = function() return 0.64 end,
      GetLeft = function() return edges()[1] end, GetRight = function() return edges()[2] end,
      GetTop = function() return edges()[3] end, GetBottom = function() return edges()[4] end,
    }
  end
  CharacterModelScene = Frame(function() return GAME.charOpen == true end, function() return { 100, 331, 900, 580 } end)
  GameTooltip = Frame(function() return GAME.tip == true end, function() return GAME.tipOver and { 300, 500, 700, 600 } or { 400, 600, 700, 600 } end)`;

function enterWorld() {
  const addon = loadAddon(DIR);
  addon.lua(WINDOW);
  addon.fire('PLAYER_LOGIN');
  addon.lua('local ns = ...; ns.db.mode = "fast"');
  addon.fire('PLAYER_ENTERING_WORLD');
  addon.run(10); // past the wait at the start
  return addon;
}
// What the section "model" last said.
const model = (addon) => {
  addon.run(3);
  const said = addon.strips().map(decodeStrip).filter((b) => b.section === 'model');
  return JSON.parse(said[said.length - 1].text);
};

test('the model is told only while the character window shows it, in pixels from the top left of the window', () => {
  const addon = enterWorld();
  assert.deepEqual(model(addon), [], 'the window is closed');
  addon.lua('GAME.charOpen = true');
  // 1440 / 768 * 0.64 = 1.2 pixels a unit: left 100 -> 120, top 900 -> 1440 - 1080, 231 wide -> 277, 320 high -> 384.
  assert.deepEqual(model(addon), { key: 'Catubbio Sucameli', x: 120, y: 360, w: 277, h: 384 });
  addon.lua('GAME.charOpen = false');
  assert.deepEqual(model(addon), []);
});

test('a tooltip over the model, or the pointer, and it is not told; a tooltip beside it changes nothing', () => {
  const addon = enterWorld();
  addon.lua('GAME.charOpen, GAME.tip = true, true');
  assert.equal(model(addon).w, 277, 'the tooltip is beside the model');
  addon.lua('GAME.tipOver = true');
  assert.deepEqual(model(addon), [], 'the tooltip reaches over the model');
  addon.lua('GAME.tip = false');
  assert.equal(model(addon).w, 277);
  addon.lua('GAME.pointerOver = true');
  assert.deepEqual(model(addon), [], 'the pointer is over the model');
});

test('the model is told in a fight too: a window closed there is not left open', () => {
  const addon = enterWorld();
  addon.lua('GAME.charOpen = true');
  assert.equal(model(addon).w, 277);
  addon.lua('GAME.combat, GAME.charOpen = true, false');
  assert.deepEqual(model(addon), []);
});
