import { Button } from "~/components/ui/button";
import ObsidianAgentsServer from "~/index";
import { Activity, useEffect, useState } from "react";
import { Loader2Icon, Plus, Trash } from "lucide-react";
import { MODEL_PROVIDERS, ModelProviderID, ModelProviderLabel } from "~/models/providers/constants";
import { SelectGroup, SelectItem, SelectLabel } from "~/components/ui/select";
import { useAppForm } from "~/components/form"
import { nanoid } from "nanoid";
import { TOOL_TYPES } from "~/tools/types";
import { VAULT_TOOLS, VaultToolsID } from "~/tools/vault";
import { MultiSelect, MultiSelectContent, MultiSelectGroup, MultiSelectItem, MultiSelectTrigger, MultiSelectValue } from "~/components/ui/multi-select";
import { useQuery } from "@tanstack/react-query";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";

export default function AgentsSettings({ plugin }: { plugin: ObsidianAgentsServer }) {
  const [modelsByProvider, setModelsByProvider] = useState<{ id: ModelProviderID, models: { id: string, provider: ModelProviderID }[] }[]>([])
  const vaultToolsArray = Object.values(VAULT_TOOLS).map(t => t.id)
  const mcpServers = Array.from(plugin.mcpManager.servers.values())
  const { data: mcpServerTools, isPending: pendingServerTools } = useQuery({
    queryKey: ["mcp-servers-tools"],
    queryFn: async () => {
      const st = []
      // Only query connected servers to avoid hanging offline
      const connectedServers = mcpServers.filter(s => s.status === 'connected')

      for (const server of connectedServers) {
        try {
          const tools = await server.server.listTools()
          st.push({
            serverID: server.id,
            tools
          })
        } catch (err) {
          console.warn(`[Settings] Failed to list tools for ${server.id}:`, err)
        }
      }
      return st
    },
    // Add retry and staleTime config for better offline behavior
    retry: 1,
    staleTime: 30000, // Cache for 30 seconds
  })

  useEffect(() => {
    const allModelsByProvider: { id: ModelProviderID, models: { id: string, provider: ModelProviderID, providerLabel: ModelProviderLabel }[] }[] = []
    plugin.modelProviders.forEach(p => {
      const providerModels: { id: string, provider: ModelProviderID, providerLabel: ModelProviderLabel }[] = []
      p.models.forEach(model => {
        if (!providerModels.find(m => m.id === model)) {
          providerModels.push({ id: model, provider: p.id, providerLabel: MODEL_PROVIDERS[p.id].label })
        }
      })
      allModelsByProvider.push({
        id: p.id,
        models: providerModels
      })
    })
    setModelsByProvider(allModelsByProvider)
  }, [plugin.modelProviders])

  const form = useAppForm({
    defaultValues: {
      agents: plugin.settings.agents,
      restartServer: false
    },
    onSubmit: async ({ value }) => {
      plugin.settings.agents = value.agents
      await plugin.saveSettings()
      await plugin.restartServer()
    }
  })

  function reloadModels() {
    const allModels: { id: string, provider: ModelProviderID }[] = []
    plugin.modelProviders.forEach((provider) => {
      provider.getModels().then(models => {
        models.forEach(model => {
          if (!allModels.find(m => m.id === model)) {
            allModels.push({ id: model, provider: provider.id })
          }
        })
      })
    })
    console.log('allModels: ', allModels)
  }

  return (
    <form.AppForm>
      <div className="relative">
        <Button type="submit" onClick={form.handleSubmit} className="right-0 -top-11 absolute">
          Save
        </Button>
        <form.Field name="agents" mode="array">
          {(field) => (
            <Accordion className="py-6 flex flex-col gap-4" type="multiple" defaultValue={form.state.values.agents.filter(a => !a.collapsed).map(a => a.id)} onValueChange={async (value) => {
              for (const agent of form.state.values.agents) {
                let updatedSettings = false
                if (value.includes(agent.id) && agent.collapsed) {
                  agent.collapsed = false
                  updatedSettings = true
                }
                if (!value.includes(agent.id) && !agent.collapsed) {
                  agent.collapsed = true
                  updatedSettings = true
                }
                if (updatedSettings) {
                  plugin.settings.agents = form.state.values.agents
                  await plugin.saveSettings({ hideNotice: true })
                }
              }
            }}>
              {field.state.value?.map((agent, i) => (
                <AccordionItem value={agent.id} key={`agent-${i}`}>
                  <AccordionTrigger className="px-4">{agent.name !== "" ? agent.name : `Agent #${i + 1}`}</AccordionTrigger>
                  <AccordionContent className="relative py-2 flex flex-col gap-2">
                    {/* <h2>{agent.name !== "" ? agent.name : `Agent #${i + 1}`}</h2> */}
                    <Trash
                      size={16}
                      onClick={() => {
                        field.removeValue(i)
                        form.handleSubmit()
                      }}
                      className="absolute cursor-pointer right-4 top-2 hover:stroke-red-600 transition-colors duration-300"
                    />
                    <div className="flex gap-4">
                      <form.AppField name={`agents[${i}].enabled`}>
                        {(subField) => <subField.CheckboxField label="Enabled" orientation="horizontal" />}
                      </form.AppField>
                    </div>
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
                          modelsByProvider.forEach(mp => {
                            const model = mp.models.find(m => m.id === value)
                            if (model) {
                              if (subField.state.value !== value) {
                                form.setFieldValue("restartServer", true)
                              }
                              form.setFieldValue(`agents[${i}].modelProvider`, mp.id)
                            }
                          })
                        }}>
                          {modelsByProvider.map((provider, j) => (
                            <SelectGroup key={`${j}-provider-${provider.id}-models`}>
                              <SelectLabel className="text-center">{MODEL_PROVIDERS[provider.id].label}</SelectLabel>
                              {provider.models.sort((m1, m2) => m1.id < m2.id ? 1 : -1).map((model, k) => (
                                <SelectItem key={`provider-${provider.id}-model-${model.id}-${k}`} value={model.id}>{model.id}</SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </subField.SelectField>
                      )}
                    </form.AppField>
                    <form.AppField name={`agents[${i}].agentTools`}>
                      {(subField) => (
                        <div className="flex flex-col gap-2">
                          <h2 className="text-center">Agent as Tool Settings</h2>
                          <div className="flex justify-center">
                            <form.AppField name={`agents[${i}].useAsTool`}>
                              {(subField) => <subField.CheckboxField label="Use Agent as Tool" orientation="horizontal" />}
                            </form.AppField>
                          </div>
                          <form.Subscribe
                            selector={(state) => state.values.agents[i].useAsTool}
                          >
                            {(useAsTool) => (
                              <Activity mode={useAsTool ? "visible" : "hidden"}>
                                <form.AppField name={`agents[${i}].toolName`}>
                                  {(subField) => (<subField.TextField label="Tool Name" defaultValue={agent.name} />)}
                                </form.AppField>
                                <form.AppField name={`agents[${i}].toolDescription`}>
                                  {(subField) => (<subField.TextareaField label="Tool Description" />)}
                                </form.AppField>
                              </Activity>
                            )}
                          </form.Subscribe>
                          <div className="flex justify-center">
                            <subField.MultiSelectField label="Agents available as Tools for this Agent">
                              <MultiSelectContent search={false}>
                                <MultiSelectGroup>
                                  {form.state.values.agents.filter(a => a.id !== agent.id && a.useAsTool).map((agentTool, i) => (
                                    <MultiSelectItem key={i} value={agentTool.id} className="text-center">{agentTool.name}</MultiSelectItem>
                                  ))}
                                </MultiSelectGroup>
                              </MultiSelectContent>
                            </subField.MultiSelectField>
                          </div>
                        </div>
                      )}
                    </form.AppField>
                    <div className="py-6">
                      <h2>Vault Tools</h2>
                      <div className="flex flex-wrap pt-4 gap-8">
                        {vaultToolsArray.map((t, j) => {
                          const tool = Object.values(VAULT_TOOLS).find(vt => vt.id === t)!
                          return (
                            <form.AppField name={`agents[${i}].vaultTools.${t}`} key={j}>
                              {(subField) => <subField.CheckboxField label={tool.label} orientation="horizontal" />}
                            </form.AppField>
                          )
                        })}
                      </div>
                    </div>
                    <div className="py-6">
                      <h2>File Access</h2>
                      <div className="flex flex-wrap pt-4 gap-8">
                        <form.Field name={`agents[${i}].includedFolders`} mode="array">
                          {(field) => (
                            <div className="w-full">
                              <div className="flex gap-4 items-center">
                                <h2>Included Folders</h2>
                                <Button onClick={(e) => {
                                  e.preventDefault()
                                  field.pushValue({ path: "" })
                                }}>
                                  <Plus size={16} />
                                </Button>
                              </div>
                              <div>
                                {field.state.value?.map((inf, j) => (
                                  <div className="relative" key={j}>
                                    <form.AppField name={`agents[${i}].includedFolders.[${j}].path`}>
                                      {(subField) => <subField.FolderPathField label="Included Folder" app={plugin.app} />}
                                    </form.AppField>
                                    <Trash
                                      size={16}
                                      onClick={() => {
                                        field.removeValue(j)
                                        form.handleSubmit()
                                      }}
                                      className="absolute cursor-pointer right-4 top-1/2 hover:stroke-red-600 transition-colors duration-300"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </form.Field>
                        <form.Field name={`agents[${i}].excludedFolders`} mode="array">
                          {(field) => (
                            <div className="w-full">
                              <div className="flex gap-4 items-center">
                                <h2>Excluded Folders</h2>
                                <Button onClick={(e) => {
                                  e.preventDefault()
                                  field.pushValue({ path: "" })
                                }}>
                                  <Plus size={16} />
                                </Button>
                              </div>
                              <div>
                                {field.state.value?.map((exf, j) => (
                                  <div className="relative" key={j}>
                                    <form.AppField name={`agents[${i}].excludedFolders.[${j}].path`}>
                                      {(subField) => <subField.FolderPathField label="Excluded Folder" app={plugin.app} />}
                                    </form.AppField>
                                    <Trash
                                      size={16}
                                      onClick={() => {
                                        field.removeValue(j)
                                        form.handleSubmit()
                                      }}
                                      className="absolute cursor-pointer right-4 top-1/2 hover:stroke-red-600 transition-colors duration-300"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </form.Field>
                      </div>
                    </div>
                    <form.Field name={`agents[${i}].mcpTools`} mode="array">
                      {(mcpToolsField) => (
                        <div>
                          <h2>MCP Tools</h2>
                          <div className="grid place-items-center">
                            <form.Subscribe
                              selector={(state) => (state.values.agents[i].mcpTools)}
                            >
                              {(mcpTools) => {
                                const selectedServerIDs = mcpTools.map(t => t.serverID)
                                return (
                                  <MultiSelect values={selectedServerIDs} onValuesChange={(values) => {
                                    const mcpToolsFieldValues = mcpToolsField.state.value
                                    for (const serverID of values) {
                                      if (!mcpToolsFieldValues.find(tool => tool.serverID === serverID)) {
                                        mcpToolsField.pushValue({
                                          enabled: true,
                                          type: TOOL_TYPES.mcp,
                                          serverID,
                                          toolIDs: mcpServerTools?.find(t => t.serverID === serverID)?.tools.map(t => t.name) ?? []
                                        })
                                      }
                                    }
                                    if (values.length !== mcpToolsFieldValues.length) {
                                      const valuesSet = new Set(values)
                                      mcpToolsFieldValues.forEach((fv) => {
                                        if (valuesSet.has(fv.serverID)) return
                                        mcpToolsField.removeValue(mcpToolsField.state.value.findIndex(v => v.serverID === fv.serverID))
                                      })
                                    }
                                  }}>
                                    <MultiSelectTrigger>
                                      <MultiSelectValue overflowBehavior="wrap" placeholder="Add MCP Tool" />
                                    </MultiSelectTrigger>
                                    <MultiSelectContent>
                                      <MultiSelectGroup>
                                        {mcpServers.map((mcpServer, i) => {
                                          // Get server name from config instead of server instance
                                          // because server might be null if connection failed
                                          const config = plugin.settings.mcpServers.find(c => c.id === mcpServer.id);
                                          const serverName = config?.name || mcpServer.id;
                                          const displayName = mcpServer.status === 'error'
                                            ? `${serverName} (offline)`
                                            : mcpServer.status === 'disabled'
                                              ? `${serverName} (disabled)`
                                              : serverName;

                                          return (
                                            <MultiSelectItem key={i} value={mcpServer.id} className="text-center">
                                              {displayName}
                                            </MultiSelectItem>
                                          );
                                        })}
                                      </MultiSelectGroup>
                                    </MultiSelectContent>
                                  </MultiSelect>
                                )
                              }}
                            </form.Subscribe>
                          </div>
                          {mcpToolsField.state.value?.map((mcpTool, j) => {
                            // Get server info from config and connection status
                            const mcpServer = mcpServers.find(s => s.id === mcpTool.serverID)
                            const serverConfig = plugin.settings.mcpServers.find(c => c.id === mcpTool.serverID)
                            const serverName = serverConfig?.name || mcpTool.serverID
                            const isOffline = mcpServer?.status !== 'connected'

                            // Get available tools from connected server, or use saved toolIDs if offline
                            const serverTools = mcpServerTools?.find(mst => mst.serverID === mcpTool.serverID)?.tools

                            return (
                              <div key={j} className="relative">
                                {pendingServerTools ?
                                  <Loader2Icon size={16} className="animate-spin" /> :
                                  (
                                    <div className="flex flex-col gap-4">
                                      <h4>
                                        {serverName}
                                        {isOffline && <span className="text-xs text-muted-foreground ml-2">(offline)</span>}
                                      </h4>
                                      <Trash
                                        size={16}
                                        onClick={() => {
                                          mcpToolsField.removeValue(j)
                                          form.handleSubmit()
                                        }}
                                        className="absolute cursor-pointer right-4 top-0 hover:stroke-red-600 transition-colors duration-300"
                                      />
                                      <div className="flex gap-6 flex-wrap">
                                        {isOffline ? (
                                          // Show saved tool IDs when offline
                                          mcpTool.toolIDs.map((toolID, k) => (
                                            <div key={k} className="flex gap-2 items-center">
                                              <Label htmlFor={`${mcpTool.serverID}-${toolID}`} className="text-muted-foreground">
                                                {toolID}
                                              </Label>
                                              <Checkbox
                                                id={`${mcpTool.serverID}-${toolID}`}
                                                checked={true}
                                                disabled={true}
                                                className="opacity-50"
                                              />
                                            </div>
                                          ))
                                        ) : (
                                          // Show interactive tools when online
                                          serverTools?.map((tool, k) => (
                                            <div key={k} className="flex gap-2 cursor-pointer">
                                              <Label htmlFor={tool.name}>{tool.name ?? tool.title}</Label>
                                              <Checkbox
                                                id={tool.name}
                                                defaultChecked={mcpTool.toolIDs.includes(tool.name)}
                                                onCheckedChange={(checked) => {
                                                  const existingTool = mcpToolsField.state.value.find(v => v.serverID === mcpTool.serverID && v.toolIDs.includes(tool.name))
                                                  if (checked && !existingTool) {
                                                    mcpTool.toolIDs.push(tool.name)
                                                  }
                                                  if (!checked && existingTool) {
                                                    mcpTool.toolIDs = mcpTool.toolIDs.filter(t => t !== tool.name)
                                                  }
                                                  form.handleSubmit()
                                                }}
                                              />
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    </div>
                                  )
                                }
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </form.Field>
                    <form.Field name={`agents[${i}].tools`} mode="array">
                      {(agentTools) => (
                        <div className="relative">
                          <h2>User Tools</h2>
                          <div className="grid place-items-center pb-4">
                            <Button
                              type="button"
                              onClick={() => {
                                agentTools.pushValue({
                                  type: { id: "", label: "" },
                                  enabled: true,
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
                                    <div>
                                      <subField.SelectField label="Type" placeholder="Select Tool Type">
                                        <SelectGroup>
                                          {Object.values(TOOL_TYPES).filter(t => t.id !== "" && t.id !== "vault").map((tool, k) => (
                                            <SelectItem key={k} value={tool.id}>{tool.label}</SelectItem>
                                          ))}
                                        </SelectGroup>
                                      </subField.SelectField>
                                    </div>
                                  )}
                                </form.AppField>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </form.Field>
                  </AccordionContent>
                </AccordionItem>
              ))}
              <div className="grid place-items-center">
                <Button type="button" onClick={() => {
                  field.pushValue({
                    id: nanoid(),
                    name: "",
                    instructions: "",
                    collapsed: false,
                    modelProvider: "" as ModelProviderID,
                    model: "",
                    toolName: "",
                    toolDescription: "",
                    enabled: true,
                    useAsTool: false,
                    agentTools: [],
                    vaultTools: Object.values(VAULT_TOOLS).reduce(
                      (acc, tool) => {
                        acc[tool.id] = false;
                        return acc
                      },
                      {} as Record<VaultToolsID, boolean>
                    ),
                    includedFolders: [],
                    excludedFolders: [],
                    mcpTools: [],
                    tools: []
                  })
                }}>
                  Add Agent
                </Button>
              </div>
            </Accordion>
          )}
        </form.Field>
      </div>
    </form.AppForm>
  )

}
