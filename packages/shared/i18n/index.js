const MESSAGES = {
  documentation_intro: {
    zh: "请依次提交以下文件：\n1) 个人全身照\n2) 身份证（正面）\n3) 身份证（反面）\n4) Tabian Baan",
    en: "Please submit the following documents in order:\n1) Full-body photo\n2) ID card (front)\n3) ID card (back)\n4) Tabian Baan",
    th: "กรุณาส่งเอกสารตามลำดับ:\n1) รูปเต็มตัว\n2) บัตรประชาชน (หน้า)\n3) บัตรประชาชน (หลัง)\n4) ทะเบียนบ้าน",
  },
  documents_submitted: {
    zh: "您的文件已提交，我们将在24小时内审核完毕，并且通知。",
    en: "Your documents have been submitted. We will review them within 24 hours and notify you.",
    th: "เอกสารของคุณถูกส่งแล้ว เราจะตรวจสอบภายใน 24 ชั่วโมงและแจ้งผล",
  },
  documents_status_pending: {
    zh: "Documents Status : Pending",
    en: "Documents Status: Pending",
    th: "สถานะเอกสาร: รอดำเนินการ",
  },
  documents_approved: {
    zh: "Approved：您的文件已通过审核，我们将在7个工作日内为您办理公司注册。",
    en: "Approved: your documents have been approved, we will process company registration within 7 working days.",
    th: "อนุมัติ: เอกสารของคุณได้รับการอนุมัติแล้ว เราจะดำเนินการจดทะเบียนบริษัทภายใน 7 วันทำการ",
  },
  documents_rejected: {
    zh: "Rejected：很抱歉，您的申请未通过审核，我们暂时无法处理您的文件。",
    en: "Rejected: your application was rejected, we are unable to process your documents.",
    th: "ปฏิเสธ: ขออภัย ใบสมัครของคุณไม่ผ่านการตรวจสอบ เราไม่สามารถดำเนินการเอกสารของคุณได้",
  },
  doc_prompt_photo_full_body: {
    zh: "请上传：个人全身照",
    en: "Please upload: full-body photo",
    th: "กรุณาอัปโหลด: รูปเต็มตัว",
  },
  doc_prompt_id_front: {
    zh: "请上传：身份证（正面）",
    en: "Please upload: ID card (front)",
    th: "กรุณาอัปโหลด: บัตรประชาชน (หน้า)",
  },
  doc_prompt_id_back: {
    zh: "请上传：身份证（反面）",
    en: "Please upload: ID card (back)",
    th: "กรุณาอัปโหลด: บัตรประชาชน (หลัง)",
  },
  doc_prompt_tabian_baan: {
    zh: "请上传：Tabian Baan",
    en: "Please upload: Tabian Baan",
    th: "กรุณาอัปโหลด: ทะเบียนบ้าน",
  },
};

function t(key, lang = "th") {
  const entry = MESSAGES[key];
  if (!entry) return key;
  return entry[lang] || entry.th || entry.en;
}

module.exports = { t, MESSAGES };
