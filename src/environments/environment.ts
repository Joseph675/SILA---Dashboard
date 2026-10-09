export const environment = {
  production: true,
  // Empty on purpose: ApiService adds "/api/v1", so requests go to the same host that serves
  // the dashboard and the reverse proxy decides the real API host. Never hardcode it here.
  apiBaseUrl: '',
  apiVersion: 'v1',
};
