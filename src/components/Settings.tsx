import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Settings as SettingsIcon, User, Shield, Bell, Database, Save, AlertTriangle, FileText, History, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { logAdminAction } from '../services/auditService';
import { format, parseISO } from 'date-fns';
import { cn } from '../lib/utils';

const Settings: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [activeSection, setActiveSection] = useState('profile');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const sections = [
    { id: 'profile', label: 'Profile Settings', icon: User },
    { id: 'security', label: 'Security & Access', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'database', label: 'Data Management', icon: Database },
    { id: 'audit', label: 'Audit Logs', icon: History },
  ];

  useEffect(() => {
    if (activeSection === 'audit') {
      const fetchLogs = async () => {
        const { data } = await supabase.from('audit_log').select('*').order('timestamp', { ascending: false }).limit(50);
        if (data) setAuditLogs(data);
      };

      fetchLogs();

      const channel = supabase.channel('audit_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_log' }, fetchLogs)
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [activeSection]);

  const handleSaveProfile = async () => {
    // Mock save
    await logAdminAction({
      action: 'UPDATE_SETTINGS',
      details: 'Updated administrator profile settings'
    });
    alert('Settings saved and logged!');
  };

  const handleExport = async (type: string) => {
    await logAdminAction({
      action: 'EXPORT_DATA',
      details: `Exported system data as ${type}`
    });
    alert(`${type} export initiated and logged!`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-emerald-500" />
          System Settings
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-1">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                activeSection === section.id 
                  ? "bg-white text-emerald-600 shadow-sm border border-slate-200" 
                  : "text-slate-500 hover:bg-slate-100"
              )}
            >
              <section.icon className="w-5 h-5" />
              {section.label}
            </button>
          ))}
        </div>

        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {activeSection === 'profile' && (
            <div className="p-8 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-6 pb-8 border-b border-slate-100">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-2xl border-4 border-white shadow-sm">
                  {user?.user_metadata?.full_name?.charAt(0) || user?.email?.charAt(0) || '?'}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{user?.user_metadata?.full_name || 'Admin User'}</h3>
                  <p className="text-sm text-slate-500">{user?.email}</p>
                  <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-200">
                    {isAdmin ? 'System Administrator' : 'Therapist'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Display Name</label>
                  <input
                    type="text"
                    defaultValue={user?.user_metadata?.full_name || ''}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
                  <input
                    type="email"
                    disabled
                    value={user?.email || ''}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 text-sm cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button 
                  onClick={handleSaveProfile}
                  className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
              </div>
            </div>
          )}

          {activeSection === 'security' && (
            <div className="p-8 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-lg font-bold text-slate-900">Security & Access Control</h3>
              <div className="space-y-4">
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-amber-900">Admin Access Only</p>
                    <p className="text-xs text-amber-700 mt-1">
                      You are currently logged in as a system administrator. Be careful when modifying security settings as they affect all users.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="text-sm font-bold text-slate-900">Two-Factor Authentication</p>
                    <p className="text-xs text-slate-500 mt-0.5">Add an extra layer of security to your account.</p>
                  </div>
                  <button className="px-4 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-white transition-all shadow-sm">Enable</button>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="text-sm font-bold text-slate-900">Session Management</p>
                    <p className="text-xs text-slate-500 mt-0.5">Sign out of all other devices.</p>
                  </div>
                  <button className="px-4 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-white transition-all shadow-sm">Sign Out All</button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'database' && (
            <div className="p-8 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-lg font-bold text-slate-900">Data Management</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-2xl border border-slate-100 bg-slate-50 space-y-4">
                  <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Export All Data</p>
                    <p className="text-xs text-slate-500 mt-1">Download a full backup of all clients, tasks, and intakes in JSON format.</p>
                  </div>
                  <button 
                    onClick={() => handleExport('JSON')}
                    className="w-full py-2 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all shadow-sm"
                  >
                    Export JSON
                  </button>
                </div>

                <div className="p-6 rounded-2xl border border-slate-100 bg-slate-50 space-y-4">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Client CSV Export</p>
                    <p className="text-xs text-slate-500 mt-1">Export your client list to a CSV file compatible with Excel or Google Sheets.</p>
                  </div>
                  <button 
                    onClick={() => handleExport('CSV')}
                    className="w-full py-2 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all shadow-sm"
                  >
                    Export CSV
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'audit' && (
            <div className="p-8 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">Administrative Audit Logs</h3>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filter logs..."
                    className="pl-9 pr-4 py-1.5 rounded-lg border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-100">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] uppercase tracking-widest font-bold text-slate-500">
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Admin</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {auditLogs.length > 0 ? auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 text-xs text-slate-500 font-medium whitespace-nowrap">
                          {log.timestamp ? format(parseISO(log.timestamp), 'MMM dd, HH:mm:ss') : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-700">
                          {log.adminEmail?.split('@')[0] || 'Unknown'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider",
                            log.action?.includes('DELETE') ? "bg-red-100 text-red-700" :
                            log.action?.includes('CREATE') ? "bg-emerald-100 text-emerald-700" :
                            "bg-blue-100 text-blue-700"
                          )}>
                            {log.action?.replace('_', ' ') || 'ACTION'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {log.details}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-400 italic">
                          No audit logs found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
