<script module lang="ts">
  import { TALENTS_FILE, type TalentFacts } from '../../shared/talents'
  import { TILES } from './web'
  // The game's talent trees (talents.json, made beside the map by tiles-worker.ts just after the map is ready), asked for
  // then, and again every few seconds until the file is there, as Professions does for spells.json.
  let facts = $state.raw<TalentFacts | null>(null)
  let asked = false
  function ask(left: number): void {
    const again = (): unknown => left > 0 && setTimeout(() => ask(left - 1), 3000)
    void fetch(`${TILES}/${TALENTS_FILE}`)
      .then((r) => (r.status === 200 ? r.json() : null))
      .then((read: TalentFacts | null) => (read ? (facts = read) : again()))
      .catch(again)
  }
</script>

<script lang="ts">
  // The Talents panel of the Character workspace (M20-F12), from the sheet the app keeps for the character shown: the three
  // trees of its class side by side as the game's window draws them, each talent with the ranks taken, the arrows between
  // them, the points spent in each tree. Where the place is too narrow for three, one tree at a time under three tabs. It
  // shows, it does not plan: nothing here changes a talent. It reads the same with the game closed.
  import type { Known } from '../../shared/characters'
  import { t } from '../../shared/i18n'
  import type { Sheets } from '../../shared/sheet'
  import { treeOf, type Talent } from '../../shared/talents'
  import { CLASS_IDS } from '../../shared/trainers'

  let { sheets, shown, ready }: { sheets: Sheets; shown: Known | null; ready: boolean } = $props()

  $effect(() => {
    if (!ready || asked) return
    asked = true
    ask(40)
  })
  const sheet = $derived(shown ? sheets[shown.key] : undefined)
  const tree = $derived(sheet && facts ? treeOf(sheet.pieces.talents, shown?.class ? CLASS_IDS[shown.class] : undefined, facts) : undefined)
  let chosen = $state<number | null>(null)
  // The tab on show where only one fits: the one chosen, else the one with the most points.
  const on = $derived(chosen ?? (tree ? tree.tabs.reduce((best, tab, i) => (tab.spent > tree.tabs[best]!.spent ? i : best), 0) : 0))

  // The arrows, in units of a talent's side: talents 1 apart and 0.35 between them, as the grid lays them out.
  const STEP = 1.35
  function arrow(a: Talent, b: Talent): { line: string; head: string } {
    const across = a.row === b.row
    const [x1, y1] = across ? [a.column * STEP + 1, a.row * STEP + 0.5] : [a.column * STEP + 0.5, a.row * STEP + 1]
    const [x2, y2] = across ? [b.column * STEP - 0.04, b.row * STEP + 0.5] : [b.column * STEP + 0.5, b.row * STEP - 0.04]
    const length = Math.hypot(x2 - x1, y2 - y1) || 1, dx = (x2 - x1) / length, dy = (y2 - y1) / length, s = 0.2
    const head = `${x2},${y2} ${x2 - dx * s - dy * s * 0.7},${y2 - dy * s + dx * s * 0.7} ${x2 - dx * s + dy * s * 0.7},${y2 - dy * s - dx * s * 0.7}`
    return { line: `M${x1},${y1} L${x2 - dx * s * 0.8},${y2 - dy * s * 0.8}`, head }
  }
</script>

<main class="surface">
  {#if !shown || !sheet}
    <p class="empty">{t('items.page.noCharacter')}</p>
  {:else if facts && (!tree || (!tree.spent && !tree.free))}
    <p class="empty"><b>{t('items.talents.none')}</b>{t('items.talents.learn')}</p>
  {:else if tree}
    <header class="top">
      <h2>{t('app.top.talents')}</h2>
      <span>{t('items.talents.spent', { count: tree.spent })}</span>
      {#if tree.free}<span class="free">{t('items.talents.free', { count: tree.free })}</span>{/if}
    </header>
    <nav class="tabs">
      {#each tree.tabs as tab, i (i)}
        <button class:on={i === on} aria-pressed={i === on} aria-label="{tab.name} {tab.spent}" title={tab.name} onclick={() => (chosen = i)}>
          <img src="{TILES}/pictures/{tab.icon}.png" alt="" onerror={(e) => e.currentTarget.setAttribute('style', 'visibility: hidden')} />
          <span>{tab.name}</span><em>{tab.spent}</em>
        </button>
      {/each}
    </nav>
    <div class="trees">
      {#each tree.tabs as tab, i (i)}
        <section class="tree" class:on={i === on} aria-label={tab.name}>
          <h3>
            <img src="{TILES}/pictures/{tab.icon}.png" alt="" onerror={(e) => e.currentTarget.setAttribute('style', 'visibility: hidden')} />
            <span>{tab.name}</span><em>{tab.spent}</em>
          </h3>
          <div class="grid">
            <svg viewBox="0 0 {4 * STEP - 0.35} {7 * STEP - 0.35}" aria-hidden="true">
              {#each tab.arrows as [a, b] (a.node + ' ' + b.node)}
                {@const d = arrow(a, b)}
                <g class:lit={a.rank > 0}><path d={d.line} /><polygon points={d.head} /></g>
              {/each}
            </svg>
            {#each tab.talents as x (x.node)}
              <div class="t" class:full={x.rank === x.most} class:some={x.rank > 0 && x.rank < x.most} class:right={x.column > 1} style:grid-area="{x.row + 1} / {x.column + 1}" role="img" aria-label="{x.name}, {t('items.talents.rank', { rank: x.rank, most: x.most })}">
                <img src="{TILES}/pictures/{x.icon}.png" alt="" onerror={(e) => e.currentTarget.setAttribute('style', 'visibility: hidden')} />
                <b>{x.rank}/{x.most}</b>
                <span class="tip"><strong>{x.name}</strong>{t('items.talents.rank', { rank: x.rank, most: x.most })}<small>{tab.name}</small></span>
              </div>
            {/each}
          </div>
        </section>
      {/each}
    </div>
  {/if}
</main>

<style>
  /* Its narrow form follows the width of its place: one tree at a time under tabs below 600 px. Its height counts too: the
     talents shrink to fit a place as low as half the Character workspace. */
  main {
    position: absolute;
    inset: 0;
    overflow: auto;
    padding: 12px 14px 20px;
    container: talents / size;
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
  .top {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 16px;
    margin-bottom: 12px;
    color: var(--text-dim);
  }
  h2 {
    margin: 0;
    font: var(--t-title);
    color: var(--gold);
  }
  /* The game's own green for what is still to do. */
  .free {
    color: #40bf40;
  }
  .tabs {
    display: none;
    gap: 6px;
    margin-bottom: 12px;
  }
  .tabs button {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 5px 8px;
    border: 1px solid var(--bronze-700);
    border-radius: 4px;
    background: var(--stone-800);
    color: var(--text-dim);
    font: var(--t-body);
    text-align: left;
    cursor: pointer;
  }
  .tabs button.on {
    border-color: var(--bronze-500);
    background: linear-gradient(var(--stone-600), var(--stone-700));
    color: var(--gold);
  }
  .tabs img,
  h3 img {
    flex: none;
    width: 22px;
    height: 22px;
    border-radius: 3px;
    box-shadow: 0 0 0 1px #000;
  }
  .tabs span,
  h3 span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tabs em,
  h3 em {
    margin-left: auto;
    font: var(--t-body);
    font-style: normal;
    color: var(--text-off);
  }
  .tabs .on em {
    color: var(--gold);
  }
  /* A talent's side: as large as three trees side by side and seven rows allow, from 24 to 40 px. */
  .trees {
    --c: clamp(24px, min((100cqi - 134px) / 15.2, (100cqb - 130px) / 9.1), 40px);
    display: flex;
    justify-content: center;
    gap: 14px;
  }
  .tree {
    flex: none;
    padding: 10px 12px 12px;
    border: 1px solid var(--bronze-700);
    border-radius: 4px;
    background: radial-gradient(ellipse at 50% 0%, var(--stone-800), var(--stone-950));
  }
  h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 10px;
    font: var(--t-label);
    color: var(--gold);
  }
  .grid {
    position: relative;
    display: grid;
    grid-template: repeat(7, var(--c)) / repeat(4, var(--c));
    gap: calc(var(--c) * 0.35);
  }
  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    pointer-events: none;
  }
  svg path {
    fill: none;
    stroke: #666;
    stroke-width: 0.08;
  }
  svg polygon {
    fill: #666;
  }
  svg .lit path {
    stroke: var(--gold);
  }
  svg .lit polygon {
    fill: var(--gold);
  }
  /* A talent as the game's window draws it: grey until taken, green while ranks are left, gold when all are taken. */
  .t {
    position: relative;
  }
  .t img {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 4px;
    box-shadow:
      0 0 0 1px #000,
      0 0 0 2px #555;
    filter: grayscale(1) brightness(0.45);
  }
  .t.some img {
    filter: none;
    box-shadow:
      0 0 0 1px #000,
      0 0 0 2px #40bf40;
  }
  .t.full img {
    filter: none;
    box-shadow:
      0 0 0 1px #000,
      0 0 0 2px var(--gold);
  }
  .t b {
    position: absolute;
    right: -6px;
    bottom: -6px;
    min-width: 22px;
    padding: 0 3px;
    border: 1px solid #000;
    border-radius: 3px;
    background: var(--stone-950);
    font: 600 11px/14px var(--font);
    text-align: center;
    color: var(--text-off);
  }
  .t.some b {
    color: #40bf40;
  }
  .t.full b {
    color: var(--gold);
  }
  .tip {
    display: none;
    position: absolute;
    z-index: 2;
    top: calc(100% + 10px);
    left: 0;
    width: max-content;
    max-width: 220px;
    padding: 8px 10px;
    border: 1px solid var(--bronze-500);
    border-radius: 4px;
    background: var(--stone-950);
    box-shadow: 0 6px 18px #000a;
    font: var(--t-body);
    color: var(--text-dim);
  }
  .t.right .tip {
    right: 0;
    left: auto;
  }
  .t:hover {
    z-index: 3;
  }
  .t:hover .tip {
    display: block;
  }
  .tip strong {
    display: block;
    font-weight: 600;
    color: var(--gold);
  }
  .tip small {
    display: block;
    margin-top: 4px;
    color: var(--text-off);
  }
  @container talents (width < 600px) {
    .tabs {
      display: flex;
    }
    .trees {
      --c: clamp(24px, min((100cqi - 54px) / 5.05, (100cqb - 140px) / 9.1), 40px);
    }
    .tree:not(.on),
    h3 {
      display: none;
    }
  }
  /* Where the names would be cut to a few letters, the trees' pictures tell them apart, as in the game. */
  @container talents (width < 400px) {
    .tabs span {
      display: none;
    }
  }
</style>
