# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# First-time setup (install deps + generate Prisma client + run migrations)
npm run setup

# Development server (Turbopack)
npm run dev

# Development server as background daemon (logs to logs.txt)
npm run dev:daemon

# Build
npm run build

# Lint
npm run lint

# Run all tests
npm test

# Run a single test file
npx vitest run src/lib/__tests__/file-system.test.ts

# Reset database (destructive)
npm run db:reset
```

### Environment

Copy `.env` and set `ANTHROPIC_API_KEY`. Without it the app runs with a `MockLanguageModel` that returns static components instead of calling Claude.

## Architecture

UIGen is a Next.js 15 App Router app that lets users describe React components in a chat interface, then generates and live-previews them using Claude.

### Request / Response flow

1. User types a prompt in `ChatInterface` → submitted via `useChat` (Vercel AI SDK) to `POST /api/chat`
2. `route.ts` deserializes the virtual file system from the request body, calls `streamText` with two tools (`str_replace_editor`, `file_manager`), and streams the response back
3. The AI SDK fires `onToolCall` callbacks on the client side; `FileSystemContext.handleToolCall` applies the tool operations to the in-memory `VirtualFileSystem`
4. `PreviewFrame` re-renders on every `refreshTrigger` increment: it transforms all files with Babel (`jsx-transformer.ts`), creates blob URLs, builds an ES module import map, and writes the resulting HTML into a sandboxed `<iframe>` via `srcdoc`

### Virtual File System (`src/lib/file-system.ts`)

`VirtualFileSystem` is an in-memory tree of `FileNode` objects (no disk I/O). It supports create/read/update/delete/rename, serializes to `Record<string, FileNode>` for JSON transport, and is reconstructed from that shape on both client and server.

### Preview pipeline (`src/lib/transform/jsx-transformer.ts`)

- `transformJSX`: uses `@babel/standalone` to compile TSX/JSX in the browser
- `createImportMap`: iterates all VFS files, transforms each, creates blob URLs, and builds a `<script type="importmap">` that maps imports (including `@/` aliases and third-party packages via `esm.sh`) to blob URLs
- `createPreviewHTML`: produces the full HTML document injected into the iframe; includes Tailwind CDN, collected CSS, the import map, and a React error boundary

### AI tools

- `str_replace_editor` (`src/lib/tools/str-replace.ts`): exposes `view`, `create`, `str_replace`, and `insert` commands that operate on the `VirtualFileSystem`
- `file_manager` (`src/lib/tools/file-manager.ts`): exposes `rename` and `delete`

### State management

Two React contexts wrap the workspace:

- `FileSystemContext` (`src/lib/contexts/file-system-context.tsx`): owns the `VirtualFileSystem` instance, exposes mutation helpers, and routes AI tool calls to the right VFS operations
- `ChatContext` (`src/lib/contexts/chat-context.tsx`): wraps the Vercel AI SDK `useChat` hook; passes the serialized VFS on every request so the server can reconstruct it

### Persistence

- **Anonymous users**: chat messages and VFS state are saved to `sessionStorage` via `anon-work-tracker.ts`
- **Authenticated users**: on stream finish, `route.ts` serializes messages and VFS data and writes them to the `Project` model in SQLite via Prisma. `Project.messages` and `Project.data` are JSON strings.

### Auth

JWT-based sessions (`jose`), stored as `httpOnly` cookies. `src/lib/auth.ts` is `server-only`. `src/middleware.ts` protects `/api/projects` and `/api/filesystem` routes.

### Provider fallback

`src/lib/provider.ts` exports `getLanguageModel()`: returns a real `anthropic("claude-haiku-4-5")` model when `ANTHROPIC_API_KEY` is set, otherwise returns `MockLanguageModel` which streams pre-baked component code without calling any API.

## Database

The database schema is defined in `prisma/schema.prisma`. Reference it anytime you need to understand the structure of data stored in the database.

## Code Style

Use comments sparingly. Only comment complex code.

## Testing

Tests use Vitest + jsdom + React Testing Library. Test files live alongside source in `__tests__/` subdirectories. The vitest config (`vitest.config.mts`) uses `vite-tsconfig-paths` so `@/` imports resolve correctly in tests.
