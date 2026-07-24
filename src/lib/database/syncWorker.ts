import { getDB } from './db';
import { supabase } from '../auth/supabase';
import NetInfo from '@react-native-community/netinfo';

export async function flushOutbox() {
  const db = await getDB();
  
  // Only attempt sync if we have a network connection
  const netInfo = await NetInfo.fetch();
  if (!netInfo.isConnected) return;

  const session = await supabase.auth.getSession();
  if (!session.data.session) return; // Only sync if logged in

  const pending = await db.getAllAsync<{ 
    id: string; 
    entity_type: string; 
    operation: string; 
    payload: string; 
  }>(
    `SELECT id, entity_type, operation, payload FROM pending_sync WHERE sync_status = 'pending' ORDER BY created_at ASC`
  );

  if (pending.length === 0) return;

  for (const item of pending) {
    try {
      const payloadObj = JSON.parse(item.payload);
      
      let error = null;
      
      if (item.operation === 'DELETE') {
        const { error: e } = await supabase.from(item.entity_type).delete().match({ id: payloadObj.id });
        error = e;
      } else {
        const { error: e } = await supabase.from(item.entity_type).upsert(payloadObj);
        error = e;
      }

      if (error) {
        console.error('Sync error for item', item.id, error);
        // Mark as failed to retry later
        await db.runAsync(`UPDATE pending_sync SET sync_status = 'failed', retry_count = retry_count + 1 WHERE id = ?`, [item.id]);
      } else {
        // Success! Remove from outbox
        await db.runAsync(`DELETE FROM pending_sync WHERE id = ?`, [item.id]);
      }
    } catch (err) {
      console.error('Failed to process sync item', item.id, err);
      await db.runAsync(`UPDATE pending_sync SET sync_status = 'failed', retry_count = retry_count + 1 WHERE id = ?`, [item.id]);
    }
  }
}
