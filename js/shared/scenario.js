// The scripted presentation: twenty steps, one booking, three interfaces.
// Used by the presenter view (to guide and to catch up) and by the tests
// (to prove the whole journey works end to end).

import * as R from './rules.js';
import { DEMO } from './seed.js';

/** The demo booking date: the first Thursday at least two days from now. */
export function demoDate(now) {
  const d = new Date(R.startOfDay(now));
  d.setDate(d.getDate() + 2);
  while (d.getDay() !== 4) d.setDate(d.getDate() + 1);
  return R.dateKey(d.getTime());
}

/** Thandi's booking for the demo meal made since the last reset, if any. */
export function findDemoBooking(state) {
  return state.bookings.find((b) => b.customerId === DEMO.customerId && b.mealId === DEMO.mealId && b.createdAt >= state.seededAt - R.MIN) || null;
}

const reached = (b, statuses) => Boolean(b) && statuses.includes(b.status);
const AFTER = {
  en_route: ['en_route', 'arrived', 'cooking', 'completed'],
  arrived: ['arrived', 'cooking', 'completed'],
  cooking: ['cooking', 'completed'],
  completed: ['completed'],
};

export const STEPS = [
  { n: 1, view: 'customer', route: '#/welcome', title: 'Thandi opens Foodie',
    say: 'The first screen is the brand and two choices: create an account or log in.',
    click: 'Log in, then "Continue as Thandi".',
    done: (s) => s.session.customerId === DEMO.customerId,
    run: (store) => store.loginCustomer(DEMO.customerEmail, 'demo-password') },
  { n: 2, view: 'customer', route: '#/home', title: 'She browses Traditional Food',
    say: 'The home page asks one question: what do you feel like eating? Eight categories, all managed from admin.',
    click: 'Tap "Traditional Food".',
    done: (s) => s.session.customerId === DEMO.customerId },
  { n: 3, view: 'customer', route: '#/category/traditional', title: 'She picks Pap, Beef Stew & Vegetables',
    say: 'Each meal shows a photo, a short description and a starting price.',
    click: 'Tap "Pap, Beef Stew & Vegetables".',
    done: (s) => s.session.customerId === DEMO.customerId },
  { n: 4, view: 'customer', route: `#/meal/${DEMO.mealId}`, title: 'Four servings',
    say: 'The meal page lists what is included, the ingredients she will buy, allergens and cooking time. The price follows the number of people.',
    click: 'Tap "Book this meal", then set people to 4.',
    done: (s) => s.session.customerId === DEMO.customerId },
  { n: 5, view: 'customer', route: `#/book/${DEMO.mealId}`, title: 'A future date, arriving at 18:00',
    say: 'Same-day bookings are not possible. Today is greyed out; tomorrow onward is open.',
    click: 'Choose the suggested Thursday and 18:00.',
    done: (s) => s.session.customerId === DEMO.customerId },
  { n: 6, view: 'customer', route: `#/book/${DEMO.mealId}`, title: 'Where the chef will cook',
    say: 'The address is fictional. The chef only sees the suburb until they accept.',
    click: 'Tap "Use the demonstration address".',
    done: (s) => s.session.customerId === DEMO.customerId },
  { n: 7, view: 'customer', route: `#/book/${DEMO.mealId}`, title: 'She reviews the Foodie service amount',
    say: 'One amount, no extras. The summary also says which cancellation rule applies.',
    click: 'Read the summary, then "Proceed to payment".',
    done: (s) => s.session.customerId === DEMO.customerId },
  { n: 8, view: 'customer', route: `#/book/${DEMO.mealId}`, title: 'Simulated payment',
    say: 'No card details are taken and no money moves. She gets a booking reference and the status "Finding your chef".',
    click: 'Tap "Approve simulated payment".',
    done: (s) => Boolean(findDemoBooking(s)),
    run: (store) => store.createBooking({ customerId: DEMO.customerId, mealId: DEMO.mealId, servings: DEMO.servings, date: demoDate(store.now()), time: DEMO.time, address: DEMO.address, payment: 'approve' }) },
  { n: 9, view: 'admin', route: '#/', title: 'Admin receives the booking',
    say: 'The booking lands in the operations dashboard with customer, meal, people, date, amount paid and five separate statuses.',
    click: 'Open the new booking from "Needs a chef".',
    done: (s) => Boolean(findDemoBooking(s)) },
  { n: 10, view: 'admin', route: (b) => `#/bookings/${b.id}`, title: 'Admin allocates a chef by hand',
    say: 'Foodie chooses the chef. The list shows who cooks this category, covers the suburb, works that day and has no clash.',
    click: 'Allocate Sipho Dlamini.',
    done: (s) => { const b = findDemoBooking(s); return Boolean(b) && (b.assignment.status === 'offered' || b.assignment.status === 'accepted' || b.status !== 'awaiting_chef'); },
    run: (store, b) => store.allocateChef(b.id, DEMO.chefId) },
  { n: 11, view: 'chef', route: '#/requests', title: 'The chef accepts',
    say: 'Sipho sees the meal, people, date and suburb, and can accept or decline. A decline goes back to admin.',
    click: 'Tap "Accept".',
    done: (s) => { const b = findDemoBooking(s); return Boolean(b) && (b.assignment.status === 'accepted' || !['awaiting_chef'].includes(b.status)); },
    run: (store, b) => store.chefRespond(b.id, b.assignment.chefId, true) },
  { n: 12, view: 'customer', route: (b) => `#/booking/${b.id}`, title: 'Thandi sees her chef is confirmed',
    say: 'The status moves from "Finding your chef" to "Confirmed" and she meets her chef.',
    click: 'Look at the booking: chef card and status.',
    done: (s) => { const b = findDemoBooking(s); return Boolean(b) && b.assignment.status === 'accepted'; } },
  { n: 13, view: 'chef', route: (b) => `#/booking/${b.id}`, title: 'The chef confirms the ingredients',
    say: 'Foodie does not supply groceries. The chef confirms exactly what Thandi must have.',
    click: 'Tap "Confirm ingredient list".',
    done: (s) => { const b = findDemoBooking(s); return Boolean(b) && b.ingredients.status !== 'not_listed'; },
    run: (store, b) => store.chefConfirmIngredients(b.id, b.assignment.chefId, { note: 'Please have the beef defrosted before I arrive.' }) },
  { n: 14, view: 'customer', route: (b) => `#/booking/${b.id}`, title: 'Two hours before: Thandi confirms her ingredients',
    say: 'Two hours before the booking Foodie sends a reminder. Her confirmation is recorded with a timestamp.',
    click: 'Tick every ingredient, then "I confirm I have the required ingredients".',
    clock: (b) => ({ at: R.reminderDueAt(b.scheduledAt), label: 'two hours before the booking' }),
    done: (s) => { const b = findDemoBooking(s); return Boolean(b) && b.ingredients.status === 'customer_confirmed'; },
    run: (store, b) => {
      b.ingredients.items.forEach((item, i) => { if (!item.have) store.setIngredientHave(b.id, i, true); });
      return store.customerConfirmIngredients(b.id);
    } },
  { n: 15, view: 'chef', route: (b) => `#/booking/${b.id}`, title: 'The chef marks En Route',
    say: 'From here the chef’s status and timestamps are the official record. Thandi sees every change.',
    click: 'Tap "I am on my way".',
    clock: (b) => ({ at: b.scheduledAt - 40 * R.MIN, label: '40 minutes before arrival' }),
    done: (s) => reached(findDemoBooking(s), AFTER.en_route),
    run: (store, b) => store.chefAdvance(b.id, b.assignment.chefId, 'en_route') },
  { n: 16, view: 'chef', route: (b) => `#/booking/${b.id}`, title: 'The chef marks Arrived',
    say: 'The arrival time is recorded. More than 30 minutes late would switch the split to 70/30 and give Thandi 10% off her next booking.',
    click: 'Tap "I have arrived".',
    clock: (b) => ({ at: b.scheduledAt - 5 * R.MIN, label: 'five minutes before arrival' }),
    done: (s) => reached(findDemoBooking(s), AFTER.arrived),
    run: (store, b) => store.chefAdvance(b.id, b.assignment.chefId, 'arrived') },
  { n: 17, view: 'chef', route: (b) => `#/booking/${b.id}`, title: 'The chef starts cooking',
    say: 'If an essential ingredient were missing, this is where the 20-minute wait would start.',
    click: 'Tap "Start cooking".',
    clock: (b) => ({ at: (b.times.arrivedAt || b.scheduledAt) + 8 * R.MIN, label: 'a few minutes after arriving' }),
    done: (s) => reached(findDemoBooking(s), AFTER.cooking),
    run: (store, b) => store.chefAdvance(b.id, b.assignment.chefId, 'cooking') },
  { n: 18, view: 'chef', route: (b) => `#/booking/${b.id}`, title: 'The chef completes the service',
    say: 'Completing the booking records the chef’s earnings for the next payout Friday.',
    click: 'Tap "Complete booking".',
    clock: (b) => ({ at: (b.times.cookingAt || b.scheduledAt) + 130 * R.MIN, label: 'the end of the meal' }),
    done: (s) => reached(findDemoBooking(s), AFTER.completed),
    run: (store, b) => store.chefAdvance(b.id, b.assignment.chefId, 'completed') },
  { n: 19, view: 'customer', route: (b) => `#/booking/${b.id}`, title: 'Thandi reviews her experience',
    say: 'An overall rating plus food, professionalism, punctuality and cleanliness, and a comment.',
    click: 'Choose stars, write a line, tap "Send review".',
    done: (s) => { const b = findDemoBooking(s); return Boolean(b) && Boolean(b.review); },
    run: (store, b) => store.submitReview(b.id, { overall: 5, food: 5, professionalism: 5, punctuality: 5, cleanliness: 5, comment: 'Sipho cooked like family. The stew was perfect.' }) },
  { n: 20, view: 'admin', route: (b) => `#/bookings/${b.id}`, title: 'Admin sees the result and the money',
    say: 'Completed, paid, reviewed. R760 paid: 80% to the chef, 20% to Foodie, payout scheduled for the next payout Friday.',
    click: 'Open the booking, then Revenue and Payouts.',
    done: (s) => reached(findDemoBooking(s), AFTER.completed) },
];

export function routeFor(step, state) {
  if (typeof step.route === 'string') return step.route;
  const b = findDemoBooking(state);
  return b ? step.route(b) : '#/';
}

/** The clock jump a step needs, if the demo clock has not reached it yet. */
export function clockJumpFor(step, store) {
  if (!step.clock) return null;
  const b = findDemoBooking(store.getState());
  if (!b) return null;
  const target = step.clock(b);
  return store.now() < target.at ? target : null;
}

/** The highest step whose result is already visible in the shared state. */
export function progress(state) {
  let last = 0;
  for (const step of STEPS) {
    if (step.done(state)) last = step.n;
    else break;
  }
  return last;
}

/**
 * Bring the shared state up to and including step n by running every
 * unfinished step through the same store actions the screens use.
 */
export function ensureStep(store, n) {
  for (const step of STEPS) {
    if (step.n > n) break;
    if (step.done(store.getState())) continue;
    const before = findDemoBooking(store.getState());
    if (before && before.status === 'cancelled') return { ok: false, error: 'The demo booking was cancelled. Reset the demo to run the script again.' };
    const jump = clockJumpFor(step, store);
    if (jump) store.setClock(jump.at);
    if (!step.run) continue;
    const result = step.run(store, findDemoBooking(store.getState()));
    if (!result.ok) return { ok: false, error: `Step ${step.n} could not run: ${result.error}` };
  }
  return { ok: true };
}
