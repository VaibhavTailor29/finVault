/**
 * Dexie-based Offline IndexedDB for PWA Support (Phase 2).
 * Queues offline-created transactions with client-generated UUIDs and idempotency keys.
 */
import Dexie, { Table } from 'dexie';

export interface OfflineQueueItem {
  id: string;
  type: 'expense' | 'income' | 'transfer';
  data: any;
  idempotencyKey: string;
  createdAt: number;
  synced: number; // 0 = false, 1 = true
}

export class FinVaultOfflineDatabase extends Dexie {
  offlineQueue!: Table<OfflineQueueItem, string>;

  constructor() {
    super('FinVaultOfflineDB');
    this.version(1).stores({
      offlineQueue: 'id, type, idempotencyKey, synced, createdAt',
    });
  }
}

export const offlineDb = new FinVaultOfflineDatabase();

export async function queueOfflineTransaction(type: 'expense' | 'income' | 'transfer', data: any) {
  const id = `off_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const idempotencyKey = `${type}_${Date.now()}_${data.amount}_${data.date}`;
  await offlineDb.offlineQueue.add({
    id,
    type,
    data,
    idempotencyKey,
    createdAt: Date.now(),
    synced: 0,
  });
  return id;
}

export async function getUnsyncedTransactions(): Promise<OfflineQueueItem[]> {
  return await offlineDb.offlineQueue.where('synced').equals(0).toArray();
}

export async function markAsSynced(id: string) {
  await offlineDb.offlineQueue.update(id, { synced: 1 });
}
