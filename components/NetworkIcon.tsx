'use client';

import { FaFacebookF, FaInstagram, FaLinkedinIn, FaThreads, FaTiktok, FaYoutube } from 'react-icons/fa6';
import { NETWORKS, type NetworkId } from '@/lib/networks';

const ICONS = {
  instagram: FaInstagram,
  linkedin: FaLinkedinIn,
  tiktok: FaTiktok,
  youtube: FaYoutube,
  facebook: FaFacebookF,
  threads: FaThreads,
} satisfies Record<NetworkId, unknown>;

export function NetworkIcon({ id, size = 40 }: { id: NetworkId; size?: number }) {
  const n = NETWORKS.find((x) => x.id === id)!;
  const Icon = ICONS[id];
  return (
    <span
      className="netBadge"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        background: id === 'instagram' ? 'radial-gradient(circle at 30% 107%, #FDD86A 0%, #F77737 30%, #E1306C 60%, #833AB4 100%)' : n.color,
      }}
    >
      <Icon size={Math.round(size * 0.5)} />
    </span>
  );
}
