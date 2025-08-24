import React from 'react';
import { flags, type FlagCode } from '../../assets/flags';

interface FlagProps {
  code: FlagCode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-4 h-3',
  md: 'w-5 h-4',
  lg: 'w-6 h-5',
};

export const Flag: React.FC<FlagProps> = ({ code, size = 'sm', className = '' }) => {
  const flagUrl = flags[code];
  
  return (
    <span className="flex-shrink-0 inline-flex items-center justify-center">
      <img
        src={flagUrl}
        alt={`${code.toUpperCase()} flag`}
        className={`object-cover rounded-sm ${sizeClasses[size]} ${className}`}
        loading="lazy"
        width={24}
        height={18}
      />
    </span>
  );
}; 