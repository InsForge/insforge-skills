# Contributing to InsForge Agent Skills

Thank you for your interest in contributing to InsForge Agent Skills! This document provides guidelines for contributing to this repository.

## Getting Started

1. Fork this repository
2. Clone your fork locally
3. Create a branch for your changes

## Skill Format

This repository follows the [Agent Skills Open Standard](https://agentskills.io/). Please review the specification before contributing.

### SKILL.md Requirements

Every skill must have a `SKILL.md` file with:

```yaml
---
name: skill-name           # Required: lowercase, hyphens only, matches directory name
description: |             # Required: clear description of what the skill does
  Description here...
license: MIT               # Optional: license identifier
metadata:                  # Optional: additional metadata
  author: insforge
  version: "1.0.0"
---

# Skill content in Markdown...
```

### Documentation Files

For InsForge modules, follow this pattern:

- **`sdk-integration.md`**: Client-side SDK usage with `@insforge/sdk`
- **`backend-configuration.md`**: Backend HTTP API configuration

## Documentation Guidelines

### Structure

Each documentation file should include:

1. **Title and Overview**: Brief description of the module
2. **Setup/Prerequisites**: Required configuration or imports
3. **Usage Examples**: Practical code examples
4. **Best Practices**: Recommended patterns
5. **Common Mistakes**: What to avoid with solutions

### Code Examples

- Keep examples concise and runnable
- Use consistent formatting
- Include both correct and incorrect examples where helpful
- Show the `{ data, error }` return pattern

```javascript
// Good: Shows complete pattern
const { data, error } = await insforge.database.from('posts').select()
if (error) {
  console.error(error)
  return
}
console.log(data)
```

### Writing Style

- Use clear, direct language
- Prefer active voice
- Keep explanations brief
- Use tables for reference information

## Adding a New Module

1. Create a directory under `skills/insforge/`
2. Add the required documentation files
3. Update the module reference table in `skills/insforge/SKILL.md`
4. Test that all links work correctly

## Pull Request Process

1. Ensure your changes follow the format guidelines
2. Update relevant documentation if adding features
3. Submit a pull request with a clear description
4. Respond to any feedback from reviewers

## Questions?

If you have questions about contributing, please open an issue for discussion.
