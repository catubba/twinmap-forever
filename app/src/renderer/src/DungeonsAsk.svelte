<script lang="ts">
  // Inside a dungeon, the 2D/3D switch pressed while "3D Dungeon (Experimental)" is off in Settings > Graphics (M23-F23):
  // it says so and offers Settings, drawn as the question of the language is (LangAsk.svelte). Not now, the cross and
  // Escape leave the map as it is.
  import { onMount } from 'svelte'
  import Glyph from './Glyph.svelte'
  import { t } from '../../shared/i18n'

  let { onclose, onsettings }: { onclose: () => void; onsettings: () => void } = $props()
  let dialog: HTMLDialogElement
  let open = false
  onMount(() => dialog.showModal())
</script>

<dialog bind:this={dialog} class="surface" aria-labelledby="dungeons-title" onclose={() => (onclose(), open && onsettings())}>
  <button class="x" aria-label={t('common.close')} onclick={() => dialog.close()}><Glyph name="close" size={14} /></button>
  <h1 id="dungeons-title">{t('map.corner.dungeonsOff')}</h1>
  <p>{t('map.corner.dungeonsOffText')}</p>
  <div class="foot">
    <button class="btn" onclick={() => dialog.close()}>{t('map.corner.dungeonsLater')}</button>
    <button class="btn" onclick={() => ((open = true), dialog.close())}>{t('map.corner.dungeonsOpen')}</button>
  </div>
</dialog>

<style>
  dialog {
    position: relative;
    width: min(440px, calc(100vw - 32px));
    padding: 24px;
    border: 1px solid var(--bronze-600);
    box-shadow: 0 0 0 1px #000, 0 12px 40px #000c;
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
    margin: 0;
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
    gap: 8px;
    margin-top: 16px;
  }
</style>
