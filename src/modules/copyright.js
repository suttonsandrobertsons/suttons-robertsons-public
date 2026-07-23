export function initCopyrightYear() {
	const year = new Date().getFullYear().toString();

	document.querySelectorAll("[data-copyright='year']").forEach((el) => {
		el.textContent = year;
	});
}
