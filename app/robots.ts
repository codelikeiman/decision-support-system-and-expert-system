import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

/** Area pengelola & API tidak diindeks; halaman publik dan gambar pratinjau tetap dapat dibaca crawler. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/super-admin', '/api/', '/login', '/masuk'] }],
    host: siteUrl().origin,
  };
}
