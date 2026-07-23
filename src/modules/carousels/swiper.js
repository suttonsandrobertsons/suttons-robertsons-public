import { qsa, qs } from "../../utils/dom.js";
let instances = [];

const defaults = {
	selector: ".swiper",
	wrapperSelector: ".swiper-wrapper",
	slideSelector: ".swiper-slide",

	dotsSelector: ".carousel-controls_dots",
	dotClass: "carousel-controls_dot",
	activeClass: "is-active",
	activeCarouselClass: "is-carousel-active",
	inactiveCarouselClass: "is-carousel-inactive",
	draggingClass: "is-dragging",

	loopAttr: "data-swiper-loop",
	draggableAttr: "data-swiper-draggable",
	centeredAttr: "data-swiper-centered",
	customAttr: "data-swiper-custom",
	autoScrollAttr: "data-swiper-autoscroll",
	autoScrollSpeedAttr: "data-swiper-autoscroll-speed",
	swiperAutoplayDelay: 1,

	options: {
		loop: false,
		draggable: true,
		dragThreshold: 5,
		spaceBetween: 36,
		centered: false,
		autoScroll: false,
		autoScrollSpeed: 2,
	},
};

function getCarouselLabel(root) {
	if (!root) return "unknown-carousel";

	const name = root.getAttribute("data-swiper-name") || root.getAttribute("data-carousel-name");
	if (name) {
		return name;
	}

	if (root.id) {
		return `#${root.id}`;
	}

	const className = typeof root.className === "string" ? root.className.trim() : "";
	if (className) {
		const fallbackClass = className.split(/\s+/).find((classToken) => classToken);

		if (fallbackClass) {
			return `.${fallbackClass}`;
		}
	}

	return root.tagName.toLowerCase();
}

function logCarousel(root, message, details) {
	const prefix = `[carousels/swiper] ${getCarouselLabel(root)}`;

	if (typeof details === "undefined") {
		console.info(prefix, message);
		return;
	}

	console.info(prefix, message, details);
}

function getSwiperWrap(root) {
	return root?.closest(".swiper-outer-wrap") || root?.parentElement || null;
}

function classNameFromSelector(selector) {
	if (!selector || !selector.startsWith(".")) return selector || "";
	return selector.slice(1);
}

function getSwiperActiveState(swiper) {
	return Boolean(swiper && !swiper.destroyed && !swiper.isLocked && swiper.slides?.length > 1);
}

function normalizeLoopIndex(index, length) {
	if (!Number.isFinite(index) || length <= 0) {
		return 0;
	}

	return ((index % length) + length) % length;
}

function getActiveBulletIndex(swiper, bulletCount) {
	const rawIndex = Number.isFinite(swiper?.realIndex) ? swiper.realIndex : swiper?.activeIndex;
	return normalizeLoopIndex(rawIndex || 0, bulletCount);
}

function renderPaginationBullets(paginationEl, settings, count) {
	if (!paginationEl) {
		return;
	}

	const bulletCount = Math.max(0, count || 0);
	paginationEl.innerHTML = Array.from({ length: bulletCount }, (_, index) => {
		const bulletNumber = index + 1;
		return `<button type="button" class="${settings.dotClass}" data-swiper-bullet-index="${index}" aria-label="Go to slide ${bulletNumber}"></button>`;
	}).join("");
}

function updatePaginationBullets(swiper, paginationEl, settings) {
	if (!paginationEl) {
		return 0;
	}

	const bullets = qsa(paginationEl, `.${settings.dotClass}`);
	const activeIndex = getActiveBulletIndex(swiper, bullets.length);

	bullets.forEach((bullet, index) => {
		bullet.classList.toggle(settings.activeClass, index === activeIndex);
	});

	return bullets.length;
}

function isCustomCarousel(root, settings) {
	return Boolean(root?.hasAttribute(settings.customAttr));
}

function parseBooleanAttr(root, attrName, fallbackValue) {
	const value = root.getAttribute(attrName);

	if (value === null) {
		return fallbackValue;
	}

	if (value === "true") {
		return true;
	}

	if (value === "false") {
		return false;
	}

	console.warn(
		`[carousels/swiper] Ignoring invalid boolean attribute value for ${attrName}:`,
		value,
		root,
	);
	return fallbackValue;
}

function parsePositiveNumberAttr(root, attrName, fallbackValue) {
	const value = root.getAttribute(attrName);

	if (value === null) {
		return fallbackValue;
	}

	const parsed = Number(value);
	if (Number.isFinite(parsed) && parsed > 0) {
		return parsed;
	}

	console.warn(
		`[carousels/swiper] Ignoring invalid numeric attribute value for ${attrName}:`,
		value,
		root,
	);
	return fallbackValue;
}

function resolveSettings(root, userSettings) {
	const settings = {
		...defaults,
		...userSettings,
		options: {
			...defaults.options,
			...(userSettings.options || {}),
		},
	};

	settings.options.loop = parseBooleanAttr(root, settings.loopAttr, settings.options.loop);
	settings.options.centered = parseBooleanAttr(
		root,
		settings.centeredAttr,
		settings.options.centered,
	);
	settings.options.draggable = parseBooleanAttr(
		root,
		settings.draggableAttr,
		settings.options.draggable,
	);
	settings.options.autoScroll = parseBooleanAttr(
		root,
		settings.autoScrollAttr,
		settings.options.autoScroll,
	);
	settings.options.autoScrollSpeed = parsePositiveNumberAttr(
		root,
		settings.autoScrollSpeedAttr,
		settings.options.autoScrollSpeed,
	);

	return settings;
}

function getSwiperOptions(root, settings) {
	const isLooping = settings.options.loop === true;
	const isDraggable = settings.options.draggable === true;
	const isAutoScrollEnabled = settings.options.autoScroll === true;
	const autoScrollSpeed = settings.options.autoScrollSpeed;

	const options = {
		wrapperClass: classNameFromSelector(settings.wrapperSelector),
		slideClass: classNameFromSelector(settings.slideSelector),
		slideActiveClass: settings.activeClass,
		slidesPerView: "auto",
		spaceBetween: settings.options.spaceBetween || 0,
		loop: isLooping,
		centeredSlides: settings.options.centered,
		watchOverflow: !isLooping,
		grabCursor: isDraggable,
		allowTouchMove: isDraggable,
		threshold: settings.options.dragThreshold,
		on: {
			init(swiper) {
				updateSwiperState(swiper, root, settings);
			},
			slideChange(swiper) {
				updateSwiperState(swiper, root, settings);
			},
			resize(swiper) {
				updateSwiperState(swiper, root, settings);
			},
			lock(swiper) {
				updateSwiperState(swiper, root, settings);
			},
			unlock(swiper) {
				updateSwiperState(swiper, root, settings);
			},
			touchStart(swiper) {
				if (getSwiperActiveState(swiper)) {
					root.classList.add(settings.draggingClass);
				}
			},
			touchEnd() {
				root.classList.remove(settings.draggingClass);
			},
		},
	};

	if (isAutoScrollEnabled) {
		options.autoplay = {
			delay: settings.swiperAutoplayDelay,
			disableOnInteraction: false,
			pauseOnMouseEnter: false,
		};
		options.speed = Math.max(1000, Math.round(8000 / autoScrollSpeed));
	}

	return options;
}

function updateSwiperState(swiper, root, settings) {
	const isActive = getSwiperActiveState(swiper);
	const paginationEl = qs(getSwiperWrap(root), settings.dotsSelector);

	root.classList.toggle(settings.activeCarouselClass, isActive);
	root.classList.toggle(settings.inactiveCarouselClass, !isActive);
	root.setAttribute("data-swiper-active", isActive ? "true" : "false");
	root.setAttribute("data-carousel-active", isActive ? "true" : "false");

	if (paginationEl) {
		const bulletCount = updatePaginationBullets(swiper, paginationEl, settings);
		paginationEl.hidden = !isActive || bulletCount <= 1;
	}
}

function createSwiperCarousel(root, settings) {
	if (typeof Swiper === "undefined") {
		console.warn("[carousels/swiper] Swiper not found.", root);
		return null;
	}

	const wrapper = qs(root, settings.wrapperSelector);

	if (!wrapper) {
		console.warn("[carousels/swiper] Missing wrapper:", root);
		return null;
	}

	const swiperWrap = getSwiperWrap(root);
	const paginationEl = qs(swiperWrap, settings.dotsSelector);

	let slideCount = qsa(root, `${settings.slideSelector}:not(.is-loop-clone)`).length;
	if (slideCount === 0) {
		slideCount = qsa(root, settings.slideSelector).length;
	}
	const effectiveSettings =
		slideCount <= 1
			? {
					...settings,
					options: {
						...settings.options,
						loop: false,
					},
				}
			: settings;

	if (effectiveSettings.options.loop && slideCount > 1) {
		const slides = qsa(root, settings.slideSelector);
		const setsNeeded = Math.ceil(24 / slideCount);
		for (let i = 1; i < setsNeeded; i++) {
			slides.forEach((slide) => {
				const clone = slide.cloneNode(true);
				clone.classList.add("is-loop-clone");
				wrapper.appendChild(clone);
			});
		}
	}

	renderPaginationBullets(paginationEl, effectiveSettings, slideCount);

	const swiperOptions = getSwiperOptions(root, effectiveSettings);

	logCarousel(root, "Swiper options (init)", {
		options: swiperOptions,
		slideCount,
	});

	const swiper = new Swiper(root, swiperOptions);
	let paginationClickHandler = null;

	if (paginationEl) {
		paginationClickHandler = (event) => {
			const bullet = event.target.closest(`.${effectiveSettings.dotClass}`);

			if (!bullet || !paginationEl.contains(bullet)) {
				return;
			}

			const bulletIndex = Number(bullet.getAttribute("data-swiper-bullet-index"));
			if (!Number.isFinite(bulletIndex)) {
				return;
			}

			if (effectiveSettings.options.loop && typeof swiper.slideToLoop === "function") {
				swiper.slideToLoop(bulletIndex);
				return;
			}

			swiper.slideTo(bulletIndex);
		};

		paginationEl.addEventListener("click", paginationClickHandler);
	}

	function destroy() {
		logCarousel(root, "Destroying Swiper carousel instance");

		root.classList.remove(
			settings.activeCarouselClass,
			settings.inactiveCarouselClass,
			settings.draggingClass,
		);
		root.removeAttribute("data-swiper-active");
		root.removeAttribute("data-carousel-active");

		if (paginationEl) {
			if (paginationClickHandler) {
				paginationEl.removeEventListener("click", paginationClickHandler);
			}

			paginationEl.innerHTML = "";
			paginationEl.hidden = false;
		}

		swiper.destroy(true, false);
		root._swiperInstance = null;
		root._carouselInstance = null;
		instances = instances.filter((instance) => instance.root !== root);
	}

	const instance = {
		root,
		swiper,
		destroy,
		reInit() {
			swiper.update();
			updateSwiperState(swiper, root, settings);
		},
	};

	root._swiperInstance = instance;
	root._carouselInstance = instance;
	instances.push(instance);

	return instance;
}

export function createCarousel(root, userSettings = {}) {
	if (!root || root._swiperInstance) return root?._swiperInstance || null;

	const settings = resolveSettings(root, userSettings);
	if (isCustomCarousel(root, settings)) {
		return null;
	}

	return createSwiperCarousel(root, settings);
}

export function initCarousels(userSettings = {}) {
	return qsa(document, defaults.selector)
		.filter((root) => !isCustomCarousel(root, defaults))
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
