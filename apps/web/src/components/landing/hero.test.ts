import { describe, expect, test } from "bun:test";

const heroSource = await Bun.file(new URL("./hero.tsx", import.meta.url)).text();

describe("hero rendering stability", () => {
	test("does not use Math.random in the SSR render path", () => {
		expect(heroSource).not.toContain("Math.random()");
	});

	test("renders the GitHub CTA as a plain anchor instead of localized Link", () => {
		expect(heroSource).toContain("<a");
		expect(heroSource).toContain('href={SOCIAL_LINKS.github}');
		expect(heroSource).not.toContain("<Link\n\t\t\t\t\t\thref={SOCIAL_LINKS.github}");
		expect(heroSource).not.toContain("<Link\r\n\t\t\t\t\t\thref={SOCIAL_LINKS.github}");
	});
});
