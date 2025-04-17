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
- [x] Reviewed
- [x] Finalized
- **Notes**: Completed comprehensive documentation with:
  - Detailed documentation for all active tools in bin/ directory
  - Practical usage examples for each command line tool
  - Cross-references to other documentation sections (e.g., versioning)
  - Identified deprecated tools (ticket, erd, wysegi)
  - Enhanced wmdump/wmrestore explanations showing advantages over pg_dump
  - Added detailed examples for language tools with reference to MyCHIPs usage
  - Added details on JSON configuration via Wyseman.conf
  - Added environment variables documentation
  - Added integration examples with Make and npm scripts
  - Reorganized into logical sections (Main Command, Node.js Tools, Shell Utilities, Legacy Tools)

### 8. Versioning System
- [x] Outline created
- [x] Research completed
- [x] First draft written
- [x] Reviewed
- [x] Finalized
- **Notes**: Completed with comprehensive information about:
  - The versioning architecture and implementation details
  - Structure of Wyseman.hist, Wyseman.delta, and schema files
  - Schema release lifecycle (development, release, upgrade)
  - Detailed explanation of table data migration process and implementation
  - Technical implementation (Schema.js, Migrate.js, History.js)
  - Current limitations and future enhancement opportunities
  - Examples of complete versioning workflows
  - Best practices for schema versioning

### 9. Runtime Support
- [x] Outline created
- [x] Research completed
- [x] First draft written
- [x] Reviewed
- [x] Finalized
- **Notes**: Completed comprehensive documentation covering:
  
  **Key Components**:
  - Server-side components (Wyseman, Handler, DbClient)
  - Client-side components (client_ws.js, client_msg.js)
  - Support libraries (lang_cache.js, meta_cache.js)
  
  **Features Documented**:
  - Complete architecture overview with communication flow
  - API details for server-side and client-side usage
  - Authentication methods (tokens and key-based)
  - Data operations (CRUD) with examples
  - Language and metadata support
  - Real-time updates via PostgreSQL notifications
  - Advanced features (caching, binary data, JSON support)
  - Integration examples for both browser and Node.js
  - Error handling patterns
  - Best practices for using the runtime API
  - Detailed query format and where clause syntax documentation

  **Research Performed**:
  - Analyzed core JavaScript files (handler.js, wyseman.js, dbclient.js, client_ws.js)
  - Studied test examples, especially client.js for connection patterns
  - Documented security implementation and authentication flow
  - Created practical code examples for all major operations
  - Documented all supported where clause formats with examples

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
- [x] Reviewed
- [x] Finalized
- **Notes**: Completed documentation of Wyseman's development history from TCL to Ruby to JavaScript implementations.

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
   - Completed: Comprehensive documentation of active tools in bin/
   - Completed: Added detailed usage examples for all tools
   - Completed: Identified and documented legacy/deprecated tools
   - Completed: Documented environment variables and configuration options
3. ✅ Understand schema file formats from test/schema/ examples
   - Completed: Documented .wms, .wmt, .wmd, .wmi file formats
   - Completed: Created schema authoring guide with all TCL keywords
4. 🔄 Extract runtime API details from lib/handler.js and related files
   - Pending: Need to analyze JavaScript API for runtime support
   - Next priority after versioning review
5. ✅ Document versioning system based on doc/Versions.md and implementation
   - Completed: Studied code in schema.js, migrate.js, and history.js
   - Completed: Analyzed test examples in migrate.js and versions.js
   - Completed: Drafted comprehensive versioning documentation (awaiting review)
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
       
8. 🆕 Update Command Line Tools documentation
   - In progress: Analyzing each tool in bin/ directory
   - In progress: Adding detailed descriptions and examples
   - Planned: Document connection between CLI tools and schema management workflow

## Documentation Plan Timeline

1. ✅ **Phase 1**: Complete outlines for all sections (Estimated: 1 week)
   - Completed: Table of contents created in README.md
   - Completed: Structure for all sections established
2. ✅ **Phase 2**: Research and first drafts of core sections (1-7) (Estimated: 2 weeks)
   - Completed: Introduction, Installation, Basic Concepts
   - Completed: Schema Authoring with all TCL keywords and features
   - Completed: Schema File Reference, Command Line Tools
   - Completed: First draft of Versioning System (awaiting review)
3. 🔄 **Phase 3**: Research and first drafts of remaining sections (8-15) (Estimated: 2 weeks)
   - In Progress: 2/8 completed (Project History, Contributing)
   - Next priority: Runtime Support and API Reference
   - Pending: Security, Examples, Troubleshooting, Future Development
4. 🔄 **Phase 4**: Documentation Migration and Restructuring (Estimated: 1 week)
   - Pending: Create new GitHub README.md for project root
   - Pending: Move old documentation to doc/old/ directory
   - Pending: Final review to ensure all important information is preserved
5. **Phase 5**: Review, revision, and finalization (Estimated: 1 week)
   - Completed reviews: Introduction, Installation, Basic Concepts, Schema Authoring, Schema Files, Command Reference, Command Line Tools

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
  - Complete coverage of all active tools with detailed examples
  - Identified deprecated tools and recommended alternatives
  - Added environment variables and configuration options
  - Added integration examples with Make and npm scripts
- Created complete reference of schema file formats (.wms, .wmt, .wmd, .wmi)
- Documented all TCL keywords used in schema files
- Added detailed Schema Command Reference with syntax and examples for all commands
- Added documentation for TCL evaluation features (eval/expr/subst)
- Created schema authoring guide with examples
- Completed extensive research on versioning system
  - Analyzed source code in schema.js, migrate.js, history.js
  - Studied test examples and workflows
  - Documented limitations and potential enhancements
- Added detailed installation instructions
- Created project history documentation
- Added contributing guidelines with development setup and workflow

## Current Focus

- Moving to the next sections of documentation:
  - Planning and research for Connection Protocols section
  - Preparing for API Reference documentation
  - Analyzing security model for Security section

## Documentation Context for Future Sessions

- Runtime Section: Completed with comprehensive API documentation and query format details
- Important files analyzed: 
  - handler.js: Implements SQL query generation from JSON
  - wyseman.js: Main server implementation with WebSocket handling
  - dbclient.js: Database connection and query execution
  - client_ws.js: Client-side connection with authentication
- The `where` clause formats are fully documented in runtime.md
- Next logical sections: Connection Protocols and API Reference

## Pending Tasks

- Create Connection Protocols documentation
- Develop comprehensive API Reference section
- Document security model and authentication flows
- Complete Examples section with real-world usage patterns
- Develop Troubleshooting guide
- Create Future Development roadmap
- Create new GitHub README.md as a landing page
- Finalize migration of old documentation
- Document integration with WyattERP suite
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