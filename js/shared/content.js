// Text for the information pages (brief §37) and kitchen requirements (§19).
// Policy figures are read from rules.js so the words can never drift from
// the calculations. Everything marked placeholder needs Dishit's own wording.

import { POLICY as P } from './rules.js';

export const KITCHEN_BASICS = ['Stove', 'Oven where the meal needs one', 'Fridge', 'Sink with running water', 'Basic pots and pans', 'Basic knives', 'Cutting boards', 'A normal kitchen workspace'];

export const INFO_PAGES = {
  how: { title: 'How Dishit works', body: [
    'Choose a meal, tell us how many people and when, and pay in the app. Dishit allocates a qualified chef who comes to your home and cooks it.',
    'You buy the groceries. After accepting your booking, your chef confirms the exact ingredient list. You tick off what you have and confirm in the app.',
    `Bookings are made at least one day ahead. Two hours before your chef arrives we remind you to confirm your ingredients.`,
    'Your chef cooks, serves and cleans up after their cooking. You leave a review afterwards.',
  ] },
  cancellation: { title: 'Cancellation policy', body: [
    `More than ${P.cancelFullRefundHours} hours before your booking: ${P.refundMoreThan24hPct}% refund.`,
    `Within ${P.cancelFullRefundHours} hours of your booking: ${P.refundWithin24hPct}% refund.`,
    `Once your chef has started travelling: ${P.refundChefTravellingPct}% refund.`,
    'If your chef cancels and Dishit cannot find a replacement: 100% refund.',
    `If you are not there when your chef arrives, your chef waits ${P.noShowWaitMin} minutes. After that the booking is a no-show and is not refundable.`,
    `If an essential ingredient is missing when your chef arrives, you have ${P.missingIngredientWaitMin} minutes to get it. After that your chef may leave and the booking is not refundable.`,
    `If your chef arrives more than ${P.lateThresholdMin} minutes late, you get ${P.lateDiscountPct}% off your next Dishit booking. It is applied automatically and cannot be exchanged for cash, transferred or saved for a later booking.`,
  ] },
  kitchen: { title: 'What your kitchen needs', body: [
    `A normal household kitchen is enough: ${KITCHEN_BASICS.join(', ').toLowerCase()}.`,
    'You do not need specialised equipment. If a meal needs it, such as sushi mats, a blender or special knives, your chef brings it.',
    'Your chef cleans up the mess made by cooking and leaves the kitchen as they found it, allowing for normal cooking use. Clearing up after eating is yours unless you agree otherwise.',
  ] },
  about: { title: 'About Dishit', placeholder: true, body: ['Dishit brings home-cooked meals to your table by bringing the chef to your kitchen. You choose the food. We bring the chef.'] },
  faqs: { title: 'FAQs', placeholder: true, body: [
    'Does Dishit bring the food? No. You buy the ingredients; your chef tells you exactly what to get.',
    'Can I book for today? No. Bookings need at least one day’s notice.',
    'Can I choose my chef? Not yet. Dishit allocates a chef who suits your meal, area and date.',
  ] },
  contact: { title: 'Contact and support', placeholder: true, body: ['Help & Support, Contact Us and complaints will be handled here. No real contact details are shown in this demonstration.'] },
  customer: { title: 'Customer policy', placeholder: true, body: ['What Dishit expects from customers: a safe home, a working kitchen, the confirmed ingredients, and someone present when the chef arrives.'] },
  terms: { title: 'Terms & Conditions', placeholder: true, body: ['The customer terms and conditions will appear here.'] },
  privacy: { title: 'Privacy Policy', placeholder: true, body: ['The privacy policy will appear here. It must cover how Dishit handles names, contact details and home addresses under POPIA.'] },
  safety: { title: 'Safety', placeholder: true, body: ['How Dishit keeps customers and chefs safe: chef verification, what to do if something goes wrong, and how to reach Dishit urgently.'] },
  chefs: { title: 'Become a Dishit chef', placeholder: true, body: [
    'Dishit chefs are qualified cooks who want flexible, well-paid bookings. The preferred minimum is an NQF Level 5 qualification in cooking or hospitality, subject to Dishit’s verification.',
    `Chefs earn ${P.standardChefPct}% of each booking and are paid every second Friday.`,
  ] },
  'chef-terms': { title: 'Chef requirements and terms', placeholder: true, body: ['Chef requirements, chef terms and chef support information will appear here.'] },
  company: { title: 'Company', placeholder: true, body: ['Careers, Partner With Us, Press and Media, and Dishit’s social media links (Instagram, TikTok, Facebook, LinkedIn) will appear here.'] },
  credits: { title: 'Photo credits', body: [] },
};

export const INFO_GROUPS = [
  { title: 'Dishit', slugs: ['about', 'how', 'faqs', 'contact'] },
  { title: 'Customers', slugs: ['customer', 'cancellation', 'kitchen', 'terms', 'privacy', 'safety'] },
  { title: 'Chefs', slugs: ['chefs', 'chef-terms'] },
  { title: 'More', slugs: ['company', 'credits'] },
];
