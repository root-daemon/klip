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
}

export function RiveActivity({
  className,
  src = '/klip-activity.riv',
}: RiveActivityProps) {
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const { rive, RiveComponent } = useRive({
    src,
    autoplay: true,
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

  useEffect(() => {
    if (!rive || !motionAllowed) return;

    // The local signal is a one-shot Rive timeline. Restart it periodically so
    // the status surfaces remain alive without relying on a CSS imitation.
    const replay = window.setInterval(() => rive.reset({ autoplay: true }), 3600);
    return () => window.clearInterval(replay);
  }, [motionAllowed, rive]);

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
