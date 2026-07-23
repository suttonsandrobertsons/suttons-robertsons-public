import { beforeEach, afterEach, describe, expect, it } from "vitest";

import { initSectionNav } from "../section-nav.js";

function renderPage(markup) {
	document.body.innerHTML = markup;
}

describe("initSectionNav", () => {
	let destroy;

	beforeEach(() => {
		destroy = null;
		renderPage("");
		window.location.hash = "";
	});

	afterEach(() => {
		destroy?.();
		renderPage("");
		window.location.hash = "";
	});

	it("clears stale links and marks the nav empty when no sections exist", () => {
		renderPage(`
			<nav data-section-nav="component">
				<div data-section-nav="progress"></div>
				<ul data-section-nav="list">
					<li><a href="#test">Test link</a></li>
				</ul>
			</nav>
		`);

		destroy = initSectionNav();

		const component = document.querySelector("[data-section-nav='component']");
		const list = component.querySelector("[data-section-nav='list']");

		expect(component.getAttribute("data-section-nav-state")).toBe("empty");
		expect(list.children).toHaveLength(0);
		expect(destroy).toBeNull();
	});

	it("replaces stale links and marks the nav ready when sections exist", () => {
		renderPage(`
			<nav data-section-nav="component">
				<div data-section-nav="progress"></div>
				<ul data-section-nav="list">
					<li><a href="#test">Test link</a></li>
				</ul>
			</nav>
			<section data-section-nav-text="Overview"></section>
		`);

		destroy = initSectionNav();

		const component = document.querySelector("[data-section-nav='component']");
		const list = component.querySelector("[data-section-nav='list']");
		const links = Array.from(list.querySelectorAll("a"));

		expect(component.getAttribute("data-section-nav-state")).toBe("ready");
		expect(list.children).toHaveLength(1);
		expect(links[0].textContent).toBe("Overview");
		expect(links[0].getAttribute("href")).toBe("#overview");
		expect(typeof destroy).toBe("function");
	});
});
