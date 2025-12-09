import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import ObsidianAgentsServer from "~/index";
import { Clipboard } from "lucide-react";
import { Notice } from "obsidian";
import { useAppForm } from "~/components/form";

export default function GeneralSettings({ plugin }: { plugin: ObsidianAgentsServer }) {
	const form = useAppForm({
		defaultValues: {
			deviceID: plugin.settings.deviceID,
			controlDeviceID: plugin.settings.controlDeviceID,
			serverPort: plugin.settings.serverPort,
			agentDocsFolder: plugin.settings.agentDocsFolder || "Agent Docs"
		},
		onSubmit: async ({ value }) => {
			const portChanged = value.serverPort !== plugin.settings.serverPort

			// Update settings
			plugin.settings.controlDeviceID = value.controlDeviceID
			plugin.settings.serverPort = value.serverPort
			plugin.settings.agentDocsFolder = value.agentDocsFolder
			await plugin.saveSettings()

			// Restart server if port changed (await to prevent race condition)
			if (portChanged) {
				await plugin.restartServer()
			}
		}
	})

	return (
		<form.AppForm>
			<div className="relative py-6">
				<Button type="submit" onClick={form.handleSubmit} className="right-0 absolute -top-11">Save</Button>
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
				<form.AppField
					name="controlDeviceID"
					children={(field) => <field.TextField label="Control Device ID" />}
				/>
				<form.AppField
					name="serverPort"
					children={(field) =>
						<field.TextField
							label="ServerPort"
							inputProps={{
								type: "number",
								onChange: (e) => field.handleChange(Number(e.target.value))
							}}
						/>
					}
				/>
				<form.AppField
					name="agentDocsFolder"
					children={(field) =>
						<field.TextField
							label="Agent Docs Folder"
						// description="Folder path in your vault where agents store system documentation"
						/>
					}
				/>
			</div>
		</form.AppForm>
	)

}
