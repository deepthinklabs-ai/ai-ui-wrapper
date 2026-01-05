# Contributing to aiuiw

First off, thank you for considering contributing to aiuiw! It's people like you who make aiuiw a great tool for the community.

## Contributor License Agreement (CLA)

**Before your contribution can be accepted, you must agree to our [Contributor License Agreement](CLA.md).**

When you submit your first pull request, include this statement in your PR description:

> I have read the CLA and I hereby sign the CLA.

This is a one-time requirement. The CLA ensures that:
- You have the right to submit the contribution
- We can continue to maintain and evolve the project
- Both you and the project are legally protected

## Ways to Contribute

### Report Bugs

Found a bug? Please open an issue with:
- A clear, descriptive title
- Steps to reproduce the issue
- Expected vs actual behavior
- Screenshots if applicable
- Your environment (OS, browser, Node version)

### Suggest Features

Have an idea? We'd love to hear it! Open a discussion or issue with:
- A clear description of the feature
- The problem it solves
- Any implementation ideas you have

### Submit Code

Ready to code? Here's how:

1. **Fork the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/ai-ui-wrapper.git
   cd ai-ui-wrapper
   ```

2. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

3. **Install dependencies**
   ```bash
   cd apps/web
   npm install
   ```

4. **Make your changes**
   - Write clean, readable code
   - Follow the existing code style
   - Add comments for complex logic
   - Update documentation if needed

5. **Test your changes**
   ```bash
   npm run lint
   npm run build
   ```

6. **Commit with clear messages**
   ```bash
   git commit -m "feat: add new canvas node type for webhooks"
   # or
   git commit -m "fix: resolve race condition in message loading"
   ```

7. **Push and open a PR**
   ```bash
   git push origin feature/your-feature-name
   ```

## Code Style Guide

### TypeScript

- Use TypeScript strict mode
- Define explicit types (avoid `any`)
- Use interfaces for object shapes
- Export types from dedicated files in `src/types/`

### React

- Functional components with hooks
- Custom hooks for reusable logic (place in `src/hooks/`)
- Feature-based directory structure
- Keep components focused and small

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `MessageComposer.tsx` |
| Hooks | camelCase with `use` prefix | `useMessages.ts` |
| Utilities | camelCase | `formatDate.ts` |
| Types | PascalCase | `ChatMessage`, `CanvasNode` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_TOKEN_LIMIT` |

### File Structure

```
src/
├── app/                 # Next.js pages and API routes
├── components/          # Reusable UI components
│   └── feature-name/    # Feature-specific components
├── hooks/               # Custom React hooks
├── lib/                 # Utilities and services
│   ├── services/        # Business logic
│   └── config/          # Configuration
└── types/               # TypeScript definitions
```

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new feature
fix: resolve bug
docs: update documentation
style: formatting changes
refactor: code restructuring
test: add or update tests
chore: maintenance tasks
```

## Pull Request Process

1. **Keep PRs focused** — One feature or fix per PR
2. **Write a clear description** — Explain what and why
3. **Reference issues** — Link related issues with `Fixes #123`
4. **Sign the CLA** — Include the CLA statement in your first PR
5. **Respond to feedback** — We may request changes
6. **Be patient** — We review PRs as quickly as we can

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## How Has This Been Tested?
Describe how you tested your changes

## Checklist
- [ ] I have read the CLA and I hereby sign the CLA
- [ ] My code follows the project's style guidelines
- [ ] I have performed a self-review of my code
- [ ] I have added comments where necessary
- [ ] My changes generate no new warnings
```

## Development Setup

### Prerequisites

- Node.js 18+
- npm, yarn, or pnpm
- Git

### Environment Setup

1. Copy the environment template:
   ```bash
   cp apps/web/.env.example apps/web/.env.local
   ```

2. Fill in required values (see README for details)

3. Start the development server:
   ```bash
   cd apps/web
   npm run dev
   ```

### Useful Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run lint     # Run ESLint
npm run start    # Start production server
```

## Getting Help

- **Questions?** Open a discussion on GitHub
- **Stuck?** Ask in an issue — we're happy to help
- **Chat?** Join our community (coming soon)

## Recognition

Contributors are recognized in:
- The Contributors section on GitHub
- Release notes for significant contributions
- Our website's community page (for major contributors)

---

Thank you for contributing to aiuiw! Together, we're building the future of AI interaction.
