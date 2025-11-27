import { useStore } from "@tanstack/react-form";
import ObsidianAgentsServer from "~/index";
import { SelectGroup, SelectItem } from "~/components/ui/select";
import { MODEL_PROVIDERS, ModelProviderID } from "~/models/providers/constants";
import { Trash } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useAppForm } from "~/components/form";

export default function ModelSettings({ plugin }: { plugin: ObsidianAgentsServer }) {
	const form = useAppForm({
		defaultValues: {
			modelProviders: plugin.settings.modelProviders
		},
		onSubmit: async ({ value }) => {
			plugin.settings.modelProviders = value.modelProviders
			await plugin.saveSettings()
		}
	})

	const modelProviders = useStore(form.store, (state) => state.values.modelProviders)

	return (
		<form.AppForm>
			<div className="relative">
				<Button type="submit" className="right-0 absolute top-0">Save</Button>
				<h1 className="text-center pb-8">Model Settings</h1>
				<form.AppField name="modelProviders" mode="array">
					{(field) => (
						<div>
							<field.SelectField onValueChange={(value) => {
								const provider = MODEL_PROVIDERS[value as ModelProviderID]
								field.pushValue({ id: value as ModelProviderID, label: provider.label, baseURL: provider.baseURL })
								form.handleSubmit()
							}}>
								<SelectGroup>
									{Object.values(MODEL_PROVIDERS)
										.filter(p => !modelProviders.find(p2 => p2.id === p.id))
										.map((provider, i) => (
											<SelectItem key={i} value={provider.id}>{provider.label}</SelectItem>
										))
									}
								</SelectGroup>
							</field.SelectField>
							{field.state.value.map((provider, i) => (
								<div key={i} className="relative py-2">
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
								</div>
							))}
						</div>
					)}
				</form.AppField>
			</div>
		</form.AppForm>
	)

}
