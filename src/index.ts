import "./styles.css"

import { Plugin } from 'obsidian';

import { AgentsServerSettings } from '~/settings';
import initAgentsServer from "~/core";
import { nanoid } from "nanoid";
import { MODEL_PROVIDERS, ModelProviderSettings } from "~/settings/models/providers";
import { Agent } from "~/settings/agents/types";
import { ModelProvider } from "./providers";
import { LMStudio } from "./providers/lmstudio";

export interface ObsidianAgentsServerSettings {
	activeTab: string;
	deviceId: string;
	controlDeviceId: string;
	modelProviders: ModelProviderSettings[]
	agents: Agent[]
}

export const DEFAULT_SETTINGS: ObsidianAgentsServerSettings = {
	activeTab: "agents",
	deviceId: "",
	controlDeviceId: "",
	modelProviders: [],
	agents: []
}

export default class ObsidianAgentsServer extends Plugin {
	settings: ObsidianAgentsServerSettings;
	isControlDevice: boolean = false;
	modelProviders: ModelProvider[] = []

	async onload() {
		await this.loadSettings();
		this.modelProviders = this.initializeModelProviders(this);
		initAgentsServer({ plugin: this, modelProviders: this.modelProviders })

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new AgentsServerSettings({ app: this.app, plugin: this, modelProviders: this.modelProviders }));
	}

	onunload() {

	}

	async loadSettings() {
		const loadedData = await this.loadData();

		// Merge loaded data with defaults
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);

		// Generate deviceId only if it doesn't exist or is empty
		if (!this.settings.deviceId || this.settings.deviceId === "") {
			this.settings.deviceId = nanoid();
			await this.saveSettings();
		} else {
			if (this.settings.controlDeviceId !== "") {
				this.isControlDevice = this.settings.controlDeviceId === this.settings.deviceId
			}
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	initializeModelProviders(plugin: ObsidianAgentsServer): ModelProvider[] {
		const providers = []
		for (const provider of plugin.settings.modelProviders) {
			switch (provider.id) {
				case MODEL_PROVIDERS.lmstudio.id:
					providers.push(new LMStudio(plugin))
					break;
				default:
					break;
			}
		}
		return providers
	}
}
