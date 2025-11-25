import { useForm } from "@tanstack/react-form";
import { Button } from "~/components/ui/button";
import ObsidianAgentsServer from "~/index";
import { Notice } from "obsidian";
import { ModelProvider } from "~/providers";
import { useEffect, useState } from "react";
import { Trash } from "lucide-react";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { ModelProviderID } from "~/models/providers";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectGroup, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Checkbox } from "~/components/ui/checkbox";

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

	const form = useForm({
		defaultValues: {
			agents: plugin.settings.agents
		},
		onSubmit: async ({ value }) => {
			plugin.settings.agents = value.agents
			await plugin.saveSettings()
			new Notice("Settings Updated!")
		}
	})

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault()
				e.stopPropagation()
				form.handleSubmit()
			}}
			className="relative"
		>
			<Button type="submit" className="right-0 absolute">Save</Button>
			<p className="text-center w-full">Agents Settings</p>
			<form.Field name="agents" mode="array">
				{(field) => (
					<div>
						<Button type="button" onClick={() => {
							field.pushValue({
								name: "",
								instructions: "",
								modelProvider: "" as ModelProviderID,
								model: "",
								enabled: true
							})
						}}>
							Add Agent
						</Button>
						{field.state.value.map((agent, i) => (
							<div key={i} className="relative py-2 flex flex-col gap-2">
								<h2>Agent #{i + 1}</h2>
								<Trash size={16} onClick={() => {
									field.removeValue(i)
									form.handleSubmit()
								}} className="absolute cursor-pointer right-4 top-2 hover:stroke-red-600 transition-colors duration-300" />
								<form.Field name={`agents[${i}].enabled`}>
									{(subField) => {
										return (
											<div className="flex gap-4 pt-2">
												<Label htmlFor={subField.name}>Enabled</Label>
												<Checkbox
													id={subField.name}
													name={subField.name}
													checked={subField.state.value}
													onBlur={subField.handleBlur}
													onCheckedChange={(checked) => subField.handleChange(checked === true)}
												/>
											</div>
										)
									}}
								</form.Field>
								<form.Field name={`agents[${i}].name`}>
									{(subField) => {
										return (
											<>
												<Label htmlFor={subField.name}>Name</Label>
												<Input
													id={subField.name}
													name={subField.name}
													onBlur={subField.handleBlur}
													value={subField.state.value}
													onChange={(e) => subField.handleChange(e.target.value)}
												/>
											</>
										)
									}}
								</form.Field>
								<form.Field name={`agents[${i}].instructions`}>
									{(subField) => {
										return (
											<>
												<Label htmlFor={subField.name}>Instructions</Label>
												<Textarea
													id={subField.name}
													name={subField.name}
													onBlur={subField.handleBlur}
													value={subField.state.value}
													onChange={(e) => subField.handleChange(e.target.value)}
												/>
											</>
										)
									}}
								</form.Field>
								<form.Field name={`agents[${i}].model`}>
									{(subField) => {
										return (
											<>
												<Label htmlFor={subField.name}>Model</Label>
												<Select
													name={subField.name}
													value={subField.state.value}
													onValueChange={(value) => {
														subField.handleChange(value)
														const model = models.find(m => m.id === value)
														if (model) {
															form.setFieldValue(`agents[${i}].modelProvider`, model.provider)
														}
													}}
												>
													<SelectTrigger>
														<SelectValue placeholder="Select Model" />
													</SelectTrigger>
													<SelectContent>
														<SelectGroup>
															{models.map((model, i) => (
																<SelectItem key={i} value={model.id}>{model.id}</SelectItem>
															))}
														</SelectGroup>
													</SelectContent>
												</Select>
											</>
										)
									}}
								</form.Field>
							</div>
						))}
					</div>
				)}
			</form.Field>
		</form>
	)

}
