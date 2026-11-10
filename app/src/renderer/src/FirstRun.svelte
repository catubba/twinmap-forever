<script lang="ts">
  // The first run: four steps on one page, each ticking itself as it becomes true. The app looks
  // and tells; the addon comes from CurseForge, never from here.
  import type { LinkStatus } from '../../shared/link'
  import { setupComplete, setupSteps, type SetupStatus, type StepState } from '../../shared/setup'
  import Glyph from './Glyph.svelte'
  import Logo from './Logo.svelte'

  let { setup, link, onclose }: { setup: SetupStatus; link: LinkStatus | null; onclose: () => void } = $props()

  const steps = $derived(setupSteps(setup, link))
  const complete = $derived(setupComplete(steps))
  const WORD: Record<StepState, string> = { done: 'Done', todo: 'To do', waiting: 'After the steps above', problem: 'Needs attention' }
  let wrong = $state('') // what was wrong with the folder the player picked

  async function choose(): Promise<void> {
    wrong = (await window.twinmap.chooseGameFolder()) ?? ''
  }
</script>

<main class="surface">
  <div class="column">
    <header>
      <Logo size={56} />
      <p>A live map of World of Warcraft: Forever for your second screen. Four steps and your character is on it.</p>
    </header>

    <ol>
      {#each steps as step, i (step.title)}
        <li class={step.state}>
          <h2 class="band">
            {i + 1}. {step.title}
            <span class="count">{#if step.state === 'done'}<Glyph name="check" />{/if}{WORD[step.state]}</span>
          </h2>
          <div class="body">
            {#each step.lines as line (line)}
              <p>{line}</p>
            {/each}
            {#if step.action === 'choose-folder'}
              {#if wrong}<p class="wrong">{wrong}</p>{/if}
              <button class="btn" onclick={choose}>{step.state === 'done' ? 'Change folder' : 'Choose the game folder'}</button>
            {:else if step.action === 'curseforge'}
              <button class="btn" disabled={!setup.gameFolder} onclick={() => window.twinmap.openCurseForge()}>Get Twinmap Forever on CurseForge</button>
            {/if}
          </div>
        </li>
      {/each}
    </ol>

    <footer>
      {#if complete}
        <p class="ready">All set.</p>
        <button class="btn" onclick={onclose}>Go to the map</button>
      {:else}
        <p>The map works without the game too; your character appears on it once the steps are done.</p>
        <button class="btn" onclick={onclose}>Look at the map</button>
      {/if}
    </footer>
  </div>
</main>

<style>
  main {
    position: absolute;
    inset: 46px 0 0;
    overflow-y: auto;
  }
  .column {
    max-width: 640px;
    margin: 0 auto;
    padding: 32px 0 48px;
  }
  header {
    padding: 0 16px 24px;
    color: var(--gold);
  }
  header p {
    margin: 16px 0 0;
    color: var(--text);
  }
  ol {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .band .count {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--text-dim);
  }
  .done .count {
    color: var(--done);
  }
  .problem .count {
    color: var(--objective);
  }
  .body {
    padding: 12px 16px 24px;
  }
  .body p {
    margin: 0 0 8px;
    max-width: 70ch;
  }
  .body p + p {
    color: var(--text-dim);
  }
  .waiting .body {
    color: var(--text-dim);
  }
  .body .wrong,
  .problem .body p {
    color: var(--objective);
  }
  .body .btn {
    margin-top: 4px;
  }
  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 16px;
    box-shadow:
      0 -1px 0 var(--bronze-600),
      0 -2px 0 #000;
  }
  footer p {
    margin: 0;
    color: var(--text-dim);
  }
  footer .ready {
    color: var(--done);
  }
</style>
