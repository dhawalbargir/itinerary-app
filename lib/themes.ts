export const THEMES = [
  { id: "itinerary", label: "Lagoon", dark: false },
  { id: "itinerary-night", label: "Lagoon night", dark: true },
  { id: "nord", label: "Nord", dark: false },
  { id: "emerald", label: "Emerald", dark: false },
  { id: "cupcake", label: "Cupcake", dark: false },
  { id: "dim", label: "Dim", dark: true },
  { id: "sunset", label: "Sunset", dark: true },
  { id: "business", label: "Business", dark: true },
] as const;

/** Runs before paint so the saved theme never flashes. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
