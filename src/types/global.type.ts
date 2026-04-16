export interface CommonResponse {
  response: boolean;
  message: string;
}

export interface PaginatedResponse<T> extends CommonResponse {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DataResponse<T> extends CommonResponse {
  data: T;
}

export interface GlobalServiceIntroduceResponse extends CommonResponse {
  version: string;
  contributor: string;
  timezone: string;
}

export interface GlobalServiceHealthResponse extends CommonResponse {
  status: string;
  uptime: number;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
