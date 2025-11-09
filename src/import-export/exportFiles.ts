import type {
	Bundle,
	ExportFile,
	InlangPlugin,
	Message,
	Variant,
} from "@inlang/sdk";
import { unflatten } from "flat";

export const exportFiles: NonNullable<InlangPlugin["exportFiles"]> = async ({
	bundles,
	messages,
	variants,
}) => {
	const files: Record<string, Record<string, string>> = {};

	for (const message of messages) {
		const bundle = bundles.find((b) => b.id === message.bundleId);
		if (!bundle) continue;

		const variantsOfMessage = [
			...variants
				.reduce((r, v) => {
					if (v.messageId === message.id) r.set(JSON.stringify(v.matches), v);
					return r;
				}, new Map<string, (typeof variants)[number]>())
				.values(),
		];

		if (!files[message.locale]) {
			files[message.locale] = {};
		}

		const serialized = serializeMessage(bundle, message, variantsOfMessage);
		files[message.locale] = { ...files[message.locale], ...serialized };
	}

	const result: ExportFile[] = [];

	for (const locale in files) {
		result.push({
			locale,
			content: new TextEncoder().encode(
				JSON.stringify(unflatten(files[locale]), undefined, "\t"),
			),
			name: `${locale}.json`,
		});
	}

	return result;
};

function serializeMessage(
	bundle: Bundle,
	message: Message,
	variants: Variant[],
): Record<string, string> {
	const key = message.bundleId;
	const value = serializeVariants(bundle, message, variants);
	return { [key]: value };
}

function serializeVariants(
	bundle: Bundle,
	message: Message,
	variants: Variant[],
): string {
	// Single variant - simple message
	if (variants.length === 1 && variants[0]?.matches.length === 0) {
		const firstVariant = variants[0];
		if (!firstVariant) return "";
		return serializePattern(firstVariant.pattern);
	}

	// Multiple variants - need to determine if it's plural or select
	if (message.selectors.length === 0) {
		// No explicit selectors, just return first variant
		const firstVariant = variants[0];
		if (!firstVariant) return "";
		return serializePattern(firstVariant.pattern);
	}

	// Find the selector variable
	const selector = message.selectors[0];
	if (!selector) {
		return serializeSelectMessage("unknown", variants);
	}
	const selectorName = selector.name;

	// Determine if this is a plural or select based on declarations
	const declaration = bundle.declarations.find(
		(d) => d.type === "local-variable" && d.name === selectorName,
	);

	const isPluralMessage =
		declaration?.type === "local-variable" &&
		declaration.value.annotation?.name === "plural";

	if (isPluralMessage) {
		// Extract the actual variable name (remove the "Plural" suffix if present)
		const actualVarName =
			declaration.value.arg.type === "variable-reference"
				? declaration.value.arg.name
				: selectorName;

		return serializePluralMessage(actualVarName, variants);
	}

	// Otherwise treat as select
	return serializeSelectMessage(selectorName, variants);
}

function serializePluralMessage(
	variableName: string,
	variants: Variant[],
): string {
	const options: string[] = [];

	for (const variant of variants) {
		const match = variant.matches[0];
		if (!match) continue;

		const key =
			match.type === "catchall-match" ? "other" : match.value || "other";
		const pattern = serializePattern(variant.pattern);

		options.push(`${key} {${pattern}}`);
	}

	return `{${variableName}, plural, ${options.join(" ")}}`;
}

function serializeSelectMessage(
	variableName: string,
	variants: Variant[],
): string {
	const options: string[] = [];

	for (const variant of variants) {
		const match = variant.matches[0];
		if (!match) continue;

		const key =
			match.type === "catchall-match" ? "other" : match.value || "other";
		const pattern = serializePattern(variant.pattern);

		options.push(`${key} {${pattern}}`);
	}

	return `{${variableName}, select, ${options.join(" ")}}`;
}

function serializePattern(pattern: Variant["pattern"]): string {
	let result = "";

	for (const part of pattern) {
		if (part.type === "text") {
			result += part.value;
		} else if (part.arg.type === "variable-reference") {
			result += `{${part.arg.name}}`;
		} else {
			throw new Error("Unsupported expression type");
		}
	}

	return result;
}
