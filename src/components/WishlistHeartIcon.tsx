import React, { useEffect, useRef, useState } from 'react';
import { Heart } from 'lucide-react';

interface WishlistHeartIconProps {
  /** Whether the item is currently in the wishlist (triggers heart-beat on false -> true transition) */
  active?: boolean;
  /** Optional numeric counter (triggers heart-beat whenever the count increases, e.g. header/nav badge) */
  pulseOnIncrement?: number;
  /** Optional entity identifier so switching to an already-wishlisted product does not trigger a false pulse */
  resetKey?: string | number;
  className?: string;
}

export const WishlistHeartIcon: React.FC<WishlistHeartIconProps> = ({
  active,
  pulseOnIncrement,
  resetKey,
  className = '',
}) => {
  const [isBeating, setIsBeating] = useState(false);
  const prevActiveRef = useRef<boolean | undefined>(active);
  const prevCountRef = useRef<number | undefined>(pulseOnIncrement);
  const prevResetKeyRef = useRef<string | number | undefined>(resetKey);
  const timerRef = useRef<number | null>(null);

  const triggerBeat = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsBeating(false);
    requestAnimationFrame(() => {
      setIsBeating(true);
      timerRef.current = window.setTimeout(() => {
        setIsBeating(false);
        timerRef.current = null;
      }, 650);
    });
  };

  useEffect(() => {
    if (resetKey !== prevResetKeyRef.current) {
      prevResetKeyRef.current = resetKey;
      prevActiveRef.current = active;
      setIsBeating(false);
      return;
    }

    if (active !== undefined) {
      if (prevActiveRef.current === false && active === true) {
        triggerBeat();
      }
      prevActiveRef.current = active;
    }
  }, [active, resetKey]);

  useEffect(() => {
    if (pulseOnIncrement !== undefined) {
      if (prevCountRef.current !== undefined && pulseOnIncrement > prevCountRef.current) {
        triggerBeat();
      }
      prevCountRef.current = pulseOnIncrement;
    }
  }, [pulseOnIncrement]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  return <Heart className={`${className} ${isBeating ? 'animate-heart-beat' : ''}`.trim()} />;
};
