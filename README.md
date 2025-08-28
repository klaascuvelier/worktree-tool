# KWT - k11r Worktree Tool

A modern TypeScript wrapper around git worktrees with GitLab integration and intelligent configuration management.

## Features

- 🚀 **Easy worktree management** - Create, remove, and list git worktrees with simple commands
- 🔧 **Flexible prefix configuration** - Support for none, manual, or auto-detected prefixes
- 🦊 **GitLab integration** - Create worktrees directly from merge requests using `glab`
- ⚙️ **Post-creation commands** - Run custom commands after worktree creation
- 📁 **Smart configuration** - Local and global configuration with intelligent merging
- 🎯 **TypeScript first** - Fully typed with strict TypeScript configuration
- 🛠️ **Modern tooling** - Built with latest Node.js, ESBuild, and comprehensive linting

## Installation

### Global Installation

```bash
npm install -g kwt
```

### Local Development

```bash
git clone <repository-url>
cd worktree-tool
npm install
npm run build
npm link  # For global access during development
```

## Quick Start

1. **Initialize configuration** in your git repository:

   ```bash
   kwt config --init
   ```

2. **Create a new worktree**:

   ```bash
   kwt new feature-branch
   ```

3. **Create worktree from GitLab MR**:

   ```bash
   kwt mr 123
   ```

4. **List all worktrees**:

   ```bash
   kwt list
   ```

5. **Remove a worktree**:
   ```bash
   kwt rm feature-branch
   ```

## Commands

### `kwt new <name>`

Create a new worktree with the specified name.

**Options:**

- `-b, --branch <name>` - Custom branch name (defaults to worktree name)
- `--no-push` - Don't push the new branch to origin
- `--dry-run` - Show what would be done without executing

**Examples:**

```bash
kwt new feature-auth
kwt new bugfix-login --branch fix/login-issue
kwt new experiment --no-push
```

### `kwt mr <number>`

Create a worktree from a GitLab merge request.

**Options:**

- `--checkout` - Checkout existing worktree if it exists
- `--dry-run` - Show what would be done without executing

**Examples:**

```bash
kwt mr 123
kwt mr 456 --checkout
```

**Requirements:**

- `glab` CLI tool must be installed and configured
- Must be run in a GitLab project repository

### `kwt rm <name>`

Remove a worktree and optionally its branch.

**Options:**

- `-f, --force` - Force removal without confirmation
- `--dry-run` - Show what would be done without executing

**Examples:**

```bash
kwt rm feature-auth
kwt rm old-feature --force
```

### `kwt config`

Manage configuration settings.

**Options:**

- `--init` - Initialize local configuration
- `--global` - Use global configuration
- `--set <key=value>` - Set a configuration value
- `--get <key>` - Get a configuration value
- `--list` - List all configuration values

**Examples:**

```bash
kwt config --init
kwt config --set prefixType=detect
kwt config --set worktreeDir=../my-worktrees
kwt config --get prefixType
kwt config --list
```

### `kwt list`

List all existing worktrees.

**Aliases:** `ls`

## Configuration

KWT uses a hierarchical configuration system with global and local settings.

### Configuration Files

- **Global**: `~/.kwt` - User-wide settings
- **Local**: `.kwt` in your repository - Project-specific settings

Local settings override global settings.

### Configuration Options

#### `prefixType`

Controls how worktree names are prefixed:

- `"none"` - No prefix (default)
- `"manual"` - Use manually specified prefix
- `"detect"` - Auto-detect from git remote

#### `manualPrefix`

Custom prefix when `prefixType` is `"manual"`.

**Examples:**

```json
{
  "prefixType": "manual",
  "manualPrefix": "myproject-"
}
```

#### `worktreeDir`

Directory where worktrees are created (relative to repository root).

**Default:** `"../worktrees"`

#### `postCommands`

Array of commands to run after worktree creation.

**Example:**

```json
{
  "postCommands": [
    {
      "label": "Install dependencies",
      "commands": ["npm install"]
    },
    {
      "label": "Setup environment",
      "commands": ["cp .env.example .env", "npm run setup"]
    }
  ]
}
```

### Example Configuration

```json
{
  "prefixType": "detect",
  "worktreeDir": "../worktrees",
  "postCommands": [
    {
      "label": "Install dependencies",
      "commands": ["npm install"]
    },
    {
      "label": "Run initial setup",
      "commands": ["npm run setup"]
    }
  ]
}
```

## Prefix Detection

When `prefixType` is set to `"detect"`, KWT automatically generates prefixes from your git remote:

- `git@github.com:user/my-repo.git` → `my-repo-`
- `https://gitlab.com/user/awesome-project.git` → `awesome-project-`

## GitLab Integration

KWT integrates with GitLab through the `glab` CLI tool:

1. **Install glab**: Follow [glab installation guide](https://gitlab.com/gitlab-org/cli)
2. **Authenticate**: `glab auth login`
3. **Use MR command**: `kwt mr <merge-request-number>`

The tool will:

- Verify the MR exists
- Fetch the source branch
- Create a worktree with an appropriate name
- Run post-creation commands

## Development

### Prerequisites

- Node.js 22.17.0+ (see `.nvmrc`)
- npm or yarn

### Setup

```bash
git clone <repository-url>
cd worktree-tool
npm install
```

### Scripts

- `npm run build` - Build the project
- `npm run dev` - Build in watch mode
- `npm run test` - Run tests
- `npm run lint` - Lint code
- `npm run format` - Format code
- `npm run typecheck` - Type check

### Architecture

- **TypeScript** with strict configuration
- **ESM modules** for modern Node.js
- **Commander.js** for CLI framework
- **Zod** for configuration validation
- **Execa** for process execution
- **Cosmiconfig** for configuration management

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run linting and tests
6. Submit a pull request

## Troubleshooting

### Common Issues

**"Not in a git repository"**

- Ensure you're running KWT from within a git repository

**"glab CLI not available"**

- Install and configure the GitLab CLI tool for MR functionality

**"Worktree already exists"**

- Use `kwt list` to see existing worktrees
- Use `kwt rm <name>` to remove conflicting worktrees

**Permission denied on CLI**

- Ensure the binary is executable: `chmod +x dist/cli.js`

### Debug Mode

Use the `--verbose` flag for detailed logging:

```bash
kwt --verbose new my-feature
```
