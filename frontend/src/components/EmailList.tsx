import React, { useContext, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { MailboxContext } from '../contexts/MailboxContext';
import EmailDetail from './EmailDetail';
import UserInfoModal from './UserInfoModal';
import { generateRandomName, generateFromOSM } from '../utils/nameGenerator';
import { COUNTRIES } from '../utils/countryData';
import { batchDeleteEmails, batchMarkAsRead, batchMarkAsUnread } from '../utils/api';
import { copyText } from '../lib/utils';

interface EmailListProps {
  emails: Email[];
  selectedEmailId: string | null;
  onSelectEmail: (id: string | null) => void;
  isLoading: boolean;
}

const EmailList: React.FC<EmailListProps> = ({ 
  emails, 
  selectedEmailId, 
  onSelectEmail,
  isLoading 
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { autoRefresh, setAutoRefresh, refreshEmails, mailbox, deleteMailbox, showSuccessMessage, showErrorMessage } = useContext(MailboxContext);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState("US");
  const [randomName, setRandomName] = useState(() => generateRandomName("US"));
  const [isNameLoading, setIsNameLoading] = useState(true);
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<string>>(new Set());
  const [isBatchOperating, setIsBatchOperating] = useState(false);

  useEffect(() => {
    generateFromOSM("US").then(result => {
      if (result) setRandomName(result);
      setIsNameLoading(false);
    });
  }, []);

  const regenerateName = async (countryCode?: string) => {
    const code = countryCode || selectedCountry;
    setIsNameLoading(true);
    const apiResult = await generateFromOSM(code);
    setRandomName(apiResult || generateRandomName(code));
    setIsNameLoading(false);
  };

  const handleCountryChange = async (countryCode: string) => {
    setSelectedCountry(countryCode);
    setIsNameLoading(true);
    const apiResult = await generateFromOSM(countryCode);
    setRandomName(apiResult || generateRandomName(countryCode));
    setIsNameLoading(false);
  };

  const toggleEmailSelection = (emailId: string) => {
    setSelectedEmailIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(emailId)) {
        newSet.delete(emailId);
      } else {
        newSet.add(emailId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedEmailIds.size === emails.length) {
      setSelectedEmailIds(new Set());
    } else {
      setSelectedEmailIds(new Set(emails.map(e => e.id)));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedEmailIds.size === 0) return;
    if (!window.confirm(t('email.batchDeleteConfirm', { count: selectedEmailIds.size }))) return;
    
    setIsBatchOperating(true);
    try {
      const result = await batchDeleteEmails(Array.from(selectedEmailIds), mailbox?.password);
      if (result.success) {
        showSuccessMessage(t('email.batchDeleteSuccess', { count: selectedEmailIds.size }));
        setSelectedEmailIds(new Set());
        refreshEmails(true);
      } else {
        showErrorMessage(t('email.batchDeleteFailed'));
      }
    } catch {
      showErrorMessage(t('email.batchDeleteFailed'));
    }
    setIsBatchOperating(false);
  };

  const handleBatchMarkAsRead = async () => {
    if (selectedEmailIds.size === 0) return;
    
    setIsBatchOperating(true);
    try {
      const result = await batchMarkAsRead(Array.from(selectedEmailIds), mailbox?.password);
      if (result.success) {
        showSuccessMessage(t('email.batchMarkAsReadSuccess', { count: selectedEmailIds.size }));
        setSelectedEmailIds(new Set());
        refreshEmails(true);
      } else {
        showErrorMessage(t('email.batchMarkAsReadFailed'));
      }
    } catch {
      showErrorMessage(t('email.batchMarkAsReadFailed'));
    }
    setIsBatchOperating(false);
  };

  const handleBatchMarkAsUnread = async () => {
    if (selectedEmailIds.size === 0) return;
    
    setIsBatchOperating(true);
    try {
      const result = await batchMarkAsUnread(Array.from(selectedEmailIds), mailbox?.password);
      if (result.success) {
        showSuccessMessage(t('email.batchMarkAsUnreadSuccess', { count: selectedEmailIds.size }));
        setSelectedEmailIds(new Set());
        refreshEmails(true);
      } else {
        showErrorMessage(t('email.batchMarkAsUnreadFailed'));
      }
    } catch {
      showErrorMessage(t('email.batchMarkAsUnreadFailed'));
    }
    setIsBatchOperating(false);
  };

  const copyToClipboard = async (text: string, messageKey: string) => {
    const ok = await copyText(text);
    if (ok) {
      showSuccessMessage(t(messageKey));
    } else {
      showErrorMessage(t('common.copyFailed'));
    }
  };
  
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };
  
  const formatFullDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };
  
  const calculateTimeLeft = (expiresAt: number) => {
    if (!expiresAt) return '';
    
    const now = Math.floor(Date.now() / 1000);
    const timeLeftSeconds = expiresAt - now;
    
    if (timeLeftSeconds <= 0) {
      return t('mailbox.expired');
    }
    
    const hours = Math.floor(timeLeftSeconds / 3600);
    const minutes = Math.floor((timeLeftSeconds % 3600) / 60);
    
    if (hours > 0) {
      return t('mailbox.expiresInTime', { hours, minutes });
    } else {
      return t('mailbox.expiresInMinutes', { minutes });
    }
  };
  
  const handleRefresh = () => {
    refreshEmails(true);
  };
  
  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
  };
  
  
  if (isLoading || isDeleting) {
    return (
      <div className="border rounded-xl shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">{t('email.inbox')}</h2>
        </div>
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }
  
  return (
    <>
    <div className="border rounded-xl shadow-sm overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between p-5 border-b bg-card gap-3">
        <h2 className="text-xl font-medium">{t('email.inbox')}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => copyToClipboard(randomName.firstName, 'email.copiedFirstName')}
            className="px-3 py-1.5 rounded-full bg-muted/60 hover:bg-muted/80 text-foreground hover:text-primary flex items-center gap-1.5 border border-border/60 hover:border-border text-base shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ease-out"
            title={t('email.copyFirstName')}
          >
            <span className="text-muted-foreground">{t('email.firstName')}:</span>
            <span className="text-foreground">{randomName.firstName}</span>
            <i className="fas fa-copy text-xs opacity-60"></i>
          </button>
          <button
            onClick={() => copyToClipboard(randomName.lastName, 'email.copiedLastName')}
            className="px-3 py-1.5 rounded-full bg-muted/60 hover:bg-muted/80 text-foreground hover:text-primary flex items-center gap-1.5 border border-border/60 hover:border-border text-base shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ease-out"
            title={t('email.copyLastName')}
          >
            <span className="text-muted-foreground">{t('email.lastName')}:</span>
            <span className="text-foreground">{randomName.lastName}</span>
            <i className="fas fa-copy text-xs opacity-60"></i>
          </button>
          <button
            onClick={() => copyToClipboard(randomName.fullName, 'email.copiedFullName')}
            className="px-3 py-1.5 rounded-full bg-muted/60 hover:bg-muted/80 text-foreground hover:text-primary flex items-center gap-1.5 border border-border/60 hover:border-border text-base shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ease-out"
            title={t('email.copyFullName')}
          >
            <span className="text-muted-foreground">{t('email.fullName')}:</span>
            <span className="text-foreground">{randomName.fullName}</span>
            <i className="fas fa-copy text-xs opacity-60"></i>
          </button>
          <button
            onClick={() => copyToClipboard(randomName.username, 'email.copiedUsername')}
            className="px-3 py-1.5 rounded-full bg-muted/60 hover:bg-muted/80 text-foreground hover:text-primary flex items-center gap-1.5 border border-border/60 hover:border-border text-base shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ease-out"
            title={t('email.copyUsername') + ': ' + randomName.username}
          >
            <span className="text-muted-foreground">{t('email.username')}:</span>
            <span className="text-foreground">{randomName.username.length > 4 ? randomName.username.substring(0, 4) + '...' : randomName.username}</span>
            <i className="fas fa-copy text-xs opacity-60"></i>
          </button>
          <button
            onClick={() => copyToClipboard(randomName.password, 'email.copiedPassword')}
            className="px-3 py-1.5 rounded-full bg-muted/60 hover:bg-muted/80 text-foreground hover:text-primary flex items-center gap-1.5 border border-border/60 hover:border-border text-base shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ease-out"
            title={t('email.copyPassword')}
          >
            <span className="text-muted-foreground">{t('email.password')}:</span>
            <span className="text-foreground">{'•'.repeat(4)}</span>
            <i className="fas fa-copy text-xs opacity-60"></i>
          </button>
          <button
            onClick={() => setIsInfoModalOpen(true)}
            className="px-3 py-1.5 rounded-full bg-muted/60 hover:bg-muted/80 text-foreground hover:text-primary flex items-center gap-1.5 border border-border/60 hover:border-border text-base shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ease-out"
            title={t('email.showMore')}
          >
            <i className="fas fa-ellipsis-h text-xs opacity-60"></i>
            <span>{t('email.showMore')}</span>
          </button>
          {isNameLoading && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          )}
        </div>

      </div>

      {mailbox && (
        <div className="px-5 py-3 bg-muted/20 border-b text-sm text-muted-foreground">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="flex justify-between sm:flex-col sm:gap-0.5">
              <span className="font-medium">{t('mailbox.created')}</span>
              <span>{formatFullDate(mailbox.createdAt)}</span>
            </div>
            <div className="flex justify-between sm:flex-col sm:gap-0.5 sm:text-center">
              <span className="font-medium">{t('mailbox.expiresAt')}</span>
              <span>{formatFullDate(mailbox.expiresAt)}</span>
            </div>
            <div className="flex justify-between sm:flex-col sm:gap-0.5 sm:text-right">
              <span className="font-medium">{t('mailbox.timeLeft')}</span>
              <span className={mailbox.expiresAt - Math.floor(Date.now() / 1000) < 3600 ? 'text-red-500 font-semibold' : ''}>{calculateTimeLeft(mailbox.expiresAt)}</span>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex justify-between items-center px-5 py-3 bg-muted/20">
        <div className="flex items-center gap-3">
          {emails.length > 0 && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedEmailIds.size === emails.length && emails.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-sm text-muted-foreground">
                {selectedEmailIds.size > 0 
                  ? t('email.selectedCount', { count: selectedEmailIds.size })
                  : t('email.selectAll')}
              </span>
            </label>
          )}
          <span className="text-sm font-medium text-muted-foreground">
            {emails.length} {emails.length === 1 ? t('email.message') : t('email.messages')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {selectedEmailIds.size > 0 && (
            <>
              <button
                onClick={handleBatchMarkAsRead}
                disabled={isBatchOperating}
                className="px-3 py-1.5 rounded-full bg-muted/60 hover:bg-muted/80 text-foreground hover:text-primary border border-border/60 hover:border-border flex items-center gap-1.5 text-sm disabled:opacity-50"
                title={t('email.batchMarkAsRead')}
              >
                <i className="fas fa-envelope-open text-xs"></i>
                <span className="hidden sm:inline">{t('email.batchMarkAsRead')}</span>
              </button>
              <button
                onClick={handleBatchMarkAsUnread}
                disabled={isBatchOperating}
                className="px-3 py-1.5 rounded-full bg-muted/60 hover:bg-muted/80 text-foreground hover:text-primary border border-border/60 hover:border-border flex items-center gap-1.5 text-sm disabled:opacity-50"
                title={t('email.batchMarkAsUnread')}
              >
                <i className="fas fa-envelope text-xs"></i>
                <span className="hidden sm:inline">{t('email.batchMarkAsUnread')}</span>
              </button>
              <button
                onClick={handleBatchDelete}
                disabled={isBatchOperating}
                className="px-3 py-1.5 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 hover:border-red-500 flex items-center gap-1.5 text-sm disabled:opacity-50"
                title={t('email.batchDelete')}
              >
                <i className="fas fa-trash text-xs"></i>
                <span className="hidden sm:inline">{t('email.batchDelete')}</span>
              </button>
            </>
          )}
          <button
            onClick={handleRefresh}
            className="px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 hover:border-primary flex items-center gap-1.5 text-sm"
            title={t('email.refresh')}
          >
            <i className="fas fa-sync-alt text-xs"></i>
            <span>{t('email.refresh')}</span>
          </button>
          <button
            onClick={toggleAutoRefresh}
            className={`px-3 py-1.5 rounded-full border text-sm flex items-center gap-1.5 ${
              autoRefresh
                ? 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
                : 'bg-muted/60 hover:bg-muted/80 text-foreground hover:text-primary border-border/60 hover:border-border'
            }`}
            title={autoRefresh ? t('email.autoRefreshOn') : t('email.autoRefreshOff')}
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-green-500' : 'bg-gray-400'}`} />
          </button>
        </div>
      </div>
      
      {emails.length === 0 ? (
        <div className="p-10 text-center text-muted-foreground">
          <div className="text-5xl mb-4 opacity-20"><i className="fas fa-envelope-open-text"></i></div>
          <p className="text-lg font-medium">{t('email.emptyInbox')}</p>
          <p className="text-sm mt-2">{t('email.waitingForEmails')}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border/50">
          {emails.map((email) => (
            <React.Fragment key={email.id}>
              <li 
                className={`px-5 py-4 cursor-pointer transition-colors ${
                  selectedEmailId === email.id ? 'bg-primary/5' : 'hover:bg-muted/40'
                } ${!email.isRead ? 'bg-primary/[0.02] border-l-2 border-primary' : 'border-l-2 border-transparent'}`}
                onClick={() => onSelectEmail(selectedEmailId === email.id ? null : email.id)}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedEmailIds.has(email.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleEmailSelection(email.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className={`truncate flex items-center gap-1.5 ${!email.isRead ? 'font-medium text-foreground' : 'text-foreground'}`}>
                        {!email.isRead && <span className="w-2 h-2 rounded-full bg-primary inline-block"></span>}
                        {email.isInternal && (
                          <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
                            {t('email.internal')}
                          </span>
                        )}
                        {email.fromName || email.fromAddress}
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        {email.isInternal && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/internal-chat?peer=${encodeURIComponent(email.fromAddress)}`);
                            }}
                            className="px-2.5 py-1 text-xs rounded-full bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30 hover:border-green-500 transition-colors"
                            title={t('email.enterChat')}
                          >
                            <i className="fas fa-comments mr-1"></i>
                            {t('email.enterChat')}
                          </button>
                        )}
                        <span className="text-sm text-muted-foreground whitespace-nowrap tabular-nums">
                          {formatDate(email.receivedAt)}
                        </span>
                      </span>
                    </div>
                    <div className={`text-sm truncate ${!email.isRead ? 'font-medium' : 'text-muted-foreground'}`}>
                      {email.subject || <span className="italic opacity-60">{t('email.noSubject')}</span>}
                    </div>
                  </div>
                </div>
              </li>
              {selectedEmailId === email.id && (
                <li className="border-t border-border/50 bg-muted/10">
                  <EmailDetail 
                    emailId={email.id} 
                    onClose={() => onSelectEmail(null)}
                  />
                </li>
              )}
            </React.Fragment>
          ))}
        </ul>
      )}
    </div>
      <UserInfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        randomName={randomName}
        countries={COUNTRIES}
        selectedCountry={selectedCountry}
        onCountryChange={handleCountryChange}
        onRegenerate={regenerateName}
        generating={isNameLoading}
      />
    </>
  );
};

export default EmailList;
