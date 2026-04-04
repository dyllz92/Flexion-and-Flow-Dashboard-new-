import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logAdminAction } from '../services/auditService';
import { CheckCircle2, Clock, AlertCircle, Plus, Trash2, Check, X, Calendar, Users } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '../lib/utils';

const TaskList: React.FC = () => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    dueDate: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
    type: 'manual' as const,
    clientName: '',
    clientEmail: ''
  });

  useEffect(() => {
    const fetchTasks = async () => {
      const { data } = await supabase.from('tasks').select('*').order('dueDate', { ascending: true });
      if (data) setTasks(data);
    };

    fetchTasks();

    const channel = supabase.channel('tasks_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchTasks)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title) return;

    const { data, error } = await supabase.from('tasks').insert({
      title: newTask.title,
      description: newTask.description,
      dueDate: newTask.dueDate,
      type: newTask.type,
      clientName: newTask.clientName,
      clientEmail: newTask.clientEmail,
      status: 'pending',
      createdAt: new Date().toISOString()
    }).select().single();

    if (data) {
      await logAdminAction({
        action: 'CREATE_TASK',
        details: `Created task: ${newTask.title}`,
        targetId: data.id,
        targetType: 'task'
      });
    }

    setNewTask({
      title: '',
      description: '',
      dueDate: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
      type: 'manual',
      clientName: '',
      clientEmail: ''
    });
    setIsAdding(false);
  };

  const toggleStatus = async (taskId: string, currentStatus: string, title: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
    
    await logAdminAction({
      action: 'TOGGLE_TASK_STATUS',
      details: `Marked task "${title}" as ${newStatus}`,
      targetId: taskId,
      targetType: 'task'
    });
  };

  const deleteTask = async (taskId: string, title: string) => {
    if (window.confirm(`Are you sure you want to delete the task: ${title}?`)) {
      await supabase.from('tasks').delete().eq('id', taskId);
      
      await logAdminAction({
        action: 'DELETE_TASK',
        details: `Deleted task: ${title}`,
        targetId: taskId,
        targetType: 'task'
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          Task Management
        </h2>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Task
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-lg animate-in fade-in slide-in-from-top-4 duration-300">
          <form onSubmit={handleAddTask} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Task Title</label>
                <input
                  type="text"
                  required
                  value={newTask.title}
                  onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  placeholder="e.g., Follow up with Jane"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Due Date</label>
                <input
                  type="datetime-local"
                  required
                  value={newTask.dueDate.slice(0, 16)}
                  onChange={e => setNewTask({ ...newTask, dueDate: new Date(e.target.value).toISOString() })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Description</label>
              <textarea
                value={newTask.description}
                onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none h-24"
                placeholder="Task details..."
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-lg text-sm font-bold transition-colors"
              >
                Create Task
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-100">
          {tasks.length > 0 ? tasks.map((task) => (
            <div key={task.id} className={cn(
              "p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors",
              task.status === 'completed' && "bg-slate-50/50"
            )}>
              <button
                onClick={() => toggleStatus(task.id, task.status, task.title)}
                className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                  task.status === 'completed' 
                    ? "bg-emerald-500 border-emerald-500 text-white" 
                    : "border-slate-300 text-transparent hover:border-emerald-400"
                )}
              >
                <Check className="w-4 h-4" />
              </button>
              
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className={cn(
                    "text-sm font-bold text-slate-900",
                    task.status === 'completed' && "line-through text-slate-400"
                  )}>
                    {task.title}
                  </h4>
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider",
                    task.type === 'soap_note' ? "bg-blue-100 text-blue-700" :
                    task.type === 'follow_up' ? "bg-purple-100 text-purple-700" :
                    "bg-slate-100 text-slate-700"
                  )}>
                    {task.type?.replace('_', ' ') || 'manual'}
                  </span>
                </div>
                <p className={cn(
                  "text-xs text-slate-500 mt-0.5",
                  task.status === 'completed' && "text-slate-400"
                )}>
                  {task.description || 'No description provided.'}
                </p>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <Calendar className="w-3 h-3" />
                    Due: {task.dueDate ? format(parseISO(task.dueDate), 'MMM dd, yyyy HH:mm') : 'N/A'}
                  </div>
                  {task.clientName && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <Users className="w-3 h-3" />
                      {task.clientName}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => deleteTask(task.id, task.title)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )) : (
            <div className="text-center py-12">
              <CheckCircle2 className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">All caught up! No tasks found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskList;
