// ONE source of truth for the public contact address.
//
// Canonical target: hello@thewhetstone.review — but that inbox does not exist
// until Cloudflare Email Routing is enabled on the .review zone (dashboard →
// Email → Email Routing → enable + add the routing MX records, then create a
// custom address hello@ forwarding to the verified Gmail destination). Until
// that is done, any mailto: pointing at hello@ silently bounces.
//
// DEPLOY GUARD (2026-07-16): keep the Gmail here so no live contact link
// bounces. The moment Email Routing is verified, change this ONE line to
// 'hello@thewhetstone.review'.
export const CONTACT_EMAIL = 'daniel.livingstone44@gmail.com';
