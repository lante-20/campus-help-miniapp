// cloudfunctions/acceptTask/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { taskId, acceptor } = event;
  if(!taskId || !acceptor || !acceptor.wechat) return { ok:false, msg:'参数不全' };
  try {
    await db.collection('tasks').doc(taskId).update({
      data: { status:'ongoing', acceptor, acceptTime: new Date() }
    });
    return { ok:true };
  } catch(e){ return { ok:false, msg:e.message }; }
};
