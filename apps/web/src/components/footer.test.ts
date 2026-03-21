import { describe, expect, test } from "bun:test";

const footerSource = await Bun.file(new URL("./footer.tsx", import.meta.url)).text();

describe("footer external links", () => {
	test("renders the GitHub link as a plain anchor instead of localized Link", () => {
		expect(footerSource).toContain("<a");
		expect(footerSource).toContain('href={SOCIAL_LINKS.github}');
		expect(footerSource).not.toContain("<Link\n\t\t\t\t\t\thref={SOCIAL_LINKS.github}");
		expect(footerSource).not.toContain("<Link\r\n\t\t\t\t\t\thref={SOCIAL_LINKS.github}");
	});
});
