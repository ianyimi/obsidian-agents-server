import { ModelProvider } from "~/providers";
import ObsidianAgentsServer from "..";
// import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export default function initAgentsServer({ plugin, modelProviders }: { plugin: ObsidianAgentsServer, modelProviders: ModelProvider[] }) {

	console.log('setting up agents server core for device with id: ', plugin.settings)
}
