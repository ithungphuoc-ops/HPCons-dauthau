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
import { KpiCard } from './ui';

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
        <motion.div variants={itemVariants} id="staff-card-pending-tasks">
          <KpiCard
            tone="primary"
            icon={<ListTodo className="size-5" />}
            title="Tác vụ Đấu Thầu"
            value={`${pendingMyTasks} Việc Con`}
            sub={`Tổng số việc được giao: ${totalMyTasks} tác vụ`}
          />
        </motion.div>

        <motion.div variants={itemVariants} id="staff-card-completion">
          <KpiCard
            tone="success"
            icon={<Percent className="size-5" />}
            title="Hiệu Suất Tiến Độ"
            value={`${myCompletionRate}%`}
            sub={`${completedMyTasks}/${totalMyTasks} tác vụ hoàn thành`}
          />
        </motion.div>

        {/* Nhân viên không được xem KPI của mình — chỉ Quản lý/Trưởng phòng theo dõi */}
        <motion.div variants={itemVariants} id="staff-card-kpi">
          <KpiCard
            tone="neutral"
            icon={<Award className="size-5" />}
            title="Điểm Đánh Giá KPI"
            value="🔒 Do Quản lý theo dõi"
            sub={`Vai trò chuyên môn: ${myProfile?.chucVu || "Chuyên viên đấu thầu"}`}
          />
        </motion.div>

        <motion.div variants={itemVariants} id="staff-card-projects">
          <KpiCard
            tone="warning"
            icon={<Briefcase className="size-5" />}
            title="Gói Thầu Tham Gia"
            value={`${projects.length} Gói Thầu`}
            sub="Số lượng gói thầu phụ trách — theo hạn đấu thầu"
          />
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
        <motion.div variants={itemVariants} id="stat-card-total-projects">
          <KpiCard
            tone="primary"
            icon={<Briefcase className="size-5" />}
            title="Tổng Quan Gói Thầu"
            value={`${projects.length} Gói Thầu`}
            sub={`Đang hoạt động: ${activeProjects.length} gói thầu`}
          />
        </motion.div>

        <motion.div variants={itemVariants} id="stat-card-completed-projects">
          <KpiCard
            tone="success"
            icon={<CheckCircle className="size-5" />}
            title="Số Dự Án Đã Thực Hiện"
            value={`${completedProjectsCount} / ${totalProjectsCount}`}
            sub={`${projectCompletionRate}% tỷ lệ hoàn thành`}
          />
        </motion.div>

        <motion.div variants={itemVariants} id="stat-card-completed-tasks">
          <KpiCard
            tone="primary"
            icon={<CheckSquare className="size-5" />}
            title="Số Công Việc Đã Thực Hiện"
            value={`${totalCalculatedTasks} cv`}
            sub={`Xong ${totalCompletedTasksCount} cv`}
          />
        </motion.div>

        <motion.div variants={itemVariants} id="stat-card-avg-kpi">
          <KpiCard
            tone="warning"
            icon={<Award className="size-5" />}
            title="Chỉ Số Đội Ngũ & KPI"
            value={`${avgKPI} / 100 đ`}
            sub={`Tổng số nhân sự: ${staff.length} nhân sự`}
          />
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
