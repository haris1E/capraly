# Capraly

A modern, full-stack web application built with React, TypeScript, and Supabase.

## 🎯 Project Overview

Capraly is a contemporary web application that combines a powerful frontend built with React and TypeScript with a robust backend powered by PostgreSQL and Supabase. The project uses a modern development stack including Vite for fast build times, shadcn/ui for accessible UI components, and Tailwind CSS for styling.

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18.3.1
- **Language**: TypeScript 5.8.3
- **Build Tool**: Vite 5.4.19
- **Styling**: Tailwind CSS 3.4.17 + shadcn/ui
- **State Management**: TanStack React Query 5.83.0
- **Routing**: React Router v6
- **Form Handling**: React Hook Form 7.61.1 + Zod validation
- **UI Components**: Radix UI (comprehensive component library)
- **Code Editor**: Monaco Editor 0.55.1
- **Terminal Emulator**: XTerm.js 5.3.0
- **Charts**: Recharts 2.15.4
- **Authentication**: Lovable Cloud Auth

### Backend
- **Database**: PostgreSQL (Supabase)
- **ORM/Client**: Supabase JavaScript Client 2.104.1
- **Database Language**: PLpgSQL

### Development Tools
- **Linting**: ESLint 9.32.0
- **Testing**: Vitest 3.2.4
- **Type Checking**: TypeScript with strict type support
- **Package Manager**: npm/yarn/pnpm

## 📋 Project Structure

```
capraly/
├── src/
│   ├── components/        # React components (UI, features)
│   ├── pages/            # Page-level components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utilities and helpers
│   ├── styles/           # Global CSS/Tailwind config
│   ├── App.tsx           # Main app component
│   └── main.tsx          # Entry point
├── public/               # Static assets
├── vite.config.ts        # Vite configuration
├── tsconfig.json         # TypeScript configuration
├── tailwind.config.js    # Tailwind CSS configuration
├── package.json          # Dependencies and scripts
└── README.md             # This file
```

## 🚀 Getting Started

### Prerequisites
- Node.js 16.x or higher
- npm, yarn, or pnpm

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/haris1E/capraly.git
   cd capraly
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Environment Configuration**
   
   Create a `.env.local` file in the project root:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_LOVABLE_AUTH_URL=your_lovable_auth_url
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```
   
   The application will be available at `http://localhost:8080`

## 📚 Available Scripts

### Development
```bash
npm run dev          # Start development server with HMR
npm run build        # Build for production
npm run build:dev    # Build in development mode
npm run preview      # Preview production build locally
```

### Quality Assurance
```bash
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues automatically
npm run test         # Run tests once
npm run test:watch   # Run tests in watch mode
```

### Type Checking
```bash
npx tsc --noEmit     # Check TypeScript types without emitting
```

## 🔐 Authentication

This project uses **Lovable Cloud Auth** for authentication. Make sure to:
1. Configure your Lovable authentication credentials in `.env.local`
2. Set up proper Supabase auth policies for your tables
3. Review Supabase Row Level Security (RLS) policies

## 🗄️ Database (Supabase/PostgreSQL)

### Setup
1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Configure your PostgreSQL database
3. Run migrations (if applicable)

### Database Features
- Real-time subscriptions via Supabase
- Row Level Security (RLS) for data protection
- PostgreSQL triggers and functions (PLpgSQL)
- Automatic backups and point-in-time recovery

### PLpgSQL Components
The project includes custom PostgreSQL functions and triggers (2.7% of the codebase) for:
- Data validation
- Automated workflows
- Complex queries

## 🎨 UI Components & Styling

### shadcn/ui Components
The project includes comprehensive shadcn/ui components:
- Forms, dialogs, and alerts
- Data tables and selectors
- Navigation and menus
- Accessibility features (ARIA)

### Tailwind CSS
All styling is managed through Tailwind CSS with a custom theme configuration. See `tailwind.config.js` for theme customization.

## 🧪 Testing

Tests are written using **Vitest** and **React Testing Library**:

```bash
# Run all tests
npm run test

# Run tests in watch mode during development
npm run test:watch
```

## 🔍 Code Quality

### Linting & Type Safety
- ESLint for code quality
- TypeScript strict type checking
- Automatic formatting with Prettier (recommended)

```bash
npm run lint        # Check for issues
npm run lint:fix    # Auto-fix issues
```

## 🌐 Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## 📦 Dependencies Highlights

### UI & Components
- **shadcn/ui + Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Beautiful icon library

### Data & State
- **TanStack React Query**: Server state management
- **React Router**: Client-side routing
- **Supabase JS**: Database & auth client

### Forms & Validation
- **React Hook Form**: Performant form handling
- **Zod**: TypeScript-first schema validation

### Advanced Features
- **Monaco Editor**: Code editing capabilities
- **XTerm.js**: Terminal emulation
- **Recharts**: React charting library
- **Embla Carousel**: Carousel component

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes and commit: `git commit -m 'Add feature'`
3. Push to the branch: `git push origin feature/your-feature`
4. Open a Pull Request

## 📝 Development Guidelines

- Follow TypeScript best practices
- Use component composition patterns
- Keep components small and reusable
- Add proper TypeScript types (no `any`)
- Write tests for new features
- Use Tailwind CSS utilities for styling

## 🐛 Troubleshooting

### Port Already in Use
If port 8080 is already in use, modify `vite.config.ts`:
```typescript
server: {
  port: 3000, // Change port here
}
```

### Environment Variables Not Loading
Ensure your `.env.local` variables are prefixed with `VITE_` to be accessible in the browser.

### Supabase Connection Issues
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct
- Check Supabase project status and network connectivity
- Review RLS policies if queries are failing

## 📄 License

[Add your license information here]

## 📞 Support

For issues, questions, or suggestions, please open an issue on the [GitHub repository](https://github.com/haris1E/capraly/issues).

---

**Last Updated**: June 2026
