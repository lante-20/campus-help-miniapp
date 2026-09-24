const db = require('./db');
const session = require('./session');
const { check, containsPhone } = require('./sensitive');
const TYPES = { express: '代拿快递', food: '代拿外卖', lost: '失物招领' };
const STATUS = { approved: '待接取', ongoing: '进行中', done: '已完成', cancelled: '已撤下' };

function text(value, label, max, required) {
  const result = String(value || '').trim();
  if (required && !result) throw new Error('请填写' + label);
  if (result.length > max) throw new Error(label + '最多 ' + max + ' 字');
  return result;
}
function localTime(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new Error('请选择完整的日期和时间');
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const value = new Date(year, month - 1, day, hour, minute);
  if (value.getFullYear() !== year || value.getMonth() !== month - 1 || value.getDate() !== day ||
      value.getHours() !== hour || value.getMinutes() !== minute) throw new Error('日期或时间无效');
  return value.getTime();
}
function validateTask(form, now) {
  now = now === undefined ? Date.now() : now;
  if (!Object.prototype.hasOwnProperty.call(TYPES, form.type)) throw new Error('请选择任务类型');
  const lost = form.type === 'lost';
  const data = {
    type: form.type,
    item: text(form.item, '物品名称', 80, true),
    pickup: text(form.pickup, lost ? '遗失或拾获地点' : '取件地点', 100, true),
    building: lost ? '' : text(form.building, '送达地址', 100, true),
    pickupCode: lost ? '' : text(form.pickupCode, '取件码', 40, false),
    weight: lost ? '' : text(form.weight, '重量', 30, false),
    remark: text(form.remark, '描述', 500, lost),
    reward: '', rewardCents: 0, deadline: '', deadlineAt: null, occurredAt: null
  };
  if (lost) {
    data.occurredAt = localTime(form.eventDate, form.eventTime);
    if (data.occurredAt > now) throw new Error('遗失或拾获时间不能晚于现在');
    data.eventTimeText = form.eventDate + ' ' + form.eventTime;
  } else {
    data.deadlineAt = localTime(form.deadlineDate, form.deadlineTime);
    if (data.deadlineAt <= now) throw new Error('截止时间必须晚于现在');
    data.deadline = form.deadlineDate + ' ' + form.deadlineTime;
    const reward = String(form.reward === undefined ? '' : form.reward).trim();
    if (!/^(0|[1-9]\d{0,3})(\.\d{1,2})?$/.test(reward)) throw new Error('报酬请填 0–9999.99，可保留两位小数');
    data.rewardCents = Math.round(Number(reward) * 100);
    data.reward = (data.rewardCents / 100).toFixed(2) + ' 元';
  }
  const content = [data.item, data.pickup, data.building, data.weight, data.remark].join(' ');
  const result = check(content);
  if (!result.ok) throw new Error(result.msg);
  if (containsPhone(content)) throw new Error('公开信息和地址中请勿填写手机号');
  return data;
}
function isPublisher(task, me) {
  return !!me && !!me.wechat && task.pubWechat === me.wechat;
}
function isParticipant(task, me) {
  return isPublisher(task, me) || !!(me && task.acceptor && task.acceptor.wechat === me.wechat);
}
function expired(task) {
  return task.type !== 'lost' && task.deadlineAt && task.deadlineAt <= Date.now();
}
function decorate(task, me) {
  const own = isPublisher(task, me), participant = isParticipant(task, me);
  return Object.assign({}, task, {
    typeLabel: TYPES[task.type] || '校园互助',
    statusText: task.status === 'approved' && expired(task) ? '已过期' : STATUS[task.status] || '不可接取',
    isPub: own, canViewPrivate: participant,
    canAccept: !!me && !own && task.status === 'approved' && !expired(task),
    canContact: participant && !!task.acceptor && ['ongoing', 'done'].indexOf(task.status) >= 0,
    canFinish: own && ['approved', 'ongoing'].indexOf(task.status) >= 0,
    finishLabel: task.status === 'ongoing' || task.type === 'lost' ? '确认完成' : '撤下任务'
  });
}
async function getTask(id) {
  if (!id) throw new Error('缺少任务编号');
  const dd = await db.ready;
  return (await dd.collection('tasks').doc(id).get()).data;
}
async function publish(form) {
  const me = session.requireUser();
  const data = validateTask(form);
  const dd = await db.ready;
  return dd.collection('tasks').add({ data: Object.assign(data, {
    status: 'approved', pubName: me.nick, pubWechat: me.wechat,
    pubAvatar: me.avatar || '', acceptor: null, createTime: Date.now()
  }) });
}
async function accept(id) {
  const me = session.requireUser(), task = await getTask(id);
  if (isPublisher(task, me)) throw new Error('不能接取自己发布的任务');
  if (task.status !== 'approved') throw new Error('任务已被接取或已结束');
  if (expired(task)) throw new Error('任务已过截止时间');
  const dd = await db.ready;
  return dd.collection('tasks').doc(id).updateIf({ status: 'approved' }, { data: {
    status: 'ongoing', acceptor: { name: me.nick, wechat: me.wechat, avatar: me.avatar || '' },
    acceptTime: Date.now()
  } });
}
async function finish(id) {
  const me = session.requireUser(), task = await getTask(id);
  if (!isPublisher(task, me)) throw new Error('只有发布者可以结束任务');
  if (['approved', 'ongoing'].indexOf(task.status) < 0) throw new Error('任务已经结束');
  const status = task.status === 'ongoing' || task.type === 'lost' ? 'done' : 'cancelled';
  const dd = await db.ready;
  return dd.collection('tasks').doc(id).updateIf({ status: task.status, pubWechat: me.wechat },
    { data: { status, finishTime: Date.now() } });
}
async function conversation(id) {
  const me = session.requireUser(), task = await getTask(id);
  if (!isParticipant(task, me) || !task.acceptor || ['ongoing', 'done'].indexOf(task.status) < 0) {
    throw new Error('仅任务双方可进入接取后的对话');
  }
  const otherWx = isPublisher(task, me) ? task.acceptor.wechat : task.pubWechat;
  return { task, me, otherWx };
}
async function sendMessage(id, input) {
  const ctx = await conversation(id);
  const message = text(input, '消息', 500, true);
  const result = check(message);
  if (!result.ok) throw new Error(result.msg);
  if (containsPhone(message)) throw new Error('请勿发送手机号');
  const dd = await db.ready;
  return dd.collection('messages').add({ data: {
    taskId: id, fromWx: ctx.me.wechat, fromName: ctx.me.nick,
    toWx: ctx.otherWx, text: message, time: Date.now()
  } });
}
async function report(id) {
  const ctx = await conversation(id), dd = await db.ready;
  return dd.collection('reports').add({ data: {
    taskId: id, reporterWx: ctx.me.wechat, targetWx: ctx.otherWx,
    reason: '聊天中违规', status: 'pending', time: Date.now()
  } });
}
module.exports = {
  TYPES, STATUS, validateTask, decorate, getTask, publish, accept, finish,
  conversation, sendMessage, report, isParticipant
};
