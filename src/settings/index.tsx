import { App, PluginSettingTab, Setting } from "obsidian";
import ObsidianAgentsServer from "..";
import { createRoot, Root } from "react-dom/client"
import { StrictMode } from "react";

export class AgentsServerSettings extends PluginSettingTab {
	plugin: ObsidianAgentsServer;
	root: Root | null = null;

	constructor(app: App, plugin: ObsidianAgentsServer) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		if (!this.root) {
			this.root = createRoot(containerEl)
		}

		this.root.render(
			<StrictMode>
				<h4 className="text-blue-300">hello world, react with tailwind</h4>
			</StrictMode>
		)

		// new Setting(containerEl)
		// 	.setName('Setting #1')
		// 	.setDesc('It\'s a secret')
		// 	.addText(text => text
		// 		.setPlaceholder('Enter your secret')
		// 		.setValue(this.plugin.settings.mySetting)
		// 		.onChange(async (value) => {
		// 			this.plugin.settings.mySetting = value;
		// 			await this.plugin.saveSettings();
		// 		}));
	}

	hide(): void {
		this.root?.unmount()
	}
}

