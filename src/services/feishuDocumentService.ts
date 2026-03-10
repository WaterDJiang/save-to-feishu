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
 * 等待指定时间
 * @param ms 毫秒
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 并发执行任务（带并发限制）
 * @param items 待处理列表
 * @param limit 并发数
 * @param handler 处理函数
 */
async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  handler: (item: T, index: number) => Promise<void>
): Promise<void> {
  const queue = items.map((item, index) => ({ item, index }));
  const workers = Array.from({ length: Math.max(1, limit) }).map(async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) break;
      await handler(next.item, next.index);
    }
  });
  await Promise.all(workers);
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
 * 从 URL 下载图片为 Blob
 * @param imageUrl 图片 URL
 * @returns Blob 或 null
 */
async function downloadImageAsBlob(imageUrl: string): Promise<Blob | null> {
  try {
    const response = await fetch(imageUrl, {
      mode: 'cors',
      credentials: 'omit',
    });

    if (!response.ok) {
      console.log('[FeishuDoc] 下载图片失败，HTTP状态:', response.status);
      return null;
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      console.log('[FeishuDoc] 下载内容不是图片，content-type:', contentType);
      return null;
    }

    const blob = await response.blob();
    console.log('[FeishuDoc] 图片下载成功，大小:', blob.size, '类型:', contentType);
    return blob;
  } catch (error) {
    console.log('[FeishuDoc] 下载图片异常:', error);
    return null;
  }
}

/**
 * 将图片上传到飞书文档（三步流程）
 * 1. 创建空白图片块
 * 2. 上传图片素材
 * 3. 更新图片块
 * @param documentId 文档ID
 * @param parentBlockId 父块ID
 * @param imageUrl 图片URL
 * @returns 是否成功
 */
export async function uploadImageToDocument(
  documentId: string,
  parentBlockId: string,
  imageUrl: string,
  imageBlockId?: string
): Promise<boolean> {
  try {
    console.log('[FeishuDoc] 开始三步上传图片...', { imageUrl: imageUrl.substring(0, 30) + '...' });

    // Step 1: 下载图片
    const blob = await downloadImageAsBlob(imageUrl);
    if (!blob) {
      console.error('[FeishuDoc] 图片下载失败');
      return false;
    }

    const ext = blob.type.split('/')[1] || 'jpg';
    const fileName = `image_${Date.now()}.${ext}`;

    const headers = await getAuthHeaders();
    if (!headers) {
      console.error('[FeishuDoc] 无法获取认证 Token');
      return false;
    }

    let targetBlockId = imageBlockId;
    if (!targetBlockId) {
      console.log('[FeishuDoc] Step 1: 创建空白图片块');
      const createBlockResponse = await fetch(
        `${LARK_API_BASE}/docx/v1/documents/${documentId}/blocks/${parentBlockId}/children`,
        {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            children: [
              {
                block_type: BlockType.DOCX_IMAGE,
                image: {}
              }
            ]
          }),
        }
      );

      const createBlockText = await createBlockResponse.text();
      console.log('[FeishuDoc] 创建图片块响应:', createBlockText);

      if (!createBlockResponse.ok) {
        console.error('[FeishuDoc] 创建图片块失败，HTTP:', createBlockResponse.status);
        return false;
      }

      const createBlockData = JSON.parse(createBlockText);
      if (createBlockData.code !== 0) {
        console.error('[FeishuDoc] 创建图片块失败:', createBlockData.msg);
        return false;
      }

      const imageBlock = createBlockData.data?.children?.[0];
      if (!imageBlock) {
        console.error('[FeishuDoc] 未获取到图片块信息');
        return false;
      }

      targetBlockId = imageBlock.block_id;
      console.log('[FeishuDoc] 图片块创建成功，block_id:', targetBlockId);
    }

    // Step 3: 上传图片素材
    console.log('[FeishuDoc] Step 2: 上传图片素材');

    if (!targetBlockId) {
      console.error('[FeishuDoc] 图片块ID为空');
      return false;
    }

    const formData = new FormData();
    formData.append('file_name', fileName);
    formData.append('parent_type', 'docx_image');  // 指定为文档图片
    formData.append('parent_node', targetBlockId);
    formData.append('size', String(blob.size));     // 文件大小（必需）
    formData.append('file', blob, fileName);

    const uploadResponse = await fetch(`${LARK_API_BASE}/drive/v1/medias/upload_all`, {
      method: 'POST',
      headers: {
        Authorization: (headers as Record<string, string>)['Authorization'],
      },
      body: formData,
    });

    const uploadText = await uploadResponse.text();
    console.log('[FeishuDoc] 上传素材响应:', uploadText);

    if (!uploadResponse.ok) {
      console.error('[FeishuDoc] 上传素材失败，HTTP:', uploadResponse.status);
      // 即使上传失败也尝试删除创建的空块
      return false;
    }

    const uploadData = JSON.parse(uploadText);
    if (uploadData.code !== 0) {
      console.error('[FeishuDoc] 上传素材失败:', uploadData.msg);
      return false;
    }

    const fileToken = uploadData.data?.file_token;
    console.log('[FeishuDoc] 素材上传成功，token:', fileToken);

    // Step 4: 更新图片块
    console.log('[FeishuDoc] Step 3: 更新图片块');

    const updateResponse = await fetch(
      `${LARK_API_BASE}/docx/v1/documents/${documentId}/blocks/${targetBlockId}`,
      {
        method: 'PATCH',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          replace_image: {
            token: fileToken
          }
        }),
      }
    );

    const updateText = await updateResponse.text();
    console.log('[FeishuDoc] 更新图片块响应:', updateText);

    if (!updateResponse.ok) {
      console.error('[FeishuDoc] 更新图片块失败，HTTP:', updateResponse.status);
      return false;
    }

    const updateData = JSON.parse(updateText);
    if (updateData.code !== 0) {
      console.error('[FeishuDoc] 更新图片块失败:', updateData.msg);
      return false;
    }

    console.log('[FeishuDoc] ✅ 图片上传并嵌入成功!');
    return true;
  } catch (error) {
    console.error('[FeishuDoc] 图片上传异常:', error);
    return false;
  }
}

/**
 * 上传图片到飞书云盘（使用 drive/v1/medias/upload_all API）
 * @deprecated 使用 uploadImageToDocument 替代
 */
export async function uploadImageToFeishu(_imageData: string | Blob, _fileName: string): Promise<string | null> {
  return null; // 不再使用这种方式
}

/**
 * 向文档添加块（带重试机制）
 * @param documentId 文档ID
 * @param blockId 父块ID（page块的ID）
 * @param blocks 要添加的块数组
 * @returns 是否成功
 */
async function addBlocksToDocument(
  documentId: string,
  blockId: string,
  blocks: DocBlock[],
  collectedBlockIds?: string[]
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

      // 带重试机制的请求
      let retries = 3;
      let delay = 1000;
      let lastError: Error | null = null;

      while (retries > 0) {
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
          // 429 Too Many Requests - 需要等待后重试
          if (response.status === 429) {
            retries--;
            if (retries > 0) {
              console.log('[FeishuDoc] ⚠️ 请求过于频繁，等待', delay, 'ms 后重试...');
              await new Promise(resolve => setTimeout(resolve, delay));
              delay *= 2; // 指数退避
              continue;
            }
          }
          console.error('[FeishuDoc] 添加块失败，HTTP状态:', response.status);
          lastError = new Error(`HTTP ${response.status}`);
          break;
        }

        const data = JSON.parse(responseText) as FeishuDocApiResponse<{ children?: Array<{ block_id?: string }> }>;

        if (data.code !== 0) {
          // 429 错误码也需要重试
          if (data.code === 1254043) { // 429 错误码
            retries--;
            if (retries > 0) {
              console.log('[FeishuDoc] ⚠️ 请求过于频繁（错误码1254043），等待', delay, 'ms 后重试...');
              await new Promise(resolve => setTimeout(resolve, delay));
              delay *= 2;
              continue;
            }
          }
          console.error('[FeishuDoc] 添加块失败:', data.msg, '(错误码:', data.code, ')');
          console.error('[FeishuDoc] 完整错误:', JSON.stringify(data, null, 2));
          lastError = new Error(data.msg);
          break;
        }

        const createdIds = data.data?.children?.map(child => child.block_id).filter((id): id is string => Boolean(id)) || [];
        if (createdIds.length > 0 && collectedBlockIds) {
          collectedBlockIds.push(...createdIds);
        }

        console.log('[FeishuDoc] 块添加成功');
        break;
      }

      if (retries === 0 && lastError) {
        console.error('[FeishuDoc] ❌ 添加块重试次数用尽');
        return false;
      }

      // 每批次之间添加延迟，避免触发频率限制
      if (i + batchSize < blocks.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
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

    // 收集图片 URLs
    const imageUrls = elements
      .filter(el => el.type === 'image' && el.imageUrl)
      .map(el => el.imageUrl!);
    console.log('[FeishuDoc] 发现', imageUrls.length, '张图片');

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

    // 转换元素为块（按原始顺序）
    const imageBlockIndexes: { index: number; imageUrl: string }[] = [];
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (el.type === 'image') {
        // 记录图片块的位置，用于后续上传
        imageBlockIndexes.push({ index: blocks.length, imageUrl: el.imageUrl! });
        // 在当前位置添加空图片块（token 会在后续步骤更新）
        blocks.push({
          block_type: BlockType.DOCX_IMAGE,
          image: {
            token: ''
          }
        });
      } else if (el.type === 'heading') {
        const block: DocBlock = {
          block_type: el.level === 1 ? BlockType.HEADING1 : el.level === 2 ? BlockType.HEADING2 : BlockType.HEADING3,
        };
        const textContent: TextBlockContent = {
          elements: createTextElements(el.content || ''),
        };
        if (el.level === 1) block.heading1 = textContent;
        else if (el.level === 2) block.heading2 = textContent;
        else block.heading3 = textContent;
        blocks.push(block);
      } else if (el.type === 'text') {
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
    const createdBlockIds: string[] = [];
    const success = await addBlocksToDocument(doc.document_id, pageBlockId, blocks, createdBlockIds);

    if (!success) {
      console.error('[FeishuDoc] ❌ 写入文档块失败');
      return doc; // 仍然返回文档，只是内容写入失败
    }

    // 处理图片上传（三步流程）
    console.log('[FeishuDoc] 步骤5: 上传图片...');
    let successCount = 0;
    await runWithConcurrency(imageBlockIndexes, 2, async (imgInfo, index) => {
      if (!imgInfo.imageUrl) return;
      if (index > 0) {
        await sleep(200);
      }
      const targetBlockId = createdBlockIds[imgInfo.index];
      if (!targetBlockId) {
        await addBlocksToDocument(doc.document_id, doc.document_id, [{
          block_type: BlockType.TEXT,
          text: {
            elements: createTextElements('[图片]', imgInfo.imageUrl),
          },
        }]);
        return;
      }
      const uploaded = await uploadImageToDocument(
        doc.document_id,
        doc.document_id,
        imgInfo.imageUrl,
        targetBlockId
      );
      if (uploaded) {
        successCount++;
        console.log('[FeishuDoc] 图片上传成功:', imgInfo.imageUrl.substring(0, 30) + '...');
      } else {
        console.log('[FeishuDoc] 图片上传失败，回退到链接:', imgInfo.imageUrl.substring(0, 30) + '...');
        await addBlocksToDocument(doc.document_id, doc.document_id, [{
          block_type: BlockType.TEXT,
          text: {
            elements: createTextElements('[图片]', imgInfo.imageUrl),
          },
        }]);
      }
    });
    console.log('[FeishuDoc] 图片处理完成，成功', successCount, '/', imageBlockIndexes.length, '张');

    console.log('[FeishuDoc] ========== 文档创建完成 ==========');
    console.log('[FeishuDoc] 文档URL:', doc.url);
    return doc;
  } catch (error) {
    console.error('[FeishuDoc] ❌ 创建文档异常:', error);
    return null;
  }
}
