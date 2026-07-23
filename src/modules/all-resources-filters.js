import { DESKTOP_MEDIA_QUERY } from "../utils/breakpoints.js";

let hasCreatedFiltersEase = false;

const filtersEaseName = "allResourcesFiltersEase";
const filtersEaseCurve = "M0,0 C0.25,0.1 0.25,1 1,1";

const selectors = {
	trigger: ".all-resources_filter-btn-wrap",
	panel: ".all-resources_filters",
	text: ".all-resources_filter-btn-text",
};

const labels = {
	closed: "Open filters",
	open: "Close filters",
	openWithApplied: "Apply filters",
};

let instance = null;

function getLabel({ isOpen, hasAppliedFilters }) {
	if (!isOpen) return labels.closed;
	if (hasAppliedFilters) return labels.openWithApplied;
	return labels.open;
}

function normalizeAppliedStateResolver(value) {
	if (typeof value === "function") return value;
	return () => false;
}

function isClearControl(field) {
	if (!field) return false;

	const clearElement = field.getAttribute("fs-list-element");
	if (clearElement === "clear") return true;

	const listValue = field.getAttribute("fs-list-value");
	if (typeof listValue === "string" && listValue.trim() === "") return true;

	return false;
}

function hasMeaningfulSelection(field) {
	if (!field || isClearControl(field)) return false;

	if (field.matches('input[type="checkbox"], input[type="radio"]')) {
		return field.checked;
	}

	if (field.matches('input[type="text"], input[type="search"], textarea')) {
		return field.value.trim().length > 0;
	}

	if (field.matches("select")) {
		const selectedValue = (field.value || "").trim();
		return selectedValue.length > 0;
	}

	return false;
}

function hasActiveFilters(panel) {
	if (!panel) return false;

	const activeFields = panel.querySelectorAll(
		"input.is-list-active, select.is-list-active, textarea.is-list-active",
	);

	for (const field of activeFields) {
		if (hasMeaningfulSelection(field)) {
			return true;
		}
	}

	// Fallback for fields that may not use .is-list-active during transition states.
	const filterFields = panel.querySelectorAll("[fs-list-field]");

	for (const field of filterFields) {
		if (hasMeaningfulSelection(field)) {
			return true;
		}
	}

	return false;
}

function hasDesktopMatch(mediaQuery) {
	return Boolean(mediaQuery?.matches);
}

function getFiltersEase() {
	if (typeof CustomEase === "undefined") {
		return "power2.inOut";
	}

	if (!hasCreatedFiltersEase) {
		CustomEase.create(filtersEaseName, filtersEaseCurve);
		hasCreatedFiltersEase = true;
	}

	return filtersEaseName;
}

export function initAllResourcesFilters(options = {}) {
	if (instance) {
		instance.destroy();
	}

	if (typeof gsap === "undefined") {
		console.warn("[all-resources-filters] gsap not found.");
		return null;
	}

	const trigger = document.querySelector(selectors.trigger);
	const panel = document.querySelector(selectors.panel);
	const text = document.querySelector(selectors.text);

	if (!trigger || !panel || !text) return null;

	const desktopQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
	const ease = getFiltersEase();
	const state = {
		isOpen: false,
		isAppliedOverride: null,
		hasAppliedFiltersResolver: normalizeAppliedStateResolver(
			options.hasAppliedFilters || (() => hasActiveFilters(panel)),
		),
	};

	const timeline = gsap.timeline({
		paused: true,
		reversed: true,
	});

	timeline.to(panel, {
		height: "auto",
		duration: 0.4,
		ease,
		onStart: () => {
			gsap.set(panel, { overflow: "hidden" });
		},
		onComplete: () => {
			gsap.set(panel, { overflow: "visible" });
		},
		onReverseComplete: () => {
			gsap.set(panel, { overflow: "hidden" });
		},
	});

	const getHasAppliedFilters = () => {
		if (typeof state.isAppliedOverride === "boolean") {
			return state.isAppliedOverride;
		}

		return Boolean(state.hasAppliedFiltersResolver());
	};

	const updateLabel = () => {
		text.textContent = getLabel({
			isOpen: state.isOpen,
			hasAppliedFilters: getHasAppliedFilters(),
		});
	};

	const applyState = () => {
		if (hasDesktopMatch(desktopQuery)) {
			state.isOpen = false;
			timeline.pause(0);
			gsap.set(panel, { clearProps: "height,overflow" });
			trigger.removeAttribute("aria-expanded");
			updateLabel();
			return;
		}

		gsap.set(panel, {
			height: state.isOpen ? "auto" : 0,
			overflow: state.isOpen ? "visible" : "hidden",
		});
		timeline.progress(state.isOpen ? 1 : 0).pause();
		trigger.setAttribute("aria-expanded", state.isOpen ? "true" : "false");
		updateLabel();
	};

	const onTriggerClick = (event) => {
		if (hasDesktopMatch(desktopQuery)) return;

		event.preventDefault();
		state.isOpen = !state.isOpen;

		if (state.isOpen) {
			timeline.play();
		} else {
			gsap.set(panel, { overflow: "hidden" });
			timeline.reverse();
		}

		trigger.setAttribute("aria-expanded", state.isOpen ? "true" : "false");
		updateLabel();
	};

	const onBreakpointChange = () => {
		applyState();
	};

	const onFiltersStateChange = () => {
		updateLabel();
	};

	const filtersObserver = new MutationObserver((mutations) => {
		if (!mutations.length) return;
		onFiltersStateChange();
	});

	trigger.addEventListener("click", onTriggerClick);
	desktopQuery.addEventListener("change", onBreakpointChange);
	panel.addEventListener("change", onFiltersStateChange);
	panel.addEventListener("input", onFiltersStateChange);
	filtersObserver.observe(panel, {
		subtree: true,
		attributes: true,
		attributeFilter: ["class"],
	});
	applyState();

	instance = {
		setHasAppliedFiltersResolver(nextResolver) {
			state.hasAppliedFiltersResolver = normalizeAppliedStateResolver(nextResolver);
			state.isAppliedOverride = null;
			updateLabel();
		},
		setFiltersApplied(isApplied) {
			state.isAppliedOverride = Boolean(isApplied);
			updateLabel();
		},
		clearFiltersAppliedOverride() {
			state.isAppliedOverride = null;
			updateLabel();
		},
		refresh() {
			updateLabel();
		},
		destroy() {
			trigger.removeEventListener("click", onTriggerClick);
			desktopQuery.removeEventListener("change", onBreakpointChange);
			panel.removeEventListener("change", onFiltersStateChange);
			panel.removeEventListener("input", onFiltersStateChange);
			filtersObserver.disconnect();
			timeline.kill();
			gsap.set(panel, { clearProps: "height,overflow" });
			trigger.removeAttribute("aria-expanded");
			instance = null;
		},
	};

	return instance;
}

export function getAllResourcesFiltersInstance() {
	return instance;
}
