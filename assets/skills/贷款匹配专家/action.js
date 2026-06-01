// action.js - 火山引擎知识库 API 请求脚本
// ⚠️ 使用前请将 YOUR_VOLC_API_KEY 替换为你的真实 API Key

const API_BASE = 'http://api-knowledgebase.mlp.cn-beijing.volces.com';
const SERVICE_RESOURCE_ID = 'kb-service-5134a80c1adf0a2e';

/**
 * 搜索贷款产品（调用火山引擎知识库）
 * @param {string} query - 精炼的客户资质查询词
 * @returns {Promise<string>} JSON 字符串
 */
/**
 * 知识库连通性检查（轻量探测）
 * @param {string} apiKey - API Key
 * @returns {Promise<{ok: boolean, message: string}>}
 */
async function checkKnowledgeBase(apiKey = '1e0a1bff-f4ef-45d9-84a9-8f8d53b6a861') {
    const url = `${API_BASE}/api/knowledge/service/chat`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json;charset=UTF-8',
                'Host': 'api-knowledgebase.mlp.cn-beijing.volces.com',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                service_resource_id: SERVICE_RESOURCE_ID,
                messages: [{ role: "user", content: "ping" }],
                stream: false
            })
        });
        if (!response.ok) {
            return { ok: false, message: `知识库不可用，状态码: ${response.status}` };
        }
        return { ok: true, message: '知识库连接正常' };
    } catch (error) {
        return { ok: false, message: `知识库连接失败: ${error.message}` };
    }
}

async function searchLoanProducts(query, apiKey = '1e0a1bff-f4ef-45d9-84a9-8f8d53b6a861') {
    const url = `${API_BASE}/api/knowledge/service/chat`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json;charset=UTF-8',
                'Host': 'api-knowledgebase.mlp.cn-beijing.volces.com',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                service_resource_id: SERVICE_RESOURCE_ID,
                messages: [
                    {
                        role: "user",
                        content: query
                    }
                ],
                stream: false
            })
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            return JSON.stringify({
                error: `API 请求失败，状态码: ${response.status}`,
                detail: errText
            });
        }

        const data = await response.json();
        return JSON.stringify(data);
    } catch (error) {
        return JSON.stringify({ error: `执行动作出错: ${error.message}` });
    }
}

module.exports = { searchLoanProducts, checkKnowledgeBase };
