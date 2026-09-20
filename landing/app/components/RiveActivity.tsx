'use client';

import { useEffect, useState } from 'react';
import { useRive } from '@rive-app/react-canvas';

/**
 * A small, local Rive animation used to make the assistant's active state
 * tangible. It begins paused and only plays for people who have not asked for
 * reduced motion. The CSS fallback keeps the panel informative if Rive cannot
 * load in a constrained browser.
 */
interface RiveActivityProps {
  className?: string;
  src?: string;
  stateMachines?: string | string[];
}

export function RiveActivity({
  className,
  src = '/klip-activity.riv',
  stateMachines,
}: RiveActivityProps) {
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const { rive, RiveComponent } = useRive({
    src,
    stateMachines,
    autoplay: false,
    onLoadError: () => setLoadFailed(true),
  });

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => {
      const canAnimate = !media.matches;
      setMotionAllowed(canAnimate);

      if (canAnimate) {
        rive?.play();
      } else {
        rive?.pause();
      }
    };

    updateMotion();
    media.addEventListener('change', updateMotion);
    return () => media.removeEventListener('change', updateMotion);
  }, [rive]);

  if (!motionAllowed || loadFailed) {
    return (
      <div className={`rive-fallback${className ? ` ${className}` : ''}`} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    );
  }

  return <RiveComponent className={`rive-canvas${className ? ` ${className}` : ''}`} aria-hidden="true" />;
}
