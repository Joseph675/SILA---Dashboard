export const environment = {
  production: false,
  // Empty like production: `ng serve` forwards /api to the backend (proxy.conf.json), so the page
  // and the API share one origin and the HttpOnly refresh cookie (SameSite=Strict) works.
  apiBaseUrl: '',
  apiVersion: 'v1',
};
