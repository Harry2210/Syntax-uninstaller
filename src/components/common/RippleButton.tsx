import React from 'react';

interface RippleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'surface';
  className?: string;
}

/**
 * Solid action button.
 *
 * The click ripple and the looping shimmer beam were removed: they added motion
 * without adding information. Colour, hover and press states carry the
 * affordance instead.
 */
export const RippleButton: React.FC<RippleButtonProps> = ({
  children,
  variant = 'primary',
  className = '',
  type = 'button',
  ...rest
}) => {
  const variantStyles = {
    primary:
      'bg-gradient-to-r from-primary to-primary-hover hover:opacity-95 text-white shadow-md shadow-primary/25 border border-primary/40',
    secondary:
      'bg-secondary/15 hover:bg-secondary/25 text-secondary border border-secondary/40 shadow-sm',
    danger: 'bg-danger hover:opacity-95 text-white shadow-md shadow-danger/25 border border-danger/40',
    surface: 'bg-surface hover:bg-surface-elevated text-text-primary border border-border',
  };

  return (
    <button
      type={type}
      className={`relative overflow-hidden transition-colors duration-150 active:scale-[0.98] select-none ${variantStyles[variant]} ${className}`}
      {...rest}
    >
      <span className="relative z-10 flex items-center justify-center space-x-2">{children}</span>
    </button>
  );
};
