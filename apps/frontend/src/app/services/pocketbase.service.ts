import { Injectable, signal } from '@angular/core';
import PocketBase, { RecordModel } from 'pocketbase';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PocketBaseService {
  readonly pb: PocketBase;
  readonly isConnected = signal(false);

  constructor() {
    this.pb = new PocketBase(environment.pocketbaseUrl);
    this.checkHealth();
  }

  async checkHealth(): Promise<boolean> {
    try {
      await this.pb.health.check();
      this.isConnected.set(true);
      return true;
    } catch {
      this.isConnected.set(false);
      return false;
    }
  }

  async listRecords<T extends RecordModel>(
    collection: string,
    page = 1,
    perPage = 30,
    sort = '-created',
    filter = '',
  ): Promise<T[]> {
    const result = await this.pb.collection(collection).getList<T>(page, perPage, {
      sort,
      filter,
    });
    return result.items;
  }

  async getRecord<T extends RecordModel>(collection: string, id: string): Promise<T> {
    return this.pb.collection(collection).getOne<T>(id);
  }

  subscribe(
    collection: string,
    callback: (data: { action: string; record: RecordModel }) => void,
  ): () => void {
    this.pb.collection(collection).subscribe('*', callback);
    return () => this.pb.collection(collection).unsubscribe('*');
  }
}
