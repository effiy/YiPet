# API 文档规范

> 温柔陪伴助手 - API 文档编写规范

---

## 概述

本规范定义了温柔陪伴助手项目的 API 文档编写标准和格式要求，确保 API 文档清晰、准确、完整，便于开发者理解和使用。

---

## API 文档结构

### 1. 文档标题

```markdown
# [API 名称] API

> API 简短描述
```

### 2. 目录结构

```markdown
- [概述](#概述)
- [认证](#认证)
- [端点列表](#端点列表)
- [错误处理](#错误处理)
- [使用示例](#使用示例)
- [相关文档](#相关文档)
```

---

## API 端点文档格式

### 端点信息

```markdown
## [HTTP 方法] [端点路径]

> 简短描述

**认证方式**：[Bearer Token / API Key / 无]

**请求参数**：
| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| id | string | 是 | 会话 ID |

**请求示例**：
```javascript
const response = await fetch('/api/sessions/123', {
    method: 'GET',
    headers: {
        'Authorization': 'Bearer token123'
    }
});
```

**响应参数**：
| 参数名 | 类型 | 描述 |
|--------|------|------|
| id | string | 会话 ID |
| title | string | 会话标题 |

**响应示例**：
```json
{
    "id": "123",
    "title": "我的会话",
    "createdAt": "2026-03-18T10:00:00Z"
}
```

**错误**：
| HTTP 状态码 | 错误码 | 描述 |
|------------|--------|------|
| 404 | NOT_FOUND | 会话不存在 |
| 401 | UNAUTHORIZED | 认证失败 |
```

---

## 端点分类

### 1. 会话 API

#### 创建会话
```markdown
## POST /api/sessions

> 创建一个新的会话
```

#### 获取会话
```markdown
## GET /api/sessions/:id

> 获取指定会话的详情
```

#### 更新会话
```markdown
## PUT /api/sessions/:id

> 更新指定会话的信息
```

#### 删除会话
```markdown
## DELETE /api/sessions/:id

> 删除指定会话
```

#### 会话列表
```markdown
## GET /api/sessions

> 获取会话列表
```

### 2. FAQ API

#### 创建 FAQ
```markdown
## POST /api/faqs

> 创建一个新的 FAQ
```

#### 获取 FAQ
```markdown
## GET /api/faqs/:id

> 获取指定 FAQ 的详情
```

#### 更新 FAQ
```markdown
## PUT /api/faqs/:id

> 更新指定 FAQ 的信息
```

#### 删除 FAQ
```markdown
## DELETE /api/faqs/:id

> 删除指定 FAQ
```

#### FAQ 列表
```markdown
## GET /api/faqs

> 获取 FAQ 列表
```

### 3. AI 聊天 API

#### 发送消息
```markdown
## POST /api/prompt

> 发送 AI 聊天消息
```

---

## 认证说明

### Bearer Token 认证

```markdown
## 认证

所有 API 端点（除公开端点外）都需要 Bearer Token 认证。

**获取 Token**：
1. 在扩展设置中配置 API Token
2. 或通过登录流程获取

**使用 Token**：
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" https://api.effiy.cn/api/sessions
```
```

### API Key 认证

```markdown
## 认证

使用 API Key 进行认证，在请求头中传递：

```bash
curl -H "X-API-Key: YOUR_API_KEY" https://api.effiy.cn/api/sessions
```
```

---

## 错误处理

### 错误响应格式

```markdown
## 错误处理

所有错误响应都采用统一格式：

```json
{
    "error": {
        "code": "ERROR_CODE",
        "message": "错误描述",
        "details": {
            // 可选，详细错误信息
        }
    }
}
```

**常见错误码**：
| 错误码 | HTTP 状态码 | 描述 |
|--------|------------|------|
| BAD_REQUEST | 400 | 请求参数错误 |
| UNAUTHORIZED | 401 | 认证失败 |
| FORBIDDEN | 403 | 权限不足 |
| NOT_FOUND | 404 | 资源不存在 |
| INTERNAL_ERROR | 500 | 服务器内部错误 |
```

---

## 使用示例

### JavaScript 示例

```javascript
// 使用 fetch API 调用会话接口
const apiClient = {
    baseUrl: 'https://api.effiy.cn',

    async getSessions(token) {
        const response = await fetch(`${this.baseUrl}/api/sessions`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.json();
    },

    async createSession(token, data) {
        const response = await fetch(`${this.baseUrl}/api/sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        return response.json();
    }
};
```

### cURL 示例

```bash
# 获取会话列表
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.effiy.cn/api/sessions

# 创建新会话
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"title": "新会话"}' \
  https://api.effiy.cn/api/sessions
```

---

## 最佳实践

1. **文档完整**：确保每个端点都有完整的文档
2. **示例准确**：提供准确且可运行的示例
3. **及时更新**：API 变更时及时更新文档
4. **清晰易懂**：使用简单明了的语言描述
5. **版本管理**：为不同 API 版本维护文档

---

## 相关文档

- **[文档规范](./文档规范.md)** - 文档编写规范
- **[编码规范](./编码规范.md)** - JavaScript 代码规范
- **[README](./README.md)** - 开发规范总览

---

*最后更新：2026-03-18*
