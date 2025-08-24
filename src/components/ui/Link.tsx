import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useInteractionTracking } from '../../hooks/useInteractionTracking';

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: React.ReactNode;
  trackingName?: string;
  trackingData?: Record<string, any>;
  external?: boolean;
}

export const Link: React.FC<LinkProps> = ({
  href,
  children,
  className = '',
  trackingName,
  trackingData,
  external = false,
  onClick,
  ...props
}) => {
  const { trackLinkClick } = useInteractionTracking();

  const handleClick = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    // Track the link click if tracking name is provided
    if (trackingName) {
      await trackLinkClick(trackingName, href, {
        is_external: external,
        ...trackingData
      });
    }

    // Call the original onClick handler if provided
    onClick?.(event);
  };

  if (external) {
    return (
      <a
        href={href}
        className={className}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        {...props}
      >
        {children}
      </a>
    );
  }

  return (
    <RouterLink
      to={href}
      className={className}
      onClick={handleClick}
      {...props}
    >
      {children}
    </RouterLink>
  );
};