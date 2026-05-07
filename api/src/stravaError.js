const MESSAGES = {
  401: 'Strava authorization expired. Please reconnect.',
  403: 'Access forbidden. You may not have permission for this resource.',
  404: 'Segment not found on Strava.',
  429: 'Strava rate limit exceeded. Please try again in a few minutes.',
  500: 'Strava is having issues. Check https://status.strava.com for updates.',
}

export class StravaError extends Error {
  constructor(status) {
    super(MESSAGES[status] ?? `Strava returned an unexpected error (${status}).`)
    this.status = status
  }
}

// Map a Strava status code to an appropriate HTTP status to return to our clients.
export function stravaHttpStatus(stravaStatus) {
  if (stravaStatus === 401) return 401
  if (stravaStatus === 429) return 429
  return 502
}
