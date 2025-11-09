import type { InlangPlugin } from "@inlang/sdk";

export const toBeImportedFiles: NonNullable<
	InlangPlugin["toBeImportedFiles"]
> = async ({ settings }) => {
	const PLUGIN_KEY = "plugin.volcie.icu-messageFormat";
	const result = [];

	const pathPatterns = settings[PLUGIN_KEY]?.pathPattern
		? Array.isArray(settings[PLUGIN_KEY].pathPattern)
			? settings[PLUGIN_KEY].pathPattern
			: [settings[PLUGIN_KEY]?.pathPattern]
		: [];

	for (const pathPattern of pathPatterns) {
		for (const locale of settings.locales) {
			result.push({
				locale,
				path: pathPattern.replace(/{(locale|languageTag)}/, locale),
			});
		}
	}

	return result;
};
