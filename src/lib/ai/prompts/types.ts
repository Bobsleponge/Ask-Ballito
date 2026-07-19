/**
 * Prompts are versioned and isolated. Never hardcode prompt strings throughout
 * the app -- import a prompt module and reference its `version` when logging.
 */
export interface PromptMeta<TName extends string = string> {
  name: TName;
  version: string;
}
