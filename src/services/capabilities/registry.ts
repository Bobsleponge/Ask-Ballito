import type { CapabilityId } from "@/services/planner/types";
import type { Capability } from "./types";
import { businessSearchCapability } from "./business-search.capability";
import { staticDatasetCapability } from "./static-dataset.capability";
import { faqCapability } from "./faq.capability";

const CAPABILITIES: Partial<Record<CapabilityId, Capability>> = {
  business_search: businessSearchCapability,
  static_dataset: staticDatasetCapability,
  faq: faqCapability,
};

export function getCapability(id: CapabilityId): Capability | undefined {
  return CAPABILITIES[id];
}
