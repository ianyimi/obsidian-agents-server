import { App, PluginSettingTab } from "obsidian";
import ObsidianAgentsServer from "..";
import { createRoot, Root } from "react-dom/client"
import { type ReactNode, StrictMode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

import AgentsSettings from "./agents";
import ModelSettings from "./models"
import GeneralSettings from "./general";
import { ModelProvider } from "~/providers";
import { MODEL_PROVIDERS } from "./models/providers";
import { LMStudio } from "~/providers/lmstudio";

interface SettingsTab {
	valueId: string
	triggerLabel: ReactNode | string,
	content: ReactNode | string
}

export class AgentsServerSettings extends PluginSettingTab {
	plugin: ObsidianAgentsServer;
	root: Root | null = null;
	tabs: SettingsTab[] = [
		{
			valueId: "general",
			triggerLabel: "General",
			content: "Loading..."
		},
		{
			valueId: "agents",
			triggerLabel: "Agents",
			content: "Loading..."
		},
		{
			valueId: "models",
			triggerLabel: "Models",
			content: "Loading..."
		}
	]

	constructor({ app, plugin, modelProviders }: { app: App, plugin: ObsidianAgentsServer, modelProviders: ModelProvider[] }) {
		super(app, plugin);
		this.plugin = plugin;
		this.tabs = [
			{
				valueId: "general",
				triggerLabel: "General",
				content: <GeneralSettings plugin={this.plugin} />
			},
			{
				valueId: "agents",
				triggerLabel: "Agents",
				content: <AgentsSettings plugin={this.plugin} modelProviders={modelProviders} />
			},
			{
				valueId: "models",
				triggerLabel: "Models",
				content: <ModelSettings plugin={this.plugin} />
			}
		];
	}

	display(): void {
		const { containerEl } = this;

		if (!this.root) {
			this.root = createRoot(containerEl)
		}

		this.root.render(
			<StrictMode>
				<div className="w-full h-full relative">
					<h1 className="pb-4 text-center text-2xl">Agents Server</h1>
					<div className="flex flex-col items-center">
						<Tabs defaultValue={this.plugin.settings.activeTab} className="w-full grid place-items-center" onValueChange={this.handleTabChange}>
							<TabsList className="gap-4">
								{this.tabs.map((t, i) => <TabsTrigger key={`settings-tab-trigger-${i}`} value={t.valueId} className="rounded">{t.triggerLabel}</TabsTrigger>)}
							</TabsList>
							<>
								{this.tabs.map((t, i) => <TabsContent key={`settings-tab-content-${i}`} value={t.valueId} className="w-full">{t.content}</TabsContent>)}
							</>
						</Tabs>
					</div>
				</div>
			</StrictMode>
		)
	}

	handleTabChange = async (value: string): Promise<void> => {
		this.plugin.settings.activeTab = value;
		await this.plugin.saveSettings()
	}

	hide(): void {
		if (this.root) {
			this.root.unmount();
			this.root = null;
		}
	}

}

