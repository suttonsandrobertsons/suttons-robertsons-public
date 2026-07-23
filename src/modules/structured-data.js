import { qsa } from "../utils/dom.js";

const SCRIPT_SELECTOR = 'script[data-structured-data-generated="true"]';
const GENERATED_ATTR = "data-structured-data-generated";
const GENERATED_TYPE_ATTR = "data-structured-data-type";
const GENERATED_ROOT_ATTR = "data-structured-data-root";
const GENERATED_INDEX_ATTR = "data-structured-data-index";
const JSON_LD_CONTEXT = "https://schema.org";

const registry = new Map();

function normalizeTypeName(value) {
	return String(value || "")
		.trim()
		.toLowerCase();
}

function parseTypeList(value) {
	if (!value || typeof value !== "string") return [];

	return value
		.split(/[\s,]+/)
		.map(normalizeTypeName)
		.filter(Boolean);
}

function collapseWhitespace(value) {
	return String(value || "")
		.replace(/\s+/g, " ")
		.trim();
}

function getTextContent(node) {
	if (!node) return "";

	return collapseWhitespace(node.textContent || "");
}

function ensureJsonLdContext(schema) {
	if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
		return schema;
	}

	return schema["@context"] ? schema : { "@context": JSON_LD_CONTEXT, ...schema };
}

function createJsonLdScript(schema, type, root, index) {
	const script = document.createElement("script");

	script.type = "application/ld+json";
	script.setAttribute(GENERATED_ATTR, "true");
	script.setAttribute(GENERATED_TYPE_ATTR, type);

	if (root?.id) {
		script.setAttribute(GENERATED_ROOT_ATTR, root.id);
	}

	if (Number.isFinite(index)) {
		script.setAttribute(GENERATED_INDEX_ATTR, String(index));
	}

	script.textContent = JSON.stringify(ensureJsonLdContext(schema));

	return script;
}

function removeGeneratedScripts(scope = document) {
	qsa(scope, SCRIPT_SELECTOR).forEach((script) => {
		script.remove();
	});
}

function getRegistryEntry(type) {
	return registry.get(normalizeTypeName(type)) || null;
}

function renderSchemas(type, root) {
	const entry = getRegistryEntry(type);

	if (!entry) return [];

	const result = entry.build(root);
	const schemas = Array.isArray(result) ? result : result ? [result] : [];

	return schemas
		.map((schema) => ensureJsonLdContext(schema))
		.filter(Boolean)
		.map((schema, index) => createJsonLdScript(schema, type, root, index));
}

function appendScripts(scripts, scope = document) {
	if (!scripts.length) return;

	const mountPoint =
		scope && scope.nodeType !== Node.DOCUMENT_NODE && typeof scope.appendChild === "function"
			? scope
			: document.head || document.body || document.documentElement;

	scripts.forEach((script) => {
		mountPoint.appendChild(script);
	});
}

function getExplicitRoots(scope = document) {
	return qsa(scope, "[data-structured-data]");
}

function getAutoRoots(scope = document, explicitRoots = new Set()) {
	const roots = [];
	const seen = new WeakMap();
	const entries = [...registry.entries()].sort(
		(a, b) => (b[1].priority || 0) - (a[1].priority || 0),
	);

	entries.forEach(([type, entry]) => {
		if (!entry.selector) return;

		qsa(scope, entry.selector).forEach((root) => {
			const matchedTypes = seen.get(root) || new Set();

			if (explicitRoots.has(root) || matchedTypes.has(type)) return;

			matchedTypes.add(type);
			seen.set(root, matchedTypes);
			roots.push({ root, type });
		});
	});

	return roots;
}

function getExplicitTypeRoots(scope = document) {
	const roots = [];

	getExplicitRoots(scope).forEach((root) => {
		const types = parseTypeList(root.getAttribute("data-structured-data"));

		if (!types.length) return;

		types.forEach((type) => roots.push({ root, type }));
	});

	return roots;
}

export function registerStructuredDataType(type, options = {}) {
	const normalizedType = normalizeTypeName(type);
	const build = options.build;

	if (!normalizedType) {
		throw new Error("Structured data type is required.");
	}

	if (typeof build !== "function") {
		throw new Error(`Structured data builder for "${normalizedType}" must be a function.`);
	}

	registry.set(normalizedType, {
		selector: options.selector || "",
		priority: Number.isFinite(options.priority) ? options.priority : 0,
		build,
	});
}

export function buildFaqStructuredData(root) {
	const items = qsa(root, '[data-schema="faq-item"]');
	const uniqueEntities = [];
	const seen = new Set();

	items.forEach((item) => {
		const questionNode = item.querySelector('[data-schema="faq-question"]');
		const answerNode = item.querySelector('[data-schema="faq-answer"]');
		const question = getTextContent(questionNode);
		const answer = getTextContent(answerNode);
		const signature = `${question}:::${answer}`;

		if (!question || !answer || seen.has(signature)) return;

		seen.add(signature);
		uniqueEntities.push({
			"@type": "Question",
			name: question,
			acceptedAnswer: {
				"@type": "Answer",
				text: answer,
			},
		});
	});

	if (!uniqueEntities.length) return null;

	return {
		"@type": "FAQPage",
		mainEntity: uniqueEntities,
	};
}

export function initStructuredData(scope = document) {
	removeGeneratedScripts(scope);

	const scripts = [];
	const explicitRoots = new Set();

	getExplicitTypeRoots(scope).forEach(({ root, type }) => {
		explicitRoots.add(root);
		scripts.push(...renderSchemas(type, root));
	});

	getAutoRoots(scope, explicitRoots).forEach(({ root, type }) => {
		scripts.push(...renderSchemas(type, root));
	});

	appendScripts(scripts, scope);

	return scripts;
}

registerStructuredDataType("faq", {
	build: buildFaqStructuredData,
});
