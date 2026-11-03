import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import EmailList from '../components/EmailList';
import { MailboxContext } from '../contexts/MailboxContext';
import Container from '../components/Container';
import CreateLoginDialog from '../components/CreateLoginDialog';
import { getSiteConfig, SITE_MODE, SITE_NAME } from '../config';

const StructuredData: React.FC = () => {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "秒邮-永久匿名邮箱",
    "applicationCategory": "UtilityApplication",
    "operatingSystem": "All",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "CNY"
    },
    "description": "创建永久邮箱地址，接收邮件，支持密码登录找回，保护您的隐私安全",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "1024"
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
};

const FAQItem: React.FC<{ question: string; answer: string }> = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        className="w-full py-4 flex items-center justify-between text-left hover:text-primary transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="font-medium">{question}</span>
        <i className={`fas fa-chevron-down transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}></i>
      </button>
      {isOpen && (
        <div className="pb-4 text-muted-foreground">
          {answer}
        </div>
      )}
    </div>
  );
};

const StepCard: React.FC<{ step: string; title: string; description: string; icon: string; color: string }> = ({ step, title, description, icon, color }) => (
  <div className="flex flex-col items-center text-center group">
    <div className={`w-20 h-20 rounded-2xl ${color} flex items-center justify-center mb-4 relative group-hover:scale-110 transition-transform`}>
      <i className={`fas ${icon} text-4xl`}></i>
      <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-sm">
        {step}
      </span>
    </div>
    <h3 className="text-lg font-bold mb-2">{title}</h3>
    <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">{description}</p>
  </div>
);

const HomePage: React.FC = () => {
  const { t } = useTranslation();
  const { 
    mailbox, 
    isLoading, 
    emails, 
    selectedEmail, 
    setSelectedEmail, 
    isEmailsLoading,
    showPasswordDialog,
    setShowPasswordDialog
  } = useContext(MailboxContext);

  // 双站点配置：首屏用构建时变量，挂载后从 /api/config 获取服务端最新配置
  const [siteMode, setSiteMode] = useState<'temp' | 'perm'>(SITE_MODE);
  const [siteName, setSiteName] = useState(SITE_NAME);
  useEffect(() => {
    getSiteConfig().then(config => {
      setSiteMode(config.siteMode);
      setSiteName(config.siteName || SITE_NAME);
    }).catch(() => {});
  }, []);
  
  if (isLoading) {
    return (
      <Container>
        <div className="flex justify-center items-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Container>
    );
  }
  
  const openLogin = () => {
    setShowPasswordDialog(true);
    setTimeout(() => {
      const loginTab = document.querySelector('[data-tab="login"]');
      if (loginTab) (loginTab as HTMLElement).click();
    }, 100);
  };
  
  return (
    <Container>
      <StructuredData />
      <CreateLoginDialog isOpen={showPasswordDialog} onDismiss={() => setShowPasswordDialog(false)} />
      
      {mailbox && (
        <EmailList 
          emails={emails} 
          selectedEmailId={selectedEmail}
          onSelectEmail={setSelectedEmail}
          isLoading={isEmailsLoading}
        />
      )}
      
      {!mailbox && (
        <div className="text-center space-y-10 py-20">
          <div className="space-y-6">
            <h1 className="text-5xl md:text-7xl font-extrabold bg-gradient-to-r from-indigo-900 via-blue-800 to-cyan-700 bg-clip-text text-transparent leading-tight">
              {siteMode === 'temp' ? (siteName || t('intro.temp.title')) : t('intro.hero.title')}
            </h1>
            <p className="text-[10px] sm:text-sm md:text-lg lg:text-xl xl:text-2xl bg-gradient-to-r from-blue-700 via-indigo-600 to-violet-600 bg-clip-text text-transparent mx-auto leading-relaxed font-bold whitespace-nowrap">
              {siteMode === 'temp' ? t('intro.temp.subtitle') : t('intro.hero.subtitle')}
            </p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-4">
            {siteMode === 'perm' ? (
              <>
                <div className="px-6 py-3 rounded-full bg-primary/10 text-primary font-bold text-base md:text-lg border border-primary/20 shadow-sm">
                  <i className="fas fa-infinity mr-2 text-lg"></i>
                  {t('intro.hero.stats.permanent')}
                </div>
                <div className="px-6 py-3 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 font-bold text-base md:text-lg border border-green-500/20 shadow-sm">
                  <i className="fas fa-key mr-2 text-lg"></i>
                  {t('intro.hero.stats.secure')}
                </div>
                <div className="px-6 py-3 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-base md:text-lg border border-purple-500/20 shadow-sm">
                  <i className="fas fa-user-secret mr-2 text-lg"></i>
                  {t('intro.hero.stats.anonymous')}
                </div>
              </>
            ) : (
              <>
                <div className="px-6 py-3 rounded-full bg-primary/10 text-primary font-bold text-base md:text-lg border border-primary/20 shadow-sm">
                  <i className="fas fa-bolt mr-2 text-lg"></i>
                  {t('intro.temp.badgeInstant')}
                </div>
                <div className="px-6 py-3 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 font-bold text-base md:text-lg border border-green-500/20 shadow-sm">
                  <i className="fas fa-shield-alt mr-2 text-lg"></i>
                  {t('intro.temp.badgePrivacy')}
                </div>
                <div className="px-6 py-3 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold text-base md:text-lg border border-orange-500/20 shadow-sm">
                  <i className="fas fa-clock mr-2 text-lg"></i>
                  {t('intro.temp.badgeAutoClean')}
                </div>
              </>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5 pt-8">
            <button
              onClick={() => setShowPasswordDialog(true)}
              className="w-full sm:w-auto px-12 py-5 text-xl rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all hover:shadow-2xl hover:shadow-primary/30 font-bold"
            >
              <i className="fas fa-plus mr-2"></i>
              {siteMode === 'temp' ? t('intro.temp.createBtn') : t('intro.hero.createBtn')}
            </button>
            {siteMode === 'perm' && (
              <button
                onClick={openLogin}
                className="w-full sm:w-auto px-12 py-5 text-xl rounded-2xl bg-card border-2 border-border hover:border-primary hover:bg-muted/50 transition-all hover:shadow-lg font-bold"
              >
                <i className="fas fa-sign-in-alt mr-2"></i>
                {t('intro.hero.loginBtn')}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-24 py-16">
          {/* 功能介绍 - 2行2列 */}
          <section>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-extrabold mb-4">{t('intro.features.title')}</h2>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto">{t('intro.features.subtitle')}</p>
            </div>
            <div className="grid md:grid-cols-2 gap-5">
              <div className="bg-card rounded-2xl p-7 border hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-0.5 group">
                <div className="flex items-start gap-5">
                  <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <i className="fas fa-shield-alt text-4xl text-primary"></i>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold mb-2">{t('intro.features.privacy.title')}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{t('intro.features.privacy.description')}</p>
                  </div>
                </div>
              </div>
              <div className="bg-card rounded-2xl p-7 border hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-0.5 group">
                <div className="flex items-start gap-5">
                  <div className="w-20 h-20 rounded-2xl bg-green-500/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <i className="fas fa-infinity text-4xl text-green-500"></i>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold mb-2">{t('intro.features.permanent.title')}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{t('intro.features.permanent.description')}</p>
                  </div>
                </div>
              </div>
              <div className="bg-card rounded-2xl p-7 border hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-0.5 group">
                <div className="flex items-start gap-5">
                  <div className="w-20 h-20 rounded-2xl bg-purple-500/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <i className="fas fa-user-secret text-4xl text-purple-500"></i>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold mb-2">{t('intro.features.anonymous.title')}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{t('intro.features.anonymous.description')}</p>
                  </div>
                </div>
              </div>
              <div className="bg-card rounded-2xl p-7 border hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-0.5 group">
                <div className="flex items-start gap-5">
                  <div className="w-20 h-20 rounded-2xl bg-orange-500/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <i className="fas fa-key text-4xl text-orange-500"></i>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold mb-2">{t('intro.features.secure.title')}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{t('intro.features.secure.description')}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
          
          {/* 使用步骤 */}
          <section>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-extrabold mb-4">{t('intro.steps.title')}</h2>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto">{t('intro.steps.subtitle')}</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              <StepCard 
                step="1" 
                title={t('intro.steps.step1.title')} 
                description={t('intro.steps.step1.description')} 
                icon="fa-plus-circle" 
                color="bg-primary/10" 
              />
              <StepCard 
                step="2" 
                title={t('intro.steps.step2.title')} 
                description={t('intro.steps.step2.description')} 
                icon="fa-copy" 
                color="bg-blue-500/10" 
              />
              <StepCard 
                step="3" 
                title={t('intro.steps.step3.title')} 
                description={t('intro.steps.step3.description')} 
                icon="fa-envelope-open-text" 
                color="bg-green-500/10" 
              />
            </div>
          </section>
          
          {/* 使用场景 */}
          <section>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-extrabold mb-4">{t('intro.useCases.title')}</h2>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto">{t('intro.useCases.subtitle')}</p>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              <div className="bg-card rounded-2xl p-7 border text-center hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-0.5 group">
                <div className="w-20 h-20 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                  <i className="fas fa-check-circle text-4xl text-blue-500"></i>
                </div>
                <h3 className="text-lg font-bold mb-2">{t('intro.useCases.verification.title')}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t('intro.useCases.verification.description')}</p>
              </div>
              <div className="bg-card rounded-2xl p-7 border text-center hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-0.5 group">
                <div className="w-20 h-20 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                  <i className="fas fa-download text-4xl text-green-500"></i>
                </div>
                <h3 className="text-lg font-bold mb-2">{t('intro.useCases.downloads.title')}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t('intro.useCases.downloads.description')}</p>
              </div>
              <div className="bg-card rounded-2xl p-7 border text-center hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-0.5 group">
                <div className="w-20 h-20 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                  <i className="fas fa-user-shield text-4xl text-purple-500"></i>
                </div>
                <h3 className="text-lg font-bold mb-2">{t('intro.useCases.privacy.title')}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t('intro.useCases.privacy.description')}</p>
              </div>
              <div className="bg-card rounded-2xl p-7 border text-center hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-0.5 group">
                <div className="w-20 h-20 rounded-2xl bg-orange-500/10 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                  <i className="fas fa-code text-4xl text-orange-500"></i>
                </div>
                <h3 className="text-lg font-bold mb-2">{t('intro.useCases.testing.title')}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t('intro.useCases.testing.description')}</p>
              </div>
              <div className="bg-card rounded-2xl p-7 border text-center hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-0.5 group">
                <div className="w-20 h-20 rounded-2xl bg-pink-500/10 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                  <i className="fas fa-comments text-4xl text-pink-500"></i>
                </div>
                <h3 className="text-lg font-bold mb-2">{t('intro.useCases.forum.title')}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t('intro.useCases.forum.description')}</p>
              </div>
              <div className="bg-card rounded-2xl p-7 border text-center hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-0.5 group">
                <div className="w-20 h-20 rounded-2xl bg-yellow-500/10 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                  <i className="fas fa-shopping-cart text-4xl text-yellow-500"></i>
                </div>
                <h3 className="text-lg font-bold mb-2">{t('intro.useCases.shopping.title')}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t('intro.useCases.shopping.description')}</p>
              </div>
            </div>
          </section>
          
          {/* 安全提示 */}
          <section>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-extrabold mb-4">{t('intro.security.title')}</h2>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto">{t('intro.security.subtitle')}</p>
            </div>
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100/50 dark:from-yellow-950/20 dark:to-yellow-900/10 border-2 border-yellow-500/20 rounded-2xl p-7 space-y-4 security-warning-card shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-exclamation-triangle text-lg text-yellow-500"></i>
                </div>
                <p className="text-sm leading-relaxed break-words">{t('intro.security.warning1')}</p>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-trash-alt text-lg text-red-500"></i>
                </div>
                <p className="text-sm leading-relaxed break-words">{t('intro.security.warning3')}</p>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-clock text-lg text-orange-500"></i>
                </div>
                <p className="text-sm leading-relaxed break-words">{t('intro.security.warning4')}</p>
              </div>
            </div>
          </section>
          
          {/* FAQ */}
          <section>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-extrabold mb-4">{t('intro.faq.title')}</h2>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto">{t('intro.faq.subtitle')}</p>
            </div>
            <div className="bg-card rounded-2xl border-2 p-7 shadow-sm">
              <FAQItem question={t('intro.faq.q1.question')} answer={t('intro.faq.q1.answer')} />
              <FAQItem question={t('intro.faq.q2.question')} answer={t('intro.faq.q2.answer')} />
              <FAQItem question={t('intro.faq.q3.question')} answer={t('intro.faq.q3.answer')} />
              <FAQItem question={t('intro.faq.q4.question')} answer={t('intro.faq.q4.answer')} />
            </div>
          </section>
          
          {/* CTA */}
          {!mailbox && (
            <section className="bg-gradient-to-br from-primary/10 via-blue-500/5 to-indigo-500/10 rounded-3xl p-12 md:p-16 text-center border border-primary/10 shadow-xl">
              <h2 className="text-3xl md:text-4xl font-extrabold mb-4">{t('intro.cta.title')}</h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">{t('intro.cta.subtitle')}</p>
              <button
                onClick={() => setShowPasswordDialog(true)}
                className="px-12 py-4 text-lg rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all hover:shadow-2xl hover:shadow-primary/30 font-bold"
              >
                <i className="fas fa-rocket mr-2"></i>
                {t('intro.cta.btn')}
              </button>
            </section>
          )}
        </div>
    </Container>
  );
};

export default HomePage;
