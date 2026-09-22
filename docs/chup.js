// Chụp ảnh minh hoạ cho tài liệu "Tổng hợp nâng cấp Ver4".
// Chạy: node chup.js   (cần dev server đang chạy ở http://localhost:3000)
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = path.join(__dirname, 'anh');
fs.mkdirSync(OUT, { recursive: true });

const doi = (ms) => new Promise(r => setTimeout(r, ms));

async function bamChu(page, chu, chiSo = 0) {
  const ok = await page.evaluate((chu, chiSo) => {
    const ds = [...document.querySelectorAll('button, a, [role="button"]')]
      .filter(b => b.offsetParent !== null && (b.innerText || '').trim().includes(chu));
    if (!ds[chiSo]) return false;
    ds[chiSo].click();
    return true;
  }, chu, chiSo);
  if (!ok) throw new Error(`Không thấy nút chứa chữ: ${chu}`);
  await doi(900);
}

async function bamTitle(page, phanTitle, chiSo = 0) {
  const ok = await page.evaluate((t, i) => {
    const ds = [...document.querySelectorAll('button')]
      .filter(b => b.offsetParent !== null && (b.title || '').includes(t));
    if (!ds[i]) return false;
    ds[i].click();
    return true;
  }, phanTitle, chiSo);
  if (!ok) throw new Error(`Không thấy nút có title: ${phanTitle}`);
  await doi(900);
}

/** Chụp khối NHỎ NHẤT còn chứa đủ chữ mốc — khối to quá thì chữ trong ảnh bé tí. */
async function chupKhoi(page, ten, timChu, { le = 12, caoToiDa = 1100, rongToiThieu = 380 } = {}) {
  const hop = await page.evaluate((timChu, caoToiDa, rongToiThieu) => {
    const ungVien = [...document.querySelectorAll('section, div, table, form')]
      .filter(e => e.offsetParent !== null && (e.innerText || '').includes(timChu));
    if (!ungVien.length) return null;
    let chon = null;
    for (const e of ungVien) {
      const r = e.getBoundingClientRect();
      if (r.height < 90 || r.width < rongToiThieu) continue;
      if (!chon || r.height * r.width < chon.getBoundingClientRect().height * chon.getBoundingClientRect().width) chon = e;
    }
    if (!chon) chon = ungVien[ungVien.length - 1];
    chon.scrollIntoView({ block: 'center' });
    const r = chon.getBoundingClientRect();
    return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: Math.min(r.height, caoToiDa) };
  }, timChu, caoToiDa, rongToiThieu);
  if (!hop) throw new Error(`Không tìm thấy khối chứa: ${timChu}`);
  await doi(400);
  const vp = page.viewport();
  await page.screenshot({
    path: path.join(OUT, ten + '.png'),
    clip: {
      x: Math.max(0, hop.x - le),
      y: Math.max(0, hop.y - le),
      width: Math.min(hop.w + le * 2, vp.width),
      height: hop.h + le * 2,
    },
  });
  console.log('  ✓', ten);
}

async function doiVai(page, cap) {
  await page.evaluate((cap) => {
    const b = [...document.querySelectorAll('button')].find(x => x.innerText.trim() === cap);
    if (b) b.click();
  }, cap);
  await doi(1600);
}

async function vaoMuc(page, ten) {
  await page.evaluate((ten) => {
    const b = [...document.querySelectorAll('button, a')].find(x => x.innerText.trim() === ten);
    if (b) b.click();
  }, ten);
  await doi(1600);
}

async function dongModal(page) {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')]
      .find(x => x.offsetParent !== null && ['Hủy', 'Huỷ', 'Để sau', 'Quay lại', 'Đóng'].includes(x.innerText.trim()));
    if (b) b.click();
  });
  await doi(700);
  await page.keyboard.press('Escape');
  await doi(500);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    defaultViewport: { width: 1680, height: 1050, deviceScaleFactor: 2 },
    args: ['--hide-scrollbars', '--disable-gpu', '--force-color-profile=srgb'],
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await doi(1500);

  console.log('Nạp dữ liệu bản thử...');
  await bamChu(page, 'Nạp 10 hồ sơ NHÁP');
  await doi(1500);
  await bamChu(page, 'Ngô Nữ Quỳnh Trâm');
  await doi(2500);

  // Nền sáng cho ảnh in ra giấy đọc được (nền tối in vừa tốn mực vừa mờ chữ)
  await bamTitle(page, 'Chế độ sáng').catch(() => console.log('  (đã ở nền sáng)'));
  await doi(1200);
  console.log('Đã vào app — vai Trưởng phòng, nền sáng.\n');

  // ===== 1. LIÊN KẾT PHÒNG BAN =====
  await vaoMuc(page, 'Liên kết phòng ban');
  await chupKhoi(page, '02-danh-muc-du-an', 'Danh mục dự án');
  await chupKhoi(page, '02-tien-do-thiet-ke', 'Tiến độ thiết kế');

  // ===== 2. KANBAN =====
  await vaoMuc(page, 'Bảng Kanban');
  await chupKhoi(page, '05-kanban', 'BẢNG KANBAN QUY TRÌNH THẦU', { caoToiDa: 820 });

  // ===== 3. GANTT =====
  await vaoMuc(page, 'Biểu Đồ Gantt');
  await doi(1200);
  await chupKhoi(page, '06-gantt', 'Gantt', { caoToiDa: 820 });

  // ===== 4. BẢNG NHẬP TIẾN ĐỘ & KẾT QUẢ CẤP PHÒNG (ô lý do trễ + khung BOQ) =====
  await vaoMuc(page, 'Bảng Kanban');
  await bamTitle(page, 'Chuyển sang bước 4').catch(() => {});
  await doi(1200);
  const coBang = await page.evaluate(() => !!document.getElementById('phong-result-note'));
  if (coBang) {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => x.innerText.trim() === 'Duyệt đủ 100%');
      if (b) b.click();
    });
    await doi(900);
    await chupKhoi(page, '17-bang-tien-do-phong', 'NHẬP TIẾN ĐỘ & KẾT QUẢ CẤP PHÒNG', { caoToiDa: 1000 });
    await dongModal(page);
  } else {
    console.log('  ! Không mở được bảng tiến độ Phòng');
  }

  // ===== 5. VAI QUẢN LÝ — HỘP KÉO VỀ BƯỚC 1 & CHẶN LƯU =====
  await doiVai(page, 'L2');
  await vaoMuc(page, 'Bảng Kanban');
  await bamTitle(page, 'Lập lại kế hoạch việc con', 1).catch(() => bamTitle(page, 'Lập lại kế hoạch việc con', 0));
  await doi(1000);
  await chupKhoi(page, '16-ba-lua-chon', 'Chọn giúp trường hợp của bạn', { caoToiDa: 900 });

  // chọn "giữ nguyên hạn" rồi rút ngắn 1 ngày để chụp khối chặn lưu
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')]
      .find(x => x.innerText.includes('hạn nộp giữ NGUYÊN ngày') || x.innerText.includes('Không thay đổi tiến độ'));
    if (b) b.click();
  });
  await doi(1400);
  await page.evaluate(() => {
    const bs = [...document.querySelectorAll('button')].filter(b => (b.title || '').includes('Bớt nửa ngày'));
    const cuoi = bs[bs.length - 1];
    if (cuoi) { cuoi.click(); cuoi.click(); }
  });
  await doi(1200);
  await chupKhoi(page, '16-chan-luu', 'Chưa lưu được', { caoToiDa: 1000 });
  await dongModal(page);

  // ===== 6. VAI NHÂN VIÊN — MỤC CÔNG VIỆC CÁ NHÂN =====
  await doiVai(page, 'L3');
  await doi(1200);
  await chupKhoi(page, '03-cong-viec-ca-nhan', 'Công việc cá nhân', { rongToiThieu: 200, caoToiDa: 780 });

  await browser.close();
  console.log('\nXong. Ảnh nằm ở:', OUT);
})().catch(e => { console.error('LỖI:', e.message); process.exit(1); });
