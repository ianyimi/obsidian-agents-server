import { Button } from "~/components/ui/button";
import ObsidianAgentsServer from "~/index";
import { Notice } from "obsidian";
import { ModelProvider } from "~/models/providers";
import { useEffect, useState } from "react";
import { Trash } from "lucide-react";
import { ModelProviderID } from "~/models/providers/constants";
import { SelectGroup, SelectItem } from "~/components/ui/select";
import { useAppForm } from "~/components/form"
import { nanoid } from "nanoid";
import { TOOL_TYPES } from "~/tools/types";
import { VAULT_TOOLS, VaultToolsID } from "~/tools/vault";

export default function AgentsSettings({ plugin, modelProviders }: { plugin: ObsidianAgentsServer, modelProviders: ModelProvider[] }) {
	const [models, setModels] = useState<{ id: string, provider: ModelProviderID }[]>([])
	const vaultToolsArray = Object.values(VAULT_TOOLS).map(t => t.id)

	useEffect(() => {
		const allModels: { id: string, provider: ModelProviderID }[] = []
		modelProviders.forEach(p => {
			p.models.forEach(model => {
				if (!allModels.find(m => m.id === model)) {
					allModels.push({ id: model, provider: p.id })
				}
			})
		})
		setModels(allModels)
	}, [modelProviders])

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
