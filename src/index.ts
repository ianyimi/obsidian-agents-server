import "./styles.css"

import { Notice, Plugin } from 'obsidian';
import { Agent } from "@openai/agents"

import { AgentsServerSettings } from '~/settings';
import { nanoid } from "nanoid";
import { MODEL_PROVIDERS } from "~/models/providers/constants";
import { ModelProvider } from "~/models/providers";
import { LMStudio } from "~/models/providers/lmstudio";
import { aisdk } from "@openai/agents-extensions";

import { Hono } from "hono";
import { cors } from "hono/cors"
import { DEFAULT_SETTINGS, ObsidianAgentsServerSettings } from "~/settings/types";
import { serve, ServerType } from "@hono/node-server";

export default class ObsidianAgentsServer extends Plugin {
	settings: ObsidianAgentsServerSettings;
	isControlDevice: boolean = false;
	modelProviders: ModelProvider[] = []
	agents: Agent[]
	honoApp?: Hono
	server?: ServerType

	async onload() {
		await this.loadSettings();
		this.modelProviders = this.initializeModelProviders();
		this.agents = this.initializeAgents()
		this.initializeServer()

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new AgentsServerSettings({ app: this.app, plugin: this, modelProviders: this.modelProviders }));
	}

	onunload() {
		this.stopServer()
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
			agents.push(
				new Agent({
					name: agent.name,
					instructions: agent.instructions,
					model,
				})
			)
		}
		return agents
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
		const app = new Hono();
		this.honoApp = app;

		app.use("/*", cors())

		app.get("v1/models", (c) => {
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

		app.get("v1/chat/completions", async (c) => {
			try {
				const body = await c.req.json()
				// todo: implement chat completion and agent run logic here
			} catch (err) {
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
		} catch (e) {
			console.log('error starting server: ', e)
		}
	}

	restartServer() {
		this.stopServer();
		this.initializeServer();
		new Notice(`Server Restarted at http://localhost:${this.settings.serverPort}`)
	}

	stopServer() {
		if (this.server) {
			this.server.close()
		}
	}
}
