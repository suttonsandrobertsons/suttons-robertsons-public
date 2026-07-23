import { menuUnderline } from "./tab-underline.js";

const selectors = {
	component: '[data-tab-element="component"]',
	tabs: '[data-tab-element="tabs"]',
	template: '[data-tab-element="tab-template"]',
	panel: '[data-tab-element="panel"]',
	tab: '[data-tab-element="tab"]',
	tabText: ".tabs_tabs-item-text",
	carousel: ".panel-carousel",
	carouselButton: ".panel-carousel_btn",
	carouselList: ".panel-carousel_list",
	carouselSlide: ".panel-carousel_item",
};

const cleanupKey = "__tabsCleanup";
const componentStateAttribute = "data-component-state";
let componentCount = 0;

function qsa(root, selector) {
	return Array.from(root.querySelectorAll(selector));
}

function isScope(value) {
	return Boolean(value) && typeof value.querySelectorAll === "function";
}

function getComponents(scope = document) {
	if (!scope) return [];

	const components = [];

	if (typeof scope.matches === "function" && scope.matches(selectors.component)) {
		components.push(scope);
	}

	if (typeof scope.querySelectorAll === "function") {
		components.push(...scope.querySelectorAll(selectors.component));
	}

	return components;
}

function getScopedElements(root, selector) {
	return qsa(root, selector).filter((element) => element.closest(selectors.component) === root);
}

function getTabLabel(panel, index) {
	const label = panel.getAttribute("data-tab-text");

	if (label?.trim()) {
		return label.trim();
	}

	return `Tab ${index + 1}`;
}

function buildTabFromTemplate(template) {
	const tab = template.cloneNode(true);

	tab.hidden = false;
	tab.removeAttribute("hidden");
	tab.removeAttribute("aria-hidden");
	tab.removeAttribute("inert");
	tab.removeAttribute("id");

	qsa(tab, "[id]").forEach((element) => {
		element.removeAttribute("id");
	});

	if (tab.style.display === "none") {
		tab.style.display = "";
	}

	tab.setAttribute("data-tab-element", "tab");

	return tab;
}

function setTabLabel(tab, label) {
	tab.dataset.text = label;

	const textElement = tab.querySelector(selectors.tabText);

	if (textElement) {
		textElement.textContent = label;
		return;
	}

	tab.textContent = label;
}

function clearExistingTabs(tabsRoot, template) {
	Array.from(tabsRoot.children).forEach((child) => {
		if (child === template) return;

		if (child.matches(selectors.tab) || child.getAttribute("role") === "tab") {
			child.remove();
		}
	});
}

function ensurePanelId(panel, componentId, panelIndex, usedIds) {
	const fallbackId = `tabs-panel-${componentId}-${panelIndex + 1}`;
	const currentId = panel.id?.trim();
	const isDuplicate = currentId && usedIds.has(currentId);
	const panelId = currentId && !isDuplicate ? currentId : fallbackId;

	panel.id = panelId;
	usedIds.add(panelId);

	return panelId;
}

function setElementDisplayVisibility(element, isVisible) {
	if (!element) return;

	element.style.display = isVisible ? "" : "none";
	element.setAttribute("aria-hidden", isVisible ? "false" : "true");
	element.removeAttribute("hidden");
}

function hidePanel(panel, withTransition) {
	if (!panel) return;

	if (typeof gsap !== "undefined") {
		gsap.killTweensOf(panel);
	}

	if (!withTransition || typeof gsap === "undefined") {
		setElementDisplayVisibility(panel, false);

		if (typeof gsap !== "undefined") {
			gsap.set(panel, { clearProps: "opacity,visibility" });
		}

		return;
	}

	gsap.to(panel, {
		autoAlpha: 0,
		duration: 0.2,
		ease: "power1.out",
		onComplete: () => {
			setElementDisplayVisibility(panel, false);
			gsap.set(panel, { clearProps: "opacity,visibility" });
		},
	});
}

function showPanel(panel, withTransition) {
	if (!panel) return;

	if (typeof gsap !== "undefined") {
		gsap.killTweensOf(panel);
	}

	setElementDisplayVisibility(panel, true);

	if (!withTransition || typeof gsap === "undefined") {
		if (typeof gsap !== "undefined") {
			gsap.set(panel, { clearProps: "opacity,visibility" });
		}

		return;
	}

	gsap.fromTo(
		panel,
		{ autoAlpha: 0 },
		{
			autoAlpha: 1,
			duration: 0.25,
			ease: "power1.out",
			clearProps: "opacity,visibility",
		},
	);
}

function getTabIndex(tabs, eventTarget) {
	const tab = eventTarget.closest(selectors.tab);

	if (!tab) return -1;

	return tabs.indexOf(tab);
}

function updateUnderline(tabsRoot, activeTab, withTransition) {
	requestAnimationFrame(() => {
		menuUnderline(tabsRoot, activeTab, undefined, undefined, "", withTransition);
	});
}

function setCarouselButtonState(button, isInactive) {
	if (!button) return;

	button.classList.toggle("is-inactive", isInactive);
	button.disabled = isInactive;
	button.setAttribute("aria-disabled", isInactive ? "true" : "false");
}

function setCarouselControlsState(prevButton, nextButton, index, totalSlides) {
	const isAtStart = index <= 0;
	const isAtEnd = index >= totalSlides - 1;

	setCarouselButtonState(prevButton, isAtStart);
	setCarouselButtonState(nextButton, isAtEnd);
}

function setSlideVisibility(slide, isVisible) {
	if (!slide) return;

	slide.classList.toggle("is-active", isVisible);
	slide.style.display = isVisible ? "" : "none";
	slide.style.opacity = isVisible ? "1" : "0";
	slide.style.visibility = isVisible ? "visible" : "hidden";
	slide.setAttribute("aria-hidden", isVisible ? "false" : "true");
	slide.removeAttribute("hidden");
}

function createPanelCarousel(panel) {
	if (!panel) return null;

	const carousel = panel.querySelector(selectors.carousel);

	if (!carousel) return null;

	const list = carousel.querySelector(selectors.carouselList);

	if (!list) return null;

	const slides = qsa(list, selectors.carouselSlide);

	if (!slides.length) return null;

	const buttons = qsa(carousel, selectors.carouselButton);
	const prevButton = buttons.find((button) => button.classList.contains("is-prev")) || null;
	const nextButton = buttons.find((button) => !button.classList.contains("is-prev")) || null;

	let activeSlideIndex = 0;

	slides.forEach((slide, index) => {
		setSlideVisibility(slide, index === 0);
	});

	setCarouselControlsState(prevButton, nextButton, activeSlideIndex, slides.length);

	function setActiveSlide(nextIndex, options = {}) {
		const { withTransition = true } = options;
		const boundedIndex = Math.max(0, Math.min(nextIndex, slides.length - 1));

		if (boundedIndex === activeSlideIndex) {
			setCarouselControlsState(prevButton, nextButton, activeSlideIndex, slides.length);
			return;
		}

		const previousSlide = slides[activeSlideIndex];
		const nextSlide = slides[boundedIndex];

		activeSlideIndex = boundedIndex;
		setCarouselControlsState(prevButton, nextButton, activeSlideIndex, slides.length);

		if (typeof gsap !== "undefined") {
			gsap.killTweensOf(previousSlide);
			gsap.killTweensOf(nextSlide);
		}

		if (!withTransition || typeof gsap === "undefined") {
			setSlideVisibility(previousSlide, false);
			setSlideVisibility(nextSlide, true);
			return;
		}

		setElementDisplayVisibility(nextSlide, true);
		nextSlide.classList.add("is-active");

		gsap.set(nextSlide, { autoAlpha: 0 });

		gsap.to(previousSlide, {
			autoAlpha: 0,
			duration: 0.22,
			ease: "power1.out",
			onComplete: () => {
				setSlideVisibility(previousSlide, false);
			},
		});

		gsap.to(nextSlide, {
			autoAlpha: 1,
			duration: 0.28,
			ease: "power1.out",
			onComplete: () => {
				nextSlide.style.opacity = "1";
				nextSlide.style.visibility = "visible";
			},
		});
	}

	function onCarouselButtonClick(event) {
		const button = event.target.closest(selectors.carouselButton);

		if (!button || !carousel.contains(button)) return;

		event.preventDefault();

		if (button.classList.contains("is-prev")) {
			setActiveSlide(activeSlideIndex - 1);
			return;
		}

		setActiveSlide(activeSlideIndex + 1);
	}

	carousel.addEventListener("click", onCarouselButtonClick);

	return {
		panel,
		carousel,
		slides,
		setActiveSlide,
		destroy: () => {
			carousel.removeEventListener("click", onCarouselButtonClick);

			if (typeof gsap !== "undefined") {
				slides.forEach((slide) => gsap.killTweensOf(slide));
			}
		},
	};
}

function createTabs(component) {
	if (!component) return null;

	component.setAttribute(componentStateAttribute, "loading");
	component.setAttribute("aria-busy", "true");

	if (typeof component[cleanupKey] === "function") {
		component[cleanupKey]();
	}

	const panels = getScopedElements(component, selectors.panel);

	if (!panels.length) return null;

	const componentId = ++componentCount;
	const template = getScopedElements(component, selectors.template)[0] || null;
	const tabsRoot = getScopedElements(component, selectors.tabs)[0] || null;

	if (!template || !tabsRoot || template.parentElement !== tabsRoot) {
		return null;
	}

	if (template.tagName !== "BUTTON") {
		return null;
	}

	const tabs = [];
	const usedPanelIds = new Set();
	const panelCarousels = panels.map(createPanelCarousel).filter(Boolean);
	let activeIndex = 0;

	tabsRoot.setAttribute("role", "tablist");

	if (template) {
		template.removeAttribute("hidden");
		template.setAttribute("aria-hidden", "true");
		template.style.display = "none";
	}

	clearExistingTabs(tabsRoot, template);

	panels.forEach((panel, index) => {
		const tab = buildTabFromTemplate(template);
		const label = getTabLabel(panel, index);
		const panelId = ensurePanelId(panel, componentId, index, usedPanelIds);
		const tabId = `tabs-tab-${componentId}-${index + 1}`;
		const isActive = index === 0;

		setTabLabel(tab, label);
		tab.type = "button";
		tab.id = tabId;
		tab.setAttribute("role", "tab");
		tab.setAttribute("aria-controls", panelId);
		tab.setAttribute("aria-selected", isActive ? "true" : "false");
		tab.tabIndex = isActive ? 0 : -1;
		tab.classList.toggle("is-active", isActive);

		panel.setAttribute("role", "tabpanel");
		panel.setAttribute("aria-labelledby", tabId);
		panel.classList.toggle("is-active", isActive);
		setElementDisplayVisibility(panel, isActive);

		tabsRoot.append(tab);
		tabs.push(tab);
	});

	template.remove();
	setElementDisplayVisibility(tabsRoot, tabs.length > 1);

	function setActiveTab(nextIndex, options = {}) {
		const { withTransition = true, focusTab = false } = options;
		const nextTab = tabs[nextIndex];
		const nextPanel = panels[nextIndex];

		if (!nextTab || !nextPanel) return;

		const previousIndex = activeIndex;
		const previousPanel = panels[previousIndex];
		const previousTab = tabs[previousIndex];

		activeIndex = nextIndex;

		tabs.forEach((tab, index) => {
			const isActive = index === nextIndex;

			tab.classList.toggle("is-active", isActive);
			tab.setAttribute("aria-selected", isActive ? "true" : "false");
			tab.tabIndex = isActive ? 0 : -1;
		});

		panels.forEach((panel, index) => {
			const isActive = index === nextIndex;
			const isPrevious = index === previousIndex;

			panel.classList.toggle("is-active", isActive);

			if (isActive) {
				setElementDisplayVisibility(panel, true);
				return;
			}

			if (!isPrevious || !withTransition || previousIndex === nextIndex) {
				setElementDisplayVisibility(panel, false);
			}
		});

		if (previousPanel && previousPanel !== nextPanel) {
			hidePanel(previousPanel, withTransition);
		}

		showPanel(nextPanel, previousTab !== nextTab ? withTransition : false);

		if (focusTab) {
			nextTab.focus();
		}

		updateUnderline(tabsRoot, nextTab, previousTab !== nextTab ? withTransition : false);
	}

	function onClick(event) {
		const tabIndex = getTabIndex(tabs, event.target);

		if (tabIndex < 0) return;

		event.preventDefault();
		setActiveTab(tabIndex);
	}

	function onKeydown(event) {
		const currentIndex = getTabIndex(tabs, event.target);

		if (currentIndex < 0) return;

		let nextIndex = currentIndex;

		switch (event.key) {
			case "ArrowRight":
			case "ArrowDown":
				nextIndex = (currentIndex + 1) % tabs.length;
				break;
			case "ArrowLeft":
			case "ArrowUp":
				nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
				break;
			case "Home":
				nextIndex = 0;
				break;
			case "End":
				nextIndex = tabs.length - 1;
				break;
			default:
				return;
		}

		event.preventDefault();
		setActiveTab(nextIndex, {
			focusTab: true,
		});
	}

	function onResize() {
		updateUnderline(tabsRoot, tabs[activeIndex], false);
	}

	tabsRoot.addEventListener("click", onClick);
	tabsRoot.addEventListener("keydown", onKeydown);
	window.addEventListener("resize", onResize);

	component[cleanupKey] = () => {
		tabsRoot.removeEventListener("click", onClick);
		tabsRoot.removeEventListener("keydown", onKeydown);
		window.removeEventListener("resize", onResize);
		panelCarousels.forEach((instance) => instance.destroy());

		if (typeof gsap !== "undefined") {
			panels.forEach((panel) => gsap.killTweensOf(panel));
		}

		component.setAttribute(componentStateAttribute, "loading");
		component.setAttribute("aria-busy", "true");
		component[cleanupKey] = null;
	};

	setActiveTab(0, {
		withTransition: false,
	});

	requestAnimationFrame(() => {
		if (component[cleanupKey]) {
			component.setAttribute(componentStateAttribute, "ready");
			component.setAttribute("aria-busy", "false");
		}
	});

	return {
		component,
		tabsRoot,
		panels,
		tabs,
		panelCarousels,
		setActiveTab,
		destroy: component[cleanupKey],
	};
}

export function initTabs(scope = document) {
	const root = isScope(scope) ? scope : document;
	const instances = getComponents(root).map(createTabs).filter(Boolean);

	if (instances.length) {
		const refreshOverflowDrag = window.sr?.functions?.initOverflowDrag;

		if (typeof refreshOverflowDrag === "function") {
			requestAnimationFrame(() => {
				refreshOverflowDrag();
			});
		}
	}

	return instances;
}
