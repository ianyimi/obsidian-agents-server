import { ModelProviderSettings } from "~/models/providers/constants";
import { AgentSettings } from "~/agents/types";

export interface ObsidianAgentsServerSettings {
	activeTab: string;
	deviceID: string;
	serverPort: number;
	controlDeviceID: string;
	modelProviders: ModelProviderSettings[]
	agents: AgentSettings[]
}

export const DEFAULT_SETTINGS: ObsidianAgentsServerSettings = {
	activeTab: "agents",
	deviceID: "",
	controlDeviceID: "",
	modelProviders: [],
	serverPort: 2345,
	agents: []
}


