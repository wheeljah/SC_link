export interface User {
  id: number;
  email: string;
  nickname: string | null;
  emailVerified: boolean;
  tier: 'free' | 'premium' | 'vip';
  downloadCount: number;
}

export interface DownloadServer {
  id: number;
  name: string;
  url: string;
  type: 'scihub' | 'libgen' | 'zlibrary' | 'archive';
  status: 'ONLINE' | 'SLOW' | 'OFFLINE' | 'BLOCKED' | 'CHECKING' | 'HIDDEN';
  last_checked: string | null;
  avg_latency: number;
  success_rate: number;
  location: string;
  requires_login: boolean;
}

export interface ServerCredential {
  serverId: number;
  serverName: string;
  loginId: string;
  configured: boolean;
  updatedAt: string;
}

export interface PaperRequest {
  id: number;
  input_type: string;
  input_value: string;
  normalized_doi: string | null;
  title: string | null;
  authors: string | null;
  journal: string | null;
  year: number | null;
  status: 'pending' | 'completed' | 'failed';
  file_size: number | null;
  downloaded_at: string | null;
  created_at: string;
}

export interface CommunityRequest {
  id: number;
  title: string;
  description: string | null;
  doi: string | null;
  status: 'open' | 'in_progress' | 'fulfilled' | 'closed';
  view_count: number;
  created_at: string;
  author_nickname: string;
  response_count: number;
}

export interface AdBanner {
  id: number;
  position: 'TOP' | 'BOTTOM';
  type: 'TEXT' | 'IMAGE_TEXT' | 'RICH';
  icon: string | null;
  message: string;
  cta_text: string | null;
  cta_url: string | null;
  image_url: string | null;
  advertiser_name: string | null;
  bg_color: string;
  text_color: string;
}
