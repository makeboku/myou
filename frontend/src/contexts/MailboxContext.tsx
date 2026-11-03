import React, { createContext, useState, useEffect, ReactNode, useRef } from 'react';
import {
  getMailboxFromLocalStorage,
  saveMailboxToLocalStorage,
  removeMailboxFromLocalStorage,
  getEmails,
  deleteMailbox as apiDeleteMailbox,
  loginMailbox as apiLoginMailbox,
  createMailboxWithCredentials
} from '../utils/api';
import { useTranslation } from 'react-i18next';
import { DEFAULT_AUTO_REFRESH, AUTO_REFRESH_INTERVAL, getEmailDomains, getDefaultEmailDomain, EMAIL_DOMAINS, DEFAULT_EMAIL_DOMAIN, resetEmailDomainsCache } from '../config';

// 邮件详情缓存接口
interface EmailCache {
  [emailId: string]: {
    email: Email;
    attachments: any[];
    timestamp: number;
  }
}

interface MailboxContextType {
  mailbox: (Mailbox & { password: string }) | null;
  setMailbox: (mailbox: Mailbox & { password: string }) => void;
  logout: () => void;
  isLoading: boolean;
  emails: Email[];
  setEmails: React.Dispatch<React.SetStateAction<Email[]>>;
  selectedEmail: string | null;
  setSelectedEmail: (id: string | null) => void;
  isEmailsLoading: boolean;
  setIsEmailsLoading: (loading: boolean) => void;
  autoRefresh: boolean;
  setAutoRefresh: (autoRefresh: boolean) => void;
  deleteMailbox: () => Promise<void>;
  refreshEmails: (isManual?: boolean) => Promise<void>;
  emailCache: EmailCache;
  addToEmailCache: (emailId: string, email: Email, attachments: any[]) => void;
  clearEmailCache: () => void;
  handleMailboxNotFound: () => Promise<void>;
  errorMessage: string | null;
  successMessage: string | null;
  showSuccessMessage: (message: string) => void;
  showErrorMessage: (message: string) => void;
  loginWithPassword: (address: string, password: string) => Promise<boolean>;
  isPasswordVisible: boolean;
  togglePasswordVisibility: () => void;
  showPasswordDialog: boolean;
  setShowPasswordDialog: (show: boolean) => void;
  createMailboxWithCredentials: (address: string, password: string) => Promise<boolean>;
  emailDomains: string[];
  selectedDomain: string;
  setSelectedDomain: (domain: string) => void;
  refreshEmailDomains: () => Promise<string[]>;
}

export const MailboxContext = createContext<MailboxContextType>({
  mailbox: null,
  setMailbox: () => {},
  logout: () => {},
  isLoading: false,
  emails: [],
  setEmails: () => {},
  selectedEmail: null,
  setSelectedEmail: () => {},
  isEmailsLoading: false,
  setIsEmailsLoading: () => {},
  autoRefresh: DEFAULT_AUTO_REFRESH,
  setAutoRefresh: () => {},
  deleteMailbox: async () => {},
  refreshEmails: async () => {},
  emailCache: {},
  addToEmailCache: () => {},
  clearEmailCache: () => {},
  handleMailboxNotFound: async () => {},
  errorMessage: null,
  successMessage: null,
  showSuccessMessage: () => {},
  showErrorMessage: () => {},
  loginWithPassword: async () => false,
  isPasswordVisible: false,
  togglePasswordVisibility: () => {},
  showPasswordDialog: false,
  setShowPasswordDialog: () => {},
  createMailboxWithCredentials: async () => false,
  emailDomains: [],
  selectedDomain: '',
  setSelectedDomain: () => {},
  refreshEmailDomains: async () => [],
});

interface MailboxProviderProps {
  children: ReactNode;
}

export const MailboxProvider: React.FC<MailboxProviderProps> = ({ children }) => {
  const { t } = useTranslation();
  const [mailbox, setMailboxState] = useState<(Mailbox & { password: string }) | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [isEmailsLoading, setIsEmailsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(DEFAULT_AUTO_REFRESH);
  const [emailCache, setEmailCache] = useState<EmailCache>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [exiting, setExiting] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [emailDomains, setEmailDomains] = useState<string[]>(EMAIL_DOMAINS);
  const [selectedDomain, setSelectedDomain] = useState<string>(DEFAULT_EMAIL_DOMAIN);
  const errorTimeoutRef = useRef<number | null>(null);
  const successTimeoutRef = useRef<number | null>(null);

  // 包装 setMailbox 以自动保存到 localStorage
  const setMailbox = (newMailbox: Mailbox & { password: string }) => {
    setMailboxState(newMailbox);
    saveMailboxToLocalStorage(newMailbox, newMailbox.password);
  };

  const dismissWithParticles = (type: 'success' | 'error', duration: number) => {
    const ref = type === 'success' ? successTimeoutRef : errorTimeoutRef;
    const setter = type === 'success' ? setSuccessMessage : setErrorMessage;
    if (ref.current) window.clearTimeout(ref.current);
    ref.current = window.setTimeout(() => {
      setExiting(true);
      ref.current = window.setTimeout(() => {
        setter(null);
        setExiting(false);
      }, 600);
    }, duration);
  };

  // feat: 创建显示成功消息的函数
  const showSuccessMessage = (message: string) => {
    setExiting(false);
    setSuccessMessage(message);
    dismissWithParticles('success', 8000);
  };

  // feat: 创建显示错误消息的函数
  const showErrorMessage = (message: string) => {
    setExiting(false);
    setErrorMessage(message);
    dismissWithParticles('error', 3000);
  };

  // 切换密码显示
  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };


  // 清除提示的定时器
  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        window.clearTimeout(errorTimeoutRef.current);
      }
      if (successTimeoutRef.current) {
        window.clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  // 初始化：仅检查本地存储，不再自动创建
  useEffect(() => {
    const savedMailbox = getMailboxFromLocalStorage();
    if (savedMailbox) {
      setMailbox(savedMailbox);
    }
    setIsLoading(false);
  }, []);
  
  // 加载域名配置
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const domains = await getEmailDomains();
        const defaultDom = await getDefaultEmailDomain();
        setEmailDomains(domains.length > 0 ? domains : EMAIL_DOMAINS);
        setSelectedDomain(defaultDom || DEFAULT_EMAIL_DOMAIN);
      } catch (error) {
        console.error('加载邮箱域名配置失败:', error);
      }
    };
    loadConfig();
  }, []);

  // 强制重新拉取域名配置（用于启动时拉取失败、当前只剩兜底域名时）
  const refreshEmailDomains = async (): Promise<string[]> => {
    try {
      resetEmailDomainsCache();
      const domains = await getEmailDomains();
      if (domains.length > 0) {
        setEmailDomains(domains);
        setSelectedDomain(domains[Math.floor(Math.random() * domains.length)]);
        return domains;
      }
      const fresh = EMAIL_DOMAINS.length > 0 ? EMAIL_DOMAINS : [];
      setEmailDomains(fresh);
      return fresh;
    } catch (error) {
      console.error('刷新邮箱域名配置失败:', error);
      return [];
    }
  };

  // 使用指定的用户名和密码创建邮箱
  const createMailboxWithCredentialsFn = async (address: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      
      const result = await createMailboxWithCredentials(address, password);
      
      if (result.success && result.mailbox) {
        const mailboxWithPassword = {
          ...result.mailbox,
          password: result.password || password
        };
        setMailbox(mailboxWithPassword);
        showSuccessMessage(t('mailbox.createSuccess'));
        return true;
      } else {
        // 防御性检查：确保 error 是字符串，防止 React 渲染崩溃
        const errorMsg = typeof result.error === 'string' ? result.error : t('mailbox.createFailed');
        showErrorMessage(errorMsg);
        return false;
      }
    } catch (error) {
      console.error('createMailboxWithCredentials: Error:', error);
      showErrorMessage(t('mailbox.createFailed'));
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // 使用密码登录邮箱
  const loginWithPassword = async (address: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      
      const result = await apiLoginMailbox(address, password);
      
      if (result.success && result.mailbox) {
        const mailboxWithPassword = {
          ...result.mailbox,
          password: result.password || password
        };
        setMailbox(mailboxWithPassword);
        showSuccessMessage(t('mailbox.loginSuccess'));
        return true;
      } else {
        showErrorMessage(t('mailbox.loginFailed'));
        return false;
      }
    } catch (error) {
      console.error('loginWithPassword: Error:', error);
      showErrorMessage(t('mailbox.loginFailed'));
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // 删除邮箱
  const deleteMailbox = async () => {
    if (!mailbox) return;

    try {
      setErrorMessage(null);
      setSuccessMessage(null);

      const result = await apiDeleteMailbox(mailbox.address, mailbox.password);

      if (result.success) {
        showSuccessMessage(t('mailbox.deleteSuccess'));

        setMailboxState(null);
        setEmails([]);
        setSelectedEmail(null);
        removeMailboxFromLocalStorage();
        clearEmailCache();
      } else {
        showErrorMessage(t('mailbox.deleteFailed'));
      }
    } catch (error) {
      console.error('Error deleting mailbox:', error);
      showErrorMessage(t('mailbox.deleteFailed'));
    }
  };

  // 注销登录（仅清除本地状态，不删除邮箱）
  const logout = () => {
    setMailboxState(null);
    setEmails([]);
    setSelectedEmail(null);
    removeMailboxFromLocalStorage();
    clearEmailCache();
    showSuccessMessage(t('mailbox.logoutSuccess'));
  };

  // feat: 增加 isManual 参数，只有手动点击刷新时才显示Toast
  const refreshEmails = async (isManual = false) => {
    if (!mailbox || isEmailsLoading) return;
    setIsEmailsLoading(true);

    try {
      const result = await getEmails(mailbox.address, mailbox.password);

      if (result.success) {
        setEmails(result.emails);
        // feat: 手动刷新成功时显示Toast
        if (isManual) {
          showSuccessMessage(t('email.refreshSuccess'));
        }
      } else if (result.notFound) {
        // [fix]: 如果邮箱不存在，调用 handleMailboxNotFound 进行平滑处理，而不是强制刷新页面
        await handleMailboxNotFound();
      } else {
        // feat: 刷新失败时也显示Toast
        if (isManual) {
          showErrorMessage(t('email.fetchFailed'));
        }
      }
    } catch (error) {
      // 错误处理
      console.error('Error refreshing emails:', error);
      if (isManual) {
        showErrorMessage(t('email.fetchFailed'));
      }
    } finally {
      setIsEmailsLoading(false);
    }
  };

  // 自动刷新邮件
  useEffect(() => {
    if (!mailbox || isLoading) return;
    refreshEmails(); // 初始加载不显示 a Toast
    let intervalId: number | undefined;
    if (autoRefresh) {
      intervalId = window.setInterval(() => refreshEmails(), AUTO_REFRESH_INTERVAL); // 自动刷新不显示 a Toast
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [mailbox, autoRefresh, isLoading]);

  // [fix]: 重构处理邮箱不存在的逻辑，避免页面刷新
  const handleMailboxNotFound = async () => {
    showSuccessMessage(t('mailbox.creatingNew'));
    
    removeMailboxFromLocalStorage();
    clearEmailCache();
    
    setMailboxState(null);
    setShowPasswordDialog(true);
  };

  // 添加邮件到缓存
  const addToEmailCache = (emailId: string, email: Email, attachments: any[]) => {
    setEmailCache(prev => ({
      ...prev,
      [emailId]: {
        email,
        attachments,
        timestamp: Date.now()
      }
    }));

    // 保存到localStorage
    try {
      const mailboxAddress = mailbox?.address;
      if (mailboxAddress) {
        const cacheKey = `emailCache_${mailboxAddress}`;
        const updatedCache = {
          ...emailCache,
          [emailId]: {
            email,
            attachments,
            timestamp: Date.now()
          }
        };
        localStorage.setItem(cacheKey, JSON.stringify(updatedCache));
      }
    } catch (error) {
      console.error('Error saving email cache to localStorage:', error);
    }
  };

  // 清除邮件缓存
  const clearEmailCache = () => {
    setEmailCache({});

    // 清除localStorage中的缓存
    try {
      const mailboxAddress = mailbox?.address;
      if (mailboxAddress) {
        const cacheKey = `emailCache_${mailboxAddress}`;
        localStorage.removeItem(cacheKey);
      }
    } catch (error) {
      console.error('Error clearing email cache from localStorage:', error);
    }
  };

  return (
    <MailboxContext.Provider
      value={{
        mailbox,
        setMailbox,
        logout,
        isLoading,
        emails,
        setEmails,
        selectedEmail,
        setSelectedEmail,
        isEmailsLoading,
        setIsEmailsLoading,
        autoRefresh,
        setAutoRefresh,
        deleteMailbox,
        refreshEmails,
        emailCache,
        addToEmailCache,
        clearEmailCache,
        handleMailboxNotFound,
        errorMessage,
        successMessage,
        showSuccessMessage,
        showErrorMessage,
        loginWithPassword,
        isPasswordVisible,
        togglePasswordVisibility,
        showPasswordDialog,
        setShowPasswordDialog,
        createMailboxWithCredentials: createMailboxWithCredentialsFn,
        emailDomains,
        selectedDomain,
        setSelectedDomain,
        refreshEmailDomains,
      }}
    >
      {/* [feat] 全局通知组件 */}
      {(errorMessage || successMessage) && (
        <div
          className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] ${
            exiting ? 'animate-toast-exit' : 'animate-slide-up'
          }`}
        >
          <div className="relative px-4 py-2.5 rounded-xl shadow-2xl overflow-visible">
            <div className={`flex items-center whitespace-nowrap ${
              errorMessage
                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-300 dark:border-red-700'
                : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border border-green-300 dark:border-green-700'
            } px-4 py-2.5 rounded-xl shadow-2xl`}>
              <i className={`fas ${errorMessage ? 'fa-exclamation-circle' : 'fa-check-circle'} mr-2`}></i>
              {errorMessage || successMessage}
            </div>
          </div>
        </div>
      )}
      {children}
    </MailboxContext.Provider>
  );
}; 
