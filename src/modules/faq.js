import { BREAKPOINT_PX } from "../utils/breakpoints.js";

const DESKTOP_MQ = `(min-width: ${BREAKPOINT_PX.tabletMin}px)`;

const CONFIG = {
	selectors: {
		component: '[data-faq-split="component"]',
		source: '[data-faq-split="source"]',
		item: '[data-faq-split="item"]',
	},

	attributes: {
		target1: "target-1",
		target2: "target-2",
	},

	xTolerance: 8,
};

let hasSplitRun = false;
let lastIsDesktop = null;
let splitMq = null;

function splitByPosition(items, target1, target2) {
	const measuredItems = items.map((item) => ({
		item,
		x: Math.round(item.getBoundingClientRect().left / CONFIG.xTolerance) * CONFIG.xTolerance,
	}));

	const xGroups = [...new Set(measuredItems.map(({ x }) => x))].sort((a, b) => a - b);
	if (xGroups.length < 2) return false;

	const leftX = xGroups[0];
	const rightX = xGroups[xGroups.length - 1];

	measuredItems.forEach(({ item, x }) => {
		const distanceFromLeft = Math.abs(x - leftX);
		const distanceFromRight = Math.abs(x - rightX);

		(distanceFromLeft <= distanceFromRight ? target1 : target2).appendChild(item);
	});

	return true;
}

function splitHalfAndHalf(items, target1, target2) {
	const midpoint = Math.ceil(items.length / 2);

	items.forEach((item, index) => {
		(index < midpoint ? target1 : target2).appendChild(item);
	});

	return true;
}

function splitFaqColumns(strategy) {
	if (hasSplitRun) return;

	const sources = [...document.querySelectorAll(CONFIG.selectors.source)];
	let didSplit = false;

	sources.forEach((source) => {
		const items = [...source.querySelectorAll(CONFIG.selectors.item)];
		if (!items.length) return;

		const component = source.closest(CONFIG.selectors.component);
		if (!component) return;

		const target1 = component.querySelector(`[data-faq-split="${CONFIG.attributes.target1}"]`);
		const target2 = component.querySelector(`[data-faq-split="${CONFIG.attributes.target2}"]`);
		if (!target1 || !target2) return;

		const sourceShouldSplit =
			strategy === "balanced"
				? splitHalfAndHalf(items, target1, target2)
				: splitByPosition(items, target1, target2);

		if (!sourceShouldSplit) return;

		source.remove();
		didSplit = true;
	});

	hasSplitRun = didSplit;
}

function onBreakpointChange(event) {
	const isDesktop = event.matches;

	if (!lastIsDesktop && isDesktop && !hasSplitRun) {
		splitFaqColumns("balanced");
	}

	lastIsDesktop = isDesktop;
}

function initWhenReady() {
	if (!splitMq) {
		splitMq = window.matchMedia(DESKTOP_MQ);
		splitMq.addEventListener("change", onBreakpointChange);
	}

	lastIsDesktop = splitMq.matches;

	if (lastIsDesktop && !hasSplitRun) {
		splitFaqColumns("position");
	}
}

export function initFaq() {
	if (document.documentElement.classList.contains("sr-page-loaded")) {
		initWhenReady();
	} else {
		window.addEventListener("load", initWhenReady, { once: true });
	}
}
