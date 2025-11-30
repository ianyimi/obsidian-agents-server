import { useAppForm } from "~/components/form";
import ObsidianAgentsServer from "..";
import { Notice } from "obsidian";
import { Button } from "~/components/ui/button";
import { nanoid } from "nanoid";
import { Trash } from "lucide-react";
import { SelectGroup, SelectItem } from "~/components/ui/select";
import { cn } from "~/lib/utils";


export default function MCPServerSettings({ plugin }: { plugin: ObsidianAgentsServer }) {
	const form = useAppForm({
		defaultValues: {
			mcpServers: plugin.settings.mcpServers
		},
		onSubmit: async ({ value }) => {
			plugin.settings.mcpServers = value.mcpServers
			await plugin.saveSettings()

			await plugin.mcpManager.initializeServers()

			plugin.agents = await plugin.initializeAgents()

			new Notice("MCP Servers Updated!")
		}
	})

	return (
		<form.AppForm>
			<div className="relative">
				<Button type="submit" onClick={form.handleSubmit} className="right-0 absolute">
					Save
				</Button>
				<p className="text-center w-full">MCP Servers</p>

				<form.Field name="mcpServers" mode="array">
					{(field) => (
						<div>
							<Button
								type="button"
								onClick={() => {
									field.pushValue({
										id: nanoid(),
										name: "",
										enabled: true,
										type: "stdio",
										command: "npx",
										args: "",
										env: [],
										cacheToolsList: true
									})
								}}
							>
								Add MCP Server
							</Button>
							{field.state.value?.map((server, i) => (
								<div key={i} className="relative py-2 flex flex-col gap-2">
									<h2>MCP Server #{i + 1}</h2>
									<Trash
										size={16}
										onClick={() => {
											field.removeValue(i)
											form.handleSubmit()
										}}
										className="absolute cursor-pointer right-4 top-2 hover:stroke-destructive transition-colors duration-300"
									/>

									<form.AppField name={`mcpServers[${i}].enabled`}>
										{(subField) => (<subField.CheckboxField label="Enabled" orientation="horizontal" />)}
									</form.AppField>

									<form.AppField name={`mcpServers[${i}].name`}>
										{(subField) => (<subField.TextField label="Name" />)}
									</form.AppField>

									<form.AppField name={`mcpServers[${i}].type`}>
										{(subField) => (<subField.SelectField label="Type">
											<SelectGroup>
												<SelectItem value="stdio">Stdio (Local Command)</SelectItem>
												<SelectItem value="sse">SSE (HTTP Server)</SelectItem>
											</SelectGroup>
										</subField.SelectField>)}
									</form.AppField>

									<form.Subscribe
										selector={(state) => state.values.mcpServers[i].type}
										children={(type) => (
											<div className={cn(type !== "stdio" && "hidden")}>
												<form.AppField name={`mcpServers[${i}].command`}>
													{(subField) => (<subField.TextField label="Command" inputProps={{ placeholder: "npx", required: type === "stdio" }} />)}
												</form.AppField>
												<form.AppField name={`mcpServers[${i}].args`}>
													{(subField) => (
														<subField.TextField
															label="Command Args (a comma-separated list of strings)"
															inputProps={{
																placeholder: "-y,@context7/mcp-server,--docs,obsidian",
															}}
														/>
													)}
												</form.AppField>
												<form.Field name={`mcpServers[${i}].env`} mode="array">
													{(subField) => (
														<div className="relative">
															<h2>Env</h2>
															<div className="grid place-items-center">
																<Button
																	onClick={() => {
																		subField.pushValue({ name: "", value: "" })
																	}}
																>
																	Add ENV
																</Button>
															</div>
															{subField.state.value?.map((env, j) => (
																<div key={j} className="grid grid-cols-2 gap-4 relative">
																	<form.AppField name={`mcpServers[${i}].env[${j}].name`}>
																		{(envField) => (<envField.TextField label="NAME" />)}
																	</form.AppField>
																	<form.AppField name={`mcpServers[${i}].env[${j}].value`}>
																		{(envField) => (<envField.TextField label="VALUE" />)}
																	</form.AppField>
																	<Trash
																		size={16}
																		className="absolute cursor-pointer -right-8 top-1/2 hover:stroke-destructive transition-colors duration-300"
																		onClick={() => {
																			subField.removeValue(j)
																			form.handleSubmit(j)
																		}}
																	/>
																</div>
															))}
														</div>
													)}
												</form.Field>
											</div>
										)}
									/>

									<form.Subscribe
										selector={(state) => state.values.mcpServers[i].type}
										children={(type) => (
											<div className={cn(type !== "sse" && "hidden")}>
												<form.AppField name={`mcpServers[${i}].url`}>
													{(subField) => <subField.TextField label="URL" inputProps={{ placeholder: "http://localhost:3000/sse", required: type === "sse" }} />}
												</form.AppField>
											</div>
										)}
									/>

									<form.AppField name={`mcpServers[${i}].cacheToolsList`}>
										{(subField) => <subField.CheckboxField label="Cache Tools List" orientation="horizontal" />}
									</form.AppField>
								</div>
							))}
						</div>
					)}
				</form.Field>
			</div>
		</form.AppForm>
	)
}
