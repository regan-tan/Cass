# React Components

This directory contains all React components that make up the user interface of the IKIAG application. The components are organized by functionality and follow a hierarchical structure from page-level views down to reusable UI elements.

## Architecture Overview

The component structure follows a clear separation of concerns:

- **Page Components**: Top-level views that represent different application states
- **Shared Components**: Reusable components used across multiple views
- **UI Components**: Low-level building blocks from the Shadcn UI library
- **Icon Components**: SVG-based icons for consistent visual language

## Component Organization

### Page Components (View States)

#### `initial/index.tsx`

The landing view displayed when the application starts or is reset:

- **Screenshot queue display**: Shows current screenshots with preview thumbnails
- **Onboarding guidance**: Helps new users understand how to take their first screenshot
- **Tooltip integration**: Configuration interface for API keys and model selection
- **Dynamic sizing**: Automatically adjusts window dimensions based on content
- **Event handling**: Listens for screenshot events and view state changes
- **Query management**: Uses TanStack Query for real-time screenshot data

#### `response/index.tsx`

Displays AI-generated responses after processing:

- **Markdown rendering**: Rich text display with syntax highlighting for code blocks
- **Response formatting**: Proper typography and spacing for readability
- **Action buttons**: Options to continue conversation or start new session
- **Loading states**: Visual feedback during AI processing
- **Error handling**: Graceful display of processing errors
- **Context preservation**: Maintains conversation history for follow-ups

#### `follow-up/index.tsx`

Handles additional context and follow-up interactions:

- **Previous context display**: Shows the ongoing conversation history
- **New input handling**: Accepts additional screenshots and context
- **Conversation flow**: Maintains threaded conversation structure
- **Context management**: Builds upon previous AI responses
- **Dynamic content**: Adapts interface based on conversation length

#### `main/index.tsx`

Central coordinator component that manages view transitions:

- **View state management**: Controls which page component is displayed
- **Global event handling**: Coordinates application-wide events and shortcuts
- **Layout management**: Provides consistent container and positioning
- **State persistence**: Maintains application state across view changes
- **Window controls**: Handles dragging, resizing, and positioning

### Shared Components

#### `Commands.tsx`

Interactive command palette and help system:

- **Shortcut display**: Visual representation of all available keyboard shortcuts
- **Contextual help**: Shows relevant commands based on current application state
- **Interactive elements**: Clickable commands that trigger their respective actions
- **Configuration access**: Quick access to settings and preferences
- **Visual hierarchy**: Clear organization of commands by category and importance

#### `shared/` Directory

Contains reusable components used across multiple views:

- **Layout components**: Headers, containers, and structural elements
- **Form elements**: Input fields, buttons, and controls
- **Display components**: Lists, cards, and content containers
- **Utility components**: Loading spinners, error messages, and notifications

### UI Components (`ui/` Directory)

Based on the Shadcn UI component library, providing:

- **Button variants**: Primary, secondary, ghost, and destructive button styles
- **Input components**: Text fields, textareas, and form controls
- **Navigation elements**: Tabs, menus, and breadcrumbs
- **Feedback components**: Alerts, toasts, and progress indicators
- **Layout utilities**: Grids, flexbox helpers, and spacing components
- **Typography**: Consistent text styles and heading hierarchy

### Icon Components (`icons/` Directory)

SVG-based icon system that provides:

- **Consistent styling**: Unified size, color, and visual treatment
- **Accessibility**: Proper ARIA labels and semantic markup
- **Performance**: Optimized SVG code for fast rendering
- **Customization**: Easy theming and color adaptation
- **Scalability**: Vector-based icons that scale at any resolution

## Component Patterns

### State Management

- **Local state**: Component-specific state using React hooks
- **Global state**: Shared state managed at the App level
- **Event-driven updates**: Real-time updates via Electron IPC events
- **Query synchronization**: TanStack Query for server state management

### Event Handling

- **IPC communication**: Direct communication with Electron main process
- **Event cleanup**: Proper listener cleanup to prevent memory leaks
- **Error boundaries**: Graceful error handling and user feedback
- **Keyboard shortcuts**: Global and component-specific shortcut handling

### Performance Optimization

- **Memoization**: React.memo and useMemo for expensive operations
- **Lazy loading**: Dynamic imports for large components
- **Virtualization**: Efficient rendering of large lists
- **Debouncing**: Optimized user input handling

### Accessibility

- **Keyboard navigation**: Full keyboard accessibility support
- **Screen readers**: Proper ARIA labels and semantic HTML
- **Focus management**: Logical tab order and focus indicators
- **Color contrast**: WCAG-compliant color schemes

## Data Flow

### Component Communication

1. **Props drilling**: Parent-to-child data passing for simple cases
2. **Event bubbling**: Child-to-parent communication via callbacks
3. **Context providers**: Shared state for component trees
4. **IPC events**: Communication with the main process

### Lifecycle Management

1. **Component mounting**: Initialization and event listener setup
2. **Update cycles**: Efficient re-rendering based on state changes
3. **Cleanup**: Proper resource cleanup on component unmount
4. **Error recovery**: Graceful handling of component errors

## Development Guidelines

### Component Structure

- **Single responsibility**: Each component has a clear, focused purpose
- **Composition over inheritance**: Build complex UI through component composition
- **Props interface**: Well-defined TypeScript interfaces for all props
- **Default values**: Sensible defaults for optional props

### Styling Approach

- **Tailwind CSS**: Utility-first styling for rapid development
- **Component variants**: Configurable component appearances
- **Responsive design**: Mobile-first responsive design principles
- **Theme consistency**: Consistent use of design tokens and variables

### Testing Strategy

- **Unit testing**: Individual component testing with Jest and React Testing Library
- **Integration testing**: Component interaction testing
- **Visual testing**: Screenshot comparison for UI consistency
- **Accessibility testing**: Automated accessibility compliance checking
