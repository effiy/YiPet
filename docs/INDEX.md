# YiPet Documentation Index

This file serves as the central navigation point for all YiPet project documentation.

## Documentation Structure

```
docs/
├── README.md                    # This navigation file
├── architecture/               # Architecture and design documents
│   └── src-architecture-proposal.md
├── migration/                  # Migration guides and procedures
│   ├── MIGRATION_GUIDE.md
│   └── src-migration-guide.md
└── project-info/              # Project overview and structure
    └── PROJECT_STRUCTURE_SUMMARY.md
```

## Quick Links by Role

### For New Developers
1. Start with: [project-info/PROJECT_STRUCTURE_SUMMARY.md](project-info/PROJECT_STRUCTURE_SUMMARY.md)
2. Review: [architecture/src-architecture-proposal.md](architecture/src-architecture-proposal.md)
3. Follow: [migration/src-migration-guide.md](migration/src-migration-guide.md)

### For Project Maintainers
1. Reference: [migration/MIGRATION_GUIDE.md](migration/MIGRATION_GUIDE.md)
2. Update: [project-info/PROJECT_STRUCTURE_SUMMARY.md](project-info/PROJECT_STRUCTURE_SUMMARY.md)

### For Architects
1. Primary: [architecture/src-architecture-proposal.md](architecture/src-architecture-proposal.md)
2. Context: [project-info/PROJECT_STRUCTURE_SUMMARY.md](project-info/PROJECT_STRUCTURE_SUMMARY.md)

## Document Categories

### 📐 Architecture (`architecture/`)
Contains high-level design decisions, architectural patterns, and system design documentation.

**Files:**
- `src-architecture-proposal.md` - Comprehensive architecture proposal for the src directory reorganization

### 🔄 Migration (`migration/`)
Step-by-step guides for transitioning between different versions or structural changes.

**Files:**
- `MIGRATION_GUIDE.md` - General migration guide with code examples and path mappings
- `src-migration-guide.md` - Specific guide for migrating src directory structure

### 📋 Project Information (`project-info/`)
Overview documents that describe the current state and organization of the project.

**Files:**
- `PROJECT_STRUCTURE_SUMMARY.md` - Complete summary of the optimized project structure

## Maintenance Notes

- Keep this index updated when adding new documentation
- Follow the established categorization when adding new files
- Consider adding subdirectories for complex topics
- Maintain consistent naming conventions (kebab-case for files)

## File Naming Conventions

- Use kebab-case for all file names
- Prefix with topic area when relevant
- Keep names descriptive but concise
- Avoid special characters and spaces