# Frontend Source Files (Renderer Process)

This `src` directory contains all the frontend code for the IKIAG application, which runs in the Electron renderer process. It is primarily built using React and TypeScript.

## File and Directory Descriptions

### Root Files

- `App.tsx`: This is the main React root component of the application. It sets up routing, global context providers, and the overall layout structure of the UI.
- `index.css`: This file contains global CSS styles and potentially imports other CSS files or utility classes (like Tailwind CSS) that apply to the entire application.
- `main.tsx`: This is the entry point for the React application. It's responsible for rendering the root `App` component into the DOM (specifically, into the `index.html` file loaded by Electron).

### Subdirectories

- `_pages/`: This directory contains components that represent different "pages" or top-level views of the application. If a router is used (e.g., React Router), these components would be associated with specific routes.

- `components/`: This directory houses all reusable React UI components. It is further subdivided into:

  - `icons/`: For SVG or image-based icon components.
  - `shared/`: For generic, widely used components.
  - `ui/`: For UI components, specifically those from the Shadcn UI library.
  - `Commands.tsx`: A component for displaying application commands/shortcuts.

- `lib/`: This directory is typically used for utility functions, helper modules, or third-party library configurations that are specific to the frontend application but don't fit neatly into other categories like `utils` or `components`.

- `types/`: This directory contains TypeScript type definitions and interfaces used throughout the frontend codebase, ensuring type safety and better code maintainability.

- `utils/`: This directory holds general utility functions and helper scripts that can be used across various parts of the frontend application. These are often pure functions or small modules that perform specific tasks (e.g., date formatting, data manipulation, API request helpers specific to the renderer).
