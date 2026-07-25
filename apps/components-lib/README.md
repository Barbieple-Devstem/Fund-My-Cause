# @fund-my-cause/components

Shared UI component library for Fund-My-Cause frontend applications.

## Installation

```bash
npm install @fund-my-cause/components
```

## Components

### Button

Versatile button component with multiple variants and sizes.

```tsx
import { Button } from "@fund-my-cause/components";

<Button variant="primary" size="md">
  Click me
</Button>
```

**Props:**
- `variant`: "primary" | "secondary" | "outline" | "ghost" | "danger"
- `size`: "sm" | "md" | "lg"
- `isLoading`: boolean
- `fullWidth`: boolean

### Input

Form input with label, error, and helper text support.

```tsx
import { Input } from "@fund-my-cause/components";

<Input
  label="Email"
  type="email"
  error="Invalid email"
  helperText="Enter a valid email address"
/>
```

**Props:**
- `label`: string
- `error`: string
- `helperText`: string
- `fullWidth`: boolean

### Modal

Accessible modal dialog component.

```tsx
import { Modal, Button } from "@fund-my-cause/components";

<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Confirm Action"
  footer={<Button onClick={() => setIsOpen(false)}>Close</Button>}
>
  Are you sure?
</Modal>
```

**Props:**
- `isOpen`: boolean
- `onClose`: () => void
- `title`: string
- `size`: "sm" | "md" | "lg" | "xl"
- `closeOnBackdropClick`: boolean

### Card

Container component for content grouping.

```tsx
import { Card } from "@fund-my-cause/components";

<Card hoverable padding="lg">
  <Card.Header>Title</Card.Header>
  <Card.Body>Content</Card.Body>
  <Card.Footer>Footer</Card.Footer>
</Card>
```

**Props:**
- `hoverable`: boolean
- `padding`: "sm" | "md" | "lg"

### ProgressBar

Visual progress indicator.

```tsx
import { ProgressBar } from "@fund-my-cause/components";

<ProgressBar progress={65} animated showLabel color="indigo" />
```

**Props:**
- `progress`: number (0-100)
- `animated`: boolean
- `showLabel`: boolean
- `color`: "indigo" | "green" | "blue" | "red"

## Prop Naming Conventions

To maintain consistency across the component library, follow these naming patterns:

### Boolean Props
- Use `is*` prefix for state-like booleans: `isOpen`, `isLoading`, `isDisabled`
- Use `*` or `has*` for feature flags: `disabled`, `required`, `hasError`

### Event Handler Props
- Use `on*` prefix with camelCase action: `onClick`, `onClose`, `onSubmit`, `onChange`

### Size & Variant Props
- Use explicit names: `size`, `variant`, `color`, `padding`
- Values are lowercase or kebab-case

### Other Props
- Use clear, descriptive names
- Avoid abbreviations unless standard (e.g., `aria-*` for ARIA attributes)

## Styling

All components use Tailwind CSS for styling. Ensure Tailwind CSS is configured in your project.

## Accessibility

All components follow WAI-ARIA guidelines and include:
- Semantic HTML
- ARIA labels and roles
- Keyboard navigation support
- Focus management

## Development

```bash
# Build
npm run build

# Watch mode
npm run dev

# Lint
npm run lint

# Test
npm run test
```
