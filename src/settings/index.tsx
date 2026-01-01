import { App, PluginSettingTab } from "obsidian";
import ObsidianAgentsServer from "..";
import { createRoot, Root } from "react-dom/client"
import { type ReactNode, StrictMode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

import AgentsSettings from "~/agents/settings";
import ModelSettings from "../models/settings"
import GeneralSettings from "./general";
import { ModelProvider } from "~/models/providers";
import MCPServerSettings from "~/mcp/settings";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

interface SettingsTab {
  valueID: string
  triggerLabel: ReactNode | string,
  content: ReactNode | string
}

export class AgentsServerSettings extends PluginSettingTab {
  plugin: ObsidianAgentsServer;
  root: Root | null = null;
  tabs: SettingsTab[] = [
    {
      valueID: "general",
      triggerLabel: "General",
      content: "Loading..."
    },
    {
      valueID: "agents",
      triggerLabel: "Agents",
      content: "Loading..."
    },
    {
      valueID: "models",
      triggerLabel: "Models",
      content: "Loading..."
    },
    {
      valueID: "mcp",
      triggerLabel: "MCP Servers",
      content: "Loading..."
    }
  ]
  queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Better offline behavior
        retry: 1, // Only retry once on failure
        staleTime: 30000, // Consider data fresh for 30 seconds
        gcTime: 300000, // Keep unused data cached for 5 minutes
        networkMode: "offlineFirst", // Try cache first when offline
      },
    },
  })

  constructor({ app, plugin, modelProviders }: { app: App, plugin: ObsidianAgentsServer, modelProviders: ModelProvider[] }) {
    super(app, plugin);
    this.plugin = plugin;
    this.tabs = [
      {
        valueID: "general",
        triggerLabel: "General",
        content: <GeneralSettings plugin={this.plugin} />
      },
      {
        valueID: "agents",
        triggerLabel: "Agents",
        content: <AgentsSettings plugin={this.plugin} />
      },
      {
        valueID: "models",
        triggerLabel: "Models",
        content: <ModelSettings plugin={this.plugin} />
      },
      {
        valueID: "mcp",
        triggerLabel: "MCP Servers",
        content: <MCPServerSettings plugin={this.plugin} />
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
        <QueryClientProvider client={this.queryClient}>
          <div className="obsidian-agents-server-plugin w-full min-h-full relative">
            <h1 className="pb-4 text-center text-2xl">Agents Server</h1>
            <div className="flex flex-col items-center">
              <Tabs defaultValue={this.plugin.settings.activeTab} className="w-full grid place-items-center" onValueChange={this.handleTabChange}>
                <TabsList className="gap-4">
                  {this.tabs.map((t, i) => <TabsTrigger key={`settings-tab-trigger-${i}`} value={t.valueID} className="rounded">{t.triggerLabel}</TabsTrigger>)}
                </TabsList>
                <>
                  {this.tabs.map((t, i) => <TabsContent key={`settings-tab-content-${i}`} value={t.valueID} className="w-full">{t.content}</TabsContent>)}
                </>
              </Tabs>
            </div>
          </div>
        </QueryClientProvider>
      </StrictMode>
    )
  }

  handleTabChange = async (value: string): Promise<void> => {
    this.plugin.settings.activeTab = value;
    await this.plugin.saveSettings({ hideNotice: true })
  }

  hide(): void {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }

}

