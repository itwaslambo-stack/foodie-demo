// Shared demo state for the customer app, chef app and admin dashboard.
// One JSON document in localStorage; every interface reads and writes it
// through the actions below, so all three always show the same booking.
// Every figure comes from rules.js. Nothing here talks to a network.

import * as R from './rules.js';
import { baseState, seedHistory } from './seed.js';

export const STORAGE_KEY = 'dishit.demo.state.v1';
export const DEMO_VERIFY_CODE = '246810';

const ok = (extra = {}) => ({ ok: true, ...extra });
const fail = (error, extra = {}) => ({ ok: false, error, ...extra });

export function createStore({ storage, realNow = () => Date.now() } = {}) {
  let state = null;
  let batching = false;
  const listeners = new Set();

  // ------------------------------------------------------------ plumbing

  function load() {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && parsed.version === 1 ? parsed : null;
    } catch {
      return null;
    }
  }

  function save() {
    if (batching) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('Dishit demo: could not save state', err);
    }
  }

  function emit() {
    if (batching) return;
    for (const fn of [...listeners]) fn(state);
  }

  /** Re-read storage before every action so two open tabs never overwrite each other. */
  function fresh() {
    if (batching) return;
    const stored = load();
    if (stored) state = stored;
  }

  function commit(result) {
    state.rev += 1;
    save();
    emit();
    return result;
  }

  function now() {
    return realNow() + state.clockOffsetMs;
  }

  const api = {};

  // ------------------------------------------------------------- lookups

  const customer = (id) => state.customers.find((c) => c.id === id);
  const chef = (id) => state.chefs.find((c) => c.id === id);
  const meal = (id) => state.meals.find((m) => m.id === id);
  const category = (id) => state.categories.find((c) => c.id === id);
  const booking = (id) => state.bookings.find((b) => b.id === id);

  function event(b, actor, type, text) {
    b.events.push({ at: now(), actor, type, text });
  }

  function notify(to, title, body, bookingId = null) {
    state.seq.notification += 1;
    state.notifications.unshift({ id: `n${state.seq.notification}`, to, at: now(), title, body, bookingId, read: false });
  }

  function incident(bookingId, type, severity, summary) {
    state.seq.incident += 1;
    const record = { id: `i${state.seq.incident}`, bookingId, type, severity, summary, status: 'open', createdAt: now(), notes: [] };
    state.incidents.unshift(record);
    return record;
  }

  function refund(b, amount, { pct = null, rule, reason, by }) {
    if (amount <= 0) return null;
    state.seq.refund += 1;
    const record = { id: `r${state.seq.refund}`, amount, pct, rule, reason, by, status: 'pending', createdAt: now(), processedAt: null };
    b.payment.refunds.push(record);
    const refunded = b.payment.refunds.reduce((s, r) => s + r.amount, 0);
    b.payment.status = R.paymentStatusFor(b.pricing.total, refunded);
    return record;
  }

  /** Record what the chef is owed once a booking is closed (BRIEF §25, §36). */
  function scheduleEarnings(b, chefId) {
    const s = R.settle(b);
    if (chefId && s.chefAmount > 0) {
      b.payout = { status: R.PAYOUT.SCHEDULED, chefId, payoutDate: R.payoutDateFor(now()) };
    } else {
      b.payout = { status: R.PAYOUT.NONE, chefId: null, payoutDate: null };
    }
  }

  function resetIngredients(b) {
    b.ingredients.status = R.INGREDIENTS.NOT_LISTED;
    b.ingredients.chefConfirmedAt = null;
    b.ingredients.customerConfirmedAt = null;
    b.ingredients.chefNote = '';
  }

  function restoreDiscountIfFullyRefunded(b) {
    // ASSUMPTION M4: a late-chef discount comes back only on a 100% refund.
    if (b.pricing.discount > 0 && b.payment.status === R.PAYMENT.REFUNDED) {
      const c = customer(b.customerId);
      if (c && !c.discount) {
        c.discount = { pct: b.pricing.discountPct, fromBookingId: b.pricing.discountFromBookingId, grantedAt: now(), restoredFrom: b.id };
      }
    }
  }

  function guardBooking(id) {
    const b = booking(id);
    return b ? { b } : { error: fail('That booking could not be found.') };
  }

  // --------------------------------------------------------------- clock

  api.now = () => now();

  api.advanceClock = (ms) => {
    fresh();
    if (!(ms > 0)) return fail('The demo clock only moves forward.');
    state.clockOffsetMs += ms;
    runTick();
    return commit(ok());
  };

  api.setClock = (targetMs) => {
    fresh();
    if (!(targetMs > now())) return fail('The demo clock only moves forward. Reset the demo to go back.');
    state.clockOffsetMs = targetMs - realNow();
    runTick();
    return commit(ok());
  };

  /** Time-driven work: the two-hour ingredient reminder (BRIEF §18). */
  function runTick() {
    let changed = false;
    const t = now();
    for (const b of state.bookings) {
      if (b.status !== R.BOOKING.CONFIRMED && b.status !== R.BOOKING.AWAITING_CHEF) continue;
      if (b.ingredients.reminderSentAt || t < R.reminderDueAt(b.scheduledAt)) continue;
      b.ingredients.reminderSentAt = t;
      const confirmed = b.ingredients.status === R.INGREDIENTS.CONFIRMED;
      notify(
        `customer:${b.customerId}`,
        'Your Dishit booking is coming up',
        confirmed
          ? 'Your chef arrives in about two hours. Your ingredients are confirmed.'
          : 'Please confirm that you have all the required ingredients ready for your chef.',
        b.id,
      );
      event(b, 'system', 'reminder', confirmed ? 'Two-hour reminder sent. Ingredients already confirmed.' : 'Two-hour ingredient reminder sent to customer.');
      changed = true;
    }
    return changed;
  }

  api.tick = () => {
    fresh();
    return runTick() ? commit(ok({ changed: true })) : ok({ changed: false });
  };

  // ------------------------------------------------------------- session

  api.registerCustomer = (input) => {
    fresh();
    const data = {
      firstName: String(input.firstName || '').trim(),
      surname: String(input.surname || '').trim(),
      email: String(input.email || '').trim().toLowerCase(),
      mobile: String(input.mobile || '').replace(/\s+/g, ''),
    };
    const errors = {};
    if (!data.firstName) errors.firstName = 'Enter your first name.';
    if (!data.surname) errors.surname = 'Enter your surname.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) errors.email = 'Enter a valid email address.';
    else if (state.customers.some((c) => c.email === data.email)) errors.email = 'An account with this email already exists. Log in instead.';
    if (!/^(\+27|0)\d{9}$/.test(data.mobile)) errors.mobile = 'Enter a South African mobile number, for example 060 555 0199.';
    if (String(input.password || '').length < 8) errors.password = 'Use at least 8 characters.';
    if (!input.acceptTerms) errors.acceptTerms = 'Accept the Terms & Conditions to continue.';
    if (!input.acceptPrivacy) errors.acceptPrivacy = 'Accept the Privacy Policy to continue.';
    if (Object.keys(errors).length) return fail('Check the highlighted fields.', { errors });

    state.seq.customer += 1;
    const t = now();
    // The password is checked for length and then discarded: the demo stores no passwords.
    const record = {
      id: `u${state.seq.customer}`, ...data, emailVerified: false, status: 'active', createdAt: t,
      acceptedTermsAt: t, acceptedPrivacyAt: t, discount: null, savedAddress: null, demo: false,
    };
    state.customers.push(record);
    state.session.pendingVerificationId = record.id;
    return commit(ok({ customerId: record.id }));
  };

  api.verifyEmail = (code) => {
    fresh();
    const c = customer(state.session.pendingVerificationId);
    if (!c) return fail('There is no account waiting for verification.');
    if (String(code).trim() !== DEMO_VERIFY_CODE) return fail('That code is not right. Use the demonstration code shown above.');
    c.emailVerified = true;
    state.session.pendingVerificationId = null;
    state.session.customerId = c.id;
    notify(`customer:${c.id}`, 'Welcome to Dishit', 'Your email is verified. You choose the food, we bring the chef.');
    return commit(ok({ customerId: c.id }));
  };

  api.loginCustomer = (email, password) => {
    fresh();
    const c = state.customers.find((x) => x.email === String(email || '').trim().toLowerCase());
    if (!c || String(password || '').length < 8) return fail('That email and password do not match a Dishit account.');
    if (c.status !== 'active') return fail('This account is suspended. Contact Dishit support.');
    if (!c.emailVerified) {
      state.session.pendingVerificationId = c.id;
      return commit(fail('Verify your email address first.', { needsVerification: true }));
    }
    state.session.customerId = c.id;
    return commit(ok({ customerId: c.id }));
  };

  api.logoutCustomer = () => {
    fresh();
    state.session.customerId = null;
    return commit(ok());
  };

  api.switchChef = (chefId) => {
    fresh();
    if (!chef(chefId)) return fail('That chef could not be found.');
    state.session.chefId = chefId;
    return commit(ok());
  };

  // ----------------------------------------------------- customer booking

  api.validateAddress = (address = {}) => {
    const errors = {};
    if (!String(address.line1 || '').trim()) errors.line1 = 'Enter the street address.';
    if (!String(address.suburb || '').trim()) errors.suburb = 'Enter the suburb.';
    if (!String(address.city || '').trim()) errors.city = 'Enter the city.';
    if (!/^\d{4}$/.test(String(address.postalCode || '').trim())) errors.postalCode = 'Enter the 4-digit postal code.';
    return errors;
  };

  api.quoteFor = (customerId, mealId, servings) => {
    const m = meal(mealId);
    const c = customer(customerId);
    return R.quote(m, servings, c && c.discount ? c.discount.pct : 0);
  };

  api.createBooking = (input) => {
    fresh();
    const c = customer(input.customerId);
    if (!c) return fail('Log in to make a booking.');
    if (c.status !== 'active') return fail('This account is suspended. Contact Dishit support.');
    if (!c.emailVerified) return fail('Verify your email address before booking.');
    const m = meal(input.mealId);
    if (!m || !m.active || !category(m.categoryId) || !category(m.categoryId).active) return fail('This meal is not available right now.');

    let q;
    try {
      q = R.quote(m, input.servings, c.discount ? c.discount.pct : 0);
    } catch (err) {
      return fail(err.message, { field: 'servings' });
    }
    const schedule = R.validateSchedule(input.date, input.time, now());
    if (!schedule.ok) return fail(schedule.error, { field: 'schedule' });
    const addressErrors = api.validateAddress(input.address);
    if (Object.keys(addressErrors).length) return fail('Complete the address.', { field: 'address', errors: addressErrors });

    if (input.payment === 'decline') {
      return fail('The simulated payment was declined, so nothing was booked. Try again.', { code: 'payment_declined' });
    }

    const t = now();
    state.seq.booking += 1;
    state.seq.payment += 1;
    const n = state.seq.booking;
    const address = {
      line1: String(input.address.line1).trim(),
      suburb: String(input.address.suburb).trim(),
      city: String(input.address.city).trim(),
      postalCode: String(input.address.postalCode).trim(),
      directions: String(input.address.directions || '').trim(),
    };
    const b = {
      id: `b${n}`,
      ref: `DS-${String(20417 + n * 263).padStart(5, '0')}`,
      customerId: c.id,
      mealId: m.id,
      mealName: m.name,
      categoryId: m.categoryId,
      image: m.image,
      servings: q.servings,
      scheduledAt: schedule.scheduledAt,
      createdAt: t,
      address,
      noteToChef: String(input.noteToChef || '').trim(),
      pricing: { serviceAmount: q.serviceAmount, discountPct: q.discountPct, discount: q.discount, total: q.total, discountFromBookingId: c.discount ? c.discount.fromBookingId : null },
      status: R.BOOKING.AWAITING_CHEF,
      assignment: { status: R.ASSIGNMENT.UNASSIGNED, chefId: null, offeredAt: null, respondedAt: null, history: [] },
      ingredients: {
        status: R.INGREDIENTS.NOT_LISTED,
        items: m.ingredients.flatMap((g) => g.items.map((i) => ({ group: g.group, name: i.name, essential: i.essential, have: false }))),
        chefNote: '', chefConfirmedAt: null, customerConfirmedAt: null, reminderSentAt: null, missing: null,
      },
      payment: { status: R.PAYMENT.PAID, method: 'Simulated card', reference: `SIM-${String(900100 + state.seq.payment * 17)}`, paidAt: t, amount: q.total, refunds: [] },
      payout: { status: R.PAYOUT.NONE, chefId: null, payoutDate: null },
      times: { enRouteAt: null, arrivedAt: null, cookingAt: null, completedAt: null, closedAt: null, customerArrivalConfirmedAt: null },
      late: { minutesLate: 0, isLate: false },
      cancellation: null,
      review: null,
      events: [],
    };
    if (c.discount) {
      c.discount = null; // BRIEF §30: applied automatically to the next order.
    }
    c.savedAddress = address;
    state.bookings.unshift(b);
    event(b, 'customer', 'booked', `${c.firstName} booked ${m.name} for ${q.servings} people.`);
    event(b, 'system', 'payment', `Simulated payment of ${R.money(q.total)} approved (${b.payment.reference}).${q.discount ? ` Late-chef discount of ${R.money(q.discount)} applied automatically.` : ''}`);
    notify(`customer:${c.id}`, 'Your Dishit booking has been received!', `${m.name} for ${q.servings}. Reference ${b.ref}. We are finding your chef.`, b.id);
    notify('admin', 'New booking to allocate', `${b.ref}: ${m.name} for ${q.servings} in ${address.suburb}.`, b.id);
    return commit(ok({ bookingId: b.id, ref: b.ref }));
  };

  api.setIngredientHave = (bookingId, index, have) => {
    fresh();
    const { b, error } = guardBooking(bookingId);
    if (error) return error;
    if (b.ingredients.status === R.INGREDIENTS.NOT_LISTED) return fail('Your chef has not confirmed the ingredient list yet.');
    if (b.ingredients.status === R.INGREDIENTS.CONFIRMED) return fail('You have already confirmed your ingredients.');
    if (!b.ingredients.items[index]) return fail('That ingredient is not on the list.');
    b.ingredients.items[index].have = Boolean(have);
    return commit(ok());
  };

  api.customerConfirmIngredients = (bookingId) => {
    fresh();
    const { b, error } = guardBooking(bookingId);
    if (error) return error;
    if (!R.isOpen(b.status)) return fail('This booking is closed.');
    if (b.ingredients.status === R.INGREDIENTS.NOT_LISTED) return fail('Your chef has not confirmed the ingredient list yet.');
    if (b.ingredients.status === R.INGREDIENTS.CONFIRMED) return fail('You have already confirmed your ingredients.');
    const missing = b.ingredients.items.filter((i) => !i.have).length;
    if (missing) return fail(`Tick every ingredient first. ${missing} still to get.`);
    b.ingredients.status = R.INGREDIENTS.CONFIRMED;
    b.ingredients.customerConfirmedAt = now();
    event(b, 'customer', 'ingredients_confirmed', 'Customer confirmed they have all the required ingredients.');
    if (b.assignment.chefId) notify(`chef:${b.assignment.chefId}`, 'Ingredients confirmed', `${b.ref}: the customer has everything on your list.`, b.id);
    return commit(ok());
  };

  api.customerConfirmArrival = (bookingId) => {
    fresh();
    const { b, error } = guardBooking(bookingId);
    if (error) return error;
    if (![R.BOOKING.ARRIVED, R.BOOKING.COOKING].includes(b.status)) return fail('Your chef has not marked themselves as arrived yet.');
    if (b.times.customerArrivalConfirmedAt) return fail('You have already confirmed this.');
    b.times.customerArrivalConfirmedAt = now();
    // BRIEF §21: recorded, but never used for lateness or cancellation timing.
    event(b, 'customer', 'arrival_confirmed', 'Customer confirmed the chef has arrived (for the record only).');
    return commit(ok());
  };

  api.customerCancel = (bookingId, reason = '') => {
    fresh();
    const { b, error } = guardBooking(bookingId);
    if (error) return error;
    const q = R.cancellationQuote(b, now());
    if (!q.allowed) return fail(q.reason);
    const chefId = b.assignment.chefId;
    const chefHadAccepted = b.assignment.status === R.ASSIGNMENT.ACCEPTED;
    b.cancellation = { by: 'customer', at: now(), rule: q.rule, refundPct: q.refundPct, reason: String(reason).trim(), chefHadAccepted };
    b.status = R.BOOKING.CANCELLED;
    b.times.closedAt = now();
    refund(b, q.refund, { pct: q.refundPct, rule: q.rule, reason: `Customer cancelled: ${q.label.toLowerCase()}`, by: 'system' });
    if (chefId) {
      b.assignment.history.push({ chefId, at: now(), outcome: 'booking_cancelled' });
      notify(`chef:${chefId}`, 'Booking cancelled', `${b.ref} was cancelled by the customer.`, b.id);
    }
    scheduleEarnings(b, chefHadAccepted ? chefId : null);
    restoreDiscountIfFullyRefunded(b);
    event(b, 'customer', 'cancelled', `Customer cancelled. Rule: ${q.label.toLowerCase()}. Refund ${q.refundPct}% = ${R.money(q.refund)}.`);
    notify(`customer:${b.customerId}`, 'Booking cancelled', `${b.ref}: ${q.refundPct}% refund of ${R.money(q.refund)}.`, b.id);
    notify('admin', 'Customer cancelled a booking', `${b.ref}: ${q.refundPct}% refund to process.`, b.id);
    if (q.rule !== 'more_than_24h') incident(b.id, 'customer_cancelled', 'low', `Customer cancelled ${b.ref} (${q.label.toLowerCase()}). ${q.refundPct}% refunded.`);
    return commit(ok({ refund: q.refund, refundPct: q.refundPct }));
  };

  api.submitReview = (bookingId, input) => {
    fresh();
    const { b, error } = guardBooking(bookingId);
    if (error) return error;
    if (b.status !== R.BOOKING.COMPLETED) return fail('You can review a booking once it is completed.');
    if (b.review) return fail('You have already reviewed this booking.');
    const stars = (v) => (Number.isInteger(Number(v)) && v >= 1 && v <= 5 ? Number(v) : null);
    const overall = stars(input.overall);
    if (!overall) return fail('Choose an overall rating from 1 to 5 stars.');
    b.review = {
      overall,
      food: stars(input.food), professionalism: stars(input.professionalism), punctuality: stars(input.punctuality), cleanliness: stars(input.cleanliness),
      comment: String(input.comment || '').trim().slice(0, 600),
      at: now(),
    };
    const ch = chef(b.payout.chefId || b.assignment.chefId);
    if (ch) {
      ch.rating = Math.round(((ch.rating * ch.ratingCount + overall) / (ch.ratingCount + 1)) * 100) / 100;
      ch.ratingCount += 1;
      notify(`chef:${ch.id}`, 'New review', `${b.ref}: ${overall} out of 5 stars.`, b.id);
    }
    event(b, 'customer', 'reviewed', `Customer left a ${overall}-star review.`);
    notify('admin', 'New review', `${b.ref}: ${overall} out of 5 stars.`, b.id);
    if (overall <= 2) incident(b.id, 'complaint', 'medium', `Low review (${overall}/5) on ${b.ref}${b.review.comment ? `: "${b.review.comment}"` : '.'}`);
    return commit(ok());
  };

  // ---------------------------------------------------------- allocation

  api.allocateChef = (bookingId, chefId) => {
    fresh();
    const { b, error } = guardBooking(bookingId);
    if (error) return error;
    if (![R.BOOKING.AWAITING_CHEF, R.BOOKING.CONFIRMED].includes(b.status)) return fail('A chef can only be changed before they start travelling.');
    const ch = chef(chefId);
    if (!ch) return fail('That chef could not be found.');
    if (ch.status !== 'approved') return fail(`${ch.name} is not an approved, active chef.`);
    const current = b.assignment.chefId;
    const hadChef = current && [R.ASSIGNMENT.OFFERED, R.ASSIGNMENT.ACCEPTED].includes(b.assignment.status);
    if (hadChef && current === chefId) return fail(`${ch.name} already has this booking.`);
    if (hadChef) {
      b.assignment.history.push({ chefId: current, at: now(), outcome: 'withdrawn' });
      notify(`chef:${current}`, 'Booking reassigned', `${b.ref} has been given to another chef by Dishit.`, b.id);
      resetIngredients(b);
    }
    const wasConfirmed = b.status === R.BOOKING.CONFIRMED;
    b.assignment.status = R.ASSIGNMENT.OFFERED;
    b.assignment.chefId = chefId;
    b.assignment.offeredAt = now();
    b.assignment.respondedAt = null;
    b.assignment.history.push({ chefId, at: now(), outcome: 'offered' });
    b.status = R.BOOKING.AWAITING_CHEF;
    event(b, 'admin', hadChef ? 'reallocated' : 'allocated', `Admin ${hadChef ? 'reallocated the booking to' : 'allocated'} ${ch.name}. Waiting for the chef to respond.`);
    notify(`chef:${chefId}`, 'New booking request', `${b.mealName} for ${b.servings} in ${b.address.suburb}. Accept or decline.`, b.id);
    if (wasConfirmed) notify(`customer:${b.customerId}`, 'Your chef is changing', `${b.ref}: Dishit is confirming a new chef for you.`, b.id);
    return commit(ok());
  };

  api.chefRespond = (bookingId, chefId, accept, reason = '') => {
    fresh();
    const { b, error } = guardBooking(bookingId);
    if (error) return error;
    if (b.assignment.status !== R.ASSIGNMENT.OFFERED || b.assignment.chefId !== chefId) return fail('This request is no longer open for you.');
    const ch = chef(chefId);
    b.assignment.respondedAt = now();
    if (accept) {
      b.assignment.status = R.ASSIGNMENT.ACCEPTED;
      b.assignment.history.push({ chefId, at: now(), outcome: 'accepted' });
      b.status = R.BOOKING.CONFIRMED;
      event(b, 'chef', 'accepted', `${ch.name} accepted the booking.`);
      notify(`customer:${b.customerId}`, 'Your Dishit Chef has been confirmed!', `${ch.name} will cook your ${b.mealName}.`, b.id);
      notify('admin', 'Chef accepted', `${b.ref}: ${ch.name} accepted.`, b.id);
    } else {
      b.assignment.status = R.ASSIGNMENT.DECLINED;
      b.assignment.chefId = null;
      b.assignment.history.push({ chefId, at: now(), outcome: 'declined', reason: String(reason).trim() });
      event(b, 'chef', 'declined', `${ch.name} declined${reason ? `: ${String(reason).trim()}` : '.'}`);
      notify('admin', 'Chef declined: allocate another chef', `${b.ref}: ${ch.name} declined.`, b.id);
    }
    return commit(ok());
  };

  api.chefCancel = (bookingId, chefId, reason = '') => {
    fresh();
    const { b, error } = guardBooking(bookingId);
    if (error) return error;
    if (b.assignment.status !== R.ASSIGNMENT.ACCEPTED || b.assignment.chefId !== chefId) return fail('This booking is not yours to cancel.');
    if (![R.BOOKING.CONFIRMED, R.BOOKING.EN_ROUTE].includes(b.status)) return fail('This booking can no longer be handed back. Contact Dishit support.');
    const ch = chef(chefId);
    b.assignment.status = R.ASSIGNMENT.CHEF_CANCELLED;
    b.assignment.chefId = null;
    b.assignment.history.push({ chefId, at: now(), outcome: 'chef_cancelled', reason: String(reason).trim() });
    b.status = R.BOOKING.AWAITING_CHEF;
    b.times.enRouteAt = null;
    resetIngredients(b);
    ch.stats.cancellations += 1; // BRIEF §29: recorded against the chef's profile.
    event(b, 'chef', 'chef_cancelled', `${ch.name} cancelled after accepting${reason ? `: ${String(reason).trim()}` : '.'} Dishit is looking for a replacement.`);
    incident(b.id, 'chef_cancelled', 'high', `${ch.name} cancelled ${b.ref} after accepting. Find a replacement or refund 100%.`);
    notify('admin', 'Chef cancelled: replacement needed', `${b.ref}: ${ch.name} cancelled after accepting.`, b.id);
    notify(`customer:${b.customerId}`, 'We are finding you a new chef', `${b.ref}: your chef can no longer make it. Dishit is arranging a replacement.`, b.id);
    return commit(ok());
  };

  // ------------------------------------------------------------ chef day

  api.chefConfirmIngredients = (bookingId, chefId, { note = '', extras = [] } = {}) => {
    fresh();
    const { b, error } = guardBooking(bookingId);
    if (error) return error;
    if (b.assignment.status !== R.ASSIGNMENT.ACCEPTED || b.assignment.chefId !== chefId) return fail('Accept the booking before confirming ingredients.');
    if (b.ingredients.status !== R.INGREDIENTS.NOT_LISTED) return fail('You have already confirmed this ingredient list.');
    for (const raw of extras) {
      const name = String(raw).trim();
      if (name && !b.ingredients.items.some((i) => i.name.toLowerCase() === name.toLowerCase())) {
        b.ingredients.items.push({ group: 'Added by your chef', name, essential: false, have: false });
      }
    }
    b.ingredients.status = R.INGREDIENTS.LISTED;
    b.ingredients.chefConfirmedAt = now();
    b.ingredients.chefNote = String(note).trim();
    event(b, 'chef', 'ingredients_listed', `Chef confirmed the ingredient list (${b.ingredients.items.length} items).`);
    notify(`customer:${b.customerId}`, 'Your ingredient list is ready', `${b.ref}: tick what you have, then confirm.`, b.id);
    return commit(ok());
  };

  api.chefAdvance = (bookingId, chefId, to) => {
    fresh();
    const { b, error } = guardBooking(bookingId);
    if (error) return error;
    if (b.assignment.status !== R.ASSIGNMENT.ACCEPTED || b.assignment.chefId !== chefId) return fail('This booking is not assigned to you.');
    if (!R.canTransition(b.status, to)) return fail(`A booking cannot go from ${R.LABELS.booking[b.status]} to ${R.LABELS.booking[to] || to}.`);
    const ch = chef(chefId);
    const t = now();

    if (to === R.BOOKING.EN_ROUTE) {
      if (b.ingredients.status === R.INGREDIENTS.NOT_LISTED) return fail('Confirm the ingredient list before you travel.');
      if (t < R.enRouteAllowedFrom(b.scheduledAt)) {
        return fail(`It is too early to travel. You can mark En Route from ${R.POLICY.enRouteWindowHours} hours before the arrival time.`, { code: 'too_early' });
      }
      b.times.enRouteAt = t;
      event(b, 'chef', 'en_route', `${ch.name} is en route.${b.ingredients.status !== R.INGREDIENTS.CONFIRMED ? ' Note: the customer has not confirmed ingredients.' : ''}`);
      notify(`customer:${b.customerId}`, 'Your chef is on the way', `${ch.name} is travelling to you.`, b.id);
    }

    if (to === R.BOOKING.ARRIVED) {
      b.times.arrivedAt = t;
      b.late = R.lateness(b.scheduledAt, t);
      event(b, 'chef', 'arrived', `${ch.name} marked "I have arrived" at ${R.timeKey(t)}${b.late.minutesLate ? ` (${b.late.minutesLate} min after the booked time)` : ''}. This is the official arrival record.`);
      notify(`customer:${b.customerId}`, 'Your Dishit Chef has arrived', `${ch.name} is at your door.`, b.id);
      if (b.late.isLate) {
        const c = customer(b.customerId);
        // BRIEF §30: automatic, no coupon, applies to the next booking only.
        c.discount = { pct: R.POLICY.lateDiscountPct, fromBookingId: b.id, grantedAt: t };
        ch.stats.lateArrivals += 1;
        event(b, 'system', 'late', `Chef was more than ${R.POLICY.lateThresholdMin} minutes late. Split changes to 70% chef / 30% Dishit. Customer gets ${R.POLICY.lateDiscountPct}% off their next booking.`);
        notify(`customer:${b.customerId}`, `${R.POLICY.lateDiscountPct}% off your next Dishit`, 'Your chef arrived more than 30 minutes late. The discount is applied automatically to your next booking.', b.id);
        notify(`chef:${chefId}`, 'Late arrival recorded', `${b.ref}: you arrived ${b.late.minutesLate} minutes late. This booking pays 70%.`, b.id);
        incident(b.id, 'chef_late', 'medium', `${ch.name} arrived ${b.late.minutesLate} min late for ${b.ref}. 70/30 split applied, customer given 10% off next booking.`);
      }
    }

    if (to === R.BOOKING.COOKING) {
      if (b.ingredients.missing && b.ingredients.missing.status === 'waiting') return fail('An essential ingredient is still missing. Mark it as found, or end the booking when the 20 minutes are up.');
      b.times.cookingAt = t;
      event(b, 'chef', 'cooking', `${ch.name} started cooking.`);
      notify(`customer:${b.customerId}`, 'Cooking has started', `Your ${b.mealName} is being prepared.`, b.id);
    }

    if (to === R.BOOKING.COMPLETED) {
      b.times.completedAt = t;
      b.times.closedAt = t;
      b.status = to;
      scheduleEarnings(b, chefId);
      ch.stats.completed += 1;
      const s = R.settle(b);
      event(b, 'chef', 'completed', `${ch.name} completed the booking.`);
      event(b, 'system', 'earnings', `Earnings recorded: chef ${R.money(s.chefAmount)} (${s.chefPct}%), Dishit ${R.money(s.foodieAmount)}. Chef payout scheduled for ${R.dateKey(b.payout.payoutDate)}.`);
      notify(`customer:${b.customerId}`, 'How was your Dishit experience?', `Rate your ${b.mealName} with ${ch.name}.`, b.id);
      notify(`chef:${chefId}`, 'Earnings recorded', `${b.ref}: ${R.money(s.chefAmount)} will be paid on ${R.dateKey(b.payout.payoutDate)}.`, b.id);
      notify('admin', 'Booking completed', `${b.ref} completed by ${ch.name}.`, b.id);
      return commit(ok());
    }

    b.status = to;
    return commit(ok());
  };

  api.chefFlagMissing = (bookingId, chefId, itemName, essential) => {
    fresh();
    const { b, error } = guardBooking(bookingId);
    if (error) return error;
    if (b.assignment.chefId !== chefId || b.status !== R.BOOKING.ARRIVED) return fail('You can report a missing ingredient after you arrive and before you start cooking.');
    if (b.ingredients.missing && b.ingredients.missing.status === 'waiting') return fail('You are already waiting for a missing ingredient.');
    const item = String(itemName || '').trim();
    if (!item) return fail('Say which ingredient is missing.');
    const t = now();
    if (essential) {
      b.ingredients.missing = { item, essential: true, flaggedAt: t, status: 'waiting', resolvedAt: null };
      event(b, 'chef', 'missing_essential', `Essential ingredient missing: ${item}. The customer has ${R.POLICY.missingIngredientWaitMin} minutes to get it.`);
      notify(`customer:${b.customerId}`, 'An essential ingredient is missing', `Your chef cannot cook without ${item}. You have ${R.POLICY.missingIngredientWaitMin} minutes to get it.`, b.id);
    } else {
      b.ingredients.missing = { item, essential: false, flaggedAt: t, status: 'noted', resolvedAt: null };
      event(b, 'chef', 'missing_minor', `Ingredient missing: ${item}. The chef will cook without it; the result may differ.`);
      notify(`customer:${b.customerId}`, 'One ingredient is missing', `Your chef will cook without ${item}. The meal may turn out a little different.`, b.id);
    }
    return commit(ok());
  };

  api.chefResolveMissing = (bookingId, chefId) => {
    fresh();
    const { b, error } = guardBooking(bookingId);
    if (error) return error;
    const m = b.ingredients.missing;
    if (b.assignment.chefId !== chefId || !m || m.status !== 'waiting') return fail('There is no missing ingredient to resolve.');
    m.status = 'resolved';
    m.resolvedAt = now();
    event(b, 'chef', 'missing_resolved', `${m.item} was provided ${Math.floor((m.resolvedAt - m.flaggedAt) / R.MIN)} minutes after it was reported.`);
    return commit(ok());
  };

  api.chefEndMissing = (bookingId, chefId) => {
    fresh();
    const { b, error } = guardBooking(bookingId);
    if (error) return error;
    const m = b.ingredients.missing;
    if (b.assignment.chefId !== chefId || b.status !== R.BOOKING.ARRIVED || !m || m.status !== 'waiting') return fail('There is no missing ingredient to end this booking for.');
    if (now() < R.missingIngredientDeadline(m.flaggedAt)) return fail(`The customer still has time. You can end the booking ${R.POLICY.missingIngredientWaitMin} minutes after reporting the ingredient.`);
    const ch = chef(chefId);
    m.status = 'expired';
    b.status = R.BOOKING.ENDED_MISSING;
    b.times.closedAt = now();
    scheduleEarnings(b, chefId);
    const s = R.settle(b);
    event(b, 'chef', 'ended_missing', `${ch.name} left: ${m.item} was still missing after ${R.POLICY.missingIngredientWaitMin} minutes. No refund. Split ${s.chefPct}/${s.foodiePct}.`);
    notify(`customer:${b.customerId}`, 'Your booking has ended', `${m.item} was not available within ${R.POLICY.missingIngredientWaitMin} minutes, so your chef has left. This booking is not refundable.`, b.id);
    notify('admin', 'Booking ended: essential ingredient missing', `${b.ref}: ${ch.name} left after waiting.`, b.id);
    incident(b.id, 'missing_ingredient', 'medium', `${b.ref} ended: ${m.item} missing after the ${R.POLICY.missingIngredientWaitMin}-minute wait. No refund.`);
    return commit(ok());
  };

  api.chefMarkNoShow = (bookingId, chefId) => {
    fresh();
    const { b, error } = guardBooking(bookingId);
    if (error) return error;
    if (b.assignment.chefId !== chefId || b.status !== R.BOOKING.ARRIVED) return fail('You can only mark a no-show after you have arrived.');
    if (b.times.customerArrivalConfirmedAt) return fail('The customer has confirmed your arrival, so this is not a no-show.');
    if (now() < R.noShowAllowedAt(b.times.arrivedAt)) return fail(`Wait ${R.POLICY.noShowWaitMin} minutes after arriving, and try to contact the customer, before marking a no-show.`);
    const ch = chef(chefId);
    b.status = R.BOOKING.NO_SHOW;
    b.times.closedAt = now();
    scheduleEarnings(b, chefId);
    const s = R.settle(b);
    event(b, 'chef', 'no_show', `${ch.name} marked a customer no-show after waiting ${R.POLICY.noShowWaitMin} minutes. No refund. Split ${s.chefPct}/${s.foodiePct}.`);
    notify(`customer:${b.customerId}`, 'We missed you', `Your chef waited ${R.POLICY.noShowWaitMin} minutes and could not reach you. This booking is not refundable.`, b.id);
    notify('admin', 'Customer no-show', `${b.ref}: marked by ${ch.name}.`, b.id);
    incident(b.id, 'no_show', 'medium', `Customer no-show on ${b.ref}. Chef waited ${R.POLICY.noShowWaitMin} minutes. No refund.`);
    return commit(ok());
  };

  // ---------------------------------------------------------------- admin

  api.adminCancel = (bookingId, reason = '') => {
    fresh();
    const { b, error } = guardBooking(bookingId);
    if (error) return error;
    if (!R.isOpen(b.status)) return fail('This booking is already closed.');
    const chefId = b.assignment.chefId;
    b.cancellation = { by: 'admin', at: now(), rule: 'foodie_cancelled', refundPct: 100, reason: String(reason).trim(), chefHadAccepted: false };
    b.status = R.BOOKING.CANCELLED;
    b.times.closedAt = now();
    refund(b, b.pricing.total, { pct: 100, rule: 'foodie_cancelled', reason: reason ? `Dishit cancelled: ${String(reason).trim()}` : 'Dishit cancelled the booking', by: 'admin' });
    scheduleEarnings(b, null);
    restoreDiscountIfFullyRefunded(b);
    if (chefId) notify(`chef:${chefId}`, 'Booking cancelled by Dishit', `${b.ref} has been cancelled.`, b.id);
    event(b, 'admin', 'cancelled', `Admin cancelled the booking${reason ? `: ${String(reason).trim()}` : '.'} 100% refund of ${R.money(b.pricing.total)}.`);
    notify(`customer:${b.customerId}`, 'Your booking was cancelled by Dishit', `${b.ref}: you will be refunded ${R.money(b.pricing.total)} in full.`, b.id);
    return commit(ok());
  };

  api.adminProcessRefund = (bookingId, refundId) => {
    fresh();
    const { b, error } = guardBooking(bookingId);
    if (error) return error;
    const r = b.payment.refunds.find((x) => x.id === refundId);
    if (!r) return fail('That refund could not be found.');
    if (r.status === 'processed') return fail('This refund has already been processed.');
    r.status = 'processed';
    r.processedAt = now();
    event(b, 'admin', 'refund_processed', `Simulated refund of ${R.money(r.amount)} processed. No real money moved.`);
    notify(`customer:${b.customerId}`, 'Refund processed', `${b.ref}: ${R.money(r.amount)} has been refunded (simulated).`, b.id);
    return commit(ok());
  };

  api.adminGoodwillRefund = (bookingId, amountCents, reason = '') => {
    fresh();
    const { b, error } = guardBooking(bookingId);
    if (error) return error;
    const max = R.maxGoodwillRefund(b);
    const amount = Math.round(Number(amountCents));
    if (!(amount > 0)) return fail('Enter a refund amount.');
    if (amount > max) return fail(max > 0 ? `The most that can be refunded here is ${R.money(max)}, which is Dishit's share. The chef's earnings are not touched.` : 'There is nothing left to refund on this booking.');
    if (!String(reason).trim()) return fail('Give a reason for the refund.');
    refund(b, amount, { rule: 'goodwill', reason: String(reason).trim(), by: 'admin' });
    event(b, 'admin', 'goodwill_refund', `Admin issued a goodwill refund of ${R.money(amount)}: ${String(reason).trim()}`);
    return commit(ok());
  };

  api.adminContact = (bookingId, who, message) => {
    fresh();
    const { b, error } = guardBooking(bookingId);
    if (error) return error;
    const text = String(message || '').trim();
    if (!text) return fail('Write a message first.');
    const to = who === 'chef' ? (b.assignment.chefId ? `chef:${b.assignment.chefId}` : null) : `customer:${b.customerId}`;
    if (!to) return fail('No chef is allocated to this booking.');
    notify(to, 'Message from Dishit support', text, b.id);
    event(b, 'admin', 'contact', `Admin messaged the ${who === 'chef' ? 'chef' : 'customer'} in the app: "${text}"`);
    return commit(ok());
  };

  api.setChefStatus = (chefId, status, reason = '') => {
    fresh();
    const ch = chef(chefId);
    if (!ch) return fail('That chef could not be found.');
    if (!['approved', 'rejected', 'suspended'].includes(status)) return fail('Unknown chef status.');
    if (status === 'suspended' || status === 'rejected') {
      const open = state.bookings.some((b) => b.assignment.chefId === chefId && R.isOpen(b.status));
      if (open) return fail(`${ch.name} still has open bookings. Reallocate them first.`);
      if (!String(reason).trim()) return fail('Give a reason.');
    }
    ch.statusHistory.push({ at: now(), from: ch.status, to: status, reason: String(reason).trim() });
    ch.status = status;
    if (status === 'approved') notify(`chef:${chefId}`, 'You are approved to cook with Dishit', 'You can now receive booking requests.');
    return commit(ok());
  };

  api.setChefAvailability = (chefId, days) => {
    fresh();
    const ch = chef(chefId);
    if (!ch) return fail('That chef could not be found.');
    ch.availability = [...new Set(days.map(Number).filter((d) => d >= 0 && d <= 6))].sort();
    return commit(ok());
  };

  api.setCustomerStatus = (customerId, status) => {
    fresh();
    const c = customer(customerId);
    if (!c) return fail('That customer could not be found.');
    if (!['active', 'suspended'].includes(status)) return fail('Unknown account status.');
    c.status = status;
    if (status === 'suspended' && state.session.customerId === customerId) state.session.customerId = null;
    return commit(ok());
  };

  api.saveCategory = (input) => {
    fresh();
    const name = String(input.name || '').trim();
    if (!name) return fail('Give the category a name.');
    if (state.categories.some((c) => c.id !== input.id && c.name.toLowerCase() === name.toLowerCase())) return fail('A category with this name already exists.');
    let c = input.id ? category(input.id) : null;
    if (!c) {
      state.seq.category += 1;
      c = { id: `cat${state.seq.category}`, order: state.categories.length + 1, active: true, image: '' };
      state.categories.push(c);
    }
    c.name = name;
    c.blurb = String(input.blurb || '').trim();
    if (input.image !== undefined) c.image = input.image;
    if (input.active !== undefined) c.active = Boolean(input.active);
    return commit(ok({ id: c.id }));
  };

  api.saveMeal = (input) => {
    fresh();
    const name = String(input.name || '').trim();
    const errors = {};
    if (!name) errors.name = 'Give the meal a name.';
    if (!category(input.categoryId)) errors.categoryId = 'Choose a category.';
    const base = Math.round(Number(input.basePriceCents));
    const extra = Math.round(Number(input.extraPersonCents));
    if (!(base > 0)) errors.basePriceCents = 'Enter the price for 2 people.';
    if (!(extra >= 0)) errors.extraPersonCents = 'Enter the price per extra person.';
    const cook = Math.round(Number(input.cookMinutes));
    if (!(cook > 0)) errors.cookMinutes = 'Enter the cooking time in minutes.';
    if (Object.keys(errors).length) return fail('Check the highlighted fields.', { errors });
    let m = input.id ? meal(input.id) : null;
    if (!m) {
      state.seq.meal += 1;
      m = { id: `meal${state.seq.meal}`, active: true, image: '', included: [], ingredients: [], allergens: [], chefBrings: [] };
      state.meals.push(m);
    }
    Object.assign(m, { name, categoryId: input.categoryId, description: String(input.description || '').trim(), basePriceCents: base, extraPersonCents: extra, cookMinutes: cook });
    for (const key of ['included', 'ingredients', 'allergens', 'chefBrings', 'image']) {
      if (input[key] !== undefined) m[key] = input[key];
    }
    if (input.active !== undefined) m.active = Boolean(input.active);
    return commit(ok({ id: m.id }));
  };

  api.setMealActive = (mealId, active) => {
    fresh();
    const m = meal(mealId);
    if (!m) return fail('That meal could not be found.');
    m.active = Boolean(active);
    return commit(ok());
  };

  api.setCategoryActive = (categoryId, active) => {
    fresh();
    const c = category(categoryId);
    if (!c) return fail('That category could not be found.');
    c.active = Boolean(active);
    return commit(ok());
  };

  api.markPayoutPaid = (batchId) => {
    fresh();
    const batch = R.payoutBatches(state.bookings, state.paidBatches).find((p) => p.id === batchId);
    if (!batch) return fail('That payout could not be found.');
    if (batch.status === R.PAYOUT.PAID) return fail('This payout is already marked as paid.');
    state.seq.payout += 1;
    state.paidBatches[batchId] = { paidAt: now(), reference: `PAYSIM-${String(4100 + state.seq.payout * 9)}` };
    for (const id of batch.bookingIds) {
      const b = booking(id);
      b.payout.status = R.PAYOUT.PAID;
      event(b, 'admin', 'payout_paid', `Chef payout marked as paid (simulated, ${state.paidBatches[batchId].reference}). No real money moved.`);
    }
    notify(`chef:${batch.chefId}`, 'Payout sent', `${R.money(batch.amount)} for ${batch.bookingIds.length} booking${batch.bookingIds.length === 1 ? '' : 's'} (simulated).`);
    return commit(ok());
  };

  api.addIncident = ({ bookingId = null, type = 'support', severity = 'low', summary }) => {
    fresh();
    if (!String(summary || '').trim()) return fail('Describe what happened.');
    if (bookingId && !booking(bookingId)) return fail('That booking reference could not be found.');
    const record = incident(bookingId, type, severity, String(summary).trim());
    return commit(ok({ id: record.id }));
  };

  api.addIncidentNote = (incidentId, text) => {
    fresh();
    const record = state.incidents.find((i) => i.id === incidentId);
    if (!record) return fail('That record could not be found.');
    if (!String(text || '').trim()) return fail('Write a note first.');
    record.notes.push({ at: now(), text: String(text).trim() });
    return commit(ok());
  };

  api.resolveIncident = (incidentId) => {
    fresh();
    const record = state.incidents.find((i) => i.id === incidentId);
    if (!record) return fail('That record could not be found.');
    record.status = 'resolved';
    record.resolvedAt = now();
    return commit(ok());
  };

  api.markNotificationsRead = (to) => {
    fresh();
    let changed = false;
    for (const n of state.notifications) {
      if (n.to === to && !n.read) { n.read = true; changed = true; }
    }
    return changed ? commit(ok()) : ok();
  };

  // ------------------------------------------------------- store control

  api.getState = () => state;
  api.find = { customer, chef, meal, category, booking };
  api.subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

  /** Called when another tab or frame has written new state. */
  api.reload = () => {
    const stored = load();
    if (stored && stored.rev !== state.rev) {
      state = stored;
      emit();
    }
  };

  api.payoutBatches = () => R.payoutBatches(state.bookings, state.paidBatches);

  /** Seeding helpers: only seed.js uses these. */
  api._seed = {
    setClockAnywhere: (targetMs) => { state.clockOffsetMs = targetMs - realNow(); },
    state: () => state,
  };

  /** Put the demo back to its starting point: fresh sample data, clock at real time. */
  api.reset = () => {
    batching = true;
    try {
      state = baseState(realNow());
      seedHistory(api, realNow());
    } finally {
      batching = false;
    }
    save();
    emit();
    return ok();
  };

  state = load();
  if (!state) api.reset();

  return api;
}

/** Simple in-memory storage for tests. */
export function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}
