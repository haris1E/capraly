# Contributing to Capraly

Thank you for your interest in contributing to Capraly! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and constructive in all interactions.

## How to Contribute

### 1. Fork the Repository
```bash
git clone https://github.com/haris1E/capraly.git
cd capraly
```

### 2. Create a Feature Branch
```bash
git checkout -b feature/your-feature-name
```

### 3. Make Your Changes
- Follow the existing code style
- Write meaningful commit messages
- Add tests for new functionality

### 4. Commit Your Changes
```bash
git add .
git commit -m "feat: add your feature description"
```

### 5. Push to Your Fork
```bash
git push origin feature/your-feature-name
```

### 6. Submit a Pull Request
- Provide a clear description of your changes
- Reference any related issues
- Ensure all tests pass

## Development Setup

### Prerequisites
- Node.js 18+
- Bun or npm

### Installation
```bash
bun install
```

### Running Locally
```bash
bun run dev
```

### Running Tests
```bash
bun run test
```

### Building
```bash
bun run build
```

## Coding Standards

- Use TypeScript for all code
- Follow ESLint configuration
- Use Tailwind CSS for styling
- Keep components small and focused
- Write descriptive variable and function names

## Git Commit Messages

Use conventional commits:
- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation
- `style:` for formatting
- `refactor:` for code refactoring
- `test:` for tests
- `chore:` for maintenance

Example: `feat: add user authentication module`

## Pull Request Process

1. Update documentation as needed
2. Add tests for new functionality
3. Ensure all tests pass locally
4. Request review from maintainers
5. Address feedback and update PR
6. Once approved, maintainers will merge

## Reporting Issues

Use GitHub Issues to report bugs or suggest features. Include:
- Clear description
- Steps to reproduce (for bugs)
- Expected vs actual behavior
- Environment details

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

Thank you for contributing to Capraly! 🎉
