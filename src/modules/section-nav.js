export function initSectionNav() {
	const sectionNavs = document.querySelectorAll("[data-section-nav='component']");
	const sections = Array.from(document.querySelectorAll("[data-section-nav-text]")).filter(
		(section) => {
			return section.dataset.sectionNavText.trim() !== "";
		},
	);

	if (!sectionNavs.length) return null;

	function setComponentState(component, state) {
		component.setAttribute("data-section-nav-state", state);
	}

	if (!sections.length) {
		sectionNavs.forEach((component) => {
			const list = component.querySelector("[data-section-nav='list']");

			if (list) list.replaceChildren();

			setComponentState(component, "empty");
		});

		return null;
	}

	function initScrollProgress(component) {
		const progress = component.querySelector("[data-section-nav='progress']");

		if (!progress || typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;

		gsap.set(progress, {
			scaleX: 0,
			transformOrigin: "left center",
		});

		gsap.to(progress, {
			scaleX: 1,
			ease: "none",
			scrollTrigger: {
				trigger: ".page-wrap",
				start: "top top",
				end: "bottom bottom",
				scrub: 1,
			},
		});
	}

	const usedIds = new Set(
		Array.from(document.querySelectorAll("[id]")).map((element) => element.id),
	);

	function slugify(value) {
		return (
			value
				.toLowerCase()
				.trim()
				.replace(/&/g, "and")
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-+|-+$/g, "") || "section"
		);
	}

	function getUniqueId(text) {
		const baseId = slugify(text);
		let id = baseId;
		let index = 2;

		while (usedIds.has(id)) {
			id = `${baseId}-${index}`;
			index += 1;
		}

		usedIds.add(id);

		return id;
	}

	const links = sections.map((section) => {
		const text = section.dataset.sectionNavText.trim();

		if (!section.id) {
			section.id = getUniqueId(text);
		} else {
			usedIds.add(section.id);
		}

		return {
			id: section.id,
			text,
		};
	});

	const linkEntries = [];

	function setActiveLink(id, options = {}) {
		const { updateHash = false } = options;

		linkEntries.forEach(({ item, anchor, sectionId }) => {
			const isActive = sectionId === id;

			item.classList.toggle("is-active", isActive);
			anchor.classList.toggle("is-active", isActive);
			if (isActive) {
				anchor.setAttribute("aria-current", "location");
			} else {
				anchor.removeAttribute("aria-current");
			}
		});

		if (updateHash && id && window.location.hash !== `#${id}`) {
			// history.replaceState(null, "", `#${id}`);
		}
	}

	function getViewportHeight() {
		return window.innerHeight || document.documentElement.clientHeight || 0;
	}

	function getVisibleSectionId() {
		const viewportHeight = getViewportHeight();

		if (!viewportHeight) return null;

		const activationLine = viewportHeight * 0.5;
		const activeSection = sections.find((section) => {
			const { top, bottom } = section.getBoundingClientRect();

			return top <= activationLine && bottom >= activationLine;
		});

		return activeSection?.id || null;
	}

	function syncActiveLink(options = {}) {
		const visibleSectionId = getVisibleSectionId();

		setActiveLink(visibleSectionId, options);
	}

	function getCurrentHashId() {
		return decodeURIComponent(window.location.hash.replace(/^#/, ""));
	}

	sectionNavs.forEach((component) => {
		setComponentState(component, "ready");
		initScrollProgress(component);

		const list = component.querySelector("[data-section-nav='list']");

		if (!list) return;

		list.replaceChildren();

		links.forEach((link) => {
			const item = document.createElement("li");
			const anchor = document.createElement("a");

			item.className = "section-nav_item";
			anchor.className = "section-nav_link u-link-effect-inherit";
			anchor.href = `#${link.id}`;
			anchor.textContent = link.text;
			item.dataset.text = link.text;

			item.append(anchor);
			list.append(item);

			linkEntries.push({
				item,
				anchor,
				sectionId: link.id,
			});
		});
	});

	const refreshOverflowDrag = window.sr?.functions?.initOverflowDrag;

	if (typeof refreshOverflowDrag === "function") {
		requestAnimationFrame(() => {
			refreshOverflowDrag();
		});
	}

	const initialHashId = getCurrentHashId();

	if (initialHashId && links.some((link) => link.id === initialHashId)) {
		setActiveLink(initialHashId);
	} else {
		syncActiveLink();
	}

	function onHashChange() {
		const hashId = getCurrentHashId();

		if (hashId && links.some((link) => link.id === hashId)) {
			setActiveLink(hashId);
		}
	}

	window.addEventListener("hashchange", onHashChange);

	const observer =
		typeof IntersectionObserver === "undefined"
			? null
		: new IntersectionObserver(
					(entries) => {
						if (!entries.length) return;

						syncActiveLink({ updateHash: true });
					},
					{
						root: null,
						rootMargin: "-50% 0px -50% 0px",
						threshold: 0,
					},
				);

	if (observer) {
		sections.forEach((section) => observer.observe(section));
	}

	// Return destroy function for cleanup
	return function destroy() {
		observer?.disconnect();
		window.removeEventListener("hashchange", onHashChange);
	};
}
