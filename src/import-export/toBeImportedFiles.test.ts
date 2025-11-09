import { expect, test } from "vitest";
import { toBeImportedFiles } from "./toBeImportedFiles.js";

test("toBeImportedFiles should work with locale as setting", async () => {
	const result = await toBeImportedFiles({
		settings: {
			baseLocale: "en",
			locales: ["en", "de"],
			"plugin.volcie.icu-messageFormat": {
				pathPattern: "/translations/{locale}.json",
			},
		},
	});

	expect(result).toEqual([
		{
			locale: "en",
			path: "/translations/en.json",
		},
		{
			locale: "de",
			path: "/translations/de.json",
		},
	]);
});

test("toBeImportedFiles returns [] if the pathPattern is not provided", async () => {
	const result = await toBeImportedFiles({
		settings: {
			baseLocale: "en",
			locales: ["en", "de"],
			"plugin.volcie.icu-messageFormat": {
				"some-other-prop": "value",
				// pathPattern: "/translations/{locale}.json",
			},
		},
	});

	expect(result).toEqual([]);
});

test("toBeImportedFiles should work with languageTag as setting for backward compatibility", async () => {
	const result = await toBeImportedFiles({
		settings: {
			baseLocale: "en",
			locales: ["en", "de"],
			"plugin.volcie.icu-messageFormat": {
				pathPattern: "/translations/{languageTag}.json",
			},
		},
	});

	expect(result).toEqual([
		{
			locale: "en",
			path: "/translations/en.json",
		},
		{
			locale: "de",
			path: "/translations/de.json",
		},
	]);
});

test("toBeImportedFiles should work with both locale and languageTag and multiple pathPatterns", async () => {
	const result = await toBeImportedFiles({
		settings: {
			baseLocale: "en",
			locales: ["en", "de"],
			"plugin.volcie.icu-messageFormat": {
				pathPattern: ["/defaults/{locale}.json", "/translations/{locale}.json"],
			},
		},
	});

	expect(result).toEqual([
		{
			locale: "en",
			path: "/defaults/en.json",
		},
		{
			locale: "de",
			path: "/defaults/de.json",
		},
		{
			locale: "en",
			path: "/translations/en.json",
		},
		{
			locale: "de",
			path: "/translations/de.json",
		},
	]);
});
