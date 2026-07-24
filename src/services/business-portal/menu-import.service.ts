import "server-only";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { openai, AI_MODEL } from "@/lib/ai/openai";
import { extractedMenuItemSchema } from "@/lib/schemas/business-offerings";
import type { BusinessMenuItemInput } from "@/lib/schemas/business-offerings";

const extractionSchema = z.object({
  items: z.array(extractedMenuItemSchema).max(80),
});

/**
 * Extract menu/service options from a photo or PDF text via the LLM.
 * Always returns a draft list for the owner to review — never auto-publishes.
 */
export class MenuImportService {
  async extractFromImage(params: {
    bytes: Buffer;
    mimeType: string;
    businessName: string;
  }): Promise<BusinessMenuItemInput[]> {
    const base64 = params.bytes.toString("base64");
    const dataUrl = `data:${params.mimeType};base64,${base64}`;

    const res = await openai.responses.parse({
      model: AI_MODEL,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Extract menu items or service options from this photo for "${params.businessName}".
Return structured items with name, optional description, price, and category.
Skip headers, addresses, and phone numbers. If nothing readable, return an empty items array.`,
            },
            {
              type: "input_image",
              image_url: dataUrl,
              detail: "high",
            },
          ],
        },
      ],
      text: {
        format: zodTextFormat(extractionSchema, "menu_extraction"),
      },
    });

    return res.output_parsed?.items ?? [];
  }

  async extractFromPdfText(params: {
    text: string;
    businessName: string;
  }): Promise<BusinessMenuItemInput[]> {
    const trimmed = params.text.replace(/\s+/g, " ").trim();
    if (trimmed.length < 40) {
      throw new Error(
        "Could not read text from this PDF. Upload clear photos of the menu instead.",
      );
    }

    const res = await openai.responses.parse({
      model: AI_MODEL,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Extract menu items or service options from this menu text for "${params.businessName}".
Return structured items with name, optional description, price, and category.
Skip headers, addresses, and phone numbers.

MENU TEXT:
${trimmed.slice(0, 12000)}`,
            },
          ],
        },
      ],
      text: {
        format: zodTextFormat(extractionSchema, "menu_extraction"),
      },
    });

    return res.output_parsed?.items ?? [];
  }

  async extractFromPdfBuffer(params: {
    bytes: Buffer;
    businessName: string;
  }): Promise<BusinessMenuItemInput[]> {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(params.bytes) });
    try {
      const result = await parser.getText();
      return this.extractFromPdfText({
        text: result.text ?? "",
        businessName: params.businessName,
      });
    } finally {
      await parser.destroy();
    }
  }
}

export const menuImportService = new MenuImportService();
