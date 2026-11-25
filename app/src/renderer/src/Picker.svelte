<script lang="ts">
  // The character the app shows, at the start of the top row: name and surname in the colour of the
  // class, the level, and a green light while that character is the one in game. A click opens the
  // characters the app has kept; one picked shows its bags, bank and spells, never its place on the
  // map. A right click on one that is not in game offers to forget it.
  import { ago, type Known } from '../../shared/characters'
  import { t } from '../../shared/i18n'

  let { known, shown, now, onpick, onforget }: { known: Known[]; shown: Known | null; now: number; onpick: (key: string | null) => void; onforget: (key: string) => void } = $props()

  let open = $state(false)
  let forgetting = $state<string | null>(null)
  let box = $state<HTMLElement>()

  function close(): void {
    open = false
    forgetting = null
  }
  // Anywhere else, or Escape, closes the list.
  function away(e: PointerEvent): void {
    if (open && box && !box.contains(e.target as Node)) close()
  }
  function key(e: KeyboardEvent): void {
    if (open && e.key === 'Escape') close()
  }
  function pick(k: Known): void {
    onpick(k.live ? null : k.key)
    close()
  }
</script>

<svelte:window onpointerdown={away} onkeydown={key} />

{#if shown}
  <div class="picker" bind:this={box}>
    <button class="who" class:open aria-haspopup="listbox" aria-expanded={open} style:--class={shown.color} onclick={() => ((open = !open), (forgetting = null))}>
      {#if shown.live}<i class="light" title={t('items.picker.inGame')}></i>{/if}
      <span class="name">{shown.key}</span>
      {#if shown.level !== undefined}<span class="level">{shown.level}</span>{/if}
      {#if !shown.live}<span class="seen">{t('items.picker.seen', { ago: ago(shown.seen, now) })}</span>{/if}
      <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1 3h8L5 8z" /></svg>
    </button>
    {#if open}
      <div class="list" role="listbox" aria-label={t('items.picker.list')}>
        {#each known as k (k.key)}
          <div class="char" role="option" tabindex="-1" aria-selected={k.key === shown.key} class:current={k.key === shown.key}
            oncontextmenu={(e) => {
              e.preventDefault()
              if (!k.live) forgetting = k.key
            }}>
            <button class="pick" onclick={() => pick(k)}>
              <span class="n" style:color={k.color}>{k.key}</span>
              {#if k.line}<span class="d">{k.line}</span>{/if}
            </button>
            {#if forgetting === k.key}
              <button class="btn forget" onclick={() => (onforget(k.key), (forgetting = null))}>{t('items.picker.forget')}</button>
            {:else}
              <span class="when" class:live={k.live}>{k.live ? t('items.picker.inGame') : ago(k.seen, now)}</span>
            {/if}
          </div>
        {/each}
        <p class="note">{t('items.picker.note')}</p>
      </div>
    {/if}
  </div>
{/if}

<style>
  .picker {
    position: relative;
    min-width: 0; /* in a top row short of room the name is cut, with three dots */
    -webkit-app-region: no-drag;
  }
  /* As an entry of the top row: no relief at rest, the edge of a tab under the mouse and while open. */
  .who {
    display: flex;
    align-items: baseline;
    gap: 8px;
    height: 33px;
    padding: 0 12px 0 10px;
    border: 1px solid transparent;
    border-bottom: 0;
    border-radius: 5px 5px 0 0;
    background: none;
    font: var(--t-nav);
    color: var(--class);
    text-shadow: 0 1px 0 #000;
    cursor: pointer;
    max-width: 100%;
    overflow: hidden; /* squeezed by many workspaces at the top: cut, never under the tabs */
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .who:hover,
  .who.open {
    border-color: var(--bronze-600);
    background: #ffffff0d;
  }
  .light {
    flex: none;
    align-self: center;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--done);
    box-shadow: 0 0 0 1px #000;
  }
  .level {
    font: 500 14px/31px var(--font);
    color: var(--text-dim);
  }
  .seen {
    font: var(--t-small);
    color: var(--text-dim);
  }
  .who svg {
    flex: none;
    align-self: center;
    width: 10px;
    height: 10px;
    fill: var(--text-dim);
  }
  .list {
    position: absolute;
    left: 0;
    top: calc(100% + 6px);
    z-index: 2500;
    width: 330px;
    padding: 6px 0;
    background: var(--float);
    box-shadow:
      0 0 0 1px var(--float-edge),
      0 0 0 2px #000,
      0 10px 30px #000c;
    white-space: normal;
  }
  .char {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
  }
  .char:hover {
    background: #ffffff10;
  }
  .char.current::before {
    content: '';
    position: absolute;
    left: 9px;
    top: 15px;
    width: 5px;
    height: 5px;
    rotate: 45deg;
    background: var(--current);
  }
  .pick {
    display: grid;
    padding: 6px 8px 6px 22px;
    border: 0;
    background: none;
    text-align: left;
    cursor: pointer;
  }
  .n {
    font: 400 16px/20px var(--display);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .d {
    font: var(--t-small);
    color: var(--text-dim);
  }
  .when {
    padding: 7px 16px 0 0;
    font: var(--t-small);
    color: var(--text-dim);
    white-space: nowrap;
  }
  .when.live {
    color: var(--done);
  }
  .forget {
    margin: 8px 12px 0 0;
    padding: 0 10px;
    height: 24px;
    font: var(--t-small);
  }
  .note {
    margin: 6px 0 0;
    padding: 6px 16px 2px;
    border-top: 1px solid #ffffff1a;
    font: var(--t-small);
    color: var(--text-dim);
  }
  /* A narrow top row: the name alone, cut short if it must be. */
  /* When it was last seen is in the list too: in the app's window it leaves the row before the name is cut. */
  @media (max-width: 1200px) {
    :global(html:not(.web)) .seen {
      display: none;
    }
  }
  @media (max-width: 760px) {
    .who {
      padding: 0 8px;
      max-width: 40vw;
    }
    .level,
    .seen {
      display: none;
    }
  }
</style>
