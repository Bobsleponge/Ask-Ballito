import type { NormalizedBusiness } from "@/lib/schemas/business";
import type { BusinessDataProvider } from "./types";

/**
 * Future provider for user-submitted businesses. Stubbed against the common
 * interface; will read from a submissions table once moderation is built.
 */
export class ManualSubmissionProvider implements BusinessDataProvider {
  readonly name = "manual_submission";

  isConfigured(): boolean {
    return false;
  }

  async search(): Promise<NormalizedBusiness[]> {
    throw new Error("ManualSubmissionProvider is not implemented yet.");
  }

  async getDetails(): Promise<NormalizedBusiness | null> {
    throw new Error("ManualSubmissionProvider is not implemented yet.");
  }
}

export const manualSubmissionProvider = new ManualSubmissionProvider();
