const SENSITIVE = ['代课', '代签到', '代刷课', '代考试', '替考', '代做作业', '作弊'];
const PHONE_RE = /1[3-9]\d{9}/;
function check(text) {
  const normalized = String(text || '').replace(/\s/g, '');
  const word = SENSITIVE.find(item => normalized.indexOf(item) >= 0);
  return word ? { ok: false, msg: '内容包含禁止发布的词语：' + word } : { ok: true };
}
function containsPhone(text) {
  return PHONE_RE.test(String(text || '').replace(/[\s-]/g, ''));
}
module.exports = { check, containsPhone };
