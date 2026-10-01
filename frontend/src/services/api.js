/**
 * MediLocker API Client
 * Features: SWR caching, in-flight deduplication, session synchronization.
 */

class ApiService {
  constructor() {
    this.tokenKey = 'medilockerToken';
    this.sessionKey = 'medilockerSession';
    this.swrCache = new Map(); // key -> { data, timestamp, ttl, etag }
    this.inflight = new Map(); // key -> Promise
  }

  getToken() {
    try {
      return localStorage.getItem(this.tokenKey);
    } catch {
      return null;
    }
  }

  setToken(token) {
    if (token) {
      localStorage.setItem(this.tokenKey, token);
    } else {
      localStorage.removeItem(this.tokenKey);
    }
  }

  getSession() {
    try {
      const raw = localStorage.getItem(this.sessionKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  setSession(user) {
    if (user) {
      localStorage.setItem(this.sessionKey, JSON.stringify(user));
    } else {
      localStorage.removeItem(this.sessionKey);
    }
  }

  getBaseUrl() {
    if (typeof window !== 'undefined' && window.MEDILOCKER_API_BASE) {
      return window.MEDILOCKER_API_BASE.replace(/\/+$/, '');
    }
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('medilockerBackendUrl') : null;
    if (saved) return saved.replace(/\/+$/, '');
    
    // Relative URL works with Vite proxy (/api -> http://localhost:5000)
    return '';
  }

  formatUrl(endpoint) {
    const base = this.getBaseUrl();
    const clean = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${base}${clean}`;
  }

  getRecordViewUrl(recordId) {
    if (!recordId) return '#';
    const token = this.getToken() || '';
    const base = this.formatUrl(`/api/v1/records/${recordId}/view`);
    return token ? `${base}?token=${encodeURIComponent(token)}` : base;
  }

  invalidateCache(prefix = '') {
    if (!prefix) {
      this.swrCache.clear();
      return;
    }
    for (const key of this.swrCache.keys()) {
      if (key.includes(prefix)) {
        this.swrCache.delete(key);
      }
    }
  }

  async request(endpoint, options = {}) {
    const url = this.formatUrl(endpoint);
    const method = (options.method || 'GET').toUpperCase();
    const token = this.getToken();

    const headers = {
      ...(options.headers || {}),
    };

    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const isGet = method === 'GET';
    const cacheKey = `${method}:${url}`;

    // 1. Check SWR cache for GET
    if (isGet && !options.skipCache) {
      const cached = this.swrCache.get(cacheKey);
      const now = Date.now();
      const ttl = options.ttl || 60000; // default 60s
      if (cached && now - cached.timestamp < ttl) {
        return cached.data;
      }
    }

    // 2. Inflight request deduplication for concurrent GETs
    if (isGet && this.inflight.has(cacheKey)) {
      return this.inflight.get(cacheKey);
    }

    const fetchPromise = (async () => {
      try {
        const response = await fetch(url, {
          ...options,
          method,
          headers,
        });

        if (response.status === 401) {
          // Token expired or invalid
          this.setToken(null);
          this.setSession(null);
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/login') && !window.location.pathname.includes('/signup') && window.location.pathname !== '/') {
            window.location.href = '/login';
          }
          throw new Error('Authentication session expired. Please sign in again.');
        }

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          let errMsg = data.message || data.error || `Request failed with status ${response.status}`;
          if (data.details && Array.isArray(data.details) && data.details.length > 0) {
            const detailStr = data.details
              .map((d) => (d.path ? `${d.path}: ${d.message}` : d.message))
              .join(', ');
            errMsg = `${errMsg}: ${detailStr}`;
          }
          throw new Error(errMsg);
        }

        // Cache successful GET responses
        if (isGet) {
          this.swrCache.set(cacheKey, {
            data,
            timestamp: Date.now(),
          });
        } else {
          // Invalidate related caches on mutations
          this.invalidateCache('/api/v1/');
        }

        return data;
      } finally {
        if (isGet) {
          this.inflight.delete(cacheKey);
        }
      }
    })();

    if (isGet) {
      this.inflight.set(cacheKey, fetchPromise);
    }

    return fetchPromise;
  }

  // --- Authentication ---
  async login(payload) {
    const data = await this.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const token = data.token || data.data?.token;
    const user = data.user || data.data?.user || data.data;
    if (token) {
      this.setToken(token);
    }
    if (user && user.id) {
      this.setSession(user);
    }
    return { ...data, token, user };
  }

  async signup(payload) {
    const data = await this.request('/api/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const token = data.token || data.data?.token;
    const user = data.user || data.data?.user || data.data;
    if (token) {
      this.setToken(token);
    }
    if (user && user.id) {
      this.setSession(user);
    }
    return { ...data, token, user };
  }

  async getMe() {
    return this.request('/api/v1/auth/me');
  }

  async updateProfile(payload) {
    const data = await this.request('/api/v1/auth/me', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (data?.user || data?.data) {
      const user = data.user || data.data;
      this.setSession(user);
    }
    this.invalidateCache('/api/v1/auth/me');
    return data;
  }

  logout() {
    this.setToken(null);
    this.setSession(null);
    this.invalidateCache();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }

  // --- Records & Vault ---
  async listRecords(filter = '') {
    const q = filter ? `?type=${encodeURIComponent(filter)}` : '';
    return this.request(`/api/v1/records${q}`);
  }

  async getRecordById(id) {
    return this.request(`/api/v1/records/${id}`);
  }

  async getRecordStatus(id) {
    return this.request(`/api/v1/records/${id}/status`, { skipCache: true });
  }

  async uploadRecord(formData) {
    this.invalidateCache('/api/v1/records');
    this.invalidateCache('/api/v1/timeline');
    this.invalidateCache('/api/v1/todo');
    return this.request('/api/v1/records/upload', {
      method: 'POST',
      body: formData,
    });
  }

  async createManualRecord(payload) {
    this.invalidateCache('/api/v1/records');
    this.invalidateCache('/api/v1/timeline');
    this.invalidateCache('/api/v1/todo');
    return this.request('/api/v1/records', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async deleteRecord(id) {
    this.invalidateCache('/api/v1/records');
    this.invalidateCache('/api/v1/timeline');
    this.invalidateCache('/api/v1/todo');
    return this.request(`/api/v1/records/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Timeline & Feelings ---
  async getTimeline() {
    return this.request('/api/v1/timeline');
  }

  async getFeelings(days = 14) {
    return this.request(`/api/v1/timeline/feeling?days=${days}`);
  }

  async logFeeling(feelingScore, notes = '') {
    const severityColor = feelingScore === 1 ? 'GREEN' : feelingScore === 2 ? 'ORANGE' : 'RED';
    this.invalidateCache('/api/v1/timeline');
    this.invalidateCache('/api/v1/todo');
    this.invalidateCache('/api/v1/timeline/feeling');
    return this.request('/api/v1/todo/daily-feeling', {
      method: 'POST',
      body: JSON.stringify({ feelingScore, severityColor, feedback: notes }),
    });
  }

  // --- Todo & Medications ---
  async getTodos() {
    return this.request('/api/v1/todo');
  }

  async toggleTodo(id, isCompleted) {
    this.invalidateCache('/api/v1/todo');
    return this.request(`/api/v1/todo/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isCompleted }),
    });
  }

  // --- Medicine Cabinet & Inventory ---
  async getInventory() {
    return this.request('/api/v1/inventory');
  }

  async addInventory(payload) {
    this.invalidateCache('/api/v1/inventory');
    return this.request('/api/v1/inventory', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async lookupBarcode(barcode) {
    return this.request(`/api/v1/inventory/barcode/${encodeURIComponent(barcode)}`);
  }

  async checkRefills() {
    return this.request('/api/v1/inventory/refill-alert');
  }

  // --- AI Clinical Services ---
  async voiceIntake(payload) {
    return this.request('/api/v1/ai/voice-intake', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async predictDiseases(payload) {
    return this.request('/api/v1/ai/disease-prediction', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async doubleCode(payload) {
    return this.request('/api/v1/ai/double-code', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async saveIntakeToVault(payload) {
    this.invalidateCache('/api/v1/records');
    this.invalidateCache('/api/v1/timeline');
    this.invalidateCache('/api/v1/todo');
    return this.request('/api/v1/ai/save-intake-to-vault', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getClinicalTriage(patientId = '') {
    const path = patientId ? `/api/v1/ai/clinical-triage/${patientId}` : '/api/v1/ai/clinical-triage';
    return this.request(path);
  }

  // --- Touch OPD Kiosk ---
  async submitKioskIntake(payload) {
    this.invalidateCache('/api/v1/records');
    this.invalidateCache('/api/v1/timeline');
    return this.request('/api/v1/kiosk/intake', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // --- ABDM / FHIR ---
  async getFhirBundle(patientId = '') {
    const path = patientId ? `/api/v1/abdm/fhir-bundle/${patientId}` : '/api/v1/abdm/fhir-bundle';
    return this.request(path);
  }

  // --- Consent, Access & Doctor Delegation ---
  async listDelegations() {
    return this.request('/api/v1/delegation');
  }

  async createDelegation(payload) {
    return this.request('/api/v1/delegation', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async revokeDelegation(delegationId) {
    this.invalidateCache('/api/v1/delegation');
    return this.request('/api/v1/delegation/revoke', {
      method: 'POST',
      body: JSON.stringify({ delegationId }),
    });
  }

  async searchPatient(medilockerId) {
    return this.request(`/api/v1/delegation/search-patient?medilockerId=${encodeURIComponent(medilockerId)}`, {
      skipCache: true,
    });
  }

  async createAccessRequest(payload) {
    this.invalidateCache('/api/v1/delegation');
    return this.request('/api/v1/delegation/create-request', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async verifyPatientOtp(payload) {
    this.invalidateCache('/api/v1/delegation');
    return this.request('/api/v1/delegation/verify-code', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getPatientRequests() {
    return this.request('/api/v1/delegation/patient-requests', {
      skipCache: true,
    });
  }

  async getDoctorActivePatients() {
    return this.request('/api/v1/delegation/doctor/active-patients', {
      skipCache: true,
    });
  }

  async getProviderPendingRequests() {
    return this.request('/api/v1/delegation/provider/pending-requests', {
      skipCache: true,
    });
  }

  async getDoctorPatientFullData(patientId) {
    return this.request(`/api/v1/delegation/doctor/patient/${encodeURIComponent(patientId)}/full-data`, {
      skipCache: true,
    });
  }

  // --- Appointments ---
  async getMyAppointments() {
    return this.request('/api/v1/appointments/my', {
      skipCache: true,
    });
  }

  async updateAppointmentStatus(id, status) {
    this.invalidateCache('/api/v1/appointments');
    return this.request(`/api/v1/appointments/${encodeURIComponent(id)}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  async listDoctors(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/api/v1/appointments/doctors${q ? `?${q}` : ''}`);
  }

  async bookAppointment(payload) {
    this.invalidateCache('/api/v1/appointments');
    return this.request('/api/v1/appointments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // --- Emergency QR & Unit ID Triage Lookup ---
  async emergencyLookup(identifier) {
    return this.request(`/api/v1/delegation/emergency-lookup/${encodeURIComponent(identifier)}`, {
      skipCache: true,
    });
  }

  // --- Hospital Doctor Organization Management ---
  async getHospitalDoctors() {
    return this.request('/api/v1/delegation/hospital/doctors', {
      skipCache: true,
    });
  }

  async searchDoctorsForHospital(query) {
    return this.request(`/api/v1/delegation/hospital/search-doctors?query=${encodeURIComponent(query)}`, {
      skipCache: true,
    });
  }

  async addDoctorToHospital(payload) {
    this.invalidateCache('/api/v1/delegation');
    return this.request('/api/v1/delegation/hospital/add-doctor', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async toggleHospitalDoctor(doctorId, payload) {
    this.invalidateCache('/api/v1/delegation');
    return this.request(`/api/v1/delegation/hospital/doctor/${encodeURIComponent(doctorId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async removeDoctorFromHospital(doctorId) {
    this.invalidateCache('/api/v1/delegation');
    return this.request(`/api/v1/delegation/hospital/doctor/${encodeURIComponent(doctorId)}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiService();

