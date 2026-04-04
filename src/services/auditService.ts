import { supabase } from '../lib/supabase';

export type AuditAction = 
  | 'CREATE_CLIENT' | 'UPDATE_CLIENT' | 'DELETE_CLIENT'
  | 'CREATE_TASK' | 'UPDATE_TASK' | 'DELETE_TASK'
  | 'TOGGLE_TASK_STATUS' | 'SIMULATE_WEBHOOK'
  | 'UPDATE_SETTINGS' | 'EXPORT_DATA';

export interface AuditLogEntry {
  action: AuditAction;
  details: string;
  targetId?: string;
  targetType?: string;
}

export const logAdminAction = async (entry: AuditLogEntry) => {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return;

  try {
    await supabase.from('audit_log').insert({
      action: entry.action,
      details: entry.details,
      targetId: entry.targetId,
      targetType: entry.targetType,
      adminEmail: user.email,
      adminId: user.id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log audit entry:', error);
  }
};
