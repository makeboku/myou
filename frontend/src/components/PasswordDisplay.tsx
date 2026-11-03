import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { copyText } from '../lib/utils';

interface PasswordDisplayProps {
  password: string;
  address: string;
  onDismiss: () => void;
}

const PasswordDisplay: React.FC<PasswordDisplayProps> = ({ password, address, onDismiss }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyText(password);
    setCopied(ok);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-yellow-600">
            <i className="fas fa-exclamation-triangle mr-2"></i>
            {t('mailbox.savePassword')}
          </h2>
          <button
            onClick={onDismiss}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              {t('mailbox.savePasswordWarning')}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              {t('mailbox.address')}
            </label>
            <div className="flex items-center bg-muted rounded-md px-3 py-2">
              <code className="flex-1 text-sm">{address}</code>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              {t('mailbox.password')}
            </label>
            <div className="flex items-center gap-2 border border-border rounded-md p-1 bg-background">
              <input
                readOnly
                type="password"
                value={password}
                className="flex-1 min-w-0 px-3 py-2 text-sm font-mono bg-transparent outline-none"
              />
              <button
                onClick={handleCopy}
                className="shrink-0 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/80 transition-colors"
              >
                {copied ? t('common.copied') : t('common.copy')}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={onDismiss}
              className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/80 transition-colors"
            >
              {t('common.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PasswordDisplay;
