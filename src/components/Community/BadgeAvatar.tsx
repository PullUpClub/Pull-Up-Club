import React from 'react';

type Badge = { name: string; image_url: string; min_pull_ups?: number };

interface BadgeAvatarProps {
  badges?: Badge[];
  size?: number;
}

const BadgeAvatar: React.FC<BadgeAvatarProps> = ({ badges = [], size = 40 }) => {
  const primary = [...badges].sort((a, b) => (b.min_pull_ups ?? 0) - (a.min_pull_ups ?? 0))[0];
  
  return (
    <div 
      className="rounded-full overflow-hidden border-2 border-[#9b9b6f] bg-black"
      style={{ 
        width: size, 
        height: size, 
        minWidth: size, 
        minHeight: size,
        maxWidth: size,
        maxHeight: size,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {primary ? (
        <img
          src={primary.image_url}
          alt={primary.name}
          className="w-full h-full object-contain p-0.5"
          loading="lazy"
          decoding="async"
          style={{ width: '100%', height: '100%' }}
        />
      ) : (
        <div className="w-full h-full bg-black" />
      )}
    </div>
  );
};

export default BadgeAvatar;


