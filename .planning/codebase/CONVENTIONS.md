# CONVENTIONS.md — Code Conventions & Patterns

## Backend (Node.js/Express)

### Module System
- CommonJS throughout: `require()` / `module.exports`
- No ES modules in backend

### Route Files Pattern

```js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { validate, sanitize } = require('../middleware/validate');

router.use(authenticateToken); // protect all routes below

router.get('/', async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        // ...
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
```

### User ID Extraction

```js
const userId = req.user?.userId || req.user?.id;
```
Both forms exist in the codebase — always use both with optional chaining.

### API Response Format

```js
// Success
res.json({ success: true, data: {...} })
res.json({ success: true, message: 'Done' })

// Error
res.status(4xx/5xx).json({ success: false, error: 'message' })
```

### Database Queries

```js
const { query } = require('../config/database');

// Parameterized queries always (never string interpolation)
const result = await query(
    'SELECT * FROM table WHERE user_id = $1',
    [userId]
);
const rows = result.rows;
```

### Validation Pattern

```js
const Joi = require('joi');
const { validate, sanitize } = require('../middleware/validate');

router.post('/',
    sanitize,                      // strip XSS from body
    validate(Joi.object({...})),   // validate body
    handler
);

// For params:
validate(schema, 'params')
// For query:
validate(schema, 'query')
```

### Service Files

Services export async functions, no class instances:

```js
const doSomething = async (userId, data) => {
    // business logic
    return result;
};

module.exports = { doSomething };
```

### Error Handling

- Route handlers: try/catch → `res.status(500).json({ success: false, error: error.message })`
- Services: throw errors, let routes handle
- Global error handler in `src/middleware/errorHandler.js`

### Naming Conventions (Backend)

- Files: camelCase (`backupService.js`, `emailService.js`)
- Routes: kebab-case URL paths (`/api/v1/backup-schedule`)
- DB tables: snake_case
- JS variables/functions: camelCase

## Frontend (Next.js/TypeScript)

### Component Pattern

```tsx
'use client'; // only when needed

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export default function PageComponent() {
    const { data, isLoading } = useQuery({
        queryKey: ['resource'],
        queryFn: () => api.getResource()
    });

    return <div>...</div>;
}
```

### API Calls

All API calls go through `wpma-frontend/lib/api.ts`:

```ts
import { api } from '@/lib/api';
// or specific named exports
```

### Auth State

```ts
import { useAuthStore } from '@/lib/auth-store';
const { user, token, logout } = useAuthStore();
```

### Naming Conventions (Frontend)

- Components: PascalCase files and exports
- Pages: `page.tsx` (Next.js convention)
- Layouts: `layout.tsx`
- Utilities: camelCase
- Types: PascalCase interfaces

### Tailwind Usage

Utility classes directly in JSX. No CSS modules. `clsx` for conditionals:

```tsx
import { clsx } from 'clsx';
<div className={clsx('base-class', isActive && 'active-class')} />
```

## Git Conventions

- Commit style: `feat:`, `fix:`, `chore:`, `docs:` prefixes observed in history
- Branch: `main` is the primary branch
