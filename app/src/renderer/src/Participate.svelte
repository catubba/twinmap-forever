<script lang="ts">
  // The question of the participation programme, asked once: after the first run, the first time
  // the app has it. Both answers look the same. A click outside does not close it (a quick click
  // would answer without reading); the cross and Escape do, and count as "No thanks". Either way it
  // is not asked again: Settings keeps the switch.
  import { onMount } from 'svelte'
  import Glyph from './Glyph.svelte'
  import { t } from '../../shared/i18n'

  let { onclose }: { onclose: () => void } = $props()

  let dialog: HTMLDialogElement
  let answer = false
  onMount(() => dialog.showModal())
  const say = (yes: boolean): void => ((answer = yes), dialog.close())
</script>

<dialog bind:this={dialog} class="surface" aria-labelledby="participate-title" onclose={() => void window.twinmap.setParticipate(answer).then(onclose)}>
  <button class="x" aria-label={t('common.close')} onclick={() => say(false)}><Glyph name="close" size={14} /></button>
  <h1 id="participate-title">{t('participate.title')}</h1>
  <p>{t('participate.what')}</p>
  <p>{t('participate.anonymous')}</p>
  <p class="dim">{t('participate.later')} <button class="link" onclick={() => void window.twinmap.openFeedback('participation', '')}>{t('participate.full')}</button></p>
  <div class="foot">
    <button class="btn" onclick={() => say(true)}>{t('participate.yes')}</button>
    <button class="btn" onclick={() => say(false)}>{t('participate.no')}</button>
  </div>
</dialog>

<style>
  dialog {
    position: relative;
    width: min(480px, calc(100vw - 32px));
    max-height: calc(100vh - 32px);
    padding: 24px;
    border: 1px solid var(--bronze-600);
    box-shadow: 0 0 0 1px #000, 0 12px 40px #000c;
    overflow: auto;
    color: var(--text);
  }
  dialog::backdrop {
    background: #000a;
  }
  h1 {
    margin: 0 24px 12px 0;
    font: var(--t-title, inherit);
    color: var(--gold);
  }
  p {
    margin: 0 0 12px;
  }
  .dim {
    color: var(--text-dim);
  }
  .x {
    position: absolute;
    top: 12px;
    right: 12px;
    padding: 4px;
    border: 0;
    background: none;
    color: var(--text-dim);
    cursor: pointer;
  }
  .x:hover {
    color: var(--text);
  }
  .link {
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    color: var(--gold);
    text-decoration: underline;
    cursor: pointer;
  }
  .foot {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
  }
</style>
