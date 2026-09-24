// cloudfunctions/getPhoneNumber/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const { code } = event;
  if (!code) return { ok: false, msg: '缺少 code' };
  try {
    const res = await cloud.openapi.phonenumber.getPhoneNumber({ code });
    const info = res.phoneInfo || {};
    return {
      ok: true,
      phone: info.phoneNumber || '',
      purePhone: info.purePhoneNumber || '',
      countryCode: info.countryCode || ''
    };
  } catch (e) {
    return { ok: false, msg: e.errMsg || '获取手机号失败' };
  }
};
