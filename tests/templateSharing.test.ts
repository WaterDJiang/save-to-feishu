import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createSharedKnowledgeTemplate,
  encodeSharedKnowledgeTemplate,
  matchSharedTemplateMappings,
  parseSharedKnowledgeTemplate,
} from '../src/utils/templateSharing.ts';

test('shared template excludes Feishu credentials, table identity, links and static values', () => {
  const template = createSharedKnowledgeTemplate({
    name: '研究资料库',
    templateId: 'researchLibrary',
    appToken: 'secret_app_token',
    tableId: 'tbl_secret',
    tableUrl: 'https://feishu.cn/base/secret_app_token?table=tbl_secret',
    fieldMappings: [
      { feishuFieldId: 'fld_title', feishuFieldName: '标题', sourceType: 'title' },
      {
        feishuFieldId: 'fld_status',
        feishuFieldName: '状态',
        sourceType: 'static',
        staticValue: '内部项目',
      },
    ],
  }, [{ id: 'summary', label: '摘要', type: 'summary' }]);
  const decoded = parseSharedKnowledgeTemplate(encodeSharedKnowledgeTemplate(template));
  const serialized = JSON.stringify(decoded);

  assert.equal(decoded.name, '研究资料库');
  assert.equal(decoded.fieldMappings[1].sourceType, 'static');
  assert.doesNotMatch(serialized, /secret_app_token|tbl_secret|内部项目|feishu\.cn|fld_title/);
});

test('shared template mappings bind to the recipient fields by field name', () => {
  const template = parseSharedKnowledgeTemplate(encodeSharedKnowledgeTemplate(
    createSharedKnowledgeTemplate({
      name: '选题库',
      fieldMappings: [
        { feishuFieldId: 'sender_title', feishuFieldName: '标题', sourceType: 'title' },
        { feishuFieldId: 'sender_note', feishuFieldName: '个人备注', sourceType: 'note' },
      ],
    }, [{ id: 'tags', label: '标签', type: 'tags' }])
  ));

  assert.deepEqual(matchSharedTemplateMappings(template, [
    { id: 'recipient_title', name: '标题', type: 'text' },
    { id: 'recipient_note', name: '个人备注', type: 'text' },
  ]), [
    { feishuFieldId: 'recipient_title', feishuFieldName: '标题', sourceType: 'title', aiFieldId: undefined, aiFieldName: undefined },
    { feishuFieldId: 'recipient_note', feishuFieldName: '个人备注', sourceType: 'note', aiFieldId: undefined, aiFieldName: undefined },
  ]);
});

test('parseSharedKnowledgeTemplate rejects unrelated text', () => {
  assert.throws(() => parseSharedKnowledgeTemplate('not-a-template'), /不是有效/);
});
