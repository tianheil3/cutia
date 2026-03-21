import { describe, expect, test } from "bun:test";

const llmClientSource = await Bun.file(
	new URL("../llm-client.ts", import.meta.url),
).text();

describe("llm client transport", () => {
	test("routes absolute base URLs through the local proxy", () => {
		expect(llmClientSource).toContain("getChatCompletionsUrl");
		expect(llmClientSource).toContain('return `/api/ai/agent/chat?${params.toString()}`');
		expect(llmClientSource).not.toContain("const url = `${baseUrl}/chat/completions`");
	});

	test("allows relative base URLs to keep direct same-origin requests", () => {
		expect(llmClientSource).toContain("baseUrl.startsWith(\"/\")");
		expect(llmClientSource).toContain("return `${normalizedBaseUrl}/chat/completions`");
	});
});
