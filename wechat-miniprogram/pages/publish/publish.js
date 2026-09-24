const session = require('../../utils/session');
const service = require('../../utils/task-service');
const FORM_FIELDS = ['type', 'item', 'pickup', 'building', 'pickupCode', 'weight', 'reward',
  'remark', 'deadlineDate', 'deadlineTime', 'eventDate', 'eventTime'];
function today() {
  const date = new Date();
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}
function emptyForm() {
  return {
    type: 'express', item: '', pickup: '', building: '', pickupCode: '', weight: '', reward: '',
    remark: '', deadlineDate: '', deadlineTime: '', eventDate: '', eventTime: ''
  };
}
Page({
  data: Object.assign({
    types: [{ value: 'express', label: '代拿快递' }, { value: 'food', label: '代拿外卖' }, { value: 'lost', label: '失物招领' }],
    typeIdx: 0, showWarn: false, saving: false, draftError: '', today: today()
  }, emptyForm()),
  onShow() {
    if (!session.ensurePage()) return;
    const owner = session.current().wechat;
    if (owner !== this._owner) {
      this._owner = owner;
      this._draftLoaded = false;
      this._draftDirty = false;
      this.setData(Object.assign(emptyForm(), { typeIdx: 0, showWarn: false, draftError: '' }));
      try {
        const draft = wx.getStorageSync(this.draftKey());
        if (draft && (typeof draft !== 'object' || Array.isArray(draft))) throw new Error('草稿格式异常');
        if (draft && typeof draft === 'object') {
          const restored = emptyForm();
          FORM_FIELDS.forEach(field => { if (typeof draft[field] === 'string') restored[field] = draft[field]; });
          const index = this.data.types.findIndex(type => type.value === restored.type);
          if (index < 0) restored.type = 'express';
          this.setData(Object.assign(restored, { typeIdx: Math.max(0, index) }));
        }
        this._draftLoaded = true;
      } catch (error) { this.setData({ draftError: '草稿读取失败，可继续填写或稍后重试' }); }
    }
    this.setData({ today: today() });
  },
  onHide() { this.persistDraft(false); },
  draftKey() { return 'draft_task_' + this._owner; },
  form() {
    const form = {};
    FORM_FIELDS.forEach(field => { form[field] = this.data[field]; });
    return form;
  },
  onType(e) {
    const index = Number(e.detail.value);
    if (this.data.types[index]) {
      this._draftDirty = true;
      this.setData({ typeIdx: index, type: this.data.types[index].value });
    }
  },
  onIn(e) {
    const field = e.currentTarget.dataset.f;
    if (FORM_FIELDS.indexOf(field) !== -1) {
      this._draftDirty = true;
      this.setData({ [field]: e.detail.value });
    }
  },
  persistDraft(notify) {
    if (!this._owner || this._sending) return;
    // 读取失败且尚未编辑时，绝不使用空表单覆盖原草稿。
    if (!this._draftLoaded && !this._draftDirty) return;
    try {
      const form = this.form();
      const hasContent = FORM_FIELDS.some(field => field !== 'type' && form[field]);
      if (hasContent) wx.setStorageSync(this.draftKey(), form);
      else wx.removeStorageSync(this.draftKey());
      this._draftLoaded = true;
      this._draftDirty = false;
      this.setData({ draftError: '' });
      if (notify) wx.showToast({ title: hasContent ? '草稿已保存' : '暂无草稿内容', icon: 'none' });
    } catch (error) {
      this.setData({ draftError: '草稿保存失败，请保留当前页面内容后重试' });
    }
  },
  saveDraft() { this.persistDraft(true); },
  submit() {
    if (!session.ensurePage() || this.data.saving) return;
    try {
      service.validateTask(this.form());
      this.setData({ showWarn: true });
    } catch (error) {
      wx.showModal({ title: '请检查填写内容', content: error.message, showCancel: false });
    }
  },
  async confirmWarn() {
    if (this._sending || !session.ensurePage()) return;
    this._sending = true;
    this.setData({ saving: true, showWarn: false });
    try {
      await service.publish(this.form());
      // 先清空表单；草稿删除失败时不能把已成功的发布显示为失败。
      this.setData(Object.assign(emptyForm(), { typeIdx: 0 }));
      try { wx.removeStorageSync(this.draftKey()); }
      catch (error) { wx.showToast({ title: '发布成功，旧草稿清理失败', icon: 'none' }); }
      wx.switchTab({ url: '/pages/index/index' });
    } catch (error) {
      wx.showModal({ title: '发布失败', content: error.message || '请稍后重试', showCancel: false });
    } finally {
      this._sending = false;
      this.setData({ saving: false });
    }
  },
  cancelWarn() { this.setData({ showWarn: false }); }
});
