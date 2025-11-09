import type {
	Bundle,
	Declaration,
	Message,
	Pattern,
	Variant,
	VariantImport,
} from "@inlang/sdk";
import { expect, test } from "vitest";
import { exportFiles } from "./exportFiles.js";
import { importFiles } from "./importFiles.js";

test("it handles simple messages without placeholders", async () => {
	const imported = await runImportFiles({
		some_happy_cat: "Read more about Lix",
	});
	expect(await runExportFilesParsed(imported)).toMatchObject({
		some_happy_cat: "Read more about Lix",
	});

	expect(imported.bundles).toHaveLength(1);
	expect(imported.messages).toHaveLength(1);
	expect(imported.variants).toHaveLength(1);

	expect(imported.bundles[0]?.id).toStrictEqual("some_happy_cat");
	expect(imported.bundles[0]?.declarations).toStrictEqual([]);

	expect(imported.messages[0]?.selectors).toStrictEqual([]);

	expect(imported.variants[0]?.matches).toStrictEqual([]);
	expect(imported.variants[0]?.pattern).toStrictEqual([
		{ type: "text", value: "Read more about Lix" },
	]);
});

test("it handles variable placeholders in patterns", async () => {
	const imported = await runImportFiles({
		some_happy_cat:
			"Used by {count} devs, {numDesigners} designers and translators",
	});
	expect(await runExportFilesParsed(imported)).toMatchObject({
		some_happy_cat:
			"Used by {count} devs, {numDesigners} designers and translators",
	});

	expect(imported.bundles).toHaveLength(1);
	expect(imported.messages).toHaveLength(1);
	expect(imported.variants).toHaveLength(1);

	expect(imported.bundles[0]?.id).toStrictEqual("some_happy_cat");
	expect(imported.bundles[0]?.declarations).toStrictEqual([
		{ type: "input-variable", name: "count" },
		{ type: "input-variable", name: "numDesigners" },
	] satisfies Declaration[]);

	expect(imported.messages[0]?.selectors).toStrictEqual([]);

	expect(imported.variants[0]?.matches).toStrictEqual([]);
	expect(imported.variants[0]?.pattern).toStrictEqual([
		{ type: "text", value: "Used by " },
		{
			type: "expression",
			arg: { type: "variable-reference", name: "count" },
		},
		{
			type: "text",
			value: " devs, ",
		},
		{
			type: "expression",
			arg: { type: "variable-reference", name: "numDesigners" },
		},
		{
			type: "text",
			value: " designers and translators",
		},
	] satisfies Pattern);
});

test("it handles ICU plural messages", async () => {
	const imported = await runImportFiles({
		some_happy_cat:
			"{count, plural, one {There is one cat.} other {There are many cats.}}",
	});

	const exported = await runExportFilesParsed(imported);
	expect(exported.some_happy_cat).toContain("plural");
	expect(exported.some_happy_cat).toContain("one");
	expect(exported.some_happy_cat).toContain("other");

	expect(imported.bundles).toHaveLength(1);
	expect(imported.messages).toHaveLength(1);
	expect(imported.variants).toHaveLength(2);

	expect(imported.bundles[0]?.id).toStrictEqual("some_happy_cat");
	expect(imported.bundles[0]?.declarations).toStrictEqual(
		expect.arrayContaining([
			{ type: "input-variable", name: "count" },
			{
				type: "local-variable",
				name: "countPlural",
				value: {
					type: "expression",
					arg: {
						name: "count",
						type: "variable-reference",
					},
					annotation: {
						type: "function-reference",
						name: "plural",
						options: [],
					},
				},
			},
		] satisfies Declaration[]),
	);

	expect(imported.messages[0]?.selectors).toStrictEqual(
		expect.arrayContaining([
			{ type: "variable-reference", name: "countPlural" },
		] satisfies Message["selectors"]),
	);

	expect(imported.variants[0]).toStrictEqual(
		expect.objectContaining({
			matches: expect.arrayContaining([
				expect.objectContaining({ key: "countPlural" }),
			]),
			pattern: [{ type: "text", value: "There is one cat." }],
		} satisfies Partial<Variant>),
	);

	expect(imported.variants[1]).toStrictEqual(
		expect.objectContaining({
			matches: expect.arrayContaining([
				expect.objectContaining({ key: "countPlural" }),
			]),
			pattern: [{ type: "text", value: "There are many cats." }],
		} satisfies Partial<Variant>),
	);
});

test("it handles ICU select messages", async () => {
	const imported = await runImportFiles({
		some_happy_cat:
			"{gender, select, male {He likes cats.} female {She likes cats.} other {They like cats.}}",
	});

	const exported = await runExportFilesParsed(imported);
	expect(exported.some_happy_cat).toContain("select");
	expect(exported.some_happy_cat).toContain("male");
	expect(exported.some_happy_cat).toContain("female");

	expect(imported.bundles).toHaveLength(1);
	expect(imported.messages).toHaveLength(1);
	expect(imported.variants).toHaveLength(3);

	expect(imported.bundles[0]?.declarations).toStrictEqual(
		expect.arrayContaining([
			{ type: "input-variable", name: "gender" },
		] satisfies Declaration[]),
	);
});

test("handles inputs of a bundle even if one message doesn't use all inputs", async () => {
	const imported = await importFiles({
		settings: {
			baseLocale: "en",
			locales: ["en", "de"],
		},
		files: [
			{
				locale: "en",
				content: new TextEncoder().encode(
					JSON.stringify({
						blue_horse_shoe: "Hello {username}! Welcome in {placename}.",
					}),
				),
			},
			{
				locale: "de",
				content: new TextEncoder().encode(
					JSON.stringify({
						blue_horse_shoe: "Willkommen {username}!",
					}),
				),
			},
		],
	});

	expect(imported.bundles).toHaveLength(1);
	expect(imported.messages).toHaveLength(2);
	expect(imported.variants).toHaveLength(2);

	expect(imported.bundles[0]?.declarations).toStrictEqual([
		{ type: "input-variable", name: "username" },
		{ type: "input-variable", name: "placename" },
	]);

	const exported = await runExportFiles(imported);

	expect(
		JSON.parse(new TextDecoder().decode(exported[0]?.content)),
	).toMatchObject({
		blue_horse_shoe: "Hello {username}! Welcome in {placename}.",
	});

	expect(
		JSON.parse(new TextDecoder().decode(exported[1]?.content)),
	).toMatchObject({
		blue_horse_shoe: "Willkommen {username}!",
	});
});

test("it handles multiple files for the same locale", async () => {
	const imported = await importFiles({
		settings: {
			baseLocale: "en",
			locales: ["en"],
		},
		files: [
			{
				locale: "en",
				content: new TextEncoder().encode(
					JSON.stringify({
						some_happy_cat: "Read more about Lix",
						one_happy_dog: "This explains itself",
					}),
				),
			},
			{
				locale: "en",
				content: new TextEncoder().encode(
					JSON.stringify({
						some_happy_cat: "Read more about Lix",
						one_happy_dog: "Read more about Inlang",
					}),
				),
			},
		],
	});
	expect(await runExportFilesParsed(imported)).toMatchObject({
		some_happy_cat: "Read more about Lix",
		one_happy_dog: "Read more about Inlang",
	});

	expect(imported.bundles).toHaveLength(2);
	expect(imported.messages).toHaveLength(4);
	expect(imported.variants).toHaveLength(4);
});

test("it handles nested simple messages", async () => {
	const imported = await runImportFiles({
		navigation: {
			home: "Home",
			about: "About",
			contact: {
				email: "Email",
				phone: "Phone",
			},
		},
	});

	expect(await runExportFilesParsed(imported)).toMatchObject({
		navigation: {
			home: "Home",
			about: "About",
			contact: {
				email: "Email",
				phone: "Phone",
			},
		},
	});

	expect(imported.bundles).toHaveLength(4);
	expect(imported.messages).toHaveLength(4);
	expect(imported.variants).toHaveLength(4);

	// Check that bundle IDs use dot notation
	expect(imported.bundles.map((b) => b.id)).toContain("navigation.home");
	expect(imported.bundles.map((b) => b.id)).toContain("navigation.about");
	expect(imported.bundles.map((b) => b.id)).toContain(
		"navigation.contact.email",
	);
	expect(imported.bundles.map((b) => b.id)).toContain(
		"navigation.contact.phone",
	);
});

test("it handles nested ICU plural messages", async () => {
	const imported = await runImportFiles({
		navigation: {
			items: {
				count:
					"{count, plural, one {There is one item} other {There are # items}}",
			},
		},
	});

	const exported = await runExportFilesParsed(imported);
	expect(exported.navigation.items.count).toContain("plural");

	expect(imported.bundles).toHaveLength(1);
	expect(imported.messages).toHaveLength(1);
	expect(imported.variants).toHaveLength(2);

	// Check that bundle ID uses dot notation
	expect(imported.bundles[0]?.id).toEqual("navigation.items.count");

	expect(imported.bundles[0]?.declarations).toStrictEqual(
		expect.arrayContaining([
			{ type: "input-variable", name: "count" },
			{
				type: "local-variable",
				name: "countPlural",
				value: {
					type: "expression",
					arg: {
						name: "count",
						type: "variable-reference",
					},
					annotation: {
						type: "function-reference",
						name: "plural",
						options: [],
					},
				},
			},
		]),
	);

	expect(imported.messages[0]?.selectors).toStrictEqual(
		expect.arrayContaining([
			{ type: "variable-reference", name: "countPlural" },
		]),
	);
});

test("it correctly handles messages with duplicate placeholders", async () => {
	const imported = await importFiles({
		settings: {
			baseLocale: "en-us",
			locales: ["en-us", "de-de"],
		},
		files: [
			{
				locale: "en-us",
				content: new TextEncoder().encode(
					JSON.stringify({
						date_last_days: "Last {days} days",
					}),
				),
			},
			{
				locale: "de-de",
				content: new TextEncoder().encode(
					JSON.stringify({
						date_last_days: "Letzte {days} Tage",
					}),
				),
			},
		],
	});

	expect(imported.bundles).toHaveLength(1);
	expect(imported.messages).toHaveLength(2);
	expect(imported.variants).toHaveLength(2);

	// Check that the bundle has only one declaration
	expect(imported.bundles[0]?.id).toBe("date_last_days");
	expect(imported.bundles[0]?.declarations).toHaveLength(1);
	expect(imported.bundles[0]?.declarations?.[0]).toMatchObject({
		type: "input-variable",
		name: "days",
	});

	const exported = await runExportFiles(imported);
	const enExport = JSON.parse(
		new TextDecoder().decode(
			exported.find((e) => e.locale === "en-us")?.content || new Uint8Array(),
		),
	);
	const deExport = JSON.parse(
		new TextDecoder().decode(
			exported.find((e) => e.locale === "de-de")?.content || new Uint8Array(),
		),
	);

	expect(enExport).toMatchObject({
		date_last_days: "Last {days} days",
	});
	expect(deExport).toMatchObject({
		date_last_days: "Letzte {days} Tage",
	});
});

test("it correctly handles messages with the same placeholder used multiple times in a string", async () => {
	const imported = await runImportFiles({
		repeat_value: "The value {value} appears twice: {value}",
	});

	expect(imported.bundles).toHaveLength(1);
	expect(imported.messages).toHaveLength(1);
	expect(imported.variants).toHaveLength(1);

	// Check that the bundle only has a single declaration for "value"
	expect(imported.bundles[0]?.declarations).toHaveLength(1);
	expect(imported.bundles[0]?.declarations?.[0]).toMatchObject({
		type: "input-variable",
		name: "value",
	});

	// Check pattern has two references to the same variable
	expect(imported.variants[0]?.pattern).toEqual([
		{ type: "text", value: "The value " },
		{ type: "expression", arg: { type: "variable-reference", name: "value" } },
		{ type: "text", value: " appears twice: " },
		{ type: "expression", arg: { type: "variable-reference", name: "value" } },
	]);

	// Verify export
	const exported = await runExportFilesParsed(imported);
	expect(exported).toMatchObject({
		repeat_value: "The value {value} appears twice: {value}",
	});
});

test("roundtrip with new variants that have been created by apps", async () => {
	const imported1 = await runImportFiles({
		some_happy_cat: "Read more about Lix",
	});

	// simulating adding a new bundle, message, and variant
	imported1.bundles.push({
		id: "green_box_atari",
		declarations: [],
	});

	imported1.messages.push({
		id: "0j299j-3si02j0j4=s02-3js2",
		bundleId: "green_box_atari",
		selectors: [],
		locale: "en",
	});

	imported1.variants.push({
		id: "929s",
		matches: [],
		messageId: "0j299j-3si02j0j4=s02-3js2",
		pattern: [{ type: "text", value: "New variant" }],
	});

	// export after adding the bundle, messages, variants
	const exported1 = await runExportFiles(imported1);

	const imported2 = await runImportFiles(
		JSON.parse(new TextDecoder().decode(exported1[0]?.content)),
	);

	const exported2 = await runExportFiles(imported2);

	// Check bundles by ID rather than position
	expect(imported2.bundles.map((b) => b.id).sort()).toEqual(
		["some_happy_cat", "green_box_atari"].sort(),
	);

	expect(exported2).toStrictEqual(exported1);
});

// convenience wrapper for less testing code
function runImportFiles(json: Record<string, unknown>) {
	return importFiles({
		settings: {
			baseLocale: "en",
			locales: ["en"],
		},
		files: [
			{
				locale: "en",
				content: new TextEncoder().encode(JSON.stringify(json)),
			},
		],
	});
}

// convenience wrapper for less testing code
async function runExportFiles(
	imported: Awaited<ReturnType<typeof importFiles>>,
) {
	// add ids which are undefined from the import
	for (const message of imported.messages) {
		if (message.id === undefined) {
			message.id =
				imported.messages.find(
					(m) => m.bundleId === message.bundleId && m.locale === message.locale,
				)?.id ?? `${Math.random() * 1000}`;
		}
	}
	for (const variant of imported.variants) {
		const variantWithId = variant as Variant;
		if (variant.id === undefined) {
			variantWithId.id = `${Math.random() * 1000}`;
		}
		const variantImport = variant as VariantImport;
		if (variantWithId.messageId === undefined) {
			const foundMessage = imported.messages.find(
				(m) =>
					m.bundleId === variantImport.messageBundleId &&
					m.locale === variantImport.messageLocale,
			);
			if (foundMessage?.id) {
				variantWithId.messageId = foundMessage.id;
			}
		}
	}

	const exported = await exportFiles({
		settings: {
			baseLocale: "en",
			locales: ["en"],
		},
		bundles: imported.bundles as Bundle[],
		messages: imported.messages as Message[],
		variants: imported.variants as Variant[],
	});

	return exported;
}

// convenience wrapper for less testing code
async function runExportFilesParsed(
	imported: Awaited<ReturnType<typeof importFiles>>,
) {
	const exported = await runExportFiles(imported);
	return JSON.parse(new TextDecoder().decode(exported[0]?.content));
}
