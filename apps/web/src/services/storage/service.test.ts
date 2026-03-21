import { describe, expect, test } from "bun:test";

const storageServiceSource = await Bun.file(
	new URL("./service.ts", import.meta.url),
).text();

describe("storage service browser compatibility", () => {
	test("guards navigator.storage.estimate before reading quota usage", () => {
		expect(storageServiceSource).toContain(
			'typeof navigator.storage?.estimate === "function"',
		);
		expect(storageServiceSource).not.toContain(
			"const estimate = await navigator.storage.estimate();",
		);
	});

	test("falls back to IndexedDB-backed file storage when OPFS is unavailable", () => {
		expect(storageServiceSource).toContain("OPFSAdapter.isSupported()");
		expect(storageServiceSource).toContain("new IndexedDBFileAdapter(");
	});
});
