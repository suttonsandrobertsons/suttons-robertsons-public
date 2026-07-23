const OVERFLOW_DRAG_TRACK_SELECTOR = [
	"[data-overflow-drag='track']",
	".overflow-content_track",
	".trust-bar_track",
].join(", ");
const OVERFLOW_DRAG_ITEMS_SELECTOR = [
	"[data-overflow-drag='content']",
	".overflow-content_list",
	".trust-bar_items",
].join(", ");
const OVERFLOW_DRAG_CLEANUP_KEY = "__overflowDragCleanup";

export function initOverflowDrag() {
	if (typeof gsap === "undefined" || typeof Draggable === "undefined") {
		console.warn("[overflowDrag] GSAP or Draggable not found.");

		return;
	}

	document.querySelectorAll(OVERFLOW_DRAG_TRACK_SELECTOR).forEach((wrapper) => {
		const items = wrapper.querySelector(OVERFLOW_DRAG_ITEMS_SELECTOR);

		if (!items) {
			return;
		}

		if (typeof wrapper[OVERFLOW_DRAG_CLEANUP_KEY] === "function") {
			wrapper[OVERFLOW_DRAG_CLEANUP_KEY]();
		}

		wrapper.dataset.overflowDragBound = "true";

		let draggable;
		let resizeTimer;

		function getMetrics() {
			const visibleWidth = wrapper.clientWidth;

			const contentWidth = items.scrollWidth;
			const overflowAmount = contentWidth - visibleWidth;
			const hasOverflow = overflowAmount > 0;

			wrapper.classList.toggle("has-overflow", hasOverflow);

			return {
				visibleWidth,
				contentWidth,
				overflowAmount,
				hasOverflow,
				minX: Math.min(0, visibleWidth - contentWidth),
				maxX: 0,
			};
		}

		function init() {
			const metrics = getMetrics();

			if (draggable) {
				draggable.kill();
				draggable = null;
			}

			gsap.set(items, {
				x: 0,
			});

			if (!metrics.hasOverflow) {
				return;
			}

			draggable = Draggable.create(items, {
				type: "x",
				inertia: true,
				zIndexBoost: false,
				bounds: {
					minX: metrics.minX,
					maxX: metrics.maxX,
				},
				edgeResistance: 0.9,
				dragClickables: true,
				onPress() {
					items.classList.add("is-dragging");
				},
				onRelease() {
					items.classList.remove("is-dragging");
				},
				onDragEnd() {
					items.classList.remove("is-dragging");
				},
			})[0];
		}

		function onResize() {
			clearTimeout(resizeTimer);

			resizeTimer = setTimeout(() => {
				init();
			}, 100);
		}

		function cleanup() {
			clearTimeout(resizeTimer);
			window.removeEventListener("resize", onResize);

			if (draggable) {
				draggable.kill();
				draggable = null;
			}

			wrapper.classList.remove("has-overflow");
		}

		init();
		window.addEventListener("resize", onResize);
		wrapper[OVERFLOW_DRAG_CLEANUP_KEY] = cleanup;
	});
}
