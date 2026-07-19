/**
 * Industry / vertical registry used for Google Places discovery and the
 * explore directory. Each vertical maps to a Places text query; ingest pulls
 * the top N results per vertical for a city.
 *
 * Keep TOP_PER_VERTICAL × VERTICALS.length roughly near MAX_CITY_BUSINESSES;
 * ingest also enforces a hard unique-business cap.
 */

export interface Vertical {
  /** Stable slug stored on business metadata.verticals. */
  slug: string;
  /** UI label. */
  label: string;
  /** Short blurb shown on the explore page. */
  description: string;
  /** Google Places text query (city name is appended at search time). */
  query: string;
}

export const VERTICALS: readonly Vertical[] = [
  // Food & drink
  {
    slug: "restaurants",
    label: "Restaurants",
    description: "Dinner spots, local favourites, and coastal dining.",
    query: "best restaurants",
  },
  {
    slug: "takeaways",
    label: "Takeaways & Fast Food",
    description: "Quick meals, delivery, and casual eats.",
    query: "best takeaways and fast food",
  },
  {
    slug: "cafes",
    label: "Cafés & Coffee",
    description: "Coffee shops, brunch spots, and laptop-friendly cafés.",
    query: "best cafes and coffee shops",
  },
  {
    slug: "bakeries",
    label: "Bakeries",
    description: "Fresh bread, cakes, and pastry shops.",
    query: "best bakeries",
  },
  {
    slug: "bars",
    label: "Bars & Nightlife",
    description: "Pubs, cocktail bars, and evening hangouts.",
    query: "best bars and pubs",
  },
  {
    slug: "grocery",
    label: "Grocery Stores",
    description: "Supermarkets, convenience stores, and groceries.",
    query: "best grocery stores and supermarkets",
  },
  {
    slug: "butchers",
    label: "Butchers & Delis",
    description: "Butcheries, delis, and fresh meat counters.",
    query: "best butcheries and delis",
  },
  {
    slug: "liquor",
    label: "Liquor Stores",
    description: "Bottle stores and wine shops.",
    query: "best liquor stores and bottle shops",
  },

  // Personal care
  {
    slug: "hair-salons",
    label: "Hairdressers",
    description: "Hair salons and stylists.",
    query: "best hairdressers and hair salons",
  },
  {
    slug: "barbershops",
    label: "Barbershops",
    description: "Barbers and men's haircuts.",
    query: "best barbershops",
  },
  {
    slug: "beauticians",
    label: "Beauticians & Nails",
    description: "Beauty therapists, nail salons, and aesthetics.",
    query: "best beauticians nail salons and beauty therapists",
  },
  {
    slug: "spas",
    label: "Spas & Wellness",
    description: "Day spas, massage, and wellness treatments.",
    query: "best spas and massage",
  },

  // Health
  {
    slug: "doctors",
    label: "Doctors & Clinics",
    description: "GPs, medical centres, and clinics.",
    query: "best doctors and medical clinics",
  },
  {
    slug: "dentists",
    label: "Dentists",
    description: "Dental practices and oral care.",
    query: "best dentists",
  },
  {
    slug: "pharmacies",
    label: "Pharmacies",
    description: "Chemists and dispensaries.",
    query: "best pharmacies and chemists",
  },
  {
    slug: "optometrists",
    label: "Optometrists",
    description: "Eye tests, glasses, and contact lenses.",
    query: "best optometrists and opticians",
  },
  {
    slug: "vets",
    label: "Vets & Pets",
    description: "Veterinarians, pet shops, and pet care.",
    query: "best veterinarians and pet shops",
  },

  // Everyday services
  {
    slug: "laundry",
    label: "Laundry & Dry Cleaning",
    description: "Laundromats and dry cleaners.",
    query: "best laundry and dry cleaners",
  },
  {
    slug: "banks",
    label: "Banks & ATMs",
    description: "Banks, ATMs, and financial services.",
    query: "best banks and ATMs",
  },
  {
    slug: "petrol",
    label: "Petrol Stations",
    description: "Fuel stops and convenience forecourts.",
    query: "petrol stations and fuel",
  },
  {
    slug: "hardware",
    label: "Hardware Stores",
    description: "DIY, tools, and building supplies.",
    query: "best hardware stores",
  },
  {
    slug: "florists",
    label: "Florists",
    description: "Flower shops and bouquet delivery.",
    query: "best florists",
  },
  {
    slug: "childcare",
    label: "Schools & Childcare",
    description: "Schools, crèches, and daycare.",
    query: "best schools creches and daycare",
  },

  // Home, auto, fitness, leisure
  {
    slug: "home-services",
    label: "Home Services",
    description: "Plumbers, electricians, and household pros.",
    query: "best plumbers electricians and home services",
  },
  {
    slug: "automotive",
    label: "Automotive",
    description: "Mechanics, car washes, and auto services.",
    query: "best car mechanics and auto services",
  },
  {
    slug: "fitness",
    label: "Gyms & Fitness",
    description: "Gyms, studios, and fitness centres.",
    query: "best gyms and fitness centres",
  },
  {
    slug: "shopping",
    label: "Shopping",
    description: "Malls, boutiques, and local retail.",
    query: "best shopping centres and stores",
  },
  {
    slug: "hotels",
    label: "Hotels & Stays",
    description: "Hotels, guest houses, and places to stay.",
    query: "best hotels and accommodation",
  },
  {
    slug: "attractions",
    label: "Things to Do",
    description: "Beaches, attractions, and experiences worth the trip.",
    query: "top things to do and attractions",
  },
  {
    slug: "family",
    label: "Kids & Family",
    description: "Family activities and kid-friendly outings.",
    query: "best kids and family activities",
  },
] as const;

/** Max results requested from Google per vertical. */
export const TOP_PER_VERTICAL = 15;

/** Hard cap on unique businesses stored per city from discovery ingest. */
export const MAX_CITY_BUSINESSES = 500;

export function getVertical(slug: string): Vertical | undefined {
  return VERTICALS.find((v) => v.slug === slug);
}
