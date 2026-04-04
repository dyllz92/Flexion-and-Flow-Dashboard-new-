import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Users, CheckSquare, FileText, Activity, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { format, subDays, isSameDay, parseISO } from 'date-fns';
import { cn } from '../lib/utils';

const StatsCard: React.FC<{ title: string; value: string | number; icon: any; color: string; trend?: string }> = ({ title, value, icon: Icon, color, trend }) => (
  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900 mt-1">{value}</h3>
        {trend && (
          <p className="text-xs font-medium text-emerald-600 mt-2 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            {trend}
          </p>
        )}
      </div>
      <div className={cn("p-3 rounded-lg", color)}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
  </div>
);

const DashboardOverview: React.FC = () => {
  const [stats, setStats] = useState({
    totalClients: 0,
    pendingTasks: 0,
    recentIntakes: 0,
    completedSoaps: 0
  });
  const [recentIntakes, setRecentIntakes] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      const [
        { count: totalClients },
        { count: pendingTasks },
        { data: intakesData },
        { data: tasksData }
      ] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }),
        supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('intakes').select('*').order('intakeDate', { ascending: false }).limit(10),
        supabase.from('tasks').select('*').eq('status', 'pending').limit(5)
      ]);

      setStats(prev => ({
        ...prev,
        totalClients: totalClients || 0,
        pendingTasks: pendingTasks || 0,
        recentIntakes: intakesData?.length || 0
      }));

      setTasks(tasksData || []);
      setRecentIntakes(intakesData || []);

      if (intakesData) {
        // Generate chart data for the last 7 days
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const date = subDays(new Date(), i);
          const count = intakesData.filter(intake => {
            if (!intake.intakeDate) return false;
            const intakeDate = parseISO(intake.intakeDate);
            return isSameDay(intakeDate, date);
          }).length;
          return {
            name: format(date, 'MMM dd'),
            count
          };
        }).reverse();
        setChartData(last7Days);
      }
    };

    fetchStats();

    const channel = supabase.channel('dashboard_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'intakes' }, fetchStats)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard title="Total Clients" value={stats.totalClients} icon={Users} color="bg-blue-500" trend="+12% from last month" />
        <StatsCard title="Pending Tasks" value={stats.pendingTasks} icon={CheckSquare} color="bg-amber-500" />
        <StatsCard title="Recent Intakes" value={stats.recentIntakes} icon={FileText} color="bg-emerald-500" trend="+5 this week" />
        <StatsCard title="System Health" value="99.9%" icon={Activity} color="bg-indigo-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            Intake Trends (Last 7 Days)
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="count" stroke="#10b981" fillOpacity={1} fill="url(#colorCount)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              Urgent Tasks
            </h3>
            <button className="text-xs font-medium text-emerald-600 hover:text-emerald-700">View All</button>
          </div>
          <div className="space-y-4">
            {tasks.length > 0 ? tasks.map((task) => (
              <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors border-l-4 border-amber-400">
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900">{task.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{task.clientName || 'General Task'}</p>
                  <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">Due: {task.dueDate ? format(parseISO(task.dueDate), 'MMM dd, HH:mm') : 'N/A'}</p>
                </div>
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              </div>
            )) : (
              <div className="text-center py-8">
                <p className="text-sm text-slate-500 italic">No pending tasks!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" />
            Recent Intakes
          </h3>
          <button className="text-xs font-medium text-emerald-600 hover:text-emerald-700">Download CSV</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-widest font-bold">
                <th className="px-6 py-4">Client</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentIntakes.map((intake) => (
                <tr key={intake.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-900">{intake.clientName}</p>
                    <p className="text-xs text-slate-500">{intake.clientPhone}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{intake.clientEmail}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{intake.intakeDate ? format(parseISO(intake.intakeDate), 'MMM dd, yyyy') : 'N/A'}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700">Received</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <a href={intake.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700 text-sm font-medium">View PDF</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
