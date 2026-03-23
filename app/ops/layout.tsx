/**
 * Ops layout — forces dark theme for all /ops pages.
 *
 * Strategy:
 *  1. `class="dark"` on the wrapper activates all `dark:` Tailwind variants.
 *  2. CSS variable overrides replace tenant-specific brand colors with the
 *     fixed Servify OS dark design system.
 *
 * Design system:
 *  Background:    #0a0a0f (near-black)
 *  Card surface:  #12121a
 *  Border:        #1e1e2e
 *  Text primary:  #f0f0f5
 *  Text muted:    #71717a
 *  Accent:        #6366f1 (indigo)
 *  Positive:      #0d9488 (teal)
 *  Danger:        #ef4444
 */

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="dark"
      style={{
        // Override every CSS variable used by ops components
        ['--brand-bg' as string]: '#0a0a0f',
        ['--brand-surface' as string]: '#12121a',
        ['--brand-border' as string]: '#1e1e2e',
        ['--brand-text' as string]: '#f0f0f5',
        ['--brand-muted' as string]: '#71717a',
        ['--brand-primary' as string]: '#6366f1',
        ['--brand-accent' as string]: '#0d9488',
        // Ensure the entire ops area uses the dark background
        background: '#0a0a0f',
        minHeight: '100dvh',
        color: '#f0f0f5',
      }}
    >
      {children}
    </div>
  )
}
