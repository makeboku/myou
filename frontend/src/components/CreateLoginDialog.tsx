import React, { useState, useContext, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MailboxContext } from '../contexts/MailboxContext';
import { generateRandomAddress, generatePassword, buildAccountInfoText } from '../utils/helpers';
import { copyText } from '../lib/utils';

interface CreateLoginDialogProps {
  isOpen: boolean;
  onDismiss: () => void;
}

const MIN_PASSWORD_LENGTH = 6;

const CreateLoginDialog: React.FC<CreateLoginDialogProps> = ({ isOpen, onDismiss }) => {
  const { t } = useTranslation();
  const { loginWithPassword, isLoading, createMailboxWithCredentials, showSuccessMessage, showErrorMessage, emailDomains, selectedDomain, setSelectedDomain, refreshEmailDomains } = useContext(MailboxContext);
  const [activeTab, setActiveTab] = useState<'create' | 'login'>('create');

  const [generatedAddress, setGeneratedAddress] = useState(() => generateRandomAddress());
  const [generatedPassword, setGeneratedPassword] = useState(() => generatePassword());
  const [customAddress, setCustomAddress] = useState('');
  const [useCustomAddress, setUseCustomAddress] = useState(false);
  const [customPassword, setCustomPassword] = useState('');
  const [useCustomPassword, setUseCustomPassword] = useState(false);
  
  const [loginFullAddress, setLoginFullAddress] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // 每次打开弹窗时，随机选择地址、密码和域名后缀（而不是只依赖随机按钮）
  useEffect(() => {
    if (!isOpen) return;
    setGeneratedAddress(generateRandomAddress());
    setGeneratedPassword(generatePassword());
    setUseCustomAddress(false);
    setUseCustomPassword(false);
    setCustomAddress('');
    setCustomPassword('');
    if (emailDomains.length > 0) {
      // 过滤掉无效兜底域名（example.com 等），只在真实配置的域名里随机
      const validDomains = emailDomains.filter(d => !d.includes('example.com'));
      const pool = validDomains.length > 0 ? validDomains : emailDomains;
      setSelectedDomain(pool[Math.floor(Math.random() * pool.length)]);
    } else {
      // 启动时拉取失败导致没有域名时，强制重新拉取
      refreshEmailDomains();
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const handleRegenerate = () => {
    setGeneratedAddress(generateRandomAddress());
    setGeneratedPassword(generatePassword());
    setUseCustomPassword(false);
    setCustomPassword('');
    const validDomains = emailDomains.filter(d => !d.includes('example.com'));
    const pool = validDomains.length > 0 ? validDomains : emailDomains;
    const randomDomain = pool.length > 0
      ? pool[Math.floor(Math.random() * pool.length)]
      : selectedDomain;
    setSelectedDomain(randomDomain);
  };

  const handleCreate = async () => {
    const localPart = useCustomAddress ? customAddress.trim() : generatedAddress;
    if (!localPart) {
      showErrorMessage(t('mailbox.invalidAddress'));
      return;
    }
    let finalDomain = selectedDomain && !selectedDomain.includes('example.com') ? selectedDomain : '';
    if (!finalDomain) {
      // 域名尚未就绪时先重新拉取，避免生成 @ 空域名或 example.com 的无效账号
      const domains = await refreshEmailDomains();
      const validDomains = domains.filter(d => !d.includes('example.com'));
      const pool = validDomains.length > 0 ? validDomains : domains;
      finalDomain = pool[0] || '';
      if (!finalDomain) {
        showErrorMessage(t('mailbox.invalidAddress'));
        return;
      }
      setSelectedDomain(finalDomain);
    }
    const finalPassword = useCustomPassword ? customPassword.trim() : generatedPassword;
    if (useCustomPassword && finalPassword.length < MIN_PASSWORD_LENGTH) {
      showErrorMessage(t('mailbox.passwordTooShort'));
      return;
    }
    const fullAddress = `${localPart}@${finalDomain}`;
    const result = await createMailboxWithCredentials(fullAddress, finalPassword);
    
    if (result) {
      const text = buildAccountInfoText({
        siteUrl: window.location.origin,
        fullAddress,
        password: finalPassword,
        title: t('mailbox.accountInfoTitle'),
        usernameLabel: t('mailbox.username'),
        passwordLabel: t('mailbox.password'),
      });
      
      // 后台静默复制，不阻塞 UI
      copyText(text).catch(err => console.error("复制失败", err));
      
      // 立即关闭弹窗，显示收件箱
      onDismiss();
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!loginFullAddress.trim() || !loginPassword.trim()) {
      setLoginError(t('mailbox.loginRequiredFields'));
      return;
    }

    const success = await loginWithPassword(loginFullAddress.trim(), loginPassword);
    if (success) {
      setLoginFullAddress('');
      setLoginPassword('');
      onDismiss();
    } else {
      setLoginError(t('mailbox.loginFailed'));
    }
  };

  const handleTabSwitch = (tab: 'create' | 'login') => {
    setActiveTab(tab);
    setLoginError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-2xl shadow-2xl w-[480px] max-w-[95vw] mx-4 p-6 border">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-bold">
            {t('app.title')}
          </h2>
          <button
            onClick={onDismiss}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="flex bg-muted/60 rounded-xl p-1 mb-5">
          <button
            data-tab="create"
            className={`flex-1 py-2.5 px-4 text-sm font-semibold transition-all rounded-lg ${
              activeTab === 'create' 
                ? 'bg-background text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => handleTabSwitch('create')}
          >
            {t('mailbox.create')}
          </button>
          <button
            data-tab="login"
            className={`flex-1 py-2.5 px-4 text-sm font-semibold transition-all rounded-lg ${
              activeTab === 'login' 
                ? 'bg-background text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => handleTabSwitch('login')}
          >
            {t('mailbox.login')}
          </button>
        </div>

        {activeTab === 'create' && (
          <div className="space-y-4 min-h-[320px] flex flex-col">
            <div className="bg-muted/30 rounded-xl p-5 space-y-4 border">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-semibold">
                    {t('mailbox.address')}
                  </label>
                  <button
                    type="button"
                    onClick={() => { setUseCustomAddress(!useCustomAddress); setCustomAddress(''); }}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    <i className={`fas ${useCustomAddress ? 'fa-random' : 'fa-pen'} mr-1`}></i>
                    {useCustomAddress ? t('mailbox.refresh') : t('mailbox.customize')}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {useCustomAddress ? (
                    <input
                      type="text"
                      value={customAddress}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^a-zA-Z0-9._-]/g, '');
                        setCustomAddress(val);
                      }}
                      placeholder={t('mailbox.customAddressPlaceholder')}
                      className="flex-1 px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-sm font-mono"
                      disabled={isLoading}
                    />
                  ) : (
                    <code className="flex-1 bg-background rounded-lg px-3 py-2.5 text-sm font-mono whitespace-nowrap overflow-hidden text-ellipsis border" title={generatedAddress}>
                      {generatedAddress}
                    </code>
                  )}
                  <span className="text-muted-foreground font-bold text-lg shrink-0">@</span>
                  <select 
                    value={selectedDomain}
                    onChange={(e) => setSelectedDomain(e.target.value)}
                    className="flex-1 px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-sm"
                  >
                    {emailDomains.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-semibold">
                    {t('mailbox.password')}
                  </label>
                  <button
                    type="button"
                    onClick={() => { setUseCustomPassword(!useCustomPassword); setCustomPassword(''); }}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    <i className={`fas ${useCustomPassword ? 'fa-sync-alt' : 'fa-pen'} mr-1`}></i>
                    {useCustomPassword ? t('mailbox.randomPassword') : t('mailbox.customizePassword')}
                  </button>
                </div>
                {useCustomPassword ? (
                  <input
                    type="text"
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    placeholder={t('mailbox.passwordPlaceholder')}
                    className="w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-sm font-mono"
                    disabled={isLoading}
                  />
                ) : (
                  <code className="block bg-background rounded-lg px-3 py-2.5 text-sm font-mono whitespace-nowrap overflow-hidden text-ellipsis border" title={generatedPassword}>
                    {generatedPassword}
                  </code>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleRegenerate}
                className="flex-1 px-4 py-2.5 text-sm rounded-xl bg-muted hover:bg-muted/80 transition-all font-medium"
                disabled={isLoading}
              >
                <i className="fas fa-sync-alt mr-1.5"></i>
                {t('mailbox.refresh')}
              </button>
              <button
                onClick={handleCreate}
                className="flex-1 px-4 py-2.5 text-sm rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all font-semibold shadow-sm"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span><i className="fas fa-spinner fa-spin mr-1.5"></i>{t('common.loading')}</span>
                ) : (
                  <span><i className="fas fa-plus mr-1.5"></i>{t('mailbox.createAndCopy')}</span>
                )}
              </button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              {t('mailbox.createPasswordTip')}
            </p>
            <div className="flex-1"></div>
          </div>
        )}

        {activeTab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4 min-h-[320px] flex flex-col">
            <div>
              <label className="block text-sm font-semibold mb-1.5">
                {t('mailbox.address')}
              </label>
              <input
                type="text"
                value={loginFullAddress}
                onChange={(e) => setLoginFullAddress(e.target.value)}
                className="w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary bg-background text-sm"
                placeholder={t('mailbox.addressPlaceholder')}
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5">
                {t('mailbox.password')}
              </label>
              <input
                type="text"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary bg-background text-sm"
                placeholder={t('mailbox.password')}
                disabled={isLoading}
              />
            </div>

            {loginError && (
              <div className="text-red-500 text-sm font-medium bg-red-500/10 rounded-lg px-4 py-2">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full px-4 py-2.5 text-sm rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all font-semibold shadow-sm"
              disabled={isLoading}
            >
              {isLoading ? (
                <span><i className="fas fa-spinner fa-spin mr-1.5"></i>{t('common.loading')}</span>
              ) : (
                <span><i className="fas fa-sign-in-alt mr-1.5"></i>{t('mailbox.login')}</span>
              )}
            </button>

            <div className="flex-1"></div>
          </form>
        )}
      </div>
    </div>
  );
};

export default CreateLoginDialog;
