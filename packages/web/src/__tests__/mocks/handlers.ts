import { http, HttpResponse } from 'msw';
import { mockUser, mockVault, mockDocument, mockTreeNode, mockApiKey } from './data.js';

const API = 'http://localhost:4000/api/v1';

export const handlers = [
  // Auth
  http.post(`${API}/auth/login`, () => {
    return HttpResponse.json({
      user: mockUser(),
      accessToken: 'mock-access-token',
    });
  }),

  http.post(`${API}/auth/register`, () => {
    return HttpResponse.json({
      user: mockUser(),
      accessToken: 'mock-access-token',
    });
  }),

  http.post(`${API}/auth/refresh`, () => {
    return HttpResponse.json({
      user: mockUser(),
      accessToken: 'mock-refreshed-token',
    });
  }),

  http.post(`${API}/auth/logout`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Users
  http.get(`${API}/users/me`, () => {
    return HttpResponse.json(mockUser());
  }),

  // Vaults
  http.get(`${API}/vaults`, () => {
    return HttpResponse.json([mockVault()]);
  }),

  http.post(`${API}/vaults`, () => {
    return HttpResponse.json(mockVault(), { status: 201 });
  }),

  http.get(`${API}/vaults/:id`, () => {
    return HttpResponse.json(mockVault());
  }),

  http.get(`${API}/vaults/:id/tree`, () => {
    return HttpResponse.json(mockTreeNode());
  }),

  // Documents
  http.get(`${API}/vaults/:vaultId/documents/*path`, () => {
    return HttpResponse.json(mockDocument());
  }),

  http.put(`${API}/vaults/:vaultId/documents/*path`, () => {
    return HttpResponse.json(mockDocument());
  }),

  http.delete(`${API}/vaults/:vaultId/documents/*path`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Search
  http.get(`${API}/search`, () => {
    return HttpResponse.json({
      results: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
  }),

  // API Keys
  http.get(`${API}/api-keys`, () => {
    return HttpResponse.json([mockApiKey()]);
  }),

  http.post(`${API}/api-keys`, () => {
    return HttpResponse.json({ ...mockApiKey(), key: 'ds_k_mock_full_key' }, { status: 201 });
  }),
];
