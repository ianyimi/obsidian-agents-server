import "./styles.css"

import { Notice, Plugin } from 'obsidian';
import { Agent, Runner, Tool } from "@openai/agents"

import { AgentsServerSettings } from '~/settings';
import { AgentSettings } from "~/agents/types"
import { nanoid } from "nanoid";
import { MODEL_PROVIDERS } from "~/models/providers/constants";
import { ModelProvider } from "~/models/providers";
import { LMStudio } from "~/models/providers/lmstudio";
import { OpenAI } from "~/models/providers/openai";
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
import { MCPManager } from "./mcp";
import { AppWithPlugins } from "./tools/plugin-utils";

export default class ObsidianAgentsServer extends Plugin {
	settings: ObsidianAgentsServerSettings;
	isControlDevice: boolean = false;
	modelProviders: ModelProvider[] = []
	agents: Record<string, { settings: AgentSettings, instance: Agent }> = {}
	runner: Runner = new Runner({ tracingDisabled: true })
	honoApp?: Hono
	server?: ServerType
	tools: AgentTool[] = []
	mcpManager: MCPManager

	async onload() {
		await this.loadSettings();
		this.modelProviders = this.initializeModelProviders();

		this.tools = this.initializeTools()

		this.mcpManager = new MCPManager(this)
		await this.mcpManager.initializeServers()

		await this.initializeAgents()
		this.initializeServer()

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new AgentsServerSettings({ app: this.app, plugin: this, modelProviders: this.modelProviders }));
	}

	async onunload() {
		await this.mcpManager.closeAll()
		await this.stopServer()
	}

	async loadSettings() {
		const loadedData = await this.loadData();

		// Merge loaded data with defaults
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);

		let needsSave = false;

		// Generate deviceID only if it doesn't exist or is empty
		if (!this.settings.deviceID || this.settings.deviceID === "") {
			this.settings.deviceID = nanoid();
			needsSave = true;
		} else {
			if (this.settings.controlDeviceID !== "") {
				this.isControlDevice = this.settings.controlDeviceID === this.settings.deviceID
			}
		}

		// Migration: Ensure all agents have an id
		if (this.settings.agents && Array.isArray(this.settings.agents)) {
			for (const agent of this.settings.agents) {
				if (!agent.id || agent.id === "") {
					agent.id = nanoid();
					needsSave = true;
					console.log(`[Settings] Generated missing id for agent: ${agent.name} -> ${agent.id}`);
				}
			}
		}

		if (needsSave) {
			await this.saveSettings({ hideNotice: true });
		}
	}

	async saveSettings(options?: { hideNotice: boolean }) {
		await this.saveData(this.settings);
		await this.initializeAgents();
		if (options?.hideNotice) return;
		new Notice("Settings Saved!")
	}

	async initializeAgents() {
		const agents: Record<string, { settings: AgentSettings, instance: Agent }> = {}
		for (const agentSettings of this.settings.agents) {
			if (!agentSettings.enabled) continue
			const modelProvider = this.modelProviders.find(mp => mp.id === agentSettings.modelProvider)
			if (!modelProvider) continue

			// OpenAI is natively supported by the SDK, so we pass the model string directly
			// Other providers need to be wrapped with aisdk()
			let model: any
			if (modelProvider.id === MODEL_PROVIDERS.openai.id) {
				model = agentSettings.model
			} else {
				if (!modelProvider.instance) continue
				model = aisdk(modelProvider.instance(agentSettings.model))
			}

			const tools = await this.getAgentTools(agentSettings)
			agents[agentSettings.id] = {
				settings: agentSettings,
				instance: new Agent({
					name: agentSettings.name,
					instructions: agentSettings.instructions,
					model,
					tools
				})
			}
		}
		this.agents = agents
		// add agents as tools in second for loop after agents have been created
		this.settings.agents.forEach(agentSettings => {
			if (agentSettings.agentTools.length > 0) {
				const updatedAgent = agents[agentSettings.id]
				agentSettings.agentTools.forEach(agentToolID => {
					const agentTool = agents[agentToolID].instance
					const agentToolSettings = this.agents[agentToolID].settings
					updatedAgent.instance.tools.push(agentTool.asTool({
						toolName: agentToolSettings.toolName,
						toolDescription: agentToolSettings.toolDescription
					}))
				})
				agents[agentSettings.id] = updatedAgent
			}
		})
		this.agents = agents
		console.log('agents: ', this.agents)
		console.log('appPlugins: ', (this.app as AppWithPlugins))
	}

	initializeTools(): AgentTool[] {
		const tools = createVaultTools(this)
		return tools
	}

	async getAgentTools(agent: AgentSettings): Promise<Tool[]> {
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

		const mcpTools = await this.mcpManager.getToolsForAgent(agent)
		tools.push(...mcpTools)

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
				case MODEL_PROVIDERS.openai.id:
					providers.push(new OpenAI(this, provider))
					break;
				case MODEL_PROVIDERS.lmstudio.id:
					providers.push(new LMStudio(this, provider))
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
			console.warn('[Server] Server reference already exists, attempting to stop first...');
			// Try to stop it before proceeding
			this.stopServer().then(() => {
				setTimeout(() => this.initializeServer(), 1000);
			});
			return;
		}

		console.log(`[Server] Initializing on port ${this.settings.serverPort}...`);

		const app = new Hono();
		this.honoApp = app;

		app.use("/*", cors())

		app.get("/v1/models", async (c) => {
			const models = Object.values(this.agents).map((agent) => ({
				id: agent.instance.name,
				object: "model",
				created: Date.now(),
				owned_by: "obsidian-agents-server",
				permission: [],
				root: agent.instance.name,
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

				const agent = Object.values(this.agents).find(a => a.instance.name === model)
				if (!agent) {
					return c.json({
						error: {
							message: `Model '${model}' not found. Available models: ${Object.values(this.agents).map(a => a.instance.name).join(', ')}`,
							type: "invalid_request_error"
						}
					}, 404)
				}

				const agentMessages = convertMessagesToAgentInput(messages);

				if (stream) {
					const result = await this.runner.run(agent.instance, agentMessages, { stream: true });

					console.log(`result usage: ${JSON.stringify(result.state._context.usage)}`)

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

				const result = await this.runner.run(agent.instance, agentMessages);
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
					console.error(`[Server] Port ${this.settings.serverPort} is already in use`);

					// Actually close the server, don't just clear the reference
					const serverToClose = this.server;
					this.server = undefined;

					if (serverToClose) {
						serverToClose.close((closeErr) => {
							if (closeErr) {
								console.error('[Server] Error closing server after port conflict:', closeErr);
							} else {
								console.log('[Server] Closed server after port conflict');
							}
						});
					}
				} else {
					console.error('[Server] Server error:', err);
				}
			});

			this.server.on?.('listening', () => {
				console.log(`[Server] Started successfully on port ${this.settings.serverPort}`);
			});
		} catch (e) {
			console.error('[Server] Error starting server:', e)
			new Notice('Failed to start server. Check console for details.');
		}
	}

	async restartServer() {
		console.log('[Server] Restarting...');

		// Stop existing server
		await this.stopServer();

		// Wait for port to be released (increased to 1 second for reliability)
		console.log('[Server] Waiting for port to be released...');
		await new Promise(resolve => setTimeout(resolve, 1000));

		// Reinitialize agents and start server
		console.log('[Server] Reinitializing agents...');
		await this.initializeAgents()

		console.log('[Server] Starting server...');
		this.initializeServer();

		new Notice(`Server Restarted at http://localhost:${this.settings.serverPort}`)
	}

	async stopServer(): Promise<void> {
		if (!this.server) {
			console.log('[Server] No server to stop');
			return;
		}

		const serverToClose = this.server;
		this.server = undefined; // Clear reference immediately to prevent double-close

		return new Promise<void>((resolve) => {
			const timeout = setTimeout(() => {
				console.warn('[Server] Close timeout, forcing shutdown');
				resolve();
			}, 5000);

			serverToClose.close((err) => {
				clearTimeout(timeout);
				if (err) {
					console.error('[Server] Error closing server:', err);
				} else {
					console.log('[Server] Closed successfully');
				}
				resolve();
			});
		});
	}
}
