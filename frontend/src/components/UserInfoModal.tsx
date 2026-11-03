import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { MailboxContext } from '../contexts/MailboxContext';
import { RandomName } from '../utils/nameGenerator';
import { CountryInfo } from '../utils/countryData';
import { copyText } from '../lib/utils';

interface UserInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  randomName: RandomName;
  countries: CountryInfo[];
  selectedCountry: string;
  onCountryChange: (countryCode: string) => void | Promise<void>;
  onRegenerate?: (countryCode?: string) => void | Promise<void>;
  generating?: boolean;
}

const UserInfoModal: React.FC<UserInfoModalProps> = ({ isOpen, onClose, randomName, countries, selectedCountry, onCountryChange, onRegenerate, generating }) => {
  const { t, i18n } = useTranslation();
  const { showSuccessMessage } = useContext(MailboxContext);

  if (!isOpen) return null;

  const copyToClipboard = async (text: string, label: string) => {
    const ok = await copyText(text);
    if (ok) showSuccessMessage(`${label} ${t('common.copied')}`);
  };

  interface InfoItemProps {
    label: string;
    value: string;
  }

  const InfoRow: React.FC<InfoItemProps> = ({ label, value }) => (
    <div className="flex items-center justify-between py-2 border-b border-muted/50 last:border-0">
      <span className="text-sm text-muted-foreground min-w-[90px]">{label}</span>
      <div className="flex items-center gap-2 flex-1 justify-end">
        <span
          onClick={() => copyToClipboard(value, label)}
          className="text-sm text-right truncate max-w-[280px] cursor-pointer hover:text-primary transition-colors"
          title={`${label}: ${value}`}
        >
          {value}
        </span>
        <button
          onClick={() => copyToClipboard(value, label)}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-primary shrink-0"
          title={t('common.copy')}
        >
          <i className="fas fa-copy text-sm"></i>
        </button>
      </div>
    </div>
  );

  const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="mb-4">
      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">{title}</h4>
      <div className="bg-muted/30 rounded-md px-4 py-2">{children}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-background rounded-lg shadow-xl w-[560px] max-w-[95vw] max-h-[85vh] mx-4 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold">{t('email.userInfo')}</h2>
            <span className="text-sm text-muted-foreground whitespace-nowrap">{t('email.selectCountry')}</span>
            <select
              value={selectedCountry}
              onChange={(e) => onCountryChange(e.target.value)}
              disabled={generating}
              className="px-2 py-1 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background disabled:opacity-50"
            >
              {countries.map(c => (
                <option key={c.code} value={c.code}>{i18n.language?.startsWith('zh') ? c.name : c.englishName}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onRegenerate?.(selectedCountry)}
              disabled={generating}
              className="px-3 py-1.5 text-sm rounded-md border border-muted-foreground/30 hover:border-muted-foreground/60 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 disabled:opacity-50"
              title={t('email.regenerate')}
            >
              {generating ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
              ) : (
                <i className="fas fa-shuffle"></i>
              )}
              <span>{generating ? '' : t('email.regenerate')}</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto">
          <Section title={t('email.sectionPersonal')}>
            <InfoRow label={t('email.fullName')} value={randomName.fullName} />
            <InfoRow label={t('email.firstName')} value={randomName.firstName} />
            <InfoRow label={t('email.lastName')} value={randomName.lastName} />
            <InfoRow label={t('email.gender')} value={randomName.gender} />
            <InfoRow label={t('email.birthday')} value={randomName.birthday} />
            <InfoRow label={t('email.title')} value={randomName.title} />
          </Section>

          <Section title={t('email.sectionAddress')}>
            <InfoRow label={t('email.streetAddress')} value={randomName.streetAddress} />
            <InfoRow label={t('email.city')} value={randomName.city} />
            <InfoRow label={t('email.state')} value={`${randomName.state} (${randomName.stateFull})`} />
            <InfoRow label={t('email.zipCode')} value={randomName.zipCode} />
            <InfoRow label={t('email.country')} value={countries.find(c => c.code === selectedCountry)?.englishName || randomName.countryName} />
            <div className="flex items-start justify-between py-2 border-b border-muted/50 last:border-0">
              <span className="text-sm text-muted-foreground min-w-[90px]">{t('email.fullAddress')}</span>
              <div className="flex items-start gap-2 flex-1 justify-end">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(randomName.fullAddress.replace(/\n/g, ", "))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-500/15 text-red-500 hover:text-red-600 shrink-0 mt-0.5"
                  title={t('email.viewOnGoogleMaps')}
                >
                  <i className="fas fa-map-marker-alt text-sm"></i>
                </a>
                <pre
                  onClick={() => copyToClipboard(randomName.fullAddress, t('email.fullAddress'))}
                  className="text-sm text-right whitespace-pre-line leading-relaxed cursor-pointer hover:text-primary transition-colors"
                  title={t('email.copyFullAddress')}
                >{randomName.fullAddress}</pre>
                <button
                  onClick={() => copyToClipboard(randomName.fullAddress, t('email.fullAddress'))}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-primary shrink-0 mt-0.5"
                  title={t('email.copyFullAddress')}
                >
                  <i className="fas fa-copy text-sm"></i>
                </button>
              </div>
            </div>
          </Section>

          <Section title={t('email.sectionContact')}>
            <InfoRow label={t('email.telephone')} value={randomName.telephone} />
          </Section>

          <Section title={t('email.sectionAccount')}>
            <InfoRow label={t('email.username')} value={randomName.username} />
            <InfoRow label={t('email.password')} value={randomName.password} />
          </Section>

          <Section title={t('email.sectionWork')}>
            <InfoRow label={t('email.company')} value={randomName.company} />
            <InfoRow label={t('email.occupation')} value={randomName.occupation} />
          </Section>

          <Section title={t('email.sectionFinancial')}>
            <InfoRow label={t('email.ssn')} value={randomName.ssn} />
            <InfoRow label={t('email.creditCardType')} value={randomName.creditCardType} />
            <InfoRow label={t('email.creditCardNumber')} value={randomName.creditCardNumber} />
            <InfoRow label={t('email.cvv2')} value={randomName.cvv2} />
            <InfoRow label={t('email.expires')} value={randomName.expires} />
          </Section>

        </div>
      </div>
    </div>
  );
};

export default UserInfoModal;
