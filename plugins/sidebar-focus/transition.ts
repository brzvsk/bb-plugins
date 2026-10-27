import { topBlocks } from './sidebar';

const SCROLL = '[data-sidebar="content"]';
const NAME_PREFIX = 'sidebar-focus-';
export const TRANSITION_CLASS = 'sidebar-focus-transition';

type TransitionHost = { startViewTransition?: (update: () => Promise<void>) => ViewTransition };

const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

/**
 * Runs a focus change as a view transition: groups that leave fade out, the
 * ones that stay slide to their new place, and a group the focus expands grows.
 * Scoped to the sidebar's scroll area where the browser supports it, so the
 * rest of the app stays live and nothing draws outside the list; otherwise a
 * document transition animates only the groups in view. Reduced motion, or no
 * support at all, applies the change at once.
 */
export function animateFocus(update: () => void): void {
  const scroll = document.querySelector<HTMLElement>(`[data-bb-plugin="thread-list"]`)?.closest<HTMLElement>(SCROLL)
    ?? document.querySelector<HTMLElement>(SCROLL);
  const scoped = typeof (scroll as TransitionHost | null)?.startViewTransition === 'function';
  const host: TransitionHost | null = scoped ? scroll as TransitionHost : document as TransitionHost;
  if (!scroll || !host?.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    update();
    return;
  }

  const view = scroll.getBoundingClientRect();
  const named: HTMLElement[] = [];
  topBlocks(document).forEach(({ element }, index) => {
    if (!scoped) {
      const rect = element.getBoundingClientRect();
      if (rect.height === 0 || rect.bottom < view.top || rect.top > view.bottom) return;
    }
    element.style.setProperty('view-transition-name', `${NAME_PREFIX}${index}`);
    element.style.setProperty('view-transition-class', 'sidebar-focus');
    named.push(element);
  });
  document.documentElement.classList.add(TRANSITION_CLASS);
  const cleanup = () => {
    for (const element of named) {
      element.style.removeProperty('view-transition-name');
      element.style.removeProperty('view-transition-class');
    }
    document.documentElement.classList.remove(TRANSITION_CLASS);
  };

  try {
    // One frame lets React draw the rows of a group the focus just expanded.
    const transition = host.startViewTransition(async () => {
      update();
      await nextFrame();
    });
    void transition.finished.catch(() => undefined).finally(cleanup);
  } catch {
    cleanup();
    update();
  }
}
