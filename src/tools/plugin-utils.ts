import { App, TFile } from "obsidian";
import ObsidianAgentsServer from "..";
import { SUPPORTED_PLUGINS } from "./types";

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

type SearchMatchApi = {
	match: string,
	offset: number
}
type ResultNoteApi = {
	score: number,
	vault: string,
	path: string,
	basename: string,
	foundWords: string[]
	matches: SearchMatchApi[]
	excerpt: string
}
interface OmnisearchPlugin {
	api: {
		search: (query: string) => Promise<ResultNoteApi[]>
		refreshIndex: () => Promise<void>
		registerOnIndexed: (callback: () => void) => void
		unregisterOnIndexed: (callback: () => void) => void
	}
}

type SupportedPlugins = {
	[SUPPORTED_PLUGINS.templater.id]: TemplaterPlugin
	[SUPPORTED_PLUGINS.omnisearch.id]: OmnisearchPlugin
	// ["dataview"]: DataviewPlugin
}
type PluginKey = keyof SupportedPlugins
type SupportedPlugin = SupportedPlugins[keyof SupportedPlugins]

export interface AppWithPlugins extends App {
	plugins: {
		plugins: SupportedPlugins,
		enabledPlugins: Set<PluginKey>
	}
}

function isPluginEnabled(plugin: ObsidianAgentsServer, pluginID: PluginKey) {
	return (plugin.app as AppWithPlugins).plugins.enabledPlugins.has(pluginID)
}
function getPlugin<T extends SupportedPlugin>(plugin: ObsidianAgentsServer, pluginID: PluginKey): T {
	if (!isPluginEnabled(plugin, pluginID)) {
		throw new Error(`Plugin not found: ${pluginID}`)
	}
	return (plugin.app as AppWithPlugins).plugins.plugins[pluginID] as T
}

export function omnisearchApi(plugin: ObsidianAgentsServer) {
	const omnisearch = getPlugin<OmnisearchPlugin>(plugin, SUPPORTED_PLUGINS.omnisearch.id)
	return omnisearch.api
}

export function templaterApi(plugin: ObsidianAgentsServer) {
	const templater = getPlugin<TemplaterPlugin>(plugin, SUPPORTED_PLUGINS.templater.id)
	const templaterModuleArray = templater.templater.functions_generator.internal_functions.modules_array
	const templaterFileMap = Object.fromEntries(templaterModuleArray[1].static_functions)
	return { createFromTemplate: templaterFileMap.create_new as TemplaterCreateFromTemplate, findTemplate: templaterFileMap.find_tfile as TemplaterFindTemplate }
}
