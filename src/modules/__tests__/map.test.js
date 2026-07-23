import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	DEFAULT_MAP_ID,
	BOOTSTRAP_MISSING_ERROR,
	ensureMapId,
	getMapId,
	waitForGoogleMapsBootstrap,
} from "../map.js";

describe("map bootstrap helpers", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		delete window.google;
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("resolves immediately when importLibrary is available", async () => {
		window.google = {
			maps: {
				importLibrary: vi.fn(),
			},
		};

		await expect(waitForGoogleMapsBootstrap()).resolves.toBeUndefined();
	});

	it("waits until importLibrary becomes available", async () => {
		const pending = waitForGoogleMapsBootstrap();

		window.google = {
			maps: {
				importLibrary: vi.fn(),
			},
		};

		await vi.advanceTimersByTimeAsync(50);
		await expect(pending).resolves.toBeUndefined();
	});

	it("rejects when bootstrap never appears", async () => {
		const pending = waitForGoogleMapsBootstrap(200);
		const assertion = expect(pending).rejects.toThrow(BOOTSTRAP_MISSING_ERROR);
		await vi.advanceTimersByTimeAsync(200);
		await assertion;
	});
});

describe("map id helpers", () => {
	it("falls back to the default map id", () => {
		const mapElement = document.createElement("gmp-map");
		expect(getMapId(mapElement)).toBe(DEFAULT_MAP_ID);
	});

	it("prefers an explicit map-id attribute", () => {
		const mapElement = document.createElement("gmp-map");
		mapElement.setAttribute("map-id", "custom-map-id");
		expect(getMapId(mapElement)).toBe("custom-map-id");
	});

	it("writes map-id onto the element when missing", () => {
		const mapElement = document.createElement("gmp-map");
		ensureMapId(mapElement);
		expect(mapElement.getAttribute("map-id")).toBe(DEFAULT_MAP_ID);
		expect(mapElement.mapId).toBe(DEFAULT_MAP_ID);
	});
});
