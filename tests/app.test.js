const test = require('node:test');
const assert = require('node:assert/strict');
const { createRuntime, copy, flush } = require('./helpers/runtime');
const A = { wechat: 'studentA', nick: '同学 A' };
const B = { wechat: 'studentB', nick: '同学 B' };
const C = { wechat: 'studentC', nick: '同学 C' };
const form = overrides => Object.assign({
  type: 'express', item: '演示包裹', pickup: '示例驿站', building: '示例楼栋',
  pickupCode: 'DEMO-123', deadlineDate: '2099-01-01', deadlineTime: '18:00',
  reward: '0', remark: ''
}, overrides);

test('nested queries, direct collection ordering, OR and pagination work without mutating query objects', async () => {
  const r = createRuntime({ col_tasks: [
    { _id: 't1', pubWechat: A.wechat, acceptor: { wechat: B.wechat }, createTime: '2026-01-01T00:00:00.000Z' },
    { _id: 't2', pubWechat: B.wechat, acceptor: null, createTime: 1767312000000 }
  ], col_reports: [{ _id: 'r1', time: 1 }, { _id: 'r2', time: 2 }] });
  const d = await r.load('utils/db').ready;
  assert.equal((await d.collection('tasks').where({ 'acceptor.wechat': B.wechat }).get()).data.length, 1);
  assert.equal((await d.collection('reports').orderBy('time', 'desc').get()).data[0]._id, 'r2');
  assert.equal((await d.collection('tasks').where(d.command.or([{ pubWechat: B.wechat }, { 'acceptor.wechat': B.wechat }])).get()).data.length, 2);
  const query = d.collection('tasks').orderBy('createTime', 'desc');
  assert.equal((await query.limit(1).get()).data[0]._id, 't2');
  assert.equal((await query.skip(1).limit(1).get()).data[0]._id, 't1');
  assert.equal((await query.get()).data.length, 2);
});

test('missing records, corrupt storage and quota failures reject rather than reporting success', async () => {
  const r = createRuntime();
  const d = await r.load('utils/db').ready;
  await assert.rejects(d.collection('tasks').doc('missing').get(), /不存在/);
  await assert.rejects(d.collection('tasks').doc('missing').update({ data: { status: 'done' } }), /不存在/);
  r.storage.col_tasks = 'broken';
  await assert.rejects(d.collection('tasks').get(), /格式异常/);
  delete r.storage.col_tasks;
  r.failures.write = 'col_tasks';
  await assert.rejects(d.collection('tasks').add({ data: { item: 'x' } }), /write failed/);
  assert.equal(r.storage.col_tasks, undefined);
});

test('local login, restart and profile save never invoke cloud APIs or require phone authorization', async () => {
  const r = createRuntime();
  r.load('app');
  const session = r.load('utils/session');
  await session.login(A);
  assert.equal(r.me().wechat, A.wechat);
  await session.saveInfo({ college: '示例学院' });
  session.logout();
  await session.login(A);
  assert.equal(r.me().college, '示例学院');
  assert.equal(r.storage.col_users.length, 1);
  assert.equal(createRuntime(r.storage).load('utils/session').restore().wechat, A.wechat);
  r.failures.write = 'me';
  await assert.rejects(session.login(B), /write failed/);
  assert.equal(r.me().wechat, A.wechat);
});

test('selected avatar is copied to persistent local storage and remains optional', async () => {
  const r = createRuntime(), session = r.load('utils/session');
  await session.login(Object.assign({}, A, { avatar: '/temp/picture' }));
  assert.equal(r.me().avatar, '/demo-data/demo_avatar_studentA.png');
  assert.equal(r.calls.filter(call => call[0] === 'copyFile').length, 1);
  await session.login(B);
  assert.equal(r.me().avatar, '');
});

test('complete publish, accept, message, report and finish workflow preserves both users records', async () => {
  const r = createRuntime(), service = r.load('utils/task-service'), d = await r.load('utils/db').ready;
  r.setMe(A);
  const { _id } = await service.publish(form());
  assert.equal(r.storage.col_tasks[0].rewardCents, 0);
  r.setMe(B);
  await service.accept(_id);
  await service.sendMessage(_id, '我已到达示例地点');
  await service.report(_id);
  assert.equal((await d.collection('tasks').where({ 'acceptor.wechat': B.wechat }).get()).data.length, 1);
  r.setMe(A);
  await service.sendMessage(_id, '收到，谢谢');
  await service.finish(_id);
  const task = await service.getTask(_id);
  assert.equal(task.status, 'done');
  assert.equal(task.acceptor.wechat, B.wechat);
  assert.equal(r.storage.col_messages.length, 2);
  assert.equal(r.storage.col_reports.length, 1);
  assert.equal(service.decorate(task, B).canAccept, false);
  assert.equal(service.decorate(task, B).canContact, true);
  r.setMe(B);
  await assert.rejects(service.accept(_id), /已被接取或已结束/);
  assert.equal((await service.getTask(_id)).status, 'done');
});

test('competing acceptors produce exactly one success and do not overwrite the winner', async () => {
  const r = createRuntime(), service = r.load('utils/task-service');
  r.setMe(A);
  const { _id } = await service.publish(form());
  r.setMe(B);
  const first = service.accept(_id);
  r.setMe(C);
  const second = service.accept(_id);
  const results = await Promise.allSettled([first, second]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal((await service.getTask(_id)).acceptor.wechat, B.wechat);
});

test('own, expired, missing and closed tasks cannot be accepted; only publisher can finish', async () => {
  const r = createRuntime(), service = r.load('utils/task-service'), d = await r.load('utils/db').ready;
  await assert.rejects(service.publish(form()), /演示身份/);
  r.setMe(A);
  const { _id } = await service.publish(form());
  await assert.rejects(service.accept(_id), /自己/);
  r.setMe(B);
  await assert.rejects(service.finish(_id), /只有发布者/);
  await assert.rejects(service.accept('missing'), /不存在/);
  await d.collection('tasks').doc(_id).update({ data: { deadlineAt: 1 } });
  await assert.rejects(service.accept(_id), /截止时间/);
  r.setMe(A);
  await service.finish(_id);
  assert.equal((await service.getTask(_id)).status, 'cancelled');
  r.setMe(B);
  await assert.rejects(service.accept(_id), /已被接取或已结束/);
});

test('lost-and-found uses its own fields; dates, decimals and all public text are validated', () => {
  const r = createRuntime(), service = r.load('utils/task-service');
  const lost = service.validateTask(form({
    type: 'lost', building: '', reward: '', deadlineDate: '', deadlineTime: '',
    eventDate: '2020-01-01', eventTime: '10:00', remark: '蓝色外壳'
  }));
  assert.equal(lost.building, '');
  assert.equal(lost.reward, '');
  assert.equal(lost.deadlineAt, null);
  assert.ok(lost.occurredAt);
  assert.equal(service.validateTask(form({ reward: '1.25' })).rewardCents, 125);
  assert.equal(service.validateTask(form({ reward: 0 })).rewardCents, 0);
  for (const reward of ['-1', 'NaN', '1.234', '10000', '1e2', '']) {
    assert.throws(() => service.validateTask(form({ reward })), /报酬/);
  }
  assert.throws(() => service.validateTask(form({ deadlineDate: '2020-01-01' })), /晚于现在/);
  assert.throws(() => service.validateTask(form({ deadlineDate: '2099-02-30' })), /无效/);
  assert.throws(() => service.validateTask(form({ building: '代 签 到地点' })), /禁止/);
  assert.throws(() => service.validateTask(form({ remark: '138-1234-5678' })), /手机号/);
  assert.throws(() => service.validateTask(form({ type: 'toString' })), /任务类型/);
});

test('outsiders cannot read, send or report a task conversation; recipient comes from task membership', async () => {
  const r = createRuntime(), service = r.load('utils/task-service');
  r.setMe(A);
  const { _id } = await service.publish(form());
  r.setMe(B); await service.accept(_id);
  r.setMe(C);
  await assert.rejects(service.conversation(_id), /仅任务双方/);
  await assert.rejects(service.sendMessage(_id, 'hello'), /仅任务双方/);
  await assert.rejects(service.report(_id), /仅任务双方/);
  r.setMe(B);
  await assert.rejects(service.sendMessage(_id, '138 1234 5678'), /手机号/);
  await service.sendMessage(_id, 'test');
  assert.equal(r.storage.col_messages[0].toWx, A.wechat);
});

test('accept and detail pages expose failures and guard repeat submission', async () => {
  const r = createRuntime(), service = r.load('utils/task-service');
  r.setMe(A);
  const { _id } = await service.publish(form());
  r.setMe(B);
  const page = r.page('pages/accept/accept'); page.onLoad({ id: _id });
  await Promise.all([page.confirm(), page.confirm()]);
  assert.equal(r.calls.filter(call => call[0] === 'modal' && call[1].title === '接取成功').length, 1);
  const detail = r.page('pages/detail/detail'); detail.onLoad({ id: 'missing' });
  await detail.load();
  assert.equal(detail.data.t, null);
  assert.match(detail.data.error, /不存在/);
  assert.equal(detail.data.loading, false);
});

test('home filters before pagination, including tasks older than the previous 50 item cutoff', async () => {
  const tasks = Array.from({ length: 70 }, (_, i) => ({
    _id: 't' + i, status: 'approved', type: i < 4 ? 'lost' : 'express',
    pubWechat: A.wechat, createTime: i
  }));
  const r = createRuntime({ col_tasks: tasks }); r.setMe(B);
  const index = r.page('pages/index/index');
  await index.load();
  assert.equal(index.data.list.length, 20);
  assert.equal(index.data.hasMore, true);
  await index.loadMore();
  assert.equal(index.data.list.length, 40);
  index.setData({ filter: 'lost' });
  await index.load();
  assert.equal(index.data.list.length, 4);
  assert.ok(index.data.list.every(task => task.type === 'lost'));
});

test('drafts are isolated by demo account and successful publish resets the form', async () => {
  const r = createRuntime(); r.setMe(A);
  const page = r.page('pages/publish/publish'); page.onShow();
  page.setData(form()); page.onHide();
  assert.equal(r.storage.draft_task_studentA.item, '演示包裹');
  r.setMe(B); page.onShow();
  assert.equal(page.data.item, '');
  page.setData({ item: 'B 的草稿' }); page.onHide();
  r.setMe(A); page.onShow();
  assert.equal(page.data.item, '演示包裹');
  await page.confirmWarn();
  assert.equal(r.storage.col_tasks.length, 1);
  assert.equal(page.data.item, '');
  assert.equal(r.storage.draft_task_studentA, undefined);
  assert.equal(r.storage.draft_task_studentB.item, 'B 的草稿');
});

test('failed publication keeps the form and unlocks retry without creating a phantom task', async () => {
  const r = createRuntime(); r.setMe(A);
  const page = r.page('pages/publish/publish'); page.onShow(); page.setData(form());
  r.failures.write = 'col_tasks';
  await page.confirmWarn();
  assert.equal(page.data.item, '演示包裹');
  assert.equal(page.data.saving, false);
  assert.equal(page._sending, false);
  assert.equal(r.storage.col_tasks, undefined);
  assert.equal(r.calls.some(call => call[0] === 'modal' && call[1].title === '发布失败'), true);
});

test('a draft read failure never replaces the saved draft with an empty form', () => {
  const original = form({ item: '需要保留的草稿' });
  const r = createRuntime({ draft_task_studentA: original });
  r.setMe(A);
  r.failures.read = 'draft_task_studentA';
  const page = r.page('pages/publish/publish'); page.onShow();
  assert.ok(page.data.draftError);
  page.onHide();
  assert.deepEqual(r.storage.draft_task_studentA, original);
  page.onIn({ currentTarget: { dataset: { f: 'item' } }, detail: { value: '重新填写的草稿' } });
  page.saveDraft();
  assert.equal(r.storage.draft_task_studentA.item, '重新填写的草稿');
});

test('chat ignores unrelated messages, loads history and stops polling while hidden', async () => {
  const r = createRuntime(), service = r.load('utils/task-service');
  r.setMe(A); const { _id } = await service.publish(form());
  r.setMe(B); await service.accept(_id);
  r.storage.col_messages = Array.from({ length: 35 }, (_, i) => ({
    _id: 'm' + i, taskId: _id, fromWx: A.wechat, toWx: B.wechat, text: 'message ' + i, time: i
  }));
  r.storage.col_messages.push({ _id: 'outsider', taskId: _id, fromWx: C.wechat, toWx: A.wechat, text: 'not this conversation', time: 100 });
  const chat = r.page('pages/chat/chat');
  chat.onLoad({ taskId: _id, otherWx: C.wechat }); chat.onShow(); await flush();
  assert.equal(chat.data.msgs.length, 30);
  assert.equal(chat.data.hasMore, true);
  assert.equal(chat.data.msgs.some(message => message._id === 'outsider'), false);
  assert.equal(r.timers.size, 1);
  const previousUpdates = chat.updates.length;
  await chat.load();
  assert.equal(chat.updates.slice(previousUpdates).some(keys => keys.includes('msgs')), false);
  await chat.loadEarlier();
  assert.equal(chat.data.msgs.length, 35);
  chat.onHide();
  assert.equal(r.timers.size, 0);
  await chat.load();
  assert.equal(r.timers.size, 0);
  chat.onShow(); await flush();
  assert.equal(r.timers.size, 1);
  chat.onUnload();
  assert.equal(r.timers.size, 0);
});

test('accepted tasks and both participants conversation lists are populated and link to details', async () => {
  const r = createRuntime(), service = r.load('utils/task-service');
  r.setMe(A); const { _id } = await service.publish(form());
  r.setMe(B); await service.accept(_id);
  const mine = r.page('pages/myacc/myacc'); await mine.load();
  assert.equal(mine.data.list[0]._id, _id);
  mine.goDetail({ currentTarget: { dataset: { id: _id } } });
  assert.match(r.calls[r.calls.length - 1][1].url, /pages\/detail\/detail/);
  const messages = r.page('pages/messages/messages'); await messages.load();
  assert.equal(messages.data.list.length, 1);
  r.setMe(A); await messages.load();
  assert.equal(messages.data.list.length, 1);
});

test('admin list renders sorted reports and offers an error instead of an empty success', async () => {
  const r = createRuntime({ col_reports: [{ _id: 'r1', time: 1 }, { _id: 'r2', time: 2 }] });
  r.setMe(A);
  const page = r.page('pages/admin/admin'); await page.load();
  assert.equal(page.data.reports[0]._id, 'r2');
  r.failures.read = 'col_reports';
  await page.load();
  assert.match(page.data.error, /read failed/);
  assert.equal(page.data.loading, false);
});

test('unsupported cloud mode fails explicitly without creating local records', async () => {
  const r = createRuntime(), config = r.load('config');
  config.mode = 'cloud';
  await assert.rejects(r.load('utils/session').login(A), /云端模式尚未实现/);
  const d = await r.load('utils/db').ready;
  await assert.rejects(d.collection('tasks').get(), /云端模式尚未实现/);
  assert.deepEqual(r.storage, {});
});
