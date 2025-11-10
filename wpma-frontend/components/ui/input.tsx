'use client';

import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`border px-3 py-2 rounded w-full ${className}`}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export default Input;
