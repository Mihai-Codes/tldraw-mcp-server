import type { Tool } from '@modelcontextprotocol/sdk/types.js'

export const layoutTools: Tool[] = [
  {
    name: 'auto_layout',
    description:
      'Automatically arrange elements using a layout algorithm. ' +
      'Supports dagre (hierarchical), force (force-directed), and grid layouts. ' +
      'Uses arrow connections to determine hierarchy for dagre/force.',
    inputSchema: {
      type: 'object',
      properties: {
        algorithm: {
          type: 'string',
          enum: ['dagre', 'force', 'grid'],
          description: 'Layout algorithm: dagre (hierarchical), force (force-directed), grid',
        },
        elementIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Element IDs to layout (empty = all non-arrow elements)',
        },
        dagre: {
          type: 'object',
          description: 'Dagre-specific options',
          properties: {
            rankdir: {
              type: 'string',
              enum: ['TB', 'LR', 'BT', 'RL'],
              description: 'Layout direction: TB (top-bottom), LR (left-right)',
            },
            nodesep: {
              type: 'number',
              description: 'Horizontal spacing between nodes (default: 60)',
            },
            ranksep: {
              type: 'number',
              description: 'Vertical spacing between ranks (default: 80)',
            },
          },
        },
        force: {
          type: 'object',
          description: 'Force-directed specific options',
          properties: {
            linkDistance: {
              type: 'number',
              description: 'Distance between linked nodes (default: 150)',
            },
            chargeStrength: {
              type: 'number',
              description: 'Charge strength, negative = repulsion (default: -400)',
            },
            iterations: {
              type: 'number',
              description: 'Simulation iterations (default: 300)',
            },
          },
        },
        grid: {
          type: 'object',
          description: 'Grid-specific options',
          properties: {
            columns: {
              type: 'number',
              description: 'Number of columns (0 = auto)',
            },
            gapX: {
              type: 'number',
              description: 'Horizontal gap between elements (default: 60)',
            },
            gapY: {
              type: 'number',
              description: 'Vertical gap between elements (default: 60)',
            },
            direction: {
              type: 'string',
              enum: ['row', 'column'],
              description: 'Arrange direction: row (left-right, then down) or column (top-bottom, then right)',
            },
          },
        },
        respectLocked: {
          type: 'boolean',
          description: 'Preserve locked elements positions (default: false)',
        },
      },
      required: ['algorithm'],
    },
  },
]

export const exportTools: Tool[] = [
  {
    name: 'export_svg',
    description:
      'Export the current canvas as an SVG string. ' +
      'Use this for vector graphics export or further processing.',
    inputSchema: {
      type: 'object',
      properties: {
        background: {
          type: 'boolean',
          description: 'Include background color (default: true)',
        },
      },
    },
  },
  {
    name: 'export_pdf',
    description:
      'Export the current canvas as a PDF file. ' +
      'Returns base64-encoded PDF data. Requires Playwright for full fidelity.',
    inputSchema: {
      type: 'object',
      properties: {
        background: {
          type: 'boolean',
          description: 'Include background color (default: true)',
        },
        format: {
          type: 'string',
          enum: ['a4', 'letter', 'legal'],
          description: 'Paper size (default: a4)',
        },
        landscape: {
          type: 'boolean',
          description: 'Landscape orientation (default: false)',
        },
      },
    },
  },
]
