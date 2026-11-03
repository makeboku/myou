import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useContext } from 'react';
import { MailboxContext } from '../contexts/MailboxContext';
import LanguageSwitcher from './LanguageSwitcher';
import HeaderMailbox from './HeaderMailbox';
import Container from './Container';
import ThemeSwitcher from './ThemeSwitcher';
import { getExternalLinks, getSiteConfig, SITE_NAME, OTHER_SITE_URL, OTHER_SITE_LABEL } from '../config';
import { getUnreadChatCount } from '../utils/api';

interface ExternalLink {
  label: string;
  url: string;
}

const DEFAULT_LINKS = '临时Gmail邮箱|https://smailpro.com/temporary-email,真实地址生成器|https://ip.alice7.eu.org/';

function parseExternalLinks(raw: string): ExternalLink[] {
  return raw.split(',').filter(Boolean).map(pair => {
    const [label, url] = pair.split('|');
    return { label: label?.trim() || url, url: url?.trim() || '' };
  }).filter(l => l.url);
}

interface HeaderProps {
  mailbox: (Mailbox & { password: string }) | null;
  onMailboxChange?: (mailbox: Mailbox & { password: string }) => void;
  isLoading?: boolean;
}

const Header: React.FC<HeaderProps> = ({ 
  mailbox = null, 
  onMailboxChange = () => {}, 
  isLoading = false 
}) => {
  const { t } = useTranslation();
  const { setShowPasswordDialog } = useContext(MailboxContext);
  const location = useLocation();
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // 双站点配置（首屏用构建时变量，挂载后再向 /api/config 拉取最新值）
  const [siteName, setSiteName] = useState(SITE_NAME);
  const [otherSiteUrl, setOtherSiteUrl] = useState(OTHER_SITE_URL);
  const [otherSiteLabel, setOtherSiteLabel] = useState(OTHER_SITE_LABEL);

  useEffect(() => {
    getSiteConfig().then(config => {
      setSiteName(config.siteName);
      setOtherSiteUrl(config.otherSiteUrl);
      setOtherSiteLabel(config.otherSiteLabel);
    }).catch(() => {});
  }, []);

  // 站内聊天未读数角标（进入聊天页会由服务端标记已读）
  useEffect(() => {
    if (!mailbox) {
      setUnreadChatCount(0);
      return;
    }
    if (location.pathname.startsWith('/internal-chat')) {
      setUnreadChatCount(0);
      return;
    }
    let cancelled = false;
    const fetchCount = async () => {
      const result = await getUnreadChatCount(mailbox.address, mailbox.password);
      if (!cancelled && result.success) {
        setUnreadChatCount(result.count ?? 0);
      }
    };
    fetchCount();
    const intervalId = window.setInterval(fetchCount, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [mailbox, location.pathname]);
  
  const titleElement = otherSiteUrl ? (
    <a href={otherSiteUrl} className="text-xl md:text-2xl font-bold tracking-tight hover:text-primary transition-colors">
      {otherSiteLabel || siteName}
    </a>
  ) : (
    <Link to="/" className="text-xl md:text-2xl font-bold tracking-tight hover:text-primary transition-colors">
      {siteName || t('app.title')}
    </Link>
  );

  return (
    <header className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-40">
      <Container>
        <div className="flex items-center justify-between py-4">
          {titleElement}
          
          <div className="flex items-center bg-muted/60 rounded-xl px-3 py-1.5 shadow-sm">
            {mailbox ? (
              <>
                <Link
                  to="/internal-chat"
                  className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-primary/15 hover:text-primary transition-all duration-200 text-lg mr-2"
                  title={t('internalChat.title')}
                >
                  <i className="fas fa-comments"></i>
                  {unreadChatCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {unreadChatCount > 99 ? '99+' : unreadChatCount}
                    </span>
                  )}
                </Link>
                <HeaderMailbox 
                  mailbox={mailbox} 
                  onMailboxChange={onMailboxChange}
                  isLoading={isLoading}
                />
              </>
            ) : (
              <button
                onClick={() => setShowPasswordDialog(true)}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-primary/15 hover:text-primary transition-all duration-200 text-lg"
                title={t('intro.hero.createBtn')}
              >
                <i className="fas fa-plus"></i>
              </button>
            )}
            
            <div className={`flex items-center ${mailbox ? 'ml-3 pl-3 border-l border-border' : 'ml-1'}`}>
              <div className="border-r border-border pr-1">
                <ThemeSwitcher />
              </div>
              <div className="border-r border-border px-1">
                <LanguageSwitcher />
              </div>
              <div className="pl-1">
                <ExternalLinksDropdown />
              </div>
            </div>
          </div>
        </div>
      </Container>
    </header>
  );
};

const ExternalLinksDropdown: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<ExternalLink[]>(() => parseExternalLinks(import.meta.env.VITE_EXTERNAL_LINKS || ''));

  useEffect(() => {
    getExternalLinks().then(raw => {
      const parsed = parseExternalLinks(raw || DEFAULT_LINKS);
      if (parsed.length > 0) setLinks(parsed);
    });
  }, []);

  if (links.length === 0) return null;

  return (
    <div className="relative ml-1.5">
      <button
        onClick={() => setOpen(!open)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="px-3 h-9 flex items-center justify-center rounded-lg transition-all duration-200 hover:bg-primary/15 hover:text-primary text-sm font-semibold whitespace-nowrap gap-1.5"
      >
        <i className="fas fa-link text-xs opacity-60"></i>
        <span>工具</span>
        <i className={`fas fa-chevron-down text-[10px] opacity-50 transition-transform ${open ? 'rotate-180' : ''}`}></i>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 rounded-xl bg-popover border shadow-xl z-50 py-1.5 overflow-hidden">
          {links.slice(0, 5).map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-popover-foreground hover:bg-muted transition-colors"
            >
              <i className="fas fa-external-link-alt text-xs text-muted-foreground/50 w-3.5"></i>
              {link.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

export default Header;
