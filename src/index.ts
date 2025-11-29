import "./styles.css"

import { Notice, Plugin } from 'obsidian';
import { Agent, Runner, Tool } from "@openai/agents"

import { AgentsServerSettings } from '~/settings';
import { AgentSettings } from "~/agents/types"
import { nanoid } from "nanoid";
import { MODEL_PROVIDERS } from "~/models/providers/constants";
import { ModelProvider } from "~/models/providers";
import { LMStudio } from "~/models/providers/lmstudio";
import { aisdk } from "@openai/agents-extensions";

import { Hono } from "hono";
import { cors } from "hono/cors"
import { streamSSE } from "hono/streaming"
import { DEFAULT_SETTINGS, ObsidianAgentsServerSettings } from "~/settings/types";
import { serve, ServerType } from "@hono/node-server";
import { CreateChatCompletionBody } from "~/agents/chatCompletionApiTypes";
import { convertMessagesToAgentInput, convertRunResultToCompletion, convertStreamToChunks } from "~/lib/utils";
import { createVaultTools } from "~/tools/vault";
import { AgentTool } from "~/tools/types";
import { templaterApi } from "./tools/plugin-utils";

export default class ObsidianAgentsServer extends Plugin {
	settings: ObsidianAgentsServerSettings;
	isControlDevice: boolean = false;
	modelProviders: ModelProvider[] = []
	agents: Agent[]
	runner: Runner = new Runner()
	honoApp?: Hono
	server?: ServerType
	tools: AgentTool[] = []

	async onload() {
		await this.loadSettings();
		this.modelProviders = this.initializeModelProviders();
		this.tools = this.initializeTools()
		this.agents = this.initializeAgents()
		this.initializeServer()

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new AgentsServerSettings({ app: this.app, plugin: this, modelProviders: this.modelProviders }));
	}

	async onunload() {
		await this.stopServer()
	}

	async loadSettings() {
		const loadedData = await this.loadData();

		// Merge loaded data with defaults
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);

		// Generate deviceID only if it doesn't exist or is empty
		if (!this.settings.deviceID || this.settings.deviceID === "") {
			this.settings.deviceID = nanoid();
			await this.saveSettings();
		} else {
			if (this.settings.controlDeviceID !== "") {
				this.isControlDevice = this.settings.controlDeviceID === this.settings.deviceID
			}
		}
	}

	async saveSettings(options?: { hideNotice: boolean }) {
		await this.saveData(this.settings);
		if (options?.hideNotice) return;
		new Notice("Settings Saved!")
	}

	initializeAgents(): Agent[] {
		const agents = []
		for (const agent of this.settings.agents) {
			if (!agent.enabled) continue
			const modelProvider = this.modelProviders.find(mp => mp.id === agent.modelProvider)
			if (!modelProvider?.instance) continue
			const model = aisdk(modelProvider.instance(agent.model))
			const tools = this.getAgentTools(agent)
			console.log('agent tools: ', tools)
			agents.push(
				new Agent({
					name: agent.name,
					instructions: agent.instructions,
					model,
					tools
				})
			)
		}
		return agents
	}

	initializeTools(): AgentTool[] {
		const tools = createVaultTools(this)
		return tools
	}

	getAgentTools(agent: AgentSettings): Tool[] {
		const tools: Tool[] = []
		const agentVaultTools = Object.entries(agent.vaultTools).filter(([_key, value]) => value === true).map(([key, _value]) => key)
		if (agentVaultTools.length > 0) {
			const vaultTools = createVaultTools(this)
			for (const vaultTool of vaultTools) {
				if (agentVaultTools.includes(vaultTool.id)) {
					tools.push(vaultTool.tool)
				}
			}
		}
		// Custom Tools
		// for (const tool of agent.tools.filter(t => t.enabled)) {
		// 	switch (tool.type.id) {
		// 		default:
		// 			break;
		// 	}
		// }
		return tools
	}

	initializeModelProviders(): ModelProvider[] {
		const providers = []
		for (const provider of this.settings.modelProviders) {
			switch (provider.id) {
				case MODEL_PROVIDERS.lmstudio.id:
					providers.push(new LMStudio(this))
					break;
				default:
					break;
			}
		}
		return providers
	}

	initializeServer() {
		// Skip if server is already running
		if (this.server) {
			console.log('Server already running on port', this.settings.serverPort);
			return;
		}

		const app = new Hono();
		this.honoApp = app;

		app.use("/*", cors())

		app.get("/v1/models", (c) => {
			const models = this.agents.map((agent) => ({
				id: agent.name,
				object: "model",
				created: Date.now(),
				owned_by: "obsidian-agents-server",
				permission: [],
				root: agent.name,
				parent: null
			}))
			return c.json({
				object: "list",
				data: models
			})
		})

		app.post("/v1/chat/completions", async (c) => {
			try {
				const body = await c.req.json() as CreateChatCompletionBody
				const { model, messages, stream = false } = body

				const agent = this.agents.find(a => a.name === model)
				if (!agent) {
					return c.json({
						error: {
							message: `Model '${model}' not found. Available models: ${this.agents.map(a => a.name).join(', ')}`,
							type: "invalid_request_error"
						}
					}, 404)
				}

				const agentMessages = convertMessagesToAgentInput(messages);

				if (stream) {
					const result = await this.runner.run(agent, agentMessages, { stream: true });

					return streamSSE(c, async (stream) => {
						try {
							for await (const chunk of convertStreamToChunks(result, model)) {
								await stream.writeSSE({
									data: JSON.stringify(chunk),
								});
							}
							await stream.writeSSE({
								data: '[DONE]',
							});
						} catch (streamErr) {
							console.error('Stream error:', streamErr);
						}
					});
				}

				const result = await this.runner.run(agent, agentMessages);
				const response = convertRunResultToCompletion(result, model);
				return c.json(response)

			} catch (err: any) {
				console.error('error handling chat completion: ', err)
				return c.json({
					error: {
						message: err?.message ?? "Internal Server Error",
						type: "internal_error"
					}
				}, 500)
			}
		})

		try {
			this.server = serve({
				fetch: app.fetch,
				port: this.settings.serverPort
			})

			// Handle server errors
			this.server.on?.('error', (err: NodeJS.ErrnoException) => {
				if (err.code === 'EADDRINUSE') {
					new Notice(`Port ${this.settings.serverPort} is already in use. Please choose a different port.`);
					console.error(`Port ${this.settings.serverPort} is already in use`);
					this.server = undefined;
				} else {
					console.error('Server error:', err);
				}
			});

			this.server.on?.('listening', () => {
				console.log(`Server started on port ${this.settings.serverPort}`);
			});
		} catch (e) {
			console.log('error starting server: ', e)
			new Notice('Failed to start server. Check console for details.');
		}
	}

	async restartServer() {
		await this.stopServer();
		// Small delay to ensure port is fully released by OS
		await new Promise(resolve => setTimeout(resolve, 100));
		this.initializeServer();
		new Notice(`Server Restarted at http://localhost:${this.settings.serverPort}`)
	}

	async stopServer(): Promise<void> {
		if (!this.server) {
			return;
		}

		return new Promise<void>((resolve) => {
			if (!this.server) {
				return;
			}
			const timeout = setTimeout(() => {
				console.warn('Server close timeout, forcing shutdown');
				this.server = undefined;
				resolve();
			}, 5000);

			this.server.close((err) => {
				clearTimeout(timeout);
				if (err) {
					console.error('Error closing server:', err);
				} else {
					console.log('Server closed successfully');
				}
				this.server = undefined;
				resolve();
			});
		});
	}
}
