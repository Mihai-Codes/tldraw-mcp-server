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
  {
    name: 'export_png',
    description:
      'Export the current canvas as a PNG image. ' +
      'Returns base64-encoded PNG. Uses server-side Playwright — no browser required.',
    inputSchema: {
      type: 'object',
      properties: {
        background: {
          type: 'boolean',
          description: 'Include white background (default: true)',
        },
      },
    },
  },
  {
    name: 'export_jpg',
    description:
      'Export the current canvas as a JPEG image. ' +
      'Returns base64-encoded JPEG. Uses server-side Playwright — no browser required.',
    inputSchema: {
      type: 'object',
      properties: {
        background: {
          type: 'boolean',
          description: 'Include white background (default: true)',
        },
      },
    },
  },
]

export const groupingTools: Tool[] = [
  {
    name: 'group_elements',
    description:
      'Group multiple canvas elements together. ' +
      'Grouped elements move and transform as a unit. ' +
      'Returns the group ID for future reference.',
    inputSchema: {
      type: 'object',
      properties: {
        elementIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs of elements to group (minimum 2)',
        },
        groupId: {
          type: 'string',
          description: 'Custom group ID (auto-generated if omitted)',
        },
      },
      required: ['elementIds'],
    },
  },
  {
    name: 'ungroup_elements',
    description:
      'Dissolve a group, releasing all child elements back to the canvas as independent shapes.',
    inputSchema: {
      type: 'object',
      properties: {
        groupId: {
          type: 'string',
          description: 'ID of the group element to dissolve',
        },
      },
      required: ['groupId'],
    },
  },
]

export const stickyNoteTools: Tool[] = [
  {
    name: 'create_sticky',
    description:
      'Create a sticky note on the canvas. Shorthand for create_element with type=note and sensible defaults. ' +
      'Stickies default to yellow, solid fill, and the draw font.',
    inputSchema: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'X position' },
        y: { type: 'number', description: 'Y position' },
        text: { type: 'string', description: 'Sticky note content' },
        id: { type: 'string', description: 'Custom element ID (auto-generated if omitted)' },
        color: {
          type: 'string',
          description: "Color: 'yellow' (default) | 'orange' | 'green' | 'light-blue' | 'violet' | 'red' | 'black' | 'white'",
        },
        size: {
          type: 'string',
          enum: ['s', 'm', 'l', 'xl'],
          description: 'Text size preset (default: m)',
        },
        font: {
          type: 'string',
          enum: ['draw', 'sans', 'serif', 'mono'],
          description: 'Font family (default: draw)',
        },
        width: { type: 'number', description: 'Width in pixels (default: 200)' },
        height: { type: 'number', description: 'Height in pixels (default: 200)' },
      },
      required: ['x', 'y'],
    },
  },
  {
    name: 'update_sticky',
    description: 'Update the content or styling of an existing sticky note.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the sticky note to update' },
        text: { type: 'string', description: 'New text content' },
        color: { type: 'string', description: "Color name: 'yellow' | 'orange' | 'green' | 'light-blue' | 'violet' | 'red'" },
        size: { type: 'string', enum: ['s', 'm', 'l', 'xl'], description: 'Text size preset' },
        font: { type: 'string', enum: ['draw', 'sans', 'serif', 'mono'], description: 'Font family' },
        x: { type: 'number', description: 'New X position' },
        y: { type: 'number', description: 'New Y position' },
        width: { type: 'number', description: 'New width' },
        height: { type: 'number', description: 'New height' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_sticky_templates',
    description:
      'Return a list of pre-built sticky note templates with recommended colors, sizes, and use cases. ' +
      'Call this before create_sticky for inspiration.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
]
