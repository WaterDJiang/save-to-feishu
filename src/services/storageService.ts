import type { AppConfig, TableConfig, FeishuCredentials } from '@/types';
import { saveEncryptedToStorage, loadEncryptedFromStorage, clearEncryptedStorage } from '@/utils/encryption';
import { parseAndValidateConfig, repairConfig } from '@/utils/validator';

const CONFIG_VERSION = '1.0.0';

/**
 * 获取默认配置
 */
function getDefaultConfig(): AppConfig {
  return {
    feishu: {
      appId: '',
      appSecret: '',
    },
    tables: [],
    version: CONFIG_VERSION,
  };
}

/**
 * 保存完整配置
 */
export async function saveConfig(config: AppConfig): Promise<void> {
  await saveEncryptedToStorage(config);
}

/**
 * 加载配置
 */
export async function loadConfig(): Promise<AppConfig> {
  const data = await loadEncryptedFromStorage();
  if (!data) {
    return getDefaultConfig();
  }
  return data as AppConfig;
}

/**
 * 保存飞书应用凭证
 */
export async function saveFeishuCredentials(credentials: FeishuCredentials): Promise<void> {
  const config = await loadConfig();
  config.feishu = credentials;
  await saveConfig(config);
}

/**
 * 获取飞书应用凭证
 */
export async function getFeishuCredentials(): Promise<FeishuCredentials> {
  const config = await loadConfig();
  return config.feishu;
}

/**
 * 获取所有表格配置
 */
export async function getTableConfigs(): Promise<TableConfig[]> {
  const config = await loadConfig();
  return config.tables;
}

/**
 * 根据 ID 获取单个表格配置
 */
export async function getTableConfigById(id: string): Promise<TableConfig | undefined> {
  const tables = await getTableConfigs();
  return tables.find(t => t.id === id);
}

/**
 * 添加或更新表格配置
 */
export async function saveTableConfig(table: TableConfig): Promise<void> {
  const config = await loadConfig();
  const index = config.tables.findIndex(t => t.id === table.id);
  
  if (index >= 0) {
    config.tables[index] = { ...table, updatedAt: Date.now() };
  } else {
    config.tables.push({ ...table, createdAt: Date.now(), updatedAt: Date.now() });
  }
  
  await saveConfig(config);
}

/**
 * 删除表格配置
 */
export async function deleteTableConfig(id: string): Promise<void> {
  const config = await loadConfig();
  config.tables = config.tables.filter(t => t.id !== id);
  await saveConfig(config);
}

/**
 * 保存所有表格配置（用于排序）
 */
export async function saveTableConfigs(tables: TableConfig[]): Promise<void> {
  const config = await loadConfig();
  config.tables = tables.map(t => ({ ...t, updatedAt: Date.now() }));
  await saveConfig(config);
}

/**
 * 导出配置为 JSON
 */
export async function exportConfig(includeSecret: boolean = false): Promise<string> {
  const config = await loadConfig();
  
  if (!includeSecret) {
    return JSON.stringify({
      ...config,
      feishu: {
        ...config.feishu,
        appSecret: '',
      },
    }, null, 2);
  }
  
  return JSON.stringify(config, null, 2);
}

/**
 * 导入配置
 */
export async function importConfig(jsonString: string): Promise<boolean> {
  try {
    // 使用验证工具解析和验证
    let config = parseAndValidateConfig(jsonString);
    
    // 如果验证失败，尝试修复
    if (!config) {
      console.warn('[Storage] 配置验证失败，尝试修复...');
      const obj = JSON.parse(jsonString);
      config = repairConfig(obj);
    }
    
    if (!config) {
      console.error('[Storage] 配置导入失败：无法解析或修复配置');
      return false;
    }
    
    await saveConfig(config);
    console.log('[Storage] 配置导入成功');
    return true;
  } catch (error) {
    console.error('[Storage] 配置导入异常:', error);
    return false;
  }
}

/**
 * 清除所有配置
 */
export async function clearAllConfig(): Promise<void> {
  await clearEncryptedStorage();
}
