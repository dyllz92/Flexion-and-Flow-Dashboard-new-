import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { logAdminAction } from '../services/auditService';
import { Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';

const WebhookSimulator: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    clientName: 'Jane Smith',
    clientEmail: 'jane@example.com',
    clientPhone: '555-0123',
    sessionDate: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss'Z'")
  });

  const simulateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      const submissionId = `sub_${Math.random().toString(36).substr(2, 9)}`;
      const intakeDate = new Date().toISOString();

      // 1. Create Intake Record
      await supabase.from('intakes').insert({
        submissionId,
        clientName: formData.clientName,
        clientEmail: formData.clientEmail,
        clientPhone: formData.clientPhone,
        intakeDate,
        sessionDate: formData.sessionDate,
        pdfUrl: 'https://picsum.photos/seed/intake/800/1200' // Mock PDF URL
      });

      // 2. Create/Update Client Profile
      const { data: existingClient } = await supabase
        .from('clients')
        .select('*')
        .eq('email', formData.clientEmail)
        .single();

      if (!existingClient) {
        await supabase.from('clients').insert({
          name: formData.clientName,
          email: formData.clientEmail,
          phone: formData.clientPhone,
          lastIntakeDate: intakeDate
        });
      } else {
        await supabase.from('clients').update({
          lastIntakeDate: intakeDate,
          phone: formData.clientPhone // Update phone if changed
        }).eq('id', existingClient.id);
      }

      // 3. Create Tasks
      await supabase.from('tasks').insert([
        {
          title: `SOAP Note: ${formData.clientName}`,
          description: `Complete SOAP note for session on ${format(new Date(formData.sessionDate), 'MMM dd')}`,
          status: 'pending',
          dueDate: new Date(new Date(formData.sessionDate).getTime() + 24 * 60 * 60 * 1000).toISOString(), // Due 24h after session
          clientEmail: formData.clientEmail,
          clientName: formData.clientName,
          submissionId,
          type: 'soap_note'
        },
        {
          title: `Follow-up: ${formData.clientName}`,
          description: `Check in with client 3 weeks after intake.`,
          status: 'pending',
          dueDate: new Date(new Date(intakeDate).getTime() + 21 * 24 * 60 * 60 * 1000).toISOString(),
          clientEmail: formData.clientEmail,
          clientName: formData.clientName,
          submissionId,
          type: 'follow_up'
        }
      ]);

      await logAdminAction({
        action: 'SIMULATE_WEBHOOK',
        details: `Simulated intake submission for ${formData.clientName} (${formData.clientEmail})`,
        targetId: submissionId,
        targetType: 'intake'
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Webhook simulation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Send className="w-5 h-5 text-emerald-500" />
          Webhook Simulator
        </h3>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded">Dev Tool</span>
      </div>

      <form onSubmit={simulateWebhook} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Client Name</label>
            <input
              type="text"
              required
              value={formData.clientName}
              onChange={e => setFormData({ ...formData, clientName: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Client Email</label>
            <input
              type="email"
              required
              value={formData.clientEmail}
              onChange={e => setFormData({ ...formData, clientEmail: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Session Date</label>
          <input
            type="datetime-local"
            required
            value={formData.sessionDate.slice(0, 16)}
            onChange={e => setFormData({ ...formData, sessionDate: new Date(e.target.value).toISOString() })}
            className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all",
            success 
              ? "bg-emerald-100 text-emerald-700 border border-emerald-200" 
              : "bg-slate-900 text-white hover:bg-slate-800"
          )}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing Webhook...
            </>
          ) : success ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Webhook Received & Processed!
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Simulate Intake Submission
            </>
          )}
        </button>
      </form>

      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
        <p className="text-[10px] text-blue-700 font-medium leading-relaxed">
          <AlertCircle className="w-3 h-3 inline-block mr-1 -mt-0.5" />
          This tool simulates the <strong>Intake Form</strong> app sending a webhook to this dashboard. 
          It will auto-create a client profile, an intake record, a SOAP note reminder, and a follow-up task.
        </p>
      </div>
    </div>
  );
};

export default WebhookSimulator;
