// Canonical site origin — ONE source of truth so a domain move (the .net → .review
// migration, or an eventual .com) is a one-line change and no surface ships a
// dead URL. Base.astro, citation exports, and any absolute-URL builder read this.
export const SITE_URL = 'https://thewhetstone.review';
