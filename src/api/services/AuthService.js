/**
 * 认证服务
 * 提供用户认证相关的API操作
 */

(function (root) {
class AuthService extends ApiManager {
    constructor(baseUrl, options = {}) {
        super(baseUrl, {
            ...options,
            logger: {
                ...options.logger,
                prefix: '[AuthService]'
            }
        });
        
        // 用户信息缓存
        this.userInfo = null;
        this.userInfoExpiry = 0;
        this.cacheDuration = options.cacheDuration || 5 * 60 * 1000; // 5分钟
    }
    
    /**
     * 用户登录
     */
    async login(credentials) {
        if (!credentials || !credentials.username || !credentials.password) {
            throw new Error('用户名和密码不能为空');
        }
        
        try {
            const result = await this.post(AUTH_ENDPOINTS.LOGIN, {
                username: credentials.username,
                password: credentials.password
            });
            
            // 保存token
            if (result.token) {
                await this.tokenManager.saveToken(result.token);
            }
            
            // 缓存用户信息
            if (result.user) {
                this.userInfo = result.user;
                this.userInfoExpiry = Date.now() + this.cacheDuration;
            }
            
            return result;
        } catch (error) {
            this.logger.error('登录失败:', error.message);
            throw error;
        }
    }
    
    /**
     * 用户登出
     */
    async logout() {
        try {
            await this.post(AUTH_ENDPOINTS.LOGOUT);
        } catch (error) {
            this.logger.warn('登出失败:', error.message);
        } finally {
            // 清除token和用户信息
            await this.tokenManager.clearToken();
            this.userInfo = null;
            this.userInfoExpiry = 0;
        }
    }
    
    /**
     * 刷新token
     */
    async refreshToken() {
        try {
            const result = await this.post(AUTH_ENDPOINTS.REFRESH);
            
            if (result.token) {
                await this.tokenManager.saveToken(result.token);
            }
            
            return result;
        } catch (error) {
            this.logger.error('刷新token失败:', error.message);
            throw error;
        }
    }
    
    /**
     * 获取用户信息
     */
    async getProfile() {
        // 检查缓存
        if (this.userInfo && Date.now() < this.userInfoExpiry) {
            return this.userInfo;
        }
        
        try {
            const userInfo = await this.get(AUTH_ENDPOINTS.PROFILE);
            
            // 缓存用户信息
            this.userInfo = userInfo;
            this.userInfoExpiry = Date.now() + this.cacheDuration;
            
            return userInfo;
        } catch (error) {
            this.logger.error('获取用户信息失败:', error.message);
            throw error;
        }
    }
    
    /**
     * 验证token
     */
    async validateToken() {
        try {
            const result = await this.get(AUTH_ENDPOINTS.VALIDATE);
            return result.valid === true;
        } catch (error) {
            this.logger.warn('验证token失败:', error.message);
            return false;
        }
    }
    
    /**
     * 检查是否已登录
     */
    async isAuthenticated() {
        const hasToken = await this.tokenManager.hasToken();
        if (!hasToken) {
            return false;
        }
        
        try {
            return await this.validateToken();
        } catch (error) {
            return false;
        }
    }
    
    /**
     * 获取当前用户信息（同步）
     */
    getCurrentUserSync() {
        if (this.userInfo && Date.now() < this.userInfoExpiry) {
            return this.userInfo;
        }
        
        return null;
    }
    
    /**
     * 清除用户信息缓存
     */
    clearUserCache() {
        this.userInfo = null;
        this.userInfoExpiry = 0;
    }
}

root.AuthService = AuthService;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window));
