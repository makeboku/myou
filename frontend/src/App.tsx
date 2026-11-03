import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import ChatPage from './pages/ChatPage';
import InternalChatPage from './pages/InternalChatPage';
import NotFoundPage from './pages/NotFoundPage';
import { MailboxProvider } from './contexts/MailboxContext';

const App: React.FC = () => {

  return (
      <MailboxProvider>
        <div className="min-h-screen bg-background">
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<HomePage />} />
              {/* 移除了 privacy-policy 和 terms 的路由 */}
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/internal-chat" element={<InternalChatPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </div>
      </MailboxProvider>
  );
};

export default App;
