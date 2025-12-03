import { ModelProviderSettings } from "~/models/providers/constants";
import { AgentSettings } from "~/agents/types";

interface BaseMCPServerConfig {
	id: string
	name: string
	enabled: boolean
	cacheToolsList?: boolean
	collapsed: boolean
}

export interface StdioMCPServerConfig extends BaseMCPServerConfig {
	type: "stdio"
	command: string
	args: string
	env?: {
		name: string
		value: string
	}[]
}

export interface SseMCPServerConfig extends BaseMCPServerConfig {
	type: "sse"
	url: string
}

export type MCPServerConfig = StdioMCPServerConfig | SseMCPServerConfig

export interface ObsidianAgentsServerSettings {
	activeTab: string;
	deviceID: string;
	serverPort: number;
	controlDeviceID: string;
	modelProviders: ModelProviderSettings[]
	mcpServers: MCPServerConfig[]
	customToolsFolder?: string
	agentDocsFolder?: string
	agents: AgentSettings[]
}

export const DEFAULT_SETTINGS: ObsidianAgentsServerSettings = {
	activeTab: "agents",
	deviceID: "",
	controlDeviceID: "",
	modelProviders: [],
	serverPort: 2345,
	agents: [],
	mcpServers: [],
	agentDocsFolder: "Agent Docs"
}


