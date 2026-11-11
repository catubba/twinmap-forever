<script lang="ts">
  // The Now column: the quests of the log with something to do in this zone, and who is near.
  // Nothing to click to make it work: it composes itself from where the character is.
  import type { Position } from '../../shared/game'
  import type { GameMap } from '../../shared/maps'
  import { nearbyRows, nearest, questsHere, steady, wayOf, whereIs, type NowRow } from '../../shared/now'
  import type { QuestPin } from '../../shared/quests'
  import type { FixedPin } from '../../shared/services'
  import Glyph from './Glyph.svelte'

  // onpick: a row was chosen, the map should go there.
  let { pos, quests, fixed, side, ready, onpick }: { pos: Position | undefined; quests: QuestPin[]; fixed: FixedPin[]; side?: string; ready: boolean; onpick?: (row: NowRow) => void } = $props()

  const NEAR = 8 // rows of Nearby

  // The maps of the game, from the folder of the tiles: there once the map is made.
  let maps = $state.raw<GameMap[]>([])
  $effect(() => {
    if (!ready || maps.length) return
    void fetch('twinmap://tiles/maps.json')
      .then((answer) => answer.json() as Promise<GameMap[]>)
      .then((list) => (maps = list))
      .catch(() => {})
  })

  // Inside a dungeon the character has no place on a continent: the column is empty there.
  const me = $derived(pos?.inst ? null : whereIs(maps, pos))
  const around = $derived(nearbyRows(maps, quests, fixed, side))

  // The order of the rows holds for a few seconds; how far and which way follow every reading.
  let here: { rows: NowRow[]; at: number } | null = null
  let near: { rows: NowRow[]; at: number } | null = null
  const lists = $derived.by(() => {
    if (!me) return ((here = near = null), { here: [], near: [] })
    const now = Date.now()
    here = steady(here, questsHere(quests, me.zone, me.at), now)
    near = steady(near, nearest(around, me.continent, me.at, NEAR), now)
    return { here: here.rows, near: near.rows }
  })
  const yards = (n: number): string => `${Math.round(n).toLocaleString('en-US')} yd`
</script>

{#snippet rows(list: NowRow[])}
  <div class="rows">
    {#each list as row (row.key)}
      {@const way = wayOf(me!.at, row.at)}
      <button class="row" onclick={() => onpick?.(row)}>
        <span>{row.name}</span>
        <span class="t-{row.tone}">{row.kind}</span>
        <span class="num">{yards(way.yards)}</span>
        <Glyph name="direction" size={12} turn={way.turn} />
      </button>
    {/each}
  </div>
{/snippet}

<div class="now">
  {#if lists.here.length}
    <h2 class="band">Quests here <span class="count">{lists.here.length}</span></h2>
    {@render rows(lists.here)}
  {/if}
  {#if lists.near.length}
    <h2 class="band">Nearby</h2>
    {@render rows(lists.near)}
  {/if}
</div>

<style>
  .now {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
  /* More room above a title than under it: the band belongs to its own rows. */
  .rows {
    padding: 6px 0 16px;
  }
</style>
