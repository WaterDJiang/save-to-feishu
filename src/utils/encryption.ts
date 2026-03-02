/**
 * 加密工具模块
 * 使用 Web Crypto API 进行 AES-GCM 加密/解密
 */

const STORAGE_KEY_SALT = 'save_to_feishu_salt';
const STORAGE_KEY_DATA = 'save_to_feishu_encrypted';

/**
 * 获取或生成设备 salt (新版：存储在 chrome.storage.local)
 */
async function getSalt(): Promise<string> {
  const result = await chrome.storage.local.get(STORAGE_KEY_SALT);
  let salt = result[STORAGE_KEY_SALT];
  if (!salt) {
    // 尝试从旧版迁移 salt (仅在有 localStorage 的环境中)
    let legacySalt = '';
    if (typeof localStorage !== 'undefined') {
      legacySalt = localStorage.getItem(STORAGE_KEY_SALT) || '';
    }

    if (legacySalt) {
      salt = legacySalt;
    } else {
      const buf = new Uint8Array(16);
      crypto.getRandomValues(buf);
      salt = Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    await chrome.storage.local.set({ [STORAGE_KEY_SALT]: salt });
  }
  return salt;
}

/**
 * 获取旧版 salt (仅用于迁移)
 */
function getSaltLegacy(): string {
  // Service Worker (Background) 环境下没有 localStorage，无法读取旧版 salt
  if (typeof localStorage === 'undefined') {
    return '';
  }
  return localStorage.getItem(STORAGE_KEY_SALT) || '';
}

/**
 * 从用户代理等信息派生加密密钥 (新版：无环境依赖)
 */
async function deriveKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  // 移除环境依赖，只使用 salt，确保跨环境（Popup/Options/Background）一致性
  const salt = await getSalt();
  const base = salt;
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(base),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: 120000,
      salt: encoder.encode('save_to_feishu_v1'),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * 从用户代理等信息派生加密密钥 (旧版：有环境依赖)
 */
async function deriveKeyLegacy(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const salt = getSaltLegacy();
  if (!salt) throw new Error('No legacy salt found');

  const base = `${navigator.userAgent}|${navigator.language}|${navigator.platform}|${salt}`;
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(base),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: 120000,
      salt: encoder.encode('save_to_feishu_v1'),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * 加密数据
 * @param data 要加密的数据对象
 * @returns 加密后的字符串
 */
export async function encryptData(data: object): Promise<string> {
  const encoder = new TextEncoder();
  const key = await deriveKey();
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(JSON.stringify(data))
  );
  
  const blob = {
    v: 1,
    iv: btoa(String.fromCharCode(...iv)),
    data: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
  };
  
  return JSON.stringify(blob);
}

/**
 * 解密数据 (尝试使用新版密钥)
 * @param encryptedString 加密后的字符串
 * @returns 解密后的对象
 */
export async function decryptData(encryptedString: string): Promise<object | null> {
  try {
    const decoder = new TextDecoder();
    const key = await deriveKey();
    const blob = JSON.parse(encryptedString);
    
    if (!blob || blob.v !== 1 || !blob.iv || !blob.data) {
      return null;
    }
    
    const iv = Uint8Array.from(atob(blob.iv), c => c.charCodeAt(0));
    const data = Uint8Array.from(atob(blob.data), c => c.charCodeAt(0));
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    
    return JSON.parse(decoder.decode(decrypted));
  } catch {
    return null;
  }
}

/**
 * 解密数据 (尝试使用旧版密钥)
 */
async function decryptDataLegacy(encryptedString: string): Promise<object | null> {
  try {
    const decoder = new TextDecoder();
    const key = await deriveKeyLegacy();
    const blob = JSON.parse(encryptedString);
    
    if (!blob || blob.v !== 1 || !blob.iv || !blob.data) {
      return null;
    }
    
    const iv = Uint8Array.from(atob(blob.iv), c => c.charCodeAt(0));
    const data = Uint8Array.from(atob(blob.data), c => c.charCodeAt(0));
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    
    return JSON.parse(decoder.decode(decrypted));
  } catch {
    return null;
  }
}

/**
 * 保存加密数据到 chrome.storage.local
 */
export async function saveEncryptedToStorage(data: object): Promise<void> {
  const encrypted = await encryptData(data);
  await chrome.storage.local.set({ [STORAGE_KEY_DATA]: encrypted });
}

/**
 * 从 chrome.storage.local 读取并解密数据
 * 包含自动迁移逻辑：如果新版解密失败，尝试旧版解密并重新保存
 */
export async function loadEncryptedFromStorage(): Promise<object | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY_DATA);
  const encrypted = result[STORAGE_KEY_DATA];
  if (!encrypted) return null;

  // 1. 尝试使用新版逻辑解密
  const data = await decryptData(encrypted);
  if (data) return data;

  // 2. 尝试使用旧版逻辑解密 (用于迁移)
  console.log('Attempting to migrate legacy configuration...');
  const legacyData = await decryptDataLegacy(encrypted);
  if (legacyData) {
    console.log('Migration successful, re-encrypting with new key...');
    await saveEncryptedToStorage(legacyData);
    return legacyData;
  }

  return null;
}

/**
 * 清除存储的加密数据
 */
export async function clearEncryptedStorage(): Promise<void> {
  await chrome.storage.local.remove([STORAGE_KEY_DATA, STORAGE_KEY_SALT]);
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY_SALT);
  }
}
