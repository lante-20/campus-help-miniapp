const config = require('../config');
const db = require('./db');

function current() {
  const me = getApp().globalData.me;
  return me && me.wechat ? me : null;
}
function requireUser() {
  const me = current();
  if (!me) throw new Error('请先选择本机演示身份');
  return me;
}
function ensurePage() {
  if (current()) return true;
  wx.reLaunch({ url: '/pages/login/login' });
  return false;
}
function restore() {
  if (config.mode !== 'local') throw new Error('云端模式尚未实现');
  const saved = wx.getStorageSync('me');
  return saved && typeof saved.wechat === 'string' ? saved : null;
}
async function login(profile) {
  if (config.mode !== 'local') throw new Error('云端模式尚未实现');
  const nick = (profile.nick || '').trim();
  const wechat = (profile.wechat || '').trim();
  if (!nick || nick.length > 30) throw new Error('请填写 1–30 字的昵称');
  if (!/^[a-zA-Z][a-zA-Z0-9_-]{5,19}$/.test(wechat)) throw new Error('演示账号需为 6–20 位，字母开头');
  const dd = await db.ready;
  const users = dd.collection('users');
  const found = await users.where({ wechat }).get();
  const previous = found.data[0] || {};
  let avatar = profile.avatar || previous.avatar || '';
  if (profile.avatar && profile.avatar !== previous.avatar) {
    const savedPath = wx.env.USER_DATA_PATH + '/demo_avatar_' + wechat + '.png';
    if (profile.avatar !== savedPath) {
      try { wx.getFileSystemManager().copyFileSync(profile.avatar, savedPath); }
      catch (error) { throw new Error('头像保存失败，请重新选择头像或跳过'); }
    }
    avatar = savedPath;
  }
  const me = {
    nick, wechat, avatar,
    realName: previous.realName || '', college: previous.college || '',
    grade: previous.grade || '', building: previous.building || '',
    mode: 'local'
  };
  if (previous._id) await users.doc(previous._id).update({ data: me });
  else await users.add({ data: me });
  wx.setStorageSync('me', me);
  getApp().globalData.me = me;
  return me;
}
async function saveInfo(info) {
  const me = requireUser();
  const fields = ['realName', 'college', 'grade', 'building'];
  const next = Object.assign({}, me);
  fields.forEach(field => {
    next[field] = String(info[field] || '').trim();
    if (next[field].length > 60) throw new Error('个人信息每项最多 60 字');
  });
  const dd = await db.ready;
  const found = await dd.collection('users').where({ wechat: me.wechat }).get();
  if (found.data.length) await dd.collection('users').doc(found.data[0]._id).update({ data: next });
  else await dd.collection('users').add({ data: next });
  wx.setStorageSync('me', next);
  getApp().globalData.me = next;
  return next;
}
function logout() {
  wx.removeStorageSync('me');
  getApp().globalData.me = null;
}
module.exports = { current, requireUser, ensurePage, restore, login, saveInfo, logout };
