import type { NormalizedBusiness } from "@/lib/schemas/business";
import type { BusinessDataProvider } from "./types";

/**
 * Future provider for Facebook business pages. Stubbed against the common
 * interface so it can be enabled without architectural changes.
 */
export class FacebookProvider implements BusinessDataProvider {
  readonly name = "facebook";

  isConfigured(): boolean {
    return false;
  }

  async search(): Promise<NormalizedBusiness[]> {
    throw new Error("FacebookProvider is not implemented yet.");
  }

  async getDetails(): Promise<NormalizedBusiness | null> {
    throw new Error("FacebookProvider is not implemented yet.");
  }
}

export const facebookProvider = new FacebookProvider();
