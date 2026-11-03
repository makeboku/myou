import React, { useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, Navigate } from 'react-router-dom';
import { MailboxContext } from '../contexts/MailboxContext';
import Container from '../components/Container';
import { sendInternalMessage, editInternalMessage, deleteChatMessage, getInternalChat, getFullInternalChat, clearInternalChat, getInternalChatConversations, uploadChatAttachments, downloadChatAttachment, syncChatReadStatus, InternalChatMessage, getMailboxFromLocalStorage } from '../utils/api';

const POLL_INTERVAL = 4000;
const READ_SYNC_INTERVAL = 3600000; // 已读回执每小时同步一次

// 常用 emoji（供快速插入）
const EMOJIS = [
  '😀','😄','😁','😆','😊','😍','🥰','😘','😎','🤗',
  '🤔','😅','😂','🤣','😉','🙂','😇','🥳','😜','🤪',
  '😴','🥺','😢','😭','😤','😠','🤯','🥵','😱','🤩',
  '👍','👎','👏','🙏','💪','🤝','✌️','🤞','👌','✨',
  '❤️','💖','🔥','⭐','🎉','🎂','🍀','🌸','❤','💯'
];

interface PendingFile {
  id: string;
  name: string;
  size: number;
  base64: string;
  mimeType: string;
}

const InternalChatPage: React.FC = () => {
  const { t } = useTranslation();
  const { mailbox, showSuccessMessage, showErrorMessage } = useContext(MailboxContext);
  const [searchParams] = useSearchParams();

  const [peer, setPeer] = useState('');
  const [connectedPeer, setConnectedPeer] = useState('');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<InternalChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showClearMenu, setShowClearMenu] = useState(false);
  const [showEmojiBar, setShowEmojiBar] = useState(false);
  const [penders, setPenders] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; msgId: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editing, setEditing] = useState(false);
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const pendingTempId = useRef<string | null>(null);

  // 联系人昵称备注（本地存储，key 含本人邮箱避免多账号冲突）
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [editingRemark, setEditingRemark] = useState<string | null>(null);
  const [remarkDraft, setRemarkDraft] = useState('');
  // 防止 Enter/Escape 后 blur 再次触发保存导致昵称被误删
  const remarkGuardRef = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesListRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const sinceRef = useRef(0);
  const messagesRef = useRef<InternalChatMessage[]>([]);
  const myAddress = mailbox?.address || '';

  // 未登录直接跳回首页（同步读取本地存储，避免邮箱从会话恢复完成前的闪烁跳转）
  const [hasSavedMailbox] = useState(() => {
    try {
      return !!getMailboxFromLocalStorage();
    } catch {
      return false;
    }
  });

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // 切换/恢复账号时：清空旧账号的聊天状态，并按账号恢复上次聊天的对象（避免跨账号串台、聊天记录残留）
  useEffect(() => {
    if (!myAddress) {
      setConnectedPeer('');
      setPeer('');
      setMessages([]);
      sinceRef.current = 0;
      return;
    }

    setMessages([]);
    sinceRef.current = 0;

    // 支持 ?peer=xxx 直达：从收件箱站内消息点击进入时自动开始聊天
    const peerParam = searchParams.get('peer');
    if (peerParam && peerParam.trim()) {
      const target = peerParam.trim().toLowerCase();
      if (target !== myAddress) {
        setPeer(target);
        setConnectedPeer(target);
        try {
          localStorage.setItem(`internalChatPeer:${myAddress}`, target);
        } catch {}
      }
      return;
    }

    // 恢复该账号上次聊天的对象（优先按账号，旧版全局 key 作为兼容回退）
    const saved = (() => {
      try {
        return localStorage.getItem(`internalChatPeer:${myAddress}`) || localStorage.getItem('internalChatPeer') || '';
      } catch {
        return '';
      }
    })();
    if (saved) {
      setPeer(saved);
      setConnectedPeer(saved);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myAddress]);

  // 拉取历史会话列表（联系人），供"开始聊天"页与聊天窗口内的快速切换使用
  useEffect(() => {
    if (!myAddress) {
      setConversations([]);
      return;
    }
    let active = true;
    setConversationsLoading(true);
    getInternalChatConversations(myAddress, mailbox?.password).then(result => {
      if (!active) return;
      if (result.success && result.conversations) {
        setConversations(result.conversations);
      }
    }).finally(() => {
      if (active) setConversationsLoading(false);
    });
    return () => { active = false; };
  }, [myAddress, connectedPeer]);

  // 加载联系人昵称备注
  useEffect(() => {
    if (!myAddress) {
      setRemarks({});
      return;
    }
    try {
      const raw = localStorage.getItem(`internalChatRemarks:${myAddress}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') setRemarks(parsed);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myAddress]);

  const persistRemarks = (next: Record<string, string>) => {
    setRemarks(next);
    if (!myAddress) return;
    try {
      if (Object.keys(next).length === 0) {
        localStorage.removeItem(`internalChatRemarks:${myAddress}`);
      } else {
        localStorage.setItem(`internalChatRemarks:${myAddress}`, JSON.stringify(next));
      }
    } catch {}
  };

  // 保存/清空昵称
  const saveRemark = (peer: string) => {
    if (!remarkGuardRef.current) return;
    remarkGuardRef.current = false;
    const nickname = remarkDraft.trim();
    if (!nickname) {
      persistRemarks(Object.fromEntries(Object.entries(remarks).filter(([k]) => k !== peer)));
      showSuccessMessage(t('internalChat.remarkRemoved'));
    } else {
      persistRemarks({ ...remarks, [peer]: nickname });
      showSuccessMessage(t('internalChat.remarkSaved'));
    }
    setEditingRemark(null);
    setRemarkDraft('');
  };

  // 只滚动消息列表本身，避免 scrollIntoView 带动整页上移、把聊天头部（对方邮箱）顶出视线
  const scrollToBottom = () => {
    const el = messagesListRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 增量轮询：根据维护的 since 只拉取新消息和该时段内的编辑/删除，降低 D1 读取量
  const poll = useCallback(async (isInitial: boolean) => {
    if (!myAddress || !connectedPeer) return;

    const since = isInitial ? 0 : sinceRef.current;
    const result = await getInternalChat(myAddress, connectedPeer, since, mailbox?.password);

    if (result.success) {
      // 删除传播：按 msg_key 移除本地已删消息
      if (result.deletedKeys && result.deletedKeys.length > 0) {
        const delSet = new Set(result.deletedKeys);
        setMessages(prev => prev.filter(m => !(m.msgKey && delSet.has(m.msgKey))));
        if (result.deletedAt) sinceRef.current = Math.max(sinceRef.current, result.deletedAt);
      }

      const incoming = result.messages || [];
      if (incoming.length > 0) {
        setMessages(prev => {
          if (isInitial) return incoming;
          const seen = new Set(prev.map(m => m.id));
          const merged = [...prev];
          for (const m of incoming) {
            const idx = merged.findIndex(x => x.id === m.id);
            if (idx >= 0) {
              merged[idx] = m; // 覆盖：同步编辑后的内容/状态
            } else if (!seen.has(m.id)) {
              // 若这是"我"刚发出的消息，且本地还有一条匹配的乐观占位，则直接替换，避免重复
              if (m.fromAddress === myAddress) {
                const pendingIdx = merged.findIndex(x => x.pending && x.textContent === m.textContent && x.toAddress === m.toAddress);
                if (pendingIdx >= 0) {
                  merged[pendingIdx] = m;
                  seen.add(m.id);
                  continue;
                }
              }
              merged.push(m);
              seen.add(m.id);
            }
          }
          merged.sort((a, b) => a.receivedAt - b.receivedAt);
          return merged;
        });
        const latest = incoming.reduce((max, m) => Math.max(max, m.receivedAt), sinceRef.current);
        sinceRef.current = latest;
      }
    }
  }, [myAddress, connectedPeer]);

  useEffect(() => {
    if (!myAddress || !connectedPeer) return;
    let active = true;
    setLoading(true);
    poll(true).finally(() => {
      if (active) setLoading(false);
    });

    const id = window.setInterval(() => {
      if (active) poll(false);
    }, POLL_INTERVAL);

    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [myAddress, connectedPeer, poll]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [connectedPeer]);

  const handleStart = () => {
    const target = peer.trim().toLowerCase();
    if (!target) return;
    if (target === myAddress) {
      showErrorMessage(t('internalChat.selfError'));
      return;
    }
    setConnectedPeer(target);
    try {
      localStorage.setItem(`internalChatPeer:${myAddress}`, target);
    } catch {}
    sinceRef.current = 0;
    setMessages([]);
  };

  const handleSend = async () => {
    const text = input.trim();
    if ((!text && penders.length === 0) || !myAddress || !connectedPeer || uploading) return;

    // 1. 上传附件（如有）
    let attachmentIds: string[] = [];
    let pendingAttachments: { id: string; filename: string; mimeType: string; size: number }[] = [];
    if (penders.length > 0) {
      setUploading(true);
      const uploadResult = await uploadChatAttachments(myAddress, penders.map(p => ({
        filename: p.name,
        mimeType: p.mimeType,
        content: p.base64,
        size: p.size,
      })), mailbox?.password);
      setUploading(false);
      if (uploadResult.success && uploadResult.attachments) {
        attachmentIds = uploadResult.attachments.map(a => a.id);
        pendingAttachments = uploadResult.attachments;
        setPenders([]);
      } else {
        const msg = typeof uploadResult.error === 'string'
          ? uploadResult.error
          : (uploadResult.error?.message || uploadResult.message || t('internalChat.uploadFailed'));
        showErrorMessage(msg);
        return;
      }
    }

    // 2. 乐观占位：输入框立即清空，消息列表立即追加"发送中"占位消息
    const tmpId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    pendingTempId.current = tmpId;
    const optimisticMsg: InternalChatMessage = {
      id: tmpId,
      fromAddress: myAddress,
      toAddress: connectedPeer,
      fromName: '',
      subject: '',
      textContent: text,
      attachments: pendingAttachments.length > 0 ? pendingAttachments : undefined,
      receivedAt: Math.floor(Date.now() / 1000),
      isRead: true,
      pending: true,
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setInput('');
    setShowEmojiBar(false);
    setSendStatus('sending');
    inputRef.current?.focus();
    scrollToBottom();

    // 3. 后台发送，完成后更新占位消息状态
    try {
      const result = await sendInternalMessage(myAddress, connectedPeer, text, mailbox?.password, attachmentIds);
      pendingTempId.current = null;
      if (result.success && result.message) {
        setMessages(prev => prev.map(m => m.id === tmpId ? { ...result.message!, pending: false } : m));
        sinceRef.current = Math.max(sinceRef.current, result.message.receivedAt);
        setSendStatus('sent');
        setTimeout(() => setSendStatus('idle'), 2000);
        void poll(false);
      } else {
        setMessages(prev => prev.map(m => m.id === tmpId ? { ...m, pending: false, failed: true } : m));
        setSendStatus('failed');
      }
    } catch {
      pendingTempId.current = null;
      setMessages(prev => prev.map(m => m.id === tmpId ? { ...m, pending: false, failed: true } : m));
      setSendStatus('failed');
    }
  };

  const retrySend = async (m: InternalChatMessage) => {
    if (!myAddress || !connectedPeer || uploading) return;
    const text = m.textContent;
    const attachmentIds = (m.attachments || []).map(a => a.id);

    setMessages(prev => prev.map(x => x.id === m.id ? { ...x, pending: true, failed: false } : x));
    setSendStatus('sending');
    pendingTempId.current = m.id;

    try {
      const result = await sendInternalMessage(myAddress, connectedPeer, text, mailbox?.password, attachmentIds);
      pendingTempId.current = null;
      if (result.success && result.message) {
        setMessages(prev => prev.map(x => x.id === m.id ? { ...result.message!, pending: false } : x));
        sinceRef.current = Math.max(sinceRef.current, result.message.receivedAt);
        setSendStatus('sent');
        setTimeout(() => setSendStatus('idle'), 2000);
      } else {
        setMessages(prev => prev.map(x => x.id === m.id ? { ...x, pending: false, failed: true } : x));
        setSendStatus('failed');
      }
    } catch {
      pendingTempId.current = null;
      setMessages(prev => prev.map(x => x.id === m.id ? { ...x, pending: false, failed: true } : x));
      setSendStatus('failed');
    }
  };

  // 选择附件：读取为 base64，暂存待发送（先上传后发送）
  const handlePickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files).slice(0, 5 - penders.length);
    if (list.length === 0) {
      showErrorMessage(t('internalChat.maxAttachments'));
      return;
    }
    for (const file of list) {
      if (file.size > 10 * 1024 * 1024) {
        showErrorMessage(`${file.name}: ${t('internalChat.fileTooLarge')}`);
        continue;
      }
      try {
        const base64 = await fileToBase64(file);
        setPenders(prev => {
          const next = [...prev, { id: `${file.name}-${Date.now()}-${Math.random()}`, name: file.name, size: file.size, base64, mimeType: file.type || 'application/octet-stream' }];
          return next.slice(0, 5);
        });
      } catch {
        showErrorMessage(t('internalChat.uploadFailed'));
      }
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const removePender = (id: string) => {
    setPenders(prev => prev.filter(p => p.id !== id));
  };

  // 右键菜单：复制 / 编辑 / 删除
  const openContextMenu = (e: React.MouseEvent, m: InternalChatMessage) => {
    e.preventDefault();
    setEditKey(null);
    setContextMenu({ x: e.clientX, y: e.clientY, msgId: m.id });
  };

  // 点击空白处 / Esc / 滚动时关闭右键菜单
  useEffect(() => {
    const close = () => setContextMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        setEditKey(null);
      }
    };
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const handleCopyMessage = async (m: InternalChatMessage) => {
    setContextMenu(null);
    const names = (m.attachments || []).map(a => a.filename);
    const text = [m.textContent, ...names].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      showSuccessMessage(t('internalChat.copied'));
    } catch {
      showErrorMessage(t('internalChat.copyFailed'));
    }
  };

  const startEdit = (m: InternalChatMessage) => {
    setContextMenu(null);
    setEditKey(m.msgKey || null);
    setEditText(m.textContent);
  };

  const cancelEdit = () => {
    setEditKey(null);
    setEditText('');
  };

  const saveEdit = async () => {
    if (!editKey) return;
    const msg = messages.find(m => m.msgKey === editKey);
    if (!msg) return;
    const content = editText.trim();
    if (!content) {
      showErrorMessage(t('internalChat.messageEmpty'));
      return;
    }
    if (content === msg.textContent) {
      cancelEdit();
      return;
    }
    setEditing(true);
    const result = await editInternalMessage(myAddress, editKey, content, mailbox?.password);
    setEditing(false);
    if (result.success && result.message) {
      const updated = result.message;
      setMessages(prev => {
        const idx = prev.findIndex(x => x.id === updated.id);
        if (idx < 0) return prev;
        const next = [...prev];
        next[idx] = updated;
        return next;
      });
      cancelEdit();
    } else {
      const err = typeof result.error === 'string' ? result.error : (result.error?.message || t('internalChat.editFailed'));
      showErrorMessage(err);
    }
  };

  const handleDeleteMessage = async (m: InternalChatMessage) => {
    if (!m.msgKey) return;
    setContextMenu(null);
    if (!window.confirm(t('internalChat.deleteConfirm'))) return;
    const result = await deleteChatMessage(myAddress, m.msgKey, mailbox?.password);
    if (result.success) {
      setMessages(prev => prev.filter(x => x.msgKey !== m.msgKey));
      showSuccessMessage(t('internalChat.deleteSuccess'));
    } else {
      const err = typeof result.error === 'string' ? result.error : (result.error?.message || t('internalChat.deleteFailed'));
      showErrorMessage(err);
    }
  };

  // 拖拽上传附件
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handlePickFiles(files);
    }
  };

  // 下载聊天附件
  const handleDownloadAttachment = async (attachmentId: string, filename: string) => {
    if (!myAddress) return;
    try {
      const result = await downloadChatAttachment(myAddress, attachmentId, mailbox?.password);
      if (result.success && result.blob) {
        const url = URL.createObjectURL(result.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename || filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const msg = typeof result.error === 'string' ? result.error : t('internalChat.downloadFailed');
        showErrorMessage(msg);
      }
    } catch {
      showErrorMessage(t('internalChat.downloadFailed'));
    }
  };

  // 已读回执同步（上报已读 + 拉取对方已读，服务端每小时节流）
  const runReadSync = useCallback(async () => {
    if (!myAddress || !connectedPeer) return;
    const visibleIds = messagesRef.current
      .filter(m => m.fromAddress !== myAddress)
      .map(m => m.id)
      .slice(0, 500);
    const result = await syncChatReadStatus(myAddress, visibleIds, mailbox?.password);
    if (result.success && result.readReceipts) {
      setMessages(prev => {
        const receiptMap = new Map(result.readReceipts!.filter(r => r.peer === connectedPeer).map(r => [r.msgKey, r]));
        let changed = false;
        const next = prev.map(m => {
          const rec = m.msgKey ? receiptMap.get(m.msgKey) : undefined;
          if (rec && rec.read && !m.peerRead) {
            changed = true;
            return { ...m, peerRead: true, peerReadAt: rec.readAt };
          }
          return m;
        });
        return changed ? next : prev;
      });
    }
  }, [myAddress, connectedPeer, mailbox?.password]);

  // 打开会话后做一次已读回执同步，并每小时同步一次
  useEffect(() => {
    if (!myAddress || !connectedPeer) return;
    let active = true;
    runReadSync();
    const id = window.setInterval(() => {
      if (active) runReadSync();
    }, READ_SYNC_INTERVAL);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [myAddress, connectedPeer, runReadSync]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const resetChat = () => {
    setConnectedPeer('');
    setPeer('');
    setMessages([]);
    sinceRef.current = 0;
    try {
      localStorage.removeItem(`internalChatPeer:${myAddress}`);
    } catch {}
  };

  // 导出聊天记录为文本文件（拉取完整历史）
  const handleExport = async () => {
    if (!myAddress || !connectedPeer || exporting) return;
    setExporting(true);
    try {
      const result = await getFullInternalChat(myAddress, connectedPeer, mailbox?.password);
      if (!result.success || !result.messages) {
        showErrorMessage(t('internalChat.exportFailed'));
        return;
      }
      const lines: string[] = [];
      lines.push(`=== ${t('internalChat.exportTitle')} ===`);
      lines.push(`${t('internalChat.myAddress')}: ${myAddress}`);
      lines.push(`${t('internalChat.peer')}: ${connectedPeer}`);
      lines.push('');
      for (const m of result.messages) {
        const time = new Intl.DateTimeFormat(undefined, {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
        }).format(new Date(m.receivedAt * 1000));
        const sender = m.fromAddress === myAddress ? `${myAddress} (${t('internalChat.me')})` : connectedPeer;
        lines.push(`[${time}] ${sender}`);
        lines.push(m.textContent || '');
        lines.push('');
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat_${myAddress}_${connectedPeer}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSuccessMessage(t('internalChat.exportSuccess'));
    } catch {
      showErrorMessage(t('internalChat.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  // 清空聊天记录（按小时；0 表示全部）
  const handleClear = async (hours: number) => {
    if (!myAddress || !connectedPeer) return;
    const label = hours === 0
      ? t('internalChat.clearAllConfirm')
      : t('internalChat.clearHoursConfirm', { hours });
    if (!window.confirm(label)) return;

    setClearing(true);
    setShowClearMenu(false);
    try {
      const result = await clearInternalChat(myAddress, connectedPeer, hours, mailbox?.password);
      if (result.success) {
        setMessages([]);
        sinceRef.current = 0;
        showSuccessMessage(t('internalChat.clearSuccess'));
      } else {
        showErrorMessage(t('internalChat.clearFailed'));
      }
    } catch {
      showErrorMessage(t('internalChat.clearFailed'));
    } finally {
      setClearing(false);
    }
  };

  return (
    <Container>
      <div className="max-w-4xl mx-auto h-[calc(100dvh-16rem)] min-h-[320px] flex flex-col">
        {!myAddress ? (
          hasSavedMailbox ? (
            <div className="flex items-center justify-center min-h-[50vh]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <Navigate to="/" replace />
          )
        ) : !connectedPeer ? (
          <div className="flex-1 flex flex-col items-center justify-start min-h-[50vh] pt-6 text-center space-y-5">
            <div>
              <div className="text-5xl opacity-30 mb-4"><i className="fas fa-comments"></i></div>
              <h1 className="text-2xl font-bold mb-2">{t('internalChat.title')}</h1>
              <p className="text-muted-foreground text-sm max-w-md">{t('internalChat.intro')}</p>
              <p className="text-xs text-muted-foreground/70 mt-2">{t('internalChat.myAddress')}: <span className="font-mono text-primary">{myAddress}</span></p>
            </div>

            <div className="w-full max-w-xl text-left">
              <div className="flex items-center gap-2 mb-2 px-1">
                <h2 className="text-sm font-semibold text-muted-foreground">{t('internalChat.conversations')}</h2>
                {conversationsLoading && (
                  <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-primary"></span>
                )}
              </div>
              {!conversationsLoading && conversations.length === 0 ? (
                <div className="bg-muted/40 rounded-xl px-4 py-6 text-center text-sm text-muted-foreground border">
                  {t('internalChat.noConversations')}
                </div>
              ) : (
                <div className="space-y-2 max-h-[35vh] overflow-y-auto">
                  {conversations.map(conv => (
                    <button
                      key={conv.peer}
                      onClick={() => {
                        setConnectedPeer(conv.peer);
                        setPeer(conv.peer);
                        try {
                          localStorage.setItem(`internalChatPeer:${myAddress}`, conv.peer);
                        } catch {}
                        sinceRef.current = 0;
                        setMessages([]);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border bg-background hover:bg-muted/60 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <i className="fas fa-user"></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm truncate font-mono">{remarks[conv.peer] || conv.peer}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">{formatTime(conv.lastAt)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-medium' : 'text-muted-foreground'}`}>
                            {conv.lastMessage || t('internalChat.empty')}
                          </span>
                          {conv.unreadCount > 0 && (
                            <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">
                              {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="w-full max-w-md flex gap-2">
              <input
                type="text"
                value={peer}
                onChange={e => setPeer(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleStart(); }}
                placeholder={t('internalChat.peerPlaceholder')}
                className="flex-1 px-4 py-2.5 rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={handleStart}
                disabled={!peer.trim()}
                className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {t('internalChat.start')}
              </button>
            </div>
            <p className="text-xs text-muted-foreground/60">{t('internalChat.peerHint')}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between py-4 border-b gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={resetChat}
                  className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-muted transition-colors shrink-0"
                  title={t('internalChat.back')}
                >
                  <i className="fas fa-arrow-left"></i>
                </button>
                <div className="min-w-0">
                  {editingRemark === connectedPeer ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={remarkDraft}
                        onChange={e => setRemarkDraft(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            remarkGuardRef.current = true;
                            saveRemark(connectedPeer);
                          }
                          if (e.key === 'Escape') {
                            remarkGuardRef.current = false;
                            setEditingRemark(null);
                            setRemarkDraft('');
                          }
                        }}
                        onBlur={() => {
                          remarkGuardRef.current = true;
                          saveRemark(connectedPeer);
                        }}
                        placeholder={t('internalChat.remarkPlaceholder')}
                        className="w-48 px-2 py-1 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <i className="fas fa-check text-green-500"></i>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5 min-w-0">
                        {remarks[connectedPeer] && (
                          <span className="font-semibold truncate max-w-[140px]">{remarks[connectedPeer]}</span>
                        )}
                        <button
                          onClick={() => {
                            remarkGuardRef.current = true;
                            setRemarkDraft(remarks[connectedPeer] || '');
                            setEditingRemark(connectedPeer);
                          }}
                          className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-muted transition-colors shrink-0"
                          title={t('internalChat.remark')}
                        >
                          <i className="fas fa-pen text-[10px]"></i>
                        </button>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(connectedPeer).then(() => {
                            showSuccessMessage(t('internalChat.copied'));
                          }).catch(() => {
                            showErrorMessage(t('internalChat.copyFailed'));
                          });
                        }}
                        className="block font-mono text-sm truncate max-w-[220px] hover:underline hover:text-primary transition-colors"
                        title={t('internalChat.peerCopy')}
                      >
                        {connectedPeer}
                      </button>
                    </>
                  )}
                  <div className="text-xs text-muted-foreground">{t('internalChat.online')}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground">
                  {messages.length} {t('internalChat.messages')}
                </span>
                <button
                  onClick={handleExport}
                  disabled={exporting || messages.length === 0}
                  className="px-3 py-1.5 text-sm rounded-full bg-muted/60 hover:bg-muted/80 text-foreground hover:text-primary border border-border/60 hover:border-border flex items-center gap-1.5 disabled:opacity-50"
                  title={t('internalChat.export')}
                >
                  <i className="fas fa-download text-xs"></i>
                  <span className="hidden sm:inline">{exporting ? '...' : t('internalChat.export')}</span>
                </button>
                <div className="relative">
                  <button
                    onClick={() => setShowClearMenu(v => !v)}
                    onBlur={() => setTimeout(() => setShowClearMenu(false), 150)}
                    disabled={clearing || messages.length === 0}
                    className="px-3 py-1.5 text-sm rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 hover:border-red-500 flex items-center gap-1.5 disabled:opacity-50"
                    title={t('internalChat.clear')}
                  >
                    <i className="fas fa-trash text-xs"></i>
                    <span className="hidden sm:inline">{clearing ? '...' : t('internalChat.clear')}</span>
                  </button>
                  {showClearMenu && (
                    <div className="absolute right-0 top-full mt-1 w-48 rounded-xl bg-popover border shadow-xl z-50 py-1.5 overflow-hidden">
                      <button
                        className="w-full text-left px-4 py-2.5 text-sm text-popover-foreground hover:bg-muted transition-colors"
                        onClick={() => handleClear(1)}
                      >
                        {t('internalChat.clear1h')}
                      </button>
                      <button
                        className="w-full text-left px-4 py-2.5 text-sm text-popover-foreground hover:bg-muted transition-colors"
                        onClick={() => handleClear(24)}
                      >
                        {t('internalChat.clear24h')}
                      </button>
                      <button
                        className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                        onClick={() => handleClear(0)}
                      >
                        {t('internalChat.clearAll')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {conversations.length > 0 && (
              <div className="flex gap-2 overflow-x-auto py-2 border-b px-1 shrink-0 scrollbar-thin scrollbar-thumb-muted">
                {conversations.map(c => (
                  <button
                    key={c.peer}
                    onClick={() => {
                      if (c.peer === connectedPeer) return;
                      setConnectedPeer(c.peer);
                      setPeer(c.peer);
                      try {
                        localStorage.setItem(`internalChatPeer:${myAddress}`, c.peer);
                      } catch {}
                      sinceRef.current = 0;
                      setMessages([]);
                      inputRef.current?.focus();
                    }}
                    className={`shrink-0 px-3 py-1 rounded-full border text-xs font-mono whitespace-nowrap transition-colors ${
                      c.peer === connectedPeer
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-muted border-border text-muted-foreground hover:text-foreground'
                    }`}
                    title={c.peer}
                  >
                    {remarks[c.peer] || c.peer}
                    {c.unreadCount > 0 && (
                      <span className="ml-1.5 inline-flex min-w-[16px] h-4 px-1 items-center justify-center rounded-full text-[10px] font-bold bg-red-500 text-white">
                        {c.unreadCount > 99 ? '99+' : c.unreadCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            <div
              ref={messagesListRef}
              className="relative flex-1 overflow-y-auto overflow-x-hidden overscroll-contain py-4 space-y-3"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {loading && messages.length === 0 ? (
                <div className="flex justify-center py-20">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-20">
                  <div className="text-4xl mb-3 opacity-30"><i className="fas fa-comment-dots"></i></div>
                  <p>{t('internalChat.empty')}</p>
                </div>
              ) : (
                messages.map(m => {
                  const isMine = m.fromAddress === myAddress;
                  const isEditing = !!m.msgKey && editKey === m.msgKey;
                  return (
                    <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        onContextMenu={e => openContextMenu(e, m)}
                        className={`max-w-[80%] rounded-2xl px-4 py-3 cursor-context-menu ${
                          isMine
                            ? 'bg-primary text-primary-foreground rounded-br-sm'
                            : 'bg-muted rounded-bl-sm'
                        }`}
                      >
                        {isEditing ? (
                          <div className="flex flex-col gap-1.5">
                            <textarea
                              value={editText}
                              onChange={e => setEditText(e.target.value)}
                              rows={2}
                              autoFocus
                              placeholder={t('internalChat.editPlaceholder')}
                              className="w-full rounded-lg bg-background/85 text-foreground px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={cancelEdit}
                                className="px-3 py-1.5 rounded-lg text-xs bg-background/80 text-foreground border border-border hover:bg-background/60 transition-colors"
                              >
                                {t('internalChat.cancel')}
                              </button>
                              <button
                                onClick={saveEdit}
                                disabled={editing}
                                className="px-3 py-1.5 rounded-lg text-xs bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                              >
                                {editing ? '...' : t('internalChat.confirm')}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {m.textContent && (
                              <p className="whitespace-pre-wrap break-words">{m.textContent}</p>
                            )}
                            {m.attachments && m.attachments.length > 0 && (
                              <div className={`mt-2 space-y-1.5 ${!m.textContent ? 'mt-0' : ''}`}>
                                {m.attachments.map(att => (
                                  <button
                                    key={att.id}
                                    onClick={() => handleDownloadAttachment(att.id, att.filename)}
                                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs transition-colors ${
                                      isMine
                                        ? 'bg-primary-foreground/10 border-primary-foreground/20 hover:bg-primary-foreground/20'
                                        : 'bg-background/60 border-border hover:bg-background'
                                    }`}
                                    title={t('internalChat.download')}
                                  >
                                    <i className="fas fa-paperclip shrink-0"></i>
                                    <span className="flex-1 min-w-0">
                                      <span className={`block truncate font-medium ${isMine ? 'text-primary-foreground' : ''}`}>{att.filename}</span>
                                      <span className={`${isMine ? 'text-primary-foreground/60' : 'text-muted-foreground/70'}`}>{formatBytes(att.size)}</span>
                                    </span>
                                    <i className="fas fa-download shrink-0 opacity-70"></i>
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                        <div className={`text-[10px] mt-1 flex items-center gap-1.5 min-h-[14px] ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground/60'}`}>
                          <span>{formatTime(m.receivedAt)}</span>
                          {!!m.editedAt && (
                            <span title={`${t('internalChat.edited')} ${formatTime(m.editedAt)}`}>{t('internalChat.edited')}</span>
                          )}
                          {m.failed ? (
                            <button
                              onClick={() => retrySend(m)}
                              className="inline-flex items-center gap-1 text-red-300 hover:text-red-100 transition-colors"
                              title={t('internalChat.retry')}
                            >
                              <i className="fas fa-exclamation-circle"></i>
                              <span className="hidden sm:inline">{t('internalChat.retry')}</span>
                            </button>
                          ) : isMine && (
                            <span className="flex items-center gap-0.5">
                              {m.peerRead ? (
                                <span className="inline-flex items-center gap-0.5" title={t('internalChat.readAt', { time: formatTime(m.peerReadAt || 0) })}>
                                  <i className="fas fa-check-double"></i>
                                  <span className="hidden sm:inline">{t('internalChat.read')}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5">
                                  <i className="fas fa-check"></i>
                                  <span className="hidden sm:inline">{t('internalChat.delivered')}</span>
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
              {dragOver && (
                <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-2 bg-background/70 rounded-xl border-2 border-dashed border-primary pointer-events-none">
                  <i className="fas fa-cloud-upload-alt text-4xl text-primary"></i>
                  <p className="text-sm text-primary font-medium">{t('internalChat.dropHint')}</p>
                </div>
              )}
            </div>

            <div className="py-4 border-t">
              {penders.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {penders.map(p => (
                    <span key={p.id} className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-muted border text-xs max-w-[220px]">
                      <i className="fas fa-paperclip text-muted-foreground shrink-0"></i>
                      <span className="truncate">{p.name}</span>
                      <span className="text-muted-foreground/70 shrink-0">({formatBytes(p.size)})</span>
                      <button
                        onClick={() => removePender(p.id)}
                        className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-red-500/20 text-muted-foreground hover:text-red-500 shrink-0"
                        title={t('internalChat.remove')}
                      >
                        <i className="fas fa-times text-[9px]"></i>
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {showEmojiBar && (
                <div className="flex flex-wrap gap-1 mb-2 max-h-28 overflow-y-auto rounded-xl border bg-popover p-2">
                  {EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => setInput(v => v + emoji)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-lg hover:bg-muted transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
              {sendStatus !== 'idle' && (
                <div className={`text-xs mb-2 pr-1 flex items-center justify-end gap-1.5 ${
                  sendStatus === 'failed'
                    ? 'text-red-500'
                    : sendStatus === 'sent'
                      ? 'text-green-600'
                      : 'text-muted-foreground'
                }`}>
                  {sendStatus === 'sending' && <i className="fas fa-circle-notch fa-spin"></i>}
                  {sendStatus === 'sending' && t('internalChat.sending')}
                  {sendStatus === 'sent' && <i className="fas fa-check-circle"></i>}
                  {sendStatus === 'sent' && t('internalChat.sent')}
                  {sendStatus === 'failed' && <i className="fas fa-exclamation-triangle"></i>}
                  {sendStatus === 'failed' && t('internalChat.sendFailedShort')}
                </div>
              )}
              <div className="flex gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowEmojiBar(v => !v)}
                    className="w-11 h-11 rounded-full bg-muted/70 hover:bg-muted text-lg flex items-center justify-center shrink-0 transition-colors disabled:opacity-50"
                    title={t('internalChat.emoji')}
                    disabled={uploading}
                  >
                    😊
                  </button>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={e => handlePickFiles(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-11 h-11 rounded-full bg-muted/70 hover:bg-muted text-muted-foreground flex items-center justify-center shrink-0 transition-colors disabled:opacity-50"
                  title={t('internalChat.attach')}
                  disabled={uploading || penders.length >= 5}
                >
                  <i className="fas fa-paperclip"></i>
                </button>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => {
                    setInput(e.target.value);
                    if (sendStatus !== 'idle') setSendStatus('idle');
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={t('internalChat.inputPlaceholder')}
                  disabled={uploading}
                  className="flex-1 px-4 py-2.5 rounded-full border bg-background focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                />
                <button
                  onClick={handleSend}
                  disabled={uploading || (!input.trim() && penders.length === 0)}
                  className="px-6 py-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors font-medium"
                >
                  {uploading ? '↑' : t('internalChat.send')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {contextMenu && (() => {
        const target = messages.find(m => m.id === contextMenu.msgId);
        if (!target) return null;
        const isMine = target.fromAddress === myAddress;
        return (
          <div
            className="fixed z-[100] w-44 rounded-xl bg-popover border shadow-xl py-1.5 overflow-hidden"
            style={{ left: Math.min(contextMenu.x, window.innerWidth - 190), top: Math.min(contextMenu.y, window.innerHeight - 140) }}
            onClick={e => e.stopPropagation()}
          >
            <button
              className="w-full text-left px-4 py-2.5 text-sm text-popover-foreground hover:bg-muted transition-colors flex items-center gap-2"
              onClick={() => handleCopyMessage(target)}
            >
              <i className="fas fa-copy opacity-70"></i>
              <span>{t('internalChat.copy')}</span>
            </button>
            {isMine && (
              <button
                className="w-full text-left px-4 py-2.5 text-sm text-popover-foreground hover:bg-muted transition-colors flex items-center gap-2"
                onClick={() => startEdit(target)}
              >
                <i className="fas fa-pen opacity-70"></i>
                <span>{t('internalChat.edit')}</span>
              </button>
            )}
            {isMine && (
              <button
                className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                onClick={() => handleDeleteMessage(target)}
              >
                <i className="fas fa-trash opacity-70"></i>
                <span>{t('internalChat.delete')}</span>
              </button>
            )}
          </div>
        );
      })()}
    </Container>
  );
};

function formatTime(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default InternalChatPage;
