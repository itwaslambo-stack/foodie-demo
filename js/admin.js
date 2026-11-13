// Dishit admin dashboard (demo). Operations, manual chef allocation, menu,
// money and support. Every figure is read from rules.js via the shared store.

import * as R from './shared/rules.js';
import {
  store, html, mount, go, toast, act, money, dateLong, dateShort, dateFull, dateTime, dayMonth, time, initials, plural, stars, photo, chip,
  ribbon, demoPanel, demoActions, setDemoFocus,
} from './shared/ui.js';

const S = () => store.getState();
const F = store.find;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const phone = (m) => String(m).replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
const fullName = (c) => (c ? `${c.firstName} ${c.surname}` : 'Unknown');
const customerOf = (b) => F.customer(b.customerId);
const chefOf = (b) => F.chef(b.assignment.chefId || b.payout.chefId);

let modal = null;
let filters = { bookings: 'all', support: 'open', menuCategory: 'all' };
let showCandidates = false;
let forms = { goodwill: { amount: '', reason: '' }, incident: { summary: '', bookingRef: '', severity: 'low' }, note: {} };

const needsChef = () => S().bookings.filter((b) => b.status === 'awaiting_chef' && b.assignment.status !== 'offered');
const pendingRefunds = () => S().bookings.flatMap((b) => b.payment.refunds.filter((r) => r.status === 'pending').map((r) => ({ b, r })));
const openIncidents = () => S().incidents.filter((i) => i.status === 'open');
const applications = () => S().chefs.filter((c) => c.status === 'applied');

// ------------------------------------------------------------------ shell

const NAV = [
  ['', 'Overview'], ['bookings', 'Bookings'], ['customers', 'Customers'], ['chefs', 'Chefs'], ['menu', 'Menu'],
  ['payments', 'Payments and refunds'], ['revenue', 'Revenue'], ['payouts', 'Chef payouts'], ['reviews', 'Reviews'], ['support', 'Support and incidents'],
];

function shell(section, body) {
  const counts = { bookings: needsChef().length, chefs: applications().length, payments: pendingRefunds().length, support: openIncidents().length };
  return html`<div class="admin-shell">
    <aside class="side">
      <img class="logo" src="assets/img/brand/logo-dark.png" alt="Dishit" width="1017" height="411">
      <p class="role">Admin dashboard</p>
      <nav aria-label="Admin sections">${NAV.map(([key, label]) => html`<a href="#/${key}" aria-current="${section === key ? 'page' : 'false'}">${label}${counts[key] ? html`<span class="count">${counts[key]}</span>` : ''}</a>`)}</nav>
      <div class="foot"><p>Demonstration. Fictional people, simulated money.</p><p style="margin-top:6px"><a href="index.html" style="color:var(--on-deep)">Back to the demo hub</a></p></div>
    </aside>
    <div class="main">
      ${ribbon('Admin dashboard, sample data')}
      <div class="content">${body}</div>
    </div>
  </div>${modalView()}${demoPanel('modal')}`;
}

const head = (title, sub, right = '') => html`<header><div><h1>${title}</h1>${sub ? html`<p class="muted">${sub}</p>` : ''}</div>${right}</header>`;
const figure = (n, l, cls = 'c3', id = '') => html`<div class="panel figure ${cls}"><div class="n num" id="${id}">${n}</div><div class="l">${l}</div></div>`;
const emptyRow = (cols, text) => html`<tr><td colspan="${cols}" class="muted" style="text-align:center; padding:28px">${text}</td></tr>`;

function bookingRows(list, { showChef = true } = {}) {
  return list.map((b) => {
    const c = customerOf(b);
    const ch = chefOf(b);
    return html`<tr class="click" data-action="open" data-href="#/bookings/${b.id}" data-row="${b.id}">
      <td><a href="#/bookings/${b.id}" class="strong">${b.ref}</a></td>
      <td>${fullName(c)}</td><td>${b.mealName}<br><span class="small muted">${plural(b.servings, 'person', 'people')}, ${b.address.suburb}</span></td>
      <td class="num">${dateShort(b.scheduledAt)}<br><span class="small muted">${time(b.scheduledAt)}</span></td>
      ${showChef ? html`<td>${ch ? ch.name : html`<span class="muted">None</span>`}<br>${chip('assignment', b.assignment.status)}</td>` : ''}
      <td>${chip('booking', b.status)}</td><td>${chip('payment', b.payment.status)}</td>
      <td class="r">${money(b.pricing.total)}</td></tr>`;
  });
}

function bookingTable(list, emptyText) {
  return html`<div class="table-wrap"><table class="t"><thead><tr><th>Reference</th><th>Customer</th><th>Meal</th><th>Date</th><th>Chef</th><th>Booking</th><th>Payment</th><th class="r">Paid</th></tr></thead>
    <tbody>${list.length ? bookingRows(list) : emptyRow(8, emptyText)}</tbody></table></div>`;
}

// --------------------------------------------------------------- overview

function overviewView() {
  const all = S().bookings;
  const now = store.now();
  const sum = R.revenueSummary(all);
  const owed = store.payoutBatches().filter((p) => p.status === 'scheduled').reduce((s, p) => s + p.amount, 0);
  const today = all.filter((b) => R.dateKey(b.scheduledAt) === R.dateKey(now) && R.isOpen(b.status));
  const waiting = all.filter((b) => b.assignment.status === 'offered');
  const upcoming = all.filter((b) => R.isOpen(b.status)).sort((a, b) => a.scheduledAt - b.scheduledAt);
  const activity = all.flatMap((b) => b.events.map((e) => ({ ...e, b }))).sort((a, b) => b.at - a.at).slice(0, 9);
  const attention = [
    ...needsChef().map((b) => ({ href: `#/bookings/${b.id}`, tone: 'chilli', label: 'Needs a chef', text: `${b.ref}: ${b.mealName} for ${b.servings}, ${dateShort(b.scheduledAt)} in ${b.address.suburb}`, id: `attn-${b.id}` })),
    ...waiting.map((b) => ({ href: `#/bookings/${b.id}`, tone: 'mielie', label: 'Waiting for chef', text: `${b.ref}: offered to ${chefOf(b).name} ${dateTime(b.assignment.offeredAt)}` })),
    ...pendingRefunds().map(({ b, r }) => ({ href: `#/bookings/${b.id}`, tone: 'mielie', label: 'Refund to process', text: `${b.ref}: ${money(r.amount)} to ${fullName(customerOf(b))}` })),
    ...openIncidents().map((i) => ({ href: '#/support', tone: 'chilli', label: 'Open incident', text: i.summary })),
    ...applications().map((c) => ({ href: `#/chefs/${c.id}`, tone: 'indigo', label: 'Chef application', text: `${c.name}: ${c.qualification} (NQF ${c.nqfLevel})` })),
  ];
  return shell('', html`${head('Operations overview', `${dateLong(now)}. Chefs are allocated by hand in this first version.`)}
    <div class="cols">
      ${figure(needsChef().length, 'Bookings needing a chef', 'c3', 'fig-needs-chef')}
      ${figure(today.length, 'Happening today')}
      ${figure(money(sum.foodie), 'Dishit earnings, closed bookings')}
      ${figure(money(owed), 'Owed to chefs at next payouts')}
      <div class="panel c7"><h2>Needs attention</h2>
        ${attention.length ? html`<ul class="list">${attention.map((a) => html`<li><a href="${a.href}" id="${a.id || ''}" style="text-decoration:none; color:inherit" class="row grow"><span class="chip ${a.tone}">${a.label}</span><span class="grow">${a.text}</span></a></li>`)}</ul>` : html`<p class="muted">Nothing is waiting on you.</p>`}
      </div>
      <div class="panel c5"><h2>Latest activity</h2>
        <ul class="list">${activity.map((e) => html`<li style="display:block"><a href="#/bookings/${e.b.id}" class="small strong">${e.b.ref}</a> <span class="tiny muted">${dateTime(e.at)}</span><br><span class="small">${e.text}</span></li>`)}</ul>
      </div>
      <div class="panel tight c12"><h2>Open bookings</h2>${bookingTable(upcoming, 'No open bookings.')}</div>
    </div>`);
}

// --------------------------------------------------------------- bookings

function bookingsView() {
  const all = [...S().bookings].sort((a, b) => b.createdAt - a.createdAt);
  const sets = {
    all, 'needs a chef': needsChef(), open: all.filter((b) => R.isOpen(b.status)), completed: all.filter((b) => R.FINISHED_STATUSES.includes(b.status)), cancelled: all.filter((b) => b.status === 'cancelled'),
  };
  return shell('bookings', html`${head('Bookings', 'Every booking, newest first.')}
    <div class="tabset" role="tablist" style="margin-bottom:14px">${Object.keys(sets).map((k) => html`<button type="button" role="tab" data-action="filter" data-group="bookings" data-value="${k}" aria-selected="${String(filters.bookings === k)}">${k[0].toUpperCase() + k.slice(1)} (${sets[k].length})</button>`)}</div>
    <div class="panel tight">${bookingTable(sets[filters.bookings] || all, 'No bookings match this filter.')}</div>`);
}

function candidatesPanel(b) {
  const meal = F.meal(b.mealId) || { categoryId: b.categoryId };
  const ranked = S().chefs.filter((c) => c.status === 'approved')
    .map((c) => ({ c, fit: R.chefSuitability(c, b, meal, S().bookings) }))
    .filter(({ c }) => !(b.assignment.chefId === c.id && ['offered', 'accepted'].includes(b.assignment.status)))
    .sort((a, z) => z.fit.score - a.fit.score);
  return html`<div id="candidates">${ranked.map(({ c, fit }) => html`<div class="cand" data-chef="${c.id}">
    <div class="avatar">${initials(c.name)}</div>
    <div><p class="strong">${c.name} <span class="small muted">${c.ratingCount ? `${c.rating.toFixed(1)} rating` : 'No reviews'}, ${plural(c.years, 'year')}, reliability ${fit.reliability}%</span></p>
      <p class="checks">${fit.checks.filter((k) => k.key !== 'status').map((k) => html`<span class="${k.ok ? 'ok' : 'no'}">${k.ok ? '✓' : '✗'} ${k.label}</span>`)}</p></div>
    <button type="button" class="btn small ${fit.allPassed ? '' : 'ghost'}" data-action="allocate" data-id="${b.id}" data-chef="${c.id}">Allocate</button>
  </div>`)}</div>
  <p class="small muted" style="margin-top:8px">Suitability is advice only. You make the choice, and the chef can accept or decline.</p>`;
}

function allocationPanel(b) {
  const ch = F.chef(b.assignment.chefId);
  const canChange = ['awaiting_chef', 'confirmed'].includes(b.status);
  const history = b.assignment.history;
  const OUT = { offered: 'Offered', accepted: 'Accepted', declined: 'Declined', withdrawn: 'Reassigned by admin', chef_cancelled: 'Cancelled after accepting', booking_cancelled: 'Booking cancelled' };
  let top;
  if (ch && ['offered', 'accepted'].includes(b.assignment.status)) {
    top = html`<div class="row"><div class="avatar">${initials(ch.name)}</div><div class="grow"><p class="strong"><a href="#/chefs/${ch.id}">${ch.name}</a></p><p class="small muted">${b.assignment.status === 'offered' ? `Offered ${dateTime(b.assignment.offeredAt)}. Waiting for a response.` : `Accepted ${dateTime(b.assignment.respondedAt)}`}</p></div>
      ${canChange ? html`<button type="button" class="btn small ghost" data-action="toggle-candidates">${showCandidates ? 'Hide chefs' : 'Reallocate'}</button>` : ''}</div>
      ${canChange && showCandidates ? html`<div style="margin-top:10px; border-top:1px solid var(--line)">${candidatesPanel(b)}</div>` : ''}`;
  } else if (b.status === 'awaiting_chef') {
    top = html`<p class="small" style="margin-bottom:4px">${b.assignment.status === 'declined' ? 'The last chef declined. Choose another chef.' : b.assignment.status === 'chef_cancelled' ? 'The chef cancelled after accepting. Choose a replacement, or cancel the booking for a 100% refund.' : 'Choose a chef for this booking.'}</p>${candidatesPanel(b)}`;
  } else {
    const done = F.chef(b.payout.chefId);
    top = html`<p class="muted">${done ? html`Cooked by <a href="#/chefs/${done.id}">${done.name}</a>.` : 'No chef on this booking.'}</p>`;
  }
  return html`<div class="panel c7" id="allocation"><h2>Chef allocation</h2>${top}
    ${history.length ? html`<details class="more" id="d-assign" style="margin-top:12px"><summary>Allocation history (${history.length})</summary><ul class="list">${history.map((h) => html`<li><span>${(F.chef(h.chefId) || {}).name}: ${OUT[h.outcome] || h.outcome}${h.reason ? ` (${h.reason})` : ''}</span><span class="small muted">${dateTime(h.at)}</span></li>`)}</ul></details>` : ''}</div>`;
}

function moneyPanel(b) {
  const s = R.settle(b);
  const total = Math.max(1, s.paid);
  const maxGoodwill = R.maxGoodwillRefund(b);
  return html`<div class="panel c5" id="money"><h2>Money</h2>
    <div class="split-bar" aria-hidden="true">
      ${s.chefAmount > 0 ? html`<span class="chef" style="width:${(s.chefAmount / total) * 100}%">Chef ${money(s.chefAmount)}</span>` : ''}
      ${s.foodieAmount > 0 ? html`<span class="foodie" style="width:${(s.foodieAmount / total) * 100}%">Dishit ${money(s.foodieAmount)}</span>` : ''}
      ${s.refunded > 0 ? html`<span class="refund" style="width:${(s.refunded / total) * 100}%">Refund ${money(s.refunded)}</span>` : ''}
    </div>
    <dl class="kv" style="margin-top:14px">
      <dt>Dishit service amount</dt><dd class="num">${money(s.serviceAmount)}</dd>
      ${s.discount ? html`<dt>Late-chef discount used</dt><dd class="num">${money(-s.discount)}</dd>` : ''}
      <dt>Paid by customer</dt><dd class="num" id="m-paid">${money(s.paid)}</dd>
      ${s.refunded ? html`<dt>Refunded</dt><dd class="num">${money(-s.refunded)}</dd>` : ''}
      <dt>Rule</dt><dd id="m-rule">${s.ruleLabel}</dd>
      ${s.lateAdjustment ? html`<dt>Late adjustment to chef</dt><dd class="num">${money(s.lateAdjustment)}</dd>` : ''}
      <dt>Chef earnings${s.final ? '' : ' (estimate)'}</dt><dd class="num" id="m-chef">${money(s.chefAmount)}</dd>
      <dt>Dishit earnings${s.final ? '' : ' (estimate)'}</dt><dd class="num" id="m-foodie">${money(s.foodieAmount)}</dd>
      <dt>Chef payout</dt><dd id="m-payout">${b.payout.status === 'none' ? 'Nothing due yet' : `${R.LABELS.payout[b.payout.status]}, ${dateShort(b.payout.payoutDate)}`}</dd>
    </dl>
    <p class="demo-note" style="margin-top:8px">${b.payment.method}, ${b.payment.reference}, ${dateTime(b.payment.paidAt)}. No real money moved.</p>
    ${b.payment.refunds.length ? html`<h3 style="margin:14px 0 4px; font-size:16px">Refunds</h3><ul class="list">${b.payment.refunds.map((r) => html`<li><span><span class="strong num">${money(r.amount)}</span> ${chip('refund', r.status)}<br><span class="small muted">${r.reason}</span></span>
      ${r.status === 'pending' ? html`<button type="button" class="btn small" data-action="process-refund" data-id="${b.id}" data-refund="${r.id}">Process refund</button>` : html`<span class="small muted">${dateTime(r.processedAt)}</span>`}</li>`)}</ul>` : ''}
    ${maxGoodwill > 0 ? html`<details class="more" id="d-goodwill" style="margin-top:10px"><summary>Give a goodwill refund</summary>
      <p class="small muted">Up to ${money(maxGoodwill)}, taken from Dishit's share. The chef's earnings are not touched.</p>
      <div class="row"><input class="input" id="gw-amount" inputmode="decimal" placeholder="Amount in rand" value="${forms.goodwill.amount}" data-input="form" data-form="goodwill" data-key="amount" aria-label="Refund amount in rand" style="max-width:150px">
        <input class="input grow" id="gw-reason" placeholder="Reason" value="${forms.goodwill.reason}" data-input="form" data-form="goodwill" data-key="reason" aria-label="Reason"></div>
      <button type="button" class="btn small" data-action="goodwill" data-id="${b.id}">Add refund</button></details>` : ''}
  </div>`;
}

function bookingView(id) {
  const b = F.booking(id);
  if (!b) return shell('bookings', html`${head('Booking not found')}<p><a href="#/bookings">Back to bookings</a></p>`);
  const c = customerOf(b);
  const related = S().incidents.filter((i) => i.bookingId === b.id);
  const warn = b.status === 'confirmed' && b.ingredients.status !== 'customer_confirmed' && store.now() >= R.reminderDueAt(b.scheduledAt);
  return shell('bookings', html`${head(html`${b.ref} <span class="muted" style="font-weight:600">${b.mealName}</span>`, `Booked ${dateTime(b.createdAt)} for ${dateLong(b.scheduledAt)} at ${time(b.scheduledAt)}`, html`<div class="row wrap">
      <button type="button" class="btn small ghost" data-action="open-contact" data-id="${b.id}" data-who="customer">Message customer</button>
      ${b.assignment.chefId ? html`<button type="button" class="btn small ghost" data-action="open-contact" data-id="${b.id}" data-who="chef">Message chef</button>` : ''}
      ${R.isOpen(b.status) ? html`<button type="button" class="btn small danger" data-action="open-cancel" data-id="${b.id}">Cancel booking</button>` : ''}</div>`)}
    <div class="state-grid" style="margin-bottom:16px" id="states">
      <div><div class="l">Booking</div>${chip('booking', b.status)}</div>
      <div><div class="l">Chef assignment</div>${chip('assignment', b.assignment.status)}</div>
      <div><div class="l">Ingredients</div>${chip('ingredients', b.ingredients.status)}</div>
      <div><div class="l">Payment</div>${chip('payment', b.payment.status)}</div>
      <div><div class="l">Chef payout</div>${chip('payout', b.payout.status)}</div>
    </div>
    ${warn ? html`<div class="card mielie small" style="margin-bottom:16px"><strong>Less than two hours to go and the customer has not confirmed ingredients.</strong> The reminder was sent ${b.ingredients.reminderSentAt ? dateTime(b.ingredients.reminderSentAt) : 'automatically'}.</div>` : ''}
    ${b.late.isLate ? html`<div class="card chilli small" style="margin-bottom:16px"><strong>Chef arrived ${b.late.minutesLate} minutes late.</strong> Split is 70% chef / 30% Dishit. ${c.firstName} gets ${R.POLICY.lateDiscountPct}% off the next booking automatically.</div>` : ''}
    <div class="cols">
      ${allocationPanel(b)}
      ${moneyPanel(b)}
      <div class="panel c7"><h2>Booking details</h2><dl class="kv">
        <dt>Customer</dt><dd><a href="#/customers/${c.id}">${fullName(c)}</a></dd>
        <dt>Contact</dt><dd>${c.email}, ${phone(c.mobile)}</dd>
        <dt>Location</dt><dd>${b.address.line1}, ${b.address.suburb}, ${b.address.city}, ${b.address.postalCode}</dd>
        ${b.address.directions ? html`<dt>Directions</dt><dd>${b.address.directions}</dd>` : ''}
        <dt>Meal</dt><dd>${b.mealName}</dd><dt>People</dt><dd>${b.servings}</dd>
        <dt>Date and time</dt><dd>${dateFull(b.scheduledAt)}, ${time(b.scheduledAt)}</dd>
        <dt>Amount paid</dt><dd class="num">${money(b.pricing.total)}</dd>
        ${b.noteToChef ? html`<dt>Note to chef</dt><dd>${b.noteToChef}</dd>` : ''}
        ${b.times.arrivedAt ? html`<dt>Chef arrival (official)</dt><dd>${time(b.times.arrivedAt)}${b.times.customerArrivalConfirmedAt ? `, customer confirmed ${time(b.times.customerArrivalConfirmedAt)}` : ''}</dd>` : ''}
        ${b.ingredients.customerConfirmedAt ? html`<dt>Ingredients confirmed</dt><dd>${dateTime(b.ingredients.customerConfirmedAt)}</dd>` : ''}
        ${b.cancellation ? html`<dt>Cancelled</dt><dd>By ${b.cancellation.by === 'admin' ? 'Dishit' : 'customer'}, ${dateTime(b.cancellation.at)}${b.cancellation.reason ? `: ${b.cancellation.reason}` : ''}</dd>` : ''}
      </dl>
      ${b.review ? html`<div class="card flat" style="margin-top:14px"><p class="strong">Customer review ${stars(b.review.overall)}</p><p class="small">${b.review.comment || 'No comment.'}</p>
        <p class="small muted">Food ${b.review.food || '–'}, professionalism ${b.review.professionalism || '–'}, punctuality ${b.review.punctuality || '–'}, cleanliness ${b.review.cleanliness || '–'}</p></div>` : ''}
      ${related.length ? html`<h3 style="margin:16px 0 4px; font-size:16px">Support records</h3><ul class="list">${related.map((i) => html`<li><a href="#/support" class="grow" style="color:inherit; text-decoration:none">${i.summary}</a>${chip('incident', i.status)}</li>`)}</ul>` : ''}
      </div>
      <div class="panel c5"><h2>Booking history</h2><ol class="events" id="events">${b.events.map((e) => html`<li><time>${dateTime(e.at)}</time><span class="chip plain ${e.actor === 'admin' ? 'indigo' : e.actor === 'chef' ? 'leaf' : e.actor === 'customer' ? 'mielie' : ''}">${e.actor}</span><span>${e.text}</span></li>`)}</ol></div>
    </div>`);
}

// ------------------------------------------------------- customers, chefs

function customersView() {
  const rows = S().customers.map((c) => {
    const list = S().bookings.filter((b) => b.customerId === c.id);
    const complaints = S().incidents.filter((i) => list.some((b) => b.id === i.bookingId) && ['complaint', 'no_show'].includes(i.type)).length;
    return html`<tr class="click" data-action="open" data-href="#/customers/${c.id}"><td><a class="strong" href="#/customers/${c.id}">${fullName(c)}</a></td><td>${c.email}</td><td class="num">${phone(c.mobile)}</td>
      <td class="r">${list.length}</td><td class="r">${money(list.reduce((s, b) => s + R.settle(b).retained, 0))}</td><td class="r">${complaints}</td><td>${chip('account', c.status)}${c.emailVerified ? '' : html` <span class="chip mielie">Email not verified</span>`}</td></tr>`;
  });
  return shell('customers', html`${head('Customers', 'Fictional demonstration accounts.')}
    <div class="panel tight"><div class="table-wrap"><table class="t"><thead><tr><th>Name</th><th>Email</th><th>Mobile</th><th class="r">Bookings</th><th class="r">Spent</th><th class="r">Complaints</th><th>Account</th></tr></thead><tbody>${rows}</tbody></table></div></div>`);
}

function customerView(id) {
  const c = F.customer(id);
  if (!c) return shell('customers', html`${head('Customer not found')}<p><a href="#/customers">Back to customers</a></p>`);
  const list = S().bookings.filter((b) => b.customerId === c.id).sort((a, b) => b.scheduledAt - a.scheduledAt);
  const records = S().incidents.filter((i) => list.some((b) => b.id === i.bookingId));
  return shell('customers', html`${head(fullName(c), `Customer since ${dateFull(c.createdAt)}`, c.status === 'active'
      ? html`<button type="button" class="btn small danger" data-action="customer-status" data-id="${c.id}" data-status="suspended">Suspend account</button>`
      : html`<button type="button" class="btn small" data-action="customer-status" data-id="${c.id}" data-status="active">Reactivate account</button>`)}
    <div class="cols">
      <div class="panel c5"><h2>Account</h2><dl class="kv"><dt>Status</dt><dd>${chip('account', c.status)}</dd><dt>Email</dt><dd>${c.email}</dd><dt>Email verified</dt><dd>${c.emailVerified ? 'Yes' : 'No'}</dd><dt>Mobile</dt><dd>${phone(c.mobile)}</dd>
        <dt>Terms accepted</dt><dd>${dateFull(c.acceptedTermsAt)}</dd><dt>Privacy policy accepted</dt><dd>${dateFull(c.acceptedPrivacyAt)}</dd>
        <dt>Late-chef discount</dt><dd>${c.discount ? `${c.discount.pct}% waiting for next booking` : 'None'}</dd></dl></div>
      <div class="panel c7"><h2>Complaints and incidents</h2>${records.length ? html`<ul class="list">${records.map((i) => html`<li><span>${i.summary}</span>${chip('incident', i.status)}</li>`)}</ul>` : html`<p class="muted">No records for this customer.</p>`}</div>
      <div class="panel tight c12"><h2>Bookings</h2>${bookingTable(list, 'No bookings yet.')}</div>
    </div>`);
}

function chefsView() {
  const apps = applications();
  const rest = S().chefs.filter((c) => c.status !== 'applied');
  const earned = (id) => store.payoutBatches().filter((p) => p.chefId === id).reduce((s, p) => s + p.amount, 0);
  return shell('chefs', html`${head('Chefs', 'Applications, approved chefs and their standing.')}
    <div class="panel" style="margin-bottom:16px" id="applications"><h2>Applications to review (${apps.length})</h2>
      ${apps.length ? apps.map((c) => html`<div class="cand" data-application="${c.id}"><div class="avatar">${initials(c.name)}</div>
        <div><p class="strong"><a href="#/chefs/${c.id}">${c.name}</a> ${c.nqfLevel < 5 ? html`<span class="chip chilli">NQF ${c.nqfLevel}: below the preferred level 5</span>` : html`<span class="chip leaf">NQF ${c.nqfLevel}</span>`}</p>
          <p class="small muted">${c.qualification}, ${plural(c.years, 'year')} experience. Applied ${dateShort(c.appliedAt)}.</p></div>
        <div class="row"><button type="button" class="btn small" data-action="approve-chef" data-id="${c.id}">Approve</button><button type="button" class="btn small ghost" data-action="open-chef-status" data-id="${c.id}" data-status="rejected">Reject</button></div></div>`)
        : html`<p class="muted">No applications waiting.</p>`}
      <p class="demo-note" style="margin-top:8px">Demonstration of the approval step only. No identity documents or certificates are collected or verified here.</p></div>
    <div class="panel tight"><div class="table-wrap"><table class="t"><thead><tr><th>Chef</th><th>Qualification</th><th>Cooks</th><th class="r">Rating</th><th class="r">Completed</th><th class="r">Cancellations</th><th class="r">Earned</th><th>Status</th></tr></thead><tbody>
      ${rest.map((c) => html`<tr class="click" data-action="open" data-href="#/chefs/${c.id}"><td><a class="strong" href="#/chefs/${c.id}">${c.name}</a><br><span class="small muted">${c.areas.join(', ')}</span></td><td>${c.qualification}<br><span class="small muted">NQF ${c.nqfLevel}, ${plural(c.years, 'year')}</span></td>
        <td class="small">${c.categories.map((id) => (F.category(id) || {}).name).filter(Boolean).join(', ')}</td><td class="r">${c.ratingCount ? c.rating.toFixed(1) : '–'}</td><td class="r">${c.stats.completed}</td><td class="r">${c.stats.cancellations}</td><td class="r">${money(earned(c.id))}</td><td>${chip('chef', c.status)}</td></tr>`)}</tbody></table></div></div>`);
}

function chefView(id) {
  const c = F.chef(id);
  if (!c) return shell('chefs', html`${head('Chef not found')}<p><a href="#/chefs">Back to chefs</a></p>`);
  const list = S().bookings.filter((b) => b.assignment.history.some((h) => h.chefId === c.id)).sort((a, b) => b.scheduledAt - a.scheduledAt);
  const batches = store.payoutBatches().filter((p) => p.chefId === c.id);
  const paid = batches.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const due = batches.filter((p) => p.status === 'scheduled').reduce((s, p) => s + p.amount, 0);
  const actions = c.status === 'applied'
    ? html`<div class="row"><button type="button" class="btn small" data-action="approve-chef" data-id="${c.id}">Approve</button><button type="button" class="btn small ghost" data-action="open-chef-status" data-id="${c.id}" data-status="rejected">Reject</button></div>`
    : c.status === 'approved' ? html`<button type="button" class="btn small danger" data-action="open-chef-status" data-id="${c.id}" data-status="suspended">Suspend chef</button>`
      : html`<button type="button" class="btn small" data-action="approve-chef" data-id="${c.id}">${c.status === 'suspended' ? 'Reactivate chef' : 'Approve after all'}</button>`;
  return shell('chefs', html`${head(c.name, c.bio, actions)}
    <div class="cols">
      <div class="panel c5"><h2>Profile and qualifications</h2><dl class="kv"><dt>Status</dt><dd>${chip('chef', c.status)}</dd><dt>Qualification</dt><dd>${c.qualification}</dd>
        <dt>NQF level</dt><dd>${c.nqfLevel}${c.nqfLevel < 5 ? ' (below preferred level 5)' : ''}</dd><dt>Experience</dt><dd>${plural(c.years, 'year')}</dd>
        <dt>Contact</dt><dd>${c.email}, ${phone(c.mobile)}</dd><dt>Cooks</dt><dd>${c.categories.map((x) => (F.category(x) || {}).name).filter(Boolean).join(', ')}</dd><dt>Areas</dt><dd>${c.areas.join(', ')}</dd>
        <dt>Rating</dt><dd>${c.ratingCount ? html`${c.rating.toFixed(1)} from ${plural(c.ratingCount, 'review')}` : 'No reviews yet'}</dd></dl>
        <h3 style="margin:16px 0 8px; font-size:16px">Availability</h3>
        <div class="tabset" role="group" aria-label="Available days">${DAYS.map((d, i) => html`<button type="button" data-action="chef-day" data-id="${c.id}" data-day="${i}" aria-selected="${String(c.availability.includes(i))}" aria-pressed="${String(c.availability.includes(i))}">${d}</button>`)}</div></div>
      <div class="panel c7"><h2>Standing and earnings</h2>
        <div class="cols" style="gap:10px"><div class="figure c4"><div class="n num">${c.stats.completed}</div><div class="l">Completed</div></div><div class="figure c4"><div class="n num">${c.stats.cancellations}</div><div class="l">Cancelled after accepting</div></div><div class="figure c4"><div class="n num">${c.stats.lateArrivals}</div><div class="l">Late arrivals</div></div>
          <div class="figure c6"><div class="n num">${money(paid)}</div><div class="l">Paid out</div></div><div class="figure c6"><div class="n num">${money(due)}</div><div class="l">Scheduled for payout</div></div></div>
        ${c.statusHistory.length ? html`<h3 style="margin:16px 0 4px; font-size:16px">Status history</h3><ul class="list">${c.statusHistory.map((h) => html`<li><span>${h.from} to ${h.to}${h.reason ? `: ${h.reason}` : ''}</span><span class="small muted">${dateShort(h.at)}</span></li>`)}</ul>` : ''}</div>
      <div class="panel tight c12"><h2>Booking history</h2>${bookingTable(list, 'No bookings yet.')}</div>
    </div>`);
}

// -------------------------------------------------------------------- menu

function menuView() {
  const cats = [...S().categories].sort((a, b) => a.order - b.order);
  const meals = S().meals.filter((m) => filters.menuCategory === 'all' || m.categoryId === filters.menuCategory);
  return shell('menu', html`${head('Menu', 'Changes show in the customer app immediately. No app release needed.', html`<div class="row"><button type="button" class="btn small ghost" data-action="edit-category">Add category</button><button type="button" class="btn small" data-action="edit-meal">Add meal</button></div>`)}
    <div class="cols">
      <div class="panel tight c5"><h2>Categories</h2><div class="table-wrap"><table class="t" id="categories"><thead><tr><th>Category</th><th class="r">Meals</th><th>Shown</th><th></th></tr></thead><tbody>
        ${cats.map((c) => html`<tr data-category="${c.id}"><td><div class="row">${photo(c.image, '', 'thumb')}<span class="strong">${c.name}</span></div></td><td class="r">${S().meals.filter((m) => m.categoryId === c.id).length}</td>
          <td><button type="button" class="chip ${c.active ? 'leaf' : 'chilli'}" style="border:0" data-action="toggle-category" data-id="${c.id}" aria-pressed="${String(c.active)}">${c.active ? 'Active' : 'Hidden'}</button></td>
          <td class="r"><button type="button" class="link" data-action="edit-category" data-id="${c.id}">Edit</button></td></tr>`)}</tbody></table></div></div>
      <div class="panel tight c7"><h2>Meals</h2>
        <div class="tabset" style="padding:0 20px 12px">${[['all', 'All'], ...cats.map((c) => [c.id, c.name])].map(([id, name]) => html`<button type="button" data-action="filter" data-group="menuCategory" data-value="${id}" aria-selected="${String(filters.menuCategory === id)}">${name}</button>`)}</div>
        <div class="table-wrap"><table class="t" id="meals"><thead><tr><th>Meal</th><th class="r">For 2</th><th class="r">Extra person</th><th class="r">Cook time</th><th>Shown</th><th></th></tr></thead><tbody>
        ${meals.length ? meals.map((m) => html`<tr data-meal="${m.id}"><td><div class="row">${photo(m.image, '', 'thumb')}<div><span class="strong">${m.name}</span><br><span class="small muted">${(F.category(m.categoryId) || {}).name}</span></div></div></td>
          <td class="r">${money(m.basePriceCents)}</td><td class="r">${money(m.extraPersonCents)}</td><td class="r">${m.cookMinutes} min</td>
          <td><button type="button" class="chip ${m.active ? 'leaf' : 'chilli'}" style="border:0" data-action="toggle-meal" data-id="${m.id}" aria-pressed="${String(m.active)}">${m.active ? 'Active' : 'Hidden'}</button></td>
          <td class="r"><button type="button" class="link" data-action="edit-meal" data-id="${m.id}">Edit</button></td></tr>`) : emptyRow(6, 'No meals in this category yet.')}</tbody></table></div></div>
    </div>
    <p class="demo-note" style="margin-top:12px">All prices are invented demonstration content, not approved commercial pricing.</p>`);
}

const ingredientsToText = (groups) => groups.map((g) => `${g.group}: ${g.items.map((i) => i.name + (i.essential ? '*' : '')).join(', ')}`).join('\n');
function textToIngredients(text) {
  return String(text).split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const at = line.indexOf(':');
    const group = at > 0 ? line.slice(0, at).trim() : 'Ingredients';
    const rest = at > 0 ? line.slice(at + 1) : line;
    return { group, items: rest.split(',').map((x) => x.trim()).filter(Boolean).map((x) => (x.endsWith('*') ? { name: x.slice(0, -1).trim(), essential: true } : { name: x, essential: false })) };
  }).filter((g) => g.items.length);
}
const lines = (text) => String(text).split(/\n|,/).map((x) => x.trim()).filter(Boolean);

// ------------------------------------------------------------------ money

function paymentsView() {
  const all = [...S().bookings].sort((a, b) => b.payment.paidAt - a.payment.paidAt);
  const refunds = all.flatMap((b) => b.payment.refunds.map((r) => ({ b, r }))).sort((a, z) => (a.r.status === z.r.status ? z.r.createdAt - a.r.createdAt : a.r.status === 'pending' ? -1 : 1));
  return shell('payments', html`${head('Payments and refunds', 'Simulated card payments. No real money moved.')}
    <div class="panel tight" style="margin-bottom:16px"><h2>Refunds</h2><div class="table-wrap"><table class="t" id="refunds"><thead><tr><th>Booking</th><th>Customer</th><th>Reason</th><th>Requested</th><th class="r">Amount</th><th>Status</th><th></th></tr></thead><tbody>
      ${refunds.length ? refunds.map(({ b, r }) => html`<tr><td><a class="strong" href="#/bookings/${b.id}">${b.ref}</a></td><td>${fullName(customerOf(b))}</td><td>${r.reason}${r.pct ? html` <span class="small muted">(${r.pct}%)</span>` : ''}</td><td class="num">${dateTime(r.createdAt)}</td><td class="r">${money(r.amount)}</td><td>${chip('refund', r.status)}</td>
        <td class="r">${r.status === 'pending' ? html`<button type="button" class="btn small" data-action="process-refund" data-id="${b.id}" data-refund="${r.id}">Process refund</button>` : html`<span class="small muted">${dateShort(r.processedAt)}</span>`}</td></tr>`) : emptyRow(7, 'No refunds.')}</tbody></table></div></div>
    <div class="panel tight"><h2>Payments</h2><div class="table-wrap"><table class="t"><thead><tr><th>Booking</th><th>Customer</th><th>Paid</th><th>Method</th><th>Reference</th><th class="r">Amount</th><th class="r">Refunded</th><th>Status</th></tr></thead><tbody>
      ${all.map((b) => html`<tr class="click" data-action="open" data-href="#/bookings/${b.id}"><td><a class="strong" href="#/bookings/${b.id}">${b.ref}</a></td><td>${fullName(customerOf(b))}</td><td class="num">${dateTime(b.payment.paidAt)}</td><td>${b.payment.method}</td><td class="num">${b.payment.reference}</td>
        <td class="r">${money(b.payment.amount)}</td><td class="r">${money(R.settle(b).refunded)}</td><td>${chip('payment', b.payment.status)}</td></tr>`)}</tbody></table></div></div>`);
}

function revenueView() {
  const all = [...S().bookings].sort((a, b) => b.scheduledAt - a.scheduledAt);
  const sum = R.revenueSummary(all);
  const byChef = S().chefs.map((c) => {
    const closed = all.filter((b) => b.payout.chefId === c.id);
    const batches = store.payoutBatches().filter((p) => p.chefId === c.id);
    return { c, count: closed.length, earned: closed.reduce((s, b) => s + R.settle(b).chefAmount, 0), late: closed.reduce((s, b) => s + R.settle(b).lateAdjustment, 0), paid: batches.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0), due: batches.filter((p) => p.status === 'scheduled').reduce((s, p) => s + p.amount, 0) };
  }).filter((x) => x.count);
  return shell('revenue', html`${head('Revenue', 'Standard split 80% chef / 20% Dishit. Late chef: 70% / 30%.')}
    <div class="cols">
      ${figure(money(sum.gross), 'Paid by customers', 'c3', 'rev-gross')}
      ${figure(money(sum.refunded), 'Refunded', 'c3', 'rev-refunded')}
      ${figure(money(sum.chef), 'Chef earnings, closed bookings', 'c3', 'rev-chef')}
      ${figure(money(sum.foodie), 'Dishit earnings, closed bookings', 'c3', 'rev-foodie')}
      <div class="panel c12"><div class="split-bar" aria-hidden="true">
        <span class="chef" style="width:${(sum.chef / Math.max(1, sum.gross)) * 100}%">Chefs</span><span class="foodie" style="width:${(sum.foodie / Math.max(1, sum.gross)) * 100}%">Dishit</span>
        <span class="refund" style="width:${(sum.refunded / Math.max(1, sum.gross)) * 100}%">Refunds</span><span style="flex:1; background:var(--soft); color:var(--muted)">Open</span></div>
        <p class="small muted" style="margin-top:10px">${plural(sum.standardCount, 'booking')} at the standard split, ${sum.lateCount} at the late-chef split, ${sum.cancelledCount} cancelled. ${plural(sum.openCount, 'open booking')} still to settle: about ${money(sum.estimatedChef)} to chefs and ${money(sum.estimatedDishit)} to Dishit. Late-chef discounts given: ${money(sum.discounts)}.</p></div>
      <div class="panel tight c12"><h2>Breakdown by booking</h2><div class="table-wrap"><table class="t" id="revenue-table"><thead><tr><th>Booking</th><th>Date</th><th>Status</th><th>Rule</th><th class="r">Paid</th><th class="r">Refunded</th><th class="r">Chef</th><th class="r">Dishit</th></tr></thead><tbody>
        ${all.map((b) => { const s = R.settle(b); return html`<tr class="click" data-action="open" data-href="#/bookings/${b.id}" data-row="${b.id}"><td><a class="strong" href="#/bookings/${b.id}">${b.ref}</a><br><span class="small muted">${b.mealName}</span></td><td class="num">${dayMonth(b.scheduledAt)}</td><td>${chip('booking', b.status)}</td>
          <td class="small">${s.ruleLabel}</td><td class="r">${money(s.paid)}</td><td class="r">${s.refunded ? money(s.refunded) : '–'}</td><td class="r">${s.final ? money(s.chefAmount) : html`<span class="muted">~${money(s.chefAmount)}</span>`}</td><td class="r">${s.final ? money(s.foodieAmount) : html`<span class="muted">~${money(s.foodieAmount)}</span>`}</td></tr>`; })}</tbody>
        <tfoot><tr><td colspan="4">Closed bookings</td><td class="r">${money(sum.gross)}</td><td class="r">${money(sum.refunded)}</td><td class="r">${money(sum.chef)}</td><td class="r">${money(sum.foodie)}</td></tr></tfoot></table></div></div>
      <div class="panel tight c12"><h2>Chef earnings</h2><div class="table-wrap"><table class="t"><thead><tr><th>Chef</th><th class="r">Paid bookings</th><th class="r">Late adjustments</th><th class="r">Earned</th><th class="r">Paid out</th><th class="r">Scheduled</th></tr></thead><tbody>
        ${byChef.map((x) => html`<tr class="click" data-action="open" data-href="#/chefs/${x.c.id}"><td><a class="strong" href="#/chefs/${x.c.id}">${x.c.name}</a></td><td class="r">${x.count}</td><td class="r">${x.late ? money(x.late) : '–'}</td><td class="r">${money(x.earned)}</td><td class="r">${money(x.paid)}</td><td class="r">${money(x.due)}</td></tr>`)}</tbody></table></div></div>
    </div>`);
}

function payoutsView() {
  const batches = store.payoutBatches();
  const scheduled = batches.filter((p) => p.status === 'scheduled');
  return shell('payouts', html`${head('Chef payouts', `Paid every second Friday for completed bookings. Next payout day: ${dateLong(R.nextPayoutDate(store.now()))}.`)}
    <div class="cols">
      ${figure(money(scheduled.reduce((s, p) => s + p.amount, 0)), 'Scheduled, not yet paid', 'c4', 'payout-due')}
      ${figure(scheduled.length, 'Payouts waiting', 'c4')}
      ${figure(money(batches.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0)), 'Paid out so far', 'c4')}
      <div class="panel tight c12"><div class="table-wrap"><table class="t" id="payouts"><thead><tr><th>Payout date</th><th>Chef</th><th>Bookings</th><th class="r">Adjustments</th><th class="r">Amount payable</th><th>Status</th><th></th></tr></thead><tbody>
        ${batches.length ? batches.map((p) => html`<tr data-payout="${p.id}"><td class="num strong">${dateFull(p.payoutDate)}</td><td><a href="#/chefs/${p.chefId}">${F.chef(p.chefId).name}</a></td>
          <td class="small">${p.bookingIds.map((id) => html`<a href="#/bookings/${id}">${F.booking(id).ref}</a> `)}</td><td class="r">${p.adjustments ? money(p.adjustments) : '–'}</td><td class="r strong">${money(p.amount)}</td><td>${chip('payout', p.status)}</td>
          <td class="r">${p.status === 'scheduled' ? html`<button type="button" class="btn small" data-action="pay-batch" data-id="${p.id}">Mark as paid</button>` : html`<span class="small muted">${p.reference}</span>`}</td></tr>`) : emptyRow(7, 'No payouts yet.')}</tbody></table></div></div>
    </div>
    <p class="demo-note" style="margin-top:12px">"Mark as paid" only records the payout in this demonstration. No bank transfer is made.</p>`);
}

function reviewsView() {
  const list = S().bookings.filter((b) => b.review).sort((a, b) => b.review.at - a.review.at);
  const avg = list.length ? list.reduce((s, b) => s + b.review.overall, 0) / list.length : 0;
  return shell('reviews', html`${head('Reviews', list.length ? `${plural(list.length, 'review')}, average ${avg.toFixed(1)} out of 5.` : 'No reviews yet.')}
    <div class="panel tight"><div class="table-wrap"><table class="t" id="reviews"><thead><tr><th>Booking</th><th>Customer</th><th>Chef</th><th>Overall</th><th>Food / Prof. / Punct. / Clean</th><th>Comment</th><th>Date</th></tr></thead><tbody>
      ${list.length ? list.map((b) => html`<tr class="click" data-action="open" data-href="#/bookings/${b.id}"><td><a class="strong" href="#/bookings/${b.id}">${b.ref}</a></td><td>${fullName(customerOf(b))}</td><td>${(chefOf(b) || {}).name}</td><td>${stars(b.review.overall)}</td>
        <td class="num">${[b.review.food, b.review.professionalism, b.review.punctuality, b.review.cleanliness].map((v) => v || '–').join(' / ')}</td><td class="small">${b.review.comment || html`<span class="muted">No comment</span>`}</td><td class="num">${dayMonth(b.review.at)}</td></tr>`) : emptyRow(7, 'No reviews yet.')}</tbody></table></div></div>`);
}

function supportView() {
  const all = S().incidents;
  const list = all.filter((i) => filters.support === 'all' || i.status === filters.support);
  const TYPE = { chef_late: 'Chef late', chef_cancelled: 'Chef cancelled', customer_cancelled: 'Customer cancelled', missing_ingredient: 'Missing ingredient', no_show: 'Customer no-show', complaint: 'Complaint', support: 'Support' };
  return shell('support', html`${head('Support and incidents', 'Late arrivals, cancellations, no-shows and complaints are logged automatically. You can add your own records.')}
    <div class="cols">
      <div class="c8"><div class="tabset" style="margin-bottom:12px">${['open', 'resolved', 'all'].map((k) => html`<button type="button" data-action="filter" data-group="support" data-value="${k}" aria-selected="${String(filters.support === k)}">${k[0].toUpperCase() + k.slice(1)} (${k === 'all' ? all.length : all.filter((i) => i.status === k).length})</button>`)}</div>
        <div class="stack" id="incidents">${list.length ? list.map((i) => { const b = i.bookingId && F.booking(i.bookingId); return html`<div class="panel" data-incident="${i.id}">
          <div class="row spread top"><div><p><span class="chip ${i.severity === 'high' ? 'chilli' : i.severity === 'medium' ? 'mielie' : ''}">${TYPE[i.type] || i.type}</span> ${chip('incident', i.status)} ${b ? html`<a href="#/bookings/${b.id}" class="strong">${b.ref}</a>` : ''}</p><p style="margin-top:6px">${i.summary}</p><p class="small muted">Logged ${dateTime(i.createdAt)}${i.resolvedAt ? `, resolved ${dateTime(i.resolvedAt)}` : ''}</p></div>
            ${i.status === 'open' ? html`<button type="button" class="btn small" data-action="resolve-incident" data-id="${i.id}">Resolve</button>` : ''}</div>
          ${i.notes.length ? html`<ul class="list" style="margin-top:8px">${i.notes.map((n) => html`<li><span class="small">${n.text}</span><span class="tiny muted">${dateTime(n.at)}</span></li>`)}</ul>` : ''}
          ${i.status === 'open' ? html`<div class="row" style="margin-top:10px"><input class="input grow" id="note-${i.id}" placeholder="Add a note" value="${forms.note[i.id] || ''}" data-input="note" data-id="${i.id}" aria-label="Note"><button type="button" class="btn small quiet" data-action="add-note" data-id="${i.id}">Add note</button></div>` : ''}
        </div>`; }) : html`<div class="panel empty"><h3>Nothing here</h3><p>No ${filters.support === 'all' ? '' : filters.support} records.</p></div>`}</div></div>
      <div class="panel c4" style="align-self:start"><h2>Log a record</h2><div class="stack-s">
        <label class="field"><span>What happened</span><textarea class="input" id="inc-summary" data-input="form" data-form="incident" data-key="summary" maxlength="300">${forms.incident.summary}</textarea></label>
        <label class="field"><span>Booking reference (optional)</span><input class="input" id="inc-ref" placeholder="DS-00000" value="${forms.incident.bookingRef}" data-input="form" data-form="incident" data-key="bookingRef"></label>
        <label class="field"><span>Severity</span><select class="input" id="inc-sev" data-change="form" data-form="incident" data-key="severity">${['low', 'medium', 'high'].map((v) => html`<option value="${v}" ${forms.incident.severity === v ? 'selected' : ''}>${v[0].toUpperCase() + v.slice(1)}</option>`)}</select></label>
        <button type="button" class="btn small block" data-action="add-incident">Log record</button></div></div>
    </div>`);
}

// ------------------------------------------------------------------ modals

function modalView() {
  if (!modal) return '';
  const wrap = (label, body) => html`<div class="modal-back" data-action="close-modal-back"><div class="modal stack" role="dialog" aria-label="${label}">${body}</div></div>`;
  const text = (key, label, opts = {}) => html`<label class="field ${modal.errors && modal.errors[key] ? 'invalid' : ''}"><span>${label}</span>
    ${opts.area ? html`<textarea class="input" id="m-${key}" data-input="modal" data-key="${key}" rows="${opts.rows || 3}" placeholder="${opts.placeholder || ''}">${modal.data[key] ?? ''}</textarea>` : html`<input class="input" id="m-${key}" value="${modal.data[key] ?? ''}" data-input="modal" data-key="${key}" inputmode="${opts.inputmode || ''}" placeholder="${opts.placeholder || ''}">`}
    ${modal.errors && modal.errors[key] ? html`<p class="error">${modal.errors[key]}</p>` : ''}</label>`;
  const buttons = (label, cls = '') => html`<div class="row" style="justify-content:flex-end"><button type="button" class="btn small quiet" data-action="close-modal">Close</button><button type="button" class="btn small ${cls}" data-action="modal-save">${label}</button></div>`;
  const library = () => html`<div><p class="label">Photo</p><div class="photo-pick">${[...new Set(S().meals.map((m) => m.image).concat(modal.data.image || []).filter(Boolean))].map((src) => html`<button type="button" data-action="pick-photo" data-src="${src}" aria-pressed="${String(modal.data.image === src)}" aria-label="Use this photo">${photo(src, '')}</button>`)}</div>
    <label class="field" style="margin-top:8px"><span>Or upload a photo (stays on this computer)</span><input class="input" type="file" accept="image/*" id="m-upload" data-change="upload-photo"></label></div>`;

  if (modal.type === 'cancel') {
    const b = F.booking(modal.id);
    return wrap('Cancel booking', html`<h2>Cancel ${b.ref}?</h2><p>Dishit cancelling a booking refunds the customer <strong>100% (${money(b.pricing.total)})</strong>. Use this when no replacement chef can be found.</p>${text('reason', 'Reason', { placeholder: 'For example: no replacement chef available' })}${buttons('Cancel booking and refund 100%', 'danger solid')}`);
  }
  if (modal.type === 'contact') {
    const b = F.booking(modal.id);
    const who = modal.who === 'chef' ? F.chef(b.assignment.chefId).name : fullName(customerOf(b));
    return wrap('Message', html`<h2>Message ${who}</h2><p class="small muted">Sent as an in-app alert only. This demonstration sends no SMS, email or calls.</p>${text('message', 'Message', { area: true })}${buttons('Send in-app message')}`);
  }
  if (modal.type === 'chef-status') {
    const c = F.chef(modal.id);
    return wrap('Chef status', html`<h2>${modal.status === 'rejected' ? 'Reject' : 'Suspend'} ${c.name}?</h2><p class="small muted">${modal.status === 'suspended' ? 'A suspended chef cannot be allocated bookings.' : 'The applicant will not be able to receive bookings.'}</p>${text('reason', 'Reason')}${buttons(modal.status === 'rejected' ? 'Reject application' : 'Suspend chef', 'danger solid')}`);
  }
  if (modal.type === 'category') {
    return wrap('Category', html`<h2>${modal.id ? 'Edit category' : 'Add category'}</h2>${text('name', 'Name')}${text('blurb', 'Short description')}${library()}${buttons('Save category')}`);
  }
  if (modal.type === 'meal') {
    return wrap('Meal', html`<h2>${modal.id ? 'Edit meal' : 'Add meal'}</h2>${text('name', 'Meal name')}
      <label class="field ${modal.errors.categoryId ? 'invalid' : ''}"><span>Category</span><select class="input" id="m-categoryId" data-change="modal" data-key="categoryId"><option value="">Choose…</option>${S().categories.map((c) => html`<option value="${c.id}" ${modal.data.categoryId === c.id ? 'selected' : ''}>${c.name}</option>`)}</select>${modal.errors.categoryId ? html`<p class="error">${modal.errors.categoryId}</p>` : ''}</label>
      ${text('description', 'Description', { area: true, rows: 2 })}
      <div class="grid-2">${text('base', 'Price for 2 people (R)', { inputmode: 'decimal' })}${text('extra', 'Each extra person (R)', { inputmode: 'decimal' })}</div>
      ${text('cook', 'Cooking time (minutes)', { inputmode: 'numeric' })}
      ${text('included', 'What is included (one per line)', { area: true })}
      ${text('ingredients', 'Ingredients the customer buys', { area: true, rows: 4, placeholder: 'Group: item*, item, item   (one group per line, * marks an essential ingredient)' })}
      ${text('allergens', 'Allergens (comma separated)')}${text('chefBrings', 'Equipment the chef brings (comma separated)')}
      ${library()}${buttons('Save meal')}`);
  }
  return '';
}

function saveModal() {
  const m = modal;
  const d = m.data;
  let r;
  if (m.type === 'cancel') r = store.adminCancel(m.id, d.reason);
  if (m.type === 'contact') r = store.adminContact(m.id, m.who, d.message);
  if (m.type === 'chef-status') r = store.setChefStatus(m.id, m.status, d.reason);
  if (m.type === 'category') r = store.saveCategory({ id: m.id, name: d.name, blurb: d.blurb, image: d.image });
  if (m.type === 'meal') {
    r = store.saveMeal({ id: m.id, name: d.name, categoryId: d.categoryId, description: d.description, basePriceCents: Math.round(Number(String(d.base).replace(',', '.')) * 100), extraPersonCents: Math.round(Number(String(d.extra).replace(',', '.')) * 100), cookMinutes: Number(d.cook),
      included: lines(d.included), ingredients: textToIngredients(d.ingredients), allergens: lines(d.allergens), chefBrings: lines(d.chefBrings), image: d.image });
    if (!r.ok && r.errors) { m.errors = { ...r.errors, base: r.errors.basePriceCents, extra: r.errors.extraPersonCents, cook: r.errors.cookMinutes }; }
  }
  if (r.ok) { modal = null; toast({ cancel: 'Booking cancelled and refunded', contact: 'Message sent in the app', 'chef-status': 'Chef status updated', category: 'Category saved', meal: 'Meal saved' }[m.type], 'good'); }
  else toast(r.error, 'bad');
  app.render();
}

// ------------------------------------------------------------------ wiring

function view(route) {
  const [name = '', arg] = route.parts;
  switch (name) {
    case 'bookings': return arg ? bookingView(arg) : bookingsView();
    case 'customers': return arg ? customerView(arg) : customersView();
    case 'chefs': return arg ? chefView(arg) : chefsView();
    case 'menu': return menuView();
    case 'payments': return paymentsView();
    case 'revenue': return revenueView();
    case 'payouts': return payoutsView();
    case 'reviews': return reviewsView();
    case 'support': return supportView();
    default: return overviewView();
  }
}

const rerender = () => app.render();

const actions = {
  ...demoActions(rerender, () => { modal = null; go('#/'); }),
  open: (el, e) => { if (!e.target.closest('a, button')) go(el.dataset.href); else if (e.target.closest('a')) go(e.target.closest('a').getAttribute('href')); },
  filter: (el) => { filters[el.dataset.group] = el.dataset.value; rerender(); },
  form: (el) => { forms[el.dataset.form][el.dataset.key] = el.value; },
  note: (el) => { forms.note[el.dataset.id] = el.value; },
  'toggle-candidates': () => { showCandidates = !showCandidates; rerender(); },
  allocate: (el) => { if (act(store.allocateChef(el.dataset.id, el.dataset.chef), `Offered to ${F.chef(el.dataset.chef).name}`).ok) showCandidates = false; rerender(); },
  'process-refund': (el) => { act(store.adminProcessRefund(el.dataset.id, el.dataset.refund), 'Refund processed (simulated)'); },
  goodwill: (el) => {
    const r = act(store.adminGoodwillRefund(el.dataset.id, Math.round(Number(String(forms.goodwill.amount).replace(',', '.')) * 100), forms.goodwill.reason), 'Goodwill refund added');
    if (r.ok) { forms.goodwill = { amount: '', reason: '' }; rerender(); }
  },
  'open-cancel': (el) => { modal = { type: 'cancel', id: el.dataset.id, data: { reason: '' }, errors: {} }; rerender(); },
  'open-contact': (el) => { modal = { type: 'contact', id: el.dataset.id, who: el.dataset.who, data: { message: '' }, errors: {} }; rerender(); },
  'open-chef-status': (el) => { modal = { type: 'chef-status', id: el.dataset.id, status: el.dataset.status, data: { reason: '' }, errors: {} }; rerender(); },
  'approve-chef': (el) => { act(store.setChefStatus(el.dataset.id, 'approved'), `${F.chef(el.dataset.id).name} is approved`); },
  'chef-day': (el) => { const c = F.chef(el.dataset.id); const day = Number(el.dataset.day); act(store.setChefAvailability(c.id, c.availability.includes(day) ? c.availability.filter((d) => d !== day) : [...c.availability, day])); },
  'customer-status': (el) => { act(store.setCustomerStatus(el.dataset.id, el.dataset.status), el.dataset.status === 'active' ? 'Account reactivated' : 'Account suspended'); },
  'toggle-category': (el) => { act(store.setCategoryActive(el.dataset.id, el.getAttribute('aria-pressed') !== 'true')); },
  'toggle-meal': (el) => { act(store.setMealActive(el.dataset.id, el.getAttribute('aria-pressed') !== 'true')); },
  'edit-category': (el) => { const c = el.dataset.id ? F.category(el.dataset.id) : null; modal = { type: 'category', id: c ? c.id : null, data: c ? { name: c.name, blurb: c.blurb, image: c.image } : { name: '', blurb: '', image: '' }, errors: {} }; rerender(); },
  'edit-meal': (el) => {
    const m = el.dataset.id ? F.meal(el.dataset.id) : null;
    modal = { type: 'meal', id: m ? m.id : null, errors: {}, data: m
      ? { name: m.name, categoryId: m.categoryId, description: m.description, base: m.basePriceCents / 100, extra: m.extraPersonCents / 100, cook: m.cookMinutes, included: m.included.join('\n'), ingredients: ingredientsToText(m.ingredients), allergens: m.allergens.join(', '), chefBrings: m.chefBrings.join(', '), image: m.image }
      : { name: '', categoryId: filters.menuCategory === 'all' ? '' : filters.menuCategory, description: '', base: '', extra: '', cook: '', included: '', ingredients: '', allergens: '', chefBrings: '', image: '' } };
    rerender();
  },
  modal: (el) => { modal.data[el.dataset.key] = el.value; },
  'pick-photo': (el) => { modal.data.image = el.dataset.src; rerender(); },
  'upload-photo': (el) => {
    const file = el.files && el.files[0];
    if (!file || !file.type.startsWith('image/')) { toast('Choose an image file.', 'bad'); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      // Resize in the browser so the photo fits in local demo storage. Nothing is uploaded anywhere.
      const w = 800; const h = 600;
      const scale = Math.max(w / img.width, h / img.height);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, (w - img.width * scale) / 2, (h - img.height * scale) / 2, img.width * scale, img.height * scale);
      URL.revokeObjectURL(url);
      if (modal) { modal.data.image = canvas.toDataURL('image/jpeg', 0.78); rerender(); toast('Photo added', 'good'); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast('That file could not be read as an image.', 'bad'); };
    img.src = url;
  },
  'modal-save': saveModal,
  'close-modal': () => { modal = null; rerender(); },
  'close-modal-back': (el, e) => { if (e.target === el) { modal = null; rerender(); } },
  'pay-batch': (el) => { if (window.confirm('Mark this payout as paid? This only records it in the demonstration.')) act(store.markPayoutPaid(el.dataset.id), 'Payout marked as paid (simulated)'); },
  'resolve-incident': (el) => { act(store.resolveIncident(el.dataset.id), 'Record resolved'); },
  'add-note': (el) => { if (act(store.addIncidentNote(el.dataset.id, forms.note[el.dataset.id])).ok) { forms.note[el.dataset.id] = ''; rerender(); } },
  'add-incident': () => {
    const ref = forms.incident.bookingRef.trim().toUpperCase();
    const b = ref ? S().bookings.find((x) => x.ref === ref) : null;
    if (ref && !b) { toast(`No booking has the reference ${ref}.`, 'bad'); return; }
    if (act(store.addIncident({ bookingId: b ? b.id : null, summary: forms.incident.summary, severity: forms.incident.severity, type: 'support' }), 'Record logged').ok) { forms.incident = { summary: '', bookingRef: '', severity: 'low' }; filters.support = 'open'; rerender(); }
  },
};

setDemoFocus(() => {
  const id = window.location.hash.match(/^#\/bookings\/(\w+)/);
  return (id && F.booking(id[1])) || S().bookings.filter((b) => R.isOpen(b.status)).sort((a, b) => b.createdAt - a.createdAt)[0] || null;
});

const app = mount({ root: document.getElementById('app'), view, actions, scrollSelector: '.content' });
window.addEventListener('hashchange', () => { showCandidates = false; window.scrollTo(0, 0); });
