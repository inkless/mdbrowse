# Sample Project

A sample markdown corpus for `mdbrowse` end-to-end tests. The fixtures here
exercise the features we care about end-to-end: layout, syntax highlighting,
custom plugins, and the file-tree sidebar.

## Code

```ts
export function greet(name: string): string {
  return `Hello, ${name}`;
}
```

## Alerts

> [!NOTE]
> This is an informational alert. It should render with the GitHub
> markdown-alert styling.

> [!WARNING]
> This one should use the warning variant.

## Issue references

See `#42` for context (this should turn into a link when a repository is
configured).

## More pages

- [Guide](docs/guide.md)
- [Changelog](docs/changelog.md)
