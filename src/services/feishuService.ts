import type { FeishuCredentials, FeishuField, FeishuTable, SaveResult, ExtractedPageContent, TableConfig } from '@/types';
import { getFeishuCredentials } from './storageService';

const LARK_API_BASE = 'https://open.feishu.cn/open-apis';

/**
 * 缓存的 Tenant Token
 */
let cachedTenantToken: string | null = null;
let cachedTenantTokenExpireAt = 0;

/**
 * 获取 Tenant Access Token
 * @param forceRefresh 是否强制刷新
 */
export async function getTenantToken(forceRefresh: boolean = false): Promise<string | null> {
  const now = Date.now();
  
  if (!forceRefresh && cachedTenantToken && cachedTenantTokenExpireAt > now + 5000) {
    console.log('[Feishu] 使用缓存的 Token');
    return cachedTenantToken;
  }
  
  const credentials = await getFeishuCredentials();
  if (!credentials.appId || !credentials.appSecret) {
    console.error('[Feishu] 缺少 App ID 或 App Secret');
    return null;
  }
  
  try {
    console.log('[Feishu] 正在获取 Tenant Access Token...');
    const response = await fetch(`${LARK_API_BASE}/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: credentials.appId,
        app_secret: credentials.appSecret,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Feishu] Token 获取失败，HTTP 状态:', response.status, errorText);
      return null;
    }
    
    const data = await response.json();
    
    if (data.code !== 0) {
      console.error('[Feishu] Token 获取失败:', data.msg, '(错误码:', data.code, ')');
      return null;
    }
    
    cachedTenantToken = data.tenant_access_token || null;
    
    const expireSec = Number(data.expire || data.expires_in || 0);
    cachedTenantTokenExpireAt = expireSec ? now + expireSec * 1000 : now + 30 * 60 * 1000;
    
    console.log('[Feishu] Token 获取成功，有效期至:', new Date(cachedTenantTokenExpireAt).toLocaleString());
    return cachedTenantToken;
  } catch (error) {
    console.error('[Feishu] Token 获取异常:', error);
    return null;
  }
}

/**
 * 获取认证请求头
 */
async function getAuthHeaders(forceRefresh: boolean = false): Promise<HeadersInit | null> {
  const token = await getTenantToken(forceRefresh);
  if (!token) {
    console.error('[Feishu] 无法获取 Token');
    return null;
  }
  
  const headers = { Authorization: `Bearer ${token}` };
  console.log('[Feishu] 使用 Token:', token.substring(0, 20) + '...');
  return headers;
}

/**
 * 测试飞书连接
 */
export async function testFeishuConnection(credentials: FeishuCredentials): Promise<boolean> {
  try {
    const response = await fetch(`${LARK_API_BASE}/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: credentials.appId,
        app_secret: credentials.appSecret,
      }),
    });
    
    const data = await response.json();
    return data.code === 0;
  } catch {
    return false;
  }
}

/**
 * 获取多维表的表格列表
 */
export async function listTables(appToken: string): Promise<FeishuTable[]> {
  try {
    const headers = await getAuthHeaders();
    if (!headers) return [];
    
    const response = await fetch(`${LARK_API_BASE}/bitable/v1/apps/${appToken}/tables`, {
      headers,
    });
    
    if (!response.ok) return [];
    
    const data = await response.json();
    const items = (data.data?.items || data.data?.tables || []) as any[];
    
    return items.map((item: any) => ({
      id: item.table_id || item.id,
      name: item.name,
    }));
  } catch {
    return [];
  }
}

/**
 * 获取表格的字段列表
 */
export async function getTableFields(appToken: string, tableId: string): Promise<FeishuField[]> {
  try {
    console.log('[Feishu] 正在获取表格字段...', { appToken, tableId });
    
    const headers = await getAuthHeaders();
    if (!headers) {
      console.error('[Feishu] 获取字段失败：无法获取认证 Token');
      return [];
    }
    
    const response = await fetch(`${LARK_API_BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/fields`, {
      headers,
    });
    
    if (!response.ok) {
      console.error('[Feishu] 获取字段失败，HTTP 状态:', response.status);
      return [];
    }
    
    const data = await response.json();
    console.log('[Feishu] 字段 API 响应数据:', data);
    
    const items = (data.data?.items || []) as any[];
    console.log('[Feishu] 解析出的字段列表:', items);
    
    const mapType = (t: number | string): FeishuField['type'] => {
      // 飞书 API 返回的字段类型是数字
      // 参考: https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table-field/guide
      const typeMap: Record<number, FeishuField['type']> = {
        1: 'text',      // 文本
        2: 'text',      // 长文本
        3: 'number',    // 数字
        4: 'date',      // 日期
        11: 'single_select', // 单选
        12: 'multi_select',  // 多选
        13: 'person',   // 人员
        15: 'url',      // 超链接
        17: 'attachment', // 附件/图片
        20: 'checkbox', // 复选框
        21: 'email',    // 邮箱
      };
      
      if (typeof t === 'number') {
        return typeMap[t] || 'text';
      }
      
      // 兼容字符串类型（旧版本 API）
      if (t === 'text' || t === 'long_text') return 'text';
      if (t === 'number') return 'number';
      if (t === 'date') return 'date';
      if (t === 'single_select' || t === 'multi_select') return 'single_select';
      if (t === 'user' || t === 'person') return 'person';
      if (t === 'checkbox') return 'checkbox';
      if (t === 'url') return 'url';
      if (t === 'email') return 'email';
      if (t === 'attachment') return 'attachment';
      return 'text';
    };
    
    const fields = items.map((f: any) => {
      const fieldId = f.field_id || f.id;
      const fieldName = (typeof f.name === 'string' && f.name.trim()) ? f.name.trim() : (f.field_name || f.title || `Field ${f.field_id || f.id}`);
      const fieldType = mapType(f.type);
      
      console.log(`[Feishu] 解析字段: ${fieldName} (ID: ${fieldId}, 类型: ${f.type} -> ${fieldType})`);
      
      return {
        id: fieldId,
        name: fieldName,
        type: fieldType,
      };
    });
    
    console.log('[Feishu] 最终字段列表:', fields);
    return fields;
  } catch (error) {
    console.error('[Feishu] 获取字段异常:', error);
    return [];
  }
}

/**
 * 根据字段类型格式化值
 * 飞书多维表不同字段类型需要不同的数据格式
 */
function formatFieldValue(value: any, fieldType: FeishuField['type']): any {
  switch (fieldType) {
    case 'url':
      // URL 类型 - 飞书多维表的 URL 字段必须使用对象格式
      // { "text": "显示文本", "link": "https://..." }
      if (typeof value === 'string' && value) {
        let url = value.trim();
        console.log('[Feishu] URL 格式化前:', url);
        
        // 确保 URL 有协议前缀
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url;
        }
        
        // 提取显示文本（使用 URL 的主机名）
        let displayText = url;
        try {
          const urlObj = new URL(url);
          displayText = urlObj.hostname || url;
        } catch {
          displayText = url.length > 50 ? url.substring(0, 50) + '...' : url;
        }
        
        const urlObject = {
          text: displayText,
          link: url
        };
        
        console.log('[Feishu] URL 格式化后:', urlObject);
        return urlObject;
      }
      return value;
    
    case 'date':
      // 日期类型需要 ISO 8601 格式或时间戳
      if (typeof value === 'string' || typeof value === 'number') {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      }
      return value;
    
    case 'number':
      // 数字类型
      if (typeof value === 'string') {
        const num = parseFloat(value);
        return isNaN(num) ? value : num;
      }
      return value;
    
    case 'checkbox':
      // 复选框类型需要布尔值
      if (typeof value === 'string') {
        return value.toLowerCase() === 'true' || value === '1' || value === 'yes';
      }
      return Boolean(value);
    
    case 'person':
      // 人员类型需要特定格式，这里暂时返回原始值
      return value;
    
    case 'single_select':
    case 'multi_select':
      // 单选/多选类型需要选项对象
      if (typeof value === 'string' && value) {
        return { text: value };
      }
      return value;
    
    case 'attachment':
      // 附件/图片类型需要使用 file_token
      // 由于获取 file_token 需要上传文件到飞书，这里暂时返回 null 跳过该字段
      // 建议：将图片字段改为文本类型，直接保存图片 URL
      console.warn('[Feishu] 图片字段需要 file_token，暂时跳过。建议将图片字段改为文本类型以保存图片 URL。');
      return null;
    
    case 'text':
    case 'long_text':
    case 'email':
    default:
      // 文本类型直接使用字符串
      return String(value || '');
  }
}

/**
 * 保存页面内容到飞书表格
 */
export async function saveToFeishu(
  tableConfig: TableConfig,
  content: ExtractedPageContent
): Promise<SaveResult> {
  try {
    console.log('[Feishu] 开始保存数据到飞书表格...');
    console.log('[Feishu] 表格配置:', {
      appToken: tableConfig.appToken,
      tableId: tableConfig.tableId,
      name: tableConfig.name
    });
    
    const headers = await getAuthHeaders();
    if (!headers) {
      console.error('[Feishu] 无法获取认证 Token');
      return { success: false, error: '无法获取飞书认证 Token，请检查 App ID 和 App Secret 配置' };
    }
    
    // 验证字段映射配置
    if (!tableConfig.fieldMappings || tableConfig.fieldMappings.length === 0) {
      console.error('[Feishu] 未配置字段映射');
      return { success: false, error: '未配置字段映射，请先在设置中配置字段映射' };
    }
    
    // 获取当前表格的实际字段列表，用于验证字段
    console.log('[Feishu] 正在验证字段...');
    const actualFields = await getTableFields(tableConfig.appToken, tableConfig.tableId);
    const actualFieldMap = new Map(actualFields.map(f => [f.id, f]));
    console.log('[Feishu] 表格实际字段列表:', actualFields);
    
    const fields: Record<string, any> = {};
    
    console.log('[Feishu] 字段映射配置:', tableConfig.fieldMappings);
    console.log('[Feishu] 页面内容数据:', {
      url: content.url,
      title: content.title,
      content: content.content?.substring(0, 100) + '...',
      mainImage: content.mainImage,
      savedAt: content.savedAt
    });
    
    for (const mapping of tableConfig.fieldMappings) {
      // 跳过空字段 ID
      if (!mapping.feishuFieldId) {
        console.warn('[Feishu] 跳过空字段 ID 的映射:', mapping);
        continue;
      }
      
      // 查找对应的实际字段
      const actualField = actualFieldMap.get(mapping.feishuFieldId);
      if (!actualField) {
        console.error(`[Feishu] 字段 ID ${mapping.feishuFieldId} (${mapping.feishuFieldName}) 不存在于表格中！`);
        console.error(`[Feishu] 可用的字段:`, actualFields.map(f => ({ id: f.id, name: f.name })));
        return { 
          success: false, 
          error: `字段 "${mapping.feishuFieldName}" 的 ID (${mapping.feishuFieldId}) 不存在于表格中。请重新获取表格字段并配置映射。` 
        };
      }
      
      let value: any = null;
      
      switch (mapping.sourceType) {
        case 'url':
          value = content.url;
          console.log(`[Feishu] URL 字段原始值:`, value, '类型:', typeof value);
          break;
        case 'title':
          value = content.title;
          break;
        case 'content':
          value = content.content || '';
          break;
        case 'image':
          value = content.mainImage || '';
          break;
        case 'saveTime':
          value = content.savedAt;
          break;
        case 'static':
          value = mapping.staticValue || '';
          break;
      }
      
      if (value !== null && value !== undefined) {
        // 根据字段类型格式化数据
        console.log(`[Feishu] 格式化前 - ${actualField.name} (类型: ${actualField.type}):`, value, typeof value);
        const formattedValue = formatFieldValue(value, actualField.type);
        console.log(`[Feishu] 格式化后 - ${actualField.name}:`, formattedValue, typeof formattedValue);
        
        // 如果格式化后值为 null，跳过该字段
        if (formattedValue === null) {
          console.warn(`[Feishu] 字段 ${actualField.name} 格式化后为空，已跳过`);
          continue;
        }
        
        // 飞书 API 需要使用字段名称作为 key
        fields[actualField.name] = formattedValue;
        console.log(`[Feishu] 字段映射完成: ${actualField.name} <- ${mapping.sourceType}`);
      } else {
        console.warn(`[Feishu] 字段 ${mapping.feishuFieldName} (${mapping.sourceType}) 的值为空，已跳过`);
      }
    }
    
    if (Object.keys(fields).length === 0) {
      console.error('[Feishu] 没有有效的字段映射');
      return { success: false, error: '没有有效的字段映射，请检查映射配置' };
    }
    
    console.log('[Feishu] 准备发送的数据:', {
      appToken: tableConfig.appToken,
      tableId: tableConfig.tableId,
      fields: fields,
      fieldCount: Object.keys(fields).length
    });
    
    // 构建请求 URL
    const requestUrl = `${LARK_API_BASE}/bitable/v1/apps/${tableConfig.appToken}/tables/${tableConfig.tableId}/records`;
    console.log('[Feishu] 请求 URL:', requestUrl);
    console.log('[Feishu] 请求头:', headers);
    console.log('[Feishu] 请求体:', JSON.stringify({ fields }, null, 2));
    
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields,
      }),
    });
    
    console.log('[Feishu] API 响应状态:', response.status, response.statusText);
    
    const responseText = await response.text();
    console.log('[Feishu] API 响应原始文本:', responseText);
    
    const data = JSON.parse(responseText);
    console.log('[Feishu] API 响应数据:', data);
    
    if (data.code !== 0) {
      const errorMsg = data.msg || '未知错误';
      const errorCode = data.code;
      console.error(`[Feishu] 保存失败: ${errorMsg} (错误码: ${errorCode})`);
      
      // 如果是 Token 相关错误，尝试刷新 Token 后重试
      if (errorCode === 99991661 || errorMsg.includes('token') || errorMsg.includes('Token')) {
        console.log('[Feishu] Token 可能已过期，尝试刷新...');
        
        // 强制刷新 Token
        const newHeaders = await getAuthHeaders(true);
        if (!newHeaders) {
          return { 
            success: false, 
            error: '无法刷新认证 Token，请检查 App ID 和 App Secret 配置' 
          };
        }
        
        // 重试请求
        console.log('[Feishu] 使用新 Token 重试...');
        const retryResponse = await fetch(requestUrl, {
          method: 'POST',
          headers: {
            ...newHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fields }),
        });
        
        const retryText = await retryResponse.text();
        const retryData = JSON.parse(retryText);
        
        if (retryData.code === 0) {
          const recordId = retryData.data?.record?.record_id || retryData.data?.record?.id;
          console.log('[Feishu] 重试保存成功，记录 ID:', recordId);
          return { success: true, recordId };
        } else {
          console.error('[Feishu] 重试仍然失败:', retryData);
        }
      }
      
      // 提供更友好的错误提示
      let friendlyError = errorMsg;
      if (errorMsg.includes('FieldNameNotFound') || errorMsg.includes('field')) {
        friendlyError = `字段不存在或字段 ID 错误。请重新获取表格字段并配置映射。原始错误: ${errorMsg}`;
      } else if (errorMsg.includes('permission') || errorMsg.includes('Forbidden')) {
        friendlyError = `权限不足。请确保应用有权限访问该表格。原始错误: ${errorMsg}`;
      } else if (errorMsg.includes('token') || errorMsg.includes('Token')) {
        friendlyError = `认证 Token 无效。请检查 App ID 和 App Secret 配置。原始错误: ${errorMsg}`;
      }
      
      // 添加详细的错误信息
      const errorDetail = {
        errorCode,
        errorMsg,
        requestUrl: requestUrl,
        appToken: tableConfig.appToken,
        tableId: tableConfig.tableId,
        fieldIds: Object.keys(fields),
      };
      console.error('[Feishu] 详细错误信息:', errorDetail);
      
      return { 
        success: false, 
        error: `${friendlyError} (错误码: ${errorCode})` 
      };
    }
    
    const recordId = data.data?.record?.record_id || data.data?.record?.id;
    console.log('[Feishu] 保存成功，记录 ID:', recordId);
    
    return {
      success: true,
      recordId,
    };
  } catch (error) {
    console.error('[Feishu] 保存过程异常:', error);
    return {
      success: false,
      error: error instanceof Error ? `保存失败: ${error.message}` : '保存过程中发生未知错误',
    };
  }
}

/**
 * 测试表格访问权限
 */
export async function testTableAccess(appToken: string, tableId: string): Promise<boolean> {
  try {
    const headers = await getAuthHeaders();
    if (!headers) return false;
    
    const response = await fetch(
      `${LARK_API_BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records?page_size=1`,
      { headers }
    );
    
    return response.ok;
  } catch {
    return false;
  }
}
