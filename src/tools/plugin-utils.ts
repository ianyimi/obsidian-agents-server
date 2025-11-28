import { App, TFile } from "obsidian";
import ObsidianAgentsServer from "..";

interface TemplaterPlugin {
	templater: {
		functions_generator: {
			internal_functions: {
				modules_array: any[]
			}
		}
	}
}

type TemplaterCreateFromTemplate = (templateFile: TFile, filename: string, open: boolean, folderPath: string) => Promise<void>
type TemplaterFindTemplate = (templateName: string) => TFile

interface DataviewPlugin {
	api: {
		pages: (query?: string) => any[],
		path: (path?: string) => any[],
	}
}

type SupportedPlugins = {
	["templater-obsidian"]: TemplaterPlugin
	// ["dataview"]: DataviewPlugin
}
type PluginKey = keyof SupportedPlugins

interface AppWithPlugins extends App {
	plugins: {
		plugins: SupportedPlugins,
		enabledPlugins: Set<PluginKey>
	}
}

function getPlugin(plugin: ObsidianAgentsServer, pluginID: PluginKey) {
	return (plugin.app as AppWithPlugins).plugins.plugins[pluginID]
}
function isPluginEnabled(plugin: ObsidianAgentsServer, pluginID: PluginKey) {
	return (plugin.app as AppWithPlugins).plugins.enabledPlugins.has(pluginID)
}

export function templaterApi(plugin: ObsidianAgentsServer) {
	if (!isPluginEnabled(plugin, "templater-obsidian")) {
		throw new Error("Templater Plugin not enabled")
	}
	const templater = getPlugin(plugin, "templater-obsidian") as TemplaterPlugin
	const templaterModuleArray = templater.templater.functions_generator.internal_functions.modules_array
	const templaterFileMap = Object.fromEntries(templaterModuleArray[1].static_functions)
	return { createFromTemplate: templaterFileMap.create_new as TemplaterCreateFromTemplate, findTemplate: templaterFileMap.find_tfile as TemplaterFindTemplate }
}
