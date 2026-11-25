<script lang="ts">
  // The Spellbook panel of the Character workspace (M20-F11), from the sheet the app keeps for the character shown: on the
  // left the tabs of the game's book, each with its picture and how many spells, on the right the spells of the one chosen
  // in the book's order, down the columns as the game lays them, the passive ones last and round (shared/spellbook.ts).
  // It reads the same with the game closed. Under the pointer or reached with the keyboard, a spell opens a popup with the
  // game's own tooltip (M20-F16), once the addon has sent it; before, its name and rank.
  import type { Known } from '../../shared/characters'
  import { t } from '../../shared/i18n'
  import type { Sheets } from '../../shared/sheet'
  import { bookOf, type BookSpell } from '../../shared/spellbook'
  import type { TipLine } from '../../shared/tips'
  import { kept, spellTip } from './item-tip.svelte'
  import { askSpellFacts, spellFacts } from './spell-facts.svelte'
  import { TILES } from './web'

  let { sheets, shown, ready }: { sheets: Sheets; shown: Known | null; ready: boolean } = $props()

  $effect(() => {
    if (ready) askSpellFacts()
  })
  const sheet = $derived(shown ? sheets[shown.key] : undefined)
  const tabs = $derived(sheet && spellFacts.facts ? bookOf(sheet.pieces, spellFacts.facts) : [])
  let chosen = $state('')
  let typed = $state('')
  // At first the first tab of the class, as the game opens its book on the spells rather than on General.
  const one = $derived(tabs.find((tab) => tab.name === chosen) ?? tabs[1] ?? tabs[0])
  const spells = $derived(one ? one.spells.filter((s) => s.name.toLowerCase().includes(typed.trim().toLowerCase())) : [])
  const under = (s: BookSpell): string => s.rank || (s.passive ? t('items.spellbook.passive') : '')
  const linesOf = (s: BookSpell): TipLine[] => (s.spell && kept.tips[`spell:${s.spell}@${shown?.key}`]) || [[s.name, ''], ...(under(s) ? [[under(s), '9d9d9d'] as TipLine] : [])]
</script>

<main class="surface">
  {#if !shown || !sheet}
    <p class="empty">{t('items.page.noCharacter')}</p>
  {:else if spellFacts.facts && !tabs.length}
    <p class="empty"><b>{t('items.spellbook.none')}</b>{t('items.spellbook.login')}</p>
  {:else if one}
    <div class="book">
      <nav class="tabs">
        {#each tabs as tab (tab.name)}
          <button class="tab" class:on={tab === one} aria-pressed={tab === one} onclick={() => (chosen = tab.name)}>
            <img src="{TILES}/pictures/{tab.icon}.png" alt="" onerror={(e) => e.currentTarget.setAttribute('style', 'visibility: hidden')} />
            <span class="name">{tab.name}</span>
            <small>{tab.spells.length}</small>
          </button>
        {/each}
      </nav>
      <section class="spells" aria-label={one.name}>
        <header>
          <h3>{one.name}<span>{one.spells.length}</span></h3>
          <input type="search" placeholder={t('items.spellbook.filter')} bind:value={typed} />
        </header>
        <ul>
          {#each spells as s, i (i)}
            <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
            <li class:passive={s.passive} tabindex="0" use:spellTip={linesOf(s)}>
              <img src="{TILES}/pictures/{s.icon}.png" alt="" onerror={(e) => e.currentTarget.setAttribute('style', 'visibility: hidden')} />
              <span>{s.name}</span>
              <small>{under(s)}</small>
            </li>
          {/each}
        </ul>
        {#if typed.trim() && !spells.length}<p class="none">{t('items.spellbook.noMatch')}</p>{/if}
      </section>
    </div>
  {/if}
</main>

<style>
  /* Its narrow form follows the width of its place: the tabs over the spells under 560 px. */
  main {
    position: absolute;
    inset: 0;
    overflow: hidden;
    container: spellbook / inline-size;
  }
  .empty {
    max-width: 520px;
    margin: 64px auto;
    padding: 0 20px;
    color: var(--text-dim);
    text-align: center;
  }
  .empty b {
    display: block;
    margin-bottom: 6px;
    font: var(--t-title);
    color: var(--gold);
  }
  .book {
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr);
    height: 100%;
  }
  .tabs {
    overflow-y: auto;
    padding: 12px 10px;
    border-right: 1px solid var(--bronze-700);
  }
  .tab {
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
    width: 100%;
    padding: 6px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: none;
    color: var(--text);
    font: var(--t-body);
    text-align: left;
    cursor: pointer;
  }
  .tab:hover {
    background: var(--stone-800);
  }
  .tab.on {
    border-color: var(--bronze-500);
    background: linear-gradient(var(--stone-600), var(--stone-700));
  }
  .tab.on .name {
    color: var(--gold);
  }
  .tab img {
    width: 30px;
    height: 30px;
    border-radius: 3px;
    box-shadow:
      0 0 0 1px #000,
      0 0 0 2px var(--bronze-700);
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tab small {
    font: var(--t-small);
    color: var(--text-off);
  }
  .spells {
    overflow-y: auto;
    padding: 12px 16px 28px;
  }
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 14px;
    margin-bottom: 10px;
  }
  h3 {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin: 0;
    font: var(--t-name);
    font-size: 22px;
    color: var(--gold);
    white-space: nowrap;
  }
  h3 span {
    font: var(--t-body);
    color: var(--text-dim);
  }
  input {
    width: min(200px, 100%);
    height: 30px;
    margin-left: auto;
    padding: 0 10px;
    border: 0;
    background: var(--stone-950);
    box-shadow: inset 0 0 0 1px var(--bronze-700);
    color: var(--text);
    font: var(--t-body);
  }
  input:focus {
    outline: none;
    box-shadow: inset 0 0 0 1px var(--bronze-400);
  }
  /* Down the columns, as the game's book. */
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    columns: 200px;
    column-gap: 14px;
  }
  li {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr);
    column-gap: 9px;
    align-items: center;
    min-height: 36px;
    margin-bottom: 6px;
    break-inside: avoid;
  }
  li img {
    grid-row: 1 / 3;
    width: 34px;
    height: 34px;
    border-radius: 3px;
    box-shadow:
      0 0 0 1px #000,
      0 0 0 2px var(--bronze-600);
  }
  /* A long name goes on two lines, as in the game's book. */
  li span {
    overflow-wrap: break-word;
    font: var(--t-body);
    line-height: 17px;
    color: var(--text);
  }
  li small {
    font: var(--t-small);
    line-height: 14px;
    color: var(--text-off);
  }
  /* A passive spell, as the game draws it: round, without the frame of a spell to cast. */
  li.passive img {
    border-radius: 50%;
    box-shadow:
      0 0 0 1px #000,
      0 0 0 2px var(--stone-500);
    filter: saturate(0.6);
  }
  li.passive span {
    color: var(--text-dim);
  }
  .none {
    font: var(--t-small);
    color: var(--text-off);
  }
  @container spellbook (width < 560px) {
    .book {
      grid-template: auto minmax(0, 1fr) / minmax(0, 1fr);
    }
    .tabs {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 2px 8px;
      padding: 8px;
      border-right: 0;
      border-bottom: 1px solid var(--bronze-700);
    }
    .tab {
      grid-template-columns: 24px minmax(0, 1fr) auto;
      padding: 4px;
    }
    .tab img {
      width: 24px;
      height: 24px;
    }
    input {
      width: 100%;
      margin-left: 0;
    }
  }
</style>
