// utils/sensitive.js
const SENSITIVE = ['代课','代签到','代刷课','代考试','替考','代做作业','作弊'];
const PHONE_RE = /1[3-9]\d{9}/;

function check(text) {
  if (!text) return { ok: true };
  for (const w of SENSITIVE) {
    if (text.indexOf(w) >= 0) return { ok: false, msg: '内容包含违规词「' + w + '」，禁止发布（如代课/代签到/代考试），违规将被封禁。' };
  }
  return { ok: true };
}
function containsPhone(text) {
  return PHONE_RE.test(text || '');
}
module.exports = { check, containsPhone };
