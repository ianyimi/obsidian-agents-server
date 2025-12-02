import { Button } from "~/components/ui/button";
import ObsidianAgentsServer from "~/index";
import { Notice } from "obsidian";
import { Activity, useEffect, useState } from "react";
import { Loader2Icon, Trash } from "lucide-react";
import { ModelProviderID } from "~/models/providers/constants";
import { SelectGroup, SelectItem } from "~/components/ui/select";
import { useAppForm } from "~/components/form"
import { nanoid } from "nanoid";
import { TOOL_TYPES } from "~/tools/types";
import { VAULT_TOOLS, VaultToolsID } from "~/tools/vault";
import { MultiSelect, MultiSelectContent, MultiSelectGroup, MultiSelectItem, MultiSelectTrigger, MultiSelectValue } from "~/components/ui/multi-select";
import { useQuery } from "@tanstack/react-query";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";

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
			agents: plugin.settings.agents,
			restartServer: false
		},
		onSubmit: async ({ value }) => {
			let reloadServer = false
			if (value.agents.length !== plugin.settings.agents.length) {
				reloadServer = true
			}

			plugin.settings.agents = value.agents
			await plugin.saveSettings()
			if (reloadServer || value.restartServer) {
				await plugin.restartServer()
				form.setFieldValue("restartServer", false)
			}
			new Notice("Settings Updated!")
		}
	})

	return (
		<form.AppForm>
			<div className="relative">
				<Button type="submit" onClick={form.handleSubmit} className="right-0 -top-11 absolute">
					Save
				</Button>
				<form.Field name="agents" mode="array">
					{(field) => (
						<Accordion className="py-6 flex flex-col gap-4" type="multiple" defaultValue={form.state.values.agents.filter(a => !a.collapsed).map(a => a.id)} onValueChange={async (value) => {
							for (const agent of form.state.values.agents) {
								let updatedSettings = false
								if (value.includes(agent.id) && agent.collapsed) {
									agent.collapsed = false
									updatedSettings = true
								}
								if (!value.includes(agent.id) && !agent.collapsed) {
									agent.collapsed = true
									updatedSettings = true
								}
								if (updatedSettings) {
									plugin.settings.agents = form.state.values.agents
									await plugin.saveSettings({ hideNotice: true })
								}
							}
						}}>
							{field.state.value?.map((agent, i) => (
								<AccordionItem value={agent.id} key={`agent-${i}`}>
									<AccordionTrigger className="px-4">{agent.name !== "" ? agent.name : `Agent #${i + 1}`}</AccordionTrigger>
									<AccordionContent className="relative py-2 flex flex-col gap-2">
										{/* <h2>{agent.name !== "" ? agent.name : `Agent #${i + 1}`}</h2> */}
										<Trash
											size={16}
											onClick={() => {
												field.removeValue(i)
												form.handleSubmit()
											}}
											className="absolute cursor-pointer right-4 top-2 hover:stroke-red-600 transition-colors duration-300"
										/>
										<div className="flex gap-4">
											<form.AppField name={`agents[${i}].enabled`}>
												{(subField) => <subField.CheckboxField label="Enabled" orientation="horizontal" />}
											</form.AppField>
										</div>
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
														if (subField.state.value !== value) {
															form.setFieldValue("restartServer", true)
														}
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
										<form.AppField name={`agents[${i}].agentTools`}>
											{(subField) => (
												<div className="flex flex-col gap-2">
													<h2 className="text-center">Agent as Tool Settings</h2>
													<div className="flex justify-center">
														<form.AppField name={`agents[${i}].useAsTool`}>
															{(subField) => <subField.CheckboxField label="Use Agent as Tool" orientation="horizontal" />}
														</form.AppField>
													</div>
													<form.Subscribe
														selector={(state) => state.values.agents[i].useAsTool}
													>
														{(useAsTool) => (
															<Activity mode={useAsTool ? "visible" : "hidden"}>
																<form.AppField name={`agents[${i}].toolName`}>
																	{(subField) => (<subField.TextField label="Tool Name" defaultValue={agent.name} />)}
																</form.AppField>
																<form.AppField name={`agents[${i}].toolDescription`}>
																	{(subField) => (<subField.TextareaField label="Tool Description" />)}
																</form.AppField>
															</Activity>
														)}
													</form.Subscribe>
													<div className="flex justify-center">
														<subField.MultiSelectField label="Agents available as Tools for this Agent">
															<MultiSelectContent search={false}>
																<MultiSelectGroup>
																	{form.state.values.agents.filter(a => a.id !== agent.id && a.useAsTool).map((agentTool, i) => (
																		<MultiSelectItem key={i} value={agentTool.id} className="text-center">{agentTool.name}</MultiSelectItem>
																	))}
																</MultiSelectGroup>
															</MultiSelectContent>
														</subField.MultiSelectField>
													</div>
												</div>
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
										<form.Field name={`agents[${i}].mcpTools`} mode="array">
											{(mcpToolsField) => (
												<div>
													<h2>MCP Tools</h2>
													<div className="grid place-items-center">
														<form.Subscribe
															selector={(state) => (state.values.agents[i].mcpTools)}
														>
															{(mcpTools) => {
																const selectedServerIDs = mcpTools.map(t => t.serverID)
																return (
																	<MultiSelect values={selectedServerIDs} onValuesChange={(values) => {
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
																)
															}}
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
																					<Label htmlFor={tool.name}>{tool.name ?? tool.title}</Label>
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
									</AccordionContent>
								</AccordionItem>
							))}
							<div className="grid place-items-center">
								<Button type="button" onClick={() => {
									field.pushValue({
										id: nanoid(),
										name: "",
										instructions: "",
										collapsed: false,
										modelProvider: "" as ModelProviderID,
										model: "",
										toolName: "",
										toolDescription: "",
										enabled: true,
										useAsTool: false,
										agentTools: [],
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
							</div>
						</Accordion>
					)}
				</form.Field>
			</div>
		</form.AppForm>
	)

}
