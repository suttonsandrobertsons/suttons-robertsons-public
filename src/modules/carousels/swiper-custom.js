export function initUseCaseCustomSwiper() {
	if (typeof Swiper === "undefined") {
		console.warn("[carousels/swiper-custom] Swiper not found.");
		return null;
	}

	const root = document.querySelector('.swiper[data-swiper-custom="use-case"]');
	if (!root) {
		return null;
	}

	const swiper = new Swiper('.swiper[data-swiper-custom="use-case"]', {
		loop: true,
		// slidesPerView: "1",
		// centeredSlides: true,
		// loopAdditionalSlides: 5,
	});

	return swiper;
}
