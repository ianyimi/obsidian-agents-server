import { useForm, useStore } from "@tanstack/react-form";
import ObsidianAgentsServer from "../..";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { MODEL_PROVIDERS, ModelProviderID } from "./providers";
import { Trash } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Notice } from "obsidian";

export default function ModelSettings({ plugin }: { plugin: ObsidianAgentsServer }) {
	const form = useForm({
		defaultValues: {
			modelProviders: plugin.settings.modelProviders
		},
		onSubmit: async ({ value }) => {
			plugin.settings.modelProviders = value.modelProviders
			await plugin.saveSettings()
			new Notice("Settings Saved!")
		}
	})

	const modelProviders = useStore(form.store, (state) => state.values.modelProviders)

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault()
				e.stopPropagation()
				form.handleSubmit()
			}}
			className="relative"
		>
			<Button type="submit" className="right-0 absolute top-0">Save</Button>
			<h1 className="text-center pb-8">Model Settings</h1>
			<form.Field name="modelProviders" mode="array">
				{(field) => (
					<div>
						<Select value={undefined} onValueChange={(value) => {
							const provider = MODEL_PROVIDERS[value as ModelProviderID]
							field.pushValue({ id: value as ModelProviderID, label: provider.label, baseUrl: provider.baseUrl })
							form.handleSubmit()
						}}>
							<SelectTrigger>
								<SelectValue placeholder="Add a Provider" />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									{Object.values(MODEL_PROVIDERS)
										.filter(p => !modelProviders.find(p2 => p2.id === p.id))
										.map((provider, i) => (
											<SelectItem key={i} value={provider.id}>{provider.label}</SelectItem>
										))
									}
								</SelectGroup>
							</SelectContent>
						</Select>
						{field.state.value.map((provider, i) => (
							<div key={i} className="relative py-2">
								<h2>{provider.label}</h2>
								<Trash size={16} onClick={() => {
									field.removeValue(i)
									form.handleSubmit()
								}} className="absolute cursor-pointer right-4 top-2 hover:stroke-red-600 transition-colors duration-300" />
								<form.Field name={`modelProviders[${i}].baseUrl`}>
									{(subField) => {
										return (
											<>
												<Label htmlFor={subField.name}>Base URL</Label>
												<Input
													id={subField.name}
													onBlur={subField.handleBlur}
													value={subField.state.value}
													onChange={(e) => subField.handleChange(e.target.value)}
												/>
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
