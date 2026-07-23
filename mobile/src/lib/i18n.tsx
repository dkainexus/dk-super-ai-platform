import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { getLocales } from "expo-localization";

// Lightweight i18n: dictionary lookup with {var} interpolation. The language
// defaults to the phone locale (when supported) and can be changed in Profile.

export const LANGS = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "th", label: "ไทย", flag: "🇹🇭" },
  { code: "vi", label: "Tiếng Việt", flag: "🇻🇳" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
] as const;

export type Lang = (typeof LANGS)[number]["code"];
const LANG_KEY = "dk_lang";

type Dict = Record<string, Partial<Record<Lang, string>> & { en: string }>;

const STRINGS: Dict = {
  // Tabs & headers
  home: { en: "Home", th: "หน้าแรก", vi: "Trang chủ", zh: "首页" },
  training: { en: "Training", th: "การฝึกอบรม", vi: "Đào tạo", zh: "培训" },
  exams: { en: "Exams", th: "ข้อสอบ", vi: "Bài thi", zh: "考试" },
  profile: { en: "Profile", th: "โปรไฟล์", vi: "Hồ sơ", zh: "我的" },
  my_account: { en: "My Account", th: "บัญชีของฉัน", vi: "Tài khoản của tôi", zh: "我的账号" },
  notification: { en: "Notification", th: "การแจ้งเตือน", vi: "Thông báo", zh: "通知" },
  withdraw: { en: "Withdraw", th: "ถอนเงิน", vi: "Rút tiền", zh: "提现" },
  my_rewards: { en: "My Rewards", th: "รางวัลของฉัน", vi: "Phần thưởng", zh: "我的奖励" },
  transactions: { en: "Transactions", th: "ธุรกรรม", vi: "Giao dịch", zh: "交易记录" },
  requests: { en: "Requests", th: "คำขอ", vi: "Yêu cầu", zh: "提现请求" },
  exam: { en: "Exam", th: "ข้อสอบ", vi: "Bài thi", zh: "考试" },

  // Home
  hello: { en: "Hello,", th: "สวัสดี", vi: "Xin chào,", zh: "你好，" },
  wallet_balance: { en: "WALLET BALANCE", th: "ยอดเงินในกระเป๋า", vi: "SỐ DƯ VÍ", zh: "钱包余额" },
  my_reward: { en: "My Reward", th: "รางวัล", vi: "Thưởng", zh: "我的奖励" },
  your_progress: { en: "Your progress", th: "ความคืบหน้า", vi: "Tiến độ của bạn", zh: "学习进度" },
  videos_completed: {
    en: "{done} of {total} videos completed",
    th: "ดูจบแล้ว {done} จาก {total} วิดีโอ",
    vi: "Đã hoàn thành {done}/{total} video",
    zh: "已完成 {done}/{total} 个视频",
  },
  submit_new_account: { en: "Submit New Account", th: "ส่งบัญชีใหม่", vi: "Gửi tài khoản mới", zh: "提交新账号" },
  coming_soon: { en: "Coming soon", th: "เร็ว ๆ นี้", vi: "Sắp ra mắt", zh: "即将上线" },
  coming_soon_body: {
    en: "Account submission will be available in an upcoming update.",
    th: "ฟีเจอร์ส่งบัญชีจะเปิดให้ใช้ในเวอร์ชันถัดไป",
    vi: "Tính năng gửi tài khoản sẽ có trong bản cập nhật tới.",
    zh: "账号提交功能将在后续版本开放。",
  },

  // Bank accounts
  select_company: { en: "Company", th: "บริษัท", vi: "Công ty", zh: "公司" },
  select_bank: { en: "Bank", th: "ธนาคาร", vi: "Ngân hàng", zh: "银行" },
  branch_address: { en: "Branch Address", th: "ที่อยู่สาขา", vi: "Địa chỉ chi nhánh", zh: "分行地址" },
  account_number: { en: "Account Number", th: "เลขบัญชี", vi: "Số tài khoản", zh: "账号号码" },
  account_limit: { en: "Account Limit", th: "วงเงินบัญชี", vi: "Hạn mức tài khoản", zh: "账户限额" },
  sim_number: { en: "SIM Card Number", th: "เบอร์ซิมการ์ด", vi: "Số SIM", zh: "SIM卡号码" },
  login_id: { en: "Login / User ID", th: "ชื่อผู้ใช้เข้าสู่ระบบ", vi: "ID đăng nhập", zh: "登录账号/User ID" },
  payment_channels: { en: "PAYMENT CHANNELS", th: "ช่องทางการชำระเงิน", vi: "KÊNH THANH TOÁN", zh: "支付渠道" },
  linked_value: {
    en: "Linked number / ID (optional)",
    th: "หมายเลขที่ผูกไว้ (ไม่บังคับ)",
    vi: "Số liên kết (không bắt buộc)",
    zh: "绑定号码（选填）",
  },
  submit_review: { en: "Submit for Review", th: "ส่งตรวจสอบ", vi: "Gửi để duyệt", zh: "提交审核" },
  submitted: { en: "Submitted 🎉", th: "ส่งแล้ว 🎉", vi: "Đã gửi 🎉", zh: "已提交 🎉" },
  submitted_body: {
    en: "Your bank account was submitted and is pending review.",
    th: "ส่งบัญชีธนาคารแล้ว รอการตรวจสอบ",
    vi: "Tài khoản ngân hàng đã được gửi và đang chờ duyệt.",
    zh: "银行账号已提交，等待审核。",
  },
  submit_failed: { en: "Submission failed", th: "ส่งไม่สำเร็จ", vi: "Gửi thất bại", zh: "提交失败" },
  required_fields: {
    en: "Please fill in company, bank and account number.",
    th: "กรุณาเลือกบริษัท ธนาคาร และกรอกเลขบัญชี",
    vi: "Vui lòng chọn công ty, ngân hàng và nhập số tài khoản.",
    zh: "请选择公司、银行并填写账号。",
  },
  no_accounts: { en: "No accounts yet", th: "ยังไม่มีบัญชี", vi: "Chưa có tài khoản", zh: "还没有账号" },
  no_accounts_body: {
    en: "Submit your first bank account with the button below.",
    th: "กดปุ่มด้านล่างเพื่อส่งบัญชีธนาคารแรกของคุณ",
    vi: "Nhấn nút bên dưới để gửi tài khoản ngân hàng đầu tiên.",
    zh: "点击下方按钮提交你的第一个银行账号。",
  },

  // Withdraw
  available_balance: { en: "AVAILABLE BALANCE", th: "ยอดเงินที่ถอนได้", vi: "SỐ DƯ KHẢ DỤNG", zh: "可用余额" },
  enter_amount: { en: "ENTER AMOUNT", th: "ระบุจำนวนเงิน", vi: "NHẬP SỐ TIỀN", zh: "输入金额" },
  amount_exceeds: {
    en: "Amount exceeds your balance.",
    th: "จำนวนเงินเกินยอดคงเหลือ",
    vi: "Số tiền vượt quá số dư.",
    zh: "金额超过余额。",
  },
  funds_note: {
    en: "Funds are transferred to your registered bank account after review.",
    th: "เงินจะโอนเข้าบัญชีธนาคารของคุณหลังการตรวจสอบ",
    vi: "Tiền sẽ được chuyển vào tài khoản ngân hàng của bạn sau khi duyệt.",
    zh: "审核通过后，款项将转入你登记的银行账户。",
  },
  request_sent: { en: "Request sent 🎉", th: "ส่งคำขอแล้ว 🎉", vi: "Đã gửi yêu cầu 🎉", zh: "请求已提交 🎉" },
  request_sent_body: {
    en: "Your withdrawal request has been received. Track it under Requests.",
    th: "ได้รับคำขอถอนเงินแล้ว ติดตามสถานะได้ที่เมนูคำขอ",
    vi: "Đã nhận yêu cầu rút tiền. Theo dõi trong mục Yêu cầu.",
    zh: "提现请求已收到，可在提现请求里跟踪状态。",
  },
  withdrawal_failed: { en: "Withdrawal failed", th: "ถอนเงินไม่สำเร็จ", vi: "Rút tiền thất bại", zh: "提现失败" },
  try_again: { en: "Please try again.", th: "กรุณาลองใหม่", vi: "Vui lòng thử lại.", zh: "请重试。" },
  withdrawal_pending: { en: "Withdrawal pending", th: "กำลังดำเนินการถอนเงิน", vi: "Đang xử lý rút tiền", zh: "提现处理中" },
  withdrawal_pending_body: {
    en: "{amount} {currency} is being processed. You can request again once it completes.",
    th: "{amount} {currency} กำลังดำเนินการ เสร็จแล้วจึงขอถอนได้อีกครั้ง",
    vi: "{amount} {currency} đang được xử lý. Hoàn tất mới có thể yêu cầu tiếp.",
    zh: "{amount} {currency} 正在处理，完成后才能再次提现。",
  },
  view_requests: { en: "View Requests", th: "ดูคำขอ", vi: "Xem yêu cầu", zh: "查看请求" },

  // Rewards
  to_unlock: { en: "TO UNLOCK", th: "รอปลดล็อก", vi: "CHỜ MỞ KHÓA", zh: "待解锁" },
  received: { en: "RECEIVED", th: "ได้รับแล้ว", vi: "ĐÃ NHẬN", zh: "已领取" },
  no_rewards: { en: "No rewards yet", th: "ยังไม่มีรางวัล", vi: "Chưa có phần thưởng", zh: "还没有奖励" },
  no_rewards_body: {
    en: "Complete your training and tasks to start earning rewards.",
    th: "ทำการฝึกอบรมและภารกิจให้เสร็จเพื่อรับรางวัล",
    vi: "Hoàn thành đào tạo và nhiệm vụ để nhận thưởng.",
    zh: "完成培训和任务即可获得奖励。",
  },
  progress_of: {
    en: "{done} of {total} completed · {pct}%",
    th: "เสร็จแล้ว {done} จาก {total} · {pct}%",
    vi: "Hoàn thành {done}/{total} · {pct}%",
    zh: "已完成 {done}/{total} · {pct}%",
  },
  reward_training_title: {
    en: "Complete all training videos",
    th: "ดูวิดีโอฝึกอบรมให้ครบทุกตัว",
    vi: "Hoàn thành tất cả video đào tạo",
    zh: "完成全部培训视频",
  },

  // Lists
  no_transactions: { en: "No transactions yet.", th: "ยังไม่มีธุรกรรม", vi: "Chưa có giao dịch.", zh: "还没有交易记录。" },
  no_requests: { en: "No withdrawal requests yet.", th: "ยังไม่มีคำขอถอนเงิน", vi: "Chưa có yêu cầu rút tiền.", zh: "还没有提现请求。" },
  no_notifications: { en: "No notifications yet.", th: "ยังไม่มีการแจ้งเตือน", vi: "Chưa có thông báo.", zh: "还没有通知。" },
  no_videos: {
    en: "No training videos yet. Pull to refresh.",
    th: "ยังไม่มีวิดีโอ ลากลงเพื่อรีเฟรช",
    vi: "Chưa có video. Kéo xuống để làm mới.",
    zh: "还没有培训视频，下拉刷新。",
  },
  no_exams: {
    en: "No exams yet. Pull to refresh.",
    th: "ยังไม่มีข้อสอบ ลากลงเพื่อรีเฟรช",
    vi: "Chưa có bài thi. Kéo xuống để làm mới.",
    zh: "还没有考试，下拉刷新。",
  },
  tx_reward: { en: "Reward", th: "รางวัล", vi: "Thưởng", zh: "奖励" },
  tx_rent: { en: "Rent", th: "ค่าเช่า", vi: "Tiền thuê", zh: "租金" },
  tx_withdrawal: { en: "Withdrawal", th: "ถอนเงิน", vi: "Rút tiền", zh: "提现" },
  tx_refund: { en: "Refund", th: "คืนเงิน", vi: "Hoàn tiền", zh: "退款" },
  tx_adjustment: { en: "Adjustment", th: "ปรับปรุงยอด", vi: "Điều chỉnh", zh: "调整" },

  // Profile
  account: { en: "Account", th: "บัญชี", vi: "Tài khoản", zh: "账号" },
  username: { en: "Username", th: "ชื่อผู้ใช้", vi: "Tên đăng nhập", zh: "用户名" },
  phone: { en: "Phone", th: "โทรศัพท์", vi: "Điện thoại", zh: "电话" },
  email: { en: "Email", th: "อีเมล", vi: "Email", zh: "邮箱" },
  payout_bank: { en: "Payout Bank", th: "ธนาคารรับเงิน", vi: "Ngân hàng nhận tiền", zh: "收款银行" },
  bank: { en: "Bank", th: "ธนาคาร", vi: "Ngân hàng", zh: "银行" },
  account_no: { en: "Account No.", th: "เลขบัญชี", vi: "Số tài khoản", zh: "账号号码" },
  bank_note: {
    en: "Rewards are paid to this account. Contact your manager to change it.",
    th: "รางวัลจะโอนเข้าบัญชีนี้ ติดต่อผู้ดูแลหากต้องการเปลี่ยน",
    vi: "Thưởng được chuyển vào tài khoản này. Liên hệ quản lý để thay đổi.",
    zh: "奖励将打入此账户，如需更改请联系管理员。",
  },
  language: { en: "Language", th: "ภาษา", vi: "Ngôn ngữ", zh: "语言" },
  sign_out: { en: "Sign Out", th: "ออกจากระบบ", vi: "Đăng xuất", zh: "退出登录" },

  // Login
  welcome_back: { en: "Welcome back", th: "ยินดีต้อนรับกลับ", vi: "Chào mừng trở lại", zh: "欢迎回来" },
  login_subtitle: {
    en: "Sign in with the account your manager gave you",
    th: "เข้าสู่ระบบด้วยบัญชีที่ผู้ดูแลให้มา",
    vi: "Đăng nhập bằng tài khoản quản lý cấp cho bạn",
    zh: "使用管理员提供的账号登录",
  },
  password: { en: "Password", th: "รหัสผ่าน", vi: "Mật khẩu", zh: "密码" },
  sign_in: { en: "Sign In", th: "เข้าสู่ระบบ", vi: "Đăng nhập", zh: "登录" },

  // Update checker
  update_available: { en: "Update available", th: "มีอัปเดตใหม่", vi: "Có bản cập nhật", zh: "发现新版本" },
  update_now: { en: "Update Now", th: "อัปเดตเลย", vi: "Cập nhật ngay", zh: "立即更新" },
  later: { en: "Later", th: "ภายหลัง", vi: "Để sau", zh: "稍后" },
  downloading: { en: "Downloading… {pct}%", th: "กำลังดาวน์โหลด… {pct}%", vi: "Đang tải… {pct}%", zh: "下载中… {pct}%" },
  update_failed: { en: "Update failed", th: "อัปเดตไม่สำเร็จ", vi: "Cập nhật thất bại", zh: "更新失败" },
  update_failed_body: {
    en: "Could not download the update. Please try again later.",
    th: "ดาวน์โหลดอัปเดตไม่สำเร็จ กรุณาลองใหม่ภายหลัง",
    vi: "Không tải được bản cập nhật. Vui lòng thử lại sau.",
    zh: "无法下载更新，请稍后再试。",
  },
};

type I18nValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nValue>({
  lang: "en",
  setLang: () => {},
  t: (k) => STRINGS[k]?.en ?? k,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    (async () => {
      const saved = await SecureStore.getItemAsync(LANG_KEY).catch(() => null);
      if (saved && LANGS.some((l) => l.code === saved)) {
        setLangState(saved as Lang);
        return;
      }
      const device = getLocales()[0]?.languageCode ?? "en";
      if (LANGS.some((l) => l.code === device)) setLangState(device as Lang);
    })();
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    SecureStore.setItemAsync(LANG_KEY, l).catch(() => {});
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let s = STRINGS[key]?.[lang] ?? STRINGS[key]?.en ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
      return s;
    },
    [lang]
  );

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}
