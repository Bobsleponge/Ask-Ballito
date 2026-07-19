import type { NormalizedBusiness } from "@/lib/schemas/business";
import type { BusinessDataProvider } from "./types";

/**
 * Future provider for public business directories. Stubbed against the common
 * interface.
 */
export class DirectoryProvider implements BusinessDataProvider {
  readonly name = "directory";

  isConfigured(): boolean {
    return false;
  }

  async search(): Promise<NormalizedBusiness[]> {
    throw new Error("DirectoryProvider is not implemented yet.");
  }

  async getDetails(): Promise<NormalizedBusiness | null> {
    throw new Error("DirectoryProvider is not implemented yet.");
  }
}

export const directoryProvider = new DirectoryProvider();
