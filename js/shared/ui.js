// Small shared UI toolkit: safe HTML templates, formatting, a hash router,
// toasts, and the demo ribbon. No framework, no build step.

import * as R from './rules.js';
import { createStore } from './store.js';

// ------------------------------------------------------------------ store

export const store = createStore({ storage: window.localStorage });
window.addEventListener('storage', (e) => { if (e.key === null || e.key.startsWith('foodie.')) store.reload(); });
// Time-driven work (the two-hour reminder) is checked by whichever screen is open.
setInterval(() => { if (!document.hidden) store.tick(); }, 5000);

// ------------------------------------------------------------- templates

class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
export const raw = (s) => new Raw(String(s ?? ''));

function part(v) {
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(part).join('');
  if (v === null || v === undefined || v === false || v === true) return '';
  return esc(v);
}

/** html`...` escapes every interpolated value unless it is itself html`...`. */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i += 1) out += part(values[i]) + strings[i + 1];
  return new Raw(out);
}

// ------------------------------------------------------------- formatting

const fmt = (opts) => new Intl.DateTimeFormat('en-ZA', opts);
const F = {
  long: fmt({ weekday: 'long', day: 'numeric', month: 'long' }),
  short: fmt({ weekday: 'short', day: 'numeric', month: 'short' }),
  full: fmt({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
  dm: fmt({ day: 'numeric', month: 'short' }),
};
export const money = R.money;
export const dateLong = (ms) => F.long.format(ms);
export const dateShort = (ms) => F.short.format(ms);
export const dateFull = (ms) => F.full.format(ms);
export const dayMonth = (ms) => F.dm.format(ms);
export const time = (ms) => R.timeKey(ms);
export const dateTime = (ms) => `${F.short.format(ms)}, ${R.timeKey(ms)}`;
export const initials = (name) => String(name).split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function countdown(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function stars(value) {
  const n = Math.round(value);
  return html`<span class="stars" aria-label="${value} out of 5">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span>`;
}

export function photo(src, alt, cls = '') {
  return html`<span class="photo ${cls}" data-alt="${alt}">${src ? html`<img src="${src}" alt="${alt}" loading="lazy">` : ''}</span>`;
}

const CHIP_TONE = {
  awaiting_chef: 'mielie', confirmed: 'indigo', en_route: 'indigo', arrived: 'indigo', cooking: 'indigo', completed: 'leaf',
  cancelled: 'chilli', customer_no_show: 'chilli', ended_missing_ingredient: 'chilli',
  unassigned: 'chilli', offered: 'mielie', accepted: 'leaf', declined: 'chilli', chef_cancelled: 'chilli',
  not_listed: '', listed: 'mielie', customer_confirmed: 'leaf',
  paid: 'leaf', partially_refunded: 'mielie', refunded: 'chilli',
  none: '', scheduled: 'mielie',
  pending: 'mielie', processed: 'leaf', open: 'chilli', resolved: 'leaf',
  approved: 'leaf', applied: 'mielie', rejected: 'chilli', suspended: 'chilli', active: 'leaf',
};
export function chip(kind, value, label) {
  const pretty = String(value).replace(/_/g, ' ');
  const text = label || (R.LABELS[kind] && R.LABELS[kind][value]) || pretty.charAt(0).toUpperCase() + pretty.slice(1);
  const tone = kind === 'payout' && value === 'paid' ? 'leaf' : CHIP_TONE[value] || '';
  return html`<span class="chip ${tone}">${text}</span>`;
}

const ICONS = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
  bell: '<path d="M6 16V11a6 6 0 1112 0v5l2 2H4z"/><path d="M10 21h4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M16 12.5h2"/><path d="M3 10h18"/>',
  inbox: '<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 3h6l1-3h5"/>',
};
export const icon = (name) => raw(`<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`);

// ------------------------------------------------------------------ toast

export function toast(message, tone = '') {
  let box = document.getElementById('toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    document.body.append(box);
  }
  const el = document.createElement('div');
  el.className = `toast ${tone}`;
  el.textContent = message;
  box.append(el);
  setTimeout(() => el.remove(), tone === 'bad' ? 5200 : 3200);
}

/** Run a store action; show its error as a toast. Returns the result. */
export function act(result, successMessage) {
  if (!result.ok) toast(result.error, 'bad');
  else if (successMessage) toast(successMessage, 'good');
  return result;
}

// ----------------------------------------------------------------- router

export function currentRoute() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const [pathPart, queryPart = ''] = hash.split('?');
  return { parts: pathPart.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(queryPart), raw: hash };
}
export function go(hash) {
  if (window.location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else window.location.hash = hash;
}

/**
 * Mount an app. `view(route)` returns html for the whole root; `actions`
 * maps data-action names to handlers(el, event). Re-renders on route and
 * store changes, keeping focus, typed text and scroll position.
 */
export function mount({ root, view, actions = {}, scrollSelector = '.screen', onRender }) {
  let lastRoute = null;

  function render() {
    const route = currentRoute();
    const sameRoute = lastRoute === route.raw;
    const scroller = root.querySelector(scrollSelector);
    const scrollTop = sameRoute && scroller ? scroller.scrollTop : 0;
    const active = document.activeElement;
    const focusKey = active && root.contains(active) ? active.id || active.getAttribute('data-focus') : null;
    const selection = active && 'selectionStart' in active ? [active.selectionStart, active.selectionEnd] : null;
    const openDetails = sameRoute ? [...root.querySelectorAll('details[open][id]')].map((d) => d.id) : [];

    root.innerHTML = String(view(route));

    for (const id of openDetails) { const d = document.getElementById(id); if (d) d.open = true; }
    const next = root.querySelector(scrollSelector);
    if (next) {
      next.scrollTop = scrollTop;
      if (!sameRoute) next.classList.add('enter');
    }
    if (focusKey) {
      const el = document.getElementById(focusKey) || root.querySelector(`[data-focus="${CSS.escape(focusKey)}"]`);
      if (el) {
        el.focus({ preventScroll: true });
        if (selection && 'setSelectionRange' in el) { try { el.setSelectionRange(selection[0], selection[1]); } catch { /* not a text field */ } }
      }
    }
    lastRoute = route.raw;
    if (onRender) onRender(route);
  }

  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || !root.contains(el) || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    const fn = actions[el.dataset.action];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
  root.addEventListener('submit', (e) => {
    e.preventDefault();
    const fn = actions[e.target.dataset.submit];
    if (fn) fn(e.target, e);
  });
  root.addEventListener('input', (e) => {
    const fn = e.target.dataset.input && actions[e.target.dataset.input];
    if (fn) fn(e.target, e);
  });
  root.addEventListener('change', (e) => {
    const fn = e.target.dataset.change && actions[e.target.dataset.change];
    if (fn) fn(e.target, e);
  });
  // A photo that fails to load becomes a labelled placeholder instead of a broken image.
  root.addEventListener('error', (e) => {
    if (e.target.tagName === 'IMG' && e.target.parentElement && e.target.parentElement.classList.contains('photo')) {
      e.target.parentElement.classList.add('missing');
      e.target.remove();
    }
  }, true);

  window.addEventListener('hashchange', render);
  store.subscribe(render);
  // Live countdowns tick without re-rendering the page.
  setInterval(() => {
    let expired = false;
    for (const el of root.querySelectorAll('[data-countdown]')) {
      const left = Number(el.dataset.countdown) - store.now();
      el.textContent = countdown(left);
      if (left <= 0 && !el.dataset.done) { el.dataset.done = '1'; expired = true; }
    }
    for (const el of root.querySelectorAll('[data-clock]')) el.textContent = dateTime(store.now());
    if (expired) render();
  }, 1000);

  render();
  return { render };
}

// ------------------------------------------------------------ demo ribbon

let demoOpen = false;
let demoFocus = () => null;

/** Tell the ribbon which booking the "jump to" buttons should use. */
export function setDemoFocus(fn) { demoFocus = fn; }

export function ribbon(extra = '') {
  return html`<div class="ribbon">
    <span class="grow"><b>Demo</b> ${extra || 'Simulated payments, fictional people'}</span>
    <button type="button" data-action="demo-open" aria-label="Demo controls. Demo time ${dateTime(store.now())}"><span data-clock>${dateTime(store.now())}</span></button>
  </div>`;
}

export function demoPanel(kind = 'sheet') {
  if (!demoOpen) return '';
  const b = demoFocus();
  const now = store.now();
  const jumps = [];
  if (b && R.isOpen(b.status)) {
    const add = (at, label) => { if (at > now) jumps.push({ at, label }); };
    add(R.reminderDueAt(b.scheduledAt), `2 hours before ${b.ref} (ingredient reminder)`);
    add(b.scheduledAt - 40 * R.MIN, `40 minutes before ${b.ref} (chef sets off)`);
    add(b.scheduledAt - 5 * R.MIN, `5 minutes before ${b.ref} (on-time arrival)`);
    add(b.scheduledAt + 35 * R.MIN, `35 minutes after ${b.ref} (late-chef rule)`);
  }
  const body = html`<div class="demo-panel">
    <div class="row spread top">
      <div><h3>Demo controls</h3><p class="small muted">Demo time is <strong data-clock>${dateTime(now)}</strong>. It only moves forward.</p></div>
      <button type="button" class="btn small quiet" data-action="demo-close">Close</button>
    </div>
    <div class="row wrap" style="margin-top:14px">
      <button type="button" class="btn small ghost" data-action="demo-advance" data-ms="${5 * R.MIN}">+5 min</button>
      <button type="button" class="btn small ghost" data-action="demo-advance" data-ms="${15 * R.MIN}">+15 min</button>
      <button type="button" class="btn small ghost" data-action="demo-advance" data-ms="${R.HOUR}">+1 hour</button>
      <button type="button" class="btn small ghost" data-action="demo-advance" data-ms="${R.DAY}">+1 day</button>
    </div>
    ${jumps.length ? html`<div class="jumps">${jumps.map((j) => html`<button type="button" class="btn small quiet block" data-action="demo-jump" data-at="${j.at}">Jump to ${j.label}</button>`)}</div>` : ''}
    <div style="margin-top:18px; padding-top:14px; border-top:1px solid var(--line)">
      <button type="button" class="btn small danger" data-action="demo-reset">Reset the demo</button>
      <p class="demo-note" style="margin-top:8px">Reset restores the sample data and the clock in all three interfaces. Nothing here charges money, sends messages or leaves this computer.</p>
    </div>
  </div>`;
  return kind === 'modal'
    ? html`<div class="modal-back" data-action="demo-close-back"><div class="modal" role="dialog" aria-label="Demo controls">${body}</div></div>`
    : html`<div class="sheet-back" data-action="demo-close-back"><div class="sheet" role="dialog" aria-label="Demo controls">${body}</div></div>`;
}

export function demoActions(rerender, afterReset) {
  return {
    'demo-open': () => { demoOpen = true; rerender(); },
    'demo-close': () => { demoOpen = false; rerender(); },
    'demo-close-back': (el, e) => { if (e.target === el) { demoOpen = false; rerender(); } },
    'demo-advance': (el) => { act(store.advanceClock(Number(el.dataset.ms))); },
    'demo-jump': (el) => { act(store.setClock(Number(el.dataset.at)), 'Demo clock moved forward'); },
    'demo-reset': () => {
      if (!window.confirm('Reset the demo? Sample data and the demo clock go back to the start in all three interfaces.')) return;
      demoOpen = false;
      store.reset();
      toast('Demo reset', 'good');
      if (afterReset) afterReset();
    },
  };
}
