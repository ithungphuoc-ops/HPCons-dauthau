import React from 'react';
import { Project, Staff, ProjectTask } from '../types';
import { 
  Briefcase, 
  CheckSquare, 
  AlertTriangle, 
  TrendingUp, 
  Clock, 
  DollarSign, 
  Award, 
  Percent,
  ListTodo,
  CheckCircle,
  Calendar
} from 'lucide-react';
import { motion } from 'motion/react';
import { chucVuToRole } from '../App';

interface StatsDashboardProps {
  projects: Project[];
  staff: Staff[];
  currentUserRole?: 'BOOD' | 'MANAGER' | 'STAFF';
  currentUserId?: string;
}

export default function StatsDashboard({ 
  projects, 
  staff, 
  currentUserRole = 'BOOD', 
  currentUserId 
}: StatsDashboardProps) {

  const isStaff = currentUserRole === 'STAFF';

  // --- 1. STAFF PERSONAL WORKSPACE STATISTICS ---
  const myProfile = staff.find(s => s.id === currentUserId);
  
  // Gather all tasks assigned to this staff member recursively (WBS hierarchy style)
  const myAssignedTasks: ProjectTask[] = [];
  projects.forEach(p => {
    const isProjectExecutor = p.thucHienId === currentUserId || p.thucHienIds?.includes(currentUserId || '');
    const traverse = (tList: ProjectTask[]) => {
      tList.forEach(t => {
        const isAssigned = t.assignedTo ? (t.assignedTo === currentUserId) : isProjectExecutor;
        if (isAssigned) {
          myAssignedTasks.push(t);
        }
        if (t.subtasks && t.subtasks.length > 0) {
          traverse(t.subtasks);
        }
      });
    };
    if (p.tasks) {
      traverse(p.tasks);
    }
  });

  const totalMyTasks = myAssignedTasks.length;
  const completedMyTasks = myAssignedTasks.filter(t => t.isCompleted).length;
  const pendingMyTasks = totalMyTasks - completedMyTasks;
  const myCompletionRate = totalMyTasks > 0 ? Math.round((completedMyTasks / totalMyTasks) * 100) : 100;

  // --- 2. MANAGER & BOOD DEPARTMENTAL STATISTICS ---
  const completedProjects = projects.filter(p => p.trangThai === 'HOAN_THANH_DUNG_HAN' || p.trangThai === 'HOAN_THANH_TRE_HAN');
  const onTimeCompleted = projects.filter(p => p.trangThai === 'HOAN_THANH_DUNG_HAN');
  const onTimeRate = completedProjects.length > 0 
    ? Math.round((onTimeCompleted.length / completedProjects.length) * 100) 
    : 100;

  const activeProjects = projects.filter(p => p.trangThai === 'DANG_THUC_HIEN' || p.trangThai === 'TRE_TIEN_DO');
  const delayedProjects = projects.filter(p => p.trangThai === 'TRE_TIEN_DO' || p.trangThai === 'HOAN_THANH_TRE_HAN');
  
  // Quản lý không được thấy KPI của Trưởng phòng → KPI trung bình của Quản lý loại Level 1 khỏi phép tính
  const kpiPool = currentUserRole === 'MANAGER'
    ? staff.filter(s => (s.role || chucVuToRole(s.chucVu)) !== 'BOOD')
    : staff;
  const avgKPI = kpiPool.length > 0
    ? Math.round(kpiPool.reduce((sum, s) => sum + s.kpiDiem, 0) / kpiPool.length)
    : 85;

  // USER'S EXACT SPECIFICATION CALCULATIONS:
  // "Số công việc đã thực hiện (tính dựa theo số lượng công việc con trong 1 dự án, nếu dự án nào chỉ có 1 công việc con thì đếm là 1)"
  let calculatedTasksList: { isCompleted: boolean; isOverdue: boolean; isOnTime: boolean }[] = [];
  
  projects.forEach(p => {
    const list: ProjectTask[] = [];
    const traverse = (tList: ProjectTask[]) => {
      for (const t of tList) {
        list.push(t);
        if (t.subtasks && t.subtasks.length > 0) {
          traverse(t.subtasks);
        }
      }
    };
    if (p.tasks && p.tasks.length > 0) {
      traverse(p.tasks);
    }

    if (list.length <= 1) {
      // If a project has 0 or 1 task, count as 1 task representing the project itself.
      const isCompleted = p.trangThai === 'HOAN_THANH_DUNG_HAN' || p.trangThai === 'HOAN_THANH_TRE_HAN';
      const isOverdue = p.trangThai === 'TRE_TIEN_DO' || p.trangThai === 'HOAN_THANH_TRE_HAN';
      calculatedTasksList.push({
        isCompleted,
        isOverdue,
        isOnTime: isCompleted && p.trangThai === 'HOAN_THANH_DUNG_HAN'
      });
    } else {
      list.forEach(t => {
        const isCompleted = t.isCompleted;
        const isOverdue = !!t.overdueReason || (!t.isCompleted && (p.trangThai === 'TRE_TIEN_DO' || p.trangThai === 'HOAN_THANH_TRE_HAN'));
        const isOnTime = t.isCompleted && (p.trangThai === 'HOAN_THANH_DUNG_HAN' || !t.overdueReason);
        calculatedTasksList.push({
          isCompleted,
          isOverdue,
          isOnTime
        });
      });
    }
  });

  const totalCalculatedTasks = calculatedTasksList.length;
  // Breakdown of tasks for the circular pie chart
  const taskPending = calculatedTasksList.filter(t => !t.isCompleted && !t.isOverdue).length;
  const taskCompletedOnTime = calculatedTasksList.filter(t => t.isOnTime).length;
  const taskCompletedLate = calculatedTasksList.filter(t => t.isCompleted && !t.isOnTime).length;
  const taskOverdue = calculatedTasksList.filter(t => t.isOverdue).length;

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0 }
  };

  if (isStaff) {
    // --- STAFF VIEW: PERSONAL TASKS WORKSPACE ---
    return (
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5"
      >
        {/* CARD 1: Nhiệm vụ cần làm */}
        <motion.div 
          variants={itemVariants}
          className="relative overflow-hidden bg-gradient-to-br from-brand-accent-500 via-brand-accent-600 to-brand-accent-800 text-white p-5 rounded-xl border border-brand-accent-400/30 shadow-lg group hover:scale-[1.02] transition-transform duration-300"
          id="staff-card-pending-tasks"
        >
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:scale-125 transition-transform" />
          
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-brand-accent-100 bg-white/15 px-2 py-0.5 rounded-full">
                Tác vụ Đấu Thầu
              </span>
              <div className="p-2 bg-white/10 rounded-xl text-white">
                <ListTodo className="w-4 h-4" />
              </div>
            </div>
            
            <div className="mt-4">
              <span className="text-[10px] text-brand-accent-100 font-bold block uppercase">Công việc cần xử lý</span>
              <h3 className="text-3xl font-black tracking-tight mt-1">
                {pendingMyTasks} Việc Con
              </h3>
            </div>
            
            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[10px] text-brand-accent-100 font-medium">
              <span>Tổng số việc được giao:</span>
              <span className="font-bold font-mono">{totalMyTasks} tác vụ</span>
            </div>
          </div>
        </motion.div>

        {/* CARD 2: Tiến độ hoàn thành */}
        <motion.div 
          variants={itemVariants}
          className="relative overflow-hidden bg-white dark:bg-dark-card p-5 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm group hover:scale-[1.02] transition-transform duration-300"
          id="staff-card-completion"
        >
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-brand-success/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
          
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-brand-success dark:text-brand-success-300 bg-brand-success/10 dark:bg-brand-success/15 px-2 py-0.5 rounded-full">
                Hiệu Suất Tiến Độ
              </span>
              <div className="p-2 bg-brand-success/10 dark:bg-brand-success/15 text-brand-success dark:text-brand-success-300 rounded-xl">
                <Percent className="w-4 h-4" />
              </div>
            </div>
            
            <div className="mt-4">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Tỉ lệ hoàn thành của bạn</span>
              <div className="flex items-baseline gap-2 mt-1">
                <h3 className="text-2xl font-black tracking-tight text-brand-success dark:text-brand-success-300">
                  {myCompletionRate}%
                </h3>
                <span className="text-[10px] text-slate-400 font-bold">
                  ({completedMyTasks}/{totalMyTasks})
                </span>
              </div>
            </div>

            <div className="mt-3">
              <div className="w-full bg-slate-100 dark:bg-dark-elevated h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-brand-success h-full transition-all duration-500" 
                  style={{ width: `${myCompletionRate}%` }}
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* CARD 3: KPI Cá nhân */}
        <motion.div 
          variants={itemVariants}
          className="relative overflow-hidden bg-white dark:bg-dark-card p-5 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm group hover:scale-[1.02] transition-transform duration-300"
          id="staff-card-kpi"
        >
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-brand-accent/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
          
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-brand-accent dark:text-brand-accent-300 bg-brand-accent/10 dark:bg-brand-accent/15 px-2 py-0.5 rounded-full">
                Điểm Đánh Giá KPI
              </span>
              <div className="p-2 bg-brand-accent/10 dark:bg-brand-accent/15 text-brand-accent dark:text-brand-accent-300 rounded-xl">
                <Award className="w-4 h-4" />
              </div>
            </div>
            
            {/* Nhân viên không được xem KPI của mình — chỉ Quản lý/Trưởng phòng theo dõi */}
            <div className="mt-4">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">KPI Cá Nhân</span>
              <h3 className="text-lg font-black tracking-tight text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1.5">
                🔒 Do Quản lý theo dõi
              </h3>
            </div>
            
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-bold">
              <span>Vai trò chuyên môn:</span>
              <span className="text-brand-accent dark:text-brand-accent-300 font-black">{myProfile?.chucVu || "Chuyên viên đấu thầu"}</span>
            </div>
          </div>
        </motion.div>

        {/* CARD 4: Dự án liên quan */}
        <motion.div 
          variants={itemVariants}
          className="relative overflow-hidden bg-white dark:bg-dark-card p-5 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm group hover:scale-[1.02] transition-transform duration-300"
          id="staff-card-projects"
        >
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-brand-warning/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
          
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-brand-warning dark:text-brand-warning bg-brand-warning/10 dark:bg-brand-warning/15 px-2 py-0.5 rounded-full">
                Gói Thầu Tham Gia
              </span>
              <div className="p-2 bg-brand-warning/10 dark:bg-brand-warning/15 text-brand-warning dark:text-brand-warning rounded-xl">
                <Briefcase className="w-4 h-4" />
              </div>
            </div>
            
            <div className="mt-4">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Số lượng gói thầu phụ trách</span>
              <h3 className="text-2xl font-black tracking-tight text-brand-warning dark:text-brand-warning mt-1">
                {projects.length} Gói Thầu
              </h3>
            </div>
            
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-bold">
              <span>Thời gian thực tế:</span>
              <span className="text-slate-800 dark:text-slate-200 font-black">Theo hạn đấu thầu</span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // --- BOOD / MANAGER VIEW: COMPREHENSIVE OVERVIEW ---
  const completedProjectsCount = completedProjects.length;
  const totalProjectsCount = projects.length;
  const projectCompletionRate = totalProjectsCount > 0 ? Math.round((completedProjectsCount / totalProjectsCount) * 100) : 0;

  const totalCompletedTasksCount = taskCompletedOnTime + taskCompletedLate;
  const taskCompletionRate = totalCalculatedTasks > 0 ? Math.round((totalCompletedTasksCount / totalCalculatedTasks) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* 4 Metrics Cards Grid */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5"
      >
        {/* CARD 1: Tổng số gói thầu */}
        <motion.div 
          variants={itemVariants}
          className="relative overflow-hidden bg-gradient-to-br from-brand-accent-500 via-brand-accent-600 to-brand-accent-800 text-white p-5 rounded-xl border border-brand-accent-400/30 shadow-lg group hover:scale-[1.02] transition-transform duration-300"
          id="stat-card-total-projects"
        >
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:scale-125 transition-transform" />
          
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-brand-accent-100 bg-white/15 px-2 py-0.5 rounded-full">
                Tổng Quan Gói Thầu
              </span>
              <div className="p-2 bg-white/10 rounded-xl text-white">
                <Briefcase className="w-4 h-4" />
              </div>
            </div>
            
            <div className="mt-4">
              <span className="text-[10px] text-brand-accent-100 font-bold block uppercase">Số lượng gói thầu</span>
              <h3 className="text-2xl font-black tracking-tight mt-1">
                {projects.length} Gói Thầu
              </h3>
            </div>
            
            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[10px] text-brand-accent-100 font-medium">
              <span>Đang hoạt động:</span>
              <span className="font-bold font-mono">{activeProjects.length} gói thầu</span>
            </div>
          </div>
        </motion.div>

        {/* CARD 2: Số dự án đã thực hiện */}
        <motion.div 
          variants={itemVariants}
          className="relative overflow-hidden bg-white dark:bg-dark-card p-5 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm group hover:scale-[1.02] transition-transform duration-300"
          id="stat-card-completed-projects"
        >
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-brand-success/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
          
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-brand-success dark:text-brand-success-300 bg-brand-success/10 dark:bg-brand-success/15 px-2 py-0.5 rounded-full">
                Số Dự Án Đã Thực Hiện
              </span>
              <div className="p-2 bg-brand-success/10 dark:bg-brand-success/15 text-brand-success dark:text-brand-success-300 rounded-xl">
                <CheckCircle className="w-4 h-4" />
              </div>
            </div>
            
            <div className="mt-4">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Số dự án hoàn thành</span>
              <div className="flex items-baseline gap-2 mt-1">
                <h3 className="text-2xl font-black tracking-tight text-brand-success dark:text-brand-success-300">
                  {completedProjectsCount} / {totalProjectsCount}
                </h3>
                <span className="text-[10px] text-slate-400 font-bold">
                  ({projectCompletionRate}% tỷ lệ)
                </span>
              </div>
            </div>

            <div className="mt-3">
              <div className="w-full bg-slate-100 dark:bg-dark-elevated h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-brand-success h-full transition-all duration-500" 
                  style={{ width: `${projectCompletionRate}%` }}
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* CARD 3: Số công việc đã thực hiện */}
        <motion.div 
          variants={itemVariants}
          className="relative overflow-hidden bg-white dark:bg-dark-card p-5 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm group hover:scale-[1.02] transition-transform duration-300"
          id="stat-card-completed-tasks"
        >
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-brand-accent/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
          
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-brand-accent dark:text-brand-accent-300 bg-brand-accent/10 dark:bg-brand-accent/15 px-2 py-0.5 rounded-full">
                Số Công Việc Đã Thực Hiện
              </span>
              <div className="p-2 bg-brand-accent/10 dark:bg-brand-accent/15 text-brand-accent dark:text-brand-accent-300 rounded-xl">
                <CheckSquare className="w-4 h-4" />
              </div>
            </div>
            
            <div className="mt-4">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Tổng số công việc con</span>
              <div className="flex items-baseline gap-2 mt-1">
                <h3 className="text-2xl font-black tracking-tight text-brand-accent dark:text-brand-accent-300">
                  {totalCalculatedTasks} cv
                </h3>
                <span className="text-[10px] text-slate-400 font-bold">
                  (Xong {totalCompletedTasksCount} cv)
                </span>
              </div>
            </div>

            <div className="mt-3">
              <div className="w-full bg-slate-100 dark:bg-dark-elevated h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-brand-accent h-full transition-all duration-500" 
                  style={{ width: `${taskCompletionRate}%` }}
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* CARD 4: KPI Trung bình đội ngũ */}
        <motion.div 
          variants={itemVariants}
          className="relative overflow-hidden bg-white dark:bg-dark-card p-5 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm group hover:scale-[1.02] transition-transform duration-300"
          id="stat-card-avg-kpi"
        >
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-brand-warning/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
          
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-brand-warning dark:text-brand-warning bg-brand-warning/10 dark:bg-brand-warning/15 px-2 py-0.5 rounded-full">
                Chỉ Số Đội Ngũ &amp; KPI
              </span>
              <div className="p-2 bg-brand-warning/10 dark:bg-brand-warning/15 text-brand-warning dark:text-brand-warning rounded-xl">
                <Award className="w-4 h-4" />
              </div>
            </div>
            
            <div className="mt-4">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">KPI Trung Bình Đội Ngũ</span>
              <div className="flex items-baseline gap-1 mt-1">
                <h3 className="text-2xl font-black tracking-tight text-brand-warning dark:text-brand-warning">
                  {avgKPI} / 100 đ
                </h3>
              </div>
            </div>
            
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-bold">
              <span>Tổng số nhân sự:</span>
              <span className="text-brand-warning dark:text-brand-warning font-black">{staff.length} nhân sự</span>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* 2. CIRCULAR PIE CHART BREAKDOWN (Biểu đồ hình tròn) */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white dark:bg-dark-card p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-xs"
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4 mb-5">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-accent dark:text-brand-accent-300" />
              Biểu Đồ Tròn Phân Tích Hiện Trạng Tác Vụ Đấu Thầu
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Tỷ lệ phân phối giữa các công việc đang triển khai, đã nộp đúng hạn, hoàn thành trễ và đang bị trễ hạn
            </p>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider bg-brand-accent/10 dark:bg-brand-accent/15 text-brand-accent dark:text-brand-accent-300 px-2.5 py-1 rounded-md">
            Tổng {totalCalculatedTasks} Tác Vụ
          </span>
        </div>

        {/* Circular Pie Chart custom SVG rendering */}
        {(() => {
          const total = totalCalculatedTasks || 1;
          const pctPending = (taskPending / total) * 100;
          const pctOnTime = (taskCompletedOnTime / total) * 100;
          const pctLate = (taskCompletedLate / total) * 100;
          const pctOverdue = (taskOverdue / total) * 100;

          const r = 50;
          const C = 2 * Math.PI * r; // ~ 314.159

          const strokePending = (taskPending / total) * C;
          const strokeOnTime = (taskCompletedOnTime / total) * C;
          const strokeLate = (taskCompletedLate / total) * C;
          const strokeOverdue = (taskOverdue / total) * C;

          const offset1 = 0;
          const offset2 = -strokePending;
          const offset3 = -(strokePending + strokeOnTime);
          const offset4 = -(strokePending + strokeOnTime + strokeLate);

          return (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-center">
              {/* Left Column: Visual Donut */}
              <div className="xl:col-span-5 flex flex-col items-center justify-center p-4">
                <div className="relative w-48 h-48 flex items-center justify-center shrink-0">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                    <circle
                      cx="60"
                      cy="60"
                      r={r}
                      className="stroke-slate-100 dark:stroke-slate-800/80"
                      strokeWidth="14"
                      fill="transparent"
                    />
                    {taskPending > 0 && (
                      <circle
                        cx="60"
                        cy="60"
                        r={r}
                        className="stroke-brand-accent transition-all duration-300 hover:stroke-brand-accent-400"
                        strokeWidth="14"
                        fill="transparent"
                        strokeDasharray={`${strokePending} ${C}`}
                        strokeDashoffset={offset1}
                      />
                    )}
                    {taskCompletedOnTime > 0 && (
                      <circle
                        cx="60"
                        cy="60"
                        r={r}
                        className="stroke-brand-success transition-all duration-300 hover:stroke-brand-success-400"
                        strokeWidth="14"
                        fill="transparent"
                        strokeDasharray={`${strokeOnTime} ${C}`}
                        strokeDashoffset={offset2}
                      />
                    )}
                    {taskCompletedLate > 0 && (
                      <circle
                        cx="60"
                        cy="60"
                        r={r}
                        className="stroke-brand-warning transition-all duration-300 hover:stroke-brand-warning/80"
                        strokeWidth="14"
                        fill="transparent"
                        strokeDasharray={`${strokeLate} ${C}`}
                        strokeDashoffset={offset3}
                      />
                    )}
                    {taskOverdue > 0 && (
                      <circle
                        cx="60"
                        cy="60"
                        r={r}
                        className="stroke-brand-danger transition-all duration-300 hover:stroke-brand-danger/80"
                        strokeWidth="14"
                        fill="transparent"
                        strokeDasharray={`${strokeOverdue} ${C}`}
                        strokeDashoffset={offset4}
                      />
                    )}
                  </svg>
                  
                  {/* Inside Text Center overlay */}
                  <div className="absolute text-center bg-white dark:bg-dark-card p-4 rounded-full shadow-xs w-32 h-32 flex flex-col items-center justify-center border border-slate-100 dark:border-slate-800">
                    <span className="text-3xl font-black text-slate-800 dark:text-white leading-none">
                      {totalCalculatedTasks}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                      Tổng Công Việc
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Dynamic interactive stats breakdown */}
              <div className="xl:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Pending */}
                <div className="bg-slate-50/50 dark:bg-dark-card/30 p-4 rounded-xl border border-slate-100/75 dark:border-slate-800/60 flex items-center gap-3">
                  <div className="w-3.5 h-3.5 rounded-full bg-brand-accent shrink-0 shadow-xs" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold block uppercase tracking-wider">
                      Đang thực hiện
                    </span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-base font-bold text-slate-800 dark:text-slate-100">
                        {taskPending} công việc
                      </span>
                      <span className="text-xs text-brand-accent dark:text-brand-accent-300 font-black">
                        {Math.round(pctPending)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. On Time Completed */}
                <div className="bg-slate-50/50 dark:bg-dark-card/30 p-4 rounded-xl border border-slate-100/75 dark:border-slate-800/60 flex items-center gap-3">
                  <div className="w-3.5 h-3.5 rounded-full bg-brand-success shrink-0 shadow-xs" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold block uppercase tracking-wider">
                      Đã hoàn thành đúng hạn
                    </span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-base font-bold text-slate-800 dark:text-slate-100">
                        {taskCompletedOnTime} công việc
                      </span>
                      <span className="text-xs text-brand-success dark:text-brand-success-300 font-black">
                        {Math.round(pctOnTime)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Completed Late */}
                <div className="bg-slate-50/50 dark:bg-dark-card/30 p-4 rounded-xl border border-slate-100/75 dark:border-slate-800/60 flex items-center gap-3">
                  <div className="w-3.5 h-3.5 rounded-full bg-brand-warning shrink-0 shadow-xs" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold block uppercase tracking-wider">
                      Đã hoàn thành trễ hạn
                    </span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-base font-bold text-slate-800 dark:text-slate-100">
                        {taskCompletedLate} công việc
                      </span>
                      <span className="text-xs text-brand-warning dark:text-brand-warning font-black">
                        {Math.round(pctLate)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. Overdue */}
                <div className="bg-slate-50/50 dark:bg-dark-card/30 p-4 rounded-xl border border-slate-100/75 dark:border-slate-800/60 flex items-center gap-3">
                  <div className="w-3.5 h-3.5 rounded-full bg-brand-danger shrink-0 shadow-xs" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold block uppercase tracking-wider">
                      Công việc trễ hạn
                    </span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-base font-bold text-slate-800 dark:text-slate-100">
                        {taskOverdue} công việc
                      </span>
                      <span className="text-xs text-brand-danger dark:text-brand-danger font-black">
                        {Math.round(pctOverdue)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </motion.div>
    </div>
  );
}
