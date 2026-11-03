import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Container from "./Container";
import { getStats } from "../utils/api";

// 定义 props 类型，允许父组件传递控制弹窗显示的函数
interface FooterProps {
  onShowInfo: (infoType: "privacy" | "terms" | "about") => void;
}

const Footer: React.FC<FooterProps> = ({ onShowInfo }) => {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  const [mailboxCount, setMailboxCount] = useState<number | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      const result = await getStats();
      if (result.success && result.stats) {
        setMailboxCount(result.stats.mailboxCount);
      }
    };
    fetchStats();
  }, []);

  return (
    <footer className="border-t py-8 mt-8 bg-card/50">
      <Container>
        <div className="text-center text-sm text-muted-foreground">
          {mailboxCount !== null && (
            <p className="mb-3 text-muted-foreground">
              <i className="fas fa-envelope mr-1.5"></i>
              {t("footer.mailboxCount", { count: mailboxCount })}
            </p>
          )}
          <p className="mb-3">
            © {year} {t("app.title")}
          </p>

          <div className="flex flex-wrap justify-center items-center gap-4">
            <button
              onClick={() => onShowInfo("privacy")}
              className="hover:text-primary transition-colors font-medium"
            >
              {t("common.privacyPolicy", "隐私政策")}
            </button>
            <button
              onClick={() => onShowInfo("terms")}
              className="hover:text-primary transition-colors font-medium"
            >
              {t("common.terms", "使用条款")}
            </button>
            <button
              onClick={() => onShowInfo("about")}
              className="hover:text-primary transition-colors font-medium"
            >
              {t("common.about", "关于我们")}
            </button>
          </div>
        </div>
      </Container>
    </footer>
  );
};

export default Footer;
