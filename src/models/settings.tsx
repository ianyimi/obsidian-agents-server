import { useStore } from "@tanstack/react-form";
import ObsidianAgentsServer from "~/index";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { MODEL_PROVIDERS, ModelProviderID } from "~/models/providers/constants";
import { Trash } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useAppForm } from "~/components/form";
import { Activity } from "react";

export default function ModelSettings({ plugin }: { plugin: ObsidianAgentsServer }) {
	const form = useAppForm({
		defaultValues: {
			modelProviders: plugin.settings.modelProviders
		},
		onSubmit: async ({ value }) => {
			console.log('value: ', value)
			plugin.settings.modelProviders = value.modelProviders
			// Reinitialize model providers when settings change
			plugin.modelProviders = plugin.initializeModelProviders()
			await plugin.saveSettings()
		},
		onSubmitInvalid: ({ value }) => {
			console.log('submit invalid: ', value)
		}
	})

	const modelProviders = useStore(form.store, (state) => state.values.modelProviders)

	return (
		<form.AppForm>
			<div className="relative">
				<Button type="submit" onClick={form.handleSubmit} className="right-0 absolute -top-11">Save</Button>
				<form.Field name="modelProviders" mode="array">
					{(field) => (
						<div className="py-6">
							<Select value={""} onValueChange={(value) => {
								const provider = MODEL_PROVIDERS[value as ModelProviderID]
								field.pushValue({ id: value as ModelProviderID, label: provider.label, baseURL: provider.baseURL })
								form.handleSubmit()
								value = ""
							}}>
								<SelectTrigger>
									<SelectValue>Add Model Provider</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{Object.values(MODEL_PROVIDERS)
										.filter(p => !modelProviders.find(p2 => p2.id === p.id))
										.map((provider, i) => (
											<SelectItem key={i} value={provider.id}>{provider.label}</SelectItem>
										))
									}
								</SelectContent>
							</Select>
							{field.state.value.map((provider, i) => {
								const providerInstance = Object.values(MODEL_PROVIDERS).find(p => p.id === provider.id)
								return (
									<div key={`modelProvider-${i}`} className="relative py-2">
										<h2>{provider.label}</h2>
										<Trash
											size={16}
											onClick={() => {
												field.removeValue(i)
												form.handleSubmit()
											}}
											className="absolute cursor-pointer right-4 top-2 hover:stroke-red-600 transition-colors duration-300"
										/>
										<form.AppField name={`modelProviders[${i}].baseURL`}>
											{(subField) => <subField.TextField label="Base URL" />}
										</form.AppField>
										<Activity mode={providerInstance?.apiKeyRequired ? "visible" : "hidden"}>
											<form.AppField name={`modelProviders[${i}].apiKey`}>
												{(subField) => <subField.TextField label="API Key" inputProps={{ type: "password" }} />}
											</form.AppField>
										</Activity>
									</div>
								)
							})}
						</div>
					)}
				</form.Field>
			</div>
		</form.AppForm>
	)
}
