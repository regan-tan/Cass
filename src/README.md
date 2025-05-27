# Frontend Source (Renderer Process)

This directory contains the React-based frontend application that runs in the Electron renderer process. The UI provides an intuitive interface for interacting with the AI assistant, managing screenshots, and displaying responses.

## Architecture Overview

The frontend follows a component-based architecture with:

- **React 18** for UI rendering and state management
- **TypeScript** for type safety and better development experience
- **TanStack Query** for efficient data fetching and caching
- **Tailwind CSS** with Shadcn UI components for styling
- **Framer Motion** for smooth animations and transitions

## Root Files

### `App.tsx`

The main application root component that:

- **Sets up global providers**: QueryClient for data fetching, routing context
- **Manages initialization state**: Ensures proper app startup sequence
- **Provides layout structure**: Transparent background for overlay functionality
- **Coordinates global state**: Central hub for application-wide state management

### `main.tsx`

The React application entry point that:

- **Mounts the React app**: Renders the root App component into the DOM
- **Handles hydration**: Ensures proper connection between React and the Electron environment
- **Sets up development tools**: React DevTools integration in development mode

### `index.css`

Global styles that:

- **Imports Tailwind CSS**: Base, components, and utilities
- **Defines custom CSS variables**: Theme colors and spacing
- **Sets global styles**: Typography, scrollbars, and base elements
- **Provides utility classes**: Common patterns used throughout the app

## Directory Structure

### `/components`

Contains all React UI components organized by functionality:

#### **Page Components** (View States)

- `initial/` - Landing view for taking first screenshots and starting sessions
- `response/` - Displays AI-generated responses with formatting and actions
- `follow-up/` - Handles additional context and follow-up interactions
- `main/` - Central coordinator component managing view transitions

#### **Shared Components**

- `shared/` - Reusable components used across multiple views
- `ui/` - Shadcn UI component library implementations
- `icons/` - SVG icon components for consistent iconography
- `Commands.tsx` - Displays available keyboard shortcuts and commands

### `/lib`

Utility libraries and configurations:

- `utils.ts` - General utility functions for the frontend
- Third-party library configurations and helpers

### `/types`

TypeScript type definitions:

- `screenshots.ts` - Interface definitions for screenshot data structures
- Global type declarations and shared interfaces

### `/utils`

Frontend-specific utility functions:

- `screenshots.ts` - Screenshot fetching and management utilities
- `platform.ts` - Platform-specific logic and helpers
- Data transformation and formatting functions

## Key Features

### State Management

- **View State Machine**: Manages transitions between `initial`, `response`, and `followup` views
- **Screenshot Management**: Real-time updates of screenshot queues via TanStack Query
- **Configuration State**: API key and model preference management
- **Processing State**: Real-time feedback during AI processing

### User Interface

- **Responsive Design**: Adapts to content and maintains proper window sizing
- **Dynamic Tooltips**: Context-sensitive help and configuration options
- **Drag Interactions**: Window positioning and movement capabilities
- **Visual Feedback**: Loading states, progress indicators, and error handling

### Communication with Main Process

- **IPC Integration**: Seamless communication with Electron main process via `electronAPI`
- **Event Handling**: Real-time updates for screenshots, processing status, and errors
- **Data Synchronization**: Automatic refetching of data when main process state changes

### Content Display

- **Markdown Rendering**: Rich text formatting for AI responses with syntax highlighting
- **Image Previews**: Screenshot thumbnails with management capabilities
- **Command Interface**: Visual representation of available shortcuts and actions
- **Error Boundaries**: Graceful error handling and user feedback

## Data Flow

1. **User Interaction**: User triggers actions via keyboard shortcuts or UI elements
2. **IPC Communication**: Frontend sends requests to main process via `electronAPI`
3. **State Updates**: Main process events trigger UI updates through listeners
4. **Query Invalidation**: TanStack Query automatically refetches relevant data
5. **Component Re-rendering**: React components update to reflect new state
6. **Visual Feedback**: Users see immediate feedback for their actions

## Component Hierarchy

```
App
└── QueryClientProvider
    └── Main
        ├── Initial (when view === 'initial')
        │   ├── Commands
        │   └── Screenshot management UI
        ├── Response (when view === 'response')
        │   ├── AI response display
        │   └── Follow-up options
        └── FollowUp (when view === 'followup')
            ├── Previous context
            └── New input handling
```

## Development Patterns

- **Custom Hooks**: Encapsulate complex logic and state management
- **Event Listeners**: Clean setup and teardown of Electron IPC listeners
- **Error Boundaries**: Comprehensive error handling throughout the component tree
- **Memoization**: Performance optimization for expensive operations
- **Conditional Rendering**: Dynamic UI based on application state and user permissions
