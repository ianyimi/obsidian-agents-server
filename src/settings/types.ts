import { ModelProviderSettings } from "~/models/providers/constants";
import { Agent as AgentConfig } from "~/agents/types";

export interface ObsidianAgentsServerSettings {
	activeTab: string;
	deviceID: string;
	controlDeviceID: string;
	modelProviders: ModelProviderSettings[]
	agents: AgentConfig[]
}

export const DEFAULT_SETTINGS: ObsidianAgentsServerSettings = {
	activeTab: "agents",
	deviceID: "",
	controlDeviceID: "",
	modelProviders: [],
	agents: []
}


