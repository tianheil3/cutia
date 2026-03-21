import { describe, expect, test } from "bun:test";

const mediaViewSource = await Bun.file(
	new URL("./media.tsx", import.meta.url),
).text();

describe("media view image previews", () => {
	test("renders image cards with CSS background images instead of next image", () => {
		const imageBranchMatch = mediaViewSource.match(
			/if \(item\.type === "image"\) \{([\s\S]*?)\n\t\}/,
		);

		expect(imageBranchMatch).not.toBeNull();

		const imageBranch = imageBranchMatch?.[1] ?? "";
		expect(imageBranch).toContain("backgroundImage:");
		expect(imageBranch).toContain("backgroundSize: \"cover\"");
		expect(imageBranch).toContain("backgroundPosition: \"center\"");
		expect(imageBranch).not.toContain("<Image");
	});
});
