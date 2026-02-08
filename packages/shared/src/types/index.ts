export interface HealthCheckResponse {
  status: 'ok';
  timestamp: string;
}

export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}
