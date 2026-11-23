<script lang="ts">
  // The panel of a vendor or a trainer, at the top of the side panel while its label is open on the map
  // (M10-F11, mockups in design/vendors/mockup): for the character picked, a vendor's items with price and how
  // many are in bags and bank; a trainer's spells or recipes, what can be learned now with its total, then each
  // level or skill still to reach, the known folded at the foot. Read only. The logic is in shared/npc-panel.ts.
  import { ago, classNameAll, firstName, type Known } from '../../shared/characters'
  import { around, t } from '../../shared/i18n'
  import { coins, QUALITY_COLORS, type ItemFacts } from '../../shared/items'
  import { craftOf, forRace, grouped, knownSpells, trainerClass, vendorRows, whoOf, type Group } from '../../shared/npc-panel'
  import type { FixedPin } from '../../shared/services'
  import type { Sheets } from '../../shared/sheet'
  import { classTrainer, professionTrainer, trainerReads, type TrainerFacts, type TrainerRow } from '../../shared/trainers'
  import { TRAINERS_SEEN } from '../../shared/trainers-seen'
  import Glyph from './Glyph.svelte'
  import { itemTip } from './item-tip.svelte'
  import { TILES } from './web'
  import { lowestOf, type Listing } from '../../shared/ah'

  // listing: the prices of the auction house on show (M18-F8): beside a vendor's price, the lowest there for as many.
  let { pin, sheets, shown, now, listing = null, onclose }: { pin: FixedPin; sheets: Sheets; shown: Known | null; now: number; listing?: Listing | null; onclose: () => void } = $props()

  // What the game says of the items and of the trainers, made beside the map (tiles-worker.ts).
  let items = $state.raw<ItemFacts | null>(null)
  let trainers = $state.raw<TrainerFacts>({ format: 0, classes: {}, spells: {}, makes: {} })
  $effect(() => {
    const read = <T,>(file: string, set: (v: T) => void): void =>
      void fetch(`${TILES}/${file}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((v: T | null) => v && set(v))
        .catch(() => {})
    read<ItemFacts>('items.json', (v) => (items = v))
    read<TrainerFacts>('trainers.json', (v) => (trainers = v))
  })

  const sheet = $derived(shown ? sheets[shown.key] : undefined)
  const who = $derived(whoOf(sheet))
  const money = $derived(typeof sheet?.pieces.money === 'number' ? sheet.pieces.money : null)
  const reads = $derived(trainerReads(sheets, TRAINERS_SEEN))
  const npc = $derived(pin.npc ?? 0)
  const goods = $derived(pin.sells?.length && items ? vendorRows(pin.sells, items, sheet) : [])
  const craft = $derived(pin.layers.includes('trainers') ? professionTrainer(npc, trainers, reads) : null)
  const cls = $derived(pin.layers.includes('trainers') && !craft ? (reads.trainers.get(npc)?.c ?? trainerClass(pin.sub)) : null)
  const mine = $derived(!!cls && cls === who.class)
  const stand = $derived(craft ? craftOf(sheet, craft.profession, craft.ranks) : null)
  const list = $derived.by(() => {
    if (!trainers.format) return null // not read yet: a list without the game's facts would show numbers for names
    if (craft && stand) return grouped(craft.rows, (r) => r.skill, stand.skill, stand.known)
    if (cls && mine) return grouped(forRace(classTrainer(npc, cls, trainers, reads), who.race), (r) => r.level, who.level ?? 0, knownSpells(sheet))
    // Another class's trainer someone saw: what it teaches by level, nothing to learn.
    if (cls && reads.trainers.has(npc)) return grouped(classTrainer(npc, cls, trainers, reads), (r) => r.level, 0, new Set())
    return null
  })
  let showKnown = $state(false)

  const cannot = (copper: number | null): boolean => copper !== null && money !== null && copper > money
  // A recipe takes the picture and the colour of what it makes; a spell its own picture.
  const made = (r: TrainerRow): number | undefined => (craft ? trainers.makes[r.spell] : undefined)
  const picture = (r: TrainerRow): string => (made(r) ? `${TILES}/items/${made(r)}.png` : `${TILES}/pictures/${r.icon}.png`)
  const color = (r: TrainerRow, open: boolean): string | undefined => {
    const item = made(r)
    if (!open) return undefined
    return item ? QUALITY_COLORS[items?.[item]?.[1] ?? 1] : craft ? undefined : 'var(--done)'
  }
  const foot = $derived.by(() => {
    if (!shown || !sheet) return t('items.npc.noCharacter')
    const name = firstName(shown.key)
    if (craft) return t(stand?.read ? 'items.npc.recipesRead' : 'items.npc.recipesUnread', { name, profession: craft.profession })
    if (cls) return shown.live ? t('items.npc.spellsNow', { name, level: who.level ?? '?' }) : t('items.npc.spellsAsOf', { name, level: who.level ?? '?', ago: ago(sheet.at.spells ?? shown.seen, now) })
    return sheet.at.bank ? t('items.npc.bankSeen', { ago: ago(sheet.at.bank, now), name }) : t('items.npc.bankUnseen', { name })
  })
  // The headings of the groups still to reach: a profession's by skill, a class's by level.
  const atSkill = (n: number): string => t('items.npc.atSkill', { skill: n })
  const atLevel = (n: number): string => t('items.npc.atLevel', { level: n })
</script>

{#snippet price(copper: number | null)}
  <span class="price" class:short={cannot(copper)}>
    {#if copper === null}?{:else}{#each coins(copper) as [n, coin]}{n}<i class="coin {coin}"></i>{/each}{/if}
  </span>
{/snippet}

<!-- A picture made again when its source changes: one that failed (the facts not read yet) is taken away, and its place stays empty. -->
{#snippet pic(src: string, n = 1)}
  <span class="ico">{#key src}<img {src} alt="" onerror={(e) => e.currentTarget.remove()} />{/key}{#if n > 1}<span class="n">{n}</span>{/if}</span>
{/snippet}

{#snippet line(r: TrainerRow, open: boolean)}
  <div class="t" use:itemTip={{ item: made(r) ?? 0 }}>
    {@render pic(picture(r))}
    <span class="name" style:color={color(r, open)}>{r.name}{#if r.rank}<span class="rank">{t('items.npc.rank', { rank: r.rank })}</span>{/if}</span>
    {#if r.talent}<span class="tag">{t('items.npc.talent')}</span>{:else if r.quest !== undefined}<span class="tag" title={r.quest ? t('items.npc.questTaught', { quest: r.quest }) : t('items.npc.classQuest')}>{t('items.npc.quest')}</span>{:else}{@render price(r.cost)}{/if}
  </div>
{/snippet}

{#snippet heading(text: string, cost: number)}
  <h3 class="grp"><span>{text}</span>{@render price(cost)}</h3>
{/snippet}

{#snippet groups(g: { now: Group; later: Group[] }, at: (n: number) => string)}
  {#if g.now.rows.length}
    {@render heading(t('items.npc.learnNow', { count: g.now.rows.length }), g.now.cost)}
    {#each g.now.rows as r (r.spell)}{@render line(r, true)}{/each}
  {/if}
  {#each g.later as l (l.at)}
    <div class="later">
      {@render heading(at(l.at), l.cost)}
      {#each l.rows as r (r.spell)}{@render line(r, false)}{/each}
    </div>
  {/each}
{/snippet}

<section class="npc" aria-label={pin.name}>
  <h2 class="band">{pin.name}<button class="x" aria-label={t('common.close')} onclick={onclose}><Glyph name="close" size={14} /></button></h2>
  <p class="who">
    <span class="sub">{#if goods.length && !list}{pin.sub ? t('items.npc.subSells', { sub: pin.sub, count: goods.length }) : t('items.npc.sells', { count: goods.length })}{:else}{pin.sub ?? ''}{/if}</span>
    {#if money !== null}{@render price(money)}{/if}
  </p>
  {#if craft && stand}
    <div class="skill">
      {#if stand.most}
        {craft.profession} {stand.skill} / {stand.most}{stand.rank ? ` · ${stand.rank}` : ''}
        <div class="bar"><i style:width="{(100 * stand.skill) / stand.most}%"></i></div>
      {:else}
        {t('items.npc.notLearned', { profession: craft.profession })}
      {/if}
    </div>
  {/if}
  <div class="list">
    {#if cls && !mine}
      <p class="note">{t(who.class ? 'items.npc.teaches' : 'items.npc.teachesPick', { classes: classNameAll(cls) })}</p>
    {/if}
    {#if list}
      {#if craft && stand?.next}
        <div class="later">
          <h3 class="grp"><span>{t('items.npc.nextRank')}</span></h3>
          <div class="t">
            {@render pic(`${TILES}/pictures/${trainers.spells[stand.next.spell]?.[1] ?? 0}.png`)}
            <span class="name">{stand.next.name} {craft.profession}<span class="rank">{t('items.npc.nextNeeds', { skill: stand.next.skill, level: stand.next.level })}</span></span>
            {@render price(stand.next.cost)}
          </div>
        </div>
      {/if}
      {@render groups(list, craft ? atSkill : atLevel)}
      {#if showKnown}
        <div class="later">
          {#each list.known as r (r.spell)}{@render line(r, false)}{/each}
        </div>
      {/if}
    {/if}
    {#if goods.length}
      {#if list}<h3 class="grp"><span>{t('items.npc.sellsHeading', { count: goods.length })}</span></h3>{/if}
      <div class="table">
      <div class="head"><span></span><span>{t('items.npc.columns.item')}</span><span>{t('items.npc.columns.price')}{#if listing}<small title={t('items.npc.ahNote')}>&nbsp;· {t('items.npc.columns.ah')}</small>{/if}</span><span>{t('items.npc.columns.bags')}</span><span>{t('items.npc.columns.bank')}</span></div>
      {#each goods as g (g.id)}
        <div class="r" class:two={!!listing} use:itemTip={{ item: g.id }}>
          {@render pic(`${TILES}/items/${g.id}.png`, g.perBuy)}
          <span class="name" style:color={QUALITY_COLORS[g.quality]}>{g.name}</span>
          {#if listing}
            {@const ah = lowestOf(listing, `${g.id}`)}
            {@const ahAt = around('items.npc.ahPrice', 'price')}
            <span class="both">{@render price(g.buy)}<span class="price ah" title={t('items.npc.ahNote')}>{ahAt[0]}{#if ah}{#each coins(ah * g.perBuy) as [n, coin]}{n}<i class="coin {coin}"></i>{/each}{:else}-{/if}{ahAt[1]}</span></span>
          {:else}
            {@render price(g.buy)}
          {/if}
          <span class="own" class:zero={!g.bags}>{g.bags || '-'}</span>
          <span class="own" class:zero={!g.bank}>{g.bank || '-'}</span>
        </div>
      {/each}
      </div>
    {/if}
  </div>
  {#if list?.known.length}
    <button class="fold" aria-expanded={showKnown} onclick={() => (showKnown = !showKnown)}><span>{t('items.npc.known', { count: list.known.length })}</span><b>{showKnown ? t('items.npc.hide') : t('items.npc.show')}</b></button>
  {/if}
  <p class="foot">{foot}</p>
</section>

<style>
  .npc {
    display: flex;
    flex-direction: column;
    max-height: min(70vh, 640px);
    margin-bottom: 8px;
    font-variant-numeric: tabular-nums;
  }
  .band {
    flex: none;
  }
  .x {
    margin-left: auto;
    padding: 4px;
    border: 0;
    background: none;
    color: var(--text-dim);
    cursor: pointer;
  }
  .x:hover {
    color: var(--text);
  }
  .who {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    margin: 0;
    padding: 8px 16px 6px;
  }
  .who .sub {
    color: var(--text-dim);
  }
  .price {
    white-space: nowrap;
    text-align: right;
  }
  .short {
    color: var(--objective);
  }
  .skill {
    padding: 0 16px 8px;
    font: var(--t-small);
    color: var(--text-dim);
  }
  .bar {
    height: 6px;
    margin-top: 4px;
    background: var(--stone-950);
    box-shadow:
      0 0 0 1px #000,
      0 0 0 2px var(--bronze-700);
  }
  .bar i {
    display: block;
    height: 100%;
    background: linear-gradient(var(--bronze-400), var(--bronze-600));
  }
  .list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
  .grp {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin: 0;
    padding: 10px 16px 3px;
    font: 600 13px/17px var(--font);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--gold);
    border-bottom: 1px solid #ffffff14;
  }
  .grp .price {
    font: var(--t-small);
    letter-spacing: 0;
    text-transform: none;
    color: var(--text);
  }
  .t,
  .r {
    display: grid;
    grid-template-columns: 26px minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;
    height: 31px;
    padding: 0 16px;
  }
  /* The price and the two counts are as wide as their longest text, never less than in English: in a longer language
     the headers push the names, which end with dots, rather than run into each other. The narrow tracks at the two ends,
     with the gaps, are the rows' own margins. */
  .table {
    display: grid;
    grid-template-columns: 8px 26px minmax(0, 1fr) minmax(66px, max-content) minmax(30px, max-content) minmax(30px, max-content) 8px;
    column-gap: 8px;
  }
  .table > .head,
  .table > .r {
    grid-column: 1 / -1;
    grid-template-columns: subgrid;
    padding-left: 0;
    padding-right: 0;
  }
  .table > .head > :first-child,
  .table > .r > :first-child {
    grid-column: 2;
  }
  .head {
    display: grid;
    gap: 8px;
    padding: 2px 16px 4px;
    font: var(--t-small);
    color: var(--text-dim);
    border-bottom: 1px solid #ffffff14;
  }
  .head span:nth-child(n + 3),
  .own {
    text-align: right;
  }
  .r:nth-child(even) {
    background: #ffffff06;
  }
  .t:hover,
  .r:hover {
    background: #ffffff0f;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rank {
    margin-left: 5px;
    font: var(--t-small);
    color: var(--text-dim);
  }
  .tag {
    font: var(--t-small);
    color: var(--service);
  }
  /* With the auction house's price under the vendor's, a row is two lines tall. */
  .r.two {
    height: 40px;
  }
  .both {
    display: grid;
    justify-items: end;
    line-height: 17px;
  }
  .both .ah {
    font: var(--t-small);
    color: var(--text-dim);
  }
  .head small {
    font: inherit;
    color: var(--text-dim);
  }
  .own.zero {
    color: var(--text-off);
  }
  .later .name,
  .later .price {
    color: var(--text-dim);
  }
  .later img {
    filter: grayscale(0.85) brightness(0.75);
  }
  .ico {
    position: relative;
    width: 26px;
    height: 26px;
    border-radius: 3px;
    box-shadow:
      0 0 0 1px #000,
      0 0 0 2px var(--bronze-700);
  }
  .ico img {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 3px;
  }
  .ico .n {
    position: absolute;
    right: 1px;
    bottom: -1px;
    font: 600 11px/1 var(--font);
    color: #fff;
    text-shadow:
      0 0 2px #000,
      0 0 2px #000,
      0 0 2px #000;
  }
  .note {
    margin: 0;
    padding: 4px 16px 10px;
    color: var(--text-dim);
  }
  .fold {
    display: flex;
    justify-content: space-between;
    flex: none;
    width: 100%;
    padding: 9px 16px;
    border: 0;
    background: none;
    font: var(--t-body);
    color: var(--text-dim);
    box-shadow: 0 -1px 0 #ffffff14;
    cursor: pointer;
  }
  .fold b {
    font-weight: 400;
    color: var(--gold);
  }
  .foot {
    flex: none;
    margin: 0;
    padding: 8px 16px 10px;
    font: var(--t-small);
    color: var(--text-dim);
    box-shadow:
      0 -1px 0 var(--bronze-600),
      0 -2px 0 #000;
  }
</style>
