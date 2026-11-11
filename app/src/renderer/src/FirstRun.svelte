<script lang="ts">
  // The first run: one page for each thing, sliding in from the right. The app looks and tells;
  // the addon comes from CurseForge, never from here.
  import { fly } from 'svelte/transition'
  import type { LinkStatus } from '../../shared/link'
  import { setupPages, timeLeft, type SetupStatus } from '../../shared/setup'
  import type { TilesStatus } from '../../shared/tiles-status'
  import Glyph from './Glyph.svelte'
  import Logo from './Logo.svelte'
  import { pageIn, pageOut } from './motion'

  let { setup, tiles, link, onclose }: { setup: SetupStatus; tiles: TilesStatus | null; link: LinkStatus | null; onclose: () => void } = $props()

  const pages = $derived(setupPages(setup, tiles, link))
  let at = $state(0)
  let dir = $state(1)
  const page = $derived(pages[at]!)
  const last = $derived(at === pages.length - 1)
  function go(step: number): void {
    dir = step
    at += step
  }

  let wrong = $state('') // what was wrong with the folder the player picked
  async function choose(): Promise<void> {
    wrong = (await window.twinmap.chooseGameFolder()) ?? ''
  }

  // How long the map still takes: from when its building was first seen.
  let started: { at: number; percent: number } | null = null
  let left = $state('')
  $effect(() => {
    const building = pages[1]!
    if (building.state !== 'working' || building.progress === undefined) {
      started = null
      left = ''
      return
    }
    started ??= { at: Date.now(), percent: building.progress }
    left = timeLeft(started.at, started.percent, Date.now(), building.progress)
  })
</script>

<main class="surface">
  <header>
    <Logo size={40} />
    <ol aria-label="Steps">
      {#each pages as p, i (p.id)}
        <li class:here={i === at} class:done={p.state === 'done' && i !== at} aria-current={i === at ? 'step' : undefined}>{#if p.state === 'done' && i !== at}<Glyph name="check" size={12} />{/if}{p.title}</li>
      {/each}
    </ol>
  </header>

  <div class="stage">
    {#key at}
      <section in:fly={pageIn(dir)} out:fly={pageOut(dir)} aria-labelledby="page-title">
        <h1 id="page-title">{page.title}</h1>
        <p class="intro">{page.intro}</p>
        {#if page.warning}<p class="warning">{page.warning}</p>{/if}

        <div class="now {page.state}" role="status">
          <p class="first">
            {#if page.state === 'done'}<Glyph name="check" />{/if}
            {page.lines[0]}
          </p>
          {#if page.progress !== undefined}
            <progress class="bar" value={page.progress} max="100" aria-label="Building the map"></progress>
            <p class="count"><span>{Math.floor(page.progress)}%</span><span>{left}</span></p>
          {/if}
          {#each page.lines.slice(1) as line (line)}
            <p>{line}</p>
          {/each}
          {#if page.action === 'choose-folder'}
            {#if wrong}<p class="wrong">{wrong}</p>{/if}
            <button class="btn" onclick={choose}>{page.state === 'done' ? 'Choose another folder' : 'Choose the game folder'}</button>
          {:else if page.action === 'curseforge'}
            <button class="btn" onclick={() => window.twinmap.openCurseForge()}>Get Twinmap Forever on CurseForge</button>
          {:else if page.action === 'retry'}
            <button class="btn" onclick={() => window.twinmap.retryTiles()}>Try again</button>
          {/if}
        </div>
      </section>
    {/key}
  </div>

  <footer>
    <button class="plain" onclick={onclose}>Skip, look at the map</button>
    <span class="nav">
      {#if at > 0}<button class="btn" onclick={() => go(-1)}>Back</button>{/if}
      {#if last}
        <button class="btn" disabled={page.state !== 'done'} onclick={onclose}>Go to the map</button>
      {:else}
        <button class="btn" disabled={page.state !== 'done'} onclick={() => go(1)}>Next</button>
      {/if}
    </span>
  </footer>
</main>

<style>
  main {
    position: absolute;
    inset: 46px 0 0;
    display: grid;
    /* The page and its buttons stay together in the middle of a tall window: Next is never far under what it follows. */
    grid-template-rows: auto minmax(0, 440px) auto;
    align-content: center;
    justify-items: center;
    overflow: hidden;
  }
  header,
  footer,
  section {
    width: min(640px, 100% - 48px);
  }

  /* The mark, and under it the steps: with their ticks they are too long to stand beside it. */
  header {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
    padding: 24px 0 0;
    color: var(--gold);
  }
  /* Where the player is among the pages: the names in a row, the one on show in gold. */
  ol {
    display: flex;
    gap: 14px;
    margin: 0;
    padding: 0;
    list-style: none;
    font: var(--t-small);
    color: var(--text-dim);
    white-space: nowrap;
  }
  ol li {
    display: flex;
    align-items: center;
    gap: 3px;
  }
  ol .done {
    color: var(--text);
  }
  ol .here {
    color: var(--gold);
  }

  /* The pages lie one over the other while one leaves and the next comes. */
  .stage {
    position: relative;
    width: 100%;
    overflow: hidden;
  }
  section {
    position: absolute;
    inset: 0;
    margin: 0 auto;
    padding-top: clamp(8px, 9vh - 30px, 80px); /* less air above the title in a low window */
    overflow-y: auto; /* a long page in a low window scrolls, it is not cut */
  }
  h1 {
    margin: 0;
    font: 400 34px/40px var(--display);
    color: var(--gold);
    text-shadow: 0 1px 0 #000;
  }
  .intro {
    max-width: 60ch;
    margin: 12px 0 0;
  }

  /* What is true now, under a bronze line. */
  .now {
    margin-top: 28px;
    padding-top: 18px;
    box-shadow: inset 0 1px 0 var(--bronze-600);
  }
  .now p {
    max-width: 60ch;
    margin: 0 0 8px;
    color: var(--text-dim);
  }
  .now .first {
    display: flex;
    align-items: center;
    gap: 8px;
    font: var(--t-title);
    color: var(--text);
  }
  .now.done .first {
    color: var(--done);
  }
  .now.problem .first,
  .now .wrong {
    color: var(--objective);
  }
  .now .btn {
    margin-top: 8px;
  }
  .now .bar {
    height: 10px;
    margin: 14px 0 6px;
  }
  .now .count {
    max-width: none;
    display: flex;
    justify-content: space-between;
  }

  /* Read before the thing it warns of is on: above what there is to do, in the size of the text. */
  .warning {
    max-width: 60ch;
    margin: 12px 0 0;
  }

  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 0 28px;
    box-shadow: inset 0 1px 0 var(--bronze-600);
  }
  .nav {
    display: flex;
    gap: 8px;
  }
  .plain {
    padding: 0;
    border: 0;
    background: none;
    font: var(--t-body);
    color: var(--text-dim);
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
  }
  .plain:hover {
    color: var(--text);
  }
</style>
