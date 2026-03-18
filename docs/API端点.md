# API 端点

> 温柔陪伴助手 - API 接口文档

---

## 📋 概述

本文档详细说明温柔陪伴助手使用的 API 端点，包括环境配置、认证、会话、FAQ 等接口。

---

## 🌍 环境配置

### 生产环境
```javascript
{
  streamPromptUrl: 'https://api.effiy.cn/prompt',
  promptUrl: 'https://api.effiy.cn/prompt/',
  yiaiBaseUrl: 'https://api.effiy.cn',
  faqApiUrl: 'https://api.effiy.cn'
}
```

### 测试环境
```javascript
{
  streamPromptUrl: 'https://staging.api.effiy.cn/prompt',
  promptUrl: 'https://staging.api.effiy.cn/prompt/',
  yiaiBaseUrl: 'https://staging.api.effiy.cn',
  faqApiUrl: 'https://staging.api.effiy.cn'
}
```

### 开发环境
```javascript
{
  streamPromptUrl: 'http://localhost:8000/prompt',
  promptUrl: 'http://localhost:8080/prompt/',
  yiaiBaseUrl: 'http://localhost:8000',
  faqApiUrl: 'http://localhost:8000'
}
```

---

## 🔗 基础端点

### API 基础路径
```javascript
const BASE_ENDPOINTS = {
  API_BASE: '/api',
  V1_BASE: '/api/v1',
  V2_BASE: '/api/v2'
}
```

---

## 🔐 认证端点

### 登录
- **端点**：`POST /auth/login`
- **描述**：用户登录认证
- **请求体**：
  ```javascript
  {
    username: '用户名',
    password: '密码'
  }
  ```
- **响应**：
  ```javascript
  {
    token: '认证令牌',
    user: {
      id: '用户ID',
      username: '用户名'
    }
  }
  ```

### 登出
- **端点**：`POST /auth/logout`
- **描述**：用户退出登录
- **认证**：需要 Bearer Token

### 刷新令牌
- **端点**：`POST /auth/refresh`
- **描述**：刷新过期的认证令牌
- **请求体**：
  ```javascript
  {
    refreshToken: '刷新令牌'
  }
  ```

### 获取用户信息
- **端点**：`GET /auth/profile`
- **描述**：获取当前登录用户信息
- **认证**：需要 Bearer Token

### 验证令牌
- **端点**：`POST /auth/validate`
- **描述**：验证认证令牌的有效性
- **请求体**：
  ```javascript
  {
    token: '待验证的令牌'
  }
  ```

---

## 📦 会话端点

### 获取会话列表
- **端点**：`GET /api/v1/sessions`
- **描述**：获取用户的所有会话列表
- **查询参数**：
  - `page`：页码（默认 1）
  - `limit`：每页数量（默认 20）
  - `tag`：按标签筛选
  - `search`：搜索关键词

### 创建会话
- **端点**：`POST /api/v1/sessions`
- **描述**：创建新的对话会话
- **请求体**：
  ```javascript
  {
    name: '会话名称',
    description: '会话描述',
    tags: ['标签1', '标签2'],
    role: '教师'
  }
  ```

### 更新会话
- **端点**：`PUT /api/v1/sessions/:id`
- **路径参数**：
  - `id`：会话 ID
- **描述**：更新指定会话的信息

### 删除会话
- **端点**：`DELETE /api/v1/sessions/:id`
- **路径参数**：
  - `id`：会话 ID
- **描述**：删除指定会话

### 批量删除会话
- **端点**：`POST /api/v1/sessions/batch`
- **描述**：批量删除多个会话
- **请求体**：
  ```javascript
  {
    ids: ['会话ID1', '会话ID2']
  }
  ```

### 搜索会话
- **端点**：`GET /api/v1/sessions/search`
- **描述**：按关键词搜索会话
- **查询参数**：
  - `q`：搜索关键词

### 获取收藏会话
- **端点**：`GET /api/v1/sessions/favorites`
- **描述**：获取用户收藏的会话列表

### 导出生成
- **端点**：`GET /api/v1/sessions/export`
- **描述**：导出会话数据
- **查询参数**：
  - `format`：导出格式（json, csv）
  - `ids`：指定会话 ID 列表（可选）

### 导入会话
- **端点**：`POST /api/v1/sessions/import`
- **描述**：导入会话数据
- **请求体**：
  ```javascript
  {
    sessions: [
      // 会话对象数组
    ]
  }
  ```

---

## ❓ FAQ 端点

### 获取 FAQ 列表
- **端点**：`GET /api/v1/faqs`
- **描述**：获取所有 FAQ 条目
- **查询参数**：
  - `page`：页码（默认 1）
  - `limit`：每页数量（默认 20）
  - `tag`：按标签筛选

### 创建 FAQ
- **端点**：`POST /api/v1/faqs`
- **描述**：创建新的 FAQ 条目
- **请求体**：
  ```javascript
  {
    question: '问题内容',
    answer: '答案内容',
    tags: ['标签1', '标签2'],
    isFavorite: false
  }
  ```

### 更新 FAQ
- **端点**：`PUT /api/v1/faqs/:id`
- **路径参数**：
  - `id`：FAQ ID
- **描述**：更新指定 FAQ 条目

### 删除 FAQ
- **端点**：`DELETE /api/v1/faqs/:id`
- **路径参数**：
  - `id`：FAQ ID
- **描述**：删除指定 FAQ 条目

### 批量更新 FAQ
- **端点**：`PUT /api/v1/faqs/batch`
- **描述**：批量更新多个 FAQ 条目
- **请求体**：
  ```javascript
  {
    faqs: [
      // FAQ 对象数组
    ]
  }
  ```

### 重排 FAQ
- **端点**：`POST /api/v1/faqs/reorder`
- **描述**：重新排序 FAQ 条目
- **请求体**：
  ```javascript
  {
    order: ['faqId1', 'faqId2', 'faqId3']
  }
  ```

---

## ⚙️ 配置端点

### 获取配置
- **端点**：`GET /api/v1/config`
- **描述**：获取当前用户配置
- **认证**：需要 Bearer Token

### 更新配置
- **端点**：`PUT /api/v1/config`
- **描述**：更新用户配置
- **请求体**：
  ```javascript
  {
    theme: 'dark',
    language: 'zh-CN',
    aiSettings: {
      model: 'gpt-4',
      temperature: 0.7
    }
  }
  ```

### 重置配置
- **端点**：`POST /api/v1/config/reset`
- **描述**：重置用户配置为默认值

---

## 🤖 AI 对话端点

### 非流式对话
- **端点**：`POST /prompt/`
- **描述**：发送 AI 对话请求（非流式）
- **请求体**：
  ```javascript
  {
    prompt: '用户输入',
    sessionId: '会话ID',
    role: '教师',
    model: 'gpt-4',
    temperature: 0.7
  }
  ```

### 流式对话
- **端点**：`POST /prompt`
- **描述**：发送 AI 对话请求（流式响应）
- **请求体**：
  ```javascript
  {
    prompt: '用户输入',
    sessionId: '会话ID',
    role: '教师',
    model: 'gpt-4',
    temperature: 0.7,
    stream: true
  }
  ```
- **响应**：Server-Sent Events (SSE) 流式响应

---

## 🛠️ 工具函数

### 构建 URL
```javascript
function buildUrl(baseUrl, endpoint, params = {}) {
  let url = endpoint;

  // 替换路径参数
  Object.entries(params).forEach(([key, value]) => {
    url = url.replace(`:${key}`, encodeURIComponent(value));
  });

  // 如果是相对路径，添加基础 URL
  if (!url.startsWith('http') && baseUrl) {
    url = `${baseUrl.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
  }

  return url;
}
```

### 构建查询参数
```javascript
function buildQueryParams(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (typeof value === 'object') {
        searchParams.append(key, JSON.stringify(value));
      } else {
        searchParams.append(key, String(value));
      }
    }
  });

  return searchParams.toString();
}
```

### 使用示例
```javascript
// 构建会话详情 URL
const sessionUrl = buildUrl(
  'https://api.effiy.cn/api/v1',
  '/sessions/:id',
  { id: '12345' }
);
// 结果: https://api.effiy.cn/api/v1/sessions/12345

// 构建带查询参数的 URL
const sessionsUrl = buildUrl(
  'https://api.effiy.cn/api/v1',
  '/sessions'
);
const queryParams = buildQueryParams({
  page: 1,
  limit: 20,
  tag: '学习'
});
const fullUrl = `${sessionsUrl}?${queryParams}`;
```

---

## 🔒 认证方式

### Bearer Token
```javascript
// 在请求头中添加认证令牌
headers: {
  'Authorization': 'Bearer your-access-token',
  'Content-Type': 'application/json'
}
```

---

## ⚠️ 错误响应

### 通用错误格式
```javascript
{
  error: {
    code: 'ERROR_CODE',
    message: '错误描述',
    details: '详细信息'
  }
}
```

### 常见错误码
| 错误码 | 说明 |
|--------|------|
| `400` | 请求参数错误 |
| `401` | 未授权，需要登录 |
| `403` | 权限不足 |
| `404` | 资源不存在 |
| `500` | 服务器内部错误 |

---

## 📚 相关文档

- **[配置指南](./配置指南.md)** - 环境配置说明
- **[目录结构](./目录结构.md)** - 项目目录结构
- **[架构设计](./架构设计.md)** - 项目架构设计

---

*最后更新：2026-03-18*
