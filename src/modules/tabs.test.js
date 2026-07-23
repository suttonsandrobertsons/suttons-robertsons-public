import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { initTabs } from "./tabs.js";

function renderPage(markup) {
	document.body.innerHTML = markup;
}

describe("initTabs", () => {
	beforeEach(() => {
		renderPage("");
	});

	afterEach(() => {
		renderPage("");
	});

	it("hides the tab strip and removes the template when only one tab exists", () => {
		renderPage(`
			<div data-tab-element="component">
				<div data-tab-element="tabs">
					<button data-tab-element="tab-template">
						<span class="tabs_tabs-item-text"></span>
					</button>
				</div>
				<div data-tab-element="panel" data-tab-text="Only tab">
					<p>Panel content</p>
				</div>
			</div>
		`);

		const instances = initTabs();
		const component = document.querySelector('[data-tab-element="component"]');
		const tabsRoot = component.querySelector('[data-tab-element="tabs"]');
		const panel = component.querySelector('[data-tab-element="panel"]');
		const tabs = component.querySelectorAll('[data-tab-element="tab"]');

		expect(instances).toHaveLength(1);
		expect(tabs).toHaveLength(1);
		expect(tabsRoot.style.display).toBe("none");
		expect(tabsRoot.getAttribute("aria-hidden")).toBe("true");
		expect(document.querySelector('[data-tab-element="tab-template"]')).toBeNull();
		expect(panel.classList.contains("is-active")).toBe(true);
		expect(panel.style.display).not.toBe("none");
	});
});
