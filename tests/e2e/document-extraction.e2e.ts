/**
 * E2E test: Document extraction with structured output
 */

import { describe, it, expect, beforeAll } from "vitest";
import { extractDocument } from "../../src/index.js";
import { z } from "zod";
import fs from "fs";
import { skipIfNoApiKey, createProvider, TEST_MODEL } from "./setup.js";

describe("Document Extraction", () => {
  beforeAll(() => {
    if (skipIfNoApiKey()) {
      return;
    }
  });

  it("should extract structured data from PDF", async () => {
    if (!process.env.OPENROUTER_API_KEY) return;

    // Check if a test PDF exists
    const testPdfPath = "./test-document.pdf";
    if (!fs.existsSync(testPdfPath)) {
      console.log(
        `  Skipping document extraction test: No test PDF found at ${testPdfPath}`,
      );
      return;
    }

    const provider = createProvider();

    // Define extraction schema
    const documentSchema = z.object({
      title: z.string(),
      author: z.string().optional(),
      summary: z.string(),
      keyPoints: z.array(z.string()),
      documentType: z.enum([
        "invoice",
        "contract",
        "report",
        "letter",
        "other",
      ]),
    });

    // Read the test PDF
    const pdfBase64 = fs.readFileSync(testPdfPath).toString("base64");

    // Extract structured data using Responses API
    const result = await extractDocument(provider, {
      document: {
        filename: "test-document.pdf",
        fileData: `data:application/pdf;base64,${pdfBase64}`,
      },
      schema: documentSchema,
      model: TEST_MODEL,
      prompt:
        "Extract the title, author if present, a brief summary, key points, and document type from this document.",
    });

    // Verify structure
    expect(typeof result.data.title).toBe("string");
    expect(typeof result.data.summary).toBe("string");
    expect(Array.isArray(result.data.keyPoints)).toBe(true);
    expect([
      "invoice",
      "contract",
      "report",
      "letter",
      "other",
    ]).toContain(result.data.documentType);
  });
});
