import { experimental_useSidebarThreads as useSidebarThreads, experimental_Icon as Icon } from '@get-bb/plugin-sdk/app';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { delegatedParents, syncActivityTargets, type ActivityTarget } from './sidebar';

export function SidebarChildActivity() {
  const { threads } = useSidebarThreads();
  const key = JSON.stringify([...delegatedParents(threads)].sort());
  const [targets, setTargets] = useState<ActivityTarget[]>([]);
  useEffect(() => {
    const eligible = new Set<string>(JSON.parse(key));
    let frame = 0;
    const scan = () => {
      frame = 0;
      const next = syncActivityTargets(document, eligible);
      setTargets(previous => previous.length === next.length && previous.every((t, i) => t.element === next[i]?.element && t.id === next[i]?.id) ? previous : next);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(scan); };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-icon', 'data-sidebar-thread-id'] });
    scan();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      syncActivityTargets(document, new Set());
    };
  }, [key]);
  return <>{targets.map(({ id, element }, index) => createPortal(
    <Icon name="ChildThread" className="child-thread-activity-icon animate-shine-icon" aria-label="Child thread working; parent is idle" />,
    element, `${id}:${index}`,
  ))}</>;
}
