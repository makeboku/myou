import React, { useState, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { MailboxContext } from '../contexts/MailboxContext';

interface LoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const LoginDialog: React.FC<LoginDialogProps> = ({ isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const { loginWithPassword, isLoading } = useContext(MailboxContext);
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!address.trim() || !password.trim()) {
      setError(t('mailbox.loginRequiredFields'));
      return;
    }

    const success = await loginWithPassword(address.trim(), password);
    if (success) {
      setAddress('');
      setPassword('');
      onSuccess();
      onClose();
    } else {
      setError(t('mailbox.loginFailed'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">{t('mailbox.login')}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              {t('mailbox.address')}
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={t('mailbox.address')}
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              {t('mailbox.password')}
            </label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={t('mailbox.password')}
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-md bg-muted hover:bg-muted/80 transition-colors"
              disabled={isLoading}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/80 transition-colors"
              disabled={isLoading}
            >
              {isLoading ? t('common.loading') : t('common.confirm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginDialog;
