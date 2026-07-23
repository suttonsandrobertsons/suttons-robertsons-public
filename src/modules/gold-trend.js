import { qsa } from "../utils/dom.js";
import { formConfig } from "./forms/config.js";

const selectors = {
	trendTarget: "[data-gold-trend]",
	changeTarget: "[data-gold-change]",
	heroGold: ".hero-gold",
};

function getWorkerBase() {
	return String(formConfig.uploads.workerBase || "").replace(/\/$/, "");
}

function getTrendUrl() {
	const workerBase = getWorkerBase();

	if (!workerBase) {
		throw new Error("Gold trend worker base is not configured.");
	}

	return `${workerBase}${formConfig.gold.trendEndpoint}`;
}

function setStatus(targets, status) {
	targets.forEach((target) => {
		target.setAttribute("data-gold-trend-status", status);
	});
}

function setWrapperStatus(status) {
	const wrappers = qsa(document, selectors.heroGold);
	wrappers.forEach((wrapper) => {
		wrapper.setAttribute("data-gold-trend-status", status);
	});
}

function getTargets(kind) {
	const targets = [];

	targets.push(...qsa(document, `${selectors.trendTarget}[data-gold-trend="${kind}"]`));
	targets.push(...qsa(document, `${selectors.changeTarget}[data-gold-change="${kind}"]`));

	return [...new Set(targets)];
}

function getAllTargets() {
	return [
		...getTargets("direction"),
		...getTargets("percentage"),
		...getTargets("summary"),
	];
}

function parseTrend(payload) {
	const direction = String(payload?.direction || "").trim();
	const percentage = Number(payload?.percentage);
	const summary = String(payload?.summary || "").trim();

	if (!["risen", "fallen", "unchanged"].includes(direction)) {
		throw new Error("Gold trend response missing direction.");
	}

	if (!Number.isFinite(percentage) || percentage < 0) {
		throw new Error("Gold trend response missing percentage.");
	}

	return {
		direction,
		percentage: Math.round(percentage),
		summary,
	};
}

async function fetchGoldTrend() {
	const response = await fetch(getTrendUrl(), {
		headers: {
			[formConfig.uploads.clientHeaderName]: formConfig.uploads.clientHeaderValue,
		},
	});
	const payload = await response.json().catch(() => ({}));

	if (!response.ok) {
		throw new Error(payload.error || payload.message || `Gold trend request failed (${response.status}).`);
	}

	return parseTrend(payload);
}

function writeTargets(targets, value) {
	targets.forEach((target) => {
		target.innerText = value;
	});
	setStatus(targets, "updated");
}

function renderGoldTrend(trend) {
	writeTargets(getTargets("direction"), trend.direction);
	writeTargets(getTargets("percentage"), `${trend.percentage}%`);

	if (trend.summary) {
		writeTargets(getTargets("summary"), trend.summary);
	}
}

export async function initGoldTrend() {
	const targets = getAllTargets();
	if (!targets.length) return null;

	setStatus(targets, "pending");
	setWrapperStatus("pending");

	try {
		const trend = await fetchGoldTrend();
		renderGoldTrend(trend);
		setWrapperStatus("updated");
		return trend;
	} catch (error) {
		setStatus(targets, "error");
		setWrapperStatus("error");
		console.error("[gold-trend] Failed to load gold trend.", error);
		return null;
	}
}
