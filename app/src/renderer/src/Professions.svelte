<script module lang="ts">
  import { SPELLS_FILE, type SpellFacts } from '../../shared/spells'
  import { TILES } from './web'
  // The game's spells (spells.json, made beside the map by tiles-worker.ts just after the map is ready), asked for then, and
  // again every few seconds until the file is there: at the first start of a build it takes a few seconds more.
  let facts = $state.raw<SpellFacts | null>(null)
  let asked = false
  // A file not made yet comes back empty (204) or missing.
  function ask(left: number): void {
    const again = (): unknown => left > 0 && setTimeout(() => ask(left - 1), 3000)
    void fetch(`${TILES}/${SPELLS_FILE}`)
      .then((r) => (r.status === 200 ? r.json() : null))
      .then((read: SpellFacts | null) => (read ? (facts = read) : again()))
      .catch(again)
  }
</script>

<script lang="ts">
  // The Professions panel of the Character workspace (M20-F10), from the sheet the app keeps for the character shown: on the
  // left each profession with its level, the main ones first; on the right the recipes of the one chosen, those known in the
  // colours of the game's window, the most useful first, then dimmed those its window lists and the character has not
  // learned (shared/professions.ts). It reads the same with the game closed.
  import type { Known } from '../../shared/characters'
  import { t } from '../../shared/i18n'
  import { professionsOf, type Recipe } from '../../shared/professions'
  import type { Sheets } from '../../shared/sheet'
  import { itemTip } from './item-tip.svelte'

  let { sheets, shown, ready }: { sheets: Sheets; shown: Known | null; ready: boolean } = $props()

  $effect(() => {
    if (!ready || asked) return
    asked = true
    ask(40)
  })
  const sheet = $derived(shown ? sheets[shown.key] : undefined)
  const list = $derived(sheet && facts ? professionsOf(sheet.pieces, facts) : [])
  let chosen = $state(0)
  let typed = $state('')
  const one = $derived(list.find((p) => p.line === chosen) ?? list[0])
  const matches = (r: Recipe): boolean => r.name.toLowerCase().includes(typed.trim().toLowerCase())
  const known = $derived(one ? one.known.filter(matches) : [])
  const groups = $derived(one ? one.groups.map((g) => ({ name: g.name, recipes: g.recipes.filter(matches) })).filter((g) => g.recipes.length) : [])
  const unknown = $derived(one ? one.unknown.filter(matches) : [])
  const picture = (r: Recipe): string => (r.item ? `${TILES}/items/${r.item}.png` : `${TILES}/pictures/${r.icon}.png`)
</script>

{#snippet row(p: (typeof list)[number])}
  <button class="prof" class:on={p === one} aria-pressed={p === one} onclick={() => (chosen = p.line)}>
    <img src="{TILES}/pictures/{p.icon}.png" alt="" onerror={(e) => e.currentTarget.setAttribute('style', 'visibility: hidden')} />
    <span class="name">{p.name}</span>
    <span class="bar" role="progressbar" aria-label={p.name} aria-valuenow={p.rank} aria-valuemax={p.most}><i style:width="{p.most ? (100 * p.rank) / p.most : 0}%"></i><b>{p.rank} / {p.most}</b></span>
  </button>
{/snippet}

{#snippet recipe(r: Recipe, no = false)}
  <li class:no use:itemTip={{ item: r.item }}>
    <img src={picture(r)} alt="" onerror={(e) => e.currentTarget.setAttribute('style', 'visibility: hidden')} />
    <span class={no ? '' : r.difficulty}>{r.name}</span>
    {#if no}<em>{r.yellow}</em>{/if}
  </li>
{/snippet}

<main class="surface">
  {#if !shown || !sheet}
    <p class="empty">{t('items.page.noCharacter')}</p>
  {:else if facts && !list.length}
    <p class="empty"><b>{t('items.professions.none')}</b>{t('items.professions.learn')}<small>{t('items.professions.also')}</small></p>
  {:else if one}
    <div class="profs">
      <nav class="list">
        {#if list.some((p) => !p.secondary)}<h2>{t('items.professions.primary')}</h2>{/if}
        {#each list.filter((p) => !p.secondary) as p (p.line)}{@render row(p)}{/each}
        {#if list.some((p) => p.secondary)}<h2>{t('items.professions.secondary')}</h2>{/if}
        {#each list.filter((p) => p.secondary) as p (p.line)}{@render row(p)}{/each}
      </nav>
      <section class="recipes" aria-label={one.name}>
        <header>
          <h3>{one.name}<span>{one.rank} / {one.most}</span></h3>
          {#if one.known.length || one.unknown.length}<input type="search" placeholder={t('items.professions.filter')} bind:value={typed} />{/if}
        </header>
        {#if !one.crafts}
          <p class="note">{t('items.professions.gathers', { profession: one.name })}</p>
        {:else if !one.seen && !one.known.length}
          <p class="note"><b>{t('items.professions.unseen')}</b>{t('items.professions.open', { profession: one.name })}</p>
        {:else}
          {#if one.known.length}
            <h4>{t('items.professions.known')}<small>{one.known.length}</small></h4>
            <p class="key"><i class="optimal">{t('items.professions.optimal')}</i><i class="medium">{t('items.professions.medium')}</i><i class="easy">{t('items.professions.easy')}</i><i class="trivial">{t('items.professions.trivial')}</i></p>
            {#each groups as g (g.name)}
              {#if g.name}<h5>{g.name}</h5>{/if}
              <ul>{#each g.recipes as r (r.spell)}{@render recipe(r)}{/each}</ul>
            {/each}
          {/if}
          {#if one.unknown.length}
            <h4>{t('items.professions.unknown')}<small>{one.unknown.length}</small></h4>
            <p class="key">{t('items.professions.unknownNote')}</p>
            <ul>{#each unknown as r (r.spell)}{@render recipe(r, true)}{/each}</ul>
          {/if}
          {#if !one.seen}
            <p class="note"><b>{t('items.professions.unseen')}</b>{t('items.professions.open', { profession: one.name })}</p>
          {/if}
          {#if typed.trim() && !known.length && !unknown.length}<p class="key">{t('items.professions.noMatch')}</p>{/if}
        {/if}
      </section>
    </div>
  {/if}
</main>

<style>
  /* Its narrow form follows the width of its place: the professions over the recipes under 620 px. */
  main {
    position: absolute;
    inset: 0;
    overflow: hidden;
    container: professions / inline-size;
  }
  .empty {
    max-width: 520px;
    margin: 64px auto;
    padding: 0 20px;
    color: var(--text-dim);
    text-align: center;
  }
  .empty b,
  .note b {
    display: block;
    margin-bottom: 6px;
    font: var(--t-title);
    color: var(--gold);
  }
  .empty small {
    display: block;
    margin-top: 8px;
    color: var(--text-off);
  }
  .profs {
    display: grid;
    grid-template-columns: 250px minmax(0, 1fr);
    height: 100%;
  }
  .list {
    overflow-y: auto;
    padding: 12px 10px;
    border-right: 1px solid var(--bronze-700);
  }
  h2 {
    margin: 4px 6px 6px;
    font: 600 12px/16px var(--font);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-off);
  }
  h2:not(:first-child) {
    margin-top: 14px;
  }
  .prof {
    display: grid;
    grid-template: auto auto / 30px minmax(0, 1fr);
    column-gap: 10px;
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
  .prof:hover {
    background: var(--stone-800);
  }
  .prof.on {
    border-color: var(--bronze-500);
    background: linear-gradient(var(--stone-600), var(--stone-700));
  }
  .prof.on .name {
    color: var(--gold);
  }
  .prof img {
    grid-row: 1 / 3;
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
  /* The game's skill bar: blue, the level written over it. */
  .bar {
    position: relative;
    height: 14px;
    overflow: hidden;
    border-radius: 2px;
    background: #0008;
    box-shadow: inset 0 0 0 1px var(--bronze-700);
  }
  .bar i {
    position: absolute;
    inset: 0 auto 0 0;
    background: linear-gradient(#3a7bd5, #1d3f7a);
  }
  .bar b {
    position: relative;
    display: block;
    font: 600 11px/14px var(--font);
    font-variant-numeric: tabular-nums;
    text-align: center;
    color: #fff;
    text-shadow: 0 1px 0 #000;
  }
  .recipes {
    overflow-y: auto;
    padding: 12px 16px 28px;
  }
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 14px;
    margin-bottom: 8px;
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
  h4 {
    display: flex;
    gap: 8px;
    margin: 14px 0 2px;
    font: var(--t-label);
    color: var(--text-dim);
  }
  h4 small {
    font: var(--t-small);
    color: var(--text-off);
  }
  .key {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 14px;
    margin: 0 0 6px;
    font: var(--t-small);
    color: var(--text-off);
  }
  .key i {
    font-style: normal;
  }
  /* A heading of the game's window: its gold, a thin line under it. */
  h5 {
    margin: 10px 0 4px;
    padding-bottom: 2px;
    border-bottom: 1px solid var(--bronze-700);
    font: var(--t-label);
    color: var(--quest);
  }
  .note {
    margin: 6px 0;
    padding: 10px 12px;
    border: 1px dashed var(--bronze-700);
    border-radius: 4px;
    color: var(--text-dim);
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    columns: 280px;
    column-gap: 18px;
  }
  li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 2px 0;
    break-inside: avoid;
    font: var(--t-body);
  }
  li img {
    flex: none;
    width: 22px;
    height: 22px;
    border-radius: 2px;
    box-shadow: 0 0 0 1px #000;
  }
  li span {
    min-width: 0;
  }
  li em {
    margin-left: auto;
    padding-right: 8px;
    font: var(--t-small);
    font-style: normal;
    color: var(--text-off);
  }
  /* The colours of the game's window: a sure skill-up, a likely one, a seldom one, none. */
  .optimal {
    color: #ff8040;
  }
  .medium {
    color: #ffff00;
  }
  .easy {
    color: #40bf40;
  }
  .trivial {
    color: #808080;
  }
  li.no span {
    color: var(--text-off);
  }
  li.no img {
    filter: grayscale(1) brightness(0.6);
  }
  @container professions (width < 620px) {
    .profs {
      grid-template: auto minmax(0, 1fr) / minmax(0, 1fr);
    }
    .list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      column-gap: 10px;
      max-height: 45%;
      border-right: 0;
      border-bottom: 1px solid var(--bronze-700);
    }
    .list h2 {
      grid-column: 1 / -1;
    }
    input {
      width: 100%;
      margin-left: 0;
    }
  }
</style>
