import { Share2 } from 'lucide-react';
import { siInstagram, siSoundcloud, siSpotify, siTiktok, siYoutube } from 'simple-icons';

const SOCIAL_ICON_MAP = {
  instagram: siInstagram,
  tiktok: siTiktok,
  youtube: siYoutube,
  spotify: siSpotify,
  soundcloud: siSoundcloud
};

function normalizePlatform(platform = '') {
  return String(platform || '').trim().toLowerCase();
}

export default function SocialPlatformIcon({ platform, size = 20, className = '' }) {
  const icon = SOCIAL_ICON_MAP[normalizePlatform(platform)];

  if (!icon) {
    return <Share2 size={size} className={className} aria-hidden="true" />;
  }

  const color = `#${icon.hex}`;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      role="img"
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d={icon.path} />
    </svg>
  );
}
