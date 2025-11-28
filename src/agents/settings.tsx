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

export default function AgentsSettings({ plugin, modelProviders }: { plugin: ObsidianAgentsServer, modelProviders: ModelProvider[] }) {
	const [models, setModels] = useState<{ id: string, provider: ModelProviderID }[]>([])

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
			console.log('value: ', value)
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
										)
										}
									</form.AppField>
									<form.Field name={`agents[${i}].tools`} mode="array">
										{(agentTools) => (
											<div className="relative">
												<h2>Tools</h2>
												<div className="grid place-items-center">
													<Button
														type="button"
														onClick={() => {
															agentTools.pushValue({
																type: { id: "", label: "" },
																enabled: true,
																description: ""
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
																	<subField.SelectField label="Type" placeholder="Select Tool Type">
																		<SelectGroup>
																			{Object.values(TOOL_TYPES).filter(t => t.id !== "").map((tool, k) => (
																				<SelectItem key={k} value={tool.id}>{tool.label}</SelectItem>
																			))}
																		</SelectGroup>
																	</subField.SelectField>
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
