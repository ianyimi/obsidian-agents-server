import { useForm } from "@tanstack/react-form";
import { Button } from "~/components/ui/button";
import ObsidianAgentsServer from "~/index";
import { Notice } from "obsidian";
import { ModelProvider } from "~/providers";
import { useEffect, useState } from "react";

export default function AgentsSettings({ plugin, modelProviders }: { plugin: ObsidianAgentsServer, modelProviders: ModelProvider[] }) {
	const [models, setModels] = useState<string[]>([])
	console.log('models: ', models)

	useEffect(() => {
		const allModels: string[] = []
		modelProviders.forEach(p => {
			p.models.forEach(model => {
				if (!allModels.includes(model)) {
					allModels.push(model)
				}
			})
		})
		setModels(allModels)
	}, [modelProviders])

	const form = useForm({
		defaultValues: {
			agents: []
		},
		onSubmit: async ({ value }) => {
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
			className="border border-blue-200 relative"
		>
			<Button type="submit" className="right-0 absolute">Save</Button>
			<p className="text-center w-full">Agents Settings</p>
		</form>
	)

}
