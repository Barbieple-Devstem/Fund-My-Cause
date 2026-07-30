export interface User {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  deletedAt: string | null;
  lastLogin?: string;
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  timestamp: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  cursor?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  nextCursor: string | null;
}
