#!/usr/bin/env node

/**
 * This is an MCP server that connects to neovim.
 */

import {
	McpServer,
	ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import process from "process";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { NeovimManager } from "./neovim.js";
import { z } from "zod";

const server = new McpServer({
	name: "mcp-neovim-server",
	version: "0.6",
});

const neovimManager = NeovimManager.getInstance();

// Register resources
server.resource(
	"session",
	new ResourceTemplate("nvim://session", {
		list: () => ({
			resources: [
				{
					uri: "nvim://session",
					mimeType: "text/plain",
					name: "Current neovim session",
					description: "Current neovim text editor session",
				},
			],
		}),
	}),
	async (uri: URL) => {
		const bufferContents = await neovimManager.getBufferContents();
		return {
			contents: [
				{
					uri: uri.href,
					mimeType: "text/plain",
					text: Array.from(bufferContents.entries())
						.map(([lineNum, lineText]) => `${lineNum}: ${lineText}`)
						.join("\n"),
				},
			],
		};
	},
);

server.resource(
	"buffers",
	new ResourceTemplate("nvim://buffers", {
		list: () => ({
			resources: [
				{
					uri: "nvim://buffers",
					mimeType: "application/json",
					name: "Open Neovim buffers",
					description: "List of all open buffers in the current Neovim session",
				},
			],
		}),
	}),
	async (uri: URL) => {
		const openBuffers = await neovimManager.getOpenBuffers();
		return {
			contents: [
				{
					uri: uri.href,
					mimeType: "application/json",
					text: JSON.stringify(openBuffers, null, 2),
				},
			],
		};
	},
);

// Enhanced resources from claude-code.nvim
server.resource(
	"project-structure",
	new ResourceTemplate("nvim://project-structure", {
		list: () => ({
			resources: [
				{
					uri: "nvim://project-structure",
					mimeType: "text/plain",
					name: "Project structure",
					description: "File tree of the current working directory",
				},
			],
		}),
	}),
	async (uri: URL) => {
		const projectStructure = await neovimManager.getProjectStructure();
		return {
			contents: [
				{
					uri: uri.href,
					mimeType: "text/plain",
					text: projectStructure,
				},
			],
		};
	},
);

server.resource(
	"git-status",
	new ResourceTemplate("nvim://git-status", {
		list: () => ({
			resources: [
				{
					uri: "nvim://git-status",
					mimeType: "text/plain",
					name: "Git status",
					description: "Current git repository status",
				},
			],
		}),
	}),
	async (uri: URL) => {
		const gitStatus = await neovimManager.getGitStatus();
		return {
			contents: [
				{
					uri: uri.href,
					mimeType: "text/plain",
					text: gitStatus,
				},
			],
		};
	},
);

server.resource(
	"lsp-diagnostics",
	new ResourceTemplate("nvim://lsp-diagnostics", {
		list: () => ({
			resources: [
				{
					uri: "nvim://lsp-diagnostics",
					mimeType: "application/json",
					name: "LSP diagnostics",
					description: "Current LSP diagnostics for all buffers",
				},
			],
		}),
	}),
	async (uri: URL) => {
		const diagnostics = await neovimManager.getLspDiagnostics();
		return {
			contents: [
				{
					uri: uri.href,
					mimeType: "application/json",
					text: diagnostics,
				},
			],
		};
	},
);

server.resource(
	"vim-options",
	new ResourceTemplate("nvim://vim-options", {
		list: () => ({
			resources: [
				{
					uri: "nvim://vim-options",
					mimeType: "application/json",
					name: "Vim options",
					description: "Current Neovim configuration and options",
				},
			],
		}),
	}),
	async (uri: URL) => {
		const options = await neovimManager.getVimOptions();
		return {
			contents: [
				{
					uri: uri.href,
					mimeType: "application/json",
					text: options,
				},
			],
		};
	},
);

server.resource(
	"related-files",
	new ResourceTemplate("nvim://related-files", {
		list: () => ({
			resources: [
				{
					uri: "nvim://related-files",
					mimeType: "application/json",
					name: "Related files",
					description:
						"Files related to current buffer through imports/requires",
				},
			],
		}),
	}),
	async (uri: URL) => {
		const relatedFiles = await neovimManager.getRelatedFiles();
		return {
			contents: [
				{
					uri: uri.href,
					mimeType: "application/json",
					text: relatedFiles,
				},
			],
		};
	},
);

server.resource(
	"recent-files",
	new ResourceTemplate("nvim://recent-files", {
		list: () => ({
			resources: [
				{
					uri: "nvim://recent-files",
					mimeType: "application/json",
					name: "Recent files",
					description: "Recently accessed files in current project",
				},
			],
		}),
	}),
	async (uri: URL) => {
		const recentFiles = await neovimManager.getRecentFiles();
		return {
			contents: [
				{
					uri: uri.href,
					mimeType: "application/json",
					text: recentFiles,
				},
			],
		};
	},
);

server.resource(
	"visual-selection",
	new ResourceTemplate("nvim://visual-selection", {
		list: () => ({
			resources: [
				{
					uri: "nvim://visual-selection",
					mimeType: "application/json",
					name: "Visual selection",
					description: "Currently selected text or last visual selection",
				},
			],
		}),
	}),
	async (uri: URL) => {
		const selection = await neovimManager.getCurrentSelection(true);
		return {
			contents: [
				{
					uri: uri.href,
					mimeType: "application/json",
					text: selection,
				},
			],
		};
	},
);

server.resource(
	"workspace-context",
	new ResourceTemplate("nvim://workspace-context", {
		list: () => ({
			resources: [
				{
					uri: "nvim://workspace-context",
					mimeType: "application/json",
					name: "Workspace context",
					description:
						"Enhanced workspace context with all related information",
				},
			],
		}),
	}),
	async (uri: URL) => {
		const context = await neovimManager.getWorkspaceContext();
		return {
			contents: [
				{
					uri: uri.href,
					mimeType: "application/json",
					text: context,
				},
			],
		};
	},
);

server.resource(
	"search-results",
	new ResourceTemplate("nvim://search-results", {
		list: () => ({
			resources: [
				{
					uri: "nvim://search-results",
					mimeType: "application/json",
					name: "Search results",
					description: "Current search results and quickfix list",
				},
			],
		}),
	}),
	async (uri: URL) => {
		const results = await neovimManager.getSearchResults();
		return {
			contents: [
				{
					uri: uri.href,
					mimeType: "application/json",
					text: results,
				},
			],
		};
	},
);

// Register resource-based tools
server.tool(
	"vim_get_session",
	"Get current Neovim session details including buffer contents",
	{},
	async () => {
		try {
			const bufferContents = await neovimManager.getBufferContents();
			return {
				content: [
					{
						type: "text",
						text: Array.from(bufferContents.entries())
							.map(([lineNum, lineText]) => `${lineNum}: ${lineText}`)
							.join("\n"),
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text:
							error instanceof Error ? error.message : "Error getting session",
					},
				],
			};
		}
	},
);

server.tool(
	"vim_get_buffers",
	"Get a list of all open buffers in the current Neovim session",
	{},
	async () => {
		try {
			const openBuffers = await neovimManager.getOpenBuffers();
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(openBuffers, null, 2),
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text:
							error instanceof Error ? error.message : "Error getting buffers",
					},
				],
			};
		}
	},
);

server.tool(
	"vim_get_project_structure",
	"Get the file tree of the current working directory",
	{},
	async () => {
		try {
			const projectStructure = await neovimManager.getProjectStructure();
			return {
				content: [
					{
						type: "text",
						text: projectStructure,
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text:
							error instanceof Error
								? error.message
								: "Error getting project structure",
					},
				],
			};
		}
	},
);

server.tool(
	"vim_get_git_status",
	"Get the current git repository status",
	{},
	async () => {
		try {
			const gitStatus = await neovimManager.getGitStatus();
			return {
				content: [
					{
						type: "text",
						text: gitStatus,
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text:
							error instanceof Error
								? error.message
								: "Error getting git status",
					},
				],
			};
		}
	},
);

server.tool(
	"vim_get_lsp_diagnostics",
	"Get current LSP diagnostics for all buffers",
	{},
	async () => {
		try {
			const diagnostics = await neovimManager.getLspDiagnostics();
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(diagnostics, null, 2),
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text:
							error instanceof Error
								? error.message
								: "Error getting LSP diagnostics",
					},
				],
			};
		}
	},
);

server.tool(
	"vim_get_vim_options",
	"Get current Neovim configuration and options",
	{},
	async () => {
		try {
			const options = await neovimManager.getVimOptions();
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(options, null, 2),
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text:
							error instanceof Error
								? error.message
								: "Error getting Vim options",
					},
				],
			};
		}
	},
);

server.tool(
	"vim_get_related_files",
	"Get files related to current buffer through imports/requires",
	{},
	async () => {
		try {
			const relatedFiles = await neovimManager.getRelatedFiles();
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(relatedFiles, null, 2),
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text:
							error instanceof Error
								? error.message
								: "Error getting related files",
					},
				],
			};
		}
	},
);

server.tool(
	"vim_get_recent_files",
	"Get recently accessed files in current project",
	{},
	async () => {
		try {
			const recentFiles = await neovimManager.getRecentFiles();
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(recentFiles, null, 2),
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text:
							error instanceof Error
								? error.message
								: "Error getting recent files",
					},
				],
			};
		}
	},
);

server.tool(
	"vim_get_visual_selection",
	"Get currently selected text or last visual selection",
	{},
	async () => {
		try {
			const selection = await neovimManager.getCurrentSelection(true);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(selection, null, 2),
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text:
							error instanceof Error
								? error.message
								: "Error getting visual selection",
					},
				],
			};
		}
	},
);

server.tool(
	"vim_get_workspace_context",
	"Get enhanced workspace context with all related information",
	{},
	async () => {
		try {
			const context = await neovimManager.getWorkspaceContext();
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(context, null, 2),
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text:
							error instanceof Error
								? error.message
								: "Error getting workspace context",
					},
				],
			};
		}
	},
);

server.tool(
	"vim_get_search_results",
	"Get current search results and quickfix list",
	{},
	async () => {
		try {
			const results = await neovimManager.getSearchResults();
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(results, null, 2),
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text:
							error instanceof Error
								? error.message
								: "Error getting search results",
					},
				],
			};
		}
	},
);

// Register tools with proper parameter schemas
server.tool(
	"vim_buffer",
	"Get buffer contents with line numbers",
	{
		filename: z
			.string()
			.optional()
			.describe("Optional file name to view a specific buffer"),
	},
	async ({ filename }) => {
		try {
			const bufferContents = await neovimManager.getBufferContents(filename);
			return {
				content: [
					{
						type: "text",
						text: Array.from(bufferContents.entries())
							.map(([lineNum, lineText]) => `${lineNum}: ${lineText}`)
							.join("\n"),
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text:
							error instanceof Error
								? error.message
								: "Error getting buffer contents",
					},
				],
			};
		}
	},
);

server.tool(
	"vim_command",
	"Execute Vim commands with optional shell command support",
	{
		command: z
			.string()
			.describe(
				"Vim command to execute (use ! prefix for shell commands if enabled)",
			),
	},
	async ({ command }) => {
		try {
			// Check if this is a shell command
			if (command.startsWith("!")) {
				const allowShellCommands = process.env.ALLOW_SHELL_COMMANDS === "true";
				if (!allowShellCommands) {
					return {
						content: [
							{
								type: "text",
								text: "Shell command execution is disabled. Set ALLOW_SHELL_COMMANDS=true environment variable to enable shell commands.",
							},
						],
					};
				}
			}

			const result = await neovimManager.sendCommand(command);
			return {
				content: [
					{
						type: "text",
						text: result,
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text:
							error instanceof Error
								? error.message
								: "Error executing command",
					},
				],
			};
		}
	},
);

server.tool(
	"vim_status",
	"Get comprehensive Neovim status including cursor position, mode, marks, and registers",
	{},
	async (): Promise<any> => {
		try {
			const status = await neovimManager.getNeovimStatus();
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(status, null, 2),
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text:
							error instanceof Error
								? error.message
								: "Error getting Neovim status",
					},
				],
			};
		}
	},
);

server.tool(
	"vim_edit",
	"Edit buffer content using insert, replace, or replaceAll modes",
	{
		startLine: z
			.number()
			.describe("The line number where editing should begin (1-indexed)"),
		mode: z
			.enum(["insert", "replace", "replaceAll"])
			.describe(
				"Whether to insert new content, replace existing content, or replace entire buffer",
			),
		lines: z
			.string()
			.describe("The text content to insert or use as replacement"),
	},
	async ({ startLine, mode, lines }) => {
		try {
			const result = await neovimManager.editLines(startLine, mode, lines);
			return {
				content: [
					{
						type: "text",
						text: result,
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text:
							error instanceof Error ? error.message : "Error editing buffer",
					},
				],
			};
		}
	},
);

server.tool(
	"vim_window",
	"Manage Neovim windows: split, close, and navigate between windows",
	{
		command: z
			.enum([
				"split",
				"vsplit",
				"only",
				"close",
				"wincmd h",
				"wincmd j",
				"wincmd k",
				"wincmd l",
			])
			.describe(
				"Window manipulation command: split or vsplit to create new window, only to keep just current window, close to close current window, or wincmd with h/j/k/l to navigate between windows",
			),
	},
	async ({ command }) => {
		try {
			const result = await neovimManager.manipulateWindow(command);
			return {
				content: [
					{
						type: "text",
						text: result,
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text:
							error instanceof Error
								? error.message
								: "Error manipulating window",
					},
				],
			};
		}
	},
);

server.tool(
	"vim_mark",
	"Set named marks at specific positions in the buffer",
	{
		mark: z
			.string()
			.regex(/^[a-z]$/)
			.describe("Single lowercase letter [a-z] to use as the mark name"),
		line: z
			.number()
			.describe("The line number where the mark should be placed (1-indexed)"),
		column: z
			.number()
			.describe(
				"The column number where the mark should be placed (0-indexed)",
			),
	},
	async ({ mark, line, column }) => {
		try {
			const result = await neovimManager.setMark(mark, line, column);
			return {
				content: [
					{
						type: "text",
						text: result,
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: error instanceof Error ? error.message : "Error setting mark",
					},
				],
			};
		}
	},
);

server.tool(
	"vim_register",
	"Manage Neovim register contents",
	{
		register: z
			.string()
			.regex(/^[a-z\"]$/)
			.describe(
				'Register name - a lowercase letter [a-z] or double-quote ["] for the unnamed register',
			),
		content: z
			.string()
			.describe("The text content to store in the specified register"),
	},
	async ({ register, content }) => {
		try {
			const result = await neovimManager.setRegister(register, content);
			return {
				content: [
					{
						type: "text",
						text: result,
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text:
							error instanceof Error ? error.message : "Error setting register",
					},
				],
			};
		}
	},
);

server.tool(
	"vim_visual",
	"Create visual mode selections in the buffer",
	{
		startLine: z
			.number()
			.describe("The starting line number for visual selection (1-indexed)"),
		startColumn: z
			.number()
			.describe("The starting column number for visual selection (0-indexed)"),
		endLine: z
			.number()
			.describe("The ending line number for visual selection (1-indexed)"),
		endColumn: z
			.number()
			.describe("The ending column number for visual selection (0-indexed)"),
	},
	async ({ startLine, startColumn, endLine, endColumn }) => {
		try {
			const result = await neovimManager.visualSelect(
				startLine,
				startColumn,
				endLine,
				endColumn,
			);
			return {
				content: [
					{
						type: "text",
						text: result,
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text:
							error instanceof Error
								? error.message
								: "Error creating visual selection",
					},
				],
			};
		}
	},
);

// New enhanced buffer management tools
server.tool(
	"vim_buffer_switch",
	"Switch between buffers by name or number",
	{
		identifier: z
			.union([z.string(), z.number()])
			.describe("Buffer identifier - can be buffer number or filename/path"),
	},
	async ({ identifier }) => {
		try {
			const result = await neovimManager.switchBuffer(identifier);
			return {
				content: [
					{
						type: "text",
						text: result,
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text:
							error instanceof Error ? error.message : "Error switching buffer",
					},
				],
			};
		}
	},
);

server.tool(
	"vim_buffer_save",
	"Save current buffer or save to specific filename",
	{
		filename: z
			.string()
			.optional()
			.describe(
				"Optional filename to save buffer to (defaults to current buffer's filename)",
			),
	},
	async ({ filename }) => {
		try {
			const result = await neovimManager.saveBuffer(filename);
			return {
				content: [
					{
						type: "text",
						text: result,
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text:
							error instanceof Error ? error.message : "Error saving buffer",
					},
				],
			};
		}
	},
);

server.tool(
	"vim_file_open",
	"Open files into new buffers",
	{
		filename: z.string().describe("Path to the file to open"),
	},
	async ({ filename }) => {
		try {
			const result = await neovimManager.openFile(filename);
			return {
				content: [
					{
						type: "text",
						text: result,
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: error instanceof Error ? error.message : "Error opening file",
					},
				],
			};
		}
	},
);

// New search and replace tools
server.tool(
	"vim_search",
	"Search within current buffer with regex support and options",
	{
		pattern: z.string().describe("Search pattern (supports regex)"),
		ignoreCase: z
			.boolean()
			.optional()
			.describe("Whether to ignore case in search (default: false)"),
		wholeWord: z
			.boolean()
			.optional()
			.describe("Whether to match whole words only (default: false)"),
	},
	async ({ pattern, ignoreCase = false, wholeWord = false }) => {
		try {
			const result = await neovimManager.searchInBuffer(pattern, {
				ignoreCase,
				wholeWord,
			});
			return {
				content: [
					{
						type: "text",
						text: result,
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text:
							error instanceof Error
								? error.message
								: "Error searching in buffer",
					},
				],
			};
		}
	},
);

server.tool(
	"vim_search_replace",
	"Find and replace with global, case-insensitive, and confirm options",
	{
		pattern: z.string().describe("Search pattern (supports regex)"),
		replacement: z.string().describe("Replacement text"),
		global: z
			.boolean()
			.optional()
			.describe("Replace all occurrences in each line (default: false)"),
		ignoreCase: z
			.boolean()
			.optional()
			.describe("Whether to ignore case in search (default: false)"),
		confirm: z
			.boolean()
			.optional()
			.describe("Whether to confirm each replacement (default: false)"),
	},
	async ({
		pattern,
		replacement,
		global = false,
		ignoreCase = false,
		confirm = false,
	}) => {
		try {
			const result = await neovimManager.searchAndReplace(
				pattern,
				replacement,
				{ global, ignoreCase, confirm },
			);
			return {
				content: [
					{
						type: "text",
						text: result,
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text:
							error instanceof Error
								? error.message
								: "Error in search and replace",
					},
				],
			};
		}
	},
);

server.tool(
	"vim_grep",
	"Project-wide search using vimgrep with quickfix list",
	{
		pattern: z.string().describe("Search pattern to grep for"),
		filePattern: z
			.string()
			.optional()
			.describe("File pattern to search in (default: **/* for all files)"),
	},
	async ({ pattern, filePattern = "**/*" }) => {
		try {
			const result = await neovimManager.grepInProject(pattern, filePattern);
			return {
				content: [
					{
						type: "text",
						text: result,
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text:
							error instanceof Error ? error.message : "Error in grep search",
					},
				],
			};
		}
	},
);

// Health check tool
server.tool("vim_health", "Check Neovim connection health", {}, async () => {
	const isHealthy = await neovimManager.healthCheck();
	return {
		content: [
			{
				type: "text",
				text: isHealthy
					? "Neovim connection is healthy"
					: "Neovim connection failed",
			},
		],
	};
});

// Macro management tool
server.tool(
	"vim_macro",
	"Record, stop, and play Neovim macros",
	{
		action: z
			.enum(["record", "stop", "play"])
			.describe("Action to perform with macros"),
		register: z
			.string()
			.optional()
			.describe(
				"Register to record/play macro (a-z, required for record/play)",
			),
		count: z
			.number()
			.optional()
			.describe("Number of times to play macro (default: 1)"),
	},
	async ({ action, register, count = 1 }) => {
		try {
			const result = await neovimManager.manageMacro(action, register, count);
			return {
				content: [
					{
						type: "text",
						text: result,
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text:
							error instanceof Error ? error.message : "Error managing macro",
					},
				],
			};
		}
	},
);

// Tab management tool
server.tool(
	"vim_tab",
	"Manage Neovim tabs: create, close, and navigate between tabs",
	{
		action: z
			.enum(["new", "close", "next", "prev", "first", "last", "list"])
			.describe("Tab action to perform"),
		filename: z.string().optional().describe("Filename for new tab (optional)"),
	},
	async ({ action, filename }) => {
		try {
			const result = await neovimManager.manageTab(action, filename);
			return {
				content: [
					{
						type: "text",
						text: result,
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: error instanceof Error ? error.message : "Error managing tab",
					},
				],
			};
		}
	},
);

// Code folding tool
server.tool(
	"vim_fold",
	"Manage code folding: create, open, close, and toggle folds",
	{
		action: z
			.enum([
				"create",
				"open",
				"close",
				"toggle",
				"openall",
				"closeall",
				"delete",
			])
			.describe("Folding action to perform"),
		startLine: z
			.number()
			.optional()
			.describe("Start line for creating fold (required for create)"),
		endLine: z
			.number()
			.optional()
			.describe("End line for creating fold (required for create)"),
	},
	async ({ action, startLine, endLine }) => {
		try {
			const result = await neovimManager.manageFold(action, startLine, endLine);
			return {
				content: [
					{
						type: "text",
						text: result,
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text:
							error instanceof Error ? error.message : "Error managing fold",
					},
				],
			};
		}
	},
);

// Jump list navigation tool
server.tool(
	"vim_jump",
	"Navigate Neovim jump list: go back, forward, or list jumps",
	{
		direction: z
			.enum(["back", "forward", "list"])
			.describe("Jump direction or list jumps"),
	},
	async ({ direction }) => {
		try {
			const result = await neovimManager.navigateJumpList(direction);
			return {
				content: [
					{
						type: "text",
						text: result,
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text:
							error instanceof Error
								? error.message
								: "Error navigating jump list",
					},
				],
			};
		}
	},
);

// Enhanced tools from claude-code.nvim
server.tool(
	"vim_analyze_related",
	"Analyze files related through imports/requires in the current or specified buffer",
	{
		filename: z
			.string()
			.optional()
			.describe("Optional filename to analyze (defaults to current buffer)"),
	},
	async ({ filename }) => {
		try {
			const result = await neovimManager.analyzeRelatedFiles(filename);
			return {
				content: [
					{
						type: "text",
						text: result,
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text:
							error instanceof Error
								? error.message
								: "Error analyzing related files",
					},
				],
			};
		}
	},
);

server.tool(
	"vim_find_symbols",
	"Find workspace symbols using LSP",
	{
		query: z
			.string()
			.optional()
			.describe("Symbol name to search for (empty for all symbols)"),
		limit: z
			.number()
			.optional()
			.describe("Maximum number of symbols to return (default: 20)"),
	},
	async ({ query, limit }) => {
		try {
			const result = await neovimManager.findWorkspaceSymbols(query, limit);
			return {
				content: [
					{
						type: "text",
						text: result,
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text:
							error instanceof Error
								? error.message
								: "Error finding workspace symbols",
					},
				],
			};
		}
	},
);

server.tool(
	"vim_search_files",
	"Search for files in the current project by pattern",
	{
		pattern: z.string().describe("File name pattern to search for"),
		includeContent: z
			.boolean()
			.optional()
			.describe("Whether to include file content preview (default: false)"),
	},
	async ({ pattern, includeContent }) => {
		try {
			const result = await neovimManager.searchProjectFiles(
				pattern,
				includeContent,
			);
			return {
				content: [
					{
						type: "text",
						text: result,
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text:
							error instanceof Error
								? error.message
								: "Error searching project files",
					},
				],
			};
		}
	},
);

server.tool(
	"vim_get_selection",
	"Get the currently selected text or last visual selection from Neovim",
	{
		includeContext: z
			.boolean()
			.optional()
			.describe(
				"Include surrounding context (5 lines before/after) (default: false)",
			),
	},
	async ({ includeContext }) => {
		try {
			const result = await neovimManager.getCurrentSelection(includeContext);
			return {
				content: [
					{
						type: "text",
						text: result,
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text:
							error instanceof Error
								? error.message
								: "Error getting selection",
					},
				],
			};
		}
	},
);

// Register a sample prompt for Neovim workflow assistance
server.prompt(
	"neovim_workflow",
	"Get help with common Neovim workflows and editing tasks",
	{
		task: z
			.enum(["editing", "navigation", "search", "buffers", "windows", "macros"])
			.describe("Type of Neovim task you need help with"),
	},
	async ({ task }) => {
		const workflows = {
			editing:
				"Here are common editing workflows:\n1. Use vim_edit with 'insert' mode to add new content\n2. Use vim_edit with 'replace' mode to modify existing lines\n3. Use vim_search_replace for find and replace operations\n4. Use vim_visual to select text ranges before operations",
			navigation:
				"Navigation workflows:\n1. Use vim_mark to set bookmarks in your code\n2. Use vim_jump to navigate through your jump history\n3. Use vim_command with 'gg' or 'G' to go to start/end of file\n4. Use vim_command with line numbers like ':42' to jump to specific lines",
			search:
				"Search workflows:\n1. Use vim_search to find patterns in current buffer\n2. Use vim_grep for project-wide searches\n3. Use vim_search_replace for complex find/replace operations\n4. Use regex patterns for advanced matching",
			buffers:
				"Buffer management:\n1. Use vim_buffer to view buffer contents\n2. Use vim_buffer_switch to change between buffers\n3. Use vim_file_open to open new files\n4. Use vim_buffer_save to save your work",
			windows:
				"Window management:\n1. Use vim_window with 'split'/'vsplit' to create new windows\n2. Use vim_window with 'wincmd h/j/k/l' to navigate between windows\n3. Use vim_window with 'close' to close current window\n4. Use vim_window with 'only' to keep only current window",
			macros:
				"Macro workflows:\n1. Use vim_macro with 'record' and a register to start recording\n2. Perform your actions in Neovim\n3. Use vim_macro with 'stop' to end recording\n4. Use vim_macro with 'play' to execute recorded actions",
		};

		return {
			messages: [
				{
					role: "assistant",
					content: {
						type: "text",
						text:
							workflows[task] ||
							"Unknown task type. Available tasks: editing, navigation, search, buffers, windows, macros",
					},
				},
			],
		};
	},
);

/**
 * Start the server using stdio transport.
 * This allows the server to communicate via standard input/output streams.
 */
async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
}

main().catch((error) => {
	console.error("Server error:", error);
	process.exit(1);
});
