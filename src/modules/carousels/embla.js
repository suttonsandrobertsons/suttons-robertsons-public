import { qsa, qs } from "../../utils/dom.js";

let instances = [];

const defaults = {
	selector: ".embla",
	viewportSelector: ".embla-viewport",
	containerSelector: ".embla-container",
	slideSelector: ".embla-slide",

	dotsSelector: ".carousel-controls_dots",
	prevSelector: ".embla-prev",
	nextSelector: ".embla-next",
	progressSelector: ".embla-progress-bar",

	dotClass: "carousel-controls_dot",
	activeClass: "is-active",
	inactiveClass: "is-inactive",
	dotsTypeAttr: "data-embla-dots",
	dotsType: "snaps",
	activeCarouselClass: "is-carousel-active",
	inactiveCarouselClass: "is-carousel-inactive",
	draggingClass: "is-dragging",
	loopAttr: "data-embla-loop", // possible values: "true", "false"
	alignAttr: "data-embla-align", // possible values: "start", "center", "end"
	draggableAttr: "data-embla-draggable", // possible values: "true", "false"
	cloneSlidesAttr: "data-embla-clone-slides", // possible values: "true", "false"
	autoScrollAttr: "data-embla-autoscroll", // possible values: "true", "false"
	autoScrollSpeedAttr: "data-embla-autoscroll-speed", // positive number
	autoScrollSpeed: 2,
	autoScrollOptions: {
		playOnInit: true,
	},
	cloneSets: 2,
	cloneMarkerAttr: "data-embla-managed-clone",
	cloneSetAttr: "data-embla-managed-clone-set",
	originalMarkerAttr: "data-embla-managed-original",
	containerInnerWidthVar: "--container--max-inner-w",
	containerPaddingVar: "--container--padding",

	activeSlideClass: "is-active",
	centerSlideClass: "is-center-active",

	options: {
		loop: true,
		align: "center",
		skipSnaps: true,
		draggable: true,
		dragThreshold: 5,
		dragFree: false,
		watchDrag: true,
	},
};

function isEmblaClassName(className) {
	return className === "embla" || className.startsWith("embla-") || className.includes("embla");
}

function getAncestorComponentClass(root) {
	let current = root?.parentElement || null;

	while (current) {
		const className = typeof current.className === "string" ? current.className.trim() : "";
		const componentClass = className
			.split(/\s+/)
			.find((classToken) => classToken && !isEmblaClassName(classToken));

		if (componentClass) {
			return `.${componentClass}`;
		}

		current = current.parentElement;
	}

	return null;
}

function getCarouselLabel(root) {
	if (!root) return "unknown-carousel";

	const ancestorComponentClass = getAncestorComponentClass(root);
	if (ancestorComponentClass) {
		return ancestorComponentClass;
	}

	const name = root.getAttribute("data-embla-name") || root.getAttribute("data-carousel-name");
	if (name) {
		return name;
	}

	if (root.id) {
		return `#${root.id}`;
	}

	const className = typeof root.className === "string" ? root.className.trim() : "";
	if (className) {
		const fallbackClass = className
			.split(/\s+/)
			.find((classToken) => classToken && !isEmblaClassName(classToken));

		if (fallbackClass) {
			return `.${fallbackClass}`;
		}
	}

	return root.tagName.toLowerCase();
}

function logCarousel(root, message, details) {
	const prefix = `[carousels] ${getCarouselLabel(root)}`;

	if (typeof details === "undefined") {
		console.info(prefix, message);
		return;
	}

	console.info(prefix, message, details);
}

function logEmblaOptions(root, reason, options, extra = {}) {
	logCarousel(root, `Embla options (${reason})`, {
		...extra,
		options: {
			...options,
		},
	});
}

function resolveCssLength(root, value) {
	if (!root || !value) return 0;

	const probe = document.createElement("div");
	probe.style.position = "absolute";
	probe.style.visibility = "hidden";
	probe.style.pointerEvents = "none";
	probe.style.height = "0";
	probe.style.width = value;

	root.appendChild(probe);
	const width = probe.getBoundingClientRect().width;
	probe.remove();

	return Number.isFinite(width) ? width : 0;
}

function getCssVarPx(root, varName) {
	return resolveCssLength(root, `var(${varName})`);
}

function removeManagedClones(container, settings) {
	if (!container) return;

	qsa(
		container,
		`[${settings.cloneMarkerAttr}="true"]:not([${settings.originalMarkerAttr}="true"])`,
	).forEach((slide) => {
		slide.remove();
	});
}

function setupSlideClones(root, container, settings) {
	const cloneSlidesValue = root.getAttribute(settings.cloneSlidesAttr);
	const shouldCloneSlides = cloneSlidesValue === "true";

	removeManagedClones(container, settings);

	let originalSlides = qsa(
		container,
		`${settings.slideSelector}:not([${settings.cloneMarkerAttr}="true"])`,
	);

	// Recovery path if a previous run incorrectly marked every slide as a clone.
	if (!originalSlides.length) {
		const allSlides = qsa(container, settings.slideSelector);
		allSlides.forEach((slide) => {
			slide.removeAttribute(settings.cloneMarkerAttr);
			slide.removeAttribute(settings.cloneSetAttr);
		});

		originalSlides = allSlides;
		logCarousel(root, "Recovered originals from clone-marked slides", {
			recoveredCount: allSlides.length,
		});
	}

	originalSlides.forEach((slide) => {
		slide.setAttribute(settings.originalMarkerAttr, "true");
		slide.removeAttribute(settings.cloneMarkerAttr);
		slide.removeAttribute(settings.cloneSetAttr);
	});

	const originalSlideCount = originalSlides.length;

	if (!shouldCloneSlides || !originalSlideCount) {
		return {
			isEnabled: false,
			originalSlideCount,
			totalSlideCount: originalSlideCount,
			startIndex: 0,
			destroy() {
				removeManagedClones(container, settings);
			},
		};
	}

	const prependSets = Math.floor(settings.cloneSets / 2);
	const appendSets = settings.cloneSets - prependSets;
	const slidesParent = originalSlides[0]?.parentElement || container;
	const hasSharedParent = originalSlides.every((slide) => slide.parentElement === slidesParent);

	const prependFragment = document.createDocumentFragment();
	const appendFragment = document.createDocumentFragment();

	if (!hasSharedParent) {
		logCarousel(root, "Slides do not share a parent; falling back to container for clones", {
			originalSlideCount,
		});
	}

	const cloneTarget = hasSharedParent ? slidesParent : container;

	for (let setIndex = 0; setIndex < prependSets; setIndex += 1) {
		originalSlides.forEach((slide) => {
			const clone = slide.cloneNode(true);
			clone.removeAttribute(settings.originalMarkerAttr);
			clone.setAttribute(settings.cloneMarkerAttr, "true");
			clone.setAttribute(settings.cloneSetAttr, "prepend");
			prependFragment.appendChild(clone);
		});
	}

	for (let setIndex = 0; setIndex < appendSets; setIndex += 1) {
		originalSlides.forEach((slide) => {
			const clone = slide.cloneNode(true);
			clone.removeAttribute(settings.originalMarkerAttr);
			clone.setAttribute(settings.cloneMarkerAttr, "true");
			clone.setAttribute(settings.cloneSetAttr, "append");
			appendFragment.appendChild(clone);
		});
	}

	cloneTarget.insertBefore(
		prependFragment,
		hasSharedParent ? originalSlides[0] : cloneTarget.firstChild,
	);
	cloneTarget.appendChild(appendFragment);

	const startIndex = prependSets * originalSlideCount;
	logCarousel(root, "Cloned slides", {
		originalSlideCount,
		cloneSets: settings.cloneSets,
		prependSets,
		appendSets,
		clonesAdded: originalSlideCount * settings.cloneSets,
		startIndex,
	});
	return {
		isEnabled: true,
		originalSlideCount,
		totalSlideCount: qsa(container, settings.slideSelector).length,
		startIndex,
		destroy() {
			removeManagedClones(container, settings);
		},
	};
}

function getAutoScrollState(root, settings) {
	const autoScrollValue = root.getAttribute(settings.autoScrollAttr);
	const isEnabled = autoScrollValue === "true";

	if (!isEnabled) {
		return {
			isEnabled: false,
			isAvailable: false,
			speed: null,
			plugin: null,
		};
	}

	const globalAutoScrollFactory =
		typeof EmblaCarouselAutoScroll !== "undefined"
			? EmblaCarouselAutoScroll
			: window.EmblaCarouselAutoScroll;

	if (typeof globalAutoScrollFactory !== "function") {
		console.warn("[carousels] EmblaCarouselAutoScroll not found.", root);
		return {
			isEnabled: true,
			isAvailable: false,
			speed: null,
			plugin: null,
		};
	}

	const speedValue = Number(root.getAttribute(settings.autoScrollSpeedAttr));
	const speed =
		Number.isFinite(speedValue) && speedValue > 0 ? speedValue : settings.autoScrollSpeed;
	const plugin = globalAutoScrollFactory({
		...settings.autoScrollOptions,
		speed,
	});

	return {
		isEnabled: true,
		isAvailable: true,
		speed,
		plugin,
	};
}

function getContainerInnerWidth(root, settings) {
	const maxInnerWidth = getCssVarPx(root, settings.containerInnerWidthVar);
	const padding = getCssVarPx(root, settings.containerPaddingVar);
	const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
	const paddedViewportWidth = Math.max(0, viewportWidth - padding * 2);

	if (!maxInnerWidth) return paddedViewportWidth;

	return Math.min(maxInnerWidth, paddedViewportWidth);
}

function getSlidesContentWidth(embla) {
	const slides = embla.slideNodes();
	if (!slides.length) return 0;

	let minLeft = Number.POSITIVE_INFINITY;
	let maxRight = Number.NEGATIVE_INFINITY;

	slides.forEach((slide) => {
		const rect = slide.getBoundingClientRect();
		minLeft = Math.min(minLeft, rect.left);
		maxRight = Math.max(maxRight, rect.right);
	});

	const width = maxRight - minLeft;
	return Number.isFinite(width) ? width : 0;
}

function isInactive(root, settings, state) {
	if (state) {
		return !state.isActive;
	}

	return Boolean(
		root?.classList.contains(settings.inactiveClass) ||
		root?.classList.contains(settings.inactiveCarouselClass),
	);
}

function getEmblaOptions(root, settings, state) {
	const isDraggable = settings.options.draggable !== false;
	const watchDrag = !isDraggable
		? false
		: isInactive(root, settings, state)
			? false
			: settings.options.watchDrag;

	return {
		...settings.options,
		watchDrag,
	};
}

function getCarouselState(embla, root, settings) {
	const snapCount = embla.scrollSnapList().length;
	const canScroll = embla.canScrollPrev() || embla.canScrollNext();
	const isStartAligned = settings?.options?.align === "start";
	const contentWidth = getSlidesContentWidth(embla);
	const containerInnerWidth = root && settings ? getContainerInnerWidth(root, settings) : 0;
	const hasContainerOverflow =
		isStartAligned && contentWidth > 0 && containerInnerWidth > 0
			? contentWidth > containerInnerWidth + 1
			: false;

	return {
		snapCount,
		canScroll,
		contentWidth,
		containerInnerWidth,
		hasContainerOverflow,
		isActive: snapCount > 1 && (canScroll || hasContainerOverflow),
	};
}

function setupEmblaLogging(embla, root, settings) {
	function logUpdate(eventName) {
		logCarousel(root, `Embla update: ${eventName}`, {
			selectedSnap: embla.selectedScrollSnap(),
			scrollProgress: Number(embla.scrollProgress().toFixed(4)),
			state: getCarouselState(embla, root, settings),
		});
	}

	const listeners = {
		init: () => logUpdate("init"),
		reInit: () => logUpdate("reInit"),
		select: () => logUpdate("select"),
		resize: () => logUpdate("resize"),
		settle: () => logUpdate("settle"),
	};

	Object.entries(listeners).forEach(([eventName, listener]) => {
		embla.on(eventName, listener);
	});

	return function destroy() {
		Object.entries(listeners).forEach(([eventName, listener]) => {
			embla.off(eventName, listener);
		});
	};
}

function setupArrows(embla, prevButton, nextButton, settings) {
	if (!prevButton && !nextButton) return () => {};

	function update() {
		const isLooping = settings.options.loop;

		if (prevButton) {
			prevButton.disabled = !isLooping && !embla.canScrollPrev();
		}

		if (nextButton) {
			nextButton.disabled = !isLooping && !embla.canScrollNext();
		}
	}

	function onPrevClick() {
		embla.scrollPrev();
	}

	function onNextClick() {
		embla.scrollNext();
	}

	if (prevButton) prevButton.addEventListener("click", onPrevClick);
	if (nextButton) nextButton.addEventListener("click", onNextClick);

	embla.on("select", update);
	embla.on("reInit", update);

	update();

	return function destroy() {
		if (prevButton) prevButton.removeEventListener("click", onPrevClick);
		if (nextButton) nextButton.removeEventListener("click", onNextClick);
	};
}

function setupDots(embla, root, dotsRoot, settings) {
	if (!dotsRoot) return () => {};

	const dotAttr = "data-embla-dot";

	function getDots() {
		return qsa(dotsRoot, `[${dotAttr}]`);
	}

	function getDotsType() {
		return "snaps";
	}

	function getDotCount() {
		return getDotsType() === "slides" ? embla.slideNodes().length : embla.scrollSnapList().length;
	}

	function getSelectedDotIndex() {
		if (getDotsType() === "slides") {
			const selectedSnapIndex = embla.selectedScrollSnap();
			const slidesInSnap = embla.internalEngine().slideRegistry[selectedSnapIndex] || [];

			return slidesInSnap[0] || 0;
		}

		return embla.selectedScrollSnap();
	}

	function update() {
		const selectedDotIndex = getSelectedDotIndex();

		getDots().forEach((dot, index) => {
			const isActive = index === selectedDotIndex;

			dot.classList.toggle(settings.activeClass, isActive);
			dot.setAttribute("aria-current", isActive ? "true" : "false");
		});
	}

	function render() {
		const dotCount = getDotCount();
		const dotsType = getDotsType();
		const labelType = dotsType === "slides" ? "slide" : "snap";

		dotsRoot.innerHTML = "";

		if (!getCarouselState(embla, root, settings).isActive || dotCount <= 1) {
			dotsRoot.hidden = true;
			return;
		}

		dotsRoot.hidden = false;

		for (let i = 0; i < dotCount; i += 1) {
			const dot = document.createElement("button");

			dot.type = "button";
			dot.className = settings.dotClass;
			dot.setAttribute(dotAttr, i);
			dot.setAttribute("aria-label", `Go to ${labelType} ${i + 1} of ${dotCount}`);

			dotsRoot.appendChild(dot);
		}

		update();
	}

	function onDotClick(event) {
		const dot = event.target.closest(`[${dotAttr}]`);
		if (!dot || !dotsRoot.contains(dot)) return;

		const index = Number(dot.getAttribute(dotAttr));
		if (!Number.isFinite(index)) return;

		embla.scrollTo(index);
	}

	dotsRoot.addEventListener("click", onDotClick);

	embla.on("init", render);
	embla.on("reInit", render);
	embla.on("select", update);
	embla.on("resize", render);

	render();

	return function destroy() {
		dotsRoot.removeEventListener("click", onDotClick);
		dotsRoot.innerHTML = "";
		dotsRoot.hidden = false;
	};
}

function setupProgress(embla, root, progressBar, settings) {
	if (!progressBar) return () => {};

	function update() {
		if (!getCarouselState(embla, root, settings).isActive) {
			progressBar.hidden = true;
			progressBar.style.transform = "";
			return;
		}

		progressBar.hidden = false;

		let progress = embla.scrollProgress();
		progress = Math.max(0, Math.min(1, progress));

		progressBar.style.transform = `scaleX(${progress})`;
	}

	embla.on("scroll", update);
	embla.on("select", update);
	embla.on("reInit", update);
	embla.on("resize", update);

	update();

	return function destroy() {
		progressBar.hidden = false;
		progressBar.style.transform = "";
	};
}

function setupCarouselState(embla, root, settings) {
	let lastWatchDrag = settings.options.watchDrag;
	let lastState = null;

	function update() {
		const state = getCarouselState(embla, root, settings);
		const stateChanged =
			!lastState ||
			lastState.isActive !== state.isActive ||
			lastState.snapCount !== state.snapCount;

		if (stateChanged) {
			logCarousel(root, "Carousel state updated", state);
			lastState = state;
		}

		root.classList.toggle(settings.activeCarouselClass, state.isActive);
		root.classList.toggle(settings.inactiveCarouselClass, !state.isActive);
		root.setAttribute("data-embla-active", state.isActive ? "true" : "false");

		const nextOptions = getEmblaOptions(root, settings, state);
		const nextWatchDrag = nextOptions.watchDrag;
		if (lastWatchDrag !== nextWatchDrag) {
			logEmblaOptions(root, "state change reInit", nextOptions, {
				previousWatchDrag: lastWatchDrag,
				nextWatchDrag,
			});

			lastWatchDrag = nextWatchDrag;
			embla.reInit(nextOptions);
		}
	}

	function onPointerDown() {
		if (getCarouselState(embla, root, settings).isActive) {
			root.classList.add(settings.draggingClass);
		}
	}

	function onPointerUp() {
		root.classList.remove(settings.draggingClass);
	}

	embla.on("init", update);
	embla.on("reInit", update);
	embla.on("resize", update);
	embla.on("select", update);
	embla.on("pointerDown", onPointerDown);
	embla.on("pointerUp", onPointerUp);

	update();

	return function destroy() {
		root.classList.remove(
			settings.activeCarouselClass,
			settings.inactiveCarouselClass,
			settings.draggingClass,
		);
		root.removeAttribute("data-embla-active");
	};
}

function setupActiveSlide(embla, settings) {
	function getSelectedSlideIndexes() {
		const selectedSnapIndex = embla.selectedScrollSnap();
		const slideRegistry = embla.internalEngine().slideRegistry;

		return slideRegistry[selectedSnapIndex] || [];
	}

	function update() {
		const activeIndexes = getSelectedSlideIndexes();

		embla.slideNodes().forEach((slide, index) => {
			slide.classList.toggle(settings.activeSlideClass, activeIndexes.includes(index));
		});
	}

	embla.on("init", update);
	embla.on("select", update);
	embla.on("settle", update);
	embla.on("reInit", update);
	embla.on("resize", update);

	update();

	return function destroy() {
		embla.slideNodes().forEach((slide) => {
			slide.classList.remove(settings.activeSlideClass);
		});
	};
}

function setupCenterSlide(embla, settings) {
	function getCenterSlideIndex() {
		const viewport = embla.rootNode();
		const viewportRect = viewport.getBoundingClientRect();
		const viewportCenter = viewportRect.left + viewportRect.width / 2;
		let centerIndex = 0;
		let closestDistance = Number.POSITIVE_INFINITY;

		embla.slideNodes().forEach((slide, index) => {
			const rect = slide.getBoundingClientRect();
			const slideCenter = rect.left + rect.width / 2;
			const distance = Math.abs(viewportCenter - slideCenter);

			if (distance < closestDistance) {
				closestDistance = distance;
				centerIndex = index;
			}
		});

		return centerIndex;
	}

	function update() {
		const centerIndex = getCenterSlideIndex();

		embla.slideNodes().forEach((slide, index) => {
			slide.classList.toggle(settings.centerSlideClass, index === centerIndex);
		});
	}

	embla.on("init", update);
	embla.on("select", update);
	embla.on("settle", update);
	embla.on("reInit", update);
	embla.on("resize", update);

	update();

	return function destroy() {
		embla.slideNodes().forEach((slide) => {
			slide.classList.remove(settings.centerSlideClass);
		});
	};
}

export function createCarousel(root, userSettings = {}) {
	if (!root || root._emblaInstance) return root?._emblaInstance || null;

	const settings = {
		...defaults,
		...userSettings,
		options: {
			...defaults.options,
			...(userSettings.options || {}),
		},
		autoScrollOptions: {
			...defaults.autoScrollOptions,
			...(userSettings.autoScrollOptions || {}),
		},
	};

	const dotsType = root.getAttribute(settings.dotsTypeAttr);
	if (dotsType === "slides" || dotsType === "snaps") {
		settings.dotsType = dotsType;
	}

	const loopValue = root.getAttribute(settings.loopAttr);
	if (loopValue === "false") {
		settings.options.loop = false;
	}

	const alignValue = root.getAttribute(settings.alignAttr);
	if (alignValue === "start" || alignValue === "center" || alignValue === "end") {
		settings.options.align = alignValue;
	}

	const draggableValue = root.getAttribute(settings.draggableAttr);
	if (draggableValue === "false") {
		settings.options.draggable = false;
		settings.options.watchDrag = false;
	}

	if (draggableValue === "true") {
		settings.options.draggable = true;
	}

	if (typeof EmblaCarousel === "undefined") {
		console.warn("[carousels] EmblaCarousel not found.");
		return null;
	}

	const viewport = qs(root, settings.viewportSelector);
	const container = qs(root, settings.containerSelector);

	if (!viewport) {
		console.warn("[carousels] Missing viewport:", root);
		return null;
	}

	if (!container) {
		console.warn("[carousels] Missing container:", root);
		return null;
	}

	if (settings.slideSelector) {
		settings.options.slides = settings.slideSelector;
	}

	const cloneState = setupSlideClones(root, container, settings);
	const autoScrollState = getAutoScrollState(root, settings);

	if (cloneState.isEnabled && !Number.isFinite(settings.options.startIndex)) {
		settings.options.startIndex = cloneState.startIndex;
	}

	const slideCount = cloneState.originalSlideCount;
	if (!cloneState.isEnabled && cloneState.originalSlideCount <= 2) {
		settings.options.loop = false;
	}

	const initialOptions = getEmblaOptions(root, settings);
	logEmblaOptions(root, "init", initialOptions, {
		dotsType: settings.dotsType,
		slideCount,
		originalSlideCount: cloneState.originalSlideCount,
		clonedSlideCount: cloneState.totalSlideCount,
		isDraggable: settings.options.draggable !== false,
		autoScrollEnabled: autoScrollState.isEnabled,
		autoScrollAvailable: autoScrollState.isAvailable,
		autoScrollSpeed: autoScrollState.speed,
	});

	const emblaPlugins = autoScrollState.plugin ? [autoScrollState.plugin] : [];
	const embla = EmblaCarousel(viewport, initialOptions, emblaPlugins);

	const destroyFns = [
		cloneState.destroy,
		setupEmblaLogging(embla, root, settings),
		setupCarouselState(embla, root, settings),
		setupArrows(embla, qs(root, settings.prevSelector), qs(root, settings.nextSelector), settings),
		setupDots(embla, root, qs(root, settings.dotsSelector), settings),
		setupProgress(embla, root, qs(root, settings.progressSelector), settings),
		setupActiveSlide(embla, settings),
		setupCenterSlide(embla, settings),
	];

	function destroy() {
		logCarousel(root, "Destroying carousel instance");

		destroyFns.forEach((fn) => {
			if (typeof fn === "function") fn();
		});

		embla.destroy();
		root._emblaInstance = null;
		root._carouselInstance = null;

		instances = instances.filter((instance) => instance.root !== root);
	}

	const instance = {
		root,
		embla,
		destroy,
		reInit() {
			const nextOptions = getEmblaOptions(root, settings);
			logEmblaOptions(root, "manual reInit", nextOptions);
			embla.reInit(nextOptions);
		},
	};

	root._emblaInstance = instance;
	root._carouselInstance = instance;
	instances.push(instance);

	return instance;
}

export function initCarousels(userSettings = {}) {
	return qsa(document, defaults.selector)
		.map((root) => createCarousel(root, userSettings))
		.filter(Boolean);
}

export function destroyCarousels() {
	instances.slice().forEach((instance) => {
		instance.destroy();
	});

	instances = [];
}

export function reInitCarousels() {
	instances.forEach((instance) => {
		instance.reInit();
	});
}

export function getCarouselInstances() {
	return instances;
}
