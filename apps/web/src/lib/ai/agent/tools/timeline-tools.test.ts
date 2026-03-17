import { describe, expect, test } from "bun:test";

const timelineToolsSource = await Bun.file(
	new URL("./timeline-tools.ts", import.meta.url),
).text();

describe("timeline AI tools", () => {
	test("exposes keyframe operations", () => {
		expect(timelineToolsSource).toContain('name: "get_element_keyframes"');
		expect(timelineToolsSource).toContain('name: "set_element_keyframes"');
		expect(timelineToolsSource).toContain('name: "delete_element_keyframes"');
	});

	test("set_element_keyframes schema accepts batch keyframes", () => {
		expect(timelineToolsSource).toContain('name: "set_element_keyframes"');
		expect(timelineToolsSource).toContain("keyframes:");
		expect(timelineToolsSource).toContain('property: {');
		expect(timelineToolsSource).toContain('time: {');
		expect(timelineToolsSource).toContain('value: {');
		expect(timelineToolsSource).toContain('interpolation: {');
		expect(timelineToolsSource).toContain(
			'required: ["property", "time", "value"]',
		);
	});
});
