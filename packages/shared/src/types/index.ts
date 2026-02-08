export interface HealthCheckResponse {
  status: 'ok';
  timestamp: string;
}

export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}

// Auth types

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'user';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
  inviteToken: string;
}

// Vault types

export interface Vault {
  id: string;
  userId: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

// Document types

export interface Document {
  id: string;
  vaultId: string;
  path: string;
  title: string | null;
  contentHash: string;
  sizeBytes: number;
  frontmatter: Record<string, any> | null;
  tags: string[];
  fileCreatedAt: string | null;
  fileModifiedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNum: number;
  contentHash: string;
  sizeBytes: number;
  changeSource: 'web' | 'api' | 'webdav';
  changedBy: string | null;
  createdAt: string;
}

export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
}

export interface DocumentListItem {
  path: string;
  title: string | null;
  tags: string[];
  sizeBytes: number;
  fileModifiedAt: string;
}
