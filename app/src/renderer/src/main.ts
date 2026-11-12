import { mount } from 'svelte'
import './web' // first: outside the app's own window it stands in for the preload script
import './ui.css'
import App from './App.svelte'
import Kit from './Kit.svelte'

// #kit shows the trial page of the basic controls instead of the app.
const kit = location.hash === '#kit'
mount(kit ? Kit : App, { target: document.getElementById('app')! })
// The window is see-through until its page says it is drawn: the app says so from its opening screen.
if (kit) window.twinmap.drawn()
