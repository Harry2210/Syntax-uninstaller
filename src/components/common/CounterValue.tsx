import React, { useState, useEffect, useRef } from 'react';

interface CounterValueProps {
  value: string | number;
  duration?: number; // milliseconds
  className?: string;
}

export const CounterValue: React.FC<CounterValueProps> = ({
  value,
  duration = 1000,
  className = '',
}) => {
  const [displayValue, setDisplayValue] = useState<string | number>(value);
  const prevValueRef = useRef<string | number>(value);

  useEffect(() => {
    const stringVal = String(value).trim();
    // Match numeric portion and prefix/suffix
    const match = stringVal.match(/^([^0-9.-]*)([0-9,.]+)(.*)$/);

    if (!match) {
      // Non-numeric value (e.g. "Verified", "Optimal")
      setDisplayValue(value);
      return;
    }

    const prefix = match[1] || '';
    const numStr = match[2].replace(/,/g, '');
    const suffix = match[3] || '';
    const targetNum = parseFloat(numStr);

    if (isNaN(targetNum)) {
      setDisplayValue(value);
      return;
    }

    // Determine decimal precision
    const decimalPlaces = numStr.includes('.') ? numStr.split('.')[1].length : 0;

    let startTime: number | null = null;
    let animationFrameId: number;

    const startNum = 0;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Ease out expo: 1 - 2^(-10 * t)
      const easeOutProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const currentVal = startNum + (targetNum - startNum) * easeOutProgress;

      setDisplayValue(
        `${prefix}${currentVal.toFixed(decimalPlaces)}${suffix}`
      );

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        setDisplayValue(stringVal);
      }
    };

    animationFrameId = requestAnimationFrame(step);
    prevValueRef.current = value;

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [value, duration]);

  return <span className={className}>{displayValue}</span>;
};
