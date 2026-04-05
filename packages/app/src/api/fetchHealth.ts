import type { HealthApiResponse } from '@shared/points';

export async function fetchHealth(signal?: AbortSignal): Promise<HealthApiResponse> {
  const response = await fetch('/api/health', {
    method: 'GET',
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }

  return (await response.json()) as HealthApiResponse;
}
