import { mount } from 'svelte'
import './ui.css'
import App from './App.svelte'
import Kit from './Kit.svelte'

// #kit shows the trial page of the basic controls instead of the app.
mount(location.hash === '#kit' ? Kit : App, { target: document.getElementById('app')! })
