import { googlePlacesProvider } from "./google-places.provider";
import { facebookProvider } from "./facebook.provider";
import { directoryProvider } from "./directory.provider";
import { manualSubmissionProvider } from "./manual-submission.provider";
import type { BusinessDataProvider } from "./types";

export * from "./types";

/** All registered providers, keyed by provider name. */
export const PROVIDERS: Record<string, BusinessDataProvider> = {
  [googlePlacesProvider.name]: googlePlacesProvider,
  [facebookProvider.name]: facebookProvider,
  [directoryProvider.name]: directoryProvider,
  [manualSubmissionProvider.name]: manualSubmissionProvider,
};

export function getProvider(name: string): BusinessDataProvider {
  const provider = PROVIDERS[name];
  if (!provider) throw new Error(`Unknown provider: ${name}`);
  return provider;
}

/** Providers that are currently configured and usable. */
export function getActiveProviders(): BusinessDataProvider[] {
  return Object.values(PROVIDERS).filter((p) => p.isConfigured());
}
