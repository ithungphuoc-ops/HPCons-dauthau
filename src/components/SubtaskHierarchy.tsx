import React, { useState } from 'react';
import { ProjectTask, Staff } from '../types';
import { 
  Plus, 
  Trash2, 
  CheckSquare, 
  Square, 
  ChevronDown, 
  ChevronRight, 
  User, 
  CornerDownRight, 
  Percent,
  Users,
  BookOpen,
  Sliders,
  ClipboardList
} from 'lucide-react';
import {
  updateTaskInTree,
  addSubtaskToTree,
  removeTaskFromTree,
  getTaskProgress
} from '../utils/taskTree';
import FileDropZone from './FileDropZone';
import { parseAttachments, joinAttachments } from '../utils/attachments';

interface SubtaskHierarchyProps {
  tasks: ProjectTask[];
  onChange: (updatedTasks: ProjectTask[]) => void;
  staff: Staff[];
  currentUserRole?: 'BOOD' | 'MANAGER' | 'STAFF';
  currentUserId?: string;
}

export default function SubtaskHierarchy({ tasks, onChange, staff, currentUserRole, currentUserId }: SubtaskHierarchyProps) {
  const canEdit = currentUserRole === 'BOOD' || currentUserRole === 'MANAGER';
  // Nhân sự còn làm việc — dùng cho các ô chọn giao việc (người đã nghỉ vẫn nằm trong `staff` để tra cứu tên)
  const activeStaff = staff.filter(s => !s.daNghi);

  // Store expanded state of nodes that have subtasks
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  // Store parent ID for which we are currently adding a child subtask
  const [addingChildFor, setAddingChildFor] = useState<string | null>(null);
  // Store expanded state of details panel for leaf tasks
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
  // Track open dropdown for task assignees
  const [openAssigneeTaskId, setOpenAssigneeTaskId] = useState<string | null>(null);
  // Track upload feedback banner
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);
  // Tên file kế hoạch kế thừa từ dự án cũ (chỉ đính kèm tham khảo, KHÔNG tự tạo việc)
  const [inheritedPlanFile, setInheritedPlanFile] = useState<string | null>(null);
  const [inheritedDragOver, setInheritedDragOver] = useState(false);

  const [newSubtaskName, setNewSubtaskName] = useState('');
  const [newSubtaskWeight, setNewSubtaskWeight] = useState(25);
  const [newSubtaskAssignee, setNewSubtaskAssignee] = useState('');

  const toggleExpand = (id: string) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleDetails = (id: string) => {
    setExpandedDetails(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Tìm task trong cây theo id (phục vụ kiểm tra điều kiện hoàn thành)
  const findTask = (list: ProjectTask[], id: string): ProjectTask | undefined => {
    for (const t of list) {
      if (t.id === id) return t;
      if (t.subtasks && t.subtasks.length > 0) {
        const found = findTask(t.subtasks, id);
        if (found) return found;
      }
    }
    return undefined;
  };

  const handleToggleComplete = (id: string, currentCompleted: boolean) => {
    // Quy tắc: chỉ được đánh dấu done khi nhân viên đã cập nhật kết quả công việc
    // và tiến độ thực hiện đạt 100%. Việc cha tự hoàn thành theo việc con.
    if (!currentCompleted) {
      const target = findTask(tasks, id);
      if (target) {
        if (target.subtasks && target.subtasks.length > 0) {
          setUploadFeedback('⚠ Việc cha sẽ tự hoàn thành khi toàn bộ công việc con hoàn thành — không đánh dấu tay được.');
          setTimeout(() => setUploadFeedback(null), 5000);
          return;
        }
        if (!(target.ketQuaCongViec || '').trim()) {
          setUploadFeedback('⚠ Chưa thể đánh dấu hoàn thành: nhân viên cần cập nhật KẾT QUẢ CÔNG VIỆC trước!');
          setTimeout(() => setUploadFeedback(null), 5000);
          return;
        }
        if ((target.staffProgress ?? 0) < 100) {
          setUploadFeedback(`⚠ Chưa thể đánh dấu hoàn thành: tiến độ thực hiện phải đạt 100% (hiện tại ${target.staffProgress ?? 0}%)!`);
          setTimeout(() => setUploadFeedback(null), 5000);
          return;
        }
      }
    }
    const nextCompleted = !currentCompleted;
    const updated = updateTaskInTree(tasks, id, (t) => ({
      isCompleted: nextCompleted,
      completedAt: nextCompleted ? new Date().toISOString().split('T')[0] : undefined,
      staffProgress: nextCompleted ? 100 : 0,
      managerProgress: nextCompleted ? 100 : 0
    }));
    onChange(updated);
  };

  const handleUpdateName = (id: string, name: string) => {
    const updated = updateTaskInTree(tasks, id, () => ({ name }));
    onChange(updated);
  };

  const handleUpdateWeight = (id: string, weight: number) => {
    const updated = updateTaskInTree(tasks, id, () => ({ weight }));
    onChange(updated);
  };

  const handleUpdateAssignee = (id: string, assignedTo: string) => {
    const updated = updateTaskInTree(tasks, id, () => ({ assignedTo: assignedTo || undefined }));
    onChange(updated);
  };

  const handleUpdateDetailedPlan = (id: string, detailedPlan: string) => {
    const updated = updateTaskInTree(tasks, id, () => ({ detailedPlan }));
    onChange(updated);
  };

  const handleUpdateStaffProgress = (id: string, progress: number) => {
    const updated = updateTaskInTree(tasks, id, () => ({ staffProgress: progress }));
    onChange(updated);
  };

  const handleUpdateManagerProgress = (id: string, progress: number) => {
    const updated = updateTaskInTree(tasks, id, () => ({ managerProgress: progress }));
    onChange(updated);
  };

  const handleToggleStaffAssignee = (id: string, staffId: string, currentIds: string[] = []) => {
    const nextIds = currentIds.includes(staffId)
      ? currentIds.filter(x => x !== staffId)
      : [...currentIds, staffId];
    const updated = updateTaskInTree(tasks, id, () => ({ assignedStaffIds: nextIds }));
    onChange(updated);
  };

  const handleDelete = (id: string) => {
    const updated = removeTaskFromTree(tasks, id);
    onChange(updated);
  };

  const handleToggleAssignee = (taskId: string, staffId: string, currentAssignedTo?: string, currentStaffIds: string[] = []) => {
    const allAssigned = Array.from(new Set(
      (currentAssignedTo ? [currentAssignedTo] : []).concat(currentStaffIds).filter(Boolean)
    ));
    
    let nextIds: string[];
    if (allAssigned.includes(staffId)) {
      nextIds = allAssigned.filter(id => id !== staffId);
    } else {
      nextIds = [...allAssigned, staffId];
    }
    
    const updated = updateTaskInTree(tasks, taskId, () => ({
      assignedTo: nextIds[0] || undefined,
      assignedStaffIds: nextIds.slice(1)
    }));
    onChange(updated);
  };

  // Chỉ ĐÍNH KÈM file kế hoạch kế thừa từ dự án cũ (tham khảo) — KHÔNG tự tạo công việc.
  // Người dùng tự xây danh sách việc con dựa trên file này.
  // Kéo-thả / chọn NHIỀU file kế hoạch kế thừa. Mỗi file < 25MB; file lớn hơn bị bỏ qua kèm cảnh báo.
  const INHERIT_MAX_MB = 25;
  const attachInheritedPlanFiles = (list: FileList | File[] | null) => {
    if (!list || !('length' in list) || list.length === 0) return;
    const arr = Array.from(list);
    const limit = INHERIT_MAX_MB * 1024 * 1024;
    const ok = arr.filter((f) => f.size <= limit);
    const tooBig = arr.filter((f) => f.size > limit);
    if (ok.length) {
      const names = ok.map((f) => f.name);
      const existing = inheritedPlanFile ? inheritedPlanFile.split(' | ').filter(Boolean) : [];
      const merged = [...existing];
      names.forEach((n) => { if (!merged.includes(n)) merged.push(n); });
      setInheritedPlanFile(merged.join(' | '));
    }
    if (tooBig.length) {
      const names = tooBig.map((f) => `"${f.name}" (${(f.size / 1024 / 1024).toFixed(1)}MB)`).join(', ');
      setUploadFeedback(`⚠ ${tooBig.length} tệp vượt quá ${INHERIT_MAX_MB}MB: ${names}. Hãy gửi ĐƯỜNG LINK tệp thay vì tải trực tiếp để tránh làm nặng hệ thống.`);
    } else {
      setUploadFeedback(`Đã đính kèm ${ok.length} file kế hoạch kế thừa. Bạn tự thêm các đầu việc bên dưới dựa trên kế hoạch này.`);
    }
    setTimeout(() => setUploadFeedback(null), 6000);
  };

  const handleAttachInheritedPlan = (e: React.ChangeEvent<HTMLInputElement>) => {
    attachInheritedPlanFiles(e.target.files);
    e.target.value = '';
  };

  const handleAddChildSubtask = (parentId: string) => {
    if (!newSubtaskName.trim()) return;
    const child: ProjectTask = {
      id: `T-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: newSubtaskName.trim(),
      weight: newSubtaskWeight,
      isCompleted: false,
      assignedTo: newSubtaskAssignee || undefined,
      assignedStaffIds: [],
      detailedPlan: '',
      staffProgress: 0,
      managerProgress: 0,
      subtasks: []
    };
    const updated = addSubtaskToTree(tasks, parentId, child);
    onChange(updated);
    
    // Auto-expand the parent node to show the new child
    setExpandedNodes(prev => ({ ...prev, [parentId]: true }));
    setAddingChildFor(null);
    setNewSubtaskName('');
    setNewSubtaskWeight(25);
    setNewSubtaskAssignee('');
  };

  // Helper to render a node in the task tree recursively
  const renderTaskNode = (task: ProjectTask, depth: number = 0) => {
    const hasChildren = task.subtasks && task.subtasks.length > 0;
    const isExpanded = expandedNodes[task.id] !== false; // expanded by default
    const progress = getTaskProgress(task);
    const assignedStaff = staff.find(s => s.id === task.assignedTo);
    const allAssignedIds = Array.from(new Set(
      (task.assignedTo ? [task.assignedTo] : []).concat(task.assignedStaffIds || []).filter(Boolean)
    ));
    const isDetailsExpanded = !!expandedDetails[task.id];

    // Check if current user is assigned directly or as a joint member
    const isAssignedToTask = 
      task.assignedTo === currentUserId || 
      (task.assignedStaffIds && task.assignedStaffIds.includes(currentUserId || ''));

    // Check permissions
    const canEditStaffProgress = 
      currentUserRole === 'BOOD' || 
      currentUserRole === 'MANAGER' || 
      isAssignedToTask;

    const canEditManagerProgress = 
      currentUserRole === 'BOOD' || 
      currentUserRole === 'MANAGER';

    return (
      <div key={task.id} className="group flex flex-col">
        {/* Core Task Item Bar */}
        <div 
          className={`flex items-center justify-between gap-3 p-2 rounded-xl transition-all border border-transparent hover:bg-slate-50 dark:hover:bg-dark-elevated/60 hover:border-slate-200/50 dark:hover:border-slate-800 ${
            isDetailsExpanded ? 'bg-slate-50/50 dark:bg-dark-elevated/30 border-slate-200/50 dark:border-slate-800' : ''
          }`}
          style={{ paddingLeft: `${Math.max(8, depth * 24)}px` }}
        >
          <div className="flex items-center gap-2 flex-1">
            {/* Indent connector symbol */}
            {depth > 0 && (
              <CornerDownRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0 -ml-1" />
            )}

            {/* Expand / Collapse Toggle for Nodes with children */}
            {hasChildren ? (
              <button 
                type="button"
                onClick={() => toggleExpand(task.id)} 
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors rounded"
              >
                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
            ) : (
              <div className="w-5 h-5 shrink-0" />
            )}

            {/* Completion Tickbox */}
            <button
              type="button"
              onClick={() => handleToggleComplete(task.id, task.isCompleted)}
              className="text-slate-400 hover:text-brand-accent dark:hover:text-brand-accent-300 transition-colors rounded shrink-0"
              title={hasChildren ? "Hoàn thành tác vụ con để tự động hoàn thành việc cha" : "Đánh dấu hoàn thành"}
            >
              {task.isCompleted ? (
                <CheckSquare className="w-4.5 h-4.5 text-brand-accent dark:text-brand-accent-300" />
              ) : (
                <Square className="w-4.5 h-4.5" />
              )}
            </button>

            {/* Task Title Edit Input */}
            <input 
              type="text"
              value={task.name}
              onChange={(e) => handleUpdateName(task.id, e.target.value)}
              disabled={!canEdit}
              className={`flex-1 bg-transparent px-2 py-1 text-xs border-b border-transparent focus:border-slate-300 dark:focus:border-slate-700 focus:outline-none transition-colors ${
                task.isCompleted ? 'line-through text-slate-400 dark:text-slate-500 font-medium' : 'text-slate-700 dark:text-slate-200 font-bold'
              } ${!canEdit ? 'cursor-default' : ''}`}
              placeholder="Nhập tên công việc..."
            />
          </div>

          {/* Action Tools & Meta (Weight, Assignee, Subtask Trigger, Delete) */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Progress Percentage Display */}
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
              progress === 100
                ? 'bg-brand-success/10 text-brand-success dark:bg-brand-success/10 dark:text-brand-success-300'
                : 'bg-brand-accent/10 text-brand-accent dark:bg-brand-accent/10 dark:text-brand-accent-300'
            }`}>
              {progress}%
            </span>

            {/* Weight Input */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-dark-elevated px-2 py-1 rounded-lg border border-slate-200/50 dark:border-slate-700/80">
              <span className="text-[9px] font-bold text-slate-400 uppercase">Tỉ trọng:</span>
              <input 
                type="number"
                value={task.weight}
                onChange={(e) => handleUpdateWeight(task.id, parseInt(e.target.value) || 0)}
                disabled={!canEdit}
                className="w-10 bg-transparent text-center text-xs font-black text-slate-700 dark:text-slate-300 focus:outline-none disabled:cursor-default"
                min="0"
                max="100"
              />
              <span className="text-[10px] font-bold text-slate-400">%</span>
            </div>

            {/* Multi-Assignee Selector Dropdown */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => canEdit && setOpenAssigneeTaskId(openAssigneeTaskId === task.id ? null : task.id)}
                disabled={!canEdit}
                className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-dark-card border border-slate-200/60 dark:border-slate-700 text-[10px] font-bold px-2 py-1 rounded-lg text-slate-600 dark:text-slate-300 focus:outline-none cursor-pointer disabled:cursor-default disabled:opacity-85"
                title="Chọn những người thực hiện công việc"
              >
                {/* Overlapping Avatars */}
                <div className="flex -space-x-1.5 overflow-hidden">
                  {allAssignedIds.length === 0 ? (
                    <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-dark-elevated flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0">
                      <User className="w-3 h-3 text-slate-400" />
                    </div>
                  ) : (
                    allAssignedIds.slice(0, 3).map(id => {
                      const s = staff.find(x => x.id === id);
                      if (!s) return null;
                      return s.avatar ? (
                        <img 
                          key={s.id}
                          src={s.avatar} 
                          alt={s.hoTen} 
                          className="w-5 h-5 rounded-full object-cover border border-white dark:border-slate-950 shrink-0" 
                        />
                      ) : (
                        <div key={s.id} className="w-5 h-5 rounded-full bg-brand-accent/15 dark:bg-brand-accent/15 flex items-center justify-center border border-white dark:border-slate-950 text-[9px] font-bold text-brand-accent dark:text-brand-accent-300 shrink-0">
                          {s.hoTen.split(' ').slice(-1)[0][0]}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Display Label / Text */}
                <span className="max-w-[85px] truncate text-[10px]">
                  {allAssignedIds.length === 0 
                    ? 'Giao việc' 
                    : allAssignedIds.length === 1 
                      ? (staff.find(x => x.id === allAssignedIds[0])?.hoTen.split(' ').slice(-1)[0] || '1 người')
                      : `${allAssignedIds.length} người`}
                </span>
                {canEdit && <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />}
              </button>

              {/* Multi-Select Floating Dropdown Panel */}
              {openAssigneeTaskId === task.id && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setOpenAssigneeTaskId(null)} />
                  <div className="absolute right-0 mt-1 w-52 bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-2 space-y-1 max-h-56 overflow-y-auto">
                    <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase px-2 py-1 border-b border-slate-100 dark:border-slate-800 mb-1">
                      Người thực hiện ({allAssignedIds.length})
                    </div>
                    {activeStaff.map(s => {
                      const isAssigned = allAssignedIds.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleToggleAssignee(task.id, s.id, task.assignedTo, task.assignedStaffIds)}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-dark-elevated text-left text-xs transition-all"
                        >
                          <div className="flex items-center gap-2">
                            {s.avatar ? (
                              <img src={s.avatar} alt={s.hoTen} className="w-5 h-5 rounded-full object-cover" />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-dark-elevated flex items-center justify-center text-[9px] font-bold text-slate-500">
                                {s.hoTen.split(' ').slice(-1)[0][0]}
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-slate-700 dark:text-slate-200">{s.hoTen}</div>
                              <div className="text-[9px] text-slate-400">{s.chucVu}</div>
                            </div>
                          </div>
                          <input 
                            type="checkbox" 
                            checked={isAssigned}
                            readOnly
                            className="rounded text-brand-accent focus:ring-brand-accent w-3.5 h-3.5 cursor-pointer accent-brand-accent" 
                          />
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Toggle details section (ONLY for leaf tasks) */}
            {!hasChildren && (
              <button
                type="button"
                onClick={() => toggleDetails(task.id)}
                className={`p-1.5 rounded-lg border transition-all flex items-center gap-1 ${
                  isDetailsExpanded 
                    ? 'bg-brand-accent/15 border-brand-accent/25 text-brand-accent-700 dark:bg-brand-accent/15 dark:border-brand-accent/30 dark:text-brand-accent-300' 
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-700 dark:bg-dark-card dark:border-slate-800 dark:text-slate-400'
                }`}
                title="Cập nhật kết quả công việc, % tiến độ & phân công"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold hidden sm:inline">Kết quả &amp; tiến độ</span>
              </button>
            )}

            {/* Add Child Subtask Button */}
            {canEdit && (
              <button
                type="button"
                onClick={() => setAddingChildFor(addingChildFor === task.id ? null : task.id)}
                className="p-1.5 text-brand-accent hover:text-brand-accent-700 hover:bg-brand-accent/10 dark:hover:bg-brand-accent/15 rounded-lg transition-colors border border-transparent hover:border-brand-accent/15 dark:hover:border-brand-accent/30"
                title="Thêm công việc con cấp tiếp theo"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Delete Button */}
            {canEdit && (
              <button
                type="button"
                onClick={() => handleDelete(task.id)}
                className="p-1.5 text-slate-400 hover:text-brand-danger hover:bg-brand-danger/10 dark:hover:bg-brand-danger/10 rounded-lg transition-colors"
                title="Xóa công việc"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* DETAILS ACCORDION - For Leaf Tasks */}
        {!hasChildren && isDetailsExpanded && (
          <div 
            className="p-4 bg-slate-50/50 dark:bg-dark-card/40 border-x border-b border-slate-200/50 dark:border-slate-800 rounded-b-xl mb-3 space-y-4"
            style={{ marginLeft: `${Math.max(12, depth * 24)}px` }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Side: Assignees & Plans */}
              <div className="space-y-3">
                {/* 1. Assignees list */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                    <Users className="w-3.5 h-3.5 text-brand-accent" /> Nhân viên tham gia thực hiện chung
                  </label>
                  <div className="flex flex-wrap gap-1.5 p-2 bg-white dark:bg-dark-bg border border-slate-200/60 dark:border-slate-800 rounded-lg">
                    {activeStaff.map(s => {
                      const isAssigned = (task.assignedTo === s.id) || (task.assignedStaffIds || []).includes(s.id);
                      const isPrimary = task.assignedTo === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            if (!canEdit) return;
                            if (isPrimary) return; // can't remove primary assignee from staff assigned list
                            handleToggleStaffAssignee(task.id, s.id, task.assignedStaffIds || []);
                          }}
                          disabled={!canEdit}
                          className={`text-[10px] px-2.5 py-1 rounded-full font-bold border transition-all flex items-center gap-1 ${
                            isAssigned
                              ? isPrimary
                                ? 'bg-brand-accent/10 border-brand-accent/25 text-brand-accent-700 dark:bg-brand-accent/15 dark:border-brand-accent/50 dark:text-brand-accent-300'
                                : 'bg-brand-accent/10 border-brand-accent/25 text-brand-accent-700 dark:bg-brand-accent/15 dark:border-brand-accent/50 dark:text-brand-accent-300'
                              : 'bg-slate-50/50 border-slate-100 text-slate-400 dark:bg-dark-card/50 dark:border-slate-800 dark:text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          {s.hoTen}
                          {isPrimary && <span className="text-[8px] uppercase px-1 bg-brand-accent/25 dark:bg-brand-accent/15 rounded text-brand-accent-800 dark:text-brand-accent-300">Chính</span>}
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 block mt-1">
                    * Quản lý có thể nhấp để thêm/bớt nhiều nhân viên cùng làm chung việc con này.
                  </span>
                </div>

                {/* 2. Detailed plan / data */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-brand-primary" /> Kế hoạch chi tiết &amp; Tài liệu (QL cập nhật)
                  </label>
                  {canEdit ? (
                    <textarea
                      value={task.detailedPlan || ''}
                      onChange={(e) => handleUpdateDetailedPlan(task.id, e.target.value)}
                      placeholder="Quản lý nhập bảng biểu, liên kết dữ liệu hoặc hướng dẫn chi tiết tại đây..."
                      className="w-full h-24 p-2 bg-white dark:bg-dark-bg border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand-accent text-slate-700 dark:text-slate-100"
                    />
                  ) : (
                    <div className="p-3 bg-white dark:bg-dark-bg border border-slate-200/80 dark:border-slate-800 rounded-lg text-xs text-slate-600 dark:text-slate-300 min-h-24 font-medium whitespace-pre-wrap leading-relaxed shadow-inner">
                      {task.detailedPlan?.trim() ? task.detailedPlan : 'Chưa có kế hoạch chi tiết hoặc hướng dẫn cụ thể từ Quản lý.'}
                    </div>
                  )}
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 block mt-1">
                    * Nhân viên có quyền xem toàn bộ kế hoạch để phối hợp làm việc (không được sửa).
                  </span>
                </div>
              </div>

              {/* Right Side: 70/30 Progress Sliders */}
              <div className="bg-white dark:bg-dark-bg p-3.5 border border-slate-200/60 dark:border-slate-800 rounded-xl flex flex-col justify-between">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                    <ClipboardList className="w-3.5 h-3.5 text-brand-accent" /> Phân bổ tiến độ con theo vai trò
                  </label>
                  
                  <div className="space-y-4">
                    {/* Staff Slider (70%) */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-700 dark:text-slate-300">👨‍💻 Nhân viên thực hiện (Chiếm 70%)</span>
                        <span className="text-brand-accent dark:text-brand-accent-300">{(task.staffProgress ?? 0)}%</span>
                      </div>
                      <input 
                        type="range"
                        min="0"
                        max="100"
                        value={task.staffProgress ?? 0}
                        onChange={(e) => handleUpdateStaffProgress(task.id, parseInt(e.target.value))}
                        disabled={!canEditStaffProgress}
                        className="w-full h-1.5 bg-slate-100 dark:bg-dark-elevated rounded-lg appearance-none cursor-pointer accent-brand-accent disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <div className="flex justify-between text-[9px] text-slate-400">
                        <span>Chưa bắt đầu</span>
                        <span>Hoàn tất vai trò (70% tổng việc con)</span>
                      </div>
                    </div>

                    {/* Manager Slider (30%) */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-700 dark:text-slate-300">🕵️ Quản lý phê duyệt (Chiếm 30%)</span>
                        <span className="text-brand-warning dark:text-brand-warning">{(task.managerProgress ?? 0)}%</span>
                      </div>
                      <input 
                        type="range"
                        min="0"
                        max="100"
                        value={task.managerProgress ?? 0}
                        onChange={(e) => handleUpdateManagerProgress(task.id, parseInt(e.target.value))}
                        disabled={!canEditManagerProgress}
                        className="w-full h-1.5 bg-slate-100 dark:bg-dark-elevated rounded-lg appearance-none cursor-pointer accent-brand-warning disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <div className="flex justify-between text-[9px] text-slate-400">
                        <span>Chưa duyệt</span>
                        <span>Duyệt tối đa (30% tổng việc con)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress rollup preview */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Tiến độ gộp công việc con</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      (N.Viên * 0.7) + (Q.Lý * 0.3)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <span className="text-lg font-black text-slate-800 dark:text-white block leading-none">
                        {Math.round(((task.staffProgress ?? 0) * 0.7) + ((task.managerProgress ?? 0) * 0.3))}%
                      </span>
                      <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                        task.isCompleted ? 'bg-brand-success/15 text-brand-success-800' : 'bg-brand-warning/15 text-brand-warning'
                      }`}>
                        {task.isCompleted ? 'Đã hoàn thành' : 'Đang thực hiện'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* KẾT QUẢ CÔNG VIỆC (Work Results & Attachments) */}
              <div className="border-t border-slate-200/65 dark:border-slate-800/80 pt-4 space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="flex h-2 w-2 rounded-full bg-brand-primary animate-pulse"></span>
                  📊 KẾT QUẢ CÔNG VIỆC &amp; BÁO CÁO KẾT QUẢ DỰ ÁN (Template 4)
                </label>

                <div className="bg-brand-primary/5 dark:bg-brand-primary/[0.02] border border-brand-primary/50 dark:border-brand-primary/30 rounded-xl p-3.5 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {/* Text Description of Work Results */}
                    <div className="md:col-span-8 space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block animate-pulse">
                        Tóm tắt kết quả đạt được, link tài liệu hoặc thuyết minh sản phẩm:
                      </span>
                      <textarea
                        value={task.ketQuaCongViec || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          const updated = updateTaskInTree(tasks, task.id, () => ({ ketQuaCongViec: val }));
                          onChange(updated);
                        }}
                        placeholder="Ví dụ: Đã hoàn tất bóc tách chi tiết khối lượng phần ngầm, áp đơn giá thầu sơ bộ đạt tỷ lệ chính xác >95%. Toàn bộ biểu mẫu đã trình ký và đính kèm bên dưới..."
                        className="w-full h-20 p-2 text-xs bg-white dark:bg-dark-bg border border-slate-200 dark:border-slate-800 rounded-lg font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-primary"
                      />
                    </div>

                    {/* Attachment Upload / View */}
                    <div className="md:col-span-4 flex flex-col justify-between space-y-2">
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
                          Tệp tài liệu kết quả đính kèm (nhiều tệp, mỗi tệp &lt; 25MB):
                        </span>
                        {parseAttachments(task.taiLieuDinhKem).length > 0 ? (
                          <div className="space-y-1">
                            {parseAttachments(task.taiLieuDinhKem).map((name, i) => (
                              <div key={i} className="flex items-center justify-between p-1.5 bg-brand-primary/10 dark:bg-brand-primary/15 border border-brand-primary/15 dark:border-brand-primary/50 rounded-lg text-xs">
                                <div className="flex items-center gap-1.5 text-brand-primary-800 dark:text-brand-primary-300 truncate max-w-[150px]">
                                  <span className="text-[10px]">📎</span>
                                  <span className="font-bold truncate" title={name}>{name}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const remaining = parseAttachments(task.taiLieuDinhKem).filter((_, idx) => idx !== i);
                                    const updated = updateTaskInTree(tasks, task.id, () => ({ taiLieuDinhKem: joinAttachments(remaining) }));
                                    onChange(updated);
                                  }}
                                  className="text-brand-danger hover:text-brand-danger text-[10px] font-extrabold ml-1 uppercase shrink-0"
                                  title="Xóa tệp đính kèm"
                                >
                                  Xóa
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400 italic">Chưa tải lên báo cáo kết quả.</div>
                        )}
                      </div>

                      {/* Action Upload Trigger — bấm chọn HOẶC kéo-thả nhiều tệp vào ô */}
                      <div>
                        <FileDropZone
                          inputId={`file-upload-result-${task.id}`}
                          label={parseAttachments(task.taiLieuDinhKem).length ? '➕ Thêm / kéo-thả Tệp khác' : '📤 Tải lên / kéo-thả Tệp Báo cáo (.xlsx/pdf/zip)'}
                          accept=".xlsx, .xls, .pdf, .doc, .docx, .zip"
                          multiple
                          maxSizeMB={25}
                          oversizeHint="Hãy dán ĐƯỜNG LINK tệp vào ô kết quả công việc để tránh làm nặng hệ thống."
                          onFiles={(fsList) => {
                            const existing = parseAttachments(task.taiLieuDinhKem);
                            const merged = [...existing];
                            fsList.forEach((f) => { if (!merged.includes(f.name)) merged.push(f.name); });
                            const updated = updateTaskInTree(tasks, task.id, () => ({ taiLieuDinhKem: joinAttachments(merged) }));
                            onChange(updated);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Inline form to create a child subtask */}
        {addingChildFor === task.id && (
          <div 
            className="flex flex-col gap-2 p-3 bg-brand-accent/5 dark:bg-brand-accent/15 border border-brand-accent/50 dark:border-brand-accent/20 rounded-xl my-1.5"
            style={{ marginLeft: `${(depth + 1) * 24}px` }}
          >
            <span className="text-[10px] font-black uppercase text-brand-accent flex items-center gap-1">
              <CornerDownRight className="w-3 h-3" /> Thêm công việc con cấp tiếp theo
            </span>
            <div className="flex flex-wrap gap-2">
              <input 
                type="text"
                placeholder="Nhập tên việc con..."
                value={newSubtaskName}
                onChange={(e) => setNewSubtaskName(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-1.5 bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium"
                autoFocus
              />
              <div className="flex items-center gap-1.5">
                <input 
                  type="number"
                  placeholder="Tỉ trọng %"
                  value={newSubtaskWeight}
                  onChange={(e) => setNewSubtaskWeight(parseInt(e.target.value) || 0)}
                  className="w-16 px-2 py-1.5 bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-black text-center"
                />
                <select
                  value={newSubtaskAssignee}
                  onChange={(e) => setNewSubtaskAssignee(e.target.value)}
                  className="px-2 py-1.5 bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                >
                  <option value="">Giao cho...</option>
                  {activeStaff.map(s => (
                    <option key={s.id} value={s.id}>{s.hoTen}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleAddChildSubtask(task.id)}
                  className="px-3 py-1.5 bg-brand-primary hover:bg-brand-primary-hover text-white font-extrabold rounded-lg text-xs transition-colors"
                >
                  Xác nhận
                </button>
                <button
                  type="button"
                  onClick={() => setAddingChildFor(null)}
                  className="px-2.5 py-1.5 bg-slate-100 dark:bg-dark-elevated text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg text-xs transition-colors"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Render child subtasks recursively */}
        {hasChildren && isExpanded && (
          <div className="flex flex-col border-l-2 border-dashed border-slate-200/60 dark:border-slate-800 ml-5 pl-1 my-1">
            {task.subtasks!.map(st => renderTaskNode(st, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Top Level Add Button */}
      {canEdit ? (
        <div className="flex gap-2 bg-slate-50 dark:bg-dark-card/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80">
          <input 
            type="text"
            placeholder="Nhập tên đầu việc chính mới..."
            value={newSubtaskName}
            onChange={(e) => {
              if (addingChildFor === null) {
                setNewSubtaskName(e.target.value);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && addingChildFor === null && newSubtaskName.trim()) {
                const rootTask: ProjectTask = {
                  id: `T-${Date.now()}`,
                  name: newSubtaskName.trim(),
                  weight: newSubtaskWeight,
                  isCompleted: false,
                  assignedTo: newSubtaskAssignee || undefined,
                  subtasks: []
                };
                onChange([...tasks, rootTask]);
                setNewSubtaskName('');
                setNewSubtaskWeight(25);
                setNewSubtaskAssignee('');
              }
            }}
            className="flex-1 px-3 py-2 bg-white dark:bg-dark-bg border border-slate-200/80 dark:border-slate-800 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand-accent text-slate-800 dark:text-slate-100"
          />
          <input 
            type="number"
            placeholder="Tỉ trọng %"
            value={newSubtaskWeight}
            onChange={(e) => {
              if (addingChildFor === null) {
                setNewSubtaskWeight(parseInt(e.target.value) || 0);
              }
            }}
            className="w-16 px-2 py-2 bg-white dark:bg-dark-bg border border-slate-200/80 dark:border-slate-800 rounded-lg text-xs font-black text-center text-slate-800 dark:text-slate-100"
          />
          <select
            value={addingChildFor === null ? newSubtaskAssignee : ''}
            onChange={(e) => {
              if (addingChildFor === null) {
                setNewSubtaskAssignee(e.target.value);
              }
            }}
            className="px-2 py-2 bg-white dark:bg-dark-bg border border-slate-200/80 dark:border-slate-800 rounded-lg text-xs font-bold cursor-pointer text-slate-800 dark:text-slate-100"
          >
            <option value="">Giao việc...</option>
            {activeStaff.map(s => (
              <option key={s.id} value={s.id}>{s.hoTen}</option>
            ))}
          </select>
          <input
            type="file"
            id="inherited-plan-upload"
            accept=".xlsx, .xls, .pdf, .doc, .docx"
            multiple
            className="hidden"
            onChange={handleAttachInheritedPlan}
          />
          <button
            type="button"
            onClick={() => document.getElementById('inherited-plan-upload')?.click()}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (!inheritedDragOver) setInheritedDragOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setInheritedDragOver(false); }}
            onDrop={(e) => {
              e.preventDefault(); e.stopPropagation(); setInheritedDragOver(false);
              attachInheritedPlanFiles(e.dataTransfer.files);
            }}
            className={`px-3 py-2 rounded-lg text-xs font-black transition-all shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0 ${
              inheritedDragOver
                ? 'bg-brand-primary-800 text-white ring-2 ring-brand-primary-400'
                : 'bg-brand-primary hover:bg-brand-primary-hover text-white'
            }`}
            title="Đính kèm hoặc kéo-thả file kế hoạch kế thừa từ dự án cũ (tham khảo, không tự tạo việc)"
          >
            {inheritedDragOver ? '📥 Thả tệp vào đây' : '📎 Đính kèm KH kế thừa'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!newSubtaskName.trim() || addingChildFor !== null) return;
              const rootTask: ProjectTask = {
                id: `T-${Date.now()}`,
                name: newSubtaskName.trim(),
                weight: newSubtaskWeight,
                isCompleted: false,
                assignedTo: newSubtaskAssignee || undefined,
                subtasks: []
              };
              onChange([...tasks, rootTask]);
              setNewSubtaskName('');
              setNewSubtaskWeight(25);
              setNewSubtaskAssignee('');
            }}
            className="px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-lg text-xs font-black transition-all shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Thêm đầu việc
          </button>
        </div>
      ) : (
        <div className="text-[11px] text-brand-warning dark:text-brand-warning italic bg-brand-warning/10 dark:bg-brand-warning/10 px-3.5 py-2.5 rounded-xl border border-brand-warning/15 dark:border-brand-warning/30 flex items-center gap-2 font-bold w-full select-none">
          <span>🔒 Chỉ Quản lý / Trưởng phòng / Phó phòng mới có quyền tạo thêm công việc &amp; phân rã tác vụ. Bạn chỉ có thể cập nhật trạng thái hoàn thành.</span>
        </div>
      )}

      {uploadFeedback && (
        <div className="bg-brand-primary/10 dark:bg-brand-primary/15 text-brand-primary-800 dark:text-brand-primary-300 text-xs font-bold px-4 py-2.5 rounded-xl border border-brand-primary/25 dark:border-brand-primary/40 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-brand-primary"></span>
            <span>{uploadFeedback}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setUploadFeedback(null)} 
            className="text-brand-primary hover:text-brand-primary-700 font-extrabold text-[10px] uppercase cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {inheritedPlanFile && (
        <div className="bg-slate-50 dark:bg-dark-card text-slate-600 dark:text-slate-300 text-[11px] font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
          {inheritedPlanFile.split(' | ').filter(Boolean).map((name, i, arr) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 truncate">📎 Kế hoạch kế thừa: <span className="text-brand-accent dark:text-brand-accent-300 truncate" title={name}>{name}</span></span>
              <button
                type="button"
                onClick={() => {
                  const remaining = arr.filter((_, idx) => idx !== i);
                  setInheritedPlanFile(remaining.length ? remaining.join(' | ') : null);
                }}
                className="text-brand-danger hover:text-brand-danger text-[10px] font-extrabold uppercase ml-2 shrink-0"
              >
                Gỡ
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Recursive tree container */}
      <div className="space-y-2 max-h-[450px] overflow-y-auto bg-white dark:bg-dark-bg p-4 rounded-xl border border-slate-200/60 dark:border-slate-800">
        {tasks.length === 0 ? (
          <div className="text-center py-12 text-slate-400 dark:text-slate-500 italic text-xs">
            Chưa có công việc nào. Hãy nhập đầu việc chính bên trên để bắt đầu sơ đồ phân rã công việc!
          </div>
        ) : (
          tasks.map(t => renderTaskNode(t, 0))
        )}
      </div>
    </div>
  );
}
