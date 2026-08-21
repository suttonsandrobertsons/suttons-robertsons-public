const DEFAULT_UNDERLINE_WIDTH_PROP = "--tabs--highlight-w";
const DEFAULT_UNDERLINE_OFFSET_PROP = "--tabs--highlight-l";

function getTransitionRoot(menu, listSelector) {
	if (!menu) return null;

	if (!listSelector) {
		return menu;
	}

	return menu.querySelector(listSelector);
}

export function menuUnderline(
	menu,
	target,
	underlineWidthProp = DEFAULT_UNDERLINE_WIDTH_PROP,
	underlineOffsetProp = DEFAULT_UNDERLINE_OFFSET_PROP,
	listSelector = "",
	withTransition = true,
) {
	if (!menu) return false;

	if (!target) {
		menu.style.setProperty(underlineWidthProp, "0px");
		menu.style.setProperty(underlineOffsetProp, "0px");
		return false;
	}

	const menuRect = menu.getBoundingClientRect();
	const targetRect = target.getBoundingClientRect();
	const offsetX = targetRect.left - menuRect.left + menu.scrollLeft;
	const width = targetRect.width;

	function update() {
		menu.style.setProperty(underlineWidthProp, `${width}px`);
		menu.style.setProperty(underlineOffsetProp, `${offsetX}px`);
	}

	if (!withTransition) {
		const transitionRoot = getTransitionRoot(menu, listSelector);

		if (transitionRoot) {
			transitionRoot.classList.add("no-transition");
			update();
			// Reading offsetHeight forces a layout, so "no-transition" is applied
			// before it's removed — otherwise the class swap can be batched and
			// the underline still animates into place.
			transitionRoot.offsetHeight;
			transitionRoot.classList.remove("no-transition");
			return true;
		}
	}

	update();
	return true;
}

export function syncMenuUnderline(menu, options = {}) {
	const {
		target = null,
		targetSelector = ".is-active",
		underlineWidthProp = DEFAULT_UNDERLINE_WIDTH_PROP,
		underlineOffsetProp = DEFAULT_UNDERLINE_OFFSET_PROP,
		listSelector = "",
		withTransition = true,
	} = options;
	const resolvedTarget =
		target || (menu && targetSelector ? menu.querySelector(targetSelector) : null);

	return menuUnderline(
		menu,
		resolvedTarget,
		underlineWidthProp,
		underlineOffsetProp,
		listSelector,
		withTransition,
	);
}
