import type { InlangPlugin } from "@inlang/sdk";
import { exportFiles } from "./import-export/exportFiles.js";
import { importFiles } from "./import-export/importFiles.js";
import { toBeImportedFiles } from "./import-export/toBeImportedFiles.js";
import {
	type PluginSettings,
	PluginSettings as pluginSettings,
} from "./settings.js";

export const PLUGIN_KEY = "plugin.volcie.icu-messageFormat";

export const plugin: InlangPlugin<{ [PLUGIN_KEY]?: PluginSettings }> = {
	key: PLUGIN_KEY,

	id: PLUGIN_KEY,
	// ^ deprecated but used for backwards compatibility

	settingsSchema: pluginSettings,
	toBeImportedFiles: toBeImportedFiles,
	importFiles: importFiles,
	exportFiles: exportFiles,
};

export default plugin;
