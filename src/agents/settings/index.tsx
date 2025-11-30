import { Button } from "~/components/ui/button";
import ObsidianAgentsServer from "~/index";
import { Notice } from "obsidian";
import { ModelProvider } from "~/models/providers";
import { useEffect, useRef, useState } from "react";
import { Loader2Icon, Trash } from "lucide-react";
import { ModelProviderID } from "~/models/providers/constants";
import { SelectGroup, SelectItem } from "~/components/ui/select";
import { useAppForm } from "~/components/form"
import { nanoid } from "nanoid";
import { TOOL_TYPES } from "~/tools/types";
import { VAULT_TOOLS, VaultToolsID } from "~/tools/vault";
import { MultiSelect, MultiSelectContent, MultiSelectGroup, MultiSelectItem, MultiSelectTrigger, MultiSelectValue } from "~/components/ui/multi-select";
import { useQuery } from "@tanstack/react-query";
import { CheckboxField } from "~/components/form/checkboxField";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";

export default function AgentsSettings({ plugin }: { plugin: ObsidianAgentsServer }) {
	const [models, setModels] = useState<{ id: string, provider: ModelProviderID }[]>([])
	const vaultToolsArray = Object.values(VAULT_TOOLS).map(t => t.id)
	const mcpServers = Array.from(plugin.mcpManager.servers.values())
	const { data: mcpServerTools, isPending: pendingServerTools } = useQuery({
		queryKey: ["mcp-servers-tools"],
		queryFn: async () => {
			const st = []
			for (const server of mcpServers) {
				const tools = await server.server.listTools()
				st.push({
					serverID: server.id,
					tools
				})
			}
			return st
		}
	})
	const mcpServerToolsMap: Record<string, unknown[]> | undefined = mcpServerTools?.reduce((acc, tool) => {
		// @ts-expect-error acc any type
		acc[tool.id] = tool.tools
		return acc
	}, {} as Record<string, unknown[]>)

	useEffect(() => {
		const allModels: { id: string, provider: ModelProviderID }[] = []
		plugin.modelProviders.forEach(p => {
			p.models.forEach(model => {
				if (!allModels.find(m => m.id === model)) {
					allModels.push({ id: model, provider: p.id })
				}
			})
		})
		setModels(allModels)
	}, [plugin.modelProviders])

	const form = useAppForm({
		defaultValues: {
			agents: plugin.settings.agents
		},
		onSubmit: async ({ value }) => {
			let reloadServer = false
			if (value.agents.length !== plugin.settings.agents.length) {
				reloadServer = true
			}

			plugin.settings.agents = value.agents
			await plugin.saveSettings()
			if (reloadServer) {
				await plugin.restartServer()
			}
			new Notice("Settings Updated!")
		}
	})

	return (
		<form.AppForm>
			<div className="relative">
				<Button type="submit" onClick={form.handleSubmit} className="right-0 absolute">Save</Button>
				<p className="text-center w-full">Agents Settings</p>
				<form.Field name="agents" mode="array">
					{(field) => (
						<div>
							<Button type="button" onClick={() => {
								field.pushValue({
									id: nanoid(),
									name: "",
									instructions: "",
									modelProvider: "" as ModelProviderID,
									model: "",
									enabled: true,
									vaultTools: Object.values(VAULT_TOOLS).reduce(
										(acc, tool) => {
											acc[tool.id] = false;
											return acc
										},
										{} as Record<VaultToolsID, boolean>
									),
									mcpTools: [],
									tools: []
								})
							}}>
								Add Agent
							</Button>
							{field.state.value?.map((agent, i) => (
								<div key={i} className="relative py-2 flex flex-col gap-2">
									<h2>Agent #{i + 1}</h2>
									<Trash
										size={16}
										onClick={() => {
											field.removeValue(i)
											form.handleSubmit()
										}}
										className="absolute cursor-pointer right-4 top-2 hover:stroke-red-600 transition-colors duration-300"
									/>
									<form.AppField name={`agents[${i}].enabled`}>
										{(subField) => <subField.CheckboxField label="Enabled" orientation="horizontal" />}
									</form.AppField>
									<form.AppField name={`agents[${i}].name`}>
										{(subField) => <subField.TextField label="Name" />}
									</form.AppField>
									<form.AppField name={`agents[${i}].instructions`}>
										{(subField) => <subField.TextareaField label="Instructions" />}
									</form.AppField>
									<form.AppField name={`agents[${i}].model`}>
										{(subField) => (
											<subField.SelectField label="Model" placeholder="Select Model" onValueChange={(value) => {
												subField.handleChange(value)
												const model = models.find(m => m.id === value)
												if (model) {
													form.setFieldValue(`agents[${i}].modelProvider`, model.provider)
												}
											}}>
												<SelectGroup>
													{models.map((model, i) => (
														<SelectItem key={i} value={model.id}>{model.id}</SelectItem>
													))}
												</SelectGroup>
											</subField.SelectField>
										)}
									</form.AppField>
									<div className="py-6">
										<h2>Vault Tools</h2>
										<div className="flex flex-wrap gap-8">
											{vaultToolsArray.map((t, j) => {
												const tool = Object.values(VAULT_TOOLS).find(vt => vt.id === t)!
												return (
													<form.AppField name={`agents[${i}].vaultTools.${t}`} key={j}>
														{(subField) => <subField.CheckboxField label={tool.label} orientation="horizontal" />}
													</form.AppField>
												)
											})}
										</div>
									</div>
									{/* TODO: add multiselect for mcp tools inputs here */}
									<form.Field name={`agents[${i}].mcpTools`} mode="array">
										{(mcpToolsField) => (
											<div>
												<h2>MCP Tools</h2>
												<div className="grid place-items-center">
													<form.Subscribe
														selector={(state) => (state.values.agents[i].mcpTools)}
													>
														{(mcpTools) => (
															<MultiSelect values={mcpTools.map(t => t.serverID)} onValuesChange={(values) => {
																const mcpToolsFieldValues = mcpToolsField.state.value
																for (const serverID of values) {
																	if (!mcpToolsFieldValues.find(tool => tool.serverID === serverID)) {
																		mcpToolsField.pushValue({
																			enabled: true,
																			type: TOOL_TYPES.mcp,
																			serverID,
																			toolIDs: mcpServerTools?.find(t => t.serverID === serverID)?.tools.map(t => t.name) ?? []
																		})
																	}
																}
																if (values.length !== mcpToolsFieldValues.length) {
																	const valuesSet = new Set(values)
																	mcpToolsFieldValues.forEach((fv) => {
																		if (valuesSet.has(fv.serverID)) return
																		mcpToolsField.removeValue(mcpToolsField.state.value.findIndex(v => v.serverID === fv.serverID))
																	})
																}
															}}>
																<MultiSelectTrigger>
																	<MultiSelectValue overflowBehavior="wrap" placeholder="Add MCP Tool" />
																</MultiSelectTrigger>
																<MultiSelectContent>
																	<MultiSelectGroup>
																		{mcpServers.map((mcpServer, i) => (
																			<MultiSelectItem key={i} value={mcpServer.id} className="text-center">{mcpServer.server.name}</MultiSelectItem>
																		))}
																	</MultiSelectGroup>
																</MultiSelectContent>
															</MultiSelect>
														)}
													</form.Subscribe>
												</div>
												{mcpToolsField.state.value?.map((mcpTool, j) => (
													<div key={j} className="relative">
														{pendingServerTools ?
															<Loader2Icon size={16} className="animate-spin" /> :
															(
																<div className="flex flex-col gap-4">
																	<h4>{mcpServers.find(s => s.id === mcpTool.serverID)?.server.name}</h4>
																	<Trash
																		size={16}
																		onClick={() => {
																			mcpToolsField.removeValue(j)
																			form.handleSubmit()
																		}}
																		className="absolute cursor-pointer right-4 top-0 hover:stroke-red-600 transition-colors duration-300"
																	/>
																	<div className="flex gap-6">
																		{mcpServerTools?.find(mst => mst.serverID === mcpTool.serverID)?.tools.map((tool, k) => (
																			<div key={k} className="flex gap-2 cursor-pointer">
																				<Label htmlFor={tool.name}>{tool.title}</Label>
																				<Checkbox
																					id={tool.name}
																					defaultChecked={mcpTool.toolIDs.includes(tool.name)}
																					onCheckedChange={(checked) => {
																						const existingTool = mcpToolsField.state.value.find(v => v.serverID === mcpTool.serverID && v.toolIDs.includes(tool.name))
																						if (checked && !existingTool) {
																							mcpTool.toolIDs.push(tool.name)
																						}
																						if (!checked && existingTool) {
																							mcpTool.toolIDs = mcpTool.toolIDs.filter(t => t !== tool.name)
																						}
																						form.handleSubmit()
																						console.log('checked: ', mcpToolsField.state.value, checked)
																					}}
																				/>
																			</div>
																		))}
																	</div>
																</div>
															)
														}
													</div>
												))}
											</div>
										)}
									</form.Field>
									<form.Field name={`agents[${i}].tools`} mode="array">
										{(agentTools) => (
											<div className="relative">
												<h2>User Tools</h2>
												<div className="grid place-items-center pb-4">
													<Button
														type="button"
														onClick={() => {
															agentTools.pushValue({
																type: { id: "", label: "" },
																enabled: true,
															})
														}}
													>
														Add Tool
													</Button>
												</div>
												<div className="flex flex-col gap-4">
													{agentTools.state.value?.map((tool, j) => (
														<div key={j} className="flex-col relative flex gap-2">
															<h4>Tool #{j + 1}</h4>
															<Trash
																size={16}
																onClick={() => {
																	agentTools.removeValue(j)
																	form.handleSubmit()
																}}
																className="absolute cursor-pointer right-4 top-0 hover:stroke-red-600 transition-colors duration-300"
															/>
															<form.AppField name={`agents[${i}].tools[${j}].enabled`}>
																{(subField) => <subField.CheckboxField label="Enabled" orientation="horizontal" />}
															</form.AppField>
															<form.AppField name={`agents[${i}].tools[${j}].type`}>
																{(subField) => (
																	<div>
																		{/* <subField.MultiSelectField label="Type" placeholder="Select Tool Type"> */}
																		{/* <MultiSelectGroup> */}
																		{/* </MultiSelectGroup> */}
																		{/* </subField.MultiSelectField> */}
																		<subField.SelectField label="Type" placeholder="Select Tool Type">
																			<SelectGroup>
																				{Object.values(TOOL_TYPES).filter(t => t.id !== "" && t.id !== "vault").map((tool, k) => (
																					<SelectItem key={k} value={tool.id}>{tool.label}</SelectItem>
																				))}
																			</SelectGroup>
																		</subField.SelectField>
																	</div>
																)}
															</form.AppField>
														</div>
													))}
												</div>
											</div>
										)}
									</form.Field>
								</div>
							))}
						</div>
					)}
				</form.Field>
			</div>
		</form.AppForm>
	)

}
