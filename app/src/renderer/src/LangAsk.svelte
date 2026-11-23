<script lang="ts">
  // The language, asked once after the update to a version that speaks the game's (askLangOf, main/setup.ts), drawn
  // as the question of Help improve. A pick is spoken at once and the page loads again with the window still open, in
  // the new language. Done keeps the language shown; the cross or Escape leave the app in English, as it was.
  // Either way it is not asked again: Settings keeps the choice.
  import { onMount } from 'svelte'
  import type { SetupStatus } from '../../shared/setup'
  import Glyph from './Glyph.svelte'
  import LangList from './LangList.svelte'
  import { langNow, t } from '../../shared/i18n'

  let { setup, onclose }: { setup: SetupStatus; onclose: () => void } = $props()
  let dialog: HTMLDialogElement
  let keep = false
  onMount(() => dialog.showModal())
</script>

<dialog bind:this={dialog} class="surface" aria-labelledby="lang-title" onclose={() => void window.twinmap.langAsked(keep ? langNow() : null).then(onclose)}>
  <button class="x" aria-label={t('common.close')} onclick={() => dialog.close()}><Glyph name="close" size={14} /></button>
  <h1 id="lang-title">{t('language.newTitle')}</h1>
  <p>{t('language.newIntro')}</p>
  <LangList {setup} />
  <p class="dim">{t('language.later')}</p>
  <div class="foot">
    <button class="btn" onclick={() => ((keep = true), dialog.close())}>{t('language.done')}</button>
  </div>
</dialog>

<style>
  dialog {
    position: relative;
    width: min(520px, calc(100vw - 32px));
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
    margin-top: 12px;
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
  .foot {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }
</style>
