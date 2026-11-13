// Dishit business rules — the single source of truth for every price, refund,
// split, lateness and payout calculation in the demo. Pure functions only:
// no storage, no DOM, no clock. All money is integer cents. All times are ms.
//
// Values marked BRIEF come straight from the business owner's brief.
// Values marked ASSUMPTION are placeholders that need the owner's approval
// (see docs/01-requirements-and-decisions.md).

export const MIN = 60 * 1000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

export const POLICY = Object.freeze({
  standardChefPct: 80,              // BRIEF §35
  lateChefPct: 70,                  // BRIEF §30
  lateThresholdMin: 30,             // BRIEF §30: "more than 30 minutes late"
  lateDiscountPct: 10,              // BRIEF §30
  cancelFullRefundHours: 24,        // BRIEF §28
  refundMoreThan24hPct: 100,        // BRIEF §28
  refundWithin24hPct: 80,           // BRIEF §28
  refundChefTravellingPct: 50,      // BRIEF §28
  ingredientReminderHours: 2,       // BRIEF §18
  missingIngredientWaitMin: 20,     // BRIEF §22
  noShowWaitMin: 30,                // BRIEF §27
  payoutEveryDays: 14,              // BRIEF §36: every second Friday
  payoutAnchor: [2026, 0, 2],       // ASSUMPTION M6: Friday 2 January 2026
  minServings: 2,                   // ASSUMPTION M1
  maxServings: 12,                  // ASSUMPTION M1
  baseServings: 2,                  // ASSUMPTION M1
  firstSlot: '07:00',               // ASSUMPTION T10
  lastSlot: '20:00',                // ASSUMPTION T10
  enRouteWindowHours: 3,            // ASSUMPTION T11
});

// ---------------------------------------------------------------- statuses

export const BOOKING = Object.freeze({
  AWAITING_CHEF: 'awaiting_chef',
  CONFIRMED: 'confirmed',
  EN_ROUTE: 'en_route',
  ARRIVED: 'arrived',
  COOKING: 'cooking',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'customer_no_show',
  ENDED_MISSING: 'ended_missing_ingredient',
});

export const ASSIGNMENT = Object.freeze({
  UNASSIGNED: 'unassigned',
  OFFERED: 'offered',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  CHEF_CANCELLED: 'chef_cancelled',
});

export const INGREDIENTS = Object.freeze({
  NOT_LISTED: 'not_listed',
  LISTED: 'listed',
  CONFIRMED: 'customer_confirmed',
});

export const PAYMENT = Object.freeze({
  PAID: 'paid',
  PARTIAL_REFUND: 'partially_refunded',
  REFUNDED: 'refunded',
});

export const PAYOUT = Object.freeze({
  NONE: 'none',
  SCHEDULED: 'scheduled',
  PAID: 'paid',
});

export const LABELS = Object.freeze({
  booking: {
    awaiting_chef: 'Finding your chef',
    confirmed: 'Confirmed',
    en_route: 'En route',
    arrived: 'Arrived',
    cooking: 'Cooking',
    completed: 'Completed',
    cancelled: 'Cancelled',
    customer_no_show: 'Customer no-show',
    ended_missing_ingredient: 'Ended: ingredient missing',
  },
  assignment: {
    unassigned: 'No chef allocated',
    offered: 'Waiting for chef to respond',
    accepted: 'Chef accepted',
    declined: 'Chef declined',
    chef_cancelled: 'Chef cancelled',
  },
  ingredients: {
    not_listed: 'List not confirmed by chef',
    listed: 'Waiting for customer',
    customer_confirmed: 'Customer confirmed',
  },
  payment: {
    paid: 'Paid',
    partially_refunded: 'Partly refunded',
    refunded: 'Refunded',
  },
  payout: {
    none: 'Nothing due yet',
    scheduled: 'Scheduled',
    paid: 'Paid out',
  },
});

// The day-of-booking path (BRIEF §20). Each status may only move to the next.
const NEXT_STATUS = Object.freeze({
  confirmed: 'en_route',
  en_route: 'arrived',
  arrived: 'cooking',
  cooking: 'completed',
});

export const ACTIVE_STATUSES = ['en_route', 'arrived', 'cooking'];
export const UPCOMING_STATUSES = ['awaiting_chef', 'confirmed'];
export const FINISHED_STATUSES = ['completed', 'customer_no_show', 'ended_missing_ingredient'];

export function nextStatus(status) {
  return NEXT_STATUS[status] || null;
}

export function canTransition(from, to) {
  return NEXT_STATUS[from] === to;
}

export function isOpen(status) {
  return UPCOMING_STATUSES.includes(status) || ACTIVE_STATUSES.includes(status);
}

// ------------------------------------------------------------------ pricing

export function pct(amountCents, percent) {
  return Math.round((amountCents * percent) / 100);
}

/** Price of a meal for a number of people (ASSUMPTION M1). */
export function servicePrice(meal, servings) {
  const n = Number(servings);
  if (!Number.isInteger(n) || n < POLICY.minServings || n > POLICY.maxServings) {
    throw new RangeError(`Choose between ${POLICY.minServings} and ${POLICY.maxServings} people.`);
  }
  return meal.basePriceCents + (n - POLICY.baseServings) * meal.extraPersonCents;
}

/**
 * Checkout quote. The late-chef discount (BRIEF §30) applies to the Dishit
 * service amount and is applied automatically when the customer has one.
 */
export function quote(meal, servings, discountPct = 0) {
  const serviceAmount = servicePrice(meal, servings);
  const discount = discountPct ? pct(serviceAmount, discountPct) : 0;
  return { servings: Number(servings), serviceAmount, discountPct: discountPct || 0, discount, total: serviceAmount - discount };
}

// ------------------------------------------------------------- date helpers

export function startOfDay(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function dateKey(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function timeKey(ms) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Combine 'YYYY-MM-DD' and 'HH:MM' (local time) into ms, or NaN. */
export function toTimestamp(date, time) {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  const tm = /^(\d{2}):(\d{2})$/.exec(time || '');
  if (!dm || !tm) return NaN;
  const d = new Date(+dm[1], +dm[2] - 1, +dm[3], +tm[1], +tm[2], 0, 0);
  if (d.getMonth() !== +dm[2] - 1 || d.getDate() !== +dm[3]) return NaN;
  return d.getTime();
}

/** Earliest bookable calendar day: tomorrow (BRIEF §8, no same-day bookings). */
export function earliestBookingDate(now) {
  const d = new Date(startOfDay(now));
  d.setDate(d.getDate() + 1);
  return dateKey(d.getTime());
}

export function timeSlots() {
  const out = [];
  const [fh, fm] = POLICY.firstSlot.split(':').map(Number);
  const [lh, lm] = POLICY.lastSlot.split(':').map(Number);
  for (let m = fh * 60 + fm; m <= lh * 60 + lm; m += 30) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  return out;
}

/** Validate a requested arrival date and time. Returns {ok, error?, scheduledAt?}. */
export function validateSchedule(date, time, now) {
  const scheduledAt = toTimestamp(date, time);
  if (Number.isNaN(scheduledAt)) return { ok: false, error: 'Choose a date and an arrival time.' };
  if (startOfDay(scheduledAt) <= startOfDay(now)) {
    return { ok: false, error: 'Dishit needs at least one day’s notice. Choose tomorrow or later.' };
  }
  if (!timeSlots().includes(time)) {
    return { ok: false, error: `Chefs arrive between ${POLICY.firstSlot} and ${POLICY.lastSlot}.` };
  }
  return { ok: true, scheduledAt };
}

// -------------------------------------------------------------- cancellation

/**
 * Which customer-cancellation rule applies right now (BRIEF §28).
 * Returns {allowed, refundPct, rule, label, reason?}.
 */
export function cancellationRule(status, scheduledAt, now) {
  if (status === BOOKING.EN_ROUTE) {
    return { allowed: true, refundPct: POLICY.refundChefTravellingPct, rule: 'chef_travelling', label: 'Your chef is already travelling' };
  }
  if (status === BOOKING.AWAITING_CHEF || status === BOOKING.CONFIRMED) {
    const hoursLeft = (scheduledAt - now) / HOUR;
    if (hoursLeft > POLICY.cancelFullRefundHours) {
      return { allowed: true, refundPct: POLICY.refundMoreThan24hPct, rule: 'more_than_24h', label: 'More than 24 hours before your booking' };
    }
    return { allowed: true, refundPct: POLICY.refundWithin24hPct, rule: 'within_24h', label: 'Within 24 hours of your booking' };
  }
  if (status === BOOKING.ARRIVED || status === BOOKING.COOKING) {
    // ASSUMPTION T1: the brief stops at "started travelling".
    return { allowed: false, refundPct: 0, rule: 'chef_on_site', label: 'Your chef is already with you', reason: 'Your chef has arrived, so this booking can no longer be cancelled in the app. Contact Dishit support.' };
  }
  return { allowed: false, refundPct: 0, rule: 'closed', label: 'Booking is closed', reason: 'This booking is already closed.' };
}

export function cancellationQuote(booking, now) {
  const rule = cancellationRule(booking.status, booking.scheduledAt, now);
  const paid = booking.pricing.total;
  const refund = rule.allowed ? pct(paid, rule.refundPct) : 0;
  return { ...rule, paid, refund, retained: paid - refund };
}

// ------------------------------------------------------------------ lateness

/** Lateness from the chef's own arrival timestamp (BRIEF §21, §30). */
export function lateness(scheduledAt, arrivedAt) {
  const minutesLate = Math.max(0, Math.floor((arrivedAt - scheduledAt) / MIN));
  return { minutesLate, isLate: arrivedAt - scheduledAt > POLICY.lateThresholdMin * MIN };
}

export function reminderDueAt(scheduledAt) {
  return scheduledAt - POLICY.ingredientReminderHours * HOUR;
}

export function noShowAllowedAt(arrivedAt) {
  return arrivedAt + POLICY.noShowWaitMin * MIN;
}

export function missingIngredientDeadline(flaggedAt) {
  return flaggedAt + POLICY.missingIngredientWaitMin * MIN;
}

export function enRouteAllowedFrom(scheduledAt) {
  return scheduledAt - POLICY.enRouteWindowHours * HOUR;
}

// ---------------------------------------------------------------- settlement

/**
 * The one financial breakdown of a booking. Customer receipts, chef earnings,
 * admin revenue and payouts all read from this function.
 *
 * booking needs: status, pricing{serviceAmount, discount, total},
 * payment{refunds[]}, late{isLate}, cancellation{chefHadAccepted}.
 */
export function settle(booking) {
  const { serviceAmount, discount, total: paid } = booking.pricing;
  const refunds = (booking.payment && booking.payment.refunds) || [];
  const refunded = refunds.reduce((sum, r) => sum + r.amount, 0);
  const retained = paid - refunded;
  const isLate = Boolean(booking.late && booking.late.isLate);

  const base = { serviceAmount, discount, paid, refunded, retained, isLate };
  const standardChef = pct(serviceAmount, POLICY.standardChefPct);

  if (FINISHED_STATUSES.includes(booking.status)) {
    // BRIEF §22, §25, §27, §30, §35. ASSUMPTION T3: late beats no-show.
    // ASSUMPTION M3: the chef is paid on the full service amount, so Dishit
    // carries any late-chef discount the customer used on this booking.
    const chefPct = isLate ? POLICY.lateChefPct : POLICY.standardChefPct;
    const chefAmount = pct(serviceAmount, chefPct);
    return {
      ...base,
      final: true,
      rule: isLate ? 'late' : 'standard',
      ruleLabel: isLate ? 'Late chef: 70% chef / 30% Dishit' : 'Standard: 80% chef / 20% Dishit',
      chefPct,
      foodiePct: 100 - chefPct,
      chefAmount,
      foodieAmount: retained - chefAmount,
      lateAdjustment: isLate ? chefAmount - standardChef : 0,
    };
  }

  if (booking.status === BOOKING.CANCELLED) {
    // ASSUMPTION M2: retained money is split 80/20 only if a chef had accepted.
    const chefHadAccepted = Boolean(booking.cancellation && booking.cancellation.chefHadAccepted);
    const chefAmount = chefHadAccepted && retained > 0 ? pct(retained, POLICY.standardChefPct) : 0;
    return {
      ...base,
      final: true,
      rule: 'cancelled',
      ruleLabel: retained === 0 ? 'Cancelled: fully refunded' : chefHadAccepted ? 'Cancelled: amount kept is split 80% chef / 20% Dishit' : 'Cancelled: no chef had accepted, Dishit keeps the amount not refunded',
      chefPct: chefHadAccepted && retained > 0 ? POLICY.standardChefPct : 0,
      foodiePct: chefHadAccepted && retained > 0 ? 100 - POLICY.standardChefPct : retained > 0 ? 100 : 0,
      chefAmount,
      foodieAmount: retained - chefAmount,
      lateAdjustment: 0,
    };
  }

  // Still in progress: show the standard split as an estimate.
  const chefPct = isLate ? POLICY.lateChefPct : POLICY.standardChefPct;
  const chefAmount = pct(serviceAmount, chefPct);
  return {
    ...base,
    final: false,
    rule: isLate ? 'late' : 'standard',
    ruleLabel: isLate ? 'Late chef: 70% chef / 30% Dishit (estimate)' : 'Standard: 80% chef / 20% Dishit (estimate)',
    chefPct,
    foodiePct: 100 - chefPct,
    chefAmount,
    foodieAmount: retained - chefAmount,
    lateAdjustment: isLate ? chefAmount - standardChef : 0,
  };
}

/** Largest goodwill refund admin may give on a finished booking (ASSUMPTION M7). */
export function maxGoodwillRefund(booking) {
  if (!FINISHED_STATUSES.includes(booking.status)) return 0;
  return Math.max(0, settle(booking).foodieAmount);
}

export function paymentStatusFor(paid, refunded) {
  if (refunded <= 0) return PAYMENT.PAID;
  return refunded >= paid ? PAYMENT.REFUNDED : PAYMENT.PARTIAL_REFUND;
}

// -------------------------------------------------------------------- payouts

function anchorMs() {
  const [y, m, d] = POLICY.payoutAnchor;
  return new Date(y, m, d, 12, 0, 0, 0).getTime();
}

/** All arithmetic is done on calendar days so daylight-saving shifts cannot move a Friday. */
function dayNumber(ms) {
  const d = new Date(ms);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
}

function fromDayNumber(n) {
  const u = new Date(n * DAY);
  return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate(), 12, 0, 0, 0).getTime();
}

/**
 * The payout Friday for money earned at `earnedAt`: the first fortnightly
 * Friday strictly after that calendar day (BRIEF §36, ASSUMPTION M6).
 */
export function payoutDateFor(earnedAt) {
  const anchor = dayNumber(anchorMs());
  const day = dayNumber(earnedAt);
  const cycles = Math.floor((day - anchor) / POLICY.payoutEveryDays) + 1;
  return fromDayNumber(anchor + cycles * POLICY.payoutEveryDays);
}

export function nextPayoutDate(now) {
  return payoutDateFor(now);
}

/**
 * Group everything owed to chefs into payout batches, one per chef per
 * payout Friday. Derived from bookings, never stored separately.
 */
export function payoutBatches(bookings, paidBatches = {}) {
  const map = new Map();
  for (const b of bookings) {
    if (!b.payout || b.payout.status === PAYOUT.NONE || !b.payout.chefId) continue;
    const s = settle(b);
    if (s.chefAmount <= 0) continue;
    const id = `${dateKey(b.payout.payoutDate)}_${b.payout.chefId}`;
    if (!map.has(id)) {
      map.set(id, { id, chefId: b.payout.chefId, payoutDate: b.payout.payoutDate, bookingIds: [], amount: 0, adjustments: 0 });
    }
    const batch = map.get(id);
    batch.bookingIds.push(b.id);
    batch.amount += s.chefAmount;
    batch.adjustments += s.lateAdjustment;
  }
  return [...map.values()]
    .map((batch) => ({
      ...batch,
      status: paidBatches[batch.id] ? PAYOUT.PAID : PAYOUT.SCHEDULED,
      paidAt: paidBatches[batch.id] ? paidBatches[batch.id].paidAt : null,
      reference: paidBatches[batch.id] ? paidBatches[batch.id].reference : null,
    }))
    .sort((a, b) => b.payoutDate - a.payoutDate || a.chefId.localeCompare(b.chefId));
}

/** Totals across bookings for the admin revenue view. */
export function revenueSummary(bookings) {
  const out = { gross: 0, refunded: 0, retained: 0, chef: 0, foodie: 0, discounts: 0, standardCount: 0, lateCount: 0, cancelledCount: 0, openCount: 0, estimatedChef: 0, estimatedDishit: 0 };
  for (const b of bookings) {
    const s = settle(b);
    out.gross += s.paid;
    out.refunded += s.refunded;
    out.retained += s.retained;
    out.discounts += s.discount;
    if (s.final) {
      out.chef += s.chefAmount;
      out.foodie += s.foodieAmount;
      if (s.rule === 'late') out.lateCount += 1;
      else if (s.rule === 'standard') out.standardCount += 1;
      else out.cancelledCount += 1;
    } else {
      out.openCount += 1;
      out.estimatedChef += s.chefAmount;
      out.estimatedDishit += s.foodieAmount;
    }
  }
  return out;
}

// ------------------------------------------------------------ chef matching

/**
 * How well a chef fits a booking, using the factors in BRIEF §13.
 * Advice for the admin only: allocation stays a manual decision.
 */
export function chefSuitability(chef, booking, meal, bookings) {
  const day = new Date(booking.scheduledAt).getDay();
  const clash = bookings.find(
    (o) =>
      o.id !== booking.id &&
      o.assignment.chefId === chef.id &&
      [ASSIGNMENT.OFFERED, ASSIGNMENT.ACCEPTED].includes(o.assignment.status) &&
      isOpen(o.status) &&
      Math.abs(o.scheduledAt - booking.scheduledAt) < 4 * HOUR,
  );
  const alreadyDeclined = booking.assignment.history.some((h) => h.chefId === chef.id && ['declined', 'chef_cancelled'].includes(h.outcome));
  const checks = [
    { key: 'status', label: 'Approved and active', ok: chef.status === 'approved', blocking: true },
    { key: 'category', label: 'Cooks this category', ok: chef.categories.includes(meal.categoryId) },
    { key: 'area', label: `Covers ${booking.address.suburb}`, ok: chef.areas.includes(booking.address.suburb) },
    { key: 'day', label: 'Works on this day', ok: chef.availability.includes(day) },
    { key: 'clash', label: 'No clashing booking', ok: !clash },
    { key: 'declined', label: 'Has not already turned this booking down', ok: !alreadyDeclined },
  ];
  const passed = checks.filter((c) => c.ok).length;
  const reliability = Math.max(0, 100 - chef.stats.cancellations * 15 - chef.stats.lateArrivals * 5);
  return {
    checks,
    eligible: checks.every((c) => c.ok || !c.blocking),
    allPassed: passed === checks.length,
    reliability,
    score: passed * 100 + chef.rating * 10 + reliability / 10,
  };
}

// ------------------------------------------------------------------ format

export function money(cents) {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const rands = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const c = abs % 100;
  return `${neg ? '−' : ''}R${rands}${c ? '.' + String(c).padStart(2, '0') : ''}`;
}
