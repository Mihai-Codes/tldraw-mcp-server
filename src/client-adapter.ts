import type { TldrawMcpConfig } from './config.js'

export interface ToolNameAdapter {
  exposeName(name: string): string
  normalizeName(name: string): string
}

export function createToolNameAdapter(config: TldrawMcpConfig): ToolNameAdapter {
  const doubleUnderscorePrefix = `${config.serverName}__`
  const singleUnderscorePrefix = `${config.serverName}_`

  return {
    exposeName(name: string): string {
      return config.includeServerInToolNames ? `${doubleUnderscorePrefix}${name}` : name
    },

    normalizeName(name: string): string {
      if (name.startsWith(doubleUnderscorePrefix)) {
        return name.slice(doubleUnderscorePrefix.length)
      }

      // Some gateways/clients prefer single-underscore server prefixes.
      if (name.startsWith(singleUnderscorePrefix)) {
        return name.slice(singleUnderscorePrefix.length)
      }

      return name
    },
  }
}
