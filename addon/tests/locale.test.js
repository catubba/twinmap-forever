// The addon in every language the game is installed in (Locale.lua): every text there, English where a language has
// none, no language with keys of its own or other {names}, and no English left written by hand in the code.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadAddon } = require('./client');

const DIR = path.join(__dirname, '..', 'TwinmapForever');
// The languages of the app (design notes, l10n.md), and enGB, which the game reports for English in Europe.
const LOCALES = ['enUS', 'enGB', 'frFR', 'deDE', 'esMX', 'esES', 'ruRU', 'koKR', 'zhCN'];
// Every language table, as "code\tkey\ttext" lines.
const TABLES = `local ns = ...; local out = {}
  for code, t in pairs(ns.texts) do for key, text in pairs(t) do out[#out + 1] = code .. "\\t" .. key .. "\\t" .. text:gsub("\\n", " ") end end
  return table.concat(out, "\\n")`;
const tables = (addon) => {
  const by = {};
  for (const line of addon.lua(TABLES).split('\n')) {
    const [code, key, text] = line.split('\t');
    (by[code] ??= {})[key] = text;
  }
  return by;
};
const names = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

test('in every language every text is there, the English one where the language has none', () => {
  const english = tables(loadAddon(DIR)).enUS;
  for (const locale of LOCALES) {
    const addon = loadAddon(DIR, { locale });
    for (const key of Object.keys(english)) {
      const text = addon.lua(`local ns = ...; return ns.L[${JSON.stringify(key)}]`);
      assert.ok(text && text !== key, `${locale} ${key}`);
    }
    // The page in the settings is drawn in it: every button says a setting and its value.
    addon.fire('PLAYER_LOGIN');
    addon.lua('local panel = SETTINGS_CATEGORY.panel; rawget(panel, "OnShow")(panel)');
    for (const i of [1, 2, 3, 4]) assert.match(addon.lua(`return TwinmapForeverOption${i}.text`), /^.+\S.*$/, `${locale} button ${i}`);
  }
});

test('a language has the keys of English, no others, with the same {names}, and no long or middle dash', () => {
  const by = tables(loadAddon(DIR));
  for (const [code, table] of Object.entries(by)) {
    for (const [key, text] of Object.entries(table)) {
      assert.ok(key in by.enUS, `${code} has ${key}, English has not`);
      assert.equal(names(text), names(by.enUS[key]), `${code} ${key}`);
      assert.ok(!/[\u2013\u2014]/.test(text), `${code} ${key}`);
    }
  }
});

test('a text of the game\'s language is said, its names filled in', () => {
  const addon = loadAddon(DIR, { locale: 'frFR' });
  addon.lua('local ns = ...; ns.soon.frFR = nil; ns.texts.frFR = { ["route.complete"] = "itinéraire terminé.", ["say"] = "Twinmap Forever : {line}" }');
  addon.lua('local ns = ...; ns.Say("route.complete"); ns.Say("arrow.arrived", { name = "Goldshire %1" })');
  assert.deepEqual(addon.printed().split('\n'), ['Twinmap Forever : itinéraire terminé.', 'Twinmap Forever : you are at Goldshire %1.']);
});

// What the player reads, put in a call by hand: print, SetText, AddLine. The addon's name stays.
test('no English written by hand where the addon speaks', () => {
  const found = [];
  for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith('.lua') && f !== 'Locale.lua')) {
    for (const line of fs.readFileSync(path.join(DIR, file), 'utf8').split('\n')) {
      if (/^\s*--/.test(line) || !/\b(print|SetText|AddLine)\(/.test(line)) continue;
      for (const m of line.matchAll(/"([^"]*)"/g)) {
        // A key ("marks.tip") or a name of the code is no text.
        if (!/^[\w.]*$/.test(m[1]) && /[A-Za-z]{2,}/.test(m[1].replace(/Twinmap Forever/g, ''))) found.push(`${file}: ${line.trim()}`);
      }
    }
  }
  assert.deepEqual(found, []);
});

test('a language not out yet speaks English in the game', () => {
  const addon = loadAddon(DIR, { locale: 'frFR' });
  assert.equal(addon.lua('local ns = ...; return ns.L["route.complete"]'), 'route complete.');
  assert.ok(addon.lua('local ns = ...; return ns.texts.frFR["route.complete"]'));
});
