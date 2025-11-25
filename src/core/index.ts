import ObsidianAgentsServer from "..";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export default function initAgentsServer(plugin: ObsidianAgentsServer) {
	console.log('setting up agents server core for device with id: ', plugin.settings.deviceId)
}
