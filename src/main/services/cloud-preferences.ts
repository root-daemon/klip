import { parseDocument, pickPreferences, type CloudPreferences, type PreferenceDocument } from '../../shared/cloud';

export class CloudPreferencesClient {
  private version: number | undefined;
  constructor(private readonly apiUrl: string, private readonly token: () => Promise<string>, private readonly request: typeof fetch = fetch) {}
  clear(): void { this.version = undefined; }
  get hasSavedPreferences(): boolean { return (this.version ?? 0) > 0; }

  private async call(method: string, body?: unknown): Promise<PreferenceDocument> {
    const response = await this.request(`${this.apiUrl}/preferences`, {
      method, headers: { Authorization: `Bearer ${await this.token()}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15_000), redirect: 'error',
    });
    if (response.status === 409) throw new Error('Cloud preferences changed on another device. Restore them before saving again.');
    if (response.status === 401 || response.status === 403) throw new Error('Your session was rejected. Sign out and sign in again.');
    if (!response.ok) throw new Error('Cloud preferences are unavailable. Please try again.');
    const document = parseDocument(await response.json());
    this.version = document.version;
    return document;
  }

  read(): Promise<PreferenceDocument> { return this.call('GET'); }
  async save(preferences: CloudPreferences): Promise<PreferenceDocument> {
    if (this.version === undefined) throw new Error('Restore cloud preferences before saving.');
    return this.call('PUT', { preferences: pickPreferences(preferences), version: this.version });
  }
}
