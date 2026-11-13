// Demonstration data. Every person, address, phone number, price and booking
// here is invented for the demo. Prices are NOT approved commercial pricing.
//
// The booking history is produced by running the real store actions against
// a wound-back demo clock, so the sample figures obey the same rules as
// everything a presenter does live.

import * as R from './rules.js';

const IMG = 'assets/img/meals/';

/** "Maize meal*, Salt" -> [{name, essential}] where * marks an essential ingredient. */
function items(text) {
  return text.split(',').map((raw) => {
    const name = raw.trim();
    return name.endsWith('*') ? { name: name.slice(0, -1), essential: true } : { name, essential: false };
  });
}

function groups(obj) {
  return Object.entries(obj).map(([group, text]) => ({ group, items: items(text) }));
}

const rand = (r) => r * 100;

const CATEGORIES = [
  ['traditional', 'Traditional Food', 'Pap, stews and the food you grew up on.', 'pap-beef-stew-vegetables'],
  ['sunday-lunch', 'Sunday Lunch', 'Seven colours, roasts and all the sides.', 'seven-colours'],
  ['breakfast', 'Breakfast', 'A slow morning, cooked for you.', 'full-breakfast'],
  ['braai', 'Braai', 'Fire, meat, pap and chakalaka.', 'braai-platter'],
  ['italian', 'Italian', 'Fresh pasta dishes made in your kitchen.', 'bolognese'],
  ['steak', 'Steak', 'Cooked the way you ask, with proper sides.', 'sirloin-chips'],
  ['sushi', 'Sushi', 'Rolled in front of you.', 'salmon-platter'],
  ['mexican', 'Mexican', 'Tacos, quesadillas and fresh salsa.', 'beef-tacos'],
];

// id, category, name, description, price for 2 (R), per extra person (R), cooking minutes,
// included, ingredients, allergens, what the chef brings
const MEALS = [
  ['pap-mokgodu-cabbage', 'traditional', 'Pap, Mokgodu & Cabbage', 'Traditional home-cooked pap served with mokgodu and cabbage.', 480, 110, 180,
    ['Soft or stiff pap, your choice', 'Slow-cooked mokgodu', 'Braised cabbage'],
    { Pap: 'Maize meal*, Salt, Water', Mokgodu: 'Tripe*, Onion, Tomato, Seasoning', Cabbage: 'Cabbage*, Onion, Seasoning' },
    [], []],
  ['pap-chicken-cabbage', 'traditional', 'Pap, Chicken & Cabbage', 'Traditional home-cooked chicken served with pap and cabbage.', 440, 100, 80,
    ['Pap', 'Stewed chicken pieces in gravy', 'Braised cabbage'],
    { Pap: 'Maize meal*, Salt, Water', Chicken: 'Chicken pieces*, Onion, Tomato, Chicken spice, Cooking oil', Cabbage: 'Cabbage*, Onion, Seasoning' },
    [], []],
  ['pap-beef-stew-vegetables', 'traditional', 'Pap, Beef Stew & Vegetables', 'Tender beef stew with pap and seasonal vegetables, cooked slowly the home way.', 520, 120, 120,
    ['Pap', 'Slow-cooked beef stew', 'Butternut and spinach on the side'],
    { Pap: 'Maize meal*, Salt, Water', 'Beef stew': 'Stewing beef*, Onion, Tomatoes, Carrots, Potatoes, Beef stock, Garlic, Cooking oil', Vegetables: 'Butternut, Spinach, Butter' },
    ['Milk (butter)', 'Celery (stock)'], []],
  ['samp-beans-lamb', 'traditional', 'Samp, Beans & Lamb Stew', 'Creamy samp and sugar beans with a rich lamb stew.', 560, 130, 180,
    ['Samp and beans', 'Lamb stew', 'Chakalaka'],
    { 'Samp and beans': 'Samp*, Sugar beans*, Salt, Butter', 'Lamb stew': 'Lamb knuckles*, Onion, Tomato, Potatoes, Curry powder, Garlic', Chakalaka: 'Baked beans, Carrots, Green pepper, Onion, Chilli' },
    ['Milk (butter)'], ['Pressure cooker']],

  ['seven-colours', 'sunday-lunch', 'Seven Colours Sunday Plate', 'Roast chicken with savoury rice, beetroot, coleslaw, butternut, creamed spinach and potato salad.', 640, 150, 150,
    ['Roast chicken', 'Savoury rice', 'Five colourful sides'],
    { 'Roast chicken': 'Whole chicken*, Chicken spice, Lemon, Garlic, Cooking oil', Rice: 'Rice*, Turmeric, Mixed vegetables', Sides: 'Beetroot, Cabbage, Carrots, Mayonnaise, Butternut, Spinach, Cream, Potatoes, Eggs' },
    ['Egg', 'Milk'], []],
  ['roast-lamb', 'sunday-lunch', 'Roast Leg of Lamb, Potatoes & Gravy', 'Leg of lamb roasted with garlic and rosemary, crisp potatoes and pan gravy.', 780, 190, 180,
    ['Roast leg of lamb', 'Roast potatoes', 'Green beans and gravy'],
    { Lamb: 'Leg of lamb*, Garlic, Rosemary, Olive oil', Potatoes: 'Potatoes*, Cooking oil, Salt', 'Gravy and greens': 'Flour, Beef stock, Green beans, Butter' },
    ['Gluten (gravy)', 'Milk (butter)', 'Celery (stock)'], ['Meat thermometer', 'Carving knife']],
  ['oxtail-dombolo', 'sunday-lunch', 'Oxtail & Dombolo', 'Slow-braised oxtail with steamed dumplings to soak up the gravy.', 820, 200, 210,
    ['Braised oxtail', 'Steamed dombolo', 'Carrots and green beans'],
    { Oxtail: 'Oxtail*, Onion, Carrots, Tomato paste, Beef stock, Garlic, Bay leaves', Dombolo: 'Cake flour*, Instant yeast*, Sugar, Salt', Vegetables: 'Green beans, Butter' },
    ['Gluten', 'Milk (butter)', 'Celery (stock)'], ['Pressure cooker']],

  ['full-breakfast', 'breakfast', 'Full Farmhouse Breakfast', 'Eggs your way with boerewors, bacon, grilled tomato, mushrooms and toast.', 380, 85, 45,
    ['Eggs cooked to order', 'Boerewors and bacon', 'Grilled tomato, mushrooms and toast'],
    { Eggs: 'Eggs*, Butter', Meat: 'Boerewors*, Bacon', Sides: 'Tomatoes, Mushrooms, Bread, Cooking oil' },
    ['Egg', 'Gluten', 'Milk'], []],
  ['flapjacks', 'breakfast', 'Flapjacks, Berries & Honey', 'A warm stack of fluffy flapjacks with berries, honey and cream.', 320, 70, 40,
    ['Stack of flapjacks', 'Fresh berries', 'Honey and whipped cream'],
    { Flapjacks: 'Cake flour*, Eggs*, Milk*, Baking powder, Sugar, Butter', Topping: 'Mixed berries, Honey, Cream' },
    ['Gluten', 'Egg', 'Milk'], ['Electric whisk']],
  ['omelette-avo', 'breakfast', 'Omelette, Avo & Toast', 'A three-egg omelette with cheese and peppers, sliced avocado and toast.', 340, 75, 35,
    ['Filled omelette', 'Sliced avocado', 'Buttered toast'],
    { Omelette: 'Eggs*, Cheddar cheese, Green pepper, Onion, Butter', Sides: 'Avocado, Bread, Tomatoes' },
    ['Egg', 'Milk', 'Gluten'], []],

  ['braai-platter', 'braai', 'Braai Platter with Pap & Chakalaka', 'Boerewors, lamb chops and chicken off the fire, with pap and chakalaka.', 720, 170, 120,
    ['Boerewors, lamb chops and chicken', 'Pap', 'Chakalaka'],
    { Meat: 'Boerewors*, Lamb chops*, Chicken drumsticks*, Braai spice', Pap: 'Maize meal*, Salt, Water', Chakalaka: 'Baked beans, Carrots, Green pepper, Onion, Chilli', Fire: 'Charcoal or wood*, Firelighters' },
    [], ['Braai tongs', 'Grid brush', 'Basting brush']],
  ['peri-peri-chicken', 'braai', 'Braaied Peri-Peri Chicken & Braaibroodjies', 'Flattened chicken basted with peri-peri, with toasted braaibroodjies.', 580, 135, 100,
    ['Whole flattened chicken', 'Braaibroodjies', 'Green salad'],
    { Chicken: 'Whole chicken*, Peri-peri sauce, Lemon, Garlic', Braaibroodjies: 'Bread*, Cheddar cheese, Tomatoes, Onion, Butter', Salad: 'Lettuce, Cucumber, Tomatoes', Fire: 'Charcoal or wood*, Firelighters' },
    ['Gluten', 'Milk'], ['Braai tongs', 'Folding grid']],
  ['lamb-chops-mielies', 'braai', 'Lamb Chops, Mielies & Potato Salad', 'Thick lamb chops and whole mielies off the coals with creamy potato salad.', 760, 185, 90,
    ['Lamb loin chops', 'Braaied mielies', 'Potato salad'],
    { Meat: 'Lamb chops*, Braai spice, Rosemary', Mielies: 'Mielies*, Butter', 'Potato salad': 'Potatoes, Mayonnaise, Eggs, Spring onion', Fire: 'Charcoal or wood*, Firelighters' },
    ['Egg', 'Milk'], ['Braai tongs', 'Grid brush']],

  ['chicken-alfredo', 'italian', 'Creamy Chicken Alfredo', 'Fettuccine in a parmesan cream sauce with pan-seared chicken.', 460, 105, 45,
    ['Fettuccine alfredo', 'Seared chicken breast', 'Garlic bread'],
    { Pasta: 'Fettuccine*, Salt', Sauce: 'Cream*, Parmesan*, Garlic, Butter', Chicken: 'Chicken breasts*, Olive oil, Italian herbs', 'Garlic bread': 'Baguette, Butter, Garlic, Parsley' },
    ['Gluten', 'Milk'], ['Microplane grater']],
  ['bolognese', 'italian', 'Spaghetti Bolognese', 'Slow-simmered beef ragu over spaghetti with parmesan.', 440, 100, 75,
    ['Spaghetti', 'Beef ragu', 'Parmesan and basil'],
    { Pasta: 'Spaghetti*, Salt', Ragu: 'Beef mince*, Onion, Carrots, Celery, Tinned tomatoes*, Tomato paste, Garlic, Olive oil', Finish: 'Parmesan, Fresh basil' },
    ['Gluten', 'Milk', 'Celery'], []],
  ['lasagne', 'italian', 'Lasagne al Forno', 'Layers of pasta, beef ragu and white sauce, baked until golden.', 520, 120, 100,
    ['Baked lasagne', 'Green salad', 'Garlic bread'],
    { Lasagne: 'Lasagne sheets*, Beef mince*, Tinned tomatoes*, Onion, Garlic', 'White sauce': 'Milk*, Butter, Flour, Mozzarella, Parmesan', Sides: 'Lettuce, Tomatoes, Baguette' },
    ['Gluten', 'Milk'], ['Oven dish']],

  ['sirloin-chips', 'steak', 'Sirloin Steak, Chips & Pepper Sauce', 'Sirloin cooked to your liking with hand-cut chips and creamy pepper sauce.', 680, 210, 50,
    ['300g sirloin per person', 'Hand-cut chips', 'Pepper sauce'],
    { Steak: 'Sirloin steaks*, Coarse salt, Black pepper, Butter, Garlic', Chips: 'Potatoes*, Cooking oil', 'Pepper sauce': 'Cream, Green peppercorns, Beef stock, Brandy' },
    ['Milk', 'Celery (stock)'], ['Cast-iron pan', 'Meat thermometer']],
  ['tbone-spinach', 'steak', 'T-Bone, Creamed Spinach & Roast Potatoes', 'A big T-bone with creamed spinach and crisp roast potatoes.', 760, 240, 60,
    ['500g T-bone per person', 'Creamed spinach', 'Roast potatoes'],
    { Steak: 'T-bone steaks*, Coarse salt, Black pepper, Butter', 'Creamed spinach': 'Spinach*, Cream, Onion, Nutmeg', Potatoes: 'Potatoes*, Cooking oil, Rosemary' },
    ['Milk'], ['Cast-iron pan', 'Meat thermometer']],

  ['salmon-platter', 'sushi', 'Salmon Sushi Platter', 'Salmon nigiri, sashimi and roses, rolled and sliced in your kitchen.', 820, 260, 90,
    ['Salmon nigiri and sashimi', 'Salmon roses', 'Pickled ginger, wasabi and soy'],
    { Fish: 'Sushi-grade salmon*', Rice: 'Sushi rice*, Rice vinegar*, Sugar, Salt', Extras: 'Nori sheets, Soy sauce, Wasabi, Pickled ginger, Japanese mayonnaise, Sesame seeds' },
    ['Fish', 'Soy', 'Sesame', 'Egg (mayonnaise)'], ['Sushi mat', 'Sashimi knife', 'Rice cooker']],
  ['california-maki', 'sushi', 'California Roll & Maki Platter', 'California rolls, cucumber maki and avocado maki for the table.', 720, 220, 80,
    ['California rolls', 'Cucumber and avocado maki', 'Pickled ginger, wasabi and soy'],
    { Fillings: 'Crab sticks*, Avocado*, Cucumber*', Rice: 'Sushi rice*, Rice vinegar*, Nori sheets*, Sugar, Salt', Extras: 'Soy sauce, Wasabi, Pickled ginger, Japanese mayonnaise, Sesame seeds' },
    ['Fish', 'Crustaceans', 'Soy', 'Sesame', 'Egg (mayonnaise)', 'Gluten'], ['Sushi mat', 'Sashimi knife', 'Rice cooker']],

  ['beef-tacos', 'mexican', 'Beef Tacos with Salsa & Guacamole', 'Spiced beef in soft tortillas with fresh tomato salsa and guacamole.', 480, 115, 50,
    ['Three tacos per person', 'Tomato salsa', 'Guacamole and sour cream'],
    { Filling: 'Beef mince*, Onion, Garlic, Cumin, Paprika, Chilli', Tacos: 'Soft tortillas*, Lettuce, Cheddar cheese', Toppings: 'Tomatoes, Red onion, Coriander, Limes, Avocado, Sour cream' },
    ['Gluten', 'Milk'], []],
  ['chicken-quesadillas', 'mexican', 'Chicken Quesadillas & Mexican Rice', 'Crisp tortillas filled with chicken, peppers and melted cheese, with tomato rice.', 460, 110, 50,
    ['Chicken and cheese quesadillas', 'Mexican tomato rice', 'Salsa and sour cream'],
    { Quesadillas: 'Soft tortillas*, Chicken breasts*, Mozzarella*, Green pepper, Onion, Cumin', Rice: 'Rice, Tinned tomatoes, Garlic, Chicken stock', Toppings: 'Tomatoes, Coriander, Limes, Sour cream' },
    ['Gluten', 'Milk', 'Celery (stock)'], []],
];

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

// id, name, status, qualification, NQF level, years, bio, categories, areas, working days, rating, rating count, completed, cancellations
const CHEFS = [
  ['c1', 'Sipho Dlamini', 'approved', 'National Certificate: Professional Cookery', 5, 8, 'Grew up cooking Sunday lunch for twelve. Eight years in hotel kitchens before going out on his own.',
    ['traditional', 'sunday-lunch', 'braai'], ['Demoville', 'Sampleton', 'Marula Park'], ALL_DAYS, 4.8, 41, 58, 0],
  ['c2', 'Naledi Khumalo', 'approved', 'Diploma in Culinary Arts', 6, 6, 'Trained in Italian kitchens, happiest making a seven-colours plate at home.',
    ['italian', 'breakfast', 'sunday-lunch', 'traditional'], ['Demoville', 'Sampleton'], [1, 2, 3, 4, 5, 6], 4.9, 37, 44, 0],
  ['c3', 'Pieter van Wyk', 'approved', 'National Certificate: Professional Cookery', 5, 11, 'Steakhouse grill chef for a decade. Serious about fire and resting meat.',
    ['steak', 'braai', 'breakfast'], ['Marula Park', 'Sampleton'], [0, 3, 4, 5, 6], 4.6, 29, 35, 1],
  ['c4', 'Ayesha Patel', 'approved', 'Advanced Diploma in Culinary Arts', 6, 7, 'Sushi-trained, with a soft spot for big Mexican flavours.',
    ['sushi', 'italian', 'mexican'], ['Demoville', 'Marula Park'], [1, 2, 3, 4, 5, 6], 4.7, 33, 40, 0],
  ['c5', 'Lerato Molefe', 'approved', 'National Certificate: Professional Cookery', 5, 4, 'Learnt mokgodu from her grandmother and has not changed the recipe since.',
    ['traditional', 'mexican', 'breakfast'], ['Sampleton', 'Demoville'], [0, 1, 2, 5, 6], 4.7, 18, 22, 0],
  ['c6', 'Thabo Nkosi', 'applied', 'National Certificate: Professional Cookery', 5, 3, 'Line cook at a hotel restaurant, looking for weekend bookings.',
    ['braai', 'steak', 'traditional'], ['Marula Park'], [0, 5, 6], 0, 0, 0, 0],
  ['c7', 'Zanele Mthembu', 'applied', 'Certificate in Food Preparation', 4, 5, 'Self-employed caterer for family functions.',
    ['traditional', 'sunday-lunch'], ['Sampleton'], ALL_DAYS, 0, 0, 0, 0],
  ['c8', 'Marco Ferreira', 'suspended', 'Diploma in Culinary Arts', 6, 9, 'Restaurant chef, Italian and steak.',
    ['italian', 'steak'], ['Demoville'], [4, 5, 6], 3.9, 12, 14, 3],
];

// id, first name, surname, suburb. Emails use example.com and phone numbers use the 555 pattern.
const CUSTOMERS = [
  ['u1', 'Thandi', 'Mokoena', 'Demoville', '12 Example Street'],
  ['u2', 'Kagiso', 'Sithole', 'Marula Park', '4 Placeholder Avenue'],
  ['u3', 'Anele', 'Jacobs', 'Demoville', '27 Sample Road'],
  ['u4', 'Priya', 'Naidoo', 'Sampleton', '8 Mockingbird Close'],
  ['u5', 'Johan', 'Botha', 'Marula Park', '31 Fictional Crescent'],
  ['u6', 'Nomsa', 'Zulu', 'Sampleton', '15 Demo Lane'],
];

export const DEMO = Object.freeze({
  customerId: 'u1',
  customerEmail: 'thandi@example.com',
  chefId: 'c1',
  backupChefId: 'c2',
  mealId: 'pap-beef-stew-vegetables',
  servings: 4,
  time: '18:00',
  address: {
    line1: '12 Example Street',
    suburb: 'Demoville',
    city: 'Johannesburg',
    postalCode: '0000',
    directions: 'Blue gate, ring the bell. (Fictional address for demonstration.)',
  },
});

export function addressFor(customerId) {
  const row = CUSTOMERS.find((c) => c[0] === customerId);
  return { line1: row[4], suburb: row[3], city: 'Johannesburg', postalCode: '0000', directions: 'Fictional address for demonstration.' };
}

export function baseState(nowMs) {
  return {
    version: 1,
    rev: 0,
    seededAt: nowMs,
    clockOffsetMs: 0,
    seq: { booking: 0, payment: 0, refund: 0, notification: 0, incident: 0, customer: 100, category: 0, meal: 0, payout: 0 },
    session: { customerId: null, chefId: DEMO.chefId, pendingVerificationId: null },
    categories: CATEGORIES.map(([id, name, blurb, mealId], i) => ({ id, name, blurb, image: `${IMG}${mealId}.webp`, order: i + 1, active: true })),
    meals: MEALS.map(([id, categoryId, name, description, base, extra, cookMinutes, included, ingredients, allergens, chefBrings]) => ({
      id, categoryId, name, description,
      basePriceCents: rand(base), extraPersonCents: rand(extra), cookMinutes,
      included, ingredients: groups(ingredients), allergens, chefBrings,
      image: `${IMG}${id}.webp`, active: true,
    })),
    customers: CUSTOMERS.map(([id, firstName, surname], i) => ({
      id, firstName, surname,
      email: `${firstName.toLowerCase()}@example.com`,
      mobile: `060555010${i + 1}`,
      emailVerified: true, status: 'active', createdAt: nowMs - (120 - i * 9) * R.DAY,
      acceptedTermsAt: nowMs - (120 - i * 9) * R.DAY, acceptedPrivacyAt: nowMs - (120 - i * 9) * R.DAY,
      discount: null, savedAddress: null, demo: true,
    })),
    chefs: CHEFS.map(([id, name, status, qualification, nqfLevel, years, bio, categories, areas, availability, rating, ratingCount, completed, cancellations], i) => ({
      id, name, status, qualification, nqfLevel, years, bio, categories, areas, availability,
      rating, ratingCount,
      email: `${name.split(' ')[0].toLowerCase()}.chef@example.com`,
      mobile: `060555020${i + 1}`,
      stats: { completed, cancellations, lateArrivals: 0 },
      appliedAt: nowMs - (status === 'applied' ? 2 + i : 200 - i * 12) * R.DAY,
      statusHistory: status === 'suspended' ? [{ at: nowMs - 20 * R.DAY, from: 'approved', to: 'suspended', reason: 'Three cancellations after accepting bookings.' }] : [],
      demo: true,
    })),
    bookings: [],
    notifications: [],
    incidents: [],
    paidBatches: {},
  };
}

// ---------------------------------------------------------------- history

function must(result, what) {
  if (!result.ok) throw new Error(`Seed step failed (${what}): ${result.error}`);
  return result;
}

/**
 * Play one sample booking through the real actions.
 * day: days from today (negative = past). end: how the booking finishes.
 */
function play(store, today, spec, realNow) {
  const { customerId, mealId, servings, day, time, chefId, end = 'completed', lateBy = 0, review = null, bookedDaysBefore = 4 } = spec;
  const at = (ms) => store._seed.setClockAnywhere(ms);
  const scheduledAt = R.toTimestamp(R.dateKey(today + day * R.DAY), time);

  at(scheduledAt - bookedDaysBefore * R.DAY - 3 * R.HOUR);
  const { bookingId } = must(store.createBooking({
    customerId, mealId, servings, date: R.dateKey(scheduledAt), time, address: addressFor(customerId), payment: 'approve',
  }), 'book');
  if (end === 'unallocated') return bookingId;

  at(store.now() + 25 * R.MIN);
  must(store.allocateChef(bookingId, chefId), 'allocate');
  if (end === 'offered') return bookingId;

  at(store.now() + 40 * R.MIN);
  must(store.chefRespond(bookingId, chefId, true), 'accept');
  at(store.now() + 15 * R.MIN);
  must(store.chefConfirmIngredients(bookingId, chefId, {}), 'list');
  if (end === 'listed') return bookingId;

  if (end === 'cancel_early') {
    at(scheduledAt - 2 * R.DAY);
    must(store.customerCancel(bookingId, 'Plans changed'), 'cancel');
    return bookingId;
  }
  if (end === 'chef_cancel_refund') {
    at(scheduledAt - 20 * R.HOUR);
    must(store.chefCancel(bookingId, chefId, 'Family emergency'), 'chef cancel');
    at(scheduledAt - 5 * R.HOUR);
    must(store.adminCancel(bookingId, 'No replacement chef available'), 'admin cancel');
    return bookingId;
  }

  const b = store.find.booking(bookingId);
  // Never stamp sample events in the future.
  at(Math.min(scheduledAt - 26 * R.HOUR, realNow - R.HOUR));
  b.ingredients.items.forEach((_, i) => must(store.setIngredientHave(bookingId, i, true), 'tick'));
  must(store.customerConfirmIngredients(bookingId), 'confirm');
  if (end === 'confirmed') return bookingId;

  if (end === 'cancel_late') {
    at(scheduledAt - 6 * R.HOUR);
    must(store.customerCancel(bookingId, 'Guests cancelled'), 'cancel');
    return bookingId;
  }

  at(scheduledAt - 2 * R.HOUR);
  store.tick();
  at(scheduledAt - 45 * R.MIN + lateBy * R.MIN);
  must(store.chefAdvance(bookingId, chefId, 'en_route'), 'en route');

  if (end === 'cancel_travelling') {
    at(store.now() + 10 * R.MIN);
    must(store.customerCancel(bookingId, 'Emergency at home'), 'cancel');
    return bookingId;
  }

  at(scheduledAt - 6 * R.MIN + lateBy * R.MIN);
  must(store.chefAdvance(bookingId, chefId, 'arrived'), 'arrive');

  if (end === 'no_show') {
    at(store.now() + 32 * R.MIN);
    must(store.chefMarkNoShow(bookingId, chefId), 'no-show');
    return bookingId;
  }
  if (end === 'missing') {
    at(store.now() + 4 * R.MIN);
    must(store.chefFlagMissing(bookingId, chefId, spec.missingItem, true), 'flag');
    at(store.now() + 21 * R.MIN);
    must(store.chefEndMissing(bookingId, chefId), 'end');
    return bookingId;
  }

  at(store.now() + 8 * R.MIN);
  must(store.chefAdvance(bookingId, chefId, 'cooking'), 'cook');
  const m = store.find.meal(mealId);
  at(store.now() + (m.cookMinutes + 20) * R.MIN);
  must(store.chefAdvance(bookingId, chefId, 'completed'), 'complete');
  if (review) {
    at(store.now() + 14 * R.HOUR);
    must(store.submitReview(bookingId, review), 'review');
  }
  return bookingId;
}

const five = { overall: 5, food: 5, professionalism: 5, punctuality: 5, cleanliness: 5 };

export function seedHistory(store, realNow) {
  const today = R.startOfDay(realNow) + 12 * R.HOUR;
  const state = store._seed.state();

  const history = [
    { customerId: 'u4', mealId: 'samp-beans-lamb', servings: 4, day: -31, time: '13:00', chefId: 'c1', review: { ...five, comment: 'Tasted like home. Sipho left the kitchen spotless.' } },
    { customerId: 'u1', mealId: 'seven-colours', servings: 4, day: -24, time: '13:00', chefId: 'c2', review: { ...five, comment: 'The whole family asked when Naledi is coming back.' } },
    { customerId: 'u6', mealId: 'pap-chicken-cabbage', servings: 5, day: -20, time: '17:30', chefId: 'c1', review: { ...five, cleanliness: 4, comment: '' } },
    { customerId: 'u2', mealId: 'braai-platter', servings: 6, day: -17, time: '15:00', chefId: 'c1', lateBy: 48, review: { overall: 3, food: 5, professionalism: 4, punctuality: 2, cleanliness: 4, comment: 'Great braai but we waited a long time for the chef.' } },
    { customerId: 'u5', mealId: 'pap-mokgodu-cabbage', servings: 4, day: -13, time: '18:00', chefId: 'c5', end: 'chef_cancel_refund' },
    { customerId: 'u3', mealId: 'salmon-platter', servings: 4, day: -12, time: '19:00', chefId: 'c4', end: 'cancel_early' },
    { customerId: 'u6', mealId: 'california-maki', servings: 2, day: -10, time: '18:30', chefId: 'c4', end: 'missing', missingItem: 'Sushi rice' },
    { customerId: 'u1', mealId: 'chicken-alfredo', servings: 2, day: -9, time: '18:30', chefId: 'c2', review: { overall: 4, food: 5, professionalism: 5, punctuality: 4, cleanliness: 4, comment: 'Lovely pasta. Would book again.' } },
    { customerId: 'u4', mealId: 'bolognese', servings: 4, day: -8, time: '18:00', chefId: 'c2', end: 'cancel_late' },
    { customerId: 'u5', mealId: 'tbone-spinach', servings: 2, day: -6, time: '19:00', chefId: 'c3', end: 'cancel_travelling' },
    // Kagiso's late-chef discount from the braai is applied automatically here.
    { customerId: 'u2', mealId: 'sirloin-chips', servings: 2, day: -5, time: '19:00', chefId: 'c3', review: { ...five, comment: 'Perfect medium rare.' } },
    { customerId: 'u3', mealId: 'beef-tacos', servings: 4, day: -3, time: '18:00', chefId: 'c4', end: 'no_show' },
    { customerId: 'u4', mealId: 'full-breakfast', servings: 4, day: -2, time: '08:00', chefId: 'c1', review: { ...five, comment: 'Best way to start a birthday.' } },
    { customerId: 'u3', mealId: 'lasagne', servings: 4, day: 3, time: '12:30', chefId: 'c2', end: 'confirmed', bookedDaysBefore: 5 },
    { customerId: 'u6', mealId: 'flapjacks', servings: 3, day: 5, time: '08:30', chefId: 'c3', end: 'offered', bookedDaysBefore: 5 },
  ];
  for (const spec of history) play(store, today, spec, realNow);

  // Sample history only: everything that happened before today is settled.
  store._seed.setClockAnywhere(realNow);
  for (const batch of store.payoutBatches()) {
    if (batch.payoutDate < R.startOfDay(realNow)) {
      state.seq.payout += 1;
      state.paidBatches[batch.id] = { paidAt: batch.payoutDate, reference: `PAYSIM-${String(4100 + state.seq.payout * 9)}` };
      for (const id of batch.bookingIds) store.find.booking(id).payout.status = R.PAYOUT.PAID;
    }
  }
  let keptOnePending = false;
  for (const b of state.bookings) {
    for (const r of b.payment.refunds) {
      if (!keptOnePending && r.rule === 'chef_travelling') { keptOnePending = true; continue; }
      r.status = 'processed';
      r.processedAt = r.createdAt + 2 * R.HOUR;
    }
  }
  for (const record of state.incidents) {
    if (record.type === 'chef_late' || record.createdAt > realNow - 4 * R.DAY) continue;
    record.status = 'resolved';
    record.resolvedAt = record.createdAt + R.DAY;
  }
  for (const n of state.notifications) n.read = true;
  state.session = { customerId: null, chefId: DEMO.chefId, pendingVerificationId: null };
  state.clockOffsetMs = 0;
}
