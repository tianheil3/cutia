import { describe, expect, test } from "bun:test";

const timelineManagerSource = await Bun.file(
	new URL("./timeline-manager.ts", import.meta.url),
).text();

describe("timeline manager animation api", () => {
	test("exposes explicit animation methods", () => {
		expect(timelineManagerSource).toContain("addKeyframes({");
		expect(timelineManagerSource).toContain("removeKeyframes({");
		expect(timelineManagerSource).toContain("setAnimationPreset({");
	});

	test("routes animation writes through dedicated commands", () => {
		expect(timelineManagerSource).toContain("UpdateElementAnimationsCommand");
		expect(timelineManagerSource).not.toContain(
			"new UpdateElementCommand(trackId, elementId, { animations",
		);
	});
});
