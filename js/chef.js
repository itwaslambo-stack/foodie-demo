// Foodie chef app (demo). The chef's status buttons are the official record
// for arrival, lateness, no-shows and completion (brief §20, §21).

import * as R from './shared/rules.js';
import {
  store, html, mount, go, toast, act, money, dateLong, dateShort, dateTime, dayMonth, time, initials, plural, stars, photo, chip, icon,
  ribbon, demoPanel, demoActions, setDemoFocus,
} from './shared/ui.js';

const S = () => store.getState();
const myId = () => S().session.chefId;
const me = () => store.find.chef(myId());
const unread = () => S().notifications.filter((n) => n.to === `chef:${myId()}` && !n.read).length;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

let sheet = null; // {type:'decline'|'cancel'|'missing', bookingId, text, essential}
let listDraft = {}; // bookingId -> {note, extras[], extra}
let bookingsTab = 'upcoming';

const requests = () => S().bookings.filter((b) => b.assignment.status === 'offered' && b.assignment.chefId === myId());
const mine = () => S().bookings.filter((b) => b.assignment.status === 'accepted' && b.assignment.chefId === myId() && R.isOpen(b.status)).sort((a, b) => a.scheduledAt - b.scheduledAt);
const past = () => S().bookings.filter((b) => !R.isOpen(b.status) && (b.payout.chefId === myId() || b.assignment.history.some((h) => h.chefId === myId() && h.outcome === 'accepted'))).sort((a, b) => b.scheduledAt - a.scheduledAt);
const myBatches = () => store.payoutBatches().filter((p) => p.chefId === myId());

function shell(body, { tabs = true, footer = '' } = {}) {
  const here = window.location.hash;
  const tab = (href, label, name, match, badge = 0) => html`<a href="${href}" aria-current="${match.test(here) ? 'page' : 'false'}">${icon(name)}${label}${badge ? html`<span class="badge">${badge}</span>` : ''}</a>`;
  return html`${ribbon('Chef app, fictional chef')}
    ${body}
    ${footer ? html`<div class="footer-cta">${footer}</div>` : ''}
    ${tabs ? html`<nav class="tabs" aria-label="Main">
      ${tab('#/home', 'Today', 'home', /^#\/?(home)?$/)}
      ${tab('#/bookings', 'Bookings', 'inbox', /^#\/(booking|requests)/, requests().length)}
      ${tab('#/earnings', 'Earnings', 'wallet', /^#\/earnings/)}
      ${tab('#/profile', 'Profile', 'user', /^#\/(profile|alerts)/, unread())}
    </nav>` : ''}
    ${sheetView()}${demoPanel()}`;
}

function topbar(title, back) {
  return html`<div class="topbar">${back ? html`<a class="icon-btn" href="${back}" aria-label="Back">${icon('back')}</a>` : ''}<h1>${title}</h1></div>`;
}

function where(b, full) {
  return full ? `${b.address.line1}, ${b.address.suburb}, ${b.address.city}, ${b.address.postalCode}` : `${b.address.suburb}, ${b.address.city}`;
}

function requestCard(b) {
  const est = R.settle(b);
  return html`<div class="card mielie stack-s" data-request="${b.id}">
    <div class="row top">${photo(b.image, '', 'thumb')}<div class="grow"><p class="small">New booking request</p><p class="strong">${b.mealName}</p>
      <p class="small">${dateLong(b.scheduledAt)} at ${time(b.scheduledAt)}</p><p class="small">${plural(b.servings, 'person', 'people')}, ${where(b, false)}</p></div></div>
    <p class="small">You earn <strong>${money(est.chefAmount)}</strong> (${est.chefPct}% of ${money(est.serviceAmount)}).</p>
    <div class="row"><button type="button" class="btn small grow" data-action="accept" data-id="${b.id}">Accept</button>
      <button type="button" class="btn small ghost grow" data-action="open-decline" data-id="${b.id}">Decline</button>
      <a class="btn small quiet" href="#/booking/${b.id}">Details</a></div>
  </div>`;
}

function bookingRow(b) {
  const s = R.settle(b);
  return html`<a class="card mini-booking" href="#/booking/${b.id}">${photo(b.image, '')}
    <div class="grow stack-s"><div class="row spread top"><p class="strong">${b.mealName}</p>${chip('booking', b.status, b.status === 'confirmed' ? 'Confirmed' : null)}</div>
      <p class="small muted">${dateShort(b.scheduledAt)} at ${time(b.scheduledAt)}, ${plural(b.servings, 'person', 'people')}, ${b.address.suburb}</p>
      <p class="small muted">${b.ref}${s.chefAmount && b.payout.chefId === myId() ? `, you earn ${money(s.chefAmount)}` : R.isOpen(b.status) ? `, you earn about ${money(s.chefAmount)}` : ''}</p></div></a>`;
}

// ------------------------------------------------------------------- home

function gate() {
  const c = me();
  if (c.status === 'approved') return null;
  const text = { applied: ['Your application is with Foodie', 'Foodie is checking your qualification and experience. You will be able to receive bookings once you are approved.'], rejected: ['Your application was not approved', 'Contact Foodie chef support for more information.'], suspended: ['Your chef account is suspended', 'You cannot receive bookings right now. Contact Foodie chef support.'] }[c.status];
  return shell(html`${topbar('Foodie chef')}<main class="screen"><div class="pad stack">
    <div class="row"><div class="avatar big">${initials(c.name)}</div><div><h2>${c.name}</h2>${chip('chef', c.status)}</div></div>
    <div class="card ${c.status === 'applied' ? 'mielie' : 'chilli'}"><p class="strong">${text[0]}</p><p class="small">${text[1]}</p></div>
    ${switcher()}
  </div></main>`, { tabs: false });
}

function switcher() {
  return html`<label class="field"><span>Demonstration: view the app as another chef</span>
    <select class="input" id="chef-switch" data-change="switch-chef">${S().chefs.map((c) => html`<option value="${c.id}" ${c.id === myId() ? 'selected' : ''}>${c.name} (${c.status})</option>`)}</select></label>`;
}

function homeView() {
  const c = me();
  const next = mine()[0];
  const batch = myBatches().filter((p) => p.status === 'scheduled').sort((a, b) => a.payoutDate - b.payoutDate)[0];
  return shell(html`<main class="screen"><div class="pad stack">
    <div class="row spread"><div><p class="muted">Hi ${c.name.split(' ')[0]}</p><h1>${requests().length ? plural(requests().length, 'new request') : next ? 'Your next booking' : 'No bookings yet'}</h1></div><div class="avatar">${initials(c.name)}</div></div>
    ${requests().map(requestCard)}
    ${next ? html`<a class="card indigo mini-booking" href="#/booking/${next.id}">${photo(next.image, '')}<div class="grow"><p class="small muted">${R.LABELS.booking[next.status]}</p><p class="strong">${next.mealName}</p><p class="small">${dateShort(next.scheduledAt)} at ${time(next.scheduledAt)}, ${next.address.suburb}</p></div></a>` : ''}
    ${!next && !requests().length ? html`<div class="empty"><h3>Nothing booked right now</h3><p>Foodie sends you a request when a booking suits your meals, area and days.</p></div>` : ''}
    <div class="grid-2">
      <div class="card"><p class="small muted">Rating</p><p class="price" style="font-size:26px">${c.ratingCount ? c.rating.toFixed(1) : 'New'}</p><p class="small muted">${plural(c.ratingCount, 'review')}</p></div>
      <div class="card"><p class="small muted">Next payout</p><p class="price" style="font-size:26px">${batch ? money(batch.amount) : 'R0'}</p><p class="small muted">${batch ? dateShort(batch.payoutDate) : `Paid every second Friday`}</p></div>
    </div>
    ${mine().length > 1 ? html`<div class="stack-s"><h3>Coming up</h3>${mine().slice(1).map(bookingRow)}</div>` : ''}
  </div></main>`);
}

function bookingsView(forceTab) {
  if (forceTab) bookingsTab = forceTab;
  const groups = { requests: requests(), upcoming: mine(), past: past() };
  const list = groups[bookingsTab];
  const empty = { requests: ['No open requests', 'New booking requests from Foodie show here.'], upcoming: ['No upcoming bookings', 'Accepted bookings show here.'], past: ['No past bookings yet', 'Completed and closed bookings show here.'] }[bookingsTab];
  return shell(html`${topbar('Bookings')}<main class="screen"><div class="pad stack">
    <div class="tabset" role="tablist">${Object.keys(groups).map((k) => html`<button type="button" role="tab" data-action="tab" data-tab="${k}" aria-selected="${String(bookingsTab === k)}">${k[0].toUpperCase() + k.slice(1)}${groups[k].length ? ` (${groups[k].length})` : ''}</button>`)}</div>
    ${list.length ? list.map((b) => (bookingsTab === 'requests' ? requestCard(b) : bookingRow(b))) : html`<div class="empty"><h3>${empty[0]}</h3><p>${empty[1]}</p></div>`}
  </div></main>`);
}

// ---------------------------------------------------------- booking detail

function ingredientSection(b) {
  const ing = b.ingredients;
  if (ing.status === 'not_listed') {
    const d = listDraft[b.id] || (listDraft[b.id] = { note: '', extras: [], extra: '' });
    let last = null;
    return html`<div class="card stack" id="ingredient-form">
      <div><h3>Confirm the ingredient list</h3><p class="small muted">The customer buys these. Check the list for ${plural(b.servings, 'person', 'people')}, add anything missing, then confirm.</p></div>
      <div>${b.ingredients.items.map((item) => { const head = item.group !== last ? html`<p class="ing-group">${item.group}</p>` : ''; last = item.group; return html`${head}<p class="small">${item.name}${item.essential ? html` <span class="chip plain">Essential</span>` : ''}</p>`; })}
        ${d.extras.length ? html`<p class="ing-group">Added by you</p>${d.extras.map((x, i) => html`<p class="small row spread">${x}<button type="button" class="link" data-action="remove-extra" data-id="${b.id}" data-i="${i}">Remove</button></p>`)}` : ''}</div>
      <div class="row"><input class="input grow" id="extra-${b.id}" placeholder="Add an ingredient" value="${d.extra}" data-input="extra-input" data-id="${b.id}" maxlength="40" aria-label="Add an ingredient"><button type="button" class="btn small quiet" data-action="add-extra" data-id="${b.id}">Add</button></div>
      <label class="field"><span>Note for the customer (optional)</span><textarea class="input" id="note-${b.id}" data-input="note-input" data-id="${b.id}" maxlength="200" placeholder="For example: please defrost the beef before I arrive.">${d.note}</textarea></label>
      <button type="button" class="btn primary block" data-action="confirm-list" data-id="${b.id}">Confirm ingredient list</button>
    </div>`;
  }
  const need = ing.items.filter((i) => !i.have).length;
  return html`<details class="more" id="d-ing-${b.id}" ${ing.status === 'listed' ? 'open' : ''}><summary>Ingredients ${ing.status === 'customer_confirmed' ? '(customer confirmed)' : `(customer still needs ${need})`}</summary>
    ${ing.status === 'customer_confirmed' ? html`<p class="small muted">Confirmed by the customer on ${dateTime(ing.customerConfirmedAt)}.</p>` : html`<p class="small muted">You confirmed this list on ${dateTime(ing.chefConfirmedAt)}. Waiting for the customer.</p>`}
    <ul class="list">${ing.items.map((i) => html`<li><span>${i.name}</span><span class="small ${i.have ? '' : 'muted'}">${i.have ? 'Has it' : 'To get'}</span></li>`)}</ul>
    ${ing.chefNote ? html`<p class="small"><strong>Your note:</strong> ${ing.chefNote}</p>` : ''}
  </details>`;
}

function dayCard(b) {
  const now = store.now();
  const miss = b.ingredients.missing;
  if (b.status === 'confirmed') {
    if (b.ingredients.status === 'not_listed') return '';
    const from = R.enRouteAllowedFrom(b.scheduledAt);
    return html`<div class="card ${b.ingredients.status === 'customer_confirmed' ? 'leaf' : 'mielie'}"><p class="strong">${b.ingredients.status === 'customer_confirmed' ? 'Ready to go' : 'Customer has not confirmed ingredients yet'}</p>
      <p class="small">Arrive by ${time(b.scheduledAt)} on ${dateLong(b.scheduledAt)}. ${now < from ? `You can mark En Route from ${time(from)} that day.` : 'Mark En Route when you leave.'} Arriving more than ${R.POLICY.lateThresholdMin} minutes late changes your share to ${R.POLICY.lateChefPct}%.</p></div>`;
  }
  if (b.status === 'en_route') return html`<div class="card indigo"><p class="strong">You are on your way</p><p class="small muted">Left at ${time(b.times.enRouteAt)}. Tap "I have arrived" at the door: it records your official arrival time.</p></div>`;
  if (b.status === 'arrived') {
    if (miss && miss.status === 'waiting') {
      const deadline = R.missingIngredientDeadline(miss.flaggedAt);
      return html`<div class="card chilli stack-s"><p class="strong">Waiting for ${miss.item}</p><p class="small">The customer has ${R.POLICY.missingIngredientWaitMin} minutes from when you reported it.</p><p class="countdown" data-countdown="${deadline}">--:--</p>
        <button type="button" class="btn small block" data-action="resolve-missing" data-id="${b.id}">Ingredient is here, continue</button>
        <button type="button" class="btn small danger block" data-action="end-missing" data-id="${b.id}" ${now < deadline ? 'disabled' : ''}>Still missing: end booking</button>
        <p class="small">If you end the booking after the wait, it is not refundable and you are paid as normal.</p></div>`;
    }
    const noShowAt = R.noShowAllowedAt(b.times.arrivedAt);
    return html`<div class="card indigo stack-s"><p class="strong">Arrived at ${time(b.times.arrivedAt)}${b.late.isLate ? html` <span class="chip chilli">${b.late.minutesLate} min late</span>` : ''}</p>
      <p class="small muted">${b.times.customerArrivalConfirmedAt ? 'The customer confirmed you are there.' : 'Check the ingredients with the customer, then start cooking.'}</p></div>
      <div class="stack-s">
        <button type="button" class="btn small ghost block" data-action="open-missing" data-id="${b.id}">Report a missing ingredient</button>
        ${b.times.customerArrivalConfirmedAt ? '' : html`<button type="button" class="btn small ghost block" data-action="no-show" data-id="${b.id}" ${now < noShowAt ? 'disabled' : ''}>Customer is not here${now < noShowAt ? html` (in <span data-countdown="${noShowAt}">--:--</span>)` : ''}</button>
        <p class="small muted">Wait ${R.POLICY.noShowWaitMin} minutes and try to contact the customer before marking a no-show.</p>`}
      </div>`;
  }
  if (b.status === 'cooking') return html`<div class="card indigo"><p class="strong">Cooking since ${time(b.times.cookingAt)}</p><p class="small muted">Leave the kitchen as you found it, then complete the booking.</p></div>`;
  if (b.status === 'completed') return html`<div class="card leaf"><p class="strong">Completed at ${time(b.times.completedAt)}</p><p class="small">${b.review ? html`The customer rated this booking ${stars(b.review.overall)}${b.review.comment ? html`<br>"${b.review.comment}"` : ''}` : 'Waiting for the customer’s review.'}</p></div>`;
  if (b.status === 'customer_no_show') return html`<div class="card chilli"><p class="strong">Customer no-show</p><p class="small">You waited ${R.POLICY.noShowWaitMin} minutes. You are paid as normal.</p></div>`;
  if (b.status === 'ended_missing_ingredient') return html`<div class="card chilli"><p class="strong">Ended: ${miss.item} was missing</p><p class="small">You are paid as normal.</p></div>`;
  if (b.status === 'cancelled') return html`<div class="card chilli"><p class="strong">Cancelled ${b.cancellation.by === 'admin' ? 'by Foodie' : 'by the customer'}</p><p class="small">${dateTime(b.cancellation.at)}</p></div>`;
  return '';
}

const NEXT_LABEL = { en_route: 'I am on my way', arrived: 'I have arrived', cooking: 'Start cooking', completed: 'Complete booking' };

function bookingView(id) {
  const b = store.find.booking(id);
  if (!b) return shell(html`${topbar('Booking', '#/bookings')}<main class="screen"><div class="empty"><h3>That booking could not be found</h3></div></main>`);
  const offered = b.assignment.status === 'offered' && b.assignment.chefId === myId();
  const accepted = b.assignment.status === 'accepted' && b.assignment.chefId === myId();
  const earned = b.payout.chefId === myId();
  if (!offered && !accepted && !earned) {
    return shell(html`${topbar(b.ref, '#/bookings')}<main class="screen"><div class="empty" style="padding-top:64px"><h3>This booking is no longer assigned to you</h3><p>Foodie has given it to another chef, or it was cancelled.</p><p style="margin-top:12px"><a class="btn small" href="#/bookings">Back to bookings</a></p></div></main>`);
  }
  const customer = store.find.customer(b.customerId);
  const s = R.settle(b);
  const next = accepted ? R.nextStatus(b.status) : null;
  const blocked = next === 'en_route' && b.ingredients.status === 'not_listed';
  const waiting = b.ingredients.missing && b.ingredients.missing.status === 'waiting';
  let footer = '';
  if (offered) footer = html`<div class="row"><button type="button" class="btn grow" data-action="accept" data-id="${b.id}">Accept</button><button type="button" class="btn ghost grow" data-action="open-decline" data-id="${b.id}">Decline</button></div>`;
  else if (next && !blocked && !waiting) footer = html`<button type="button" class="btn primary block" id="advance" data-action="advance" data-id="${b.id}" data-to="${next}">${NEXT_LABEL[next]}</button>`;

  return shell(html`${topbar(b.ref, '#/bookings')}
    <main class="screen"><div class="pad stack">
      <div class="row top">${photo(b.image, '', 'thumb')}<div class="grow"><h2>${b.mealName}</h2><p class="small muted">${dateLong(b.scheduledAt)}, arrive ${time(b.scheduledAt)}</p><p class="small muted">${plural(b.servings, 'person', 'people')}</p></div></div>
      ${offered ? html`<div class="card mielie"><p class="strong">Foodie is offering you this booking</p><p class="small">Accept if you can cook this meal at this time and place. If you decline, Foodie allocates another chef.</p></div>` : ''}
      ${dayCard(b)}
      ${accepted ? ingredientSection(b) : ''}
      <div class="card"><h3 style="margin-bottom:10px">Where and who</h3><dl class="kv">
        <dt>Customer</dt><dd>${accepted || earned ? `${customer.firstName} ${customer.surname}` : customer.firstName}</dd>
        <dt>${accepted ? 'Address' : 'Area'}</dt><dd>${where(b, accepted)}</dd>
        ${accepted && b.address.directions ? html`<dt>Directions</dt><dd>${b.address.directions}</dd>` : ''}
        ${accepted ? html`<dt>Mobile</dt><dd>${customer.mobile.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')}</dd>` : ''}
      </dl>
      ${offered ? html`<p class="small muted" style="margin-top:8px">The exact address and contact number are shown once you accept.</p>` : ''}
      ${b.noteToChef ? html`<p class="small" style="margin-top:8px"><strong>Note from the customer:</strong> ${b.noteToChef}</p>` : ''}</div>
      <div class="card"><h3 style="margin-bottom:10px">Your earnings</h3><dl class="kv">
        <dt>Foodie service amount</dt><dd class="num">${money(s.serviceAmount)}</dd>
        ${b.status === 'cancelled' ? html`<dt>Kept after refund</dt><dd class="num">${money(s.retained)}</dd>` : ''}
        <dt>Your share</dt><dd>${s.chefPct}%</dd>
        ${s.lateAdjustment ? html`<dt>Late arrival adjustment</dt><dd class="num">${money(s.lateAdjustment)}</dd>` : ''}
        <div class="total" style="display:contents"><dt>${s.final ? 'You earn' : 'You will earn'}</dt><dd class="num" id="chef-earns">${money(s.chefAmount)}</dd></div>
      </dl>
      <p class="small muted" style="margin-top:8px">${b.payout.status === 'paid' ? `Paid out on ${dateShort(b.payout.payoutDate)}.` : b.payout.status === 'scheduled' ? `Payout scheduled for ${dateLong(b.payout.payoutDate)}.` : 'Recorded for payout when the booking is completed. Foodie pays every second Friday.'}</p></div>
      ${b.times.enRouteAt || b.times.arrivedAt ? html`<div><h3 style="margin-bottom:12px">Your record</h3><ol class="timeline">
        ${[['En route', b.times.enRouteAt], ['Arrived', b.times.arrivedAt], ['Cooking', b.times.cookingAt], ['Completed', b.times.completedAt]].map(([label, at]) => html`<li class="${at ? 'done' : ''}"><div class="t-title">${label}</div><div class="t-meta">${at ? dateTime(at) : ''}</div></li>`)}</ol></div>` : ''}
      ${accepted && ['confirmed', 'en_route'].includes(b.status) ? html`<button type="button" class="btn danger small block" data-action="open-cancel" data-id="${b.id}">I can no longer do this booking</button>` : ''}
    </div></main>`, { tabs: false, footer });
}

function sheetView() {
  if (!sheet) return '';
  const b = store.find.booking(sheet.bookingId);
  if (!b) return '';
  if (sheet.type === 'decline') {
    return html`<div class="sheet-back" data-action="close-sheet-back"><div class="sheet stack" role="dialog" aria-label="Decline booking"><h2>Decline ${b.ref}?</h2><p class="small muted">Foodie will allocate another chef.</p>
      <label class="field"><span>Reason (optional)</span><input class="input" id="sheet-text" value="${sheet.text}" data-input="sheet-text" maxlength="120" placeholder="For example: already booked that evening"></label>
      <button type="button" class="btn danger solid block" data-action="do-decline">Decline booking</button><button type="button" class="btn quiet block" data-action="close-sheet">Keep the request</button></div></div>`;
  }
  if (sheet.type === 'cancel') {
    return html`<div class="sheet-back" data-action="close-sheet-back"><div class="sheet stack" role="dialog" aria-label="Cancel booking"><h2>Hand back ${b.ref}?</h2>
      <div class="card chilli small">Cancelling after you have accepted is recorded on your profile and can affect your standing with Foodie. Foodie will look for a replacement chef.</div>
      <label class="field"><span>Reason</span><input class="input" id="sheet-text" value="${sheet.text}" data-input="sheet-text" maxlength="120"></label>
      <button type="button" class="btn danger solid block" data-action="do-cancel">Cancel my booking</button><button type="button" class="btn quiet block" data-action="close-sheet">Keep the booking</button></div></div>`;
  }
  if (sheet.type === 'missing') {
    return html`<div class="sheet-back" data-action="close-sheet-back"><div class="sheet stack" role="dialog" aria-label="Missing ingredient"><h2>Which ingredient is missing?</h2>
      <label class="field"><span>Ingredient</span><select class="input" id="sheet-text" data-change="sheet-text"><option value="">Choose…</option>${b.ingredients.items.map((i) => html`<option value="${i.name}" ${sheet.text === i.name ? 'selected' : ''}>${i.name}${i.essential ? ' (essential)' : ''}</option>`)}</select></label>
      <div class="stack-s">
        <button type="button" class="btn block" data-action="do-missing" data-essential="0">I can still cook the meal</button>
        <button type="button" class="btn danger block" data-action="do-missing" data-essential="1">I cannot cook without it</button>
      </div>
      <p class="small muted">If you cannot cook without it, the customer gets ${R.POLICY.missingIngredientWaitMin} minutes to fetch it.</p>
      <button type="button" class="btn quiet block" data-action="close-sheet">Close</button></div></div>`;
  }
  return '';
}

// ------------------------------------------------------ earnings, profile

function earningsView() {
  const batches = myBatches();
  const scheduled = batches.filter((p) => p.status === 'scheduled').sort((a, b) => a.payoutDate - b.payoutDate);
  const paid = batches.filter((p) => p.status === 'paid');
  const due = scheduled.reduce((sum, p) => sum + p.amount, 0);
  const total = paid.reduce((sum, p) => sum + p.amount, 0);
  const line = (id) => {
    const b = store.find.booking(id);
    const s = R.settle(b);
    return html`<li><a href="#/booking/${b.id}" style="text-decoration:none; color:inherit" class="grow"><span class="strong">${b.mealName}</span><br><span class="small muted">${dayMonth(b.scheduledAt)}, ${b.ref}, ${s.rule === 'late' ? 'late arrival 70%' : s.rule === 'cancelled' ? 'cancelled by customer' : `${s.chefPct}%`}</span></a><span class="num strong">${money(s.chefAmount)}</span></li>`;
  };
  return shell(html`${topbar('Earnings')}<main class="screen"><div class="pad stack">
    <div class="card indigo"><p class="small muted">Waiting to be paid</p><p class="wordmark" style="font-size:44px" id="earnings-due">${money(due)}</p><p class="small muted">Foodie pays every second Friday for completed bookings. Next payout day: ${dateLong(R.nextPayoutDate(store.now()))}.</p></div>
    ${scheduled.length ? scheduled.map((p) => html`<div class="card"><div class="row spread"><h3>Payout on ${dateShort(p.payoutDate)}</h3>${chip('payout', 'scheduled')}</div><ul class="list" style="margin-top:6px">${p.bookingIds.map(line)}</ul><dl class="kv"><div class="total" style="display:contents"><dt>Amount payable</dt><dd class="num">${money(p.amount)}</dd></div></dl></div>`)
      : html`<div class="empty"><h3>Nothing waiting for payout</h3><p>Completed bookings show here until the next payout Friday.</p></div>`}
    <div><h2 style="margin-bottom:8px">Payout history</h2>
      ${paid.length ? html`<p class="small muted">${money(total)} paid in ${plural(paid.length, 'payout')}.</p>${paid.map((p) => html`<details class="more" id="p-${p.id}"><summary><span>${dateShort(p.payoutDate)} <span class="small muted">${p.reference}</span></span><span class="num" style="margin-left:auto; padding-right:12px">${money(p.amount)}</span></summary><ul class="list">${p.bookingIds.map(line)}</ul></details>`)}`
        : html`<p class="muted small">No payouts yet.</p>`}</div>
    <p class="demo-note">Simulated payouts. No real money is paid in this demonstration.</p>
  </div></main>`);
}

function profileView() {
  const c = me();
  const cats = S().categories.filter((x) => c.categories.includes(x.id)).map((x) => x.name);
  const reviews = S().bookings.filter((b) => b.review && b.payout.chefId === c.id).sort((a, b) => b.review.at - a.review.at).slice(0, 5);
  const alerts = S().notifications.filter((n) => n.to === `chef:${c.id}`).slice(0, 6);
  return shell(html`${topbar('Profile')}<main class="screen"><div class="pad stack">
    <div class="row"><div class="avatar big">${initials(c.name)}</div><div><h2>${c.name}</h2><p>${chip('chef', c.status, c.status === 'approved' ? 'Approved Foodie chef' : null)}</p><p class="small muted">${c.ratingCount ? html`${stars(c.rating)} ${c.rating.toFixed(1)} from ${plural(c.ratingCount, 'review')}` : 'No reviews yet'}</p></div></div>
    <p>${c.bio}</p>
    <div class="card"><h3 style="margin-bottom:10px">Qualifications</h3><dl class="kv">
      <dt>Qualification</dt><dd>${c.qualification}</dd><dt>NQF level</dt><dd>${c.nqfLevel}</dd><dt>Experience</dt><dd>${plural(c.years, 'year')}</dd>
      <dt>Bookings completed</dt><dd>${c.stats.completed}</dd><dt>Cancelled after accepting</dt><dd>${c.stats.cancellations}</dd><dt>Late arrivals</dt><dd>${c.stats.lateArrivals}</dd></dl>
      <p class="demo-note" style="margin-top:8px">No certificates or identity documents are stored in this demonstration.</p></div>
    <div><h3 style="margin-bottom:8px">Meals I cook</h3><p class="row wrap" style="gap:6px">${cats.map((n) => html`<span class="chip indigo plain">${n}</span>`)}</p></div>
    <div><h3 style="margin-bottom:8px">Areas I cover</h3><p class="row wrap" style="gap:6px">${c.areas.map((n) => html`<span class="chip plain">${n}</span>`)}</p></div>
    <div><h3 style="margin-bottom:8px">Days I am available</h3><div class="tabset" role="group" aria-label="Available days">${DAYS.map((d, i) => html`<button type="button" data-action="toggle-day" data-day="${i}" aria-selected="${String(c.availability.includes(i))}" aria-pressed="${String(c.availability.includes(i))}">${d}</button>`)}</div></div>
    <div><h3 style="margin-bottom:8px">Recent reviews</h3>${reviews.length ? reviews.map((b) => html`<div class="card" style="margin-top:8px"><div class="row spread">${stars(b.review.overall)}<span class="tiny muted">${dayMonth(b.review.at)}</span></div><p class="small">${b.review.comment || 'No comment left.'}</p><p class="tiny muted">${b.mealName}</p></div>`) : html`<p class="muted small">No reviews yet.</p>`}</div>
    <div id="alerts"><h3 style="margin-bottom:8px">Recent alerts</h3>${alerts.length ? alerts.map((n) => html`<a class="card ${n.read ? '' : 'mielie'}" style="display:block; margin-top:8px; text-decoration:none; color:inherit" href="${n.bookingId ? `#/booking/${n.bookingId}` : '#/profile'}"><div class="row spread top"><p class="strong small">${n.title}</p><span class="tiny muted" style="white-space:nowrap">${dateTime(n.at)}</span></div><p class="small">${n.body}</p></a>`) : html`<p class="muted small">No alerts yet.</p>`}</div>
    ${switcher()}
  </div></main>`);
}

// ------------------------------------------------------------------ wiring

function view(route) {
  const [name = '', arg] = route.parts;
  const blocked = gate();
  if (blocked) return blocked;
  switch (name) {
    case 'requests': return bookingsView('requests');
    case 'bookings': return bookingsView();
    case 'booking': return bookingView(arg);
    case 'earnings': return earningsView();
    case 'profile': return profileView();
    default: return homeView();
  }
}

const rerender = () => app.render();

const actions = {
  ...demoActions(rerender, () => { sheet = null; listDraft = {}; go('#/home'); }),
  tab: (el) => { bookingsTab = el.dataset.tab; if (window.location.hash !== '#/bookings') go('#/bookings'); else rerender(); },
  'switch-chef': (el) => { store.switchChef(el.value); go('#/home'); },
  accept: (el) => { if (act(store.chefRespond(el.dataset.id, myId(), true), 'Booking accepted').ok) go(`#/booking/${el.dataset.id}`); },
  'open-decline': (el) => { sheet = { type: 'decline', bookingId: el.dataset.id, text: '' }; rerender(); },
  'open-cancel': (el) => { sheet = { type: 'cancel', bookingId: el.dataset.id, text: '' }; rerender(); },
  'open-missing': (el) => { sheet = { type: 'missing', bookingId: el.dataset.id, text: '' }; rerender(); },
  'sheet-text': (el) => { if (sheet) sheet.text = el.value; },
  'close-sheet': () => { sheet = null; rerender(); },
  'close-sheet-back': (el, e) => { if (e.target === el) { sheet = null; rerender(); } },
  'do-decline': () => { const { bookingId, text } = sheet; sheet = null; if (act(store.chefRespond(bookingId, myId(), false, text), 'Booking declined').ok) go('#/bookings'); else rerender(); },
  'do-cancel': () => {
    if (!sheet.text.trim()) { toast('Give a reason so Foodie can tell the customer.', 'bad'); return; }
    const { bookingId, text } = sheet; sheet = null;
    if (act(store.chefCancel(bookingId, myId(), text), 'Booking handed back to Foodie').ok) go('#/bookings'); else rerender();
  },
  'do-missing': (el) => {
    const { bookingId, text } = sheet;
    const r = act(store.chefFlagMissing(bookingId, myId(), text, el.dataset.essential === '1'));
    if (r.ok) { sheet = null; rerender(); }
  },
  'resolve-missing': (el) => { act(store.chefResolveMissing(el.dataset.id, myId()), 'Good. You can start cooking.'); },
  'end-missing': (el) => { act(store.chefEndMissing(el.dataset.id, myId()), 'Booking ended'); },
  'no-show': (el) => { act(store.chefMarkNoShow(el.dataset.id, myId()), 'Marked as customer no-show'); },
  'extra-input': (el) => { listDraft[el.dataset.id].extra = el.value; },
  'note-input': (el) => { listDraft[el.dataset.id].note = el.value; },
  'add-extra': (el) => { const d = listDraft[el.dataset.id]; const v = d.extra.trim(); if (v) { d.extras.push(v); d.extra = ''; rerender(); } },
  'remove-extra': (el) => { listDraft[el.dataset.id].extras.splice(Number(el.dataset.i), 1); rerender(); },
  'confirm-list': (el) => { const d = listDraft[el.dataset.id] || {}; if (act(store.chefConfirmIngredients(el.dataset.id, myId(), { note: d.note, extras: d.extras }), 'Ingredient list sent to the customer').ok) delete listDraft[el.dataset.id]; },
  advance: (el) => { act(store.chefAdvance(el.dataset.id, myId(), el.dataset.to)); },
  'toggle-day': (el) => { const day = Number(el.dataset.day); const days = me().availability; act(store.setChefAvailability(myId(), days.includes(day) ? days.filter((d) => d !== day) : [...days, day])); },
};

setDemoFocus(() => {
  const id = window.location.hash.match(/^#\/booking\/(\w+)/);
  return (id && store.find.booking(id[1])) || mine()[0] || requests()[0] || null;
});

const app = mount({
  root: document.getElementById('app'),
  view,
  actions,
  onRender: (route) => { if (route.parts[0] === 'profile' && unread()) setTimeout(() => store.markNotificationsRead(`chef:${myId()}`), 1500); },
});
