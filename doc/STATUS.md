# Wyseman Documentation Status

This file tracks the progress of the Wyseman documentation project. It serves as a planning and tracking tool for documenting each aspect of the system.

## Overall Progress

- [x] Documentation structure established
- [x] DOCS.md planning document created
- [x] README.md (TOC) created
- [x] Several individual section files created with outlines
- [ ] Complete first draft of all sections (10/16 completed)
- [x] Review of Introduction, Installation, Basic Concepts, Schema Authoring, Schema File Reference, and Schema Command Reference sections complete
- [ ] Complete review of all sections (6/16 completed)
- [ ] Final release of documentation

## Documentation Migration Tasks

- [x] Draft new main README.md for project root (GitHub landing page)
- [x] Create doc/old/ directory
- [x] Move existing old documentation to doc/old/
  - [x] Original
  - [x] Control
  - [x] Versions.md
  - [x] Root README.md (as README.old.md)
- [ ] Verify all important information from old docs is preserved in new docs

**Note**: Old documentation files (Original, Control, Versions.md) have been moved to the doc/old/ directory for reference, and the original README.md has been replaced with the new version. All relevant information should be incorporated into the new documentation structure.

## Section Status

### 1. Introduction
- [x] Outline created
- [x] Research completed
- [x] First draft written
- [x] Reviewed
- [x] Finalized
- **Notes**: Introduction complete with overview of Wyseman functionality and relationship to WyattERP components.

### 2. Installation
- [x] Outline created
- [x] Research completed
- [x] First draft written
- [x] Reviewed
- [x] Finalized
- **Notes**: 
  - Added detailed instructions for PostgreSQL, TCL, and Node.js installation
  - Added examples of JavaScript-based configuration with build targets
  - Added NPX usage instructions
  - Corrected verification command to use wyseman-info

### 3. Basic Concepts
- [x] Outline created
- [x] Research completed
- [x] First draft written
- [x] Reviewed
- [x] Finalized
- **Notes**: Concepts section completed with explanation of schema definition, object versioning, and database interaction model.

### 4. Schema Authoring
- [x] Outline created
- [x] Research completed
- [x] First draft written
- [x] Reviewed
- [x] Finalized
- **Notes**: Complete with comprehensive coverage of TCL dynamic lists, schema keywords, SQL generation, grant syntax, and TCL evaluation capabilities (eval/expr/subst). Added clarification about switched parameters and abbreviations.

### 5. Schema File Reference
- [x] Outline created
- [x] Research completed
- [x] First draft written
- [x] Reviewed
- [x] Finalized
- **Notes**: Focused as an overview of file types in the Wyseman ecosystem. Clarified dual format support for WMD files. Added cross-references to related documents.

### 6. Schema Command Reference
- [x] Outline created
- [x] Research completed
- [x] First draft written
- [x] Reviewed
- [x] Finalized
- **Notes**: Enhanced as a comprehensive command dictionary with all parameters, options, and file format information. Added missing commands and switches from other documents.

### 7. Command Line Tools
- [x] Outline created
- [x] Research completed
- [x] First draft written
- [ ] Reviewed
- [ ] Finalized
- **Notes**: Need to document each tool in bin/ directory with more detail.

### 8. Versioning System
- [x] Outline created
- [x] Research completed
- [x] First draft written
- [ ] Reviewed
- [ ] Finalized
- **Notes**: Doc/Versions.md has considerable information to incorporate.

### 9. Runtime Support
- [x] Outline created
- [ ] Research completed
- [ ] First draft written
- [ ] Reviewed
- [ ] Finalized
- **Notes**: Currently working on this chapter. Analyzing lib/wyseman.js, dbclient.js, handler.js, and related files to document the backend server integration and client communication flow.

### 10. API Reference
- [ ] Outline created
- [ ] Research completed
- [ ] First draft written
- [ ] Reviewed
- [ ] Finalized
- **Notes**: Focus on JavaScript API as primary, with notes on legacy APIs.

### 11. Security and Connection Protocol
- [x] Outline created
- [x] Research completed
- [ ] First draft written
- [ ] Reviewed
- [ ] Finalized
- **Notes**: Created comprehensive documentation explaining both the current WebSocket connection protocol and planned libp2p implementation.

### 12. Examples
- [ ] Outline created
- [ ] Research completed
- [ ] First draft written
- [ ] Reviewed
- [ ] Finalized
- **Notes**: Extract examples from test directory and sample directory.

### 13. Troubleshooting
- [ ] Outline created
- [ ] Research completed
- [ ] First draft written
- [ ] Reviewed
- [ ] Finalized
- **Notes**: Compile from existing issues and developer experience.

### 14. Project History
- [x] Outline created
- [x] Research completed
- [x] First draft written
- [ ] Reviewed
- [ ] Finalized
- **Notes**: Much of this is in the current README.md.

### 15. Future Development
- [ ] Outline created
- [ ] Research completed
- [ ] First draft written
- [ ] Reviewed
- [ ] Finalized
- **Notes**: Need input from current developers on roadmap.

### 16. Contributing
- [x] Outline created
- [x] Research completed
- [x] First draft written
- [ ] Reviewed
- [ ] Finalized
- **Notes**: Completed based on GitHub repositories and project relationships. Includes development setup, code contribution workflow, and documentation contributions.

### 17. Root README.md (GitHub Landing Page)
- [ ] Outline created
- [ ] Research completed
- [ ] First draft written
- [ ] Reviewed
- [ ] Finalized
- **Notes**: Needs to be a concise, attractive landing page for the project. Move historical narrative to history.md.

## Research Priorities

1. ✅ Analyze core functionality in lib/ directory
   - Completed: Analyzed parser.js, wmparse.tcl to document schema authoring
   - Completed: Documented versioning system based on Versions.md
   - Completed: Documented command line tools in bin/wyseman.js
2. ✅ Document command line tools in bin/ directory
   - Completed: Documented all tools found in bin/ with examples
3. ✅ Understand schema file formats from test/schema/ examples
   - Completed: Documented .wms, .wmt, .wmd, .wmi file formats
   - Completed: Created schema authoring guide with all TCL keywords
4. 🔄 Extract runtime API details from lib/handler.js and related files
   - Pending: Need to analyze JavaScript API for runtime support
5. ✅ Document versioning system based on doc/Versions.md and implementation
   - Completed: Created comprehensive guide to versioning system
6. 🆕 Create a new project root README.md
   - Pending: Design a concise, informative GitHub landing page
   - Pending: Move historical narrative to history.md chapter
7. ✅ Restructure schema documentation chapters for clearer differentiation
   - Completed: Reorganized content between authoring.md, schema-files.md, and command-reference.md
   - Implementation:
     1. authoring.md: Focused on tutorial aspects
       - Updated introduction to emphasize tutorial nature
       - Added cross-references to other documents
       - Kept TCL basics and dynamic lists explanations
       - Target audience: Beginners learning schema authoring
     
     2. schema-files.md: Focused on file types and ecosystem overview
       - Emphasized its role as a file type reference
       - Added cross-references to other documents
       - Clarified dual-format support for WMD files
       - Added comprehensive WMI file documentation
       - Target audience: Users wanting to understand the ecosystem
     
     3. command-reference.md: Enhanced as a comprehensive command dictionary
       - Added all missing parameters and options
       - Added YAML format documentation
       - Expanded permission documentation
       - Created comprehensive switch reference
       - Target audience: Users seeking specific command details

## Documentation Plan Timeline

1. ✅ **Phase 1**: Complete outlines for all sections (Estimated: 1 week)
   - Completed: Table of contents created in README.md
   - Completed: Structure for all sections established
2. ✅ **Phase 2**: Research and first drafts of core sections (1-7) (Estimated: 2 weeks)
   - Completed: Introduction, Installation, Basic Concepts
   - Completed: Schema Authoring with all TCL keywords and features
   - Completed: Schema File Reference, Command Line Tools, Versioning System
3. 🔄 **Phase 3**: Research and first drafts of remaining sections (8-15) (Estimated: 2 weeks)
   - In Progress: 2/8 completed (Project History, Contributing)
   - Pending: Runtime Support, API Reference, Security, Examples, Troubleshooting, Future Development
4. 🔄 **Phase 4**: Documentation Migration and Restructuring (Estimated: 1 week)
   - Pending: Create new GitHub README.md for project root
   - Pending: Move old documentation to doc/old/ directory
   - Pending: Final review to ensure all important information is preserved
5. **Phase 5**: Review, revision, and finalization (Estimated: 1 week)

## Notes and Questions for Developers

- Clarify the current status of Ruby support - marked as deprecated in README
- Provide details on security model and authentication flow
- Confirm roadmap for future development priorities
- Provide typical examples of real-world schema files using TCL features
- Confirm if the TCL evaluation features (eval/expr/subst) are commonly used
- Clarify best practices for organizing schema files in large projects
- Review the Schema Authoring documentation for accuracy and completeness
- Confirm if the new main README draft meets project needs for GitHub presence
- Verify that no important information is lost when moving old docs to doc/old/

## Added Features / Completed Tasks

- Created documentation structure with comprehensive TOC
- Documented all wyseman command-line tools from bin/ directory
- Created complete reference of schema file formats (.wms, .wmt, .wmd, .wmi)
- Documented all TCL keywords used in schema files
- Added detailed Schema Command Reference with syntax and examples for all commands
- Added documentation for TCL evaluation features (eval/expr/subst)
- Created schema authoring guide with examples
- Documented versioning system based on doc/Versions.md
- Added detailed installation instructions
- Created project history documentation
- Added contributing guidelines with development setup and workflow

## Pending Tasks

- Document runtime JavaScript API
- Document security model and authentication
- Create troubleshooting guide
- Add comprehensive examples
- Document integration with WyattERP suite
- Re-draft main README.md in project root as a GitHub landing page
- Move old documentation to doc/old/ directory for reference
- Verify all relevant information from old docs has been incorporated into new docs

## Information Migration Checklist

### From README.md
- [x] Basic explanation of Wyseman → introduction.md
- [x] How schema files work → schema-files.md and authoring.md
- [x] Historical narrative → history.md
- [ ] Create new concise GitHub README.md

### From doc/Original
- [ ] Verify all relevant concepts included in new documentation

### From doc/Control
- [ ] Extract background information into appropriate sections

### From doc/Versions.md
- [x] Versioning concepts → versioning.md
- [x] Schema lifecycle → concepts.md
- [x] Migration strategies → versioning.md

### From Test and Sample Directories  
- [ ] Extract good examples for examples.md