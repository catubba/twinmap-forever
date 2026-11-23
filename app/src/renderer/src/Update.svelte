<script lang="ts">
  // The small window shown in place of the app while a newer version of it comes down: the mark,
  // which version, how far along. It closes when the new version is put in place of this one, and
  // says so first: for a few seconds after it there is no Twinmap on screen.
  import Logo from './Logo.svelte'
  import type { Updating } from '../../main/update'
  import { t } from '../../shared/i18n'

  let updating = $state<Updating | null>(null)
  window.twinmap.onUpdate((told) => (updating = told))
</script>

<main>
  <Logo size={96} stacked />
  <p aria-live="polite">
    {#if updating?.installing}
      {t('app.update.installing', { version: updating.version })}<br />{t('app.update.reopen')}
    {:else}
      {updating ? t('app.update.updatingTo', { version: updating.version }) : t('app.update.updating')}
    {/if}
  </p>
  <progress class="bar" value={updating?.percent ?? 0} max="100" aria-label={t('app.update.downloading')}></progress>
</main>

<style>
  /* The whole window drags, as the opening screen does. */
  main {
    position: fixed;
    inset: 0;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 20px;
    background: var(--stone-900);
    color: var(--gold);
    -webkit-app-region: drag;
  }

  p {
    margin: 12px 0 0;
    color: var(--text-dim);
    text-align: center;
    line-height: 1.5;
  }

  .bar {
    width: 220px;
  }
</style>
