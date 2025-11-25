import { useForm } from "@tanstack/react-form";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import ObsidianAgentsServer from "~/index";
import { Clipboard } from "lucide-react";
import { Notice } from "obsidian";

export default function AgentsSettings({ plugin }: { plugin: ObsidianAgentsServer }) {
	const form = useForm({
		defaultValues: {
			deviceId: plugin.settings.deviceId,
			controlDeviceId: plugin.settings.controlDeviceId
		},
		onSubmit: async ({ value }) => {
			console.log('form submitted: ', value)
			plugin.settings.controlDeviceId = value.controlDeviceId
			await plugin.saveSettings()
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
			<form.Field
				name="deviceId"
				children={(field) => {
					return (
						<div className="relative">
							<Label htmlFor={field.name}>Device ID</Label>
							<Input
								readOnly
								id={field.name}
								name={field.name}
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
							/>
							<Clipboard
								size={16}
								className="absolute cursor-pointer hover:stroke-green-300 transition-colors duration-300 right-4 top-8"
								onClick={() => {
									navigator.clipboard.writeText(field.state.value)
									new Notice('Device ID copied to clipboard!')
								}}
							/>
						</div>
					)
				}}
			/>
			<form.Field
				name="controlDeviceId"
				children={(field) => {
					return (
						<>
							<Label htmlFor={field.name}>Control Device ID</Label>
							<Input
								id={field.name}
								name={field.name}
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
							/>
						</>
					)
				}}
			/>
		</form>
	)

}
