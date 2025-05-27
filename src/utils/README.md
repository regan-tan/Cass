# Frontend Utility Functions

This directory contains utility functions and helper modules specifically designed for the frontend (renderer process) of the IKIAG application. These utilities provide common functionality, data transformations, and platform-specific logic used throughout the React components and application logic.

## Purpose

Frontend utilities serve to:

- **Abstract common operations**: Encapsulate frequently used logic into reusable functions
- **Platform detection**: Handle platform-specific behaviors and UI adaptations
- **Data transformation**: Convert data between different formats for display and processing
- **API integration**: Simplify communication with the Electron main process
- **Performance optimization**: Provide efficient implementations of common operations

## Utility Files

### `screenshots.ts`

Handles screenshot-related operations and data management for the UI:

#### Core Functions

- **`fetchScreenshots()`**: Retrieves current screenshot queue from the main process
  - **Error handling**: Graceful handling of IPC communication failures
  - **Data transformation**: Converts main process data to frontend-friendly format
  - **Type safety**: Returns properly typed `Screenshot[]` arrays
  - **Fallback behavior**: Returns empty array on errors to prevent UI crashes

#### Data Flow

1. **IPC Communication**: Calls `window.electronAPI.getScreenshots()`
2. **Response Processing**: Handles different response formats from main process
3. **Data Normalization**: Ensures consistent data structure for UI components
4. **Type Conversion**: Maps raw data to `Screenshot` interface format
5. **Error Boundaries**: Catches and logs errors without breaking the UI

#### Integration Points

- **TanStack Query**: Used as the primary data fetching function for screenshot queries
- **React Components**: Called by components displaying screenshot galleries
- **Real-time Updates**: Triggered by IPC events when screenshot queues change
- **State Management**: Integrated with React Query cache for efficient updates

### `platform.ts`

Provides platform detection and platform-specific utility functions:

#### Platform Detection

- **Operating system identification**: Detects macOS, Windows, and Linux
- **Architecture detection**: Identifies ARM64 vs x64 architectures
- **Browser environment**: Distinguishes between Electron and web browser contexts
- **Version detection**: Identifies specific OS versions for feature compatibility

#### Platform-Specific Logic

- **Keyboard shortcuts**: Platform-appropriate modifier key display (Cmd vs Ctrl)
- **File path handling**: Platform-specific path separators and conventions
- **UI adaptations**: Platform-specific styling and behavior adjustments
- **Feature availability**: Conditional feature enabling based on platform capabilities

#### Usage Patterns

```typescript
// Example usage patterns
const isMac = getPlatform() === "darwin";
const shortcutKey = isMac ? "Cmd" : "Ctrl";
const pathSeparator = getPlatformPathSeparator();
```

## Utility Patterns

### Pure Functions

- **No side effects**: Functions don't modify external state
- **Predictable outputs**: Same input always produces same output
- **Testable**: Easy to unit test in isolation
- **Composable**: Can be combined to create more complex operations

### Error Handling

- **Graceful degradation**: Functions handle errors without crashing the application
- **Logging**: Comprehensive error logging for debugging
- **Fallback values**: Sensible defaults when operations fail
- **Type safety**: TypeScript ensures proper error type handling

### Performance Considerations

- **Memoization**: Expensive operations are cached where appropriate
- **Lazy evaluation**: Functions only execute when needed
- **Minimal dependencies**: Keep utility functions lightweight
- **Efficient algorithms**: Use optimal approaches for common operations

## Integration with Application Architecture

### React Integration

- **Custom hooks**: Many utilities are wrapped in custom React hooks
- **Component helpers**: Functions specifically designed for component logic
- **State transformations**: Convert between different state representations
- **Event handling**: Utilities for processing user interactions

### IPC Communication

- **Main process bridges**: Simplified interfaces for main process communication
- **Event handling**: Utilities for managing main-to-renderer events
- **Data serialization**: Handle data conversion between processes
- **Error propagation**: Proper error handling across process boundaries

### Third-Party Libraries

- **TanStack Query integration**: Custom query functions and key generators
- **React Router utilities**: Navigation and route management helpers
- **Styling helpers**: Utilities for dynamic class generation and theming
- **Animation utilities**: Helpers for Framer Motion and other animation libraries

## Development Guidelines

### Function Design

- **Single responsibility**: Each function has one clear purpose
- **Clear naming**: Function names clearly describe their purpose
- **Parameter validation**: Input validation for robust error handling
- **Documentation**: JSDoc comments for complex functions

### Code Organization

- **Logical grouping**: Related functions grouped in the same file
- **Export patterns**: Clear module exports with named exports preferred
- **Dependency management**: Minimal external dependencies
- **Type definitions**: Comprehensive TypeScript typing

### Testing Strategy

- **Unit tests**: Individual function testing with Jest
- **Integration tests**: Testing utility functions with React components
- **Mock strategies**: Proper mocking of external dependencies
- **Coverage goals**: High test coverage for critical utility functions

## Best Practices

### Code Quality

- **ESLint compliance**: Follow project linting rules
- **TypeScript strict mode**: Use strict TypeScript configuration
- **Code formatting**: Consistent formatting with Prettier
- **Documentation**: Keep documentation current with code changes

### Performance

- **Avoid premature optimization**: Focus on correctness first
- **Profile when needed**: Use performance tools to identify bottlenecks
- **Memory management**: Prevent memory leaks in long-running functions
- **Bundle size**: Keep utilities lightweight to minimize bundle size

### Maintainability

- **Regular refactoring**: Keep code clean and up-to-date
- **Breaking changes**: Document and communicate breaking changes
- **Version compatibility**: Maintain backward compatibility where possible
- **Migration guides**: Provide clear migration paths for major changes
