/**
 * Pet Authentication Service
 * 处理宠物相关的认证逻辑
 */

class PetAuthService {
    constructor() {
        this.token = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
        this.isAuthenticated = false;
        this.authCallbacks = new Set();
        
        this.init();
    }

    init() {
        this.loadStoredAuth();
        this.setupTokenRefresh();
    }

    // 加载存储的认证信息
    async loadStoredAuth() {
        try {
            const result = await chrome.storage.local.get([
                'petToken',
                'petRefreshToken',
                'petTokenExpiry'
            ]);

            if (result.petToken) {
                this.token = result.petToken;
                this.refreshToken = result.petRefreshToken;
                this.tokenExpiry = result.petTokenExpiry;
                
                this.validateToken();
            }
        } catch (error) {
            console.error('[PetAuthService] 加载存储认证信息失败:', error);
        }
    }

    // 验证令牌
    async validateToken() {
        if (!this.token) {
            this.setAuthenticated(false);
            return false;
        }

        // 检查令牌是否过期
        if (this.isTokenExpired()) {
            console.log('[PetAuthService] 令牌已过期，尝试刷新');
            return await this.refreshAccessToken();
        }

        // 验证令牌有效性
        try {
            const response = await fetch(`${PET_CONFIG.api.baseUrl}/auth/validate`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                this.setAuthenticated(true);
                return true;
            } else {
                console.log('[PetAuthService] 令牌验证失败，尝试刷新');
                return await this.refreshAccessToken();
            }
        } catch (error) {
            console.error('[PetAuthService] 令牌验证错误:', error);
            return false;
        }
    }

    // 检查令牌是否过期
    isTokenExpired() {
        if (!this.tokenExpiry) {
            return true;
        }

        const now = Date.now();
        const expiry = new Date(this.tokenExpiry).getTime();
        
        // 提前5分钟认为令牌过期
        return now >= (expiry - 5 * 60 * 1000);
    }

    // 登录
    async login(credentials) {
        try {
            const response = await fetch(`${PET_CONFIG.api.baseUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: credentials.username,
                    password: credentials.password
                })
            });

            if (!response.ok) {
                throw new Error('登录失败');
            }

            const data = await response.json();
            
            this.token = data.token;
            this.refreshToken = data.refreshToken;
            this.tokenExpiry = data.expiry;
            
            // 保存到存储
            await this.saveAuthData();
            
            this.setAuthenticated(true);
            
            console.log('[PetAuthService] 登录成功');
            return { success: true, data };
            
        } catch (error) {
            console.error('[PetAuthService] 登录失败:', error);
            return { success: false, error: error.message };
        }
    }

    // 登出
    async logout() {
        try {
            if (this.token) {
                // 通知服务器登出
                await fetch(`${PET_CONFIG.api.baseUrl}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    }
                });
            }
        } catch (error) {
            console.error('[PetAuthService] 服务器登出失败:', error);
        } finally {
            // 清除本地认证信息
            this.clearAuthData();
            this.setAuthenticated(false);
            
            console.log('[PetAuthService] 登出成功');
        }
    }

    // 刷新访问令牌
    async refreshAccessToken() {
        if (!this.refreshToken) {
            this.setAuthenticated(false);
            return false;
        }

        try {
            const response = await fetch(`${PET_CONFIG.api.baseUrl}/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    refreshToken: this.refreshToken
                })
            });

            if (!response.ok) {
                throw new Error('刷新令牌失败');
            }

            const data = await response.json();
            
            this.token = data.token;
            this.refreshToken = data.refreshToken;
            this.tokenExpiry = data.expiry;
            
            // 保存到存储
            await this.saveAuthData();
            
            console.log('[PetAuthService] 令牌刷新成功');
            return true;
            
        } catch (error) {
            console.error('[PetAuthService] 刷新令牌失败:', error);
            this.clearAuthData();
            this.setAuthenticated(false);
            return false;
        }
    }

    // 保存认证数据
    async saveAuthData() {
        try {
            await chrome.storage.local.set({
                petToken: this.token,
                petRefreshToken: this.refreshToken,
                petTokenExpiry: this.tokenExpiry
            });
        } catch (error) {
            console.error('[PetAuthService] 保存认证数据失败:', error);
        }
    }

    // 清除认证数据
    async clearAuthData() {
        this.token = null;
        this.refreshToken = null;
        this.tokenExpiry = null;

        try {
            await chrome.storage.local.remove([
                'petToken',
                'petRefreshToken',
                'petTokenExpiry'
            ]);
        } catch (error) {
            console.error('[PetAuthService] 清除认证数据失败:', error);
        }
    }

    // 设置认证状态
    setAuthenticated(isAuthenticated) {
        this.isAuthenticated = isAuthenticated;
        this.notifyAuthChange(isAuthenticated);
    }

    // 添加认证状态变化回调
    onAuthChange(callback) {
        this.authCallbacks.add(callback);
        
        // 返回取消订阅函数
        return () => {
            this.authCallbacks.delete(callback);
        };
    }

    // 通知认证状态变化
    notifyAuthChange(isAuthenticated) {
        this.authCallbacks.forEach(callback => {
            try {
                callback(isAuthenticated);
            } catch (error) {
                console.error('[PetAuthService] 认证状态变化回调错误:', error);
            }
        });
    }

    // 获取认证头
    getAuthHeaders() {
        if (this.token) {
            return {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            };
        }
        return {
            'Content-Type': 'application/json'
        };
    }

    // 获取用户信息
    async getUserInfo() {
        if (!this.isAuthenticated) {
            return null;
        }

        try {
            const response = await fetch(`${PET_CONFIG.api.baseUrl}/auth/user`, {
                headers: this.getAuthHeaders()
            });

            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('[PetAuthService] 获取用户信息失败:', error);
        }

        return null;
    }

    // 设置自动刷新
    setupTokenRefresh() {
        // 每30分钟检查一次令牌
        setInterval(() => {
            if (this.token && this.isTokenExpired()) {
                this.refreshAccessToken();
            }
        }, 30 * 60 * 1000);
    }

    // 获取认证状态
    getAuthStatus() {
        return {
            isAuthenticated: this.isAuthenticated,
            token: this.token,
            tokenExpiry: this.tokenExpiry,
            isTokenExpired: this.isTokenExpired()
        };
    }
}

// 创建全局实例
window.PetAuthService = PetAuthService;

// 防止重复初始化
if (typeof window.petAuthService === 'undefined') {
    window.petAuthService = new PetAuthService();
}