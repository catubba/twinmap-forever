<script lang="ts">
  // Feedback: a small window over the app with the ways to tell us something. Nothing here is
  // sent by itself: the player writes here and presses Send, or opens an issue on GitHub or a
  // letter in their mail program. What the app adds about itself is shown here first.
  import { onMount } from 'svelte'
  import { FEEDBACK, LONGEST_MESSAGE, type FeedbackWay } from '../../shared/feedback'
  import { t } from '../../shared/i18n'

  let { details, onclose }: { details: string; onclose: () => void } = $props()

  // The browser's own dialog: it keeps the keyboard inside, closes on Escape, and dims what is under it.
  let dialog: HTMLDialogElement
  onMount(() => dialog.showModal())
  const open = (way: FeedbackWay): void => void window.twinmap.openFeedback(way, details)
  // What the player writes stays in the window until it is delivered: a failure loses nothing.
  let message = $state(''), email = $state(''), withLog = $state(false)
  let sending = $state(false), sent = $state(false), wrong = $state<string | null>(null)
  async function send(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    sending = true
    wrong = await window.twinmap.sendFeedback({ message, email, details, withLog })
    sending = false
    sent = wrong === null
    if (sent) message = ''
  }
  // Copying asks for a page the browser trusts: the app's window is one, a phone on the home network is not.
  const canCopy = !!navigator.clipboard
  let copied = $state<'details' | 'log' | null>(null)
  async function copy(what: 'details' | 'log'): Promise<void> {
    await navigator.clipboard.writeText(what === 'details' ? details : await window.twinmap.readLog())
    copied = what
  }
</script>

<dialog bind:this={dialog} class="surface" aria-labelledby="feedback-title" {onclose} onclick={(e) => e.target === dialog && dialog.close()}>
  <h1 id="feedback-title">{t('settings.feedback.title')}</h1>
  <p>{t('settings.feedback.intro')}</p>
  <form onsubmit={send}>
    <textarea class="field" bind:value={message} oninput={() => ((sent = false), (wrong = null))} maxlength={LONGEST_MESSAGE} rows="5" placeholder={t('settings.feedback.placeholder')} aria-label={t('settings.feedback.message')} aria-describedby="feedback-said"></textarea>
    <input class="field" type="email" bind:value={email} maxlength="200" placeholder={t('settings.feedback.email')} aria-label={t('settings.feedback.email')} />
    <label class="choice"><input type="checkbox" class="check" bind:checked={withLog} />{t('settings.feedback.withLog')}</label>
    <div class="ways">
      <button class="btn" type="submit" disabled={sending || !message.trim()}>{sending ? t('settings.feedback.sending') : t('settings.feedback.send')}</button>
      <button class="btn" type="button" onclick={() => open('github')}>{t('settings.feedback.github')}</button>
      <button class="btn" type="button" onclick={() => open('email')}>{t('settings.feedback.letter')}</button>
    </div>
    <p id="feedback-said" class={wrong ? 'field-note' : 'said'} role="status">{wrong ?? (sent ? t('settings.feedback.sent') : '')}</p>
  </form>
  <p class="dim">{t('settings.feedback.carries')} <button class="link" onclick={() => open('privacy')}>{t('settings.feedback.privacy')}</button></p>
  <p class="dim">{t('settings.feedback.noGithub', { email: FEEDBACK.email })}</p>
  <h2>{t('settings.feedback.details')}</h2>
  <pre>{details}</pre>
  <p class="dim log">{canCopy ? t('settings.feedback.logCopy') : t('settings.feedback.log')}</p>
  <div class="foot">
    {#if canCopy}
      <button class="btn" onclick={() => copy('details')}>{copied === 'details' ? t('settings.feedback.copied') : t('settings.feedback.copyDetails')}</button>
      <button class="btn" onclick={() => copy('log')}>{copied === 'log' ? t('settings.feedback.copied') : t('settings.feedback.copyLog')}</button>
    {/if}
    <button class="btn" onclick={() => dialog.close()}>{t('settings.feedback.close')}</button>
  </div>
</dialog>

<style>
  dialog {
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
    margin: 0 0 12px;
    font: var(--t-title, inherit);
    color: var(--gold);
  }
  h2 {
    margin: 20px 0 8px;
    font: inherit;
    color: var(--text-dim);
  }
  p {
    margin: 0 0 12px;
  }
  .dim {
    color: var(--text-dim);
  }
  .log {
    margin: 12px 0 0;
  }
  form {
    display: grid;
    gap: 8px;
  }
  textarea.field {
    height: auto;
    padding: 6px 8px;
    resize: vertical;
  }
  form .field {
    width: 100%;
    box-sizing: border-box;
  }
  .said,
  form .field-note {
    min-height: 1.4em;
    margin: 0;
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
  .ways,
  .foot {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .foot {
    justify-content: flex-end;
    margin-top: 16px;
  }
  pre {
    margin: 0;
    padding: 10px 12px;
    border: 1px solid var(--bronze-700);
    background: var(--stone-950);
    font: inherit;
    font-size: 0.9em;
    color: var(--text-dim);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    user-select: text;
  }
</style>
