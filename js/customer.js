// Dishit customer app (demo). Every price, refund and status on these screens
// comes from the shared store and rules, never from this file.

import * as R from './shared/rules.js';
import { DEMO_VERIFY_CODE } from './shared/store.js';
import { DEMO } from './shared/seed.js';
import { demoDate } from './shared/scenario.js';
import { INFO_PAGES, INFO_GROUPS, KITCHEN_BASICS } from './shared/content.js';
import {
  store, html, raw, mount, go, toast, act, money, dateLong, dateShort, dateTime, time, initials, plural, stars, photo, chip, icon,
  ribbon, demoPanel, demoActions, setDemoFocus,
} from './shared/ui.js';

const S = () => store.getState();
const me = () => store.find.customer(S().session.customerId);
const myBookings = () => S().bookings.filter((b) => b.customerId === S().session.customerId);
const unread = () => S().notifications.filter((n) => n.to === `customer:${S().session.customerId}` && !n.read).length;

// Local screen state (never shared with the other interfaces).
const forms = { login: { email: '', password: '' }, register: {}, errors: {}, verifyCode: '', message: '' };
let draft = null;
let sheet = null; // { type: 'cancel', bookingId, reason } | { type: 'payment' }
let reviewDraft = {};
let bookingsTab = 'upcoming';
let credits = null;

fetch('assets/img/credits.json').then((r) => (r.ok ? r.json() : [])).then((list) => { credits = list; }).catch(() => { credits = []; });

function newDraft(mealId, servings) {
  draft = { mealId, servings: servings || R.POLICY.minServings, date: '', time: '', address: { line1: '', suburb: '', city: '', postalCode: '', directions: '' }, noteToChef: '', step: 1, errors: {}, error: '', paying: false };
}

// ------------------------------------------------------------------ shell

function shell(body, { tabs = true, footer = '' } = {}) {
  return html`${ribbon()}
    ${body}
    ${footer ? html`<div class="footer-cta">${footer}</div>` : ''}
    ${tabs ? tabBar() : ''}
    ${sheetView()}
    ${demoPanel()}`;
}

function tabBar() {
  const here = window.location.hash;
  const tab = (href, label, name, match, badge = 0) => html`<a href="${href}" aria-current="${match.test(here) ? 'page' : 'false'}">${icon(name)}${label}${badge ? html`<span class="badge">${badge}</span>` : ''}</a>`;
  return html`<nav class="tabs" aria-label="Main">
    ${tab('#/home', 'Home', 'home', /^#\/(home|category|meal)/)}
    ${tab('#/bookings', 'My Dishit', 'list', /^#\/booking/)}
    ${tab('#/alerts', 'Alerts', 'bell', /^#\/alerts/, unread())}
    ${tab('#/account', 'Account', 'user', /^#\/(account|info)/)}
  </nav>`;
}

function topbar(title, back) {
  return html`<div class="topbar">
    ${back ? html`<a class="icon-btn" href="${back}" aria-label="Back">${icon('back')}</a>` : ''}
    <h1>${title}</h1>
  </div>`;
}

function field(form, key, label, { type = 'text', placeholder = '', autocomplete = 'off', inputmode = '' } = {}) {
  const error = forms.errors[key];
  return html`<label class="field ${error ? 'invalid' : ''}"><span>${label}</span>
    <input class="input" id="${form}-${key}" type="${type}" value="${forms[form][key] || ''}" placeholder="${placeholder}" autocomplete="${autocomplete}" inputmode="${inputmode}" data-input="form-input" data-form="${form}" data-key="${key}" aria-invalid="${error ? 'true' : 'false'}">
    ${error ? html`<p class="error">${error}</p>` : ''}
  </label>`;
}

// -------------------------------------------------------------- sign in

function welcomeView() {
  const meals = S().meals;
  const img = (id) => (meals.find((m) => m.id === id) || {}).image;
  return html`${ribbon()}
    <main class="screen"><div class="welcome">
      <div class="welcome-plates" aria-hidden="true">
        <div class="plate p1">${photo(img('pap-beef-stew-vegetables'), '')}</div>
        <div class="plate p2">${photo(img('braai-platter'), '')}</div>
        <div class="plate p3">${photo(img('seven-colours'), '')}</div>
      </div>
      <div class="welcome-body">
        <img class="logo" src="assets/img/brand/logo-dark.png" alt="Dishit" width="1017" height="411">
        <p class="tag">You choose the food.<br><span class="smile">We bring the chef.</span></p>
        <div class="stack-s">
          <a class="btn primary block" href="#/register">Create account</a>
          <a class="btn ghost block" href="#/login">Log in</a>
        </div>
      </div>
    </div></main>${demoPanel()}`;
}

function loginView() {
  return html`${ribbon()}
    ${topbar('Log in', '#/welcome')}
    <main class="screen"><form class="pad stack" data-submit="login" novalidate>
      <div class="card mielie stack-s">
        <p class="strong">Presenting? Use the demonstration account.</p>
        <p class="small">Thandi Mokoena is a fictional customer with booking history.</p>
        <button type="button" class="btn block" data-action="login-demo">Continue as Thandi</button>
      </div>
      ${field('login', 'email', 'Email address', { type: 'email', autocomplete: 'username', placeholder: 'you@example.com' })}
      ${field('login', 'password', 'Password', { type: 'password', autocomplete: 'current-password' })}
      ${forms.message ? html`<p class="error" role="alert">${forms.message}</p>` : ''}
      <button class="btn block ghost" type="submit">Log in</button>
      <p class="small muted">New to Dishit? <a href="#/register">Create an account</a></p>
    </form></main>${demoPanel()}`;
}

function registerView() {
  const e = forms.errors;
  const box = (key, label) => html`<div><label class="check"><input type="checkbox" id="register-${key}" ${forms.register[key] ? 'checked' : ''} data-change="form-check" data-key="${key}"><span>${label}</span></label>${e[key] ? html`<p class="error">${e[key]}</p>` : ''}</div>`;
  return html`${ribbon()}
    ${topbar('Create account', '#/welcome')}
    <main class="screen"><form class="pad stack" data-submit="register" novalidate>
      <p class="muted">You need an account before you can book a chef.</p>
      <div class="grid-2">
        ${field('register', 'firstName', 'First name', { autocomplete: 'given-name' })}
        ${field('register', 'surname', 'Surname', { autocomplete: 'family-name' })}
      </div>
      ${field('register', 'email', 'Email address', { type: 'email', autocomplete: 'email', placeholder: 'you@example.com' })}
      ${field('register', 'mobile', 'Mobile number', { type: 'tel', autocomplete: 'tel', placeholder: '060 555 0199', inputmode: 'tel' })}
      ${field('register', 'password', 'Password', { type: 'password', autocomplete: 'new-password', placeholder: 'At least 8 characters' })}
      <p class="demo-note">Demonstration only: do not use a real password. It is checked for length and never stored.</p>
      ${box('acceptTerms', html`I accept the <a href="#/info/terms">Terms &amp; Conditions</a>`)}
      ${box('acceptPrivacy', html`I accept the <a href="#/info/privacy">Privacy Policy</a>`)}
      <button class="btn primary block" type="submit">Create account</button>
      <p class="small muted">Already have an account? <a href="#/login">Log in</a></p>
    </form></main>${demoPanel()}`;
}

function verifyView() {
  const pending = store.find.customer(S().session.pendingVerificationId);
  if (!pending) return loginView();
  return html`${ribbon()}
    ${topbar('Verify your email', '#/welcome')}
    <main class="screen"><form class="pad stack" data-submit="verify" novalidate>
      <h2>Check your inbox</h2>
      <p>We sent a 6-digit code to <strong>${pending.email}</strong>.</p>
      <div class="card mielie small"><strong>Demonstration:</strong> no email is really sent. Use the code <strong class="num">${DEMO_VERIFY_CODE}</strong>.</div>
      <label class="field ${forms.message ? 'invalid' : ''}"><span>Verification code</span>
        <input class="input num" id="verify-code" inputmode="numeric" maxlength="6" value="${forms.verifyCode}" data-input="verify-input" autocomplete="one-time-code">
        ${forms.message ? html`<p class="error" role="alert">${forms.message}</p>` : ''}
      </label>
      <button class="btn primary block" type="submit">Verify email</button>
    </form></main>${demoPanel()}`;
}

// ------------------------------------------------------------------ home

function activeCategories() {
  return S().categories.filter((c) => c.active).sort((a, b) => a.order - b.order);
}
function mealsIn(categoryId) {
  return S().meals.filter((m) => m.active && m.categoryId === categoryId);
}

function mealCard(m) {
  return html`<a class="meal-card" href="#/meal/${m.id}">
    ${photo(m.image, m.name)}
    <div class="body stack-s">
      <h3>${m.name}</h3>
      <p class="small muted">${m.description}</p>
      <p><span class="price">From ${money(m.basePriceCents)}</span> <span class="small muted">for ${R.POLICY.baseServings} people</span></p>
    </div>
  </a>`;
}

function homeView() {
  const c = me();
  const next = myBookings().filter((b) => R.isOpen(b.status)).sort((a, b) => a.scheduledAt - b.scheduledAt)[0];
  const toReview = myBookings().find((b) => b.status === 'completed' && !b.review);
  const favourites = ['pap-beef-stew-vegetables', 'seven-colours', 'braai-platter', 'salmon-platter', 'sirloin-chips'].map((id) => S().meals.find((m) => m.id === id && m.active && S().categories.some((c) => c.id === m.categoryId && c.active))).filter(Boolean);
  const [feature, ...more] = favourites;
  return shell(html`<main class="screen"><div class="pad stack">
      <div class="row spread top hello">
        <div><p class="muted">Hi ${c.firstName}</p><h1>What are you feeling like eating today?</h1></div>
      </div>
      ${c.discount ? html`<div class="card mielie"><p class="strong">${c.discount.pct}% off your next Dishit</p><p class="small">Your last chef arrived late. The discount comes off automatically at checkout.</p></div>` : ''}
      ${next ? html`<a class="card indigo mini-booking" href="#/booking/${next.id}">
          ${photo(next.image, '')}
          <div class="grow"><p class="small muted">${R.ACTIVE_STATUSES.includes(next.status) ? 'Happening now' : 'Your next Dishit'}</p><p class="strong">${next.mealName}</p><p class="small">${dateShort(next.scheduledAt)} at ${time(next.scheduledAt)}, ${R.LABELS.booking[next.status].toLowerCase()}</p></div>
        </a>` : ''}
      ${toReview && !next ? html`<a class="card mielie mini-booking" href="#/booking/${toReview.id}">${photo(toReview.image, '')}<div class="grow"><p class="strong">How was your ${toReview.mealName}?</p><p class="small">Leave a review</p></div></a>` : ''}
      ${feature ? html`<a class="feature" href="#/meal/${feature.id}">
          ${photo(feature.image, feature.name)}
          <div class="cap"><span class="kicker">Booked most this month</span><h3>${feature.name}</h3><p>From ${money(feature.basePriceCents)} for ${R.POLICY.baseServings} people</p></div>
        </a>` : ''}
      <div><div class="section-title"><h2>Choose your kind of meal</h2></div>
        <div class="cat-grid">
        ${activeCategories().map((cat) => html`<a class="cat" href="#/category/${cat.id}">
          <div class="plate">${photo(cat.image, '')}</div><strong>${cat.name}</strong>
        </a>`)}
        </div></div>
      ${more.length ? html`<div><div class="section-title"><h2>More favourites</h2></div>
        <div class="hscroll">${more.map(mealCard)}</div></div>` : ''}
      <p class="demo-note">Demonstration content. Meals, prices and photos are samples, not approved commercial pricing.</p>
    </div></main>`);
}

function categoryView(id) {
  const cat = S().categories.find((c) => c.id === id && c.active);
  if (!cat) return notFound('This category is not available', '#/home');
  const meals = mealsIn(id);
  return shell(html`${topbar(cat.name, '#/home')}
    <main class="screen"><div class="pad stack">
      <p class="muted">${cat.blurb}</p>
      ${meals.length ? meals.map(mealCard) : html`<div class="empty"><h3>No meals here yet</h3><p>Dishit is adding meals to this category. Try another one.</p><p style="margin-top:12px"><a class="btn small ghost" href="#/home">See all categories</a></p></div>`}
    </div></main>`);
}

function mealView(id) {
  const m = S().meals.find((x) => x.id === id);
  const cat = m && S().categories.find((c) => c.id === m.categoryId);
  if (!m || !m.active || !cat || !cat.active) return notFound('This meal is not available right now', '#/home');
  return shell(html`<main class="screen">
      <div class="hero"><a class="icon-btn" href="#/category/${m.categoryId}" aria-label="Back to ${cat.name}">${icon('back')}</a>${photo(m.image, m.name)}</div>
      <div class="pad stack">
        <div class="stack-s">
          <p><span class="chip indigo plain">${cat.name}</span> <span class="chip plain">About ${m.cookMinutes >= 60 ? `${Math.round(m.cookMinutes / 30) / 2} hours` : `${m.cookMinutes} minutes`} to cook</span></p>
          <h1>${m.name}</h1>
          <p class="muted">${m.description}</p>
        </div>
        <div class="card flat row spread">
          <div><p class="price" style="font-size:26px">${money(m.basePriceCents)}</p><p class="small muted">for ${R.POLICY.baseServings} people</p></div>
          <p class="small muted right">${money(m.extraPersonCents)} for each<br>extra person</p>
        </div>
        <div><h3 style="margin-bottom:6px">What is included</h3><ul class="tick-list">${m.included.map((x) => html`<li>${x}</li>`)}<li>Your chef cooks, serves and cleans up after cooking</li></ul></div>
        <div>
          <details class="more" id="d-ing" open><summary>Ingredients you buy</summary>
            <p class="small muted">Dishit does not supply groceries. Your chef confirms this list after accepting your booking.</p>
            ${m.ingredients.map((g) => html`<p><strong>${g.group}:</strong> ${g.items.map((i) => i.name).join(', ')}</p>`)}
          </details>
          <details class="more" id="d-all"><summary>Dietary and allergen information</summary>
            ${m.allergens.length ? html`<p>Contains: <strong>${m.allergens.join(', ')}</strong>.</p>` : html`<p>No common allergens in the standard recipe.</p>`}
            <p class="small muted">Tell your chef about any allergies when you book. Your kitchen is not an allergen-free environment.</p>
          </details>
          <details class="more" id="d-kit"><summary>What your kitchen needs</summary>
            <p>${KITCHEN_BASICS.join(', ')}.</p>
            ${m.chefBrings.length ? html`<p><strong>Your chef brings:</strong> ${m.chefBrings.join(', ')}.</p>` : html`<p class="small muted">This meal needs no specialised equipment.</p>`}
          </details>
        </div>
      </div>
    </main>`, { tabs: false, footer: html`<p class="from"><b>${money(m.basePriceCents)}</b><span>for ${R.POLICY.baseServings} people</span></p><a class="btn primary" href="#/book/${m.id}">Book this meal</a>` });
}

// --------------------------------------------------------------- booking

const WIZARD = ['How many people?', 'When should your chef arrive?', 'Where will your chef cook?', 'Your Dishit booking', 'Payment'];

function bookView(mealId, query) {
  const m = S().meals.find((x) => x.id === mealId && x.active && activeCategories().some((c) => c.id === x.categoryId));
  if (!m) return notFound('This meal is not available right now', '#/home');
  if (!draft || draft.mealId !== mealId) newDraft(mealId, Number(query.get('n')) || 0);
  const d = draft;
  const q = store.quoteFor(S().session.customerId, mealId, d.servings);
  const now = store.now();
  let body;
  let cta;

  if (d.step === 1) {
    body = html`<p class="muted">Your chef cooks ${m.name} for everyone at the table.</p>
      <div class="stepper" style="margin:28px 0 8px">
        <button type="button" data-action="people" data-by="-1" aria-label="One person fewer" ${d.servings <= R.POLICY.minServings ? 'disabled' : ''}>&minus;</button>
        <output id="people" aria-live="polite">${d.servings}</output>
        <button type="button" data-action="people" data-by="1" aria-label="One person more" ${d.servings >= R.POLICY.maxServings ? 'disabled' : ''}>+</button>
      </div>
      <p class="small muted" style="text-align:center">${R.POLICY.minServings} to ${R.POLICY.maxServings} people</p>
      <div class="card flat" style="margin-top:20px"><dl class="kv">
        <dt>${R.POLICY.baseServings} people</dt><dd class="num">${money(m.basePriceCents)}</dd>
        ${d.servings > R.POLICY.baseServings ? html`<dt>${d.servings - R.POLICY.baseServings} extra at ${money(m.extraPersonCents)}</dt><dd class="num">${money((d.servings - R.POLICY.baseServings) * m.extraPersonCents)}</dd>` : ''}
        <div class="total" style="display:contents"><dt>Dishit service</dt><dd class="num" id="live-price">${money(q.serviceAmount)}</dd></div>
      </dl></div>`;
    cta = html`<button type="button" class="btn primary block" data-action="wizard-next">Continue</button>`;
  }

  if (d.step === 2) {
    const today = R.startOfDay(now);
    const days = Array.from({ length: 12 }, (_, i) => today + i * R.DAY + 12 * R.HOUR);
    const suggested = demoDate(now);
    body = html`<p class="muted">Dishit needs at least one day's notice, so your chef can be allocated and you can shop.</p>
      <div class="days" style="margin-top:16px" role="group" aria-label="Date">
        ${days.map((ms, i) => {
          const key = R.dateKey(ms);
          return html`<button type="button" class="day" data-action="pick-date" data-date="${key}" aria-pressed="${String(d.date === key)}" ${i === 0 ? 'disabled' : ''} ${i === 0 ? raw('title="Same-day bookings are not available"') : ''}>
            <span>${i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : new Intl.DateTimeFormat('en-ZA', { weekday: 'short' }).format(ms)}</span><b>${new Date(ms).getDate()}</b><span>${new Intl.DateTimeFormat('en-ZA', { month: 'short' }).format(ms)}</span>
          </button>`;
        })}
      </div>
      <p class="small" style="margin-top:10px"><button type="button" class="link" data-action="pick-date" data-date="${suggested}" data-time="${DEMO.time}">Use the demonstration slot: ${dateShort(R.toTimestamp(suggested, DEMO.time))} at ${DEMO.time}</button></p>
      <label class="field" style="margin-top:14px"><span>Or choose a later date</span>
        <input class="input" type="date" id="date-input" min="${R.earliestBookingDate(now)}" value="${d.date}" data-change="date-input"></label>
      <p class="label" style="margin-top:18px">Arrival time</p>
      <div class="times" role="group" aria-label="Arrival time">
        ${R.timeSlots().filter((t) => t.endsWith(':00') || t === d.time).map((t) => html`<button type="button" data-action="pick-time" data-time="${t}" aria-pressed="${String(d.time === t)}">${t}</button>`)}
      </div>
      <label class="field" style="margin-top:10px"><span class="sr">Half-hour arrival times</span>
        <select class="input" id="time-select" data-change="time-select"><option value="">Other times…</option>${R.timeSlots().map((t) => html`<option value="${t}" ${d.time === t ? 'selected' : ''}>${t}</option>`)}</select></label>
      ${d.error ? html`<p class="error" role="alert">${d.error}</p>` : ''}`;
    cta = html`<button type="button" class="btn primary block" data-action="wizard-next">Continue</button>`;
  }

  if (d.step === 3) {
    const a = (key, label, opts = {}) => html`<label class="field ${d.errors[key] ? 'invalid' : ''}"><span>${label}</span>
      <input class="input" id="addr-${key}" value="${d.address[key]}" data-input="addr-input" data-key="${key}" autocomplete="off" inputmode="${opts.inputmode || ''}" maxlength="${opts.max || 80}" aria-invalid="${d.errors[key] ? 'true' : 'false'}">
      ${d.errors[key] ? html`<p class="error">${d.errors[key]}</p>` : ''}</label>`;
    body = html`<div class="stack">
      <div class="card mielie stack-s"><p class="small"><strong>Demonstration:</strong> do not enter a real address.</p>
        <button type="button" class="btn small block" data-action="demo-address">Use the demonstration address</button></div>
      ${a('line1', 'Street address')}
      <div class="grid-2">${a('suburb', 'Suburb')}${a('city', 'City')}</div>
      ${a('postalCode', 'Postal code', { inputmode: 'numeric', max: 4 })}
      <label class="field"><span>Directions for your chef (optional)</span><textarea class="input" id="addr-directions" data-input="addr-input" data-key="directions" maxlength="200">${d.address.directions}</textarea></label>
      <label class="field"><span>Allergies or anything your chef should know (optional)</span><textarea class="input" id="note-chef" data-input="note-input" maxlength="200">${d.noteToChef}</textarea></label>
      <p class="small muted">Your exact address is only shown to your chef once they have accepted the booking.</p>
    </div>`;
    cta = html`<button type="button" class="btn primary block" data-action="wizard-next">Continue</button>`;
  }

  if (d.step >= 4) {
    const scheduledAt = R.toTimestamp(d.date, d.time);
    const rule = R.cancellationRule('awaiting_chef', scheduledAt, now);
    body = html`<div class="stack">
      <div class="row top">${photo(m.image, '', 'thumb')}<div><h3>${m.name}</h3><p class="small muted">${plural(d.servings, 'person', 'people')}</p></div></div>
      <div class="card"><dl class="kv">
        <dt>Meal</dt><dd>${m.name}</dd>
        <dt>People</dt><dd>${d.servings}</dd>
        <dt>Date</dt><dd>${dateLong(scheduledAt)}</dd>
        <dt>Chef arrives</dt><dd>${d.time}</dd>
        <dt>Where</dt><dd>${d.address.line1}, ${d.address.suburb}</dd>
        <dt>Dishit service</dt><dd class="num">${money(q.serviceAmount)}</dd>
        ${q.discount ? html`<dt>Late-chef discount (${q.discountPct}%)</dt><dd class="num">${money(-q.discount)}</dd>` : ''}
        <div class="total" style="display:contents"><dt>Total</dt><dd class="num" id="total">${money(q.total)}</dd></div>
      </dl></div>
      <div class="card flat small stack-s">
        <p><strong>Groceries are not included.</strong> You buy the ingredients; your chef sends the exact list after accepting.</p>
        <p><strong>If you cancel today:</strong> ${rule.refundPct}% refund (${rule.label.toLowerCase()}). <a href="#/info/cancellation">Cancellation policy</a></p>
      </div>
      ${d.error ? html`<p class="error" role="alert">${d.error}</p>` : ''}
    </div>`;
    cta = html`<button type="button" class="btn primary block" data-action="open-payment">Proceed to payment</button>`;
  }

  return shell(html`${html`<div class="topbar">
      <button type="button" class="icon-btn" data-action="wizard-back" aria-label="Back">${icon('back')}</button>
      <h1>${m.name}</h1><span class="small muted" style="padding-right:8px">${Math.min(d.step, 4)} of 4</span></div>`}
    <main class="screen">
      <div class="steps" style="padding-top:14px" aria-hidden="true">${[1, 2, 3, 4].map((n) => html`<i class="${n <= d.step ? 'on' : ''}"></i>`)}</div>
      <div class="pad"><h2 style="margin-bottom:10px">${WIZARD[Math.min(d.step, 4) - 1]}</h2>${body}</div>
    </main>`, { tabs: false, footer: cta });
}

function paymentSheet() {
  const q = store.quoteFor(S().session.customerId, draft.mealId, draft.servings);
  return html`<div class="sheet-back"><div class="sheet stack" role="dialog" aria-label="Simulated payment">
    <div class="row spread"><h2>Pay ${money(q.total)}</h2><button type="button" class="btn small quiet" data-action="close-sheet" ${draft.paying ? 'disabled' : ''}>Cancel</button></div>
    <div class="sim-card"><p class="small">Demonstration card</p><p class="n">•••• •••• •••• 0000</p><p class="small">No real card. No money moves.</p></div>
    <p class="small muted">In the live app this step is handled by a payment provider. This demo never asks for card details.</p>
    <button type="button" class="btn primary block" data-action="pay" data-outcome="approve" ${draft.paying ? 'disabled' : ''}>${draft.paying ? 'Processing…' : 'Approve simulated payment'}</button>
    <button type="button" class="link" data-action="pay" data-outcome="decline" ${draft.paying ? 'disabled' : ''}>Simulate a declined payment</button>
  </div></div>`;
}

function confirmedView(id) {
  const b = store.find.booking(id);
  if (!b || b.customerId !== S().session.customerId) return notFound('That booking could not be found', '#/bookings');
  return shell(html`<main class="screen"><div class="pad stack" style="text-align:center; padding-top:36px">
      <div class="plate" style="width:150px; margin:0 auto">${photo(b.image, '')}</div>
      <h1>Your Dishit booking has been received!</h1>
      <div><p class="muted small">Booking reference</p><p class="big-ref" id="booking-ref">${b.ref}</p></div>
      <p>${b.mealName} for ${b.servings}<br>${dateLong(b.scheduledAt)} at ${time(b.scheduledAt)}</p>
      <div class="card mielie"><p class="strong">Finding your chef…</p><p class="small">Dishit is choosing the right chef for you. We will let you know as soon as they confirm.</p></div>
      <p class="small muted">Simulated payment of ${money(b.pricing.total)} approved (${b.payment.reference}).</p>
      <a class="btn block" href="#/booking/${b.id}">Track this booking</a>
      <a class="btn block quiet" href="#/home">Back to home</a>
    </div></main>`, { tabs: false });
}

// --------------------------------------------------------- booking detail

function tracker(b) {
  const closedBad = ['cancelled', 'customer_no_show', 'ended_missing_ingredient'].includes(b.status);
  const order = ['awaiting_chef', 'confirmed', 'en_route', 'arrived', 'cooking', 'completed'];
  const at = closedBad ? -1 : order.indexOf(b.status);
  const accepted = b.assignment.status === 'accepted' || at >= 1;
  const rows = [
    { title: 'Booking received and paid', meta: dateTime(b.createdAt), state: 'done' },
    { title: accepted ? 'Chef confirmed' : 'Finding your chef', meta: accepted ? dateTime(b.assignment.respondedAt || b.createdAt) : 'Dishit is allocating a chef', state: accepted ? 'done' : closedBad ? '' : 'now' },
    { title: 'Ingredients confirmed', meta: b.ingredients.customerConfirmedAt ? dateTime(b.ingredients.customerConfirmedAt) : b.ingredients.status === 'listed' ? 'Waiting for you' : 'After your chef sends the list', state: b.ingredients.customerConfirmedAt ? 'done' : (!closedBad && b.ingredients.status === 'listed' && at <= 1 ? 'now' : '') },
    { title: 'Chef en route', meta: b.times.enRouteAt ? time(b.times.enRouteAt) : '', state: b.times.enRouteAt ? (b.status === 'en_route' ? 'now' : 'done') : '' },
    { title: 'Chef arrived', meta: b.times.arrivedAt ? `${time(b.times.arrivedAt)}${b.late.isLate ? `, ${b.late.minutesLate} min late` : ''}` : `Booked for ${time(b.scheduledAt)}`, state: b.times.arrivedAt ? (b.status === 'arrived' ? 'now' : 'done') : '' },
    { title: 'Cooking', meta: b.times.cookingAt ? time(b.times.cookingAt) : '', state: b.times.cookingAt ? (b.status === 'cooking' ? 'now' : 'done') : '' },
    { title: 'Completed', meta: b.times.completedAt ? time(b.times.completedAt) : '', state: b.status === 'completed' ? 'done' : '' },
  ];
  if (b.status === 'confirmed' && b.ingredients.status !== 'listed') rows[1].state = 'done';
  if (closedBad) rows.push({ title: R.LABELS.booking[b.status], meta: dateTime(b.times.closedAt), state: 'bad' });
  const shown = closedBad ? rows.filter((r) => r.state) : rows;
  return html`<ol class="timeline" aria-label="Booking progress">${shown.map((r) => html`<li class="${r.state}"><div class="t-title">${r.title}</div><div class="t-meta">${r.meta}</div></li>`)}</ol>`;
}

function nowCard(b) {
  const chef = store.find.chef(b.assignment.chefId);
  const first = chef ? chef.name.split(' ')[0] : 'Your chef';
  const miss = b.ingredients.missing;
  if (b.status === 'cancelled') {
    const refunded = b.payment.refunds.reduce((s, r) => s + r.amount, 0);
    return html`<div class="card chilli"><p class="strong">This booking was cancelled${b.cancellation.by === 'admin' ? ' by Dishit' : ''}</p><p class="small">${refunded ? `Refund: ${money(refunded)} (${b.cancellation.refundPct}%).` : 'No refund was due.'}</p></div>`;
  }
  if (b.status === 'customer_no_show') return html`<div class="card chilli"><p class="strong">We missed you</p><p class="small">Your chef waited ${R.POLICY.noShowWaitMin} minutes and could not reach you. This booking is not refundable.</p></div>`;
  if (b.status === 'ended_missing_ingredient') return html`<div class="card chilli"><p class="strong">Booking ended: ${miss.item} was missing</p><p class="small">It was not available within ${R.POLICY.missingIngredientWaitMin} minutes, so your chef left. Because you confirmed your ingredients, this booking is not refundable.</p></div>`;
  if (b.status === 'completed') return b.review ? html`<div class="card leaf"><p class="strong">Thank you for your review</p><p>${stars(b.review.overall)}</p>${b.review.comment ? html`<p class="small">"${b.review.comment}"</p>` : ''}</div>` : reviewCard(b);
  if (b.status === 'cooking') return html`<div class="card indigo"><p class="strong">${first} is cooking your ${b.mealName}</p><p class="small muted">Started at ${time(b.times.cookingAt)}. Sit back.</p></div>`;
  if (b.status === 'arrived') {
    if (miss && miss.status === 'waiting') {
      return html`<div class="card chilli stack-s"><p class="strong">An essential ingredient is missing: ${miss.item}</p><p class="small">Your chef cannot cook this meal without it. Get it before the time runs out, or your chef may leave and the booking is not refundable.</p><p class="countdown" data-countdown="${R.missingIngredientDeadline(miss.flaggedAt)}">--:--</p></div>`;
    }
    return html`<div class="card indigo stack-s"><p class="strong">Your Dishit Chef has arrived</p><p class="small muted">${first} marked arrived at ${time(b.times.arrivedAt)}.</p>
      ${b.times.customerArrivalConfirmedAt ? html`<p class="small">You confirmed this at ${time(b.times.customerArrivalConfirmedAt)}.</p>` : html`<button type="button" class="btn primary small" data-action="confirm-arrival" data-id="${b.id}">Confirm chef has arrived</button>`}
      ${miss && miss.status === 'noted' ? html`<p class="small">Cooking without ${miss.item}: the meal may turn out a little different.</p>` : ''}</div>`;
  }
  if (b.status === 'en_route') return html`<div class="card indigo"><p class="strong">${first} is on the way</p><p class="small muted">Left at ${time(b.times.enRouteAt)}. Booked to arrive at ${time(b.scheduledAt)}.</p></div>`;
  if (b.status === 'confirmed') {
    if (b.ingredients.status === 'not_listed') return html`<div class="card indigo"><p class="strong">Your Dishit Chef has been confirmed!</p><p class="small muted">${first} is checking the ingredient list for your meal. You will get it shortly.</p></div>`;
    if (b.ingredients.status === 'listed') {
      const reminded = Boolean(b.ingredients.reminderSentAt);
      return html`<div class="card mielie"><p class="strong">${reminded ? 'Your Dishit booking is coming up' : 'Your ingredient list is ready'}</p><p class="small">${reminded ? 'Please confirm that you have all the required ingredients ready for your chef.' : 'Tick what you already have, shop for the rest, then confirm below.'}</p></div>`;
    }
    return html`<div class="card leaf"><p class="strong">You are all set</p><p class="small">Ingredients confirmed. ${first} arrives ${dateShort(b.scheduledAt)} at ${time(b.scheduledAt)}.</p></div>`;
  }
  return html`<div class="card mielie"><p class="strong">Finding your chef…</p><p class="small">${b.assignment.status === 'chef_cancelled' ? 'Your chef could no longer make it. Dishit is arranging a replacement.' : 'Dishit is choosing the right chef for your booking.'}</p></div>`;
}

function reviewCard(b) {
  const r = reviewDraft[b.id] || (reviewDraft[b.id] = { overall: 0, food: 0, professionalism: 0, punctuality: 0, cleanliness: 0, comment: '' });
  const starRow = (key, size = '') => html`<div class="star-input ${size}" role="group" aria-label="${key} rating">${[1, 2, 3, 4, 5].map((n) => html`<button type="button" class="${r[key] >= n ? 'on' : ''}" data-action="star" data-id="${b.id}" data-key="${key}" data-n="${n}" aria-label="${plural(n, 'star')}" aria-pressed="${String(r[key] === n)}">★</button>`)}</div>`;
  const small = (key, label) => html`<div class="row spread"><span class="small">${label}</span>${starRow(key, 'sm')}</div>`;
  return html`<div class="card stack" id="review-form">
    <div><h3>How was your Dishit experience?</h3><p class="small muted">Your review goes to Dishit and your chef.</p></div>
    ${starRow('overall')}
    <div class="stack-s">${small('food', 'Food quality')}${small('professionalism', 'Chef professionalism')}${small('punctuality', 'Punctuality')}${small('cleanliness', 'Cleanliness')}</div>
    <label class="field"><span>Anything to add? (optional)</span><textarea class="input" id="review-comment" maxlength="600" data-input="review-comment" data-id="${b.id}">${r.comment}</textarea></label>
    <button type="button" class="btn primary block" data-action="send-review" data-id="${b.id}">Send review</button>
  </div>`;
}

function ingredientsCard(b) {
  const ing = b.ingredients;
  if (ing.status === 'not_listed') return '';
  const editable = ing.status === 'listed' && R.isOpen(b.status);
  const left = ing.items.filter((i) => !i.have).length;
  let lastGroup = null;
  return html`<div class="stack-s" id="ingredients">
    <div class="row spread"><h3>Your ingredients</h3>${ing.status === 'customer_confirmed' ? chip('ingredients', 'customer_confirmed', 'Confirmed') : html`<span class="small muted">${left ? `${left} to get` : 'All ticked'}</span>`}</div>
    ${ing.chefNote ? html`<div class="card flat small"><strong>Note from your chef:</strong> ${ing.chefNote}</div>` : ''}
    <div>${ing.items.map((item, i) => {
      const head = item.group !== lastGroup ? html`<p class="ing-group">${item.group}</p>` : '';
      lastGroup = item.group;
      return html`${head}<button type="button" class="ing" data-action="toggle-ing" data-id="${b.id}" data-i="${i}" data-focus="ing-${i}" aria-pressed="${String(item.have)}" ${editable ? '' : 'disabled'}><span class="box"></span><span>${item.name}</span>${item.essential ? html`<small>Essential</small>` : ''}</button>`;
    })}</div>
    ${editable ? html`<button type="button" class="btn primary block" style="margin-top:14px" data-action="confirm-ing" data-id="${b.id}">I confirm I have the required ingredients</button>
      <p class="small muted">Your confirmation is recorded with the time. If an essential ingredient is missing when your chef arrives, you have ${R.POLICY.missingIngredientWaitMin} minutes to get it.</p>` : ''}
    ${ing.customerConfirmedAt ? html`<p class="small muted">You confirmed on ${dateTime(ing.customerConfirmedAt)}.</p>` : ''}
  </div>`;
}

function bookingView(id) {
  const b = store.find.booking(id);
  if (!b || b.customerId !== S().session.customerId) return notFound('That booking could not be found', '#/bookings');
  const chef = store.find.chef(b.assignment.status === 'accepted' ? b.assignment.chefId : b.payout.chefId);
  const s = R.settle(b);
  const cancel = R.cancellationRule(b.status, b.scheduledAt, store.now());
  return shell(html`${topbar(b.ref, '#/bookings')}
    <main class="screen"><div class="pad stack">
      <div class="row top">${photo(b.image, '', 'thumb')}<div class="grow"><h2>${b.mealName}</h2><p class="small muted">${dateLong(b.scheduledAt)} at ${time(b.scheduledAt)}, ${plural(b.servings, 'person', 'people')}</p></div></div>
      ${nowCard(b)}
      ${chef ? html`<div class="card row"><div class="avatar">${initials(chef.name)}</div><div class="grow"><p class="small muted">Your Dishit chef</p><p class="strong">${chef.name}</p><p class="small">${stars(chef.rating)} ${chef.rating.toFixed(1)} from ${chef.ratingCount} reviews</p><p class="small muted">${chef.qualification} (NQF ${chef.nqfLevel}), ${chef.years} years cooking</p></div></div>` : ''}
      ${ingredientsCard(b)}
      <div><h3 style="margin-bottom:12px">Progress</h3>${tracker(b)}</div>
      <div class="card"><h3 style="margin-bottom:10px">Payment</h3><dl class="kv">
        <dt>Dishit service</dt><dd class="num">${money(s.serviceAmount)}</dd>
        ${s.discount ? html`<dt>Late-chef discount</dt><dd class="num">${money(-s.discount)}</dd>` : ''}
        <dt>Paid (${b.payment.method.toLowerCase()})</dt><dd class="num">${money(s.paid)}</dd>
        ${b.payment.refunds.map((r) => html`<dt>Refund${r.pct ? ` ${r.pct}%` : ''} (${r.status === 'processed' ? 'processed' : 'being processed'})</dt><dd class="num">${money(-r.amount)}</dd>`)}
      </dl><p class="demo-note" style="margin-top:8px">Simulated payment ${b.payment.reference}. No real money moved.</p></div>
      <div class="card flat small"><p class="strong">Where</p><p>${b.address.line1}, ${b.address.suburb}, ${b.address.city}, ${b.address.postalCode}</p>${b.address.directions ? html`<p class="muted">${b.address.directions}</p>` : ''}${b.noteToChef ? html`<p style="margin-top:6px"><strong>Your note to the chef:</strong> ${b.noteToChef}</p>` : ''}</div>
      ${b.late.isLate ? html`<div class="card mielie small"><strong>Your chef was ${b.late.minutesLate} minutes late.</strong> You get ${R.POLICY.lateDiscountPct}% off your next Dishit, applied automatically.</div>` : ''}
      ${R.FINISHED_STATUSES.includes(b.status) || b.status === 'cancelled' ? html`<a class="btn block ghost" href="#/book/${b.mealId}?n=${b.servings}">Order again</a>` : ''}
      ${R.isOpen(b.status) ? (cancel.allowed
        ? html`<button type="button" class="btn danger block" data-action="open-cancel" data-id="${b.id}">Cancel booking</button>`
        : html`<p class="small muted">${cancel.reason}</p>`) : ''}
    </div></main>`);
}

function cancelSheet() {
  const b = store.find.booking(sheet.bookingId);
  if (!b) return '';
  const q = R.cancellationQuote(b, store.now());
  if (!q.allowed) return html`<div class="sheet-back"><div class="sheet stack"><h2>This booking cannot be cancelled here</h2><p>${q.reason}</p><button type="button" class="btn block" data-action="close-sheet">Close</button></div></div>`;
  return html`<div class="sheet-back" data-action="close-sheet-back"><div class="sheet stack" role="dialog" aria-label="Cancel booking">
    <h2>Cancel ${b.ref}?</h2>
    <div class="card"><dl class="kv">
      <dt>Rule that applies now</dt><dd>${q.label}</dd>
      <dt>You paid</dt><dd class="num">${money(q.paid)}</dd>
      <div class="total" style="display:contents"><dt>Refund (${q.refundPct}%)</dt><dd class="num" id="refund-amount">${money(q.refund)}</dd></div>
    </dl></div>
    <p class="small muted">More than 24 hours before: ${R.POLICY.refundMoreThan24hPct}%. Within 24 hours: ${R.POLICY.refundWithin24hPct}%. Once your chef is travelling: ${R.POLICY.refundChefTravellingPct}%.</p>
    <label class="field"><span>Reason (optional)</span><input class="input" id="cancel-reason" value="${sheet.reason || ''}" data-input="cancel-reason" maxlength="120"></label>
    <button type="button" class="btn danger solid block" data-action="do-cancel">Cancel booking and refund ${money(q.refund)}</button>
    <button type="button" class="btn quiet block" data-action="close-sheet">Keep my booking</button>
  </div></div>`;
}

function sheetView() {
  if (!sheet) return '';
  if (sheet.type === 'payment' && draft) return paymentSheet();
  if (sheet.type === 'cancel') return cancelSheet();
  return '';
}

// ------------------------------------------------------- lists and account

function bookingsView() {
  const all = myBookings();
  const groups = {
    upcoming: all.filter((b) => R.UPCOMING_STATUSES.includes(b.status)).sort((a, b) => a.scheduledAt - b.scheduledAt),
    active: all.filter((b) => R.ACTIVE_STATUSES.includes(b.status)),
    completed: all.filter((b) => R.FINISHED_STATUSES.includes(b.status)).sort((a, b) => b.scheduledAt - a.scheduledAt),
    cancelled: all.filter((b) => b.status === 'cancelled').sort((a, b) => b.scheduledAt - a.scheduledAt),
  };
  const list = groups[bookingsTab];
  const empties = { upcoming: 'Nothing booked yet', active: 'No chef is cooking for you right now', completed: 'No completed bookings yet', cancelled: 'No cancelled bookings' };
  return shell(html`${topbar('My Dishit')}
    <main class="screen"><div class="pad stack">
      <div class="tabset" role="tablist">${Object.keys(groups).map((k) => html`<button type="button" role="tab" data-action="bookings-tab" data-tab="${k}" aria-selected="${String(bookingsTab === k)}">${k[0].toUpperCase() + k.slice(1)}${groups[k].length ? ` (${groups[k].length})` : ''}</button>`)}</div>
      ${list.length ? list.map((b) => {
        const chef = store.find.chef(b.assignment.chefId || b.payout.chefId);
        return html`<a class="card mini-booking" href="#/booking/${b.id}" data-booking="${b.id}">
          ${photo(b.image, '')}
          <div class="grow stack-s"><div class="row spread top"><p class="strong">${b.mealName}</p>${chip('booking', b.status)}</div>
            <p class="small muted">${dateShort(b.scheduledAt)} at ${time(b.scheduledAt)}, ${plural(b.servings, 'person', 'people')}, ${money(b.pricing.total)}</p>
            <p class="small muted">${chef ? `Chef ${chef.name}` : 'Chef not confirmed yet'}${b.review ? html`, ${stars(b.review.overall)}` : b.status === 'completed' ? ', review to leave' : ''}</p></div>
        </a>`;
      }) : html`<div class="empty"><h3>${empties[bookingsTab]}</h3><p>Choose a meal and Dishit will bring the chef.</p><p style="margin-top:12px"><a class="btn small primary" href="#/home">Browse meals</a></p></div>`}
    </div></main>`);
}

function alertsView() {
  const list = S().notifications.filter((n) => n.to === `customer:${S().session.customerId}`);
  return shell(html`${topbar('Alerts')}
    <main class="screen"><div class="pad stack-s">
      <p class="demo-note">In-app only. This demo sends no real push notifications, SMS or email.</p>
      ${list.length ? list.map((n) => html`<a class="card ${n.read ? '' : 'mielie'}" style="display:block; text-decoration:none; color:inherit" href="${n.bookingId ? `#/booking/${n.bookingId}` : '#/alerts'}">
        <div class="row spread top"><p class="strong">${n.title}</p><span class="tiny muted" style="white-space:nowrap">${dateTime(n.at)}</span></div><p class="small">${n.body}</p></a>`)
        : html`<div class="empty"><h3>No alerts yet</h3><p>Booking updates will show here.</p></div>`}
    </div></main>`);
}

function accountView() {
  const c = me();
  return shell(html`${topbar('Account')}
    <main class="screen"><div class="pad stack">
      <div class="row"><div class="avatar big">${initials(`${c.firstName} ${c.surname}`)}</div><div><h2>${c.firstName} ${c.surname}</h2><p class="small muted">${c.email}</p><p class="small muted">${c.mobile.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')}</p></div></div>
      ${c.demo ? html`<p class="demo-note">Fictional demonstration account.</p>` : ''}
      ${c.discount ? html`<div class="card mielie small"><strong>${c.discount.pct}% off your next booking</strong>, applied automatically. It cannot be exchanged for cash, transferred or saved for later.</div>` : ''}
      ${INFO_GROUPS.map((g) => html`<div><h3 style="margin-bottom:4px">${g.title}</h3><ul class="list">${g.slugs.map((slug) => html`<li><a href="#/info/${slug}">${INFO_PAGES[slug].title}</a></li>`)}</ul></div>`)}
      <button type="button" class="btn ghost block" data-action="logout">Log out</button>
    </div></main>`);
}

function infoView(slug) {
  const page = INFO_PAGES[slug];
  if (!page) return notFound('That page could not be found', '#/account');
  const back = S().session.customerId ? '#/account' : '#/welcome';
  const body = slug === 'credits'
    ? html`<p>Food photographs are freely licensed images from Wikimedia Commons, cropped and resized for this demonstration.</p>
        ${credits === null ? html`<p class="muted">Loading…</p>` : credits.length ? html`<ul class="list">${credits.map((c) => html`<li style="display:block"><strong>${c.meal}</strong><br><span class="small muted">${c.author || 'Unknown author'}, ${c.licence}. <a href="${c.page}" target="_blank" rel="noopener noreferrer">Source</a></span></li>`)}</ul>` : html`<p class="muted">No photo credits found.</p>`}`
    : page.body.map((p) => html`<p>${p}</p>`);
  return html`${ribbon()}${topbar(page.title, back)}
    <main class="screen"><div class="pad stack">${body}
      ${page.placeholder ? html`<p class="demo-note">Placeholder text for the demonstration. The final wording must come from Dishit and its legal advisers.</p>` : ''}
    </div></main>${S().session.customerId ? tabBar() : ''}${demoPanel()}`;
}

function notFound(title, href) {
  return shell(html`<main class="screen"><div class="empty" style="padding-top:80px"><h3>${title}</h3><p style="margin-top:12px"><a class="btn small" href="${href}">Go back</a></p></div></main>`);
}

// ------------------------------------------------------------------ router

function view(route) {
  const [name = '', arg] = route.parts;
  const loggedIn = Boolean(me());
  if (name === 'info') return infoView(arg);
  if (!loggedIn) {
    if (name === 'login') return loginView();
    if (name === 'register') return registerView();
    if (name === 'verify') return verifyView();
    return welcomeView();
  }
  switch (name) {
    case 'category': return categoryView(arg);
    case 'meal': return mealView(arg);
    case 'book': return bookView(arg, route.query);
    case 'confirmed': return confirmedView(arg);
    case 'booking': return bookingView(arg);
    case 'bookings': return bookingsView();
    case 'alerts': return alertsView();
    case 'account': return accountView();
    default: return homeView();
  }
}

const rerender = () => app.render();

const actions = {
  ...demoActions(rerender, () => { draft = null; sheet = null; go('#/welcome'); }),

  'form-input': (el) => { forms[el.dataset.form][el.dataset.key] = el.value; },
  'form-check': (el) => { forms.register[el.dataset.key] = el.checked; },
  'verify-input': (el) => { forms.verifyCode = el.value; },
  'login-demo': () => {
    forms.message = '';
    if (act(store.loginCustomer(DEMO.customerEmail, 'demo-password')).ok) go('#/home');
  },
  login: () => {
    const r = store.loginCustomer(forms.login.email, forms.login.password);
    forms.message = r.ok ? '' : r.error;
    if (r.ok) { forms.login = { email: '', password: '' }; go('#/home'); } else if (r.needsVerification) { forms.message = ''; go('#/verify'); } else rerender();
  },
  register: () => {
    const r = store.registerCustomer(forms.register);
    forms.errors = r.ok ? {} : r.errors || {};
    if (r.ok) { forms.register = {}; forms.verifyCode = ''; forms.message = ''; go('#/verify'); } else { rerender(); toast(r.error, 'bad'); }
  },
  verify: () => {
    const r = store.verifyEmail(forms.verifyCode);
    forms.message = r.ok ? '' : r.error;
    if (r.ok) { toast('Email verified. Welcome to Dishit.', 'good'); go('#/home'); } else rerender();
  },
  logout: () => { store.logoutCustomer(); draft = null; go('#/welcome'); },

  people: (el) => {
    const next = draft.servings + Number(el.dataset.by);
    if (next >= R.POLICY.minServings && next <= R.POLICY.maxServings) { draft.servings = next; rerender(); }
  },
  'pick-date': (el) => { draft.date = el.dataset.date; if (el.dataset.time) draft.time = el.dataset.time; draft.error = ''; rerender(); },
  'date-input': (el) => { draft.date = el.value; draft.error = ''; rerender(); },
  'pick-time': (el) => { draft.time = el.dataset.time; draft.error = ''; rerender(); },
  'time-select': (el) => { if (el.value) { draft.time = el.value; draft.error = ''; rerender(); } },
  'addr-input': (el) => { draft.address[el.dataset.key] = el.value; },
  'note-input': (el) => { draft.noteToChef = el.value; },
  'demo-address': () => { draft.address = { ...DEMO.address }; draft.errors = {}; rerender(); },
  'wizard-back': () => {
    if (draft.step > 1) { draft.step -= 1; draft.error = ''; rerender(); } else go(`#/meal/${draft.mealId}`);
  },
  'wizard-next': () => {
    draft.error = '';
    if (draft.step === 2) {
      const v = R.validateSchedule(draft.date, draft.time, store.now());
      if (!v.ok) { draft.error = v.error; rerender(); return; }
    }
    if (draft.step === 3) {
      draft.errors = store.validateAddress(draft.address);
      if (Object.keys(draft.errors).length) { rerender(); toast('Complete the address to continue.', 'bad'); return; }
    }
    draft.step += 1;
    rerender();
    const screen = document.querySelector('.screen');
    if (screen) screen.scrollTop = 0;
  },
  'open-payment': () => { sheet = { type: 'payment' }; rerender(); },
  pay: (el) => {
    if (draft.paying) return;
    draft.paying = true;
    rerender();
    const outcome = el.dataset.outcome;
    setTimeout(() => {
      const d = draft;
      const r = store.createBooking({ customerId: S().session.customerId, mealId: d.mealId, servings: d.servings, date: d.date, time: d.time, address: d.address, noteToChef: d.noteToChef, payment: outcome });
      d.paying = false;
      sheet = null;
      if (r.ok) { draft = null; go(`#/confirmed/${r.bookingId}`); return; }
      d.error = r.error;
      if (r.field === 'schedule') d.step = 2;
      if (r.field === 'address') { d.step = 3; d.errors = r.errors || {}; }
      if (r.field === 'servings') d.step = 1;
      toast(r.error, 'bad');
      rerender();
    }, 700);
  },
  'close-sheet': () => { sheet = null; rerender(); },
  'close-sheet-back': (el, e) => { if (e.target === el) { sheet = null; rerender(); } },

  'toggle-ing': (el) => { act(store.setIngredientHave(el.dataset.id, Number(el.dataset.i), el.getAttribute('aria-pressed') !== 'true')); },
  'confirm-ing': (el) => { act(store.customerConfirmIngredients(el.dataset.id), 'Ingredients confirmed'); },
  'confirm-arrival': (el) => { act(store.customerConfirmArrival(el.dataset.id), 'Thanks, noted'); },
  'open-cancel': (el) => { sheet = { type: 'cancel', bookingId: el.dataset.id, reason: '' }; rerender(); },
  'cancel-reason': (el) => { if (sheet) sheet.reason = el.value; },
  'do-cancel': () => {
    const r = act(store.customerCancel(sheet.bookingId, sheet.reason));
    sheet = null;
    if (r.ok) toast(`Booking cancelled. ${R.money(r.refund)} will be refunded.`, 'good');
    rerender();
  },
  star: (el) => { reviewDraft[el.dataset.id][el.dataset.key] = Number(el.dataset.n); rerender(); },
  'review-comment': (el) => { reviewDraft[el.dataset.id].comment = el.value; },
  'send-review': (el) => {
    const r = act(store.submitReview(el.dataset.id, reviewDraft[el.dataset.id]), 'Review sent. Thank you!');
    if (r.ok) delete reviewDraft[el.dataset.id];
  },
  'bookings-tab': (el) => { bookingsTab = el.dataset.tab; rerender(); },
};

setDemoFocus(() => {
  const mine = myBookings().filter((b) => R.isOpen(b.status));
  const id = window.location.hash.match(/^#\/booking\/(\w+)/);
  return (id && mine.find((b) => b.id === id[1])) || mine.sort((a, b) => b.createdAt - a.createdAt)[0] || null;
});

const app = mount({
  root: document.getElementById('app'),
  view,
  actions,
  onRender: (route) => {
    if (route.parts[0] === 'alerts' && me() && unread()) setTimeout(() => store.markNotificationsRead(`customer:${S().session.customerId}`), 1200);
  },
});
