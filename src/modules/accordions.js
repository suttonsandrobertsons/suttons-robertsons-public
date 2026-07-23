import { BREAKPOINT_QUERIES } from "../utils/breakpoints.js";

let instances = [];
let hasCreatedAccordionEase = false;
let hasBoundFinsweetEvents = false;

const accordionEaseName = "cssEase";
const accordionEaseCurve = "M0,0 C0.25,0.1 0.25,1 1,1";
const defaults = {
	closeOthers: true,
	breakpoints: "",
};

const selectors = {
	component: '[data-accordion="component"]',
	item: '[data-accordion="item"]',
	trigger: '[data-accordion="trigger"]',
	content: '[data-accordion="content"]',
	icon: '[data-accordion="icon"]',
};

function qsa(root, selector) {
	return Array.from(root.querySelectorAll(selector));
}

function isAccordionScope(value) {
	return Boolean(value) && typeof value.querySelectorAll === "function";
}

function normalizeInitArgs(scopeOrSettings = document, maybeSettings = {}) {
	if (isAccordionScope(scopeOrSettings)) {
		return {
			scope: scopeOrSettings,
			settings: maybeSettings,
		};
	}

	return {
		scope: document,
		settings: scopeOrSettings || {},
	};
}

function getAccordionRoots(scope = document) {
	if (!scope) return [];

	const roots = [];
	const seen = new Set();

	const pushUnique = (element) => {
		if (!element || seen.has(element)) return;

		seen.add(element);
		roots.push(element);
	};

	const canMatch = typeof scope.matches === "function";
	const canQuery = typeof scope.querySelectorAll === "function";

	if (canMatch && scope.matches(selectors.component)) {
		pushUnique(scope);
	}

	if (canQuery) {
		qsa(scope, selectors.component).forEach(pushUnique);
	}

	const pushStandaloneItem = (item) => {
		if (!item || item.closest(selectors.component)) return;
		pushUnique(item);
	};

	if (canMatch && scope.matches(selectors.item)) {
		pushStandaloneItem(scope);
	}

	if (canQuery) {
		qsa(scope, selectors.item).forEach(pushStandaloneItem);
	}

	return roots;
}

function getItemsFromRoot(root) {
	if (!root) return [];

	if (typeof root.matches === "function" && root.matches(selectors.item)) {
		return [root];
	}

	return qsa(root, selectors.item);
}

function getAccordionEase() {
	if (typeof CustomEase === "undefined") {
		return "power2.inOut";
	}

	if (!hasCreatedAccordionEase) {
		CustomEase.create(accordionEaseName, accordionEaseCurve);
		hasCreatedAccordionEase = true;
	}

	return accordionEaseName;
}

function getBooleanSetting(root, attributeName, fallbackValue) {
	const attributeValue = root.getAttribute(attributeName);

	if (attributeValue === null) {
		return fallbackValue;
	}

	return attributeValue === "true";
}

function parseBreakpointList(value) {
	if (!value || typeof value !== "string") return [];

	return value
		.split(",")
		.map((breakpoint) => breakpoint.trim().toLowerCase())
		.filter((breakpoint) => breakpoint in BREAKPOINT_QUERIES);
}

function getBreakpointSetting(root, userSettings) {
	const attributeValue = root.getAttribute("data-accordion-breakpoints");
	const settingValue = userSettings.breakpoints;

	return parseBreakpointList(attributeValue || settingValue);
}

function matchesBreakpoints(breakpoints) {
	if (!breakpoints.length) return true;

	return breakpoints.some(
		(breakpoint) => window.matchMedia(BREAKPOINT_QUERIES[breakpoint]).matches,
	);
}

function resetItemNativeState(record) {
	record.item.classList.remove("is-open");
	record.trigger.removeAttribute("aria-expanded");
	record.timeline.pause(0);
	gsap.set(record.content, { clearProps: "height,overflow" });

	if (record.icon) {
		gsap.set(record.icon, { clearProps: "rotation,transform" });
	}
}

function bindRecord(record) {
	if (record.isBound) return;

	record.trigger.addEventListener("click", record.onTriggerClick);
	record.isBound = true;
}

function unbindRecord(record) {
	if (!record.isBound) return;

	record.trigger.removeEventListener("click", record.onTriggerClick);
	record.isBound = false;
}

function setItemOpenState(record, isOpen) {
	if (!record.instance?.isActive) return;

	record.item.classList.toggle("is-open", isOpen);
	record.trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");

	// The timeline is rendered during setup, so GSAP caches the resolved value of
	// `height: "auto"`. Content injected later would otherwise animate to that
	// stale height before snapping to its current auto height.
	record.timeline.invalidate();

	if (isOpen) {
		record.timeline.play();
		return;
	}

	record.timeline.reverse();
}

function pushScope(scopes, scope) {
	if (!scope || typeof scope.querySelectorAll !== "function") return;
	if (!scopes.includes(scope)) {
		scopes.push(scope);
	}
}

function getFinsweetScopes(instance) {
	const scopes = [];

	pushScope(scopes, instance?.listInstance?.list);
	pushScope(scopes, instance?.listInstance?.wrapper);
	pushScope(scopes, instance?.list);
	pushScope(scopes, instance?.element);

	if (Array.isArray(instance?.items)) {
		instance.items.forEach((item) => {
			pushScope(scopes, item?.element || item);
		});
	}

	if (!scopes.length) {
		pushScope(scopes, document);
	}

	return scopes;
}

function bindFinsweetEvents() {
	if (hasBoundFinsweetEvents || typeof window === "undefined") return;

	hasBoundFinsweetEvents = true;
	window.fsAttributes = window.fsAttributes || [];

	// CMS Filter may swap visible list items; re-run accordion init within that list.
	window.fsAttributes.push([
		"cmsfilter",
		(filterInstances) => {
			filterInstances.forEach((filterInstance) => {
				if (typeof filterInstance?.listInstance?.on !== "function") return;

				filterInstance.listInstance.on("renderitems", () => {
					getFinsweetScopes(filterInstance).forEach((scope) => {
						initAccordions(scope);
					});
				});
			});
		},
	]);

	// CMS Load appends new items; initialize accordions in changed list scope.
	window.fsAttributes.push([
		"cmsload",
		(loadInstances) => {
			loadInstances.forEach((loadInstance) => {
				if (typeof loadInstance?.on !== "function") return;

				loadInstance.on("pagechanged", () => {
					getFinsweetScopes(loadInstance).forEach((scope) => {
						initAccordions(scope);
					});
				});
			});
		},
	]);
}

export function createAccordion(root, userSettings = {}) {
	if (!root || root._accordionInstance) return root?._accordionInstance || null;

	if (typeof gsap === "undefined") {
		console.warn("[accordions] gsap not found.");
		return null;
	}

	const settings = {
		...defaults,
		...userSettings,
	};
	const isComponentRoot = root.matches(selectors.component);
	const allowFirstOpen = root.getAttribute("data-accordion-first-open") === "true";
	const activeBreakpoints = getBreakpointSetting(root, settings);
	const closeOthers = isComponentRoot
		? getBooleanSetting(root, "data-accordion-close-others", settings.closeOthers)
		: false;
	const ease = getAccordionEase();
	const items = getItemsFromRoot(root);
	const records = [];

	const instance = {
		root,
		items: records,
		settings: null,
		isActive: null,
		mediaQueries: [],
		evaluateBreakpointState: null,
		destroy: null,
	};

	items.forEach((item, index) => {
		const trigger = item.querySelector(selectors.trigger);
		const content = item.querySelector(selectors.content);
		const icon = item.querySelector(selectors.icon);

		if (!trigger || !content) return;

		const isInitiallyOpen = allowFirstOpen && index === 0;

		const timeline = gsap.timeline({
			paused: true,
			reversed: !isInitiallyOpen,
		});

		timeline.fromTo(
			content,
			{ height: 0 },
			{
				height: "auto",
				duration: 0.4,
				ease,
			},
		);

		if (icon) {
			timeline.fromTo(
				icon,
				{ rotation: 0 },
				{
					rotation: 180,
					duration: 0.4,
					ease,
				},
				"<",
			);
		}

		const record = {
			instance,
			item,
			trigger,
			content,
			icon,
			timeline,
			onTriggerClick: null,
			isInitiallyOpen,
			isBound: false,
		};

		record.onTriggerClick = () => {
			const isOpen = item.classList.contains("is-open");

			if (closeOthers) {
				records.forEach((otherRecord) => {
					if (otherRecord !== record) {
						setItemOpenState(otherRecord, false);
					}
				});
			}

			setItemOpenState(record, !isOpen);
		};

		records.push(record);
	});

	instance.settings = {
		...settings,
		closeOthers,
		breakpoints: activeBreakpoints,
	};

	instance.mediaQueries = activeBreakpoints.map((breakpoint) =>
		window.matchMedia(BREAKPOINT_QUERIES[breakpoint]),
	);

	instance.evaluateBreakpointState = () => {
		const shouldBeActive = matchesBreakpoints(activeBreakpoints);

		if (shouldBeActive === instance.isActive) return;

		instance.isActive = shouldBeActive;

		records.forEach((record) => {
			if (shouldBeActive) {
				bindRecord(record);

				gsap.set(record.content, {
					height: record.isInitiallyOpen ? "auto" : 0,
					overflow: "hidden",
				});

				if (record.icon) {
					gsap.set(record.icon, {
						rotation: record.isInitiallyOpen ? 180 : 0,
					});
				}

				record.item.classList.toggle("is-open", record.isInitiallyOpen);
				record.trigger.setAttribute("aria-expanded", record.isInitiallyOpen ? "true" : "false");
				record.timeline.progress(record.isInitiallyOpen ? 1 : 0).pause();
				return;
			}

			unbindRecord(record);
			resetItemNativeState(record);
		});
	};

	instance.destroy = () => {
		instance.mediaQueries.forEach((mediaQuery) => {
			mediaQuery.removeEventListener("change", instance.evaluateBreakpointState);
		});

		records.forEach((record) => {
			unbindRecord(record);
			record.timeline.kill();
			resetItemNativeState(record);
		});

		root._accordionInstance = null;
		instances = instances.filter((accordion) => accordion.root !== root);
	};

	instance.mediaQueries.forEach((mediaQuery) => {
		mediaQuery.addEventListener("change", instance.evaluateBreakpointState);
	});

	instance.evaluateBreakpointState();

	root._accordionInstance = instance;
	instances.push(instance);

	return instance;
}

export function initAccordions(scopeOrSettings = document, maybeSettings = {}) {
	const { scope, settings } = normalizeInitArgs(scopeOrSettings, maybeSettings);

	bindFinsweetEvents();

	return getAccordionRoots(scope)
		.map((component) => createAccordion(component, settings))
		.filter(Boolean);
}

export function destroyAccordions(scope) {
	const scopedRoots = scope ? new Set(getAccordionRoots(scope)) : null;

	[...instances].forEach((instance) => {
		if (!scopedRoots || scopedRoots.has(instance.root)) {
			instance.destroy();
		}
	});
}

export function reInitAccordions(scopeOrSettings = document, maybeSettings = {}) {
	const { scope, settings } = normalizeInitArgs(scopeOrSettings, maybeSettings);

	destroyAccordions(scope);
	return initAccordions(scope, settings);
}

export function getAccordionInstances() {
	return [...instances];
}
