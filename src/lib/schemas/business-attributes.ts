import { z } from "zod";

/**
 * Structured amenity / capability flags nested under
 * businesses.metadata.attributes and business_profiles.attributes.
 * Keys align with src/config/vertical-listing-fields.ts.
 */
export const businessAttributesSchema = z.object({
  // Hospitality / vibe (original)
  familyFriendly: z.boolean().nullable().optional(),
  romantic: z.boolean().nullable().optional(),
  kidsArea: z.boolean().nullable().optional(),
  seaView: z.boolean().nullable().optional(),
  wheelchair: z.boolean().nullable().optional(),
  petFriendly: z.boolean().nullable().optional(),
  breakfast: z.boolean().nullable().optional(),
  parking: z.boolean().nullable().optional(),
  outdoorSeating: z.boolean().nullable().optional(),
  noiseLevel: z.enum(["quiet", "moderate", "lively"]).nullable().optional(),
  bookingRequired: z.boolean().nullable().optional(),
  rainFriendly: z.boolean().nullable().optional(),
  lateNight: z.boolean().nullable().optional(),

  // Trades / urgency
  emergencyCallOut: z.boolean().nullable().optional(),
  afterHours: z.boolean().nullable().optional(),
  freeQuotes: z.boolean().nullable().optional(),
  insuredRegistered: z.boolean().nullable().optional(),
  residential: z.boolean().nullable().optional(),
  commercial: z.boolean().nullable().optional(),
  towingRoadside: z.boolean().nullable().optional(),
  open24Hours: z.boolean().nullable().optional(),

  // Dining / retail ops
  takeaway: z.boolean().nullable().optional(),
  delivery: z.boolean().nullable().optional(),
  reservations: z.boolean().nullable().optional(),
  veganOptions: z.boolean().nullable().optional(),
  halalOptions: z.boolean().nullable().optional(),
  laptopFriendly: z.boolean().nullable().optional(),
  liveMusic: z.boolean().nullable().optional(),
  cocktails: z.boolean().nullable().optional(),
  freshBread: z.boolean().nullable().optional(),
  cakesCustom: z.boolean().nullable().optional(),
  liquorSales: z.boolean().nullable().optional(),
  wineSelection: z.boolean().nullable().optional(),
  organicProduce: z.boolean().nullable().optional(),
  butcheryCounter: z.boolean().nullable().optional(),
  cardPayments: z.boolean().nullable().optional(),
  returnsAccepted: z.boolean().nullable().optional(),
  giftWrapping: z.boolean().nullable().optional(),

  // Health / professional
  walkIns: z.boolean().nullable().optional(),
  appointmentsOnly: z.boolean().nullable().optional(),
  medicalAidAccepted: z.boolean().nullable().optional(),
  homeVisits: z.boolean().nullable().optional(),
  onlineBooking: z.boolean().nullable().optional(),
  prescriptionDispensing: z.boolean().nullable().optional(),
  eyeTests: z.boolean().nullable().optional(),
  contactLenses: z.boolean().nullable().optional(),
  vaccinations: z.boolean().nullable().optional(),
  grooming: z.boolean().nullable().optional(),

  // Personal care
  colouring: z.boolean().nullable().optional(),
  mensCuts: z.boolean().nullable().optional(),
  nailServices: z.boolean().nullable().optional(),
  massage: z.boolean().nullable().optional(),
  couplesTreatments: z.boolean().nullable().optional(),

  // Everyday services
  atmOnSite: z.boolean().nullable().optional(),
  businessBanking: z.boolean().nullable().optional(),
  dryCleaning: z.boolean().nullable().optional(),
  sameDayService: z.boolean().nullable().optional(),
  selfService: z.boolean().nullable().optional(),
  convenienceStore: z.boolean().nullable().optional(),
  carWash: z.boolean().nullable().optional(),
  toolHire: z.boolean().nullable().optional(),
  cutKeys: z.boolean().nullable().optional(),
  flowerDelivery: z.boolean().nullable().optional(),
  aftercare: z.boolean().nullable().optional(),
  mealsIncluded: z.boolean().nullable().optional(),

  // Fitness / leisure / stays
  classesAvailable: z.boolean().nullable().optional(),
  personalTraining: z.boolean().nullable().optional(),
  wifi: z.boolean().nullable().optional(),
  pool: z.boolean().nullable().optional(),
  airConditioning: z.boolean().nullable().optional(),
  ticketRequired: z.boolean().nullable().optional(),
  guidedTours: z.boolean().nullable().optional(),
  indoorPlay: z.boolean().nullable().optional(),
  outdoorPlay: z.boolean().nullable().optional(),
});

export type BusinessAttributes = z.infer<typeof businessAttributesSchema>;

export function extractAttributes(
  metadata: Record<string, unknown> | null | undefined,
): BusinessAttributes {
  if (!metadata || typeof metadata !== "object") return {};
  const raw = metadata.attributes;
  if (!raw || typeof raw !== "object") return {};
  const parsed = businessAttributesSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}
