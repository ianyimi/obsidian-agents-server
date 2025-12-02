# Additional Vault Tools for Phase 2

These tools would significantly enhance the Vault Architect agent's ability to explore and build systems.

## High Priority Tools

### 1. list_files
**Purpose**: List files matching patterns or in specific folders
```typescript
{
  folder?: string,  // Optional folder path to search in
  pattern?: string, // Optional glob pattern (*.md, **/*.canvas, etc)
  recursive?: boolean // Default true
}
// Returns: Array of file paths
```
**Why**: Essential for exploring vault structure, finding templates, checking what exists before creating

### 2. list_folders
**Purpose**: List all folders or folders matching pattern
```typescript
{
  parent?: string,  // Optional parent folder
  recursive?: boolean // Default true
}
// Returns: Array of folder paths
```
**Why**: Understanding vault organization, planning where to create new systems

### 3. create_folder
**Purpose**: Create folder structure
```typescript
{
  path: string  // Folder path to create (creates parent folders if needed)
}
// Returns: success status
```
**Why**: Building system folder structures systematically

### 4. get_frontmatter
**Purpose**: Read YAML frontmatter from a file
```typescript
{
  path: string
}
// Returns: Object with frontmatter key-value pairs
```
**Why**: Check existing metadata schemas, understand current structure

### 5. update_frontmatter
**Purpose**: Update specific frontmatter fields without touching content
```typescript
{
  path: string,
  updates: Record<string, any>,  // Keys to add/update
  remove?: string[]              // Keys to remove
}
// Returns: success status
```
**Why**: Modify metadata without rewriting entire file

### 6. search_content
**Purpose**: Search for text within vault files
```typescript
{
  query: string,
  folder?: string,     // Optional folder to search in
  caseSensitive?: boolean,
  regex?: boolean
}
// Returns: Array of {file: string, matches: string[]}
```
**Why**: Find similar existing systems, check for duplicates, understand patterns

## Medium Priority Tools

### 7. get_enabled_plugins
**Purpose**: Read community-plugins.json
```typescript
// No params
// Returns: Array of enabled plugin IDs
```
**Why**: Know what plugins are available before designing systems

### 8. list_templates
**Purpose**: List available Templater templates
```typescript
{
  folder?: string  // Optional template folder path
}
// Returns: Array of template file paths
```
**Why**: Know what templates exist, avoid duplicates

### 9. get_file_metadata
**Purpose**: Get file stats without reading full content
```typescript
{
  path: string
}
// Returns: { created: number, modified: number, size: number, exists: boolean }
```
**Why**: Check if file exists, when it was last modified

### 10. move_file
**Purpose**: Move/rename files
```typescript
{
  oldPath: string,
  newPath: string
}
// Returns: success status
```
**Why**: Reorganize systems, rename for consistency

## Lower Priority (Nice to Have)

### 11. get_plugin_settings
**Purpose**: Read plugin data.json files
```typescript
{
  pluginId: string
}
// Returns: Plugin settings object
```
**Why**: Understand current plugin configurations when designing integrations

### 12. list_tags
**Purpose**: Get all tags used in vault
```typescript
// No params
// Returns: Array of tag names with counts
```
**Why**: Understand existing tagging schemes

### 13. get_backlinks
**Purpose**: Get files that link to a specific file
```typescript
{
  path: string
}
// Returns: Array of linking file paths
```
**Why**: Understand note relationships before modifying

## Implementation Notes

- All file operations should use absolute paths from vault root
- All read operations should have `cache` option for performance
- Search operations should support limits to avoid overwhelming responses
- List operations should support pagination or limits
- All operations should validate paths and handle errors gracefully

## Priority for Phase 2 Start

Start with these 5 essentials:
1. `list_files` - Critical for exploration
2. `create_folder` - Critical for system building
3. `get_frontmatter` - Understanding existing schemas
4. `update_frontmatter` - Modifying metadata cleanly
5. `get_enabled_plugins` - Knowing what's available

These would make the Vault Architect immediately much more capable.
