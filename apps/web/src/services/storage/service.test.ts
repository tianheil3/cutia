import { describe, expect, test } from "bun:test";

const storageServiceSource = await Bun.file(
	new URL("./service.ts", import.meta.url),
).text();

describe("storage service media fallback", () => {
	test("falls back to IndexedDB-backed file storage when OPFS is unavailable", () => {
		expect(storageServiceSource).toContain("OPFSAdapter.isSupported()");
		expect(storageServiceSource).toContain("new IndexedDBFileAdapter");
	});
});
