import "./styles.css"

import { Plugin } from 'obsidian';

import { AgentsServerSettings } from './settings';
import initAgentsServer from "./core";
import { nanoid } from "nanoid";

export interface ObsidianAgentsServerSettings {
	activeTab: string;
	deviceId: string;
	controlDeviceId: string;
}

export const DEFAULT_SETTINGS: ObsidianAgentsServerSettings = {
	activeTab: "agents",
	deviceId: "",
	controlDeviceId: ""
}

export default class ObsidianAgentsServer extends Plugin {
	settings: ObsidianAgentsServerSettings;

	async onload() {
		await this.loadSettings();
		initAgentsServer(this)

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new AgentsServerSettings(this.app, this));
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
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
