import type { DocBlock, FeishuDocument, ExtractedPageContent, TextBlockContent, HtmlElementInfo } from '@/types';
import { BlockType } from '@/types';
import { getAuthHeaders } from './feishuService';

const LARK_API_BASE = 'https://open.feishu.cn/open-apis';

/**
 * 飞书文档API响应基础结构
 */
interface FeishuDocApiResponse<T = unknown> {
  code: number;
  msg: string;
  data?: T;
}

/**
 * 创建文档响应
 */
interface CreateDocResponse {
  document: {
    document_id: string;
  };
}

/**
 * 获取文档响应
 */
interface GetDocResponse {
  document: {
    document_id: string;
    title: string;
    url?: string;
    revision_id?: string;
  };
}

/**
 * 上传文件响应
 */
interface UploadFileResponse {
  file: {
    file_token: string;
  };
}

/**
 * 创建飞书文档
 * @param title 文档标题
 * @returns 文档信息
 */
export async function createFeishuDocument(title: string): Promise<FeishuDocument | null> {
  try {
    console.log('[FeishuDoc] 正在创建文档...', { title });
    
    const headers = await getAuthHeaders();
    if (!headers) {
      console.error('[FeishuDoc] 无法获取认证 Token');
      return null;
    }

    const response = await fetch(`${LARK_API_BASE}/docx/v1/documents`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[FeishuDoc] 创建文档失败，HTTP状态:', response.status, errorText);
      return null;
    }

    const data = await response.json() as FeishuDocApiResponse<CreateDocResponse>;
    
    if (data.code !== 0) {
      console.error('[FeishuDoc] 创建文档失败:', data.msg, '(错误码:', data.code, ')');
      console.error('[FeishuDoc] 完整响应:', JSON.stringify(data, null, 2));
      return null;
    }

    const documentId = data.data?.document?.document_id;
    if (!documentId) {
      console.error('[FeishuDoc] 文档ID为空，响应:', JSON.stringify(data, null, 2));
      return null;
    }

    console.log('[FeishuDoc] 文档创建成功，ID:', documentId);
    console.log('[FeishuDoc] 完整响应:', JSON.stringify(data, null, 2));

    // 获取文档URL
    const docInfo = await getDocumentInfo(documentId);
    if (!docInfo) {
      console.error('[FeishuDoc] 无法获取文档信息');
      return null;
    }

    return docInfo;
  } catch (error) {
    console.error('[FeishuDoc] 创建文档异常:', error);
    return null;
  }
}

/**
 * 获取文档信息
 * @param documentId 文档ID
 * @returns 文档信息
 */
async function getDocumentInfo(documentId: string): Promise<FeishuDocument | null> {
  try {
    const headers = await getAuthHeaders();
    if (!headers) return null;

    const response = await fetch(`${LARK_API_BASE}/docx/v1/documents/${documentId}`, {
      headers,
    });

    if (!response.ok) {
      console.error('[FeishuDoc] 获取文档信息失败，HTTP状态:', response.status);
      return null;
    }

    const data = await response.json() as FeishuDocApiResponse<GetDocResponse>;
    
    if (data.code !== 0) {
      console.error('[FeishuDoc] 获取文档信息失败:', data.msg);
      return null;
    }

    // 如果API返回了URL，直接使用；否则根据document_id构建URL
    const url = data.data?.document?.url || `https://feishu.cn/docx/${documentId}`;

    console.log('[FeishuDoc] 文档URL:', url);
    console.log('[FeishuDoc] 文档信息响应:', JSON.stringify(data.data, null, 2));

    return {
      document_id: documentId,
      title: data.data?.document?.title || '',
      url,
    };
  } catch (error) {
    console.error('[FeishuDoc] 获取文档信息异常:', error);
    return null;
  }
}

/**
 * 上传图片到飞书
 * @param imageData 图片数据（base64或Blob）
 * @param fileName 文件名
 * @returns file_token
 */
export async function uploadImageToFeishu(imageData: string | Blob, fileName: string): Promise<string | null> {
  try {
    console.log('[FeishuDoc] 正在上传图片...', { fileName });

    const headers = await getAuthHeaders();
    if (!headers) {
      console.error('[FeishuDoc] 无法获取认证 Token');
      return null;
    }

    let blob: Blob;

    if (typeof imageData === 'string') {
      // Base64格式
      const base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData;
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      blob = new Blob([bytes], { type: 'image/jpeg' });
    } else {
      // Blob格式
      blob = imageData;
    }

    // 飞书上传 API 需要使用 multipart/form-data 格式
    const formData = new FormData();
    formData.append('file_name', fileName);
    formData.append('parent_type', 'docx_image'); // 文档图片类型
    formData.append('size', String(blob.size));
    formData.append('file', blob, fileName);

    const response = await fetch(`${LARK_API_BASE}/drive/v1/medias/upload_all`, {
      method: 'POST',
      headers: {
        Authorization: (headers as Record<string, string>)['Authorization'],
        // 不要设置 Content-Type，让浏览器自动设置 multipart/form-data 边界
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[FeishuDoc] 上传图片失败，HTTP状态:', response.status, errorText);
      return null;
    }

    const data = await response.json() as FeishuDocApiResponse<UploadFileResponse>;

    if (data.code !== 0) {
      console.error('[FeishuDoc] 上传图片失败:', data.msg, '(错误码:', data.code, ')');
      return null;
    }

    const fileToken = data.data?.file?.file_token;
    console.log('[FeishuDoc] 图片上传成功，file_token:', fileToken);

    return fileToken || null;
  } catch (error) {
    console.error('[FeishuDoc] 上传图片异常:', error);
    return null;
  }
}

/**
 * 向文档添加块
 * @param documentId 文档ID
 * @param blockId 父块ID（page块的ID）
 * @param blocks 要添加的块数组
 * @returns 是否成功
 */
async function addBlocksToDocument(
  documentId: string,
  blockId: string,
  blocks: DocBlock[]
): Promise<boolean> {
  try {
    console.log('[FeishuDoc] 正在添加块到文档...', { documentId, blockId, blockCount: blocks.length });

    const headers = await getAuthHeaders();
    if (!headers) {
      console.error('[FeishuDoc] 无法获取认证 Token');
      return false;
    }

    // 飞书文档API一次最多添加10个块，需要分批处理
    const batchSize = 10;
    for (let i = 0; i < blocks.length; i += batchSize) {
      const batch = blocks.slice(i, i + batchSize);

      // 打印请求体以便调试
      const requestBody = {
        children: batch,
      };
      console.log('[FeishuDoc] 请求体:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(`${LARK_API_BASE}/docx/v1/documents/${documentId}/blocks/${blockId}/children`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const responseText = await response.text();
      console.log('[FeishuDoc] API 响应:', responseText);

      if (!response.ok) {
        console.error('[FeishuDoc] 添加块失败，HTTP状态:', response.status);
        return false;
      }

      const data = JSON.parse(responseText) as FeishuDocApiResponse<unknown>;

      if (data.code !== 0) {
        console.error('[FeishuDoc] 添加块失败:', data.msg, '(错误码:', data.code, ')');
        console.error('[FeishuDoc] 完整错误:', JSON.stringify(data, null, 2));
        return false;
      }
    }

    console.log('[FeishuDoc] 块添加成功');
    return true;
  } catch (error) {
    console.error('[FeishuDoc] 添加块异常:', error);
    return false;
  }
}

/**
 * 创建文档并使用提取的元素填充内容
 * @param content 页面元数据
 * @param elements HTML元素信息
 * @returns 文档信息或null
 */
export async function createDocumentWithElements(
  content: ExtractedPageContent,
  elements: HtmlElementInfo[]
): Promise<FeishuDocument | null> {
  try {
    console.log('[FeishuDoc] ========== 开始创建文档 ==========');
    console.log('[FeishuDoc] 标题:', content.title);
    console.log('[FeishuDoc] 元素数量:', elements.length);

    // 创建文档
    console.log('[FeishuDoc] 步骤1: 创建空白文档...');
    const doc = await createFeishuDocument(content.title || '未命名文档');
    if (!doc) {
      console.error('[FeishuDoc] ❌ 创建文档失败');
      return null;
    }
    console.log('[FeishuDoc] ✅ 文档创建成功:', doc.document_id, doc.url);

    // 收集图片URL（暂时只记录，不上传）
    const imageUrls = elements
      .filter(el => el.type === 'image' && el.imageUrl)
      .map(el => el.imageUrl!);
    console.log('[FeishuDoc] 发现', imageUrls.length, '张图片（暂时跳过上传）');

    // 转换为文档块
    console.log('[FeishuDoc] 步骤3: 生成文档块...');
    const blocks: DocBlock[] = [];

    // 辅助函数：创建文本元素
    const createTextElements = (text: string, linkUrl?: string): TextBlockContent['elements'] => {
      return [{
        text_run: {
          content: text,
          ...(linkUrl ? { text_element_style: { link: { url: linkUrl } } } : {})
        }
      }];
    };

    // 添加来源链接作为第一个块
    blocks.push({
      block_type: BlockType.TEXT,
      text: {
        elements: [
          {
            text_run: {
              content: '来源: ',
            },
          },
          {
            text_run: {
              content: content.url,
              text_element_style: {
                link: { url: content.url },
              },
            },
          }
        ],
      },
    });

    // 添加标题
    if (content.title) {
      blocks.push({
        block_type: BlockType.HEADING1,
        heading1: {
          elements: createTextElements(content.title),
        },
      });
    }

    // 转换元素为块
    for (const el of elements) {
      if (el.type === 'image') {
        // 暂时将图片转为带链接的文本
        blocks.push({
          block_type: BlockType.TEXT,
          text: {
            elements: createTextElements('[图片]', el.imageUrl),
          },
        });
      } else if (el.type === 'heading') {
        const block: DocBlock = {
          block_type: el.level === 1 ? BlockType.HEADING1 : el.level === 2 ? BlockType.HEADING2 : BlockType.HEADING3,
        };
        const textContent: TextBlockContent = {
          elements: createTextElements(el.content || ''),
        };
        // 根据标题级别设置正确的属性
        if (el.level === 1) block.heading1 = textContent;
        else if (el.level === 2) block.heading2 = textContent;
        else block.heading3 = textContent;
        blocks.push(block);
      } else if (el.type === 'text') {
        // 避免重复添加来源信息
        if (el.content && !el.content.startsWith('来源:')) {
          blocks.push({
            block_type: BlockType.TEXT,
            text: {
              elements: createTextElements(el.content),
            },
          });
        }
      } else if (el.type === 'list') {
        const isOrdered = el.listType === 'ordered';
        blocks.push({
          block_type: isOrdered ? BlockType.ORDERED : BlockType.BULLET,
          ...(isOrdered
            ? { ordered: { elements: createTextElements(el.content || '') } }
            : { bullet: { elements: createTextElements(el.content || '') } }
          ),
        });
      } else if (el.type === 'link') {
        blocks.push({
          block_type: BlockType.TEXT,
          text: {
            elements: createTextElements(el.content || '', el.linkUrl),
          },
        });
      }
    }

    console.log('[FeishuDoc] ✅ 生成了', blocks.length, '个文档块');

    if (blocks.length === 0) {
      console.warn('[FeishuDoc] ⚠️ 没有生成任何块');
      return doc; // 返回空文档
    }

    // 添加块到文档
    console.log('[FeishuDoc] 步骤4: 将块写入文档...');
    const pageBlockId = doc.document_id;
    const success = await addBlocksToDocument(doc.document_id, pageBlockId, blocks);

    if (!success) {
      console.error('[FeishuDoc] ❌ 写入文档块失败');
      return doc; // 仍然返回文档，只是内容写入失败
    }

    console.log('[FeishuDoc] ========== 文档创建完成 ==========');
    console.log('[FeishuDoc] 文档URL:', doc.url);
    return doc;
  } catch (error) {
    console.error('[FeishuDoc] ❌ 创建文档异常:', error);
    return null;
  }
}