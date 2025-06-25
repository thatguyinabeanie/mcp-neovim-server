import { attach } from 'neovim';
export class NeovimConnectionError extends Error {
    constructor(socketPath, cause) {
        super(`Failed to connect to Neovim at ${socketPath}. Is Neovim running with --listen ${socketPath}?`);
        this.name = 'NeovimConnectionError';
        this.cause = cause;
    }
}
export class NeovimCommandError extends Error {
    constructor(command, originalError) {
        super(`Failed to execute command '${command}': ${originalError}`);
        this.name = 'NeovimCommandError';
    }
}
export class NeovimValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'NeovimValidationError';
    }
}
export class NeovimManager {
    static instance;
    constructor() { }
    static getInstance() {
        if (!NeovimManager.instance) {
            NeovimManager.instance = new NeovimManager();
        }
        return NeovimManager.instance;
    }
    async healthCheck() {
        try {
            const nvim = await this.connect();
            await nvim.eval('1'); // Simple test
            return true;
        }
        catch {
            return false;
        }
    }
    validateSocketPath(path) {
        if (!path || path.trim().length === 0) {
            throw new NeovimValidationError('Socket path cannot be empty');
        }
    }
    async connect() {
        const socketPath = process.env.NVIM_SOCKET_PATH || '/tmp/nvim';
        this.validateSocketPath(socketPath);
        try {
            return attach({
                socket: socketPath
            });
        }
        catch (error) {
            console.error('Error connecting to Neovim:', error);
            throw new NeovimConnectionError(socketPath, error);
        }
    }
    async getBufferContents(filename) {
        try {
            const nvim = await this.connect();
            let buffer;
            if (filename) {
                // Find buffer by filename
                const buffers = await nvim.buffers;
                let targetBuffer = null;
                for (const buf of buffers) {
                    const bufName = await buf.name;
                    if (bufName === filename || bufName.endsWith(filename)) {
                        targetBuffer = buf;
                        break;
                    }
                }
                if (!targetBuffer) {
                    throw new NeovimValidationError(`Buffer not found: ${filename}`);
                }
                buffer = targetBuffer;
            }
            else {
                buffer = await nvim.buffer;
            }
            const lines = await buffer.lines;
            const lineMap = new Map();
            lines.forEach((line, index) => {
                lineMap.set(index + 1, line);
            });
            return lineMap;
        }
        catch (error) {
            if (error instanceof NeovimValidationError) {
                throw error;
            }
            console.error('Error getting buffer contents:', error);
            return new Map();
        }
    }
    async sendCommand(command) {
        if (!command || command.trim().length === 0) {
            throw new NeovimValidationError('Command cannot be empty');
        }
        try {
            const nvim = await this.connect();
            // Remove leading colon if present
            const normalizedCommand = command.startsWith(':') ? command.substring(1) : command;
            // Handle shell commands (starting with !)
            if (normalizedCommand.startsWith('!')) {
                if (process.env.ALLOW_SHELL_COMMANDS !== 'true') {
                    return 'Shell command execution is disabled. Set ALLOW_SHELL_COMMANDS=true environment variable to enable shell commands.';
                }
                const shellCommand = normalizedCommand.substring(1).trim();
                if (!shellCommand) {
                    throw new NeovimValidationError('Shell command cannot be empty');
                }
                try {
                    // Execute the command and capture output directly
                    const output = await nvim.eval(`system('${shellCommand.replace(/'/g, "''")}')`);
                    if (output) {
                        return String(output).trim();
                    }
                    return 'No output from command';
                }
                catch (error) {
                    console.error('Shell command error:', error);
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                    throw new NeovimCommandError(`!${shellCommand}`, errorMessage);
                }
            }
            // For regular Vim commands
            await nvim.setVvar('errmsg', '');
            // Execute the command and capture its output using the execute() function
            const output = await nvim.call('execute', [normalizedCommand]);
            // Check for errors
            const vimerr = await nvim.getVvar('errmsg');
            if (vimerr) {
                console.error('Vim error:', vimerr);
                throw new NeovimCommandError(normalizedCommand, String(vimerr));
            }
            // Return the actual command output if any
            return output ? String(output).trim() : 'Command executed (no output)';
        }
        catch (error) {
            if (error instanceof NeovimCommandError || error instanceof NeovimValidationError) {
                throw error;
            }
            console.error('Error sending command:', error);
            throw new NeovimCommandError(command, error instanceof Error ? error.message : 'Unknown error');
        }
    }
    async getNeovimStatus() {
        try {
            const nvim = await this.connect();
            const window = await nvim.window;
            const cursor = await window.cursor;
            const mode = await nvim.mode;
            const buffer = await nvim.buffer;
            // Get window layout
            const layout = await nvim.eval('winlayout()');
            const tabpage = await nvim.tabpage;
            const currentTab = await tabpage.number;
            // Get marks (a-z)
            const marks = {};
            for (const mark of 'abcdefghijklmnopqrstuvwxyz') {
                try {
                    const pos = await nvim.eval(`getpos("'${mark}")`);
                    marks[mark] = [pos[1], pos[2]];
                }
                catch (e) {
                    // Mark not set
                }
            }
            // Get registers (a-z, ", 0-9)
            const registers = {};
            const registerNames = [...'abcdefghijklmnopqrstuvwxyz', '"', ...Array(10).keys()];
            for (const reg of registerNames) {
                try {
                    registers[reg] = String(await nvim.eval(`getreg('${reg}')`));
                }
                catch (e) {
                    // Register empty
                }
            }
            // Get current working directory
            const cwd = await nvim.call('getcwd');
            // Get basic plugin information (LSP clients, loaded plugins)
            let lspInfo = '';
            let pluginInfo = '';
            try {
                // Get LSP clients if available
                const lspClients = await nvim.eval('luaeval("vim.lsp.get_active_clients()")');
                if (Array.isArray(lspClients) && lspClients.length > 0) {
                    const clientNames = lspClients.map((client) => client.name || 'unknown').join(', ');
                    lspInfo = `Active LSP clients: ${clientNames}`;
                }
                else {
                    lspInfo = 'No active LSP clients';
                }
            }
            catch (e) {
                lspInfo = 'LSP information unavailable';
            }
            try {
                // Get loaded plugins (simplified check)
                const hasLsp = await nvim.eval('exists(":LspInfo")');
                const hasTelescope = await nvim.eval('exists(":Telescope")');
                const hasTreesitter = await nvim.eval('exists("g:loaded_nvim_treesitter")');
                const hasCompletion = await nvim.eval('exists("g:loaded_completion")');
                const plugins = [];
                if (hasLsp)
                    plugins.push('LSP');
                if (hasTelescope)
                    plugins.push('Telescope');
                if (hasTreesitter)
                    plugins.push('TreeSitter');
                if (hasCompletion)
                    plugins.push('Completion');
                pluginInfo = plugins.length > 0 ? `Detected plugins: ${plugins.join(', ')}` : 'No common plugins detected';
            }
            catch (e) {
                pluginInfo = 'Plugin information unavailable';
            }
            const neovimStatus = {
                cursorPosition: cursor,
                mode: mode.mode,
                visualSelection: '',
                fileName: await buffer.name,
                windowLayout: JSON.stringify(layout),
                currentTab,
                marks,
                registers,
                cwd,
                lspInfo,
                pluginInfo
            };
            if (mode.mode.startsWith('v')) {
                const start = await nvim.eval(`getpos("'<")`);
                const end = await nvim.eval(`getpos("'>")`);
                const lines = await buffer.getLines({
                    start: start[1] - 1,
                    end: end[1],
                    strictIndexing: true
                });
                neovimStatus.visualSelection = lines.join('\n');
            }
            return neovimStatus;
        }
        catch (error) {
            console.error('Error getting Neovim status:', error);
            return 'Error getting Neovim status';
        }
    }
    async editLines(startLine, mode, newText) {
        try {
            const nvim = await this.connect();
            const splitByLines = newText.split('\n');
            const buffer = await nvim.buffer;
            if (mode === 'replaceAll') {
                // Handle full buffer replacement
                const lineCount = await buffer.length;
                // Delete all lines and then append new content
                await buffer.remove(0, lineCount, true);
                await buffer.insert(splitByLines, 0);
                return 'Buffer completely replaced';
            }
            else if (mode === 'replace') {
                await buffer.replace(splitByLines, startLine - 1);
                return 'Lines replaced successfully';
            }
            else if (mode === 'insert') {
                await buffer.insert(splitByLines, startLine - 1);
                return 'Lines inserted successfully';
            }
            return 'Invalid mode specified';
        }
        catch (error) {
            console.error('Error editing lines:', error);
            return 'Error editing lines';
        }
    }
    async getWindows() {
        try {
            const nvim = await this.connect();
            const windows = await nvim.windows;
            const windowInfos = [];
            for (const win of windows) {
                const buffer = await win.buffer;
                const [width, height] = await Promise.all([
                    win.width,
                    win.height
                ]);
                const position = await win.position;
                windowInfos.push({
                    id: win.id,
                    bufferId: buffer.id,
                    width,
                    height,
                    row: position[0],
                    col: position[1]
                });
            }
            return windowInfos;
        }
        catch (error) {
            console.error('Error getting windows:', error);
            return [];
        }
    }
    async manipulateWindow(command) {
        const validCommands = ['split', 'vsplit', 'only', 'close', 'wincmd h', 'wincmd j', 'wincmd k', 'wincmd l'];
        if (!validCommands.some(cmd => command.startsWith(cmd))) {
            return 'Invalid window command';
        }
        try {
            const nvim = await this.connect();
            await nvim.command(command);
            return 'Window command executed';
        }
        catch (error) {
            console.error('Error manipulating window:', error);
            return 'Error executing window command';
        }
    }
    async setMark(mark, line, col) {
        if (!/^[a-z]$/.test(mark)) {
            return 'Invalid mark name (must be a-z)';
        }
        try {
            const nvim = await this.connect();
            await nvim.command(`mark ${mark}`);
            const window = await nvim.window;
            await (window.cursor = [line, col]);
            return `Mark ${mark} set at line ${line}, column ${col}`;
        }
        catch (error) {
            console.error('Error setting mark:', error);
            return 'Error setting mark';
        }
    }
    async setRegister(register, content) {
        const validRegisters = [...'abcdefghijklmnopqrstuvwxyz"'];
        if (!validRegisters.includes(register)) {
            return 'Invalid register name';
        }
        try {
            const nvim = await this.connect();
            await nvim.eval(`setreg('${register}', '${content.replace(/'/g, "''")}')`);
            return `Register ${register} set`;
        }
        catch (error) {
            console.error('Error setting register:', error);
            return 'Error setting register';
        }
    }
    async visualSelect(startLine, startCol, endLine, endCol) {
        try {
            const nvim = await this.connect();
            const window = await nvim.window;
            // Enter visual mode
            await nvim.command('normal! v');
            // Move cursor to start position
            await (window.cursor = [startLine, startCol]);
            // Move cursor to end position (selection will be made)
            await (window.cursor = [endLine, endCol]);
            return 'Visual selection made';
        }
        catch (error) {
            console.error('Error making visual selection:', error);
            return 'Error making visual selection';
        }
    }
    async switchBuffer(identifier) {
        try {
            const nvim = await this.connect();
            // If identifier is a number, switch by buffer number
            if (typeof identifier === 'number') {
                await nvim.command(`buffer ${identifier}`);
                return `Switched to buffer ${identifier}`;
            }
            // If identifier is a string, try to find buffer by name
            const buffers = await nvim.buffers;
            for (const buffer of buffers) {
                const bufName = await buffer.name;
                if (bufName === identifier || bufName.endsWith(identifier)) {
                    await nvim.command(`buffer ${buffer.id}`);
                    return `Switched to buffer: ${bufName}`;
                }
            }
            throw new NeovimValidationError(`Buffer not found: ${identifier}`);
        }
        catch (error) {
            if (error instanceof NeovimValidationError) {
                throw error;
            }
            console.error('Error switching buffer:', error);
            throw new NeovimCommandError(`buffer switch to ${identifier}`, error instanceof Error ? error.message : 'Unknown error');
        }
    }
    async saveBuffer(filename) {
        try {
            const nvim = await this.connect();
            if (filename) {
                // Save with specific filename
                await nvim.command(`write ${filename}`);
                return `Buffer saved to: ${filename}`;
            }
            else {
                // Save current buffer
                const buffer = await nvim.buffer;
                const bufferName = await buffer.name;
                if (!bufferName) {
                    throw new NeovimValidationError('Cannot save unnamed buffer without specifying filename');
                }
                await nvim.command('write');
                return `Buffer saved: ${bufferName}`;
            }
        }
        catch (error) {
            if (error instanceof NeovimValidationError) {
                throw error;
            }
            console.error('Error saving buffer:', error);
            throw new NeovimCommandError(`save ${filename || 'current buffer'}`, error instanceof Error ? error.message : 'Unknown error');
        }
    }
    async openFile(filename) {
        if (!filename || filename.trim().length === 0) {
            throw new NeovimValidationError('Filename cannot be empty');
        }
        try {
            const nvim = await this.connect();
            await nvim.command(`edit ${filename}`);
            return `Opened file: ${filename}`;
        }
        catch (error) {
            console.error('Error opening file:', error);
            throw new NeovimCommandError(`edit ${filename}`, error instanceof Error ? error.message : 'Unknown error');
        }
    }
    async searchInBuffer(pattern, options = {}) {
        if (!pattern || pattern.trim().length === 0) {
            throw new NeovimValidationError('Search pattern cannot be empty');
        }
        try {
            const nvim = await this.connect();
            // Build search command with options
            let searchPattern = pattern;
            if (options.wholeWord) {
                searchPattern = `\\<${pattern}\\>`;
            }
            // Set search options
            if (options.ignoreCase) {
                await nvim.command('set ignorecase');
            }
            else {
                await nvim.command('set noignorecase');
            }
            // Perform search and get matches
            const matches = await nvim.eval(`searchcount({"pattern": "${searchPattern.replace(/"/g, '\\"')}", "maxcount": 100})`);
            const matchInfo = matches;
            if (matchInfo.total === 0) {
                return `No matches found for: ${pattern}`;
            }
            // Move to first match
            await nvim.command(`/${searchPattern}`);
            return `Found ${matchInfo.total} matches for: ${pattern}${matchInfo.incomplete ? ' (showing first 100)' : ''}`;
        }
        catch (error) {
            console.error('Error searching in buffer:', error);
            throw new NeovimCommandError(`search for ${pattern}`, error instanceof Error ? error.message : 'Unknown error');
        }
    }
    async searchAndReplace(pattern, replacement, options = {}) {
        if (!pattern || pattern.trim().length === 0) {
            throw new NeovimValidationError('Search pattern cannot be empty');
        }
        try {
            const nvim = await this.connect();
            // Build substitute command
            let flags = '';
            if (options.global)
                flags += 'g';
            if (options.ignoreCase)
                flags += 'i';
            if (options.confirm)
                flags += 'c';
            const command = `%s/${pattern.replace(/\//g, '\\/')}/${replacement.replace(/\//g, '\\/')}/${flags}`;
            const result = await nvim.call('execute', [command]);
            return result ? String(result).trim() : 'Search and replace completed';
        }
        catch (error) {
            console.error('Error in search and replace:', error);
            throw new NeovimCommandError(`substitute ${pattern} -> ${replacement}`, error instanceof Error ? error.message : 'Unknown error');
        }
    }
    async grepInProject(pattern, filePattern = '**/*') {
        if (!pattern || pattern.trim().length === 0) {
            throw new NeovimValidationError('Grep pattern cannot be empty');
        }
        try {
            const nvim = await this.connect();
            // Use vimgrep for internal searching
            const command = `vimgrep /${pattern}/ ${filePattern}`;
            await nvim.command(command);
            // Get quickfix list
            const qflist = await nvim.eval('getqflist()');
            const results = qflist;
            if (results.length === 0) {
                return `No matches found for: ${pattern}`;
            }
            const summary = results.slice(0, 10).map(item => `${item.filename}:${item.lnum}: ${item.text.trim()}`).join('\n');
            const totalText = results.length > 10 ? `\n... and ${results.length - 10} more matches` : '';
            return `Found ${results.length} matches for: ${pattern}\n${summary}${totalText}`;
        }
        catch (error) {
            console.error('Error in grep:', error);
            throw new NeovimCommandError(`grep ${pattern}`, error instanceof Error ? error.message : 'Unknown error');
        }
    }
    async getOpenBuffers() {
        try {
            const nvim = await this.connect();
            const buffers = await nvim.buffers;
            const windows = await nvim.windows;
            const bufferInfos = [];
            for (const buffer of buffers) {
                const [isLoaded, isListedOption, modified, syntax] = await Promise.all([
                    buffer.loaded,
                    buffer.getOption('buflisted'),
                    buffer.getOption('modified'),
                    buffer.getOption('syntax')
                ]);
                const isListed = Boolean(isListedOption);
                // Find windows containing this buffer
                const windowIds = [];
                for (const win of windows) {
                    const winBuffer = await win.buffer;
                    if (winBuffer.id === buffer.id) {
                        windowIds.push(win.id);
                    }
                }
                bufferInfos.push({
                    number: buffer.id,
                    name: await buffer.name,
                    isListed,
                    isLoaded,
                    modified: Boolean(modified),
                    syntax: String(syntax),
                    windowIds
                });
            }
            return bufferInfos;
        }
        catch (error) {
            console.error('Error getting open buffers:', error);
            return [];
        }
    }
    async manageMacro(action, register, count = 1) {
        try {
            const nvim = await this.connect();
            switch (action) {
                case 'record':
                    if (!register || register.length !== 1 || !/[a-z]/.test(register)) {
                        throw new NeovimValidationError('Register must be a single letter a-z for recording');
                    }
                    await nvim.input(`q${register}`);
                    return `Started recording macro in register '${register}'`;
                case 'stop':
                    await nvim.input('q');
                    return 'Stopped recording macro';
                case 'play':
                    if (!register || register.length !== 1 || !/[a-z]/.test(register)) {
                        throw new NeovimValidationError('Register must be a single letter a-z for playing');
                    }
                    const playCommand = count > 1 ? `${count}@${register}` : `@${register}`;
                    await nvim.input(playCommand);
                    return `Played macro from register '${register}' ${count} time(s)`;
                default:
                    throw new NeovimValidationError(`Unknown macro action: ${action}`);
            }
        }
        catch (error) {
            if (error instanceof NeovimValidationError) {
                throw error;
            }
            console.error('Error managing macro:', error);
            throw new NeovimCommandError(`macro ${action}`, error instanceof Error ? error.message : 'Unknown error');
        }
    }
    async manageTab(action, filename) {
        try {
            const nvim = await this.connect();
            switch (action) {
                case 'new':
                    if (filename) {
                        await nvim.command(`tabnew ${filename}`);
                        return `Created new tab with file: ${filename}`;
                    }
                    else {
                        await nvim.command('tabnew');
                        return 'Created new empty tab';
                    }
                case 'close':
                    await nvim.command('tabclose');
                    return 'Closed current tab';
                case 'next':
                    await nvim.command('tabnext');
                    return 'Moved to next tab';
                case 'prev':
                    await nvim.command('tabprev');
                    return 'Moved to previous tab';
                case 'first':
                    await nvim.command('tabfirst');
                    return 'Moved to first tab';
                case 'last':
                    await nvim.command('tablast');
                    return 'Moved to last tab';
                case 'list':
                    const tabs = await nvim.tabpages;
                    const tabInfo = [];
                    for (let i = 0; i < tabs.length; i++) {
                        const tab = tabs[i];
                        const win = await tab.window;
                        const buf = await win.buffer;
                        const name = await buf.name;
                        const current = await nvim.tabpage;
                        const isCurrent = tab === current;
                        tabInfo.push(`${isCurrent ? '*' : ' '}${i + 1}: ${name || '[No Name]'}`);
                    }
                    return `Tabs:\n${tabInfo.join('\n')}`;
                default:
                    throw new NeovimValidationError(`Unknown tab action: ${action}`);
            }
        }
        catch (error) {
            if (error instanceof NeovimValidationError) {
                throw error;
            }
            console.error('Error managing tab:', error);
            throw new NeovimCommandError(`tab ${action}`, error instanceof Error ? error.message : 'Unknown error');
        }
    }
    async manageFold(action, startLine, endLine) {
        try {
            const nvim = await this.connect();
            switch (action) {
                case 'create':
                    if (startLine === undefined || endLine === undefined) {
                        throw new NeovimValidationError('Start line and end line are required for creating folds');
                    }
                    await nvim.command(`${startLine},${endLine}fold`);
                    return `Created fold from line ${startLine} to ${endLine}`;
                case 'open':
                    await nvim.input('zo');
                    return 'Opened fold at cursor';
                case 'close':
                    await nvim.input('zc');
                    return 'Closed fold at cursor';
                case 'toggle':
                    await nvim.input('za');
                    return 'Toggled fold at cursor';
                case 'openall':
                    await nvim.command('normal! zR');
                    return 'Opened all folds';
                case 'closeall':
                    await nvim.command('normal! zM');
                    return 'Closed all folds';
                case 'delete':
                    await nvim.input('zd');
                    return 'Deleted fold at cursor';
                default:
                    throw new NeovimValidationError(`Unknown fold action: ${action}`);
            }
        }
        catch (error) {
            if (error instanceof NeovimValidationError) {
                throw error;
            }
            console.error('Error managing fold:', error);
            throw new NeovimCommandError(`fold ${action}`, error instanceof Error ? error.message : 'Unknown error');
        }
    }
    async navigateJumpList(direction) {
        try {
            const nvim = await this.connect();
            switch (direction) {
                case 'back':
                    await nvim.input('\x0f'); // Ctrl-O
                    return 'Jumped back in jump list';
                case 'forward':
                    await nvim.input('\x09'); // Ctrl-I (Tab)
                    return 'Jumped forward in jump list';
                case 'list':
                    await nvim.command('jumps');
                    // Get the output from the command
                    const output = await nvim.eval('execute("jumps")');
                    return `Jump list:\n${output}`;
                default:
                    throw new NeovimValidationError(`Unknown jump direction: ${direction}`);
            }
        }
        catch (error) {
            if (error instanceof NeovimValidationError) {
                throw error;
            }
            console.error('Error navigating jump list:', error);
            throw new NeovimCommandError(`jump ${direction}`, error instanceof Error ? error.message : 'Unknown error');
        }
    }
    // Enhanced tools from claude-code.nvim
    async analyzeRelatedFiles(filename) {
        try {
            const nvim = await this.connect();
            const buffer = filename ? await this.findBufferByName(nvim, filename) : await nvim.buffer;
            const bufferName = await buffer.name;
            const filetype = await buffer.getOption('filetype');
            // Get buffer content to analyze imports
            const lines = await buffer.lines;
            const imports = [];
            // Pattern matching for different languages
            const patterns = {
                javascript: [/import .+ from ['"](.+)['"]/g, /require\(['"](.+)['"]\)/g],
                typescript: [/import .+ from ['"](.+)['"]/g, /require\(['"](.+)['"]\)/g],
                python: [/^import (.+)$/gm, /^from (.+) import/gm],
                lua: [/require\(['"](.+)['"]\)/g, /require '(.+)'/g],
                vim: [/^source (.+)$/gm, /^runtime (.+)$/gm],
            };
            const langPatterns = patterns[filetype] || [];
            const content = lines.join('\n');
            for (const pattern of langPatterns) {
                const matches = content.matchAll(pattern);
                for (const match of matches) {
                    if (match[1]) {
                        imports.push(match[1]);
                    }
                }
            }
            // Find unique imports
            const uniqueImports = [...new Set(imports)];
            const result = {
                file: bufferName,
                language: filetype,
                imports: uniqueImports,
                importCount: uniqueImports.length,
            };
            return JSON.stringify(result, null, 2);
        }
        catch (error) {
            console.error('Error analyzing related files:', error);
            throw new NeovimCommandError('analyze_related', error instanceof Error ? error.message : 'Unknown error');
        }
    }
    async findWorkspaceSymbols(query = '', limit = 20) {
        try {
            const nvim = await this.connect();
            // Check if LSP is available
            const hasLsp = await nvim.eval('exists(":LspWorkspaceSymbol")');
            if (!hasLsp) {
                return 'LSP is not available. Ensure you have LSP configured for workspace symbol search.';
            }
            // Execute workspace symbol search
            await nvim.command(`LspWorkspaceSymbol ${query}`);
            // Get quickfix list (where LSP results are stored)
            const qflist = await nvim.eval('getqflist()');
            const symbols = qflist.slice(0, limit).map((item) => ({
                name: item.text || '',
                file: item.filename || item.bufnr,
                line: item.lnum || 0,
                column: item.col || 0,
                type: item.type || 'Unknown',
            }));
            if (symbols.length === 0) {
                return `No symbols found matching query: "${query}"`;
            }
            return JSON.stringify({
                query,
                count: symbols.length,
                totalFound: qflist.length,
                symbols,
            }, null, 2);
        }
        catch (error) {
            console.error('Error finding workspace symbols:', error);
            throw new NeovimCommandError('find_symbols', error instanceof Error ? error.message : 'Unknown error');
        }
    }
    async searchProjectFiles(pattern, includeContent = false) {
        try {
            const nvim = await this.connect();
            const cwd = await nvim.eval('getcwd()');
            // Use vimgrep for file search
            try {
                await nvim.command(`vimgrep /${pattern}/j **/*`);
            }
            catch {
                // If pattern is for filename, try with glob
                await nvim.command(`args **/*${pattern}*`);
            }
            // Get the results
            const qflist = await nvim.eval('getqflist()');
            const arglist = await nvim.eval('argv()');
            const files = [...new Set([
                    ...qflist.map((item) => item.filename || '').filter(Boolean),
                    ...arglist,
                ])].slice(0, 20);
            const results = [];
            for (const file of files) {
                const result = {
                    path: file,
                    relativePath: file.replace(cwd + '/', ''),
                };
                if (includeContent && file) {
                    try {
                        // Read first 20 lines of the file
                        const content = await nvim.eval(`readfile("${file}", "", 20)`);
                        result.preview = content.join('\n');
                        result.truncated = content.length === 20;
                    }
                    catch {
                        result.preview = 'Could not read file content';
                    }
                }
                results.push(result);
            }
            return JSON.stringify({
                pattern,
                cwd,
                count: results.length,
                files: results,
            }, null, 2);
        }
        catch (error) {
            console.error('Error searching project files:', error);
            throw new NeovimCommandError('search_files', error instanceof Error ? error.message : 'Unknown error');
        }
    }
    async getCurrentSelection(includeContext = false) {
        try {
            const nvim = await this.connect();
            const mode = await nvim.mode;
            // Check if we're in visual mode or have visual marks
            const visualMode = mode.mode.match(/^[vV]/);
            const startPos = await nvim.eval('getpos("\'<")');
            const endPos = await nvim.eval('getpos("\'>")');
            if (!visualMode && (startPos[1] === 0 || endPos[1] === 0)) {
                return 'No visual selection available';
            }
            const buffer = await nvim.buffer;
            const bufferName = await buffer.name;
            const filetype = await buffer.getOption('filetype');
            const startLine = startPos[1] - 1;
            const endLine = endPos[1] - 1;
            const startCol = startPos[2] - 1;
            const endCol = endPos[2];
            // Get the selected lines
            const lines = await buffer.getLines({ start: startLine, end: endLine + 1, strictIndexing: false });
            // Handle character-wise selection
            if (lines.length === 1) {
                lines[0] = lines[0].substring(startCol, endCol);
            }
            else if (lines.length > 1) {
                lines[0] = lines[0].substring(startCol);
                lines[lines.length - 1] = lines[lines.length - 1].substring(0, endCol);
            }
            const result = {
                mode: visualMode ? 'visual' : 'normal (using last selection)',
                buffer: bufferName,
                filetype,
                selection: {
                    start: { line: startLine + 1, column: startCol + 1 },
                    end: { line: endLine + 1, column: endCol },
                    text: lines.join('\n'),
                    lineCount: lines.length,
                },
            };
            // Include context if requested
            if (includeContext) {
                const contextStart = Math.max(0, startLine - 5);
                const contextEnd = Math.min(await buffer.length, endLine + 6);
                const contextLines = await buffer.getLines({ start: contextStart, end: contextEnd, strictIndexing: false });
                result.context = {
                    start: contextStart + 1,
                    end: contextEnd,
                    lines: contextLines,
                };
            }
            return JSON.stringify(result, null, 2);
        }
        catch (error) {
            console.error('Error getting current selection:', error);
            throw new NeovimCommandError('get_selection', error instanceof Error ? error.message : 'Unknown error');
        }
    }
    async findBufferByName(nvim, filename) {
        const buffers = await nvim.buffers;
        for (const buffer of buffers) {
            const name = await buffer.name;
            if (name.endsWith(filename)) {
                return buffer;
            }
        }
        throw new NeovimValidationError(`Buffer not found: ${filename}`);
    }
    // Resource handler methods
    async getProjectStructure() {
        try {
            const nvim = await this.connect();
            const cwd = await nvim.eval('getcwd()');
            // Use find command to get project structure
            const output = await nvim.eval(`systemlist('find . -type f -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.lua" -o -name "*.vim" -o -name "*.md" | head -100')`);
            let result = `Project: ${cwd}\n\nFiles:\n`;
            for (const file of output) {
                result += `  ${file}\n`;
            }
            return result;
        }
        catch (error) {
            console.error('Error getting project structure:', error);
            return 'Error: Could not get project structure';
        }
    }
    async getGitStatus() {
        try {
            const nvim = await this.connect();
            // Check if git is available
            const hasGit = await nvim.eval('executable("git")');
            if (!hasGit) {
                return 'Git is not available';
            }
            // Get git status
            const status = await nvim.eval('system("git status --porcelain 2>/dev/null")');
            const shellError = await nvim.eval('v:shell_error');
            if (shellError !== 0) {
                return 'Not a git repository or git not available';
            }
            if (!status || status.trim() === '') {
                return 'Working tree clean';
            }
            // Parse git status
            const lines = status.split('\n').filter(line => line.length > 0);
            let result = 'Git Status:\n\n';
            for (const line of lines) {
                const statusCode = line.substring(0, 2);
                const filename = line.substring(3);
                let statusDesc = '';
                if (statusCode.includes('M'))
                    statusDesc = 'Modified';
                else if (statusCode.includes('A'))
                    statusDesc = 'Added';
                else if (statusCode.includes('D'))
                    statusDesc = 'Deleted';
                else if (statusCode.includes('R'))
                    statusDesc = 'Renamed';
                else if (statusCode.includes('C'))
                    statusDesc = 'Copied';
                else if (statusCode.includes('U'))
                    statusDesc = 'Unmerged';
                else if (statusCode.includes('?'))
                    statusDesc = 'Untracked';
                else
                    statusDesc = 'Unknown';
                result += `${statusDesc}: ${filename}\n`;
            }
            return result;
        }
        catch (error) {
            console.error('Error getting git status:', error);
            return 'Error getting git status';
        }
    }
    async getLspDiagnostics() {
        try {
            const nvim = await this.connect();
            // Get all diagnostics
            const diagnostics = await nvim.eval('luaeval("vim.diagnostic.get()")');
            const diagnosticsByBuffer = {};
            for (const diag of diagnostics) {
                const bufnr = diag.bufnr;
                const buffers = await nvim.buffers;
                const buffer = buffers.find((b) => b.id === bufnr);
                const bufferName = buffer ? await buffer.name : `Buffer ${bufnr}`;
                if (!diagnosticsByBuffer[bufferName]) {
                    diagnosticsByBuffer[bufferName] = [];
                }
                diagnosticsByBuffer[bufferName].push({
                    line: diag.lnum + 1,
                    column: diag.col + 1,
                    severity: ['Error', 'Warning', 'Information', 'Hint'][diag.severity - 1] || 'Unknown',
                    message: diag.message,
                    source: diag.source || 'LSP',
                });
            }
            return JSON.stringify({
                totalCount: diagnostics.length,
                diagnostics: diagnosticsByBuffer,
            }, null, 2);
        }
        catch (error) {
            console.error('Error getting LSP diagnostics:', error);
            return JSON.stringify({ error: 'Could not get LSP diagnostics', totalCount: 0, diagnostics: {} });
        }
    }
    async getVimOptions() {
        try {
            const nvim = await this.connect();
            const options = {
                general: {
                    encoding: await nvim.getOption('encoding'),
                    fileformat: await nvim.getOption('fileformat'),
                    filetype: await nvim.getOption('filetype'),
                    modifiable: await nvim.getOption('modifiable'),
                    readonly: await nvim.getOption('readonly'),
                    modified: await nvim.getOption('modified'),
                },
                editor: {
                    tabstop: await nvim.getOption('tabstop'),
                    shiftwidth: await nvim.getOption('shiftwidth'),
                    expandtab: await nvim.getOption('expandtab'),
                    smartindent: await nvim.getOption('smartindent'),
                    autoindent: await nvim.getOption('autoindent'),
                    wrap: await nvim.getOption('wrap'),
                    number: await nvim.getOption('number'),
                    relativenumber: await nvim.getOption('relativenumber'),
                },
                search: {
                    ignorecase: await nvim.getOption('ignorecase'),
                    smartcase: await nvim.getOption('smartcase'),
                    hlsearch: await nvim.getOption('hlsearch'),
                    incsearch: await nvim.getOption('incsearch'),
                },
                ui: {
                    colorscheme: await nvim.eval('execute("colorscheme")'),
                    background: await nvim.getOption('background'),
                    termguicolors: await nvim.getOption('termguicolors'),
                },
            };
            return JSON.stringify(options, null, 2);
        }
        catch (error) {
            console.error('Error getting vim options:', error);
            return JSON.stringify({ error: 'Could not get vim options' });
        }
    }
    async getRelatedFiles() {
        try {
            const result = await this.analyzeRelatedFiles();
            const analysis = JSON.parse(result);
            // For each import, try to find the actual file
            const relatedFiles = [];
            const nvim = await this.connect();
            const cwd = await nvim.eval('getcwd()');
            for (const importPath of analysis.imports) {
                // Try to resolve the import to an actual file
                const possiblePaths = [
                    importPath,
                    `${importPath}.js`,
                    `${importPath}.ts`,
                    `${importPath}.lua`,
                    `${importPath}.py`,
                    `${importPath}/index.js`,
                    `${importPath}/index.ts`,
                ];
                for (const path of possiblePaths) {
                    const exists = await nvim.eval(`filereadable("${path}")`);
                    if (exists) {
                        relatedFiles.push({
                            import: importPath,
                            resolvedPath: path,
                            exists: true,
                        });
                        break;
                    }
                }
            }
            return JSON.stringify({
                currentFile: analysis.file,
                language: analysis.language,
                relatedFiles,
                importCount: analysis.importCount,
            }, null, 2);
        }
        catch (error) {
            console.error('Error getting related files:', error);
            return JSON.stringify({ error: 'Could not get related files' });
        }
    }
    async getRecentFiles() {
        try {
            const nvim = await this.connect();
            // Get oldfiles (recently opened files)
            const oldfiles = await nvim.eval('v:oldfiles');
            const cwd = await nvim.eval('getcwd()');
            // Filter to only files in current project
            const projectFiles = oldfiles
                .filter(file => file.startsWith(cwd))
                .slice(0, 20)
                .map(file => ({
                path: file,
                relativePath: file.replace(cwd + '/', ''),
            }));
            return JSON.stringify({
                cwd,
                count: projectFiles.length,
                recentFiles: projectFiles,
            }, null, 2);
        }
        catch (error) {
            console.error('Error getting recent files:', error);
            return JSON.stringify({ error: 'Could not get recent files' });
        }
    }
    async getWorkspaceContext() {
        try {
            const nvim = await this.connect();
            // Gather comprehensive workspace context
            const context = {
                cwd: await nvim.eval('getcwd()'),
                currentBuffer: {
                    name: await (await nvim.buffer).name,
                    filetype: await (await nvim.buffer).getOption('filetype'),
                    modified: await (await nvim.buffer).getOption('modified'),
                },
                buffers: await this.getOpenBuffers(),
                recentFiles: JSON.parse(await this.getRecentFiles()),
                gitStatus: await this.getGitStatus(),
                diagnosticSummary: {
                    errors: await nvim.eval('luaeval("#vim.tbl_filter(function(d) return d.severity == 1 end, vim.diagnostic.get())")'),
                    warnings: await nvim.eval('luaeval("#vim.tbl_filter(function(d) return d.severity == 2 end, vim.diagnostic.get())")'),
                },
                mode: (await nvim.mode).mode,
            };
            return JSON.stringify(context, null, 2);
        }
        catch (error) {
            console.error('Error getting workspace context:', error);
            return JSON.stringify({ error: 'Could not get workspace context' });
        }
    }
    async getSearchResults() {
        try {
            const nvim = await this.connect();
            // Get quickfix list
            const qflist = await nvim.eval('getqflist()');
            const results = qflist.map((item) => ({
                filename: item.filename || `Buffer ${item.bufnr}`,
                line: item.lnum,
                column: item.col,
                text: item.text,
                type: item.type || '',
            }));
            // Also get location list for current window
            const loclist = await nvim.eval('getloclist(0)');
            const locationResults = loclist.map((item) => ({
                filename: item.filename || `Buffer ${item.bufnr}`,
                line: item.lnum,
                column: item.col,
                text: item.text,
                type: item.type || '',
            }));
            return JSON.stringify({
                quickfix: {
                    count: results.length,
                    results,
                },
                locationList: {
                    count: locationResults.length,
                    results: locationResults,
                },
            }, null, 2);
        }
        catch (error) {
            console.error('Error getting search results:', error);
            return JSON.stringify({ error: 'Could not get search results' });
        }
    }
}
