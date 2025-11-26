import { useForm } from "@tanstack/react-form";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import ObsidianAgentsServer from "~/index";
import { Clipboard } from "lucide-react";
import { Notice } from "obsidian";

export default function GeneralSettings({ plugin }: { plugin: ObsidianAgentsServer }) {
	const form = useForm({
		defaultValues: {
			deviceID: plugin.settings.deviceID,
			controlDeviceID: plugin.settings.controlDeviceID,
			serverPort: plugin.settings.serverPort
		},
		onSubmit: async ({ value }) => {
			if (value.serverPort !== plugin.settings.serverPort) {
				plugin.settings.serverPort = value.serverPort
				plugin.restartServer()
			}
			plugin.settings.controlDeviceID = value.controlDeviceID
			plugin.settings.serverPort = value.serverPort
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
			className="relative"
		>
			<Button type="submit" className="right-0 absolute">Save</Button>
			<p className="text-center w-full">General Settings</p>
			<form.Field
				name="deviceID"
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
				name="controlDeviceID"
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
			<form.Field
				name="serverPort"
				children={(field) => {
					return (
						<>
							<Label htmlFor={field.name}>Server Port</Label>
							<Input
								id={field.name}
								name={field.name}
								type="number"
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(Number(e.target.value))}
							/>
						</>
					)
				}}
			/>
		</form>
	)

}
