import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { initTables } from "../tables.js";

const STYLE_ID = "sr-table-overrides";

function renderTable(componentMarkup) {
	document.body.innerHTML = componentMarkup;
}

function tableMarkup(attributes = "") {
	return `
		<table ${attributes}>
			<thead>
				<tr>
					<th>Check</th>
					<th>What to look for</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<th>Seller</th>
					<td>Independent reviews and a clear returns policy.</td>
				</tr>
				<tr>
					<th>Price</th>
					<td>A price far below the market can indicate a counterfeit.</td>
				</tr>
			</tbody>
		</table>
	`;
}

describe("initTables", () => {
	beforeEach(() => {
		renderTable("");
	});

	afterEach(() => {
		renderTable("");
		document.getElementById(STYLE_ID)?.remove();
	});

	it("preserves the existing wrapper-based responsive table contract", () => {
		renderTable(`<div id="table-component" data-table="responsive">${tableMarkup()}</div>`);
		const component = document.getElementById("table-component");

		initTables();

		expect(document.getElementById("table-component")).toBe(component);
		expect(component.hasAttribute("data-table-generated-wrapper")).toBe(false);
		expect(component.getAttribute("data-table-bound")).toBe("true");
		expect(component.querySelector("table").hasAttribute("data-table-desktop")).toBe(true);
		expect(component.querySelectorAll("[data-table-mobile]")).toHaveLength(1);
		expect(component.querySelectorAll(".comparison-table_card")).toHaveLength(2);
	});

	it("supports data-table responsive directly on a table", () => {
		renderTable(
			tableMarkup(
				'data-table="responsive" data-table-align-first-column="left" data-table-highlight-headings="true"',
			),
		);
		const table = document.querySelector("table");

		initTables();

		const component = table.parentElement;

		expect(component.tagName).toBe("DIV");
		expect(component.getAttribute("data-table")).toBe("responsive");
		expect(component.getAttribute("data-table-align-first-column")).toBe("left");
		expect(component.getAttribute("data-table-highlight-headings")).toBe("true");
		expect(component.hasAttribute("data-table-generated-wrapper")).toBe(true);
		expect(component.getAttribute("data-table-bound")).toBe("true");
		expect(table.hasAttribute("data-table")).toBe(false);
		expect(table.hasAttribute("data-table-desktop")).toBe(true);
		expect(component.querySelectorAll(".comparison-table_card")).toHaveLength(2);
	});

	it("does not duplicate generated wrappers or cards when initialised again", () => {
		renderTable(tableMarkup('data-table="responsive"'));

		initTables();
		initTables();

		expect(document.querySelectorAll("[data-table-generated-wrapper]")).toHaveLength(1);
		expect(document.querySelectorAll("[data-table-mobile]")).toHaveLength(1);
		expect(document.querySelectorAll(".comparison-table_card")).toHaveLength(2);
	});

	it("retains direct-table configuration overrides", () => {
		renderTable(
			tableMarkup(
				'data-table="responsive" data-table-bold-values="true" data-table-highlight-header="yes" data-table-highlight-headings="false" data-table-align-first-column="LEFT" data-table-highlight-col="2"',
			),
		);

		initTables();

		const component = document.querySelector('[data-table="responsive"]');

		expect(component.getAttribute("data-table-highlight-header")).toBe("true");
		expect(component.getAttribute("data-table-align-first-column")).toBe("left");
		expect(component.querySelector("table").getAttribute("data-table-highlight-headings")).toBe(
			"false",
		);
		expect(component.querySelectorAll("table .is-highlight")).toHaveLength(3);
		expect(component.querySelectorAll(".comparison-table_card_value.is-bold")).toHaveLength(2);
	});
});
