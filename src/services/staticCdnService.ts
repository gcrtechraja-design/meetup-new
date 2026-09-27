/**
 * static.io / Statically CDN image service & Avatar Provider
 * Delivers optimized, high-speed cached images via the static.io CDN proxy.
 * Supports Real Indian girl portraits for fake listeners and cute Female avatar illustrations for customers.
 */

/**
 * Returns a cute female avatar illustration (DiceBear Lorelei with female styling and pastel background)
 */
export function getDefaultFemaleAvatar(seed?: string): string {
  const safeSeed = encodeURIComponent(seed || 'female-user');
  // Cute female illustration with soft pastel colors (lorelei female style)
  return `https://api.dicebear.com/7.x/lorelei/svg?seed=${safeSeed}&backgroundColor=ffd5dc,c0aede,d1d4f9,b6e3f4,ffdfbf`;
}

/**
 * Returns a cute fun-emoji female avatar illustration alternative
 */
export function getFunEmojiAvatar(seed?: string): string {
  const safeSeed = encodeURIComponent(seed || 'girl');
  return `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${safeSeed}`;
}

/**
 * Delivers optimized image URL.
 * Never defaults to robots/bottts - always defaults to cute female avatar illustration.
 */
export function getStaticCdnUrl(originalUrl?: string | null, options?: { width?: number; height?: number; quality?: number; format?: string }): string {
  if (!originalUrl || originalUrl.includes('bottts') || originalUrl.includes('seed=user')) {
    return getDefaultFemaleAvatar('meetup-customer');
  }

  // If Supabase Storage public URL, return directly (Supabase serves public photos directly)
  if (originalUrl.includes('supabase.co/storage') || originalUrl.includes('/storage/v1/object/public/photos')) {
    return originalUrl;
  }

  // If already a static.io CDN url, return as is
  if (originalUrl.includes('cdn.statically.io') || originalUrl.includes('cdn.static.io')) {
    return originalUrl;
  }

  // If data URI (uploaded base64 photo), return directly
  if (originalUrl.startsWith('data:') || originalUrl.startsWith('blob:')) {
    return originalUrl;
  }

  // If Dicebear SVG avatar, return directly (Dicebear has built-in global CDN)
  if (originalUrl.includes('dicebear.com')) {
    return originalUrl;
  }

  try {
    // Strip protocol (http:// or https://)
    const stripped = originalUrl.replace(/^https?:\/\//i, '');
    const w = options?.width ? `w=${options.width}&` : '';
    const h = options?.height ? `h=${options.height}&` : '';
    const q = options?.quality ? `q=${options.quality}&` : 'q=90&';
    const f = options?.format ? `f=${options.format}&` : 'f=auto&';

    // Format via Statically CDN (cdn.statically.io)
    return `https://cdn.statically.io/img/${stripped}?${w}${h}${q}${f}`.replace(/[&?]$/, '');
  } catch (err) {
    return originalUrl;
  }
}

/**
 * Resolves avatar URL according to business rules:
 * 1. Fake customers (listeners) -> Real Indian girl photo (e.g. randomuser.me portraits)
 * 2. Real customers with uploaded photo -> Show uploaded photo
 * 3. Real customers without photo -> Cute Female avatar illustration (lorelei / fun-emoji)
 */
export function getUserAvatarUrl(user?: {
  uid?: string;
  name?: string;
  role?: string;
  profile_pic?: string;
  avatar_url?: string;
  email?: string;
} | null): string {
  if (!user) {
    return getDefaultFemaleAvatar('guest');
  }

  const pic = user.profile_pic || user.avatar_url;

  // Real customer or listener with an explicit profile_pic or avatar_url
  if (pic && pic.trim()) {
    // If not an obsolete bottts placeholder
    if (!pic.includes('bottts') && !pic.includes('seed=user')) {
      return getStaticCdnUrl(pic);
    }
  }

  // If listener (fake customer on main page), use their assigned real Indian portrait
  const isListener =
    user.role === 'listener' ||
    (user.uid && user.uid.startsWith('listener_seed_')) ||
    (user.email && user.email.includes('listener@meetup.com'));

  if (isListener) {
    return 'https://randomuser.me/api/portraits/women/11.jpg';
  }

  // Fallback for real customer
  const seedKey = user.uid || user.name || user.email || 'customer';
  return getDefaultFemaleAvatar(seedKey);
}

/**
 * Upload and process image for static storage and CDN delivery
 */
export async function uploadImageToStaticCdn(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('File size exceeds 5MB limit. Please choose a smaller photo.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result as string;
      // In production, upload to CDN endpoint or return optimized base64 for persistent Firestore storage
      resolve(base64Data);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

