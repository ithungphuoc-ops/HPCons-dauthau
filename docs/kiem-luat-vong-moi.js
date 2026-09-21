// Kiểm chứng luật "vòng mới không tính là dời hạn" — chép ĐÚNG hai biểu thức từ mã nguồn.
const laLapKeHoachVongMoi = (project) => {
  const vong = Math.max(1, project?.vongHienTai || 1);
  if (!project || vong <= 1) return false;
  return !(project.tasks || []).some(t => Math.max(1, t.vong || 1) === vong);
};
const daBiDayXaHan = (project, hanMoi, hanTheoBanDaLuu) =>
  !!project && !laLapKeHoachVongMoi(project) && !!hanTheoBanDaLuu && !!hanMoi
  && hanMoi > hanTheoBanDaLuu;

const ca = [
  { ten: 'Vòng 1, kéo dài lịch → PHẢI đòi phiếu',
    p:{vongHienTai:1,tasks:[{vong:1}]}, moi:'2026-09-20', cu:'2026-09-14', mong:true },
  { ten: 'Vòng 2 vừa mở, chưa có việc con vòng 2 → KHÔNG đòi (ca chị Trâm)',
    p:{vongHienTai:2,tasks:[{vong:1},{vong:1}]}, moi:'2026-09-20', cu:'2026-09-14', mong:false },
  { ten: 'Vòng 2 đã lập kế hoạch, nay kéo dài thêm → PHẢI đòi phiếu',
    p:{vongHienTai:2,tasks:[{vong:1},{vong:2}]}, moi:'2026-09-25', cu:'2026-09-20', mong:true },
  { ten: 'Vòng 3 vừa mở → KHÔNG đòi',
    p:{vongHienTai:3,tasks:[{vong:1},{vong:2}]}, moi:'2026-10-02', cu:'2026-09-20', mong:false },
  { ten: 'Vòng 2 đã lập kế hoạch, rút ngắn → không đòi (chỉ đòi khi bị ĐẨY XA)',
    p:{vongHienTai:2,tasks:[{vong:2}]}, moi:'2026-09-18', cu:'2026-09-20', mong:false },
];
let dat=0;
for (const c of ca) {
  const kq = daBiDayXaHan(c.p, c.moi, c.cu);
  const ok = kq === c.mong;
  if (ok) dat++;
  console.log(`${ok?'✓':'✗'} ${c.ten}  → ${kq ? 'đòi phiếu' : 'không đòi'}`);
}
console.log(`\n${dat}/${ca.length} ca đúng`);
process.exit(dat===ca.length?0:1);
