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
import { hoSoChoTPDuyet } from './MyTasksPanel';
import { KpiCard } from './ui';

interface StatsDashboardProps {
  projects: Project[];
  staff: Staff[];
  currentUserRole?: 'BOOD' | 'MANAGER' | 'STAFF' | 'VIEWER';
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
  
  // Kế hoạch Trưởng phòng CHƯA duyệt thì không tính vào số liệu của nhân viên (chị Trâm chốt
  // 27/07/2026): việc vẫn hiện ở danh sách để thu xếp trước nhưng mọi thao tác bị khóa, nên không
  // thể có tiến độ — đưa vào thống kê chỉ làm "Hiệu suất tiến độ" tụt oan cho nhân viên.
  // (hoSoChoTPDuyet tính cả kế hoạch của VÒNG mới đang chờ duyệt lại, không chỉ lần lập đầu tiên)
  const projectsTinhSoLieu = isStaff ? projects.filter(p => !hoSoChoTPDuyet(p)) : projects;

  // Gather all tasks assigned to this staff member recursively (WBS hierarchy style)
  const myAssignedTasks: ProjectTask[] = [];
  projectsTinhSoLieu.forEach(p => {
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
  
  // KPI trung bình tạm bỏ tính — KPI đang xây dựng trọng số, thẻ "KPI đội ngũ" hiển thị "Đang xây dựng"
  // thay vì con số (chị Trâm chốt 27/07/2026). Giữ lại chú thích để khi có công thức thì khôi phục.

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
            value={projectsTinhSoLieu.length}
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
  // Hiện trạng GÓI THẦU (dự án) — để vẽ biểu đồ tròn thứ hai; dùng cùng 4 nhóm với công việc
  const projectPending = projects.filter(p => p.trangThai === 'DANG_THUC_HIEN').length;
  const projectDoneOnTime = projects.filter(p => p.trangThai === 'HOAN_THANH_DUNG_HAN').length;
  const projectDoneLate = projects.filter(p => p.trangThai === 'HOAN_THANH_TRE_HAN').length;
  const projectOverdue = projects.filter(p => p.trangThai === 'TRE_TIEN_DO').length;
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
            title="Gói thầu"
            value={projects.length}
            sub={`${activeProjects.length} đang thực hiện`}
          />
        </motion.div>

        <motion.div variants={itemVariants} id="stat-card-completed-projects">
          <KpiCard
            tone="success"
            icon={<CheckCircle className="size-5" />}
            title="Gói thầu đã xong"
            value={`${completedProjectsCount} / ${totalProjectsCount}`}
            sub={`Đạt ${projectCompletionRate}%`}
          />
        </motion.div>

        <motion.div variants={itemVariants} id="stat-card-completed-tasks">
          <KpiCard
            tone="primary"
            icon={<CheckSquare className="size-5" />}
            title="Công việc"
            value={totalCalculatedTasks}
            sub={`Xong ${totalCompletedTasksCount} · Còn ${totalCalculatedTasks - totalCompletedTasksCount}`}
          />
        </motion.div>

        <motion.div variants={itemVariants} id="stat-card-avg-kpi">
          {/* KPI đội ngũ để TRỐNG điểm — đang xây dựng trọng số (chị Trâm chốt 27/07/2026) */}
          <KpiCard
            tone="neutral"
            icon={<Award className="size-5" />}
            title="KPI đội ngũ"
            value="Đang xây dựng"
            sub={`${staff.length} nhân sự`}
          />
        </motion.div>
      </motion.div>

      {/* 2. HAI BIỂU ĐỒ TRÒN: gói thầu (dự án) và công việc — chị Trâm chốt 26/07/2026.
             Trước đây chỉ có 1 biểu đồ cho công việc nên không nhìn được hiện trạng gói thầu. */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        // Hai biểu đồ NẰM NGANG cạnh nhau từ md (768px) trở lên — chỉ mobile mới xếp dọc
        // (chị Trâm chốt 26/07/2026: trước đây đặt ngưỡng xl=1280px nên màn hẹp hơn bị xếp dọc, tốn chỗ).
        className="grid grid-cols-1 md:grid-cols-2 gap-5"
      >
        {[
          {
            key: 'goiThau',
            tieuDe: 'Hiện trạng gói thầu',
            tongNhan: 'gói thầu',
            tong: totalProjectsCount,
            phan: [
              { nhan: 'Đang thực hiện', so: projectPending, mau: 'stroke-brand-accent', dot: 'bg-brand-accent', chu: 'text-brand-accent dark:text-brand-accent-300' },
              { nhan: 'Hoàn thành đúng hạn', so: projectDoneOnTime, mau: 'stroke-brand-success', dot: 'bg-brand-success', chu: 'text-brand-success dark:text-brand-success-300' },
              { nhan: 'Hoàn thành trễ hạn', so: projectDoneLate, mau: 'stroke-brand-warning', dot: 'bg-brand-warning', chu: 'text-brand-warning' },
              { nhan: 'Đang trễ hạn', so: projectOverdue, mau: 'stroke-brand-danger', dot: 'bg-brand-danger', chu: 'text-brand-danger' },
            ],
          },
          {
            key: 'congViec',
            tieuDe: 'Hiện trạng công việc',
            tongNhan: 'công việc',
            tong: totalCalculatedTasks,
            phan: [
              { nhan: 'Đang thực hiện', so: taskPending, mau: 'stroke-brand-accent', dot: 'bg-brand-accent', chu: 'text-brand-accent dark:text-brand-accent-300' },
              { nhan: 'Hoàn thành đúng hạn', so: taskCompletedOnTime, mau: 'stroke-brand-success', dot: 'bg-brand-success', chu: 'text-brand-success dark:text-brand-success-300' },
              { nhan: 'Hoàn thành trễ hạn', so: taskCompletedLate, mau: 'stroke-brand-warning', dot: 'bg-brand-warning', chu: 'text-brand-warning' },
              { nhan: 'Đang trễ hạn', so: taskOverdue, mau: 'stroke-brand-danger', dot: 'bg-brand-danger', chu: 'text-brand-danger' },
            ],
          },
        ].map(bd => {
          const tong = bd.tong || 1;
          const r = 50;
          const C = 2 * Math.PI * r;
          let luyKe = 0;                                  // độ dài cung đã vẽ, dùng làm offset cho mảnh kế tiếp
          const cung = bd.phan.map(ph => {
            const dai = (ph.so / tong) * C;
            const offset = -luyKe;
            luyKe += dai;
            return { ...ph, dai, offset, pct: Math.round((ph.so / tong) * 100) };
          });
          return (
            <div key={bd.key} className="bg-white dark:bg-dark-card p-5 rounded-xl border border-slate-100 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3 mb-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-brand-accent dark:text-brand-accent-300" />
                  {bd.tieuDe}
                </h3>
                <span className="text-[10px] font-black uppercase tracking-wider bg-brand-accent/10 dark:bg-brand-accent/15 text-brand-accent dark:text-brand-accent-300 px-2.5 py-1 rounded-md whitespace-nowrap">
                  Tổng {bd.tong} {bd.tongNhan}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                {/* Vòng tròn */}
                <div className="relative w-32 h-32 lg:w-36 lg:h-36 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r={r} className="stroke-slate-100 dark:stroke-slate-800/80" strokeWidth="14" fill="transparent" />
                    {cung.map(c => c.so > 0 && (
                      <circle
                        key={c.nhan}
                        cx="60" cy="60" r={r}
                        className={`${c.mau} transition-all duration-300`}
                        strokeWidth="14"
                        fill="transparent"
                        strokeDasharray={`${c.dai} ${C}`}
                        strokeDashoffset={c.offset}
                      />
                    ))}
                  </svg>
                  <div className="absolute text-center w-22 h-22 lg:w-26 lg:h-26 rounded-full bg-white dark:bg-dark-card border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-slate-800 dark:text-white leading-none">{bd.tong}</span>
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">{bd.tongNhan}</span>
                  </div>
                </div>

                {/* Chú giải: cùng một cỡ chữ & cách trình bày cho cả 2 biểu đồ */}
                <ul className="flex-1 w-full min-w-0 space-y-1.5">
                  {cung.map(c => (
                    <li key={c.nhan} className="flex items-center gap-2.5 bg-slate-50/60 dark:bg-dark-card/30 border border-slate-100/70 dark:border-slate-800/60 rounded-lg px-2.5 py-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${c.dot}`} />
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex-1 truncate">{c.nhan}</span>
                      <span className="text-[13px] font-black text-slate-800 dark:text-slate-100 tabular-nums">{c.so}</span>
                      <span className={`text-[11px] font-black tabular-nums w-10 text-right ${c.chu}`}>{c.pct}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}
