/**
 * Industry / vertical registry used for Google Places discovery and the
 * explore directory. Each vertical maps to a Places text query; ingest pulls
 * the top N results per vertical for a city.
 *
 * Keep Σ(topN) roughly near MAX_CITY_BUSINESSES; ingest also enforces a hard
 * unique-business cap. Newer local-service verticals use a lower topN so their
 * combined budget stays ≤ LOCAL_SERVICE_BUSINESS_BUDGET.
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
  /**
   * Optional per-vertical fetch cap. Defaults to TOP_PER_VERTICAL.
   * Used to budget newer local-service verticals without raising city totals.
   */
  topN?: number;
}

/** Default results requested from Google per vertical (when topN unset). */
export const TOP_PER_VERTICAL = 15;

/** Hard cap on unique businesses stored per city from discovery ingest. */
export const MAX_CITY_BUSINESSES = 800;

/**
 * Combined Google fetch budget for split trades + new Ballito local-service
 * verticals (everything with an explicit topN below). Keep ≤ this for merge
 * expansion without a full city reingest.
 */
export const LOCAL_SERVICE_BUSINESS_BUDGET = 340;

/** Per-vertical topN for the local-service expansion set. */
const LOCAL_SERVICE_TOP = 6;
const LOCAL_FILL_TOP = 5;
const FABRICATION_TOP = 10;
const ELECTRONICS_TOP = 10;

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
    label: "Vets",
    description: "Veterinarians and animal clinics.",
    query: "best veterinarians and animal clinics",
  },
  {
    slug: "pet-shops",
    label: "Pet Shops",
    description: "Pet food, accessories, and pet retail.",
    query: "best pet shops pet stores and pet food",
    topN: LOCAL_SERVICE_TOP,
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

  // Trades (split from former home-services) — budgeted topN
  {
    slug: "plumbers",
    label: "Plumbers",
    description: "Plumbing, geysers, and drain clearing.",
    query: "best plumbers and plumbing services",
    topN: LOCAL_SERVICE_TOP,
  },
  {
    slug: "electricians",
    label: "Electricians",
    description: "Electrical repairs and installations.",
    query: "best electricians and electrical services",
    topN: LOCAL_SERVICE_TOP,
  },
  {
    slug: "locksmiths",
    label: "Locksmiths",
    description: "Lockouts, keys, and lock changes.",
    query: "best locksmiths",
    topN: LOCAL_SERVICE_TOP,
  },
  {
    slug: "handyman",
    label: "Handymen",
    description: "General repairs, gate motors, and odd jobs.",
    query: "best handymen and handyman services",
    topN: LOCAL_SERVICE_TOP,
  },
  {
    slug: "hvac",
    label: "Aircon & HVAC",
    description: "Air conditioning install, service, and repair.",
    query: "best air conditioning and HVAC technicians",
    topN: LOCAL_SERVICE_TOP,
  },

  // Ballito local essentials — budgeted topN
  {
    slug: "property",
    label: "Estate Agents",
    description: "Estate agents, lettings, and property sales.",
    query: "best estate agents and real estate agencies",
    topN: LOCAL_SERVICE_TOP,
  },
  {
    slug: "security",
    label: "Security",
    description: "Armed response, alarms, and CCTV.",
    query: "best security companies armed response and CCTV",
    topN: LOCAL_SERVICE_TOP,
  },
  {
    slug: "telecom",
    label: "Internet & Fibre",
    description: "Fibre, internet, and connectivity providers.",
    query: "best fibre internet and telecom providers",
    topN: LOCAL_SERVICE_TOP,
  },
  {
    slug: "movers",
    label: "Movers & Removals",
    description: "Furniture removals and relocation help.",
    query: "best movers and furniture removals",
    topN: LOCAL_SERVICE_TOP,
  },
  {
    slug: "cleaning",
    label: "Cleaning Services",
    description: "Home, office, and deep cleaning.",
    query: "best cleaning services and cleaners",
    topN: LOCAL_SERVICE_TOP,
  },
  {
    slug: "pool-services",
    label: "Pool Services",
    description: "Pool cleaning, repairs, and maintenance.",
    query: "best pool cleaning and pool services",
    topN: LOCAL_SERVICE_TOP,
  },
  {
    slug: "landscaping",
    label: "Garden & Landscaping",
    description: "Gardeners, landscapers, and lawn care.",
    query: "best landscapers gardeners and garden services",
    topN: LOCAL_SERVICE_TOP,
  },
  {
    slug: "pest-control",
    label: "Pest Control",
    description: "Pest and insect control for homes and estates.",
    query: "best pest control services",
    topN: LOCAL_SERVICE_TOP,
  },
  {
    slug: "contractors",
    label: "Builders & Contractors",
    description: "Builders, painters, and renovation contractors.",
    query: "best builders painters and renovation contractors",
    topN: LOCAL_SERVICE_TOP,
  },
  {
    slug: "legal",
    label: "Attorneys & Legal",
    description: "Lawyers, conveyancers, and legal advice.",
    query: "best attorneys lawyers and conveyancers",
    topN: LOCAL_SERVICE_TOP,
  },
  {
    slug: "accountants",
    label: "Accountants",
    description: "Accountants, bookkeepers, and tax advisors.",
    query: "best accountants bookkeepers and tax advisors",
    topN: LOCAL_SERVICE_TOP,
  },

  // Auto, fabrication, fitness, leisure
  {
    slug: "fabrication",
    label: "Welding & Fabrication",
    description: "Welders, metal fabricators, and trailer/bodywork shops.",
    query: "best welders metal fabricators trailer fabrication boilermakers steel fabricators",
    topN: FABRICATION_TOP,
  },
  {
    slug: "automotive",
    label: "Automotive",
    description: "Mechanics, car washes, and auto services.",
    query: "best car mechanics and auto repair",
  },
  {
    slug: "panel-beaters",
    label: "Panel Beaters",
    description: "Panel beating, spray painting, and body repairs.",
    query: "best panel beaters spray painters and body repair",
    topN: LOCAL_SERVICE_TOP,
  },
  {
    slug: "tyres",
    label: "Tyres & Fitment",
    description: "Tyre shops, wheel alignment, and fitment centres.",
    query: "best tyre shops wheel alignment and fitment centres",
    topN: LOCAL_SERVICE_TOP,
  },
  {
    slug: "electronics",
    label: "Electronics & Computers",
    description: "Electronics, computer, phone, and gaming retailers.",
    query:
      "electronics stores computer shops phone shops Incredible Connection Game Matrix Warehouse HiFi Corp Game store",
    topN: ELECTRONICS_TOP,
  },
  {
    slug: "sporting-goods",
    label: "Sporting Goods",
    description: "Sports shops, outdoor gear, and fitness retail.",
    query:
      "sporting goods stores Totalsports Sportsmans Warehouse Captec outdoor gear",
    topN: LOCAL_SERVICE_TOP,
  },
  {
    slug: "furniture",
    label: "Furniture & Homeware",
    description: "Furniture, bedding, and homeware stores.",
    query: "furniture stores homeware bedding and decor shops",
    topN: LOCAL_SERVICE_TOP,
  },
  {
    slug: "surf-shops",
    label: "Surf & Beach Gear",
    description: "Surf shops, boards, and beach lifestyle retail.",
    query: "surf shops surfboards beach gear and watersports stores",
    topN: LOCAL_SERVICE_TOP,
  },
  {
    slug: "baby-toys",
    label: "Baby & Toys",
    description: "Baby stores, toys, and kids retail.",
    query: "baby shops toy stores kids retail baby clothing",
    topN: LOCAL_SERVICE_TOP,
  },
  {
    slug: "stationery",
    label: "Stationery & Office",
    description: "Stationery, office supplies, and print shops.",
    query: "stationery shops office supplies print and copy shops",
    topN: LOCAL_SERVICE_TOP,
  },
  {
    slug: "bike-shops",
    label: "Bike Shops",
    description: "Bicycle shops, repairs, and cycling gear.",
    query: "bicycle shops bike stores cycling gear and repairs",
    topN: LOCAL_SERVICE_TOP,
  },
  {
    slug: "marine",
    label: "Marine & Boating",
    description: "Boat shops, marine supplies, and watersports retail.",
    query: "boat dealers marine chandlery yacht supplies boat repairs",
    topN: LOCAL_SERVICE_TOP,
  },
  {
    slug: "music-instruments",
    label: "Music & Instruments",
    description: "Music shops, guitar stores, and instrument services.",
    query:
      "music shops guitar stores musical instrument stores piano shops restringing",
    topN: LOCAL_SERVICE_TOP,
  },

  // Gap-fill verticals (Ballito Google / mall / local directory coverage)
  {
    slug: "physio",
    label: "Physio & Chiro",
    description: "Physiotherapy, chiropractic, and biokinetics.",
    query: "physiotherapy chiropractors biokinetics sports physio",
    topN: LOCAL_FILL_TOP,
  },
  {
    slug: "travel",
    label: "Travel & Tours",
    description: "Travel agents and tour operators.",
    query: "travel agents tour operators and travel agencies",
    topN: LOCAL_FILL_TOP,
  },
  {
    slug: "car-rental",
    label: "Car Rental & Transport",
    description: "Car hire, shuttles, and taxi services.",
    query: "car rental shuttle taxi and airport transfers",
    topN: LOCAL_FILL_TOP,
  },
  {
    slug: "entertainment",
    label: "Cinema & Entertainment",
    description: "Cinemas, karting, and entertainment centres.",
    query: "cinema movie theatre karting and entertainment centres",
    topN: LOCAL_FILL_TOP,
  },
  {
    slug: "clothing",
    label: "Clothing & Fashion",
    description: "Clothing stores and fashion retail.",
    query: "clothing stores fashion boutiques mens and womens wear",
    topN: LOCAL_FILL_TOP,
  },
  {
    slug: "footwear",
    label: "Footwear",
    description: "Shoe stores and footwear retail.",
    query: "shoe stores footwear and sneaker shops",
    topN: LOCAL_FILL_TOP,
  },
  {
    slug: "jewellery",
    label: "Jewellery",
    description: "Jewellery stores and watch retailers.",
    query: "jewellery stores jewellers and watch shops",
    topN: LOCAL_FILL_TOP,
  },
  {
    slug: "insurance",
    label: "Insurance & Advisors",
    description: "Insurance brokers and financial advisors.",
    query: "insurance brokers financial advisors and wealth managers",
    topN: LOCAL_FILL_TOP,
  },
  {
    slug: "car-dealerships",
    label: "Car Dealerships",
    description: "New and used vehicle dealerships.",
    query: "car dealerships vehicle sales and used car dealers",
    topN: LOCAL_FILL_TOP,
  },
  {
    slug: "solar",
    label: "Solar PV",
    description: "Solar panel installers and PV systems.",
    query: "solar PV installers solar panels and inverters",
    topN: LOCAL_FILL_TOP,
  },
  {
    slug: "hospitals",
    label: "Hospitals & Emergency",
    description: "Hospitals, emergency rooms, and urgent care.",
    query: "hospitals emergency rooms Netcare and medical centres",
    topN: LOCAL_FILL_TOP,
  },
  {
    slug: "photography",
    label: "Photography",
    description: "Photographers and photo studios.",
    query: "photographers photography studios and photo services",
    topN: LOCAL_FILL_TOP,
  },
  {
    slug: "events",
    label: "Events & Venues",
    description: "Wedding, conference, and function venues.",
    query: "wedding venues conference venues event planners and halls",
    topN: LOCAL_FILL_TOP,
  },
  {
    slug: "golf",
    label: "Golf",
    description: "Golf clubs and courses.",
    query: "golf clubs golf courses and driving ranges",
    topN: LOCAL_FILL_TOP,
  },
  {
    slug: "garden-centres",
    label: "Garden Centres",
    description: "Nurseries and garden centres.",
    query: "garden centres nurseries and plant nurseries",
    topN: LOCAL_FILL_TOP,
  },
  {
    slug: "blinds-flooring",
    label: "Blinds & Flooring",
    description: "Blinds, flooring, and curtain suppliers.",
    query: "blinds flooring curtains and laminate flooring",
    topN: LOCAL_FILL_TOP,
  },
  {
    slug: "paint",
    label: "Paint & Decor",
    description: "Paint shops and decor suppliers.",
    query: "paint shops decor suppliers and painting supplies",
    topN: LOCAL_FILL_TOP,
  },
  {
    slug: "appliance-repair",
    label: "Appliance Repair",
    description: "Appliance and white-goods repair.",
    query: "appliance repair washing machine fridge and oven repair",
    topN: LOCAL_FILL_TOP,
  },
  {
    slug: "auto-parts",
    label: "Auto Parts & Glass",
    description: "Auto parts, spares, and windscreens.",
    query: "auto parts spares windscreen and car glass",
    topN: LOCAL_FILL_TOP,
  },
  {
    slug: "tattoo",
    label: "Tattoo & Piercing",
    description: "Tattoo studios and piercing shops.",
    query: "tattoo studios piercing shops and tattoo artists",
    topN: LOCAL_FILL_TOP,
  },
  {
    slug: "pet-grooming",
    label: "Pet Grooming",
    description: "Pet grooming, dog walking, and pet sitters.",
    query: "pet grooming dog walking pet sitters and grooming parlours",
    topN: LOCAL_FILL_TOP,
  },
  {
    slug: "storage",
    label: "Self Storage",
    description: "Self-storage and mini storage units.",
    query: "self storage mini storage and storage units",
    topN: LOCAL_FILL_TOP,
  },
  {
    slug: "skip-hire",
    label: "Skip Hire & Waste",
    description: "Skip hire and waste removal.",
    query: "skip hire waste removal and rubbish collection",
    topN: LOCAL_FILL_TOP,
  },
  {
    slug: "architects",
    label: "Architects & Engineers",
    description: "Architects, engineers, and draughting.",
    query: "architects engineers draughtsmen and structural engineers",
    topN: LOCAL_FILL_TOP,
  },
  {
    slug: "books",
    label: "Bookstores",
    description: "Bookshops and magazine stores.",
    query: "bookstores book shops and Exclusive Books",
    topN: LOCAL_FILL_TOP,
  },
  {
    slug: "funeral",
    label: "Funeral Services",
    description: "Funeral homes and undertakers.",
    query: "funeral services undertakers and funeral homes",
    topN: LOCAL_FILL_TOP,
  },
  {
    slug: "shoe-repair",
    label: "Shoe Repair & Keys",
    description: "Shoe repair and key cutting.",
    query: "shoe repair key cutting and cobblers",
    topN: LOCAL_FILL_TOP,
  },
  {
    slug: "employment",
    label: "Employment Agencies",
    description: "Recruitment and employment agencies.",
    query: "employment agencies recruitment and staffing agencies",
    topN: LOCAL_FILL_TOP,
  },
  {
    slug: "debt-collection",
    label: "Debt Collection",
    description: "Debt collection and recovery agencies.",
    query: "debt collectors collection agencies and credit recovery",
    topN: LOCAL_FILL_TOP,
  },
  {
    slug: "farm-supplies",
    label: "Farm Supplies",
    description: "Farm supplies and agricultural stores.",
    query: "farm supplies agricultural stores and feed suppliers",
    topN: LOCAL_FILL_TOP,
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
    description: "Malls, boutiques, and general retail centres.",
    query: "best shopping centres and malls",
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

export function getVertical(slug: string): Vertical | undefined {
  return VERTICALS.find((v) => v.slug === slug);
}

/** Effective Google fetch limit for a vertical. */
export function topForVertical(
  vertical: Vertical,
  fallback: number = TOP_PER_VERTICAL,
): number {
  return vertical.topN ?? fallback;
}

/** Sum of budgeted (explicit topN) local-service vertical slots. */
export function localServiceBudgetUsed(): number {
  return VERTICALS.reduce(
    (sum, v) => sum + (typeof v.topN === "number" ? v.topN : 0),
    0,
  );
}

/** Verticals in the budgeted local-service expansion set (explicit topN). */
export function localServiceVerticals(): readonly Vertical[] {
  return VERTICALS.filter((v) => typeof v.topN === "number");
}

const _localBudget = localServiceBudgetUsed();
if (_localBudget > LOCAL_SERVICE_BUSINESS_BUDGET) {
  throw new Error(
    `Local-service vertical budget ${_localBudget} exceeds cap ${LOCAL_SERVICE_BUSINESS_BUDGET}`,
  );
}
