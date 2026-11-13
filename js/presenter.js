// Guided presentation: the 20-step script on the left, the live interfaces
// on the right. The script follows what the presenter does, and any step
// can be done automatically to recover or to save time.

import { store, html, toast, dateTime } from './shared/ui.js';
import { STEPS, routeFor, clockJumpFor, ensureStep, findDemoBooking } from './shared/scenario.js';

const VIEWS = { customer: 'Customer app', chef: 'Chef app', admin: 'Admin dashboard' };
const frames = Object.fromEntries(Object.keys(VIEWS).map((v) => [v, document.getElementById(`frame-${v}`)]));
const scriptEl = document.getElementById('script');
const tabsEl = document.getElementById('stage-tabs');

let current = Math.min(STEPS.length, Math.max(1, Number(sessionStorage.getItem('foodie.presenter.step')) || 1));
let visible = STEPS[current - 1].view;

const step = (n) => STEPS[n - 1];

function show(view, route) {
  visible = view;
  for (const [name, frame] of Object.entries(frames)) frame.classList.toggle('on', name === view);
  if (route) {
    try { frames[view].contentWindow.location.hash = route; } catch { /* frame still loading */ }
  }
  renderTabs();
}

function setCurrent(n, { navigate = true } = {}) {
  current = Math.min(STEPS.length, Math.max(1, n));
  sessionStorage.setItem('foodie.presenter.step', String(current));
  const s = step(current);
  show(s.view, navigate ? routeFor(s, store.getState()) : null);
  render();
  const li = scriptEl.querySelector('li.current');
  if (li) li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function renderTabs() {
  tabsEl.innerHTML = String(html`${Object.entries(VIEWS).map(([v, label]) => html`<button type="button" role="tab" data-view="${v}" aria-selected="${String(visible === v)}">${label}</button>`)}
    <span class="sp"></span><a href="index.html">Exit to the demo hub</a>`);
}

function render() {
  const state = store.getState();
  const b = findDemoBooking(state);
  scriptEl.innerHTML = String(html`<div class="script-head">
      <div class="row spread"><div class="wordmark">foodie<span style="color:var(--mielie)">.</span></div><span class="chip indigo plain">Step ${current} of ${STEPS.length}</span></div>
      <p class="small muted" style="margin-top:4px">Thandi books Pap, Beef Stew &amp; Vegetables for 4. Demo time <strong>${dateTime(store.now())}</strong>${b ? html`, booking <strong>${b.ref}</strong>` : ''}.</p>
    </div>
    <ol class="script-list">${STEPS.map((s) => {
      const done = s.done(state) && (s.run ? true : s.n < current);
      const isCurrent = s.n === current;
      const jump = isCurrent ? clockJumpFor(s, store) : null;
      return html`<li class="${isCurrent ? 'current' : ''} ${done ? 'done' : ''}">
        <button type="button" class="step" data-step="${s.n}" aria-current="${isCurrent ? 'step' : 'false'}"><span class="n">${done && !isCurrent ? '✓' : s.n}</span><span><span class="who">${VIEWS[s.view]}</span><br><span class="ttl">${s.title}</span></span></button>
        ${isCurrent ? html`<div class="detail"><p>${s.say}</p><p class="do">${s.click}</p>
          <div class="acts">
            ${jump ? html`<button type="button" class="btn small primary" data-act="jump">Fast-forward to ${jump.label}</button>` : ''}
            ${s.run && !s.done(state) ? html`<button type="button" class="btn small quiet" data-act="auto">Do it for me</button>` : ''}
            <button type="button" class="btn small quiet" data-act="show">Show this screen</button>
          </div></div>` : ''}
      </li>`;
    })}</ol>
    <div class="script-foot">
      <button type="button" class="btn small ghost" data-act="prev" ${current === 1 ? 'disabled' : ''}>Back</button>
      <button type="button" class="btn small" data-act="next" ${current === STEPS.length ? 'disabled' : ''}>Next step</button>
      <span class="grow"></span>
      <button type="button" class="btn small danger" data-act="reset">Reset</button>
    </div>`);
}

scriptEl.addEventListener('click', (e) => {
  const stepBtn = e.target.closest('[data-step]');
  if (stepBtn) { setCurrent(Number(stepBtn.dataset.step)); return; }
  const btn = e.target.closest('[data-act]');
  if (!btn || btn.disabled) return;
  const s = step(current);
  switch (btn.dataset.act) {
    case 'prev': setCurrent(current - 1); break;
    case 'next': {
      // Moving on means everything before the next step must have happened.
      const r = ensureStep(store, current);
      if (!r.ok) { toast(r.error, 'bad'); break; }
      setCurrent(current + 1);
      break;
    }
    case 'show': show(s.view, routeFor(s, store.getState())); break;
    case 'jump': {
      const jump = clockJumpFor(s, store);
      if (jump) { store.setClock(jump.at); toast(`Demo clock moved to ${dateTime(store.now())}`, 'good'); }
      break;
    }
    case 'auto': {
      const r = ensureStep(store, current);
      if (!r.ok) toast(r.error, 'bad');
      else show(s.view, routeFor(s, store.getState()));
      break;
    }
    case 'reset':
      if (!window.confirm('Reset the demo and start the script again?')) break;
      store.reset();
      frames.customer.contentWindow.location.hash = '#/welcome';
      frames.chef.contentWindow.location.hash = '#/home';
      frames.admin.contentWindow.location.hash = '#/';
      setCurrent(1);
      toast('Demo reset. Ready to present.', 'good');
      break;
    default:
  }
});

tabsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-view]');
  if (btn) show(btn.dataset.view, null);
});

// Follow the presenter: when the current step's result appears in the shared
// state, move the script on and bring up the interface the next step uses.
let advanceTimer = null;
store.subscribe(() => {
  const s = step(current);
  if (!advanceTimer && s.run && s.done(store.getState()) && current < STEPS.length) {
    const from = current;
    const changeScreen = step(from + 1).view !== s.view;
    advanceTimer = setTimeout(() => {
      advanceTimer = null;
      if (current === from) setCurrent(from + 1, { navigate: changeScreen });
    }, changeScreen ? 1400 : 300);
  }
  render();
});

window.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select')) return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown') scriptEl.querySelector('[data-act="next"]').click();
  if (e.key === 'ArrowLeft' || e.key === 'PageUp') scriptEl.querySelector('[data-act="prev"]').click();
});

renderTabs();
render();
// Frames load their own apps; once ready, point them at the current step.
let pending = Object.keys(frames).length;
for (const frame of Object.values(frames)) {
  const ready = () => { pending -= 1; if (pending === 0) setCurrent(current); };
  if (frame.contentDocument && frame.contentDocument.readyState === 'complete' && frame.contentWindow.location.href !== 'about:blank') ready();
  else frame.addEventListener('load', ready, { once: true });
}
show(visible, null);
