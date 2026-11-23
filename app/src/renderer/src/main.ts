import { mount } from 'svelte'
import './web' // first: outside the app's own window it stands in for the preload script
import './ui.css'
import App from './App.svelte'
import { setLang } from '../../shared/i18n'
import Kit from './Kit.svelte'
import Update from './Update.svelte'

// Every text in the language of the app, asked before anything is drawn (shared/i18n).
// The update window opens before the app answers this: English then.
setLang(await window.twinmap.lang().catch(() => 'enUS'))

// #kit shows the trial page of the basic controls instead of the app.
const kit = location.hash === '#kit'
// #update is the small window shown while a newer version of the app comes down.
mount(kit ? Kit : location.hash === '#update' ? Update : App, { target: document.getElementById('app')! })
// The window is see-through until its page says it is drawn: the app says so from its opening screen.
if (kit) window.twinmap.drawn()
