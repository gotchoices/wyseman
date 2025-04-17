# Contributing to Wyseman

[Prev](future.md) | [TOC](README.md)

This guide provides information on how to contribute to the Wyseman project, part of the WyattERP ecosystem.

## Project Overview

Wyseman is an open-source PostgreSQL schema management tool developed by the [GotChoices Foundation](https://gotchoices.org). It is part of a larger ecosystem that includes:

- **[Wyseman](https://github.com/gotchoices/wyseman)**: Schema authoring and management
- **[Wylib](https://github.com/gotchoices/wylib)**: Vue.js UI component library
- **[Wyselib](https://github.com/gotchoices/wyselib)**: Reusable SQL objects library
- **[Wyclif](https://github.com/gotchoices/wyclif)**: Client interface framework

These components work together to create business applications, with [MyCHIPs](https://github.com/gotchoices/mychips) being the flagship project that uses the complete WyattERP stack.

## Ways to Contribute

### Reporting Issues

If you encounter any bugs, have feature requests, or need help with Wyseman:

1. Check the [Issues](https://github.com/gotchoices/wyseman/issues) page to see if your issue has already been reported.
2. If not, create a new issue with a descriptive title and detailed information:
   - Steps to reproduce the problem
   - Expected behavior
   - Actual behavior
   - Your environment (OS, PostgreSQL version, Node.js version)
   - Any relevant logs or error messages

### Contributing Code

#### Setting Up Your Development Environment

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/your-username/wyseman.git
   cd wyseman
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Ensure you have PostgreSQL installed and running
5. Run the tests to make sure everything is working:
   ```bash
   npm test
   ```

#### Making Changes

1. Create a new branch for your feature or bugfix:
   ```bash
   git checkout -b feature/your-feature-name
   ```
   or
   ```bash
   git checkout -b fix/issue-description
   ```

2. Make your changes, following the code style and practices used in the project
3. Add appropriate tests for your changes
4. Run the tests to ensure everything still works:
   ```bash
   npm test
   ```
5. Update documentation as needed

#### Submitting Changes

1. Commit your changes with clear, descriptive commit messages:
   ```bash
   git commit -m "Add feature: description of your feature"
   ```
2. Push your branch to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
3. Create a Pull Request (PR) from your fork to the main Wyseman repository
4. In your PR description, explain the changes you've made and why they should be included

### Documentation Contributions

Documentation is a critical part of Wyseman. You can help by:

1. Improving existing documentation
2. Adding missing information or clarifying unclear sections
3. Providing examples of real-world usage
4. Fixing typos or formatting issues

Documentation is located in the `/doc` directory and written in Markdown.

## Development Guidelines

### Code Style

- Follow the existing code style in the project
- Use meaningful variable and function names
- Include comments for complex logic
- Keep functions focused on a single responsibility

### Testing

Before submitting your changes, ensure:

1. All tests pass with `npm test`
2. New features include appropriate test coverage
3. No regressions are introduced for existing functionality

### Documentation

When adding or modifying features:

1. Update relevant documentation files
2. Include code examples where appropriate
3. Document any schema file formats or command-line options

## TCL Development

Since Wyseman uses TCL for schema parsing, TCL development may be required for certain contributions:

1. Understand the basics of TCL syntax
2. Familiarize yourself with the existing TCL parsing code in `lib/wmparse.tcl`
3. Maintain compatibility with existing schema files

## Git Workflow

We follow a standard Git workflow:

1. Fork the repository
2. Create feature/bugfix branches
3. Submit Pull Requests to the main repository
4. Code review by maintainers
5. Merge to main branch upon approval

## Community and Communication

Join the Wyseman and WyattERP community:

- GitHub Issues: For bug reports and feature discussions
- GitHub Pull Requests: For code contributions
- Star the repository to show your support

### MyCHIPs and Wider Ecosystem

Wyseman is a core component of the MyCHIPs project, which aims to create a digital value exchange system. Contributing to Wyseman helps advance the larger goal of creating open-source business application infrastructure.

To learn more about the MyCHIPs project and how Wyseman fits into it, visit the [MyCHIPs repository](https://github.com/gotchoices/mychips).

## License

Wyseman is released under the MIT License. By contributing to Wyseman, you agree to license your contributions under the same license.

Thank you for contributing to Wyseman and helping make it better for everyone!

[Prev](future.md) | [TOC](README.md)