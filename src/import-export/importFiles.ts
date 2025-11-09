import {
	isArgumentElement,
	isLiteralElement,
	isPluralElement,
	isPoundElement,
	isSelectElement,
	type MessageFormatElement,
	parse as parseICU,
} from "@formatjs/icu-messageformat-parser";
import type {
	Bundle,
	Declaration,
	InlangPlugin,
	Match,
	MessageImport,
	Pattern,
	VariableReference,
	VariantImport,
} from "@inlang/sdk";
import { flatten } from "flat";

export const importFiles: NonNullable<InlangPlugin["importFiles"]> = async ({
	files,
}) => {
	const bundles: Bundle[] = [];
	const messages: MessageImport[] = [];
	const variants: VariantImport[] = [];

	for (const file of files) {
		const json = JSON.parse(new TextDecoder().decode(file.content));
		const flattened = flatten(json, { safe: true }) as Record<string, string>;

		for (const key in flattened) {
			if (key === "$schema") {
				continue;
			}
			const value = flattened[key];
			if (!value) continue;
			const result = parseBundle(key, file.locale, value);
			messages.push(result.message);
			variants.push(...result.variants);

			const existingBundle = bundles.find((b) => b.id === result.bundle.id);
			if (existingBundle === undefined) {
				bundles.push(result.bundle);
			} else {
				// merge declarations without duplicates
				existingBundle.declarations = unique([
					...existingBundle.declarations,
					...result.bundle.declarations,
				]);
			}
		}
	}

	return { bundles, messages, variants };
};

function parseBundle(
	key: string,
	locale: string,
	value: string,
): {
	bundle: Bundle;
	message: MessageImport;
	variants: VariantImport[];
} {
	const ast = parseICU(value);
	const parsed = parseVariants(key, locale, ast);
	const declarations = unique(parsed.declarations);
	const selectors = unique(parsed.selectors);

	const undeclaredSelectors = selectors.filter(
		(selector) =>
			declarations.find((d) => d.name === selector.name) === undefined,
	);

	for (const undeclaredSelector of undeclaredSelectors) {
		declarations.push({
			type: "input-variable",
			name: undeclaredSelector.name,
		});
	}

	return {
		bundle: {
			id: key,
			declarations,
		},
		message: {
			bundleId: key,
			selectors,
			locale: locale,
		},
		variants: parsed.variants,
	};
}

function parseVariants(
	bundleId: string,
	locale: string,
	ast: MessageFormatElement[],
): {
	variants: VariantImport[];
	declarations: Declaration[];
	selectors: VariableReference[];
} {
	// Check if the message contains plural or select elements
	const hasPluralsOrSelects = ast.some(
		(el) => isPluralElement(el) || isSelectElement(el),
	);

	if (!hasPluralsOrSelects) {
		// Simple message - single variant
		const parsed = icuAstToPattern(ast);
		return {
			variants: [
				{
					messageBundleId: bundleId,
					messageLocale: locale,
					matches: [],
					pattern: parsed.pattern,
				},
			],
			declarations: parsed.declarations,
			selectors: [],
		};
	}

	// Complex message with plural/select
	const variants: VariantImport[] = [];
	const declarations = new Set<Declaration>();
	const selectors = new Set<VariableReference>();

	// Find the plural/select element (we'll handle the first one)
	for (const element of ast) {
		if (isPluralElement(element)) {
			const pluralSelectorName = `${element.value}Plural`;

			selectors.add({
				type: "variable-reference",
				name: pluralSelectorName,
			});

			// Add declaration for the plural function
			declarations.add({
				type: "local-variable",
				name: pluralSelectorName,
				value: {
					type: "expression",
					arg: {
						type: "variable-reference",
						name: element.value,
					},
					annotation: {
						type: "function-reference",
						name: "plural",
						options:
							element.pluralType === "ordinal"
								? [
										{
											name: "type",
											value: { type: "literal", value: "ordinal" },
										},
									]
								: [],
					},
				},
			});

			declarations.add({
				type: "input-variable",
				name: element.value,
			});

			// Process each plural option
			for (const [option, optionValue] of Object.entries(element.options)) {
				const parsed = icuAstToPattern(optionValue.value);

				for (const decl of parsed.declarations) {
					declarations.add(decl);
				}

				variants.push({
					messageBundleId: bundleId,
					messageLocale: locale,
					matches: [
						{
							type: option === "other" ? "catchall-match" : "literal-match",
							key: `${element.value}Plural`,
							...(option !== "other" && { value: option }),
						} as Match,
					],
					pattern: parsed.pattern,
				});
			}
		} else if (isSelectElement(element)) {
			selectors.add({
				type: "variable-reference",
				name: element.value,
			});

			declarations.add({
				type: "input-variable",
				name: element.value,
			});

			// Process each select option
			for (const [option, optionValue] of Object.entries(element.options)) {
				const parsed = icuAstToPattern(optionValue.value);

				for (const decl of parsed.declarations) {
					declarations.add(decl);
				}

				variants.push({
					messageBundleId: bundleId,
					messageLocale: locale,
					matches: [
						{
							type: option === "other" ? "catchall-match" : "literal-match",
							key: element.value,
							...(option !== "other" && { value: option }),
						} as Match,
					],
					pattern: parsed.pattern,
				});
			}
		}
	}

	return {
		variants,
		declarations: Array.from(declarations),
		selectors: Array.from(selectors),
	};
}

function icuAstToPattern(ast: MessageFormatElement[]): {
	declarations: Declaration[];
	pattern: Pattern;
} {
	const pattern: Pattern = [];
	const declarations: Declaration[] = [];

	for (const element of ast) {
		if (isLiteralElement(element)) {
			pattern.push({ type: "text", value: element.value });
		} else if (isArgumentElement(element)) {
			// Simple variable reference
			declarations.push({
				type: "input-variable",
				name: element.value,
			});
			pattern.push({
				type: "expression",
				arg: { type: "variable-reference", name: element.value },
			});
		} else if (isPoundElement(element)) {
			// The # symbol in plural messages - we'll treat it as the count variable
			// This is a bit tricky - we need to infer the variable name from context
			// For now, we'll skip it or handle it as text
			pattern.push({ type: "text", value: "#" });
		}
		// Note: nested plural/select would need recursive handling
	}

	return { declarations, pattern };
}

const unique = <T>(arr: T[]): T[] =>
	[...new Set(arr.map((item) => JSON.stringify(item)))].map((item) =>
		JSON.parse(item),
	);
