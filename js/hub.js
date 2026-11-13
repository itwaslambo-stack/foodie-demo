// Demo hub: the front door to the three interfaces and the guided presentation.

import { store, html, photo, toast, dateTime } from './shared/ui.js';
import { progress, STEPS } from './shared/scenario.js';

const root = document.getElementById('app');

function render() {
  const s = store.getState();
  const img = (id) => (s.meals.find((m) => m.id === id) || {}).image;
  const at = progress(s);
  root.innerHTML = String(html`<div class="hub-wrap">
    <div class="hub-head">
      <div>
        <div class="wordmark">foodie<span>.</span></div>
        <p class="tag">You choose the food.<br>We bring the chef.</p>
        <p>A working demonstration of the Foodie customer app, chef app and admin dashboard. All three share one booking, so what the customer does shows up for the chef and for Foodie straight away.</p>
      </div>
      <div class="hub-plates" aria-hidden="true">
        <div class="plate p1">${photo(img('pap-beef-stew-vegetables'), '')}</div>
        <div class="plate p2">${photo(img('braai-platter'), '')}</div>
        <div class="plate p3">${photo(img('salmon-platter'), '')}</div>
      </div>
    </div>
    <div class="hub-bar">
      <a class="btn primary" href="presenter.html" id="start-presentation">${at > 0 && at < STEPS.length ? `Continue the guided presentation (step ${at + 1} of ${STEPS.length})` : 'Start the guided presentation'}</a>
      <button type="button" class="btn ghost" id="reset">Reset the demo</button>
      <span class="small" style="color:#c9cfee">Demo time: ${dateTime(store.now())}</span>
    </div>
    <div class="doors">
      <a class="door" href="customer.html"><p class="who">Customer app</p><h2>Book a chef</h2><p class="small muted">Browse eight food categories, choose a meal and people, pick a date, pay (simulated), confirm ingredients, track the chef and leave a review.</p></a>
      <a class="door" href="chef.html"><p class="who">Chef app</p><h2>Cook the booking</h2><p class="small muted">Accept or decline requests, confirm the ingredient list, mark En Route, Arrived, Cooking and Completed, and follow earnings and payouts.</p></a>
      <a class="door" href="admin.html"><p class="who">Admin dashboard</p><h2>Run Foodie</h2><p class="small muted">Allocate chefs by hand, manage the menu, customers and chefs, handle refunds, and see revenue, chef earnings and fortnightly payouts.</p></a>
    </div>
    <p class="hub-note">Demonstration only. Payments are simulated, people and addresses are fictional, prices are sample values, and nothing leaves this computer. Open the three interfaces in separate windows to watch them stay in step, or use the guided presentation.</p>
  </div>`);
}

root.addEventListener('click', (e) => {
  if (e.target.id !== 'reset') return;
  if (!window.confirm('Reset the demo? Sample data and the demo clock go back to the start in all three interfaces.')) return;
  store.reset();
  toast('Demo reset. Ready to present.', 'good');
});
root.addEventListener('error', (e) => { if (e.target.tagName === 'IMG') { e.target.parentElement.classList.add('missing'); e.target.remove(); } }, true);
store.subscribe(render);
render();
