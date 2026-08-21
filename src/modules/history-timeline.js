const SELECTORS = {
	component: '[data-timeline="component"]',
	card: ".timeline-card",
	date: ".timeline-card_date",
	media: ".timeline-card_media",
	content: ".timeline-card_content",
	circle: ".timeline-card:first-child .timeline_circle-v2-dsk",
	circleMobile: ".timeline_circle-v2-mbl",
	line: ".timeline_line-v2",
	lineWrapper: ".timeline_line-wrapper-v2",
};

const CLEANUP_KEY = "__historyTimelineCleanup";
const DESKTOP_TIMELINE_QUERY = "(min-width: 768px)";
const MOBILE_TIMELINE_QUERY = "(max-width: 767px)";

function qsa(root, selector) {
	return Array.from(root.querySelectorAll(selector));
}

function getImageData(card) {
	const image = card.querySelector("img");

	if (!image) {
		return null;
	}

	return {
		src: image.getAttribute("src") || image.src || "",
		srcset: image.getAttribute("srcset") || "",
		sizes: image.getAttribute("sizes") || "",
		alt: image.getAttribute("alt") || "",
	};
}

function isReducedMotion() {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function applyImageAttributes(image, imageData) {
	if (!image || !imageData) return;

	image.src = imageData.src;
	image.alt = imageData.alt;

	if (imageData.srcset) {
		image.srcset = imageData.srcset;
	} else {
		image.removeAttribute("srcset");
	}

	if (imageData.sizes) {
		image.sizes = imageData.sizes;
	} else {
		image.removeAttribute("sizes");
	}
}

function buildMediaImages(container, stickyImage, slides) {
	return slides.map((slide, index) => {
		if (index === 0) {
			gsap.set(stickyImage, { autoAlpha: 1 });
			return stickyImage;
		}

		const img = new Image();
		applyImageAttributes(img, slide);
		img.className = stickyImage.className;
		gsap.set(img, { autoAlpha: 0 });
		container.appendChild(img);

		return img;
	});
}

function setMediaImage(mediaImages, index, immediate = false) {
	if (!mediaImages?.length || !mediaImages[index]) {
		return;
	}

	if (immediate || typeof gsap === "undefined" || isReducedMotion()) {
		mediaImages.forEach((img, i) => {
			gsap.set(img, { autoAlpha: i === index ? 1 : 0 });
		});
		return;
	}

	mediaImages.forEach((img, i) => {
		if (i === index) {
			gsap.to(img, { autoAlpha: 1, duration: 0.35, ease: "power1.out", overwrite: true });
		} else {
			gsap.to(img, { autoAlpha: 0, duration: 0.25, ease: "power1.out", overwrite: true });
		}
	});
}

function setMediaStackPosition(container, images) {
	gsap.set(container, { position: "relative" });

	images.forEach((img, index) => {
		if (index === 0) return;

		gsap.set(img, {
			position: "absolute",
			inset: 0,
			width: "100%",
			height: "100%",
		});
	});
}

function setActiveState(items, activeIndex) {
	items.forEach((item, index) => {
		item.classList.toggle("is-active", index === activeIndex);
	});
}

function hideInactiveMedia(cards) {
	cards.forEach((card, index) => {
		const media = card.querySelector(SELECTORS.media);
		if (!media || index === 0) return;

		gsap.set(media, {
			autoAlpha: 0,
			pointerEvents: "none",
		});
	});
}

// Computed synchronously from scroll position before ScrollTrigger fires, so
// the first paint shows the right active card instead of flashing card 0.
function getInitialIndex(items) {
	const threshold = window.innerHeight * 0.45;
	let activeIndex = 0;

	items.forEach((item, index) => {
		const rect = item.getBoundingClientRect();

		if (rect.top <= threshold) {
			activeIndex = index;
		}
	});

	return activeIndex;
}

function getTimelineParts(component) {
	const lineWrapper = component.querySelector(SELECTORS.lineWrapper);

	return {
		lineWrapper,
		line: lineWrapper?.querySelector(SELECTORS.line),
	};
}

function setupLine({ lineWrapper, line, finalCard, finalDate, isMobile = false }) {
	if (!lineWrapper || !line) return () => {};

	gsap.set(line, {
		scaleY: 0,
		transformOrigin: "50% 0%",
		force3D: false,
	});

	const lineTween = gsap.to(line, {
		scaleY: 1,
		ease: "none",
		force3D: false,
		scrollTrigger: {
			trigger: lineWrapper,
			start: "top center",
			end: "bottom center",
			scrub: true,
			invalidateOnRefresh: true,
		},
	});

	// pinSpacing: false stops ScrollTrigger reserving layout space for the pin
	// (which would otherwise push later cards down); the rail must sit fixed
	// behind content that keeps scrolling past it.
	const lineWrapperPinTrigger = ScrollTrigger.create({
		trigger: lineWrapper,
		start: "bottom center",
		endTrigger: (isMobile ? finalDate : finalCard) || lineWrapper,
		end: isMobile && finalDate ? "center center" : finalCard ? "center center" : "bottom center",
		pin: lineWrapper,
		pinSpacing: false,
		anticipatePin: 1,
		invalidateOnRefresh: true,
	});

	return () => {
		lineTween.scrollTrigger?.kill();
		lineTween.kill();
		lineWrapperPinTrigger.kill();
		gsap.set(line, { clearProps: "transform,transformOrigin" });
		gsap.set(lineWrapper, { clearProps: "position,top,height,transform" });
	};
}

function setupCirclePin({ circle, finalCard, finalDate, isMobile = false }) {
	if (!circle) return () => {};

	const circlePinTrigger = ScrollTrigger.create({
		trigger: circle,
		start: "center center",
		endTrigger: (isMobile ? finalDate : finalCard) || circle,
		end: isMobile && finalDate ? "center center" : finalCard ? "center center" : "bottom center",
		pin: circle,
		pinSpacing: false,
		anticipatePin: 1,
		invalidateOnRefresh: true,
	});

	return () => {
		circlePinTrigger.kill();
		gsap.set(circle, { clearProps: "position,top,height,transform" });
	};
}

function setupRail({ lineWrapper, line, cards = [], isMobile = false }) {
	const finalCard = cards[cards.length - 1];
	const finalDate = finalCard?.querySelector(SELECTORS.date);
	const circleSelector = isMobile ? SELECTORS.circleMobile : SELECTORS.circle;
	const circle = document.querySelector(circleSelector);
	const cleanups = [
		setupLine({ lineWrapper, line, finalCard, finalDate, isMobile }),
		setupCirclePin({ circle, finalCard, finalDate, isMobile }),
	];

	return () => cleanups.forEach((cleanup) => cleanup());
}

function initRailComponent(component) {
	if (typeof component[CLEANUP_KEY] === "function") {
		component[CLEANUP_KEY]();
	}

	const cards = qsa(component, SELECTORS.card);
	const railCleanup = setupRail({
		...getTimelineParts(component),
		cards,
		isMobile: true,
	});

	ScrollTrigger.refresh();

	component[CLEANUP_KEY] = () => {
		railCleanup();
		component[CLEANUP_KEY] = null;
	};

	return component[CLEANUP_KEY];
}

function initComponent(component) {
	if (typeof component[CLEANUP_KEY] === "function") {
		component[CLEANUP_KEY]();
	}

	const cards = qsa(component, SELECTORS.card);
	const firstCard = cards[0];
	const finalCard = cards[cards.length - 1];
	const firstMedia = firstCard?.querySelector(SELECTORS.media);
	const stickyImage = firstMedia?.querySelector("img");

	if (!cards.length || !firstMedia || !stickyImage || !finalCard) return null;

	const slides = cards.map(getImageData);
	const imageTriggers = [];
	const mediaImages = buildMediaImages(firstMedia, stickyImage, slides);
	const railCleanup = setupRail({
		...getTimelineParts(component),
		cards,
		isMobile: false,
	});

	hideInactiveMedia(cards);
	setMediaStackPosition(firstMedia, mediaImages);

	const initialIndex = getInitialIndex(cards);

	setActiveState(cards, initialIndex);
	setMediaImage(mediaImages, initialIndex, true);

	cards.forEach((card, index) => {
		const content = card.querySelector(SELECTORS.content) || card;
		if (!content) {
			return;
		}

		imageTriggers.push(
			ScrollTrigger.create({
				trigger: content,
				start: "top center",
				end: "bottom center",
				onEnter: () => {
					setActiveState(cards, index);
					setMediaImage(mediaImages, index);
				},
				onEnterBack: () => {
					setActiveState(cards, index);
					setMediaImage(mediaImages, index);
				},
				onLeaveBack: () => {
					const previousIndex = Math.max(index - 1, 0);

					setActiveState(cards, previousIndex);
					setMediaImage(mediaImages, previousIndex);
				},
				onRefresh: (self) => {
					if (!self.isActive) return;

					setActiveState(cards, index);
					setMediaImage(mediaImages, index, true);
				},
			}),
		);
	});

	const pinTrigger = ScrollTrigger.create({
		trigger: firstMedia,
		start: "center center",
		endTrigger: finalCard,
		end: "center center",
		pin: firstMedia,
		pinSpacing: false,
		invalidateOnRefresh: true,
	});

	ScrollTrigger.refresh();

	component[CLEANUP_KEY] = () => {
		imageTriggers.forEach((trigger) => {
			if (typeof trigger?.kill === "function") {
				trigger.kill();
			}
		});

		pinTrigger.kill();
		railCleanup();

		cards.forEach((card) => card.classList.remove("is-active"));
		cards.forEach((card, index) => {
			if (index === 0) return;

			const media = card.querySelector(SELECTORS.media);
			if (media) {
				gsap.set(media, { clearProps: "opacity,visibility,pointer-events" });
			}
		});
		setMediaImage(mediaImages, 0, true);
		mediaImages.slice(1).forEach((img) => img.remove());
		gsap.set(stickyImage, { clearProps: "opacity,visibility" });
		gsap.set(firstMedia, { clearProps: "position" });
		component[CLEANUP_KEY] = null;
	};

	return component[CLEANUP_KEY];
}

export function initHistoryTimeline() {
	const components = qsa(document, SELECTORS.component);

	if (!components.length) return null;
	if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return null;

	gsap.registerPlugin(ScrollTrigger);

	const mm = gsap.matchMedia();

	mm.add(DESKTOP_TIMELINE_QUERY, () => {
		const cleanups = components.map((component) => initComponent(component)).filter(Boolean);

		return () => {
			cleanups.forEach((cleanup) => cleanup());
		};
	});

	mm.add(MOBILE_TIMELINE_QUERY, () => {
		const cleanups = components.map((component) => initRailComponent(component)).filter(Boolean);

		return () => {
			cleanups.forEach((cleanup) => cleanup());
		};
	});

	return () => mm.revert();
}
