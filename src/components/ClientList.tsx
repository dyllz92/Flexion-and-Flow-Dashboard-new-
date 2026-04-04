import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logAdminAction } from '../services/auditService';
import { Users, Search, Mail, Phone, Calendar, Trash2, Edit2, ExternalLink } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '../lib/utils';

const ClientList: React.FC = () => {
  const [clients, setClients] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchClients = async () => {
      const { data } = await supabase.from('clients').select('*').order('name', { ascending: true });
      if (data) setClients(data);
    };

    fetchClients();

    const channel = supabase.channel('clients_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, fetchClients)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredClients = clients.filter(client => 
    client.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const deleteClient = async (clientId: string, clientName: string) => {
    if (window.confirm(`Are you sure you want to delete the profile for ${clientName}?`)) {
      await supabase.from('clients').delete().eq('id', clientId);
      
      await logAdminAction({
        action: 'DELETE_CLIENT',
        details: `Deleted client profile: ${clientName}`,
        targetId: clientId,
        targetType: 'client'
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Users className="w-6 h-6 text-emerald-500" />
          Client Profiles
        </h2>
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search clients..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClients.length > 0 ? filteredClients.map((client) => (
          <div key={client.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-lg">
                {client.name?.charAt(0) || '?'}
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteClient(client.id, client.name)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <h3 className="text-lg font-bold text-slate-900">{client.name}</h3>
            <div className="space-y-2 mt-4">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Mail className="w-4 h-4 text-slate-400" />
                {client.email}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Phone className="w-4 h-4 text-slate-400" />
                {client.phone || 'No phone provided'}
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Last Intake</p>
                <p className="text-xs font-medium text-slate-700">
                  {client.lastIntakeDate ? format(parseISO(client.lastIntakeDate), 'MMM dd, yyyy') : 'Never'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Last SOAP</p>
                <p className="text-xs font-medium text-slate-700">
                  {client.lastSoapNoteDate ? format(parseISO(client.lastSoapNoteDate), 'MMM dd, yyyy') : 'Never'}
                </p>
              </div>
            </div>

            <button className="w-full mt-6 flex items-center justify-center gap-2 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
              <ExternalLink className="w-4 h-4" />
              View Full History
            </button>
          </div>
        )) : (
          <div className="col-span-full text-center py-12 bg-white rounded-xl border border-slate-200">
            <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No clients found matching your search.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientList;
