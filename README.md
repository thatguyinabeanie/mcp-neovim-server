# Neovim MCP Server (Enhanced Fork)

Connect Claude Desktop (or any Model Context Protocol client) to Neovim using MCP and the official neovim/node-client JavaScript library. This enhanced fork leverages Vim's native text editing commands and workflows, which Claude already understands, to create a powerful code assistance layer with additional tools and resources.

**Version 0.6.0** - Enhanced fork with additional tools and resources!

> This is an enhanced fork of [bigcodegen/mcp-neovim-server](https://github.com/bigcodegen/mcp-neovim-server) with additional features and improvements.

<a href="https://glama.ai/mcp/servers/s0fywdwp87"><img width="380" height="200" src="https://glama.ai/mcp/servers/s0fywdwp87/badge" alt="mcp-neovim-server MCP server" /></a>

## Features

- Connects to your nvim instance if you expose a socket file, for example `--listen /tmp/nvim`, when starting nvim
- Views your current buffers and manages buffer switching
- Gets cursor location, mode, file name, marks, registers, and visual selections
- Runs vim commands and optionally shell commands through vim
- Can make edits using insert, replace, or replaceAll modes
- Search and replace functionality with regex support
- Project-wide grep search with quickfix integration
- Comprehensive window management
- Health monitoring and connection diagnostics

## API

### Resources

- `nvim://session`: Current neovim text editor session
- `nvim://buffers`: List of all open buffers in the current Neovim session with metadata including modified status, syntax, and window IDs
- `nvim://project-structure`: File tree of the current working directory
- `nvim://git-status`: Current git repository status
- `nvim://lsp-diagnostics`: Current LSP diagnostics for all buffers
- `nvim://vim-options`: Current Neovim configuration and options
- `nvim://related-files`: Files related to current buffer through imports/requires
- `nvim://recent-files`: Recently accessed files in current project
- `nvim://visual-selection`: Currently selected text or last visual selection
- `nvim://workspace-context`: Enhanced workspace context with all related information
- `nvim://search-results`: Current search results and quickfix list

### Tools

#### Core Tools
- **vim_buffer**
  - Get buffer contents with line numbers (supports filename parameter)
  - Input `filename` (string, optional) - Get specific buffer by filename
  - Returns numbered lines with buffer content
- **vim_command**
  - Send a command to VIM for navigation, spot editing, and line deletion
  - Input `command` (string)
  - Runs vim commands with `nvim.replaceTermcodes`. Multiple commands work with newlines
  - Shell commands supported with `!` prefix when `ALLOW_SHELL_COMMANDS=true`
  - On error, `'nvim:errmsg'` contents are returned 
- **vim_status**
  - Get comprehensive Neovim status
  - Returns cursor position, mode, filename, visual selection, window layout, current tab, marks, registers, working directory, LSP client info, and plugin detection
- **vim_edit**
  - Edit lines using insert, replace, or replaceAll modes
  - Input `startLine` (number), `mode` (`"insert"` | `"replace"` | `"replaceAll"`), `lines` (string)
  - insert: insert lines at startLine
  - replace: replace lines starting at startLine
  - replaceAll: replace entire buffer contents
- **vim_window**
  - Manipulate Neovim windows (split, vsplit, close, navigate)
  - Input `command` (string: "split", "vsplit", "only", "close", "wincmd h/j/k/l")
- **vim_mark**
  - Set named marks at specific positions
  - Input `mark` (string: a-z), `line` (number), `column` (number)
- **vim_register**
  - Set content of registers
  - Input `register` (string: a-z or "), `content` (string)
- **vim_visual**
  - Create visual mode selections
  - Input `startLine` (number), `startColumn` (number), `endLine` (number), `endColumn` (number)

#### Enhanced Buffer Management
- **vim_buffer_switch**
  - Switch between buffers by name or number
  - Input `identifier` (string | number) - Buffer name or number
- **vim_buffer_save**
  - Save current buffer or save to specific filename
  - Input `filename` (string, optional) - Save to specific file
- **vim_file_open**
  - Open files into new buffers
  - Input `filename` (string) - File to open

#### Search and Replace
- **vim_search**
  - Search within current buffer with regex support
  - Input `pattern` (string), `ignoreCase` (boolean, optional), `wholeWord` (boolean, optional)
- **vim_search_replace**
  - Find and replace with advanced options
  - Input `pattern` (string), `replacement` (string), `global` (boolean, optional), `ignoreCase` (boolean, optional), `confirm` (boolean, optional)
- **vim_grep**
  - Project-wide search using vimgrep with quickfix list
  - Input `pattern` (string), `filePattern` (string, optional) - File pattern to search

#### Advanced Workflow Tools
- **vim_macro**
  - Record, stop, and play Vim macros
  - Input `action` ("record" | "stop" | "play"), `register` (string, a-z), `count` (number, optional)
- **vim_tab**
  - Complete tab management
  - Input `action` ("new" | "close" | "next" | "prev" | "first" | "last" | "list"), `filename` (string, optional)
- **vim_fold**
  - Code folding operations
  - Input `action` ("create" | "open" | "close" | "toggle" | "openall" | "closeall" | "delete"), `startLine`/`endLine` (numbers, for create)
- **vim_jump**
  - Jump list navigation
  - Input `direction` ("back" | "forward" | "list")

#### System Tools
- **vim_health**
  - Check Neovim connection health and socket status

#### Enhanced Tools (Fork-specific)
- **vim_analyze_related**
  - Analyze files related through imports/requires in the current or specified buffer
  - Input `filename` (string, optional) - Optional filename to analyze
- **vim_find_symbols**
  - Find workspace symbols using LSP
  - Input `query` (string, optional), `limit` (number, optional) - Symbol search with optional filtering
- **vim_search_files**
  - Search for files in the current project by pattern
  - Input `pattern` (string), `includeContent` (boolean, optional) - File search with content preview
- **vim_get_selection**
  - Get the currently selected text or last visual selection
  - Input `includeContext` (boolean, optional) - Include surrounding context lines

#### Resource-based Tools
- **vim_get_session** - Get current Neovim session details
- **vim_get_buffers** - Get list of all open buffers
- **vim_get_project_structure** - Get file tree of working directory
- **vim_get_git_status** - Get current git repository status
- **vim_get_lsp_diagnostics** - Get current LSP diagnostics
- **vim_get_vim_options** - Get Neovim configuration and options
- **vim_get_related_files** - Get files related through imports
- **vim_get_recent_files** - Get recently accessed project files
- **vim_get_visual_selection** - Get current or last visual selection
- **vim_get_workspace_context** - Get enhanced workspace context
- **vim_get_search_results** - Get current search results and quickfix list

Using this comprehensive set of **19+ tools**, Claude can peer into your neovim session, navigate buffers, perform searches, make edits, record macros, manage tabs and folds, and handle your complete development workflow with standard Neovim features. This enhanced fork includes additional tools for project analysis, workspace context, and LSP integration.

### Prompts

- **neovim_workflow**: Get contextual help and guidance for common Neovim workflows including editing, navigation, search, buffer management, window operations, and macro usage. Provides step-by-step instructions for accomplishing tasks with the available MCP tools.

## Error Handling

The server implements comprehensive error handling with custom error classes and consistent error responses:

- **NeovimConnectionError**: Socket connection failures with detailed messages
- **NeovimCommandError**: Command execution failures with command context  
- **NeovimValidationError**: Input validation failures

**New in v0.6.0**: This enhanced fork includes additional resources and tools for better project integration, LSP diagnostics, workspace context analysis, and improved development workflow support.

## Limitations

- May not interact well with complex neovim configurations or plugins
- Shell command execution is disabled by default for security
- Socket connection required - won't work with standard vim

## Configuration

### Environment Variables

- `ALLOW_SHELL_COMMANDS`: Set to 'true' to enable shell command execution (e.g. `!ls`). Defaults to false for security.
- `NVIM_SOCKET_PATH`: Set to the path of your Neovim socket. Defaults to '/tmp/nvim' if not specified.

## Installation

### Option 1: DXT Package (Recommended)
1. Download the latest `.dxt` file from [Releases](https://github.com/thatguyinabeanie/mcp-neovim-server/releases)
2. Drag the file to Claude Desktop

### Option 2: Manual Installation
Add this to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "MCP Neovim Server": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-neovim-server"
      ],
      "env": {
        "ALLOW_SHELL_COMMANDS": "true",
        "NVIM_SOCKET_PATH": "/tmp/nvim"
      }
    }
  }
}
```

## License

This MCP server is licensed under the MIT License. This means you are free to use, modify, and distribute the software, subject to the terms and conditions of the MIT License. For more details, please see the LICENSE file in the project repository.
